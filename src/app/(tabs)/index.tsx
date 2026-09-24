import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 items-center justify-center">
        <Text className="text-4xl font-bold">MAH Volunteers</Text>
      </View>
    </SafeAreaView>
  );
}
