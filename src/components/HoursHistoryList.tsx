import { HoursItem } from "@/types";
import { formatHours, formatShortDate, formatSignedHours } from "@/utils/hours";
import { Text, View } from "react-native";

function Note({ amount, reason }: { amount: number; reason: string }) {
  return (
    <Text className="mt-1 text-sm text-gray-500">
      {formatSignedHours(amount)} · {reason}
    </Text>
  );
}

// The lines that add up to a volunteer's total, newest first.
export default function HoursHistoryList({
  items,
  emptyText,
}: {
  items: HoursItem[];
  emptyText: string;
}) {
  if (items.length === 0) {
    return <Text className="py-4 text-sm text-gray-500">{emptyText}</Text>;
  }

  return (
    <View>
      {items.map((item) =>
        item.type === "event" ? (
          <View
            key={item.eventId}
            className="flex-row gap-4 border-b border-gray-100 py-4"
          >
            <View className="flex-1">
              <Text
                numberOfLines={2}
                className="text-base font-medium text-gray-900"
              >
                {item.name}
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                {formatShortDate(item.date)}
              </Text>
              {item.adjustments.map((note) => (
                <Note key={note.id} amount={note.amount} reason={note.reason} />
              ))}
            </View>
            <Text className="text-base font-semibold text-green-700">
              {formatHours(item.hours)}
            </Text>
          </View>
        ) : (
          <View
            key={item.id}
            className="flex-row gap-4 border-b border-gray-100 py-4"
          >
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900">
                Hours adjustment
              </Text>
              <Text className="mt-0.5 text-sm text-gray-500">
                {formatShortDate(item.date)} · {item.reason}
              </Text>
            </View>
            <Text className="text-base font-semibold text-gray-900">
              {formatSignedHours(item.amount)}
            </Text>
          </View>
        ),
      )}
    </View>
  );
}
