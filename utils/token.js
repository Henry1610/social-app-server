import jwt from "jsonwebtoken";
import prisma from "./prisma.js";

export const createRefreshToken = async (user) => {
  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Lưu vào DB
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return refreshToken;
};
export const createAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

export const createResetPasswordToken = (user) => {
  const token = jwt.sign(
    { id:user.id },
    process.env.JWT_RESET_SECRET,
    { expiresIn: '15m' } 
  );

  return token;
};