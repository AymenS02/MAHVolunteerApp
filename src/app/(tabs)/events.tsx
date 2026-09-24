import EventCard from "@/components/EventCard";
import SectionHeader from "@/components/SectionHeader";
import { mockEvents } from "@/constants/mockData";
import { splitEvents } from "@/utils/format";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

export default function EventsScreen() {
  const [events, setEvents] = useState(mockEvents);
  const { registered, upcoming, past } = useMemo(
    () => splitEvents(events),
    [events],
  );

  const handleRegister = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, registered: true } : e)),
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-8 p-5"
    >
      <View className="gap-3">
        <SectionHeader title="Registered Events" />
        {registered.length === 0 && (
          <Text className="text-slate-500">No registered events.</Text>
        )}
        {registered.map((e) => (
          <EventCard key={e.id} event={e} variant="registered" />
        ))}
      </View>

      <View className="gap-3">
        <SectionHeader title="Upcoming Events" />
        {upcoming.length === 0 && (
          <Text className="text-slate-500">No upcoming events.</Text>
        )}
        {upcoming.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            variant="upcoming"
            onRegister={handleRegister}
          />
        ))}
      </View>

      <View className="gap-3">
        <SectionHeader title="Past Events" />
        {past.length === 0 && (
          <Text className="text-slate-500">No past events yet.</Text>
        )}
        {past.map((e) => (
          <EventCard key={e.id} event={e} variant="past" />
        ))}
      </View>
    </ScrollView>
  );
}
