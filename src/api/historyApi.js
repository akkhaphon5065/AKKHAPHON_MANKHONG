import {
  apiDelete,
  apiGet,
} from "./api";

// =========================================================
// MY HISTORY
// GET /api/history/mine
// =========================================================

export async function getMyHistory() {
  return apiGet(
    "/history/mine",
  );
}

// =========================================================
// ALL HISTORY
// GET /api/history/all
// ADMIN ONLY
// =========================================================

export async function getAllHistory() {
  return apiGet(
    "/history/all",
  );
}

// =========================================================
// CLEAR ALL HISTORY
// DELETE /api/history/all
// ADMIN ONLY
// =========================================================

export async function clearAllHistory() {
  return apiDelete(
    "/history/all",
  );
}