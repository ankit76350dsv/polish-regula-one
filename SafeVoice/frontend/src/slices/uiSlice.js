/**
 * UI slice — app-wide presentation state that many components share:
 *   • theme  → "light" or "dark" (CLAUDE.md mandates a dark mode)
 *   • toasts → short confirmation/error messages shown after an action
 *
 * Per the project's Redux rules, this shared UI state lives in the store, not in
 * scattered component state. Applying the theme to <html> is a side effect done
 * in App.jsx by reading this slice — the reducer itself stays pure.
 */
import { createSlice, nanoid } from "@reduxjs/toolkit";
import { STORAGE_KEYS } from "../config";

function initialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.theme);
    if (saved === "light" || saved === "dark") return saved;
    // Fall back to the operating-system preference the first time.
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    /* ignore */
  }
  return "light";
}

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    theme: initialTheme(),
    toasts: [],
    // The case the user is currently viewing (CaseDetails open, or the selected Inbox
    // thread), or null. Used to suppress the "new reply" notification for that case — you
    // are already looking at it, like WhatsApp not notifying you about the open chat.
    activeCaseId: null,
  },
  reducers: {
    // Mark which case the user is currently viewing (null = none).
    setActiveCase(state, action) {
      state.activeCaseId = action.payload;
    },
    clearActiveCase(state) {
      state.activeCaseId = null;
    },
    setTheme(state, action) {
      state.theme = action.payload === "dark" ? "dark" : "light";
      try {
        localStorage.setItem(STORAGE_KEYS.theme, state.theme);
      } catch {
        /* ignore */
      }
    },
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEYS.theme, state.theme);
      } catch {
        /* ignore */
      }
    },
    // addToast({ type: 'success' | 'error' | 'info', message, persistent }) — id auto-generated.
    // persistent: true keeps the toast on screen until the user dismisses it (no auto-hide);
    // used for notifications the user should not miss (e.g. a new report arriving).
    addToast: {
      reducer(state, action) {
        state.toasts.push(action.payload);
      },
      prepare({ type = "info", message, persistent = false }) {
        return { payload: { id: nanoid(), type, message, persistent } };
      },
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { setTheme, toggleTheme, addToast, removeToast, setActiveCase, clearActiveCase } =
  uiSlice.actions;

export const selectTheme = (s) => s.ui.theme;
export const selectToasts = (s) => s.ui.toasts;
export const selectActiveCaseId = (s) => s.ui.activeCaseId;

export default uiSlice.reducer;
