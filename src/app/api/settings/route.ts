import { NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto";
import { parseNextNumberInput } from "@/lib/invoice-number";
import { toBusinessPublicDTO, type BusinessRow } from "@/lib/supabase/mappers";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import {
  isValidEmail,
  isValidGstin,
  validateLogoDataUrl,
  type FieldErrors,
} from "@/lib/validation";

export async function GET() {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }
    return NextResponse.json({ business: toBusinessPublicDTO(auth.business) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface PatchSettingsBody {
  section?: "invoice" | "payment" | "email";
  name?: string;
  logoDataUrl?: string | null;
  address?: string;
  gstin?: string;
  phone?: string;
  contactEmail?: string;
  invoicePrefix?: string;
  nextNumberInput?: string;
  defaultGstRate?: number | string;
  defaultDueDays?: number | string;
  defaultNotes?: string;
  defaultTerms?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  clearRazorpay?: boolean;
  smtpHost?: string;
  smtpPort?: number | string;
  smtpSecure?: boolean;
  smtpEmail?: string;
  smtpPassword?: string;
  clearSmtpPassword?: boolean;
  emailSubjectTemplate?: string;
  emailBodyTemplate?: string;
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as PatchSettingsBody;
    const section = body.section ?? "invoice";
    const updates: Record<string, unknown> = {};
    const fieldErrors: FieldErrors = {};

    if (section === "invoice") {
      const name = (body.name ?? "").trim();
      if (!name) fieldErrors.name = "Enter your business name.";
      else updates.name = name;

      if (body.logoDataUrl !== undefined) {
        const logoErr = validateLogoDataUrl(body.logoDataUrl);
        if (logoErr) fieldErrors.logoDataUrl = logoErr;
        else updates.logo_data_url = body.logoDataUrl ? body.logoDataUrl.trim() : null;
      }

      const gstin = (body.gstin ?? "").trim().toUpperCase();
      if (!isValidGstin(gstin)) {
        fieldErrors.gstin = "Enter a valid 15-character GSTIN (e.g. 27ABCDE1234F1Z5) or leave blank.";
      } else {
        updates.gstin = gstin;
      }

      const contactEmail = (body.contactEmail ?? "").trim();
      if (contactEmail && !isValidEmail(contactEmail)) {
        fieldErrors.contactEmail = "Enter a valid email address like billing@yourbusiness.com.";
      } else {
        updates.contact_email = contactEmail;
      }

      updates.address = (body.address ?? "").trim();
      updates.phone = (body.phone ?? "").trim();

      const prefix = body.invoicePrefix ?? "";
      if (!prefix.trim()) {
        fieldErrors.invoicePrefix = "Enter an invoice prefix such as INV- or ABC/26-27/.";
      } else if (prefix.length > 24) {
        fieldErrors.invoicePrefix = "Invoice prefix must be 24 characters or fewer.";
      } else {
        updates.invoice_prefix = prefix;
      }

      const nextParsed = parseNextNumberInput(body.nextNumberInput ?? "");
      if (!nextParsed) {
        fieldErrors.nextNumberInput = "Enter a positive number such as 0001 or 001.";
      } else {
        updates.next_invoice_number = nextParsed.nextNumber;
        updates.invoice_number_padding = nextParsed.padding;
      }

      const gstRate = Number(body.defaultGstRate);
      if (!Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
        fieldErrors.defaultGstRate = "Enter a GST rate between 0 and 100.";
      } else {
        updates.default_gst_rate = Number(gstRate.toFixed(2));
      }

      const dueDays = Number(body.defaultDueDays);
      if (!Number.isInteger(dueDays) || dueDays < 0 || dueDays > 365) {
        fieldErrors.defaultDueDays = "Enter whole days between 0 and 365.";
      } else {
        updates.default_due_days = dueDays;
      }

      updates.default_notes = (body.defaultNotes ?? "").trim();
      updates.default_terms = (body.defaultTerms ?? "").trim();
    } else if (section === "payment") {
      if (body.clearRazorpay) {
        updates.razorpay_key_id = null;
        updates.razorpay_key_secret_enc = null;
        updates.razorpay_webhook_secret_enc = null;
      } else {
        const keyId = (body.razorpayKeyId ?? "").trim();
        const keySecret = (body.razorpayKeySecret ?? "").trim();
        const webhookSecret = (body.razorpayWebhookSecret ?? "").trim();

        if (!keyId) {
          fieldErrors.razorpayKeyId = "Enter your Razorpay Key ID (starts with rzp_test_).";
        } else if (!keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
          fieldErrors.razorpayKeyId = "Key ID should start with rzp_test_ (for Test Mode).";
        } else {
          updates.razorpay_key_id = keyId;
        }

        if (!auth.business.razorpay_key_secret_enc && !keySecret) {
          fieldErrors.razorpayKeySecret = "Enter your Razorpay Key Secret.";
        } else if (keySecret) {
          updates.razorpay_key_secret_enc = encryptSecret(keySecret);
        }

        if (webhookSecret) {
          updates.razorpay_webhook_secret_enc = encryptSecret(webhookSecret);
        }
      }
    } else if (section === "email") {
      const smtpHost = (body.smtpHost ?? "").trim();
      if (!smtpHost) {
        fieldErrors.smtpHost = "Enter your SMTP host (e.g. smtp.gmail.com).";
      } else {
        updates.smtp_host = smtpHost;
      }

      const smtpPort = Number(body.smtpPort);
      if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
        fieldErrors.smtpPort = "Enter a valid SMTP port (e.g. 465 or 587).";
      } else {
        updates.smtp_port = smtpPort;
      }

      updates.smtp_secure = Boolean(body.smtpSecure);

      const smtpEmail = (body.smtpEmail ?? "").trim();
      if (!smtpEmail) {
        fieldErrors.smtpEmail = "Enter your sender email address.";
      } else if (!isValidEmail(smtpEmail)) {
        fieldErrors.smtpEmail = "Enter a valid email address like you@gmail.com.";
      } else {
        updates.smtp_email = smtpEmail;
      }

      const smtpPassword = (body.smtpPassword ?? "").trim();
      if (body.clearSmtpPassword) {
        updates.smtp_password_enc = null;
      } else if (!auth.business.smtp_password_enc && !smtpPassword) {
        fieldErrors.smtpPassword = "Enter your email App Password.";
      } else if (smtpPassword) {
        updates.smtp_password_enc = encryptSecret(smtpPassword);
      }

      const subjectTpl = (body.emailSubjectTemplate ?? "").trim();
      if (!subjectTpl) {
        fieldErrors.emailSubjectTemplate = "Enter an email subject template.";
      } else {
        updates.email_subject_template = subjectTpl;
      }

      const bodyTpl = (body.emailBodyTemplate ?? "").trim();
      if (!bodyTpl) {
        fieldErrors.emailBodyTemplate = "Enter an email message template.";
      } else {
        updates.email_body_template = bodyTpl;
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields.", fieldErrors },
        { status: 400 }
      );
    }

    const { data: updated, error: updateError } = await auth.supabase
      .from("businesses")
      .update(updates)
      .eq("id", auth.business.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Could not save settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      business: toBusinessPublicDTO(updated as BusinessRow),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
