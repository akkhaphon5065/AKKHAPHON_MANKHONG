import { apiDelete, apiGet, apiPatch, apiPut } from './api';

export async function getAdminDashboard() {
  return apiGet('/admin/dashboard');
}

export async function getAdminUsers() {
  return apiGet('/admin/users');
}

export async function updateAdminUserStatus(userId, status) {
  return apiPatch(`/admin/users/${userId}/status`, { status });
}

export async function deleteAdminUser(userId) {
  return apiDelete(`/admin/users/${userId}`);
}

export async function changeAdminPassword(currentPassword, newPassword) {
  return apiPut('/admin/password', { currentPassword, newPassword });
}

export async function getSystemStatus() {
  return apiGet('/admin/system-status');
}

export async function updateSystemStatus(status) {
  return apiPut('/admin/system-status', { status });
}

export async function exportAdminData() {
  return apiGet('/admin/export');
}
