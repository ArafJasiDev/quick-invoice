import nodemailer from "nodemailer";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  email: string;
  password: string;
}

export function formatSmtpError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("invalid login") || lower.includes("535") || lower.includes("username and password not accepted")) {
    return "Email login failed. For Gmail, use a 16-character App Password (not your regular Gmail password).";
  }
  if (lower.includes("econnrefused") || lower.includes("enotfound") || lower.includes("etimedout")) {
    return "Could not connect to the mail server. Check your SMTP host and port.";
  }
  if (lower.includes("self signed") || lower.includes("certificate")) {
    return "TLS/SSL handshake failed with the mail server. Try toggling SSL/TLS or switching between port 465 and 587.";
  }
  return raw || "Failed to send email. Check your email settings and try again.";
}

export async function sendBusinessEmail(params: {
  smtp: SmtpConfig;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  attachment?: {
    filename: string;
    content: Buffer;
  };
}): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: params.smtp.host,
    port: params.smtp.port,
    secure: params.smtp.secure,
    auth: {
      user: params.smtp.email,
      pass: params.smtp.password,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  await transporter.sendMail({
    from: `"${params.fromName.replaceAll('"', "")}" <${params.smtp.email}>`,
    to: params.to,
    subject: params.subject,
    text: params.text,
    attachments: params.attachment
      ? [
          {
            filename: params.attachment.filename,
            content: params.attachment.content,
            contentType: "application/pdf",
          },
        ]
      : undefined,
  });
}
