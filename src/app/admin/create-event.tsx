import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

type FieldProps = TextInputProps & { label: string; hint?: string };

function Field({ label, hint, ...props }: FieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <TextInput
        placeholderTextColor="#9ca3af"
        className="rounded-xl bg-gray-50 px-4 py-3.5 text-base text-gray-900"
        {...props}
      />
      {hint ? <Text className="text-xs text-gray-500">{hint}</Text> : null}
    </View>
  );
}

function PickerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View className="flex-1 gap-1.5">
      <Text className="text-sm font-medium text-gray-700">{label}</Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="rounded-xl bg-gray-50 px-4 py-3.5 active:bg-gray-100"
      >
        <Text className="text-base text-gray-900">{value}</Text>
      </Pressable>
    </View>
  );
}

export default function CreateEventScreen() {
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [hours, setHours] = useState("1");
  const [brothersMax, setBrothersMax] = useState("0");
  const [sistersMax, setSistersMax] = useState("0");
  const [brothersContactName, setBrothersContactName] = useState("");
  const [brothersContactPhone, setBrothersContactPhone] = useState("");
  const [sistersContactName, setSistersContactName] = useState("");
  const [sistersContactPhone, setSistersContactPhone] = useState("");
  const [dateTime, setDateTime] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return next;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const brothersNeeded = useMemo(() => Number(brothersMax) > 0, [brothersMax]);
  const sistersNeeded = useMemo(() => Number(sistersMax) > 0, [sistersMax]);

  const submit = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert("Missing fields", "Name and location are required.");
      return;
    }

    if (
      brothersNeeded &&
      (!brothersContactName.trim() || !brothersContactPhone.trim())
    ) {
      Alert.alert(
        "Missing fields",
        "Brothers contact name and phone are required.",
      );
      return;
    }

    if (
      sistersNeeded &&
      (!sistersContactName.trim() || !sistersContactPhone.trim())
    ) {
      Alert.alert(
        "Missing fields",
        "Sisters contact name and phone are required.",
      );
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/events", {
        name: name.trim(),
        location: location.trim(),
        hours: Number(hours),
        brothersMax: Number(brothersMax),
        sistersMax: Number(sistersMax),
        date: dateTime.toISOString(),
        brothersContact: brothersNeeded
          ? {
              name: brothersContactName.trim(),
              phone: brothersContactPhone.trim(),
            }
          : undefined,
        sistersContact: sistersNeeded
          ? {
              name: sistersContactName.trim(),
              phone: sistersContactPhone.trim(),
            }
          : undefined,
      });

      router.back();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to create event",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BackBar fallback="/(tabs)/admin" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-5 pb-12 pt-2"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl font-semibold text-gray-900">New event</Text>

        <View className="gap-4">
          <Field
            label="Name"
            value={name}
            onChangeText={setName}
            placeholder="Event name"
          />
          <Field
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="Where is it?"
          />
          <Field
            label="Volunteer hours"
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
          />
        </View>

        <View className="gap-4">
          <SectionHeader title="Date and time" />
          <View className="flex-row gap-3">
            <PickerField
              label="Date"
              value={dateTime.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              onPress={() => setShowDatePicker(true)}
            />
            <PickerField
              label="Time"
              value={dateTime.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
              onPress={() => setShowTimePicker(true)}
            />
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={dateTime}
              mode="date"
              onChange={(_, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selectedDate) {
                  const next = new Date(dateTime);
                  next.setFullYear(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    selectedDate.getDate(),
                  );
                  setDateTime(next);
                }
              }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={dateTime}
              mode="time"
              onChange={(_, selectedDate) => {
                setShowTimePicker(Platform.OS === "ios");
                if (selectedDate) {
                  const next = new Date(dateTime);
                  next.setHours(
                    selectedDate.getHours(),
                    selectedDate.getMinutes(),
                    0,
                    0,
                  );
                  setDateTime(next);
                }
              }}
            />
          )}
        </View>

        <View className="gap-4">
          <SectionHeader title="Volunteers needed" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field
                label="Brothers"
                value={brothersMax}
                onChangeText={setBrothersMax}
                keyboardType="numeric"
              />
            </View>
            <View className="flex-1">
              <Field
                label="Sisters"
                value={sistersMax}
                onChangeText={setSistersMax}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text className="-mt-2 text-xs text-gray-500">
            Enter 0 if a group isn&apos;t needed.
          </Text>
        </View>

        {brothersNeeded && (
          <View className="gap-4">
            <SectionHeader title="Brothers contact" />
            <Field
              label="Name"
              value={brothersContactName}
              onChangeText={setBrothersContactName}
              placeholder="Contact name"
            />
            <Field
              label="Phone"
              value={brothersContactPhone}
              onChangeText={setBrothersContactPhone}
              keyboardType="phone-pad"
              placeholder="Contact phone"
            />
          </View>
        )}

        {sistersNeeded && (
          <View className="gap-4">
            <SectionHeader title="Sisters contact" />
            <Field
              label="Name"
              value={sistersContactName}
              onChangeText={setSistersContactName}
              placeholder="Contact name"
            />
            <Field
              label="Phone"
              value={sistersContactPhone}
              onChangeText={setSistersContactPhone}
              keyboardType="phone-pad"
              placeholder="Contact phone"
            />
          </View>
        )}

        <Button title="Create event" onPress={submit} loading={submitting} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
