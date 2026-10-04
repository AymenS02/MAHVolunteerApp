import { useAuth } from "@/context/AuthContext";
import { Link, Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)/events" />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      await login(email.trim().toLowerCase(), password);
      router.replace("/(tabs)/events");
    } catch (error: any) {
      Alert.alert("Login failed", error.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-center bg-white px-6"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text className="text-3xl font-bold text-gray-900">Login</Text>
      <Text className="mt-2 text-gray-500">Welcome back to MAH Volunteer</Text>

      <View className="mt-8 gap-4">
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          className="rounded-lg border border-gray-200 p-4 text-gray-900"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Password"
          className="rounded-lg border border-gray-200 p-4 text-gray-900"
        />
      </View>

      <Pressable
        onPress={handleLogin}
        disabled={loading}
        className="mt-6 rounded-lg bg-green-700 p-4"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-center font-semibold text-white">Login</Text>
        )}
      </Pressable>

      <Link href="/register" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-gray-500">
            Don&apos;t have an account?
            <Text className="font-semibold text-green-700"> Register</Text>
          </Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
