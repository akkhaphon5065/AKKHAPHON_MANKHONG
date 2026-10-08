import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getCurrentUser, updateProfile, logoutUser } from "../api/authApi";

export default function ProfilePage() {
  const navigate = useNavigate();

  // =========================================================
  // SESSION
  // =========================================================

  const [session, setSession] = useState({
    user_id: "",
    name: "",
    display_name: "",
    email: "",
    role: "user",
    status: "Active",
  });

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    profileName: "",
    profileEmail: "",
    profilePassword: "",
    profileConfirmPassword: "",
  });

  // =========================================================
  // ERRORS
  // =========================================================

  const [errors, setErrors] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // =========================================================
  // UI STATE
  // =========================================================

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const showToastMessage = (message, type = "success") => {
    setToast({
      show: true,
      message,
      type,
    });

    window.setTimeout(() => {
      setToast({
        show: false,
        message: "",
        type: "",
      });
    }, 2500);
  };

  // =========================================================
  // LOAD USER FROM BACKEND
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const token = localStorage.getItem("userToken");

        if (!token) {
          navigate("/user-login", {
            replace: true,
          });
          return;
        }

        const result = await getCurrentUser();

        if (!result?.success || !result?.user) {
          throw new Error(result?.message || "ไม่สามารถโหลดข้อมูลผู้ใช้งานได้");
        }

        if (!mounted) {
          return;
        }

        const user = result.user;

        // ===================================================
        // ADMIN
        // ===================================================

        if (user.role === "admin") {
          navigate("/admin-dashboard", {
            replace: true,
          });
          return;
        }

        // ===================================================
        // SESSION
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
        };

        setSession(userSession);

        // ===================================================
        // FORM
        // ===================================================

        setFormData({
          profileName: user.display_name || user.name || "",
          profileEmail: user.email || "",
          profilePassword: "",
          profileConfirmPassword: "",
        });

        setErrors({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
        });
      } catch (error) {
        console.error("LOAD PROFILE ERROR:", error);

        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");

        if (mounted) {
          showToastMessage(
            error?.message || "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
            "error",
          );
        }

        setTimeout(() => {
          navigate("/user-login", {
            replace: true,
          });
        }, 700);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  // =========================================================
  // INPUT CHANGE
  // =========================================================

  const handleInputChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }));

    let errorKey = "";

    switch (id) {
      case "profileName":
        errorKey = "name";
        break;

      case "profileEmail":
        errorKey = "email";
        break;

      case "profilePassword":
        errorKey = "password";
        break;

      case "profileConfirmPassword":
        errorKey = "confirmPassword";
        break;

      default:
        break;
    }

    if (errorKey) {
      setErrors((prev) => ({
        ...prev,
        [errorKey]: "",
      }));
    }
  };

  // =========================================================
  // SAVE PROFILE
  // =========================================================

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const newErrors = {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    };

    let hasError = false;

    const name = formData.profileName.trim();
    const email = formData.profileEmail.trim().toLowerCase();
    const password = formData.profilePassword;
    const confirmPassword = formData.profileConfirmPassword;

    // =====================================================
    // NAME
    // =====================================================

    if (!name) {
      newErrors.name = "กรุณากรอกชื่อที่แสดง";
      hasError = true;
    }

    // =====================================================
    // EMAIL
    // =====================================================

    if (!email) {
      newErrors.email = "กรุณากรอกอีเมล";
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "รูปแบบอีเมลไม่ถูกต้อง";
      hasError = true;
    }

    // =====================================================
    // PASSWORD
    // =====================================================

    if (password) {
      if (password.length < 6) {
        newErrors.password = "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";
        hasError = true;
      }

      if (password !== confirmPassword) {
        newErrors.confirmPassword = "รหัสผ่านยืนยันไม่ตรงกัน";
        hasError = true;
      }
    }

    // =====================================================
    // SHOW VALIDATION
    // =====================================================

    if (hasError) {
      setErrors(newErrors);
      showToastMessage("กรุณาตรวจสอบข้อมูลให้ถูกต้อง", "error");
      return;
    }

    // =====================================================
    // SAVE TO BACKEND
    // =====================================================

    try {
      setSaving(true);

      const result = await updateProfile(name, email, password);

      if (!result?.success) {
        throw new Error(result?.message || "ไม่สามารถบันทึกข้อมูลได้");
      }

      // ===================================================
      // USER FROM SERVER
      // ===================================================

      const user = result.user;

      if (user) {
        const updatedSession = {
          ...user,
          user_id: user.user_id,
          id: user.user_id,
          name: user.name || user.display_name || "",
          display_name: user.display_name || user.name || "",
          email: user.email || email,
          role: user.role || "user",
          status: user.status || "Active",
        };

        setSession(updatedSession);

        localStorage.setItem("ocrthai_session", JSON.stringify(updatedSession));
      }

      // ===================================================
      // CLEAR PASSWORD
      // ===================================================

      setFormData((prev) => ({
        ...prev,
        profilePassword: "",
        profileConfirmPassword: "",
      }));

      setErrors({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
      });

      showToastMessage(
        result.message || "บันทึกการแก้ไขข้อมูลส่วนตัวสำเร็จแล้ว ✨",
        "success",
      );
    } catch (error) {
      console.error("UPDATE PROFILE ERROR:", error);

      const message =
        error?.data?.message || error?.message || "ไม่สามารถบันทึกข้อมูลได้";

      if (error?.status === 409) {
        setErrors((prev) => ({
          ...prev,
          email: message,
        }));
      } else if (error?.status === 401) {
        localStorage.removeItem("userToken");
        localStorage.removeItem("ocrthai_session");

        navigate("/user-login", {
          replace: true,
        });
      } else {
        showToastMessage(message, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("PROFILE LOGOUT ERROR:", error);
    } finally {
      setSession({
        user_id: "",
        name: "",
        display_name: "",
        email: "",
        role: "user",
        status: "Active",
      });

      showToastMessage("ออกจากระบบสำเร็จ", "success");

      setTimeout(() => {
        navigate("/user-login", {
          replace: true,
        });
      }, 700);
    }
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
              fontWeight: 600,
            }}
          >
            กำลังโหลดข้อมูลส่วนตัว...
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // RETURN
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

        body {
          margin: 0;
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

        input::placeholder {
          color: rgba(255,255,255,0.45);
        }

        /* =========================
           NAV MENU
        ========================= */

        .profile-nav-menu {
          display: flex;
          gap: 20px;
          align-items: center;
          flex-wrap: wrap;
        }

        .profile-nav-link {
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

        .profile-nav-link:hover {
          background: rgba(255,255,255,0.1);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .profile-nav-link.active {
          background:
            linear-gradient(
              135deg,
              rgba(99,102,241,0.2) 0%,
              rgba(139,92,246,0.2) 100%
            );
          color: #818cf8;
          border: 1px solid rgba(99,102,241,0.3);
          font-weight: 600;
        }

        /* =========================
           USER CHIP
        ========================= */

        .profile-user-chip {
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

        .profile-user-chip:hover {
          background: rgba(255,255,255,0.15);
          transform: translateY(-1px);
        }

        /* =========================
           BUTTON
        ========================= */

        .profile-btn {
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 600;
        }

        .profile-btn:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        .profile-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .profile-btn-outline {
          background: transparent;
          color: rgba(255,255,255,0.9);
          border: 2px solid rgba(255,255,255,0.3);
        }

        .profile-btn-outline:hover:not(:disabled) {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.5);
          color: #ffffff;
        }

        .profile-btn-primary {
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

        .profile-btn-primary:hover:not(:disabled) {
          background:
            linear-gradient(
              135deg,
              #818cf8 0%,
              #6366f1 100%
            );
          box-shadow:
            0 12px 24px -8px
            rgba(99,102,241,0.6);
        }

        /* =========================
           FORM CARD
        ========================= */

        .profile-card {
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

        .profile-title {
          margin: 0;
          color: #ffffff;
          font-size: 20px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          padding-left: 16px;
        }

        .profile-title::before {
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

        .profile-description {
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          margin: 8px 0 0;
          line-height: 1.6;
        }

        .profile-divider {
          margin: 0 0 28px;
          padding: 0 0 16px;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .profile-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .profile-field label {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
        }

        .profile-input {
          width: 100%;
          padding: 12px 14px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
        }

        .profile-input:focus {
          border-color: #818cf8;
          background: rgba(255,255,255,0.1);
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .profile-password-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .profile-password-input {
          width: 100%;
          padding: 12px 70px 12px 14px;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(10px);
          color: #ffffff;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          font-size: 14px;
          outline: none;
          transition: all 0.3s ease;
        }

        .profile-password-input:focus {
          border-color: #818cf8;
          background: rgba(255,255,255,0.1);
          box-shadow:
            0 0 0 4px
            rgba(99,102,241,0.12);
        }

        .profile-password-toggle {
          position: absolute;
          right: 10px;
          padding: 6px 11px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,0.85);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s ease;
        }

        .profile-password-toggle:hover {
          background: rgba(255,255,255,0.16);
          color: #ffffff;
        }

        .profile-error {
          color: #f87171;
          font-size: 12px;
        }

        /* =========================
           TOAST
        ========================= */

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .profile-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          padding: 14px 24px;
          border-radius: 12px;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          box-shadow:
            0 12px 24px
            rgba(0,0,0,0.3);
          z-index: 3000;
          animation: slideIn 0.3s ease;
        }

        /* =========================
           RESPONSIVE
        ========================= */

        @media (max-width: 1100px) {
          .profile-navbar {
            flex-direction: column !important;
          }

          .profile-navbar-menu,
          .profile-navbar-user {
            justify-content: center;
          }
        }

        @media (max-width: 768px) {
          .profile-navbar-menu {
            flex-direction: column;
            width: 100%;
          }

          .profile-navbar-menu .profile-nav-link {
            width: 100%;
            text-align: center;
          }

          .profile-navbar-user {
            width: 100%;
            justify-content: center;
          }

          .profile-main {
            padding: 20px !important;
          }

          .profile-card {
            padding: 24px;
          }
        }
      `}</style>

      {/* =====================================================
          NAVBAR
      ====================================================== */}

      <nav
        className="profile-navbar"
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

        <div className="profile-navbar-menu profile-nav-menu">
          <Link to="/dashboard" className="profile-nav-link">
            Dashboard
          </Link>

          <Link to="/ocr" className="profile-nav-link">
            OCR
          </Link>

          <Link to="/translate" className="profile-nav-link">
            Translate
          </Link>

          <Link to="/history" className="profile-nav-link">
            History
          </Link>

          <Link to="/profile" className="profile-nav-link active">
            Edit Profile
          </Link>
        </div>

        {/* =================================================
            USER AREA
        ================================================== */}

        <div
          className="profile-navbar-user"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div className="profile-user-chip">
            สถานะระบบ:{" "}
            <strong
              style={{
                color: "#34d399",
              }}
            >
              Online
            </strong>
          </div>

          <div className="profile-user-chip">
            บทบาท:{" "}
            <strong
              style={{
                color: "#818cf8",
              }}
            >
              {formatRole(session?.role)}
            </strong>
          </div>

          <div className="profile-user-chip">
            ผู้ใช้งาน:{" "}
            <strong>
              {session.name ||
                session.display_name ||
                session.email ||
                "ยังไม่ได้เข้าสู่ระบบ"}
            </strong>
          </div>

          <button
            className="
              profile-btn
              profile-btn-outline
            "
            onClick={handleLogout}
          >
            ออกจากระบบ
          </button>
        </div>
      </nav>

      {/* =====================================================
          MAIN
      ====================================================== */}

      <main
        className="profile-main"
        style={{
          padding: "32px 32px 40px",
          maxWidth: "700px",
          margin: "0 auto",
        }}
      >
        <div className="profile-card">
          {/* TITLE */}

          <div className="profile-divider">
            <h3 className="profile-title">แก้ไขข้อมูลส่วนตัว</h3>

            <p className="profile-description">
              แก้ไขชื่อ อีเมล หรือเปลี่ยนรหัสผ่านของบัญชี
            </p>
          </div>

          {/* FORM */}

          <form
            onSubmit={handleSaveProfile}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "22px",
            }}
          >
            {/* NAME */}

            <div className="profile-field">
              <label>ชื่อที่แสดง</label>

              <input
                id="profileName"
                type="text"
                value={formData.profileName}
                onChange={handleInputChange}
                className="profile-input"
                placeholder="กรอกชื่อที่แสดง"
                disabled={saving}
                style={{
                  borderColor: errors.name
                    ? "#ef4444"
                    : "rgba(255,255,255,0.2)",
                }}
              />

              {errors.name && (
                <span className="profile-error">⚠️ {errors.name}</span>
              )}
            </div>

            {/* EMAIL */}

            <div className="profile-field">
              <label>อีเมลผู้ใช้งาน</label>

              <input
                id="profileEmail"
                type="email"
                value={formData.profileEmail}
                onChange={handleInputChange}
                className="profile-input"
                placeholder="example@email.com"
                disabled={saving}
                style={{
                  borderColor: errors.email
                    ? "#ef4444"
                    : "rgba(255,255,255,0.2)",
                }}
              />

              {errors.email && (
                <span className="profile-error">⚠️ {errors.email}</span>
              )}
            </div>

            {/* PASSWORD */}

            <div className="profile-field">
              <label>
                รหัสผ่านใหม่{" "}
                <span
                  style={{
                    fontSize: "11px",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  (เว้นว่างได้หากไม่ต้องการเปลี่ยน)
                </span>
              </label>

              <div className="profile-password-wrap">
                <input
                  id="profilePassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.profilePassword}
                  onChange={handleInputChange}
                  className="profile-password-input"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  disabled={saving}
                  style={{
                    borderColor: errors.password
                      ? "#ef4444"
                      : "rgba(255,255,255,0.2)",
                  }}
                />

                <button
                  type="button"
                  className="profile-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={saving}
                >
                  {showPassword ? "ซ่อน" : "แสดง"}
                </button>
              </div>

              {errors.password && (
                <span className="profile-error">⚠️ {errors.password}</span>
              )}
            </div>

            {/* CONFIRM PASSWORD */}

            <div className="profile-field">
              <label>ยืนยันรหัสผ่านใหม่</label>

              <div className="profile-password-wrap">
                <input
                  id="profileConfirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.profileConfirmPassword}
                  onChange={handleInputChange}
                  className="profile-password-input"
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  disabled={saving}
                  style={{
                    borderColor: errors.confirmPassword
                      ? "#ef4444"
                      : "rgba(255,255,255,0.2)",
                  }}
                />

                <button
                  type="button"
                  className="profile-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={saving}
                >
                  {showConfirmPassword ? "ซ่อน" : "แสดง"}
                </button>
              </div>

              {errors.confirmPassword && (
                <span className="profile-error">
                  ⚠️ {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* SAVE */}

            <div
              style={{
                marginTop: "6px",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="submit"
                className="
                  profile-btn
                  profile-btn-primary
                "
                disabled={saving}
              >
                {saving ? "กำลังบันทึก..." : "💾 บันทึกการแก้ไข"}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* =====================================================
          TOAST
      ====================================================== */}

      {toast.show && (
        <div
          className="profile-toast"
          style={{
            background:
              toast.type === "success"
                ? "linear-gradient(135deg,#10b981 0%,#059669 100%)"
                : "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
