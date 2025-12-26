import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (email, htmlContent, options = {}) => {
  try {
    const { subject = "Thông báo từ Insta App" } = options;
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        ${htmlContent}
        <p style="margin-top: 30px; color: #666; font-size: 14px;">Trân trọng,<br/>Insta App</p>
      </div>
    `;

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: email,
      subject,
      html: emailHtml,
    });
  } catch (error) {
    console.error("Email sending error:", error);
  }
};
