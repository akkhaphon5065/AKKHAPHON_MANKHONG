// =========================================================
// routes/ocrRoutes.js
// =========================================================

const express =
  require("express");

const {
  cleanupText,
  speakText,
  uploadFile,
  createOcrResult,
  getMyOcrResults,
  getMyFiles,
  openFile,
  deleteFile,
} =
  require(
    "../controllers/ocrController",
  );

const {
  requireAuth,
} =
  require(
    "../middleware/authMiddleware",
  );

const upload =
  require(
    "../middleware/uploadMiddleware",
  );

const router =
  express.Router();

// =========================================================
// AI CLEANUP
// POST /api/ocr/cleanup
// =========================================================

router.post(
  "/cleanup",
  requireAuth,
  cleanupText,
);

// =========================================================
// TEXT-TO-SPEECH
// POST /api/ocr/speak
// =========================================================

router.post(
  "/speak",
  requireAuth,
  speakText,
);

// =========================================================
// UPLOAD
// POST /api/ocr/upload
//
// IMPORTANT:
// Frontend ส่ง FormData:
// file = File
// =========================================================

router.post(
  "/upload",
  requireAuth,
  upload.single(
    "file",
  ),
  uploadFile,
);

// =========================================================
// SAVE OCR
// POST /api/ocr/result
// =========================================================

router.post(
  "/result",
  requireAuth,
  createOcrResult,
);

// =========================================================
// OCR RESULTS
// GET /api/ocr/results
// =========================================================

router.get(
  "/results",
  requireAuth,
  getMyOcrResults,
);

// =========================================================
// FILES
// GET /api/ocr/files
// =========================================================

router.get(
  "/files",
  requireAuth,
  getMyFiles,
);

// =========================================================
// OPEN FILE
// GET /api/ocr/files/:fileId/open
// =========================================================

router.get(
  "/files/:fileId/open",
  requireAuth,
  openFile,
);

// =========================================================
// DELETE FILE
// DELETE /api/ocr/files/:fileId
// =========================================================

router.delete(
  "/files/:fileId",
  requireAuth,
  deleteFile,
);

// =========================================================
// EXPORT
// =========================================================

module.exports =
  router;