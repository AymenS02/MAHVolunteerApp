import * as SecureStore from "expo-secure-store";
import { create } from "axios";

const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("auth_token");

  if (token) {
    config.headers.Authorization = "Bearer " + token;
  }

  return config;
});

export default api;
