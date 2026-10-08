const fs = require("fs");
const path = require("path");

const { pool } = require("../config/db");

function getUserId(req) {
  const userId = Number(
    req.user?.user_id ?? req.user?.userId ?? req.user?.id ?? 0,
  );

  return Number.isInteger(userId) && userId > 0 ? userId : null;
}

function normalizeText(value) {
  return String(value ?? "");
}

function normalizeFileType(fileType, fileName = "") {
  const type = String(fileType || "")
    .trim()
    .toLowerCase();

  const extensionMimeTypes = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".avif": "image/avif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  if (type === "pdf" || type === ".pdf") {
    return "application/pdf";
  }

  if (
    type === "jpg" ||
    type === "jpeg" ||
    type === ".jpg" ||
    type === ".jpeg"
  ) {
    return "image/jpeg";
  }

  if (type === "png" || type === ".png") {
    return "image/png";
  }

  if (type === "gif" || type === ".gif") {
    return "image/gif";
  }

  if (type === "webp" || type === ".webp") {
    return "image/webp";
  }

  if (type === "bmp" || type === ".bmp") {
    return "image/bmp";
  }

  if (type === "svg" || type === ".svg") {
    return "image/svg+xml";
  }

  if (type === "txt" || type === ".txt") {
    return "text/plain";
  }

  if (type.includes("/")) {
    return type;
  }

  const ext = path.extname(fileName || "").toLowerCase();

  return extensionMimeTypes[ext] || "application/octet-stream";
}

