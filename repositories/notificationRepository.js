import prisma from "../utils/prisma.js";

/**
 * Repository Layer - Data Access cho Notification operations
 * Chỉ chứa database operations, không có business logic
 */

// ============ Notification Operations ============

/**
 * Tìm notification theo groupKey
 * @param {number} userId - ID của user
 * @param {string} type - Type của notification
 * @param {string} targetType - Type của target
 * @param {number|null} targetId - ID của target (có thể null)
 * @param {string|null} groupKey - Group key (có thể null)
 * @param {Object} include - Include options
 * @returns {Promise<Object|null>} Notification object hoặc null
 */
export const findNotificationByGroupKey = async (userId, type, targetType, targetId, groupKey, include = {}) => {
  return await prisma.notification.findFirst({
    where: {
      userId,
      type,
      targetType,
      targetId: targetId ?? null,
      groupKey: groupKey ?? null
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Tạo notification mới
 * @param {Object} data - Notification data
 * @param {number} data.userId - ID của user
 * @param {number} data.actorId - ID của actor
 * @param {string} data.type - Type của notification
 * @param {string} data.targetType - Type của target
 * @param {number|null} data.targetId - ID của target
 * @param {string|null} data.groupKey - Group key
 * @param {Object} data.metadata - Metadata object
 * @param {Date} data.updatedAt - Updated at timestamp
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (data, include = {}) => {
  return await prisma.notification.create({
    data: {
      user: { connect: { id: data.userId } },
      actor: { connect: { id: data.actorId } },
      type: data.type,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      groupKey: data.groupKey ?? null,
      ...(data.metadata && { metadata: data.metadata }),
      ...(data.updatedAt && { updatedAt: data.updatedAt })
    },
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Cập nhật notification
 * @param {number} notificationId - ID của notification
 * @param {Object} data - Update data
 * @param {number} data.actorId - ID của actor (optional)
 * @param {Object} data.metadata - Metadata object (optional)
 * @param {Date} data.updatedAt - Updated at timestamp (optional)
 * @param {Object} include - Include options
 * @returns {Promise<Object>} Updated notification
 */
export const updateNotification = async (notificationId, data, include = {}) => {
  const updateData = {};
  if (data.actorId !== undefined) updateData.actorId = data.actorId;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;
  if (data.updatedAt !== undefined) updateData.updatedAt = data.updatedAt;

  return await prisma.notification.update({
    where: { id: notificationId },
    data: updateData,
    include: Object.keys(include).length > 0 ? include : undefined
  });
};

/**
 * Lấy danh sách notifications của user với pagination
 * @param {number} userId - ID của user
 * @param {Object} options - Options
 * @param {number} options.page - Số trang
 * @param {number} options.limit - Số lượng items mỗi trang
 * @param {Object} options.include - Include options
 * @returns {Promise<Array>} Danh sách notifications
 */
export const findNotificationsByUserId = async (userId, options = {}) => {
  const { page = 1, limit = 20, include = {} } = options;
  const skip = (page - 1) * limit;

  return await prisma.notification.findMany({
    where: { userId },
    include: Object.keys(include).length > 0 ? include : undefined,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  });
};

/**
 * Đếm số notifications của user
 * @param {number} userId - ID của user
 * @returns {Promise<number>} Tổng số notifications
 */
export const countNotificationsByUserId = async (userId) => {
  return await prisma.notification.count({
    where: { userId }
  });
};

