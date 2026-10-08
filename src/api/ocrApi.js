// =========================================================
// src/api/ocrApi.js
// OCRThai Plus
//
// OCR API SERVICE
// ---------------------------------------------------------
// AI Cleanup
// Gemini TTS
// Upload File
// Save OCR Result
// Get OCR Results
// Get Files
// Open File
// Delete File
//
// IMPORTANT
// ---------------------------------------------------------
// - ใช้ api.js เป็นตัวกลางทั้งหมด
// - ไม่ใส่ Authorization เอง
// - ไม่กำหนด Content-Type เองสำหรับ FormData
// - AI Cleanup ส่ง Raw OCR ไป Backend
// - processedText ต้องมาจาก AI เท่านั้น
// - Gemini TTS ส่งข้อความที่ต้องการอ่านไป Backend
// =========================================================

import { apiGet, apiPost, apiDelete } from "./api";

// =========================================================
// AI CLEANUP
// =========================================================
//
// BACKEND:
// POST /api/ocr/cleanup
//
// BODY:
// {
//   rawText: "..."
// }
//
// RESPONSE ที่คาดหวัง:
//
// {
//   success: true,
//   cleanedText: "..."
// }
// =========================================================

export async function cleanupOcrText(rawText) {
  const text = String(rawText ?? "").trim();

  if (!text) {
    const error = new Error("ไม่มี Raw OCR สำหรับส่งให้ AI Cleanup");

    error.status = 400;

    throw error;
  }

  return apiPost("/ocr/cleanup", {
    rawText: text,
  });
}

// =========================================================
// GEMINI TTS
// =========================================================
//
// BACKEND:
// POST /api/ocr/speak
//
// BODY:
// {
//   text: "..."
// }
//
// RESPONSE ที่คาดหวัง:
//
// {
//   success: true,
//   audioBase64: "...",
//   mimeType: "audio/wav"
// }
//
// IMPORTANT
// ---------------------------------------------------------
// - ใช้ข้อความปัจจุบันจาก Textarea
// - รองรับ Raw OCR
// - รองรับ AI Cleanup
// - รองรับข้อความที่ผู้ใช้แก้ไขเอง
// - ไม่บันทึกเสียงลง Database
// =========================================================

export async function speakOcrText(text) {
  const content = String(text ?? "").trim();

  if (!content) {
    const error = new Error("ไม่มีข้อความสำหรับอ่านออกเสียง");

    error.status = 400;

    throw error;
  }

  return apiPost("/ocr/speak", {
    text: content,
  });
}

// =========================================================
// UPLOAD OCR FILE
// =========================================================
//
// BACKEND:
// POST /api/ocr/upload
//
// FORM:
// file = File
//
// IMPORTANT:
// ---------------------------------------------------------
// apiPost() ต้องรองรับ FormData
// และต้องไม่กำหนด Content-Type:
// application/json เมื่อ body เป็น FormData
// =========================================================

export async function uploadOcrFile(file) {
  if (!file) {
    const error = new Error("ไม่พบไฟล์สำหรับอัปโหลด");

    error.status = 400;

    throw error;
  }

  const form = new FormData();

  form.append("file", file, file.name || "ocr_file");

  const result = await apiPost("/ocr/upload", form);

  return result;
}

// =========================================================
// SAVE OCR RESULT
// =========================================================
//
// BACKEND:
// POST /api/ocr/result
//
// BODY:
// {
//   fileId,
//   ocrName,
//   rawText,
//   processedText,
//   processingTime,
//   approved,
//   selectedPages,
//   aiCleaningUsed
// }
//
// DATABASE:
// ---------------------------------------------------------
// rawText       -> raw_text
// processedText -> processed_text
// =========================================================

export async function saveOcrResult({
  fileId,
  ocrName,
  rawText,
  processedText = "",
  processingTime = 0,
  approved = false,
  selectedPages = [],
  aiCleaningUsed = false,
}) {
  if (fileId === null || fileId === undefined || fileId === "") {
    const error = new Error("ไม่พบ file_id สำหรับบันทึกผล OCR");

    error.status = 400;

    throw error;
  }

  const finalName = String(ocrName ?? "").trim();

  const finalRawText = String(rawText ?? "").trim();

  const finalProcessedText = aiCleaningUsed
    ? String(processedText ?? "").trim()
    : "";

  if (!finalName) {
    const error = new Error("กรุณาตั้งชื่อรายการ OCR");

    error.status = 400;

    throw error;
  }

  if (!finalRawText) {
    const error = new Error("ไม่มี Raw OCR สำหรับบันทึก");

    error.status = 400;

    throw error;
  }

  return apiPost("/ocr/result", {
    fileId: Number(fileId),

    ocrName: finalName,

    rawText: finalRawText,

    processedText: finalProcessedText,

    processingTime: Number(processingTime || 0),

    approved: Boolean(approved),

    selectedPages: Array.isArray(selectedPages) ? selectedPages : [],

    aiCleaningUsed: Boolean(finalProcessedText),
  });
}

// =========================================================
// GET MY OCR RESULTS
// =========================================================
//
// BACKEND:
// GET /api/ocr/results
// =========================================================

export async function getMyOcrResults() {
  return apiGet("/ocr/results");
}

// =========================================================
// GET MY FILES
// =========================================================
//
// BACKEND:
// GET /api/ocr/files
// =========================================================

export async function getMyFiles() {
  return apiGet("/ocr/files");
}

// =========================================================
// OPEN FILE
// =========================================================
//
// BACKEND:
// GET /api/ocr/files/:fileId/open
//
// IMPORTANT
// ---------------------------------------------------------
// Endpoint นี้คืนไฟล์ binary เช่น PDF / Image / TXT
//
// ดังนั้นไม่ควรใช้ apiGet() ถ้า apiGet()
// ถูกออกแบบให้ parse JSON อย่างเดียว
//
// หน้า HistoryPage.jsx ตอนนี้ใช้ fetch()
// สำหรับ endpoint นี้อยู่แล้ว
// =========================================================
//
// ฟังก์ชันนี้จึงคืน URL endpoint
// เพื่อให้หน้าที่ต้องการเปิดไฟล์สามารถ
// fetch blob เองได้อย่างถูกต้อง
// =========================================================

export function getOcrFileOpenUrl(fileId) {
  if (fileId === null || fileId === undefined || fileId === "") {
    throw new Error("ไม่พบ file_id");
  }

  const baseUrl = String(
    process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  ).replace(/\/$/, "");

  return `${baseUrl}/ocr/files/${encodeURIComponent(fileId)}/open`;
}

// =========================================================
// DELETE FILE
// =========================================================
//
// BACKEND:
// DELETE /api/ocr/files/:fileId
// =========================================================

export async function deleteOcrFile(fileId) {
  if (fileId === null || fileId === undefined || fileId === "") {
    const error = new Error("ไม่พบ file_id สำหรับลบไฟล์");

    error.status = 400;

    throw error;
  }

  return apiDelete(`/ocr/files/${encodeURIComponent(fileId)}`);
}

// =========================================================
// DEFAULT EXPORT
// =========================================================

const ocrApi = {
  cleanupOcrText,
  speakOcrText,
  uploadOcrFile,
  saveOcrResult,
  getMyOcrResults,
  getMyFiles,
  getOcrFileOpenUrl,
  deleteOcrFile,
};

export default ocrApi;
