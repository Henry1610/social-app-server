import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho User operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ User Operations ============

/**
 * Tìm user theo username
 * @param {string} username - Username của user
 * @param {Object} select - Select fields (default: { id: true })
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByUsername = async (username, select = { id: true }) => {
  return await prisma.user.findUnique({
    where: { username },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm user theo id với các fields cụ thể
 * @param {number} userId - ID của user
 * @param {Object} select - Fields cần select
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByIdWithSelect = async (userId, select = {
  id: true,
  username: true,
  fullName: true
}) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Kiểm tra user có tồn tại không
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
  });
};

// ============ UserPrivacySetting Operations ============

/**
 * Tìm user privacy settings theo userId
 * @param {number} userId - ID của user
 * @returns {Promise<Object|null>} UserPrivacySetting object hoặc null
 */
export const findUserPrivacySetting = async (userId) => {
  return await prisma.userPrivacySetting.findUnique({
    where: { userId },
  });
};

/**
 * Cập nhật user privacy settings
 * @param {number} userId - ID của user
 * @param {Object} data - Update data
 * @param {boolean} data.isPrivate - Is private account
 * @param {string} data.whoCanMessage - Who can message
 * @param {string} data.whoCanTagMe - Who can tag me
 * @param {string} data.whoCanFindByUsername - Who can find by username
 * @param {boolean} data.showOnlineStatus - Show online status
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Updated privacy settings
 */
export const updateUserPrivacySetting = async (userId, data, include = {}) => {
  return await prisma.userPrivacySetting.update({
    where: { userId },
    data,
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Tạo user privacy settings mới
 * @param {number} userId - ID của user
 * @param {Object} data - Privacy settings data
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Created privacy settings
 */
export const createUserPrivacySetting = async (userId, data, include = {}) => {
  return await prisma.userPrivacySetting.create({
    data: {
      userId,
      ...data
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Cập nhật user
 * @param {number} userId - ID của user
 * @param {Object} data - Update data
 * @param {Object} select - Select fields
 * @returns {Promise<Object>} Updated user
 */
export const updateUser = async (userId, data, select = {}) => {
  return await prisma.user.update({
    where: { id: userId },
    data,
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm user theo email
 * @param {string} email - Email của user
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByEmail = async (email, select = {}) => {
  return await prisma.user.findUnique({
    where: { email },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm user theo phone
 * @param {string} phone - Phone của user
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByPhone = async (phone, select = {}) => {
  return await prisma.user.findUnique({
    where: { phone },
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tìm user theo email hoặc phone (cho login)
 * @param {string} email - Email của user (optional)
 * @param {string} phone - Phone của user (optional)
 * @param {Object} select - Select fields
 * @returns {Promise<Object|null>} User object hoặc null
 */
export const findUserByEmailOrPhone = async (email, phone, select = {}) => {
  if (!email && !phone) return null;

  const whereClause = {
    OR: [
      ...(email ? [{ email }] : []),
      ...(phone ? [{ phone }] : []),
    ].filter(Boolean),
  };

  return await prisma.user.findFirst({
    where: whereClause,
    select: Object.keys(select).length > 0 ? select : undefined
  });
};

/**
 * Tạo user mới với privacy settings
 * @param {Object} data - User data
 * @param {string} data.username - Username
 * @param {string} data.email - Email (optional)
 * @param {string} data.phone - Phone (optional)
 * @param {string} data.passwordHash - Hashed password
 * @param {string} data.fullName - Full name
 * @param {string} data.avatarUrl - Avatar URL
 * @param {Object} include - Include options (e.g., { privacySettings: true })
 * @returns {Promise<Object>} Created user
 */
export const createUser = async (data, include = {}) => {
  return await prisma.user.create({
    data: {
      username: data.username,
      ...(data.email && { email: data.email }),
      ...(data.phone && { phone: data.phone }),
      passwordHash: data.passwordHash,
      fullName: data.fullName,
      ...(data.avatarUrl && { avatarUrl: data.avatarUrl }),
      ...(data.privacySettings && {
        privacySettings: {
          create: data.privacySettings
        }
      }),
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Cập nhật password của user
 * @param {number} userId - ID của user
 * @param {string} passwordHash - Hashed password mới
 * @returns {Promise<Object>} Updated user
 */
export const updateUserPassword = async (userId, passwordHash) => {
  return await prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
};

