import { AuthProvider, needsProfile, useAuth } from "@/context/AuthContext";
import { SnackbarProvider, useSnackbar } from "@/context/SnackbarContext";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { Stack } from "expo-router";
import { useEffect } from "react";
import "../../global.css";

function AppNavigator() {
  const { user } = useAuth();
  const { hide } = useSnackbar();

  // An undo from the previous session can't run without a token.
  useEffect(() => {
    if (!user) hide();
  }, [user, hide]);

  const profileMissing = needsProfile(user);
  usePushNotifications(user, !profileMissing);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user && !profileMissing}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events" />
        <Stack.Screen name="admin" />
        <Stack.Screen name="profile" />
      </Stack.Protected>

      {/* Older accounts are held here until they add a date of birth. */}
      <Stack.Protected guard={profileMissing}>
        <Stack.Screen name="complete-profile" />
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
      <SnackbarProvider>
        <AppNavigator />
      </SnackbarProvider>
    </AuthProvider>
  );
}
