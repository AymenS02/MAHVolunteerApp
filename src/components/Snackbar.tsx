import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

type Props = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
  bottom: number;
};

export default function Snackbar({
  message,
  actionLabel,
  onAction,
  busy = false,
  bottom,
}: Props) {
  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 px-4"
      style={{ bottom }}
    >
      <Animated.View
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(150)}
      >
        <View
          accessibilityLiveRegion="polite"
          className="min-h-[52px] flex-row items-center gap-3 rounded-xl bg-gray-900 py-1.5 pl-4 pr-1.5 shadow-lg"
        >
          <Text className="flex-1 py-2 text-sm text-white">{message}</Text>
          {actionLabel && onAction ? (
            <Pressable
              onPress={onAction}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              accessibilityState={{ busy }}
              hitSlop={8}
              className="min-h-[40px] min-w-[64px] items-center justify-center rounded-lg px-3 active:bg-gray-700"
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text className="text-sm font-semibold text-white">
                  {actionLabel}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
