// =========================================================
// backend/controllers/historyController.js
// OCRThai Plus
//
// HISTORY CONTROLLER
// ---------------------------------------------------------
// GET /api/history/mine
//
// Query:
// ?page=1
// ?limit=5
// ?search=ข้อความ
// ?filter=all
// ?filter=ocr
// ?filter=translate
// ?startDate=2026-10-01
// ?endDate=2026-10-06
//
// DELETE /api/history/mine/:historyId
//
// IMPORTANT:
// ---------------------------------------------------------
// - Pagination ทำที่ Database
// - Search ทำที่ Database
// - Filter ทำที่ Database
// - สมาชิกเห็นเฉพาะประวัติของตัวเอง
// - Search รองรับ OCR / AI Cleanup / Translate / File / ID
// - Date filter ใช้ startDate / endDate จากปฏิทิน
// - ไม่ใช้ filter today / week / month แล้ว
// - การลบประวัติ 1 รายการ จะลบเฉพาะ usage_history
// =========================================================

const { pool } = require("../config/db");

// =========================================================
// BASE URL
// =========================================================

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// =========================================================
// HELPER
// =========================================================

function parseActivity(activityType) {
  const activity = String(activityType || "").trim();

  if (!activity) {
    return {
      type: "SYSTEM",
      detail: "กิจกรรมระบบ",
      status: "สำเร็จ",
    };
  }

  const isOCR = activity.toUpperCase().startsWith("OCR:");

  const isTranslate = activity.toLowerCase().startsWith("translate:");

  if (isOCR || isTranslate) {
    const type = isOCR ? "OCR" : "Translate";

    const prefixRegex = isOCR ? /^OCR:\s*/i : /^Translate:\s*/i;

    const parts = activity.split("|");

    return {
      type,

      detail:
        String(parts[0] || "")
          .replace(prefixRegex, "")
          .trim() || (isOCR ? "รายการ OCR" : "รายการแปลภาษา"),

      status: String(parts[1] || "สำเร็จ").trim(),
    };
  }

  return {
    type: "SYSTEM",
    detail: activity,
    status: "สำเร็จ",
  };
}

// =========================================================
// SELECTED PAGES
// =========================================================

function parseSelectedPages(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }

  let rawArray = [];

  if (Array.isArray(value)) {
    rawArray = value;
  } else {
    rawArray = String(value).split(",");
  }

  const pages = [
    ...new Set(
      rawArray
        .map((page) => Number(String(page).trim()))
        .filter((page) => Number.isInteger(page) && page > 0),
    ),
  ];

  return pages.sort((a, b) => a - b);
}

// =========================================================
// FILE URL
// =========================================================

function createFileUrl(filePath) {
  if (!filePath) {
    return null;
  }

  const fileName = String(filePath).replace(/\\/g, "/").split("/").pop();

  if (!fileName) {
    return null;
  }

  return `${BASE_URL}/uploads/${encodeURIComponent(fileName)}`;
}

// =========================================================
// FORMAT HISTORY ROW
// =========================================================

function formatHistoryRow(row) {
  const parsed = parseActivity(row.activity_type);

  let itemName = parsed.detail;

  if (parsed.type === "OCR" && row.ocr_name) {
    itemName = row.ocr_name;
  }

  if (parsed.type === "Translate" && row.translation_name) {
    itemName = row.translation_name;
  }

  if (!itemName) {
    if (parsed.type === "OCR") {
      itemName = "OCR Result";
    } else if (parsed.type === "Translate") {
      itemName = "รายการแปลภาษา";
    } else {
      itemName = "system_activity";
    }
  }

  return {
    // =====================================================
    // HISTORY
    // =====================================================

    id: `${parsed.type.toLowerCase()}-${row.history_id}`,

    historyId: row.history_id,

    userId: row.user_id,

    userName: row.display_name || "-",

    userEmail: row.email || "-",

    datetime: row.created_at,

    type: parsed.type,

    filename: itemName,

    itemName,

    detail:
      parsed.type === "OCR"
        ? "บันทึกผล OCR"
        : parsed.type === "Translate"
          ? "รายการแปลภาษา"
          : parsed.detail,

    status: parsed.status,

    // =====================================================
    // FILE
    // =====================================================

    fileId: row.file_id ?? null,

    fileName: row.file_name || "",

    fileType: row.file_type || "",

    filePath: row.file_path || null,

    fileSize: row.file_size ?? null,

    fileUrl: createFileUrl(row.file_path),

    // =====================================================
    // OCR
    // =====================================================

    ocrId: row.ocr_id ?? null,

    ocrName: row.ocr_name || "",

    rawText: row.raw_text || "",

    processedText: row.processed_text || "",

    processingTime: row.processing_time ?? null,

    selectedPages: parseSelectedPages(row.selected_pages),

    approved: Boolean(row.approved),

    approvedAt: row.approved_at || null,

    // =====================================================
    // TRANSLATION
    // =====================================================

    translationId: row.translation_id ?? row.t_translation_id ?? null,

    translationName: row.translation_name || "",

    sourceText: row.source_text || "",

    translatedText: row.translated_text || "",

    sourceLanguage: row.source_language || "auto",

    targetLanguage: row.target_language || "",
  };
}

