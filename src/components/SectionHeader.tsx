import { Text } from "react-native";

export default function SectionHeader({ title }: { title: string }) {
  return <Text className="text-xl font-bold text-slate-900">{title}</Text>;
}
