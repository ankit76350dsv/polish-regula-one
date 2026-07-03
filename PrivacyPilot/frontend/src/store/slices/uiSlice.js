// UI state — language (PL default; Poland-first product) and layout chrome.
import { createSlice } from '@reduxjs/toolkit';

const LANG_KEY = 'pp_lang';

function initialLanguage() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'pl' || stored === 'en') return stored;
  } catch { /* storage unavailable */ }
  return 'pl';
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    language: initialLanguage(),
    sidebarOpen: true,
  },
  reducers: {
    setLanguage(state, action) {
      state.language = action.payload;
      try { localStorage.setItem(LANG_KEY, action.payload); } catch { /* ignore */ }
      document.documentElement.lang = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const { setLanguage, toggleSidebar } = uiSlice.actions;
export default uiSlice.reducer;
