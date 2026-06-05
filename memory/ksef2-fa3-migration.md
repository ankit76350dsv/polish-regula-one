---
name: ksef2-fa3-migration
description: KSeF 2.0 + FA(3) migration — verified findings, what's done, and the remaining plan
metadata:
  type: project
---

Verified against official MF docs (June 2026). The KSeFFlow KSeF integration was built against **KSeF 1.0 / FA(2)** and needs migration for the 2026 mandatory KSeF 2.0 / FA(3). See [[ksef-offline-compliance]] and [[ksef-api-topology]]. Always re-verify against the official XSD / open-api.json before coding (per [[ksef-api-topology]] verification rule).

**DONE (June 2026):**
- **#3 Invoice dates (timezone-safe):** `config/MongoDateConfig` registers MongoCustomConversions so every `LocalDate` is stored as an ISO `yyyy-MM-dd` **String** (not a BSON Date) — kills the day-shift bug across IST/UTC/CET. Proven by `MongoDateConfigTest`. NOTE: pre-existing rows stored as BSON Date need a one-time migration to strings.
- **#4 Hash:** confirmed `FA3XmlGeneratorService.sha256Hex` hashes the EXACT XML string that is submitted (`xmlResult.xmlContent()` is both hashed and sent). Made package-private; `FA3XmlHashTest` proves stored hash == SHA-256(UTF-8 xml) and a known-vector check.

