import prisma from "../utils/prisma.js";
// Middleware: Chuyển username param -> resolvedUserId
export const resolveUser = async (req, res, next) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: "Thiếu tham số username" });
    }

    const user = await prisma.user.findUnique({
      where: { username: username },
      select: { id: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not founds" });
    }

    req.resolvedUserId = user.id;
    return next();
  } catch (err) {
    console.error("resolveUser error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};


