import Button from "@/components/Button";
import EventCard from "@/components/EventCard";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { Event } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

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
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load events",
      );
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
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-base font-semibold text-gray-900">
          Admins only
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          You need an admin account to manage events.
        </Text>
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
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-6 px-5 pb-10 pt-4"
      showsVerticalScrollIndicator={false}
    >
      <Button
        title="Create event"
        onPress={() => router.push("/admin/create-event")}
      />

      <View className="gap-3">
        <View className="gap-1">
          <SectionHeader title="All events" />
          {events.length > 0 && (
            <Text className="text-sm text-gray-500">
              Tap an event to manage its volunteers.
            </Text>
          )}
        </View>

        {events.length === 0 ? (
          <View className="items-center px-8 py-16">
            <Text className="text-base font-semibold text-gray-900">
              No events yet
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              Create your first event and volunteers can start signing up.
            </Text>
          </View>
        ) : (
          events.map((event) => (
            <EventCard
              key={event._id}
              event={event}
              onPress={() =>
                router.push(`/admin/events/${event._id}/volunteers`)
              }
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
