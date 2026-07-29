# EU-Wide Compliance Requirements

Requirements that apply in **every** EU member state. National laws (see
[`01-POLAND.md`](01-POLAND.md)) transpose these and may be stricter, but never weaker.

---

## 1. Directive (EU) 2019/1937 — EU Whistleblowing Directive

Source: https://eur-lex.europa.eu/eli/dir/2019/1937/oj/eng

### Who must comply
- Legal entities with **50+ workers** (private and public), and entities in financial
  services / AML regardless of size. (Art. 8)

### Reporting channels (Art. 7–9)
- **Internal** reporting channels that are secure and protect confidentiality.
- **External** channels to a designated competent authority.
- **Public disclosure** protection in defined circumstances (Art. 15).

### Deadlines (Art. 9(1)) — used throughout SafeVoice
| Obligation | Limit | Article |
|---|---|---|
| Acknowledge receipt of a report | **7 days** | Art. 9(1)(b) |
| Give feedback on follow-up | **3 months** | Art. 9(1)(f) |

### Confidentiality & data protection (Art. 16–18)
- The reporter's **identity must stay confidential**; disclosure only under strict legal
  conditions and usually with notice. (Art. 16)
- Processing of personal data must comply with **GDPR**; data **manifestly not relevant**
  to a report must **not be collected**, or must be **deleted**. (Art. 17)
- Keep **records** of every report, proportionate and confidential. (Art. 18)

### Anti-retaliation (Art. 19–24)
- Prohibits dismissal, demotion, intimidation, blacklisting, and other retaliation.
- Reporters who reasonably believed the information was true and fell in scope are protected.

### Anonymous reporting (Art. 6(2), Recital 34)
- Member States **may** decide whether entities must accept anonymous reports. Where
  anonymous reporters are later identified and retaliated against, they are still protected.

### SafeVoice mapping
- 7-day / 3-month deadlines: `jurisdictions.ts` → `acknowledgementDays`, `feedbackMonths`.
- No reporter telemetry, evidence minimisation, identity confidentiality: enforced in the UI
  and documented in [`06-SECURITY-DATA-PROTECTION.md`](06-SECURITY-DATA-PROTECTION.md).
- External-authority signposting before submission: report portal step 2.

---

## 2. GDPR — Regulation (EU) 2016/679

Source: https://eur-lex.europa.eu/eli/reg/2016/679/oj

Principles most relevant to a whistleblower channel:
- **Art. 5** — lawfulness, fairness, transparency; **purpose limitation**; **data
  minimisation**; **storage limitation**; integrity & confidentiality; accountability.
- **Art. 6 / 9** — lawful basis (legal obligation / public interest); special-category data
  needs an Art. 9 condition.
- **Art. 25** — **data protection by design and by default** (anonymous-first intake).
- **Art. 30** — records of processing activities (ROPA).
- **Art. 32** — security of processing (encryption, confidentiality, resilience).
- **Art. 35** — a **DPIA is expected** for a whistleblowing system (large-scale, sensitive,
  high risk to data subjects).
- **Chapter V** — international transfers: personal data must stay in the EEA unless a valid
  transfer mechanism applies. SafeVoice ships **no** third-party AI/analytics that would
  transfer report content outside the EEA.

---

## 3. Accessibility — European Accessibility Act & EN 301 549

- **Directive (EU) 2019/882 (EAA)** — applies to consumer-facing digital services; in force
  and enforceable from **28 June 2025**. Source: https://eur-lex.europa.eu/eli/dir/2019/882/oj
- **EN 301 549** is the harmonised EU standard; its web requirements map to **WCAG 2.1 level
  AA**. (WCAG 2.2 is not yet in the harmonised standard, so 2.1 AA is the operative target.)
- Public-sector bodies are additionally covered by the **Web Accessibility Directive
  (EU) 2016/2102**.

SafeVoice targets **WCAG 2.1 AA**; the component-level checklist is in
[`05-ACCESSIBILITY.md`](05-ACCESSIBILITY.md). CLAUDE.md §11 also mandates WCAG 2.1, i18n,
Polish language, and dark mode.

---

_Last reviewed: 2026-06-18._
