# PrivacyPilot — Product Validation & Frontend A/B Review (2026-07-02)

Scope: validation of the PrivacyPilot module (GDPR/RODO register, privacy notices, DPIA) before further development.
Method: legal requirements verified against official sources only (EUR-Lex / EU Publications Office OJ L 119, EDPB, UODO, ISAP/Sejm ELI API, monitorpolski.gov.pl). Full legal research with citations: [privacypilot-gdpr-legal-research.md](privacypilot-gdpr-legal-research.md).
Frontends reviewed: `PrivacyPilot/frontend1` ("Frontend A"), `PrivacyPilot/frontend2` ("Frontend B") — every source file read.

---

## 1. Product validation — YES, the product has a real legal driver

1. **ROPA is legally mandatory** for controllers **and** processors — GDPR Art. 30(1)/(2), "in writing, including in electronic form" (30(3)), producible to the supervisory authority on request (30(4)). Fines under Art. 83(4)(a): up to €10M / 2% worldwide turnover.
2. **The <250-employee exemption (Art. 30(5)) is practically hollow.** The WP29 position paper (April 2018, EDPB-endorsed) reads the three carve-outs as *alternatives*: non-occasional processing alone triggers the duty, and "a small organisation is likely to regularly process data regarding its employees… such processing cannot be considered 'occasional'". Threshold is plain "risk", not "high risk". → Virtually every operating Polish business needs at least a partial ROPA.
3. **Live Polish enforcement precedent directly on point:** UODO decision **DKN.5112.14.2022 (Toyota Bank Polska, 18 Dec 2024)** — 314,302 PLN specifically for a deficient ROPA (Art. 30(1)) + missing DPIA (Art. 35(1),(7)); total 576,220 PLN with the DPO-independence count. This is the sales deck's proof point.
4. **DPIA screening is automatable against hard official criteria:** the Polish mandatory list, **Komunikat Prezesa UODO of 17 June 2019, M.P. 2019 poz. 666** (12 categories; "as a rule ≥2 criteria ⇒ DPIA required, one may suffice") + EDPB WP248 (9 criteria). Notably the Polish list explicitly names **whistleblowing systems, employee monitoring, location data, biometrics** — several of which RegulaOne's own modules (SafeVoice, WorkPulse GPS) trigger. Cross-sell inside the suite is legally grounded.
5. **Accountability (Art. 5(2) + 24(1))** makes documentation the statutory mechanism of demonstrable compliance — undocumented compliance is indistinguishable from non-compliance when UODO invokes 30(4)/33(5)/58(1).
6. **Poland-specific product hooks nobody generic covers well:** DPO notification to UODO within **14 days** of designation/change/dismissal, **electronically only** (qualified signature / ePUAP trusted profile) — Act of 10 May 2018, Art. 10; DPO contact must be published on the entity's website (Art. 11). UODO publishes official ROPA example templates (uodo.gov.pl/pl/file/1491) — the export should match their column structure.

**Caveat for positioning:** GDPR does not mandate a single "privacy policy" document. Arts. 13/14 mandate *providing information*, per context. The product must generate **per-audience notices** (website, employees, candidates, contractors, whistleblowers), not one monolithic policy.

## 2. Target customers (legally grounded)

- **SMEs (controllers)** — hollow 30(5) exemption ⇒ ROPA needed; primary underserved segment vs OneTrust-class pricing.
- **Processors** (IT, payroll bureaus, agencies) — separate Art. 30(2) register of categories of processing per controller.
- **Public bodies** — always need a DPO (Art. 37(1)(a); Polish Act Art. 9 catalogue: public-finance units, research institutes, NBP), Polish fine caps (Art. 102: 100k/10k PLN), 14-day UODO DPO workflow.
- **DPOs / compliance officers** (in-house and outsourced multi-client) — the power users; Art. 39 task support.
- Sectors force-multiplied by the M.P. 2019 poz. 666 list: health/telemedicine, HR monitoring, marketing/profiling, fintech scoring, CCTV operators, IoT.

## 3. Mandatory compliance requirements the frontend must express

