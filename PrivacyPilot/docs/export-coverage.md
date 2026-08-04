# Export coverage across PrivacyPilot

Date: 2026-08-03

Every screen that holds evidence a DPO, auditor or UODO inspector can ask for now exports it,
and every copy is recorded in the audit trail first.

## 1. Files modified

**Backend**
- `models/enums/export/ExportTarget.java` — 9 new targets
- `service/ExportService.java` — added `DpiaRepository`, `DsarRepository`,
  `ProcessingActivityRepository`; new `describeEntity` cases + `dsarLabel`
- `test/service/ExportServiceTest.java` — 16 tests (was 9)

**Frontend — new**
- `src/lib/csv.js` — shared CSV plumbing (delimiter, quoting, dates, provenance, BOM download)
- `src/lib/registersCsv.js` — 6 register CSV builders
- `src/lib/dpiaReport.js` — Art. 35(7) DPIA report (Markdown)
- `src/lib/dsarCaseFile.js` — Art. 12 / 15-22 request case file (Markdown)
- `src/lib/activityRecord.js` — single Art. 30 record sheet (Markdown)
- `src/components/common/ExportMenu.jsx` — the shared record-then-produce control

**Frontend — modified**
- `lib/registerCsv.js`, `pages/Ropa/RegisterPage.jsx`, `pages/Ropa/ActivityDetailPage.jsx`,
  `pages/Dpia/DpiaListPage.jsx`, `pages/Dpia/DpiaDetailPage.jsx`, `pages/Vendors/VendorsPage.jsx`,
  `pages/Transfers/TransfersPage.jsx`, `pages/Breaches/BreachesPage.jsx`, `pages/Dsar/DsarPage.jsx`,
  `pages/Dsar/DsarDetailPage.jsx`, `pages/Admin/UsersPage.jsx`, `pages/Audit/AuditTrailPage.jsx`,
  `i18n/en.js`, `i18n/pl.js`

## 2. Old behaviour

Only 4 of 13 evidence-bearing screens could export: the ROPA register (CSV), the audit trail
(CSV), privacy notices and the UODO breach report (Word/Markdown/print).

Nothing else could leave the app. Most importantly the **breach register** could not — even
though Art. 33(5) obliges the controller to document every breach and make that documentation
available to the supervisory authority on request. The DPIA register, processor register,
transfer register, request register and user access list were all screen-only, as were the
individual DPIA and request records.

Each of the 4 working exports also re-implemented the "record before handing over" sequence by
hand, and the BOM download helper existed twice (RegisterPage and AuditTrailPage).

## 3. New behaviour

| Screen | Export | Target code | Legal basis |
|---|---|---|---|
| ROPA register | CSV | `register_controller` / `register_processor` | Art. 30(1)/(2) |
| Activity detail | Word / MD / print | `activity_record` | Art. 30 |
| DPIA list | CSV | `register_dpia` | Art. 35 |
| DPIA detail | Word / MD / print | `dpia_report` | Art. 35(7), Art. 36(3)(e) |
| Processors | CSV | `register_vendors` | Art. 28, Art. 30(1)(d) |
| Transfers | CSV | `register_transfers` | Chapter V, Art. 30(1)(e) |
| Breaches | CSV | `register_breaches` | **Art. 33(5)** |
| Breach detail | Word / MD / print / copy | `breach_report` | Art. 33(3) (pre-existing) |
| Requests (DSAR) | CSV | `register_dsar` | Arts. 12, 15-22 |
| Request detail | Word / MD / print | `dsar_case_file` | Art. 12(3), Art. 12(4) |
| Notices | Word / MD / print | `privacy_notice` | Arts. 13/14 (pre-existing) |
| Users | CSV | `register_users` | Art. 32(1)(b)/(4) |
| Audit trail | CSV | `audit_trail` | Art. 5(2) (pre-existing) |

**Deliberately NOT given an export**: Dashboard (a derived view of registers that all export
individually), Settings, Profile, Landing, Login, NotFound.

Three CSV columns are **computed findings**, not stored fields, because they are the question an
inspector actually asks and deriving them by eye from two timestamps invites mistakes:
- breaches: "Notified within 72h (Art. 33(1))" — on time / late / not yet / not required
- requests: "Answered within the deadline (Art. 12(3))" — same shape
- DPIA: highest inherent and highest residual risk score

