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

**NOT DONE — verified non-compliant, needs the official artifacts (do NOT fabricate):**
- **#7 FA(2)→FA(3) (CRITICAL):** `FA3XmlBuilder.FA3_NAMESPACE` is `http://crd.gov.pl/wzor/2023/06/29/12648/` — that is **FA(2)** (invalid since 1 Feb 2026). FA(3) is `http://crd.gov.pl/wzor/2025/06/25/13775/` (published 25 Jun 2025). NOT a namespace swap — FA(3) changed structure (flexible payment terms, attachments/ZALACZNIK, VAT groups, JST, authorized entities, IPKSeF payment id). Needs the official FA(3) **XSD** (place at `resources/xsd/`), a rebuilt `FA3XmlBuilder`, and strict XSD validation. Also UPO stub namespace (KSeFInvoiceService ~line 495) uses the FA(2) namespace.
- **#6 Auth (CRITICAL):** uses legacy KSeF 1.0 endpoints `/online/Session/AuthorisationChallenge` + `/online/Session/Authorisation` and sends `documentType=FA(2)` (KsefDocumentType). KSeF 2.0 is `POST /auth/challenge` → build+sign an `AuthTokenRequest` XML → submit → **token-based session**; auth has NO documentType field. Credentials: qualified signature/seal, Trusted Profile, KSeF Authentication-type cert, KSeF token, Peppol. Needs the KSeF 2.0 `open-api.json` + auth XSD. Tied to the deferred cert-enrollment flow (the `Authentication` cert) in [[ksef-offline-compliance]].

**Artifacts required before implementing #6/#7:** official FA(3) XSD, KSeF 2.0 `open-api.json`, AuthTokenRequest XSD (all from ksef.podatki.gov.pl / CIRFMF/ksef-docs). Treat #6+#7 as a dedicated migration workstream, not a quick edit.
