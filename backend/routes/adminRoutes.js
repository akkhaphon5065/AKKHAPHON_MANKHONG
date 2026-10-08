const express =
  require("express");

const {
  requireAuth,
} =
  require(
    "../middleware/authMiddleware",
  );

const {
  requireAdmin,
} =
  require(
    "../middleware/adminMiddleware",
  );

const {
  dashboard,
  getUsers,
  updateUserStatus,
  deleteUser,
  changeAdminPassword,
  getSystemStatus,
  updateSystemStatus,
  exportData,
} =
  require(
    "../controllers/adminController",
  );

const router =
  express.Router();

// =========================================================
// ADMIN PROTECTION
// =========================================================

router.use(
  requireAuth,
  requireAdmin,
);

// =========================================================
// DASHBOARD
// GET /api/admin/dashboard
// =========================================================

router.get(
  "/dashboard",
  dashboard,
);

// =========================================================
// USERS
// GET /api/admin/users
// =========================================================

router.get(
  "/users",
  getUsers,
);

// =========================================================
// UPDATE USER
// PATCH /api/admin/users/:userId/status
// =========================================================

router.patch(
  "/users/:userId/status",
  updateUserStatus,
);

// =========================================================
// DELETE USER
// DELETE /api/admin/users/:userId
// =========================================================

router.delete(
  "/users/:userId",
  deleteUser,
);

// =========================================================
// ADMIN PASSWORD
// PUT /api/admin/password
// =========================================================

router.put(
  "/password",
  changeAdminPassword,
);

// =========================================================
// SYSTEM STATUS
// =========================================================

router.get(
  "/system-status",
  getSystemStatus,
);

router.put(
  "/system-status",
  updateSystemStatus,
);

// =========================================================
// EXPORT
// =========================================================

router.get(
  "/export",
  exportData,
);

module.exports =
  router;