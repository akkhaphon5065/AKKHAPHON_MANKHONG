// =========================================================
// UsageReportPage.jsx
// OCRThai Plus
//
// ADMIN:
// ---------------------------------------------------------
// - รายงานประวัติการใช้งานระบบ
// - ค้นหาด้วยชื่อ / Email / User ID
// - กรองวันที่เริ่มต้น / สิ้นสุด
// - แสดง User ID
// - แสดง OCR / Translate
// - Export CSV
// =========================================================

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

// =========================================================
// CONFIG
// =========================================================

const API_BASE_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

// =========================================================
// COMPONENT
// =========================================================

const UsageReportPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // USAGE DATA
  // =========================================================

  const [allUsageData, setAllUsageData] = useState([]);

  // =========================================================
  // FILTER
  // =========================================================

  const [userSearch, setUserSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // =========================================================
  // TOAST
  // =========================================================

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // =========================================================
  // ACTION
  // =========================================================

  const [loadingAction, setLoadingAction] = useState("");

  // =========================================================
  // SHOW TOAST
  // =========================================================

  const showToast = useCallback((message, type = "success") => {
    setToast({
      show: true,
      message,
      type,
    });

    window.setTimeout(() => {
      setToast({
        show: false,
        message: "",
        type: "success",
      });
    }, 1800);
  }, []);

  // =========================================================
  // TOKEN
  // =========================================================

  const getToken = () => {
    try {
      return localStorage.getItem("userToken") || "";
    } catch (error) {
      console.error("GET TOKEN ERROR:", error);
      return "";
    }
  };

  // =========================================================
  // API REQUEST
  // =========================================================

  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    if (!token) {
      const error = new Error("NO_TOKEN");
      error.status = 401;
      throw error;
    }

    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;

    const headers = {
      ...(isFormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data = null;

    try {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();

        if (text) {
          try {
            data = JSON.parse(text);
          } catch (_) {
            data = {
              success: response.ok,
              message: text,
            };
          }
        }
      }
    } catch (error) {
      console.error("PARSE API RESPONSE ERROR:", error);
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || data?.error || `HTTP ${response.status}`,
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data || { success: true };
  };

  // =========================================================
  // CLEAR AUTH
  // =========================================================

  const clearAuth = () => {
    localStorage.removeItem("userToken");
    localStorage.removeItem("ocrthai_session");
    setSession(null);
  };

  // =========================================================
  // CHECK ADMIN SESSION
  // =========================================================

  const checkAdminSession = useCallback(async () => {
    try {
      const result = await apiRequest("/auth/me");

      if (!result?.success || !result?.user) {
        throw new Error("INVALID_SESSION");
      }

      const user = result.user;

      if (user.role !== "admin") {
        clearAuth();
        navigate("/admin-login", { replace: true });
        return null;
      }

      const adminSession = {
        ...user,
        name: user.display_name || user.name || user.email || "Administrator",
      };

      setSession(adminSession);
      localStorage.setItem("ocrthai_session", JSON.stringify(adminSession));

      return adminSession;
    } catch (error) {
      console.error("CHECK USAGE REPORT SESSION ERROR:", error);
      clearAuth();
      navigate("/admin-login", { replace: true });
      return null;
    }
  }, [navigate]);

  // =========================================================
  // NORMALIZE USER ID
  // =========================================================

  const getUserId = (item) => {
    return item?.user_id ?? item?.userId ?? item?.userID ?? null;
  };

  // =========================================================
  // NORMALIZE HISTORY
  // =========================================================

  const normalizeHistory = (item, index) => {
    const normalizedUserId = getUserId(item);

    return {
      ...item,
      id: item?.history_id ?? item?.historyId ?? item?.id ?? index + 1,
      history_id: item?.history_id ?? item?.historyId ?? item?.id ?? index + 1,
      user_id: normalizedUserId,
      userId: normalizedUserId,
      userName:
        item?.userName ??
        item?.user_name ??
        item?.displayName ??
        item?.display_name ??
        item?.name ??
        "-",
      userEmail: item?.userEmail ?? item?.user_email ?? item?.email ?? "-",
      datetime: item?.datetime ?? item?.createdAt ?? item?.created_at ?? "-",
      type: item?.type ?? "SYSTEM",
      detail: item?.detail ?? item?.description ?? item?.message ?? "-",
      status: item?.status ?? "สำเร็จ",
    };
  };

  // =========================================================
  // LOAD USAGE DATA
  // =========================================================

  const loadUsageData = useCallback(async () => {
    try {
      const result = await apiRequest("/history/all");

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถโหลดรายงานการใช้งานได้");
      }

      const rows = Array.isArray(result.data) ? result.data : [];
      const normalized = rows.map((item, index) =>
        normalizeHistory(item, index),
      );

      setAllUsageData(normalized);
    } catch (error) {
      console.error("LOAD USAGE DATA ERROR:", error);

      if (
        error.status === 401 ||
        error.status === 403 ||
        error.message === "NO_TOKEN"
      ) {
        clearAuth();
        navigate("/admin-login", { replace: true });
        return;
      }

      showToast(error.message || "ไม่สามารถโหลดรายงานการใช้งานได้", "error");
    }
  }, [navigate, showToast]);

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const admin = await checkAdminSession();

        if (!mounted || !admin) {
          return;
        }

        await loadUsageData();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [checkAdminSession, loadUsageData]);

  // =========================================================
  // REFRESH ON FOCUS
  // =========================================================

  useEffect(() => {
    const handleFocus = async () => {
      const token = getToken();

      if (!token) {
        navigate("/admin-login", { replace: true });
        return;
      }

      const admin = await checkAdminSession();

      if (admin) {
        await loadUsageData();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkAdminSession, loadUsageData, navigate]);

  // =========================================================
  // GET COMPARABLE DATE
  // =========================================================

  const getComparableDate = (value) => {
    if (!value) {
      return "";
    }

    const raw = String(value);

    if (raw.includes("T")) {
      return raw.replace("T", " ").slice(0, 19);
    }

    return raw;
  };

  // =========================================================
  // FORMAT DATE
  // =========================================================

  const formatDateTime = (value) => {
    if (!value || value === "-") {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // =========================================================
  // FILTER DATA
  // =========================================================

  const filteredData = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase();

    return allUsageData.filter((item) => {
      const rawUserId = getUserId(item);
      const userId = String(rawUserId ?? "").toLowerCase();
      const name = String(item.userName || "").toLowerCase();
      const email = String(item.userEmail || "").toLowerCase();

      const matchesUser =
        !keyword ||
        name.includes(keyword) ||
        email.includes(keyword) ||
        userId.includes(keyword);

      const comparable = getComparableDate(item.datetime);
      let matchesDate = true;

      if (startDate && comparable) {
        const start = `${startDate} 00:00:00`;
        if (comparable < start) {
          matchesDate = false;
        }
      }

      if (endDate && comparable) {
        const end = `${endDate} 23:59:59`;
        if (comparable > end) {
          matchesDate = false;
        }
      }

      return matchesUser && matchesDate;
    });
  }, [allUsageData, userSearch, startDate, endDate]);

  // =========================================================
  // SEARCH
  // =========================================================

  const handleSearch = () => {
    showToast("ค้นหาข้อมูลเรียบร้อยแล้ว", "success");
  };

  // =========================================================
  // CLEAR
  // =========================================================

  const handleClear = () => {
    setUserSearch("");
    setStartDate("");
    setEndDate("");
    showToast("ล้างตัวกรองเรียบร้อยแล้ว", "success");
  };

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExport = () => {
    if (filteredData.length === 0) {
      showToast("ไม่มีข้อมูลสำหรับส่งออกรายงาน", "error");
      return;
    }

    const headers = [
      "History ID",
      "วันที่/เวลา",
      "User ID",
      "ผู้ใช้งาน",
      "อีเมล",
      "ประเภท",
      "รายละเอียด",
      "สถานะ",
    ];

    const escapeCSV = (value) => {
      const text = String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };

    const csvRows = filteredData.map((item) => {
      const userId = getUserId(item);

      return [
        item.history_id,
        item.datetime,
        userId,
        item.userName,
        item.userEmail,
        item.type,
        item.detail,
        item.status,
      ]
        .map(escapeCSV)
        .join(",");
    });

    const csvContent = [headers.map(escapeCSV).join(","), ...csvRows].join(
      "\n",
    );

    const blob = new Blob(["\ufeff", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const today = new Date().toISOString().split("T")[0];
    link.download = `usage_report_${today}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("ส่งออกรายงานเรียบร้อยแล้ว", "success");
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      setLoadingAction("logout");

      const token = getToken();

      if (token) {
        try {
          await apiRequest("/auth/logout", {
            method: "POST",
          });
        } catch (error) {
          console.warn("LOGOUT API ERROR:", error);
        }
      }
    } finally {
      clearAuth();
      showToast("ออกจากระบบเรียบร้อยแล้ว", "success");

      setTimeout(() => {
        navigate("/admin-login", { replace: true });
      }, 500);
    }
  };

  // =========================================================
  // STATUS CLASS
  // =========================================================

  const getStatusClass = (status) => {
    const text = String(status || "").toLowerCase();

    if (text === "active" || text === "สำเร็จ" || text === "success") {
      return "status-success";
    }

    return "status-error";
  };

  // =========================================================
  // STATUS TEXT
  // =========================================================

  const getStatusText = (status) => {
    if (!status) {
      return "สำเร็จ";
    }

    return status;
  };

  // =========================================================
  // TYPE TEXT
  // =========================================================

  const getTypeText = (type) => {
    const normalized = String(type || "").toLowerCase();

    if (normalized === "translate") {
      return "Translate";
    }

    if (normalized === "translation") {
      return "Translation";
    }

    if (normalized === "ocr") {
      return "OCR";
    }

    return type || "SYSTEM";
  };

  // =========================================================
  // FORMAT ROLE
  // =========================================================

  const formatRole = (role) => {
    if (!role) {
      return "Guest";
    }

    return (
      String(role).charAt(0).toUpperCase() + String(role).slice(1).toLowerCase()
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>⏳</div>

          <div style={{ fontSize: "17px", fontWeight: "600" }}>
            กำลังโหลดรายงานการใช้งาน...
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RENDER
  // =========================================================

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

        .user-chip {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 10px 16px;
          font-size: 13px;
          color: #ffffff;
          font-weight: 500;
          transition: all 0.3s ease;
        }

        .user-chip:hover {
          background: rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }

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
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #ffffff;
          box-shadow: 0 8px 16px -4px rgba(99,102,241,0.4);
        }

        .btn-primary:hover:not(:disabled) {
          background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.2);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255,255,255,0.15);
        }

        .btn-success {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          box-shadow: 0 8px 16px -4px rgba(16,185,129,0.35);
        }

        .btn-success:hover:not(:disabled) {
          background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
        }

        .btn-outline {
          background: transparent;
          color: rgba(255,255,255,0.9);
          border: 2px solid rgba(255,255,255,0.3);
        }

        .btn-outline:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
          color: #ffffff;
        }

        .usage-report-navbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 32px;
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.1);
          color: #ffffff;
          position: sticky;
          top: 0;
          z-index: 1000;
          flex-wrap: wrap;
          gap: 20px;
        }

        .usage-report-logo {
          width: 120px;
          height: 75px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: linear-gradient(
            135deg,
            rgba(99,102,241,0.3),
            rgba(139,92,246,0.3)
          );
          backdrop-filter: blur(10px);
          border: 2px solid rgba(255,255,255,0.2);
          box-shadow:
            0 8px 25px rgba(99,102,241,0.3),
            0 0 15px rgba(99,102,241,0.2);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .usage-report-logo:hover {
          transform: scale(1.05);
        }

        .usage-report-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .usage-report-main {
          padding: 0 32px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .usage-report-topbar {
          padding: 24px 0 18px;
        }

        .usage-report-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 30px;
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
        }

        .usage-report-title {
          margin: 0 0 24px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
          position: relative;
          padding-left: 16px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
          padding-bottom: 16px;
        }

        .usage-report-title::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 24px;
          background: linear-gradient(180deg, #818cf8, #6366f1);
          border-radius: 2px;
        }

        .usage-filters {
          margin-bottom: 24px;
        }

        .usage-filter-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }

        .field input {
          width: 100%;
          padding: 13px 15px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 12px;
          color: #ffffff;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
        }

        .field input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        .field input:focus {
          border-color: #818cf8;
          background: rgba(255,255,255,0.09);
          box-shadow: 0 0 0 4px rgba(99,102,241,0.12);
        }

        input[type="date"] {
          color-scheme: dark;
        }

        .usage-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
        }

        .usage-table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
        }

        .usage-table th,
        .usage-table td {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          text-align: left;
          font-size: 14px;
        }

        .usage-table th {
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.65);
          font-size: 12px;
          font-weight: 600;
        }

        .usage-table td {
          color: rgba(255,255,255,0.9);
        }

        .usage-table tbody tr {
          transition: background 0.2s ease;
        }

        .usage-table tbody tr:hover {
          background: rgba(255,255,255,0.04);
        }

        .usage-table tbody tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 11px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-success {
          background: rgba(16,185,129,0.12);
          color: #34d399;
          border: 1px solid rgba(16,185,129,0.25);
        }

        .status-error {
          background: rgba(239,68,68,0.12);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }

        .empty-usage {
          text-align: center;
          color: rgba(255,255,255,0.6);
          padding: 30px 20px;
        }

        .usage-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 20px;
        }

        .usage-summary-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 16px;
        }

        .usage-summary-label {
          font-size: 12px;
          color: rgba(255,255,255,0.6);
        }

        .usage-summary-value {
          margin-top: 7px;
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
        }

        .usage-report-toast {
          position: fixed;
          right: 32px;
          bottom: 32px;
          background: rgba(15,15,35,0.96);
          backdrop-filter: blur(20px);
          color: #ffffff;
          padding: 16px 24px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.35);
          z-index: 9999;
          max-width: 400px;
        }

        @media (max-width: 1100px) {
          .usage-report-navbar {
            flex-direction: column !important;
          }

          .usage-report-navbar-menu,
          .usage-report-navbar-user {
            justify-content: center;
          }

          .usage-filter-grid {
            grid-template-columns: 1fr;
          }

          .usage-summary {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .usage-report-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .usage-report-navbar-menu .nav-link {
            width: 100%;
            text-align: center;
          }

          .usage-report-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .usage-report-logo {
            width: 100px;
            height: 60px;
          }

          .usage-report-main {
            padding: 0 16px 30px;
          }

          .usage-report-card {
            padding: 24px;
          }

          .usage-actions {
            flex-direction: column;
          }

          .usage-actions .btn {
            width: 100%;
          }

          .usage-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav className="usage-report-navbar">
        {/* LOGO */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div className="usage-report-logo">
            <img src="/LOGO.jpg" alt="OCR Logo" />
          </div>
        </div>

        {/* NAV MENU */}
        <div className="usage-report-navbar-menu nav-menu">
          <Link to="/admin-dashboard" className="nav-link">
            Admin Dashboard
          </Link>

          <Link to="/user-report" className="nav-link">
            User Report
          </Link>

          <Link to="/usage-report" className="nav-link Active">
            Usage Report
          </Link>
        </div>

        {/* USER AREA */}
        <div
          className="usage-report-navbar-user"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div className="user-chip">
            สถานะระบบ: <strong style={{ color: "#34d399" }}>Online</strong>
          </div>

          <div className="user-chip">
            บทบาท:{" "}
            <strong style={{ color: "#818cf8" }}>
              {formatRole(session?.role)}
            </strong>
          </div>

          <div className="user-chip">
            ผู้ใช้งาน:{" "}
            <strong>
              {session?.display_name ||
                session?.name ||
                session?.email ||
                "Administrator"}
            </strong>
          </div>

          <button
            className="btn btn-outline"
            onClick={handleLogout}
            disabled={loadingAction === "logout"}
          >
            {loadingAction === "logout" ? "กำลังออก..." : "ออกจากระบบ"}
          </button>
        </div>
      </nav>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="usage-report-main">
        <div className="usage-report-topbar"></div>

        <section>
          <div className="usage-report-card">
            <h3 className="usage-report-title">รายงานประวัติการใช้งานระบบ</h3>

            {/* =================================================
                SUMMARY
            ================================================== */}

            <div className="usage-summary">
              <div className="usage-summary-card">
                <div className="usage-summary-label">ข้อมูลทั้งหมด</div>
                <div className="usage-summary-value">{allUsageData.length}</div>
              </div>

              <div className="usage-summary-card">
                <div className="usage-summary-label">ผลการค้นหา</div>
                <div className="usage-summary-value">{filteredData.length}</div>
              </div>

              <div className="usage-summary-card">
                <div className="usage-summary-label">OCR</div>
                <div className="usage-summary-value">
                  {
                    filteredData.filter(
                      (item) => String(item.type).toLowerCase() === "ocr",
                    ).length
                  }
                </div>
              </div>

              <div className="usage-summary-card">
                <div className="usage-summary-label">Translation</div>
                <div className="usage-summary-value">
                  {
                    filteredData.filter(
                      (item) =>
                        String(item.type).toLowerCase() === "translate" ||
                        String(item.type).toLowerCase() === "translation",
                    ).length
                  }
                </div>
              </div>
            </div>

            {/* =================================================
                FILTER
            ================================================== */}

            <div className="usage-filters">
              <div className="usage-filter-grid">
                <div className="field">
                  <label>ค้นหาผู้ใช้งาน</label>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้งาน อีเมล หรือ User ID..."
                  />
                </div>

                <div className="field">
                  <label>วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="usage-actions">
                <button className="btn btn-primary" onClick={handleSearch}>
                  ค้นหา
                </button>

                <button className="btn btn-secondary" onClick={handleClear}>
                  ล้างค่า
                </button>

                <button
                  className="btn btn-success"
                  onClick={handleExport}
                  disabled={filteredData.length === 0}
                >
                  ส่งออกรายงาน
                </button>
              </div>
            </div>

            {/* =================================================
                TABLE
            ================================================== */}

            <div className="table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>วันที่/เวลา</th>
                    <th>User ID</th>
                    <th>ผู้ใช้งาน</th>
                    <th>ประเภท</th>
                    <th>รายละเอียด</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => {
                      const userId = getUserId(item);

                      return (
                        <tr key={item.history_id ?? index}>
                          <td>{formatDateTime(item.datetime)}</td>

                          <td>
                            <strong style={{ color: "#a5b4fc" }}>
                              {userId ?? "-"}
                            </strong>
                          </td>

                          <td>
                            <div style={{ fontWeight: "600" }}>
                              {item.userName}
                            </div>

                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "12px",
                                color: "rgba(255,255,255,0.55)",
                              }}
                            >
                              {item.userEmail}
                            </div>
                          </td>

                          <td>{getTypeText(item.type)}</td>
                          <td>{item.detail}</td>

                          <td>
                            <span
                              className={`status-badge ${getStatusClass(
                                item.status,
                              )}`}
                            >
                              {getStatusText(item.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <div className="empty-usage">
                          {allUsageData.length === 0
                            ? "ยังไม่มีประวัติการใช้งานในระบบ"
                            : "ไม่พบข้อมูลที่ตรงกับเงื่อนไข"}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && <div className="usage-report-toast">{toast.message}</div>}
    </div>
  );
};

export default UsageReportPage;
