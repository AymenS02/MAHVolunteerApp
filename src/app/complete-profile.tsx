import Button from "@/components/Button";
import DateOfBirthField from "@/components/DateOfBirthField";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/utils/apiError";
import { isAxiosError } from "axios";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Shown to accounts created before date of birth was collected. The root
// layout keeps them here until it's saved, then sends them into the app.
export default function CompleteProfileScreen() {
  const { user, setDateOfBirth, refreshUser, logout } = useAuth();
  const [dateOfBirth, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!dateOfBirth) {
      setError("Please enter your date of birth");
      return;
    }

    try {
      setSaving(true);
      await setDateOfBirth(dateOfBirth);
    } catch (err) {
      // Already set (e.g. from another device): load it and move on.
      if (isAxiosError(err) && err.response?.status === 409) {
        await refreshUser().catch(() => {});
        return;
      }
      Alert.alert("Couldn't save", apiErrorMessage(err, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="px-6 pb-10 pt-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-sm font-semibold text-green-700">
          MAH Volunteer
        </Text>
        <Text className="mt-3 text-4xl font-semibold text-gray-900">
          One more step
        </Text>
        <Text className="mt-2 text-base text-gray-500">
          {user?.firstName ? `Hi ${user.firstName}, we` : "We"} now ask every
          volunteer for their date of birth so organizers know who is under 18.
          Only you and event admins can see it.
        </Text>

        <View className="mt-10 gap-1.5">
          <DateOfBirthField
            value={dateOfBirth}
            onChange={(value) => {
              setValue(value);
              setError(undefined);
            }}
            error={error}
          />
          <Text className="text-xs text-gray-500">
            You can&apos;t change this later. Ask an admin if it&apos;s wrong.
          </Text>
        </View>

        <View className="mt-8">
          <Button title="Save and continue" onPress={save} loading={saving} />
        </View>

        <Pressable
          onPress={logout}
          accessibilityRole="button"
          hitSlop={8}
          className="mt-6 items-center py-3"
        >
          <Text className="text-sm font-medium text-gray-500">Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
