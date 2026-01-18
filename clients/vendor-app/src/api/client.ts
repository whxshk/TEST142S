import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use(async (config) => {
      const token = await SecureStore.getItemAsync('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  get instance() {
    return this.client;
  }
}

export const apiClient = new ApiClient().instance;

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
};

export const transactionsApi = {
  issuePoints: (customerId: string, amount: number, deviceId: string | null, idempotencyKey: string) =>
    apiClient.post('/transactions/issue', { customerId, amount, deviceId }, {
      headers: { 'Idempotency-Key': idempotencyKey },
    }),
};
