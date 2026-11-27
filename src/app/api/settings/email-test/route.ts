import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/crypto";
import { formatSmtpError, sendBusinessEmail } from "@/lib/email";
import { getAuthenticatedBusiness } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedBusiness();
    if (!auth) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      toEmail?: string;
      smtpHost?: string;
      smtpPort?: number | string;
      smtpSecure?: boolean;
      smtpEmail?: string;
      smtpPassword?: string;
    };

    const host = (body.smtpHost ?? auth.business.smtp_host ?? "smtp.gmail.com").trim();
    const port = Number(body.smtpPort ?? auth.business.smtp_port ?? 465);
    const secure =
      body.smtpSecure !== undefined ? Boolean(body.smtpSecure) : auth.business.smtp_secure;
    const smtpEmail = (body.smtpEmail ?? auth.business.smtp_email ?? "").trim();
    let smtpPassword = (body.smtpPassword ?? "").trim();

    if (!smtpPassword && auth.business.smtp_password_enc) {
      smtpPassword = decryptSecret(auth.business.smtp_password_enc);
    }

    const toEmail = (body.toEmail ?? smtpEmail).trim();

    if (!smtpEmail || !smtpPassword) {
      return NextResponse.json(
        {
          ok: false,
          message: "Enter your sender email address and App Password before sending a test email.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(toEmail)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Enter a valid recipient email address for the test email.",
        },
        { status: 400 }
      );
    }

    await sendBusinessEmail({
      smtp: {
        host,
        port: Number.isInteger(port) ? port : 465,
        secure,
        email: smtpEmail,
        password: smtpPassword,
      },
      fromName: auth.business.name,
      to: toEmail,
      subject: `Test email from ${auth.business.name} (Quick Invoice)`,
      text: `Hello,\n\nThis is a test email confirming that ${auth.business.name} can send invoices from ${smtpEmail}.\n\nSent via Quick Invoice.`,
    });

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${toEmail}! Your email settings are working.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: formatSmtpError(err) },
      { status: 400 }
    );
  }
}