| Requirement | Legal basis |
|---|---|
| ROPA with all Art. 30(1)(a)–(g) fields; controller/joint-controller/representative/DPO identity attached to the register | Art. 30(1), UODO template |
| Separate processor register (categories of processing per controller) | Art. 30(2) |
| Register export producible on demand (PDF/XLSX aligned to UODO template) | Art. 30(3)–(4) |
| Legal basis per purpose (Art. 6(1)(a)–(f), all six) + Art. 9(2) condition picker + Art. 10 | Arts. 6, 9, 10 (UODO-suggested ROPA extras) |
| DPIA screening vs M.P. 2019 poz. 666 (12 criteria) + WP248; DPIA record with Art. 35(7)(a)–(d) minimum contents; Art. 36 prior-consultation path; Art. 35(11) review | Arts. 35–36, M.P. 2019 poz. 666 |
| Per-audience privacy notices covering every Art. 13(1)–(2)/14(1)–(2) item (incl. SA complaint right, source of data, automated decision-making logic) | Arts. 12–14, WP260 |
| Breach register of ALL breaches + 72h UODO notification workflow with Art. 33(3) content + Art. 34 subject communication | Arts. 33–34 |
| DSAR handling with 1-month deadline, +2-month extension, identity-proportionate verification | Arts. 12(3), 15–22 |
| Processor/DPA management (Art. 28(3) content, sub-processors, 2021/915 SCCs) | Art. 28 |
| Transfer mapping: destination country, mechanism (adequacy list / 2021/914 SCCs / Art. 49), TIA documentation | Ch. V, EDPB Rec. 01/2020 |
| DPO module: designation, 14-day UODO notification tracking, website-publication flag | Polish Act Arts. 10–11 |
| Immutable audit trail (who/when/old/new) on compliance records | Art. 5(2); CLAUDE.md §5 |
| Polish-first UI + Polish legal document output | market requirement; CLAUDE.md §11 |

## 4. Frontend A (`frontend1`) — verdict: polished shell, legally weak

React 19 + Vite, Tailwind v4, **no Redux Toolkit** (state = one 580-line App.tsx + localStorage), no router (string state), 100% mock. Stock Google AI Studio scaffold (README/title/package.json untouched; dead deps `@google/genai`, `express`).

**Strengths worth harvesting:** 10-step wizard whose structure mirrors Art. 30 with inline legal explainers per step (good pedagogy); audit-log UI with old/new diff modal (best-in-class of the two); clean 8-item IA; real dark/light toggle; consistent component library with stable test ids; table affordances (sort/filter/bulk/pagination/CSV).

