import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar, useSnackbarOffset } from "@/context/SnackbarContext";
import { Event, EventMessage } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { notifyEventsChanged } from "@/utils/eventsChanged";
import { formatHours, formatShortDate } from "@/utils/hours";
import { openInMaps } from "@/utils/maps";
import { offerNotificationsOnce } from "@/utils/push";
import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
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

// The location, tappable to open it in the maps app.
function LocationRow({ location }: { location: string }) {
  return (
    <Pressable
      onPress={() => openInMaps(location)}
      accessibilityRole="link"
      accessibilityHint="Opens this location in your maps app"
      className="flex-row gap-4"
    >
      <Text className="w-16 text-sm text-gray-500">Where</Text>
      <View className="flex-1">
        <Text className="text-base text-gray-900">{location}</Text>
        <View className="mt-1 flex-row items-center gap-1">
          <Ionicons name="navigate-outline" size={14} color="#15803d" />
          <Text className="text-sm font-semibold text-green-700">
            Open in Maps
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [now, setNow] = useState(0);
  const [missing, setMissing] = useState(false);
  const [messages, setMessages] = useState<EventMessage[]>([]);
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const { show } = useSnackbar();
  useSnackbarOffset(actionBarHeight);

  const loadEvent = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<Event>(`/events/${id}`);
      setEvent(data);

      // Organizer messages are for people signed up or waiting.
      if (data.myStatus || data.myWaitlistPosition) {
        api
          .get<EventMessage[]>(`/events/${id}/messages`)
          .then(({ data: list }) => setMessages(list))
          .catch(() => setMessages([]));
      } else {
        setMessages([]);
      }
      setMissing(false);
      setNow(Date.now());
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        setMissing(true);
      } else {
        Alert.alert("Error", apiErrorMessage(error, "Failed to load event"));
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadEvent();
    }, [loadEvent]),
  );

  type Action = "register" | "cancel" | "join" | "leave" | null;

  const eventState = useMemo((): {
    disabled: boolean;
    label: string;
    reason: string;
    action: Action;
  } => {
    if (!event || !user)
      return { disabled: true, label: "Loading", reason: "", action: null };

    const start = new Date(event.date).getTime();
    const cancelLock = start - 10 * 60 * 60 * 1000;
    const registeredCount =
      user.gender === "brother"
        ? event.brothersRegistered
        : event.sistersRegistered;
    const maxCount =
      user.gender === "brother" ? event.brothersMax : event.sistersMax;
    const waitingCount =
      (user.gender === "brother"
        ? event.brothersWaitlisted
        : event.sistersWaitlisted) ?? 0;
    const none = { reason: "", action: null };

    if (event.myStatus === "approved") {
      return {
        disabled: true,
        label: `Hours confirmed (+${formatHours(event.myHours ?? event.hours)})`,
        ...none,
      };
    }

    if (event.myStatus === "registered") {
      if (now >= start) {
        return { disabled: true, label: "Event has started", ...none };
      }

      if (now >= cancelLock) {
        // The date moved after they signed up, so the lock doesn't apply.
        if (event.myCancelLockWaived) {
          return {
            disabled: false,
            label: "Cancel registration",
            reason:
              "The date changed after you signed up, so you can still cancel.",
            action: "cancel",
          };
        }

        return {
          disabled: true,
          label: "Cancellation locked",
          reason: "You can no longer cancel within 10 hours of the event.",
          action: null,
        };
      }

      return {
        disabled: false,
        label: "Cancel registration",
        reason: "",
        action: "cancel",
      };
    }

    if (now >= start) {
      return { disabled: true, label: "Event has started", ...none };
    }

    if (event.signupsOpen === false) {
      return {
        disabled: true,
        label: "Sign-ups closed",
        reason: "Sign-ups and the waitlist close 10 hours before the event.",
        action: null,
      };
    }

    if (event.myWaitlistPosition) {
      return {
        disabled: false,
        label: "Leave waitlist",
        reason: `You're #${event.myWaitlistPosition} on the waitlist. If a spot opens, it's yours automatically.`,
        action: "leave",
      };
    }

    if (maxCount === 0) {
      return {
        disabled: true,
        label: "Not needed for your group",
        reason: "This event is not accepting your gender for this shift.",
        action: null,
      };
    }

    // Full, or people are already waiting: the next spot goes to the queue.
    if (registeredCount >= maxCount || waitingCount > 0) {
      return {
        disabled: false,
        label: "Join waitlist",
        reason:
          waitingCount > 0
            ? `${waitingCount} ${waitingCount === 1 ? "person is" : "people are"} waiting ahead of you.`
            : "All spots are filled. Join the waitlist to get the next one.",
        action: "join",
      };
    }

    return {
      disabled: false,
      label: "Register to volunteer",
      reason: "",
      action: "register",
    };
  }, [event, now, user]);

  const handleAction = async () => {
    if (!event) return;

    if (eventState.action === "leave") {
      // Leaving can't be undone (rejoining puts you at the back), so confirm.
      Alert.alert(
        "Leave the waitlist?",
        "If you rejoin later, you'll go to the back of the line.",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Leave",
            style: "destructive",
            onPress: async () => {
              try {
                setActionLoading(true);
                const { data } = await api.delete<Event>(
                  `/events/${event._id}/waitlist`,
                );
                setEvent(data);
                notifyEventsChanged();
              } catch (error) {
                Alert.alert(
                  "Error",
                  apiErrorMessage(error, "Failed to leave the waitlist"),
                );
              } finally {
                setActionLoading(false);
              }
            },
          },
        ],
      );
      return;
    }

    if (eventState.action === "join") {
      try {
        setActionLoading(true);
        const { data } = await api.post<Event>(`/events/${event._id}/waitlist`);
        setEvent(data);
        notifyEventsChanged();
        offerNotificationsOnce();
        show({
          message: data.myWaitlistPosition
            ? `You're #${data.myWaitlistPosition} on the waitlist`
            : "A spot opened up. You're registered!",
        });
      } catch (error) {
        Alert.alert("Error", apiErrorMessage(error, "Failed to join the waitlist"));
        await loadEvent();
      } finally {
        setActionLoading(false);
      }
      return;
    }

    // No confirm dialog: the Undo snackbar is the safety net.
    if (eventState.action === "cancel") {
      try {
        setActionLoading(true);
        const { data } = await api.delete<Event>(
          `/events/${event._id}/register`,
        );
        setEvent(data);
        notifyEventsChanged();
        show({
          message: "Registration cancelled",
          actionLabel: "Undo",
          onAction: async () => {
            const { data: restored } = await api.post<Event>(
              `/events/${event._id}/register/undo`,
            );
            setEvent(restored);
            notifyEventsChanged();
            return "You're registered again";
          },
        });
      } catch (error) {
        Alert.alert(
          "Error",
          apiErrorMessage(error, "Failed to cancel registration"),
        );
      } finally {
        setActionLoading(false);
      }
      return;
    }

    try {
      setActionLoading(true);
      await api.post(`/events/${event._id}/register`);
      await loadEvent();
      // A good moment to offer reminders (asked once).
      offerNotificationsOnce();
    } catch (error) {
      // E.g. the last spot was taken a moment ago: show the waitlist option.
      Alert.alert("Error", apiErrorMessage(error, "Request failed"));
      await loadEvent();
    } finally {
      setActionLoading(false);
    }
  };

  if (missing) {
    return (
      <View className="flex-1 bg-white">
        <BackBar />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-semibold text-gray-900">
            Event not available
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            This event was removed or no longer exists.
          </Text>
        </View>
      </View>
    );
  }

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
  const waitlisted = !!event.myWaitlistPosition;

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
          {waitlisted && (
            <View className="self-start rounded-full border border-gray-300 px-2.5 py-1">
              <Text className="text-xs font-semibold text-gray-900">
                Waitlisted #{event.myWaitlistPosition}
              </Text>
            </View>
          )}
          <Text className="text-3xl font-semibold text-gray-900">
            {event.name}
          </Text>
        </View>

        {registered && event.myPromotedAt && (
          <View className="flex-row gap-3 rounded-xl bg-green-50 px-4 py-3">
            <Ionicons name="checkmark-circle" size={18} color="#15803d" />
            <Text className="flex-1 text-sm text-green-800">
              You got a spot from the waitlist.
            </Text>
          </View>
        )}

        {(registered || approved || waitlisted) && event.previousDate && (
          <View className="flex-row gap-3 rounded-xl border border-gray-200 px-4 py-3">
            <Ionicons name="calendar-outline" size={18} color="#111827" />
            <Text className="flex-1 text-sm text-gray-900">
              The date changed. It was {formatDate(event.previousDate)}.
            </Text>
          </View>
        )}

        <View className="gap-4 rounded-2xl bg-gray-50 p-5">
          <DetailRow label="When" value={formatDate(event.date)} />
          <LocationRow location={event.location} />
          <DetailRow
            label="Hours"
            value={`${event.hours} volunteer ${event.hours === 1 ? "hour" : "hours"}`}
          />
        </View>

        {event.description ? (
          <View className="gap-3">
            <SectionHeader title="Details" />
            <Text className="text-base leading-6 text-gray-900">
              {event.description}
            </Text>
          </View>
        ) : null}

        {messages.length > 0 && (
          <View className="gap-3">
            <SectionHeader title="Messages from organizers" />
            {messages.map((message) => (
              <View key={message.id} className="gap-1 rounded-xl bg-gray-50 p-4">
                <Text className="text-base leading-6 text-gray-900">
                  {message.body}
                </Text>
                <Text className="text-xs text-gray-500">
                  {formatShortDate(message.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}

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

      <View
        onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}
        className="border-t border-gray-100 bg-white"
      >
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
                variant={
                  eventState.action === "register" ? "primary" : "outline"
                }
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
