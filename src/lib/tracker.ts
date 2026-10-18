import blind75 from "../data/blind75.json";
import leetcode75 from "../data/leetcode75.json";
import neetcode150 from "../data/neetcode150.json";
import { storage } from "./storage";

const STORAGE_KEY = "leetcode-tracker-state-v1";
const LEETCODE_API_BASE = "https://leetcode-api-pied.vercel.app";
const CUSTOM_TRACKING_LIST = "Custom Tracking";

export const intervals = [1, 3, 7, 14, 30];

export const builtinLists = {
  "Blind 75": "https://leetcode.com/problem-list/oizxjoit/",
  "LeetCode 75": "https://leetcode.com/studyplan/leetcode-75/",
  "NeetCode 150": "https://neetcode.io/roadmap",
  [CUSTOM_TRACKING_LIST]: "",
};

export const pageSizeOptions = [10, 20, 50];

export const builtinProblemLists = {
  "Blind 75": blind75,
  "LeetCode 75": leetcode75,
  "NeetCode 150": neetcode150,
};

const defaultProgress = () => ({});

const defaultUiPreferences = () => ({
  showOnlyDueToday: false,
  pageSize: 20,
  selectedList: "Blind 75",
});

const defaultNotificationSettings = () => ({
  enabled: false,
  streakReminderHour: 20,
  spacedRepetitionReminderHour: 9,
  streakReminderTime: "20:00",
  spacedRepetitionReminderTime: "09:00",
  lastStreakReminderDate: null,
  lastDueReminderDate: null,
});

const toTwoDigits = (value) => value.toString().padStart(2, "0");

const normalizeReminderTime = (value, fallbackHour) => {
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (
        Number.isInteger(hour) &&
        hour >= 0 &&
        hour <= 23 &&
        Number.isInteger(minute) &&
        minute >= 0 &&
        minute <= 59
      ) {
        return `${toTwoDigits(hour)}:${toTwoDigits(minute)}`;
      }
    }
  }

  const normalizedHour = Number.isInteger(fallbackHour)
    ? fallbackHour
    : Number(fallbackHour);

  if (
    Number.isInteger(normalizedHour) &&
    normalizedHour >= 0 &&
    normalizedHour <= 23
  ) {
    return `${toTwoDigits(normalizedHour)}:00`;
  }

  return "00:00";
};

const slugifyTitle = (title) =>
  String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createCustomProblemId = ({ title, questionId, slug }) => {
  if (title && questionId) {
    return `custom-${slugifyTitle(title)}-${questionId}`;
  }

  if (slug) {
    return `custom-${slug}`;
  }

  return `custom-${crypto.randomUUID()}`;
};

export const createInitialState = () => ({
  progress: defaultProgress(),
  customProblems: [],
  activityLog: [],
  notificationSettings: defaultNotificationSettings(),
  uiPreferences: defaultUiPreferences(),
});

const getProgressStorageKey = (problem) =>
  problem?.slug || problem?.questionId || problem?.url || problem?.id;

const normalizeProblem = (problem) => {
  if (!problem || typeof problem !== "object") {
    return null;
  }

  const slug =
    problem.slug || parseLeetCodeUrl(problem.url || "")?.slug || null;
  const title = problem.title || slug;
  const url =
    problem.url || (slug ? `https://leetcode.com/problems/${slug}/` : "");

  if (!title || !url) {
    return null;
  }

  return {
    id:
      problem.id ||
      createCustomProblemId({
        title,
        questionId: problem.questionId,
        slug,
      }),
    title,
    slug,
    url,
    questionId: problem.questionId || null,
    difficulty: problem.difficulty || "Medium",
    topics: Array.isArray(problem.topics) ? problem.topics.filter(Boolean) : [],
    companies: Array.isArray(problem.companies) ? problem.companies : [],
  };
};

const dedupeProblems = (problems) => {
  const seen = new Set();
  return problems.flatMap((problem) => {
    const normalized = normalizeProblem(problem);
    if (!normalized) {
      return [];
    }
    const key = normalized.slug || normalized.url;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    return [{ ...problem, ...normalized }];
  });
};

const normalizeProgress = (progress) => ({ ...(progress || {}) });

