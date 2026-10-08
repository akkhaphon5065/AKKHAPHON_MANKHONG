import {
  apiGet,
  apiPost,
} from "./api";

// =========================================================
// TRANSLATE
// POST /api/translate
// =========================================================

export async function translateText(
  sourceText,
  targetLanguage,
  sourceLanguage = "auto",
) {
  return apiPost(
    "/translate",
    {
      sourceText,
      targetLanguage,
      sourceLanguage,
    },
  );
}

// =========================================================
// SAVE TRANSLATION
// POST /api/translate/result
// =========================================================

export async function saveTranslationResult({
  translationName,
  sourceText,
  translatedText,
  sourceLanguage = "auto",
  targetLanguage = "en",
  processingTime = 0,
  approved = false,
}) {
  return apiPost(
    "/translate/result",
    {
      translationName,
      sourceText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      processingTime,
      approved,
    },
  );
}

// =========================================================
// GET MY TRANSLATIONS
// GET /api/translate/results
// =========================================================

export async function getMyTranslations() {
  return apiGet(
    "/translate/results",
  );
}