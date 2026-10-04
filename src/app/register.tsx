import { useAuth } from "@/context/AuthContext";
import { Gender } from "@/types";
import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gender: Gender | null;
  highschoolStudent: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

const validate = (data: FormData): FormErrors => {
  const errors: FormErrors = {};

  if (data.firstName.trim().length < 2)
    errors.firstName = "First name must be at least 2 characters";
  if (data.lastName.trim().length < 2)
    errors.lastName = "Last name must be at least 2 characters";
  if (!/^\S+@\S+\.\S+$/.test(data.email.trim()))
    errors.email = "Invalid email address";
  if (data.phone.replace(/\D/g, "").length < 10)
    errors.phone = "Phone number must be at least 10 digits";
  if (data.password.length < 6)
    errors.password = "Password must be at least 6 characters";
  else if (!/[A-Z]/.test(data.password))
    errors.password = "Password must contain at least one uppercase letter";
  if (data.confirmPassword !== data.password)
    errors.confirmPassword = "Passwords do not match";
  if (!data.gender) errors.gender = "Please select Brother or Sister";

  return errors;
};

const inputClass = "border border-gray-300 rounded-lg p-4 text-gray-900";
const inputErrorClass = "border border-red-500 rounded-lg p-4 text-gray-900";

export default function Register() {
  const router = useRouter();
  const { user, register } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: null,
    highschoolStudent: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Redirect href="/(tabs)/events" />;
  }

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0 || !formData.gender) return;

    setLoading(true);
    try {
      await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        gender: formData.gender,
        highschoolStudent: formData.highschoolStudent,
      });

      router.replace("/(tabs)/events");
    } catch (error: any) {
      Alert.alert(
        "Registration failed",
        error.response?.data?.message || "Please check your details and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="mb-2 text-3xl font-bold text-gray-900">Create Account</Text>
        <Text className="mb-8 text-gray-500">Join MAH as a volunteer</Text>

        <View className="mb-4 flex-row gap-3">
          <View className="flex-1">
            <TextInput
              placeholder="First Name"
              value={formData.firstName}
              onChangeText={(text) => handleChange("firstName", text)}
              className={errors.firstName ? inputErrorClass : inputClass}
            />
            {errors.firstName && (
              <Text className="mt-1 text-xs text-red-500">{errors.firstName}</Text>
            )}
          </View>
          <View className="flex-1">
            <TextInput
              placeholder="Last Name"
              value={formData.lastName}
              onChangeText={(text) => handleChange("lastName", text)}
              className={errors.lastName ? inputErrorClass : inputClass}
            />
            {errors.lastName && (
              <Text className="mt-1 text-xs text-red-500">{errors.lastName}</Text>
            )}
          </View>
        </View>

        <View className="mb-4">
          <TextInput
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={formData.email}
            onChangeText={(text) => handleChange("email", text)}
            className={errors.email ? inputErrorClass : inputClass}
          />
          {errors.email && <Text className="mt-1 text-xs text-red-500">{errors.email}</Text>}
        </View>

        <View className="mb-4">
          <TextInput
            placeholder="Phone Number"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(text) => handleChange("phone", text)}
            className={errors.phone ? inputErrorClass : inputClass}
          />
          {errors.phone && <Text className="mt-1 text-xs text-red-500">{errors.phone}</Text>}
        </View>

        <View className="mb-4">
          <View className="relative justify-center">
            <TextInput
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={formData.password}
              onChangeText={(text) => handleChange("password", text)}
              className={`${errors.password ? inputErrorClass : inputClass} pr-16`}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              className="absolute right-4"
            >
              <Text className="text-sm font-semibold text-green-700">
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
          {errors.password ? (
            <Text className="mt-1 text-xs text-red-500">{errors.password}</Text>
          ) : (
            <Text className="mt-1 text-xs text-gray-500">
              At least 6 characters, including one uppercase letter
            </Text>
          )}
        </View>

        <View className="mb-4">
          <TextInput
            placeholder="Confirm Password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange("confirmPassword", text)}
            className={errors.confirmPassword ? inputErrorClass : inputClass}
          />
          {errors.confirmPassword && (
            <Text className="mt-1 text-xs text-red-500">{errors.confirmPassword}</Text>
          )}
        </View>

        <View className="mb-4">
          <Text className="mb-2 text-gray-900">Gender</Text>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => handleChange("gender", "brother")}
              className={`flex-1 rounded-lg border p-3 ${
                formData.gender === "brother" ? "border-green-700 bg-green-700" : "border-gray-200"
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  formData.gender === "brother" ? "text-white" : "text-gray-900"
                }`}
              >
                Brother
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleChange("gender", "sister")}
              className={`flex-1 rounded-lg border p-3 ${
                formData.gender === "sister" ? "border-green-700 bg-green-700" : "border-gray-200"
              }`}
            >
              <Text
                className={`text-center font-medium ${
                  formData.gender === "sister" ? "text-white" : "text-gray-900"
                }`}
              >
                Sister
              </Text>
            </Pressable>
          </View>
          {errors.gender && <Text className="mt-1 text-xs text-red-500">{errors.gender}</Text>}
        </View>

        <View className="mb-2 flex-row items-center justify-between rounded-lg border border-gray-300 px-4 py-3">
          <View className="flex-1 pr-4">
            <Text className="font-medium text-gray-900">I&apos;m a high school student</Text>
            <Text className="mt-0.5 text-xs text-gray-500">
              Helps us track volunteer hours for school
            </Text>
          </View>
          <Switch
            value={formData.highschoolStudent}
            onValueChange={(value) => handleChange("highschoolStudent", value)}
            trackColor={{ false: "#d1d5db", true: "#15803d" }}
            thumbColor="#ffffff"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className="mt-4 items-center rounded-lg bg-green-700 p-4"
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-center font-semibold text-white">Create Account</Text>
          )}
        </Pressable>

        <Link href="/login" asChild>
          <Pressable className="mt-6">
            <Text className="text-center text-gray-500">
              Already have an account?
              <Text className="font-semibold text-green-700"> Login</Text>
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
