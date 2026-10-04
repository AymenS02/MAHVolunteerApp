import { Event } from "@/types";
import { Pressable, Text, View } from "react-native";

type Props = {
  event: Event;
  onPress: () => void;
};

const formatDate = (date: string) =>
  new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const spotsLeft = (max: number, registered: number) => Math.max(max - registered, 0);

export default function EventCard({ event, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-lg border border-gray-200 bg-white p-4 active:bg-gray-50"
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900">{event.name}</Text>
          <Text className="mt-1 text-gray-500">{formatDate(event.date)}</Text>
          <Text className="text-gray-500">{event.location}</Text>
          <Text className="mt-1 text-green-700">{event.hours} volunteer hours</Text>
        </View>
        {event.myStatus && (
          <Text className="rounded-lg bg-green-700 px-2 py-1 text-xs font-semibold text-white">
            {event.myStatus === "approved" ? "Approved" : "Registered"}
          </Text>
        )}
      </View>

      <View className="mt-4 gap-1">
        {event.brothersMax > 0 && (
          <Text className="text-gray-500">
            Brothers: {spotsLeft(event.brothersMax, event.brothersRegistered)} left
          </Text>
        )}
        {event.sistersMax > 0 && (
          <Text className="text-gray-500">
            Sisters: {spotsLeft(event.sistersMax, event.sistersRegistered)} left
          </Text>
        )}
      </View>
    </Pressable>
  );
}
