import axios, { isAxiosError } from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.2.56:5000/api";
console.log("API URL:", API_URL);

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("auth_token");

  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }

  return config;
});

// A 401 from these means wrong credentials, not an expired session.
const CREDENTIAL_ROUTES = ["/auth/login", "/auth/register"];

let onUnauthorized: (() => void) | null = null;

// AuthProvider registers this so any 401 signs the user out.
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

api.interceptors.response.use(undefined, (error) => {
  if (
    isAxiosError(error) &&
    error.response?.status === 401 &&
    !CREDENTIAL_ROUTES.includes(error.config?.url ?? "")
  ) {
    onUnauthorized?.();
    // Screens that show the error message get a useful one.
    error.response.data = {
      message: "Your session expired. Please log in again.",
    };
  }

  return Promise.reject(error);
});

export default api;
