import Button from "@/components/Button";
import EventCard from "@/components/EventCard";
import PillButton from "@/components/PillButton";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar, useSnackbarOffset } from "@/context/SnackbarContext";
import { Event } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { onEventsChanged } from "@/utils/eventsChanged";
import { formatDate } from "@/utils/format";
import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";

function DeletedEventRow({
  event,
  restoring,
  onRestore,
}: {
  event: Event;
  restoring: boolean;
  onRestore: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-gray-50 p-4">
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-gray-900">
          {event.name}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          {event.deletedAt ? `Deleted ${formatDate(event.deletedAt)}` : "Deleted"}
        </Text>
      </View>
      <PillButton
        title="Restore"
        variant="outline"
        onPress={onRestore}
        loading={restoring}
        accessibilityLabel={`Restore ${event.name}`}
      />
    </View>
  );
}

export default function AdminTabScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { show } = useSnackbar();
  const [events, setEvents] = useState<Event[]>([]);
  const [deleted, setDeleted] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  useSnackbarOffset(useBottomTabBarHeight());

  const loadEvents = useCallback(
    async (showSpinner = true) => {
      if (user?.role !== "admin") {
        return;
      }

      try {
        if (showSpinner) setLoading(true);
        const [live, gone] = await Promise.all([
          api.get<Event[]>("/events"),
          api.get<Event[]>("/events/deleted"),
        ]);
        setEvents(live.data);
        setDeleted(gone.data);
      } catch (error) {
        Alert.alert("Error", apiErrorMessage(error, "Failed to load events"));
      } finally {
        setLoading(false);
      }
    },
    [user?.role],
  );

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  useEffect(() => onEventsChanged(() => loadEvents(false)), [loadEvents]);

  const restoreEvent = async (event: Event) => {
    try {
      setRestoringId(event._id);
      await api.post(`/events/${event._id}/restore`);
      await loadEvents(false);
      show({ message: "Event restored" });
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, "Failed to restore event"));
    } finally {
      setRestoringId(null);
    }
  };

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

      {deleted.length > 0 && (
        <View className="gap-3">
          <View className="gap-1">
            <SectionHeader title="Recently deleted" />
            <Text className="text-sm text-gray-500">
              Events deleted in the last 30 days.
            </Text>
          </View>
          {deleted.map((event) => (
            <DeletedEventRow
              key={event._id}
              event={event}
              restoring={restoringId === event._id}
              onRestore={() => restoreEvent(event)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
