import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import "../../global.css";

function AppNavigator() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onAuthScreen = pathname === "/" || pathname === "/login" || pathname === "/register";
    const onProtectedScreen = pathname.startsWith("/(tabs)") || pathname.startsWith("/events") || pathname.startsWith("/admin");

    if (!user && onProtectedScreen) {
      router.replace("/");
      return;
    }

    if (user && onAuthScreen) {
      router.replace("/(tabs)/events");
    }
  }, [pathname, router, user]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}
