// =========================================================
// src/api/api.js
// OCRThai Plus
//
// FRONTEND API CORE
// ---------------------------------------------------------
// รองรับ:
// GET
// POST JSON
// POST FormData
// PUT JSON
// PUT FormData
// PATCH JSON
// DELETE
//
// Auth:
// Authorization: Bearer JWT
// =========================================================

export const API_BASE_URL = (
  process.env.REACT_APP_API_URL ||
  "http://localhost:5000/api"
).replace(/\/+$/, "");

// =========================================================
// TOKEN
// =========================================================

export function getToken() {
  try {
    return (
      localStorage.getItem(
        "userToken",
      ) || ""
    );
  } catch (error) {
    console.error(
      "GET TOKEN ERROR:",
      error,
    );

    return "";
  }
}

// =========================================================
// SESSION
// =========================================================

export function getSession() {
  try {
    return JSON.parse(
      localStorage.getItem(
        "ocrthai_session",
      ) || "null",
    );
  } catch (error) {
    console.error(
      "GET SESSION ERROR:",
      error,
    );

    return null;
  }
}

// =========================================================
// SAVE SESSION
// =========================================================

export function saveAuthSession(
  session,
  token = null,
) {
  try {
    if (token) {
      localStorage.setItem(
        "userToken",
        String(token),
      );
    }

    if (session) {
      localStorage.setItem(
        "ocrthai_session",
        JSON.stringify(
          session,
        ),
      );
    }

    return true;
  } catch (error) {
    console.error(
      "SAVE AUTH SESSION ERROR:",
      error,
    );

    return false;
  }
}

// =========================================================
// CLEAR SESSION
// =========================================================

export function clearAuthSession() {
  try {
    localStorage.removeItem(
      "userToken",
    );

    localStorage.removeItem(
      "ocrthai_session",
    );

    return true;
  } catch (error) {
    console.error(
      "CLEAR AUTH SESSION ERROR:",
      error,
    );

    return false;
  }
}

// =========================================================
// BUILD URL
// =========================================================

function buildUrl(
  endpoint,
) {
  const cleanEndpoint =
    String(endpoint || "")
      .replace(/^\/+/, "");

  return `${API_BASE_URL}/${cleanEndpoint}`;
}

// =========================================================
// COMMON HEADERS
// =========================================================

function getAuthHeaders() {
  const token =
    getToken();

  const headers = {
    Accept:
      "application/json",
  };

  if (token) {
    headers.Authorization =
      `Bearer ${token}`;
  }

  return headers;
}

// =========================================================
// PARSE RESPONSE
// =========================================================

async function parseResponse(
  response,
) {
  const contentType =
    response.headers.get(
      "content-type",
    ) || "";

  let data = null;

  try {
    if (
      contentType.includes(
        "application/json",
      )
    ) {
      data =
        await response.json();
    } else {
      const text =
        await response.text();

      if (text) {
        try {
          data =
            JSON.parse(text);
        } catch (_) {
          data = {
            success:
              response.ok,

            message:
              text,
          };
        }
      }
    }
  } catch (error) {
    console.error(
      "PARSE RESPONSE ERROR:",
      error,
    );
  }

  if (!response.ok) {
    const error =
      new Error(
        data?.message ||
          data?.error ||
          `HTTP ${response.status}`,
      );

    error.status =
      response.status;

    error.code =
      data?.code || null;

    error.data =
      data || null;

    throw error;
  }

  return (
    data || {
      success: true,
    }
  );
}

// =========================================================
// GET
// =========================================================

export async function apiGet(
  endpoint,
  options = {},
) {
  let response;

  try {
    response =
      await fetch(
        buildUrl(endpoint),
        {
          ...options,

          method:
            "GET",

          headers: {
            ...getAuthHeaders(),
            ...(options.headers ||
              {}),
          },
        },
      );
  } catch (error) {
    const networkError =
      new Error(
        "ไม่สามารถเชื่อมต่อ Backend ได้",
      );

    networkError.status =
      0;

    networkError.data =
      error;

    throw networkError;
  }

  return parseResponse(
    response,
  );
}

