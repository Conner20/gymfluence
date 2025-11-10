// lib/mail.ts

type Mailer = (to: string, resetUrl: string) => Promise<void>;

/**
 * Sends a password reset email.
 * Uses Resend if RESEND_API_KEY is present; otherwise falls back to SMTP via Nodemailer.
 */
export const sendPasswordResetEmail: Mailer = async (to, resetUrl) => {
    const from = process.env.EMAIL_FROM || 'no-reply@gymfluence.app';
    const subject = 'Reset your Gymfluence password';
    const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
      <h2>Reset your password</h2>
      <p>Click the button below to set a new password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#16a34a;color:#fff;text-decoration:none;border-radius:8px">Reset Password</a></p>
      <p>If the button doesn't work, paste this link into your browser:<br/>${resetUrl}</p>
    </div>
  `;

    // Prefer Resend in environments where it's configured
    if (process.env.RESEND_API_KEY) {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({ from, to, subject, html });
        return;
    }

    // Fallback: Nodemailer SMTP
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        }
    });

    await transporter.sendMail({ from, to, subject, html });
};
