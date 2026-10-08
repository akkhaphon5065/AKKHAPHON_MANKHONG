import { apiGet } from './api';

export async function getDashboard() {
  return apiGet('/dashboard');
}
