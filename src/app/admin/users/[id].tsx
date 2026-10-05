import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import HoursHistoryList from "@/components/HoursHistoryList";
import { ErrorState, LoadingState } from "@/components/ScreenState";
import SectionHeader from "@/components/SectionHeader";
import StatCard from "@/components/StatCard";
import TextField from "@/components/TextField";
import api from "@/constants/api";
import { useAuth } from "@/context/AuthContext";
import { useSnackbar } from "@/context/SnackbarContext";
import { useScreenData } from "@/hooks/use-screen-data";
import { VolunteerHours } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { getAge } from "@/utils/dateOfBirth";
import {
  formatHours,
  formatShortDate,
  formatSignedHours,
} from "@/utils/hours";
import { fieldErrors } from "@/validation/account";
import { adjustmentFormSchema } from "@/validation/hours";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

type FormField = "amount" | "reason";

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 ${
        selected ? "bg-green-700" : "bg-gray-50 active:bg-gray-100"
      }`}
    >
      <Text
        numberOfLines={1}
        className={`text-sm font-semibold ${
          selected ? "text-white" : "text-gray-900"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function EventOption({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className="flex-row items-center gap-3 py-3"
    >
      <View
        className={`h-5 w-5 items-center justify-center rounded-full border-2 ${
          selected ? "border-green-700" : "border-gray-300"
        }`}
      >
        {selected && <View className="h-2.5 w-2.5 rounded-full bg-green-700" />}
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base text-gray-900">
          {label}
        </Text>
        {detail ? (
          <Text className="text-sm text-gray-500">{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function VolunteerHoursScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const { show } = useSnackbar();
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [eventId, setEventId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FormField, string>>>({});
  const [saving, setSaving] = useState(false);

  const fetchHours = useCallback(async () => {
    const { data: hours } = await api.get<VolunteerHours>(`/users/${id}/hours`);
    return hours;
  }, [id]);

  const { data, loading, error, refreshing, reload, refresh, retry } =
    useScreenData(fetchHours);

  if (loading || !data) {
    return (
      <View className="flex-1 bg-white">
        <BackBar fallback="/(tabs)/admin" />
        {error ? <ErrorState message={error} onRetry={retry} /> : <LoadingState />}
      </View>
    );
  }

  const isSelf = me?._id === data.user._id;
  const age = data.user.dateOfBirth ? getAge(data.user.dateOfBirth) : null;
  const events = data.items.flatMap((item) =>
    item.type === "event" ? [item] : [],
  );
  const selectedEvent = events.find((event) => event.eventId === eventId);

  // Live preview of what the save will do.
  const parsedAmount = Number(amount);
  const signed =
    amount.trim() && Number.isFinite(parsedAmount)
      ? direction === "add"
        ? parsedAmount
        : -parsedAmount
      : null;

  const clearError = (field: FormField) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  const save = async () => {
    const parsed = adjustmentFormSchema.safeParse({ amount, reason });

    if (!parsed.success) {
      setErrors(fieldErrors<FormField>(parsed.error));
      return;
    }

    const value =
      direction === "add" ? parsed.data.amount : -parsed.data.amount;

    try {
      setSaving(true);
      await api.post(`/users/${id}/hour-adjustments`, {
        amount: value,
        reason: parsed.data.reason,
        ...(eventId ? { eventId } : {}),
      });
      setAmount("");
      setReason("");
      setEventId(null);
      await reload();
      show({ message: `Hours adjusted (${formatSignedHours(value)})` });
    } catch (error) {
      Alert.alert("Couldn't adjust hours", apiErrorMessage(error, "Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <BackBar fallback="/(tabs)/admin" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="gap-8 px-5 pb-10 pt-2"
          keyboardShouldPersistTaps="handled"
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
          <View className="gap-1">
            <Text
              accessibilityRole="header"
              className="text-3xl font-semibold text-gray-900"
            >
              {data.user.firstName} {data.user.lastName}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-sm text-gray-500">
                {data.user.gender === "brother" ? "Brother" : "Sister"} ·{" "}
                {age !== null ? age : "Age not set"}
              </Text>
              {age !== null && age < 18 && (
                <View className="rounded-full bg-gray-900 px-2 py-0.5">
                  <Text className="text-xs font-semibold text-white">
                    Under 18
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View className="flex-row">
            <StatCard label="Volunteer hours" value={data.total} />
          </View>

          <View>
            <SectionHeader title="Hours history" />
            <HoursHistoryList
              items={data.items}
              emptyTitle="No hours yet"
              emptyHint="Approved events and adjustments will appear here."
            />
          </View>

          {isSelf ? (
            <Text className="text-sm text-gray-500">
              You can&apos;t adjust your own hours. Ask another admin.
            </Text>
          ) : (
            <View className="gap-5">
              <View className="gap-1">
                <SectionHeader title="Adjust hours" />
                <Text className="text-sm text-gray-500">
                  For partial shifts or corrections. Every change is logged
                  with your name and reason.
                </Text>
              </View>

              <View accessibilityRole="radiogroup" className="flex-row gap-3">
                <Choice
                  label="Add hours"
                  selected={direction === "add"}
                  onPress={() => setDirection("add")}
                />
                <Choice
                  label="Remove hours"
                  selected={direction === "remove"}
                  onPress={() => setDirection("remove")}
                />
              </View>

              <TextField
                label="Hours"
                value={amount}
                onChangeText={(text) => {
                  setAmount(text);
                  clearError("amount");
                }}
                error={errors.amount}
                hint="Quarter hours, like 1.5 or 0.25"
                keyboardType="decimal-pad"
              />

              {events.length > 0 && (
                <View>
                  <Text className="text-sm font-medium text-gray-700">
                    For an event
                  </Text>
                  <View accessibilityRole="radiogroup">
                    <EventOption
                      label="Not for a specific event"
                      selected={eventId === null}
                      onPress={() => setEventId(null)}
                    />
                    {events.map((event) => (
                      <EventOption
                        key={event.eventId}
                        label={event.name}
                        detail={`${formatShortDate(event.date)} · ${formatHours(event.hours)} counted`}
                        selected={eventId === event.eventId}
                        onPress={() => setEventId(event.eventId)}
                      />
                    ))}
                  </View>
                </View>
              )}

              <TextField
                label="Reason"
                value={reason}
                onChangeText={(text) => {
                  setReason(text);
                  clearError("reason");
                }}
                error={errors.reason}
                placeholder="e.g. Left 1.5 hours early"
                multiline
              />

              {signed !== null && (
                <View className="gap-1 rounded-xl bg-gray-50 px-4 py-3">
                  <Text className="text-sm text-gray-900">
                    Total: {formatHours(data.total)} →{" "}
                    {formatHours(Math.round((data.total + signed) * 100) / 100)}
                  </Text>
                  {selectedEvent && (
                    <Text className="text-sm text-gray-500">
                      {selectedEvent.name}: {formatHours(selectedEvent.hours)} →{" "}
                      {formatHours(
                        Math.round((selectedEvent.hours + signed) * 100) / 100,
                      )}
                    </Text>
                  )}
                </View>
              )}

              <Button title="Save adjustment" onPress={save} loading={saving} />
            </View>
          )}

          {data.audit.length > 0 && (
            <View>
              <SectionHeader title="Adjustment log" />
              {data.audit.map((entry) => (
                <View key={entry.id} className="border-b border-gray-100 py-4">
                  <Text className="text-base text-gray-900">
                    {formatSignedHours(entry.amount)} · {entry.reason}
                  </Text>
                  <Text className="mt-0.5 text-sm text-gray-500">
                    {entry.by} · {formatShortDate(entry.date)} · total{" "}
                    {entry.before} → {entry.after}
                  </Text>
                  {entry.event && (
                    <Text className="mt-0.5 text-sm text-gray-500">
                      {entry.event.name}: {entry.event.hoursBefore} →{" "}
                      {entry.event.hoursAfter}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
