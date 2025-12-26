import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { redisClient } from "../utils/cache.js";
import { createAccessToken, createRefreshToken, createResetPasswordToken } from "../utils/token.js";
import { sendEmail } from "../utils/mailer.js";
import { sendSMS } from "../utils/sms.js";
import * as userRepository from "../repositories/userRepository.js";

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Gửi OTP cho đăng ký
 * @param {string} email - Email (optional)
 * @param {string} phone - Phone (optional)
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const sendOtpService = async (email, phone) => {
  if (!email && !phone) {
    return {
      success: false,
      message: "Email hoặc số điện thoại là bắt buộc",
      statusCode: 400
    };
  }

  // Kiểm tra email đã tồn tại chưa
  if (email) {
    const existingEmail = await userRepository.findUserByEmail(email);
    if (existingEmail) {
      return {
        success: false,
        message: "Email đã tồn tại",
        statusCode: 400
      };
    }
  }

  // Kiểm tra phone đã tồn tại chưa
  if (phone) {
    const existingPhone = await userRepository.findUserByPhone(phone);
    if (existingPhone) {
      return {
        success: false,
        message: "Số điện thoại đã tồn tại",
        statusCode: 400
      };
    }
  }

  // Sinh OTP và lưu Redis TTL (5 phút)
  const otp = generateOTP();
  const ttlSec = 5 * 60;
  const key = email ? `otp:register-email:${email}` : `otp:phone:${phone}`;
  await redisClient.set(key, otp, "EX", ttlSec);

  // Gửi OTP
  if (email) {
    const otpHtml = `
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
    `;
    await sendEmail(email, otpHtml, { subject: "Mã xác thực đăng ký tài khoản" });
  }
  if (phone) await sendSMS(phone, `Mã OTP của bạn là: ${otp}`);

  return {
    success: true,
    message: "OTP đã được gửi !"
  };
};

/**
 * Verify OTP và đăng ký user
 * @param {Object} data - Registration data
 * @param {string} data.username - Username
 * @param {string} data.email - Email (optional)
 * @param {string} data.phone - Phone (optional)
 * @param {string} data.password - Password
 * @param {string} data.fullName - Full name
 * @param {string} data.otp - OTP code
 * @returns {Promise<{success: boolean, user?: Object, tokens?: Object, message?: string, statusCode?: number}>}
 */
export const verifyOtpAndRegisterService = async (data) => {
  const { username, email, phone, password, fullName, otp } = data;

  if ((!email && !phone) || (email && phone)) {
    return {
      success: false,
      message: "Bạn phải nhập 1 trong 2: email hoặc phone",
      statusCode: 400
    };
  }

  // Lấy OTP từ Redis và so khớp
  const key = email ? `otp:register-email:${email}` : `otp:phone:${phone}`;
  const cachedOtp = await redisClient.get(key);
  if (!cachedOtp || cachedOtp !== String(otp)) {
    return {
      success: false,
      message: "OTP không hợp lệ hoặc đã hết hạn",
      statusCode: 400
    };
  }

  // Xóa OTP ngay sau khi dùng
  await redisClient.del(key);

  // Hash password và tạo user cùng với privacy settings
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await userRepository.createUser(
    {
      username,
      email,
      phone,
      passwordHash: hashedPassword,
      fullName,
      avatarUrl: "/images/avatar-IG-mac-dinh-1.jpg",
      privacySettings: {
        isPrivate: false,
        whoCanMessage: "everyone",
        whoCanTagMe: "everyone",
        whoCanFindByUsername: "everyone",
        showOnlineStatus: true,
      },
    },
    {
      privacySettings: true
    }
  );

  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  return {
    success: true,
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
  };
};

/**
 * Đăng nhập user
 * @param {string} email - Email (optional)
 * @param {string} phone - Phone (optional)
 * @param {string} password - Password
 * @returns {Promise<{success: boolean, user?: Object, accessToken?: string, refreshToken?: string, message?: string, statusCode?: number}>}
 */
export const loginService = async (email, phone, password) => {
  if (!email && !phone) {
    return {
      success: false,
      message: "Email hoặc số điện thoại là bắt buộc",
      statusCode: 400
    };
  }

  const user = await userRepository.findUserByEmailOrPhone(email, phone);

  if (!user) {
    return {
      success: false,
      message: "Người dùng không tồn tại",
      statusCode: 400
    };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return {
      success: false,
      message: "Sai mật khẩu",
      statusCode: 400
    };
  }

  // Tạo tokens
  const accessToken = createAccessToken(user);
  const refreshToken = await createRefreshToken(user);

  return {
    success: true,
    message: "Đăng nhập thành công",
    accessToken,
    refreshToken,
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
    },
  };
};

/**
 * Refresh access token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<{success: boolean, accessToken?: string, message?: string, statusCode?: number}>}
 */