// =========================================================
// PAGINATION
// =========================================================

function parsePagination(req) {
  let page = Number(req.query.page);

  let limit = Number(req.query.limit);

  if (!Number.isInteger(page) || page < 1) {
    page = 1;
  }

  if (!Number.isInteger(limit) || limit < 1) {
    limit = 5;
  }

  if (limit > 100) {
    limit = 100;
  }

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

// =========================================================
// FILTER
// =========================================================

function normalizeFilter(value) {
  const filter = String(value || "all")
    .trim()
    .toLowerCase();

  const allowed = ["all", "ocr", "translate", "translation"];

  if (allowed.includes(filter)) {
    return filter;
  }

  return "all";
}

// =========================================================
// SEARCH
// =========================================================

function normalizeSearch(value) {
  return String(value || "").trim();
}

// =========================================================
// DATE
// =========================================================

function normalizeDate(value) {
  const date = String(value || "").trim();

  if (!date) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

// =========================================================
// BUILD CONDITIONS
// =========================================================

function buildHistoryConditions(req) {
  const conditions = [];
  const values = [];

  // =======================================================
  // USER
  // =======================================================

  const userId = Number(req.user?.user_id);

  conditions.push("h.user_id = ?");

  values.push(userId);

  // =======================================================
  // FILTER
  // =======================================================

  const filter = normalizeFilter(req.query.filter);

  switch (filter) {
    case "ocr":
      conditions.push(`
        UPPER(
          COALESCE(
            h.activity_type,
            ''
          )
        ) LIKE 'OCR:%'
      `);
      break;

    case "translate":
    case "translation":
      conditions.push(`
        LOWER(
          COALESCE(
            h.activity_type,
            ''
          )
        ) LIKE 'translate:%'
      `);
      break;

    case "all":
    default:
      break;
  }

  // =======================================================
  // DATE RANGE
  // =======================================================

  const startDate = normalizeDate(req.query.startDate);

  const endDate = normalizeDate(req.query.endDate);

  if (startDate === null) {
    const error = new Error("รูปแบบวันเริ่มต้นไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD");

    error.statusCode = 400;

    throw error;
  }

  if (endDate === null) {
    const error = new Error("รูปแบบวันสิ้นสุดไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD");

    error.statusCode = 400;

    throw error;
  }

  if (startDate && endDate && startDate > endDate) {
    const error = new Error("วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด");

    error.statusCode = 400;

    throw error;
  }

  if (startDate) {
    conditions.push("h.created_at >= ?");

    values.push(`${startDate} 00:00:00`);
  }

  if (endDate) {
    conditions.push("h.created_at <= ?");

    values.push(`${endDate} 23:59:59`);
  }

  // =======================================================
  // SEARCH
  // =======================================================

  const search = normalizeSearch(req.query.search);

  if (search) {
    const keyword = `%${search}%`;

    const searchColumns = [
      `COALESCE(h.activity_type, '') LIKE ?`,
      `COALESCE(u.display_name, '') LIKE ?`,
      `COALESCE(u.email, '') LIKE ?`,
      `COALESCE(f.file_name, '') LIKE ?`,
      `COALESCE(f.file_type, '') LIKE ?`,
      `COALESCE(f.file_path, '') LIKE ?`,
      `COALESCE(o.ocr_name, '') LIKE ?`,
      `COALESCE(o.raw_text, '') LIKE ?`,
      `COALESCE(o.processed_text, '') LIKE ?`,
      `COALESCE(t.translation_name, '') LIKE ?`,
      `COALESCE(t.source_text, '') LIKE ?`,
      `COALESCE(t.translated_text, '') LIKE ?`,
      `COALESCE(t.source_language, '') LIKE ?`,
      `COALESCE(t.target_language, '') LIKE ?`,
      `CAST(h.history_id AS CHAR) LIKE ?`,
      `CAST(h.user_id AS CHAR) LIKE ?`,
      `CAST(h.file_id AS CHAR) LIKE ?`,
      `CAST(h.translation_id AS CHAR) LIKE ?`,
      `CAST(o.ocr_id AS CHAR) LIKE ?`,
    ];

    conditions.push(`
      (
        ${searchColumns.join("\n        OR ")}
      )
    `);

    // Push exactly one value
    // for every ? above.
    for (const unusedColumn of searchColumns) {
      values.push(keyword);
    }
  }

  return {
    conditions,
    values,
    search,
    filter,
    startDate: startDate || "",
    endDate: endDate || "",
  };
}

// =========================================================
// MY HISTORY
// =========================================================

async function getMyHistory(req, res) {
  try {
    const userId = Number(req.user?.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบ user_id ใน Session",
      });
    }

    // =====================================================
    // PAGINATION
    // =====================================================

    const { page, limit, offset } = parsePagination(req);

    // =====================================================
    // CONDITIONS
    // =====================================================

    const { conditions, values, search, filter, startDate, endDate } =
      buildHistoryConditions(req);

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // =====================================================
    // COUNT
    // =====================================================

    const countSql = `
      SELECT
        COUNT(
          DISTINCT h.history_id
        ) AS total
      FROM usage_history h
      LEFT JOIN users u
        ON u.user_id =
          h.user_id
      LEFT JOIN files f
        ON f.file_id =
          h.file_id
        AND f.user_id =
          h.user_id
      LEFT JOIN ocr_results o
        ON o.file_id =
          f.file_id
      LEFT JOIN translations t
        ON t.translation_id =
          h.translation_id
        AND t.user_id =
          h.user_id
      ${whereSql}
    `;

    const [countRows] = await pool.query(countSql, values);

    const total = Number(countRows?.[0]?.total || 0);

    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    // =====================================================
    // DATA
    // =====================================================

    // limit / offset are already
    // validated integers.
    // They are embedded here to avoid
    // driver-specific problems with
    // LIMIT ? OFFSET ? in some MariaDB
    // prepared statements.

    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));

    const safeOffset = Math.max(0, Math.trunc(offset));

    const dataSql = `
      SELECT DISTINCT
        h.history_id,
        h.user_id,
        h.activity_type,
        h.created_at,
        h.file_id,
        h.translation_id,
        u.display_name,
        u.email,
        f.file_name,
        f.file_type,
        f.file_path,
        f.file_size,
        o.ocr_id,
        o.ocr_name,
        o.raw_text,
        o.processed_text,
        o.processing_time,
        o.selected_pages,
        o.approved,
        o.approved_at,
        t.translation_id
          AS t_translation_id,
        t.translation_name,
        t.source_text,
        t.translated_text,
        t.source_language,
        t.target_language
      FROM usage_history h
      LEFT JOIN users u
        ON u.user_id =
          h.user_id
      LEFT JOIN files f
        ON f.file_id =
          h.file_id
        AND f.user_id =
          h.user_id
      LEFT JOIN ocr_results o
        ON o.file_id =
          f.file_id
      LEFT JOIN translations t
        ON t.translation_id =
          h.translation_id
        AND t.user_id =
          h.user_id
      ${whereSql}
      ORDER BY
        h.created_at DESC,
        h.history_id DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}
    `;

    const [rows] = await pool.query(dataSql, values);

    const data = rows.map(formatHistoryRow);

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({
      success: true,

      data,

      pagination: {
        currentPage: page,
        perPage: limit,
        total,
        totalPages,

        hasNext: page < totalPages,

        hasPrevious: page > 1,
      },

      filters: {
        search,
        filter,
        startDate,
        endDate,
      },
    });
  } catch (error) {
    console.error("GET MY HISTORY ERROR:", error);

    const statusCode = Number(error?.statusCode) === 400 ? 400 : 500;

    return res.status(statusCode).json({
      success: false,

      message:
        error?.sqlMessage ||
        error?.message ||
        "ไม่สามารถโหลดประวัติการใช้งานได้",
    });
  }
}

