import BackBar from "@/components/BackBar";
import EventForm, { EventPayload } from "@/components/EventForm";
import api from "@/constants/api";
import { apiErrorMessage } from "@/utils/apiError";
import { notifyEventsChanged } from "@/utils/eventsChanged";
import { router } from "expo-router";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
} from "react-native";

export default function CreateEventScreen() {
  const create = async (payload: EventPayload) => {
    try {
      await api.post("/events", payload);
      notifyEventsChanged();
      router.back();
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, "Failed to create event"));
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
        <EventForm submitLabel="Create event" onSubmit={create} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
