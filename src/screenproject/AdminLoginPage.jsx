// AdminLoginPage.jsx

import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE_URL = "http://localhost:5000/api";

const AdminLoginPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    adminEmail: "",
    adminPassword: "",
  });

  const [errors, setErrors] = useState({
    adminEmail: "",
    adminPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // =========================================================
  // LOGIN STATE
  // =========================================================

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // =========================================================
  // LOGOUT STATE
  // =========================================================

  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  const showToast = (message, type = "success") => {
    setToast({
      show: true,
      message,
      type,
    });

    setTimeout(() => {
      setToast({
        show: false,
        message: "",
        type: "success",
      });
    }, 1500);
  };

  // =========================================================
  // GET TOKEN
  // =========================================================

  const getToken = () => {
    return localStorage.getItem("userToken");
  };

  // =========================================================
  // API REQUEST
  // =========================================================

  const apiRequest = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

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
      const error = new Error(
        data?.message || `Request failed: ${response.status}`,
      );

      error.status = response.status;
      error.data = data;

      throw error;
    }

    return data;
  };

  // =========================================================
  // CHECK EXISTING ADMIN SESSION
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const checkExistingSession = async () => {
      const token = getToken();

      if (!token) {
        if (mounted) {
          setCheckingSession(false);
        }

        return;
      }

      try {
        const result = await apiRequest("/auth/me");

        if (!mounted) {
          return;
        }

        if (result?.success && result?.user && result.user.role === "admin") {
          const adminUser = result.user;

          setSession(adminUser);

          // เก็บไว้เพื่อให้หน้าอื่นที่ยังใช้ session เดิมทำงานต่อได้
          localStorage.setItem("ocrthai_session", JSON.stringify(adminUser));

          navigate("/admin-dashboard", {
            replace: true,
          });

          return;
        }

        // Token ใช้ได้แต่ไม่ใช่ Admin
        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");
        setSession(null);
      } catch (error) {
        console.warn("CHECK ADMIN SESSION ERROR:", error);

        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");
        setSession(null);
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // =========================================================
  // INPUT CHANGE
  // =========================================================

  const handleChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [id]: "",
    }));
  };

  // =========================================================
  // ADMIN LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e?.preventDefault();

    const newErrors = {
      adminEmail: "",
      adminPassword: "",
    };

    let hasError = false;

    // =====================================================
    // EMAIL
    // =====================================================

    const inputEmail = formData.adminEmail.trim().toLowerCase();

    if (!inputEmail) {
      newErrors.adminEmail = "กรุณากรอกอีเมลผู้ดูแลระบบ";

      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)) {
      newErrors.adminEmail = "รูปแบบอีเมลไม่ถูกต้อง";

      hasError = true;
    }

    // =====================================================
    // PASSWORD
    // =====================================================

    if (!formData.adminPassword) {
      newErrors.adminPassword = "กรุณากรอกรหัสผ่าน";

      hasError = true;
    }

    // =====================================================
    // SHOW VALIDATION ERROR
    // =====================================================

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoggingIn(true);

      // =====================================================
      // CALL BACKEND
      // =====================================================

      const result = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: inputEmail,
          password: formData.adminPassword,
        }),
      });

      // =====================================================
      // CHECK RESULT
      // =====================================================

      if (!result?.success || !result?.token || !result?.user) {
        throw new Error(result?.message || "ไม่สามารถเข้าสู่ระบบได้");
      }

      const user = result.user;

      // =====================================================
      // IMPORTANT:
      // LOGIN API ใช้ร่วมกับ User Login
      // ดังนั้นต้องตรวจ role ตรงนี้ว่าเป็น Admin จริง
      // =====================================================

      if (user.role !== "admin") {
        // ไม่ใช่ Admin
        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");

        setErrors({
          adminEmail: "บัญชีนี้ไม่มีสิทธิ์เข้าสู่ระบบผู้ดูแลระบบ",
          adminPassword: "",
        });

        return;
      }

      // =====================================================
      // SAVE JWT TOKEN
      // =====================================================

      localStorage.setItem("userToken", result.token);

      // =====================================================
      // SAVE SESSION
      //
      // เก็บไว้เพื่อให้หน้าอื่นที่ยังใช้
      // ocrthai_session ทำงานร่วมกันได้
      // =====================================================

      const adminSession = {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        name: user.display_name || user.name || "Administrator",
        display_name: user.display_name || user.name || "Administrator",
        status: user.status,
        privacy_status: user.privacy_status,
        online: user.online,
        last_login_at: user.last_login_at,
        last_seen_at: user.last_seen_at,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };

      localStorage.setItem("ocrthai_session", JSON.stringify(adminSession));

      // =====================================================
      // UPDATE STATE
      // =====================================================

      setSession(adminSession);

      // =====================================================
      // CLEAR FORM ERRORS
      // =====================================================

      setErrors({
        adminEmail: "",
        adminPassword: "",
      });

      // =====================================================
      // SUCCESS
      // =====================================================

      showToast("เข้าสู่ระบบผู้ดูแลระบบเรียบร้อยแล้ว", "success");

      // =====================================================
      // GO ADMIN DASHBOARD
      // =====================================================

      setTimeout(() => {
        navigate("/admin-dashboard", {
          replace: true,
        });
      }, 700);
    } catch (error) {
      console.error("ADMIN LOGIN ERROR:", error);

      // =====================================================
      // CLEAR INVALID TOKEN
      // =====================================================

      if (error.status === 401 || error.status === 403) {
        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");
      }

      // =====================================================
      // BACKEND MESSAGE
      // =====================================================

      const message =
        error?.data?.message || error?.message || "ไม่สามารถเข้าสู่ระบบได้";

      // =====================================================
      // SHOW ERROR
      // =====================================================

      setErrors({
        adminEmail: message,
        adminPassword: "",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);

      const token = getToken();

      if (token) {
        try {
          await apiRequest("/auth/logout", {
            method: "POST",
          });
        } catch (error) {
          console.warn("ADMIN LOGOUT API ERROR:", error);
        }
      }
    } finally {
      localStorage.removeItem("userToken");
      localStorage.removeItem("ocrthai_session");

      setSession(null);

      showToast("ออกจากระบบเรียบร้อยแล้ว", "success");

      setIsLoggingOut(false);

      setTimeout(() => {
        navigate("/admin-login", {
          replace: true,
        });
      }, 700);
    }
  };

  // =========================================================
  // LOADING SESSION
  // =========================================================

  if (checkingSession) {
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
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            กำลังตรวจสอบ Session...
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
            rgba(99,102,241,0.2) 0%,
            rgba(139,92,246,0.2) 100%
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
          background: linear-gradient(
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
          background: linear-gradient(
            135deg,
            #818cf8 0%,
            #6366f1 100%
          );
        }

        .btn-outline {
          background: transparent;
          color: rgba(255,255,255,0.9);
          border: 2px solid rgba(255,255,255,0.3);
        }

        .btn-outline:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
          color: #ffffff;
        }

        .admin-navbar {
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

        .admin-logo-box {
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

        .admin-logo-box:hover {
          transform: scale(1.05);
          box-shadow:
            0 10px 30px rgba(99,102,241,0.4),
            0 0 20px rgba(99,102,241,0.3);
          border-color: rgba(255,255,255,0.3);
        }

        .admin-logo-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 10px;
        }

        .admin-login-main {
          min-height: calc(100vh - 107px);
          display: grid;
          place-items: center;
          padding: 40px 32px;
        }

        .admin-login-card {
          width: min(560px, 100%);
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 48px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
          position: relative;
          overflow: hidden;
          animation: fadeInAdmin 0.25s ease;
        }

        .admin-login-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.3),
              transparent
            );
        }

        .admin-section-title {
          margin: 0 0 20px;
          font-size: 24px;
          font-weight: 700;
          color: #ffffff;
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
              #818cf8 0%,
              #6366f1 100%
            );
          border-radius: 2px;
        }

        .admin-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 14px;
          position: relative;
        }

        .admin-field label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          margin-bottom: 8px;
          display: block;
        }

        .admin-field input {
          width: 100%;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          padding: 16px 20px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          font-size: 15px;
          color: #ffffff;
          outline: none;
          transition: all 0.3s ease;
        }

        .admin-field input::placeholder {
          color: rgba(255,255,255,0.5);
        }

        .admin-field input.with-toggle {
          padding-right: 120px;
        }

        .admin-field input:focus {
          border-color: #818cf8;
          background: rgba(255,255,255,0.12);
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.2);
          transform: translateY(-1px);
        }

        .admin-field input.error-input {
          border-color: #ef4444;
        }

        .admin-error-text {
          font-size: 12px;
          color: #f87171;
          min-height: 16px;
          font-weight: 500;
          margin-top: 4px;
        }

        .admin-password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,0.8);
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .admin-password-toggle:hover {
          background: rgba(255,255,255,0.15);
          color: #ffffff;
          transform:
            translateY(-50%)
            translateY(-1px);
        }

        .admin-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 6px;
        }

        .admin-actions .btn-primary {
          width: 100%;
          padding: 14px 24px;
          font-size: 15px;
        }

        .admin-toast {
          position: fixed;
          right: 32px;
          bottom: 32px;
          background: rgba(15,15,35,0.95);
          backdrop-filter: blur(20px);
          color: #ffffff;
          padding: 16px 24px;
          border-radius: 12px;
          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 9999;
          max-width: 400px;
          font-weight: 500;
          animation: toastInAdmin 0.3s ease;
        }

        @keyframes fadeInAdmin {
          from {
            opacity: 0;
            transform: translateY(8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes toastInAdmin {
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
          .admin-navbar {
            flex-direction: column !important;
          }

          .admin-navbar-menu,
          .admin-navbar-user {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .admin-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .admin-navbar-menu .nav-link {
            width: 100%;
            text-align: center;
          }

          .admin-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .admin-logo-box {
            width: 100px;
            height: 60px;
          }

          .admin-login-main {
            padding: 20px 16px;
          }

          .admin-login-card {
            padding: 32px 24px;
          }
        }

      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav className="admin-navbar">
        {/* LOGO */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="admin-logo-box">
            <img
              src="/LOGO.jpg"
              alt="OCR Logo"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        </div>

        {/* NAV MENU */}

        <div className="admin-navbar-menu nav-menu">
          {session?.role === "admin" ? (
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

              <Link to="/history" className="nav-link">
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

              <Link to="/user-login" className="nav-link">
                User Login
              </Link>

              <Link to="/register" className="nav-link">
                Register
              </Link>

              <Link to="/admin-login" className="nav-link Active">
                Admin Login
              </Link>
            </>
          )}
        </div>

        {/* USER AREA */}

        <div
          className="admin-navbar-user"
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
              {session ? session.role : "Guest"}
            </strong>
          </div>

          <div className="user-chip">
            ผู้ใช้งาน:{" "}
            <strong>
              {session
                ? session.name || session.display_name || session.email
                : "ยังไม่ได้เข้าสู่ระบบ"}
            </strong>
          </div>

          {/* =================================================
              LOGOUT
          ================================================== */}

          {session?.role === "admin" && (
            <button
              className="btn btn-outline"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? "กำลังออก..." : "ออกจากระบบ"}
            </button>
          )}
        </div>
      </nav>

      {/* =====================================================
          ADMIN LOGIN
      ====================================================== */}

      <main className="admin-login-main">
        <div className="admin-login-card">
          <h3 className="admin-section-title">เข้าสู่ระบบผู้ดูแลระบบ</h3>

          <form onSubmit={handleLogin}>
            {/* EMAIL */}

            <div className="admin-field">
              <label htmlFor="adminEmail">อีเมลผู้ดูแลระบบ</label>

              <input
                id="adminEmail"
                type="email"
                value={formData.adminEmail}
                onChange={handleChange}
                placeholder="admin@ocrthaiplus.com"
                autoComplete="username"
                className={errors.adminEmail ? "error-input" : ""}
              />

              <div className="admin-error-text">{errors.adminEmail}</div>
            </div>

            {/* PASSWORD */}

            <div className="admin-field">
              <label htmlFor="adminPassword">รหัสผ่าน</label>

              <input
                id="adminPassword"
                className="with-toggle"
                type={showPassword ? "text" : "password"}
                value={formData.adminPassword}
                onChange={handleChange}
                placeholder="กรอกรหัสผ่าน"
                autoComplete="current-password"
              />

              <button
                className="admin-password-toggle"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "ซ่อน" : "แสดง"}
              </button>

              <div className="admin-error-text">{errors.adminPassword}</div>
            </div>

            {/* LOGIN */}

            <div className="admin-actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && <div className="admin-toast">{toast.message}</div>}
    </div>
  );
};

export default AdminLoginPage;
