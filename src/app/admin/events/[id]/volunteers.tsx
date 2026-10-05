import BackBar from "@/components/BackBar";
import PillButton from "@/components/PillButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/ScreenState";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { useSnackbar } from "@/context/SnackbarContext";
import { useScreenData } from "@/hooks/use-screen-data";
import { EventVolunteer, RemovedVolunteer, WaitlistEntry } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { formatDateOfBirth, getAge } from "@/utils/dateOfBirth";
import { formatShortDate } from "@/utils/hours";
import { notifyEventsChanged } from "@/utils/eventsChanged";
import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

type RestoreResult = { overCapacity?: boolean };

type Roster = {
  // The event was deleted (or never existed).
  missing: boolean;
  volunteers: EventVolunteer[];
  removed: RemovedVolunteer[];
  waitlist: WaitlistEntry[];
};

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
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const age = volunteer.dateOfBirth ? getAge(volunteer.dateOfBirth) : null;
  const minor = age !== null && age < 18;

  return (
    <View className="border-b border-gray-100 py-4">
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={() => setExpanded((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityHint="Shows date of birth and a link to their hours"
          className="flex-1"
        >
          <View className="flex-row items-center gap-2">
            <Text
              numberOfLines={1}
              className="shrink text-base font-semibold text-gray-900"
            >
              {name}
            </Text>
            {minor && (
              <View className="rounded-full bg-gray-900 px-2 py-0.5">
                <Text className="text-xs font-semibold text-white">
                  Under 18
                </Text>
              </View>
            )}
          </View>
          <View className="mt-0.5 flex-row items-center gap-2">
            <Text className="text-sm text-gray-500">
              {volunteer.gender === "brother" ? "Brother" : "Sister"} ·{" "}
              {age !== null ? `${age}` : "Age not set"}
            </Text>
            <Pressable
              onPress={() => Linking.openURL(`tel:${volunteer.phone}`)}
              accessibilityRole="link"
              accessibilityLabel={`Call ${name}, ${volunteer.phone}`}
              hitSlop={12}
            >
              <Text className="text-sm font-medium text-green-700">
                {volunteer.phone}
              </Text>
            </Pressable>
          </View>
        </Pressable>

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

      {expanded && (
        <View className="mt-3 gap-3 rounded-xl bg-gray-50 px-4 py-3">
          <View className="flex-row gap-4">
            <Text className="min-w-[96px] text-sm text-gray-500">Date of birth</Text>
            <Text className="flex-1 text-sm text-gray-900">
              {volunteer.dateOfBirth
                ? `${formatDateOfBirth(volunteer.dateOfBirth)} (${age})`
                : "Not provided yet"}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/admin/users/[id]",
                params: { id: volunteer.userId },
              })
            }
            accessibilityRole="link"
            accessibilityLabel={`View hours for ${name}`}
            hitSlop={12}
            className="flex-row items-center justify-between"
          >
            <Text className="text-sm font-semibold text-green-700">
              View hours
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#15803d" />
          </Pressable>
        </View>
      )}
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // The server builds the CSV (escaping, under-18 flag); the app saves it to
  // the cache and opens the share sheet.
  const exportCsv = async () => {
    try {
      setExporting(true);
      const { data, headers } = await api.get<string>(
        `/events/${id}/volunteers.csv`,
        { responseType: "text" },
      );
      const fileName =
        /filename="([^"]+)"/.exec(String(headers["content-disposition"]))?.[1] ??
        "volunteers.csv";
      const file = new File(Paths.cache, fileName);
      file.create({ overwrite: true });
      file.write(data);

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Can't share", "Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: "text/csv",
        UTI: "public.comma-separated-values-text",
        dialogTitle: "Export volunteers",
      });
    } catch (error) {
      Alert.alert("Couldn't export", apiErrorMessage(error, "Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const fetchVolunteers = useCallback(async (): Promise<Roster> => {
    try {
      const [current, gone, queue] = await Promise.all([
        api.get<EventVolunteer[]>(`/events/${id}/volunteers`),
        api.get<RemovedVolunteer[]>(`/events/${id}/volunteers/removed`),
        api.get<WaitlistEntry[]>(`/events/${id}/waitlist`),
      ]);
      return {
        missing: false,
        volunteers: current.data,
        removed: gone.data,
        waitlist: queue.data,
      };
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return { missing: true, volunteers: [], removed: [], waitlist: [] };
      }
      throw error;
    }
  }, [id]);

  const { data, loading, error, refreshing, reload, refresh, retry } =
    useScreenData(fetchVolunteers);

  // Runs a row action with that row's spinner showing.
  const withBusy = async (
    userId: string,
    failureTitle: string,
    action: () => Promise<void>,
  ) => {
    try {
      setBusyId(userId);
      await action();
    } catch (error) {
      Alert.alert(failureTitle, apiErrorMessage(error, "Please try again."));
    } finally {
      setBusyId(null);
    }
  };

  const restoredMessage = (name: string, result: RestoreResult) =>
    result.overCapacity
      ? `${name} is back. This event is now over its spot limit.`
      : `${name} restored`;

  const approve = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Couldn't approve", async () => {
      await api.patch(`/events/${id}/volunteers/${volunteer.userId}/approve`);
      await reload();
    });

  const unapprove = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Couldn't undo approval", async () => {
      await api.patch(`/events/${id}/volunteers/${volunteer.userId}/unapprove`);
      await reload();
      show({
        message: `${fullName(volunteer)} unapproved`,
        actionLabel: "Undo",
        onAction: async () => {
          await api.patch(
            `/events/${id}/volunteers/${volunteer.userId}/approve`,
          );
          await reload();
        },
      });
    });

  const remove = (volunteer: EventVolunteer) =>
    withBusy(volunteer.userId, "Couldn't remove volunteer", async () => {
      await api.delete(`/events/${id}/volunteers/${volunteer.userId}`);
      await reload();
      show({
        message: `${fullName(volunteer)} removed`,
        actionLabel: "Undo",
        onAction: async () => {
          const { data } = await api.post<RestoreResult>(
            `/events/${id}/volunteers/${volunteer.userId}/restore`,
          );
          await reload();
          if (data.overCapacity) return restoredMessage(fullName(volunteer), data);
        },
      });
    });

  const restore = (volunteer: RemovedVolunteer) =>
    withBusy(volunteer.userId, "Couldn't restore volunteer", async () => {
      const { data } = await api.post<RestoreResult>(
        `/events/${id}/volunteers/${volunteer.userId}/restore`,
      );
      await reload();
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
      Alert.alert("Couldn't delete event", apiErrorMessage(error, "Please try again."));
      setDeleting(false);
    }
  };

  if (loading || !data || data.missing) {
    return (
      <View className="flex-1 bg-white">
        <BackBar fallback="/(tabs)/admin" />
        {data?.missing ? (
          <EmptyState
            title="Event not available"
            hint="This event was deleted. You can restore it from the admin tab."
          />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <LoadingState />
        )}
      </View>
    );
  }

  const { volunteers, removed, waitlist } = data;

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#15803d"
            colors={["#15803d"]}
          />
        }
      >
        <View className="gap-3">
          <View className="gap-1">
            <Text
              accessibilityRole="header"
              className="text-3xl font-semibold text-gray-900"
            >
              Volunteers
            </Text>
            {volunteers.length > 0 && (
              <Text className="text-sm text-gray-500">
                {approved.length} of {volunteers.length} approved
              </Text>
            )}
          </View>
          <View className="flex-row flex-wrap gap-2">
            <PillButton
              title="Edit event"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/admin/events/[id]/edit",
                  params: { id },
                })
              }
            />
            <PillButton
              title="Message"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: "/admin/events/[id]/message",
                  params: { id },
                })
              }
            />
            {volunteers.length > 0 && (
              <PillButton
                title="Export CSV"
                variant="outline"
                onPress={exportCsv}
                loading={exporting}
              />
            )}
          </View>
        </View>

        {volunteers.length === 0 ? (
          <EmptyState
            title="No volunteers yet"
            hint="People who register for this event will show up here."
          />
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

        {waitlist.length > 0 && (
          <View>
            <SectionHeader title="Waitlist" />
            <Text className="mt-1 text-sm text-gray-500">
              Promoted automatically, in this order, when a spot opens.
            </Text>
            <View className="mt-1">
              {waitlist.map((entry) => {
                const age = entry.dateOfBirth ? getAge(entry.dateOfBirth) : null;
                return (
                  <View
                    key={entry.userId}
                    className="flex-row items-center gap-3 border-b border-gray-100 py-4"
                  >
                    <Text className="min-w-[32px] text-base font-semibold text-gray-500">
                      #{entry.position}
                    </Text>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Text
                          numberOfLines={1}
                          className="shrink text-base font-semibold text-gray-900"
                        >
                          {fullName(entry)}
                        </Text>
                        {age !== null && age < 18 && (
                          <View className="rounded-full bg-gray-900 px-2 py-0.5">
                            <Text className="text-xs font-semibold text-white">
                              Under 18
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text className="mt-0.5 text-sm text-gray-500">
                        {entry.gender === "brother" ? "Brother" : "Sister"} ·{" "}
                        {age !== null ? age : "Age not set"} · joined{" "}
                        {formatShortDate(entry.joinedAt)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
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
              <ActivityIndicator color="#dc2626" accessibilityLabel="Deleting event" />
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
