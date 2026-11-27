import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(explicitKeyHex?: string): Buffer {
  const keyHex = (explicitKeyHex ?? process.env.APP_ENCRYPTION_KEY ?? "").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "APP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts a secret string with AES-256-GCM.
 * Output format: "v1:<iv_base64>:<authTag_base64>:<ciphertext_base64>"
 */
export function encryptSecret(plaintext: string, explicitKeyHex?: string): string {
  const key = getEncryptionKey(explicitKeyHex);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypts a secret produced by `encryptSecret`.
 */
export function decryptSecret(payload: string, explicitKeyHex?: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted secret format.");
  }
  const [, ivB64, tagB64, dataB64] = parts;
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Incomplete encrypted secret payload.");
  }

  const key = getEncryptionKey(explicitKeyHex);
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Verifies Razorpay Checkout signature: HMAC-SHA256(orderId + "|" + paymentId, keySecret).
 */
export function verifyRazorpayCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!params.orderId || !params.paymentId || !params.signature || !params.keySecret) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", params.keySecret)
    .update(`${params.orderId}|${params.paymentId}`)
    .digest("hex");

  return timingSafeEqualHex(expected, params.signature);
}

/**
 * Verifies Razorpay Webhook signature: HMAC-SHA256(rawBody, webhookSecret).
 */
export function verifyRazorpayWebhookSignature(params: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  if (!params.rawBody || !params.signature || !params.webhookSecret) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", params.webhookSecret)
    .update(params.rawBody, "utf8")
    .digest("hex");

  return timingSafeEqualHex(expected, params.signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  if (normalizedA.length !== normalizedB.length || normalizedA.length === 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(normalizedA, "utf8"),
      Buffer.from(normalizedB, "utf8")
    );
  } catch {
    return false;
  }
}