const normalizeNotificationSettings = (settings) => {
  const defaults = defaultNotificationSettings();
  const nextSettings = {
    ...defaults,
    ...(settings || {}),
  };

  nextSettings.streakReminderTime = normalizeReminderTime(
    nextSettings.streakReminderTime,
    nextSettings.streakReminderHour,
  );
  nextSettings.spacedRepetitionReminderTime = normalizeReminderTime(
    nextSettings.spacedRepetitionReminderTime,
    nextSettings.spacedRepetitionReminderHour,
  );
  nextSettings.streakReminderHour = Number(
    nextSettings.streakReminderTime.split(":")[0],
  );
  nextSettings.spacedRepetitionReminderHour = Number(
    nextSettings.spacedRepetitionReminderTime.split(":")[0],
  );

  return nextSettings;
};

const normalizeUiPreferences = (preferences) => {
  const next = {
    ...defaultUiPreferences(),
    ...(preferences || {}),
  };
  if (!pageSizeOptions.includes(next.pageSize)) {
    next.pageSize = 20;
  }
  next.showOnlyDueToday = Boolean(next.showOnlyDueToday);
  if (!Object.keys(builtinLists).includes(next.selectedList)) {
    next.selectedList = "Blind 75";
  }
  return next;
};

const migrateCustomProblems = (input) => {
  if (Array.isArray(input?.customProblems)) {
    return dedupeProblems(
      input.customProblems.map((problem) => ({ ...problem })),
    );
  }

  if (Array.isArray(input?.customSets)) {
    return dedupeProblems(
      input.customSets.flatMap((set) =>
        Array.isArray(set?.problems)
          ? set.problems.map((problem) => ({ ...problem }))
          : [],
      ),
    );
  }

  return [];
};

const getProblemCatalog = (customProblems = [], customSets = []) => ({
  ...builtinProblemLists,
  [CUSTOM_TRACKING_LIST]: dedupeProblems([
    ...customProblems.map((problem) => ({ ...problem })),
    ...customSets.flatMap((set) =>
      Array.isArray(set?.problems)
        ? set.problems.map((problem) => ({ ...problem }))
        : [],
    ),
  ]),
});

const mergeProgressEntries = (existing, incoming) => {
  if (!existing) {
    return incoming;
  }

  const solvedDate =
    existing.solvedDate && incoming?.solvedDate
      ? existing.solvedDate >= incoming.solvedDate
        ? existing.solvedDate
        : incoming.solvedDate
      : existing.solvedDate || incoming?.solvedDate || null;

  const maxReviews = Math.max(
    existing.reviews?.length || intervals.length,
    incoming?.reviews?.length || intervals.length,
  );

  return {
    solved: Boolean(existing.solved || incoming?.solved),
    solvedDate,
    reviews: Array.from({ length: maxReviews }, (_, index) =>
      Boolean(existing.reviews?.[index] || incoming?.reviews?.[index]),
    ),
    dates: {
      ...(existing.dates || {}),
      ...(incoming?.dates || {}),
    },
  };
};

const migrateProgress = (input, customProblems) => {
  const rawProgress = input?.progress || {};
  const catalog = getProblemCatalog(customProblems, input?.customSets || []);
  const listNames = Object.keys(catalog);
  const looksLikePerListProgress = listNames.some(
    (listName) =>
      rawProgress[listName] && typeof rawProgress[listName] === "object",
  );

  if (!looksLikePerListProgress) {
    return normalizeProgress(rawProgress);
  }

  const migrated = {};

  listNames.forEach((listName) => {
    const listProgress = rawProgress[listName] || {};
    const problems = catalog[listName] || [];
    const problemByLegacyId = new Map(
      problems.flatMap((problem) => {
        const keys = [problem.id, problem.slug, problem.url].filter(Boolean);
        return keys.map((key) => [key, problem]);
      }),
    );

    Object.entries(listProgress).forEach(([legacyKey, entry]) => {
      const problem = problemByLegacyId.get(legacyKey);
      const storageKey = getProgressStorageKey(
        problem || { id: legacyKey, url: legacyKey },
      );
      migrated[storageKey] = mergeProgressEntries(migrated[storageKey], entry);
    });
  });

  return migrated;
};

const getActivityIdentity = (entry) => {
  if (!entry) {
    return null;
  }

  if (entry.problemKey && entry.type && entry.date) {
    return [
      entry.problemKey,
      entry.type,
      entry.date,
      entry.reviewIndex ?? "",
    ].join(":");
  }

  return entry.id || [entry.type || "activity", entry.date || ""].join(":");
};

