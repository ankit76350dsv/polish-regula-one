# PrivacyPilot — GDPR/RODO Legal Research (Poland/EU), verified against official sources

Research date: 2026-07-02. Method: deep-research fan-out (5 parallel agents) + direct verification. All claims verified against official sources only: EUR-Lex/EU Publications Office, EDPB, ec.europa.eu, UODO (uodo.gov.pl, orzeczenia.uodo.gov.pl), ISAP/Sejm ELI API (api.sejm.gov.pl), monitorpolski.gov.pl, biznes.gov.pl. Blogs used for nothing.

**Sourcing caveat (applies throughout):** `eur-lex.europa.eu` and `isap.sejm.gov.pl` block automated fetchers (WAF/CAPTCHA). GDPR text was verified **verbatim from the authentic Official Journal PDF (OJ L 119, 4.5.2016, p. 1–88)** served by the EU Publications Office cellar (`http://publications.europa.eu/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1.0006.01/DOC_1`, CELEX 32016R0679) — the same official publisher behind EUR-Lex. Polish acts were verified via the official Sejm ELI API (`api.sejm.gov.pl/eli/...`, the machine interface to ISAP) and monitorpolski.gov.pl PDFs. Canonical citation URLs (EUR-Lex ELI / ISAP) are given as citations of record.

---

## 1. ROPA — GDPR Article 30 (Records of Processing Activities)

Citation of record: https://eur-lex.europa.eu/eli/reg/2016/679/oj (CELEX 32016R0679). Verified verbatim from OJ L 119/50–51 via Publications Office cellar.

**Art 30(1) — controller register.** "Each controller and, where applicable, the controller's representative, shall maintain a record of processing activities under its responsibility. That record shall contain all of the following information:"
- (a) name and contact details of the controller and, where applicable, the joint controller, the controller's representative and the DPO;
- (b) the purposes of the processing;
- (c) a description of the categories of data subjects and of the categories of personal data;
- (d) the categories of recipients to whom the personal data have been or will be disclosed, including recipients in third countries or international organisations;
- (e) where applicable, transfers to a third country/international organisation, including its identification and, for Art 49(1) second-subparagraph transfers, the documentation of suitable safeguards;
- (f) where possible, the envisaged time limits for erasure of the different categories of data;
- (g) where possible, a general description of the technical and organisational security measures referred to in Article 32(1).

**Art 30(2) — processor register** ("record of all categories of processing activities carried out on behalf of a controller"):
- (a) name and contact details of the processor(s) and of each controller on behalf of which the processor acts, and, where applicable, of representatives and the DPO;
- (b) the categories of processing carried out on behalf of each controller;
- (c) transfers (identical wording to 30(1)(e));
- (d) general description of Art 32(1) security measures (identical to 30(1)(g)).

**Art 30(3):** "The records referred to in paragraphs 1 and 2 shall be **in writing, including in electronic form**."
**Art 30(4):** controller/processor (and representative) "shall **make the record available to the supervisory authority on request**."
**Art 30(5) — SME exemption (verbatim):** does not apply "to an enterprise or an organisation employing fewer than 250 persons **unless** the processing it carries out is likely to result in a **risk** to the rights and freedoms of data subjects, the processing is **not occasional**, **or** the processing includes special categories of data as referred to in Article 9(1) or personal data relating to criminal convictions and offences referred to in Article 10." Note: "a risk", not "a high risk". Recital 13 provides the SME context (derogation for organisations with fewer than 250 employees regarding record-keeping).

