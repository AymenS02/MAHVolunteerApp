import BackBar from "@/components/BackBar";
import EventForm, { EventFormInitial, EventPayload } from "@/components/EventForm";
import api from "@/constants/api";
import { useSnackbar } from "@/context/SnackbarContext";
import { apiErrorMessage } from "@/utils/apiError";
import { notifyEventsChanged } from "@/utils/eventsChanged";
import { formatHours } from "@/utils/hours";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

type EditData = EventFormInitial & {
  hours: number;
  brothersRegistered: number;
  sistersRegistered: number;
  approvedCount: number;
};

type UpdateResult = { warnings: string[]; hoursUpdatedFor: number };

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show } = useSnackbar();
  const [data, setData] = useState<EditData | null>(null);

  useEffect(() => {
    api
      .get<EditData>(`/events/${id}/edit`)
      .then(({ data: event }) => setData(event))
      .catch((error) => {
        Alert.alert("Error", apiErrorMessage(error, "Failed to load event"));
        router.back();
      });
  }, [id, router]);

  const save = async (payload: EventPayload) => {
    try {
      const { data: result } = await api.patch<UpdateResult>(
        `/events/${id}`,
        payload,
      );
      notifyEventsChanged();

      const notes = [...result.warnings];
      if (result.hoursUpdatedFor > 0) {
        notes.push(
          `Hours updated for ${result.hoursUpdatedFor} approved ${
            result.hoursUpdatedFor === 1 ? "volunteer" : "volunteers"
          }.`,
        );
      }
      show({ message: notes.length ? notes.join(" ") : "Event updated" });
      router.back();
    } catch (error) {
      Alert.alert("Couldn't save", apiErrorMessage(error, "Please try again."));
    }
  };

  if (!data) {
    return (
      <View className="flex-1 bg-white">
        <BackBar />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#15803d" />
        </View>
      </View>
    );
  }

  const registered = data.brothersRegistered + data.sistersRegistered;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <BackBar />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-5 pb-12 pt-2"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text className="text-3xl font-semibold text-gray-900">
            Edit event
          </Text>
          {registered > 0 && (
            <Text className="text-sm text-gray-500">
              {data.brothersRegistered} brothers and {data.sistersRegistered}{" "}
              sisters are signed up. Saving never removes anyone.
            </Text>
          )}
        </View>

        <EventForm
          initial={data}
          submitLabel="Save changes"
          onSubmit={save}
          notice={
            data.approvedCount > 0 ? (
              <View className="rounded-xl bg-gray-50 px-4 py-3">
                <Text className="text-sm text-gray-700">
                  {data.approvedCount} approved{" "}
                  {data.approvedCount === 1 ? "volunteer has" : "volunteers have"}{" "}
                  {formatHours(data.hours)}. If you change the hours, theirs
                  change to match. The date can&apos;t move into the future.
                </Text>
              </View>
            ) : registered > 0 ? (
              <View className="rounded-xl bg-gray-50 px-4 py-3">
                <Text className="text-sm text-gray-700">
                  If you change the date, people already signed up see the
                  change and can still cancel, even close to the event.
                </Text>
              </View>
            ) : null
          }
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
