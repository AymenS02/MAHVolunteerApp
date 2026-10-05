import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { apiErrorMessage } from "@/utils/apiError";
import { fieldErrors, passwordChangeSchema } from "@/validation/account";
import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { useRouter } from "expo-router";
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

type Field = "currentPassword" | "newPassword" | "confirmPassword";

const WRONG_PASSWORD = "Current password is incorrect";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const { show } = useSnackbar();
  const [form, setForm] = useState<Record<Field, string>>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const handleChange = (field: Field, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const save = async () => {
    const parsed = passwordChangeSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }

    try {
      setSaving(true);
      await changePassword(parsed.data.currentPassword, parsed.data.newPassword);
      show({ message: "Password changed. Other devices were signed out." });
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/profile");
    } catch (error) {
      const message = apiErrorMessage(error, "Please try again.");
      // Show a wrong current password next to that field, not in an alert.
      if (isAxiosError(error) && message === WRONG_PASSWORD) {
        setErrors({ currentPassword: message });
      } else {
        Alert.alert("Couldn't change password", message);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggle = (
    <Pressable
      onPress={() => setShowPasswords((prev) => !prev)}
      accessibilityRole="button"
      accessibilityLabel={showPasswords ? "Hide passwords" : "Show passwords"}
      hitSlop={12}
    >
      <Ionicons
        name={showPasswords ? "eye-off-outline" : "eye-outline"}
        size={20}
        color="#6b7280"
      />
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <BackBar fallback="/(tabs)/profile" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="gap-8 px-5 pb-10 pt-2"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-1">
            <Text accessibilityRole="header" className="text-3xl font-semibold text-gray-900">
              Change password
            </Text>
            <Text className="text-sm text-gray-500">
              You&apos;ll stay signed in here. Other devices will be signed
              out.
            </Text>
          </View>

          <View className="gap-5">
            <TextField
              label="Current password"
              value={form.currentPassword}
              onChangeText={(text) => handleChange("currentPassword", text)}
              error={errors.currentPassword}
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="next"
              onSubmitEditing={() => newRef.current?.focus()}
              right={toggle}
            />
            <TextField
              label="New password"
              inputRef={newRef}
              value={form.newPassword}
              onChangeText={(text) => handleChange("newPassword", text)}
              error={errors.newPassword}
              hint="At least 6 characters, including one uppercase letter"
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
            <TextField
              label="Confirm new password"
              inputRef={confirmRef}
              value={form.confirmPassword}
              onChangeText={(text) => handleChange("confirmPassword", text)}
              error={errors.confirmPassword}
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={save}
            />
          </View>

          <Button title="Change password" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
