// =========================================================
// backend/routes/historyRoutes.js
// OCRThai Plus
//
// HISTORY ROUTES
// ---------------------------------------------------------
// GET    /api/history/mine
// DELETE /api/history/mine/:historyId
// GET    /api/history/all
// DELETE /api/history/all
// =========================================================

const express = require("express");

const {
  getMyHistory,
  deleteMyHistory,
  getAllHistory,
  clearAllHistory,
} = require("../controllers/historyController");

const {
  requireAuth,
} = require("../middleware/authMiddleware");

const {
  requireAdmin,
} = require("../middleware/adminMiddleware");

const router = express.Router();

// =========================================================
// MY HISTORY
// GET /api/history/mine
// =========================================================

router.get(
  "/mine",
  requireAuth,
  getMyHistory,
);

// =========================================================
// DELETE ONE HISTORY
// DELETE /api/history/mine/:historyId
// MEMBER ONLY
// =========================================================

router.delete(
  "/mine/:historyId",
  requireAuth,
  deleteMyHistory,
);

// =========================================================
// ALL HISTORY
// GET /api/history/all
// ADMIN ONLY
// =========================================================

router.get(
  "/all",
  requireAuth,
  requireAdmin,
  getAllHistory,
);

// =========================================================
// DELETE ALL HISTORY
// DELETE /api/history/all
// ADMIN ONLY
// =========================================================

router.delete(
  "/all",
  requireAuth,
  requireAdmin,
  clearAllHistory,
);

// =========================================================
// EXPORT
// =========================================================

module.exports = router;