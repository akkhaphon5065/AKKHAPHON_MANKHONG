// =========================================================
// OCRThaiApp1.jsx
// OCRThai Plus
//
// FLOW
// ---------------------------------------------------------
// 1. เลือกไฟล์
// 2. เลือกว่าจะใช้ Gemini AI Cleanup หรือไม่
// 3. กด "เริ่ม OCR"
// 4. Tesseract OCR
// 5. ถ้าเปิด AI Cleanup -> เรียก Gemini AI Cleanup
// 6. ถ้าปิด AI Cleanup -> ใช้ Raw OCR โดยตรง
// 7. แสดงผลลัพธ์
// 8. เลือกวิธีอ่านออกเสียง
//    - Browser TTS
//    - Gemini TTS
// 9. กด "บันทึกลงฐานข้อมูล"
// 10. เปิด Modal ให้ตั้งชื่อรายการ
// 11. กดยืนยันชื่อ
// 12. Upload + Save OCR + History
//
// DATABASE
// ---------------------------------------------------------
// rawText       = Raw OCR จาก Tesseract
// processedText = AI Cleanup เท่านั้น
// ocrName       = ชื่อรายการ OCR
//
// AI
// ---------------------------------------------------------
// useAiCleanup = true  -> ใช้ Gemini AI Cleanup
// useAiCleanup = false -> ไม่ใช้ Gemini AI Cleanup
//
// TTS
// ---------------------------------------------------------
// ttsProvider = "browser" -> Browser TTS
// ttsProvider = "gemini"  -> Gemini TTS
//
// Gemini TTS
// ---------------------------------------------------------
// Raw PCM/L16 -> WAV
// หาก Gemini TTS Error / Quota
// -> แจ้งเตือนและให้ผู้ใช้เปลี่ยนไป Browser TTS เอง
// Browser TTS รองรับข้อความยาวโดยแบ่งเป็น Chunk
// =========================================================

