import { Resend } from "resend";

type Mailer = (to: string, url: string) => Promise<void>;

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendMail(to: string, subject: string, html: string, fallbackLabel: string, fallbackUrl: string) {
    if (resendClient) {
        const { error } = await resendClient.emails.send({
            from: process.env.EMAIL_FROM || "mail@fittingin.co",
            to,
            subject,
            html,
        });
        if (error) {
            console.error("[mail] resend error", error);
            throw new Error(error.message || "Failed to send verification email via Resend");
        }
        return;
    }

    console.warn(`No email provider configured. ${fallbackLabel} logged to console.`);
    console.info(fallbackUrl);
}

export const sendPasswordResetEmail: Mailer = async (to, resetUrl) => {
    const subject = "Reset your Fitting In password";

    const html = `
  <div style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
                <div style="font-size:18px;font-weight:600;line-height:1.3;margin:0 0 12px 0;">
                  Reset your password
                </div>

                <div style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px 0;">
                  Use the button below to set a new password. This link expires in <span style="color:#111827;font-weight:600;">1 hour</span>.
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px 0;">
                  <tr>
                    <td style="border-radius:10px;background:#16a34a;">
                      <a href="${resetUrl}"
                        style="display:inline-block;padding:10px 14px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                               font-size:14px;font-weight:600;line-height:1;text-decoration:none;color:#ffffff;border-radius:10px;">
                        Reset password
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 8px 0;">
                  If the button doesn’t work, copy and paste this link:
                </div>

                <div style="font-size:12px;line-height:1.6;margin:0 0 22px 0;">
                  <a href="${resetUrl}" style="color:#111827;text-decoration:underline;word-break:break-word;">
                    ${resetUrl}
                  </a>
                </div>

                <div style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0;">
                  If you didn’t request a password reset, you can safely ignore this email.
                </div>

                <div style="font-size:12px;line-height:1.6;color:#9ca3af;margin:16px 0 0 0;">
                  — Fitting In
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();

    await sendMail(to, subject, html, "[password-reset]", `[password-reset] ${to}: ${resetUrl}`);
};

export const sendEmailVerificationEmail: Mailer = async (to, verifyUrl) => {
    const subject = "Verify your Fitting In email";

    const html = `
  <div style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
                <div style="font-size:18px;font-weight:600;line-height:1.3;margin:0 0 12px 0;">
                  Verify your email
                </div>

                <div style="font-size:14px;line-height:1.6;color:#374151;margin:0 0 20px 0;">
                  Confirm your email address to finish creating your Fitting In account.
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 20px 0;">
                  <tr>
                    <td style="border-radius:10px;background:#16a34a;">
                      <a href="${verifyUrl}"
                        style="display:inline-block;padding:10px 14px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                               font-size:14px;font-weight:600;line-height:1;text-decoration:none;color:#ffffff;border-radius:10px;">
                        Verify email
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 8px 0;">
                  If the button doesn’t work, copy and paste this link:
                </div>

                <div style="font-size:12px;line-height:1.6;margin:0 0 22px 0;">
                  <a href="${verifyUrl}" style="color:#111827;text-decoration:underline;word-break:break-word;">
                    ${verifyUrl}
                  </a>
                </div>

                <div style="font-size:12px;line-height:1.6;color:#9ca3af;margin:0;">
                  If you didn’t create an account, you can ignore this email.
                </div>

                <div style="font-size:12px;line-height:1.6;color:#9ca3af;margin:16px 0 0 0;">
                  — Fitting In
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `.trim();

    await sendMail(to, subject, html, "[verify-email]", `[verify-email] ${to}: ${verifyUrl}`);
};

