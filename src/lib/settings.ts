// Shared by server and client: no runtime imports.
import type { Grade } from "./fsrs";

export interface Settings {
  followedLists: string[];
  polygonList: string;
  targetRecall: number;
  newPerDay: number;
  reminder: { enabled: boolean; time: string };
}

export const DEFAULT_SETTINGS: Settings = {
  followedLists: ["neetcode150"],
  polygonList: "neetcode150",
  targetRecall: 0.9,
  newPerDay: 3,
  reminder: { enabled: false, time: "09:00" },
};

export interface ReviewRow { id: number; problemId: string; date: string; grade: Grade | null }
