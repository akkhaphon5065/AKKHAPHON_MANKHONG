// =========================================================
// middleware/authMiddleware.js
// OCRThai Plus
// =========================================================

const jwt =
  require("jsonwebtoken");

const {
  pool,
} =
  require(
    "../config/db",
  );

async function requireAuth(
  req,
  res,
  next,
) {
  try {
    const authHeader =
      req.headers.authorization ||
      "";

    if (
      !authHeader.startsWith(
        "Bearer ",
      )
    ) {
      return res.status(401).json({
        success:
          false,

        message:
          "ไม่พบ Authorization Token",
      });
    }

    const token =
      authHeader
        .slice(
          7,
        )
        .trim();

    if (!token) {
      return res.status(401).json({
        success:
          false,

        message:
          "ไม่พบ Token",
      });
    }

    const secret =
      process.env.JWT_SECRET;

    if (!secret) {
      console.error(
        "JWT_SECRET is missing",
      );

      return res.status(500).json({
        success:
          false,

        message:
          "JWT_SECRET ยังไม่ได้ตั้งค่า",
      });
    }

    const decoded =
      jwt.verify(
        token,
        secret,
      );

    req.user = {
      ...decoded,

      user_id:
        decoded.user_id ??
        decoded.userId ??
        decoded.id,
    };

    if (
      !req.user.user_id
    ) {
      return res.status(401).json({
        success:
          false,

        message:
          "Token ไม่มี user_id",
      });
    }

    // =====================================================
    // SYSTEM MAINTENANCE
    // =====================================================
    //
    // Admin:
    //   ยังสามารถใช้งานระบบได้
    //
    // User:
    //   ไม่สามารถใช้งาน API ได้เมื่อ Maintenance
    //
    // =====================================================

    if (
      String(
        req.user.role ||
          ""
      ).toLowerCase() ===
      "user"
    ) {
      const [
        systemRows,
      ] =
        await pool.query(
          `SELECT setting_value
           FROM system_settings
           WHERE setting_key = 'system_status'
           LIMIT 1`
        );

      const systemStatus =
        systemRows.length
          ? systemRows[0]
              .setting_value
          : "Online";

      if (
        systemStatus ===
        "Maintenance"
      ) {
        return res.status(503).json({
          success:
            false,

          code:
            "SYSTEM_MAINTENANCE",

          systemStatus:
            "Maintenance",

          message:
            "ขณะนี้ระบบอยู่ระหว่างการบำรุงรักษา บัญชี User ไม่สามารถใช้งานระบบได้ กรุณารอจนกว่าระบบจะกลับสู่ Online",
        });
      }
    }

    next();
  } catch (error) {
    console.error(
      "AUTH MIDDLEWARE ERROR:",
      error,
    );

    if (
      error.name ===
        "TokenExpiredError" ||
      error.name ===
        "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success:
          false,

        message:
          "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
      });
    }

    return res.status(401).json({
      success:
        false,

      message:
        "ไม่สามารถตรวจสอบ Session ได้",
    });
  }
}

module.exports = {
  requireAuth,
};