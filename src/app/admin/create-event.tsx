import api from "@/constants/api";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

const inputClass = "rounded-lg border border-gray-200 p-4 text-gray-900";

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
  const [dateTime, setDateTime] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const brothersNeeded = useMemo(() => Number(brothersMax) > 0, [brothersMax]);
  const sistersNeeded = useMemo(() => Number(sistersMax) > 0, [sistersMax]);

  const submit = async () => {
    if (!name.trim() || !location.trim()) {
      Alert.alert("Missing fields", "Name and location are required.");
      return;
    }

    if (brothersNeeded && (!brothersContactName.trim() || !brothersContactPhone.trim())) {
      Alert.alert("Missing fields", "Brothers contact name and phone are required.");
      return;
    }

    if (sistersNeeded && (!sistersContactName.trim() || !sistersContactPhone.trim())) {
      Alert.alert("Missing fields", "Sisters contact name and phone are required.");
      return;
    }

    try {
      await api.post("/events", {
        name: name.trim(),
        location: location.trim(),
        hours: Number(hours),
        brothersMax: Number(brothersMax),
        sistersMax: Number(sistersMax),
        date: dateTime.toISOString(),
        brothersContact: brothersNeeded
          ? { name: brothersContactName.trim(), phone: brothersContactPhone.trim() }
          : undefined,
        sistersContact: sistersNeeded
          ? { name: sistersContactName.trim(), phone: sistersContactPhone.trim() }
          : undefined,
      });

      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to create event");
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-4 p-5">
      <Text className="text-2xl font-bold text-gray-900">Create Event</Text>

      <TextInput value={name} onChangeText={setName} placeholder="Name" className={inputClass} />
      <TextInput
        value={location}
        onChangeText={setLocation}
        placeholder="Location"
        className={inputClass}
      />
      <TextInput
        value={hours}
        onChangeText={setHours}
        placeholder="Hours"
        keyboardType="numeric"
        className={inputClass}
      />
      <TextInput
        value={brothersMax}
        onChangeText={setBrothersMax}
        placeholder="Brothers needed"
        keyboardType="numeric"
        className={inputClass}
      />
      <TextInput
        value={sistersMax}
        onChangeText={setSistersMax}
        placeholder="Sisters needed"
        keyboardType="numeric"
        className={inputClass}
      />

      <Pressable onPress={() => setShowDatePicker(true)} className="rounded-lg border border-gray-200 p-4">
        <Text className="text-gray-900">Date: {dateTime.toLocaleDateString()}</Text>
      </Pressable>
      <Pressable onPress={() => setShowTimePicker(true)} className="rounded-lg border border-gray-200 p-4">
        <Text className="text-gray-900">Time: {dateTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={dateTime}
          mode="date"
          onChange={(_, selectedDate) => {
            setShowDatePicker(Platform.OS === "ios");
            if (selectedDate) {
              const next = new Date(dateTime);
              next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
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
              next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
              setDateTime(next);
            }
          }}
        />
      )}

      {brothersNeeded && (
        <View className="gap-2 rounded-lg border border-gray-200 p-4">
          <Text className="font-semibold text-gray-900">Brothers contact</Text>
          <TextInput
            value={brothersContactName}
            onChangeText={setBrothersContactName}
            placeholder="Name"
            className={inputClass}
          />
          <TextInput
            value={brothersContactPhone}
            onChangeText={setBrothersContactPhone}
            placeholder="Phone"
            className={inputClass}
          />
        </View>
      )}

      {sistersNeeded && (
        <View className="gap-2 rounded-lg border border-gray-200 p-4">
          <Text className="font-semibold text-gray-900">Sisters contact</Text>
          <TextInput
            value={sistersContactName}
            onChangeText={setSistersContactName}
            placeholder="Name"
            className={inputClass}
          />
          <TextInput
            value={sistersContactPhone}
            onChangeText={setSistersContactPhone}
            placeholder="Phone"
            className={inputClass}
          />
        </View>
      )}

      <Pressable onPress={submit} className="rounded-lg bg-green-700 p-4">
        <Text className="text-center font-semibold text-white">Create Event</Text>
      </Pressable>
    </ScrollView>
  );
}
