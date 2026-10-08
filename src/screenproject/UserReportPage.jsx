// UserReportPage.jsx

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

const UserReportPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================================================
  // USERS
  // =========================================================

  const [users, setUsers] = useState([]);

  // =========================================================
  // SEARCH
  // =========================================================

  const [searchTerm, setSearchTerm] = useState("");

  // =========================================================
  // ACTION STATE
  // =========================================================

  const [actionUserId, setActionUserId] = useState(null);

  // =========================================================
  // TOAST
  // =========================================================

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

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
  // NORMALIZE USER
  // =========================================================

  const normalizeUser = (user, index = 0) => {
    const userId = user.user_id ?? user.id ?? index + 1;

    const name =
      user.display_name ??
      user.name ??
      user.displayName ??
      user.username ??
      "-";

    const email = user.email ?? "-";

    const backendStatus = String(user.status ?? "Offline")
      .trim()
      .toLowerCase();

    let normalizedStatus = "Offline";

    if (
      backendStatus === "active" ||
      backendStatus === "online" ||
      backendStatus === "ใช้งาน" ||
      backendStatus === "ออนไลน์"
    ) {
      normalizedStatus = "Active";
    } else if (
      backendStatus === "suspended" ||
      backendStatus === "ระงับ" ||
      backendStatus === "ระงับการใช้งาน"
    ) {
      normalizedStatus = "Suspended";
    } else {
      normalizedStatus = "Offline";
    }

    return {
      ...user,

      id: userId,

      user_id: userId,

      name,

      display_name: name,

      email,

      status: normalizedStatus,

      online: Boolean(user.online),
    };
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

      localStorage.setItem("ocrthai_session", JSON.stringify(adminSession));

      return adminSession;
    } catch (error) {
      console.error("CHECK USER REPORT SESSION ERROR:", error);

      clearAuth();

      navigate("/admin-login", {
        replace: true,
      });

      return null;
    }
  }, [navigate]);

  // =========================================================
  // LOAD USERS
  // =========================================================

  const loadUsers = useCallback(async () => {
    try {
      const result = await apiRequest("/admin/users");

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถโหลดรายชื่อผู้ใช้ได้");
      }

      const rows = Array.isArray(result.data) ? result.data : [];

      const normalizedUsers = rows
        .map((user, index) => normalizeUser(user, index))
        // ไม่แสดง Admin ใน User Report
        .filter((user) => user.role !== "admin");

      setUsers(normalizedUsers);
    } catch (error) {
      console.error("LOAD USERS ERROR:", error);

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

      showToast(error.message || "ไม่สามารถโหลดรายชื่อผู้ใช้ได้", "error");
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

        await loadUsers();
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
  }, [checkAdminSession, loadUsers]);

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
        await loadUsers();
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [checkAdminSession, loadUsers, navigate]);

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
  // FILTER USERS
  // =========================================================

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) {
      return users;
    }

    return users.filter((user) => {
      const text = `
            ${user.id}
            ${user.name}
            ${user.email}
            ${user.status}
          `.toLowerCase();

      return text.includes(keyword);
    });
  }, [users, searchTerm]);

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
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

      window.setTimeout(() => {
        navigate("/admin-login", {
          replace: true,
        });
      }, 500);
    }
  };

  // =========================================================
  // USER STATUS CLASS
  // =========================================================

  const getStatusClass = (status) => {
    if (status === "Active") {
      return "status-online";
    }

    if (status === "Suspended") {
      return "status-suspended";
    }

    return "status-offline";
  };

  // =========================================================
  // USER STATUS TEXT
  // =========================================================

  const getStatusText = (status) => {
    if (status === "Active") {
      return "เปิดใช้งาน";
    }

    if (status === "Suspended") {
      return "ระงับการใช้งาน";
    }

    return "Offline";
  };

  // =========================================================
  // UPDATE USER STATUS
  // =========================================================

  const handleUpdateUserStatus = async (userId, nextStatus) => {
    const targetUser = users.find((user) => String(user.id) === String(userId));

    if (!targetUser) {
      return;
    }

    if (targetUser.status === nextStatus) {
      return;
    }

    const isSuspending = nextStatus === "Suspended";

    const confirmed = window.confirm(
      isSuspending
        ? `ต้องการระงับการใช้งานของ ${targetUser.name} หรือไม่?`
        : `ต้องการเปิดใช้งาน ${targetUser.name} หรือไม่?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionUserId(userId);

      const result = await apiRequest(
        `/admin/users/${encodeURIComponent(userId)}/status`,
        {
          method: "PATCH",

          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      showToast(
        result.message ||
          (isSuspending
            ? "ระงับการใช้งานผู้ใช้เรียบร้อยแล้ว"
            : "เปิดใช้งานผู้ใช้เรียบร้อยแล้ว"),
        "success",
      );

      await loadUsers();
    } catch (error) {
      console.error("UPDATE USER STATUS ERROR:", error);

      if (error.status === 401 || error.status === 403) {
        clearAuth();

        navigate("/admin-login", {
          replace: true,
        });

        return;
      }

      showToast(error.message || "ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้", "error");
    } finally {
      setActionUserId(null);
    }
  };

  // =========================================================
  // SUSPEND USER
  // =========================================================

  const handleSuspendUser = (userId) =>
    handleUpdateUserStatus(userId, "Suspended");

  // =========================================================
  // ACTIVATE USER
  // =========================================================

  const handleActivateUser = (userId) =>
    handleUpdateUserStatus(userId, "Active");

  // =========================================================
  // DELETE USER
  // =========================================================

  const handleDeleteUser = async (userId) => {
    // =====================================================
    // PROTECT ADMIN SELF
    // =====================================================

    if (
      session &&
      String(userId) === String(session.user_id ?? session.id ?? "")
    ) {
      showToast("ไม่สามารถลบบัญชีผู้ดูแลระบบที่กำลังเข้าสู่ระบบได้", "error");

      return;
    }

    const targetUser = users.find((user) => String(user.id) === String(userId));

    if (!targetUser) {
      return;
    }

    const confirmed = window.confirm(
      `ต้องการลบผู้ใช้งาน ${targetUser.name} หรือไม่?\n\nข้อมูลไฟล์ OCR ประวัติ และข้อมูลการแปลของผู้ใช้นี้จะถูกลบจากฐานข้อมูลด้วย`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setActionUserId(userId);

      const result = await apiRequest(
        `/admin/users/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );

      showToast(result.message || "ลบผู้ใช้งานเรียบร้อยแล้ว", "success");

      await loadUsers();
    } catch (error) {
      console.error("DELETE USER ERROR:", error);

      if (error.status === 401 || error.status === 403) {
        clearAuth();

        navigate("/admin-login", {
          replace: true,
        });

        return;
      }

      showToast(error.message || "ไม่สามารถลบผู้ใช้งานได้", "error");
    } finally {
      setActionUserId(null);
    }
  };

  // =========================================================
  // RENDER USER ACTIONS
  // =========================================================

  const renderUserActions = (user) => {
    const isSuspended = user.status === "Suspended";

    const isLoading = String(actionUserId) === String(user.id);

    return (
      <div className="user-actions">
        {/* SUSPEND / ACTIVATE */}

        {isSuspended ? (
          <button
            className="btn btn-success"
            style={{
              padding: "8px 12px",
              fontSize: "12px",
            }}
            onClick={() => handleActivateUser(user.id)}
            disabled={isLoading}
          >
            {isLoading ? "กำลัง..." : "เปิดใช้งาน"}
          </button>
        ) : (
          <button
            className="btn btn-warning"
            style={{
              padding: "8px 12px",
              fontSize: "12px",
            }}
            onClick={() => handleSuspendUser(user.id)}
            disabled={isLoading}
          >
            {isLoading ? "กำลัง..." : "ระงับ"}
          </button>
        )}

        {/* DELETE */}

        <button
          className="btn btn-danger"
          style={{
            padding: "8px 12px",
            fontSize: "12px",
          }}
          onClick={() => handleDeleteUser(user.id)}
          disabled={isLoading}
        >
          {isLoading ? "กำลัง..." : "ลบ"}
        </button>
      </div>
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
            กำลังโหลดข้อมูลผู้ใช้งาน...
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

        .btn-warning {
          background:
            linear-gradient(
              135deg,
              #f59e0b,
              #d97706
            );
          color: #ffffff;
          box-shadow:
            0 8px 16px -4px
            rgba(245,158,11,0.3);
        }

        .btn-warning:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #fbbf24,
              #f59e0b
            );
        }

        .btn-success {
          background:
            linear-gradient(
              135deg,
              #10b981,
              #059669
            );
          color: #ffffff;
          box-shadow:
            0 8px 16px -4px
            rgba(16,185,129,0.3);
        }

        .btn-success:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #34d399,
              #10b981
            );
        }

        .btn-danger {
          background:
            linear-gradient(
              135deg,
              #ef4444,
              #dc2626
            );
          color: #ffffff;
          box-shadow:
            0 8px 16px -4px
            rgba(239,68,68,0.3);
        }

        .btn-danger:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #f87171,
              #ef4444
            );
        }

        .user-report-navbar {
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

        .user-report-logo {
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

        .user-report-logo:hover {
          transform: scale(1.05);
        }

        .user-report-logo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .user-report-main {
          padding: 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .user-report-card {
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 30px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
        }

        .user-report-title {
          margin: 0 0 24px;
          color: #ffffff;
          font-size: 24px;
          font-weight: 700;
          position: relative;
          padding-left: 16px;
          border-bottom:
            1px solid
            rgba(255,255,255,0.1);
          padding-bottom: 16px;
        }

        .user-report-title::before {
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

        .search-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .search-field label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
        }

        .search-field input {
          width: 100%;
          padding: 14px 16px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 12px;
          color: #ffffff;
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
        }

        .search-field input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        .search-field input:focus {
          border-color: #818cf8;
          background: rgba(255,255,255,0.09);
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .table-wrap {
          width: 100%;
          overflow-x: auto;
          border:
            1px solid
            rgba(255,255,255,0.08);
          border-radius: 16px;
        }

        .user-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }

        .user-table th,
        .user-table td {
          padding: 14px 16px;
          border-bottom:
            1px solid
            rgba(255,255,255,0.08);
          text-align: left;
          font-size: 14px;
        }

        .user-table th {
          color: rgba(255,255,255,0.65);
          font-size: 12px;
          font-weight: 600;
          background: rgba(255,255,255,0.04);
        }

        .user-table td {
          color: rgba(255,255,255,0.9);
        }

        .user-table tbody tr {
          transition: background 0.2s ease;
        }

        .user-table tbody tr:hover {
          background: rgba(255,255,255,0.04);
        }

        .user-table tbody tr:last-child td {
          border-bottom: none;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-online {
          background:
            rgba(16,185,129,0.12);
          color: #34d399;
          border:
            1px solid
            rgba(16,185,129,0.25);
        }

        .status-suspended {
          background:
            rgba(245,158,11,0.12);
          color: #fbbf24;
          border:
            1px solid
            rgba(245,158,11,0.25);
        }

        .status-offline {
          background:
            rgba(148,163,184,0.1);
          color: #94a3b8;
          border:
            1px solid
            rgba(148,163,184,0.2);
        }

        .user-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .empty-state {
          padding: 40px 20px;
          text-align: center;
          color: rgba(255,255,255,0.55);
          font-size: 14px;
        }

        .user-report-toast {
          position: fixed;
          right: 32px;
          bottom: 32px;
          background: rgba(15,15,35,0.96);
          backdrop-filter: blur(20px);
          color: #ffffff;
          padding: 16px 24px;
          border-radius: 12px;
          border:
            1px solid
            rgba(255,255,255,0.1);
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.35);
          z-index: 9999;
          max-width: 400px;
        }

        @media (max-width: 1100px) {
          .user-report-navbar {
            flex-direction: column !important;
          }

          .user-report-navbar-menu,
          .user-report-navbar-user {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .user-report-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .user-report-navbar-menu .nav-link {
            width: 100%;
            text-align: center;
          }

          .user-report-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .user-report-logo {
            width: 100px;
            height: 60px;
          }

          .user-report-main {
            padding: 20px 16px;
          }

          .user-report-card {
            padding: 24px;
          }

          .user-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav className="user-report-navbar">
        {/* LOGO */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="user-report-logo">
            <img src="/LOGO.jpg" alt="OCR Logo" />
          </div>
        </div>

        {/* NAV MENU */}

        <div className="user-report-navbar-menu nav-menu">
          <Link to="/admin-dashboard" className="nav-link">
            Admin Dashboard
          </Link>

          <Link to="/user-report" className="nav-link Active">
            User Report
          </Link>

          <Link to="/usage-report" className="nav-link">
            Usage Report
          </Link>
        </div>

        {/* USER AREA */}

        <div
          className="user-report-navbar-user"
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
              {session?.display_name ||
                session?.name ||
                session?.email ||
                "Administrator"}
            </strong>
          </div>

          <button className="btn btn-outline" onClick={handleLogout}>
            ออกจากระบบ
          </button>
        </div>
      </nav>

      <br />

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main className="user-report-main">
        <section>
          <div className="user-report-card">
            <h3 className="user-report-title">ผู้ใช้งานในระบบ</h3>

            {/* SEARCH */}

            <div className="search-field">
              <label>ค้นหาผู้ใช้งาน</label>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้งาน อีเมล หรือ User ID..."
              />
            </div>

            {/* TABLE */}

            <div className="table-wrap">
              <table className="user-table">
                <thead>
                  <tr>
                    <th>User ID</th>

                    <th>ชื่อที่แสดง</th>

                    <th>อีเมล</th>

                    <th>สถานะ</th>

                    <th>จัดการ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.id}</td>

                        <td>{user.name}</td>

                        <td>{user.email}</td>

                        <td>
                          <span
                            className={`status-badge ${getStatusClass(
                              user.status,
                            )}`}
                          >
                            <span>●</span>

                            {getStatusText(user.status)}
                          </span>
                        </td>

                        <td>{renderUserActions(user)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty-state">
                          {users.length === 0
                            ? "ยังไม่มีผู้ใช้งานในระบบ"
                            : "ไม่พบข้อมูลผู้ใช้งานที่ค้นหา"}
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

      {toast.show && <div className="user-report-toast">{toast.message}</div>}
    </div>
  );
};

export default UserReportPage;
