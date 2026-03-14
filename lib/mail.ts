import { Resend } from "resend";

type Mailer = (to: string, url: string) => Promise<void>;

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendMail(to: string, subject: string, html: string, fallbackLabel: string, fallbackUrl: string) {
    if (resendClient) {
        const { error } = await resendClient.emails.send({
            from: process.env.EMAIL_FROM || "Fitting In <mail@fittingin.co>",
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
      <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Reset your password</title>
</head>

<body style="margin:0;padding:0;background-color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="border-collapse:collapse;background-color:#ffffff;margin:0;padding:0;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
                    style="border-collapse:collapse;width:560px;max-width:100%;background-color:#ffffff;">
                    <tr>
                        <td align="center"
                            style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;text-align:center;">
                            <p
                                style="margin:0 0 12px 0;font-size:13px;line-height:1.4;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#16a34a;">
                                Find your fit
                            </p>

                            <h1
                                style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;">
                                Reset your password
                            </h1>

                            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">
                                Need to reset your Fitting In password? Click the button below to get back into your account.
                                If you did not request this, you can safely ignore this email.
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
                                style="border-collapse:collapse;margin:0 auto 24px auto;">
                                <tr>
                                    <td align="center" bgcolor="#16a34a"
                                        style="border-radius:999px;background-color:#16a34a;">
                                        <a href="${resetUrl}"
                                            style="display:inline-block;padding:14px 26px;font-size:15px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
                                            Reset password
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#0f172a;">
                                Have a question? Visit
                                <a href="https://fittingin.co/legal/support"
                                    style="color:#16a34a;text-decoration:none;">
                                    Support
                                </a>.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>

</html>
    `.trim();

    await sendMail(to, subject, html, "[password-reset]", `[password-reset] ${to}: ${resetUrl}`);
};

export const sendEmailVerificationEmail: Mailer = async (to, verifyUrl) => {
    const subject = "Verify your Fitting In email";

    const html = `
      <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to Fitting In</title>
</head>

<body style="margin:0;padding:0;background-color:#ffffff;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
        style="border-collapse:collapse;background-color:#ffffff;margin:0;padding:0;">
        <tr>
            <td align="center" style="padding:32px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560"
                    style="border-collapse:collapse;width:560px;max-width:100%;background-color:#ffffff;">
                    <tr>
                        <td align="center"
                            style="padding:32px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;text-align:center;">
                            <p
                                style="margin:0 0 12px 0;font-size:13px;line-height:1.4;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#16a34a;">
                                Find your fit
                            </p>

                            <h1
                                style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;">
                                Welcome to Fitting In!
                            </h1>

                            <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#475569;">
                                Join the fitness marketplace built to help you grow. <br> Take your next step with Fitting
                                In.
                            </p>

                            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"
                                style="border-collapse:collapse;margin:0 auto 24px auto;">
                                <tr>
                                    <td align="center" bgcolor="#16a34a"
                                        style="border-radius:999px;background-color:#16a34a;">
                                        <a href="${verifyUrl}"
                                            style="display:inline-block;padding:14px 26px;font-size:15px;line-height:1.2;font-weight:600;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
                                            Verify email
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0 0 24px 0;font-size:14px;line-height:1.5;color:#0f172a;">
                                Have a question? Visit
                                <a href="https://fittingin.co/legal/support"
                                    style="color:#16a34a;text-decoration:none;">
                                    Support
                                </a>.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
    `.trim();

    await sendMail(to, subject, html, "[verify-email]", `[verify-email] ${to}: ${verifyUrl}`);
};
