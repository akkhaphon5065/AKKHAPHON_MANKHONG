// UserLoginPage.jsx

import React, { useEffect, useState } from "react";

import { useNavigate, Link } from "react-router-dom";

import { loginUser, logoutUser } from "../api/authApi";

const UserLoginPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    userLoginEmail: "",
    userLoginPassword: "",
  });

  const [errors, setErrors] = useState({
    userLoginEmail: "",
    userLoginPassword: "",
  });

  // =========================================================
  // UI STATE
  // =========================================================

  const [showPassword, setShowPassword] = useState(false);

  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  // =========================================================
  // LOAD SESSION
  // =========================================================

  useEffect(() => {
    try {
      const savedSession = JSON.parse(
        localStorage.getItem("ocrthai_session") || "null",
      );

      setSession(savedSession);

      // ถ้าเป็น User ที่ Login อยู่แล้ว
      // ให้กลับ Dashboard
      if (savedSession && savedSession.role === "user") {
        navigate("/", {
          replace: true,
        });
      }

      // ถ้าเป็น Admin
      // ไม่ควรอยู่หน้า User Login
      if (savedSession && savedSession.role === "admin") {
        navigate("/admin-dashboard", {
          replace: true,
        });
      }
    } catch (error) {
      console.error("LOAD SESSION ERROR:", error);

      setSession(null);
    }
  }, [navigate]);

  // =========================================================
  // TOAST
  // =========================================================

  const showToast = (message, type = "success") => {
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
    }, 1500);
  };

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

    setToast({
      show: false,
      message: "",
      type: "success",
    });
  };

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    const newErrors = {
      userLoginEmail: "",
      userLoginPassword: "",
    };

    let hasError = false;

    const email = formData.userLoginEmail.trim().toLowerCase();

    const password = formData.userLoginPassword;

    // =====================================================
    // EMAIL
    // =====================================================

    if (!email) {
      newErrors.userLoginEmail = "กรุณากรอกที่อยู่อีเมลของคุณ";

      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.userLoginEmail = "กรุณากรอกอีเมลให้ถูกต้อง";

      hasError = true;
    }

    // =====================================================
    // PASSWORD
    // =====================================================

    if (!password.trim()) {
      newErrors.userLoginPassword = "กรุณากรอกรหัสผ่าน";

      hasError = true;
    }

    // =====================================================
    // FRONTEND ERROR
    // =====================================================

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    // =====================================================
    // CLEAR ERROR
    // =====================================================

    setErrors({
      userLoginEmail: "",
      userLoginPassword: "",
    });

    setLoading(true);

    try {
      // ===================================================
      // REAL BACKEND LOGIN
      // ===================================================

      const result = await loginUser(email, password);

      console.log("USER LOGIN API RESULT:", result);

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถเข้าสู่ระบบได้");
      }

      // ===================================================
      // USER DATA
      // ===================================================

      const user = result.user;

      if (!user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งานจาก Server");
      }

      // ===================================================
      // PROTECT ROLE
      // ===================================================

      if (user.role === "admin") {
        showToast("บัญชีนี้เป็นผู้ดูแลระบบ", "error");

        setTimeout(() => {
          navigate("/admin-dashboard", {
            replace: true,
          });
        }, 700);

        return;
      }

      // ===================================================
      // CREATE SESSION FOR UI
      // loginUser() บันทึก JWT แล้ว
      // ===================================================

      const userSession = {
        ...user,

        user_id: user.user_id,

        id: user.user_id,

        name: user.name || user.display_name || "",

        display_name: user.display_name || user.name || "",

        email: user.email || "",

        role: user.role || "user",

        status: user.status || "Active",

        privacy_status: user.privacy_status,

        online: Boolean(user.online),

        last_login_at: user.last_login_at,

        last_seen_at: user.last_seen_at,
      };

      // ===================================================
      // SAVE SESSION
      // ===================================================

      setSession(userSession);

      localStorage.setItem("ocrthai_session", JSON.stringify(userSession));

      // ===================================================
      // SUCCESS
      // ===================================================

      showToast(result.message || "เข้าสู่ระบบเรียบร้อยแล้ว", "success");

      // ===================================================
      // GO DASHBOARD
      // ===================================================

      setTimeout(() => {
        navigate("/", {
          replace: true,
        });
      }, 700);
    } catch (error) {
      console.error("USER LOGIN ERROR:", error);

      // ===================================================
      // SERVER ERROR MESSAGE
      // ===================================================

      const message =
        error?.data?.message || error?.message || "อีเมลหรือรหัสผ่านไม่ถูกต้อง";

      // ===================================================
      // AUTH ERROR
      // ===================================================

      if (error?.status === 401 || error?.status === 403) {
        setErrors({
          userLoginEmail: message,

          userLoginPassword: "",
        });

        return;
      }

      // ===================================================
      // OTHER ERROR
      // ===================================================

      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("USER LOGOUT ERROR:", error);
    } finally {
      setSession(null);

      showToast("ออกจากระบบเรียบร้อยแล้ว", "success");

      setTimeout(() => {
        navigate("/user-login", {
          replace: true,
        });
      }, 700);
    }
  };

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
          background:
            rgba(255,255,255,0.04);
        }

        ::-webkit-scrollbar-thumb {
          background:
            #6366f1;

          border-radius:
            999px;
        }

        /* =========================================
           NAV MENU
        ========================================== */

        .nav-menu {
          display:
            flex;

          gap:
            20px;

          align-items:
            center;

          flex-wrap:
            wrap;
        }

        .nav-link {
          display:
            inline-block;

          padding:
            8px 16px;

          margin:
            0 4px;

          color:
            rgba(255,255,255,0.8);

          text-decoration:
            none;

          border-radius:
            12px;

          transition:
            all 0.3s ease;

          font-weight:
            500;

          font-size:
            14px;
        }

        .nav-link:hover {
          background:
            rgba(255,255,255,0.1);

          color:
            #ffffff;

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

          color:
            #818cf8;

          border:
            1px solid
            rgba(99,102,241,0.3);

          font-weight:
            600;
        }

        /* =========================================
           USER CHIP
        ========================================== */

        .user-chip {
          background:
            rgba(255,255,255,0.1);

          backdrop-filter:
            blur(10px);

          border:
            1px solid
            rgba(255,255,255,0.2);

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

          transition:
            all 0.3s ease;
        }

        .user-chip:hover {
          background:
            rgba(255,255,255,0.15);

          transform:
            translateY(-1px);
        }

        /* =========================================
           BUTTON
        ========================================== */

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
              #6366f1 0%,
              #4f46e5 100%
            );

          color:
            #ffffff;

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

          color:
            #ffffff;
        }

        /* =========================================
           LOGIN
        ========================================== */

        .login-page {
          min-height:
            calc(100vh - 107px);

          display:
            grid;

          place-items:
            center;

          padding:
            40px 32px;
        }

        .login-card {
          width:
            min(560px, 100%);

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
            48px;

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);

          position:
            relative;

          overflow:
            hidden;

          animation:
            fadeInLogin
            0.25s ease;
        }

        .login-card::before {
          content:
            "";

          position:
            absolute;

          top:
            0;

          left:
            0;

          right:
            0;

          height:
            1px;

          background:
            linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.3),
              transparent
            );
        }

        /* =========================================
           SECTION TITLE
        ========================================== */

        .section-title {
          margin:
            0 0 20px;

          font-size:
            24px;

          font-weight:
            700;

          color:
            #ffffff;

          position:
            relative;

          padding-left:
            16px;
        }

        .section-title::before {
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
              #818cf8 0%,
              #6366f1 100%
            );

          border-radius:
            2px;
        }

        /* =========================================
           FORM FIELD
        ========================================== */

        .field {
          display:
            flex;

          flex-direction:
            column;

          gap:
            8px;

          margin-bottom:
            14px;

          position:
            relative;
        }

        .field label {
          font-size:
            14px;

          font-weight:
            600;

          color:
            rgba(255,255,255,0.9);

          margin-bottom:
            8px;

          display:
            block;
        }

        .field input {
          width:
            100%;

          border:
            1px solid
            rgba(255,255,255,0.2);

          border-radius:
            12px;

          padding:
            16px 20px;

          background:
            rgba(255,255,255,0.08);

          backdrop-filter:
            blur(10px);

          font-size:
            15px;

          color:
            #ffffff;

          outline:
            none;

          transition:
            all 0.3s
            cubic-bezier(
              0.4,
              0,
              0.2,
              1
            );
        }

        .field input::placeholder {
          color:
            rgba(255,255,255,0.5);
        }

        .field input.with-toggle {
          padding-right:
            120px;
        }

        .field input:focus {
          border-color:
            #818cf8;

          background:
            rgba(255,255,255,0.12);

          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.2);

          transform:
            translateY(-1px);
        }

        /* =========================================
           ERROR
        ========================================== */

        .error-text {
          font-size:
            12px;

          color:
            #f87171;

          min-height:
            16px;

          font-weight:
            500;

          margin-top:
            4px;
        }

        /* =========================================
           PASSWORD TOGGLE
        ========================================== */

        .password-toggle {
          position:
            absolute;

          right:
            12px;

          top:
            50%;

          transform:
            translateY(-50%);

          border:
            none;

          background:
            rgba(255,255,255,0.1);

          backdrop-filter:
            blur(10px);

          color:
            rgba(255,255,255,0.8);

          border-radius:
            12px;

          padding:
            10px 14px;

          cursor:
            pointer;

          font-size:
            12px;

          font-weight:
            600;

          transition:
            all 0.3s ease;

          text-transform:
            uppercase;

          letter-spacing:
            0.05em;
        }

        .password-toggle:hover {
          background:
            rgba(255,255,255,0.15);

          color:
            #ffffff;

          transform:
            translateY(-50%)
            translateY(-1px);
        }

        .password-toggle:disabled {
          opacity:
            0.5;

          cursor:
            not-allowed;
        }

        /* =========================================
           ACTIONS
        ========================================== */

        .actions {
          display:
            flex;

          flex-wrap:
            wrap;

          gap:
            10px;

          margin-top:
            6px;
        }

        .actions .btn {
          padding:
            14px 24px;

          font-size:
            15px;
        }

        .actions .btn-primary {
          flex:
            1;
        }

        /* =========================================
           TOAST
        ========================================== */

        .toast {
          position:
            fixed;

          right:
            32px;

          bottom:
            32px;

          background:
            rgba(15,15,35,0.95);

          backdrop-filter:
            blur(20px);

          color:
            #ffffff;

          padding:
            16px 24px;

          border-radius:
            12px;

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.25);

          border:
            1px solid
            rgba(255,255,255,0.1);

          z-index:
            9999;

          max-width:
            400px;

          font-weight:
            500;

          animation:
            toastInLogin
            0.3s ease;
        }

        /* =========================================
           ANIMATION
        ========================================== */

        @keyframes fadeInLogin {
          from {
            opacity:
              0;

            transform:
              translateY(8px);
          }

          to {
            opacity:
              1;

            transform:
              translateY(0);
          }
        }

        @keyframes toastInLogin {
          from {
            opacity:
              0;

            transform:
              translateY(20px);
          }

          to {
            opacity:
              1;

            transform:
              translateY(0);
          }
        }

        /* =========================================
           RESPONSIVE
        ========================================== */

        @media (max-width: 1100px) {

          .dashboard-navbar {
            flex-direction:
              column !important;
          }

          .dashboard-navbar-menu,
          .dashboard-navbar-user {
            justify-content:
              center;
          }
        }

        @media (max-width: 768px) {

          .dashboard-navbar-menu {
            flex-direction:
              column;

            width:
              100%;
          }

          .dashboard-navbar-menu
          .nav-link {
            width:
              100%;

            text-align:
              center;
          }

          .dashboard-navbar-user {
            width:
              100%;

            justify-content:
              center;
          }

          .login-page {
            padding:
              20px 16px;
          }

          .login-card {
            padding:
              32px 24px;
          }

          .actions {
            flex-direction:
              column;
          }

          .actions .btn {
            width:
              100%;
          }
        }

      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav
        className="dashboard-navbar"
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
        {/* =================================================
            LOGO
        ================================================== */}

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

        {/* =================================================
            NAV MENU
        ================================================== */}

        <div
          className="
            dashboard-navbar-menu
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

                <Link to="/ocr" className="nav-link">
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
              </>
            )
          ) : (
            <>
              <Link to="/" className="nav-link">
                Dashboard
              </Link>

              <Link
                to="/user-login"
                className="
                  nav-link
                  Active
                "
              >
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

        {/* =================================================
            USER AREA
        ================================================== */}

        <div
          className="
            dashboard-navbar-user
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
              LOGIN / LOGOUT
          ================================================== */}

          {session ? (
            <button
              className="
                btn
                btn-outline
              "
              onClick={handleLogout}
              disabled={loading}
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

      {/* =====================================================
          LOGIN
      ====================================================== */}

      <main className="login-page">
        <div className="login-card">
          <h3 className="section-title">เข้าสู่ระบบผู้ใช้งาน</h3>

          {/* =================================================
              EMAIL
          ================================================== */}

          <div className="field">
            <label>อีเมล</label>

            <input
              id="userLoginEmail"
              type="email"
              value={formData.userLoginEmail}
              onChange={handleChange}
              placeholder="example@email.com"
              disabled={loading}
              autoComplete="email"
            />

            <div className="error-text">{errors.userLoginEmail}</div>
          </div>

          {/* =================================================
              PASSWORD
          ================================================== */}

          <div className="field">
            <label>รหัสผ่าน</label>

            <input
              id="userLoginPassword"
              className="with-toggle"
              type={showPassword ? "text" : "password"}
              value={formData.userLoginPassword}
              onChange={handleChange}
              placeholder="กรอกรหัสผ่าน"
              disabled={loading}
              autoComplete="current-password"
            />

            <button
              className="
                password-toggle
              "
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? "ซ่อน" : "แสดง"}
            </button>

            <div className="error-text">{errors.userLoginPassword}</div>
          </div>

          {/* =================================================
              ACTIONS
          ================================================== */}

          <div className="actions">
            <button
              className="
                btn
                btn-primary
              "
              onClick={handleLogin}
              type="button"
              disabled={loading}
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
            </button>

            <button
              className="
                btn
                btn-secondary
              "
              type="button"
              onClick={() => navigate("/register")}
              disabled={loading}
            >
              สมัครสมาชิก
            </button>
          </div>
        </div>
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && <div className="toast">{toast.message}</div>}
    </div>
  );
};

export default UserLoginPage;
