import { VolunteerEvent } from "@/types";
import { formatDate } from "@/utils/format";
import { Text, View } from "react-native";
import Button from "./Button";

type Props = {
  event: VolunteerEvent;
  variant: "registered" | "upcoming" | "past";
  onRegister?: (id: string) => void;
};

export default function EventCard({ event, variant, onRegister }: Props) {
  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <Text className="text-lg font-bold text-slate-900">{event.title}</Text>
      <Text className="mt-1 text-sm text-slate-500">
        📅 {formatDate(event.date)} · 📍 {event.location}
      </Text>

      <View className="mt-3 flex-row items-center justify-between">
        {variant === "registered" && (
          <>
            <Text className="font-semibold text-emerald-600">Registered ✓</Text>
            <Text className="text-sm text-slate-500">+{event.hours} hours</Text>
          </>
        )}

        {variant === "upcoming" && (
          <>
            <Text className="text-sm text-slate-500">
              {event.hours} volunteer hours
            </Text>
            <Button
              title="Register"
              onPress={() => onRegister?.(event.id)}
              className="px-5 py-2"
            />
          </>
        )}

        {variant === "past" && (
          <>
            <Text className="font-semibold text-slate-600">Completed</Text>
            <Text className="font-semibold text-emerald-600">
              +{event.hours} hours
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
