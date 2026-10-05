import Button from "@/components/Button";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/context/AuthContext";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

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

export default function ProfileScreen() {
  const { user, logout, deleteAccount } = useAuth();

  if (!user) return null;

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
        <StatCard label="Volunteer hours" value={user.volunteerHours} />
      </View>

      <View className="mt-8">
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={user.phone} />
        <Row
          label="Group"
          value={user.gender === "brother" ? "Brother" : "Sister"}
        />
        <Row label="Role" value={user.role} capitalize />
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
