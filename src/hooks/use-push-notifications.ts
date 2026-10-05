import { User } from "@/types";
import { registerDevice } from "@/utils/push";
import * as Notifications from "expo-notifications";
import { type Href, router } from "expo-router";
import { useEffect, useRef } from "react";

// For the root layout. `ready` is false while the user still has to finish
// their profile, so links don't fight the profile gate.
export function usePushNotifications(user: User | null, ready: boolean) {
  const userId = user?._id;
  const enabled = user?.notificationsEnabled !== false;

  // Register this device (without asking for permission) whenever someone
  // is signed in with notifications on.
  useEffect(() => {
    if (userId && ready && enabled) {
      registerDevice({ prompt: false });
    }
  }, [userId, ready, enabled]);

  // Open the screen a notification links to, including one that launched
  // the app. Each notification is handled once.
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!response || !userId || !ready) return;

    const id = response.notification.request.identifier;
    const url = response.notification.request.content.data?.url;
    if (handled.current === id || typeof url !== "string") return;

    handled.current = id;
    router.push(url as Href);
  }, [response, userId, ready]);
}
