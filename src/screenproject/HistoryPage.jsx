// =========================================================
// HistoryPage.jsx
// OCRThai Plus
//
// THEME:
// ---------------------------------------------------------
// ใช้ธีมเดียวกับ DashboardPage.jsx
//
// OCR:
// Raw OCR      -> raw_text
// AI Cleanup  -> processed_text
//
// IMPORTANT:
// ---------------------------------------------------------
// - Raw OCR และ AI Cleanup เก็บแยกกัน
// - Raw OCR ไม่ถูกนำมาแทน AI Cleanup
// - AI Cleanup แสดง processed_text โดยตรง
// - ไม่ใช้ extractPageText กับ AI Cleanup
// - PDF Preview แสดงตามหน้าที่เลือก
// - Image Preview รองรับ JPG / JPEG / PNG / WEBP / GIF / BMP / SVG
// - Text Preview รองรับ TXT
//
// FILE DETECTION:
// ---------------------------------------------------------
// 1. Magic Bytes
// 2. Content-Type จาก Backend
// 3. file_type จาก Database
// 4. ชื่อไฟล์ / นามสกุลไฟล์
//
// SEARCH:
// ---------------------------------------------------------
// - Search ที่ Database
// - Debounce 400ms
// - Search ใช้ร่วมกับ Filter ประเภท
// - Search ใช้ร่วมกับช่วงวันที่
// - Search ใช้ร่วมกับ Pagination
// - ป้องกัน request เก่าทับ request ใหม่
//
// Pagination:
// -> โหลดครั้งละ 5 รายการ
// =========================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";

import { apiGet, apiDelete } from "../api/api";

import * as pdfjsLib from "pdfjs-dist";

// =========================================================
// PDF WORKER
// =========================================================

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

// =========================================================
// CONFIG
// =========================================================

const HISTORY_API = "/history/mine";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || "http://localhost:5000/api";

const HISTORY_LIMIT = 5;

// =========================================================
// HELPERS
// =========================================================