## 4. Why the old code was changed

- **`ExportMenu`** replaces the hand-written record-then-produce sequence. Nine new export
  paths meant nine more chances to get the order wrong, skip the permission check, or swallow
  the failure and hand the file over anyway — which would let a register leave with nothing in
  the trail. The sequence now exists once.
- **`lib/csv.js`** replaces two copies of the BOM download helper and the private
  delimiter/quote/date helpers inside `registerCsv.js`. Seven registers sharing four rules that
  must all be right (Excel delimiter per language, unconditional quoting, timezone-stamped
  dates, UTF-8 BOM) should not each keep their own copy.
- **`registerCsv.js`** now takes `filterSummary` and prints it in the provenance block. The
  filters were already recorded on the audit line but not in the file, so a filtered export was
  indistinguishable from the complete register — and a reader would reasonably assume it was
  complete. This changes the existing ROPA CSV by adding one line.
- **`AuditTrailPage`** keeps its own flow on purpose: it embeds the audit *receipt* inside the
  file and warns when the export could not hold every matching row. Only its duplicated
  download helper was removed.

## 5. Security impact

- Nothing weakened. Every new path goes through the same gate: `EXPORT_DATA` capability checked
  in the browser **and** enforced by `ExportController.CAN_EXPORT` on the server.
- Tenant isolation: the 3 new single-document targets look the record up with
  `findByIdAndTenantIdAndDeletedFalse`, so a record belonging to another company is a 404 and no
  audit line can be written about it. Covered by `refusesForeignSingleDocuments`.
- Nothing about the actor is trusted from the client — user, company, IP and browser all come
  from the verified session.
- **Data minimisation on file names**: the DSAR case file is named after the request *type*,
  never the requester. A name in a file name propagates into folders, e-mail attachments and
  backup indexes, where it is far harder to control than the file's contents.
- The DSAR register CSV and case file are the most sensitive exports in the product (they name
  identified data subjects) — which is exactly why every copy is recorded.

## 6. Compliance impact

Closes the Art. 33(5) gap: the breach register could not be handed to UODO at all. Adds the
Art. 35(7)/36(3)(e) DPIA report, the Art. 12 request case file, and Art. 28 / Chapter V /
Art. 32 register exports. Every export line remains immutable 10-year evidence under Art. 5(2),
filed under its own entity type so the trail stays filterable per register.

Export documents are bilingual (PL/EN) throughout, with the semicolon delimiter for Polish
Excel, and every heading carries the article it evidences.

## 7. Testing performed

- Backend: full suite `./mvnw -o test` → **74 tests, 0 failures**, including the Spring context
  test that validates the new `ExportService` constructor wiring. `ExportServiceTest` grew from
  9 to 16 tests (per-register entity types, each new single-document label, tenant isolation).
- Frontend: `npm run build` → clean (only the pre-existing chunk-size warning).
- All 10 builders executed against realistic data (including a late breach notification, a
  refused-after-deadline request, an adequacy-country transfer needing no TIA, and values
  containing quotes and commas) and the output inspected in both languages.
- i18n parity checked programmatically: `en.js` and `pl.js` have identical key sets; a
  fail-loud translator confirmed no builder requests a missing key.
- Unused-import scan over all 18 changed/new files: clean.

Not run: there is no frontend test runner in this project (`package.json` has no test script),
so the builder checks above were one-off and are not committed as regression tests.

## 8. Potential risks / side effects

- **The existing ROPA CSV gains one provenance line** ("Filters applied"). Anything parsing
  that file by fixed row offset would need updating; it is written for humans, so this is
  considered safe.
- `ExportMenu` disables the register CSV buttons until tenant settings have loaded, so a file
  can never open with a blank "Controller:" line. If the settings request fails the button stays
  disabled — the same trade-off the ROPA export already made.
- `print` opens a pop-up. When the browser blocks it the export is already recorded but the
  document does not appear, so `export.deliveryFailed` now tells the user instead of failing
  silently.
- Export remains an accountability record, not a data-loss-prevention control: someone already
  allowed to read the data could call the read APIs and assemble their own copy. Closing that
  fully means generating exports server-side, which needs the bilingual register labels that
  today live only in the frontend.
