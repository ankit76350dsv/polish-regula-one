# Register Form Guide — "Add New Activity" Wizard

**Page:** `/register/new` (and `/register/:id/edit` for editing)
**Code:** `src/pages/Ropa/ActivityWizardPage.jsx`

This guide explains, in simple language, **why the form exists** and **exactly what
to type in each field**, with real example values. Every option list below is
copied from the real code (`src/lib/gdpr.js`, `src/lib/dpiaCriteria.js`) so it
matches what a user actually sees.

---

## 1. Why this form exists (plain language)

The law (GDPR / RODO **Article 30**) says: *for every different thing your
company does with people's personal data, write down a small fact-sheet about
it.* This 9-step form **is** that fact-sheet.

- You fill it in **once per activity** — e.g. "HR & payroll" is one activity,
  "CCTV" is another, "Marketing newsletter" is another.
- When you press **Save**, a new row appears in the Register (the Art. 30 list).
- The form is split into 9 small steps so it never feels overwhelming.

**Use case in one line:** A Compliance Officer or DPO uses this form to create
one audit-ready Art. 30 record per data activity, so that when the Polish
regulator (**UODO**) asks *"show me your Register,"* every activity already has a
complete, correct fact-sheet.

---

## 2. The AI Copilot (Step 1 only)

On **Step 1** there is an **AI box**. You type a plain sentence describing the
activity, and it **pre-fills a draft of the whole 9-step form** to save typing.
You still walk through every step and confirm — validation, the special-category
picker, and the DPIA screening all stay in force.

> ⚠️ **Current state:** the AI is a **dummy/mock**. In the code it reports its
> model as `mock-ai-v0 (dummy)` (`src/services/aiService.js`). No real model is
> connected yet.

**Which model to use when building it for real:** this is legal-reasoning work
(map a plain description → correct lawful basis, data categories, retention,
DPIA flags). Use the strongest reasoning model — **Claude Opus 4.8** is the best
fit for compliance accuracy. **Claude Haiku 4.5** could handle simpler drafts
more cheaply. The AI **must run server-side** — never put API keys in the browser.

**Example prompt for the AI box:**
> "We send a monthly marketing newsletter to people who subscribe on our
> website. We store their name and email in Mailchimp."

---

## 3. Field-by-field guide

