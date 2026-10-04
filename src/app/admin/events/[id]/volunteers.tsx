import api from "@/constants/api";
import { EventVolunteer } from "@/types";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";

export default function EventVolunteersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [volunteers, setVolunteers] = useState<EventVolunteer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadVolunteers = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get<EventVolunteer[]>(`/events/${id}/volunteers`);
      setVolunteers(data);
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to load volunteers");
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
      await api.patch(`/events/${id}/volunteers/${userId}/approve`);
      setVolunteers((prev) =>
        prev.map((volunteer) =>
          volunteer.userId === userId ? { ...volunteer, status: "approved" } : volunteer,
        ),
      );
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Failed to approve volunteer");
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator color="#15803d" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="gap-3 p-5">
      <Text className="text-2xl font-bold text-gray-900">Volunteers</Text>
      {volunteers.map((volunteer) => (
        <View key={volunteer.userId} className="rounded-lg border border-gray-200 bg-white p-4">
          <Text className="font-semibold text-gray-900">
            {volunteer.firstName} {volunteer.lastName}
          </Text>
          <Text className="text-gray-500">{volunteer.phone}</Text>
          <Text className="text-gray-500">
            {volunteer.gender === "brother" ? "Brother" : "Sister"}
          </Text>
          <Text className="mt-1 text-green-700">
            {volunteer.status === "approved" ? "Approved" : "Registered"}
          </Text>
          {volunteer.status === "registered" && (
            <Pressable
              onPress={() => approve(volunteer.userId)}
              className="mt-3 rounded-lg bg-green-700 p-3"
            >
              <Text className="text-center font-semibold text-white">Approve</Text>
            </Pressable>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
