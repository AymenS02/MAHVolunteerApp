import { Text, View } from "react-native";

type Props = { label: string; value: string | number };

export default function StatCard({ label, value }: Props) {
  return (
    <View className="flex-1 rounded-2xl bg-gray-50 p-4">
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="text-3xl font-semibold text-gray-900"
      >
        {value}
      </Text>
      <Text numberOfLines={1} className="mt-1 text-sm text-gray-500">
        {label}
      </Text>
    </View>
  );
}
