import { Pressable, Text } from "react-native";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  className?: string;
};

const containerStyles = {
  primary: "bg-emerald-600 active:bg-emerald-700",
  outline: "bg-white border border-slate-300 active:bg-slate-100",
  danger: "bg-red-600 active:bg-red-700",
};

const textStyles = {
  primary: "text-white",
  outline: "text-slate-800",
  danger: "text-white",
};

export default function Button({
  title,
  onPress,
  variant = "primary",
  className = "",
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`items-center justify-center rounded-xl px-4 py-3 ${containerStyles[variant]} ${className}`}
    >
      <Text className={`text-base font-semibold ${textStyles[variant]}`}>
        {title}
      </Text>
    </Pressable>
  );
}
