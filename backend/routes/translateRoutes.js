const express =
  require("express");

const {
  translateText,
  saveTranslationResult,
  getMyTranslations,
} =
  require(
    "../controllers/translateController",
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
// TRANSLATE
// POST /api/translate
// =========================================================

router.post(
  "/",
  requireAuth,
  translateText,
);

// =========================================================
// SAVE
// POST /api/translate/result
// =========================================================

router.post(
  "/result",
  requireAuth,
  saveTranslationResult,
);

// =========================================================
// RESULTS
// GET /api/translate/results
// =========================================================

router.get(
  "/results",
  requireAuth,
  getMyTranslations,
);

module.exports =
  router;