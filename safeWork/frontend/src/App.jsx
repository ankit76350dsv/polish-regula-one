import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useSelector } from "react-redux";
import { AuthProvider } from "./context/AuthContext";
import router from "./routes/AppRoutes";
import { selectLanguage } from "./store/slices/languageSlice";

export default function App() {
  // Which language the user picked (Polish by default).
  const language = useSelector(selectLanguage);

  // Tell the browser which language this page is written in, by setting
  // <html lang="pl"> or <html lang="en">.
  //
  // Why this matters: screen readers use it to choose the right pronunciation,
  // and browsers use it for spell-checking and for offering to translate a page.
  // If it stays "en" while the text is Polish, a screen reader reads Polish words
  // with English pronunciation. Getting this right is also required by the
  // accessibility rules we follow (WCAG 2.1, rule 3.1.1 "Language of Page").
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
