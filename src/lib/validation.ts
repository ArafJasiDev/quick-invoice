export type FieldErrors<T extends string = string> = Partial<Record<T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidGstin(value: string): boolean {
  const normalized = value.trim().toUpperCase();
  return normalized.length === 0 || GSTIN_RE.test(normalized);
}

export function validateLogoDataUrl(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return null;
  const trimmed = dataUrl.trim();
  if (!trimmed) return null;
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed);
  if (!match) {
    return "Logo must be a PNG, JPEG, or WebP image file.";
  }
  if (trimmed.length > 750_000) {
    return "Logo image is too large. Please choose an image under 500 KB.";
  }
  return null;
}

export function validateCustomerInput(input: {
  name: string;
  email: string;
  phone: string;
}): FieldErrors<"name" | "email" | "phone"> {
  const errors: FieldErrors<"name" | "email" | "phone"> = {};
  if (!input.name.trim()) {
    errors.name = "Enter the customer's name.";
  }
  if (!input.email.trim()) {
    errors.email = "Enter the customer's email address.";
  } else if (!isValidEmail(input.email)) {
    errors.email = "Enter an email address like name@example.com.";
  }
  if (input.phone.trim().length > 25) {
    errors.phone = "Phone number is too long (max 25 characters).";
  }
  return errors;
}
