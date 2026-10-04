import { Link, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
  highschoolStudent: boolean;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

// Mirrors the backend zod schema (createUserSchema) so errors match what the API would return
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

  return errors;
};

const inputClass = "border border-gray-300 rounded-lg p-4 text-gray-900";
const inputErrorClass = "border border-red-500 rounded-lg p-4 text-gray-900";

export default function Register() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    highschoolStudent: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear that field's error as soon as the user edits it
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const validationErrors = validate(formData);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    try {
      // TODO: replace the mock with the real call when the backend is hooked up:
      // await api.post("/users", {
      //   firstName: formData.firstName.trim(),
      //   lastName: formData.lastName.trim(),
      //   email: formData.email.trim().toLowerCase(),
      //   password: formData.password,
      //   phone: formData.phone.trim(),
      //   highschoolStudent: formData.highschoolStudent,
      // });
      // 409 -> setErrors({ email: "A user with this email already exists." })
      await new Promise((resolve) => setTimeout(resolve, 800));

      router.replace("/(tabs)");
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
        <Text className="text-3xl font-bold text-gray-900 mb-2">
          Create Account
        </Text>
        <Text className="text-gray-500 mb-8">Join MAH as a volunteer</Text>

        {/* Name row */}
        <View className="flex-row gap-3 mb-4">
          <View className="flex-1">
            <TextInput
              placeholder="First Name"
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              value={formData.firstName}
              onChangeText={(text) => handleChange("firstName", text)}
              className={errors.firstName ? inputErrorClass : inputClass}
            />
            {errors.firstName && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.firstName}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <TextInput
              placeholder="Last Name"
              autoCapitalize="words"
              autoComplete="family-name"
              textContentType="familyName"
              returnKeyType="next"
              value={formData.lastName}
              onChangeText={(text) => handleChange("lastName", text)}
              className={errors.lastName ? inputErrorClass : inputClass}
            />
            {errors.lastName && (
              <Text className="text-red-500 text-xs mt-1">
                {errors.lastName}
              </Text>
            )}
          </View>
        </View>

        {/* Email */}
        <View className="mb-4">
          <TextInput
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            value={formData.email}
            onChangeText={(text) => handleChange("email", text)}
            className={errors.email ? inputErrorClass : inputClass}
          />
          {errors.email && (
            <Text className="text-red-500 text-xs mt-1">{errors.email}</Text>
          )}
        </View>

        {/* Phone */}
        <View className="mb-4">
          <TextInput
            placeholder="Phone Number"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="next"
            value={formData.phone}
            onChangeText={(text) => handleChange("phone", text)}
            className={errors.phone ? inputErrorClass : inputClass}
          />
          {errors.phone && (
            <Text className="text-red-500 text-xs mt-1">{errors.phone}</Text>
          )}
        </View>

        {/* Password */}
        <View className="mb-4">
          <View className="relative justify-center">
            <TextInput
              placeholder="Password"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              value={formData.password}
              onChangeText={(text) => handleChange("password", text)}
              className={`${errors.password ? inputErrorClass : inputClass} pr-16`}
            />
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              hitSlop={8}
              className="absolute right-4"
            >
              <Text className="text-green-700 font-semibold text-sm">
                {showPassword ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
          {errors.password ? (
            <Text className="text-red-500 text-xs mt-1">{errors.password}</Text>
          ) : (
            <Text className="text-gray-400 text-xs mt-1">
              At least 6 characters, including one uppercase letter
            </Text>
          )}
        </View>

        {/* Confirm password */}
        <View className="mb-6">
          <TextInput
            placeholder="Confirm Password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange("confirmPassword", text)}
            className={errors.confirmPassword ? inputErrorClass : inputClass}
          />
          {errors.confirmPassword && (
            <Text className="text-red-500 text-xs mt-1">
              {errors.confirmPassword}
            </Text>
          )}
        </View>

        {/* High school student toggle */}
        <View className="flex-row items-center justify-between border border-gray-300 rounded-lg px-4 py-3 mb-2">
          <View className="flex-1 pr-4">
            <Text className="text-gray-900 font-medium">
              I'm a high school student
            </Text>
            <Text className="text-gray-500 text-xs mt-0.5">
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

        {/* Submit */}
        <Pressable
          onPress={handleSubmit}
          disabled={loading}
          className={`rounded-lg p-4 mt-4 items-center ${
            loading ? "bg-green-700/60" : "bg-green-700 active:bg-green-800"
          }`}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white text-center font-semibold">
              Create Account
            </Text>
          )}
        </Pressable>

        {/* Login link */}
        <Link href="/login" asChild>
          <Pressable className="mt-6">
            <Text className="text-center text-gray-600">
              Already have an account?
              <Text className="text-green-700 font-semibold"> Login</Text>
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
