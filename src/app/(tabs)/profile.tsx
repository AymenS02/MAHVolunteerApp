import { useAuth } from "@/context/AuthContext";
import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-gray-200 py-3">
      <Text className="text-gray-500">{label}</Text>
      <Text className="font-medium text-gray-900">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
    } catch {
      Alert.alert("Error", "Could not log out");
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="p-5">
      <Text className="text-2xl font-bold text-gray-900">
        {user.firstName} {user.lastName}
      </Text>
      <Text className="mt-1 text-gray-500">Your volunteer profile</Text>

      <View className="mt-6 rounded-lg border border-gray-200 bg-white px-4">
        <Row label="Email" value={user.email} />
        <Row label="Phone" value={user.phone} />
        <Row label="Gender" value={user.gender === "brother" ? "Brother" : "Sister"} />
        <Row label="Role" value={user.role} />
        <Row label="Volunteer Hours" value={String(user.volunteerHours)} />
      </View>

      <Pressable onPress={handleLogout} className="mt-10">
        <Text className="text-center font-semibold text-red-600">Logout</Text>
      </Pressable>
    </ScrollView>
  );
}
