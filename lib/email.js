import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL || "Smart Hospital Digitalization System <no-reply@resend.dev>";

export async function sendPasswordResetEmail(email, resetUrl) {
  try {
    if (!resendApiKey) {
      console.warn("RESEND_API_KEY is not configured in .env");
      return { success: false, message: "Email service is not configured" };
    }

    const resend = new Resend(resendApiKey);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              background-color: #f9fafb;
              margin: 0;
              padding: 40px 20px;
            }
            .container {
              max-width: 560px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 16px;
              padding: 40px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
              border: 1px solid #f3f4f6;
            }
            h1 {
              font-size: 24px;
              font-weight: 800;
              letter-spacing: -0.025em;
              color: #0f172a;
              margin-top: 0;
              margin-bottom: 24px;
            }
            p {
              font-size: 15px;
              line-height: 1.6;
              color: #475569;
              margin-top: 0;
              margin-bottom: 28px;
            }
            .btn {
              display: inline-block;
              background-color: #6366f1;
              color: #ffffff !important;
              font-size: 15px;
              font-weight: 700;
              text-decoration: none;
              padding: 14px 28px;
              border-radius: 12px;
              text-align: center;
              box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
            }
            .btn:hover {
              background-color: #4f46e5;
            }
            .footer {
              margin-top: 36px;
              font-size: 13px;
              line-height: 1.5;
              color: #64748b;
              border-top: 1px solid #f1f5f9;
              padding-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Reset your password</h1>
            <p>We received a request to reset your Smart Hospital Digitalization System password.</p>
            <div style="margin-bottom: 32px;">
              <a href="${resetUrl}" class="btn" target="_blank">Reset password</a>
            </div>
            <div class="footer">
              This link expires in 5 minutes and can be used only once. If you did not request it, you can safely ignore this email.
            </div>
          </div>
        </body>
      </html>
    `;

    const response = await resend.emails.send({
      from: resendFromEmail,
      to: [email],
      subject: "Reset your password",
      html: htmlContent,
    });

    if (response.error) {
      console.error("Resend send email error:", response.error);
      return { success: false, message: response.error.message || "Failed to send email" };
    }

    return { success: true, message: "Password reset email sent successfully", data: response };
  } catch (error) {
    console.error("sendPasswordResetEmail exception:", error);
    return { success: false, message: "Failed to send password reset email" };
  }
}
