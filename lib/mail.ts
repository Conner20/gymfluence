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
  <div style="margin:0;padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="left" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;border-collapse:collapse;">
            <tr>
              <td align="left" style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
                
                <div style="font-size:18px;font-weight:600;line-height:1.3;margin:0 0 14px 0;">
                  Reset password
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px 0;">
                  <tr>
                    <td style="border-radius:10px;background:#16a34a;">
                      <a href="${resetUrl}"
                        style="display:inline-block;padding:10px 14px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                               font-size:14px;font-weight:600;line-height:1;text-decoration:none;color:#ffffff;border-radius:10px;">
                        Continue
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 22px 0;">
                  Link expires in 1 hour.
                </div>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 6px 0;">
                  Or paste:
                </div>

                <div style="font-size:12px;line-height:1.6;margin:0 0 22px 0;">
                  <a href="${resetUrl}" style="color:#111827;text-decoration:underline;word-break:break-word;">
                    ${resetUrl}
                  </a>
                </div>

                <!-- Logo (bottom) -->
                <div style="margin-top:10px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1;">
                  <span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;">fitt</span><span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:2px;text-decoration-color:#15803d;">in</span><span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;">g</span>
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
  <div style="margin:0;padding:0;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td align="left" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;border-collapse:collapse;">
            <tr>
              <td align="left" style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;">
                
                <div style="font-size:18px;font-weight:600;line-height:1.3;margin:0 0 14px 0;">
                  Verify email
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 14px 0;">
                  <tr>
                    <td style="border-radius:10px;background:#16a34a;">
                      <a href="${verifyUrl}"
                        style="display:inline-block;padding:10px 14px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
                               font-size:14px;font-weight:600;line-height:1;text-decoration:none;color:#ffffff;border-radius:10px;">
                        Continue
                      </a>
                    </td>
                  </tr>
                </table>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 22px 0;">
                  This link may expire soon.
                </div>

                <div style="font-size:12px;line-height:1.6;color:#6b7280;margin:0 0 6px 0;">
                  Or paste:
                </div>

                <div style="font-size:12px;line-height:1.6;margin:0 0 22px 0;">
                  <a href="${verifyUrl}" style="color:#111827;text-decoration:underline;word-break:break-word;">
                    ${verifyUrl}
                  </a>
                </div>

                <!-- Logo (bottom) -->
                <div style="margin-top:10px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1;">
                  <span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;">fitt</span><span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:2px;text-decoration-color:#15803d;">in</span><span style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:#15803d;">g</span>
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
