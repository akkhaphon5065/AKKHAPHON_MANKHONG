// =========================================================
// src/api/authApi.js
// OCRThai Plus
// =========================================================

import {
  apiGet,
  apiPost,
  apiPut,
  getToken,
  saveAuthSession,
  clearAuthSession,
} from "./api";

// =========================================================
// NORMALIZE USER
// =========================================================

function normalizeUser(
  user,
) {
  if (!user) {
    return null;
  }

  return {
    ...user,

    user_id:
      user.user_id,

    id:
      user.user_id,

    name:
      user.name ||
      user.display_name ||
      "",

    display_name:
      user.display_name ||
      user.name ||
      "",

    email:
      user.email ||
      "",

    role:
      user.role ||
      "user",

    status:
      user.status ||
      "Active",

    privacy_status:
      user.privacy_status,

    online:
      Boolean(
        user.online,
      ),

    last_login_at:
      user.last_login_at,

    last_seen_at:
      user.last_seen_at,

    created_at:
      user.created_at,

    updated_at:
      user.updated_at,
  };
}

// =========================================================
// REGISTER
// =========================================================

export async function registerUser(
  name,
  email,
  password,
) {
  return apiPost(
    "/auth/register",
    {
      displayName:
        name,
      name,
      email,
      password,
    },
  );
}

// =========================================================
// LOGIN
// =========================================================

export async function loginUser(
  email,
  password,
) {
  const result =
    await apiPost(
      "/auth/login",
      {
        email,
        password,
      },
    );

  if (
    result?.success &&
    result?.token &&
    result?.user
  ) {
    const user =
      normalizeUser(
        result.user,
      );

    saveAuthSession(
      user,
      result.token,
    );

    return {
      ...result,
      user,
    };
  }

  return result;
}

// =========================================================
// GET CURRENT USER
// =========================================================

export async function getCurrentUser() {
  const token =
    getToken();

  if (!token) {
    const error =
      new Error(
        "กรุณาเข้าสู่ระบบ",
      );

    error.status =
      401;

    throw error;
  }

  const result =
    await apiGet(
      "/auth/me",
    );

  if (
    result?.success &&
    result?.user
  ) {
    const user =
      normalizeUser(
        result.user,
      );

    localStorage.setItem(
      "ocrthai_session",
      JSON.stringify(
        user,
      ),
    );

    return {
      ...result,
      user,
    };
  }

  return result;
}

// =========================================================
// UPDATE PROFILE
// =========================================================

export async function updateProfile(
  name,
  email,
  password = "",
) {
  const body = {
    displayName:
      name,
    name,
    email,
  };

  if (
    String(
      password ||
        "",
    ).trim()
  ) {
    body.password =
      password;
  }

  const result =
    await apiPut(
      "/auth/profile",
      body,
    );

  if (
    result?.success &&
    result?.user
  ) {
    const user =
      normalizeUser(
        result.user,
      );

    saveAuthSession(
      user,
      result.token ||
        null,
    );

    return {
      ...result,
      user,
    };
  }

  return result;
}

// =========================================================
// LOGOUT
// =========================================================

export async function logoutUser() {
  const token =
    getToken();

  try {
    if (token) {
      await apiPost(
        "/auth/logout",
        null,
      );
    }
  } catch (error) {
    console.warn(
      "LOGOUT API ERROR:",
      error,
    );
  } finally {
    clearAuthSession();
  }

  return {
    success:
      true,
    message:
      "ออกจากระบบสำเร็จ",
  };
}

// =========================================================
// SESSION
// =========================================================

export function getSavedSession() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "ocrthai_session",
      ) || "null",
    );
  } catch {
    return null;
  }
}

// =========================================================
// AUTH CHECK
// =========================================================

export function isAuthenticated() {
  return Boolean(
    getToken(),
  );
}