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

const formatDate = (date: string) =>
  new Date(date).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Event>(`/events/${id}`);
      setEvent(data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to load event");
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
    if (!event || !user) return { disabled: true, label: "Loading", reason: "" };

    const now = Date.now();
    const start = new Date(event.date).getTime();
    const cancelLock = start - 10 * 60 * 60 * 1000;
    const registeredCount =
      user.gender === "brother" ? event.brothersRegistered : event.sistersRegistered;
    const maxCount = user.gender === "brother" ? event.brothersMax : event.sistersMax;

    if (event.myStatus === "approved") {
      return { disabled: true, label: `Hours confirmed (+${event.hours} hrs)`, reason: "" };
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
  }, [event, user]);

  const handleAction = async () => {
    if (!event) return;

    try {
      setActionLoading(true);

      if (event.myStatus === "registered") {
        Alert.alert("Cancel registration", "Are you sure you want to cancel?", [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel registration",
            style: "destructive",
            onPress: async () => {
              try {
                await api.delete(`/events/${event._id}/register`);
                await loadEvent();
              } catch (error: any) {
                Alert.alert(
                  "Error",
                  error.response?.data?.message || "Failed to cancel registration",
                );
              } finally {
                setActionLoading(false);
              }
            },
          },
        ]);
        return;
      }

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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  const userContact =
    user?.gender === "brother" ? event.brothersContact : user?.gender === "sister" ? event.sistersContact : undefined;

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-5">
      <View className="rounded-lg border border-gray-200 bg-white p-4">
        <Text className="text-2xl font-bold text-gray-900">{event.name}</Text>
        <Text className="mt-2 text-gray-500">{formatDate(event.date)}</Text>
        <Text className="text-gray-500">{event.location}</Text>
        <Text className="mt-2 text-green-700">{event.hours} volunteer hours</Text>

        {event.brothersMax > 0 && (
          <Text className="mt-3 text-gray-500">
            Brothers: {event.brothersRegistered}/{event.brothersMax}
          </Text>
        )}
        {event.sistersMax > 0 && (
          <Text className="text-gray-500">
            Sisters: {event.sistersRegistered}/{event.sistersMax}
          </Text>
        )}
      </View>

      {(event.myStatus === "registered" || event.myStatus === "approved") && userContact && (
        <View className="rounded-lg border border-gray-200 bg-white p-4">
          <Text className="text-lg font-semibold text-gray-900">Your contact</Text>
          <Text className="mt-2 text-gray-500">{userContact.name}</Text>
          <Pressable onPress={() => Linking.openURL(`tel:${userContact.phone}`)}>
            <Text className="mt-1 font-semibold text-green-700">{userContact.phone}</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        onPress={handleAction}
        disabled={eventState.disabled || actionLoading}
        className={`rounded-lg p-4 ${eventState.disabled ? "bg-gray-200" : "bg-green-700"}`}
      >
        {actionLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text
            className={`text-center font-semibold ${eventState.disabled ? "text-gray-500" : "text-white"}`}
          >
            {eventState.label}
          </Text>
        )}
      </Pressable>

      {eventState.reason ? <Text className="text-sm text-gray-500">{eventState.reason}</Text> : null}
    </ScrollView>
  );
}
