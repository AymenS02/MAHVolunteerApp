import EventCard from "@/components/EventCard";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { Event } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

export default function AdminTabScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    if (user?.role !== "admin") {
      return;
    }

    try {
      setLoading(true);
      const { data } = await api.get<Event[]>("/events");
      setEvents(data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  if (user?.role !== "admin") {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-gray-500">Admin access required.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-5">
      <Pressable
        onPress={() => router.push("/admin/create-event")}
        className="rounded-lg bg-green-700 p-4"
      >
        <Text className="text-center font-semibold text-white">Create Event</Text>
      </Pressable>

      <Text className="text-xl font-semibold text-gray-900">All Events</Text>
      {events.map((event) => (
        <EventCard
          key={event._id}
          event={event}
          onPress={() => router.push(`/admin/events/${event._id}/volunteers`)}
        />
      ))}
    </ScrollView>
  );
}
