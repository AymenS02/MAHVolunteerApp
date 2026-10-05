import { type ReactNode, type RefObject } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";

type Props = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  inputRef?: RefObject<TextInput | null>;
  // E.g. a show/hide password toggle inside the field.
  right?: ReactNode;
};

export default function TextField({
  label,
  error,
  hint,
  inputRef,
  right,
  ...props
}: Props) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <View className="justify-center">
        <TextInput
          ref={inputRef}
          placeholderTextColor="#6b7280"
          accessibilityLabel={error ? `${label}, error: ${error}` : label}
          className={`rounded-xl px-4 py-3.5 text-base text-gray-900 ${
            error ? "bg-red-50" : "bg-gray-50"
          } ${right ? "pr-12" : ""} ${props.multiline ? "min-h-[112px]" : ""}`}
          textAlignVertical={props.multiline ? "top" : undefined}
          {...props}
        />
        {right ? <View className="absolute right-4">{right}</View> : null}
      </View>
      {error ? (
        <Text className="text-xs text-red-600">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-gray-500">{hint}</Text>
      ) : null}
    </View>
  );
}
