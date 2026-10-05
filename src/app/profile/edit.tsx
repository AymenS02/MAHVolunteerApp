import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import TextField from "@/components/TextField";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { apiErrorMessage } from "@/utils/apiError";
import { formatDateOfBirth } from "@/utils/dateOfBirth";
import { fieldErrors, profileSchema } from "@/validation/account";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

type Field = "firstName" | "lastName" | "phone";

function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View className="rounded-xl bg-gray-50 px-4 py-3.5">
        <Text className="text-base text-gray-500">{value}</Text>
      </View>
      <Text className="text-xs text-gray-500">{hint}</Text>
    </View>
  );
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const { show } = useSnackbar();
  const [form, setForm] = useState<Record<Field, string>>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    phone: user?.phone ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const lastNameRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  if (!user) return null;

  const changed =
    form.firstName !== user.firstName ||
    form.lastName !== user.lastName ||
    form.phone !== user.phone;

  const handleChange = (field: Field, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const save = async () => {
    const parsed = profileSchema.safeParse(form);

    if (!parsed.success) {
      setErrors(fieldErrors<Field>(parsed.error));
      return;
    }

    try {
      setSaving(true);
      await updateProfile(parsed.data);
      show({ message: "Profile updated" });
      goBack();
    } catch (error) {
      Alert.alert("Couldn't save", apiErrorMessage(error, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

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
          <Text accessibilityRole="header" className="text-3xl font-semibold text-gray-900">
            Edit profile
          </Text>

          <View className="gap-5">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <TextField
                  label="First name"
                  value={form.firstName}
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
                  value={form.lastName}
                  onChangeText={(text) => handleChange("lastName", text)}
                  error={errors.lastName}
                  autoComplete="family-name"
                  textContentType="familyName"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              </View>
            </View>

            <TextField
              label="Phone number"
              inputRef={phoneRef}
              value={form.phone}
              onChangeText={(text) => handleChange("phone", text)}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              onSubmitEditing={save}
            />

            <ReadOnlyField
              label="Date of birth"
              value={
                user.dateOfBirth
                  ? formatDateOfBirth(user.dateOfBirth)
                  : "Not set"
              }
              hint="Ask an admin to correct this."
            />

            <ReadOnlyField
              label="Email"
              value={user.email}
              hint="Email can't be changed yet."
            />
          </View>

          <Button
            title="Save changes"
            onPress={save}
            loading={saving}
            disabled={!changed}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
