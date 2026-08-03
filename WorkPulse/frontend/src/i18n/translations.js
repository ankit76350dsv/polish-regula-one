// All the words the app can show, in one place.
//
// Polish (pl) is the default language for WorkPulse, because the app is built for
// the Polish market. English (en) is the second option and also acts as the
// fallback: if a Polish word is ever missing, the app shows the English one
// instead of an empty space (see hooks/useTranslation.js).
//
// Add a new language by creating another file next to pl.js / en.js, importing it
// here, and adding its code to SUPPORTED_LANGUAGES in store/slices/languageSlice.js.
import pl from "./pl";
import en from "./en";

export const translations = { pl, en };

export default translations;