function detectFileMimeType(filePath, fallbackType = "", fileName = "") {
  const fallback = normalizeFileType(fallbackType, fileName);

  try {
    const fd = fs.openSync(filePath, "r");

    try {
      const buffer = Buffer.alloc(512);
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
      const header = buffer.subarray(0, bytesRead);

      // PDF
      if (
        header.length >= 5 &&
        header.subarray(0, 5).toString("ascii") === "%PDF-"
      ) {
        return "application/pdf";
      }

      // JPEG
      if (
        header.length >= 3 &&
        header[0] === 0xff &&
        header[1] === 0xd8 &&
        header[2] === 0xff
      ) {
        return "image/jpeg";
      }

      // PNG
      if (
        header.length >= 8 &&
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47 &&
        header[4] === 0x0d &&
        header[5] === 0x0a &&
        header[6] === 0x1a &&
        header[7] === 0x0a
      ) {
        return "image/png";
      }

      // GIF
      if (
        header.length >= 6 &&
        (header.subarray(0, 6).toString("ascii") === "GIF87a" ||
          header.subarray(0, 6).toString("ascii") === "GIF89a")
      ) {
        return "image/gif";
      }

      // WEBP
      if (
        header.length >= 12 &&
        header.subarray(0, 4).toString("ascii") === "RIFF" &&
        header.subarray(8, 12).toString("ascii") === "WEBP"
      ) {
        return "image/webp";
      }

      // BMP
      if (header.length >= 2 && header[0] === 0x42 && header[1] === 0x4d) {
        return "image/bmp";
      }

      // TIFF
      if (
        header.length >= 4 &&
        ((header[0] === 0x49 &&
          header[1] === 0x49 &&
          header[2] === 0x2a &&
          header[3] === 0x00) ||
          (header[0] === 0x4d &&
            header[1] === 0x4d &&
            header[2] === 0x00 &&
            header[3] === 0x2a))
      ) {
        return "image/tiff";
      }

      // ICO
      if (
        header.length >= 4 &&
        header[0] === 0x00 &&
        header[1] === 0x00 &&
        header[2] === 0x01 &&
        header[3] === 0x00
      ) {
        return "image/x-icon";
      }

      // AVIF / HEIC / HEIF
      if (
        header.length >= 12 &&
        header.subarray(4, 8).toString("ascii") === "ftyp"
      ) {
        const brands = header
          .subarray(8, Math.min(header.length, 512))
          .toString("ascii");

        if (brands.includes("avif") || brands.includes("avis")) {
          return "image/avif";
        }

        if (
          brands.includes("heic") ||
          brands.includes("heix") ||
          brands.includes("hevc") ||
          brands.includes("hevx") ||
          brands.includes("mif1") ||
          brands.includes("msf1")
        ) {
          return "image/heic";
        }
      }

      // SVG
      const textHeader = header
        .toString("utf8")
        .replace(/^\uFEFF/, "")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .trim()
        .toLowerCase();

      if (
        textHeader.startsWith("<svg") ||
        (textHeader.includes("<svg") &&
          (textHeader.startsWith("<?xml") ||
            textHeader.startsWith("<!doctype")))
      ) {
        return "image/svg+xml";
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    console.warn("DETECT MIME ERROR:", error?.message || error);
  }

  return fallback;
}

function parseSelectedPages(value) {
  let pages = [];

  if (Array.isArray(value)) {
    pages = value;
  } else if (typeof value === "string") {
    pages = value.split(",");
  } else if (typeof value === "number") {
    pages = [value];
  }

  pages = pages
    .map((page) => Number(String(page).trim()))
    .filter((page) => Number.isInteger(page) && page > 0);

  return [...new Set(pages)].sort((a, b) => a - b);
}

function resolveStoredPath(storedPath) {
  if (!storedPath) {
    return null;
  }

  const normalizedPath = String(storedPath)
    .trim()
    .replace(/\//g, path.sep)
    .replace(/\\/g, path.sep);

  if (!normalizedPath) {
    return null;
  }

  if (path.isAbsolute(normalizedPath)) {
    return path.normalize(normalizedPath);
  }

  const candidates = [
    path.resolve(normalizedPath),
    path.resolve(process.cwd(), normalizedPath),
    path.resolve(__dirname, "..", normalizedPath),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (_) {}
  }

  return path.resolve(normalizedPath);
}

function getGeminiConfig() {
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();

  const model = String(process.env.GEMINI_MODEL || "gemini-2.5-flash").trim();

  const ttsModel = String(
    process.env.GEMINI_TTS_MODEL || "gemini-3.8-flash-tts",
  ).trim();

  const ttsVoice = String(process.env.GEMINI_TTS_VOICE || "Kore").trim();

  return {
    apiKey,
    model,
    ttsModel,
    ttsVoice,
  };
}

async function callGeminiCleanup(rawText) {
  const { apiKey, model } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY ยังไม่ได้ตั้งค่าในไฟล์ .env");

    error.status = 500;

    throw error;
  }

  const safeRawText = String(rawText || "").trim();

  if (!safeRawText) {
    const error = new Error("ไม่มี Raw OCR สำหรับส่งให้ Gemini");

    error.status = 400;

    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const prompt = [
    "You are an OCR text cleaning assistant.",
    "",
    "The following text is raw OCR output.",
    "",
    "Your task:",
    "1. Fix only obvious OCR recognition errors.",
    "2. Correct obvious Thai spacing problems.",
    "3. Remove obvious OCR junk characters.",
    "4. Preserve original meaning.",
    "5. Preserve paragraph and line structure as much as possible.",
    "6. Do not invent information.",
    "7. Do not summarize.",
    "8. Do not explain your changes.",
    "9. Do not add markdown unless already present.",
    "10. Return only the cleaned text.",
    "",
    "RAW OCR:",
    safeRawText,
  ].join("\n");

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
        },
      }),
    });
  } catch (networkError) {
    const error = new Error(
      `เชื่อมต่อ Gemini ไม่สำเร็จ: ${networkError?.message || "Network Error"}`,
    );

    error.status = 503;

    throw error;
  }

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    const error = new Error(
      `อ่านผลตอบกลับจาก Gemini ไม่สำเร็จ (HTTP ${response.status})`,
    );

    error.status = response.status;

    throw error;
  }

  if (!response.ok) {
    const apiMessage = data?.error?.message || data?.message || "";

    const error = new Error(
      apiMessage || `Gemini API error (HTTP ${response.status})`,
    );

    error.status = response.status;

    throw error;
  }

  const candidate = data?.candidates?.[0];

  if (!candidate) {
    const error = new Error("Gemini ไม่ส่ง candidates กลับมา");

    error.status = 502;

    throw error;
  }

  const parts = candidate?.content?.parts;

  if (!Array.isArray(parts)) {
    const error = new Error("Gemini ไม่ส่งข้อความกลับมาในรูปแบบที่รองรับ");

    error.status = 502;

    throw error;
  }

  const cleanedText = parts
    .map((part) => String(part?.text || ""))
    .join("")
    .trim();

  if (!cleanedText) {
    const error = new Error("Gemini ส่งผลลัพธ์ว่าง");

    error.status = 502;

    throw error;
  }

  return cleanedText;
}