const getBackfilledActivityLog = (progress, existingActivityLog = []) => {
  const normalizedExistingEntries = (existingActivityLog || []).filter(
    (entry) => {
      if (!entry) {
        return false;
      }

      if (entry.problemKey) {
        return true;
      }

      return !["history", "solve", "review"].includes(entry.type);
    },
  );

  const syntheticEntries = Object.entries(progress || {}).flatMap(
    ([problemKey, entry]: [string, any]) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const entries = [];

      if (entry.solvedDate) {
        entries.push({
          id: `history-solve-${problemKey}-${entry.solvedDate}`,
          type: "solve",
          date: entry.solvedDate,
          problemKey,
        });
      }

      Object.entries(entry.dates || {}).forEach(([key, date]) => {
        if (!date || key === "initial") {
          return;
        }

        const match = key.match(/^review(\d+)$/);
        entries.push({
          id: `history-review-${problemKey}-${key}-${date}`,
          type: "review",
          date,
          problemKey,
          reviewIndex: match ? Number(match[1]) - 1 : undefined,
        });
      });

      return entries;
    },
  );

  const mergedEntries = [
    ...normalizedExistingEntries,
    ...syntheticEntries,
  ].sort((left, right) =>
    String(left?.date || "").localeCompare(String(right?.date || "")),
  );

  const seen = new Set();

  return mergedEntries.filter((entry) => {
    const identity = getActivityIdentity(entry);
    if (!identity || seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });
};

export const migrateLegacyProgress = (legacyProgress) => {
  const input = { progress: legacyProgress };
  const customProblems = migrateCustomProblems(input);
  const progress = migrateProgress(input, customProblems);
  const activityLog = getBackfilledActivityLog(progress, []);
  return {
    customProblems,
    progress,
    activityLog,
    notificationSettings: normalizeNotificationSettings(undefined),
    uiPreferences: normalizeUiPreferences(undefined),
  };
};

export const sanitizeTrackerState = (input) => {
  const looksLikeLegacyProgress =
    input &&
    typeof input === "object" &&
    !input.progress &&
    Object.keys(builtinLists).some((key) => Object.hasOwn(input, key));

  if (looksLikeLegacyProgress) {
    return migrateLegacyProgress(input);
  }

  const customProblems = migrateCustomProblems(input);
  const progress = migrateProgress(input, customProblems);
  const activityLog = getBackfilledActivityLog(
    progress,
    Array.isArray(input?.activityLog) ? input.activityLog : [],
  );

  return {
    customProblems,
    progress,
    activityLog,
    notificationSettings: normalizeNotificationSettings(
      input?.notificationSettings,
    ),
    uiPreferences: normalizeUiPreferences(input?.uiPreferences),
  };
};

export const loadTrackerState = () => {
  if (typeof window === "undefined") {
    return createInitialState();
  }
  try {
    const savedState = storage.getItem(STORAGE_KEY);
    if (savedState) {
      return sanitizeTrackerState(JSON.parse(savedState));
    }

    const legacyProgress = storage.getItem("leetcode-progress-v2");
    if (legacyProgress) {
      return migrateLegacyProgress(JSON.parse(legacyProgress));
    }
  } catch (error) {
    console.error("Error loading tracker state:", error);
  }

  return createInitialState();
};

export const saveTrackerState = (state) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Error saving tracker state:", error);
  }
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateString = (value) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value)
    .split("-")
    .map((segment) => Number(segment));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
};

export const getTodayString = () => formatLocalDate(new Date());

export const isReminderDue = (now, reminderTime) => {
  const [hourString = "0", minuteString = "0"] =
    String(reminderTime).split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const reminderMinutes = hour * 60 + minute;
  return currentMinutes >= reminderMinutes;
};

export const calculateNextReviews = (solvedDate) => {
  if (!solvedDate) {
    return [];
  }

  const solvedDateValue = parseDateString(solvedDate);
  if (!solvedDateValue) {
    return [];
  }

  const solvedTime = solvedDateValue.getTime();
  return intervals.map((days) =>
    formatLocalDate(new Date(solvedTime + days * 24 * 60 * 60 * 1000)),
  );
};

export const getProblemIdentifier = (problem) =>
  problem.id || problem.slug || problem.url;

export const getProblemProgressKey = (problem) =>
  getProgressStorageKey(problem) || getProblemIdentifier(problem);

export const getProblemProgress = (listProgress, problemId) =>
  listProgress[problemId] || {
    solved: false,
    reviews: Array(intervals.length).fill(false),
    dates: {},
  };

