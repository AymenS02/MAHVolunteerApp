import { useAuth } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#15803d",
        headerTitleStyle: { color: "#111827" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: () => <Text className="text-xl">📅</Text>,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: () => <Text className="text-xl">👤</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: () => <Text className="text-xl">🛠️</Text>,
          href: user?.role === "admin" ? undefined : null,
        }}
      />
    </Tabs>
  );
}