**WP29 Position Paper on Art 30(5) derogations (April 2018) — narrow reading.** Official PDF read in full: https://ec.europa.eu/newsroom/article29/redirection/document/51422 ; EDPB Endorsement 1/2018 (25 May 2018), item 9: https://www.edpb.europa.eu/sites/default/files/files/news/endorsement_of_wp29_documents_en_0.pdf ; EDPB page: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/position-paper-derogations-obligation-maintain-records_en
- "The derogation provided by Article 30(5) is **not absolute**."
- The three carve-outs "are **alternative ('or') and the occurrence of any one of them alone triggers the obligation** to maintain the record."
- Threshold is "a risk (**not just a high risk**)".
- Partial relief only: such organisations "need only maintain records of processing activities for the types of processing mentioned by Article 30(5)".
- "Occasional" (fn 1): only if "not carried out regularly, and occurs outside the regular course of business or activity".
- Worked example: "a small organisation is likely to regularly process data regarding its employees. As a result, such processing **cannot be considered 'occasional'** and must therefore be included in the record." (Employee data is the paper's explicit example; payroll/customer extrapolations are common but not verbatim.)
- WP29 encourages SAs to publish simplified SME register models.
- FLAG: the adoption date "19 April 2018" is reported on the EC newsroom listing/EDPB page but is not printed in the PDF body itself.

**UODO ROPA guidance and templates — YES, published.** Guidance PDF (16–17 pp., read in full): "Wskazówki i wyjaśnienia dotyczące obowiązku rejestrowania czynności i kategorii czynności przetwarzania określonego w art. 30 ust. 1 i 2 RODO" — https://uodo.gov.pl/pl/file/708 (also https://uodo.gov.pl/data/filemanager_pl/708.pdf); guidance page https://uodo.gov.pl/pl/383/214; template file https://uodo.gov.pl/pl/file/1491.
- Two example templates by the President of UODO: controller register (worked example: primary school — staff recruitment, employee/working-time records, ZUS filings, payroll, pupil recruitment/records, class register) and processor "register of categories" (e.g. hosted e-commerce, HR-recruitment platform, payroll-system support).
- Templates expressly **not the only correct model**; any layout is acceptable if all Art 30(1)/(2) elements are presented clearly.
- **Optional extra fields UODO suggests** (product schema candidates): legal basis of processing, data source, IT system/software used, DPIA information, "process owners" (responsible persons), contact details of processors and sub-processors (Art 28(4)); UODO notes Belgian and UK SAs recommend extended registers.
- Form: written, paper or electronic (Art 30(3)); controller/DPO details may appear once on a title page; "czynność przetwarzania" = set of related operations grouped by purpose.
- FLAG: uodo.gov.pl was restructured; some old URLs (/pl/123/214, /pl/341/3516) 404. The file/708 PDF and /pl/383/214 page are live.

---

## 2. DPIA — GDPR Articles 35–36 + Polish mandatory list

GDPR text verified verbatim (OJ L 119 via Publications Office cellar); citation of record https://eur-lex.europa.eu/eli/reg/2016/679/oj

- **Art 35(1):** where a type of processing "in particular using new technologies … is likely to result in a high risk to the rights and freedoms of natural persons, the controller shall, **prior to the processing**, carry out an assessment of the impact…". One assessment may cover a set of similar operations.
- **Art 35(3):** DPIA in particular required for: (a) systematic and extensive evaluation of personal aspects based on automated processing, including profiling, on which decisions with legal or similarly significant effects are based; (b) large-scale processing of Art 9(1) special categories or Art 10 criminal data; (c) systematic monitoring of a publicly accessible area on a large scale.
- **Art 35(4):** each SA "shall establish and make public a list" of operations requiring DPIA (blacklist), communicated to the EDPB; 35(5) optional whitelist; 35(6) consistency mechanism for cross-border-relevant lists.
- **Art 35(7):** minimum contents: (a) systematic description of operations and purposes (incl. legitimate interest where applicable); (b) necessity/proportionality assessment; (c) risk assessment to data subjects' rights; (d) measures envisaged to address risks (safeguards, security measures, mechanisms to demonstrate compliance).
- **Art 35(11):** review "at least when there is a change of the risk".
- **Art 36(1):** prior consultation of the SA "where a data protection impact assessment under Article 35 indicates that the processing would result in a high risk in the absence of measures taken by the controller to mitigate the risk" (36(2): SA advice within 8 weeks + 6 extension).

**Polish mandatory-DPIA list (current):** Komunikat Prezesa UODO z dnia 17 czerwca 2019 r. w sprawie wykazu rodzajów operacji przetwarzania danych osobowych wymagających oceny skutków przetwarzania dla ich ochrony — **M.P. 2019 poz. 666** (published 8 July 2019; legal basis art. 54 ust. 1 pkt 1 of the Act of 10 May 2018 in conjunction with Art 35(4) and (6) GDPR; signed J. Nowak).
- Official PDF (full text extracted): http://monitorpolski.gov.pl/M2019000066601.pdf ; page https://monitorpolski.gov.pl/MP/2019/666 ; ISAP record https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WMP20190000666 ; metadata verified via https://api.sejm.gov.pl/eli/acts/MP/2019/666
- Point 2 **expressly repeals** the list in the Komunikat of 17 August 2018 (**M.P. 2018 poz. 827**), which had not covered cross-border offering of goods/services or behaviour monitoring in several Member States (i.e. reissued after the Art 35(6)/EDPB consistency procedure). (ISAP metadata still shows the 2018 act "in force" — the repeal is in the 2019 operative text itself.)
- **How it works (annex preamble, verified):** built on WP248 and "supplements and concretises" it; "**as a rule, processing meeting at least two of the criteria below will require a DPIA**", but one criterion may suffice in some cases; the more criteria met, the more likely high risk. Three-column table: (I) type/criterion; (II) potential areas of application; (III) examples — columns II–III expressly illustrative and non-exhaustive. The list does not displace the general Art 35(1) duty.
- **The 12 categories (translated):**
  1. Evaluation or assessment, incl. profiling and prediction (behavioural analysis), for purposes with negative legal/physical/financial effects or other inconvenience (social-media/marketing profiling, AI credit scoring, insurer lifestyle premium optimisation, indirect group-based profiling);
  2. Automated decision-making with legal, financial or similarly significant effects (section speed control/viaTOLL vehicle ID, automated profile-based pricing, loyalty-programme purchase monitoring);
  3. Large-scale systematic monitoring of publicly accessible places using recognition of features/properties of objects (excludes plain CCTV used only for incident analysis) — incl. workplace monitoring of e-mail/software/access cards and working time, IoT wearables, V2X, RFID attributable to persons;
  4. Processing of Art 9 special categories and Art 10 criminal-conviction data ("sensitive data") — health/clinical data, political affiliation/electoral preferences, smart-metering lifestyle observation, personal cloud/e-mail/life-logging services;
  5. Biometric data processed solely to identify a person or for access control (face/voice/fingerprint, workplace entry, banking/ATM verification, fitness clubs, hotels);
  6. Genetic data (genetic diagnostics, DNA tests, medical research);
  7. Large-scale processing (factors: number of data subjects, scope, retention period, geographical extent) — central public registers, social networks, browsers, cable/streaming viewing histories;
  8. Comparing, evaluating or inferring from data from different sources (matching/combining datasets; data brokers; combining public registers; profiles from browsing+banking+shopping);
  9. Processing data of persons whose evaluation and services depend on entities with supervisory/evaluative powers — job-matching platforms and **explicitly: whistleblowing systems ("systemy służące do zgłaszania nieprawidłowości"), in particular processing employee data** (corruption, mobbing);
  10. Innovative use or application of technological or organisational solutions (smart meters enabling profiling, IoT metadata/GPS photos, beacons/drones, wearables, devices with mic/camera interfaces, interactive toys for children, cross-border telemedicine/clinical trials);
  11. Processing which in itself prevents data subjects from exercising a right or using a service or contract (credit decisions from debtor databases; conditioning service on profiled income data);
  12. Location data (IoT devices/apps, remote/home-work contexts, employee location tracking, communications-network position of user terminals).

**WP248 rev.01 (EDPB-endorsed) — verified.** "Guidelines on Data Protection Impact Assessment (DPIA)…", adopted 4 Apr 2017, last revised 4 Oct 2017. Page: https://ec.europa.eu/newsroom/article29/items/611236 ; PDF (read): https://ec.europa.eu/newsroom/just/document.cfm?doc_id=47711 ; endorsement: https://www.edpb.europa.eu/our-work-tools/general-guidance/endorsed-wp29-guidelines_en (Endorsement 1/2018).
- Nine criteria: (1) evaluation or scoring incl. profiling/predicting; (2) automated decision-making with legal or similar significant effect; (3) systematic monitoring; (4) sensitive data or data of a highly personal nature; (5) large scale (number of subjects, volume/range, duration, geography); (6) matching or combining datasets; (7) vulnerable data subjects (children, employees, patients…); (8) innovative use or new technological/organisational solutions; (9) processing preventing exercise of a right/service/contract.
- Rule of thumb (verbatim): "In most cases, a data controller can consider that a processing meeting **two criteria** would require a DPIA…However, in some cases…only one of these criteria" suffices. WP248's own example flags systematic employee monitoring (criteria 3+7) as DPIA-likely.

**UODO DPIA guidance:** https://uodo.gov.pl/pl/598/3617 ("Kiedy trzeba przeprowadzić ocenę skutków dla ochrony danych?", 31 Mar 2025) restates Art 35(1), the M.P. 2019 poz. 666 list and the two-criteria rule. Art 36 prior-consultation page: uodo.gov.pl/500 (existence per search; content not fetched — FLAG).

---

## 3. Transparency — GDPR Articles 12–14 (privacy notices)

Verified verbatim from OJ L 119 (pp. 39–43) via Publications Office cellar; citation https://eur-lex.europa.eu/eli/reg/2016/679/oj

- **Art 12(1):** information must be provided "in a concise, transparent, intelligible and easily accessible form, using clear and plain language", esp. for children; "in writing, or by other means, including, where appropriate, by electronic means"; orally on request with identity proven. **Art 12(5):** free of charge. Art 12(7): standardised icons possible.
- **Art 13 (data collected FROM the data subject; at the time of collection).** 13(1): (a) controller (and representative) identity/contact; (b) DPO contact where applicable; (c) purposes AND legal basis; (d) legitimate interests where Art 6(1)(f); (e) recipients or categories of recipients; (f) third-country transfer intention + adequacy decision existence/absence or Art 46/47/49(1)-2nd-subpara safeguards and how to obtain a copy. 13(2): (a) storage period or criteria; (b) rights of access, rectification, erasure, restriction, objection, portability; (c) right to withdraw consent; (d) right to complain to an SA; (e) whether provision is statutory/contractual requirement + consequences of failure; (f) existence of automated decision-making incl. profiling + meaningful information about the logic, significance and envisaged consequences. 13(3): inform before further processing for a new purpose. 13(4): not where the data subject already has the information.
- **Art 14 (data NOT obtained from the data subject).** 14(1)(a)–(f): as 13(1) plus **(d) categories of personal data concerned**. 14(2)(a)–(g): storage period/criteria; legitimate interests; rights; consent withdrawal; complaint to SA; **(f) source of the data and whether publicly accessible sources**; automated decision-making + logic. **14(3) timing:** (a) within a reasonable period, at the latest **one month**; (b) at the latest at first communication with the data subject; (c) at the latest at first disclosure to another recipient. **14(5) exceptions:** (a) already has it; (b) impossible/disproportionate effort (esp. Art 89(1) contexts) — with protective measures incl. making information publicly available; (c) obtaining/disclosure expressly laid down by Union/Member State law with appropriate protections; (d) statutory professional secrecy.
- **Structural point:** GDPR **does not mandate a single "privacy policy" document** — it mandates *providing* the Art 13/14 information via Art 12(1) modalities. A website privacy policy is one delivery mechanism covering website-visitor processing; **separate tailored notices are needed per processing context** (employees, job candidates, contractors, whistleblowing reporters), because content (purposes, legal bases, recipients, retention) differs. Supported by WP29 Transparency Guidelines **WP260 rev.01** (adopted 29 Nov 2017, rev. 11 Apr 2018; EDPB Endorsement 1/2018 item 2): layered notices recommended (para 35); electronic privacy statement appropriate for online presence but possibly not sufficient alone (para 40). Page: https://ec.europa.eu/newsroom/article29/items/622227 ; PDF: https://ec.europa.eu/newsroom/article29/redirection/document/51025

---

## 4. DPO — GDPR Articles 37–39 + Polish notification specifics

GDPR (OJ L 119/55–56, verified):
- **Art 37(1) mandatory designation:** (a) processing by a **public authority or body** (except courts in judicial capacity); (b) core activities require **regular and systematic monitoring of data subjects on a large scale**; (c) core activities consist of **large-scale processing of Art 9 special categories or Art 10 criminal data**. 37(2) group DPO if easily accessible; 37(4) also where required by Member State law; **37(5)** professional qualities, expert knowledge of data protection law/practice; 37(6) employee or service contract; **37(7)** "publish the contact details of the data protection officer and communicate them to the supervisory authority".
- **Art 38:** timely involvement; resources; independence — no instructions, no dismissal/penalty for performing tasks; reports to highest management; data-subject contact point; confidentiality; conflict-of-interest rule.
- **Art 39(1) tasks:** inform/advise; monitor compliance (incl. audits, training); advise on and monitor DPIAs; cooperate with SA; SA contact point (incl. Art 36). WP243 rev.01 DPO guidelines (EDPB-endorsed): https://ec.europa.eu/newsroom/article29/items/612048

**Polish Act of 10 May 2018 (Dz.U. 2018 poz. 1000) — verified verbatim from the official consolidated text** (ISAP record https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20180001000 ; consolidated PDF https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20180001000/U/D20181000Lj.pdf ; verified via api.sejm.gov.pl/eli/acts/DU/2018/1000):
- **Art. 8:** DPO designation per GDPR Art 37 (no additional Polish triggers for private entities).
- **Art. 9:** "public authorities and bodies" (Art 37(1)(a)) = public-finance-sector units, research institutes, Narodowy Bank Polski.
- **Art. 10(1):** notify the President of UODO of DPO designation **within 14 days**, giving the DPO's **first name, surname and e-mail address or telephone number**. 10(2): proxy allowed (electronic power of attorney attached). 10(3): notifying entity's identifying data + REGON. **10(4): every change and dismissal — within 14 days.** 10(5): each entity of a group/public cluster notifies separately. **10(6): electronic form ONLY, with qualified electronic signature or ePUAP trusted-profile signature.**
- **Art. 11:** publish the DPO's name + e-mail/phone **immediately after designation on the entity's website**; if no website, in a generally accessible manner at the place of business. (Art. 11a: deputy DPO — same notification/publication regime.)
- UODO guidance: https://uodo.gov.pl/pl/499/2443 ("the only valid and effective way to notify is electronic"); e-service: https://www.biznes.gov.pl/pl/portal/ou871 (14 days, qualified signature/Profil Zaufany, free; 17 PLN stamp duty for power of attorney); dismissal/new DPO https://www.biznes.gov.pl/pl/portal/ou876
- Product implication: PrivacyPilot should track DPO designation dates, 14-day notification deadlines (designation/change/dismissal), and website-publication compliance.

---

## 5. Polish national framework, fines, enforcement

- **Act of 10 May 2018 o ochronie danych osobowych** (Dz.U. 2018 poz. 1000; in force 25 May 2018; consolidated text current; amended incl. Dz.U. 2018/1669, 2019/730, 2026/252, 2026/548). Establishes **Prezes Urzędu Ochrony Danych Osobowych (UODO)** as supervisory authority replacing GIODO — Art. 34(1)–(2) (verbatim verified). Chapters: DPO notification (Arts 8–11a), certification/accreditation, codes of conduct, proceedings (single-instance), inspections, civil liability, fines and criminal provisions.
  - **Art. 102 fine caps for public entities:** up to **100,000 PLN** (public-finance units per Art 9 pts 1–12, 14 of the Public Finance Act; research institutes; NBP); up to **10,000 PLN** for cultural institutions (Art 9 pt 13); imposed on Art 83 GDPR conditions. Real-world confirmation: Minister of Digitization fined exactly 100,000 PLN (2020 postal-election case; https://uodo.gov.pl/pl/138/4093).
  - **Art. 107 criminal:** unlawful processing — fine, restriction of liberty or imprisonment up to 2 years; up to 3 years for special-category data. **Art. 108:** obstructing an inspection — up to 2 years.
- **Sectoral implementation act:** Ustawa z 21 lutego 2019 r. (Dz.U. 2019 poz. 730, in force 4 May 2019; https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20190000730) — amended ~160 sectoral statutes incl. Labour Code Art 22¹ (candidate/employee data catalogues). FLAG: exact count and Art 22¹ wording not re-verified from the act text this session.
- **GDPR Art 83 tiers:** Art 83(4)(a) — up to **EUR 10M / 2%** worldwide turnover for infringements of controller/processor obligations under "Articles 8, 11, **25 to 39**, 42 and 43" → **Art 30 (ROPA) and Art 35 (DPIA) violations sit in the lower tier**; Art 83(5) — up to **EUR 20M / 4%** for basic principles (Arts 5, 6, 7, 9), data-subject rights (Arts 12–22), transfers (Arts 44–49), Chapter IX national-law obligations, non-compliance with SA orders (also 83(6)). Tier placement additionally confirmed in UODO's own decision materials (Toyota Bank case).
- **Enforcement — ROPA/DPIA-specific (verified on official sources):**
  - **Toyota Bank Polska S.A. — decision DKN.5112.14.2022 of 18 Dec 2024** (entity anonymized "C. S.A." in text; identified in UODO communications). Violations: **Art 30(1)** (creditworthiness profiling not recorded as a distinct activity in the ROPA) + **Art 35(1) and (7)** (no DPIA for the profiling) → fine **314,302 PLN**; plus Art 38(3) (DPO subordination) → 261,918 PLN; total 576,220 PLN (~EUR 135k; non-final at publication). Sources: https://uodo.gov.pl/decyzje/DKN.5112.14.2022 ; full text https://orzeczenia.uodo.gov.pl/document/urn:ndoc:gov:pl:uodo:2022:dkn_5112_14/content — **the key Polish precedent that a deficient register + missing DPIA are independently finable.**
  - Virgin Mobile Polska, DKN.5112.1.2020 (3 Dec 2020), 1,968,524 PLN — Arts 5(1)(f), 5(2), 25(1), 32 (risk testing only incidental, not regular) — https://orzeczenia.uodo.gov.pl/document/urn:ndoc:gov:pl:uodo:2020:dkn_5112_1/content
  - Fortum Marketing and Sales Polska + processor PIKA, DKN.5130.2215.2020 (19 Jan 2022), 4,911,732 PLN + 250,135 PLN — Arts 5(1)(f), 25(1), 28(1), 32 — https://www.uodo.gov.pl/decyzje/DKN.5130.2215.2020 (FLAG: reported later WSA annulment not verified officially).
  - Morele.net (Sep 2019), 2,830,410 PLN (~EUR 645k), Art 32 sphere — https://www.edpb.europa.eu/news/national-news/2019/polish-dpa-imposes-eu645000-fine-insufficient-organisational-and-technical_en (FLAG: later NSA annulment/re-decision not verified officially).
- UODO publishes decisions at uodo.gov.pl/decyzje/{case} and the searchable https://orzeczenia.uodo.gov.pl; breach notification to UODO is via electronic form (https://uodo.gov.pl/525).

---

## 6. Adjacent obligations (verified verbatim from OJ L 119)

- **Art 33 breach notification:** to the SA "without undue delay and, where feasible, not later than **72 hours** after having become aware", unless unlikely to result in a risk; reasons required for delay; processor notifies controller without undue delay (33(2)); content 33(3)(a)–(d) (nature incl. categories/approx. numbers; DPO/contact; likely consequences; measures taken/proposed); phased provision allowed (33(4)). **Art 33(5) breach register: "The controller shall document any personal data breaches"** (facts, effects, remedial action) — all breaches, including non-notifiable ones — "shall enable the supervisory authority to verify compliance".
- **Art 34:** communication to data subjects "without undue delay" where **high risk**; clear and plain language with 33(3)(b)–(d) content; exceptions 34(3)(a)–(c) (e.g. encryption; subsequent measures; disproportionate effort → public communication); SA may compel (34(4)).
- **Data subject rights, Arts 12(3)/(5), 15–22:** respond "without undue delay and in any event within **one month**"; extendable by **two further months** for complex/numerous requests with notice within one month; refusals explained within one month with complaint/remedy info (12(4)); free of charge, fee/refusal only for manifestly unfounded/excessive requests with burden of proof on controller (12(5)). Rights: access + copy (15, 15(3)), rectification (16), erasure (17), restriction (18), portability (20), objection (21), automated decision-making incl. profiling (22).
- **Art 28 processor contracts:** processing by a processor "shall be governed by a contract or other legal act" fixing subject-matter, duration, nature, purpose, data types, data-subject categories, controller rights/obligations; mandatory clauses **28(3)(a)–(h)**: (a) documented instructions incl. transfers; (b) confidentiality commitments; (c) Art 32 security measures; (d) sub-processor conditions per 28(2)/(4) (prior specific/general written authorisation, objection right, flow-down, full liability); (e) assist with data-subject rights; (f) assist with Arts 32–36; (g) delete or return at end of services; (h) provide compliance information and allow/contribute to **audits, including inspections** + duty to flag unlawful instructions. **Commission Implementing Decision (EU) 2021/915** (4 June 2021) provides Art 28(7) SCCs fulfilling Art 28(3)-(4): https://eur-lex.europa.eu/eli/dec_impl/2021/915/oj
- **Chapter V transfers:** Art 44 general principle (incl. onward transfers); Art 45 adequacy — current list (Commission page, checked 2026-07-02): Andorra, Argentina, Brazil, Canada (commercial), Faroe Islands, Guernsey, Israel, Isle of Man, Japan, Jersey, New Zealand, Republic of Korea, Switzerland, United Kingdom (renewed Dec 2025), USA (EU-US Data Privacy Framework participants only), Uruguay, European Patent Organisation — https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/adequacy-decisions_en ; Art 46 appropriate safeguards incl. Commission SCCs (Art 46(2)(c)) — **Implementing Decision (EU) 2021/914** (4 June 2021): https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj ; Art 49 derogations. **Schrems II (C-311/18) / transfer impact assessments:** verified via **EDPB Recommendations 01/2020** v2.0 (18 June 2021) — six-step roadmap; assessment must be documented and made "available to the competent supervisory authority upon request" — https://www.edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en
- **Accountability, Art 5(2) + 24(1):** "The controller shall be responsible for, and be able to demonstrate compliance with, paragraph 1 ('accountability')"; Art 24(1) requires measures "to ensure and to be able to demonstrate" compliance, reviewed and updated. Because SAs can demand evidence (30(4), 33(5), 58(1)), undocumented compliance is legally indistinguishable from non-compliance — documentation (ROPA, breach register, DPIAs, DPAs, TIAs, DSAR logs, notices) is the statutory mechanism of demonstrable compliance.

---

## 7. Market validation

- **ROPA is a hard legal obligation for both controllers (30(1)) and processors (30(2))**, backed by Art 83(4)(a) fines (up to EUR 10M/2%) and a live Polish enforcement precedent (Toyota Bank: 314,302 PLN specifically for ROPA + DPIA failures).
- **The Art 30(5) SME exemption is practically hollow** (WP29, EDPB-endorsed): carve-outs are alternatives; regular employee/HR processing alone is "not occasional"; risk threshold is plain "risk". Virtually every operating business — including <250-employee SMEs — must keep at least a partial ROPA; the exemption only trims occasional, low-risk, non-Art-9/10 activities.
- **Public bodies:** always need a DPO (Art 37(1)(a); Polish Art 9 defines the catalogue), get no practical 30(5) relief, and face Polish-specific caps (Art 102: 100k/10k PLN) — a distinct customer segment with the 14-day UODO DPO-notification workflow.
- **DPIA has a national statutory trigger list in Poland** (M.P. 2019 poz. 666, 12 categories incl. whistleblowing systems, employee monitoring, location data, biometrics, innovative tech) + WP248's 2-of-9-criteria rule — highly automatable as a detection questionnaire. Art 36 prior consultation is the escalation path.
- **Adjacent documentation surfaces with legal drivers:** breach register (33(5)), 72h notification workflow (33(1)), DSAR deadline tracking (12(3)), Art 28 DPA contents/2021-915 SCCs, transfer mapping + TIA documentation (Ch. V, EDPB Rec 01/2020), accountability evidence (5(2)/24(1)).
- Net: a ROPA/DPIA/notice documentation product addresses obligations that are mandatory, fined in practice in Poland, and specific enough (UODO templates, Monitor Polski list, 14-day DPO rule) to build differentiated Poland-first features.

## Could-not-verify flags (consolidated)
1. EUR-Lex and ISAP direct pages bot-blocked — content verified via EU Publications Office cellar (OJ PDF) and Sejm ELI API/monitorpolski.gov.pl (authentic official alternates).
2. WP29 position paper adoption date (19 Apr 2018) not printed in the PDF body (EC newsroom listing/EDPB page provide it).
3. 2018 Polish DPIA list annex contents (M.P. 2018 poz. 827) not fetched — superseded; existence/date/repeal verified from the 2019 text.
4. Fortum fine's reported WSA annulment and Morele.net NSA annulment/re-decision — secondary sources only.
5. Dz.U. 2019 poz. 730: "~160 statutes" count and Labour Code Art 22¹ wording not re-verified from the act text.
6. UODO Art-36 prior-consultation page (uodo.gov.pl/500) and an alleged Aug-2025 UODO DPIA guidance update — existence per search only, content not fetched.
7. Schrems II verified via EDPB Recommendations 01/2020 text, not a direct curia.europa.eu fetch.
