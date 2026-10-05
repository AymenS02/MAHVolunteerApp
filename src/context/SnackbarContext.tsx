import Snackbar from "@/components/Snackbar";
import { apiErrorMessage, isRetryable } from "@/utils/apiError";
import { useFocusEffect } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DURATION_MS = 6000;
// Screen reader users need time to hear the message and reach the button.
const SCREEN_READER_DURATION_MS = 12000;
const GAP = 12;

type SnackbarOptions = {
  message: string;
  actionLabel?: string;
  // May return a short confirmation to show once the action succeeds.
  onAction?: () => Promise<string | void>;
};

type Current = SnackbarOptions & { id: number; busy?: boolean };

type SnackbarContextValue = {
  show: (options: SnackbarOptions) => void;
  hide: () => void;
  registerOffset: (offset: number) => number;
  unregisterOffset: (key: number) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | undefined>(
  undefined,
);

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const nextId = useRef(0);
  const [current, setCurrent] = useState<Current | null>(null);
  const [offsets, setOffsets] = useState<{ key: number; value: number }[]>([]);
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setScreenReader);
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader,
    );
    return () => subscription.remove();
  }, []);

  const show = useCallback((options: SnackbarOptions) => {
    setCurrent({ ...options, id: ++nextId.current });
  }, []);

  const hide = useCallback(() => setCurrent(null), []);

  const registerOffset = useCallback((value: number) => {
    const key = ++nextId.current;
    setOffsets((prev) => [...prev, { key, value }]);
    return key;
  }, []);

  const unregisterOffset = useCallback((key: number) => {
    setOffsets((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const currentId = current?.id;
  const currentBusy = current?.busy;
  const currentMessage = current?.message;

  useEffect(() => {
    if (currentMessage) {
      AccessibilityInfo.announceForAccessibility(currentMessage);
    }
  }, [currentId, currentMessage]);

  // Auto-dismiss, paused while the action is running.
  useEffect(() => {
    if (currentId === undefined || currentBusy) return;

    const timer = setTimeout(
      () => setCurrent((c) => (c?.id === currentId ? null : c)),
      screenReader ? SCREEN_READER_DURATION_MS : DURATION_MS,
    );
    return () => clearTimeout(timer);
  }, [currentId, currentBusy, screenReader]);

  const runAction = useCallback(async () => {
    if (!current?.onAction || current.busy) return;

    const { id, onAction } = current;
    setCurrent((c) => (c?.id === id ? { ...c, busy: true } : c));

    try {
      const confirmation = await onAction();
      setCurrent((c) =>
        c?.id === id
          ? confirmation
            ? { id: ++nextId.current, message: confirmation }
            : null
          : c,
      );
    } catch (error) {
      setCurrent((c) =>
        c?.id === id
          ? {
              id: ++nextId.current,
              message: apiErrorMessage(error, "Couldn't undo. Try again."),
              ...(isRetryable(error) ? { actionLabel: "Retry", onAction } : {}),
            }
          : c,
      );
    }
  }, [current]);

  const value = useMemo(
    () => ({ show, hide, registerOffset, unregisterOffset }),
    [show, hide, registerOffset, unregisterOffset],
  );

  // The focused screen's offset (tab bar, bottom action bar) wins.
  const bottom = Math.max(offsets.at(-1)?.value ?? 0, insets.bottom) + GAP;

  return (
    <SnackbarContext.Provider value={value}>
      <View className="flex-1">
        {children}
        {current ? (
          <Snackbar
            key={current.id}
            message={current.message}
            actionLabel={current.actionLabel}
            onAction={runAction}
            busy={current.busy}
            bottom={bottom}
          />
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);

  if (!context) {
    throw new Error("useSnackbar must be used within SnackbarProvider");
  }

  return context;
};

// Keeps the snackbar above whatever covers the bottom of the focused screen,
// e.g. the tab bar or a sticky action bar. Pass the covered height in points.
export function useSnackbarOffset(offset: number) {
  const { registerOffset, unregisterOffset } = useSnackbar();

  useFocusEffect(
    useCallback(() => {
      const key = registerOffset(offset);
      return () => unregisterOffset(key);
    }, [offset, registerOffset, unregisterOffset]),
  );
}
