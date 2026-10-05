import { ActivityIndicator, Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  className?: string;
  disabled?: boolean;
  loading?: boolean;
};

const containerStyles = {
  primary: "bg-green-700 active:bg-green-800",
  outline: "border border-gray-300 bg-white active:bg-gray-50",
  danger: "bg-red-600 active:bg-red-700",
};

const textStyles = {
  primary: "text-white",
  outline: "text-gray-900",
  danger: "text-white",
};

const spinnerColors = {
  primary: "#ffffff",
  outline: "#15803d",
  danger: "#ffffff",
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  className = "",
  disabled = false,
  loading = false,
}: Props) {
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={`min-h-[52px] items-center justify-center rounded-xl px-5 ${
        containerStyles[variant]
      } ${disabled ? "opacity-40" : ""} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColors[variant]} />
      ) : (
        <Text className={`text-base font-semibold ${textStyles[variant]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
