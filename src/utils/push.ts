import api from "@/constants/api";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";

// This device's push token, remembered so logout can remove it.
const TOKEN_KEY = "push_token";
// Whether we've already offered notifications (iOS only lets us ask once).
const OFFERED_KEY = "push_offered";

// Show notifications that arrive while the app is open, too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ensureChannel = async () => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Event updates",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
};

export const getPermission = async () =>
  (await Notifications.getPermissionsAsync()).status;

// Gets this device's Expo push token and saves it on the server. Returns
// false when that isn't possible: a simulator, permission not granted, Expo
// Go on Android (needs a development build), or no connection.
export const registerDevice = async ({ prompt }: { prompt: boolean }) => {
  try {
    if (!Device.isDevice) return false;
    await ensureChannel();

    let status = await getPermission();
    if (status !== "granted" && prompt) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    await api.post("/users/me/push-tokens", { token, platform: Platform.OS });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return true;
  } catch (error) {
    console.log("[push] couldn't register this device:", error);
    return false;
  }
};

// On logout: stop sending to this device. Best effort.
export const unregisterDevice = async () => {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token) {
      await api.delete(`/users/me/push-tokens/${encodeURIComponent(token)}`);
    }
  } catch {
    // The server also drops tokens that stop working.
  } finally {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }
};

// After account deletion the server has already removed the token.
export const forgetDevice = () =>
  SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});

// Offered once, right after a first event sign-up, when reminders make sense.
export const offerNotificationsOnce = async () => {
  try {
    if (!Device.isDevice) return;
    if ((await getPermission()) !== "undetermined") return;
    if (await SecureStore.getItemAsync(OFFERED_KEY)) return;
    await SecureStore.setItemAsync(OFFERED_KEY, "1");

    Alert.alert(
      "Get reminders?",
      "We can remind you the day before your events and let you know if anything changes.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Turn on", onPress: () => registerDevice({ prompt: true }) },
      ],
    );
  } catch {
    // Not offering is fine.
  }
};

// Development only: a local notification (works in Expo Go) to check how
// notifications look and that tapping one opens the right screen.
export const sendTestNotification = (url: string) =>
  Notifications.scheduleNotificationAsync({
    content: {
      title: "Test notification",
      body: "Tap to open the linked screen.",
      data: { url },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
