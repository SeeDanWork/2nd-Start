import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  // TODO: Attach JWT from secure store in Phase 1
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // TODO: Handle 401 → refresh token in Phase 1
    return Promise.reject(error);
  },
);
