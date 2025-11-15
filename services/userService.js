import prisma from "../utils/prisma.js";

//Get user by id (tự động throw error nếu không tìm thấy)
export const getUserById = async (id, errorMessage = 'Người dùng không tồn tại!') => {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        privacySettings: {
          select: {
            isPrivate: true,
            whoCanMessage: true,
            whoCanTagMe: true,
            whoCanFindByUsername: true,
            showOnlineStatus: true
          }
        }
      }
    });
    
    if (!user) {
        const error = new Error(errorMessage);
        error.statusCode = 404;
        throw error;
    }
    
    return user;
};
  

