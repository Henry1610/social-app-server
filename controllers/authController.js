import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import jwt from "jsonwebtoken";
import { createAccessToken, createRefreshToken, createResetPasswordToken } from "../utils/token.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS } from "../utils/sms.js"
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/send-otp
export const sendOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res
        .status(400)
        .json({ message: "Email hoặc số điện thoại là bắt buộc" });
    }

    // Kiểm tra email đã tồn tại chưa
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) {
        return res.status(400).json({ message: "Email đã tồn tại" });
      }
    }

    // Kiểm tra phone đã tồn tại chưa
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
      if (existingPhone) {
        return res.status(400).json({ message: "Số điện thoại đã tồn tại" });
      }
    }

    // Sinh OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Lưu vào bảng otp_verifications
    await prisma.otpVerification.create({
      data: {
        email,
        phone,
        otp,
        expiresAt,
        used: false
      },
    });

    // Gửi OTP
    if (email) {
      await sendEmail(email, `Mã OTP của bạn là: ${otp}`);
    }
    if (phone) {
      await sendSMS(phone, `Mã OTP của bạn là: ${otp}`);
    }

    return res.json({ message: "OTP đã được gửi !" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ message: "Lỗi Server" });
  }
};

// POST /api/auth/verify-otp-register
export const verifyOtpAndRegister = async (req, res) => {
  try {
    const { username, email, phone, password, fullName, otp } = req.body;
      
    if ((!email && !phone) || (email && phone)) {
      return res.status(400).json({
        message: "Bạn phải nhập 1 trong 2: email hoặc phone",
      });
    }
    // tìm OTP còn hạn và chưa dùng
    const otpRecord = await prisma.otpVerification.findFirst({
      where: {
        otp:String(otp),
        used: false,
        expiresAt: { gt: new Date() },
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean),
      },
    });


    if (!otpRecord) {
      return res.status(400).json({ message: "OTP không hợp lệ" });
    }

    // mark OTP là đã dùng
    await prisma.otpVerification.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // hash password và tạo user
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone,
        passwordHash: hashedPassword,
        fullName,
      },
    });
    const accessToken = createAccessToken(user);
    const refreshToken = createAccessToken(user);

    return res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi Sever" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if (!email && !phone) {
      return res
        .status(400)
        .json({ message: "Email hoặc số điện thoại là bắt buộc" });
    }

    // Tìm user theo email hoặc phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          email ? { email } : undefined,
          phone ? { phone } : undefined,
        ].filter(Boolean),
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // Tạo JWT
    const accessToken = createAccessToken(user);
    const refreshToken = createRefreshToken(user);
    return res.json({
      message: "Đăng nhập thành công",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Lỗi Server" });
  }
};

// POST /api/auth/refresh-token
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: "Không có refresh token!" });
    }

    // tìm trong DB (chỉnh lại field)
    const storedToken = await prisma.refreshToken.findUnique({
      where: { refreshToken: refreshToken },  // đổi từ token -> refresh_token
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date() || storedToken.revoked) {
      return res.status(403).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn!" });
    }

    // verify token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // tạo access token mới
    const accessToken = jwt.sign(
      { id: storedToken.userId, role: storedToken.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({ accessToken });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/change-password
export const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!req.user) {
    return res.status(401).json({ message: "Chưa đăng nhập" });
  }

  // Lấy user từ DB
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  // Kiểm tra mật khẩu cũ
  const isMatch = await bcrypt.compare(oldPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Mật khẩu cũ không đúng" });
  }

  // Hash mật khẩu mới
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update DB
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: "Đổi mật khẩu thành công" });
};

// POST /api/auth/forgot-password
export const requestResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "Email không tồn tại" });

    const token = createResetPasswordToken(user.id);
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail(email, `<p>Click link để reset mật khẩu:</p><a href="${resetLink}">${resetLink}</a>`);

    res.json({ message: "Gửi email reset mật khẩu thành công" });
  } catch (error) {
    console.error("requestResetPassword error:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token) return res.status(400).json({ message: "Token không được để trống" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
    const userId = decoded.id;

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    res.json({ message: "Reset mật khẩu thành công" });
  } catch (err) {
    res.status(400).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) return res.status(400).json({ message: "Token không được để trống" });

  await prisma.refreshToken.deleteMany({
    where: { refreshToken },
  });

  res.json({ message: "Đăng xuất thành công" });
};
