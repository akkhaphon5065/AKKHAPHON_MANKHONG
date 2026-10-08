const {
  pool,
} = require("../config/db");

// =========================================================
// TRANSLATE TEXT
// POST /api/translate
//
// แปลอย่างเดียว
// ไม่บันทึก DB
// =========================================================

async function translateText(
  req,
  res,
) {
  try {
    const sourceText =
      String(
        req.body?.sourceText ||
          "",
      ).trim();

    const targetLanguage =
      String(
        req.body?.targetLanguage ||
          "en",
      ).trim();

    if (!sourceText) {
      return res.status(400).json({
        success: false,
        message:
          "กรุณากรอกข้อความต้นฉบับ",
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message:
          "GEMINI_API_KEY ยังไม่ได้ตั้งค่า",
      });
    }

    const model =
      process.env.GEMINI_MODEL ||
      "gemini-2.5-flash";

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(
        apiKey,
      )}`;

    const response =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",

                parts: [
                  {
                    text:
                      `Translate the following text to ${targetLanguage}. Preserve all original line breaks. Return only the translated text.\n\n${sourceText}`,
                  },
                ],
              },
            ],
          }),
        },
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "GEMINI TRANSLATE ERROR:",
        data,
      );

      return res.status(
        response.status === 429
          ? 429
          : 500,
      ).json({
        success: false,
        message:
          data?.error?.message ||
          "Gemini Translation Error",
      });
    }

    const translatedText =
      data?.candidates?.[0]
        ?.content?.parts?.[0]
        ?.text || "";

    if (!translatedText) {
      return res.status(500).json({
        success: false,
        message:
          "Gemini ไม่ได้ส่งผลการแปลกลับมา",
      });
    }

    return res.json({
      success: true,

      sourceText,

      translatedText:
        translatedText
          .split("\n")
          .map(
            (line) =>
              line.trimEnd(),
          )
          .join("\n"),

      targetLanguage,
    });
  } catch (error) {
    console.error(
      "TRANSLATE ERROR:",
      error,
    );

    return res.status(
      error?.status || 500,
    ).json({
      success: false,
      message:
        error?.message ||
        "เกิดข้อผิดพลาดในการแปลภาษา",
    });
  }
}

// =========================================================
// CHECK DUPLICATE
// =========================================================

async function checkTranslationNameDuplicate(
  connection,
  userId,
  translationName,
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        translation_id
      FROM translations
      WHERE
        user_id = ?
        AND LOWER(TRIM(translation_name)) =
            LOWER(TRIM(?))
      LIMIT 1
      `,
      [
        userId,
        translationName,
      ],
    );

  return rows.length > 0;
}

// =========================================================
// SAVE TRANSLATION
// POST /api/translate/result
//
// บันทึกเฉพาะตอนกดปุ่ม "บันทึก"
// =========================================================

async function saveTranslationResult(
  req,
  res,
) {
  const connection =
    await pool.getConnection();

  try {
    const userId =
      Number(
        req.user?.user_id ??
          req.user?.userId ??
          req.user?.id ??
          0,
      );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      connection.release();

      return res.status(401).json({
        success: false,
        message:
          "ไม่พบผู้ใช้งาน",
      });
    }

    const translationName =
      String(
        req.body?.translationName ??
          req.body?.translation_name ??
          "",
      ).trim();

    const sourceText =
      String(
        req.body?.sourceText ||
          "",
      ).trim();

    const translatedText =
      String(
        req.body?.translatedText ??
          req.body?.translated_text ??
          "",
      ).trim();

    const sourceLanguage =
      String(
        req.body?.sourceLanguage ||
          "auto",
      ).trim();

    const targetLanguage =
      String(
        req.body?.targetLanguage ||
          "en",
      ).trim();

    const processingTime =
      Number(
        req.body?.processingTime ||
          0,
      );

    const approved =
      req.body?.approved === true ||
      req.body?.approved === 1 ||
      req.body?.approved === "1"
        ? 1
        : 0;

    // =====================================================
    // VALIDATE
    // =====================================================

    if (!translationName) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "กรุณาตั้งชื่อรายการแปล",
      });
    }

    if (
      translationName.length >
      255
    ) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "ชื่อรายการแปลยาวเกิน 255 ตัวอักษร",
      });
    }

    if (!sourceText) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "ไม่มีข้อความต้นฉบับ",
      });
    }

    if (!translatedText) {
      connection.release();

      return res.status(400).json({
        success: false,
        message:
          "ไม่มีข้อความแปล",
      });
    }

    // =====================================================
    // DUPLICATE NAME
    // =====================================================

    const duplicate =
      await checkTranslationNameDuplicate(
        connection,
        userId,
        translationName,
      );

    if (duplicate) {
      connection.release();

      return res.status(409).json({
        success: false,
        message:
          "ชื่อรายการแปลนี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่",
      });
    }

    await connection.beginTransaction();

    // =====================================================
    // TRANSLATION
    // =====================================================

    const [result] =
      await connection.query(
        `
        INSERT INTO translations
        (
          translation_name,
          source_text,
          translated_text,
          source_language,
          target_language,
          processing_time,
          created_at,
          user_id,
          approved,
          approved_at
        )
        VALUES
        (?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)
        `,
        [
          translationName,
          sourceText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          Number.isFinite(
            processingTime,
          )
            ? processingTime
            : 0,
          userId,
          approved,
          approved
            ? new Date()
            : null,
        ],
      );

    // =====================================================
    // HISTORY
    // =====================================================

    const activityType =
      `Translate:${translationName}|สำเร็จ`;

    const [
      historyResult,
    ] =
      await connection.query(
        `
        INSERT INTO usage_history
        (
          activity_type,
          created_at,
          user_id,
          translation_id
        )
        VALUES
        (?, NOW(), ?, ?)
        `,
        [
          activityType,
          userId,
          result.insertId,
        ],
      );

    await connection.commit();

    connection.release();

    return res.status(201).json({
      success: true,

      translation_id:
        result.insertId,

      history_id:
        historyResult.insertId,

      translation_name:
        translationName,

      message:
        "บันทึกผลการแปลสำเร็จ",
    });
  } catch (error) {
    try {
      await connection.rollback();
    } catch (_) {}

    connection.release();

    console.error(
      "SAVE TRANSLATION ERROR:",
      error,
    );

    // MySQL duplicate
    if (
      error?.code ===
      "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "ชื่อรายการแปลนี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error?.sqlMessage ||
        error?.message ||
        "ไม่สามารถบันทึกผลการแปลได้",
    });
  }
}

// =========================================================
// GET MY TRANSLATIONS
// GET /api/translate/results
// =========================================================

async function getMyTranslations(
  req,
  res,
) {
  try {
    const userId =
      Number(
        req.user?.user_id ??
          req.user?.userId ??
          req.user?.id ??
          0,
      );

    if (
      !Number.isInteger(userId) ||
      userId <= 0
    ) {
      return res.status(401).json({
        success: false,
        message:
          "ไม่พบผู้ใช้งาน",
      });
    }

    const [rows] =
      await pool.query(
        `
        SELECT
          translation_id,
          translation_name,
          source_text,
          translated_text,
          source_language,
          target_language,
          processing_time,
          created_at,
          user_id,
          approved,
          approved_at
        FROM translations
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 500
        `,
        [
          userId,
        ],
      );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error(
      "GET TRANSLATIONS ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        "ไม่สามารถโหลดประวัติการแปลได้",
    });
  }
}

module.exports = {
  translateText,
  saveTranslationResult,
  getMyTranslations,
};