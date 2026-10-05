import EventCard from "@/components/EventCard";
import api from "@/constants/api";
import { useSnackbarOffset } from "@/context/SnackbarContext";
import { EventPage } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { onEventsChanged } from "@/utils/eventsChanged";
import { useFocusEffect, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";

type Tab = "upcoming" | "past";

const PAGE_SIZE = 20;
const EMPTY_PAGE: EventPage = { items: [], nextCursor: null, total: 0 };

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

const fetchPage = async (when: Tab, cursor?: string | null) => {
  const { data } = await api.get<EventPage>("/events", {
    params: { when, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
  });
  return data;
};

export default function EventsScreen() {
  const router = useRouter();
  const [pages, setPages] = useState<Record<Tab, EventPage>>({
    upcoming: EMPTY_PAGE,
    past: EMPTY_PAGE,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tab, setTab] = useState<Tab>("upcoming");
  // Bumped on every reload so a slow "load more" can't append to a newer list.
  const generation = useRef(0);
  useSnackbarOffset(useBottomTabBarHeight());

  // First page of both tabs, so both counts are right.
  const reload = useCallback(async (showSpinner = true) => {
    const current = ++generation.current;
    try {
      if (showSpinner) setLoading(true);
      const [upcoming, past] = await Promise.all([
        fetchPage("upcoming"),
        fetchPage("past"),
      ]);
      if (current === generation.current) setPages({ upcoming, past });
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, "Failed to load events"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => onEventsChanged(() => reload(false)), [reload]);

  const refresh = async () => {
    setRefreshing(true);
    await reload(false);
    setRefreshing(false);
  };

  const loadMore = async () => {
    const page = pages[tab];
    if (!page.nextCursor || loadingMore) return;

    const current = generation.current;
    try {
      setLoadingMore(true);
      const next = await fetchPage(tab, page.nextCursor);
      if (current !== generation.current) return;
      setPages((prev) => {
        const seen = new Set(prev[tab].items.map((event) => event._id));
        return {
          ...prev,
          [tab]: {
            items: [
              ...prev[tab].items,
              ...next.items.filter((event) => !seen.has(event._id)),
            ],
            nextCursor: next.nextCursor,
            total: next.total,
          },
        };
      });
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, "Failed to load more events"));
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-4"
      showsVerticalScrollIndicator={false}
      data={pages[tab].items}
      keyExtractor={(event) => event._id}
      renderItem={({ item }) => (
        <View className={tab === "past" ? "opacity-60" : ""}>
          <EventCard
            event={item}
            onPress={() => router.push(`/events/${item._id}`)}
          />
        </View>
      )}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListHeaderComponent={
        <View
          accessibilityRole="tablist"
          className="mb-5 flex-row rounded-xl bg-gray-100 p-1"
        >
          <TabButton
            label="Upcoming"
            count={pages.upcoming.total}
            active={tab === "upcoming"}
            onPress={() => setTab("upcoming")}
          />
          <TabButton
            label="Past"
            count={pages.past.total}
            active={tab === "past"}
            onPress={() => setTab("past")}
          />
        </View>
      }
      ListEmptyComponent={
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
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="py-6">
            <ActivityIndicator color="#15803d" />
          </View>
        ) : null
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshing={refreshing}
      onRefresh={refresh}
    />
  );
}
