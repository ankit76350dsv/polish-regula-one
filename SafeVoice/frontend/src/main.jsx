import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store/store.js";
import App from "./App.jsx";
// Initialise translations (Polish + English) before anything renders, so the
// very first paint is already in the user's language.
import "./i18n";
import "./index.css";

// <Provider> makes the single Redux store available to every component via hooks
// (useSelector / useDispatch). All shared/API state — starting with auth — flows
// through it, per the project's Redux Toolkit rules.
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
