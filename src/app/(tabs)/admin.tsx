import Button from "@/components/Button";
import EventCard from "@/components/EventCard";
import PillButton from "@/components/PillButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar, useSnackbarOffset } from "@/context/SnackbarContext";
import { useScreenData } from "@/hooks/use-screen-data";
import { Event } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { onEventsChanged } from "@/utils/eventsChanged";
import { formatDate } from "@/utils/format";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";

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

type AdminEvents = { events: Event[]; deleted: Event[] };

export default function AdminTabScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { show } = useSnackbar();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  useSnackbarOffset(useBottomTabBarHeight());
  const isAdmin = user?.role === "admin";

  const fetchEvents = useCallback(async (): Promise<AdminEvents> => {
    if (!isAdmin) return { events: [], deleted: [] };
    const [live, gone] = await Promise.all([
      api.get<Event[]>("/events"),
      api.get<Event[]>("/events/deleted"),
    ]);
    return { events: live.data, deleted: gone.data };
  }, [isAdmin]);

  const { data, loading, error, refreshing, reload, refresh, retry } =
    useScreenData(fetchEvents);

  useEffect(() => onEventsChanged(() => reload()), [reload]);

  const restoreEvent = async (event: Event) => {
    try {
      setRestoringId(event._id);
      await api.post(`/events/${event._id}/restore`);
      await reload();
      show({ message: "Event restored" });
    } catch (err) {
      Alert.alert("Couldn't restore event", apiErrorMessage(err, "Please try again."));
    } finally {
      setRestoringId(null);
    }
  };

  if (!isAdmin) {
    return (
      <View className="flex-1 bg-white">
        <EmptyState
          title="Admins only"
          hint="You need an admin account to manage events."
        />
      </View>
    );
  }

  if (loading || !data) {
    return (
      <View className="flex-1 bg-white">
        {error ? <ErrorState message={error} onRetry={retry} /> : <LoadingState />}
      </View>
    );
  }

  const { events, deleted } = data;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-6 px-5 pb-10 pt-4"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#15803d"
          colors={["#15803d"]}
        />
      }
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
          <EmptyState
            title="No events yet"
            hint="Create your first event and volunteers can start signing up."
          />
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