// =========================================================
// DELETE ONE HISTORY
// DELETE /api/history/mine/:historyId
// MEMBER ONLY
// =========================================================

async function deleteMyHistory(req, res) {
  try {
    const userId = Number(req.user?.user_id);

    const historyId = Number(req.params.historyId);

    // =====================================================
    // VALIDATE USER
    // =====================================================

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({
        success: false,
        message: "ไม่พบข้อมูลผู้ใช้งาน",
      });
    }

    // =====================================================
    // VALIDATE HISTORY ID
    // =====================================================

    if (!Number.isInteger(historyId) || historyId <= 0) {
      return res.status(400).json({
        success: false,
        message: "historyId ไม่ถูกต้อง",
      });
    }

    // =====================================================
    // CHECK OWNERSHIP
    // =====================================================

    const [rows] = await pool.query(
      `
        SELECT history_id
        FROM usage_history
        WHERE history_id = ?
          AND user_id = ?
        LIMIT 1
        `,
      [historyId, userId],
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "ไม่พบประวัติรายการนี้",
      });
    }

    // =====================================================
    // DELETE
    // ลบเฉพาะประวัติ
    // ไม่ลบไฟล์ / OCR / Translation
    // =====================================================

    const [result] = await pool.query(
      `
        DELETE FROM usage_history
        WHERE history_id = ?
          AND user_id = ?
        LIMIT 1
        `,
      [historyId, userId],
    );

    return res.json({
      success: true,

      message: "ลบประวัติรายการนี้เรียบร้อยแล้ว",

      deletedHistoryId: historyId,

      affectedRows: result.affectedRows,
    });
  } catch (error) {
    console.error("DELETE MY HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message: error?.sqlMessage || error?.message || "ไม่สามารถลบประวัติได้",
    });
  }
}

