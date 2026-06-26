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
  },
  reducers: {
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
    // addToast({ type: 'success' | 'error' | 'info', message }) — id is auto-generated.
    addToast: {
      reducer(state, action) {
        state.toasts.push(action.payload);
      },
      prepare({ type = "info", message }) {
        return { payload: { id: nanoid(), type, message } };
      },
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const { setTheme, toggleTheme, addToast, removeToast } = uiSlice.actions;

export const selectTheme = (s) => s.ui.theme;
export const selectToasts = (s) => s.ui.toasts;

export default uiSlice.reducer;
