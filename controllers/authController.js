import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import jwt from "jsonwebtoken";
import passport from "passport";
import { redisClient } from "../utils/cache.js";
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
    // Sinh OTP và lưu Redis TTL (5-15 phút)
    const otp = generateOTP();
    const ttlSec = 5 * 60;
    const key = email ? `otp:register-email:${email}` : `otp:phone:${phone}`;
    await redisClient.set(key, otp, "EX", ttlSec);

    // Gửi OTP
    if (email) await sendEmail(email, `Mã OTP của bạn là: ${otp}`);
    if (phone) await sendSMS(phone, `Mã OTP của bạn là: ${otp}`);

    return res.json({ message: "OTP đã được gửi !" });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Gửi OTP thất bại!" });
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
    // Lấy OTP từ Redis và so khớp
    const key = email ? `otp:register-email:${email}` : `otp:phone:${phone}`;
    const cachedOtp = await redisClient.get(key);
    if (!cachedOtp || cachedOtp !== String(otp)) {
      return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn" });
    }
    // Xóa OTP ngay sau khi dùng
    await redisClient.del(key);

    // hash password và tạo user cùng với privacy settings
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone,
        passwordHash: hashedPassword,
        fullName,
        avatarUrl: "/images/avatar-IG-mac-dinh-1.jpg",
        privacySettings: {
          create: {
            isPrivate: false,
            whoCanMessage: "everyone",
            whoCanTagMe: "everyone",
            whoCanFindByUsername: true,
            showOnlineStatus: true,
          },
        },
      },
      include: {
        privacySettings: true,
      },
    });

    const accessToken = createAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    return res.status(201).json({
      message: "Đăng ký thành công",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        privacySettings: user.privacySettings,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
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

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Sai mật khẩu" });
    }

    // Tạo tokens
    const accessToken = createAccessToken(user);
    const refreshToken = await createRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // CHỈ TRẢ AT trong response body
    return res.json({
      message: "Đăng nhập thành công",
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: user.role,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        privacySettings: user.privacySettings
          ? {
            isPrivate: user.privacySettings.isPrivate,
            whoCanMessage: user.privacySettings.whoCanMessage,
            whoCanTagMe: user.privacySettings.whoCanTagMe,
            whoCanFindByUsername: user.privacySettings.whoCanFindByUsername,
            showOnlineStatus: user.privacySettings.showOnlineStatus,
          }
          : null,
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Đăng nhập thất bại!" });
  }
};

// POST /api/auth/refresh-token
export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(400).json({ message: "Không có refresh token!" });
    }
    // tìm token trong DB redis
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const stored = await redisClient.get(`refresh:${decoded.id}`);
    if (!stored || stored !== refreshToken) {
      return res.status(403).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn!" });
    }

    //  Lấy lại user từ DB
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, email: true, username: true }
    });

    if (!user) {
      return res.status(400).json({ message: "Người dùng không tồn tại" });
    }
    // tạo access token mới
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({
      success: true,
      accessToken
    });
  } catch (error) {
    return res.status(500).json({ message: "Làm mới token thất bại!" });
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

    // Rate limit handled by express-rate-limit middleware

    const token = createResetPasswordToken(user.id);
    const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    await sendEmail(email, `<p>Click link để reset mật khẩu:</p><a href="${resetLink}">${resetLink}</a>`);

    res.json({ message: "Gửi email reset mật khẩu thành công" });
  } catch (error) {
    return res.status(500).json({ error: "Gửi email reset mật khẩu thất bại!" });
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
    return res.status(500).json({ error: "Reset mật khẩu thất bại!" });
  }
};

// POST /api/auth/logout
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      // Xóa refresh token khỏi Redis
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      await redisClient.del(`refresh:${decoded.id}`);
    }

    // Xóa cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    res.json({ message: "Logout thành công" });
  } catch (error) {
    return res.status(500).json({ error: "Logout thất bại!" });
  }
};

// GET /api/auth/me - Lấy thông tin user hiện tại
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        provider: true,
        facebookId: true,
        privacySettings: {
          select: {
            isPrivate: true,
            whoCanMessage: true,
            whoCanTagMe: true,
            whoCanFindByUsername: true,
            showOnlineStatus: true,
          },
        },
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({ error: "Lấy thông tin người dùng thất bại!" });
  }
};

// GET /api/auth/facebook/callback - Xử lý Facebook OAuth callback
export const facebookCallback = (req, res, next) => {
  passport.authenticate("facebook", (err, authData, info) => {
    if (err) {
      console.error("Passport error:", err);
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }
    if (!authData.user) {
      console.log("No user returned from Facebook");
      return res.redirect(`${process.env.CLIENT_URL}/login?error=no_user`);
    }
    try {
      const { user, tokens } = authData;

      // Lưu vào session tạm (5 phút)
      req.session.tempAuth = {
        accessToken: tokens.accessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          avatarUrl: user.avatarUrl,
          provider: user.provider
        }
      };

      // Lưu Refresh Token vào httpOnly cookie
      res.cookie('refreshToken', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
      });

      // Redirect về frontend callback page
      res.redirect(`${process.env.CLIENT_URL}/auth/callback`);

    } catch (error) {
      res.redirect(`${process.env.CLIENT_URL}/login?error=server_error`);
    }
  })(req, res, next);
};

// GET /api/auth/session-auth - Lấy auth data từ session
export const getSessionAuth = (req, res) => {
  // Check session tồn tại
  if (!req.session || !req.session.tempAuth) {
    return res.status(500).json({ message: "Không tìm thấy session auth!" });
  }

  const authData = req.session.tempAuth;

  // Xóa session sau khi lấy (single-use token)
  req.session.tempAuth = null;

  // Lưu session để đảm bảo xóa
  req.session.save((err) => {
    if (err) {
      return res.status(500).json({ message: "Lưu session thất bại!" });
    }
  });

  // Trả về auth data
  res.json({
    success: true,
    accessToken: authData.accessToken,
    user: authData.user
  });
};

