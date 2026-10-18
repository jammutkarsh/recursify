"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  createInitialState,
  loadTrackerState,
  saveTrackerState,
  sanitizeTrackerState,
} from "../lib/tracker";

type TrackerState = ReturnType<typeof createInitialState>;

interface TrackerContextValue {
  trackerState: TrackerState;
  updateTrackerState: (
    nextStateOrUpdater:
      | TrackerState
      | null
      | ((prev: TrackerState) => TrackerState),
  ) => void;
  notificationSettings: TrackerState["notificationSettings"];
  handleNotificationSettingsChange: (
    settings: TrackerState["notificationSettings"],
  ) => void;
  handleEnableChange: (enabled: boolean) => void;
  mounted: boolean;
}

const TrackerContext = createContext<TrackerContextValue | undefined>(
  undefined,
);

export function TrackerProvider({ children }: { children: React.ReactNode }) {
  const [trackerState, setTrackerState] = useState(createInitialState);
  const [mounted, setMounted] = useState(false);

  const updateTrackerState = useCallback((nextStateOrUpdater) => {
    if (nextStateOrUpdater === null) {
      setTrackerState(createInitialState());
      return;
    }
    setTrackerState((prev) =>
      sanitizeTrackerState(
        typeof nextStateOrUpdater === "function"
          ? nextStateOrUpdater(prev)
          : nextStateOrUpdater,
      ),
    );
  }, []);

  // Local storage paints instantly; KV is the source of truth across devices.
  // Sync stays off until the server answers so stale local data can't overwrite it.
  const router = useRouter();
  const syncRef = useRef(false);
  const pendingRef = useRef<TrackerState | null>(null);

  const flush = useCallback((keepalive = false) => {
    const state = pendingRef.current;
    if (!state) return;
    pendingRef.current = null;
    fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
      keepalive,
    }).catch((error) => console.error("Sync failed:", error));
  }, []);

  useEffect(() => {
    setTrackerState(loadTrackerState());
    fetch("/api/state")
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { state } = (await res.json()) as { state: unknown };
        if (state) setTrackerState(sanitizeTrackerState(state));
        syncRef.current = true;
      })
      .catch((error) => console.error("Could not load synced state:", error))
      .finally(() => setMounted(true));
  }, [router]);

  useEffect(() => {
    if (!mounted) return;
    saveTrackerState(trackerState);
    if (!syncRef.current) return;
    pendingRef.current = trackerState;
    const timeoutId = window.setTimeout(() => flush(), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [trackerState, mounted, flush]);

  useEffect(() => {
    const flushOnHide = () => flush(true);
    window.addEventListener("pagehide", flushOnHide);
    return () => window.removeEventListener("pagehide", flushOnHide);
  }, [flush]);

  const handleNotificationSettingsChange = useCallback(
    (newSettings: TrackerState["notificationSettings"]) => {
      setTrackerState((prev) => ({
        ...prev,
        notificationSettings: newSettings,
      }));
    },
    [],
  );

  const handleEnableChange = useCallback((enabled: boolean) => {
    setTrackerState((prev) => ({
      ...prev,
      notificationSettings: { ...prev.notificationSettings, enabled },
    }));
  }, []);

  const notificationSettings = trackerState.notificationSettings;

  return (
    <TrackerContext.Provider
      value={{
        trackerState,
        updateTrackerState,
        notificationSettings,
        handleNotificationSettingsChange,
        handleEnableChange,
        mounted,
      }}
    >
      {children}
    </TrackerContext.Provider>
  );
}

export function useTracker() {
  const context = useContext(TrackerContext);
  if (context === undefined) {
    throw new Error("useTracker must be used within a TrackerProvider");
  }
  return context;
}
