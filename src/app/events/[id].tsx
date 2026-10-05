import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { Event } from "@/types";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const formatDate = (date: string) =>
  new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row gap-4">
      <Text className="w-16 text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-base text-gray-900">{value}</Text>
    </View>
  );
}

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [now, setNow] = useState(0);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Event>(`/events/${id}`);
      setEvent(data);
      setNow(Date.now());
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load event",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

  const eventState = useMemo(() => {
    if (!event || !user)
      return { disabled: true, label: "Loading", reason: "" };

    const start = new Date(event.date).getTime();
    const cancelLock = start - 10 * 60 * 60 * 1000;
    const registeredCount =
      user.gender === "brother"
        ? event.brothersRegistered
        : event.sistersRegistered;
    const maxCount =
      user.gender === "brother" ? event.brothersMax : event.sistersMax;

    if (event.myStatus === "approved") {
      return {
        disabled: true,
        label: `Hours confirmed (+${event.hours} hrs)`,
        reason: "",
      };
    }

    if (event.myStatus === "registered") {
      if (now >= cancelLock) {
        return {
          disabled: true,
          label: "Cancellation locked",
          reason: "You can no longer cancel within 10 hours of the event.",
        };
      }

      return { disabled: false, label: "Cancel Registration", reason: "" };
    }

    if (now >= start) {
      return { disabled: true, label: "Event has started", reason: "" };
    }

    if (maxCount === 0) {
      return {
        disabled: true,
        label: "Not needed for your group",
        reason: "This event is not accepting your gender for this shift.",
      };
    }

    if (registeredCount >= maxCount) {
      return {
        disabled: true,
        label: "No spots available",
        reason: "All spots are filled for your gender.",
      };
    }

    return { disabled: false, label: "Register to Volunteer", reason: "" };
  }, [event, now, user]);

  const handleAction = async () => {
    if (!event) return;

    if (event.myStatus === "registered") {
      Alert.alert("Cancel registration", "Are you sure you want to cancel?", [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel registration",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              await api.delete(`/events/${event._id}/register`);
              await loadEvent();
            } catch (error: any) {
              Alert.alert(
                "Error",
                error.response?.data?.message ||
                  "Failed to cancel registration",
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]);
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/events/${event._id}/register`);
      await loadEvent();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Request failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !event) {
    return (
      <View className="flex-1 bg-white">
        <BackBar />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#15803d" />
        </View>
      </View>
    );
  }

  const userContact =
    user?.gender === "brother"
      ? event.brothersContact
      : user?.gender === "sister"
        ? event.sistersContact
        : undefined;

  const approved = event.myStatus === "approved";
  const registered = event.myStatus === "registered";

  return (
    <View className="flex-1 bg-white">
      <BackBar />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-5 pb-8 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          {(registered || approved) && (
            <View
              className={`self-start rounded-full px-2.5 py-1 ${
                approved ? "bg-green-700" : "bg-green-100"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  approved ? "text-white" : "text-green-800"
                }`}
              >
                {approved ? "Approved" : "Registered"}
              </Text>
            </View>
          )}
          <Text className="text-3xl font-semibold text-gray-900">
            {event.name}
          </Text>
        </View>

        <View className="gap-4 rounded-2xl bg-gray-50 p-5">
          <DetailRow label="When" value={formatDate(event.date)} />
          <DetailRow label="Where" value={event.location} />
          <DetailRow
            label="Hours"
            value={`${event.hours} volunteer ${event.hours === 1 ? "hour" : "hours"}`}
          />
        </View>

        {(event.brothersMax > 0 || event.sistersMax > 0) && (
          <View className="gap-3">
            <SectionHeader title="Spots" />
            {event.brothersMax > 0 && (
              <View className="flex-row items-center justify-between">
                <Text className="text-base text-gray-900">Brothers</Text>
                <Text className="text-base text-gray-500">
                  {event.brothersRegistered} of {event.brothersMax} filled
                </Text>
              </View>
            )}
            {event.sistersMax > 0 && (
              <View className="flex-row items-center justify-between">
                <Text className="text-base text-gray-900">Sisters</Text>
                <Text className="text-base text-gray-500">
                  {event.sistersRegistered} of {event.sistersMax} filled
                </Text>
              </View>
            )}
          </View>
        )}

        {(registered || approved) && userContact && (
          <View className="gap-3">
            <SectionHeader title="Your contact" />
            <View className="flex-row items-center justify-between gap-4">
              <Text className="flex-1 text-base text-gray-900">
                {userContact.name}
              </Text>
              <Pressable
                onPress={() => Linking.openURL(`tel:${userContact.phone}`)}
                accessibilityRole="link"
                hitSlop={8}
              >
                <Text className="text-base font-semibold text-green-700">
                  {userContact.phone}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <View className="border-t border-gray-100 bg-white">
        <SafeAreaView edges={["bottom"]}>
          <View className="gap-2 px-5 pb-3 pt-3">
            {eventState.disabled ? (
              <View
                className={`min-h-[52px] items-center justify-center rounded-xl px-5 ${
                  approved ? "bg-green-50" : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-base font-semibold ${
                    approved ? "text-green-800" : "text-gray-500"
                  }`}
                >
                  {eventState.label}
                </Text>
              </View>
            ) : (
              <Button
                title={eventState.label}
                onPress={handleAction}
                loading={actionLoading}
                variant={registered ? "outline" : "primary"}
              />
            )}
            {eventState.reason ? (
              <Text className="text-center text-sm text-gray-500">
                {eventState.reason}
              </Text>
            ) : null}
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
}
