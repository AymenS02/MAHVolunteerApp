import axios from "axios";
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

export default api;
