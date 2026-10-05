import Button from "@/components/Button";
import HoursHistoryList from "@/components/HoursHistoryList";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useSnackbarOffset } from "@/context/SnackbarContext";
import { HoursHistory } from "@/types";
import { formatDateOfBirth, getAge } from "@/utils/dateOfBirth";
import {
  getPermission,
  registerDevice,
  sendTestNotification,
} from "@/utils/push";
import { Ionicons } from "@expo/vector-icons";
import { type Href, useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4 border-b border-gray-100 py-4">
      <Text className="text-sm text-gray-500">{label}</Text>
      <Text
        numberOfLines={1}
        className={`flex-1 text-right text-base text-gray-900 ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ label, href }: { label: string; href: Href }) {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      className="flex-row items-center justify-between border-b border-gray-100 py-4 active:bg-gray-50"
    >
      <Text className="text-base text-gray-900">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, deleteAccount, refreshUser, setNotificationsEnabled } =
    useAuth();
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [history, setHistory] = useState<HoursHistory | null>(null);
  useSnackbarOffset(useBottomTabBarHeight());

  // Hours change when an admin approves or adjusts, so refresh on focus.
  useFocusEffect(
    useCallback(() => {
      refreshUser().catch(() => {});
      api
        .get<HoursHistory>("/users/me/hours")
        .then(({ data }) => setHistory(data))
        .catch(() => {});
    }, [refreshUser]),
  );

  if (!user) return null;

  const toggleNotifications = async (enabled: boolean) => {
    try {
      setSavingNotifications(true);
      await setNotificationsEnabled(enabled);
      if (!enabled) return;

      const registered = await registerDevice({ prompt: true });
      if (!registered && (await getPermission()) === "denied") {
        Alert.alert(
          "Notifications are blocked",
          "Allow notifications for this app in your phone's settings.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => Linking.openSettings() },
          ],
        );
      }
    } catch {
      Alert.alert("Error", "Could not update notifications");
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      Alert.alert("Error", "Could not log out");
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and removes you from all events. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error: any) {
              console.log(
                "[DELETE ACCOUNT] error:",
                error?.response?.status,
                error?.response?.data,
              );
              Alert.alert(
                "Error",
                error?.response?.data?.message ??
                  "Could not delete your account",
              );
            }
          },
        },
      ],
    );
  };

  const initials =
    `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Text className="text-2xl font-semibold text-green-800">
            {initials}
          </Text>
        </View>
        <Text className="mt-4 text-2xl font-semibold text-gray-900">
          {user.firstName} {user.lastName}
        </Text>
        <Text className="mt-1 text-sm text-gray-500">Volunteer profile</Text>
      </View>

      <View className="mt-8 flex-row">
        {/* The total is the sum of the history below, by construction. */}
        <StatCard
          label="Volunteer hours"
          value={history?.total ?? user.volunteerHours}
        />
      </View>

      {history && (
        <View className="mt-8">
          <SectionHeader title="Hours history" />
          <HoursHistoryList
            items={history.items}
            emptyText="Hours appear here once an organizer approves an event you attended."
          />
        </View>
      )}

      <View className="mt-8">
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={user.phone} />
        {user.dateOfBirth ? (
          <Row
            label="Date of birth"
            value={`${formatDateOfBirth(user.dateOfBirth)} (${getAge(user.dateOfBirth)})`}
          />
        ) : null}
        <Row
          label="Group"
          value={user.gender === "brother" ? "Brother" : "Sister"}
        />
        <Row label="Role" value={user.role} capitalize />
      </View>

      <View className="mt-8 flex-row items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3.5">
        <View className="flex-1">
          <Text className="text-base font-medium text-gray-900">
            Notifications
          </Text>
          <Text className="mt-0.5 text-xs text-gray-500">
            Reminders, approvals, event changes and messages from organizers
          </Text>
        </View>
        <Switch
          value={user.notificationsEnabled !== false}
          onValueChange={toggleNotifications}
          disabled={savingNotifications}
          trackColor={{ false: "#969a9e", true: "#15803d" }}
          ios_backgroundColor="#969a9e"
          thumbColor="#ffffff"
          accessibilityLabel="Notifications"
        />
      </View>

      {__DEV__ && (
        <Pressable
          onPress={() => sendTestNotification("/(tabs)/events")}
          accessibilityRole="button"
          className="mt-3 items-center py-2"
        >
          <Text className="text-sm font-medium text-gray-500">
            Send a test notification (development only)
          </Text>
        </Pressable>
      )}

      <View className="mt-8">
        <LinkRow label="Edit profile" href="/profile/edit" />
        <LinkRow label="Change password" href="/profile/password" />
      </View>

      <View className="mt-10">
        <Button title="Log out" variant="outline" onPress={handleLogout} />
      </View>

      <Pressable
        onPress={handleDeleteAccount}
        accessibilityRole="button"
        hitSlop={8}
        className="mt-6 items-center py-3"
      >
        <Text className="text-sm font-medium text-red-600">Delete account</Text>
      </Pressable>
    </ScrollView>
  );
}
