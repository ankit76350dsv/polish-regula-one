import { createSlice } from "@reduxjs/toolkit";

// Which language the whole app is shown in.
//
// This lives in Redux (not in a component) because EVERY screen needs to know
// the answer — the header, the tables, the buttons, the error messages. Keeping
// it in one place means the whole app switches together the moment the user
// presses the toggle, and no screen can disagree with another.

// Where we remember the choice between visits, so a Polish user does not have to
// press the button every time they open the app.
//
// The key is prefixed with "workpulse." so it cannot clash with the key SafeWork
// uses ("safework.language"). Both apps run on localhost during development and
// therefore share one localStorage — an unprefixed key would let one app change
// the other app's language.
const STORAGE_KEY = "workpulse.language";

// Polish is the DEFAULT because WorkPulse is built for the Polish market: the
// people clocking in and out, and the PIP inspector who may read these records,
// work in Polish. English is the second option.
export const DEFAULT_LANGUAGE = "pl";

// The languages we actually have words for. Anything else is ignored, so a bad
// value saved in the browser can never leave the app half-translated.
export const SUPPORTED_LANGUAGES = ["pl", "en"];

/**
 * Read the saved choice from the browser.
 *
 * Wrapped in try/catch because localStorage can throw — for example in a private
 * window, or when the user has blocked storage. If anything goes wrong we simply
 * fall back to Polish instead of crashing the app on start-up.
 *
 * @returns {string} "pl" or "en"
 */
const readSavedLanguage = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
};

/**
 * Remember the choice for next time.
 *
 * Also safe to fail: if we cannot save, the app still works for this visit and
 * simply starts in Polish next time.
 *
 * @param {string} language "pl" or "en"
 */
export const saveLanguage = (language) => {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage is not available — nothing to do, and nothing worth breaking for.
  }
};

const languageSlice = createSlice({
  name: "language",
  initialState: {
    // Start with whatever the user picked last time, or Polish on a first visit.
    current: readSavedLanguage(),
  },
  reducers: {
    // Switch to a specific language. Unknown values are ignored on purpose.
    setLanguage: (state, action) => {
      if (SUPPORTED_LANGUAGES.includes(action.payload)) {
        state.current = action.payload;
      }
    },

    // Flip between the two languages — what the header button uses.
    toggleLanguage: (state) => {
      state.current = state.current === "pl" ? "en" : "pl";
    },
  },
});

export const { setLanguage, toggleLanguage } = languageSlice.actions;

// Small helper so components read the language the same way everywhere.
export const selectLanguage = (state) => state.language.current;

export default languageSlice.reducer;
