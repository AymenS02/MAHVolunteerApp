import { homeHref, useAuth } from "@/context/AuthContext";
import { Redirect, router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function WelcomeScreen() {
  const { user } = useAuth();

  if (user) {
    return <Redirect href={homeHref(user)} />;
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-gray-900">MAH Volunteer</Text>
      <Text className="mt-2 text-gray-500">
        Serve the community and track your volunteer hours.
      </Text>

      <Pressable
        onPress={() => router.push("/register")}
        className="mt-10 rounded-lg bg-green-700 p-4"
      >
        <Text className="text-center font-semibold text-white">Create Account</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push("/login")}
        className="mt-3 rounded-lg border border-gray-200 p-4"
      >
        <Text className="text-center font-semibold text-gray-900">Login</Text>
      </Pressable>
    </View>
  );
}
