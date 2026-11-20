import axios from 'axios';

const getApiBaseUrl = () => {
  const configured =
    (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_API_URL || process.env.VITE_API_URL)) ||
    'http://localhost:5000/api';
  if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' && configured.includes('localhost')) {
    return configured.replace('localhost', '127.0.0.1');
  }
  return configured;
};

const client = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: Attach JWT token only if caller hasn't explicitly provided one
client.interceptors.request.use(
  (config) => {
    if (!config.headers.Authorization && typeof window !== 'undefined') {
      const token = localStorage.getItem('parksync_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Extract response data and handle auth errors
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
      message = 'Unable to connect to the ParkSync backend server (Network Error). Please ensure the backend server is running at http://localhost:5000.';
    } else if (!message) {
      message = 'An unexpected network error occurred';
    }

    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear token if expired or invalid, but do not interrupt auth flow pages
      if (
        window.location.pathname !== '/login' &&
        window.location.pathname !== '/register' &&
        window.location.pathname !== '/verify-otp'
      ) {
        localStorage.removeItem('parksync_token');
        localStorage.removeItem('parksync_user');
      }
    }

    return Promise.reject(new Error(message));
  }
);

export const authApi = {
  login: (credentials) => client.post('/auth/login', credentials),
  register: (data) => client.post('/auth/register', data),
  sync: (data, token) =>
    client.post('/auth/sync', data || {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  getProfile: () => client.get('/auth/profile'),
};

export const areasApi = {
  getAll: () => client.get('/areas'),
  getById: (id) => client.get(`/areas/${id}`),
  create: (data) => client.post('/areas', data),
  update: (id, data) => client.put(`/areas/${id}`, data),
  delete: (id) => client.delete(`/areas/${id}`),
};

export const slotsApi = {
  getAll: (params) => client.get('/slots', { params }),
  getAvailable: (params) => client.get('/slots/available', { params }),
  create: (data) => client.post('/slots', data),
  update: (id, data) => client.put(`/slots/${id}`, data),
  delete: (id) => client.delete(`/slots/${id}`),
};

export const reservationsApi = {
  create: (data) => client.post('/reservations', data),
  getMy: () => client.get('/reservations/my'),
  getAll: (params) => client.get('/reservations', { params }),
  getById: (id) => client.get(`/reservations/${id}`),
  cancel: (id, reason) => client.post(`/reservations/${id}/cancel`, { reason }),
  updateStatus: (id, status) => client.put(`/reservations/${id}/status`, { status }),
};

export const sessionsApi = {
  getAll: () => client.get('/sessions'),
  start: (data) => client.post('/sessions/start', data),
  end: (id) => client.post(`/sessions/${id}/end`),
};

export const paymentsApi = {
  getAll: () => client.get('/payments'),
  getById: (id) => client.get(`/payments/${id}`),
  getRazorpayKey: () => client.get('/payments/config/razorpay'),
  createOrder: (data) => client.post('/payments/create-order', data),
  verifyPayment: (data) => client.post('/payments/verify', data),
  reportFailure: (data) => client.post('/payments/failure', data),
  processDemoPayment: (id, paymentMethod) => client.post(`/payments/${id}/pay`, { paymentMethod }),
  getAuditLogs: () => client.get('/payments/audit'),
};

export const violationsApi = {
  getAll: () => client.get('/violations'),
  getVehicleLocation: (identifier) => client.get(`/violations/vehicle-location/${encodeURIComponent(identifier)}`),
  create: (data) => client.post('/violations', data),
  updateStatus: (id, payment_status) => client.put(`/violations/${id}/status`, { payment_status }),
  payDemo: (id) => client.post(`/violations/${id}/pay`),
};

export const vehiclesApi = {
  getAll: (params) =>
    client.get('/users/vehicles', {
      params: typeof params === 'object' && params !== null ? params : { userId: params },
    }),
  add: (data) => client.post('/users/vehicles', data),
  delete: (id) => client.delete(`/users/vehicles/${id}`),
};

export const notificationsApi = {
  getAll: () => client.get('/notifications'),
  markAsRead: (id) => client.put(`/notifications/${id}/read`),
};

export const activityLogsApi = {
  getAll: (params) => client.get('/activity-logs', { params }),
  getStats: () => client.get('/activity-logs/stats'),
};

export const dashboardApi = {
  getDriverStats: () => client.get('/dashboard/driver'),
  getAdminStats: () => client.get('/dashboard/admin'),
};

export const systemApi = {
  getHealth: () => client.get('/health'),
};

export default client;

