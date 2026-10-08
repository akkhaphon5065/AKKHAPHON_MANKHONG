import React, { useEffect, useRef, useState } from "react";

import { useNavigate, Link } from "react-router-dom";

import { apiPost } from "../api/api";

import { speakOcrText } from "../api/ocrApi";

export default function TranslatePage() {
  const navigate = useNavigate();

  // =======================================================
  // SESSION
  // =======================================================

  const [session, setSession] = useState(null);

  // =======================================================
  // TRANSLATION
  // =======================================================

  const [sourceText, setSourceText] = useState("");

  const [resultText, setResultText] = useState("");

  const [targetLanguage, setTargetLanguage] = useState("en");

  const [translationName, setTranslationName] = useState("");

  const [translating, setTranslating] = useState(false);

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  const [translateDuration, setTranslateDuration] = useState(0);

  // =======================================================
  // SAVE MODAL
  // =======================================================

  const [saveModalOpen, setSaveModalOpen] = useState(false);

  const [modalTranslationName, setModalTranslationName] = useState("");

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
  // MESSAGE
  // =======================================================

  const [message, setMessage] = useState({
    show: false,
    text: "",
    type: "success",
  });

  // =======================================================
  // TTS
  // =======================================================

  // gemini = Gemini TTS
  // browser = Browser TTS

  const [ttsProvider, setTtsProvider] = useState("gemini");

  const [speakingText, setSpeakingText] = useState(false);

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

  const messageTimerRef = useRef(null);

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
  // LANGUAGE LABEL
  // =======================================================

  const getLanguageName = (language) => {
    const map = {
      th: "ไทย",
      en: "English",
      zh: "Chinese",
      ja: "Japanese",
      ko: "Korean",
    };

    return map[language] || language;
  };

  // =======================================================
  // BROWSER TTS LANGUAGE
  // =======================================================

  const getBrowserTtsLanguage = (language) => {
    const map = {
      th: "th-TH",
      en: "en-US",
      zh: "zh-CN",
      ja: "ja-JP",
      ko: "ko-KR",
    };

    return map[language] || "en-US";
  };

  // =======================================================
  // SHOW MESSAGE
  // =======================================================

  const showMessage = (text, type = "success", duration = 2200) => {
    if (messageTimerRef.current) {
      window.clearTimeout(messageTimerRef.current);
    }

    setMessage({
      show: true,
      text,
      type,
    });

    messageTimerRef.current = window.setTimeout(() => {
      setMessage({
        show: false,
        text: "",
        type: "success",
      });

      messageTimerRef.current = null;
    }, duration);
  };

  // =======================================================
  // SESSION
  // =======================================================

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("ocrthai_session") || "null",
      );

      const token = localStorage.getItem("userToken");

      if (!stored || !token) {
        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      if (stored.role !== "user") {
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

    return () => {
      if (messageTimerRef.current) {
        window.clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  // =======================================================
  // LOGIN
  // =======================================================

  const ensureLogin = () => {
    const token = localStorage.getItem("userToken");

    let stored = null;

    try {
      stored = JSON.parse(localStorage.getItem("ocrthai_session") || "null");
    } catch (_) {
      stored = null;
    }

    if (!token || !stored || stored.role !== "user") {
      navigate("/user-login", {
        replace: true,
      });

      return false;
    }

    return true;
  };

  // =======================================================
  // SELECT TTS PROVIDER
  // =======================================================

  const handleTtsProviderChange = (event) => {
    const provider = event.target.value;

    if (speakingText) {
      return;
    }

    if (provider === "browser" && !ttsBrowserSupported) {
      showMessage("เบราว์เซอร์นี้ไม่รองรับ Browser TTS", "error");

      return;
    }

    setTtsProvider(provider);

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    if (provider === "gemini") {
      showMessage("เลือก Gemini TTS แล้ว", "success");
    } else {
      showMessage("เลือก Browser TTS แล้ว", "success");
    }
  };

  // =======================================================
  // AUDIO URL
  // =======================================================

  const revokeCurrentAudioUrl = () => {
    const url = audioUrlRef.current;

    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn("REVOKE AUDIO URL ERROR:", error);
      }

      audioUrlRef.current = "";
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
    stopGeminiAudio();

    stopBrowserTts();

    setSpeakingText(false);

    setTtsMode("");

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setMessage({
      show: false,
      text: "",
      type: "success",
    });
  };

  // =======================================================
  // SPLIT LONG TEXT FOR BROWSER TTS
  // =======================================================

  const splitTextForBrowserTts = (inputText, maxLength = 700) => {
    const text = String(inputText || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();

    if (!text) {
      return [];
    }

    const paragraphs = text
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

  const speakWithBrowser = (textToSpeak) => {
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

      const language = getBrowserTtsLanguage(targetLanguage);

      browserTtsChunksRef.current = chunks;

      browserTtsIndexRef.current = 0;

      browserTtsActiveRef.current = true;

      setTtsChunkTotal(chunks.length);

      setTtsChunkIndex(0);

      const loadVoices = () => {
        return window.speechSynthesis.getVoices();
      };

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

        setMessage({
          show: true,
          text: `🔊 กำลังอ่านด้วย Browser TTS (${index + 1}/${chunks.length})`,
          type: "success",
        });

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
          speakNextChunk();
        }, 100);
      } catch (error) {
        browserTtsActiveRef.current = false;

        reject(error);
      }
    });
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
        "หรือเปลี่ยนไปเลือก Browser TTS"
      );
    }

    return (
      "โควตาการสร้างเสียง Gemini TTS เต็มชั่วคราว " +
      "กรุณารอสักครู่หรือเปลี่ยนไปเลือก Browser TTS"
    );
  };

  // =======================================================
  // GEMINI TTS
  // =======================================================

  const speakWithGemini = async (textToSpeak) => {
    const result = await speakOcrText(textToSpeak);

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

    console.log("TRANSLATE GEMINI TTS MIME:", mimeType);

    console.log("TRANSLATE GEMINI TTS SAMPLE RATE:", sampleRate);

    let blob;

    if (
      mimeType.includes("audio/l16") ||
      mimeType.includes("audio/pcm") ||
      mimeType.includes("pcm")
    ) {
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

    const url = URL.createObjectURL(blob);

    audioUrlRef.current = url;

    const audio = new Audio();

    audio.preload = "auto";

    audio.volume = 1;

    audioRef.current = audio;

    audio.src = url;

    audio.onloadeddata = () => {
      console.log("✅ TRANSLATE GEMINI AUDIO LOADED");
    };

    audio.oncanplay = () => {
      console.log("✅ TRANSLATE GEMINI AUDIO CAN PLAY");
    };

    audio.onerror = () => {
      console.error("TRANSLATE GEMINI AUDIO ERROR:", audio.error);
    };

    audio.onended = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;

        setSpeakingText(false);

        setTtsMode("");

        setTtsChunkIndex(0);

        setTtsChunkTotal(0);

        setMessage({
          show: true,
          text: "✅ อ่านข้อความแปลด้วย Gemini TTS เสร็จแล้ว",
          type: "success",
        });
      }

      revokeCurrentAudioUrl();
    };

    audio.load();

    await audio.play();

    return true;
  };

  // =======================================================
  // READ RESULT TEXT
  // =======================================================

  const handleSpeakText = async () => {
    const textToSpeak = String(resultText || "").trim();

    if (!textToSpeak) {
      showMessage("กรุณาแปลข้อความก่อนอ่านออกเสียง", "error");

      return;
    }

    // กดขณะกำลังอ่าน = หยุด
    if (speakingText) {
      stopSpeaking();

      showMessage("หยุดอ่านออกเสียงแล้ว", "success");

      return;
    }

    // =====================================================
    // CHECK BROWSER SUPPORT
    // =====================================================

    if (ttsProvider === "browser" && !ttsBrowserSupported) {
      showMessage(
        "เบราว์เซอร์นี้ไม่รองรับ Browser TTS กรุณาเลือก Gemini TTS",
        "error",
      );

      return;
    }

    // =====================================================
    // RESET TTS STATE
    // =====================================================

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    stopGeminiAudio();

    stopBrowserTts();

    setSpeakingText(true);

    // =====================================================
    // BROWSER TTS
    // =====================================================

    if (ttsProvider === "browser") {
      try {
        setTtsMode("browser");

        setMessage({
          show: true,
          text: "🔊 กำลังอ่านด้วย Browser TTS...",
          type: "success",
        });

        await speakWithBrowser(textToSpeak);

        setSpeakingText(false);

        setTtsMode("");

        setTtsChunkIndex(0);

        setTtsChunkTotal(0);

        setMessage({
          show: true,
          text: "✅ อ่านข้อความแปลด้วย Browser TTS เสร็จแล้ว",
          type: "success",
        });

        return;
      } catch (error) {
        console.error("BROWSER TTS ERROR:", error);

        stopBrowserTts();

        setSpeakingText(false);

        setTtsMode("");

        const errorMessage =
          error?.message || "Browser TTS ไม่สามารถอ่านออกเสียงได้";

        setTtsErrorMessage(errorMessage);

        showMessage(errorMessage, "error", 4000);

        return;
      }
    }

    // =====================================================
    // GEMINI TTS
    // =====================================================

    try {
      setTtsMode("gemini");

      setMessage({
        show: true,
        text: "🔊 กำลังสร้างเสียงด้วย Gemini TTS...",
        type: "success",
      });

      await speakWithGemini(textToSpeak);

      setMessage({
        show: true,
        text: "🔊 กำลังอ่านออกเสียงด้วย Gemini TTS...",
        type: "success",
      });

      return;
    } catch (error) {
      console.error("GEMINI TTS ERROR:", error);

      const errorMessage = error?.message || "Gemini TTS ไม่สามารถใช้งานได้";

      if (isTtsQuotaError(errorMessage)) {
        const friendlyMessage = getTtsQuotaMessage(errorMessage);

        setTtsQuotaExceeded(true);

        setTtsErrorMessage(friendlyMessage);

        showMessage(friendlyMessage, "error", 5000);
      } else {
        setTtsQuotaExceeded(false);

        setTtsErrorMessage(errorMessage);

        showMessage(errorMessage, "error", 5000);
      }

      stopGeminiAudio();

      setSpeakingText(false);

      setTtsMode("");

      // สำคัญ:
      // ไม่ fallback ไป Browser TTS
      return;
    }
  };

  // =======================================================
  // TRANSLATE
  // =======================================================

  const handleTranslate = async () => {
    if (!ensureLogin()) {
      return;
    }

    const source = sourceText.trim();

    if (!source) {
      showMessage("กรุณากรอกข้อความต้นฉบับก่อนแปล", "error");

      return;
    }

    stopSpeaking();

    setTranslating(true);

    setSaved(false);

    setResultText("");

    setTranslateDuration(0);

    const start = performance.now();

    try {
      const result = await apiPost("/translate", {
        sourceText: source,
        targetLanguage,
      });

      if (!result?.success) {
        const error = new Error(result?.message || "ไม่สามารถแปลภาษาได้");

        error.status = result?.status;

        throw error;
      }

      const translated =
        result?.translatedText ||
        result?.translated_text ||
        result?.data?.translatedText ||
        result?.data?.translated_text ||
        "";

      if (!String(translated).trim()) {
        throw new Error("Backend ไม่ได้ส่งข้อความแปลกลับมา");
      }

      const finalText = String(translated)
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n");

      setResultText(finalText);

      setTranslateDuration(
        Number(((performance.now() - start) / 1000).toFixed(2)),
      );

      showMessage("แปลภาษาเรียบร้อยแล้ว — ยังไม่ได้บันทึก", "success");
    } catch (error) {
      console.error("TRANSLATE ERROR:", error);

      if (error?.status === 401 || error?.status === 403) {
        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      showMessage(error?.message || "เกิดข้อผิดพลาดในการแปลภาษา", "error");
    } finally {
      setTranslating(false);
    }
  };

  // =======================================================
  // OPEN SAVE MODAL
  // =======================================================

  const handleOpenSaveModal = () => {
    if (!ensureLogin()) {
      return;
    }

    if (!resultText.trim()) {
      showMessage("กรุณาแปลข้อความก่อนบันทึก", "error");

      return;
    }

    setModalTranslationName(translationName.trim());

    setSaveModalOpen(true);
  };

  // =======================================================
  // CLOSE SAVE MODAL
  // =======================================================

  const closeSaveModal = () => {
    if (saving) {
      return;
    }

    setSaveModalOpen(false);
  };

  // =======================================================
  // SAVE RESULT
  // =======================================================

  const handleSaveResult = async () => {
    if (!ensureLogin()) {
      return;
    }

    const name = modalTranslationName.trim();

    const source = sourceText.trim();

    const translated = resultText.trim();

    if (!name) {
      showMessage("กรุณาตั้งชื่อรายการก่อนบันทึก", "error");

      return;
    }

    if (name.length > 255) {
      showMessage("ชื่อรายการยาวเกิน 255 ตัวอักษร", "error");

      return;
    }

    if (!source) {
      showMessage("ไม่มีข้อความต้นฉบับสำหรับบันทึก", "error");

      return;
    }

    if (!translated) {
      showMessage("กรุณาแปลข้อความก่อนบันทึก", "error");

      return;
    }

    if (saved) {
      closeSaveModal();

      return;
    }

    try {
      setSaving(true);

      const result = await apiPost("/translate/result", {
        translationName: name,

        sourceText: source,

        translatedText: translated,

        sourceLanguage: "auto",

        targetLanguage,

        processingTime: Number(translateDuration || 0),

        approved: true,
      });

      if (!result?.success) {
        const error = new Error(
          result?.message || "ไม่สามารถบันทึกผลการแปลได้",
        );

        error.status = result?.status;

        throw error;
      }

      setTranslationName(name);

      setSaved(true);

      setSaveModalOpen(false);

      showMessage(`บันทึก "${name}" เรียบร้อยแล้ว`, "success");
    } catch (error) {
      console.error("SAVE TRANSLATION ERROR:", error);

      if (error?.status === 401 || error?.status === 403) {
        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      if (error?.status === 409 || error?.code === "ER_DUP_ENTRY") {
        showMessage(
          error?.message || "ชื่อรายการนี้ถูกใช้แล้ว กรุณาตั้งชื่อใหม่",
          "error",
        );

        return;
      }

      showMessage(error?.message || "ไม่สามารถบันทึกผลการแปลได้", "error");
    } finally {
      setSaving(false);
    }
  };

  // =======================================================
  // COPY
  // =======================================================

  const handleCopy = async () => {
    if (!resultText.trim()) {
      showMessage("ไม่มีข้อความให้คัดลอก", "error");

      return;
    }

    try {
      await navigator.clipboard.writeText(resultText);

      showMessage("คัดลอกข้อความแปลสำเร็จแล้ว", "success");
    } catch (error) {
      console.error("COPY ERROR:", error);

      showMessage("ไม่สามารถคัดลอกข้อความได้", "error");
    }
  };

  // =======================================================
  // DOWNLOAD
  // =======================================================

  const handleOpenDownloadModal = () => {
    if (!resultText.trim()) {
      showMessage("ไม่มีข้อความให้ดาวน์โหลด", "error");

      return;
    }

    const defaultName =
      translationName.trim() || `translated_${targetLanguage}`;

    setDownloadModal({
      isOpen: true,
      content: resultText,
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
    let name = modalFileName.trim() || downloadModal.defaultName;

    if (!name.toLowerCase().endsWith(".txt")) {
      name += ".txt";
    }

    const file = new Blob([downloadModal.content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(file);

    const element = document.createElement("a");

    element.href = url;

    element.download = name;

    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);

    URL.revokeObjectURL(url);

    closeDownloadModal();

    showMessage("ดาวน์โหลดข้อความแปลเรียบร้อยแล้ว", "success");
  };

  // =======================================================
  // LOGOUT
  // =======================================================

  const handleLogout = () => {
    stopSpeaking();

    localStorage.removeItem("ocrthai_session");

    localStorage.removeItem("userToken");

    setSession(null);

    navigate("/user-login", {
      replace: true,
    });
  };

  // =======================================================
  // RESET
  // =======================================================

  const handleReset = () => {
    stopSpeaking();

    setTranslationName("");

    setSourceText("");

    setResultText("");

    setTargetLanguage("en");

    setTranslateDuration(0);

    setSaved(false);

    setModalTranslationName("");

    setSaveModalOpen(false);

    setTtsQuotaExceeded(false);

    setTtsErrorMessage("");

    setTtsMode("");

    setTtsChunkIndex(0);

    setTtsChunkTotal(0);

    // กลับค่าเริ่มต้นเป็น Gemini TTS
    setTtsProvider("gemini");

    setMessage({
      show: false,
      text: "",
      type: "success",
    });
  };

  // =======================================================
  // UNMOUNT CLEANUP
  // =======================================================

  useEffect(() => {
    return () => {
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
      } catch (_) {}

      try {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}

      const url = audioUrlRef.current;

      if (url) {
        try {
          URL.revokeObjectURL(url);
        } catch (_) {}

        audioUrlRef.current = "";
      }
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",

        background: "linear-gradient(135deg,#0f0f23 0%,#1a1a2e 100%)",

        color: "#ffffff",

        fontFamily: "'Plus Jakarta Sans','Inter',sans-serif",
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

          border:
            1px solid rgba(99,102,241,0.3);

          font-weight: 600;
        }

        /* =========================================
           USER CHIP
        ========================================= */

        .user-chip {
          background:
            rgba(255,255,255,0.1);

          backdrop-filter:
            blur(10px);

          border:
            1px solid rgba(255,255,255,0.2);

          border-radius:
            12px;

          padding:
            10px 16px;

          font-size:
            13px;

          color:
            #ffffff;

          font-weight:
            500;
        }

        /* =========================================
           BUTTON
        ========================================= */

        .btn {
          border:
            none;

          border-radius:
            12px;

          padding:
            12px 20px;

          font-size:
            14px;

          cursor:
            pointer;

          transition:
            all 0.3s ease;

          font-weight:
            600;
        }

        .btn:hover:not(:disabled) {
          transform:
            translateY(-2px);
        }

        .btn:disabled {
          opacity:
            0.5;

          cursor:
            not-allowed;

          transform:
            none;
        }

        .btn-primary {
          background:
            linear-gradient(
              135deg,
              #6366f1,
              #4f46e5
            );

          color:
            #ffffff;

          box-shadow:
            0 8px 16px -4px
            rgba(99,102,241,0.4);
        }

        .btn-success {
          background:
            linear-gradient(
              135deg,
              #10b981,
              #059669
            );

          color:
            #ffffff;
        }

        .btn-warning {
          background:
            linear-gradient(
              135deg,
              #f59e0b,
              #d97706
            );

          color:
            #ffffff;
        }

        .btn-secondary {
          background:
            rgba(255,255,255,0.1);

          color:
            rgba(255,255,255,0.9);

          border:
            1px solid rgba(255,255,255,0.2);
        }

        .btn-outline {
          background:
            transparent;

          color:
            rgba(255,255,255,0.9);

          border:
            2px solid rgba(255,255,255,0.3);
        }

        .btn-outline:hover {
          background:
            rgba(255,255,255,0.1);
        }

        /* =========================================
           MAIN
        ========================================= */

        .translate-main {
          padding:
            0 32px 40px;

          max-width:
            1200px;

          margin:
            0 auto;
        }

        .translate-card {
          background:
            rgba(255,255,255,0.08);

          backdrop-filter:
            blur(20px);

          border:
            1px solid rgba(255,255,255,0.1);

          border-radius:
            24px;

          padding:
            32px;

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
        }

        .translate-title {
          margin:
            0 0 24px;

          color:
            #ffffff;

          font-size:
            24px;

          font-weight:
            700;

          position:
            relative;

          padding:
            0 0 16px 16px;

          border-bottom:
            1px solid rgba(255,255,255,0.1);
        }

        .translate-title::before {
          content:
            "";

          position:
            absolute;

          left:
            0;

          top:
            50%;

          transform:
            translateY(-50%);

          width:
            4px;

          height:
            24px;

          background:
            linear-gradient(
              180deg,
              #818cf8,
              #6366f1
            );

          border-radius:
            2px;
        }

        /* =========================================
           FIELD
        ========================================= */

        .field {
          display:
            flex;

          flex-direction:
            column;

          gap:
            8px;
        }

        .field label {
          font-size:
            14px;

          font-weight:
            600;

          color:
            rgba(255,255,255,0.9);
        }

        /* =========================================
           INPUT
        ========================================= */

        .translate-textarea,
        .translate-select,
        .modal-input {
          width:
            100%;

          padding:
            12px 14px;

          background:
            rgba(255,255,255,0.06);

          color:
            #ffffff;

          border:
            1px solid rgba(255,255,255,0.18);

          border-radius:
            12px;

          outline:
            none;

          font-family:
            inherit;
        }

        .translate-textarea {
          min-height:
            260px;

          resize:
            vertical;

          line-height:
            1.7;
        }

        .translate-textarea.source {
          border-color:
            rgba(99,102,241,0.7);
        }

        .translate-textarea.result {
          border-color:
            rgba(16,185,129,0.7);
        }

        .translate-textarea:focus,
        .translate-select:focus,
        .modal-input:focus {
          border-color:
            #818cf8;

          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        /* =========================================
           ACTIONS
        ========================================= */

        .translate-actions {
          display:
            flex;

          gap:
            10px;

          flex-wrap:
            wrap;
        }

        /* =========================================
           TTS SELECTOR
        ========================================= */

        .tts-selector-card {
          margin-top:
            20px;

          padding:
            18px;

          border-radius:
            16px;

          background:
            linear-gradient(
              135deg,
              rgba(99,102,241,0.10),
              rgba(139,92,246,0.06)
            );

          border:
            1px solid rgba(99,102,241,0.25);
        }

        .tts-selector-grid {
          display:
            grid;

          grid-template-columns:
            1fr 1fr;

          gap:
            18px;

          align-items:
            end;
        }

        .tts-provider-label {
          display:
            block;

          margin-bottom:
            8px;

          font-size:
            14px;

          font-weight:
            700;

          color:
            #ffffff;
        }

        .tts-provider-hint {
          margin-top:
            7px;

          font-size:
            12px;

          color:
            rgba(255,255,255,0.55);

          line-height:
            1.6;
        }

        .tts-provider-badge {
          display:
            inline-flex;

          align-items:
            center;

          gap:
            6px;

          padding:
            9px 13px;

          border-radius:
            10px;

          background:
            rgba(255,255,255,0.06);

          border:
            1px solid rgba(255,255,255,0.10);

          color:
            rgba(255,255,255,0.85);

          font-size:
            13px;

          line-height:
            1.5;
        }

        /* =========================================
           STATUS
        ========================================= */

        .pending-status {
          margin-top:
            15px;

          padding:
            12px 14px;

          border-radius:
            12px;

          background:
            rgba(245,158,11,0.08);

          border:
            1px solid rgba(245,158,11,0.25);

          color:
            #fbbf24;

          font-size:
            13px;

          line-height:
            1.6;
        }

        .save-status {
          margin-top:
            14px;

          padding:
            12px 14px;

          border-radius:
            12px;

          border:
            1px solid rgba(16,185,129,0.25);

          background:
            rgba(16,185,129,0.08);

          color:
            #6ee7b7;

          font-size:
            13px;

          font-weight:
            600;
        }

        /* =========================================
           TTS STATUS
        ========================================= */

        .tts-status {
          margin-top:
            16px;

          padding:
            14px 16px;

          border-radius:
            14px;

          background:
            rgba(99,102,241,0.08);

          border:
            1px solid rgba(99,102,241,0.25);

          color:
            #c7d2fe;

          font-size:
            13px;

          line-height:
            1.7;
        }

        .tts-status.warning {
          background:
            rgba(245,158,11,0.08);

          border-color:
            rgba(245,158,11,0.28);

          color:
            #fbbf24;
        }

        .tts-status.error {
          background:
            rgba(239,68,68,0.08);

          border-color:
            rgba(239,68,68,0.28);

          color:
            #fca5a5;
        }

        .tts-status-title {
          font-weight:
            700;

          margin-bottom:
            4px;
        }

        .tts-status-detail {
          color:
            rgba(255,255,255,0.65);

          font-size:
            12px;
        }

        /* =========================================
           MODAL
        ========================================= */

        .modal-overlay {
          position:
            fixed;

          inset:
            0;

          background:
            rgba(0,0,0,0.78);

          backdrop-filter:
            blur(8px);

          display:
            flex;

          justify-content:
            center;

          align-items:
            center;

          z-index:
            3000;

          padding:
            20px;
        }

        .modal-card {
          background:
            rgba(15,15,35,0.96);

          backdrop-filter:
            blur(20px);

          border:
            1px solid rgba(255,255,255,0.12);

          padding:
            28px;

          border-radius:
            20px;

          width:
            420px;

          max-width:
            100%;

          box-shadow:
            0 25px 70px
            rgba(0,0,0,0.55);

          position:
            relative;
        }

        .save-modal-note {
          padding:
            11px 13px;

          border-radius:
            10px;

          background:
            rgba(99,102,241,0.08);

          border:
            1px solid rgba(99,102,241,0.2);

          color:
            #c7d2fe;

          font-size:
            12px;

          line-height:
            1.6;

          margin-bottom:
            14px;
        }

        /* =========================================
           MESSAGE
        ========================================= */

        .translate-message {
          position:
            fixed;

          right:
            28px;

          bottom:
            28px;

          z-index:
            5000;

          padding:
            14px 20px;

          border-radius:
            12px;

          color:
            #ffffff;

          font-size:
            14px;

          font-weight:
            600;

          box-shadow:
            0 15px 30px
            rgba(0,0,0,0.35);

          max-width:
            420px;
        }

        .translate-message.success {
          background:
            linear-gradient(
              135deg,
              #10b981,
              #059669
            );
        }

        .translate-message.error {
          background:
            linear-gradient(
              135deg,
              #ef4444,
              #dc2626
            );
        }

        /* =========================================
           RESPONSIVE
        ========================================= */

        @media (max-width: 1100px) {
          .translate-navbar {
            flex-direction:
              column !important;
          }

          .translate-navbar-menu,
          .translate-navbar-user {
            justify-content:
              center;
          }
        }

        @media (max-width: 768px) {
          .translate-navbar-menu {
            flex-direction:
              column;

            width:
              100%;
          }

          .translate-navbar-menu .nav-link {
            width:
              100%;

            text-align:
              center;
          }

          .translate-navbar-user {
            width:
              100%;

            justify-content:
              center;
          }

          .translate-main {
            padding:
              0 16px 30px;
          }

          .translate-card {
            padding:
              24px;
          }

          .translate-grid {
            grid-template-columns:
              1fr !important;
          }

          .tts-selector-grid {
            grid-template-columns:
              1fr;
          }

          .translate-actions {
            flex-direction:
              column;
          }

          .translate-actions .btn {
            width:
              100%;
          }

          .translate-message {
            left:
              20px;

            right:
              20px;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav
        className="translate-navbar"
        style={{
          display: "flex",

          justifyContent: "space-between",

          alignItems: "center",

          padding: "16px 32px",

          background: "rgba(255,255,255,0.05)",

          backdropFilter: "blur(20px)",

          borderBottom: "1px solid rgba(255,255,255,0.1)",

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
            width: "120px",

            height: "75px",

            display: "grid",

            placeItems: "center",

            borderRadius: "12px",

            background:
              "linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))",

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

        {/* MENU */}

        <div className="translate-navbar-menu nav-menu">
          <Link to="/" className="nav-link">
            Dashboard
          </Link>

          <Link to="/ocr" className="nav-link">
            OCR
          </Link>

          <Link to="/translate" className="nav-link Active">
            Translate
          </Link>

          <Link to="/history" className="nav-link">
            History
          </Link>

          <Link to="/profile" className="nav-link">
            Edit Profile
          </Link>
        </div>

        {/* USER */}

        <div
          className="translate-navbar-user"
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

      <main className="translate-main">
        <section>
          <div className="translate-card">
            <h3 className="translate-title">แปลภาษา</h3>

            {/* =================================================
                TEXT AREA
            ================================================== */}

            <div
              className="translate-grid"
              style={{
                display: "grid",

                gridTemplateColumns: "1fr 1fr",

                gap: "20px",

                marginBottom: "20px",
              }}
            >
              <div className="field">
                <label>ข้อความต้นฉบับ</label>

                <textarea
                  className="translate-textarea source"
                  value={sourceText}
                  onChange={(event) => {
                    setSourceText(event.target.value);

                    setSaved(false);
                  }}
                  placeholder="กรอกข้อความที่ต้องการแปล..."
                  disabled={translating || saving}
                />
              </div>

              <div className="field">
                <label>ข้อความแปล</label>

                <textarea
                  className="translate-textarea result"
                  value={resultText}
                  onChange={(event) => {
                    setResultText(event.target.value);

                    setSaved(false);
                  }}
                  placeholder="ผลการแปลจะแสดงที่นี่..."
                  disabled={translating || saving || saved}
                />
              </div>
            </div>

            {/* =================================================
                TARGET LANGUAGE
            ================================================== */}

            <div
              className="translate-grid"
              style={{
                display: "grid",

                gridTemplateColumns: "1fr 1fr",

                gap: "20px",

                marginBottom: "20px",
              }}
            >
              <div className="field">
                <label>ภาษาเป้าหมาย</label>

                <select
                  className="translate-select"
                  value={targetLanguage}
                  onChange={(event) => {
                    if (speakingText) {
                      stopSpeaking();
                    }

                    setTargetLanguage(event.target.value);

                    setSaved(false);
                  }}
                  disabled={translating || saving || saved || speakingText}
                >
                  <option value="en">English</option>

                  <option value="th">Thai</option>

                  <option value="zh">Chinese</option>

                  <option value="ja">Japanese</option>

                  <option value="ko">Korean</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",

                  alignItems: "flex-end",

                  color: "rgba(255,255,255,0.55)",

                  fontSize: "12px",

                  paddingBottom: "12px",
                }}
              >
                ภาษาอ่านออกเสียง: {getLanguageName(targetLanguage)}
              </div>
            </div>

            {/* =================================================
                TTS PROVIDER SELECTOR
            ================================================== */}

            <div className="tts-selector-card">
              <div className="tts-selector-grid">
                <div className="field">
                  <label className="tts-provider-label">
                    🔊 วิธีอ่านออกเสียง
                  </label>

                  <select
                    className="translate-select"
                    value={ttsProvider}
                    onChange={handleTtsProviderChange}
                    disabled={translating || saving || speakingText}
                  >
                    <option value="gemini">🤖 Gemini TTS</option>

                    <option value="browser" disabled={!ttsBrowserSupported}>
                      🔊 Browser TTS
                      {!ttsBrowserSupported ? " (ไม่รองรับ)" : ""}
                    </option>
                  </select>

                  <div className="tts-provider-hint">
                    {ttsProvider === "gemini"
                      ? "ใช้ Gemini TTS ในการสร้างเสียงจากข้อความแปล"
                      : "ใช้ระบบอ่านออกเสียงของเบราว์เซอร์โดยตรง"}
                  </div>
                </div>

                
              </div>
            </div>

            {/* =================================================
                ACTIONS
            ================================================== */}

            <div
              className="translate-actions"
              style={{
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleTranslate}
                disabled={translating || saving || speakingText}
              >
                {translating ? "กำลังแปล... 🌐" : "🌐 แปลภาษา"}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSpeakText}
                disabled={!resultText || translating || saving}
              >
                {speakingText ? "⏹️ หยุดอ่าน" : "🔊 อ่านออกเสียง"}
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleCopy}
                disabled={!resultText || translating || saving}
              >
                📋 คัดลอกข้อความแปล
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenSaveModal}
                disabled={
                  !resultText || translating || saving || saved || speakingText
                }
              >
                {saved ? "✓ บันทึกแล้ว" : "💾 บันทึกผลการแปล"}
              </button>

              <button
                type="button"
                className="btn btn-warning"
                onClick={handleOpenDownloadModal}
                disabled={!resultText || translating || saving}
              >
                ⬇️ ดาวน์โหลดข้อความแปล
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={translating || saving || speakingText}
              >
                ล้างข้อมูล
              </button>
            </div>

            {/* =================================================
                TTS STATUS - BROWSER
            ================================================== */}

            {ttsMode === "browser" && speakingText && (
              <div className="tts-status">
                <div className="tts-status-title">
                  🔊 กำลังอ่านด้วย Browser TTS
                </div>

                <div className="tts-status-detail">
                  กำลังอ่านช่วงที่ {ttsChunkIndex} / {ttsChunkTotal}{" "}
                  ของข้อความแปล
                </div>
              </div>
            )}

            {/* =================================================
                TTS STATUS - GEMINI
            ================================================== */}

            {ttsMode === "gemini" && speakingText && (
              <div className="tts-status">
                <div className="tts-status-title">
                  🤖 กำลังอ่านด้วย Gemini TTS
                </div>

                <div className="tts-status-detail">
                  ระบบกำลังเล่นเสียงที่ Gemini TTS สร้างขึ้น
                </div>
              </div>
            )}

            {/* =================================================
                GEMINI QUOTA ERROR
            ================================================== */}

            {ttsQuotaExceeded && !speakingText && (
              <div className="tts-status warning">
                <div className="tts-status-title">
                  ⚠️ Gemini TTS ใช้งานไม่ได้ชั่วคราว
                </div>

                <div className="tts-status-detail">
                  {ttsErrorMessage || "กรุณารอสักครู่หรือเลือก Browser TTS"}
                </div>
              </div>
            )}

            {/* =================================================
                GENERAL TTS ERROR
            ================================================== */}

            {ttsErrorMessage && !ttsQuotaExceeded && !speakingText && (
              <div className="tts-status error">
                <div className="tts-status-title">
                  ⚠️ ไม่สามารถอ่านออกเสียงได้
                </div>

                <div className="tts-status-detail">{ttsErrorMessage}</div>
              </div>
            )}

            {/* =================================================
                PENDING SAVE
            ================================================== */}

            {resultText && !saved && !translating && (
              <div className="pending-status">
                📝 แปลเสร็จแล้ว แต่ยังไม่ได้บันทึก
                <br />
                กด <strong>💾 บันทึกผลการแปล</strong> เพื่อเปิดหน้าต่างตั้งชื่อ
              </div>
            )}

            {/* =================================================
                DURATION
            ================================================== */}

            {translateDuration > 0 && (
              <div
                style={{
                  marginTop: "16px",

                  color: "#34d399",

                  fontSize: "13px",
                }}
              >
                ⚡ ใช้เวลาประมวลผล {translateDuration} วินาที
              </div>
            )}

            {/* =================================================
                SAVE STATUS
            ================================================== */}

            {saved && (
              <div className="save-status">
                ✓ ผลการแปลถูกบันทึกลงฐานข้อมูลแล้ว
                <div
                  style={{
                    marginTop: "5px",

                    color: "rgba(255,255,255,0.55)",

                    fontSize: "11px",
                  }}
                >
                  ชื่อรายการ:{" "}
                  <strong
                    style={{
                      color: "#ffffff",
                    }}
                  >
                    {translationName}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =====================================================
          SAVE MODAL
      ====================================================== */}

      {saveModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!saving) {
              closeSaveModal();
            }
          }}
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeSaveModal}
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

                fontWeight: 700,
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
              💾 ตั้งชื่อรายการก่อนบันทึก
            </h3>

            <div className="save-modal-note">
              ชื่อนี้จะถูกบันทึกในฐานข้อมูล และแสดงเป็นชื่อรายการในหน้า
              <strong> History</strong>
              <br />
              กรุณาตั้งชื่อไม่ซ้ำกับรายการแปลเดิม
            </div>

            <div className="field">
              <label>
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
                className="modal-input"
                type="text"
                maxLength={255}
                value={modalTranslationName}
                onChange={(event) =>
                  setModalTranslationName(event.target.value)
                }
                disabled={saving}
                autoFocus
                placeholder="เช่น ข้าวสวย, วิทยานิพนธ์บทที่ 1"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();

                    handleSaveResult();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();

                    closeSaveModal();
                  }
                }}
              />
            </div>

            <div
              className="translate-actions"
              style={{
                justifyContent: "flex-end",

                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeSaveModal}
                disabled={saving}
              >
                ยกเลิก
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleSaveResult}
                disabled={saving || !modalTranslationName.trim()}
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

            <div className="field">
              <label>ชื่อไฟล์ (.txt)</label>

              <input
                className="modal-input"
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
            </div>

            <div
              className="translate-actions"
              style={{
                justifyContent: "flex-end",

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
          MESSAGE
      ====================================================== */}

      {message.show && (
        <div className={`translate-message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
