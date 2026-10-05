import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Stack } from "expo-router";
import "../../global.css";

function AppNavigator() {
  const { user } = useAuth();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events" />
        <Stack.Screen name="admin" />
      </Stack.Protected>

      <Stack.Protected guard={!user}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
