import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/** Unwrap NestJS TransformInterceptor envelope { data, timestamp } */
apiClient.interceptors.response.use((response) => {
  if (
    response.data &&
    typeof response.data === 'object' &&
    'data' in response.data &&
    'timestamp' in response.data
  ) {
    response.data = response.data.data;
  }
  return response;
});

/** Create a client that attaches a specific user's bearer token */
export function createAuthedClient(getToken: () => string | null) {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  client.interceptors.response.use((response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data &&
      'timestamp' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  });

  return client;
}
