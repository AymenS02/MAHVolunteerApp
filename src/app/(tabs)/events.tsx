import EventCard from "@/components/EventCard";
import api from "@/constants/api";
import { Event } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Event[]>("/events");
      setEvents(data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    return {
      upcoming: events.filter((event) => new Date(event.date).getTime() > now),
      past: events.filter((event) => new Date(event.date).getTime() <= now),
    };
  }, [events]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-8 p-5">
      <View className="gap-3">
        <Text className="text-xl font-semibold text-gray-900">Upcoming</Text>
        {upcoming.length === 0 ? (
          <Text className="text-gray-500">No upcoming events.</Text>
        ) : (
          upcoming.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onPress={() => router.push(`/events/${event._id}`)}
            />
          ))
        )}
      </View>

      <View className="gap-3">
        <Text className="text-xl font-semibold text-gray-900">Past</Text>
        {past.length === 0 ? (
          <Text className="text-gray-500">No past events.</Text>
        ) : (
          past.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onPress={() => router.push(`/events/${event._id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
