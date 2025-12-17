import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async (email, otp) => {
  try {
    await resend.emails.send({
      from: `Insta <${process.env.EMAIL_FROM}>`,
      to: email,
      subject: "Mã xác thực đăng ký tài khoản",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">Xác thực đăng ký tài khoản</h2>
          <p>Xin chào!</p>
          <p>Cảm ơn bạn đã đăng ký tài khoản. Vui lòng sử dụng mã OTP sau để hoàn tất quá trình đăng ký:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <ul>
            <li>Mã OTP có hiệu lực trong 5 phút.</li>
            <li>Không chia sẻ mã này với bất kỳ ai.</li>
          </ul>
          <p>Trân trọng,<br/>Insta App</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Email sending error:", error);
  }
};
