
export const authorize = (requireRole) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: "Chưa đăng nhập" });
    }
    if (req.user.role != requireRole) {
        return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    next();
}
