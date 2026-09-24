import Button from "@/components/Button";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import { mockEvents, mockUser } from "@/constants/mockData";
import { getStats } from "@/utils/format";
import { Alert, ScrollView, Text, View } from "react-native";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-slate-100 py-3">
      <Text className="text-slate-500">{label}</Text>
      <Text className="font-medium text-slate-900">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { totalHours, eventsCompleted } = getStats(mockEvents);

  const confirmDelete = () =>
    Alert.alert("Delete account", "This can't be undone. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => console.log("delete account"),
      },
    ]);

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-6 p-5"
    >
      <View className="items-center gap-2">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-600">
          <Text className="text-3xl font-bold text-white">
            {mockUser.name[0]}
          </Text>
        </View>
        <Text className="text-xl font-bold text-slate-900">
          {mockUser.name}
        </Text>
      </View>

      <View className="flex-row gap-3">
        <StatCard label="Total hours" value={totalHours} />
        <StatCard label="Events completed" value={eventsCompleted} />
      </View>

      <View className="gap-2">
        <SectionHeader title="Account" />
        <View className="rounded-2xl border border-slate-200 bg-white px-4">
          <InfoRow label="Name" value={mockUser.name} />
          <InfoRow label="Email" value={mockUser.email} />
          <InfoRow label="Phone" value={mockUser.phone} />
        </View>
      </View>

      <View className="gap-3">
        <SectionHeader title="Settings" />
        <Button
          title="Change Email"
          variant="outline"
          onPress={() => console.log("change email")}
        />
        <Button
          title="Change Phone Number"
          variant="outline"
          onPress={() => console.log("change phone")}
        />
        <Button
          title="Log Out"
          variant="outline"
          onPress={() => console.log("logout")}
        />
        <Button
          title="Delete Account"
          variant="danger"
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}
