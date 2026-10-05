import api, { setUnauthorizedHandler } from "@/constants/api";
import { User } from "@/types";
import { isAxiosError } from "axios";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Text, View } from "react-native";

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  gender: "brother" | "sister";
  highschoolStudent: boolean;
  dateOfBirth: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  restoring: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  // Re-fetches the user, e.g. after an admin changed their volunteer hours.
  refreshUser: () => Promise<void>;
  // One-time, for accounts created before date of birth was collected.
  setDateOfBirth: (dateOfBirth: string) => Promise<void>;
  updateProfile: (fields: ProfileFields) => Promise<void>;
  // Signs out other devices; this one keeps working with the new token.
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
};

type ProfileFields = { firstName: string; lastName: string; phone: string };

// Accounts created before date of birth was collected must add it first.
export const needsProfile = (user: User | null) => !!user && !user.dateOfBirth;

// Where a signed-in user belongs.
export const homeHref = (user: User) =>
  needsProfile(user) ? "/complete-profile" : "/(tabs)/events";

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
      } catch (error) {
        // Only a rejected token ends the session. Offline or server errors
        // keep it so the next launch can sign in again automatically.
        if (isAxiosError(error) && error.response?.status === 401) {
          await SecureStore.deleteItemAsync("auth_token");
        }
        setToken(null);
        setUser(null);
      } finally {
        setRestoring(false);
      }
    };

    restore();
  }, []);

  // Any 401 outside login/register means the token is no longer valid.
  const signedInRef = useRef(false);
  const sessionExpiredRef = useRef(false);

  useEffect(() => {
    signedInRef.current = !!user;

    // Navigate after the render that drops the user, so the protected-route
    // guard has already switched to the signed-out screens.
    if (!user && sessionExpiredRef.current) {
      sessionExpiredRef.current = false;
      router.replace("/login");
    }
  }, [user]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Nobody signed in (startup check, or already handled): nothing to do.
      if (!signedInRef.current) return;
      signedInRef.current = false;
      sessionExpiredRef.current = true;
      SecureStore.deleteItemAsync("auth_token").finally(() => {
        setToken(null);
        setUser(null);
      });
    });
    return () => setUnauthorizedHandler(null);
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
        return data.user;
      },
      register: async (input) => {
        const { data } = await api.post<{ token: string; user: User }>(
          "/auth/register",
          input,
        );

        await saveSession(data.token);
        setToken(data.token);
        setUser(data.user);
        return data.user;
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
      setDateOfBirth: async (dateOfBirth) => {
        const { data } = await api.put<{ user: User }>(
          "/users/me/date-of-birth",
          { dateOfBirth },
        );
        setUser(data.user);
      },
      updateProfile: async (fields) => {
        const { data } = await api.patch<{ user: User }>("/users/me", fields);
        setUser(data.user);
      },
      changePassword: async (currentPassword, newPassword) => {
        const { data } = await api.put<{ token: string }>(
          "/users/me/password",
          { currentPassword, newPassword },
        );
        await saveSession(data.token);
        setToken(data.token);
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
