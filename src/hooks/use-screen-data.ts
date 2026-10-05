import { useSnackbar } from "@/context/SnackbarContext";
import { apiErrorMessage } from "@/utils/apiError";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";

// Loads a screen's data and keeps it fresh, the same way on every screen:
// - first load: `loading` is true (show a spinner)
// - returning to the screen: refreshes in the background, content stays
// - pull to refresh: `refreshing` drives the pull-down spinner
// - first load fails: `error` holds a message (show ErrorState + `retry`)
// - a refresh fails while content is showing: a snackbar, content stays
//
// `fetcher` must be stable (wrap it in useCallback).
export function useScreenData<T>(fetcher: () => Promise<T>) {
  const { show } = useSnackbar();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasData = useRef(false);
  // Only the latest request may update the screen.
  const latest = useRef(0);

  const load = useCallback(
    async ({ pull = false }: { pull?: boolean } = {}) => {
      const request = ++latest.current;
      if (pull) setRefreshing(true);

      try {
        const result = await fetcher();
        if (request !== latest.current) return;
        hasData.current = true;
        setData(result);
        setError(null);
      } catch (err) {
        if (request !== latest.current) return;
        if (hasData.current) {
          show({ message: "Couldn't refresh. Check your connection." });
        } else {
          setError(apiErrorMessage(err, "Something went wrong. Please try again."));
        }
      } finally {
        if (pull) setRefreshing(false);
      }
    },
    [fetcher, show],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const reload = useCallback(() => load(), [load]);
  const refresh = useCallback(() => load({ pull: true }), [load]);
  const retry = useCallback(() => {
    setError(null);
    load();
  }, [load]);

  return {
    data,
    setData,
    loading: data === null && error === null,
    error,
    refreshing,
    reload,
    refresh,
    retry,
  };
}
