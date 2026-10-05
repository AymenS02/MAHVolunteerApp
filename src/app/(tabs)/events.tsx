import EventCard from "@/components/EventCard";
import api from "@/constants/api";
import { useSnackbarOffset } from "@/context/SnackbarContext";
import { Event } from "@/types";
import { onEventsChanged } from "@/utils/eventsChanged";
import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type Tab = "upcoming" | "past";

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <View className="items-center px-8 py-20">
      <Text className="text-base font-semibold text-gray-900">{title}</Text>
      <Text className="mt-1 text-center text-sm text-gray-500">{hint}</Text>
    </View>
  );
}

function TabButton({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      // Both states set a shadow so NativeWind sees its CSS variables on the
      // first render; adding them later remounts the button and crashes in dev.
      className={`flex-1 items-center rounded-lg py-2.5 ${
        active ? "bg-white shadow-sm" : "shadow-none"
      }`}
    >
      <Text
        className={`text-sm ${
          active ? "font-semibold text-gray-900" : "font-medium text-gray-500"
        }`}
      >
        {label}
        <Text className="font-normal text-gray-400"> {count}</Text>
      </Text>
    </Pressable>
  );
}

export default function EventsScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("upcoming");
  useSnackbarOffset(useBottomTabBarHeight());

  const loadEvents = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const { data } = await api.get<Event[]>("/events");
      setEvents(data);
      setNow(Date.now());
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load events",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [loadEvents]),
  );

  useEffect(() => onEventsChanged(() => loadEvents(false)), [loadEvents]);

  const { upcoming, past } = useMemo(
    () => ({
      upcoming: events.filter((event) => new Date(event.date).getTime() > now),
      past: events.filter((event) => new Date(event.date).getTime() <= now),
    }),
    [events, now],
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentContainerClassName="gap-3 px-5 pb-10 pt-4"
      showsVerticalScrollIndicator={false}
    >
      <View
        accessibilityRole="tablist"
        className="mb-2 flex-row rounded-xl bg-gray-100 p-1"
      >
        <TabButton
          label="Upcoming"
          count={upcoming.length}
          active={tab === "upcoming"}
          onPress={() => setTab("upcoming")}
        />
        <TabButton
          label="Past"
          count={past.length}
          active={tab === "past"}
          onPress={() => setTab("past")}
        />
      </View>

      {visible.length === 0 ? (
        tab === "upcoming" ? (
          <EmptyState
            title="No upcoming events"
            hint="New volunteer opportunities will show up here."
          />
        ) : (
          <EmptyState
            title="No past events"
            hint="Events you've been part of will appear here."
          />
        )
      ) : (
        visible.map((event) => (
          <View key={event._id} className={tab === "past" ? "opacity-60" : ""}>
            <EventCard
              event={event}
              onPress={() => router.push(`/events/${event._id}`)}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}