import React, { useEffect, useMemo, useRef, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import Tesseract from "tesseract.js";

import * as pdfjsLib from "pdfjs-dist";

import {
  cleanupOcrText,
  speakOcrText,
  uploadOcrFile,
  saveOcrResult,
} from "../api/ocrApi";

// =========================================================
// PDF WORKER
// =========================================================

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

// =========================================================
// PAGE RANGE
// =========================================================

const parsePageRanges = (rangeString, maxPages) => {
  const pages = new Set();

  if (!rangeString) {
    return [];
  }

  const parts = String(rangeString)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");

      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (
        !Number.isNaN(start) &&
        !Number.isNaN(end) &&
        start > 0 &&
        end > 0 &&
        start <= end
      ) {
        for (let page = start; page <= Math.min(end, maxPages); page++) {
          pages.add(page);
        }
      }
    } else {
      const page = parseInt(part, 10);

      if (!Number.isNaN(page) && page > 0 && page <= maxPages) {
        pages.add(page);
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
};

// =========================================================
// COMPONENT
// =========================================================

export default function OCRThaiApp() {
  const navigate = useNavigate();

  // =======================================================
  // SESSION
  // =======================================================

  const [session, setSession] = useState(null);

  // =======================================================
  // OCR NAME
  // =======================================================

  const [ocrName, setOcrName] = useState("");

  // =======================================================
  // SAVE NAME MODAL
  // =======================================================

  const [saveNameModal, setSaveNameModal] = useState({
    isOpen: false,
  });

  const [saveNameInput, setSaveNameInput] = useState("");

  const [saveNameError, setSaveNameError] = useState("");

  // =======================================================
  // FILE
  // =======================================================

  const [image, setImage] = useState(null);

  const [imageFile, setImageFile] = useState(null);

  const [pdfFile, setPdfFile] = useState(null);

  const [textFile, setTextFile] = useState(null);

  // =======================================================
  // OCR
  // =======================================================

  const [rawText, setRawText] = useState("");

  const [text, setText] = useState("");

  const [loading, setLoading] = useState(false);

  const [cleaning, setCleaning] = useState(false);

  const [progress, setProgress] = useState(0);

  const [ocrLang, setOcrLang] = useState("tha+eng");

  // =======================================================
  // AI CLEANUP SWITCH
  // =======================================================

  const [useAiCleanup, setUseAiCleanup] = useState(true);

  // =======================================================
  // AI STATUS
  // =======================================================

  const [aiCleaningUsed, setAiCleaningUsed] = useState(false);

  const [aiFailed, setAiFailed] = useState(false);

  const [aiErrorMessage, setAiErrorMessage] = useState("");

  // =======================================================
  // PROCESSING STATUS
  // =======================================================

  const [processingStatus, setProcessingStatus] = useState("");

  // =======================================================
  // TTS
  // =======================================================

  // browser = Browser TTS
  // gemini = Gemini TTS

  const [ttsProvider, setTtsProvider] = useState("gemini");

  const [speakingText, setSpeakingText] = useState(false);

  const [audioUrl, setAudioUrl] = useState("");

  const [ttsMode, setTtsMode] = useState("");

  const [ttsQuotaExceeded, setTtsQuotaExceeded] = useState(false);

  const [ttsErrorMessage, setTtsErrorMessage] = useState("");

  const [ttsChunkIndex, setTtsChunkIndex] = useState(0);

  const [ttsChunkTotal, setTtsChunkTotal] = useState(0);

  const [ttsBrowserSupported, setTtsBrowserSupported] = useState(true);

  const audioRef = useRef(null);

  const audioUrlRef = useRef("");

  const browserTtsChunksRef = useRef([]);

  const browserTtsIndexRef = useRef(0);

  const browserTtsActiveRef = useRef(false);

  const ttsOperationIdRef = useRef(0);

  // =======================================================
  // PDF
  // =======================================================

  const [pdfNumPages, setPdfNumPages] = useState(0);

  const [pagesToOcr, setPagesToOcr] = useState("");

  const [pdfDocument, setPdfDocument] = useState(null);

  const [currentOcrPage, setCurrentOcrPage] = useState(0);

  // =======================================================
  // PREVIEW
  // =======================================================

  const [selectedPagePreviews, setSelectedPagePreviews] = useState([]);

  const [loadingPreview, setLoadingPreview] = useState(false);

  const [modalImage, setModalImage] = useState(null);

  // =======================================================
  // DOWNLOAD MODAL
  // =======================================================

  const [downloadModal, setDownloadModal] = useState({
    isOpen: false,
    content: "",
    defaultName: "",
  });

  const [modalFileName, setModalFileName] = useState("");

  // =======================================================
  // TIMING
  // =======================================================

  const [ocrDuration, setOcrDuration] = useState(0);

  // =======================================================
  // DRAG
  // =======================================================

  const [isDragging, setIsDragging] = useState(false);

  // =======================================================
  // SAVE
  // =======================================================

  const [saving, setSaving] = useState(false);

  const [savedToDatabase, setSavedToDatabase] = useState(false);

  // =======================================================
  // REF
  // =======================================================

  const fileInputRef = useRef(null);

  const currentPdfRef = useRef(null);

  // =======================================================
  // PAGE LIST
  // =======================================================

  const parsedPagesList = useMemo(
    () => parsePageRanges(pagesToOcr, pdfNumPages),
    [pagesToOcr, pdfNumPages],
  );

  // =======================================================
  // DISPLAY TEXT
  // =======================================================

  const displayText = aiCleaningUsed && text.trim() ? text : rawText;

  // =======================================================
  // ROLE FORMAT
  // =======================================================

  const formatRole = (role) => {
    if (!role) {
      return "Guest";
    }

    return (
      String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
    );
  };

  // =======================================================
  // TTS LANGUAGE
  // =======================================================

  const getBrowserTtsLanguage = (language) => {
    const map = {
      tha: "th-TH",
      eng: "en-US",
      "tha+eng": "th-TH",
    };

    return map[language] || "en-US";
  };

  // =======================================================
  // AUDIO URL CLEANUP
  // =======================================================

  const revokeCurrentAudioUrl = () => {
    const currentUrl = audioUrlRef.current;

    if (currentUrl) {
      try {
        URL.revokeObjectURL(currentUrl);
      } catch (error) {
        console.warn("REVOKE AUDIO URL ERROR:", error);
      }

      audioUrlRef.current = "";
    }

    setAudioUrl("");
  };

  // =======================================================
  // SESSION
  // =======================================================

  useEffect(() => {
    try {
      const storedSession = JSON.parse(
        localStorage.getItem("ocrthai_session") || "null",
      );

      const token = localStorage.getItem("userToken");

      if (!storedSession || !token) {
        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      setSession(storedSession);
    } catch (error) {
      console.error("LOAD SESSION ERROR:", error);

      localStorage.removeItem("ocrthai_session");

      localStorage.removeItem("userToken");

      navigate("/user-login", {
        replace: true,
      });
    }
  }, [navigate]);

  // =======================================================
  // CHECK BROWSER TTS
  // =======================================================

  useEffect(() => {
    if (typeof window === "undefined") {
      setTtsBrowserSupported(false);

      return;
    }

    setTtsBrowserSupported(
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
    );
  }, []);

  // =======================================================
  // HANDLE AI TOGGLE
  // =======================================================

  const handleAiToggle = (enabled) => {
    setUseAiCleanup(enabled);

    // ถ้าปิด AI ให้กลับไปใช้ Raw OCR
    if (!enabled) {
      setAiCleaningUsed(false);

      setText("");

      setAiFailed(false);

      setAiErrorMessage("");

      if (rawText.trim()) {
        setProcessingStatus("📄 ปิด Gemini AI Cleanup — ระบบจะแสดง Raw OCR");
      }
    } else {
      if (rawText.trim()) {
        setProcessingStatus(
          "🤖 เปิด Gemini AI Cleanup — การประมวลผลครั้งถัดไปจะใช้ AI Cleanup",
        );
      }
    }

    setSavedToDatabase(false);
  };

  // =======================================================
  // HANDLE TTS PROVIDER
  // =======================================================

  const handleTtsProviderChange = (provider) => {
    stopSpeaking();

    setTtsProvider(provider);

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    if (provider === "browser") {
      if (ttsBrowserSupported) {
        setProcessingStatus("🔊 เลือก Browser TTS สำหรับอ่านออกเสียง");
      } else {
        setProcessingStatus("⚠️ Browser ของคุณไม่รองรับ Browser TTS");
      }
    } else {
      setProcessingStatus("🔊 เลือก Gemini TTS สำหรับอ่านออกเสียง");
    }
  };

  // =======================================================
  // IMAGE FILE
  // =======================================================

  const loadImageFile = (file) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("กรุณาเลือกไฟล์รูปภาพ");

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      stopSpeaking();

      setOcrName("");

      setImage(reader.result);

      setImageFile(file);

      setPdfFile(null);

      setTextFile(null);

      setPdfNumPages(0);

      setPagesToOcr("");

      setPdfDocument(null);

      currentPdfRef.current = null;

      setCurrentOcrPage(0);

      setSelectedPagePreviews([]);

      setRawText("");

      setText("");

      setAiCleaningUsed(false);

      setAiFailed(false);

      setAiErrorMessage("");

      setProgress(0);

      setOcrDuration(0);

      setProcessingStatus("✅ โหลดรูปภาพเรียบร้อย");

      setSavedToDatabase(false);

      setSaveNameError("");

      setTtsQuotaExceeded(false);

      setTtsErrorMessage("");

      setTtsMode("");

      setTtsChunkIndex(0);

      setTtsChunkTotal(0);
    };

    reader.onerror = () => {
      alert("ไม่สามารถอ่านไฟล์รูปภาพได้");
    };

    reader.readAsDataURL(file);
  };

  // =======================================================
  // TXT FILE
  // =======================================================

  const loadTextFile = (file) => {
    if (!file) {
      return;
    }

    if (
      file.type !== "text/plain" &&
      !file.name.toLowerCase().endsWith(".txt")
    ) {
      alert("กรุณาเลือกไฟล์ข้อความ .txt");

      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      const content = String(event.target?.result || "");

      stopSpeaking();

      setOcrName("");

      setTextFile(file);

      setImage(null);

      setImageFile(null);

      setPdfFile(null);

      setPdfNumPages(0);

      setPagesToOcr("");

      setPdfDocument(null);

      currentPdfRef.current = null;

      setSelectedPagePreviews([]);

      setRawText(content);

      setText("");

      setAiCleaningUsed(false);

      setAiFailed(false);

      setAiErrorMessage("");

      setProgress(0);

      setOcrDuration(0);

      setProcessingStatus(
        useAiCleanup
          ? "✅ โหลดไฟล์ TXT เรียบร้อย — กดเริ่ม OCR เพื่อให้ AI Cleanup ทำงาน"
          : "✅ โหลดไฟล์ TXT เรียบร้อย — เปิดใช้งาน AI ตามตัวเลือกก่อนเริ่ม",
      );

      setSavedToDatabase(false);

      setSaveNameError("");

      setTtsQuotaExceeded(false);

      setTtsErrorMessage("");

      setTtsMode("");

      setTtsChunkIndex(0);

      setTtsChunkTotal(0);
    };

    reader.onerror = () => {
      alert("ไม่สามารถอ่านไฟล์ TXT ได้");
    };

    reader.readAsText(file, "UTF-8");
  };

  // =======================================================
  // PDF PAGE -> IMAGE
  // =======================================================

  const renderPDFPageAsImage = async (
    documentObject,
    pageNumber,
    scale = 2.5,
  ) => {
    const page = await documentObject.getPage(pageNumber);

    const viewport = page.getViewport({
      scale,
    });

    const canvas = document.createElement("canvas");

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("ไม่สามารถสร้าง Canvas Context ได้");
    }

    canvas.width = Math.ceil(viewport.width);

    canvas.height = Math.ceil(viewport.height);

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // =======================================================
  // PDF
  // =======================================================

  const loadPDFFile = async (file) => {
    if (!file) {
      return;
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      alert("กรุณาเลือกไฟล์ PDF");

      return;
    }

    stopSpeaking();

    setOcrName("");

    setPdfFile(file);

    setImage(null);

    setImageFile(null);

    setTextFile(null);

    setRawText("");

    setText("");

    setAiCleaningUsed(false);

    setAiFailed(false);

    setAiErrorMessage("");

    setProgress(0);

    setCurrentOcrPage(0);

    setSelectedPagePreviews([]);

    setOcrDuration(0);

    setSavedToDatabase(false);

    setSaveNameError("");

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    setProcessingStatus("⏳ กำลังโหลด PDF...");

    try {
      const arrayBuffer = await file.arrayBuffer();

      const pdfDoc = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;

      currentPdfRef.current = pdfDoc;

      setPdfDocument(pdfDoc);

      const numberOfPages = pdfDoc.numPages;

      setPdfNumPages(numberOfPages);

      setPagesToOcr(`1-${numberOfPages}`);

      const firstPage = await renderPDFPageAsImage(pdfDoc, 1, 2.5);

      setImage(firstPage);

      setProcessingStatus(`✅ โหลด PDF สำเร็จ ${numberOfPages} หน้า`);
    } catch (error) {
      console.error("PDF LOADING ERROR:", error);

      setProcessingStatus("❌ โหลด PDF ไม่สำเร็จ");

      alert(error?.message || "เกิดข้อผิดพลาดในการโหลดไฟล์ PDF");

      resetAll();
    }
  };

  // =======================================================
  // PROCESS FILE
  // =======================================================

  const processDroppedFile = async (file) => {
    if (!file) {
      return;
    }

    if (file.type.startsWith("image/")) {
      loadImageFile(file);

      return;
    }

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      await loadPDFFile(file);

      return;
    }

    if (
      file.type === "text/plain" ||
      file.name.toLowerCase().endsWith(".txt")
    ) {
      loadTextFile(file);

      return;
    }

    alert("ไม่รองรับไฟล์ประเภทนี้\n\nรองรับ: รูปภาพ, PDF และ TXT");
  };

  // =======================================================
  // INPUT
  // =======================================================

  const handleFileInput = async (event) => {
    const file = event.target.files?.[0];

    if (file) {
      await processDroppedFile(file);
    }

    event.target.value = "";
  };

  // =======================================================
  // DRAG
  // =======================================================

  const handleDragOver = (event) => {
    event.preventDefault();

    event.stopPropagation();

    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    event.stopPropagation();

    setIsDragging(false);
  };

  const handleDrop = async (event) => {
    event.preventDefault();

    event.stopPropagation();

    setIsDragging(false);

    const files = event.dataTransfer?.files;

    if (!files?.length) {
      return;
    }

    await processDroppedFile(files[0]);
  };

  // =======================================================
  // PDF PREVIEW
  // =======================================================

  useEffect(() => {
    const localDoc = pdfDocument;

    if (!localDoc || pdfNumPages <= 0) {
      return;
    }

    const renderPreview = async () => {
      setLoadingPreview(true);

      setSelectedPagePreviews([]);

      try {
        const pages = parsePageRanges(`1-${pdfNumPages}`, pdfNumPages);

        const previews = [];

        for (let i = 0; i < pages.length; i++) {
          if (currentPdfRef.current !== localDoc) {
            return;
          }

          const pageNumber = pages[i];

          const dataUrl = await renderPDFPageAsImage(localDoc, pageNumber, 1.5);

          if (currentPdfRef.current !== localDoc) {
            return;
          }

          previews.push({
            page: pageNumber,
            dataUrl,
          });

          setSelectedPagePreviews([...previews]);
        }
      } catch (error) {
        console.error("PDF PREVIEW ERROR:", error);
      } finally {
        if (currentPdfRef.current === localDoc) {
          setLoadingPreview(false);
        }
      }
    };

    renderPreview();
  }, [pdfDocument, pdfNumPages]);

  // =======================================================
  // CLIPBOARD
  // =======================================================

  useEffect(() => {
    const handlePaste = (event) => {
      const items = event.clipboardData?.items;

      if (!items) {
        return;
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();

          if (file) {
            loadImageFile(file);
          }

          return;
        }

        if (item.type === "text/plain") {
          item.getAsString((clipboardText) => {
            if (clipboardText.trim()) {
              const blob = new Blob([clipboardText], {
                type: "text/plain",
              });

              const file = new File([blob], `clipboard_${Date.now()}.txt`, {
                type: "text/plain",
              });

              stopSpeaking();

              setOcrName("");

              setTextFile(file);

              setImage(null);

              setImageFile(null);

              setPdfFile(null);

              setPdfNumPages(0);

              setPagesToOcr("");

              setPdfDocument(null);

              currentPdfRef.current = null;

              setSelectedPagePreviews([]);

              setRawText(clipboardText);

              setText("");

              setAiCleaningUsed(false);

              setAiFailed(false);

              setAiErrorMessage("");

              setProgress(0);

              setOcrDuration(0);

              setProcessingStatus(
                useAiCleanup
                  ? "✅ นำเข้าข้อความจาก Clipboard แล้ว — กดเริ่ม OCR เพื่อ AI Cleanup"
                  : "✅ นำเข้าข้อความจาก Clipboard แล้ว — ระบบจะใช้ Raw OCR โดยไม่เรียก Gemini AI",
              );

              setSavedToDatabase(false);

              setSaveNameError("");

              setTtsQuotaExceeded(false);

              setTtsErrorMessage("");

              setTtsMode("");

              setTtsChunkIndex(0);

              setTtsChunkTotal(0);
            }
          });

          return;
        }
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [useAiCleanup]);

  // =======================================================
  // ORGANIZE TEXT
  // =======================================================

  const organizeText = (input) => {
    if (!input) {
      return "";
    }

    let cleaned = String(input);

    cleaned = cleaned.replace(/([ก-๙])\s+([ก-๙])/g, "$1$2");

    cleaned = cleaned.replace(/(\r?\n){3,}/g, "\n\n");

    cleaned = cleaned.replace(/-\s*\n/g, "");

    return cleaned.trim();
  };

  // =======================================================
  // AI CLEANUP
  // =======================================================

  const cleanAndStructureText = async (inputText) => {
    const source = String(inputText || "").trim();

    if (!source) {
      setAiCleaningUsed(false);

      setAiFailed(false);

      setAiErrorMessage("");

      setText("");

      return {
        success: false,
        cleanedText: "",
      };
    }

    // ปิด AI
    if (!useAiCleanup) {
      setCleaning(false);

      setAiCleaningUsed(false);

      setAiFailed(false);

      setAiErrorMessage("");

      setText("");

      setProcessingStatus(
        "✅ OCR เสร็จเรียบร้อย — ไม่ได้ใช้ Gemini AI Cleanup",
      );

      return {
        success: false,
        cleanedText: "",
        skipped: true,
      };
    }

    setCleaning(true);

    setAiFailed(false);

    setAiErrorMessage("");

    setProcessingStatus("🤖 กำลังส่งข้อความไป AI Cleanup...");

    try {
      const result = await cleanupOcrText(source);

      const cleanedText =
        result?.cleanedText ??
        result?.processedText ??
        result?.processed_text ??
        result?.data?.cleanedText ??
        result?.data?.processedText ??
        "";

      const normalizedCleanedText = String(cleanedText || "").trim();

      if (!result?.success || !normalizedCleanedText) {
        throw new Error(result?.message || "AI Cleanup ไม่ได้ส่งข้อความกลับมา");
      }

      setAiCleaningUsed(true);

      setAiFailed(false);

      setAiErrorMessage("");

      setText(normalizedCleanedText);

      setProcessingStatus("✅ OCR และ AI Cleanup เสร็จเรียบร้อย");

      return {
        success: true,
        cleanedText: normalizedCleanedText,
      };
    } catch (error) {
      console.error("AI Cleanup ERROR:", error);

      setAiCleaningUsed(false);

      setAiFailed(true);

      setText("");

      const errorMessage = error?.message || "AI Cleanup ไม่สำเร็จ";

      setAiErrorMessage(errorMessage);

      if (/quota|rate.?limit|exceeded|429/i.test(errorMessage)) {
        setProcessingStatus(
          "⚠️ Gemini AI ใช้งานไม่ได้ชั่วคราว เนื่องจาก Quota/Rate Limit — แสดง Raw OCR",
        );
      } else {
        setProcessingStatus("⚠️ AI Cleanup ใช้งานไม่ได้ — แสดง Raw OCR");
      }

      return {
        success: false,
        cleanedText: "",
      };
    } finally {
      setCleaning(false);
    }
  };

  // =======================================================
  // OCR
  // =======================================================

  const doOCR = async (pagesOverride = null) => {
    const hasImage = Boolean(image);

    const hasPdf = Boolean(pdfFile);

    const hasTextFile = Boolean(textFile);

    if (!hasImage && !hasPdf && !hasTextFile) {
      alert("กรุณาอัปโหลดรูปภาพ, PDF หรือ TXT ก่อน");

      return;
    }

    if (hasPdf && parsedPagesList.length === 0) {
      alert("กรุณาเลือกหน้าที่ต้องการ OCR");

      return;
    }

    stopSpeaking();

    setLoading(true);

    setProgress(0);

    setCurrentOcrPage(0);

    setAiCleaningUsed(false);

    setAiFailed(false);

    setAiErrorMessage("");

    setOcrDuration(0);

    setSavedToDatabase(false);

    const startTime = performance.now();

    try {
      const localDoc = pdfDocument;

      // =================================================
      // TXT
      // =================================================

      if (hasTextFile) {
        const source = organizeText(rawText);

        if (!source) {
          throw new Error("ไฟล์ TXT ไม่มีข้อความ");
        }

        setProcessingStatus("📝 กำลังเตรียมข้อความจาก TXT...");

        setProgress(50);

        setRawText(source);

        if (useAiCleanup) {
          const aiResult = await cleanAndStructureText(source);

          setProgress(aiResult.success ? 100 : 95);
        } else {
          setText("");

          setAiCleaningUsed(false);

          setAiFailed(false);

          setAiErrorMessage("");

          setProgress(100);

          setProcessingStatus(
            "✅ เตรียมข้อความจาก TXT เสร็จแล้ว — ไม่ได้ใช้ Gemini AI Cleanup",
          );
        }
      }

      // =================================================
      // PDF OCR
      // =================================================
      else if (hasPdf && localDoc) {
        const pages = Array.isArray(pagesOverride)
          ? pagesOverride
          : parsedPagesList;

        let allRawText = "";

        const total = pages.length;

        for (let index = 0; index < total; index++) {
          if (currentPdfRef.current !== localDoc) {
            return;
          }

          const pageNumber = pages[index];

          setCurrentOcrPage(pageNumber);

          setProcessingStatus(`⏳ กำลัง OCR หน้า ${pageNumber}/${pdfNumPages}`);

          const imageSource = await renderPDFPageAsImage(
            localDoc,
            pageNumber,
            2.5,
          );

          const weight = 90 / total;

          const baseProgress = index * weight;

          const result = await Tesseract.recognize(imageSource, ocrLang, {
            logger: (ocrMessage) => {
              if (ocrMessage.status === "recognizing text") {
                const current = baseProgress + ocrMessage.progress * weight;

                setProgress(Math.floor(current));

                setProcessingStatus(
                  `⏳ กำลัง OCR หน้า ${pageNumber}/${pdfNumPages}`,
                );
              }
            },
          });

          allRawText += `\n\n--- Page ${pageNumber} / ${pdfNumPages} ---\n\n`;

          allRawText += result.data.text;
        }

        const organized = organizeText(allRawText);

        setRawText(organized);

        setProgress(95);

        if (useAiCleanup) {
          await cleanAndStructureText(organized);
        } else {
          setText("");

          setAiCleaningUsed(false);

          setAiFailed(false);

          setAiErrorMessage("");

          setProgress(100);

          setProcessingStatus(
            "✅ OCR PDF เสร็จเรียบร้อย — ไม่ได้ใช้ Gemini AI Cleanup",
          );
        }
      }

      // =================================================
      // IMAGE OCR
      // =================================================
      else if (hasImage) {
        setProcessingStatus("⏳ กำลัง OCR รูปภาพ...");

        const result = await Tesseract.recognize(image, ocrLang, {
          logger: (ocrMessage) => {
            if (ocrMessage.status === "recognizing text") {
              setProgress(Math.floor(ocrMessage.progress * 90));

              setProcessingStatus("⏳ กำลัง OCR รูปภาพ...");
            }
          },
        });

        const organized = organizeText(result.data.text);

        setRawText(organized);

        setProgress(95);

        if (useAiCleanup) {
          await cleanAndStructureText(organized);
        } else {
          setText("");

          setAiCleaningUsed(false);

          setAiFailed(false);

          setAiErrorMessage("");

          setProgress(100);

          setProcessingStatus(
            "✅ OCR รูปภาพเสร็จเรียบร้อย — ไม่ได้ใช้ Gemini AI Cleanup",
          );
        }
      }

      const duration = ((performance.now() - startTime) / 1000).toFixed(2);

      setOcrDuration(Number(duration));
    } catch (error) {
      console.error("OCR ERROR:", error);

      setAiCleaningUsed(false);

      setAiFailed(false);

      setAiErrorMessage("");

      setText("");

      setProcessingStatus("❌ เกิดข้อผิดพลาดในการประมวลผล");

      alert(error?.message || "เกิดข้อผิดพลาดในการประมวลผล OCR");
    } finally {
      setLoading(false);

      setProgress(0);

      setCurrentOcrPage(0);

      setCleaning(false);
    }
  };

  // =======================================================
  // PAGE SELECTION
  // =======================================================

  const togglePageSelection = (pageNumber) => {
    let current = parsePageRanges(pagesToOcr, pdfNumPages);

    if (current.includes(pageNumber)) {
      current = current.filter((page) => page !== pageNumber);
    } else {
      current.push(pageNumber);
    }

    current.sort((a, b) => a - b);

    setPagesToOcr(current.join(", "));

    setSavedToDatabase(false);
  };

  const handleSelectAllPages = () => {
    if (pdfNumPages > 0) {
      setPagesToOcr(`1-${pdfNumPages}`);

      setSavedToDatabase(false);
    }
  };

  const handleDeselectAllPages = () => {
    setPagesToOcr("");

    setSavedToDatabase(false);
  };

  // =======================================================
  // COPY
  // =======================================================

  const handleCopy = async (content, label) => {
    if (!content) {
      alert("ไม่มีข้อความให้คัดลอก");

      return;
    }

    try {
      await navigator.clipboard.writeText(content);

      alert(`${label}เรียบร้อยแล้ว`);
    } catch (error) {
      console.error("COPY ERROR:", error);

      alert("ไม่สามารถคัดลอกข้อความได้");
    }
  };

  // =======================================================
  // STOP GEMINI AUDIO
  // =======================================================

  const stopGeminiAudio = () => {
    try {
      const audio = audioRef.current;

      if (audio) {
        audio.onended = null;

        audio.onerror = null;

        audio.oncanplay = null;

        audio.onloadeddata = null;

        audio.pause();

        try {
          audio.currentTime = 0;
        } catch (_) {}

        audio.removeAttribute("src");

        try {
          audio.load();
        } catch (_) {}

        audioRef.current = null;
      }
    } catch (error) {
      console.warn("STOP GEMINI AUDIO ERROR:", error);
    }

    revokeCurrentAudioUrl();
  };

  // =======================================================
  // STOP BROWSER TTS
  // =======================================================

  const stopBrowserTts = () => {
    browserTtsActiveRef.current = false;

    browserTtsChunksRef.current = [];

    browserTtsIndexRef.current = 0;

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch (error) {
      console.warn("STOP BROWSER TTS ERROR:", error);
    }
  };

  // =======================================================
  // STOP ALL TTS
  // =======================================================

  const stopSpeaking = () => {
    ttsOperationIdRef.current += 1;

    stopGeminiAudio();

    stopBrowserTts();

    setSpeakingText(false);

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);
  };

  // =======================================================
  // SPLIT LONG TEXT FOR BROWSER TTS
  // =======================================================

  const splitTextForBrowserTts = (inputText, maxLength = 700) => {
    const normalizedText = String(inputText || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    if (!normalizedText) {
      return [];
    }

    const paragraphs = normalizedText
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);

    const chunks = [];

    const pushSmartChunks = (paragraph) => {
      if (!paragraph) {
        return;
      }

      if (paragraph.length <= maxLength) {
        chunks.push(paragraph);

        return;
      }

      const sentences = paragraph.match(
        /[^.!?。！？…]+[.!?。！？…]+|[^.!?。！？…]+$/g,
      ) || [paragraph];

      let current = "";

      for (const sentence of sentences) {
        const cleanSentence = sentence.trim();

        if (!cleanSentence) {
          continue;
        }

        if (!current) {
          if (cleanSentence.length <= maxLength) {
            current = cleanSentence;
          } else {
            let start = 0;

            while (start < cleanSentence.length) {
              chunks.push(cleanSentence.slice(start, start + maxLength));

              start += maxLength;
            }
          }

          continue;
        }

        const candidate = `${current} ${cleanSentence}`;

        if (candidate.length <= maxLength) {
          current = candidate;
        } else {
          chunks.push(current);

          if (cleanSentence.length <= maxLength) {
            current = cleanSentence;
          } else {
            let start = 0;

            while (start < cleanSentence.length) {
              const piece = cleanSentence.slice(start, start + maxLength);

              if (piece.length === maxLength) {
                chunks.push(piece);
              } else {
                current = piece;
              }

              start += maxLength;
            }
          }
        }
      }

      if (current.trim()) {
        chunks.push(current.trim());
      }
    };

    for (const paragraph of paragraphs) {
      pushSmartChunks(paragraph);
    }

    return chunks.map((item) => item.trim()).filter(Boolean);
  };

  // =======================================================
  // BROWSER TTS
  // =======================================================

  const speakWithBrowser = (textToSpeak, operationId) => {
    return new Promise((resolve, reject) => {
      if (
        typeof window === "undefined" ||
        !("speechSynthesis" in window) ||
        !("SpeechSynthesisUtterance" in window)
      ) {
        reject(new Error("Browser ไม่รองรับระบบอ่านออกเสียง"));

        return;
      }

      const chunks = splitTextForBrowserTts(textToSpeak, 700);

      if (!chunks.length) {
        reject(new Error("ไม่มีข้อความสำหรับ Browser TTS"));

        return;
      }

      const language = getBrowserTtsLanguage(ocrLang);

      browserTtsChunksRef.current = chunks;

      browserTtsIndexRef.current = 0;

      browserTtsActiveRef.current = true;

      setTtsChunkTotal(chunks.length);

      setTtsChunkIndex(0);

      const loadVoices = () => window.speechSynthesis.getVoices();

      const findVoice = (voices) => {
        if (!Array.isArray(voices)) {
          return null;
        }

        const normalized = language.toLowerCase();

        let voice = voices.find(
          (item) => String(item.lang || "").toLowerCase() === normalized,
        );

        if (voice) {
          return voice;
        }

        const base = normalized.split("-")[0];

        voice = voices.find((item) =>
          String(item.lang || "")
            .toLowerCase()
            .startsWith(`${base}-`),
        );

        if (voice) {
          return voice;
        }

        voice = voices.find((item) =>
          String(item.lang || "")
            .toLowerCase()
            .startsWith(base),
        );

        return voice || null;
      };

      const speakNextChunk = () => {
        if (operationId !== ttsOperationIdRef.current) {
          resolve();

          return;
        }

        if (!browserTtsActiveRef.current) {
          resolve();

          return;
        }

        const index = browserTtsIndexRef.current;

        if (index >= chunks.length) {
          browserTtsActiveRef.current = false;

          setTtsChunkIndex(chunks.length);

          resolve();

          return;
        }

        const chunk = chunks[index];

        setTtsChunkIndex(index + 1);

        setMessageSafe(
          `🔊 กำลังอ่านด้วย Browser TTS (${index + 1}/${chunks.length})`,
          "success",
        );

        const utterance = new SpeechSynthesisUtterance(chunk);

        utterance.lang = language;

        utterance.rate = 1;

        utterance.pitch = 1;

        utterance.volume = 1;

        const voice = findVoice(loadVoices());

        if (voice) {
          utterance.voice = voice;
        }

        utterance.onend = () => {
          if (operationId !== ttsOperationIdRef.current) {
            resolve();

            return;
          }

          if (!browserTtsActiveRef.current) {
            resolve();

            return;
          }

          browserTtsIndexRef.current = index + 1;

          window.setTimeout(() => {
            speakNextChunk();
          }, 80);
        };

        utterance.onerror = (event) => {
          if (operationId !== ttsOperationIdRef.current) {
            resolve();

            return;
          }

          if (!browserTtsActiveRef.current) {
            resolve();

            return;
          }

          browserTtsActiveRef.current = false;

          reject(
            new Error(event?.error || "Browser TTS ไม่สามารถอ่านออกเสียงได้"),
          );
        };

        try {
          window.speechSynthesis.speak(utterance);
        } catch (error) {
          browserTtsActiveRef.current = false;

          reject(error);
        }
      };

      try {
        window.speechSynthesis.cancel();

        window.setTimeout(() => {
          if (operationId !== ttsOperationIdRef.current) {
            resolve();

            return;
          }

          speakNextChunk();
        }, 100);
      } catch (error) {
        browserTtsActiveRef.current = false;

        reject(error);
      }
    });
  };

  // =======================================================
  // SAFE MESSAGE
  // =======================================================

  const setMessageSafe = (message, type = "success") => {
    void type;

    setProcessingStatus(message);
  };

  // =======================================================
  // PCM/L16 -> WAV
  // =======================================================

  const pcmToWavBlob = (audioBase64, sampleRate = 24000, channels = 1) => {
    const binaryString = window.atob(audioBase64);

    const pcmBytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      pcmBytes[i] = binaryString.charCodeAt(i);
    }

    const bitsPerSample = 16;

    const blockAlign = channels * (bitsPerSample / 8);

    const byteRate = sampleRate * blockAlign;

    const wavBuffer = new ArrayBuffer(44 + pcmBytes.length);

    const view = new DataView(wavBuffer);

    const writeString = (offset, value) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(offset + i, value.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");

    view.setUint32(4, 36 + pcmBytes.length, true);

    writeString(8, "WAVE");

    writeString(12, "fmt ");

    view.setUint32(16, 16, true);

    view.setUint16(20, 1, true);

    view.setUint16(22, channels, true);

    view.setUint32(24, sampleRate, true);

    view.setUint32(28, byteRate, true);

    view.setUint16(32, blockAlign, true);

    view.setUint16(34, bitsPerSample, true);

    writeString(36, "data");

    view.setUint32(40, pcmBytes.length, true);

    new Uint8Array(wavBuffer, 44).set(pcmBytes);

    return new Blob([wavBuffer], {
      type: "audio/wav",
    });
  };

  // =======================================================
  // TTS QUOTA DETECTION
  // =======================================================

  const isTtsQuotaError = (errorMessage) => {
    return /quota|rate.?limit|429|exceeded|generate_content_free_tier_requests|resource.?exhausted/i.test(
      String(errorMessage || ""),
    );
  };

  // =======================================================
  // TTS QUOTA MESSAGE
  // =======================================================

  const getTtsQuotaMessage = (errorMessage) => {
    const messageText = String(errorMessage || "");

    const retryMatch = messageText.match(/retry in\s+([^.\n]+)/i);

    if (retryMatch?.[1]) {
      return (
        "โควตาการสร้างเสียง Gemini TTS เต็มชั่วคราว " +
        `ระบบแนะนำให้รอประมาณ ${retryMatch[1]} ` +
        "หรือเปลี่ยนไปใช้ Browser TTS"
      );
    }

    return (
      "โควตาการสร้างเสียง Gemini TTS เต็มชั่วคราว " +
      "กรุณาเปลี่ยนไปใช้ Browser TTS"
    );
  };

  // =======================================================
  // PLAY GEMINI AUDIO
  // =======================================================

  const speakWithGemini = async (textToSpeak, operationId) => {
    const result = await speakOcrText(textToSpeak);

    if (operationId !== ttsOperationIdRef.current) {
      return true;
    }

    if (!result?.success || !result?.audioBase64) {
      throw new Error(
        result?.message || "Gemini TTS ไม่ได้ส่งข้อมูลเสียงกลับมา",
      );
    }

    const mimeType = String(
      result?.mimeType ||
        result?.mime_type ||
        result?.data?.mimeType ||
        result?.data?.mime_type ||
        "",
    ).toLowerCase();

    const sampleRate =
      Number(
        result?.sampleRate ||
          result?.sample_rate ||
          result?.data?.sampleRate ||
          result?.data?.sample_rate ||
          24000,
      ) || 24000;

    console.log("OCR GEMINI TTS MIME:", mimeType);

    console.log("OCR GEMINI TTS SAMPLE RATE:", sampleRate);

    let blob;

    if (
      mimeType.includes("audio/l16") ||
      mimeType.includes("audio/pcm") ||
      mimeType.includes("pcm")
    ) {
      console.log("🎵 Gemini ส่ง Raw PCM/L16 -> กำลังแปลงเป็น WAV");

      blob = pcmToWavBlob(result.audioBase64, sampleRate, 1);
    } else {
      const binaryString = window.atob(result.audioBase64);

      const bytes = new Uint8Array(binaryString.length);

      for (let index = 0; index < binaryString.length; index++) {
        bytes[index] = binaryString.charCodeAt(index);
      }

      blob = new Blob([bytes], {
        type: result.mimeType || result.mime_type || "audio/wav",
      });
    }

    if (operationId !== ttsOperationIdRef.current) {
      return true;
    }

    const url = URL.createObjectURL(blob);

    audioUrlRef.current = url;

    setAudioUrl(url);

    const audio = new Audio();

    audio.preload = "auto";

    audio.volume = 1;

    audioRef.current = audio;

    audio.src = url;

    audio.onloadeddata = () => {
      console.log("✅ OCR GEMINI AUDIO LOADED");
    };

    audio.oncanplay = () => {
      console.log("✅ OCR GEMINI AUDIO CAN PLAY");
    };

    audio.onended = () => {
      console.log("✅ OCR GEMINI AUDIO ENDED");

      if (audioRef.current === audio) {
        audioRef.current = null;
      }

      revokeCurrentAudioUrl();

      setSpeakingText(false);

      setTtsMode("");

      setProcessingStatus("✅ อ่านข้อความด้วย Gemini TTS เสร็จแล้ว");
    };

    audio.onerror = () => {
      console.error("OCR GEMINI AUDIO ERROR:", audio.error);

      if (audioRef.current === audio) {
        audioRef.current = null;
      }

      revokeCurrentAudioUrl();

      setSpeakingText(false);

      setTtsMode("");

      setTtsErrorMessage(
        "Browser ไม่สามารถเล่นไฟล์เสียงที่ได้รับจาก Gemini ได้",
      );

      setProcessingStatus(
        "❌ Browser ไม่สามารถเล่นไฟล์เสียงจาก Gemini TTS ได้",
      );
    };

    audio.load();

    try {
      await audio.play();
    } catch (error) {
      if (operationId !== ttsOperationIdRef.current) {
        return true;
      }

      throw error;
    }

    if (operationId !== ttsOperationIdRef.current) {
      try {
        audio.pause();
      } catch (_) {}

      return true;
    }

    return true;
  };

  // =======================================================
  // TEXT-TO-SPEECH
  // =======================================================

  const handleSpeakText = async () => {
    const textToSpeak = String(displayText || "").trim();

    if (!textToSpeak) {
      alert("ไม่มีข้อความสำหรับอ่านออกเสียง");

      return;
    }

    if (speakingText) {
      stopSpeaking();

      setProcessingStatus("⏹️ หยุดการอ่านออกเสียงแล้ว");

      return;
    }

    // =====================================================
    // CHECK SELECTED PROVIDER
    // =====================================================

    if (ttsProvider === "browser") {
      if (!ttsBrowserSupported) {
        alert("Browser นี้ไม่รองรับ Browser TTS กรุณาเปลี่ยนเป็น Gemini TTS");

        return;
      }
    }

    // =====================================================
    // NEW OPERATION
    // =====================================================

    const operationId = ttsOperationIdRef.current + 1;

    ttsOperationIdRef.current = operationId;

    // =====================================================
    // RESET STATUS
    // =====================================================

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    // =====================================================
    // STOP OLD TTS
    // =====================================================

    stopGeminiAudio();

    stopBrowserTts();

    // =====================================================
    // START
    // =====================================================

    setSpeakingText(true);

    // =====================================================
    // BROWSER TTS
    // =====================================================

    if (ttsProvider === "browser") {
      try {
        setTtsMode("browser");

        setProcessingStatus("🔊 กำลังอ่านออกเสียงด้วย Browser TTS...");

        await speakWithBrowser(textToSpeak, operationId);

        if (operationId !== ttsOperationIdRef.current) {
          return;
        }

        browserTtsActiveRef.current = false;

        setSpeakingText(false);

        setTtsMode("browser");

        setProcessingStatus("✅ อ่านข้อความด้วย Browser TTS เสร็จแล้ว");
      } catch (error) {
        if (operationId !== ttsOperationIdRef.current) {
          return;
        }

        console.error("BROWSER TTS ERROR:", error);

        stopBrowserTts();

        setSpeakingText(false);

        setTtsMode("");

        const browserMessage =
          error?.message || "ไม่สามารถอ่านออกเสียงด้วย Browser TTS ได้";

        setTtsErrorMessage(browserMessage);

        setProcessingStatus(`❌ ${browserMessage}`);
      }

      return;
    }

    // =====================================================
    // GEMINI TTS
    // =====================================================

    try {
      setTtsMode("gemini");

      setProcessingStatus("🔊 กำลังสร้างเสียงด้วย Gemini TTS...");

      await speakWithGemini(textToSpeak, operationId);

      if (operationId !== ttsOperationIdRef.current) {
        return;
      }

      setTtsMode("gemini");

      setProcessingStatus("🔊 กำลังอ่านออกเสียงด้วย Gemini TTS...");
    } catch (error) {
      if (operationId !== ttsOperationIdRef.current) {
        return;
      }

      console.error("GEMINI TTS ERROR:", error);

      const errorMessage = error?.message || "Gemini TTS ไม่สามารถใช้งานได้";

      if (isTtsQuotaError(errorMessage)) {
        const friendlyMessage = getTtsQuotaMessage(errorMessage);

        setTtsQuotaExceeded(true);

        setTtsErrorMessage(friendlyMessage);

        setProcessingStatus(`⚠️ ${friendlyMessage}`);
      } else {
        setTtsQuotaExceeded(false);

        setTtsErrorMessage(errorMessage);

        setProcessingStatus(`❌ ${errorMessage}`);
      }

      stopGeminiAudio();

      setSpeakingText(false);

      setTtsMode("");
    }
  };

  // =======================================================
  // AUDIO CLEANUP
  // =======================================================

  useEffect(() => {
    return () => {
      ttsOperationIdRef.current += 1;

      try {
        const audio = audioRef.current;

        if (audio) {
          audio.onended = null;

          audio.onerror = null;

          audio.oncanplay = null;

          audio.onloadeddata = null;

          audio.pause();

          audio.removeAttribute("src");

          try {
            audio.load();
          } catch (_) {}

          audioRef.current = null;
        }
      } catch (error) {
        console.warn("AUDIO CLEANUP ERROR:", error);
      }

      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (error) {
        console.warn("BROWSER TTS CLEANUP ERROR:", error);
      }

      const currentUrl = audioUrlRef.current;

      if (currentUrl) {
        try {
          URL.revokeObjectURL(currentUrl);
        } catch (error) {
          console.warn("AUDIO URL CLEANUP ERROR:", error);
        }

        audioUrlRef.current = "";
      }
    };
  }, []);

  // =======================================================
  // RESET
  // =======================================================

  const resetAll = () => {
    currentPdfRef.current = null;

    stopSpeaking();

    revokeCurrentAudioUrl();

    setOcrName("");

    setSaveNameModal({
      isOpen: false,
    });

    setSaveNameInput("");

    setSaveNameError("");

    setImage(null);

    setImageFile(null);

    setPdfFile(null);

    setTextFile(null);

    setPdfNumPages(0);

    setPagesToOcr("");

    setPdfDocument(null);

    setCurrentOcrPage(0);

    setSelectedPagePreviews([]);

    setRawText("");

    setText("");

    setAiCleaningUsed(false);

    setAiFailed(false);

    setAiErrorMessage("");

    setProgress(0);

    setProcessingStatus("");

    setModalImage(null);

    setDownloadModal({
      isOpen: false,
      content: "",
      defaultName: "",
    });

    setModalFileName("");

    setOcrDuration(0);

    setIsDragging(false);

    setLoading(false);

    setCleaning(false);

    setSaving(false);

    setSavedToDatabase(false);

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);
  };

  // =======================================================
  // DOWNLOAD
  // =======================================================

  const openDownloadModal = (content, defaultName) => {
    if (!content) {
      alert("ไม่มีข้อมูลให้ดาวน์โหลด");

      return;
    }

    setDownloadModal({
      isOpen: true,
      content,
      defaultName,
    });

    setModalFileName(defaultName);
  };

  const closeDownloadModal = () => {
    setDownloadModal({
      isOpen: false,
      content: "",
      defaultName: "",
    });

    setModalFileName("");
  };

  const handleExecuteDownload = () => {
    let finalName = modalFileName.trim();

    if (!finalName) {
      finalName = downloadModal.defaultName;
    }

    if (!finalName.toLowerCase().endsWith(".txt")) {
      finalName += ".txt";
    }

    const blob = new Blob([downloadModal.content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const element = document.createElement("a");

    element.href = url;

    element.download = finalName;

    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);

    URL.revokeObjectURL(url);

    closeDownloadModal();
  };

  // =======================================================
  // GET FILE FOR DATABASE
  // =======================================================

  const getFileForDatabase = async () => {
    if (imageFile) {
      return imageFile;
    }

    if (pdfFile) {
      return pdfFile;
    }

    if (textFile) {
      return textFile;
    }

    if (rawText.trim()) {
      const blob = new Blob([rawText.trim()], {
        type: "text/plain;charset=utf-8",
      });

      return new File([blob], `ocr_result_${Date.now()}.txt`, {
        type: "text/plain",
      });
    }

    return null;
  };

  // =======================================================
  // OPEN SAVE NAME MODAL
  // =======================================================

  const handleOpenSaveModal = () => {
    if (!session) {
      alert("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล");

      navigate("/user-login", {
        replace: true,
      });

      return;
    }

    if (!rawText.trim()) {
      alert("ยังไม่มี Raw OCR สำหรับบันทึก");

      return;
    }

    if (savedToDatabase) {
      alert(`รายการ "${ocrName}" ถูกบันทึกแล้ว`);

      return;
    }

    setSaveNameError("");

    setSaveNameInput(ocrName.trim());

    setSaveNameModal({
      isOpen: true,
    });
  };

  // =======================================================
  // CLOSE SAVE NAME MODAL
  // =======================================================

  const closeSaveNameModal = () => {
    if (saving) {
      return;
    }

    setSaveNameModal({
      isOpen: false,
    });

    setSaveNameError("");
  };

  // =======================================================
  // SAVE TO DATABASE
  // =======================================================

  const handleSaveToDatabase = async (providedName = "") => {
    if (!session) {
      alert("กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล");

      navigate("/user-login", {
        replace: true,
      });

      return;
    }

    const finalOcrName = String(
      providedName || saveNameInput || ocrName || "",
    ).trim();

    if (!finalOcrName) {
      setSaveNameError("กรุณาตั้งชื่อรายการ OCR");

      return;
    }

    if (finalOcrName.length > 255) {
      setSaveNameError("ชื่อรายการ OCR ยาวเกิน 255 ตัวอักษร");

      return;
    }

    if (!rawText.trim()) {
      setSaveNameError("ยังไม่มี Raw OCR สำหรับบันทึก");

      return;
    }

    if (savedToDatabase) {
      closeSaveNameModal();

      alert("ข้อมูลรายการนี้ถูกบันทึกแล้ว");

      return;
    }

    try {
      setSaving(true);

      setSaveNameError("");

      setProcessingStatus("⏳ กำลังเตรียมข้อมูลสำหรับบันทึก...");

      const fileToUpload = await getFileForDatabase();

      if (!fileToUpload) {
        throw new Error("ไม่พบข้อมูล OCR สำหรับบันทึก");
      }

      let selectedPages = [];

      if (pdfFile) {
        selectedPages = Array.isArray(parsedPagesList) ? parsedPagesList : [];
      } else if (imageFile || textFile) {
        selectedPages = [1];
      }

      setProcessingStatus("⏳ กำลังบันทึกไฟล์...");

      const uploadResult = await uploadOcrFile(fileToUpload);

      if (!uploadResult?.success) {
        throw new Error(uploadResult?.message || "ไม่สามารถบันทึกไฟล์ได้");
      }

      const fileId =
        uploadResult?.file?.file_id ??
        uploadResult?.file?.id ??
        uploadResult?.file_id ??
        uploadResult?.fileId;

      if (!fileId) {
        throw new Error("Backend ไม่ส่ง file_id กลับมา");
      }

      const processedText = aiCleaningUsed && text.trim() ? text.trim() : "";

      setProcessingStatus("⏳ กำลังบันทึกผล OCR และ History...");

      const result = await saveOcrResult({
        ocrName: finalOcrName,

        fileId: Number(fileId),

        rawText: rawText.trim(),

        processedText,

        processingTime: Number(ocrDuration || 0),

        approved: true,

        selectedPages,

        aiCleaningUsed: Boolean(processedText),
      });

      if (!result?.success) {
        throw new Error(result?.message || "บันทึกผล OCR ไม่สำเร็จ");
      }

      setOcrName(finalOcrName);

      setSaveNameInput(finalOcrName);

      setSavedToDatabase(true);

      setSaveNameModal({
        isOpen: false,
      });

      setSaveNameError("");

      setProcessingStatus("✅ บันทึกข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว");

      alert(
        `บันทึกผล OCR สำเร็จ\n\n` +
          `ชื่อรายการ: ${finalOcrName}\n` +
          `Raw OCR: มีข้อมูล\n` +
          `AI Cleanup: ${
            processedText
              ? "ใช้งานแล้ว"
              : aiFailed
                ? "ใช้งานไม่ได้"
                : "ไม่ได้ใช้"
          }\n` +
          `หน้าที่บันทึก: ${
            selectedPages.length ? selectedPages.join(", ") : "ไม่มีการระบุหน้า"
          }`,
      );
    } catch (error) {
      console.error("SAVE OCR ERROR:", error);

      if (error?.status === 401 || error?.status === 403) {
        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        setSession(null);

        closeSaveNameModal();

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      if (
        error?.status === 409 ||
        error?.code === "ER_DUP_ENTRY" ||
        /ซ้ำ|duplicate|already exists|ถูกใช้แล้ว/i.test(
          String(error?.message || ""),
        )
      ) {
        setSaveNameError(
          error?.message || "ชื่อรายการ OCR นี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่",
        );

        setProcessingStatus("⚠️ ชื่อรายการ OCR ซ้ำ");

        return;
      }

      if (
        /กรุณาแนบไฟล์|ไม่มีไฟล์|file|upload/i.test(String(error?.message || ""))
      ) {
        setSaveNameError(
          error?.message ||
            "ไม่สามารถส่งข้อมูลไฟล์ไปยัง Backend ได้ กรุณาตรวจสอบ API / Upload Middleware",
        );

        setProcessingStatus("❌ Backend ไม่ได้รับไฟล์");

        return;
      }

      const message = error?.message || "บันทึกข้อมูลไม่สำเร็จ";

      setSaveNameError(message);

      setProcessingStatus(`❌ ${message}`);
    } finally {
      setSaving(false);
    }
  };

  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {
    stopSpeaking();

    revokeCurrentAudioUrl();

    localStorage.removeItem("ocrthai_session");

    localStorage.removeItem("userToken");

    setSession(null);

    navigate("/user-login", {
      replace: true,
    });
  };

  // =======================================================
  // OCR BUTTON TEXT
  // =======================================================

  const ocrButtonText = () => {
    if (loading) {
      if (pdfFile && currentOcrPage > 0) {
        return `OCR Page ${currentOcrPage}/${pdfNumPages} (${progress}%)`;
      }

      return `OCR ${progress}%`;
    }

    if (cleaning) {
      return "🤖 กำลัง AI Cleanup...";
    }

    if (textFile) {
      return useAiCleanup ? "🤖 เริ่ม AI Cleanup" : "📝 เริ่มเตรียมข้อความ";
    }

    return "เริ่ม OCR";
  };

  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div
      style={{
        minHeight: "100vh",

        background: "linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)",

        color: "#ffffff",

        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif",
      }}
    >
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

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.04);
        }

        ::-webkit-scrollbar-thumb {
          background: #6366f1;
          border-radius: 999px;
        }

        textarea::placeholder,
        input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        select option {
          background: #0f0f23;
          color: #ffffff;
        }

        /* =========================================
           NAVIGATION
        ========================================= */

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
          color: rgba(255,255,255,0.8);
          text-decoration: none;
          border-radius: 12px;
          transition: all 0.3s ease;
          font-weight: 500;
          font-size: 14px;
        }

        .nav-link:hover {
          background: rgba(255,255,255,0.1);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .nav-link.Active {
          background: linear-gradient(
            135deg,
            rgba(99,102,241,0.2),
            rgba(139,92,246,0.2)
          );
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.3);
          font-weight: 600;
        }

        /* =========================================
           USER CHIP
        ========================================= */

        .user-chip {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ffffff;
          font-weight: 500;
        }

        /* =========================================
           BUTTON
        ========================================= */

        .btn {
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .btn-primary {
          background: linear-gradient(
            135deg,
            #6366f1,
            #4f46e5
          );
          color: #ffffff;
        }

        .btn-success {
          background: linear-gradient(
            135deg,
            #10b981,
            #059669
          );
          color: #ffffff;
          box-shadow:
            0 8px 16px -4px
            rgba(16,185,129,0.35);
        }

        .btn-warning {
          background: linear-gradient(
            135deg,
            #f59e0b,
            #d97706
          );
          color: #ffffff;
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.2);
        }

        .btn-danger {
          background: linear-gradient(
            135deg,
            #ef4444,
            #dc2626
          );
          color: #ffffff;
        }

        .btn-outline {
          background: transparent;
          color: rgba(255,255,255,0.9);
          border: 2px solid rgba(255,255,255,0.3);
        }

        .btn-outline:hover {
          background: rgba(255,255,255,0.1);
        }

        /* =========================================
           OCR CARD
        ========================================= */

        .ocr-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 32px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
        }

        .ocr-section {
          margin-bottom: 20px;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 20px;
        }

        .ocr-title {
          margin: 0 0 16px;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
        }

        .field-label {
          display: block;
          margin-bottom: 8px;
          color: rgba(255,255,255,0.85);
          font-size: 14px;
          font-weight: 600;
        }

        /* =========================================
           DROPZONE
        ========================================= */

        .ocr-dropzone {
          border: 2px dashed rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.05);
          border-radius: 20px;
          min-height: 210px;
          padding: 35px 25px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .ocr-dropzone:hover,
        .ocr-dropzone.drag-active {
          border-color: #818cf8;
          background: rgba(99,102,241,0.12);
        }

        .ocr-drop-icon {
          width: 64px;
          height: 64px;
          display: grid;
          place-items: center;
          border-radius: 18px;
          background: rgba(99,102,241,0.15);
          color: #818cf8;
          font-size: 28px;
          margin-bottom: 14px;
        }

        /* =========================================
           FILE
        ========================================= */

        .selected-file-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding: 14px 16px;
          border-radius: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .selected-file-info {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
          flex: 1;
        }

        .selected-file-icon {
          width: 38px;
          height: 38px;
          min-width: 38px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: rgba(16,185,129,0.15);
          color: #34d399;
        }

        .selected-file-name {
          font-weight: 600;
          font-size: 14px;
          color: #ffffff;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .selected-file-status {
          color: rgba(255,255,255,0.55);
          font-size: 12px;
          margin-top: 3px;
        }

        .selected-file-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        /* =========================================
           INPUT
        ========================================= */

        .ocr-input,
        .ocr-select,
        .ocr-textarea {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.06);
          color: #ffffff;
          border-radius: 12px;
          outline: none;
        }

        .ocr-input {
          padding: 12px 14px;
        }

        .ocr-select {
          padding: 12px 14px;
          cursor: pointer;
        }

        .ocr-select option {
          background: #0f0f23;
          color: #ffffff;
        }

        .ocr-textarea {
          min-height: 280px;
          padding: 14px;
          font-family: inherit;
          line-height: 1.7;
          resize: vertical;
        }

        .ocr-input:focus,
        .ocr-select:focus,
        .ocr-textarea:focus {
          border-color: #818cf8;
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        /* =========================================
           TOGGLE
        ========================================= */

        .ai-toggle-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }

        .toggle-switch {
          position: relative;
          width: 50px;
          height: 28px;
          flex: 0 0 auto;
        }

        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .toggle-slider {
          position: absolute;
          inset: 0;
          cursor: pointer;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px;
          transition: 0.25s ease;
        }

        .toggle-slider::before {
          content: "";
          position: absolute;
          width: 20px;
          height: 20px;
          left: 3px;
          top: 3px;
          border-radius: 50%;
          background: #ffffff;
          transition: 0.25s ease;
          box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        }

        .toggle-switch input:checked + .toggle-slider {
          background: #6366f1;
          border-color: #818cf8;
        }

        .toggle-switch input:checked + .toggle-slider::before {
          transform: translateX(22px);
        }

        .toggle-switch input:disabled + .toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* =========================================
           NAME MODAL
        ========================================= */

        .save-name-modal {
          width: 430px;
          max-width: 100%;
        }

        .save-name-title {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
        }

        .save-name-subtitle {
          margin: 0 0 20px;
          color: rgba(255,255,255,0.55);
          font-size: 12px;
          line-height: 1.7;
        }

        .save-name-input {
          width: 100%;
          padding: 13px 14px;
          border: 1px solid rgba(255,255,255,0.18);
          background: rgba(255,255,255,0.06);
          color: #ffffff;
          border-radius: 12px;
          outline: none;
          font-size: 14px;
        }

        .save-name-input:focus {
          border-color: #818cf8;
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .save-name-error {
          margin-top: 8px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.22);
          color: #fca5a5;
          font-size: 12px;
          line-height: 1.6;
        }

        .save-name-hint {
          margin-top: 8px;
          color: rgba(255,255,255,0.38);
          font-size: 11px;
        }

        .save-name-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        /* =========================================
           PREVIEW
        ========================================= */

        .preview-image {
          max-width: 100%;
          max-height: 360px;
          object-fit: contain;
          background: #ffffff;
          padding: 8px;
          border-radius: 12px;
          cursor: zoom-in;
        }

        .pdf-preview-list {
          display: flex;
          overflow-x: auto;
          gap: 16px;
          padding-bottom: 12px;
        }

        .pdf-preview-item {
          min-width: 210px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          padding: 12px;
        }

        .pdf-preview-item.selected {
          border: 2px solid #6366f1;
          background: rgba(99,102,241,0.1);
        }

        /* =========================================
           STATUS
        ========================================= */

        .processing-status {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.2);
          color: #c7d2fe;
          font-size: 13px;
          font-weight: 500;
          line-height: 1.6;
        }

        .saved-status {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.25);
          color: #6ee7b7;
          font-size: 13px;
          font-weight: 600;
        }

        /* =========================================
           TTS STATUS
        ========================================= */

        .tts-status {
          margin-top: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(99,102,241,0.08);
          border: 1px solid rgba(99,102,241,0.25);
          color: #c7d2fe;
          font-size: 13px;
          line-height: 1.7;
        }

        .tts-status.warning {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.28);
          color: #fbbf24;
        }

        .tts-status-title {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .tts-status-detail {
          color: rgba(255,255,255,0.65);
          font-size: 12px;
        }

        /* =========================================
           AI STATUS
        ========================================= */

        .ai-status-bar {
          margin-bottom: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 12px;
        }

        .ai-status-ok {
          background: rgba(16,185,129,0.08);
          border: 1px solid rgba(16,185,129,0.25);
          color: #6ee7b7;
        }

        .ai-status-failed {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
        }

        .ai-status-raw {
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.25);
          color: #fbbf24;
        }

        .ai-status-label {
          font-weight: 700;
        }

        /* =========================================
           PROGRESS
        ========================================= */

        .progress-track {
          height: 10px;
          background: rgba(255,255,255,0.08);
          border-radius: 999px;
          overflow: hidden;
        }

        .progress-bar {
          height: 100%;
          background: linear-gradient(
            90deg,
            #818cf8,
            #6366f1
          );
          transition: width 0.25s ease;
        }

        /* =========================================
           MODAL
        ========================================= */

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.78);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 3000;
          padding: 20px;
        }

        .modal-card {
          background: rgba(15,15,35,0.96);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 28px;
          border-radius: 20px;
          width: 420px;
          max-width: 100%;
          box-shadow:
            0 25px 70px
            rgba(0,0,0,0.55);
          position: relative;
        }

        .lightbox-image {
          max-width: 90vw;
          max-height: 80vh;
          object-fit: contain;
          background: #ffffff;
          padding: 8px;
          border-radius: 12px;
        }

        /* =========================================
           RESPONSIVE
        ========================================= */

        @media (max-width: 1100px) {
          .ocr-navbar {
            flex-direction: column !important;
          }

          .ocr-navbar-menu,
          .ocr-navbar-user {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .ocr-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .ocr-navbar-menu .nav-link {
            width: 100%;
            text-align: center;
          }

          .ocr-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .selected-file-actions {
            width: 100%;
          }

          .selected-file-actions .btn {
            flex: 1;
          }

          .ocr-card {
            padding: 20px;
          }

          main {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }

          .ai-status-bar {
            align-items: flex-start;
            flex-direction: column;
          }

          .ocr-action-grid {
            grid-template-columns: 1fr !important;
          }

          .save-name-modal {
            width: 100%;
          }

          .ai-toggle-card {
            align-items: flex-start;
            flex-direction: column;
          }
        }

      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav
        className="ocr-navbar"
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

              border: "2px solid rgba(255,255,255,0.2)",

              boxShadow: "0 8px 25px rgba(99,102,241,0.3)",

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

        <div className="ocr-navbar-menu nav-menu">
          <Link to="/" className="nav-link">
            Dashboard
          </Link>

          <Link to="/ocr" className="nav-link Active">
            OCR
          </Link>

          <Link to="/translate" className="nav-link">
            Translate
          </Link>

          <Link to="/history" className="nav-link">
            History
          </Link>

          <Link to="/profile" className="nav-link">
            Edit Profile
          </Link>
        </div>

        <div
          className="ocr-navbar-user"
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
              {session?.name ||
                session?.display_name ||
                session?.email ||
                "ยังไม่ได้เข้าสู่ระบบ"}
            </strong>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleLogout}
          >
            ออกจากระบบ
          </button>
        </div>
      </nav>

      <br />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main
        style={{
          padding: "0 32px 40px",

          maxWidth: "1200px",

          margin: "0 auto",
        }}
      >
        <div className="ocr-card">
          <h2 className="ocr-title">OCR</h2>

          {/* =================================================
              UPLOAD
          ================================================== */}

          <section className="ocr-section">
            <label className="field-label">อัปโหลดเอกสาร</label>

            {!image && !pdfFile && !textFile && (
              <>
                <div
                  className={`ocr-dropzone ${isDragging ? "drag-active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="ocr-drop-icon">📂</div>

                  <h3
                    style={{
                      margin: "0 0 8px",
                      fontSize: "18px",
                    }}
                  >
                    ลากไฟล์มาวางที่นี่
                  </h3>

                  <p
                    style={{
                      margin: "0 0 6px",
                      color: "rgba(255,255,255,0.8)",
                      fontSize: "14px",
                    }}
                  >
                    หรือคลิกเพื่อเลือกไฟล์จากเครื่อง
                  </p>

                  <p
                    style={{
                      margin: "0 0 18px",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: "13px",
                    }}
                  >
                    รองรับ: รูปภาพ, PDF และ TXT
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "rgba(99,102,241,0.15)",
                        color: "#a5b4fc",
                        fontSize: "11px",
                      }}
                    >
                      JPG / PNG
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "rgba(239,68,68,0.15)",
                        color: "#fca5a5",
                        fontSize: "11px",
                      }}
                    >
                      PDF
                    </span>

                    <span
                      style={{
                        padding: "6px 10px",
                        borderRadius: "999px",
                        background: "rgba(16,185,129,0.15)",
                        color: "#6ee7b7",
                        fontSize: "11px",
                      }}
                    >
                      TXT
                    </span>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={handleFileInput}
                  style={{
                    display: "none",
                  }}
                />
              </>
            )}

            {(image || pdfFile || textFile) && (
              <>
                <div className="selected-file-bar">
                  <div className="selected-file-info">
                    <div className="selected-file-icon">✅</div>

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div className="selected-file-name">
                        {pdfFile
                          ? pdfFile.name
                          : imageFile
                            ? imageFile.name
                            : textFile?.name || "ข้อความ"}
                      </div>

                      <div className="selected-file-status">
                        {pdfFile
                          ? `${pdfNumPages} หน้า พร้อมสำหรับ OCR`
                          : imageFile
                            ? "รูปภาพพร้อมสำหรับ OCR"
                            : "ข้อความพร้อมสำหรับ AI Cleanup / บันทึก"}
                      </div>
                    </div>
                  </div>

                  <div className="selected-file-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📁 เปลี่ยนไฟล์
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={resetAll}
                    >
                      ลบไฟล์
                    </button>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.txt"
                  onChange={handleFileInput}
                  style={{
                    display: "none",
                  }}
                />
              </>
            )}
          </section>

          {/* =================================================
              IMAGE PREVIEW
          ================================================== */}

          {image && !pdfFile && !textFile && (
            <section className="ocr-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "16px",
                  }}
                >
                  🖼️ รูปภาพ
                </h3>

                <span
                  style={{
                    color: "#34d399",
                    fontSize: "12px",
                  }}
                >
                  คลิกที่รูปเพื่อขยาย
                </span>
              </div>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <img
                  src={image}
                  alt="Uploaded preview"
                  className="preview-image"
                  onClick={() => setModalImage(image)}
                />
              </div>
            </section>
          )}

          {/* =================================================
              TXT PREVIEW
          ================================================== */}

          {textFile && (
            <section className="ocr-section">
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: "16px",
                }}
              >
                📄 ข้อความที่นำเข้า
              </h3>

              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  padding: "14px",
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "13px",
                  lineHeight: "1.7",
                  whiteSpace: "pre-wrap",
                  maxHeight: "250px",
                  overflowY: "auto",
                }}
              >
                {rawText || "ยังไม่มีข้อความ"}
              </div>

              <div
                style={{
                  marginTop: "10px",
                  color: "#fbbf24",
                  fontSize: "12px",
                }}
              >
                💡 ไฟล์ TXT ไม่ผ่าน Tesseract แต่สามารถส่งข้อความเข้า AI Cleanup
                ได้
              </div>
            </section>
          )}

          {/* =================================================
              PDF
          ================================================== */}

          {pdfFile && pdfNumPages > 0 && (
            <section className="ocr-section">
              <h3
                style={{
                  margin: "0 0 12px",
                  fontSize: "16px",
                }}
              >
                📑 PDF
              </h3>

              <p
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "13px",
                }}
              >
                ชื่อไฟล์:{" "}
                <strong
                  style={{
                    color: "#ffffff",
                  }}
                >
                  {pdfFile.name}
                </strong>
                {" | "}
                จำนวนหน้า: <strong>{pdfNumPages}</strong> หน้า
              </p>

              <label className="field-label">หน้าที่ต้องการ OCR</label>

              <input
                className="ocr-input"
                value={pagesToOcr}
                onChange={(event) => {
                  setPagesToOcr(event.target.value);

                  setSavedToDatabase(false);
                }}
                placeholder="เช่น 1-3, 5, 8-10"
              />

              <div
                style={{
                  marginTop: "12px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#c7d2fe",
                  fontSize: "13px",
                }}
              >
                <strong>หน้าที่จะประมวลผล:</strong>{" "}
                {parsedPagesList.length > 0
                  ? parsedPagesList.join(", ")
                  : "ยังไม่ได้เลือกหน้า"}
              </div>
            </section>
          )}

          {/* =================================================
              PDF PREVIEW
          ================================================== */}

          {pdfFile && (
            <section className="ocr-section">
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
                    fontSize: "16px",
                  }}
                >
                  👁️ Preview PDF
                </h3>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                  }}
                >
                  <button
                    className="btn btn-success"
                    onClick={handleSelectAllPages}
                    disabled={loading}
                  >
                    เลือกทั้งหมด
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={handleDeselectAllPages}
                    disabled={loading}
                  >
                    เอาออกทั้งหมด
                  </button>
                </div>
              </div>

              {loadingPreview && selectedPagePreviews.length === 0 ? (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#818cf8",
                  }}
                >
                  ⏳ กำลังสร้าง Preview PDF...
                </div>
              ) : (
                <div className="pdf-preview-list">
                  {selectedPagePreviews.map((preview) => {
                    const selected = parsedPagesList.includes(preview.page);

                    return (
                      <div
                        key={preview.page}
                        className={`pdf-preview-item ${
                          selected ? "selected" : ""
                        }`}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: "8px",
                          }}
                        >
                          <strong>Page {preview.page}</strong>

                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => togglePageSelection(preview.page)}
                            style={{
                              accentColor: "#6366f1",
                            }}
                          />
                        </div>

                        <img
                          src={preview.dataUrl}
                          alt={`Page ${preview.page}`}
                          onClick={() => setModalImage(preview.dataUrl)}
                          style={{
                            width: "100%",
                            height: "250px",
                            objectFit: "contain",
                            background: "#ffffff",
                            borderRadius: "8px",
                            cursor: "zoom-in",
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* =================================================
              OCR ACTION
          ================================================== */}

          <section className="ocr-section">
            {/* =================================================
                AI CLEANUP OPTION
            ================================================== */}

            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <label className="field-label">🤖 Gemini AI Cleanup</label>

              <div className="ai-toggle-card">
                <div
                  style={{
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 700,
                      color: "#ffffff",
                      fontSize: "14px",
                    }}
                  >
                    {useAiCleanup
                      ? "เปิดใช้งาน AI Cleanup"
                      : "ปิดใช้งาน AI Cleanup"}
                  </div>

                  <div
                    style={{
                      marginTop: "5px",
                      color: "rgba(255,255,255,0.58)",
                      fontSize: "12px",
                      lineHeight: "1.6",
                    }}
                  >
                    {useAiCleanup
                      ? "หลัง OCR เสร็จ ระบบจะส่งข้อความไป Gemini เพื่อปรับปรุงข้อความอัตโนมัติ"
                      : "ระบบจะไม่เรียก Gemini AI และจะแสดง Raw OCR โดยตรง"}
                  </div>
                </div>

                <label className="toggle-label">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={useAiCleanup}
                      onChange={(event) => handleAiToggle(event.target.checked)}
                      disabled={loading || cleaning || saving || speakingText}
                    />

                    <span className="toggle-slider" />
                  </div>

                  <span
                    style={{
                      minWidth: "90px",
                      fontSize: "13px",
                      fontWeight: 700,
                      color: useAiCleanup ? "#6ee7b7" : "#fbbf24",
                    }}
                  >
                    {useAiCleanup ? "ใช้ AI" : "ไม่ใช้ AI"}
                  </span>
                </label>
              </div>
            </div>

            {/* =================================================
                OCR LANGUAGE / BUTTON
            ================================================== */}

            <div
              className="ocr-action-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <div>
                <label className="field-label">ภาษา OCR</label>

                <select
                  className="ocr-select"
                  value={ocrLang}
                  onChange={(event) => setOcrLang(event.target.value)}
                  disabled={loading || cleaning || textFile || speakingText}
                >
                  <option value="tha+eng">Thai + English</option>

                  <option value="tha">Thai</option>

                  <option value="eng">English</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => doOCR()}
                  disabled={
                    loading ||
                    cleaning ||
                    loadingPreview ||
                    speakingText ||
                    (!image && !pdfFile && !textFile) ||
                    (pdfFile && parsedPagesList.length === 0)
                  }
                >
                  {ocrButtonText()}
                </button>

                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={resetAll}
                  disabled={loading || saving || speakingText}
                >
                  Reset
                </button>
              </div>
            </div>

            {processingStatus && (
              <div className="processing-status">{processingStatus}</div>
            )}

            {ttsQuotaExceeded && (
              <div className="tts-status warning">
                <div className="tts-status-title">
                  ⚠️ Gemini TTS ใช้งานไม่ได้ชั่วคราว
                </div>

                <div className="tts-status-detail">
                  {ttsErrorMessage ||
                    "โควตาการสร้างเสียงเต็มชั่วคราว กรุณาเปลี่ยนเป็น Browser TTS"}
                </div>
              </div>
            )}

            {ttsErrorMessage && !ttsQuotaExceeded && !speakingText && (
              <div className="tts-status warning">
                <div className="tts-status-title">⚠️ TTS Error</div>

                <div className="tts-status-detail">{ttsErrorMessage}</div>
              </div>
            )}

            {ttsMode === "browser" && speakingText && (
              <div className="tts-status">
                <div className="tts-status-title">
                  🔊 กำลังอ่านด้วย Browser TTS
                </div>

                <div className="tts-status-detail">
                  กำลังอ่านช่วงที่ {ttsChunkIndex} / {ttsChunkTotal} ของข้อความ
                </div>
              </div>
            )}

            {ttsMode === "gemini" && speakingText && !ttsQuotaExceeded && (
              <div className="tts-status">
                <div className="tts-status-title">
                  🔊 กำลังอ่านด้วย Gemini TTS
                </div>

                <div className="tts-status-detail">
                  กำลังเล่นเสียงที่สร้างจาก Gemini
                </div>
              </div>
            )}

            {savedToDatabase && (
              <div className="saved-status">
                ✅ รายการ <strong>{ocrName}</strong> ถูกบันทึกลงฐานข้อมูลแล้ว
              </div>
            )}

            {loading && (
              <div
                style={{
                  marginTop: "16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                    color: "rgba(255,255,255,0.7)",
                    fontSize: "12px",
                  }}
                >
                  <span>{processingStatus}</span>

                  <span>{progress}%</span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-bar"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* =================================================
              RESULT
          ================================================== */}

          <section className="ocr-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "10px",
                marginBottom: "12px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "16px",
                }}
              >
                ข้อความที่ได้จาก OCR
              </h3>

              {ocrDuration > 0 && (
                <span
                  style={{
                    color: "#34d399",
                    fontSize: "12px",
                  }}
                >
                  ⚡ {ocrDuration} วินาที
                </span>
              )}
            </div>

            {/* =================================================
                AI STATUS
            ================================================== */}

            <div
              className={`ai-status-bar ${
                aiCleaningUsed && text.trim()
                  ? "ai-status-ok"
                  : aiFailed
                    ? "ai-status-failed"
                    : "ai-status-raw"
              }`}
            >
              <div
                style={{
                  width: "100%",
                }}
              >
                <div className="ai-status-label">
                  {aiCleaningUsed && text.trim()
                    ? "🤖 AI Cleanup"
                    : aiFailed
                      ? "⚠️ AI Cleanup ใช้งานไม่ได้"
                      : rawText
                        ? useAiCleanup
                          ? "📄 Raw OCR"
                          : "📄 Raw OCR — ไม่ใช้ AI"
                        : "รอผล OCR"}
                </div>

                <div
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {aiCleaningUsed && text.trim()
                    ? "กำลังแสดงข้อความที่ผ่าน AI Cleanup"
                    : aiFailed
                      ? "AI ไม่สามารถประมวลผลได้ จึงแสดง Raw OCR"
                      : rawText
                        ? useAiCleanup
                          ? "กำลังแสดง Raw OCR"
                          : "ปิด AI Cleanup — กำลังแสดง Raw OCR โดยตรง"
                        : ""}
                </div>

                {aiFailed && aiErrorMessage && (
                  <div
                    style={{
                      marginTop: "8px",
                      color: "rgba(255,255,255,0.62)",
                      fontSize: "11px",
                      lineHeight: "1.6",
                    }}
                  >
                    {aiErrorMessage}
                  </div>
                )}
              </div>
            </div>

            {/* =================================================
                RESULT TEXT
            ================================================== */}

            <textarea
              className="ocr-textarea"
              value={displayText}
              onChange={(event) => {
                if (aiCleaningUsed) {
                  setText(event.target.value);
                } else {
                  setRawText(event.target.value);
                }

                setSavedToDatabase(false);
              }}
              placeholder={
                aiCleaningUsed
                  ? "ผลลัพธ์ AI Cleanup จะแสดงที่นี่..."
                  : "ผลลัพธ์ Raw OCR จะแสดงที่นี่..."
              }
            />

            {/* =================================================
                TTS SELECT
            ================================================== */}

            <div
              style={{
                marginTop: "16px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#ffffff",
                    }}
                  >
                    🔊 วิธีการอ่านออกเสียง
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      color: "rgba(255,255,255,0.55)",
                      fontSize: "11px",
                      lineHeight: "1.6",
                    }}
                  >
                    เลือกว่าต้องการใช้ Browser TTS หรือ Gemini TTS
                  </div>
                </div>

                <select
                  className="ocr-select"
                  value={ttsProvider}
                  onChange={(event) =>
                    handleTtsProviderChange(event.target.value)
                  }
                  disabled={speakingText || cleaning || saving}
                  style={{
                    width: "250px",
                    maxWidth: "100%",
                  }}
                >
                  <option value="browser">Browser TTS</option>

                  <option value="gemini">Gemini TTS</option>
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "10px",
                }}
              >
                

                
              </div>

              {ttsProvider === "browser" && !ttsBrowserSupported && (
                <div
                  style={{
                    marginTop: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.22)",
                    color: "#fca5a5",
                    fontSize: "11px",
                  }}
                >
                  ⚠️ Browser นี้ไม่รองรับ Browser TTS กรุณาเลือก Gemini TTS
                </div>
              )}
            </div>

            {/* =================================================
                ACTIONS
            ================================================== */}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "12px",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                disabled={!displayText || cleaning || saving}
                onClick={handleSpeakText}
              >
                {speakingText ? "⏹️ หยุดอ่าน" : "🔊 อ่านออกเสียง"}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                disabled={!displayText || speakingText}
                onClick={() =>
                  handleCopy(
                    displayText,
                    aiCleaningUsed ? "คัดลอก AI Cleanup " : "คัดลอก Raw OCR ",
                  )
                }
              >
                📋 {aiCleaningUsed ? "คัดลอก AI Cleanup" : "คัดลอก Raw OCR"}
              </button>

              <button
                type="button"
                className="btn btn-success"
                disabled={!rawText || saving || savedToDatabase || speakingText}
                onClick={handleOpenSaveModal}
              >
                {saving
                  ? "⏳ กำลังบันทึก..."
                  : savedToDatabase
                    ? "✅ บันทึกแล้ว"
                    : "💾 บันทึกลงฐานข้อมูล"}
              </button>

              <button
                type="button"
                className="btn btn-warning"
                disabled={!displayText || speakingText}
                onClick={() =>
                  openDownloadModal(
                    displayText,
                    aiCleaningUsed
                      ? ocrName.trim() || "ocr_ai_cleaning"
                      : ocrName.trim() || "ocr_raw",
                  )
                }
              >
                ⬇️{" "}
                {aiCleaningUsed ? "ดาวน์โหลด AI Cleanup" : "ดาวน์โหลด Raw OCR"}
              </button>
            </div>

            {/* =================================================
                SAVE INFO
            ================================================== */}

            {rawText && !savedToDatabase && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  color: "#fbbf24",
                  fontSize: "12px",
                  lineHeight: "1.7",
                }}
              >
                📝 OCR เสร็จแล้ว แต่ยังไม่ได้บันทึกประวัติ
                <br />
                กด <strong>💾 บันทึกลงฐานข้อมูล</strong>{" "}
                แล้วตั้งชื่อรายการเพื่อสร้าง History
                <br />
                <span
                  style={{
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  ไม่ต้องแนบไฟล์ใหม่ตอนกดบันทึก
                </span>
              </div>
            )}

            {/* =================================================
                DATABASE INFO
            ================================================== */}

            {rawText && (
              <div
                style={{
                  marginTop: "15px",
                  padding: "12px 14px",
                  borderRadius: "12px",
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  color: "#c7d2fe",
                  fontSize: "12px",
                }}
              >
                📄 ข้อมูลที่จะบันทึก
                <div
                  style={{
                    marginTop: "6px",
                    color: "rgba(255,255,255,0.55)",
                  }}
                >
                  ชื่อรายการ:{" "}
                  <strong
                    style={{
                      color: "#ffffff",
                    }}
                  >
                    {ocrName.trim() || "จะตั้งชื่อในหน้าต่างบันทึก"}
                  </strong>
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  `rawText` = ข้อความที่อ่านได้ก่อน AI Cleanup
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  {aiCleaningUsed && text.trim()
                    ? "`processedText` = ผลลัพธ์จาก AI Cleanup"
                    : aiFailed
                      ? "`processedText` = ว่าง เพราะ AI Cleanup ใช้งานไม่ได้"
                      : "`processedText` = ว่าง เพราะไม่ได้ใช้ AI Cleanup"}
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  Gemini AI Cleanup:{" "}
                  <strong
                    style={{
                      color: useAiCleanup ? "#6ee7b7" : "#fbbf24",
                    }}
                  >
                    {useAiCleanup ? "เปิด" : "ปิด"}
                  </strong>
                </div>
                <div
                  style={{
                    marginTop: "5px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  TTS:{" "}
                  <strong
                    style={{
                      color: "#c4b5fd",
                    }}
                  >
                    {ttsProvider === "gemini" ? "Gemini TTS" : "Browser TTS"}
                  </strong>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* =====================================================
          SAVE NAME MODAL
      ====================================================== */}

      {saveNameModal.isOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!saving) {
              closeSaveNameModal();
            }
          }}
        >
          <div
            className="modal-card save-name-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSaveNameModal}
              disabled={saving}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#94a3b8",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "15px",
                fontWeight: "700",
              }}
            >
              ✕
            </button>

            <h3 className="save-name-title">💾 ตั้งชื่อรายการ OCR</h3>

            <p className="save-name-subtitle">
              ชื่อนี้จะถูกบันทึกในฐานข้อมูลและแสดงในหน้า History
              <br />
              กรุณาตั้งชื่อที่ไม่ซ้ำกับรายการเดิม
            </p>

            <label className="field-label">
              ชื่อรายการ
              <span
                style={{
                  color: "#fca5a5",
                }}
              >
                {" "}
                *
              </span>
            </label>

            <input
              className="save-name-input"
              type="text"
              maxLength={255}
              value={saveNameInput}
              onChange={(event) => {
                setSaveNameInput(event.target.value);

                setSaveNameError("");
              }}
              autoFocus
              disabled={saving}
              placeholder="เช่น วิทยานิพนธ์บทที่ 1"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();

                  handleSaveToDatabase(saveNameInput);
                }

                if (event.key === "Escape") {
                  event.preventDefault();

                  closeSaveNameModal();
                }
              }}
            />

            <div className="save-name-hint">
              ตัวอย่าง: วิทยานิพนธ์บทที่ 1, รายงานประชุม, เอกสารวิชา Database
            </div>

            {saveNameError && (
              <div className="save-name-error">⚠️ {saveNameError}</div>
            )}

            <div className="save-name-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeSaveNameModal}
                disabled={saving}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={() => handleSaveToDatabase(saveNameInput)}
                disabled={saving || !saveNameInput.trim()}
              >
                {saving ? "⏳ กำลังบันทึก..." : "💾 บันทึกรายการ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          DOWNLOAD MODAL
      ====================================================== */}

      {downloadModal.isOpen && (
        <div className="modal-overlay" onClick={closeDownloadModal}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDownloadModal}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                width: "34px",
                height: "34px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: "15px",
                fontWeight: "700",
              }}
            >
              ✕
            </button>

            <h3
              style={{
                margin: "0 0 18px",
                color: "#ffffff",
                fontSize: "19px",
              }}
            >
              💾 ตั้งชื่อไฟล์ก่อนดาวน์โหลด
            </h3>

            <label className="field-label">ชื่อไฟล์ (.txt)</label>

            <input
              className="ocr-input"
              type="text"
              value={modalFileName}
              onChange={(event) => setModalFileName(event.target.value)}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();

                  handleExecuteDownload();
                }

                if (event.key === "Escape") {
                  event.preventDefault();

                  closeDownloadModal();
                }
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDownloadModal}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="btn btn-warning"
                onClick={handleExecuteDownload}
              >
                ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          IMAGE LIGHTBOX
      ====================================================== */}

      {modalImage && (
        <div className="modal-overlay" onClick={() => setModalImage(null)}>
          <div
            style={{
              position: "relative",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalImage(null)}
              style={{
                position: "absolute",
                top: "-45px",
                right: "0",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                border: "none",
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                color: "#ffffff",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "700",
              }}
            >
              ✕
            </button>

            <img
              src={modalImage}
              alt="Expanded preview"
              className="lightbox-image"
            />
          </div>
        </div>
      )}
    </div>
  );
}
