const express =
  require("express");

const {
  register,
  login,
  me,
  updateProfile,
  logout,
} =
  require(
    "../controllers/authController",
  );

const {
  requireAuth,
} =
  require(
    "../middleware/authMiddleware",
  );

const router =
  express.Router();

// =========================================================
// REGISTER
// POST /api/auth/register
// =========================================================

router.post(
  "/register",
  register,
);

// =========================================================
// LOGIN
// POST /api/auth/login
// =========================================================

router.post(
  "/login",
  login,
);

// =========================================================
// ME
// GET /api/auth/me
// =========================================================

router.get(
  "/me",
  requireAuth,
  me,
);

// =========================================================
// PROFILE
// PUT /api/auth/profile
// =========================================================

router.put(
  "/profile",
  requireAuth,
  updateProfile,
);

// =========================================================
// LOGOUT
// POST /api/auth/logout
// =========================================================

router.post(
  "/logout",
  requireAuth,
  logout,
);

module.exports =
  router;