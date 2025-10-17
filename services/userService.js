import prisma from "../utils/prisma.js";

//Get user by id
export const getUserById = async (id) => {
    return await prisma.user.findUnique({
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
  };
  

