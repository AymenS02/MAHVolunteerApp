import EventCard from "@/components/EventCard";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import { mockEvents, mockUser } from "@/constants/mockData";
import { getStats, splitEvents } from "@/utils/format";
import { ScrollView, Text, View } from "react-native";

export default function HomeScreen() {
  const { totalHours, eventsCompleted } = getStats(mockEvents);
  const { registered } = splitEvents(mockEvents);

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="gap-6 p-5"
    >
      <View>
        <Text className="text-2xl font-bold text-slate-900">
          Assalamu Alaikum, {mockUser.name} 👋
        </Text>
        <Text className="mt-1 text-slate-500">
          Thank you for serving the community.
        </Text>
      </View>

      <View className="flex-row gap-3">
        <StatCard label="Volunteer hours" value={totalHours} />
        <StatCard label="Events completed" value={eventsCompleted} />
      </View>

      <View className="gap-3">
        <SectionHeader title="Your Upcoming Events" />
        {registered.length === 0 ? (
          <Text className="text-slate-500">
            You haven't registered for any events yet. Check the Events tab!
          </Text>
        ) : (
          registered.map((event) => (
            <EventCard key={event.id} event={event} variant="registered" />
          ))
        )}
      </View>
    </ScrollView>
  );
}
