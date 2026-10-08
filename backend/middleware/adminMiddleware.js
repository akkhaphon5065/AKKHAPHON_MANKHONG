// =========================================================
// middleware/adminMiddleware.js
// =========================================================

function requireAdmin(
  req,
  res,
  next,
) {
  if (
    req.user?.role !==
    "admin"
  ) {
    return res.status(403).json({
      success:
        false,
      message:
        "ไม่มีสิทธิ์สำหรับผู้ดูแลระบบ",
    });
  }

  next();
}

module.exports = {
  requireAdmin,
};