**Fatal problems:**
- Art. 30 coverage incomplete: controller/DPO data lives only in Settings and **never joins the register or exports**; recipients conflated with processors; no destination country on transfers; no Art. 9(2) condition; wizard offers only 4 of 6 Art. 6 bases (6(1)(d)/(e) unselectable); presets-only entry (8 data categories, 5 processors, 6 retention options — real orgs can't describe their processing).
- **Legal errors:** "GIODO/RODO STANDARD" badge (GIODO defunct since 2018); "Art 21 = absolute right to revoke consent" (Art. 21 is objection; withdrawal is Art. 7(3)); location + children's data labeled "Art 9 High-Risk" (neither is Art. 9); "Bypassed under Binding Corporate Rules"; "PUODO – Urząd…" misnaming; audit stream cited as "Article 30(4)".
- **DPIA page is a simulator** — 5 manual toggles, never reads the actual register; DPIA trigger in the wizard = "any sensitive preset picked", no 2-criteria logic, no Art. 35(7) record, no Art. 36.
- Policy generator: template selector is a no-op; output misses Art. 13/14 mandatory items (controller identity, SA complaint, portability, ADM); Markdown-only export. No PDF/DOCX anywhere.
- Compliance theater: hardcoded "Compliance Score A+", "S-Class sealed", "blockchain ledger", "AES-GCM-256", fake MFA — violates CLAUDE.md §22 (no fake compliance logic).
- RBAC display-only (Auditor can delete the register; role self-selected at login); tenancy cosmetic; **zero Polish i18n** (`lang="en"`, no i18n lib).

## 5. Frontend B (`frontend2`) — verdict: best domain thinking, broken engineering

React 19 + Vite, Tailwind v4 (dark-only via `!important` palette hijack), **no Redux Toolkit** (one ~490-line React Context, 14 useState arrays), hand-rolled hash router, mock localStorage "API". Also stock AI Studio scaffold.

**Strengths worth harvesting (this is the product spec, in code):**
- `compliance-rules.ts` implements the **12 Polish DPIA criteria** (`DPIA-PL-01…12`) with EN/PL labels, correctly attributed to Monitor Polski 2019 poz. 666, with the ≥2-criteria rule — closely matching the official list.
- ROPA model is near-complete vs Art. 30(1): purposes, subjects, categories, sources, recipients, vendors, transfers + safeguards, retention **+ retentionBasis**, TOMs (14-item curated list), `lawfulBasis`, `specialCategoryCondition` (Art. 9(2)), `criminalCategory` (Art. 10), controller/processor/joint-controller role, completeness score, review date. Controller/Processor register tabs (Art. 30 ust. 1 / ust. 2).
- **Adjacent modules that A lacks entirely:** breach register with 72h concept + documented non-reportable rationale (Art. 33(5)); DSAR queue with SLA and letter templates; Art. 28 vendor/DPA management with external vendor questionnaire portal; audits/evidence room (Art. 5(2) "Accountability Locker"); role-based dashboards (DPO advice queue Art. 35(2), CO breach clocks); onboarding with NIP, controller/processor scope, EU-residency choice.
- Polish-first: default language PL, genuine Polish legal terminology ("Rejestr Czynności Przetwarzania", ADO, IOD, "Ustawa o ochronie sygnalistów", ZUS/PESEL/KSeF), credible Polish mock activities (HR payroll citing ZUS, telemedicine Art. 9(2)(h), whistleblowing Art. 9(2)(g)).
- 11-role model incl. SUPER_ADMIN/DPO/AUDITOR/EXTERNAL_VENDOR + a sensible `canPerformAction` matrix.

**Fatal problems:**
- **Crash-level bugs in ≥5 screens** (context/type mismatches: `updateRequest`, `toggleTask` don't exist; mock incidents crash the workspace; `tsc --noEmit` would fail — never type-checked).
- **~⅓ of navigation unrouted**: Risk Register, Transfers, Reports, Documents, Super Admin console (routing bug dumps to Login), DSAR public portal, incident-new — silently render Dashboard.
- **Privacy-notice generation — one of the three product pillars — does not exist at all.**
- `canPerformAction` never called (any role can approve/delete anything); tenancy cosmetic (no `tenantId` on entities — switching tenant shows another company's data); controller/DPO block hardcoded to tenant-1; all exports are fake toasts; 72h clock and DSAR countdown are static strings; DSAR identity auto-verified (anti-pattern; UODO has sanctioned excessive ID collection); wizard validation nil; DPIA created from wizard discards matched criteria; audit log lacks old/new values; i18n inconsistent (wizard/DPIA/settings English-only); Art. 6 list missing (d)/(e).
- Legal rough edges: "minimum 2 criteria under Polish law" stated as hard rule (official text: "as a rule"; one can suffice); extension once said "2-month", once "1-Month Notice"; CCTV retention rationale garbles Labour Code Art. 22² §3 (3 months).

## 6. Recommendation — Option 3: new frontend, harvesting B as spec

Neither prototype is a production foundation:
- Both violate the repo mandate (no Redux Toolkit, no services layer, no router, localStorage-as-database, AI Studio scaffolding, no tests, external CDN fonts).
- A is legally the weaker artifact (incomplete Art. 30, real legal errors, DPIA simulator, fake compliance claims) — its value is UI polish.
- B is the right *product* but broken *code*: crash bugs, unrouted nav, dead pillar (notices), unenforced RBAC. Fixing it means rewriting state management, routing, typing, and enforcement — i.e., a rewrite in place.

**Build a new `PrivacyPilot/frontend` with:** RTK + RTK Query (services/slices per CLAUDE.md §26), React Router, react-i18next (PL default + EN), enforced RBAC guards, tenant-scoped API contracts. Port from B: the DPIA criteria module, ROPA data model (+ gaps below), module set, Polish terminology, role dashboards. Port from A: wizard step pedagogy/explainers, audit diff-viewer pattern, light/dark theming.

### Screen-by-screen structure (v1)

1. **Auth** — OAuth2/OIDC redirect + MFA (backend-driven; no fake forms).
2. **Onboarding** — company profile (NIP/REGON/KRS), controller/processor/joint roles, DPO details + **UODO notification status & 14-day deadline tracker**, Art. 30(5) exemption self-check (with WP29 warning), team invites.
3. **Dashboard (per role)** — compliance posture from real data: ROPA completeness, DPIAs due/review dates (Art. 35(11)), breach clock, DSAR SLAs, DPO advice queue.
4. **ROPA Register** — Controller (30(1)) / Processor (30(2)) tabs; versioned records; filters; export (PDF/XLSX matching UODO template incl. controller/DPO title page).
5. **Activity Wizard** (8–10 steps): basics & owner → purposes + Art. 6 basis **per purpose** (all six) + Art. 9(2)/Art. 10 pickers → subjects & categories (presets + free entry) → sources & recipients (recipients ≠ processors) → processors/vendors (link to Vendor module) → transfers (destination country, mechanism: adequacy/SCC 2021/914/Art. 49, TIA link) → retention (period + legal basis per category) → TOMs → **DPIA screening (12 PL criteria + WP248)** → review & submit (validated per step).
6. **DPIA Center** — screening results → full assessment implementing Art. 35(7)(a)–(d) (description, necessity/proportionality, risk matrix, mitigations) → DPO advice (35(2)) → approval workflow (enforced roles) → Art. 36 prior-consultation pack → periodic review scheduler.
7. **Notice Generator** — per-audience (website/employees/candidates/contractors/whistleblowers), compiled from register data, Art. 13/14 checklist enforced (every mandatory item present or blocked), PL+EN output, PDF/DOCX, versioning.
8. **Vendors & DPAs** — Art. 28(3) checklist, sub-processors, SCC 2021/915 template, questionnaire portal.
9. **Transfers** — per-destination register, mechanism, TIA documentation store.
10. **Breach Register** — all breaches (33(5)), real 72h countdown, Art. 33(3) content form, risk decision + rationale, Art. 34 communication workflow, UODO submission checklist.
11. **DSAR** — public intake, proportionate identity verification, real deadline engine (1 month +2 extension with notice), per-system collection tasks, response letters PL/EN.
12. **Audits & Evidence** — evidence locker (5(2)), audit projects, findings.
13. **Audit Trail** — tenant-scoped, old/new diffs, actor/IP/UA, exportable (per CLAUDE.md §5).
14. **Documents** — generated artifacts, versioned, hash-verified.
15. **Settings** — company/DPO, retention defaults, roles (enforced), language.
16. **Super Admin** — tenants, plans, feature flags (separate route tree, real guard).

### Prioritized pre-development fixes (P0 → P2)

**P0 (blockers):**
1. Scaffold new frontend: RTK + RTK Query + React Router + react-i18next (PL default), CI type-check, no AI-Studio leftovers, self-hosted fonts (no Google Fonts CDN — data-residency optics).
2. Backend API contract first (OpenAPI): tenant-scoped entities (`tenant_id` everywhere), auth, RBAC claims — no localStorage persistence of business data.
3. Correct legal data model: all six Art. 6 bases; Art. 9(2)(a)–(j) picker; Art. 10; recipients vs processors; transfer destination country + mechanism; retention per category; controller/DPO joined to register + exports.
4. DPIA engine as shared, tested module: 12 × M.P. 2019 poz. 666 criteria + WP248, "as a rule ≥2" wording (not "legally required minimum 2").
5. Real exports: ROPA PDF/XLSX aligned to the UODO template; notice PDF/DOCX.

**P1:**
6. Notice generator with Art. 13/14 completeness gate (blocked until every mandatory item present).
7. Enforced RBAC (route guards + action guards from one permission matrix; server-authoritative).
8. Breach 72h + DSAR 1-month deadline engines (server clocks, not UI strings).
9. Audit trail with old/new values, actor, IP, UA, tenant.
10. Full PL/EN i18n coverage incl. generated documents; fix legal terminology (UODO not GIODO; "Prezes UODO"; Art. 21 vs 7(3); Labour Code Art. 22² §3 CCTV = 3 months).

**P2:**
11. DPO module: 14-day UODO notification tracker + website-publication flag (Polish Act Arts. 10–11).
12. Art. 30(5) exemption advisor (narrow WP29 reading, per-activity flags).
13. Vendor questionnaire portal; TIA workflow (EDPB Rec. 01/2020 six steps).
14. Review-date reminders (Art. 35(11)), retention-expiry alerts.
15. WCAG 2.1: ≥14px body text, contrast on dark theme, keyboard-operable controls, focus management (both prototypes fail today).

### What NOT to build (unnecessary features seen in prototypes)
- Compliance "scores/grades" presented as legal assurance (A's "A+ / S-Class") — replace with factual completeness checklists.
- "Blockchain ledger" claims, decorative security badges, fake encryption labels.
- Legal-tone "templates" that don't change output.
- Employee-training widgets (belongs to SafeWork), MRR dashboards inside the compliance module (Super Admin scope only).
