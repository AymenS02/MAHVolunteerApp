import { Tabs } from "expo-router";
import { Text } from "react-native";

const icon = (emoji: string) => () => <Text className="text-xl">{emoji}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#059669" }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: icon("🏠") }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: "Events", tabBarIcon: icon("📅") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: icon("👤") }}
      />
    </Tabs>
  );
}