// =========================================================
// ALL HISTORY
// =========================================================

async function getAllHistory(req, res) {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "ไม่มีสิทธิ์ดูประวัติทั้งหมด",
      });
    }

    const [rows] = await pool.query(`
      SELECT DISTINCT
        h.history_id,
        h.user_id,
        h.activity_type,
        h.created_at,
        h.file_id,
        h.translation_id,
        u.display_name,
        u.email,
        f.file_name,
        f.file_type,
        f.file_path,
        f.file_size,
        o.ocr_id,
        o.ocr_name,
        o.raw_text,
        o.processed_text,
        o.processing_time,
        o.selected_pages,
        o.approved,
        o.approved_at,
        t.translation_id
          AS t_translation_id,
        t.translation_name,
        t.source_text,
        t.translated_text,
        t.source_language,
        t.target_language
      FROM usage_history h
      LEFT JOIN users u
        ON u.user_id =
          h.user_id
      LEFT JOIN files f
        ON f.file_id =
          h.file_id
      LEFT JOIN ocr_results o
        ON o.file_id =
          f.file_id
      LEFT JOIN translations t
        ON t.translation_id =
          h.translation_id
      ORDER BY
        h.created_at DESC,
        h.history_id DESC
      LIMIT 1000
    `);

    return res.json({
      success: true,

      data: rows.map(formatHistoryRow),
    });
  } catch (error) {
    console.error("GET ALL HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message:
        error?.sqlMessage || error?.message || "ไม่สามารถโหลดประวัติทั้งหมดได้",
    });
  }
}

// =========================================================
// CLEAR ALL HISTORY
// =========================================================

async function clearAllHistory(req, res) {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "ไม่มีสิทธิ์ล้างประวัติทั้งหมด",
      });
    }

    await pool.query("TRUNCATE TABLE usage_history");

    return res.json({
      success: true,

      message: "ล้างประวัติการใช้งานทั้งหมดเรียบร้อยแล้ว",

      deletedCount: 0,
    });
  } catch (error) {
    console.error("CLEAR ALL HISTORY ERROR:", error);

    return res.status(500).json({
      success: false,

      message:
        error?.sqlMessage ||
        error?.message ||
        "ไม่สามารถล้างประวัติการใช้งานทั้งหมดได้",
    });
  }
}

// =========================================================
// EXPORT
// =========================================================

module.exports = {
  getMyHistory,
  deleteMyHistory,
  getAllHistory,
  clearAllHistory,
};
