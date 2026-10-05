import api from "@/constants/api";
import { User } from "@/types";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  gender: "brother" | "sister";
  highschoolStudent: boolean;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  restoring: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  // Re-fetches the user, e.g. after an admin changed their volunteer hours.
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const saveSession = async (token: string) => {
  await SecureStore.setItemAsync("auth_token", token);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const savedToken = await SecureStore.getItemAsync("auth_token");

        if (!savedToken) {
          return;
        }

        setToken(savedToken);
        const { data } = await api.get<User>("/auth/me", {
          headers: { Authorization: "Bearer " + savedToken },
        });
        setUser(data);
      } catch {
        await SecureStore.deleteItemAsync("auth_token");
        setToken(null);
        setUser(null);
      } finally {
        setRestoring(false);
      }
    };

    restore();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const clearSession = async () => {
      await SecureStore.deleteItemAsync("auth_token");
      setToken(null);
      setUser(null);
    };

    return {
      user,
      token,
      restoring,
      login: async (email, password) => {
        const { data } = await api.post<{ token: string; user: User }>(
          "/auth/login",
          {
            email,
            password,
          },
        );

        await saveSession(data.token);
        setToken(data.token);
        setUser(data.user);
      },
      register: async (input) => {
        const { data } = await api.post<{ token: string; user: User }>(
          "/auth/register",
          input,
        );

        await saveSession(data.token);
        setToken(data.token);
        setUser(data.user);
      },
      logout: clearSession,
      deleteAccount: async () => {
        // The request interceptor in api.ts attaches the stored token
        await api.delete("/users/me");
        await clearSession();
      },
      refreshUser: async () => {
        const { data } = await api.get<User>("/auth/me");
        setUser(data);
      },
    };
  }, [restoring, token, user]);

  if (restoring) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
        <Text className="mt-3 text-gray-500">Loading...</Text>
      </View>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