export const getDueReviewCount = (
  problems,
  progress,
  today = getTodayString(),
) =>
  problems.filter((problem) => {
    const problemId = getProblemProgressKey(problem);
    const status = progress[problemId];
    if (!status?.solved) {
      return false;
    }

    return calculateNextReviews(status.solvedDate).some(
      (date, index) => !status.reviews?.[index] && date <= today,
    );
  }).length;

// First review not yet done, with its urgency relative to today.
export const getNextReview = (status, today = getTodayString()) => {
  if (!status?.solved) {
    return null;
  }

  const dates = calculateNextReviews(status.solvedDate);
  const index = dates.findIndex((_, idx) => !status.reviews?.[idx]);
  if (index === -1) {
    return null;
  }

  const date = dates[index];
  const daysAway = Math.round(
    (parseDateString(date).getTime() - parseDateString(today).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  return {
    index,
    date,
    daysAway,
    state: daysAway < 0 ? "overdue" : daysAway === 0 ? "today" : "upcoming",
  };
};

// Every known problem across built-in and custom lists, deduped by progress key.
export const getAllProblems = (customProblems = []) => {
  const seen = new Set();
  return [...Object.values(builtinProblemLists).flat(), ...customProblems]
    .filter((problem) => {
      const key = getProblemProgressKey(problem);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getActivityDates = (activityLog) =>
  Array.from(
    new Set(
      (activityLog || [])
        .map((entry) => entry.date)
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    ),
  );

export const getCurrentStreak = (activityLog, today = getTodayString()) => {
  const dates = new Set(getActivityDates(activityLog));
  const cursor = parseDateString(today);

  if (!cursor) {
    return 0;
  }

  let streak = 0;

  while (dates.has(formatLocalDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const getLongestStreak = (activityLog) => {
  const dates = getActivityDates(activityLog);
  if (!dates.length) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < dates.length; index += 1) {
    const previous = parseDateString(dates[index - 1]);
    const currentDate = parseDateString(dates[index]);

    if (!previous || !currentDate) {
      continue;
    }

    const diffDays = Math.round(
      ((currentDate as any) - (previous as any)) / (24 * 60 * 60 * 1000),
    );

    if (diffDays === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
};

export const parseLeetCodeUrl = (input) => {
  try {
    const normalized = input.startsWith("http") ? input : `https://${input}`;
    const url = new URL(normalized);
    const pathname = url.pathname.replace(/\/+$/, "");
    const match = pathname.match(/\/problems\/([^/]+)/);
    if (!match) {
      return null;
    }

    const slug = match[1];
    return {
      slug,
      title: slug
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" "),
      url: `https://leetcode.com/problems/${slug}/`,
    };
  } catch {
    return null;
  }
};

export const buildCustomProblem = ({
  slug,
  url,
  title,
  questionId,
  difficulty,
  topics,
  companies,
}) => ({
  id: createCustomProblemId({ title, questionId, slug }),
  title,
  slug,
  url,
  questionId: questionId || null,
  difficulty: difficulty || "Medium",
  topics: topics || [],
  companies: companies || [],
});

export const isProblemCompleteForTracking = (problem) =>
  Boolean(
    problem?.title &&
    problem?.difficulty &&
    Array.isArray(problem?.topics) &&
    problem.topics.length > 0,
  );

export const fetchProblemDetails = async (slug) => {
  const response = await fetch(
    `${LEETCODE_API_BASE}/problem/${encodeURIComponent(slug)}`,
  );

  if (!response.ok) {
    throw new Error(`Problem lookup failed with status ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Problem lookup returned non-JSON response`);
  }

  return buildCustomProblem({
    title: payload.title,
    questionId: payload.questionId || payload.questionFrontendId || null,
    slug,
    url: payload.url || `https://leetcode.com/problems/${slug}/`,
    difficulty: payload.difficulty || "Medium",
    topics: Array.isArray(payload.topicTags)
      ? payload.topicTags
          .map((tag) => tag?.name || tag?.slug || "")
          .filter(Boolean)
      : [],
    companies: Array.isArray(payload.companyTags)
      ? payload.companyTags
          .map((company) => ({
            name: company?.name || company?.slug || "",
            logo: company?.logo || null,
          }))
          .filter((company) => company.name)
      : [],
  });
};

export { CUSTOM_TRACKING_LIST };
