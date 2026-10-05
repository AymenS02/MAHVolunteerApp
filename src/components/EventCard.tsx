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

const spotsLeft = (max: number, registered: number) =>
  Math.max(max - registered, 0);

function Spots({ label, left }: { label: string; left: number }) {
  return (
    <Text
      className={`text-sm ${
        left === 0 ? "font-medium text-red-600" : "text-gray-500"
      }`}
    >
      {left === 0 ? `${label} full` : `${label} ${left} left`}
    </Text>
  );
}

export default function EventCard({ event, onPress }: Props) {
  const approved = event.myStatus === "approved";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="rounded-2xl bg-gray-50 p-5 active:bg-gray-100"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Text
          numberOfLines={2}
          className="flex-1 text-lg font-semibold text-gray-900"
        >
          {event.name}
        </Text>
        {event.myStatus && (
          <View
            className={`rounded-full px-2.5 py-1 ${
              approved ? "bg-green-700" : "bg-green-100"
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                approved ? "text-white" : "text-green-800"
              }`}
            >
              {approved ? "Approved" : "Registered"}
            </Text>
          </View>
        )}
      </View>

      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <Text className="text-sm text-gray-600">{formatDate(event.date)}</Text>
        {event.myWaitlistPosition ? (
          <View className="rounded-full border border-gray-300 px-2 py-0.5">
            <Text className="text-xs font-semibold text-gray-900">
              Waitlisted #{event.myWaitlistPosition}
            </Text>
          </View>
        ) : null}
        {event.myStatus && event.previousDate ? (
          <View className="rounded-full border border-gray-300 px-2 py-0.5">
            <Text className="text-xs font-semibold text-gray-900">
              Date changed
            </Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} className="mt-0.5 text-sm text-gray-500">
        {event.location}
      </Text>

      <View className="mt-5 flex-row items-end justify-between gap-4">
        <Text className="text-sm font-semibold text-green-700">
          {event.hours} {event.hours === 1 ? "hour" : "hours"}
        </Text>

        <View className="flex-1 flex-row flex-wrap justify-end gap-x-3">
          {event.brothersMax > 0 && (
            <Spots
              label="Brothers"
              left={spotsLeft(event.brothersMax, event.brothersRegistered)}
            />
          )}
          {event.sistersMax > 0 && (
            <Spots
              label="Sisters"
              left={spotsLeft(event.sistersMax, event.sistersRegistered)}
            />
          )}
        </View>
      </View>
    </Pressable>
  );
}
