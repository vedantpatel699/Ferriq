// Persisted application settings. Deliberately small: only settings that
// affect real engineering behavior live here (shift boundaries feed the
// Shift time-range calculation everywhere in the app). UI-only knobs
// (decimal precision, line thickness, gridline toggles, a theme switch —
// Ferriq is light-theme only) are not modeled; metric precision is
// defined per engineering quantity in each equipment module instead.

const STORAGE_KEY = "ferriq.settings.v1";

export interface FerriqSettings {
  shiftStartHour: number; // 0-23, day-shift start
  shiftEndHour: number;   // 0-23, day-shift end (night shift is the complement)
}

export const DEFAULT_FERRIQ_SETTINGS: FerriqSettings = {
  shiftStartHour: 7,
  shiftEndHour: 19,
};

export function getFerriqSettings(): FerriqSettings {
  if (typeof window === "undefined") return DEFAULT_FERRIQ_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FERRIQ_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FERRIQ_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_FERRIQ_SETTINGS;
  }
}

export function saveFerriqSettings(settings: FerriqSettings): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function resetFerriqSettings(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
