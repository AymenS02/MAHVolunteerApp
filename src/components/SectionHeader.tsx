import { Text } from "react-native";

export default function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-lg font-semibold text-gray-900"
    >
      {title}
    </Text>
  );
}
