import { ActivityIndicator, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

// Compact row action, e.g. Approve or Restore next to a name.
export default function PillButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const primary = variant === "primary";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      className={`min-h-[44px] min-w-[96px] items-center justify-center rounded-full px-4 ${
        primary
          ? "bg-green-700 active:bg-green-800"
          : "border border-gray-300 bg-white active:bg-gray-50"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {loading ? (
        <ActivityIndicator color={primary ? "#ffffff" : "#15803d"} size="small" />
      ) : (
        <Text
          className={`text-sm font-semibold ${primary ? "text-white" : "text-gray-900"}`}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
