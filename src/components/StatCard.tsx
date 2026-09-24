import { Text, View } from "react-native";

type Props = { label: string; value: string | number };

export default function StatCard({ label, value }: Props) {
  return (
    <View className="flex-1 rounded-2xl bg-emerald-600 p-4">
      <Text className="text-3xl font-bold text-white">{value}</Text>
      <Text className="mt-1 text-sm text-emerald-100">{label}</Text>
    </View>
  );
}