Legend: **★ = required field** (the form blocks you until it's filled).

We use one running example throughout: **a company email newsletter** 📧.

---

### Step 1 — Basics
*What is this activity and who runs it?*

| Field | What it means | Options / format | Example |
|---|---|---|---|
| **Activity Name ★** | Short name for the activity | free text | `Newsletter marketingowy` |
| **Department** | Which team runs it | HR · Finance · IT · Marketing · Sales · Operations · Legal · Security | `Marketing` |
| **Role (Art. 30)** | Are you the boss of the data or handling it for someone else? | `Controller` · `Joint controller` · `Processor` | `Controller` |
| **Controllers you process for ★** | *(Only appears if Role = Processor.)* Which companies you handle data for | free text | *(n/a for newsletter)* |

> **Controller vs Processor:** *Controller* = you decide why and how the data is
> used (keeps the Art. 30(1) record). *Processor* = you only handle data on
> another company's instructions (keeps the Art. 30(2) record).

---

### Step 2 — Purpose & Lawful Basis
*Why do you do this, and what law lets you?*

| Field | What it means | Example |
|---|---|---|
| **Purpose ★** | Why you collect the data (min. 20 characters) | `Sending monthly marketing newsletters to people who subscribed on our website` |
| **Lawful Basis ★** | The legal reason you're allowed *(controllers only)* — pick one of six | `Consent` |
| **Description of the legitimate interest ★** | *(Only if basis = Legitimate interests.)* Explain the interest | *(n/a — we chose Consent)* |
| **Is providing data required?** | Is giving data mandatory or optional, and what happens if not given? | `Optional — nobody is forced to subscribe; not subscribing has no consequences` |

**The 6 lawful bases (Art. 6(1)) — pick exactly one:**

| Option | Art. | Use it when… |
|---|---|---|
| Consent | 6(1)(a) | The person ticked a box / agreed (newsletters, cookies, optional features) |
| Performance of a contract | 6(1)(b) | You need the data to deliver something they signed up for |
| Legal obligation | 6(1)(c) | A law forces you (payroll, tax, ZUS, keeping HR files) |
| Vital interests | 6(1)(d) | To protect someone's life (medical emergency) |
| Public interest / official task | 6(1)(e) | You perform a public/official duty |
| Legitimate interests | 6(1)(f) | Your reasonable business need (CCTV security, fraud prevention) — **must describe it** |

> **Quick rule of thumb:** Employees/payroll → *Legal obligation*.
> Newsletter/marketing → *Consent*. CCTV/security/fraud → *Legitimate interests*.
> Signed customer order → *Contract*.

---

### Step 3 — Data & Subjects
*Whose data, and what data?*

| Field | What it means | Example |
|---|---|---|
| **Categories of Data Subjects ★** | *Whose* data is it? (pick one or more chips) | `Customers`, `Website users` |
| **Categories of Personal Data ★** | *What* data? (pick one or more chips) | `Contact details (email, phone, address)` |
| **Art. 9 condition ★** | *(Appears only if you pick a sensitive category.)* The legal condition allowing sensitive data | *(n/a for newsletter)* |
| **Data Sources** | Where the data comes from | `Directly from the person (website sign-up form)` |

**Data-subject categories (chips):** Employees · Job candidates · Contractors (B2B) ·
Customers · Supplier contacts · Website users · Patients · Whistleblowers · Visitors (premises)

**Personal-data categories (chips):**
- Ordinary: Identification (name, PESEL, ID) · Contact (email, phone, address) ·
  Financial (salary, bank) · Employment (contract, evaluations) · Image / CCTV ·
  Location · Online identifiers (IP, cookies) · Children's data (Art. 8)
- **Sensitive — Art. 9 (picking any of these forces the Art. 9 condition step):**
  Health · Biometric (for ID) · Genetic · Racial/ethnic origin · Political opinions ·
  Religious/philosophical beliefs · Trade-union membership · Sex life · Sexual orientation
- **Criminal — Art. 10:** Criminal convictions / offences

> **Why the extra step appears:** sensitive (Art. 9) data is heavily protected.
> If you tick one, the law requires you to state *which special condition*
> (Art. 9(2)) allows it — e.g. `Employment / social security law` for health
> data in HR, or `Explicit consent`.

---

### Step 4 — Recipients & Processors
*Who else sees this data?* (Both are optional; leave empty if nobody.)

| Field | What it means | Example |
|---|---|---|
| **Categories of Recipients** | Groups you disclose data to | `IT service providers` |
| **Processors** | The specific outside companies doing the work for you (linked from the **Vendors** page) | `Mailchimp` |

**Recipient categories (chips):** Public authorities (ZUS, US, UODO) · Banks /
payment institutions · IT service providers · Payroll / accounting bureau ·
Legal advisors · Occupational medicine providers · Insurers · Postal / courier
operators · Group companies

> **Recipients vs Processors:** *Recipients* = broad groups who receive the data.
> *Processors* = named vendors who handle it on your behalf under an Art. 28
> contract (a DPA). They are kept as two separate fields on purpose.

---

### Step 5 — Third-country Transfers
*Does the data leave the EU/EEA?*

| Field | What it means | Example |
|---|---|---|
| **Third-country transfer** | Yes / No — does data go outside the EU/EEA? | `Yes` (if Mailchimp stores it in the USA) |
| **Linked transfer safeguard** | *(If Yes.)* Pick the safeguard record from the **Transfers** page | `SCC (Standard Contractual Clauses)` |

**Transfer mechanisms (from the Transfers page):** Adequacy decision (Art. 45) ·
Standard Contractual Clauses (Art. 46) · Binding Corporate Rules (Art. 47) ·
Art. 49 derogation.

> Personal data must stay in the EEA by default. Any transfer out needs a legal
> safeguard, which is why this step links to a dedicated Transfers record.

---

### Step 6 — Retention
*How long do you keep the data?*

| Field | What it means | Example |
|---|---|---|
| **Retention Period ★** | How long before you delete it | `Until the person unsubscribes / withdraws consent` |
| **Retention Basis** | The rule behind that period | `Consent withdrawn (Art. 6(1)(a))` |

More examples:
- HR & payroll → `10 years after employment ends` / basis: `Art. 94 pkt 9b Kodeksu pracy`
- CCTV → `Maximum 3 months from recording` / basis: `Art. 22(2) Kodeksu pracy`

---

### Step 7 — Security Measures (TOMs) ★
*How do you protect the data?* Tick **at least one** (Art. 32).

Available measures (chips):
Encryption at rest (AES-256) · Encryption in transit (TLS 1.3) · Pseudonymisation ·
Role-based access control · Multi-factor authentication · Regular encrypted
backups · Access logging & monitoring · Signed DPAs with all processors (Art. 28) ·
Staff data-protection training · Clean desk / physical security · Incident
response procedure · Automated retention enforcement · Vulnerability management /
pentesting · Anonymisation of analytics data.

**Newsletter example:** `Access control`, `Encryption in transit (TLS 1.3)`,
`Signed DPAs with all processors (Art. 28)`.

---

### Step 8 — DPIA Screening
*Is this risky enough to need a deep risk study?*

Tick any of the 12 risk criteria that apply. The app then **decides
automatically** — you don't set the verdict yourself.

**The 12 criteria (Polish UODO list, M.P. 2019 poz. 666):**
1. Evaluation or scoring, incl. profiling and predicting
2. Automated decision-making with legal or similar effect
3. Systematic large-scale monitoring of public places or employees
4. Special categories (Art. 9) or criminal data (Art. 10)
5. Biometric data solely to identify a person / control access
6. Genetic data
7. Large-scale processing (many subjects, volume, duration, geography)
8. Matching or combining datasets from different sources
9. Data of vulnerable people (employees, children, patients; incl. whistleblowing)
10. Innovative technological or organisational solutions
11. Processing that blocks a right or access to a service/contract
12. Location data (incl. employee location tracking)

**How the verdict is decided:**

| Criteria matched | Verdict |
|---|---|
| Falls under Art. 35(3) (special-category / large-scale monitoring cases) | **Required** (mandatory) |
| 2 or more | **Required** |
| Exactly 1 | **Recommended** (assess and document your decision) |
| 0 | **Not indicated** (re-screen if the processing changes) |

**Examples:** Newsletter → usually **Not indicated**. CCTV → criteria 3 + 9 →
**Required**. GPS fleet tracking → criteria 3 + 12 → **Required**.

---

### Step 9 — Review & Save
Nothing to type. Check everything looks right and click **Save / Create
Register**. A new row appears in the Register table, and the action is written to
the audit trail. ✅

---

## 4. Full worked example — Marketing newsletter

| Step | Field | Value |
|---|---|---|
| 1 | Activity Name | `Newsletter marketingowy` |
| 1 | Department | `Marketing` |
| 1 | Role | `Controller` |
| 2 | Purpose | `Sending monthly marketing newsletters to people who subscribed on our website` |
| 2 | Lawful Basis | `Consent (Art. 6(1)(a))` |
| 2 | Providing data required? | `Optional` |
| 3 | Data Subjects | `Customers`, `Website users` |
| 3 | Personal Data | `Contact details (email)` |
| 3 | Data Sources | `Directly from the person (website sign-up form)` |
| 4 | Recipients | `IT service providers` |
| 4 | Processors | `Mailchimp` |
| 5 | Third-country transfer | `Yes` → linked SCC safeguard |
| 6 | Retention Period | `Until consent is withdrawn (unsubscribe)` |
| 7 | Security (TOMs) | `Access control`, `TLS 1.3`, `Signed DPA (Art. 28)` |
| 8 | DPIA criteria | *(none)* → verdict **Not indicated** |
| 9 | — | Review → **Save** |

---

## 5. Notes for the backend team

- **Required fields** are enforced on steps 1, 2, 3, 6, 7 in `validateStep()`.
  Re-enforce the same validation **server-side** (never trust the frontend).
- The `art10` flag is derived automatically when `criminal` data is selected.
- The DPIA verdict is computed by `evaluateDpia()` — keep the same logic on the
  server so the register stays consistent.
- The option lists live in `src/lib/gdpr.js` and mirror the legal text; keep the
  backend enums in sync with that single source of truth.
