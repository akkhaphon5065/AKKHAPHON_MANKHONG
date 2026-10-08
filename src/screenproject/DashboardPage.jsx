// DashboardPage.jsx

import React, { useCallback, useEffect, useState } from "react";

import { useNavigate, Link } from "react-router-dom";

import { getCurrentUser, logoutUser } from "../api/authApi";

import { apiGet } from "../api/api";

const DashboardPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState(null);

  // =========================================================
  // ACTIVITIES
  // =========================================================

  const [activities, setActivities] = useState([]);

  // =========================================================
  // STATS
  // =========================================================

  const [stats, setStats] = useState({
    files: 0,
    ocrActive: 0,
    translate: 0,
    usage: 0,
    todayUsage: 0,
    onlineUsers: 0,
  });

  // =========================================================
  // LOADING
  // =========================================================

  const [loading, setLoading] = useState(true);

  const [loadingData, setLoadingData] = useState(false);

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
  // LOAD USER SESSION FROM BACKEND
  // =========================================================

  const loadSession = useCallback(async () => {
    try {
      const result = await getCurrentUser();

      if (!result?.success || !result?.user) {
        throw new Error("ไม่สามารถโหลดข้อมูลผู้ใช้งานได้");
      }

      const user = result.user;

      // =====================================================
      // ADMIN
      // =====================================================

      if (user.role === "admin") {
        const adminSession = {
          ...user,

          user_id: user.user_id,

          id: user.user_id,

          name: user.name || user.display_name || "Administrator",
        };

        setSession(adminSession);

        return adminSession;
      }

      // =====================================================
      // USER
      // =====================================================

      const userSession = {
        ...user,

        user_id: user.user_id,

        id: user.user_id,

        name: user.name || user.display_name || "",

        display_name: user.display_name || user.name || "",

        email: user.email || "",

        role: user.role || "user",

        status: user.status || "Active",

        online: Boolean(user.online),
      };

      setSession(userSession);

      return userSession;
    } catch (error) {
      console.error("LOAD SESSION ERROR:", error);

      setSession(null);

      return null;
    }
  }, []);

  // =========================================================
  // LOAD DASHBOARD DATA
  // =========================================================

  const loadDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);

      const result = await apiGet("/dashboard");

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถโหลด Dashboard ได้");
      }

      // =====================================================
      // STATS
      // =====================================================

      setStats({
        files: Number(result.stats?.files || 0),

        ocrActive: Number(result.stats?.ocrActive || 0),

        translate: Number(result.stats?.translate || 0),

        usage: Number(result.stats?.usage || 0),

        todayUsage: Number(result.stats?.todayUsage || 0),

        onlineUsers: Number(result.stats?.onlineUsers || 0),
      });

      // =====================================================
      // ACTIVITIES
      // =====================================================

      const apiActivities = Array.isArray(result.activities)
        ? result.activities
        : [];

      const formattedActivities = apiActivities.slice(0, 5).map((item) => ({
        time: formatTime(item.datetime),

        action: getActivityText(item),

        status: item.status || "สำเร็จ",
      }));

      setActivities(formattedActivities);
    } catch (error) {
      console.error("LOAD DASHBOARD DATA ERROR:", error);

      // =====================================================
      // JWT หมดอายุ
      // =====================================================

      if (error?.status === 401) {
        localStorage.removeItem("userToken");

        localStorage.removeItem("ocrthai_session");

        setSession(null);

        navigate("/user-login", {
          replace: true,
        });

        return;
      }

      showToast(error.message || "ไม่สามารถโหลด Dashboard ได้", "error");
    } finally {
      setLoadingData(false);
    }
  }, [navigate, showToast]);

  // =========================================================
  // FORMAT TIME
  // =========================================================

  const formatTime = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleTimeString("th-TH", {
      hour: "2-digit",

      minute: "2-digit",
    });
  };

  // =========================================================
  // ACTIVITY TEXT
  // =========================================================

  const getActivityText = (item) => {
    const type = String(item?.type || "").toLowerCase();

    if (type === "ocr") {
      return item.detail && item.detail !== "-"
        ? `สแกนเอกสาร OCR: ${item.detail}`
        : "สแกนเอกสาร OCR";
    }

    if (type === "translate" || type === "translation") {
      return item.detail && item.detail !== "-"
        ? `แปลภาษา: ${item.detail}`
        : "แปลภาษา";
    }

    if (item?.detail && item.detail !== "-") {
      return item.detail;
    }

    return item?.type || "ใช้งานระบบ";
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
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const currentUser = await loadSession();

        if (!mounted) {
          return;
        }

        // ===================================================
        // ถ้าไม่มี Session
        // ===================================================

        if (!currentUser) {
          setStats({
            files: 0,
            ocrActive: 0,
            translate: 0,
            usage: 0,
            todayUsage: 0,
            onlineUsers: 0,
          });

          setActivities([]);

          return;
        }

        // ===================================================
        // ADMIN
        // ===================================================

        if (currentUser.role === "admin") {
          // หน้า Dashboard นี้ยังสามารถดูได้
          // แต่ Admin มีหน้า Admin Dashboard แยกอยู่แล้ว
          await loadDashboardData();

          return;
        }

        // ===================================================
        // USER
        // ===================================================

        await loadDashboardData();
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
  }, [loadSession, loadDashboardData]);

  // =========================================================
  // REFRESH WHEN WINDOW FOCUS
  // =========================================================

  useEffect(() => {
    const handleFocus = async () => {
      try {
        const currentUser = await loadSession();

        if (currentUser) {
          await loadDashboardData();
        }
      } catch (error) {
        console.error("FOCUS REFRESH ERROR:", error);
      }
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadSession, loadDashboardData]);

  // =========================================================
  // REQUIRE LOGIN
  // =========================================================

  const requireLogin = (path) => {
    const token = localStorage.getItem("userToken");

    const savedSession = localStorage.getItem("ocrthai_session");

    if (!token || !savedSession) {
      showToast("กรุณาเข้าสู่ระบบก่อนใช้งาน", "error");

      setTimeout(() => {
        navigate("/user-login");
      }, 500);

      return;
    }

    navigate(path);
  };

  // =========================================================
  // NAVIGATION
  // =========================================================

  const handleNav = (event, path) => {
    event.preventDefault();

    navigate(path);
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    } finally {
      setSession(null);

      setActivities([]);

      setStats({
        files: 0,
        ocrActive: 0,
        translate: 0,
        usage: 0,
        todayUsage: 0,
        onlineUsers: 0,
      });

      showToast("ออกจากระบบเรียบร้อยแล้ว", "success");

      setTimeout(() => {
        navigate("/user-login", {
          replace: true,
        });
      }, 700);
    }
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
            กำลังโหลด Dashboard...
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

        .btn-success {
          background:
            linear-gradient(
              135deg,
              #10b981 0%,
              #059669 100%
            );

          color:
            #ffffff;

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

          color:
            #ffffff;
        }

        /* =========================================
           HERO
        ========================================== */

        .dashboard-hero {
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

          position:
            relative;

          overflow:
            hidden;
        }

        .dashboard-hero::before {
          content:
            "";

          position:
            absolute;

          inset:
            0;

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

        /* =========================================
           CARD
        ========================================== */

        .dashboard-card {
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

        .dashboard-card:hover {
          transform:
            translateY(-4px);

          border-color:
            rgba(255,255,255,0.2);

          box-shadow:
            0 32px 64px -12px
            rgba(0,0,0,0.4);
        }

        /* =========================================
           STAT
        ========================================== */

        .dashboard-stat-number {
          font-size:
            42px;

          font-weight:
            800;

          margin-top:
            10px;

          background:
            linear-gradient(
              135deg,
              #818cf8 0%,
              #6366f1 100%
            );

          -webkit-background-clip:
            text;

          -webkit-text-fill-color:
            transparent;
        }

        /* =========================================
           TABLE
        ========================================== */

        .dashboard-table {
          width:
            100%;

          border-collapse:
            collapse;
        }

        .dashboard-table th,
        .dashboard-table td {
          padding:
            14px 12px;

          border-bottom:
            1px solid
            rgba(255,255,255,0.1);

          text-align:
            left;
        }

        .dashboard-table th {
          color:
            rgba(255,255,255,0.65);

          font-size:
            12px;

          font-weight:
            600;
        }

        .dashboard-table td {
          color:
            rgba(255,255,255,0.9);

          font-size:
            14px;
        }

        /* =========================================
           TOAST
        ========================================== */

        .dashboard-toast {
          position:
            fixed;

          right:
            32px;

          bottom:
            32px;

          background:
            rgba(15,15,35,0.96);

          backdrop-filter:
            blur(20px);

          color:
            #ffffff;

          padding:
            16px 24px;

          border-radius:
            12px;

          border:
            1px solid
            rgba(255,255,255,0.1);

          box-shadow:
            0 25px 50px -12px
            rgba(0,0,0,0.35);

          z-index:
            9999;

          max-width:
            400px;
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

          .dashboard-main-grid {
            grid-template-columns:
              1fr !important;
          }

          .dashboard-stats {
            grid-template-columns:
              1fr !important;
          }

          .dashboard-hero {
            padding:
              25px;
          }

          main {
            padding-left:
              16px !important;

            padding-right:
              16px !important;
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
                <Link
                  to="/"
                  className="
                    nav-link
                    Active
                  "
                >
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
                <Link
                  to="/"
                  className="
                    nav-link
                    Active
                  "
                >
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
              <Link
                to="/"
                className="
                  nav-link
                  Active
                "
              >
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

      <main
        style={{
          padding: "0 32px 40px 32px",

          maxWidth: "1200px",

          margin: "0 auto",
        }}
      >
        {/* =================================================
            HERO
        ================================================== */}

        <section className="dashboard-hero">
          <h2
            style={{
              margin: "0 0 16px",

              fontSize: "36px",

              fontWeight: 700,
            }}
          >
            ยินดีต้อนรับสู่ OCRThai Plus
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
            เว็บแอปพลิเคชันสำหรับแปลงข้อความ จากรูปภาพ เอกสารสแกน และไฟล์ PDF
            เป็นข้อความดิจิทัล พร้อมแปลภาษา คัดลอก ดาวน์โหลด
            และตรวจสอบประวัติการใช้งานย้อนหลัง
          </p>

          {session && (
            <div
              style={{
                marginTop: "18px",

                color: "rgba(255,255,255,0.75)",

                fontSize: "14px",
              }}
            >
              ยินดีต้อนรับ{" "}
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

        <br />

        {/* =================================================
            STATS
        ================================================== */}

        <section
          className="
            dashboard-stats
          "
          style={{
            display: "grid",

            gridTemplateColumns: "repeat(4, 1fr)",

            gap: "18px",
          }}
        >
          {/* FILES */}

          <div
            className="
              dashboard-card
            "
          >
            <div
              style={{
                color: "rgba(255,255,255,0.65)",

                fontSize: "14px",
              }}
            >
              ไฟล์ที่ประมวลผลทั้งหมด
            </div>

            <div
              className="
                dashboard-stat-number
              "
            >
              {loadingData ? "..." : stats.files}
            </div>
          </div>

          {/* OCR */}

          <div
            className="
              dashboard-card
            "
          >
            <div
              style={{
                color: "rgba(255,255,255,0.65)",

                fontSize: "14px",
              }}
            >
              ผล OCR Active
            </div>

            <div
              className="
                dashboard-stat-number
              "
            >
              {loadingData ? "..." : stats.ocrActive}
            </div>
          </div>

          {/* TRANSLATE */}

          <div
            className="
              dashboard-card
            "
          >
            <div
              style={{
                color: "rgba(255,255,255,0.65)",

                fontSize: "14px",
              }}
            >
              การแปลภาษาทั้งหมด
            </div>

            <div
              className="
                dashboard-stat-number
              "
              style={{
                background: "linear-gradient(135deg,#34d399,#10b981)",

                WebkitBackgroundClip: "text",

                WebkitTextFillColor: "transparent",
              }}
            >
              {loadingData ? "..." : stats.translate}
            </div>
          </div>

          {/* ONLINE */}

          <div
            className="
              dashboard-card
            "
          >
            <div
              style={{
                color: "rgba(255,255,255,0.65)",

                fontSize: "14px",
              }}
            >
              ผู้ใช้งานออนไลน์
            </div>

            <div
              className="
                dashboard-stat-number
              "
              style={{
                background: "linear-gradient(135deg,#34d399,#10b981)",

                WebkitBackgroundClip: "text",

                WebkitTextFillColor: "transparent",
              }}
            >
              {loadingData ? "..." : stats.onlineUsers}
            </div>
          </div>
        </section>

        <br />

        {/* =================================================
            QUICK ACTIONS + ACTIVITY
        ================================================== */}

        <section
          className="
            dashboard-main-grid
          "
          style={{
            display: "grid",

            gridTemplateColumns: "1fr 1fr",

            gap: "18px",
          }}
        >
          {/* QUICK ACTION */}

          <div
            className="
              dashboard-card
            "
          >
            <h3
              style={{
                margin: "0 0 20px",

                fontSize: "22px",

                fontWeight: 700,
              }}
            >
              เริ่มต้นใช้งานอย่างรวดเร็ว
            </h3>

            <div
              style={{
                display: "flex",

                flexWrap: "wrap",

                gap: "10px",
              }}
            >
              {/* OCR */}

              <button
                className="
                  btn
                  btn-primary
                "
                onClick={() => requireLogin("/ocr")}
              >
                เปิดหน้า OCR
              </button>

              {/* TRANSLATE */}

              <button
                className="
                  btn
                  btn-secondary
                "
                onClick={() => requireLogin("/translate")}
              >
                ไปหน้า Translate
              </button>

              {/* HISTORY */}

              <button
                className="
                  btn
                  btn-success
                "
                onClick={() => requireLogin("/history")}
              >
                ดูประวัติย้อนหลัง
              </button>
            </div>

            {!session && (
              <div
                style={{
                  marginTop: "18px",

                  padding: "14px 16px",

                  borderRadius: "12px",

                  background: "rgba(245,158,11,0.1)",

                  border: "1px solid rgba(245,158,11,0.25)",

                  color: "#fbbf24",

                  fontSize: "13px",

                  lineHeight: 1.6,
                }}
              >
                💡 กรุณาเข้าสู่ระบบก่อนใช้งาน OCR, Translate และ History
              </div>
            )}
          </div>

          {/* ACTIVITY */}

          <div
            className="
              dashboard-card
            "
          >
            <h3
              style={{
                margin: "0 0 20px",

                fontSize: "22px",

                fontWeight: 700,
              }}
            >
              กิจกรรมล่าสุด
            </h3>

            {session ? (
              activities.length > 0 ? (
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <table
                    className="
                      dashboard-table
                    "
                  >
                    <thead>
                      <tr>
                        <th>เวลา</th>

                        <th>กิจกรรม</th>

                        <th>สถานะ</th>
                      </tr>
                    </thead>

                    <tbody>
                      {activities.map((act, index) => (
                        <tr key={index}>
                          <td>{act.time}</td>

                          <td>{act.action}</td>

                          <td
                            style={{
                              color: "#34d399",

                              fontWeight: 600,
                            }}
                          >
                            {act.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    padding: "30px 0",

                    color: "rgba(255,255,255,0.55)",

                    textAlign: "center",
                  }}
                >
                  ยังไม่มีข้อมูลกิจกรรม
                </div>
              )
            ) : (
              <div
                style={{
                  padding: "30px 0",

                  color: "rgba(255,255,255,0.55)",

                  textAlign: "center",

                  lineHeight: 1.7,
                }}
              >
                กรุณาเข้าสู่ระบบ เพื่อดูข้อมูลกิจกรรม
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            USAGE INFORMATION
        ================================================== */}

        {session && (
          <>
            <br />

            <section
              className="
                dashboard-card
              "
            >
              <h3
                style={{
                  margin: "0 0 20px",

                  fontSize: "22px",

                  fontWeight: 700,
                }}
              >
                สรุปการใช้งาน
              </h3>

              <div
                style={{
                  display: "grid",

                  gridTemplateColumns: "repeat(2, 1fr)",

                  gap: "14px",
                }}
              >
                <div
                  style={{
                    padding: "16px",

                    borderRadius: "14px",

                    background: "rgba(255,255,255,0.05)",

                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",

                      fontSize: "12px",
                    }}
                  >
                    การใช้งานทั้งหมด
                  </div>

                  <div
                    style={{
                      marginTop: "6px",

                      fontSize: "24px",

                      fontWeight: 800,
                    }}
                  >
                    {stats.usage}
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",

                    borderRadius: "14px",

                    background: "rgba(255,255,255,0.05)",

                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      color: "rgba(255,255,255,0.6)",

                      fontSize: "12px",
                    }}
                  >
                    การใช้งานวันนี้
                  </div>

                  <div
                    style={{
                      marginTop: "6px",

                      fontSize: "24px",

                      fontWeight: 800,

                      color: "#34d399",
                    }}
                  >
                    {stats.todayUsage}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && (
        <div
          className="
            dashboard-toast
          "
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
