import PillButton from "@/components/PillButton";
import { ActivityIndicator, Text, View } from "react-native";

// The three non-content states every data screen uses, so they look and
// read the same everywhere.

// First load only; later refreshes keep the content on screen.
export function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center py-16">
      <ActivityIndicator color="#15803d" accessibilityLabel="Loading" />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-1 items-center justify-center px-8 py-16"
    >
      <Text
        accessibilityRole="header"
        className="text-base font-semibold text-gray-900"
      >
        Couldn&apos;t load this
      </Text>
      <Text className="mt-1 text-center text-sm text-gray-500">{message}</Text>
      <View className="mt-4">
        <PillButton title="Try again" variant="outline" onPress={onRetry} />
      </View>
    </View>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: { title: string; onPress: () => void };
}) {
  return (
    <View className="items-center px-8 py-16">
      <Text className="text-center text-base font-semibold text-gray-900">
        {title}
      </Text>
      {hint ? (
        <Text className="mt-1 text-center text-sm text-gray-500">{hint}</Text>
      ) : null}
      {action ? (
        <View className="mt-4">
          <PillButton title={action.title} variant="outline" onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