// =========================================================
// POST
// =========================================================

export async function apiPost(
  endpoint,
  body = null,
  options = {},
) {
  const isFormData =
    typeof FormData !==
      "undefined" &&
    body instanceof
      FormData;

  const headers = {
    ...getAuthHeaders(),
    ...(options.headers ||
      {}),
  };

  let requestBody =
    body;

  if (isFormData) {
    delete headers[
      "Content-Type"
    ];

    delete headers[
      "content-type"
    ];
  } else if (
    body !== null &&
    body !== undefined
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";

    requestBody =
      JSON.stringify(
        body,
      );
  }

  let response;

  try {
    response =
      await fetch(
        buildUrl(endpoint),
        {
          ...options,

          method:
            "POST",

          headers,

          body:
            requestBody,
        },
      );
  } catch (error) {
    const networkError =
      new Error(
        "ไม่สามารถเชื่อมต่อ Backend ได้",
      );

    networkError.status =
      0;

    networkError.data =
      error;

    throw networkError;
  }

  return parseResponse(
    response,
  );
}

// =========================================================
// PUT
// =========================================================

export async function apiPut(
  endpoint,
  body = null,
  options = {},
) {
  const isFormData =
    typeof FormData !==
      "undefined" &&
    body instanceof
      FormData;

  const headers = {
    ...getAuthHeaders(),
    ...(options.headers ||
      {}),
  };

  let requestBody =
    body;

  if (isFormData) {
    delete headers[
      "Content-Type"
    ];

    delete headers[
      "content-type"
    ];
  } else if (
    body !== null &&
    body !== undefined
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";

    requestBody =
      JSON.stringify(
        body,
      );
  }

  let response;

  try {
    response =
      await fetch(
        buildUrl(endpoint),
        {
          ...options,

          method:
            "PUT",

          headers,

          body:
            requestBody,
        },
      );
  } catch (error) {
    const networkError =
      new Error(
        "ไม่สามารถเชื่อมต่อ Backend ได้",
      );

    networkError.status =
      0;

    networkError.data =
      error;

    throw networkError;
  }

  return parseResponse(
    response,
  );
}

// =========================================================
// PATCH
// =========================================================

export async function apiPatch(
  endpoint,
  body = null,
  options = {},
) {
  const isFormData =
    typeof FormData !==
      "undefined" &&
    body instanceof
      FormData;

  const headers = {
    ...getAuthHeaders(),
    ...(options.headers ||
      {}),
  };

  let requestBody =
    body;

  if (isFormData) {
    delete headers[
      "Content-Type"
    ];

    delete headers[
      "content-type"
    ];
  } else if (
    body !== null &&
    body !== undefined
  ) {
    headers[
      "Content-Type"
    ] =
      "application/json";

    requestBody =
      JSON.stringify(
        body,
      );
  }

  let response;

  try {
    response =
      await fetch(
        buildUrl(endpoint),
        {
          ...options,

          method:
            "PATCH",

          headers,

          body:
            requestBody,
        },
      );
  } catch (error) {
    const networkError =
      new Error(
        "ไม่สามารถเชื่อมต่อ Backend ได้",
      );

    networkError.status =
      0;

    networkError.data =
      error;

    throw networkError;
  }

  return parseResponse(
    response,
  );
}

// =========================================================
// DELETE
// =========================================================

export async function apiDelete(
  endpoint,
  options = {},
) {
  let response;

  try {
    response =
      await fetch(
        buildUrl(endpoint),
        {
          ...options,

          method:
            "DELETE",

          headers: {
            ...getAuthHeaders(),
            ...(options.headers ||
              {}),
          },
        },
      );
  } catch (error) {
    const networkError =
      new Error(
        "ไม่สามารถเชื่อมต่อ Backend ได้",
      );

    networkError.status =
      0;

    networkError.data =
      error;

    throw networkError;
  }

  return parseResponse(
    response,
  );
}

// =========================================================
// DEFAULT
// =========================================================

const api = {
  API_BASE_URL,

  getToken,
  getSession,

  saveAuthSession,
  clearAuthSession,

  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
};

export default api;