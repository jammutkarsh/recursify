"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Moon, Sun, Flame, Settings, X } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useTracker } from "../context/TrackerContext";
import ExportImportControls from "./ExportImportControls";
import ReminderButton from "./ReminderButton";

import { Button } from "@/components/ui/button";
import {
  getAllProblems,
  getTodayString,
  getDueReviewCount,
  isReminderDue,
} from "../lib/tracker";

const showReminderNotification = async ({
  title,
  body,
  tag,
}: {
  title: string;
  body: string;
  tag: string;
}) => {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  if (registration.active) {
    registration.active.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: {
        title,
        options: { body, tag, icon: "/icon.png", badge: "/icon.png" },
      },
    });
  }
};

const Navbar = () => {
  const { toggleTheme } = useTheme();
  const {
    trackerState,
    notificationSettings,
    handleNotificationSettingsChange,
    handleEnableChange,
  } = useTracker();
  const [openPanel, setOpenPanel] = useState<"settings" | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const sentReminderKeysRef = useRef(new Set<string>());

  const activityLog = useMemo(
    () => trackerState?.activityLog || [],
    [trackerState?.activityLog],
  );
  const allProblems = useMemo(
    () => getAllProblems(trackerState?.customProblems),
    [trackerState?.customProblems],
  );

  const progress = useMemo(
    () => trackerState?.progress ?? {},
    [trackerState?.progress],
  );
  const notificationPermission =
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        target instanceof Element &&
        target.closest(
          '[data-slot="dialog-content"], [data-slot="alert-dialog-content"]',
        )
      ) {
        return;
      }

      if (settingsPanelRef.current?.contains(target)) {
        return;
      }

      setOpenPanel(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed:", error);
    });
  }, []);

  const notificationSettingsRef = useRef(notificationSettings);
  useEffect(() => {
    notificationSettingsRef.current = notificationSettings;
  });

  const persistNotificationSettingsPatch = useCallback(
    (patch) => {
      handleNotificationSettingsChange({
        ...notificationSettingsRef.current,
        ...patch,
      });
    },
    [handleNotificationSettingsChange],
  );

  useEffect(() => {
    if (!notificationSettings.enabled || notificationPermission !== "granted") {
      return;
    }

    const runReminderCheck = async () => {
      const now = new Date();
      const currentDate = getTodayString();
      const dueProblemsCount = getDueReviewCount(
        allProblems,
        progress,
        currentDate,
      );

      const hasActivityToday = activityLog.some(
        (entry) => entry.date === currentDate,
      );

      const streakReminderKey = `streak-${currentDate}`;
      const dueReminderKey = `due-${currentDate}`;

      const streakAlreadySent =
        notificationSettings.lastStreakReminderDate === currentDate ||
        sentReminderKeysRef.current.has(streakReminderKey);
      const dueAlreadySent =
        notificationSettings.lastDueReminderDate === currentDate ||
        sentReminderKeysRef.current.has(dueReminderKey);

      if (
        isReminderDue(now, notificationSettings.streakReminderTime) &&
        !hasActivityToday &&
        !streakAlreadySent
      ) {
        sentReminderKeysRef.current.add(streakReminderKey);
        await showReminderNotification({
          title: "Keep your study streak alive",
          body: "Solve or review one problem today to keep the streak going.",
          tag: "daily-streak-reminder",
        });
        persistNotificationSettingsPatch({
          lastStreakReminderDate: currentDate,
        });
      }

      if (
        isReminderDue(now, notificationSettings.spacedRepetitionReminderTime) &&
        dueProblemsCount > 0 &&
        !dueAlreadySent
      ) {
        sentReminderKeysRef.current.add(dueReminderKey);
        await showReminderNotification({
          title: "Spaced repetition check-in",
          body: `${dueProblemsCount} problem${
            dueProblemsCount === 1 ? "" : "s"
          } need review today.`,
          tag: "spaced-repetition-reminder",
        });
        persistNotificationSettingsPatch({
          lastDueReminderDate: currentDate,
        });
      }
    };

    let timeoutId = null;

    const scheduleNextCheck = () => {
      const now = new Date();
      const delayUntilNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

      timeoutId = window.setTimeout(
        () => {
          runReminderCheck()
            .catch((error) => {
              console.error("Reminder check failed:", error);
            })
            .finally(() => {
              scheduleNextCheck();
            });
        },
        Math.max(1000, delayUntilNextMinute),
      );
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        runReminderCheck().catch((error) => {
          console.error("Reminder check failed:", error);
        });
      }
    };

    runReminderCheck().catch((error) => {
      console.error("Reminder check failed:", error);
    });

    scheduleNextCheck();
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [
    activityLog,
    notificationPermission,
    notificationSettings,
    persistNotificationSettingsPatch,
    allProblems,
    progress,
  ]);

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
        <Link
          href="/tracker"
          className="mr-2 flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Flame className="size-4" />
          </span>
          <span className="hidden sm:inline">LeetCode Tracker</span>
        </Link>

        <div className="ml-auto flex items-center gap-1.5">
          <ReminderButton
            settings={notificationSettings}
            onSettingsChange={handleNotificationSettingsChange}
            onEnableChange={handleEnableChange}
          />

          <div className="relative" ref={settingsPanelRef}>
            <Button
              onClick={() =>
                setOpenPanel((current) =>
                  current === "settings" ? null : "settings",
                )
              }
              variant="ghost"
              size="icon"
              aria-label="Open settings"
              aria-expanded={openPanel === "settings"}
            >
              <Settings />
            </Button>

            {openPanel === "settings" ? (
              <div className="absolute right-0 top-11 z-90 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Your data
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Import, export, or clear your tracked data.
                    </p>
                  </div>
                  <Button
                    onClick={() => setOpenPanel(null)}
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close settings"
                  >
                    <X />
                  </Button>
                </div>

                <ExportImportControls />
              </div>
            ) : null}
          </div>

          <Button
            onClick={toggleTheme}
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
