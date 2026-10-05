import { Ionicons } from "@expo/vector-icons";
import { Href, useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BackBar({
  fallback = "/(tabs)/events",
}: {
  fallback?: Href;
}) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  };

  return (
    <SafeAreaView edges={["top"]} className="bg-white">
      <View className="px-5 py-2">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