**#7 FA(2)→FA(3) — DONE (June 2026): `FA3XmlBuilder` rebuilt to FA(3) + passes the official XSD.**
- `FA3XmlBuilder` now emits FA(3) (namespace `…/2025/06/25/13775/`), modeled on the official validated sample. Key fixes vs the old FA(2) builder: namespace; `FaWiersz` field meanings (P_9A=unit price, P_11=line net, P_12=rate); `Adnotacje` nested boxes (Zwolnienie/NoweSrodkiTransportu/PMarzy with `*N` flags); per-rate totals P_13_1/P_14_1 (23%), P_13_2/P_14_2 (8%), P_13_3/P_14_3 (5%), P_13_6_1 (0%), P_13_7 (exempt), P_13_10 (reverse); `Podmiot2` now has required `JST`/`GV`; removed the FA(2) `Podsumowanie`. VAT-field meanings derived from the XSD annotations (not guessed).
- `FA3XmlGeneratorService` no longer runs inline FA(2) validation (XSD check is the gate's job).
- **VERIFIED:** `FA3XmlBuilderFa3Test` (`@Tag("slow")`) builds an invoice (23%+8%) and the output PASSES `Fa3XsdValidator` against the official FA(3) XSD. `FA3XmlGeneratorServiceTest` rewritten to fast FA(3) assertions. Fast suite 52 green; integration FA(3) tests green.
- **CLEANUP done:** deleted `FA3XmlValidator`, `FA3XmlValidatorService`, and the stale `xsd/FA3_schema.xsd` (FA(2) placeholder). No FA(2) namespace/logic remains in the builder path.
- REMAINING refinements (XSD-valid but business-correctness, not blocking the XSD gate): multi-rate edge cases, optional blocks (Platnosc/P_6/attachments), reverse-charge rate code `oo` unverified for all cases.

**NOT DONE — verified non-compliant, needs the official artifacts (do NOT fabricate):**
- **#7 FA(2)→FA(3) — superseded by the DONE note above.** (Auth #6 below still pending.) `FA3XmlBuilder.FA3_NAMESPACE` is `http://crd.gov.pl/wzor/2023/06/29/12648/` — that is **FA(2)** (invalid since 1 Feb 2026). FA(3) is `http://crd.gov.pl/wzor/2025/06/25/13775/` (published 25 Jun 2025). NOT a namespace swap — FA(3) changed structure (flexible payment terms, attachments/ZALACZNIK, VAT groups, JST, authorized entities, IPKSeF payment id). Needs the official FA(3) **XSD** (place at `resources/xsd/`), a rebuilt `FA3XmlBuilder`, and strict XSD validation. Also UPO stub namespace (KSeFInvoiceService ~line 495) uses the FA(2) namespace.
- **#6 Auth (CRITICAL):** uses legacy KSeF 1.0 endpoints `/online/Session/AuthorisationChallenge` + `/online/Session/Authorisation` and sends `documentType=FA(2)` (KsefDocumentType). KSeF 2.0 is `POST /auth/challenge` → build+sign an `AuthTokenRequest` XML → submit → **token-based session**; auth has NO documentType field. Credentials: qualified signature/seal, Trusted Profile, KSeF Authentication-type cert, KSeF token, Peppol. Needs the KSeF 2.0 `open-api.json` + auth XSD. Tied to the deferred cert-enrollment flow (the `Authentication` cert) in [[ksef-offline-compliance]].

**Artifacts required before implementing #6/#7:** official FA(3) XSD, KSeF 2.0 `open-api.json`, AuthTokenRequest XSD (all from ksef.podatki.gov.pl / CIRFMF/ksef-docs). Treat #6+#7 as a dedicated migration workstream, not a quick edit.

**STEP 5a-i DONE (June 2026) — official artifacts downloaded + FA(3) XSD validator built:**
Stored under `KSeFFlow/backend/src/main/resources/`: `xsd/fa3/` (schemat.xsd = FA(3) ns 2025/06/25/13775 + 3 imports StrukturyDanych/ElementarneTypyDanych/KodyKrajow, all well-formed), `xsd/auth/AuthTokenRequest.xsd` (ns `http://ksef.mf.gov.pl/auth/token/2.0`), `openapi/ksef2/open-api.json` (KSeF API v2.6.0, 73 paths), `docs/ksef/*.md`. Built `services/fa3xml/Fa3XsdValidator` + `Fa3SchemaResourceResolver` (offline LSResourceResolver → local imports, no internet) + `Fa3XsdValidatorTest` (6 tests; positive fixture = official ksef-client-java sample `invoice-template_v3.xml` with placeholder tokens filled, in `src/test/resources/fa3-samples/`). NOT wired into invoice generation (current pipeline still FA(2)).

**CRITICAL PERF + COMPLIANCE FINDINGS (decide before wiring validation to prod):**
1. The official MF **ksef-client-java does NO client-side FA(3) XSD validation** — it relies on KSeF **server-side** validation. So strict local XSD validation is an OPTIONAL pre-check, not a KSeF requirement.
2. Stock JAXP/Xerces validation of the FA(3) schema is **~233s on the FIRST validate per JVM** (one-time content-model build for large `maxOccurs` up to 50000), then **~2ms** for every validate after. `jdk.xml.maxOccurLimit` must be ≥50000 (set to 60000); `0`/unlimited is also slow. Implication: per-invoice synchronous XSD validation is impractical unless the validator is **warmed once at startup** (async). Default production design should mirror the official client (rely on KSeF server-side) and use `Fa3XsdValidator` mainly for build/test golden-file checks.
3. Found the **AuthTokenRequest XSD** in ksef-client-java (the Step-2 auth artifact) — downloaded.

**OPTION C IMPLEMENTED (June 2026) — configurable FA(3) XSD validation:**
Config `ksef.validation.xsd.enabled` (default false; dev=true, prod=false; QA/UAT should be true). `services/fa3xml/Fa3ValidationGate` is the switch: ON → `Fa3XsdValidator.validate()` before submission (logs + throws on error); OFF → skip (KSeF validates server-side, matching the official client). When ON, the gate **warms the validator asynchronously at startup** (background daemon thread validates `xsd/fa3/warmup-invoice.xml`) so the one-time ~233s rule-table build never blocks startup or the first invoice. Wired into `KSeFInvoiceService.submitInvoice` REPLACING the old FA(2) `FA3XmlValidatorService.validateStrict` (that service is now unused → remove during builder rebuild). Business rules still run inside `generateXml`. Slow XSD tests tagged `@Tag("slow")`, excluded from `mvn test` via pom property `surefire.excludedGroups=slow`; run with `mvn test -Pintegration-tests`. Fast suite = 54 tests green ~18s; integration = 6 FA(3) tests green ~224s.
TRANSITION WARNING: with the builder still emitting FA(2) and dev `xsd.enabled=true`, dev submissions will (correctly) FAIL FA(3) validation until the FA3XmlBuilder rebuild (next step).
