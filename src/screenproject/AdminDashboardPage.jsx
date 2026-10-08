// AdminDashboardPage.jsx

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

const AdminDashboardPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // SYSTEM
  // =========================================================

  const [systemStatus, setSystemStatus] = useState("Online");

  // =========================================================
  // ADMIN STATS
  // =========================================================

  const [stats, setStats] = useState({
    totalUsers: 0,
    onlineUsers: 0,
    todayUsage: 0,
    totalOcr: 0,
    totalTranslations: 0,
    totalFiles: 0,
    totalFileBytes: 0,
  });

  // =========================================================
  // STORAGE
  // =========================================================

  const [storage, setStorage] = useState({
    userDataSize: 0,
    filesDataSize: 0,
    ocrDataSize: 0,
    translationDataSize: 0,
    historyDataSize: 0,
    totalDataSize: 0,
  });

  // =========================================================
  // USAGE
  // =========================================================

  const [usage, setUsage] = useState({
    ocr: 0,
    translate: 0,
    copy: 0,
    total: 0,
  });

  // =========================================================
  // PASSWORD
  // =========================================================

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [changingPassword, setChangingPassword] = useState(false);

  // =========================================================
  // ACTION STATE
  // =========================================================

  const [loadingAction, setLoadingAction] = useState("");

  // =========================================================
  // TOAST
  // =========================================================

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // =========================================================
  // TOAST
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
    return localStorage.getItem("userToken");
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

    const headers = {
      ...(options.body instanceof FormData
        ? {}
        : {
            "Content-Type": "application/json",
          }),
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data = null;

    try {
      data = await response.json();
    } catch (_) {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
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

        navigate("/admin-login", {
          replace: true,
        });

        return null;
      }

      const adminSession = {
        ...user,
        name: user.display_name || user.name || "Administrator",
      };

      setSession(adminSession);

      // เก็บไว้เพื่อรองรับส่วนอื่นของโปรเจกต์ที่ยังใช้ session เดิม
      localStorage.setItem("ocrthai_session", JSON.stringify(adminSession));

      return adminSession;
    } catch (error) {
      console.error("CHECK ADMIN SESSION ERROR:", error);

      clearAuth();

      navigate("/admin-login", {
        replace: true,
      });

      return null;
    }
  }, [navigate]);

  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  const loadAdminDashboardData = useCallback(async () => {
    try {
      const result = await apiRequest("/admin/dashboard");

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถโหลด Dashboard Admin ได้");
      }

      // =====================================================
      // STATS
      // =====================================================

      const totalOcr = Number(result.stats?.totalOcr || 0);
      const totalTranslations = Number(result.stats?.totalTranslations || 0);

      setStats({
        totalUsers: Number(result.stats?.totalUsers || 0),

        onlineUsers: Number(result.stats?.onlineUsers || 0),

        todayUsage: Number(result.stats?.todayUsage || 0),

        totalOcr,

        totalTranslations,

        totalFiles: Number(result.stats?.totalFiles || 0),

        totalFileBytes: Number(result.stats?.totalFileBytes || 0),
      });

      // =====================================================
      // STORAGE
      // =====================================================

      setStorage({
        userDataSize: Number(result.storage?.userDataSize || 0),

        filesDataSize: Number(result.storage?.filesDataSize || 0),

        ocrDataSize: Number(result.storage?.ocrDataSize || 0),

        translationDataSize: Number(result.storage?.translationDataSize || 0),

        historyDataSize: Number(result.storage?.historyDataSize || 0),

        totalDataSize: Number(result.storage?.totalDataSize || 0),
      });

      // =====================================================
      // SYSTEM STATUS
      // =====================================================

      setSystemStatus(
        result.systemStatus === "Maintenance" ? "Maintenance" : "Online",
      );

      // =====================================================
      // USAGE
      //
      // Backend ตอนนี้คืนจำนวน OCR + Translation
      // แต่ยังไม่มีจำนวน Copy/Download โดยตรง
      // =====================================================

      const maxUsage = Math.max(totalOcr, totalTranslations, 1);

      const totalUsage = totalOcr + totalTranslations;

      setUsage({
        ocr: Math.min(100, Math.round((totalOcr / maxUsage) * 100)),

        translate: Math.min(
          100,
          Math.round((totalTranslations / maxUsage) * 100),
        ),

        copy: 0,

        total: totalUsage > 0 ? 100 : 0,
      });
    } catch (error) {
      console.error("LOAD ADMIN DASHBOARD ERROR:", error);

      if (
        error.status === 401 ||
        error.status === 403 ||
        error.message === "NO_TOKEN"
      ) {
        clearAuth();

        navigate("/admin-login", {
          replace: true,
        });

        return;
      }

      showToast(error.message || "ไม่สามารถโหลด Dashboard ได้", "error");
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

        await loadAdminDashboardData();
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
  }, [checkAdminSession, loadAdminDashboardData]);

  // =========================================================
  // REFRESH WHEN WINDOW FOCUS
  // =========================================================

  useEffect(() => {
    const handleFocus = async () => {
      const token = getToken();

      if (!token) {
        navigate("/admin-login", {
          replace: true,
        });

        return;
      }

      const admin = await checkAdminSession();

      if (admin) {
        await loadAdminDashboardData();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkAdminSession, loadAdminDashboardData, navigate]);

  // =========================================================
  // MAINTENANCE
  // =========================================================

  const handleMaintenance = async () => {
    try {
      setLoadingAction("maintenance");

      const result = await apiRequest("/admin/system-status", {
        method: "PUT",
        body: JSON.stringify({
          status: "Maintenance",
        }),
      });

      setSystemStatus(result.systemStatus || "Maintenance");

      showToast(result.message || "เปิดโหมด Maintenance แล้ว", "success");
    } catch (error) {
      console.error("MAINTENANCE ERROR:", error);

      showToast(error.message || "ไม่สามารถเปลี่ยนสถานะระบบได้", "error");
    } finally {
      setLoadingAction("");
    }
  };

  // =========================================================
  // ONLINE
  // =========================================================

  const handleOnline = async () => {
    try {
      setLoadingAction("online");

      const result = await apiRequest("/admin/system-status", {
        method: "PUT",
        body: JSON.stringify({
          status: "Online",
        }),
      });

      setSystemStatus(result.systemStatus || "Online");

      showToast(result.message || "ระบบกลับสู่สถานะ Online แล้ว", "success");
    } catch (error) {
      console.error("ONLINE ERROR:", error);

      showToast(error.message || "ไม่สามารถเปลี่ยนสถานะระบบได้", "error");
    } finally {
      setLoadingAction("");
    }
  };

  // =========================================================
  // CLEAR HISTORY
  // =========================================================

  const handleClearHistory = async () => {
    const confirmed = window.confirm(
      "ต้องการล้างประวัติการใช้งานทั้งหมดจากฐานข้อมูลหรือไม่?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้",
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoadingAction("clearHistory");

      const result = await apiRequest("/history/all", {
        method: "DELETE",
      });

      showToast(
        result.message || "ล้างประวัติการใช้งานเรียบร้อยแล้ว",
        "success",
      );

      await loadAdminDashboardData();
    } catch (error) {
      console.error("CLEAR HISTORY ERROR:", error);

      showToast(error.message || "ไม่สามารถล้างประวัติได้", "error");
    } finally {
      setLoadingAction("");
    }
  };

  // =========================================================
  // EXPORT DATA
  // =========================================================

  const handleExportData = async () => {
    try {
      setLoadingAction("export");

      const result = await apiRequest("/admin/export");

      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: "application/json;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      link.download = `ocrthai_plus_backup_${Date.now()}.json`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      showToast("สำรองข้อมูลจากฐานข้อมูลเรียบร้อยแล้ว", "success");
    } catch (error) {
      console.error("EXPORT DATA ERROR:", error);

      showToast(error.message || "ไม่สามารถสำรองข้อมูลได้", "error");
    } finally {
      setLoadingAction("");
    }
  };

  // =========================================================
  // PASSWORD INPUT
  // =========================================================

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;

    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setPasswordErrors((prev) => ({
      ...prev,
      [name]: "",
    }));
  };

  // =========================================================
  // CHANGE ADMIN PASSWORD
  // =========================================================

  const handleChangeAdminPassword = async () => {
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    let hasError = false;

    // CURRENT PASSWORD

    if (!passwordForm.currentPassword) {
      errors.currentPassword = "กรุณากรอกรหัสผ่านปัจจุบัน";

      hasError = true;
    }

    // NEW PASSWORD

    if (!passwordForm.newPassword) {
      errors.newPassword = "กรุณากรอกรหัสผ่านใหม่";

      hasError = true;
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร";

      hasError = true;
    }

    // CONFIRM PASSWORD

    if (!passwordForm.confirmPassword) {
      errors.confirmPassword = "กรุณายืนยันรหัสผ่านใหม่";

      hasError = true;
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = "รหัสผ่านใหม่ไม่ตรงกัน";

      hasError = true;
    }

    if (hasError) {
      setPasswordErrors(errors);
      return;
    }

    try {
      setChangingPassword(true);

      const result = await apiRequest("/admin/password", {
        method: "PUT",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,

          newPassword: passwordForm.newPassword,
        }),
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordErrors({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      showToast(
        result.message || "เปลี่ยนรหัสผ่านผู้ดูแลระบบสำเร็จ",
        "success",
      );
    } catch (error) {
      console.error("CHANGE PASSWORD ERROR:", error);

      const message =
        error?.data?.message || error?.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้";

      if (error.status === 400) {
        setPasswordErrors({
          currentPassword: message.includes("ปัจจุบัน") ? message : "",

          newPassword: message.includes("อย่างน้อย") ? message : "",

          confirmPassword: "",
        });
      } else {
        showToast(message, "error");
      }
    } finally {
      setChangingPassword(false);
    }
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
        navigate("/admin-login", {
          replace: true,
        });
      }, 500);
    }
  };

  // =========================================================
  // FORMAT BYTES
  // =========================================================

  const formatBytes = (bytes) => {
    const value = Number(bytes || 0);

    if (value <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];

    const index = Math.floor(Math.log(value) / Math.log(1024));

    const safeIndex = Math.min(index, units.length - 1);

    return `${(value / Math.pow(1024, safeIndex)).toFixed(
      safeIndex === 0 ? 0 : 2,
    )} ${units[safeIndex]}`;
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
            ⏳
          </div>

          <div
            style={{
              fontSize: "17px",
              fontWeight: "600",
            }}
          >
            กำลังโหลด Admin Dashboard...
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
          background:
            linear-gradient(
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

        .btn-success:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #34d399 0%,
              #10b981 100%
            );
        }

        .btn-warning {
          background:
            linear-gradient(
              135deg,
              #f59e0b 0%,
              #d97706 100%
            );
          color: #ffffff;
          box-shadow:
            0 8px 16px -4px
            rgba(245,158,11,0.35);
        }

        .btn-warning:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #fbbf24 0%,
              #f59e0b 100%
            );
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

        .admin-dashboard-navbar {
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

        .admin-dashboard-logo {
          width: 120px;
          height: 75px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background:
            linear-gradient(
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

        .admin-dashboard-logo:hover {
          transform: scale(1.05);
        }

        .admin-dashboard-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .admin-main {
          padding: 0 32px 40px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .admin-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 0 18px;
        }

        .admin-hero {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 32px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
          position: relative;
          overflow: hidden;
        }

        .admin-hero h2 {
          margin: 0 0 12px;
          font-size: 30px;
          font-weight: 700;
          color: #ffffff;
        }

        .admin-hero p {
          margin: 0;
          color: rgba(255,255,255,0.8);
          font-size: 15px;
          line-height: 1.7;
          max-width: 900px;
        }

        .admin-grid {
          display: grid;
          gap: 18px;
          margin-top: 18px;
        }

        .admin-grid.cols-4 {
          grid-template-columns: repeat(4, 1fr);
        }

        .admin-grid.cols-2 {
          grid-template-columns: repeat(2, 1fr);
        }

        .admin-grid.cols-1 {
          grid-template-columns: 1fr;
        }

        .admin-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 30px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
          transition: all 0.3s ease;
        }

        .admin-card:hover {
          transform: translateY(-3px);
          border-color: rgba(255,255,255,0.2);
        }

        .admin-section-title {
          margin: 0 0 20px;
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          position: relative;
          padding-left: 16px;
        }

        .admin-section-title::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 4px;
          height: 24px;
          background:
            linear-gradient(
              180deg,
              #818cf8,
              #6366f1
            );
          border-radius: 2px;
        }

        .admin-muted {
          color: rgba(255,255,255,0.65);
          font-size: 14px;
        }

        .admin-stat-number {
          font-size: 42px;
          font-weight: 800;
          margin-top: 10px;
          background:
            linear-gradient(
              135deg,
              #818cf8,
              #6366f1
            );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .admin-stat-status {
          font-size: 24px;
          margin-top: 10px;
          font-weight: 700;
        }

        .status-online {
          color: #34d399;
        }

        .status-maintenance {
          color: #fbbf24;
        }

        .admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .storage-info {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        .storage-stat {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 16px;
        }

        .storage-stat .stat-label {
          color: rgba(255,255,255,0.65);
          font-size: 12px;
        }

        .storage-stat .stat-value {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 700;
          color: #ffffff;
        }

        .admin-form-row {
          display: grid;
          grid-template-columns:
            1fr 1fr 1fr auto;
          gap: 12px;
          align-items: end;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }

        .form-group input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 12px;
          color: #ffffff;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition: all 0.3s ease;
        }

        .form-group input:focus {
          border-color: #818cf8;
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .form-group input.error-input {
          border-color: #ef4444;
        }

        .form-error {
          min-height: 16px;
          color: #f87171;
          font-size: 11px;
        }

        .usage-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          align-items: center;
        }

        .stat-circle {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .circle-progress {
          width: 140px;
          height: 140px;
          border-radius: 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
          background:
            conic-gradient(
              #6366f1
              calc(var(--progress) * 1%),
              rgba(255,255,255,0.08) 0
            );
          box-shadow:
            0 12px 30px rgba(0,0,0,0.2);
        }

        .circle-progress::before {
          content: "";
          position: absolute;
          inset: 10px;
          background: #17182b;
          border-radius: 50%;
        }

        .progress-text {
          position: relative;
          z-index: 2;
          font-size: 24px;
          font-weight: 800;
          color: #ffffff;
        }

        .progress-label {
          position: relative;
          z-index: 2;
          font-size: 12px;
          color: rgba(255,255,255,0.65);
          margin-top: 3px;
          text-align: center;
        }

        .admin-dashboard-toast {
          position: fixed;
          right: 32px;
          bottom: 32px;
          background: rgba(15,15,35,0.96);
          backdrop-filter: blur(20px);
          color: #ffffff;
          padding: 16px 24px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.35);
          z-index: 9999;
          max-width: 400px;
          animation: toastIn 0.3s ease;
        }

        @keyframes toastIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1100px) {
          .admin-dashboard-navbar {
            flex-direction: column !important;
          }

          .admin-dashboard-navbar-menu,
          .admin-dashboard-navbar-user {
            justify-content: center;
          }

          .admin-grid.cols-4 {
            grid-template-columns: repeat(2, 1fr);
          }

          .usage-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .admin-form-row {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 768px) {
          .admin-dashboard-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .admin-dashboard-navbar-menu .nav-link {
            width: 100%;
            text-align: center;
          }

          .admin-dashboard-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .admin-main {
            padding: 0 16px 30px;
          }

          .admin-grid.cols-4,
          .admin-grid.cols-2 {
            grid-template-columns: 1fr;
          }

          .storage-info {
            grid-template-columns: 1fr;
          }

          .admin-form-row {
            grid-template-columns: 1fr;
          }

          .usage-stats {
            grid-template-columns: 1fr 1fr;
          }

          .admin-hero {
            padding: 25px;
          }

          .admin-hero h2 {
            font-size: 26px;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav className="admin-dashboard-navbar">
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="admin-dashboard-logo">
            <img src="/LOGO.jpg" alt="OCR Logo" />
          </div>
        </div>

        <div className="admin-dashboard-navbar-menu nav-menu">
          <Link to="/admin-dashboard" className="nav-link Active">
            Admin Dashboard
          </Link>

          <Link to="/user-report" className="nav-link">
            User Report
          </Link>

          <Link to="/usage-report" className="nav-link">
            Usage Report
          </Link>
        </div>

        <div
          className="admin-dashboard-navbar-user"
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
              className={
                systemStatus === "Online"
                  ? "status-online"
                  : "status-maintenance"
              }
            >
              {systemStatus}
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
            {loadingAction === "logout" ? "กำลังออกจากระบบ..." : "ออกจากระบบ"}
          </button>
        </div>
      </nav>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="admin-main">
        <div className="admin-topbar"></div>

        {/* HERO */}

        <section className="admin-hero">
          <h2>Admin Dashboard</h2>

          <p>
            หน้าจัดการสำหรับตรวจสอบภาพรวมการใช้งานระบบ ดูจำนวนผู้ใช้งาน
            สถิติการใช้งาน และติดตามสถานะการทำงานของระบบ
          </p>
        </section>

        {/* =====================================================
            STATS
        ====================================================== */}

        <section className="admin-grid cols-4">
          <div className="admin-card">
            <div className="admin-muted">ผู้ใช้งานทั้งหมด</div>

            <div className="admin-stat-number">{stats.totalUsers}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">ผู้ใช้งานออนไลน์</div>

            <div className="admin-stat-number">{stats.onlineUsers}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">การใช้งานวันนี้</div>

            <div className="admin-stat-number">{stats.todayUsage}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">สถานะระบบ</div>

            <div
              className={`admin-stat-status ${
                systemStatus === "Online"
                  ? "status-online"
                  : "status-maintenance"
              }`}
            >
              {systemStatus}
            </div>
          </div>
        </section>

        {/* =====================================================
            ADDITIONAL STATS
        ====================================================== */}

        <section className="admin-grid cols-4">
          <div className="admin-card">
            <div className="admin-muted">จำนวน OCR</div>

            <div className="admin-stat-number">{stats.totalOcr}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">จำนวนการแปล</div>

            <div className="admin-stat-number">{stats.totalTranslations}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">จำนวนไฟล์</div>

            <div className="admin-stat-number">{stats.totalFiles}</div>
          </div>

          <div className="admin-card">
            <div className="admin-muted">ขนาดไฟล์ทั้งหมด</div>

            <div
              style={{
                marginTop: "18px",
                fontSize: "22px",
                fontWeight: "700",
                color: "#818cf8",
              }}
            >
              {formatBytes(stats.totalFileBytes)}
            </div>
          </div>
        </section>

        {/* =====================================================
            CONTROL + STORAGE
        ====================================================== */}

        <section className="admin-grid cols-2">
          {/* SYSTEM CONTROL */}

          <div className="admin-card">
            <h3 className="admin-section-title">การควบคุมระบบ</h3>

            <div className="admin-actions">
              <button
                className="btn btn-warning"
                onClick={handleMaintenance}
                disabled={
                  systemStatus === "Maintenance" || loadingAction !== ""
                }
              >
                {loadingAction === "maintenance"
                  ? "กำลังดำเนินการ..."
                  : "เปิดโหมด Maintenance"}
              </button>

              <button
                className="btn btn-success"
                onClick={handleOnline}
                disabled={systemStatus === "Online" || loadingAction !== ""}
              >
                {loadingAction === "online"
                  ? "กำลังดำเนินการ..."
                  : "กลับสู่สถานะ Online"}
              </button>
            </div>
          </div>

          {/* STORAGE */}

          <div className="admin-card">
            <h3 className="admin-section-title">จัดการพื้นที่จัดเก็บข้อมูล</h3>

            <div className="storage-info">
              <div className="storage-stat">
                <div className="stat-label">ข้อมูลผู้ใช้งาน</div>

                <div className="stat-value">
                  {formatBytes(storage.userDataSize)}
                </div>
              </div>

              <div className="storage-stat">
                <div className="stat-label">ไฟล์</div>

                <div className="stat-value">
                  {formatBytes(storage.filesDataSize)}
                </div>
              </div>

              <div className="storage-stat">
                <div className="stat-label">OCR</div>

                <div className="stat-value">
                  {formatBytes(storage.ocrDataSize)}
                </div>
              </div>

              <div className="storage-stat">
                <div className="stat-label">Translation</div>

                <div className="stat-value">
                  {formatBytes(storage.translationDataSize)}
                </div>
              </div>

              <div className="storage-stat">
                <div className="stat-label">ประวัติการใช้งาน</div>

                <div className="stat-value">
                  {formatBytes(storage.historyDataSize)}
                </div>
              </div>

              <div className="storage-stat">
                <div className="stat-label">พื้นที่ทั้งหมด</div>

                <div className="stat-value">
                  {formatBytes(storage.totalDataSize)}
                </div>
              </div>
            </div>

            <div
              className="admin-actions"
              style={{
                marginTop: "16px",
              }}
            >
              <button
                className="btn btn-outline"
                onClick={handleClearHistory}
                disabled={loadingAction !== ""}
              >
                {loadingAction === "clearHistory"
                  ? "กำลังล้าง..."
                  : "ล้างประวัติการใช้งาน"}
              </button>

              <button
                className="btn btn-outline"
                onClick={handleExportData}
                disabled={loadingAction !== ""}
              >
                {loadingAction === "export" ? "กำลังสำรอง..." : "สำรองข้อมูล"}
              </button>
            </div>
          </div>
        </section>

        {/* =====================================================
            PASSWORD
        ====================================================== */}

        <section className="admin-grid cols-1">
          <div className="admin-card">
            <h3 className="admin-section-title">จัดการรหัสผ่านผู้ดูแลระบบ</h3>

            <div className="admin-form-row">
              <div className="form-group">
                <label>รหัสผ่านปัจจุบัน</label>

                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="กรอกรหัสผ่านปัจจุบัน"
                  className={
                    passwordErrors.currentPassword ? "error-input" : ""
                  }
                />

                <span className="form-error">
                  {passwordErrors.currentPassword}
                </span>
              </div>

              <div className="form-group">
                <label>รหัสผ่านใหม่</label>

                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="กรอกรหัสผ่านใหม่"
                  className={passwordErrors.newPassword ? "error-input" : ""}
                />

                <span className="form-error">{passwordErrors.newPassword}</span>
              </div>

              <div className="form-group">
                <label>ยืนยันรหัสผ่านใหม่</label>

                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  className={
                    passwordErrors.confirmPassword ? "error-input" : ""
                  }
                />

                <span className="form-error">
                  {passwordErrors.confirmPassword}
                </span>
              </div>

              <div className="admin-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleChangeAdminPassword}
                  disabled={changingPassword}
                >
                  {changingPassword ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================
            USAGE
        ====================================================== */}

        <section className="admin-grid cols-1">
          <div className="admin-card">
            <h3 className="admin-section-title">สถิติการใช้งานระบบ</h3>

            <div className="usage-stats">
              <div className="stat-circle">
                <div
                  className="circle-progress"
                  style={{
                    "--progress": usage.ocr,
                  }}
                >
                  <div className="progress-text">{usage.ocr}%</div>

                  <div className="progress-label">OCR</div>
                </div>
              </div>

              <div className="stat-circle">
                <div
                  className="circle-progress"
                  style={{
                    "--progress": usage.translate,
                  }}
                >
                  <div className="progress-text">{usage.translate}%</div>

                  <div className="progress-label">Translate</div>
                </div>
              </div>

              <div className="stat-circle">
                <div
                  className="circle-progress"
                  style={{
                    "--progress": usage.copy,
                  }}
                >
                  <div className="progress-text">{usage.copy}%</div>

                  <div className="progress-label">Copy/Download</div>
                </div>
              </div>

              <div className="stat-circle">
                <div
                  className="circle-progress"
                  style={{
                    "--progress": usage.total,
                  }}
                >
                  <div className="progress-text">{usage.total}%</div>

                  <div className="progress-label">Total Usage</div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && (
        <div className="admin-dashboard-toast">{toast.message}</div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
