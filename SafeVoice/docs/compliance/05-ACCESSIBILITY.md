# Accessibility — WCAG 2.1 AA / EN 301 549

Target: **WCAG 2.1 level AA**, the operative benchmark of **EN 301 549** under the
**European Accessibility Act (Directive (EU) 2019/882)**, enforceable from **28 June 2025**.
Also required by RegulaOne CLAUDE.md §11.

## Checklist mapped to SafeVoice components

| WCAG criterion | What we do | Where |
|---|---|---|
| 1.3.1 Info & Relationships | All inputs have associated `<label>`/`aria-label`; tables use `scope="col"` headers. | `Views.tsx`, `UI.tsx` |
| 1.4.3 Contrast (Minimum) | Muted text raised from `slate-500/600` to `slate-400`; meaningful text avoids `9px`. | all components |
| 2.1.1 Keyboard | All actions are native buttons/links/inputs; no pointer-only controls. | all |
| 2.1.2 No Keyboard Trap / 2.4.3 Focus Order | Modal traps Tab focus, restores focus on close, closes on **Esc**. | `UI.tsx` `AppModal` |
| 2.4.1 Bypass Blocks | "Skip to main content" link before the nav. | `App.tsx` |
| 2.4.2 Page Titled | `document.title` updates per route and language. | `App.tsx` |
| 2.3.3 Animation from Interactions | `prefers-reduced-motion` honoured via `useMotionProps()`. | `a11y/motion.ts`, all `motion.*` |
| 3.1.1 Language of Page | `<html lang>` follows the chosen locale; default Polish. | `index.html`, `i18n/index.ts` |
| 3.3.1 Error Identification | Form errors use `role="alert"` + `aria-describedby`/`aria-invalid`. | `UI.tsx`, `Views.tsx` |
| 4.1.2 Name, Role, Value | Icon-only buttons have `aria-label`; relay toggle is `role="switch"` + `aria-checked`; nav uses `aria-current`. | `Navigation.tsx`, `Views.tsx`, `UI.tsx` |
| 4.1.3 Status Messages | Upload progress uses `role="status"` `aria-live="polite"`. | `UI.tsx` |

## Internationalisation (supports 3.1.1 and Polish-market requirement)
- react-i18next with Polish (`pl`) default and English (`en`) fallback.
- Language switcher in the top bar; choice stored in `localStorage` only (never sent to a
  server, never used to identify a reporter).

## Still to verify before launch
- Automated audit (axe / Lighthouse) and a manual screen-reader pass (NVDA/VoiceOver).
- Full contrast audit of every badge/disabled state against 4.5:1 (3:1 for large text).
- Translate remaining EU languages as countries are added.

---

_Last reviewed: 2026-06-18._
