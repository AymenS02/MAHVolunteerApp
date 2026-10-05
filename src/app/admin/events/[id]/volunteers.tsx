import BackBar from "@/components/BackBar";
import PillButton from "@/components/PillButton";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useSnackbar } from "@/context/SnackbarContext";
import { EventVolunteer, RemovedVolunteer } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { notifyEventsChanged } from "@/utils/eventsChanged";
import { isAxiosError } from "axios";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

type RestoreResult = { overCapacity?: boolean };

const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;

function VolunteerRow({
  volunteer,
  busy,
  action,
  onRemove,
}: {
  volunteer: EventVolunteer;
  busy: boolean;
  action: { title: string; variant: "primary" | "outline"; onPress: () => void };
  onRemove: () => void;
}) {
  const name = fullName(volunteer);

  return (
    <View className="flex-row items-center gap-3 border-b border-gray-100 py-4">
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-base font-semibold text-gray-900"
        >
          {name}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-2">
          <Text className="text-sm text-gray-500">
            {volunteer.gender === "brother" ? "Brother" : "Sister"}
          </Text>
          <Pressable
            onPress={() => Linking.openURL(`tel:${volunteer.phone}`)}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text className="text-sm font-medium text-green-700">
              {volunteer.phone}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        onPress={onRemove}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${name}`}
        hitSlop={8}
        className="px-1 py-2"
      >
        <Text className="text-sm font-medium text-gray-500">Remove</Text>
      </Pressable>

      <PillButton
        title={action.title}
        variant={action.variant}
        onPress={action.onPress}
        loading={busy}
        accessibilityLabel={`${action.title} ${name}`}
      />
    </View>
  );
}

function RemovedRow({
  volunteer,
  busy,
  onRestore,
}: {
  volunteer: RemovedVolunteer;
  busy: boolean;
  onRestore: () => void;
}) {
  const name = fullName(volunteer);

  return (
    <View className="flex-row items-center gap-3 border-b border-gray-100 py-4">
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-gray-500">
          {name}
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          {volunteer.gender === "brother" ? "Brother" : "Sister"} · was{" "}
          {volunteer.previousStatus === "approved" ? "approved" : "registered"}
        </Text>
      </View>
      <PillButton
        title="Restore"
        variant="outline"
        onPress={onRestore}
        loading={busy}
        accessibilityLabel={`Restore ${name}`}
      />
    </View>
  );
}

export default function EventVolunteersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show } = useSnackbar();
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [removed, setRemoved] = useState<RemovedVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVolunteers = useCallback(
    async (showSpinner = true) => {
      try {
        if (showSpinner) setLoading(true);
        const [current, gone] = await Promise.all([
          api.get<EventVolunteer[]>(`/events/${id}/volunteers`),
          api.get<RemovedVolunteer[]>(`/events/${id}/volunteers/removed`),
        ]);
        setVolunteers(current.data);
        setRemoved(gone.data);
        setMissing(false);
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) {
          setMissing(true);
        } else {
          Alert.alert("Error", apiErrorMessage(error, "Failed to load volunteers"));
        }
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useFocusEffect(
    useCallback(() => {
      loadVolunteers();
    }, [loadVolunteers]),
  );

  // Runs a row action with that row's spinner showing.
  const withBusy = async (
    userId: string,
    fallback: string,
    action: () => Promise<void>,
  ) => {
    try {
      setBusyId(userId);
      await action();
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, fallback));
    } finally {
      setBusyId(null);
    }
  };

  const restoredMessage = (name: string, result: RestoreResult) =>
    result.overCapacity
      ? `${name} is back. This event is now over its spot limit.`
      : `${name} restored`;

  const approve = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Failed to approve volunteer", async () => {
      await api.patch(`/events/${id}/volunteers/${volunteer.userId}/approve`);
      await loadVolunteers(false);
    });

  const unapprove = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Failed to undo approval", async () => {
      await api.patch(`/events/${id}/volunteers/${volunteer.userId}/unapprove`);
      await loadVolunteers(false);
      show({
        message: `${fullName(volunteer)} unapproved`,
        actionLabel: "Undo",
        onAction: async () => {
          await api.patch(
            `/events/${id}/volunteers/${volunteer.userId}/approve`,
          );
          await loadVolunteers(false);
        },
      });
    });

  const remove = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Failed to remove volunteer", async () => {
      await api.delete(`/events/${id}/volunteers/${volunteer.userId}`);
      await loadVolunteers(false);
      show({
        message: `${fullName(volunteer)} removed`,
        actionLabel: "Undo",
        onAction: async () => {
          const { data } = await api.post<RestoreResult>(
            `/events/${id}/volunteers/${volunteer.userId}/restore`,
          );
          await loadVolunteers(false);
          if (data.overCapacity) return restoredMessage(fullName(volunteer), data);
        },
      });
    });

  const restore = (volunteer: RemovedVolunteer) =>
    withBusy(volunteer.userId, "Failed to restore volunteer", async () => {
      const { data } = await api.post<RestoreResult>(
        `/events/${id}/volunteers/${volunteer.userId}/restore`,
      );
      await loadVolunteers(false);
      show({ message: restoredMessage(fullName(volunteer), data) });
    });

  // No confirm dialog: the event can be restored from Undo or Recently deleted.
  const deleteEvent = async () => {
    try {
      setDeleting(true);
      await api.delete(`/events/${id}`);
      notifyEventsChanged();
      show({
        message: "Event deleted",
        actionLabel: "Undo",
        onAction: async () => {
          await api.post(`/events/${id}/restore`);
          notifyEventsChanged();
          return "Event restored";
        },
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/admin");
      }
    } catch (error) {
      Alert.alert("Error", apiErrorMessage(error, "Failed to delete event"));
      setDeleting(false);
    }
  };

  if (missing) {
    return (
      <View className="flex-1 bg-white">
        <BackBar fallback="/(tabs)/admin" />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-base font-semibold text-gray-900">
            Event not available
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            This event was deleted. You can restore it from the admin tab.
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <BackBar fallback="/(tabs)/admin" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#15803d" />
        </View>
      </View>
    );
  }

  const pending = volunteers.filter(
    (volunteer) => volunteer.status === "registered",
  );
  const approved = volunteers.filter(
    (volunteer) => volunteer.status === "approved",
  );
  const canDelete = approved.length === 0;

  return (
    <View className="flex-1 bg-white">
      <BackBar fallback="/(tabs)/admin" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-5 pb-10 pt-2"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-1">
          <Text className="text-3xl font-semibold text-gray-900">
            Volunteers
          </Text>
          {volunteers.length > 0 && (
            <Text className="text-sm text-gray-500">
              {approved.length} of {volunteers.length} approved
            </Text>
          )}
        </View>

        {volunteers.length === 0 ? (
          <View className="items-center px-8 py-16">
            <Text className="text-base font-semibold text-gray-900">
              No volunteers yet
            </Text>
            <Text className="mt-1 text-center text-sm text-gray-500">
              People who register for this event will show up here.
            </Text>
          </View>
        ) : (
          <>
            {pending.length > 0 && (
              <View>
                <SectionHeader title="Needs approval" />
                <View className="mt-1">
                  {pending.map((volunteer) => (
                    <VolunteerRow
                      key={volunteer.userId}
                      volunteer={volunteer}
                      busy={busyId === volunteer.userId}
                      action={{
                        title: "Approve",
                        variant: "primary",
                        onPress: () => approve(volunteer),
                      }}
                      onRemove={() => remove(volunteer)}
                    />
                  ))}
                </View>
              </View>
            )}

            {approved.length > 0 && (
              <View>
                <SectionHeader title="Approved" />
                <View className="mt-1">
                  {approved.map((volunteer) => (
                    <VolunteerRow
                      key={volunteer.userId}
                      volunteer={volunteer}
                      busy={busyId === volunteer.userId}
                      action={{
                        title: "Unapprove",
                        variant: "outline",
                        onPress: () => unapprove(volunteer),
                      }}
                      onRemove={() => remove(volunteer)}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {removed.length > 0 && (
          <View>
            <SectionHeader title="Removed" />
            <View className="mt-1">
              {removed.map((volunteer) => (
                <RemovedRow
                  key={volunteer.userId}
                  volunteer={volunteer}
                  busy={busyId === volunteer.userId}
                  onRestore={() => restore(volunteer)}
                />
              ))}
            </View>
          </View>
        )}

        <View className="items-center">
          <Pressable
            onPress={deleteEvent}
            disabled={!canDelete || deleting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canDelete, busy: deleting }}
            hitSlop={8}
            className={`items-center py-3 ${canDelete ? "" : "opacity-40"}`}
          >
            {deleting ? (
              <ActivityIndicator color="#dc2626" />
            ) : (
              <Text className="text-sm font-medium text-red-600">
                Delete event
              </Text>
            )}
          </Pressable>
          {!canDelete && (
            <Text className="text-center text-sm text-gray-500">
              Unapprove all volunteers before deleting this event.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
