import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";

import { registerUser } from "../api/authApi";

const RegisterPage = () => {
  const navigate = useNavigate();

  // =========================================================
  // FORM DATA
  // =========================================================

  const [formData, setFormData] = useState({
    regName: "",
    regEmail: "",
    regPassword: "",
    regConfirm: "",
  });

  const [errors, setErrors] = useState({
    regName: "",
    regEmail: "",
    regPassword: "",
    regConfirm: "",
  });

  // =========================================================
  // UI STATE
  // =========================================================

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [session, setSession] = useState(null);

  const [loading, setLoading] = useState(false);

  const [serverMessage, setServerMessage] = useState("");

  const [serverMessageType, setServerMessageType] = useState("");

  // =========================================================
  // LOAD SESSION
  // =========================================================

  useEffect(() => {
    try {
      const savedSession = JSON.parse(
        localStorage.getItem("ocrthai_session") || "null",
      );

      setSession(savedSession);
    } catch (error) {
      console.error("LOAD SESSION ERROR:", error);

      setSession(null);
    }
  }, []);

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

    setServerMessage("");
    setServerMessageType("");
  };

  // =========================================================
  // REGISTER
  // =========================================================

  const handleRegister = async (e) => {
    e.preventDefault();

    let hasError = false;

    const newErrors = {
      regName: "",
      regEmail: "",
      regPassword: "",
      regConfirm: "",
    };

    // =====================================================
    // NAME
    // =====================================================

    if (!formData.regName.trim()) {
      newErrors.regName = "กรุณากรอกชื่อที่แสดงในแอปพลิเคชัน";

      hasError = true;
    }

    // =====================================================
    // EMAIL
    // =====================================================

    const email = formData.regEmail.trim();

    if (!email) {
      newErrors.regEmail = "กรุณากรอกอีเมล";

      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.regEmail = "กรุณากรอกอีเมลให้ถูกต้อง";

      hasError = true;
    }

    // =====================================================
    // PASSWORD
    // =====================================================

    if (formData.regPassword.length < 6) {
      newErrors.regPassword = "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร";

      hasError = true;
    }

    // =====================================================
    // CONFIRM PASSWORD
    // =====================================================

    if (formData.regPassword !== formData.regConfirm) {
      newErrors.regConfirm = "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน";

      hasError = true;
    }

    // =====================================================
    // SHOW FRONTEND ERRORS
    // =====================================================

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    // =====================================================
    // CLEAR OLD MESSAGE
    // =====================================================

    setServerMessage("");
    setServerMessageType("");

    // =====================================================
    // SEND TO BACKEND
    // =====================================================

    try {
      setLoading(true);

      const result = await registerUser(
        formData.regName.trim(),
        email,
        formData.regPassword,
      );

      console.log("REGISTER API RESULT:", result);

      // ===================================================
      // SUCCESS
      // ===================================================

      if (result.success) {
        setServerMessage(result.message || "สร้างบัญชีผู้ใช้สำเร็จ");

        setServerMessageType("success");

        setFormData({
          regName: "",
          regEmail: "",
          regPassword: "",
          regConfirm: "",
        });

        setErrors({
          regName: "",
          regEmail: "",
          regPassword: "",
          regConfirm: "",
        });

        // ไป Login หลังจาก 1.5 วินาที
        setTimeout(() => {
          navigate("/user-login");
        }, 1500);
      }
    } catch (error) {
      console.error("REGISTER ERROR:", error);

      setServerMessage(error.message || "ไม่สามารถสมัครสมาชิกได้");

      setServerMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESET FORM
  // =========================================================

  const handleReset = () => {
    setFormData({
      regName: "",
      regEmail: "",
      regPassword: "",
      regConfirm: "",
    });

    setErrors({
      regName: "",
      regEmail: "",
      regPassword: "",
      regConfirm: "",
    });

    setServerMessage("");
    setServerMessageType("");

    setShowPassword(false);
    setShowConfirm(false);
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    localStorage.removeItem("ocrthai_session");

    localStorage.removeItem("userToken");

    setSession(null);

    navigate("/user-login");
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

                input::placeholder {
                    color:
                        rgba(255,255,255,0.45);
                }

                /* =========================================
                   NAV MENU
                ========================================= */

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
                ========================================= */

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

                .btn-outline:hover {
                    background:
                        rgba(255,255,255,0.1);

                    border-color:
                        rgba(255,255,255,0.5);

                    color:
                        #ffffff;
                }

                /* =========================================
                   NAVBAR
                   เหมือน DashboardPage.jsx
                ========================================= */

                .register-navbar {
                    display:
                        flex;

                    justify-content:
                        space-between;

                    align-items:
                        center;

                    padding:
                        16px 32px;

                    background:
                        rgba(255,255,255,0.05);

                    backdrop-filter:
                        blur(20px);

                    border-bottom:
                        1px solid
                        rgba(255,255,255,0.1);

                    color:
                        #ffffff;

                    position:
                        sticky;

                    top:
                        0;

                    z-index:
                        1000;

                    flex-wrap:
                        wrap;

                    gap:
                        20px;
                }

                /* =========================================
                   LOGO
                ========================================= */

                .register-logo-box {
                    width:
                        120px;

                    height:
                        75px;

                    display:
                        grid;

                    place-items:
                        center;

                    border-radius:
                        12px;

                    background:
                        linear-gradient(
                            135deg,
                            rgba(99,102,241,0.3),
                            rgba(139,92,246,0.3)
                        );

                    backdrop-filter:
                        blur(10px);

                    border:
                        2px solid
                        rgba(255,255,255,0.2);

                    box-shadow:
                        0 8px 25px
                            rgba(99,102,241,0.3),
                        0 0 15px
                            rgba(99,102,241,0.2);

                    overflow:
                        hidden;

                    transition:
                        all 0.3s ease;
                }

                .register-logo-box:hover {
                    transform:
                        scale(1.05);

                    box-shadow:
                        0 10px 30px
                            rgba(99,102,241,0.4),
                        0 0 20px
                            rgba(99,102,241,0.3);
                }

                .register-logo-box img {
                    width:
                        100%;

                    height:
                        100%;

                    object-fit:
                        cover;

                    border-radius:
                        10px;
                }

                /* =========================================
                   MAIN
                ========================================= */

                .register-main {
                    padding:
                        32px;

                    max-width:
                        1200px;

                    margin:
                        0 auto;
                }

                /* =========================================
                   REGISTER CARD
                ========================================= */

                .register-card {
                    max-width:
                        760px;

                    margin:
                        0 auto;

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
                        32px;

                    box-shadow:
                        0 25px 50px -12px
                        rgba(0,0,0,0.25);

                    position:
                        relative;

                    overflow:
                        hidden;
                }

                .register-card::before {
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
                ========================================= */

                .section-title {
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

                    padding-left:
                        16px;

                    border-bottom:
                        1px solid
                        rgba(255,255,255,0.1);

                    padding-bottom:
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
                            #818cf8,
                            #6366f1
                        );

                    border-radius:
                        2px;
                }

                /* =========================================
                   FORM GRID
                ========================================= */

                .form-grid {
                    display:
                        grid;

                    grid-template-columns:
                        1fr 1fr;

                    gap:
                        20px;
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
                        14px 16px;

                    background:
                        rgba(255,255,255,0.06);

                    backdrop-filter:
                        blur(10px);

                    color:
                        #ffffff;

                    font-size:
                        14px;

                    outline:
                        none;

                    transition:
                        all 0.3s ease;
                }

                .field input:focus {
                    border-color:
                        #818cf8;

                    background:
                        rgba(255,255,255,0.09);

                    box-shadow:
                        0 0 0 4px
                        rgba(99,102,241,0.12);
                }

                .field input.with-toggle {
                    padding-right:
                        85px;
                }

                /* =========================================
                   PASSWORD TOGGLE
                ========================================= */

                .password-toggle {
                    position:
                        absolute;

                    right:
                        10px;

                    bottom:
                        42px;

                    border:
                        none;

                    background:
                        rgba(255,255,255,0.08);

                    color:
                        rgba(255,255,255,0.8);

                    border-radius:
                        10px;

                    padding:
                        7px 10px;

                    cursor:
                        pointer;

                    font-size:
                        12px;

                    font-weight:
                        600;

                    transition:
                        all 0.3s ease;
                }

                .password-toggle:hover {
                    background:
                        rgba(255,255,255,0.15);

                    color:
                        #ffffff;
                }

                /* =========================================
                   ERROR
                ========================================= */

                .error-text {
                    min-height:
                        18px;

                    color:
                        #f87171;

                    font-size:
                        12px;

                    font-weight:
                        500;
                }

                /* =========================================
                   SERVER MESSAGE
                ========================================= */

                .server-message {
                    margin-bottom:
                        20px;

                    padding:
                        12px 14px;

                    border-radius:
                        12px;

                    font-size:
                        14px;

                    font-weight:
                        600;

                    border:
                        1px solid
                        transparent;
                }

                .server-message.success {
                    background:
                        rgba(52,211,153,0.12);

                    color:
                        #6ee7b7;

                    border-color:
                        rgba(52,211,153,0.3);
                }

                .server-message.error {
                    background:
                        rgba(248,113,113,0.12);

                    color:
                        #fca5a5;

                    border-color:
                        rgba(248,113,113,0.3);
                }

                /* =========================================
                   ACTIONS
                ========================================= */

                .actions {
                    display:
                        flex;

                    gap:
                        10px;

                    flex-wrap:
                        wrap;

                    margin-top:
                        28px;
                }

                .actions .btn-primary {
                    flex:
                        1;
                }

                .actions .btn-secondary {
                    flex:
                        0 0 auto;
                }

                /* =========================================
                   RESPONSIVE
                ========================================= */

                @media (max-width: 1100px) {

                    .register-navbar {
                        flex-direction:
                            column !important;
                    }

                    .register-navbar-menu,
                    .register-navbar-user {
                        justify-content:
                            center;
                    }
                }

                @media (max-width: 768px) {

                    .register-navbar-menu {
                        flex-direction:
                            column;

                        width:
                            100%;
                    }

                    .register-navbar-menu
                    .nav-link {
                        width:
                            100%;

                        text-align:
                            center;
                    }

                    .register-navbar-user {
                        width:
                            100%;

                        justify-content:
                            center;
                    }

                    .register-logo-box {
                        width:
                            100px;

                        height:
                            60px;
                    }

                    .register-main {
                        padding:
                            20px;
                    }

                    .register-card {
                        padding:
                            24px;

                        border-radius:
                            20px;
                    }

                    .form-grid {
                        grid-template-columns:
                            1fr;
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

      <nav className="register-navbar">
        {/* =================================================
                    LOGO
                ================================================== */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          <div className="register-logo-box">
            <img src="/LOGO.jpg" alt="OCR Logo" />
          </div>
        </div>

        {/* =================================================
                    NAV MENU
                ================================================== */}

        <div
          className="
                        register-navbar-menu
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

              <Link to="/user-login" className="nav-link">
                User Login
              </Link>

              <Link
                to="/register"
                className="
                                    nav-link
                                    Active
                                "
              >
                Register
              </Link>

              <Link to="/adminlogin" className="nav-link">
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
                        register-navbar-user
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
            <strong>{session ? session.name : "ยังไม่ได้เข้าสู่ระบบ"}</strong>
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

      {/* =====================================================
                MAIN
            ====================================================== */}

      <main className="register-main">
        <section>
          <div className="register-card">
            <h3 className="section-title">สมัครสมาชิก</h3>

            {/* =================================================
                            SERVER MESSAGE
                        ================================================== */}

            {serverMessage && (
              <div
                className={`
                                    server-message
                                    ${serverMessageType}
                                `}
              >
                {serverMessage}
              </div>
            )}

            <form onSubmit={handleRegister}>
              <div className="form-grid">
                {/* =================================================
                                    NAME
                                ================================================== */}

                <div className="field">
                  <label>ชื่อที่แสดงในแอปพลิเคชัน</label>

                  <input
                    id="regName"
                    type="text"
                    value={formData.regName}
                    onChange={handleChange}
                    placeholder="กรอกชื่อที่แสดง"
                    disabled={loading}
                  />

                  <div className="error-text">{errors.regName}</div>
                </div>

                {/* =================================================
                                    EMAIL
                                ================================================== */}

                <div className="field">
                  <label>อีเมล</label>

                  <input
                    id="regEmail"
                    type="email"
                    value={formData.regEmail}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    disabled={loading}
                  />

                  <div className="error-text">{errors.regEmail}</div>
                </div>

                {/* =================================================
                                    PASSWORD
                                ================================================== */}

                <div className="field">
                  <label>รหัสผ่าน</label>

                  <input
                    id="regPassword"
                    className="
                                            with-toggle
                                        "
                    type={showPassword ? "text" : "password"}
                    value={formData.regPassword}
                    onChange={handleChange}
                    placeholder="อย่างน้อย 6 ตัวอักษร"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="
                                            password-toggle
                                        "
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? "ซ่อน" : "แสดง"}
                  </button>

                  <div className="error-text">{errors.regPassword}</div>
                </div>

                {/* =================================================
                                    CONFIRM PASSWORD
                                ================================================== */}

                <div className="field">
                  <label>ยืนยันรหัสผ่าน</label>

                  <input
                    id="regConfirm"
                    className="
                                            with-toggle
                                        "
                    type={showConfirm ? "text" : "password"}
                    value={formData.regConfirm}
                    onChange={handleChange}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="
                                            password-toggle
                                        "
                    onClick={() => setShowConfirm(!showConfirm)}
                    disabled={loading}
                  >
                    {showConfirm ? "ซ่อน" : "แสดง"}
                  </button>

                  <div className="error-text">{errors.regConfirm}</div>
                </div>
              </div>

              {/* =================================================
                                ACTIONS
                            ================================================== */}

              <div className="actions">
                <button
                  type="submit"
                  className="
                                        btn
                                        btn-primary
                                    "
                  disabled={loading}
                >
                  {loading ? "กำลังสร้างบัญชี..." : "สร้างบัญชีผู้ใช้"}
                </button>

                <button
                  type="button"
                  className="
                                        btn
                                        btn-secondary
                                    "
                  onClick={handleReset}
                  disabled={loading}
                >
                  ล้างข้อมูล
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default RegisterPage;
