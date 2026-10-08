// =========================================================
// src/App.jsx
// OCRThai Plus
//
// ROUTE STRUCTURE
// ---------------------------------------------------------
// Public
//   /
//   /dashboard
//   /user-login
//   /login
//   /register
//   /admin-login
//   /adminlogin
//
// User
//   /ocr
//   /OCRThaiApp1
//   /translate
//   /history
//   /profile
//
// Admin
//   /admin-dashboard
//   /AdminDashboardPage
//   /user-report
//   /usage-report
// =========================================================

import React from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// =========================================================
// PAGES
// =========================================================

import DashboardPage from "./DashboardPage";
import UserLoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

import OCRThaiApp1 from "./OCRThaiApp1";
import TranslatePage from "./TranslatePage";
import HistoryPage from "./HistoryPage";
import ProfilePage from "./ProfilePage";

import AdminLoginPage from "./AdminLoginPage";
import AdminDashboardPage from "./AdminDashboardPage";
import UserReportPage from "./UserReportPage";
import UsageReportPage from "./UsageReportPage";

// =========================================================
// APP
// =========================================================

function App() {
  return (
    <Router>
      <Routes>
        {/* =================================================
            PUBLIC
        ================================================= */}

        <Route path="/" element={<DashboardPage />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/user-login" element={<UserLoginPage />} />

        {/* Alias เก่า */}
        <Route path="/login" element={<UserLoginPage />} />

        <Route path="/register" element={<RegisterPage />} />

        {/* =================================================
            ADMIN LOGIN
        ================================================= */}

        <Route path="/admin-login" element={<AdminLoginPage />} />

        {/* Alias เพื่อรองรับโค้ดเก่า */}
        <Route
          path="/adminlogin"
          element={<Navigate to="/admin-login" replace />}
        />

        {/* =================================================
            MAIN USER FEATURES
        ================================================= */}

        <Route path="/ocr" element={<OCRThaiApp1 />} />

        {/* Alias เก่า */}
        <Route path="/OCRThaiApp1" element={<Navigate to="/ocr" replace />} />

        <Route path="/translate" element={<TranslatePage />} />

        <Route path="/history" element={<HistoryPage />} />

        <Route path="/profile" element={<ProfilePage />} />

        {/* =================================================
            ADMIN
        ================================================= */}

        <Route path="/admin-dashboard" element={<AdminDashboardPage />} />

        {/* Alias เก่า */}
        <Route
          path="/AdminDashboardPage"
          element={<Navigate to="/admin-dashboard" replace />}
        />

        <Route path="/user-report" element={<UserReportPage />} />

        <Route path="/usage-report" element={<UsageReportPage />} />

        {/* =================================================
            UNKNOWN URL
        ================================================= */}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