async function callGeminiTTS(text) {
  const { apiKey, ttsModel, ttsVoice } = getGeminiConfig();

  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY ยังไม่ได้ตั้งค่าในไฟล์ .env");

    error.status = 500;

    throw error;
  }

  const safeText = String(text || "").trim();

  if (!safeText) {
    const error = new Error("ไม่มีข้อความสำหรับอ่านออกเสียง");

    error.status = 400;

    throw error;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    ttsModel,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `อ่านข้อความต่อไปนี้ตามต้นฉบับอย่างชัดเจนและเป็นธรรมชาติ โดยไม่สรุป ไม่เพิ่มข้อมูล และไม่เปลี่ยนแปลงข้อความ:\n\n${safeText}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: ttsVoice,
              },
            },
          },
        },
      }),
    });
  } catch (networkError) {
    const error = new Error(
      `เชื่อมต่อ Gemini TTS ไม่สำเร็จ: ${
        networkError?.message || "Network Error"
      }`,
    );

    error.status = 503;

    throw error;
  }

  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    const error = new Error(
      `อ่านผลตอบกลับจาก Gemini TTS ไม่สำเร็จ (HTTP ${response.status})`,
    );

    error.status = response.status;

    throw error;
  }

  if (!response.ok) {
    const apiMessage = data?.error?.message || data?.message || "";

    const error = new Error(
      apiMessage || `Gemini TTS API error (HTTP ${response.status})`,
    );

    error.status = response.status;

    throw error;
  }

  const parts = data?.candidates?.[0]?.content?.parts;

  if (!Array.isArray(parts)) {
    const error = new Error("Gemini TTS ไม่ส่งข้อมูลเสียงกลับมา");

    error.status = 502;

    throw error;
  }

  const audioPart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  );

  const audioBase64 =
    audioPart?.inlineData?.data || audioPart?.inline_data?.data || "";

  if (!audioBase64) {
    const error = new Error("Gemini TTS ไม่ส่งข้อมูลเสียงกลับมา");

    error.status = 502;

    throw error;
  }

  const returnedMimeType =
    audioPart?.inlineData?.mimeType ||
    audioPart?.inline_data?.mime_type ||
    "audio/wav";

  return {
    audioBase64,
    mimeType: returnedMimeType || "audio/wav",
  };
}

async function cleanupText(req, res) {
  try {
    const rawText = normalizeText(
      req.body?.rawText ?? req.body?.raw_text ?? "",
    );

    if (!rawText.trim()) {
      return res.status(400).json({
        success: false,
        aiAvailable: false,
        cleanedText: "",
        message: "ไม่มีข้อความสำหรับ AI Cleanup",
      });
    }

    console.log("========================================");
    console.log("🤖 GEMINI CLEANUP START");
    console.log("Raw OCR length:", rawText.length);

    const { model } = getGeminiConfig();

    console.log("Gemini model:", model);

    const cleanedText = await callGeminiCleanup(rawText);

    console.log("✅ GEMINI CLEANUP SUCCESS");
    console.log("AI result length:", cleanedText.length);
    console.log("========================================");

    return res.json({
      success: true,
      aiAvailable: true,
      rawText,
      cleanedText,
    });
  } catch (error) {
    console.error("❌ OCR CLEANUP ERROR:", error);

    return res.status(error?.status || 500).json({
      success: false,
      aiAvailable: false,
      cleanedText: "",
      message: error?.message || "AI Cleanup ไม่สำเร็จ",
    });
  }
}

async function speakText(req, res) {
  try {
    const text = normalizeText(req.body?.text ?? "").trim();

    if (!text) {
      return res.status(400).json({
        success: false,
        message: "ไม่มีข้อความสำหรับอ่านออกเสียง",
      });
    }

    console.log("========================================");
    console.log("🔊 GEMINI TTS START");
    console.log("Text length:", text.length);

    const { ttsModel, ttsVoice } = getGeminiConfig();

    console.log("Gemini TTS model:", ttsModel);
    console.log("Gemini TTS voice:", ttsVoice);

    const audio = await callGeminiTTS(text);

    console.log("✅ GEMINI TTS SUCCESS");
    console.log("Audio mime type:", audio.mimeType);
    console.log("========================================");

    return res.json({
      success: true,
      mimeType: audio.mimeType,
      audioBase64: audio.audioBase64,
    });
  } catch (error) {
    console.error("❌ OCR TTS ERROR:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message: error?.message || "ไม่สามารถสร้างเสียงได้",
    });
  }
}

async function uploadFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "กรุณาแนบไฟล์",
      });
    }

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const filePath = req.file.path || "";

    const fileName =
      req.file.originalname || req.file.filename || "uploaded-file";

    const fileType = normalizeFileType(req.file.mimetype, fileName);

    const fileSize = Number(req.file.size || 0);

    if (!filePath) {
      return res.status(400).json({
        success: false,
        message: "ไม่พบตำแหน่งไฟล์ที่อัปโหลด",
      });
    }

    const [result] = await pool.query(
      `
        INSERT INTO files
        (
          file_name,
          file_type,
          file_path,
          file_size,
          created_at,
          user_id
        )
        VALUES (?, ?, ?, ?, NOW(), ?)
        `,
      [fileName, fileType, filePath, fileSize, userId],
    );

    return res.status(201).json({
      success: true,
      message: "อัปโหลดไฟล์สำเร็จ",
      file: {
        file_id: result.insertId,
        file_name: fileName,
        file_type: fileType,
        file_path: filePath,
        file_size: fileSize,
      },
    });
  } catch (error) {
    console.error("UPLOAD FILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "ไม่สามารถบันทึกไฟล์ได้",
    });
  }
}

async function checkOcrNameDuplicate(connection, userId, ocrName) {
  const [rows] = await connection.query(
    `
      SELECT
        o.ocr_id
      FROM ocr_results o
      INNER JOIN files f
        ON f.file_id = o.file_id
      WHERE
        f.user_id = ?
        AND LOWER(TRIM(o.ocr_name)) =
            LOWER(TRIM(?))
      LIMIT 1
      `,
    [userId, ocrName],
  );

  return rows.length > 0;
}

async function createOcrResult(req, res) {
  const connection = await pool.getConnection();

  try {
    const userId = getUserId(req);

    if (!userId) {
      connection.release();

      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const ocrName = normalizeText(
      req.body?.ocrName ?? req.body?.ocr_name ?? "",
    ).trim();

    if (!ocrName) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "กรุณาตั้งชื่อรายการ OCR",
      });
    }

    if (ocrName.length > 255) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "ชื่อรายการ OCR ยาวเกิน 255 ตัวอักษร",
      });
    }

    const fileId = Number(req.body?.fileId ?? req.body?.file_id ?? 0);

    const rawText = normalizeText(
      req.body?.rawText ?? req.body?.raw_text ?? "",
    );

    const processedText = normalizeText(
      req.body?.processedText ?? req.body?.processed_text ?? "",
    );

    let processingTime = Number(
      req.body?.processingTime ?? req.body?.processing_time ?? 0,
    );

    if (!Number.isFinite(processingTime) || processingTime < 0) {
      processingTime = 0;
    }

    const approved =
      req.body?.approved === true ||
      req.body?.approved === 1 ||
      req.body?.approved === "1"
        ? 1
        : 0;

    const incomingPages = req.body?.selectedPages ?? req.body?.selected_pages;

    const selectedPages = parseSelectedPages(incomingPages);

    const selectedPagesText = selectedPages.length
      ? selectedPages.join(",")
      : null;

    const aiCleaningUsed =
      req.body?.aiCleaningUsed === true ||
      req.body?.aiCleaningUsed === 1 ||
      req.body?.aiCleaningUsed === "1";

    const finalProcessedText =
      aiCleaningUsed && processedText.trim() ? processedText.trim() : "";

    if (!Number.isInteger(fileId) || fileId <= 0) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "file_id ไม่ถูกต้อง",
      });
    }

    if (!rawText.trim()) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "ไม่พบ Raw OCR สำหรับบันทึก",
      });
    }

    const [fileRows] = await connection.query(
      `
        SELECT
          file_id,
          file_name,
          file_type,
          file_path,
          file_size,
          user_id
        FROM files
        WHERE
          file_id = ?
          AND user_id = ?
        LIMIT 1
        `,
      [fileId, userId],
    );

    if (!fileRows.length) {
      connection.release();

      return res.status(404).json({
        success: false,
        message: "ไม่พบไฟล์ของผู้ใช้งาน",
      });
    }

    const file = fileRows[0];

    const duplicated = await checkOcrNameDuplicate(connection, userId, ocrName);

    if (duplicated) {
      connection.release();

      return res.status(409).json({
        success: false,
        message: "ชื่อรายการ OCR นี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่",
      });
    }

    await connection.beginTransaction();

    const [ocrResult] = await connection.query(
      `
        INSERT INTO ocr_results
        (
          raw_text,
          processed_text,
          processing_time,
          selected_pages,
          created_at,
          file_id,
          ocr_name,
          approved,
          approved_at
        )
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          NOW(),
          ?,
          ?,
          ?,
          CASE
            WHEN ? = 1
            THEN NOW()
            ELSE NULL
          END
        )
        `,
      [
        rawText,
        finalProcessedText,
        processingTime,
        selectedPagesText,
        fileId,
        ocrName,
        approved,
        approved,
      ],
    );

    const historyActivity = `OCR:${ocrName}|สำเร็จ`;

    const [historyResult] = await connection.query(
      `
        INSERT INTO usage_history
        (
          activity_type,
          created_at,
          user_id,
          file_id
        )
        VALUES
        (
          ?,
          NOW(),
          ?,
          ?
        )
        `,
      [historyActivity, userId, fileId],
    );

    await connection.commit();

    connection.release();

    console.log("OCR RESULT SAVED:", {
      userId,
      fileId,
      ocrName,
      aiCleaningUsed: Boolean(finalProcessedText),
      rawLength: rawText.length,
      processedLength: finalProcessedText.length,
    });

    return res.status(201).json({
      success: true,
      message: "บันทึกผล OCR สำเร็จ",
      ocr_id: ocrResult.insertId,
      history_id: historyResult.insertId,
      file_id: fileId,
      ocr_name: ocrName,
      selected_pages: selectedPages,
      aiCleaningUsed: Boolean(finalProcessedText),
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}

    connection.release();

    console.error("CREATE OCR ERROR:", error);

    return res.status(error?.status || 500).json({
      success: false,
      message:
        error?.sqlMessage || error?.message || "ไม่สามารถบันทึกผล OCR ได้",
    });
  }
}

async function getMyOcrResults(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          o.ocr_id,
          o.ocr_name,
          o.raw_text,
          o.processed_text,
          o.processing_time,
          o.selected_pages,
          o.created_at,
          o.file_id,
          o.approved,
          o.approved_at,
          f.file_name,
          f.file_type,
          f.file_path,
          f.file_size
        FROM ocr_results o
        INNER JOIN files f
          ON f.file_id = o.file_id
        WHERE
          f.user_id = ?
        ORDER BY
          o.created_at DESC
        LIMIT 500
        `,
      [userId],
    );

    const data = rows.map((row) => ({
      ...row,
      selected_pages: parseSelectedPages(row.selected_pages),
      ai_cleaning_used: Boolean(String(row.processed_text || "").trim()),
    }));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("GET OCR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถโหลดผล OCR ได้",
    });
  }
}

