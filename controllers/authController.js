import jwt from "jsonwebtoken";
import passport from "passport";
import { redisClient } from "../utils/cache.js";
import {
  sendOtpService,
  verifyOtpAndRegisterService,
  loginService,
  refreshTokenService,
  changePasswordService,
  requestResetPasswordService,
  resetPasswordService,
  getMeService,
} from "../services/authService.js";

// POST /api/auth/send-otp
export const sendOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    const result = await sendOtpService(email, phone);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    return res.json({ message: result.message });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Gửi OTP thất bại!" });
  }
};

// POST /api/auth/verify-otp-register
export const verifyOtpAndRegister = async (req, res) => {
  try {
    const { username, email, phone, password, fullName, otp } = req.body;

    const result = await verifyOtpAndRegisterService({
      username,
      email,
      phone,
      password,
      fullName,
      otp
    });

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ error: result.message });
    }

    res.cookie('refreshToken', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      message: result.message,
      user: result.user,
      tokens: {
        accessToken: result.tokens.accessToken
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

    const result = await loginService(email, phone, password);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    // Set refresh token vào cookie
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // CHỈ TRẢ AT trong response body
    return res.json({
      message: result.message,
      accessToken: result.accessToken,
      user: result.user
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

    const result = await refreshTokenService(refreshToken);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    res.json({
      success: true,
      accessToken: result.accessToken
    });
  } catch (error) {
    return res.status(500).json({ message: "Làm mới token thất bại!" });
  }
};

// POST /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!req.user) {
      return res.status(401).json({ message: "Chưa đăng nhập" });
    }

    const result = await changePasswordService(req.user.id, oldPassword, newPassword);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    res.json({ message: result.message });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Đổi mật khẩu thất bại!" });
  }
};

// POST /api/auth/forgot-password
export const requestResetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await requestResetPasswordService(email);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    res.json({ message: result.message });
  } catch (error) {
    return res.status(500).json({ error: "Gửi email reset mật khẩu thất bại!" });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const result = await resetPasswordService(token, newPassword);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ error: result.message });
    }

    res.json({ message: result.message });
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
    const result = await getMeService(req.user.id);

    if (!result.success) {
      return res.status(result.statusCode || 500).json({ message: result.message });
    }

    res.json(result.user);
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
          provider: user.provider,
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

// GET /health
export const healthCheck = (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
};


