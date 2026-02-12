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
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Reset your password</h2>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px">Reset Password</a></p>
      <p>If the button doesn't work, paste this link into your browser:<br/>${resetUrl}</p>
    </div>
  `;

    await sendMail(to, subject, html, "[password-reset]", `[password-reset] ${to}: ${resetUrl}`);
};

export const sendEmailVerificationEmail: Mailer = async (to, verifyUrl) => {
    const subject = "Verify your Fitting In email";
    const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Verify your email</h2>
      <p>Confirm your email to finish creating your Fitting In account.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p>
      <p>If that button doesn’t work, copy and paste this link into your browser:<br/>${verifyUrl}</p>
    </div>
  `;

    await sendMail(to, subject, html, "[verify-email]", `[verify-email] ${to}: ${verifyUrl}`);
};
