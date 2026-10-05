import BackBar from "@/components/BackBar";
import Button from "@/components/Button";
import SectionHeader from "@/components/SectionHeader";
import TextField from "@/components/TextField";
import api from "@/constants/api";
import { useSnackbar } from "@/context/SnackbarContext";
import { EventMessage } from "@/types";
import { apiErrorMessage } from "@/utils/apiError";
import { formatShortDate } from "@/utils/hours";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";

export default function MessageVolunteersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { show } = useSnackbar();
  const [body, setBody] = useState("");
  const [includeWaitlist, setIncludeWaitlist] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<EventMessage[]>([]);

  const loadSent = useCallback(() => {
    api
      .get<EventMessage[]>(`/events/${id}/messages`)
      .then(({ data }) => setSent(data))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    loadSent();
  }, [loadSent]);

  const send = async () => {
    try {
      setSending(true);
      const { data } = await api.post<EventMessage>(`/events/${id}/messages`, {
        body: body.trim(),
        includeWaitlist,
      });
      setBody("");
      loadSent();
      show({
        message: `Sent to ${data.recipientCount} ${
          data.recipientCount === 1 ? "volunteer" : "volunteers"
        }`,
      });
    } catch (err) {
      Alert.alert("Couldn't send", apiErrorMessage(err, "Please try again."));
    } finally {
      setSending(false);
    }
  };

  // A sent message can't be taken back, so confirm first.
  const confirmSend = () => {
    if (!body.trim()) {
      setError("Write a message");
      return;
    }

    Alert.alert(
      "Send this message?",
      `It goes to everyone signed up${
        includeWaitlist ? " and on the waitlist" : ""
      } and can't be unsent.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send", onPress: send },
      ],
    );
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
        <View className="gap-1">
          <Text accessibilityRole="header" className="text-3xl font-semibold text-gray-900">
            Message volunteers
          </Text>
          <Text className="text-sm text-gray-500">
            Sent as a notification and shown on the event page. Up to 5 per
            event per day.
          </Text>
        </View>

        <View className="gap-5">
          <TextField
            label="Message"
            value={body}
            onChangeText={(text) => {
              setBody(text);
              setError(undefined);
            }}
            error={error}
            placeholder="e.g. Please park behind the building."
            multiline
            maxLength={1000}
          />

          <View className="flex-row items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3.5">
            <View className="flex-1">
              <Text className="text-base font-medium text-gray-900">
                Include the waitlist
              </Text>
              <Text className="mt-0.5 text-xs text-gray-500">
                Also send to people waiting for a spot
              </Text>
            </View>
            <Switch
              value={includeWaitlist}
              onValueChange={setIncludeWaitlist}
              trackColor={{ false: "#6b7280", true: "#15803d" }}
              ios_backgroundColor="#6b7280"
              thumbColor="#ffffff"
              accessibilityLabel="Include the waitlist"
            />
          </View>

          <Button title="Send message" onPress={confirmSend} loading={sending} />
        </View>

        {sent.length > 0 && (
          <View>
            <SectionHeader title="Sent" />
            {sent.map((message) => (
              <View key={message.id} className="border-b border-gray-100 py-4">
                <Text className="text-base text-gray-900">{message.body}</Text>
                <Text className="mt-1 text-sm text-gray-500">
                  {message.sentBy} · {formatShortDate(message.createdAt)} ·{" "}
                  {message.recipientCount}{" "}
                  {message.recipientCount === 1 ? "recipient" : "recipients"}
                  {message.includeWaitlist ? " (incl. waitlist)" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