async function getMyFiles(req, res) {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          file_id,
          file_name,
          file_type,
          file_path,
          file_size,
          created_at,
          user_id
        FROM files
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 500
        `,
      [userId],
    );

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        file_type: normalizeFileType(row.file_type, row.file_name),
      })),
    });
  } catch (error) {
    console.error("GET FILES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "ไม่สามารถโหลดไฟล์ได้",
    });
  }
}

async function openFile(req, res) {
  try {
    const fileId = Number(req.params.fileId);

    const userId = getUserId(req);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      return res.status(400).json({
        success: false,
        message: "file_id ไม่ถูกต้อง",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const [rows] = await pool.query(
      `
        SELECT
          file_id,
          file_name,
          file_type,
          file_path,
          file_size,
          user_id
        FROM files
        WHERE
          file_id = ?
          AND user_id = ?
        LIMIT 1
        `,
      [fileId, userId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบไฟล์ของผู้ใช้งาน",
      });
    }

    const file = rows[0];

    if (!file.file_path) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบตำแหน่งไฟล์",
      });
    }

    const absolutePath = resolveStoredPath(file.file_path);

    if (!absolutePath) {
      return res.status(404).json({
        success: false,
        message: "ตำแหน่งไฟล์ไม่ถูกต้อง",
      });
    }

    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบไฟล์จริงในโฟลเดอร์ uploads",
      });
    }

    const stats = fs.statSync(absolutePath);

    if (!stats.isFile()) {
      return res.status(400).json({
        success: false,
        message: "ตำแหน่งที่ระบุไม่ใช่ไฟล์",
      });
    }

    // ตรวจชนิดไฟล์จากข้อมูลจริง
    const contentType = detectFileMimeType(
      absolutePath,
      file.file_type,
      file.file_name,
    );

    console.log("OPEN FILE:", {
      fileId,
      userId,
      fileName: file.file_name,
      dbFileType: file.file_type,
      detectedContentType: contentType,
      filePath: absolutePath,
      size: stats.size,
    });

    res.status(200);

    res.setHeader("Content-Type", contentType);

    res.setHeader("Content-Length", String(stats.size));

    res.setHeader("Content-Disposition", "inline");

    res.setHeader("Cache-Control", "private, no-store, max-age=0");

    res.setHeader("X-Content-Type-Options", "nosniff");

    const readStream = fs.createReadStream(absolutePath);

    readStream.on("error", (streamError) => {
      console.error("READ FILE STREAM ERROR:", streamError);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "ไม่สามารถอ่านไฟล์ได้",
        });
      } else {
        try {
          res.end();
        } catch (_) {}
      }
    });

    readStream.pipe(res);

    return;
  } catch (error) {
    console.error("OPEN FILE ERROR:", error);

    if (res.headersSent) {
      return;
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "ไม่สามารถเปิดไฟล์ได้",
    });
  }
}

async function deleteFile(req, res) {
  const connection = await pool.getConnection();

  try {
    const fileId = Number(req.params.fileId);

    const userId = getUserId(req);

    if (!Number.isInteger(fileId) || fileId <= 0) {
      connection.release();

      return res.status(400).json({
        success: false,
        message: "file_id ไม่ถูกต้อง",
      });
    }

    if (!userId) {
      connection.release();

      return res.status(401).json({
        success: false,
        message: "ไม่พบผู้ใช้งาน",
      });
    }

    const [rows] = await connection.query(
      `
        SELECT
          file_id,
          file_name,
          file_path
        FROM files
        WHERE
          file_id = ?
          AND user_id = ?
        LIMIT 1
        `,
      [fileId, userId],
    );

    if (!rows.length) {
      connection.release();

      return res.status(404).json({
        success: false,
        message: "ไม่พบไฟล์",
      });
    }

    const savedPath = rows[0].file_path;

    await connection.beginTransaction();

    await connection.query(
      `
      DELETE FROM ocr_results
      WHERE file_id = ?
      `,
      [fileId],
    );

    await connection.query(
      `
      DELETE FROM usage_history
      WHERE
        file_id = ?
        AND user_id = ?
      `,
      [fileId, userId],
    );

    await connection.query(
      `
      DELETE FROM files
      WHERE
        file_id = ?
        AND user_id = ?
      `,
      [fileId, userId],
    );

    await connection.commit();

    connection.release();

    if (savedPath) {
      try {
        const absolutePath = resolveStoredPath(savedPath);

        if (absolutePath && fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } catch (fileError) {
        console.error("DELETE PHYSICAL FILE ERROR:", fileError);
      }
    }

    return res.json({
      success: true,
      message: "ลบไฟล์สำเร็จ",
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}

    connection.release();

    console.error("DELETE FILE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error?.sqlMessage || error?.message || "ไม่สามารถลบไฟล์ได้",
    });
  }
}

module.exports = {
  cleanupText,
  speakText,
  uploadFile,
  createOcrResult,
  getMyOcrResults,
  getMyFiles,
  openFile,
  deleteFile,
};
