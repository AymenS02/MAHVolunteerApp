import { Pressable, Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
  onPress: () => void;
  // Shown in gray when nothing has been picked yet.
  placeholder?: boolean;
  error?: string;
  className?: string;
};

// A tappable field that opens a picker (date, time). Matches text inputs.
export default function PickerField({
  label,
  value,
  onPress,
  placeholder = false,
  error,
  className = "",
}: Props) {
  return (
    <View className={`gap-1.5 ${className}`}>
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}${error ? `, error: ${error}` : ""}`}
        className={`rounded-xl px-4 py-3.5 ${
          error ? "bg-red-50" : "bg-gray-50 active:bg-gray-100"
        }`}
      >
        <Text
          className={`text-base ${placeholder ? "text-gray-500" : "text-gray-900"}`}
        >
          {value}
        </Text>
      </Pressable>
      {error ? <Text className="text-xs text-red-600">{error}</Text> : null}
    </View>
  );
}
