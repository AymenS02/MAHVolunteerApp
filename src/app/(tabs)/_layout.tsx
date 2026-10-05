import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type IconProps = {
  color: ColorValue;
  size: number;
  focused: boolean;
};

function tabIcon(active: IconName, inactive: IconName) {
  // eslint-disable-next-line react/display-name
  return ({ color, size, focused }: IconProps) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color} />
  );
}

export default function TabsLayout() {
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={{
        // header
        headerShadowVisible: false,
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitleStyle: { color: "#111827", fontSize: 17, fontWeight: "600" },

        // tab bar
        tabBarActiveTintColor: "#15803d",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f3f4f6",
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="events"
        options={{
          title: "Events",
          tabBarIcon: tabIcon("calendar", "calendar-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: tabIcon("person", "person-outline"),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: "Admin",
          tabBarIcon: tabIcon("shield-checkmark", "shield-checkmark-outline"),
          href: user?.role === "admin" ? undefined : null,
        }}
      />
    </Tabs>
  );
}
