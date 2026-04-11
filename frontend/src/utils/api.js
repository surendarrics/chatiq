import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Debug: log the resolved API URL on startup (dev only)
if (process.env.NODE_ENV === 'development') {
  console.log('[ChatIQ] API base URL:', API_URL);
}

// Validate API_URL to catch misconfigurations early
if (API_URL.includes('.up.instagram') || !API_URL.startsWith('http')) {
  console.error('[ChatIQ] ⚠️ Invalid API URL detected:', API_URL);
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30s timeout to avoid hanging requests
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('chatiq_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — but NOT on /auth/me (to prevent redirect loops)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const requestUrl = err.config?.url || '';
      // Don't redirect to '/' if the failed request is /auth/me — that's
      // expected when the token is invalid/expired. AuthContext handles it.
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
  getInstagramAuthUrl: () => api.get('/auth/instagram'),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
};

// ── Instagram ─────────────────────────────────────────────────────────────────
export const instagramApi = {
  getAccounts: () => api.get('/instagram/accounts'),
  deleteAccount: (id) => api.delete(`/instagram/accounts/${id}`),
  getPosts: (accountId, limit = 20) =>
    api.get(`/instagram/accounts/${accountId}/posts?limit=${limit}`),
  updateMessageAccess: (accountId, enabled) =>
    api.patch(`/instagram/accounts/${accountId}/message-access`, { enabled }),
};

// ── Automations ───────────────────────────────────────────────────────────────
export const automationsApi = {
  list: () => api.get('/automations'),
  create: (data) => api.post('/automations', data),
  update: (id, data) => api.put(`/automations/${id}`, data),
  toggle: (id) => api.patch(`/automations/${id}/toggle`),
  delete: (id) => api.delete(`/automations/${id}`),
  getLogs: (id, page = 1) => api.get(`/automations/${id}/logs?page=${page}`),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
  getActivity: () => api.get('/dashboard/activity'),
};
