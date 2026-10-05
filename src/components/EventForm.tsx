import Button from "@/components/Button";
import PickerField from "@/components/PickerField";
import SectionHeader from "@/components/SectionHeader";
import TextField from "@/components/TextField";
import DateTimePicker from "@react-native-community/datetimepicker";
import { type ReactNode, useState } from "react";
import { Alert, Platform, Text, View } from "react-native";

type Contact = { name: string; phone: string };

// The fields as the server expects them (create and edit use the same shape).
export type EventPayload = {
  name: string;
  date: string;
  location: string;
  description: string;
  hours: number;
  brothersMax: number;
  sistersMax: number;
  brothersContact?: Contact;
  sistersContact?: Contact;
};

export type EventFormInitial = Partial<
  Omit<EventPayload, "brothersContact" | "sistersContact">
> & {
  brothersContact?: Contact | null;
  sistersContact?: Contact | null;
};

const tomorrow = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setSeconds(0, 0);
  return next;
};

// Shared by the create and edit screens.
export default function EventForm({
  initial = {},
  submitLabel,
  onSubmit,
  notice,
}: {
  initial?: EventFormInitial;
  submitLabel: string;
  onSubmit: (payload: EventPayload) => Promise<void>;
  // Shown above the submit button, e.g. what an edit will affect.
  notice?: ReactNode;
}) {
  const [name, setName] = useState(initial.name ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [hours, setHours] = useState(String(initial.hours ?? 1));
  const [brothersMax, setBrothersMax] = useState(String(initial.brothersMax ?? 0));
  const [sistersMax, setSistersMax] = useState(String(initial.sistersMax ?? 0));
  const [brothersContactName, setBrothersContactName] = useState(
    initial.brothersContact?.name ?? "",
  );
  const [brothersContactPhone, setBrothersContactPhone] = useState(
    initial.brothersContact?.phone ?? "",
  );
  const [sistersContactName, setSistersContactName] = useState(
    initial.sistersContact?.name ?? "",
  );
  const [sistersContactPhone, setSistersContactPhone] = useState(
    initial.sistersContact?.phone ?? "",
  );
  const [dateTime, setDateTime] = useState(() =>
    initial.date ? new Date(initial.date) : tomorrow(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const brothersNeeded = Number(brothersMax) > 0;
  const sistersNeeded = Number(sistersMax) > 0;

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
      await onSubmit({
        name: name.trim(),
        location: location.trim(),
        description: description.trim(),
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <View className="gap-4">
        <TextField
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Event name"
        />
        <TextField
          label="Location"
          value={location}
          onChangeText={setLocation}
          placeholder="Address or place name"
          hint="Volunteers can open this in their maps app."
        />
        <TextField
          label="Details"
          value={description}
          onChangeText={setDescription}
          placeholder="What to bring, where to meet, what to wear"
          multiline
          maxLength={2000}
        />
        <TextField
          label="Volunteer hours"
          value={hours}
          onChangeText={setHours}
          keyboardType="decimal-pad"
          hint="In quarter hours, like 1.5 or 2.25"
        />
      </View>

      <View className="gap-4">
        <SectionHeader title="Date and time" />
        <View className="flex-row gap-3">
          <PickerField
            className="flex-1"
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
            className="flex-1"
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
            <TextField
              label="Brothers"
              value={brothersMax}
              onChangeText={setBrothersMax}
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <TextField
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
          <TextField
            label="Name"
            value={brothersContactName}
            onChangeText={setBrothersContactName}
            placeholder="Contact name"
          />
          <TextField
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
          <TextField
            label="Name"
            value={sistersContactName}
            onChangeText={setSistersContactName}
            placeholder="Contact name"
          />
          <TextField
            label="Phone"
            value={sistersContactPhone}
            onChangeText={setSistersContactPhone}
            keyboardType="phone-pad"
            placeholder="Contact phone"
          />
        </View>
      )}

      {notice}

      <Button title={submitLabel} onPress={submit} loading={submitting} />
    </>
  );
}
