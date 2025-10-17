import prisma from "../../utils/prisma.js";

// GET /api/user/search?q=...
export const searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || "").trim();
    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, users });
  } catch (error) {
    console.error("Search users error:", error);
    return res.status(500).json({ success: false, message: "Tìm kiếm thất bại" });
  }
};

// GET /api/user/:username/profile
export const getPublicProfile = async (req, res) => {
  try {
    const userId = req.resolvedUserId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        createdAt: true,
        isOnline: true,
        lastSeen: true,
        createdAt: true,
        privacySettings: true
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    return res.json({ success: true, user });
  } catch (error) {
    console.error('Get public profile error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};


