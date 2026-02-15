import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT from secure store
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) {
          return Promise.reject(error);
        }
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        await SecureStore.setItemAsync('accessToken', data.accessToken);
        await SecureStore.setItemAsync('refreshToken', data.refreshToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authApi = {
  sendMagicLink: (email: string) =>
    apiClient.post('/auth/magic-link', { email }),

  verifyMagicLink: (token: string) =>
    apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; displayName: string };
      isNewUser: boolean;
    }>('/auth/verify', { token }),

  getProfile: () =>
    apiClient.get<{ id: string; email: string; displayName: string; timezone: string }>('/auth/me'),

  updateProfile: (data: { displayName?: string; timezone?: string }) =>
    apiClient.patch('/auth/me', data),
};

// Families API
export const familiesApi = {
  create: (data: { name?: string; timezone: string }) =>
    apiClient.post('/families', data),

  getFamily: (familyId: string) =>
    apiClient.get(`/families/${familyId}`),

  updateSettings: (familyId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/families/${familyId}/settings`, data),

  invite: (familyId: string, data: { email: string; role: string; label: string }) =>
    apiClient.post(`/families/${familyId}/invite`, data),

  acceptInvite: (token: string) =>
    apiClient.post('/families/accept-invite', { token }),

  getMembers: (familyId: string) =>
    apiClient.get(`/families/${familyId}/members`),
};

// Calendar API
export const calendarApi = {
  getCalendar: (familyId: string, start: string, end: string) =>
    apiClient.get(`/families/${familyId}/calendar`, { params: { start, end } }),

  getActiveSchedule: (familyId: string) =>
    apiClient.get(`/families/${familyId}/schedules/active`),

  generateSchedule: (familyId: string, options?: {
    horizonStart?: string;
    horizonEnd?: string;
    weekendDefinition?: string;
    daycareExchangeDays?: number[];
  }) =>
    apiClient.post(`/families/${familyId}/schedules/generate`, options || {}),
};

// Metrics API
export const metricsApi = {
  getToday: (familyId: string) =>
    apiClient.get(`/families/${familyId}/today`),

  getLedger: (familyId: string, windows?: string[]) =>
    apiClient.get(`/families/${familyId}/ledger`, {
      params: windows ? { windows: windows.join(',') } : {},
    }),

  getStability: (familyId: string, start: string, end: string) =>
    apiClient.get(`/families/${familyId}/stability`, { params: { start, end } }),
};

// Constraints API
export const constraintsApi = {
  getConstraints: (familyId: string) =>
    apiClient.get(`/families/${familyId}/constraints`),

  addConstraint: (familyId: string, data: {
    type: string;
    hardness: string;
    weight: number;
    owner: string;
    parameters: Record<string, unknown>;
  }) =>
    apiClient.post(`/families/${familyId}/constraints`, data),

  updateConstraint: (familyId: string, constraintId: string, data: Record<string, unknown>) =>
    apiClient.patch(`/families/${familyId}/constraints/${constraintId}`, data),

  removeConstraint: (familyId: string, constraintId: string) =>
    apiClient.delete(`/families/${familyId}/constraints/${constraintId}`),

  validate: (familyId: string) =>
    apiClient.post(`/families/${familyId}/constraints/validate`),
};

// Requests API
export const requestsApi = {
  list: (familyId: string, status?: string) =>
    apiClient.get(`/families/${familyId}/requests`, {
      params: status ? { status } : {},
    }),

  get: (familyId: string, requestId: string) =>
    apiClient.get(`/families/${familyId}/requests/${requestId}`),

  create: (familyId: string, data: {
    userId: string;
    type: string;
    dates: string[];
    reasonTag?: string;
    reasonNote?: string;
    urgency?: string;
  }) =>
    apiClient.post(`/families/${familyId}/requests`, data),

  cancel: (familyId: string, requestId: string, userId: string) =>
    apiClient.post(`/families/${familyId}/requests/${requestId}/cancel`, { userId }),

  impactPreview: (familyId: string, dates: string[]) =>
    apiClient.post(`/families/${familyId}/requests/impact-preview`, { dates }),

  getBudget: (familyId: string, userId: string) =>
    apiClient.get(`/families/${familyId}/requests/budget`, { params: { userId } }),
};

// Proposals API
export const proposalsApi = {
  generate: (familyId: string, requestId: string) =>
    apiClient.post(`/families/${familyId}/proposals/generate`, { requestId }),

  get: (familyId: string, requestId: string) =>
    apiClient.get(`/families/${familyId}/proposals/${requestId}`),

  accept: (familyId: string, optionId: string, userId: string) =>
    apiClient.post(`/families/${familyId}/proposals/${optionId}/accept`, { userId }),

  decline: (familyId: string, requestId: string, userId: string) =>
    apiClient.post(`/families/${familyId}/proposals/${requestId}/decline`, { userId }),
};
