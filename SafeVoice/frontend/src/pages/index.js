// Root barrel for all SafeVoice pages.
//
// Pages are grouped into folders by HOW they are used, not by name:
//   public/  → anonymous, no-login reporter journey (submit / track a report)
//   staff/   → gated workspace for case handlers (behind SSO AuthGate)
//   system/  → shared status screens (e.g. access denied)
//
// Everything is re-exported from here under its original name, so the rest of
// the app can keep importing from "./pages" exactly as before.
export * from "./public";
export * from "./staff";
export * from "./system";
