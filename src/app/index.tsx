import Button from "@/components/Button";
import { homeHref, useAuth } from "@/context/AuthContext";
import { Redirect, router } from "expo-router";
import { Text, View } from "react-native";

export default function WelcomeScreen() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href={homeHref(user)} />;
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text
        accessibilityRole="header"
        className="text-4xl font-semibold text-gray-900"
      >
        MAH Volunteer
      </Text>
      <Text className="mt-2 text-base text-gray-500">
        Serve the community and track your volunteer hours.
      </Text>

      <View className="mt-10 gap-3">
        <Button title="Create account" onPress={() => router.push("/register")} />
        <Button
          title="Log in"
          variant="outline"
          onPress={() => router.push("/login")}
        />
      </View>
    </View>
  );
}