function getToken() {
  try {
    return localStorage.getItem("userToken") || "";
  } catch (error) {
    console.error("GET TOKEN ERROR:", error);

    return "";
  }
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

function normalizeLower(value) {
  return normalizeString(value).toLowerCase();
}

// =========================================================
// HISTORY ID
// =========================================================

function getHistoryId(item, index = 0) {
  return item?.id ?? item?.historyId ?? item?.history_id ?? `history-${index}`;
}

// =========================================================
// FILE ID
// =========================================================

function getFileId(item) {
  return item?.fileId ?? item?.file_id ?? item?.fileID ?? null;
}

// =========================================================
// OCR ID
// =========================================================

function getOcrId(item) {
  return item?.ocrId ?? item?.ocr_id ?? item?.ocrID ?? null;
}

// =========================================================
// TYPE
// =========================================================

function getHistoryType(item) {
  const value = normalizeLower(
    item?.type ??
      item?.historyType ??
      item?.history_type ??
      item?.activityType ??
      item?.activity_type ??
      "",
  );

  if (value === "ocr" || value.startsWith("ocr:")) {
    return "OCR";
  }

  if (
    value === "translate" ||
    value === "translation" ||
    value.startsWith("translate")
  ) {
    return "Translate";
  }

  return item?.type || "SYSTEM";
}

// =========================================================
// FILE
// =========================================================

function getFilename(item) {
  return (
    item?.filename ??
    item?.fileName ??
    item?.file_name ??
    item?.name ??
    "OCR Result"
  );
}

function getDatetime(item) {
  return (
    item?.datetime ??
    item?.dateTime ??
    item?.createdAt ??
    item?.created_at ??
    item?.updatedAt ??
    item?.updated_at ??
    null
  );
}

function getStatus(item) {
  return item?.status ?? item?.state ?? "สำเร็จ";
}

function getDetail(item) {
  return (
    item?.detail ??
    item?.description ??
    item?.message ??
    item?.activityType ??
    item?.activity_type ??
    "บันทึกประวัติการใช้งาน"
  );
}

function getFileSize(item) {
  return item?.fileSize ?? item?.file_size ?? item?.size ?? 0;
}

function getFileType(item) {
  return (
    item?.fileType ?? item?.file_type ?? item?.mimeType ?? item?.mime_type ?? ""
  );
}

// =========================================================
// OCR TEXT
// =========================================================

function getRawText(item) {
  const direct = item?.rawText;

  if (direct !== undefined && direct !== null && String(direct).trim()) {
    return String(direct);
  }

  return String(item?.raw_text ?? "");
}

function getProcessedText(item) {
  const direct = item?.processedText;

  if (direct !== undefined && direct !== null && String(direct).trim()) {
    return String(direct);
  }

  return String(item?.processed_text ?? "");
}

// =========================================================
// TRANSLATE
// =========================================================

function getSourceText(item) {
  return (
    item?.sourceText ??
    item?.source_text ??
    item?.originalText ??
    item?.original_text ??
    item?.source ??
    ""
  );
}

function getTranslatedText(item) {
  return (
    item?.translatedText ??
    item?.translated_text ??
    item?.translationText ??
    item?.translation_text ??
    item?.resultText ??
    item?.result_text ??
    item?.translated ??
    ""
  );
}

function getSourceLanguage(item) {
  return (
    item?.sourceLanguage ??
    item?.source_language ??
    item?.sourceLang ??
    item?.source_lang ??
    "auto"
  );
}

function getTargetLanguage(item) {
  return (
    item?.targetLanguage ??
    item?.target_language ??
    item?.targetLang ??
    item?.target_lang ??
    ""
  );
}

// =========================================================
// PROCESSING TIME
// =========================================================

function getProcessingTime(item) {
  return (
    item?.processingTime ?? item?.processing_time ?? item?.duration ?? null
  );
}

// =========================================================
// SELECTED PAGES
// =========================================================

function getSelectedPages(item) {
  return item?.selectedPages ?? item?.selected_pages ?? [];
}

// =========================================================
// USER
// =========================================================

function getUserName(item) {
  return (
    item?.userName ??
    item?.user_name ??
    item?.displayName ??
    item?.display_name ??
    item?.name ??
    ""
  );
}

function getUserEmail(item) {
  return item?.userEmail ?? item?.user_email ?? item?.email ?? "";
}

// =========================================================
// NORMALIZE
// =========================================================

function normalizeHistoryItem(item, index = 0) {
  return {
    ...item,

    id: getHistoryId(item, index),

    type: getHistoryType(item),

    filename: getFilename(item),

    datetime: getDatetime(item),

    status: getStatus(item),

    detail: getDetail(item),

    fileId: getFileId(item),

    ocrId: getOcrId(item),

    fileSize: getFileSize(item),

    fileType: getFileType(item),

    rawText: getRawText(item),

    processedText: getProcessedText(item),

    sourceText: getSourceText(item),

    translatedText: getTranslatedText(item),

    sourceLanguage: getSourceLanguage(item),

    targetLanguage: getTargetLanguage(item),

    processingTime: getProcessingTime(item),

    selectedPages: getSelectedPages(item),

    userName: getUserName(item),

    userEmail: getUserEmail(item),
  };
}

// =========================================================
// NORMALIZE PAGES
// =========================================================

function normalizeSelectedPages(value) {
  if (Array.isArray(value)) {
    return [
      ...new Set(
        value
          .map((page) => Number(page))
          .filter((page) => Number.isInteger(page) && page > 0),
      ),
    ].sort((a, b) => a - b);
  }

  if (typeof value === "string") {
    return [
      ...new Set(
        value
          .split(",")
          .map((page) => Number(String(page).trim()))
          .filter((page) => Number.isInteger(page) && page > 0),
      ),
    ].sort((a, b) => a - b);
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? [value] : [];
  }

  return [];
}

// =========================================================
// PDF
// =========================================================

function isPdfFile(item) {
  const filename = normalizeLower(getFilename(item));

  const fileType = normalizeLower(getFileType(item));

  return filename.endsWith(".pdf") || fileType.includes("pdf");
}

// =========================================================
// IMAGE
// =========================================================

function isImageFile(item) {
  const filename = normalizeLower(getFilename(item));

  const fileType = normalizeLower(getFileType(item));

  return (
    /\.(jpg|jpeg|png|gif|webp|bmp|svg|tif|tiff|ico|avif|heic|heif)$/i.test(
      filename,
    ) || fileType.startsWith("image/")
  );
}

// =========================================================
// TEXT FILE
// =========================================================

function isTextFile(item) {
  const filename = normalizeLower(getFilename(item));

  const fileType = normalizeLower(getFileType(item));

  return filename.endsWith(".txt") || fileType.startsWith("text/");
}

// =========================================================
// FILE EXTENSION
// =========================================================

function getFileExtension(filename) {
  const value = normalizeLower(filename);

  const index = value.lastIndexOf(".");

  if (index < 0 || index === value.length - 1) {
    return "";
  }

  return value.slice(index + 1);
}

// =========================================================
// RAW OCR PAGE TEXT
// =========================================================

function extractPageText(text, pageNumber) {
  if (!text) {
    return "";
  }

  const page = Number(pageNumber);

  if (!Number.isInteger(page) || page <= 0) {
    return "";
  }

  const input = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const startPattern = new RegExp(
    `(?:^|\\n)\\s*-*\\s*Page\\s+${page}\\s*\\/\\s*\\d+\\s*-*=*\\s*`,
    "i",
  );

  const startMatch = startPattern.exec(input);

  let startIndex = -1;

  if (startMatch) {
    startIndex = startMatch.index + startMatch[0].length;
  }

  if (startIndex < 0) {
    const loosePattern = new RegExp(`Page\\s+${page}\\s*\\/\\s*\\d+`, "i");

    const looseMatch = loosePattern.exec(input);

    if (looseMatch) {
      startIndex = looseMatch.index + looseMatch[0].length;

      const afterText = input.slice(startIndex);

      const markerEnd = afterText.match(/^[\s\-=_]*/);

      if (markerEnd) {
        startIndex += markerEnd[0].length;
      }
    }
  }

  if (startIndex < 0) {
    return "";
  }

  const nextPattern = /(?:^|\n)\s*-*\s*Page\s+\d+\s*\/\s*\d+\s*-*=*/gi;

  nextPattern.lastIndex = startIndex;

  const nextMatch = nextPattern.exec(input);

  const endIndex = nextMatch ? nextMatch.index : input.length;

  return input.slice(startIndex, endIndex).trim();
}

// =========================================================
// FORMATTERS
// =========================================================

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const diff = Date.now() - date.getTime();

  if (diff < 0) {
    return date.toLocaleString("th-TH");
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const hours = Math.floor(diff / (1000 * 60 * 60));

  const minutes = Math.floor(diff / (1000 * 60));

  if (days > 0) {
    return `${days} วันที่แล้ว`;
  }

  if (hours > 0) {
    return `${hours} ชั่วโมงที่แล้ว`;
  }

  if (minutes > 0) {
    return `${minutes} นาทีที่แล้ว`;
  }

  return "เมื่อสักครู่";
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);

  if (value <= 0) {
    return "-";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(2)} KB`;
  }

  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatProcessingTime(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return String(value);
  }

  return number.toFixed(2);
}

function getLanguageName(language) {
  const value = normalizeLower(language);

  const names = {
    auto: "อัตโนมัติ",
    th: "Thai",
    en: "English",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
  };

  return names[value] || language || "-";
}

function getErrorStatus(error) {
  return error?.status ?? error?.statusCode ?? error?.response?.status ?? null;
}

// =========================================================
// FORMAT ROLE
// =========================================================

function formatRole(role) {
  if (!role) {
    return "Guest";
  }

  return (
    String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
  );
}

// =========================================================
// COMPONENT
// =========================================================

export default function HistoryPage() {
  const navigate = useNavigate();

  // =======================================================
  // SESSION
  // =======================================================

  const [session, setSession] = useState(null);

  // =======================================================
  // HISTORY
  // =======================================================

  const [rawHistory, setRawHistory] = useState([]);

  // =======================================================
  // PAGINATION
  // =======================================================

  const [currentPage, setCurrentPage] = useState(1);

  const [hasNextPage, setHasNextPage] = useState(false);

  const [totalHistory, setTotalHistory] = useState(null);

  const [totalPages, setTotalPages] = useState(null);

  // =======================================================
  // FILTER
  // =======================================================

  const [currentFilter, setCurrentFilter] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  // =======================================================
  // REQUEST CONTROL
  // =======================================================

  const requestIdRef = useRef(0);

  const initialHistoryLoadRef = useRef(true);

  // =======================================================
  // LOADING
  // =======================================================

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  // =======================================================
  // MODAL
  // =======================================================

  const [selectedItem, setSelectedItem] = useState(null);

  // =======================================================
  // PDF
  // =======================================================

  const [pdfPages, setPdfPages] = useState([]);

  const [pdfLoading, setPdfLoading] = useState(false);

  const [pdfError, setPdfError] = useState("");

  // =======================================================
  // IMAGE
  // =======================================================

  const [imagePreview, setImagePreview] = useState("");

  const [imageLoading, setImageLoading] = useState(false);

  const [imageError, setImageError] = useState("");

  // previewKind:
  // "loading"
  // "image"
  // "pdf"
  // "text"
  // ""

  const [previewKind, setPreviewKind] = useState("");

  // =======================================================
  // TEXT PREVIEW
  // =======================================================

  const [textPreview, setTextPreview] = useState("");

  // =======================================================
  // TEXT MODE
  // =======================================================

  const [textMode, setTextMode] = useState("processed");

  // =======================================================
  // OPEN FILE
  // =======================================================

  const [openingFileId, setOpeningFileId] = useState(null);

  // =======================================================
  // DELETE HISTORY
  // =======================================================

  const [deletingHistoryId, setDeletingHistoryId] = useState(null);

  // =======================================================
  // SESSION CHECK
  // =======================================================

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("ocrthai_session") || "null",
      );

      if (!stored || !getToken()) {
        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      setSession(stored);
    } catch (error) {
      console.error("SESSION ERROR:", error);

      localStorage.removeItem("ocrthai_session");

      localStorage.removeItem("userToken");

      navigate("/user-login", {
        replace: true,
      });
    }
  }, [navigate]);

  // =======================================================
  // SEARCH DEBOUNCE
  // =======================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // =======================================================
  // LOAD HISTORY
  // =======================================================

  const loadHistory = useCallback(
    async (page = 1, showLoading = true) => {
      const requestId = ++requestIdRef.current;

      try {
        if (showLoading) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setErrorMessage("");

        const params = new URLSearchParams();

        params.set("page", String(page));

        params.set("limit", String(HISTORY_LIMIT));

        if (currentFilter && currentFilter !== "all") {
          params.set("filter", currentFilter);
        }

        if (startDate) {
          params.set("startDate", startDate);
        }

        if (endDate) {
          params.set("endDate", endDate);
        }

        if (debouncedSearchTerm) {
          params.set("search", debouncedSearchTerm);
        }

        const historyResult = await apiGet(
          `${HISTORY_API}?${params.toString()}`,
        );

        if (requestId !== requestIdRef.current) {
          return;
        }

        if (!historyResult?.success) {
          throw new Error(historyResult?.message || "ไม่สามารถโหลดประวัติได้");
        }

        let historyData = [];

        if (Array.isArray(historyResult?.data)) {
          historyData = historyResult.data;
        } else if (Array.isArray(historyResult?.data?.data)) {
          historyData = historyResult.data.data;
        } else if (Array.isArray(historyResult?.history)) {
          historyData = historyResult.history;
        }

        const normalized = historyData.map((item, index) =>
          normalizeHistoryItem(item, index),
        );

        setRawHistory(normalized);

        setCurrentPage(page);

        const pagination =
          historyResult?.pagination ||
          historyResult?.meta ||
          historyResult?.data?.pagination ||
          historyResult?.data?.meta ||
          null;

        let next = false;

        let total = null;

        let pageCount = null;

        if (pagination) {
          if (typeof pagination.hasNext === "boolean") {
            next = pagination.hasNext;
          }

          if (typeof pagination.has_next === "boolean") {
            next = pagination.has_next;
          }

          if (
            typeof pagination.currentPage === "number" &&
            typeof pagination.totalPages === "number"
          ) {
            next = pagination.currentPage < pagination.totalPages;

            pageCount = pagination.totalPages;
          }

          if (
            typeof pagination.current_page === "number" &&
            typeof pagination.total_pages === "number"
          ) {
            next = pagination.current_page < pagination.total_pages;

            pageCount = pagination.total_pages;
          }

          const paginationTotal =
            pagination.total ??
            pagination.totalItems ??
            pagination.total_items ??
            pagination.count ??
            null;

          if (paginationTotal !== null && paginationTotal !== undefined) {
            const parsed = Number(paginationTotal);

            if (Number.isFinite(parsed)) {
              total = parsed;
            }
          }
        }

        if (!pageCount && total !== null) {
          pageCount = Math.ceil(total / HISTORY_LIMIT);
        }

        if (total === 0) {
          next = false;
        }

        if (normalized.length < HISTORY_LIMIT) {
          next = false;
        }

        setHasNextPage(next);

        setTotalHistory(total);

        setTotalPages(pageCount);
      } catch (error) {
        if (requestId !== requestIdRef.current) {
          return;
        }

        console.error("LOAD HISTORY ERROR:", error);

        const status = getErrorStatus(error);

        if (status === 401) {
          localStorage.removeItem("userToken");

          localStorage.removeItem("ocrthai_session");

          navigate("/user-login", {
            replace: true,
          });

          return;
        }

        setErrorMessage(error?.message || "ไม่สามารถโหลดประวัติการใช้งานได้");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);

          setRefreshing(false);
        }
      }
    },
    [navigate, currentFilter, debouncedSearchTerm, startDate, endDate],
  );

  // =======================================================
  // LOAD WHEN FILTER OR SEARCH CHANGES
  // =======================================================

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);

      return;
    }

    const showFullPageLoading = initialHistoryLoadRef.current;

    initialHistoryLoadRef.current = false;

    loadHistory(1, showFullPageLoading);
  }, [loadHistory]);

  // =======================================================
  // FOCUS REFRESH
  // =======================================================

  useEffect(() => {
    const handleFocus = () => {
      if (getToken() && !loading && !refreshing) {
        loadHistory(currentPage, false);
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadHistory, currentPage, loading, refreshing]);

  // =======================================================
  // CLOSE MODAL
  // =======================================================

  const closeModal = useCallback(() => {
    setSelectedItem(null);

    setPdfPages([]);

    setPdfError("");

    setImageLoading(false);

    setImageError("");

    setPreviewKind("");

    setTextPreview("");

    setImagePreview((oldUrl) => {
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch (_) {}
      }

      return "";
    });

    setTextMode("processed");
  }, []);

  // =======================================================
  // IMAGE URL CLEANUP
  // =======================================================

  useEffect(() => {
    return () => {
      if (imagePreview) {
        try {
          URL.revokeObjectURL(imagePreview);
        } catch (_) {}
      }
    };
  }, [imagePreview]);

  // =======================================================
  // ESC CLOSE
  // =======================================================

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeModal]);

  // =======================================================
  // SORT
  // =======================================================

  const filteredHistory = useMemo(
    () =>
      [...rawHistory].sort((a, b) => {
        const dateA = new Date(getDatetime(a)).getTime();

        const dateB = new Date(getDatetime(b)).getTime();

        const safeA = Number.isNaN(dateA) ? 0 : dateA;

        const safeB = Number.isNaN(dateB) ? 0 : dateB;

        return safeB - safeA;
      }),
    [rawHistory],
  );

  // =======================================================
  // PDF PREVIEW
  // =======================================================

  const loadSelectedPdfPages = useCallback(
    async (item) => {
      const fileId = getFileId(item);

      if (!fileId) {
        setPdfError("ไม่พบ file_id");

        return;
      }

      const token = getToken();

      if (!token) {
        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      try {
        setPdfLoading(true);

        setPdfError("");

        setPdfPages([]);

        const baseUrl = String(
          API_BASE_URL || "http://localhost:5000/api",
        ).replace(/\/$/, "");

        const response = await fetch(
          `${baseUrl}/ocr/files/${encodeURIComponent(fileId)}/open`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.status === 401) {
          localStorage.removeItem("userToken");

          localStorage.removeItem("ocrthai_session");

          navigate("/user-login", {
            replace: true,
          });

          return;
        }

        if (!response.ok) {
          let message = "ไม่สามารถโหลด PDF ได้";

          try {
            const data = await response.json();

            message = data?.message || data?.error || message;
          } catch (_) {}

          throw new Error(message);
        }

        const buffer = await response.arrayBuffer();

        if (!buffer || buffer.byteLength === 0) {
          throw new Error("ไฟล์ PDF ว่างเปล่า");
        }

        const pdf = await pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
        }).promise;

        let pages = normalizeSelectedPages(getSelectedPages(item));

        pages = pages.filter((page) => page >= 1 && page <= pdf.numPages);

        if (pages.length === 0) {
          pages = Array.from(
            {
              length: pdf.numPages,
            },
            (_, index) => index + 1,
          );
        }

        const rendered = [];

        for (const pageNumber of pages) {
          const page = await pdf.getPage(pageNumber);

          const viewport = page.getViewport({
            scale: 1.35,
          });

          const canvas = document.createElement("canvas");

          const context = canvas.getContext("2d");

          if (!context) {
            continue;
          }

          canvas.width = Math.ceil(viewport.width);

          canvas.height = Math.ceil(viewport.height);

          await page.render({
            canvasContext: context,
            viewport,
          }).promise;

          rendered.push({
            page: pageNumber,
            image: canvas.toDataURL("image/jpeg", 0.9),
          });
        }

        setPdfPages(rendered);
      } catch (error) {
        console.error("PDF PREVIEW ERROR:", error);

        setPdfError(error?.message || "ไม่สามารถแสดง PDF ได้");
      } finally {
        setPdfLoading(false);
      }
    },
    [navigate],
  );

  // =======================================================
  // ORIGINAL FILE PREVIEW
  // =======================================================
  //
  // ตรวจชนิดไฟล์ตามลำดับ:
  // 1. Magic Bytes
  // 2. Content-Type จาก Backend
  // 3. file_type จาก Database
  // 4. ชื่อไฟล์ / นามสกุล
  //
  // เพื่อแก้กรณี Backend ส่ง application/octet-stream
  // แต่ไฟล์จริงเป็น JPG / PNG / PDF / TXT
  // =======================================================

  const loadSelectedFilePreview = useCallback(
    async (item) => {
      const fileId = getFileId(item);

      if (!fileId) {
        setPreviewKind("");

        setImageError("ไม่พบ file_id");

        setPdfError("ไม่พบ file_id");

        return;
      }

      const token = getToken();

      if (!token) {
        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      try {
        setImageLoading(true);

        setPdfLoading(true);

        setImageError("");

        setPdfError("");

        setPdfPages([]);

        setTextPreview("");

        setPreviewKind("loading");

        setImagePreview((oldUrl) => {
          if (oldUrl) {
            try {
              URL.revokeObjectURL(oldUrl);
            } catch (_) {}
          }

          return "";
        });

        const baseUrl = String(
          API_BASE_URL || "http://localhost:5000/api",
        ).replace(/\/$/, "");

        const response = await fetch(
          `${baseUrl}/ocr/files/${encodeURIComponent(fileId)}/open`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.status === 401) {
          localStorage.removeItem("userToken");

          localStorage.removeItem("ocrthai_session");

          navigate("/user-login", {
            replace: true,
          });

          return;
        }

        if (!response.ok) {
          let message = "ไม่สามารถโหลดไฟล์ต้นฉบับได้";

          try {
            const contentType = normalizeLower(
              response.headers.get("content-type"),
            );

            if (contentType.includes("application/json")) {
              const data = await response.json();

              message = data?.message || data?.error || message;
            } else {
              const text = await response.text();

              if (text.trim()) {
                message = text.trim();
              }
            }
          } catch (_) {}

          throw new Error(message);
        }

        // =================================================
        // RESPONSE METADATA
        // =================================================

        const responseContentType = normalizeLower(
          response.headers.get("content-type"),
        );

        const responseContentLength = response.headers.get("content-length");

        const buffer = await response.arrayBuffer();

        if (!buffer || buffer.byteLength === 0) {
          throw new Error("ไฟล์ต้นฉบับว่างเปล่า");
        }

        const bytes = new Uint8Array(buffer);

        // =================================================
        // HELPERS
        // =================================================

        const startsWithAscii = (value) => {
          if (bytes.length < value.length) {
            return false;
          }

          for (let index = 0; index < value.length; index += 1) {
            if (bytes[index] !== value.charCodeAt(index)) {
              return false;
            }
          }

          return true;
        };

        const asciiAt = (start, length) => {
          if (start < 0 || length <= 0 || bytes.length < start + length) {
            return "";
          }

          try {
            return new TextDecoder("ascii").decode(
              bytes.slice(start, start + length),
            );
          } catch (_) {
            return "";
          }
        };

        // =================================================
        // DATABASE METADATA
        // =================================================

        const databaseFileType = normalizeLower(getFileType(item));

        const databaseFilename = normalizeLower(getFilename(item));

        const databaseExtension = getFileExtension(databaseFilename);

        // =================================================
        // DETECT
        // =================================================

        let detectedKind = "";

        let detectedMime = "";

        // =================================================
        // 1. MAGIC BYTES
        // =================================================

        // PDF
        if (startsWithAscii("%PDF-")) {
          detectedKind = "pdf";

          detectedMime = "application/pdf";
        }

        // JPEG
        if (
          !detectedKind &&
          bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff
        ) {
          detectedKind = "image";

          detectedMime = "image/jpeg";
        }

        // PNG
        if (
          !detectedKind &&
          bytes.length >= 8 &&
          bytes[0] === 0x89 &&
          bytes[1] === 0x50 &&
          bytes[2] === 0x4e &&
          bytes[3] === 0x47 &&
          bytes[4] === 0x0d &&
          bytes[5] === 0x0a &&
          bytes[6] === 0x1a &&
          bytes[7] === 0x0a
        ) {
          detectedKind = "image";

          detectedMime = "image/png";
        }

        // GIF
        if (
          !detectedKind &&
          bytes.length >= 6 &&
          (startsWithAscii("GIF87a") || startsWithAscii("GIF89a"))
        ) {
          detectedKind = "image";

          detectedMime = "image/gif";
        }

        // WEBP
        if (
          !detectedKind &&
          bytes.length >= 12 &&
          startsWithAscii("RIFF") &&
          asciiAt(8, 4) === "WEBP"
        ) {
          detectedKind = "image";

          detectedMime = "image/webp";
        }

        // BMP
        if (
          !detectedKind &&
          bytes.length >= 2 &&
          bytes[0] === 0x42 &&
          bytes[1] === 0x4d
        ) {
          detectedKind = "image";

          detectedMime = "image/bmp";
        }

        // TIFF
        if (
          !detectedKind &&
          bytes.length >= 4 &&
          ((bytes[0] === 0x49 &&
            bytes[1] === 0x49 &&
            bytes[2] === 0x2a &&
            bytes[3] === 0x00) ||
            (bytes[0] === 0x4d &&
              bytes[1] === 0x4d &&
              bytes[2] === 0x00 &&
              bytes[3] === 0x2a))
        ) {
          detectedKind = "image";

          detectedMime = "image/tiff";
        }

        // ICO
        if (
          !detectedKind &&
          bytes.length >= 4 &&
          bytes[0] === 0x00 &&
          bytes[1] === 0x00 &&
          bytes[2] === 0x01 &&
          bytes[3] === 0x00
        ) {
          detectedKind = "image";

          detectedMime = "image/x-icon";
        }

        // AVIF / HEIC / HEIF
        if (!detectedKind && bytes.length >= 12) {
          const boxType = asciiAt(4, 4);

          if (boxType === "ftyp") {
            const brands = new TextDecoder("ascii")
              .decode(bytes.slice(8, Math.min(bytes.length, 256)))
              .toLowerCase();

            if (brands.includes("avif") || brands.includes("avis")) {
              detectedKind = "image";

              detectedMime = "image/avif";
            } else if (
              brands.includes("heic") ||
              brands.includes("heix") ||
              brands.includes("hevc") ||
              brands.includes("hevx") ||
              brands.includes("mif1") ||
              brands.includes("msf1")
            ) {
              detectedKind = "image";

              detectedMime = "image/heic";
            }
          }
        }

        // =================================================
        // SVG / TEXT BASED IMAGE
        // =================================================

        if (!detectedKind) {
          try {
            const textHead = new TextDecoder("utf-8")
              .decode(bytes.slice(0, Math.min(bytes.length, 4096)))
              .replace(/^\uFEFF/, "")
              .replace(/<!--[^]*?-->/g, " ")
              .trim()
              .toLowerCase();

            if (
              textHead.startsWith("<svg") ||
              (textHead.includes("<svg") &&
                (textHead.startsWith("<?xml") ||
                  textHead.startsWith("<!doctype")))
            ) {
              detectedKind = "image";

              detectedMime = "image/svg+xml";
            }
          } catch (_) {}
        }

        // =================================================
        // TEXT FILE BY CONTENT
        // =================================================

        if (!detectedKind) {
          try {
            const textHead = new TextDecoder("utf-8", {
              fatal: false,
            })
              .decode(bytes.slice(0, Math.min(bytes.length, 4096)))
              .replace(/^\uFEFF/, "");

            // ตรวจว่าเป็นข้อความที่อ่านได้
            // และไม่พบ binary control characters รุนแรง
            const suspiciousBinary = /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(
              textHead,
            );

            if (!suspiciousBinary && textHead.trim()) {
              if (
                responseContentType.startsWith("text/") ||
                databaseFileType.startsWith("text/") ||
                databaseExtension === "txt"
              ) {
                detectedKind = "text";

                detectedMime = "text/plain;charset=utf-8";
              }
            }
          } catch (_) {}
        }

        // =================================================
        // 2. CONTENT-TYPE BACKEND
        // =================================================

        if (!detectedKind) {
          if (responseContentType.includes("application/pdf")) {
            detectedKind = "pdf";

            detectedMime = "application/pdf";
          } else if (responseContentType.startsWith("image/")) {
            detectedKind = "image";

            detectedMime = responseContentType;
          } else if (responseContentType.startsWith("text/")) {
            detectedKind = "text";

            detectedMime = responseContentType;
          }
        }

        // =================================================
        // 3. DATABASE file_type
        // =================================================

        if (!detectedKind) {
          if (databaseFileType.includes("pdf")) {
            detectedKind = "pdf";

            detectedMime = "application/pdf";
          } else if (databaseFileType.startsWith("image/")) {
            detectedKind = "image";

            detectedMime = databaseFileType;
          } else if (databaseFileType.startsWith("text/")) {
            detectedKind = "text";

            detectedMime = databaseFileType;
          }
        }

        // =================================================
        // 4. DATABASE FILENAME / EXTENSION
        // =================================================

        if (!detectedKind) {
          if (databaseExtension === "pdf") {
            detectedKind = "pdf";

            detectedMime = "application/pdf";
          } else if (
            [
              "jpg",
              "jpeg",
              "png",
              "gif",
              "webp",
              "bmp",
              "svg",
              "tif",
              "tiff",
              "ico",
              "avif",
              "heic",
              "heif",
            ].includes(databaseExtension)
          ) {
            detectedKind = "image";

            const extensionMimeMap = {
              jpg: "image/jpeg",
              jpeg: "image/jpeg",
              png: "image/png",
              gif: "image/gif",
              webp: "image/webp",
              bmp: "image/bmp",
              svg: "image/svg+xml",
              tif: "image/tiff",
              tiff: "image/tiff",
              ico: "image/x-icon",
              avif: "image/avif",
              heic: "image/heic",
              heif: "image/heif",
            };

            detectedMime =
              extensionMimeMap[databaseExtension] || "application/octet-stream";
          } else if (databaseExtension === "txt") {
            detectedKind = "text";

            detectedMime = "text/plain;charset=utf-8";
          }
        }

        // =================================================
        // LOG
        // =================================================

        console.log("HISTORY PREVIEW RESPONSE:", {
          fileId,
          responseContentType,
          responseContentLength,
          databaseFileType,
          databaseFilename,
          databaseExtension,
          detectedKind,
          detectedMime,
          size: buffer.byteLength,
        });

        // =================================================
        // PDF PREVIEW
        // =================================================

        if (detectedKind === "pdf") {
          const pdf = await pdfjsLib.getDocument({
            data: bytes,
          }).promise;

          let pages = normalizeSelectedPages(getSelectedPages(item));

          pages = pages.filter((page) => page >= 1 && page <= pdf.numPages);

          if (pages.length === 0) {
            pages = Array.from(
              {
                length: pdf.numPages,
              },
              (_, index) => index + 1,
            );
          }

          const rendered = [];

          for (const pageNumber of pages) {
            const page = await pdf.getPage(pageNumber);

            const viewport = page.getViewport({
              scale: 1.35,
            });

            const canvas = document.createElement("canvas");

            const context = canvas.getContext("2d");

            if (!context) {
              continue;
            }

            canvas.width = Math.ceil(viewport.width);

            canvas.height = Math.ceil(viewport.height);

            await page.render({
              canvasContext: context,
              viewport,
            }).promise;

            rendered.push({
              page: pageNumber,
              image: canvas.toDataURL("image/jpeg", 0.9),
            });
          }

          if (rendered.length === 0) {
            throw new Error("ไม่สามารถสร้าง PDF Preview ได้");
          }

          setPdfPages(rendered);

          setPreviewKind("pdf");

          setPdfError("");

          return;
        }

        // =================================================
        // IMAGE PREVIEW
        // =================================================

        if (detectedKind === "image") {
          let mimeType = String(detectedMime || "").trim();

          if (!mimeType || !mimeType.startsWith("image/")) {
            if (responseContentType.startsWith("image/")) {
              mimeType = responseContentType;
            } else if (databaseFileType.startsWith("image/")) {
              mimeType = databaseFileType;
            } else {
              const extensionMimeMap = {
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                png: "image/png",
                gif: "image/gif",
                webp: "image/webp",
                bmp: "image/bmp",
                svg: "image/svg+xml",
                tif: "image/tiff",
                tiff: "image/tiff",
                ico: "image/x-icon",
                avif: "image/avif",
                heic: "image/heic",
                heif: "image/heif",
              };

              mimeType =
                extensionMimeMap[databaseExtension] ||
                "application/octet-stream";
            }
          }

          const blob = new Blob([buffer], {
            type: mimeType,
          });

          if (!blob.size) {
            throw new Error("ไฟล์รูปภาพว่างเปล่า");
          }

          const objectUrl = URL.createObjectURL(blob);

          setImagePreview(objectUrl);

          setPreviewKind("image");

          setImageError("");

          return;
        }

        // =================================================
        // TEXT PREVIEW
        // =================================================

        if (detectedKind === "text") {
          let textContent = "";

          try {
            textContent = new TextDecoder("utf-8", {
              fatal: false,
            }).decode(bytes);
          } catch (error) {
            console.warn("TEXT DECODER ERROR:", error);

            textContent = new TextDecoder("utf-8").decode(bytes);
          }

          setTextPreview(textContent);

          setPreviewKind("text");

          setImageError("");

          setPdfError("");

          return;
        }

        // =================================================
        // UNKNOWN
        // =================================================

        throw new Error(
          "ไม่สามารถตรวจชนิดไฟล์ต้นฉบับได้ กรุณาตรวจสอบ file_type และไฟล์ในโฟลเดอร์ uploads",
        );
      } catch (error) {
        console.error("ORIGINAL FILE PREVIEW ERROR:", error);

        setPreviewKind("");

        const message = error?.message || "ไม่สามารถแสดงไฟล์ต้นฉบับได้";

        setImageError(message);

        setPdfError(message);
      } finally {
        setImageLoading(false);

        setPdfLoading(false);
      }
    },
    [navigate],
  );

  // =======================================================
  // SELECT HISTORY
  // =======================================================

  const handleSelectItem = async (item) => {
    setSelectedItem(item);

    setPdfPages([]);

    setPdfError("");

    setImageError("");

    setImageLoading(false);

    setPdfLoading(false);

    setPreviewKind("");

    setTextPreview("");

    setImagePreview((oldUrl) => {
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
        } catch (_) {}
      }

      return "";
    });

    const type = normalizeLower(item?.type);

    if (type === "ocr") {
      const hasAI = Boolean(getProcessedText(item).trim());

      setTextMode(hasAI ? "processed" : "raw");

      if (getFileId(item)) {
        await loadSelectedFilePreview(item);
      }

      return;
    }

    if (type === "translate" || type === "translation") {
      setTextMode("translated");

      return;
    }

    setTextMode("processed");
  };

  // =======================================================
  // DELETE HISTORY
  // =======================================================

  const handleDeleteHistory = async (item, event) => {
    if (event) {
      event.preventDefault();

      event.stopPropagation();
    }

    const historyId = item?.historyId ?? item?.history_id ?? null;

    if (
      !historyId ||
      !Number.isInteger(Number(historyId)) ||
      Number(historyId) <= 0
    ) {
      alert("ไม่พบ history_id ของรายการนี้");

      return;
    }

    const itemName =
      item?.filename ||
      item?.itemName ||
      (normalizeLower(item?.type) === "translate"
        ? "รายการแปลภาษา"
        : "รายการ OCR");

    const confirmed = window.confirm(
      `ต้องการลบประวัติ "${itemName}" หรือไม่?\n\nการลบครั้งนี้จะลบเฉพาะรายการออกจากประวัติการใช้งาน และจะไม่ลบไฟล์หรือผล OCR ในระบบ`,
    );

    if (!confirmed) {
      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/user-login", {
        replace: true,
      });

      return;
    }

    try {
      setDeletingHistoryId(String(historyId));

      setErrorMessage("");

      const result = await apiDelete(
        `/history/mine/${encodeURIComponent(historyId)}`,
      );

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถลบประวัติได้");
      }

      if (
        selectedItem &&
        String(getHistoryId(selectedItem)) === String(historyId)
      ) {
        closeModal();
      }

      const nextPage =
        currentPage > 1 && filteredHistory.length === 1
          ? currentPage - 1
          : currentPage;

      await loadHistory(nextPage, false);
    } catch (error) {
      console.error("DELETE HISTORY ERROR:", error);

      if (getErrorStatus(error) === 401) {
        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      alert(error?.message || "ไม่สามารถลบประวัติการใช้งานได้");
    } finally {
      setDeletingHistoryId(null);
    }
  };

  // =======================================================
  // OPEN FULL FILE
  // =======================================================

  const handleOpenFile = async (item) => {
    const fileId = getFileId(item);

    if (!fileId) {
      alert("รายการนี้ไม่มี file_id");

      return;
    }

    const token = getToken();

    if (!token) {
      navigate("/user-login", {
        replace: true,
      });

      return;
    }

    const newWindow = window.open("", "_blank");

    if (!newWindow) {
      alert("Browser บล็อก Pop-up กรุณาอนุญาต Pop-up");

      return;
    }

    try {
      setOpeningFileId(fileId);

      newWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>OCRThai Plus</title>
              <meta charset="UTF-8" />
              <style>
                body {
                  margin: 0;
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #0f0f23;
                  color: #ffffff;
                  font-family: Arial, sans-serif;
                }
              </style>
            </head>
            <body>
              กำลังเปิดไฟล์...
            </body>
          </html>
        `);

      newWindow.document.close();

      const baseUrl = String(
        API_BASE_URL || "http://localhost:5000/api",
      ).replace(/\/$/, "");

      const response = await fetch(
        `${baseUrl}/ocr/files/${encodeURIComponent(fileId)}/open`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.status === 401) {
        try {
          newWindow.close();
        } catch (_) {}

        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      if (!response.ok) {
        let message = "ไม่สามารถเปิดไฟล์ได้";

        try {
          const data = await response.json();

          message = data?.message || data?.error || message;
        } catch (_) {}

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("ไฟล์ที่ได้รับว่างเปล่า");
      }

      const objectUrl = URL.createObjectURL(blob);

      newWindow.location.href = objectUrl;

      setTimeout(() => {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
      }, 300000);
    } catch (error) {
      console.error("OPEN FILE ERROR:", error);

      try {
        newWindow.close();
      } catch (_) {}

      alert(error?.message || "ไม่สามารถเปิดไฟล์ได้");
    } finally {
      setOpeningFileId(null);
    }
  };

  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {
    localStorage.removeItem("ocrthai_session");

    localStorage.removeItem("userToken");

    setSession(null);

    navigate("/user-login", {
      replace: true,
    });
  };

  // =======================================================
  // PAGINATION
  // =======================================================

  const goToPreviousPage = () => {
    if (currentPage <= 1 || refreshing) {
      return;
    }

    loadHistory(currentPage - 1, false);
  };

  const goToNextPage = () => {
    if (!hasNextPage || refreshing) {
      return;
    }

    loadHistory(currentPage + 1, false);
  };

  // =======================================================
  // FILTER
  // =======================================================

  const handleFilterChange = (filter) => {
    setCurrentFilter(filter);

    setCurrentPage(1);
  };

  // =======================================================
  // DATE RANGE
  // =======================================================

  const handleStartDateChange = (event) => {
    const value = event.target.value;

    setStartDate(value);

    setCurrentPage(1);

    if (endDate && value && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (event) => {
    const value = event.target.value;

    setEndDate(value);

    setCurrentPage(1);
  };

  const clearDateRange = () => {
    setStartDate("");

    setEndDate("");

    setCurrentPage(1);
  };

  // =======================================================
  // SEARCH
  // =======================================================

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);

    setCurrentPage(1);
  };

  // =======================================================
  // LOADING
  // =======================================================

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",

          background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)",

          color: "#ffffff",

          display: "grid",

          placeItems: "center",

          fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
        }}
      >
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "40px",

              marginBottom: "12px",
            }}
          >
            📚
          </div>

          <div
            style={{
              fontSize: "17px",

              fontWeight: "600",
            }}
          >
            กำลังโหลดประวัติการใช้งาน...
          </div>
        </div>
      </div>
    );
  }

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div className="history-page">
      <style>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
        }

        body {
          min-height: 100vh;
        }

        .history-page {
          min-height: 100vh;

          background:
            linear-gradient(
              135deg,
              #0f0f23 0%,
              #1a1a2e 100%
            );

          color: #ffffff;

          font-family:
            "Plus Jakarta Sans",
            "Inter",
            sans-serif;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background:
            rgba(255,255,255,0.04);
        }

        ::-webkit-scrollbar-thumb {
          background: #6366f1;
          border-radius: 999px;
        }

        .nav-menu {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .nav-link {
          display: inline-block;
          padding: 8px 16px;
          margin: 0 4px;
          color:
            rgba(255,255,255,0.8);
          text-decoration: none;
          border-radius: 12px;
          transition:
            all 0.3s ease;
          font-weight: 500;
          font-size: 14px;
        }

        .nav-link:hover {
          background:
            rgba(255,255,255,0.1);
          color: #ffffff;
          transform:
            translateY(-1px);
        }

        .nav-link.Active {
          background:
            linear-gradient(
              135deg,
              rgba(99,102,241,0.2) 0%,
              rgba(139,92,246,0.2) 100%
            );

          color: #818cf8;

          border:
            1px solid
            rgba(99,102,241,0.3);

          font-weight: 600;
        }

        .user-chip {
          background:
            rgba(255,255,255,0.1);

          backdrop-filter:
            blur(10px);

          border:
            1px solid
            rgba(255,255,255,0.2);

          border-radius: 12px;

          padding: 10px 16px;

          font-size: 13px;

          color: #ffffff;

          font-weight: 500;

          transition:
            all 0.3s ease;
        }

        .user-chip:hover {
          background:
            rgba(255,255,255,0.15);

          transform:
            translateY(-1px);
        }

        .btn {
          border: none;

          border-radius: 12px;

          padding: 12px 20px;

          font-size: 14px;

          cursor: pointer;

          transition:
            all 0.3s ease;

          font-weight: 600;
        }

        .btn:hover:not(:disabled) {
          transform:
            translateY(-2px);
        }

        .btn:disabled {
          opacity: 0.5;

          cursor:
            not-allowed;

          transform:
            none;
        }

        .btn-primary {
          background:
            linear-gradient(
              135deg,
              #6366f1 0%,
              #4f46e5 100%
            );

          color: #ffffff;

          box-shadow:
            0 8px 16px -4px
            rgba(99,102,241,0.4);
        }

        .btn-primary:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #818cf8 0%,
              #6366f1 100%
            );
        }

        .btn-success {
          background:
            linear-gradient(
              135deg,
              #10b981 0%,
              #059669 100%
            );

          color: #ffffff;

          box-shadow:
            0 8px 16px -4px
            rgba(16,185,129,0.35);
        }

        .btn-secondary {
          background:
            rgba(255,255,255,0.1);

          backdrop-filter:
            blur(10px);

          color:
            rgba(255,255,255,0.9);

          border:
            1px solid
            rgba(255,255,255,0.2);
        }

        .btn-secondary:hover:not(:disabled) {
          background:
            rgba(255,255,255,0.15);
        }

        .btn-outline {
          background:
            transparent;

          color:
            rgba(255,255,255,0.9);

          border:
            2px solid
            rgba(255,255,255,0.3);
        }

        .btn-outline:hover:not(:disabled) {
          background:
            rgba(255,255,255,0.1);

          border-color:
            rgba(255,255,255,0.5);

          color: #ffffff;
        }

        .history-main {
          padding:
            0 32px 40px;

          max-width:
            1200px;

          margin:
            0 auto;
        }

        .history-hero {
          position:
            relative;

          overflow:
            hidden;

          background:
            rgba(255,255,255,0.08);

          backdrop-filter:
            blur(20px);

          border:
            1px solid
            rgba(255,255,255,0.1);

          border-radius:
            24px;

          padding:
            40px;

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
        }

        .history-hero::before {
          content: "";

          position:
            absolute;

          inset: 0;

          background:
            linear-gradient(
              45deg,
              transparent,
              rgba(255,255,255,0.03),
              transparent
            );

          pointer-events:
            none;
        }

        .history-card {
          margin-top:
            20px;

          background:
            rgba(255,255,255,0.08);

          backdrop-filter:
            blur(20px);

          border:
            1px solid
            rgba(255,255,255,0.1);

          border-radius:
            24px;

          padding:
            30px;

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);

          transition:
            all 0.3s ease;
        }

        .history-card:hover {
          border-color:
            rgba(255,255,255,0.2);

          box-shadow:
            0 32px 64px -12px
            rgba(0,0,0,0.4);
        }

        .history-search {
          width:
            100%;

          padding:
            12px 14px;

          border:
            1px solid
            rgba(255,255,255,0.18);

          background:
            rgba(255,255,255,0.06);

          color:
            #ffffff;

          border-radius:
            12px;

          outline:
            none;

          font-size:
            14px;
        }

        .history-search::placeholder {
          color:
            rgba(255,255,255,0.45);
        }

        .history-search:focus {
          border-color:
            #818cf8;

          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .history-date-grid {
          display:
            grid;

          grid-template-columns:
            repeat(
              2,
              minmax(0,1fr)
            );

          gap:
            12px;

          margin-top:
            14px;
        }

        .history-date-group {
          min-width:
            0;
        }

        .history-date-label {
          display:
            block;

          margin-bottom:
            7px;

          color:
            rgba(255,255,255,0.65);

          font-size:
            12px;

          font-weight:
            600;
        }

        .history-date-input {
          width:
            100%;

          padding:
            12px 14px;

          border:
            1px solid
            rgba(255,255,255,0.18);

          background:
            rgba(255,255,255,0.06);

          color:
            #ffffff;

          border-radius:
            12px;

          outline:
            none;

          font-size:
            14px;

          font-family:
            inherit;

          color-scheme:
            dark;
        }

        .history-date-input:focus {
          border-color:
            #818cf8;

          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .history-date-input::-webkit-calendar-picker-indicator {
          filter:
            invert(1);

          cursor:
            pointer;
        }

        .history-date-summary {
          margin-top:
            10px;

          color:
            #818cf8;

          font-size:
            12px;

          line-height:
            1.6;
        }

        .filter-btn {
          padding:
            8px 14px;

          border-radius:
            999px;

          border:
            1px solid
            rgba(255,255,255,0.12);

          background:
            rgba(255,255,255,0.045);

          color:
            rgba(255,255,255,0.68);

          cursor:
            pointer;

          font-size:
            12px;

          transition:
            all 0.2s ease;
        }

        .filter-btn:hover {
          background:
            rgba(255,255,255,0.1);

          color:
            #ffffff;
        }

        .filter-btn.active {
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #4f46e5
            );

          color:
            #ffffff;

          border-color:
            rgba(99,102,241,0.4);
        }

        .history-item {
          padding:
            18px;

          margin-bottom:
            10px;

          border-radius:
            16px;

          background:
            rgba(255,255,255,0.05);

          border:
            1px solid
            rgba(255,255,255,0.1);

          cursor:
            pointer;

          transition:
            all 0.25s ease;
        }

        .history-item:hover {
          background:
            rgba(255,255,255,0.09);

          border-color:
            rgba(99,102,241,0.4);

          transform:
            translateY(-2px);

          box-shadow:
            0 12px 30px
            rgba(0,0,0,0.18);
        }

        .delete-history-btn {
          border:
            1px solid
            rgba(248,113,113,0.35);

          background:
            rgba(248,113,113,0.10);

          color:
            #fca5a5;

          border-radius:
            9px;

          padding:
            5px 9px;

          font-size:
            11px;

          font-weight:
            700;

          cursor:
            pointer;

          transition:
            all 0.2s ease;
        }

        .delete-history-btn:hover:not(:disabled) {
          background:
            rgba(248,113,113,0.18);

          border-color:
            rgba(248,113,113,0.55);

          color:
            #fecaca;

          transform:
            translateY(-1px);
        }

        .delete-history-btn:disabled {
          opacity:
            0.55;

          cursor:
            not-allowed;
        }

        .history-modal-overlay {
          position:
            fixed;

          inset:
            0;

          z-index:
            5000;

          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          padding:
            14px;

          background:
            rgba(0,0,0,0.78);

          backdrop-filter:
            blur(10px);
        }

        .history-modal {
          width:
            min(
              1450px,
              100%
            );

          height:
            min(
              94vh,
              920px
            );

          display:
            flex;

          flex-direction:
            column;

          overflow:
            hidden;

          border-radius:
            22px;

          background:
            rgba(15,15,35,0.98);

          border:
            1px solid
            rgba(255,255,255,0.12);

          box-shadow:
            0 30px 80px
            rgba(0,0,0,0.55);
        }

        .modal-header {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;

          gap:
            15px;

          padding:
            15px 18px;

          background:
            rgba(255,255,255,0.05);

          border-bottom:
            1px solid
            rgba(255,255,255,0.1);
        }

        .modal-body {
          flex:
            1;

          min-height:
            0;

          display:
            grid;

          grid-template-columns:
            minmax(0,1fr)
            minmax(360px,1fr);
        }

        .pdf-area,
        .text-area {
          min-width:
            0;

          min-height:
            0;

          display:
            flex;

          flex-direction:
            column;
        }

        .pdf-area {
          background:
            #252525;

          border-right:
            1px solid
            rgba(255,255,255,0.08);
        }

        .text-area {
          background:
            rgba(255,255,255,0.03);
        }

        .pdf-pages,
        .ocr-pages {
          flex:
            1;

          min-height:
            0;

          overflow-y:
            auto;

          padding:
            14px;
        }

        .pdf-page {
          padding:
            9px;

          margin-bottom:
            15px;

          border-radius:
            10px;

          background:
            #ffffff;

          box-shadow:
            0 12px 25px
            rgba(0,0,0,0.2);
        }

        .pdf-page img {
          width:
            100%;

          display:
            block;

          border-radius:
            5px;
        }

        .text-header {
          padding:
            12px 15px;

          background:
            rgba(255,255,255,0.03);

          border-bottom:
            1px solid
            rgba(255,255,255,0.08);
        }

        .text-buttons {
          display:
            flex;

          gap:
            8px;

          margin-top:
            10px;

          flex-wrap:
            wrap;
        }

        .mode-btn {
          padding:
            8px 12px;

          border-radius:
            8px;

          border:
            1px solid
            rgba(255,255,255,0.12);

          background:
            rgba(255,255,255,0.05);

          color:
            rgba(255,255,255,0.7);

          cursor:
            pointer;

          transition:
            all 0.2s ease;
        }

        .mode-btn:hover {
          background:
            rgba(255,255,255,0.1);

          color:
            #ffffff;
        }

        .mode-btn.active {
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #4f46e5
            );

          color:
            #ffffff;

          border-color:
            rgba(99,102,241,0.5);
        }

        .ocr-page {
          margin-bottom:
            13px;

          padding:
            14px;

          border-radius:
            13px;

          background:
            rgba(255,255,255,0.05);

          border:
            1px solid
            rgba(255,255,255,0.08);
        }

        .ocr-page-title {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;

          gap:
            10px;

          margin-bottom:
            8px;

          padding-bottom:
            8px;

          border-bottom:
            1px solid
            rgba(255,255,255,0.06);

          color:
            #c7d2fe;

          font-size:
            12px;

          font-weight:
            700;
        }

        .ocr-content {
          white-space:
            pre-wrap;

          word-break:
            break-word;

          line-height:
            1.9;

          color:
            rgba(255,255,255,0.88);

          font-size:
            13px;
        }

        .info-ok {
          margin-bottom:
            12px;

          padding:
            11px 13px;

          border-radius:
            10px;

          background:
            rgba(16,185,129,0.08);

          border:
            1px solid
            rgba(16,185,129,0.2);

          color:
            #6ee7b7;

          font-size:
            12px;
        }

        .info-raw {
          margin-bottom:
            12px;

          padding:
            11px 13px;

          border-radius:
            10px;

          background:
            rgba(99,102,241,0.08);

          border:
            1px solid
            rgba(99,102,241,0.2);

          color:
            #a5b4fc;

          font-size:
            12px;
        }

        .ai-unavailable {
          padding:
            18px;

          border-radius:
            12px;

          background:
            rgba(239,68,68,0.08);

          border:
            1px solid
            rgba(239,68,68,0.22);

          color:
            #fca5a5;

          font-size:
            13px;

          line-height:
            1.8;
        }

        .modal-footer {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;

          gap:
            10px;

          flex-wrap:
            wrap;

          padding:
            10px 15px;

          background:
            rgba(255,255,255,0.05);

          border-top:
            1px solid
            rgba(255,255,255,0.1);
        }

        .footer-info {
          display:
            flex;

          align-items:
            center;

          flex-wrap:
            wrap;

          gap:
            12px;

          color:
            rgba(255,255,255,0.47);

          font-size:
            10px;
        }

        .empty-text {
          text-align:
            center;

          padding:
            40px 15px;

          color:
            rgba(255,255,255,0.42);
        }

        .pagination {
          display:
            flex;

          align-items:
            center;

          justify-content:
            center;

          gap:
            10px;

          flex-wrap:
            wrap;

          margin-top:
            20px;
        }

        .pagination-info {
          padding:
            10px 14px;

          border-radius:
            10px;

          background:
            rgba(255,255,255,0.05);

          border:
            1px solid
            rgba(255,255,255,0.08);

          color:
            rgba(255,255,255,0.68);

          font-size:
            12px;
        }

        .original-text-preview {
          flex:
            1;

          min-height:
            0;

          overflow:
            auto;

          padding:
            20px;

          background:
            linear-gradient(
              135deg,
              #202020,
              #303030
            );
        }

        .original-text-preview-box {
          margin:
            0;

          min-height:
            100%;

          padding:
            20px;

          border-radius:
            12px;

          background:
            #111827;

          border:
            1px solid
            rgba(255,255,255,0.1);

          color:
            rgba(255,255,255,0.9);

          white-space:
            pre-wrap;

          word-break:
            break-word;

          line-height:
            1.85;

          font-size:
            13px;

          font-family:
            inherit;
        }

        @media (max-width: 1100px) {
          .history-navbar {
            flex-direction:
              column !important;

            justify-content:
              center;
          }

          .history-navbar-menu,
          .history-navbar-user {
            justify-content:
              center;
          }
        }

        @media (max-width: 1050px) {
          .modal-body {
            grid-template-columns:
              1fr;

            grid-template-rows:
              1fr 1fr;
          }

          .pdf-area {
            border-right:
              none;

            border-bottom:
              1px solid
              rgba(255,255,255,0.08);
          }
        }

        @media (max-width: 768px) {
          .history-date-grid {
            grid-template-columns:
              1fr;
          }

          .history-navbar {
            padding:
              16px;
          }

          .history-navbar-menu {
            flex-direction:
              column;

            width:
              100%;
          }

          .history-navbar-menu
          .nav-link {
            width:
              100%;

            text-align:
              center;
          }

          .history-navbar-user {
            width:
              100%;

            justify-content:
              center;
          }

          .history-navbar-user
          .user-chip {
            width:
              100%;

            text-align:
              center;
          }

          .history-main {
            padding:
              0 16px 30px;
          }

          .history-hero {
            padding:
              25px;
          }

          .history-card {
            padding:
              20px;
          }

          .history-modal {
            width:
              100%;

            height:
              98vh;

            border-radius:
              14px;
          }

          .history-modal-overlay {
            padding:
              4px;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav
        className="history-navbar"
        style={{
          display: "flex",

          justifyContent: "space-between",

          alignItems: "center",

          padding: "16px 32px",

          background: "rgba(255,255,255,0.05)",

          backdropFilter: "blur(20px)",

          borderBottom: "1px solid rgba(255,255,255,0.1)",

          color: "#fff",

          position: "sticky",

          top: 0,

          zIndex: 1000,

          flexWrap: "wrap",

          gap: "20px",
        }}
      >
        {/* LOGO */}

        <div
          style={{
            display: "flex",

            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "120px",

              height: "75px",

              display: "grid",

              placeItems: "center",

              borderRadius: "12px",

              background:
                "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))",

              backdropFilter: "blur(10px)",

              border: "2px solid rgba(255,255,255,0.2)",

              boxShadow:
                "0 8px 25px rgba(99,102,241,0.3), 0 0 15px rgba(99,102,241,0.2)",

              overflow: "hidden",
            }}
          >
            <img
              src="/LOGO.jpg"
              alt="OCR Logo"
              style={{
                width: "100%",

                height: "100%",

                objectFit: "cover",

                borderRadius: "10px",
              }}
            />
          </div>
        </div>

        {/* MENU */}

        <div
          className="
            history-navbar-menu
            nav-menu
          "
        >
          {session ? (
            session.role === "admin" ? (
              <>
                <Link to="/" className="nav-link">
                  Dashboard
                </Link>

                <Link to="/ocr" className="nav-link">
                  OCR
                </Link>

                <Link to="/translate" className="nav-link">
                  Translate
                </Link>

                <Link
                  to="/history"
                  className="
                    nav-link
                    Active
                  "
                >
                  History
                </Link>

                <Link to="/admin-dashboard" className="nav-link">
                  Admin Dashboard
                </Link>

                <Link to="/user-report" className="nav-link">
                  User Report
                </Link>

                <Link to="/usage-report" className="nav-link">
                  Usage Report
                </Link>
              </>
            ) : (
              <>
                <Link to="/" className="nav-link">
                  Dashboard
                </Link>

                <Link to="/ocr" className="nav-link">
                  OCR
                </Link>

                <Link to="/translate" className="nav-link">
                  Translate
                </Link>

                <Link
                  to="/history"
                  className="
                    nav-link
                    Active
                  "
                >
                  History
                </Link>

                <Link to="/profile" className="nav-link">
                  Edit Profile
                </Link>
              </>
            )
          ) : (
            <>
              <Link to="/" className="nav-link">
                Dashboard
              </Link>

              <Link to="/user-login" className="nav-link">
                User Login
              </Link>

              <Link to="/register" className="nav-link">
                Register
              </Link>

              <Link to="/admin-login" className="nav-link">
                Admin Login
              </Link>
            </>
          )}
        </div>

        {/* USER AREA */}

        <div
          className="
            history-navbar-user
          "
          style={{
            display: "flex",

            alignItems: "center",

            gap: "10px",

            flexWrap: "wrap",
          }}
        >
          <div className="user-chip">
            สถานะระบบ:{" "}
            <strong
              style={{
                color: "#34d399",
              }}
            >
              Online
            </strong>
          </div>

          <div className="user-chip">
            บทบาท:{" "}
            <strong
              style={{
                color: "#818cf8",
              }}
            >
              {formatRole(session?.role)}
            </strong>
          </div>

          <div className="user-chip">
            ผู้ใช้งาน:{" "}
            <strong>
              {session
                ? session.name ||
                  session.display_name ||
                  session.email ||
                  "ผู้ใช้งาน"
                : "ยังไม่ได้เข้าสู่ระบบ"}
            </strong>
          </div>

          {session ? (
            <button
              className="
                btn
                btn-outline
              "
              onClick={handleLogout}
            >
              ออกจากระบบ
            </button>
          ) : (
            <button
              className="
                btn
                btn-outline
              "
              onClick={() => navigate("/user-login")}
            >
              เข้าสู่ระบบ
            </button>
          )}
        </div>
      </nav>

      <br />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="history-main">
        {/* HERO */}

        <section className="history-hero">
          <h2
            style={{
              margin: "0 0 16px",

              fontSize: "36px",

              fontWeight: 700,
            }}
          >
            ประวัติการใช้งาน
          </h2>

          <p
            style={{
              margin: 0,

              color: "rgba(255,255,255,0.85)",

              fontSize: "16px",

              lineHeight: 1.7,

              maxWidth: "900px",
            }}
          >
            ดูประวัติการใช้งาน OCR และ Translate พร้อมตรวจสอบ Raw OCR และ AI
            Cleaning ที่ถูกเก็บแยกกันในฐานข้อมูล
          </p>

          {session && (
            <div
              style={{
                marginTop: "18px",

                color: "rgba(255,255,255,0.75)",

                fontSize: "14px",
              }}
            >
              ผู้ใช้งาน{" "}
              <strong
                style={{
                  color: "#818cf8",
                }}
              >
                {session.name || session.display_name || session.email}
              </strong>
            </div>
          )}
        </section>

        {/* ERROR */}

        {errorMessage && (
          <section className="history-card">
            <div
              style={{
                color: "#fca5a5",

                lineHeight: 1.7,
              }}
            >
              ⚠️ {errorMessage}
            </div>

            <button
              type="button"
              className="
                btn
                btn-secondary
              "
              style={{
                marginTop: "12px",
              }}
              onClick={() => loadHistory(currentPage, true)}
            >
              ลองใหม่
            </button>
          </section>
        )}

        {/* SEARCH */}

        <section className="history-card">
          <h3
            style={{
              margin: "0 0 14px",

              fontSize: "20px",

              fontWeight: 700,
            }}
          >
            ค้นหาและกรองข้อมูล
          </h3>

          <input
            className="history-search"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="ค้นหาชื่อไฟล์ ข้อความ OCR หรือรายละเอียด..."
          />

          {searchTerm.trim() !== debouncedSearchTerm && (
            <div
              style={{
                marginTop: "8px",

                color: "rgba(255,255,255,0.45)",

                fontSize: "11px",
              }}
            >
              กำลังค้นหา...
            </div>
          )}

          <div
            style={{
              display: "flex",

              gap: "8px",

              flexWrap: "wrap",

              marginTop: "14px",
            }}
          >
            {[
              ["all", "ทั้งหมด"],
              ["ocr", "OCR"],
              ["translate", "แปลภาษา"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={
                  currentFilter === id ? "filter-btn active" : "filter-btn"
                }
                onClick={() => handleFilterChange(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="history-date-grid">
            <div className="history-date-group">
              <label className="history-date-label">📅 วันเริ่มต้น</label>

              <input
                className="history-date-input"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={handleStartDateChange}
              />
            </div>

            <div className="history-date-group">
              <label className="history-date-label">📅 วันสิ้นสุด</label>

              <input
                className="history-date-input"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={handleEndDateChange}
              />
            </div>
          </div>

          {(startDate || endDate) && (
            <div
              style={{
                display: "flex",

                alignItems: "center",

                gap: "10px",

                flexWrap: "wrap",

                marginTop: "10px",
              }}
            >
              <button
                type="button"
                className="filter-btn"
                onClick={clearDateRange}
              >
                ✕ ล้างช่วงวันที่
              </button>

              <div className="history-date-summary">
                {startDate && endDate
                  ? `ค้นหาตั้งแต่ ${startDate} ถึง ${endDate}`
                  : startDate
                    ? `ค้นหาตั้งแต่ ${startDate} เป็นต้นไป`
                    : `ค้นหาถึง ${endDate}`}
              </div>
            </div>
          )}
        </section>

        {/* HISTORY */}

        <section className="history-card">
          <div
            style={{
              display: "flex",

              justifyContent: "space-between",

              alignItems: "center",

              gap: "12px",

              flexWrap: "wrap",

              marginBottom: "14px",
            }}
          >
            <h3
              style={{
                margin: 0,

                fontSize: "22px",

                fontWeight: 700,
              }}
            >
              รายการประวัติ
            </h3>

            <div
              style={{
                color: "#818cf8",

                fontSize: "12px",
              }}
            >
              หน้า <strong>{currentPage}</strong>
              {totalPages !== null && (
                <>
                  {" / "}
                  {totalPages}
                </>
              )}
              {" • "}
              พบ <strong>{totalHistory ?? filteredHistory.length}</strong>{" "}
              รายการ
            </div>
          </div>

          {refreshing && (
            <div
              style={{
                marginBottom: "10px",

                color: "#818cf8",

                fontSize: "12px",
              }}
            >
              กำลังอัปเดตข้อมูล...
            </div>
          )}

          {filteredHistory.length === 0 ? (
            <div className="empty-text">
              <div
                style={{
                  fontSize: "40px",

                  marginBottom: "10px",
                }}
              >
                📭
              </div>
              ไม่พบข้อมูลที่ตรงกับเงื่อนไข
            </div>
          ) : (
            filteredHistory.map((item) => {
              const type = normalizeLower(item.type);

              const isOCR = type === "ocr";

              const isTranslate =
                type === "translate" || type === "translation";

              const rawExists = Boolean(getRawText(item).trim());

              const aiExists = Boolean(getProcessedText(item).trim());

              const pages = normalizeSelectedPages(getSelectedPages(item));

              return (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => handleSelectItem(item)}
                >
                  <div
                    style={{
                      display: "flex",

                      justifyContent: "space-between",

                      alignItems: "center",

                      gap: "10px",

                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",

                        alignItems: "center",

                        gap: "6px",

                        padding: "6px 10px",

                        borderRadius: "9px",

                        background: isTranslate
                          ? "rgba(16,185,129,0.12)"
                          : isOCR
                            ? "rgba(99,102,241,0.16)"
                            : "rgba(255,255,255,0.08)",

                        color: isTranslate
                          ? "#6ee7b7"
                          : isOCR
                            ? "#a5b4fc"
                            : "rgba(255,255,255,0.7)",

                        border: isTranslate
                          ? "1px solid rgba(16,185,129,0.25)"
                          : isOCR
                            ? "1px solid rgba(99,102,241,0.22)"
                            : "1px solid rgba(255,255,255,0.12)",

                        fontSize: "11px",

                        fontWeight: 700,
                      }}
                    >
                      {isTranslate ? "🌐" : isOCR ? "📄" : "📌"}{" "}
                      {isTranslate ? "Translate" : isOCR ? "OCR" : "SYSTEM"}
                    </span>

                    <span
                      style={{
                        color: "rgba(255,255,255,0.4)",

                        fontSize: "11px",
                      }}
                    >
                      {formatTimestamp(item.datetime)}
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: "12px",

                      fontSize: "15px",

                      fontWeight: 700,

                      wordBreak: "break-word",
                    }}
                  >
                    {isTranslate
                      ? "รายการแปลภาษา"
                      : item.filename || "OCR Result"}
                  </div>

                  <div
                    style={{
                      marginTop: "7px",

                      color: "rgba(255,255,255,0.56)",

                      fontSize: "12px",

                      lineHeight: 1.6,
                    }}
                  >
                    {isTranslate
                      ? (getSourceText(item) || "ไม่มีข้อความต้นฉบับ").slice(
                          0,
                          180,
                        )
                      : item.detail || "บันทึกผล OCR"}
                  </div>

                  <div
                    style={{
                      display: "flex",

                      alignItems: "center",

                      flexWrap: "wrap",

                      gap: "10px",

                      marginTop: "12px",

                      fontSize: "11px",
                    }}
                  >
                    <span
                      style={{
                        color: "#6ee7b7",

                        fontWeight: 600,
                      }}
                    >
                      ✅ {item.status || "สำเร็จ"}
                    </span>

                    {isOCR && (
                      <span
                        style={{
                          color: rawExists ? "#a5b4fc" : "#fca5a5",
                        }}
                      >
                        📝 Raw OCR: {rawExists ? "มีข้อมูล" : "ไม่มีข้อมูล"}
                      </span>
                    )}

                    {isOCR && (
                      <span
                        style={{
                          color: aiExists ? "#6ee7b7" : "#fca5a5",
                        }}
                      >
                        🤖 AI Cleanup: {aiExists ? "มีข้อมูล" : "ไม่มีข้อมูล"}
                      </span>
                    )}

                    {isOCR && getFileId(item) && (
                      <span
                        style={{
                          color: "rgba(255,255,255,0.4)",
                        }}
                      >
                        file_id: {getFileId(item)}
                      </span>
                    )}

                    {isOCR && pages.length > 0 && (
                      <span
                        style={{
                          color: "#a5b4fc",
                        }}
                      >
                        📑 หน้า {pages.join(", ")}
                      </span>
                    )}

                    {isTranslate && (
                      <span
                        style={{
                          color: "#6ee7b7",
                        }}
                      >
                        🌐 {getLanguageName(getSourceLanguage(item))} →{" "}
                        {getLanguageName(getTargetLanguage(item))}
                      </span>
                    )}

                    <button
                      type="button"
                      className="delete-history-btn"
                      disabled={
                        refreshing ||
                        deletingHistoryId === String(getHistoryId(item))
                      }
                      onClick={(event) => handleDeleteHistory(item, event)}
                      title="ลบประวัติรายการนี้"
                      aria-label={`ลบประวัติ ${item.filename || "รายการนี้"}`}
                    >
                      {deletingHistoryId === String(getHistoryId(item))
                        ? "กำลังลบ..."
                        : "🗑️ ลบ"}
                    </button>

                    <span
                      style={{
                        color: isTranslate ? "#6ee7b7" : "#818cf8",

                        marginLeft: "auto",
                      }}
                    >
                      คลิกเพื่อดูรายละเอียด
                    </span>
                  </div>
                </div>
              );
            })
          )}

          {/* PAGINATION */}

          <div className="pagination">
            <button
              type="button"
              className="
                btn
                btn-secondary
              "
              disabled={currentPage <= 1 || refreshing}
              onClick={goToPreviousPage}
            >
              ← ก่อนหน้า
            </button>

            <div className="pagination-info">
              หน้า <strong>{currentPage}</strong>
              {" • "}
              แสดง <strong>{HISTORY_LIMIT}</strong> รายการต่อหน้า
            </div>

            <button
              type="button"
              className="
                btn
                btn-primary
              "
              disabled={!hasNextPage || refreshing}
              onClick={goToNextPage}
            >
              ถัดไป →
            </button>
          </div>

          {totalHistory !== null && (
            <div
              style={{
                textAlign: "center",

                marginTop: "10px",

                color: "rgba(255,255,255,0.4)",

                fontSize: "11px",
              }}
            >
              มีประวัติทั้งหมด {totalHistory} รายการ
            </div>
          )}
        </section>
      </main>

      {/* =====================================================
          DETAIL MODAL
      ====================================================== */}

      {selectedItem && (
        <div
          className="
            history-modal-overlay
          "
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="
              history-modal
            "
            onClick={(event) => event.stopPropagation()}
          >
            {/* HEADER */}

            <div className="modal-header">
              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: "16px",

                    fontWeight: 700,

                    whiteSpace: "nowrap",

                    overflow: "hidden",

                    textOverflow: "ellipsis",
                  }}
                >
                  {normalizeLower(selectedItem.type) === "translate"
                    ? "🌐 "
                    : "📄 "}

                  {normalizeLower(selectedItem.type) === "translate" ||
                  normalizeLower(selectedItem.type) === "translation"
                    ? "รายละเอียดการแปลภาษา"
                    : selectedItem.filename || "OCR Result"}
                </div>

                <div
                  style={{
                    marginTop: "4px",

                    color: "rgba(255,255,255,0.45)",

                    fontSize: "11px",
                  }}
                >
                  {formatDateTime(selectedItem.datetime)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",

                  gap: "8px",

                  flexWrap: "wrap",
                }}
              >
                {normalizeLower(selectedItem.type) === "ocr" &&
                  getFileId(selectedItem) && (
                    <button
                      type="button"
                      className="
                        btn
                        btn-primary
                      "
                      disabled={openingFileId === getFileId(selectedItem)}
                      onClick={() => handleOpenFile(selectedItem)}
                    >
                      {openingFileId === getFileId(selectedItem)
                        ? "⏳ กำลังเปิด..."
                        : "↗ เปิดไฟล์เต็ม"}
                    </button>
                  )}

                <button
                  type="button"
                  className="
                    btn
                    btn-secondary
                  "
                  onClick={closeModal}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* TRANSLATE */}

            {normalizeLower(selectedItem.type) === "translate" ||
            normalizeLower(selectedItem.type) === "translation" ? (
              <>
                <div className="modal-body">
                  <div
                    className="text-area"
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <div className="text-header">
                      <div
                        style={{
                          display: "flex",

                          justifyContent: "space-between",

                          alignItems: "center",

                          gap: "10px",

                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,

                            fontSize: "14px",
                          }}
                        >
                          🌐 รายละเอียดการแปลภาษา
                        </div>

                        {getProcessingTime(selectedItem) !== null &&
                          getProcessingTime(selectedItem) !== undefined && (
                            <div
                              style={{
                                color: "#34d399",

                                fontSize: "10px",
                              }}
                            >
                              ⚡{" "}
                              {formatProcessingTime(
                                getProcessingTime(selectedItem),
                              )}{" "}
                              วินาที
                            </div>
                          )}
                      </div>
                    </div>

                    <div
                      style={{
                        flex: 1,

                        overflowY: "auto",

                        padding: "20px",
                      }}
                    >
                      <div
                        className="history-card"
                        style={{
                          marginTop: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",

                            gap: "10px",

                            flexWrap: "wrap",

                            marginBottom: "18px",
                          }}
                        >
                          <span
                            style={{
                              padding: "7px 10px",

                              borderRadius: "999px",

                              background: "rgba(16,185,129,0.1)",

                              border: "1px solid rgba(16,185,129,0.2)",

                              color: "#6ee7b7",

                              fontSize: "11px",
                            }}
                          >
                            จาก:{" "}
                            {getLanguageName(getSourceLanguage(selectedItem))}
                          </span>

                          <span
                            style={{
                              padding: "7px 10px",

                              borderRadius: "999px",

                              background: "rgba(16,185,129,0.1)",

                              border: "1px solid rgba(16,185,129,0.2)",

                              color: "#6ee7b7",

                              fontSize: "11px",
                            }}
                          >
                            ไป:{" "}
                            {getLanguageName(getTargetLanguage(selectedItem))}
                          </span>
                        </div>

                        <div
                          style={{
                            marginBottom: "18px",
                          }}
                        >
                          <div
                            style={{
                              marginBottom: "8px",

                              color: "#c7d2fe",

                              fontSize: "13px",

                              fontWeight: 700,
                            }}
                          >
                            📝 ข้อความต้นฉบับ
                          </div>

                          <div
                            style={{
                              padding: "14px",

                              borderRadius: "12px",

                              background: "rgba(255,255,255,0.04)",

                              border: "1px solid rgba(255,255,255,0.08)",

                              color: "rgba(255,255,255,0.88)",

                              fontSize: "13px",

                              lineHeight: 1.85,

                              whiteSpace: "pre-wrap",

                              wordBreak: "break-word",
                            }}
                          >
                            {getSourceText(selectedItem) ||
                              "ไม่มีข้อความต้นฉบับ"}
                          </div>
                        </div>

                        <div>
                          <div
                            style={{
                              marginBottom: "8px",

                              color: "#c7d2fe",

                              fontSize: "13px",

                              fontWeight: 700,
                            }}
                          >
                            🌐 ข้อความแปล
                          </div>

                          <div
                            style={{
                              padding: "14px",

                              borderRadius: "12px",

                              background: "rgba(16,185,129,0.04)",

                              border: "1px solid rgba(16,185,129,0.2)",

                              color: "rgba(255,255,255,0.88)",

                              fontSize: "13px",

                              lineHeight: 1.85,

                              whiteSpace: "pre-wrap",

                              wordBreak: "break-word",
                            }}
                          >
                            {getTranslatedText(selectedItem) || "ไม่มีผลการแปล"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <div className="footer-info">
                    <span>👤 {getUserName(selectedItem) || "-"}</span>

                    <span>
                      🌐 {getLanguageName(getSourceLanguage(selectedItem))} →{" "}
                      {getLanguageName(getTargetLanguage(selectedItem))}
                    </span>

                    <span>
                      ⚡ {formatProcessingTime(getProcessingTime(selectedItem))}{" "}
                      วินาที
                    </span>
                  </div>

                  <button
                    type="button"
                    className="
                      btn
                      btn-secondary
                    "
                    onClick={closeModal}
                  >
                    ปิด
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* OCR */}

                <div className="modal-body">
                  {/* FILE PREVIEW */}

                  <div className="pdf-area">
                    <div
                      style={{
                        display: "flex",

                        justifyContent: "space-between",

                        alignItems: "center",

                        gap: "10px",

                        padding: "12px 14px",

                        background: "rgba(0,0,0,0.24)",

                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",

                          fontWeight: 700,
                        }}
                      >
                        {previewKind === "pdf"
                          ? "📑 PDF ต้นฉบับ"
                          : previewKind === "image"
                            ? "🖼️ รูปภาพต้นฉบับ"
                            : previewKind === "text"
                              ? "📄 ไฟล์ข้อความต้นฉบับ"
                              : "📄 ไฟล์ต้นฉบับ"}
                      </div>

                      <div
                        style={{
                          color: "#818cf8",

                          fontSize: "11px",
                        }}
                      >
                        {previewKind === "pdf"
                          ? (() => {
                              const pages = normalizeSelectedPages(
                                getSelectedPages(selectedItem),
                              );

                              return pages.length > 0
                                ? `หน้า ${pages.join(", ")}`
                                : "ข้อมูลเดิม";
                            })()
                          : getFilename(selectedItem)}
                      </div>
                    </div>

                    {/* IMAGE */}

                    {previewKind === "image" ? (
                      <div
                        style={{
                          flex: 1,

                          minHeight: 0,

                          overflow: "auto",

                          display: "flex",

                          alignItems: "center",

                          justifyContent: "center",

                          padding: "20px",

                          background:
                            "linear-gradient(135deg, #202020, #303030)",
                        }}
                      >
                        {imageLoading ? (
                          <div
                            style={{
                              textAlign: "center",

                              color: "rgba(255,255,255,0.65)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "36px",

                                marginBottom: "10px",
                              }}
                            >
                              ⏳
                            </div>
                            กำลังโหลดรูปภาพ...
                          </div>
                        ) : imageError ? (
                          <div
                            style={{
                              textAlign: "center",

                              color: "#fca5a5",

                              maxWidth: "420px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "36px",

                                marginBottom: "10px",
                              }}
                            >
                              ⚠️
                            </div>

                            <div
                              style={{
                                marginBottom: "12px",
                              }}
                            >
                              {imageError}
                            </div>

                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() =>
                                loadSelectedFilePreview(selectedItem)
                              }
                            >
                              ลองใหม่
                            </button>
                          </div>
                        ) : imagePreview ? (
                          <div
                            style={{
                              width: "100%",

                              height: "100%",

                              display: "flex",

                              alignItems: "center",

                              justifyContent: "center",

                              overflow: "auto",
                            }}
                          >
                            <img
                              src={imagePreview}
                              alt={getFilename(selectedItem) || "OCR image"}
                              style={{
                                display: "block",

                                maxWidth: "100%",

                                maxHeight: "100%",

                                width: "auto",

                                height: "auto",

                                objectFit: "contain",

                                borderRadius: "10px",

                                boxShadow: "0 15px 40px rgba(0,0,0,0.4)",

                                background: "#ffffff",
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            ไม่พบรูปภาพ
                          </div>
                        )}
                      </div>
                    ) : previewKind === "pdf" ? (
                      /* PDF */

                      <div className="pdf-pages">
                        {pdfLoading ? (
                          <div
                            style={{
                              minHeight: "300px",

                              display: "grid",

                              placeItems: "center",

                              color: "rgba(255,255,255,0.6)",
                            }}
                          >
                            ⏳ กำลังสร้าง PDF Preview...
                          </div>
                        ) : pdfError ? (
                          <div
                            style={{
                              minHeight: "300px",

                              display: "grid",

                              placeItems: "center",

                              textAlign: "center",

                              color: "#fca5a5",
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontSize: "34px",

                                  marginBottom: "10px",
                                }}
                              >
                                ⚠️
                              </div>

                              <div
                                style={{
                                  marginBottom: "12px",
                                }}
                              >
                                {pdfError}
                              </div>

                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={() =>
                                  loadSelectedFilePreview(selectedItem)
                                }
                              >
                                ลองใหม่
                              </button>
                            </div>
                          </div>
                        ) : pdfPages.length === 0 ? (
                          <div
                            style={{
                              minHeight: "300px",

                              display: "grid",

                              placeItems: "center",

                              textAlign: "center",

                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            ไม่พบ Preview
                          </div>
                        ) : (
                          pdfPages.map((page) => (
                            <div key={page.page} className="pdf-page">
                              <div
                                style={{
                                  padding: "6px 8px",

                                  marginBottom: "7px",

                                  borderRadius: "6px",

                                  background: "#eef2ff",

                                  color: "#4338ca",

                                  fontSize: "11px",

                                  fontWeight: 700,
                                }}
                              >
                                หน้า {page.page}
                              </div>

                              <img src={page.image} alt={`หน้า ${page.page}`} />
                            </div>
                          ))
                        )}
                      </div>
                    ) : previewKind === "text" ? (
                      /* TEXT */

                      <div className="original-text-preview">
                        <pre className="original-text-preview-box">
                          {textPreview || "ไฟล์ข้อความว่างเปล่า"}
                        </pre>
                      </div>
                    ) : (
                      <div
                        className="pdf-pages"
                        style={{
                          minHeight: "300px",

                          display: "grid",

                          placeItems: "center",

                          padding: "30px",

                          color: "rgba(255,255,255,0.6)",

                          textAlign: "center",
                        }}
                      >
                        {imageLoading || pdfLoading ? (
                          <div>
                            <div
                              style={{
                                fontSize: "38px",

                                marginBottom: "10px",
                              }}
                            >
                              ⏳
                            </div>
                            กำลังตรวจสอบและโหลดไฟล์ต้นฉบับ...
                          </div>
                        ) : imageError || pdfError ? (
                          <div
                            style={{
                              color: "#fca5a5",

                              maxWidth: "500px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "34px",

                                marginBottom: "10px",
                              }}
                            >
                              ⚠️
                            </div>

                            <div
                              style={{
                                marginBottom: "12px",
                              }}
                            >
                              {imageError || pdfError}
                            </div>

                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() =>
                                loadSelectedFilePreview(selectedItem)
                              }
                            >
                              ลองใหม่
                            </button>
                          </div>
                        ) : (
                          <div>ไม่พบ Preview ของไฟล์ต้นฉบับ</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* OCR TEXT */}

                  <div className="text-area">
                    <div className="text-header">
                      <div
                        style={{
                          display: "flex",

                          justifyContent: "space-between",

                          alignItems: "center",

                          gap: "10px",

                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,

                            fontSize: "14px",
                          }}
                        >
                          📝 ผล OCR
                        </div>

                        {getProcessingTime(selectedItem) !== null &&
                          getProcessingTime(selectedItem) !== undefined && (
                            <div
                              style={{
                                color: "#34d399",

                                fontSize: "10px",
                              }}
                            >
                              ⚡{" "}
                              {formatProcessingTime(
                                getProcessingTime(selectedItem),
                              )}{" "}
                              วินาที
                            </div>
                          )}
                      </div>

                      <div
                        style={{
                          marginTop: "6px",

                          color: "#818cf8",

                          fontSize: "11px",
                        }}
                      >
                        {(() => {
                          const pages = normalizeSelectedPages(
                            getSelectedPages(selectedItem),
                          );

                          return pages.length > 0
                            ? `OCR จากหน้าที่เลือก: ${pages.join(", ")}`
                            : "รายการ OCR เดิม";
                        })()}
                      </div>

                      <div className="text-buttons">
                        <button
                          type="button"
                          className={
                            textMode === "raw" ? "mode-btn active" : "mode-btn"
                          }
                          onClick={() => setTextMode("raw")}
                        >
                          📝 Raw OCR
                        </button>

                        <button
                          type="button"
                          className={
                            textMode === "processed"
                              ? "mode-btn active"
                              : "mode-btn"
                          }
                          onClick={() => setTextMode("processed")}
                        >
                          🤖 AI Cleanup
                        </button>
                      </div>
                    </div>

                    <div className="ocr-pages">
                      {(() => {
                        const rawTextValue = getRawText(selectedItem).trim();

                        const processedText =
                          getProcessedText(selectedItem).trim();

                        if (textMode === "raw") {
                          return (
                            <>
                              <div className="info-raw">
                                📝 Raw OCR จาก Tesseract
                              </div>

                              <div className="ocr-page">
                                <div className="ocr-page-title">
                                  <span>📝 Raw OCR</span>

                                  <span
                                    style={{
                                      color: "#a5b4fc",

                                      fontWeight: 500,
                                    }}
                                  >
                                    raw_text
                                  </span>
                                </div>

                                <div className="ocr-content">
                                  {rawTextValue || "ไม่มี Raw OCR"}
                                </div>
                              </div>
                            </>
                          );
                        }

                        if (textMode === "processed") {
                          if (!processedText) {
                            return (
                              <div className="ai-unavailable">
                                <div
                                  style={{
                                    fontSize: "30px",

                                    marginBottom: "10px",
                                  }}
                                >
                                  ⚠️
                                </div>

                                <strong>AI Cleanup ไม่มีข้อความ</strong>

                                <div
                                  style={{
                                    marginTop: "8px",
                                  }}
                                >
                                  ไม่พบข้อมูล <code>processed_text</code>{" "}
                                  สำหรับรายการนี้
                                </div>

                                <div
                                  style={{
                                    marginTop: "8px",

                                    color: "rgba(255,255,255,0.5)",
                                  }}
                                >
                                  Raw OCR ยังคงเก็บแยกอยู่ในฐานข้อมูล
                                  และไม่ถูกนำมาแสดงแทน AI Cleanup
                                </div>

                                <button
                                  type="button"
                                  className="
                                    btn
                                    btn-secondary
                                  "
                                  style={{
                                    marginTop: "15px",
                                  }}
                                  onClick={() => setTextMode("raw")}
                                >
                                  ดู Raw OCR
                                </button>
                              </div>
                            );
                          }

                          return (
                            <>
                              <div className="info-ok">
                                🤖 AI Cleanup จาก Gemini
                              </div>

                              <div className="ocr-page">
                                <div className="ocr-page-title">
                                  <span>🤖 AI Cleanup</span>

                                  <span
                                    style={{
                                      color: "#6ee7b7",

                                      fontWeight: 500,
                                    }}
                                  >
                                    processed_text
                                  </span>
                                </div>

                                <div className="ocr-content">
                                  {processedText}
                                </div>
                              </div>
                            </>
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* FOOTER */}

                <div className="modal-footer">
                  <div className="footer-info">
                    <span>👤 {getUserName(selectedItem) || "-"}</span>

                    <span>file_id: {getFileId(selectedItem) ?? "-"}</span>

                    <span>ocr_id: {getOcrId(selectedItem) ?? "-"}</span>

                    <span>
                      📝 Raw OCR:{" "}
                      {getRawText(selectedItem).trim() ? "มี" : "ไม่มี"}
                    </span>

                    <span>
                      🤖 AI Cleanup:{" "}
                      {getProcessedText(selectedItem).trim() ? "มี" : "ไม่มี"}
                    </span>

                    <span>💾 {formatFileSize(getFileSize(selectedItem))}</span>
                  </div>

                  <button
                    type="button"
                    className="
                      btn
                      btn-secondary
                    "
                    onClick={closeModal}
                  >
                    ปิด
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
