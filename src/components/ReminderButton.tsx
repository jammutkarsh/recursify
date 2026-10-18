import { useState, useRef, useEffect, useCallback } from "react";
import { Bell, BellRing, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const parseTime24 = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})(?:[.:](\d{2}))?$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const min = match[2] ? parseInt(match[2], 10) : 0;
  if (hour < 0 || hour > 23) return null;
  if (min < 0 || min > 59) return null;
  return { hour, min };
};

const ReminderButton = ({ settings, onSettingsChange, onEnableChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [streakStr, setStreakStr] = useState(settings.streakReminderTime);
  const [reviewStr, setReviewStr] = useState(
    settings.spacedRepetitionReminderTime,
  );

  const dropdownRef = useRef(null);

  const commitReminderSettings = useCallback(
    ({ nextStreak, nextReview }) => {
      const parsedStreak = parseTime24(nextStreak);
      const parsedReview = parseTime24(nextReview);

      if (!parsedStreak || !parsedReview) {
        if (!parsedStreak) {
          setStreakStr(settings.streakReminderTime);
        }
        if (!parsedReview) {
          setReviewStr(settings.spacedRepetitionReminderTime);
        }
        return false;
      }

      const streakReminderTime = `${parsedStreak.hour
        .toString()
        .padStart(2, "0")}:${parsedStreak.min.toString().padStart(2, "0")}`;
      const spacedRepetitionReminderTime = `${parsedReview.hour
        .toString()
        .padStart(2, "0")}:${parsedReview.min.toString().padStart(2, "0")}`;

      setStreakStr(streakReminderTime);
      setReviewStr(spacedRepetitionReminderTime);
      onSettingsChange({
        ...settings,
        streakReminderHour: parsedStreak.hour,
        spacedRepetitionReminderHour: parsedReview.hour,
        streakReminderTime,
        spacedRepetitionReminderTime,
      });
      return true;
    },
    [onSettingsChange, settings],
  );

  const closePopup = useCallback(() => {
    commitReminderSettings({ nextStreak: streakStr, nextReview: reviewStr });
    setIsOpen(false);
  }, [commitReminderSettings, reviewStr, streakStr]);

  useEffect(() => {
    setStreakStr(settings.streakReminderTime);
  }, [settings.streakReminderTime]);

  useEffect(() => {
    setReviewStr(settings.spacedRepetitionReminderTime);
  }, [settings.spacedRepetitionReminderTime]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        closePopup();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closePopup]);

  const handleStreakBlur = () => {
    commitReminderSettings({
      nextStreak: streakStr,
      nextReview: settings.spacedRepetitionReminderTime,
    });
  };

  const handleReviewBlur = () => {
    commitReminderSettings({
      nextStreak: settings.streakReminderTime,
      nextReview: reviewStr,
    });
  };

  const handleInputKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    commitReminderSettings({ nextStreak: streakStr, nextReview: reviewStr });
  };

  const handleSaveClick = () => {
    const didSave = commitReminderSettings({
      nextStreak: streakStr,
      nextReview: reviewStr,
    });

    if (didSave) {
      setIsOpen(false);
    }
  };

  const hasUnsavedChanges =
    streakStr !== settings.streakReminderTime ||
    reviewStr !== settings.spacedRepetitionReminderTime;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        size="icon"
        aria-label="Toggle reminders"
        aria-expanded={isOpen}
      >
        {settings.enabled ? (
          <BellRing className="text-primary" />
        ) : (
          <Bell />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-90 w-72 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl ring-1 ring-foreground/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Reminders</h3>
            <Button
              onClick={closePopup}
              variant="ghost"
              size="icon-sm"
              aria-label="Close reminders"
            >
              <X />
            </Button>
          </div>

          <div className="flex flex-col gap-3">
            {notifError ? (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {notifError}
              </p>
            ) : null}
            <div className="flex items-center justify-between">
              <Label htmlFor="reminder-enabled">Enable</Label>
              <Switch
                id="reminder-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => {
                  if (checked && typeof Notification !== "undefined") {
                    if (Notification.permission === "default") {
                      Notification.requestPermission().then((permission) => {
                        if (permission === "granted") {
                          onSettingsChange({ ...settings, enabled: true });
                        } else {
                          if (onEnableChange) onEnableChange(false);
                          else
                            onSettingsChange({ ...settings, enabled: false });
                        }
                      });
                      return;
                    } else if (Notification.permission === "denied") {
                      setNotifError(
                        "Notifications blocked. Enable them in browser settings.",
                      );
                      if (onEnableChange) onEnableChange(false);
                      else onSettingsChange({ ...settings, enabled: false });
                      return;
                    }
                  }
                  onSettingsChange({ ...settings, enabled: checked });
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Label
                  htmlFor="streak-reminder"
                  className="text-xs text-muted-foreground"
                >
                  Streak Reminder (HH:MM)
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="About streak reminders"
                      />
                    }
                  >
                    <CircleHelp />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Sends a reminder when you have not solved or reviewed any
                    problem yet today.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="streak-reminder"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={streakStr}
                onChange={(e) => setStreakStr(e.target.value)}
                onBlur={handleStreakBlur}
                onKeyDown={handleInputKeyDown}
                placeholder="20:00"
                className="text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <Label
                  htmlFor="review-reminder"
                  className="text-xs text-muted-foreground"
                >
                  Review Reminder (HH:MM)
                </Label>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="About review reminders"
                      />
                    }
                  >
                    <CircleHelp />
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Sends a reminder when you have due spaced-repetition reviews
                    waiting for today.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="review-reminder"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={reviewStr}
                onChange={(e) => setReviewStr(e.target.value)}
                onBlur={handleReviewBlur}
                onKeyDown={handleInputKeyDown}
                placeholder="09:00"
                className="text-sm"
              />
            </div>

            <Button
              onClick={handleSaveClick}
              size="sm"
              className="mt-1 w-full shadow-sm"
              disabled={!hasUnsavedChanges}
            >
              Save Reminders
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReminderButton;
