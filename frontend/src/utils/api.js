import axios from 'axios';

// ── Base URL ─────────────────────────────────────────────────────────────────
// REACT_APP_API_URL should be the backend root (no /api suffix)
// e.g. "https://chatiq-production.up.railway.app" or "http://localhost:3001"
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Safety: warn if the URL looks wrong
if (!API_URL.startsWith('http')) {
  console.error('[ChatIQ] ⚠️ REACT_APP_API_URL is missing or invalid:', API_URL);
}
if (API_URL.includes('.up.instagram')) {
  console.error('[ChatIQ] ⚠️ API URL contains typo ".up.instagram" — should be ".up.railway.app"');
}
if (process.env.NODE_ENV === 'development') {
  console.log('[ChatIQ] API base URL:', API_URL);
}

// ── Axios Instance ───────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chatiq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — but NOT on /auth/me (prevents redirect loops)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const requestUrl = err.config?.url || '';
      const isAuthMeRequest = requestUrl.includes('/auth/me');
      if (!isAuthMeRequest) {
        localStorage.removeItem('chatiq_token');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  getInstagramAuthUrl: () => api.get('/api/auth/instagram'),
  connectInstagram: (accessToken) => api.post('/api/auth/instagram/connect', { accessToken }),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
  refreshToken: (token) => api.post('/api/auth/refresh', { token }),
};

// ── Instagram ────────────────────────────────────────────────────────────────
export const instagramApi = {
  getAccounts: () => api.get('/api/instagram/accounts'),
  deleteAccount: (id) => api.delete(`/api/instagram/accounts/${id}`),
  getPosts: (accountId, limit = 20) =>
    api.get(`/api/instagram/accounts/${accountId}/posts?limit=${limit}`),
  validateAccount: (accountId) =>
    api.get(`/api/instagram/accounts/${accountId}/validate`),
  subscribeWebhook: (accountId) =>
    api.post(`/api/instagram/accounts/${accountId}/subscribe`),
  updateMessageAccess: (accountId, enabled) =>
    api.patch(`/api/instagram/accounts/${accountId}/message-access`, { enabled }),
};

// ── Automations ──────────────────────────────────────────────────────────────
export const automationsApi = {
  list: () => api.get('/api/automations'),
  create: (data) => api.post('/api/automations', data),
  update: (id, data) => api.put(`/api/automations/${id}`, data),
  toggle: (id) => api.patch(`/api/automations/${id}/toggle`),
  delete: (id) => api.delete(`/api/automations/${id}`),
  getLogs: (id, page = 1) => api.get(`/api/automations/${id}/logs?page=${page}`),
};

// ── Dashboard ────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/api/dashboard/stats'),
  getActivity: () => api.get('/api/dashboard/activity'),
};
