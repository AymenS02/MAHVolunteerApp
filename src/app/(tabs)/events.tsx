import EventCard from "@/components/EventCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import api from "@/constants/api";
import { useSnackbar, useSnackbarOffset } from "@/context/SnackbarContext";
import { useScreenData } from "@/hooks/use-screen-data";
import { EventPage } from "@/types";
import { onEventsChanged } from "@/utils/eventsChanged";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

type Tab = "upcoming" | "past";
type Pages = Record<Tab, EventPage>;

const PAGE_SIZE = 20;

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
      accessibilityLabel={`${label}, ${count} ${count === 1 ? "event" : "events"}`}
      // Both states set a shadow so NativeWind sees its CSS variables on the
      // first render; adding them later remounts the button and crashes in dev.
      className={`min-h-[44px] flex-1 items-center justify-center rounded-lg py-2.5 ${
        active ? "bg-white shadow-sm" : "shadow-none"
      }`}
    >
      <Text
        className={`text-sm ${
          active ? "font-semibold text-gray-900" : "font-medium text-gray-600"
        }`}
      >
        {label}
        <Text className="font-normal text-gray-600"> {count}</Text>
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

// First page of both tabs, so both counts are right.
const fetchFirstPages = async (): Promise<Pages> => {
  const [upcoming, past] = await Promise.all([
    fetchPage("upcoming"),
    fetchPage("past"),
  ]);
  return { upcoming, past };
};

export default function EventsScreen() {
  const router = useRouter();
  const { show } = useSnackbar();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [loadingMore, setLoadingMore] = useState(false);
  useSnackbarOffset(useBottomTabBarHeight());

  const { data, setData, loading, error, refreshing, reload, refresh, retry } =
    useScreenData(fetchFirstPages);

  useEffect(() => onEventsChanged(() => reload()), [reload]);

  const loadMore = async () => {
    const base = data;
    const page = base?.[tab];
    if (!base || !page?.nextCursor || loadingMore) return;

    try {
      setLoadingMore(true);
      const next = await fetchPage(tab, page.nextCursor);
      // If the list was reloaded meanwhile, this page belongs to the old one.
      setData((prev) => {
        if (prev !== base) return prev;
        const seen = new Set(base[tab].items.map((event) => event._id));
        return {
          ...base,
          [tab]: {
            items: [
              ...base[tab].items,
              ...next.items.filter((event) => !seen.has(event._id)),
            ],
            nextCursor: next.nextCursor,
            total: next.total,
          },
        };
      });
    } catch {
      show({ message: "Couldn't load more events. Check your connection." });
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading || !data) {
    return (
      <View className="flex-1 bg-white">
        {error ? <ErrorState message={error} onRetry={retry} /> : <LoadingState />}
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-white"
      contentContainerClassName="px-5 pb-10 pt-4"
      showsVerticalScrollIndicator={false}
      data={data[tab].items}
      keyExtractor={(event) => event._id}
      renderItem={({ item }) => (
        <EventCard
          event={item}
          onPress={() => router.push(`/events/${item._id}`)}
        />
      )}
      ItemSeparatorComponent={() => <View className="h-3" />}
      ListHeaderComponent={
        <View
          accessibilityRole="tablist"
          className="mb-5 flex-row rounded-xl bg-gray-100 p-1"
        >
          <TabButton
            label="Upcoming"
            count={data.upcoming.total}
            active={tab === "upcoming"}
            onPress={() => setTab("upcoming")}
          />
          <TabButton
            label="Past"
            count={data.past.total}
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
            hint="Events that have already happened will appear here."
          />
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="py-6">
            <ActivityIndicator
              color="#15803d"
              accessibilityLabel="Loading more events"
            />
          </View>
        ) : null
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor="#15803d"
          colors={["#15803d"]}
        />
      }
    />
  );
}
