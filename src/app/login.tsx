import Button from "@/components/Button";
import { homeHref, useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { Link, Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (user) {
    return <Redirect href={homeHref(user)} />;
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      const signedIn = await login(email.trim().toLowerCase(), password);
      router.replace(homeHref(signedIn));
    } catch (error: any) {
      Alert.alert(
        "Couldn't log in",
        error.response?.data?.message || "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-sm font-semibold text-green-700">
            MAH Volunteer
          </Text>
          <Text accessibilityRole="header" className="mt-3 text-4xl font-semibold text-gray-900">
            Welcome back
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            Log in to see events and track your hours.
          </Text>

          <View className="mt-10 gap-5">
            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="Email"
                placeholder="you@example.com"
                placeholderTextColor="#6b7280"
                className="rounded-xl bg-gray-50 px-4 py-3.5 text-base text-gray-900"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">
                Password
              </Text>
              <View className="justify-center">
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                  placeholder="Your password"
                  placeholderTextColor="#6b7280"
                  className="rounded-xl bg-gray-50 px-4 py-3.5 pr-12 text-base text-gray-900"
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  hitSlop={12}
                  className="absolute right-4"
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6b7280"
                  />
                </Pressable>
              </View>
            </View>
          </View>

          <View className="mt-8">
            <Button title="Log in" onPress={handleLogin} loading={loading} />
          </View>

          <Link href="/register" asChild>
            <Pressable
              className="mt-6 min-h-[44px] justify-center py-2"
              accessibilityRole="link"
            >
              <Text className="text-center text-gray-500">
                New here?
                <Text className="font-semibold text-green-700">
                  {" "}
                  Create an account
                </Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
