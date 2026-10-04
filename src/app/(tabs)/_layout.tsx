import { useAuth } from "@/context/AuthContext";
import { Tabs } from "expo-router";
import { Text } from "react-native";

const icon = (emoji: string) => () => <Text className="text-xl">{emoji}</Text>;

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
        options={{ title: "Events", tabBarIcon: icon("📅") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon("👤") }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: icon("🛠️"),
          href: user?.role === "admin" ? undefined : null,
        }}
      />
    </Tabs>
  );
}
