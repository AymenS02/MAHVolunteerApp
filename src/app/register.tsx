import Button from "@/components/Button";
import DateOfBirthField from "@/components/DateOfBirthField";
import TextField from "@/components/TextField";
import { homeHref, useAuth } from "@/context/AuthContext";
import { Gender } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Link, Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
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
import { SafeAreaView } from "react-native-safe-area-context";

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
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
  if (!data.dateOfBirth) errors.dateOfBirth = "Please enter your date of birth";
  if (data.password.length < 6)
    errors.password = "Password must be at least 6 characters";
  else if (!/[A-Z]/.test(data.password))
    errors.password = "Password must contain at least one uppercase letter";
  if (data.confirmPassword !== data.password)
    errors.confirmPassword = "Passwords do not match";
  if (!data.gender) errors.gender = "Please select Brother or Sister";

  return errors;
};

function GroupOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-[52px] flex-1 items-center justify-center rounded-xl ${
        selected ? "bg-green-700" : "bg-gray-50 active:bg-gray-100"
      }`}
    >
      <Text
        className={`text-base font-semibold ${
          selected ? "text-white" : "text-gray-900"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function Register() {
  const router = useRouter();
  const { user, register } = useAuth();
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: null,
    password: "",
    confirmPassword: "",
    gender: null,
    highschoolStudent: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  if (user) {
    return <Redirect href={homeHref(user)} />;
  }

  const handleChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    const validationErrors = validate(formData);
    setErrors(validationErrors);

    if (
      Object.keys(validationErrors).length > 0 ||
      !formData.gender ||
      !formData.dateOfBirth
    )
      return;

    setLoading(true);
    try {
      const newUser = await register({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        gender: formData.gender,
        highschoolStudent: formData.highschoolStudent,
        dateOfBirth: formData.dateOfBirth,
      });

      router.replace(homeHref(newUser));
    } catch (error: unknown) {
      let message = "Please check your details and try again.";

      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.log(
            "[REGISTER] Server error:",
            error.response.status,
            JSON.stringify(error.response.data),
          );
          message = error.response.data?.message ?? message;
        } else if (error.request) {
          console.log(
            "[REGISTER] No response:",
            error.config?.baseURL,
            error.config?.url,
            error.code,
            error.message,
          );
          message = "Can't reach the server. Check your connection.";
        } else {
          console.log("[REGISTER] Request setup error:", error.message);
        }
      } else if (error instanceof Error) {
        console.log("[REGISTER] Code error:", error.message, "\n", error.stack);
      } else {
        console.log("[REGISTER] Unknown error:", error);
      }

      Alert.alert("Registration failed", message);
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
          contentContainerClassName="px-6 pb-10 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-sm font-semibold text-green-700">
            MAH Volunteer
          </Text>
          <Text className="mt-3 text-4xl font-semibold text-gray-900">
            Create your account
          </Text>
          <Text className="mt-2 text-base text-gray-500">
            Sign up for events and keep track of your volunteer hours.
          </Text>

          <View className="mt-10 gap-5">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label="First name"
                  value={formData.firstName}
                  onChangeText={(text) => handleChange("firstName", text)}
                  error={errors.firstName}
                  autoComplete="given-name"
                  textContentType="givenName"
                  returnKeyType="next"
                  onSubmitEditing={() => lastNameRef.current?.focus()}
                />
              </View>
              <View className="flex-1">
                <TextField
                  label="Last name"
                  inputRef={lastNameRef}
                  value={formData.lastName}
                  onChangeText={(text) => handleChange("lastName", text)}
                  error={errors.lastName}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

            <TextField
              label="Email"
              inputRef={emailRef}
              value={formData.email}
              onChangeText={(text) => handleChange("email", text)}
              error={errors.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />

            <TextField
              label="Phone number"
              inputRef={phoneRef}
              value={formData.phone}
              onChangeText={(text) => handleChange("phone", text)}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />

            <DateOfBirthField
              value={formData.dateOfBirth}
              onChange={(value) => handleChange("dateOfBirth", value)}
              error={errors.dateOfBirth}
            />

            <TextField
              label="Password"
              inputRef={passwordRef}
              value={formData.password}
              onChangeText={(text) => handleChange("password", text)}
              error={errors.password}
              hint="At least 6 characters, including one uppercase letter"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              right={
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color="#6b7280"
                  />
                </Pressable>
              }
            />

            <TextField
              label="Confirm password"
              inputRef={confirmRef}
              value={formData.confirmPassword}
              onChangeText={(text) => handleChange("confirmPassword", text)}
              error={errors.confirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />

            <View className="gap-1.5">
              <Text className="text-sm font-medium text-gray-700">
                I&apos;m signing up as
              </Text>
              <View accessibilityRole="radiogroup" className="flex-row gap-3">
                <GroupOption
                  label="Brother"
                  selected={formData.gender === "brother"}
                  onPress={() => handleChange("gender", "brother")}
                />
                <GroupOption
                  label="Sister"
                  selected={formData.gender === "sister"}
                  onPress={() => handleChange("gender", "sister")}
                />
              </View>
              {errors.gender ? (
                <Text className="text-xs text-red-600">{errors.gender}</Text>
              ) : null}
            </View>

            <View className="flex-row items-center justify-between rounded-xl bg-gray-50 px-4 py-3.5">
              <View className="flex-1 pr-4">
                <Text className="text-base font-medium text-gray-900">
                  I&apos;m a high school student
                </Text>
                <Text className="mt-0.5 text-xs text-gray-500">
                  Helps us track volunteer hours for school
                </Text>
              </View>
              <Switch
                value={formData.highschoolStudent}
                onValueChange={(value) =>
                  handleChange("highschoolStudent", value)
                }
                trackColor={{ false: "#969a9e", true: "#15803d" }}
                ios_backgroundColor="#969a9e"
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View className="mt-8">
            <Button
              title="Create account"
              onPress={handleSubmit}
              loading={loading}
            />
          </View>

          <Link href="/login" asChild>
            <Pressable className="mt-6 py-2" accessibilityRole="link">
              <Text className="text-center text-gray-500">
                Already have an account?
                <Text className="font-semibold text-green-700"> Log in</Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
