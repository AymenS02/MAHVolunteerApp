import BackBar from "@/components/BackBar";
import SectionHeader from "@/components/SectionHeader";
import api from "@/constants/api";
import { EventVolunteer } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
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

function VolunteerRow({
  volunteer,
  approving,
  onApprove,
}: {
  volunteer: EventVolunteer;
  approving: boolean;
  onApprove?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4 border-b border-gray-100 py-4">
      <View className="flex-1">
        <Text
          numberOfLines={1}
          className="text-base font-semibold text-gray-900"
        >
          {volunteer.firstName} {volunteer.lastName}
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

      {onApprove ? (
        <Pressable
          onPress={onApprove}
          disabled={approving}
          accessibilityRole="button"
          accessibilityLabel={`Approve ${volunteer.firstName} ${volunteer.lastName}`}
          className="min-w-[88px] items-center rounded-full bg-green-700 px-4 py-2.5 active:bg-green-800"
        >
          {approving ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text className="text-sm font-semibold text-white">Approve</Text>
          )}
        </Pressable>
      ) : (
        <View className="flex-row items-center gap-1">
          <Ionicons name="checkmark-circle" size={18} color="#15803d" />
          <Text className="text-sm font-medium text-green-800">Approved</Text>
        </View>
      )}
    </View>
  );
}

export default function EventVolunteersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const loadVolunteers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<EventVolunteer[]>(
        `/events/${id}/volunteers`,
      );
      setVolunteers(data);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to load volunteers",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadVolunteers();
    }, [loadVolunteers]),
  );

  const approve = async (userId: string) => {
    try {
      setApprovingId(userId);
      await api.patch(`/events/${id}/volunteers/${userId}/approve`);
      setVolunteers((prev) =>
        prev.map((volunteer) =>
          volunteer.userId === userId
            ? { ...volunteer, status: "approved" }
            : volunteer,
        ),
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to approve volunteer",
      );
    } finally {
      setApprovingId(null);
    }
  };

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
                      approving={approvingId === volunteer.userId}
                      onApprove={() => approve(volunteer.userId)}
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
                      approving={false}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}