export const refreshTokenService = async (refreshToken) => {
  if (!refreshToken) {
    return {
      success: false,
      message: "Không có refresh token!",
      statusCode: 400
    };
  }

  // Tìm token trong DB redis
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const stored = await redisClient.get(`refresh:${decoded.id}`);
  if (!stored || stored !== refreshToken) {
    return {
      success: false,
      message: "Refresh token không hợp lệ hoặc đã hết hạn!",
      statusCode: 403
    };
  }

  // Lấy lại user từ DB
  const user = await userRepository.findUserByIdWithSelect(decoded.id, {
    id: true,
    role: true,
    email: true,
    username: true
  });

  if (!user) {
    return {
      success: false,
      message: "Người dùng không tồn tại",
      statusCode: 400
    };
  }

  // Tạo access token mới
  const accessToken = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  return {
    success: true,
    accessToken
  };
};

/**
 * Đổi mật khẩu
 * @param {number} userId - ID của user
 * @param {string} oldPassword - Mật khẩu cũ
 * @param {string} newPassword - Mật khẩu mới
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const changePasswordService = async (userId, oldPassword, newPassword) => {
  // Lấy user từ DB
  const user = await userRepository.findUserById(userId);

  if (!user) {
    return {
      success: false,
      message: "Người dùng không tồn tại",
      statusCode: 404
    };
  }

  // Kiểm tra mật khẩu cũ
  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    return {
      success: false,
      message: "Mật khẩu cũ không đúng",
      statusCode: 400
    };
  }

  // Hash mật khẩu mới
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update DB
  await userRepository.updateUserPassword(userId, hashedPassword);

  return {
    success: true,
    message: "Đổi mật khẩu thành công"
  };
};

/**
 * Yêu cầu reset password
 * @param {string} email - Email của user
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const requestResetPasswordService = async (email) => {
  const user = await userRepository.findUserByEmail(email);
  if (!user) {
    return {
      success: false,
      message: "Email không tồn tại",
      statusCode: 404
    };
  }

  // Rate limit handled by express-rate-limit middleware

  const token = createResetPasswordToken(user.id);
  const resetLink = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  const resetPasswordHtml = `
    <h2 style="color: #333; text-align: center;">Đặt lại mật khẩu</h2>
    <p>Xin chào!</p>
    <p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng click vào nút bên dưới để tiếp tục:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Đặt lại mật khẩu</a>
    </div>
    <p style="color: #666; font-size: 14px;">Hoặc copy và dán link sau vào trình duyệt:</p>
    <p style="color: #007bff; word-break: break-all; font-size: 12px;">${resetLink}</p>
    <ul style="color: #666; font-size: 14px;">
      <li>Link có hiệu lực trong 15 phút.</li>
      <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</li>
      <li>Không chia sẻ link này với bất kỳ ai.</li>
    </ul>
  `;

  try {
    await sendEmail(email, resetPasswordHtml, { 
      subject: "Đặt lại mật khẩu"
    });
  } catch (error) {
    console.error("Error sending reset password email:", error);
    return {
      success: false,
      message: "Gửi email thất bại. Vui lòng thử lại sau.",
      statusCode: 500
    };
  }

  return {
    success: true,
    message: "Gửi email reset mật khẩu thành công"
  };
};

/**
 * Reset password với token
 * @param {string} token - Reset password token
 * @param {string} newPassword - Mật khẩu mới
 * @returns {Promise<{success: boolean, message?: string, statusCode?: number}>}
 */
export const resetPasswordService = async (token, newPassword) => {
  
  if (!token) {
    return {
      success: false,
      message: "Token không được để trống",
      statusCode: 400
    };
  }

  if (!newPassword) {
    return {
      success: false,
      message: "Mật khẩu mới không được để trống",
      statusCode: 400
    };
  }

  if (newPassword.length < 6) {
    return {
      success: false,
      message: "Mật khẩu phải có ít nhất 6 ký tự",
      statusCode: 400
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_RESET_SECRET);
    const userId = decoded.id;

    // Kiểm tra user có tồn tại không
    const user = await userRepository.findUserById(userId);
    if (!user) {
      return {
        success: false,
        message: "Người dùng không tồn tại",
        statusCode: 404
      };
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.updateUserPassword(userId, passwordHash);

    return {
      success: true,
      message: "Reset mật khẩu thành công"
    };
  } catch (err) {
    // Xử lý các lỗi cụ thể
    if (err.name === 'TokenExpiredError') {
      return {
        success: false,
        message: "Token đã hết hạn. Vui lòng yêu cầu reset mật khẩu lại.",
        statusCode: 400
      };
    }
    if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
      return {
        success: false,
        message: "Token không hợp lệ",
        statusCode: 400
      };
    }
    
    console.error("Reset password error:", err);
    return {
      success: false,
      message: "Reset mật khẩu thất bại!",
      statusCode: 500
    };
  }
};

/**
 * Lấy thông tin user hiện tại
 * @param {number} userId - ID của user
 * @returns {Promise<{success: boolean, user?: Object, message?: string, statusCode?: number}>}
 */
export const getMeService = async (userId) => {
  const user = await userRepository.findUserByIdWithSelect(userId, {
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
  });

  if (!user) {
    return {
      success: false,
      message: 'Không tìm thấy người dùng',
      statusCode: 404
    };
  }

  return {
    success: true,
    user
  };
};

