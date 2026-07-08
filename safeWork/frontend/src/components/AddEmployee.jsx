import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchEmployees,
  upsertProfile,
  clearSubmitError,
} from "../store/slices/employeeSlice";

// ─── Constants ────────────────────────────────────────────────────────────────
// List of company departments an employee can belong to.
// These cover the common departments found in industrial, manufacturing,
// warehouse and logistics companies (the industries this app serves).
//
// NOTE ON COMPLIANCE: Unlike job roles (KZiS) and contract types (Kodeks pracy),
// company departments are NOT defined by any Polish government standard — a
// company organises its own internal structure. So these are sensible industry
// names, shown BILINGUALLY (Polish / English) to match the Polish-market UI.
//
// Each item has:
//   value -> the text we SAVE (kept exactly as the original English name, so
//            employees saved before this change still match — backward compatible)
//   label -> the text we SHOW in the dropdown ("Polish / English")
const DEPARTMENTS = [
  { value: "Warehouse",              label: "Magazyn / Warehouse" },
  { value: "Operations",             label: "Operacje / Operations" },
  { value: "Manufacturing",          label: "Wytwarzanie / Manufacturing" },
  { value: "Production",             label: "Produkcja / Production" },
  { value: "Logistics",              label: "Logistyka / Logistics" },
  { value: "Supply Chain",           label: "Łańcuch dostaw / Supply Chain" },
  { value: "Procurement",            label: "Zakupy / Procurement" },
  { value: "Transport",              label: "Transport" },
  { value: "Distribution",           label: "Dystrybucja / Distribution" },
  { value: "Maintenance",            label: "Utrzymanie ruchu / Maintenance" },
  { value: "Engineering",            label: "Inżynieria / Engineering" },
  { value: "Quality Assurance",      label: "Zapewnienie jakości / Quality Assurance" },
  { value: "Quality Control",        label: "Kontrola jakości / Quality Control" },
  { value: "Research & Development", label: "Badania i rozwój / R&D" },
  { value: "Health & Safety (BHP)",  label: "BHP / Health & Safety" },
  { value: "Environmental",          label: "Ochrona środowiska / Environmental" },
  { value: "Facilities",             label: "Obsługa obiektu / Facilities" },
  { value: "Admin",                  label: "Administracja / Admin" },
  { value: "HR",                     label: "Kadry / HR" },
  { value: "IT",                     label: "Informatyka / IT" },
  { value: "Finance",                label: "Finanse / Finance" },
  { value: "Accounting",             label: "Księgowość / Accounting" },
  { value: "Legal",                  label: "Dział prawny / Legal" },
  { value: "Compliance",             label: "Zgodność / Compliance" },
  { value: "Sales",                  label: "Sprzedaż / Sales" },
  { value: "Marketing",              label: "Marketing" },
  { value: "Customer Service",       label: "Obsługa klienta / Customer Service" },
  { value: "Security",               label: "Ochrona / Security" },
  { value: "Training & Development", label: "Szkolenia i rozwój / Training & Development" },
  { value: "Project Management",     label: "Zarządzanie projektami / Project Management" },
];

// Job roles (positions) an employee can have.
//
// These are the OFFICIAL Polish job titles from KZiS — "Klasyfikacja Zawodów
// i Specjalności na potrzeby rynku pracy" (Classification of Occupations and
// Specialties), maintained by the Ministry of Family, Labour and Social
// Policy. Each entry shows the official Polish name plus its 6-digit KZiS code,
// e.g. "Magazynier — KZiS 432103". Using official codes makes the data ready
// for government reporting (GUS, ZUS) and audits.
//
// The list is grouped by department (English comments) only to stay readable —
// it is still ONE flat list because the position dropdown shows every role and
// the user can just type to search by name or by code.
//
// Legal source: KZiS, consolidated text Dz.U. 2018 poz. 227 with later
// amendments (Dz.U. 2021 poz. 2285; 2022 poz. 853; 2024 poz. 1372).
// Portal: https://psz.praca.gov.pl (Public Employment Services) and
// https://klasyfikacje.stat.gov.pl/Kzis (GUS).
const JOB_ROLES = [
  // ── Management & Directors (KZiS major group 1) ──
  "Dyrektor generalny — KZiS 112007",
  "Dyrektor operacyjny — KZiS 112011",
  "Dyrektor produkcji — KZiS 112012",
  "Dyrektor finansowy — KZiS 112006",
  "Dyrektor handlowy — KZiS 112008",
  "Dyrektor marketingu — KZiS 112010",
  "Dyrektor logistyki — KZiS 112009",
  "Dyrektor do spraw informatyki / informacji — KZiS 112004",
  "Dyrektor do spraw badawczo-rozwojowych — KZiS 112002",
  "Dyrektor do spraw administracyjnych — KZiS 112001",
  "Dyrektor departamentu — KZiS 121301",
  // ── Department managers (Kierownicy) ──
  "Kierownik produkcji w przemyśle — KZiS 132103",
  "Kierownik do spraw kontroli jakości — KZiS 132102",
  "Kierownik działu logistyki — KZiS 132401",
  "Kierownik magazynu — KZiS 132404",
  "Kierownik działu zakupów — KZiS 132403",
  "Kierownik utrzymania ruchu — KZiS 132105",
  "Główny księgowy — KZiS 121101",
  "Kierownik działu finansowego — KZiS 121103",
  "Kierownik działu kadr i płac — KZiS 121201",
  "Kierownik działu zarządzania zasobami ludzkimi — KZiS 121203",
  "Kierownik działu szkoleń — KZiS 121202",
  "Kierownik działu informatyki — KZiS 133001",
  "Kierownik do spraw sprzedaży — KZiS 122102",
  "Kierownik do spraw marketingu — KZiS 122101",
  "Kierownik do spraw rozwoju produktu — KZiS 122301",
  "Kierownik działu badawczo-rozwojowego — KZiS 122302",
  "Kierownik projektu — KZiS 121904",
  "Kierownik działu administracyjno-gospodarczego — KZiS 121901",
  "Kierownik agencji ochrony mienia i osób — KZiS 134903",
  // ── Warehouse (Magazyn) ──
  "Magazynier — KZiS 432103",
  "Magazynier-logistyk — KZiS 432106",
  "Robotnik magazynowy — KZiS 933304",
  "Kierowca operator wózków jezdniowych (widłowych) — KZiS 834401",
  "Wydawca materiałów — KZiS 932914",
  // ── Logistics & Forwarding (Logistyka / Spedycja) ──
  "Specjalista do spraw logistyki — KZiS 242108",
  "Pracownik działu logistyki — KZiS 333104",
  "Technik logistyk — KZiS 333107",
  "Spedytor — KZiS 333105",
  "Technik spedytor — KZiS 333108",
  "Dyspozytor transportu samochodowego — KZiS 432302",
  "Ekspedytor — KZiS 432303",
  "Inżynier zaopatrzenia, transportu i magazynowania — KZiS 214104",
  // ── Transport (Kierowcy) ──
  "Kierowca samochodu ciężarowego — KZiS 833203",
  "Kierowca ciągnika siodłowego — KZiS 833202",
  "Kierowca samochodu dostawczego — KZiS 832202",
  "Kierowca samochodu osobowego — KZiS 832203",
  "Kierowca autobusu — KZiS 833101",
  // ── Procurement (Zakupy / Zaopatrzenie) ──
  "Specjalista do spraw zamówień publicznych — KZiS 242225",
  "Agent do spraw zakupów — KZiS 332301",
  "Zaopatrzeniowiec — KZiS 332302",
  // ── Production & Manufacturing (Produkcja) ──
  "Mistrz produkcji w przemyśle elektromaszynowym — KZiS 312203",
  "Mistrz produkcji w przemyśle samochodowym — KZiS 312207",
  "Operator zautomatyzowanej linii produkcyjnej — KZiS 313904",
  "Operator robotów i manipulatorów przemysłowych — KZiS 313903",
  "Monter maszyn i urządzeń przemysłowych — KZiS 821105",
  "Monter maszyn elektrycznych — KZiS 821204",
  "Monter wiązek elektrycznych — KZiS 821207",
  "Pomocniczy robotnik przemysłowy — KZiS 932911",
  "Pakowacz ręczny — KZiS 932101",
  "Sortowacz — KZiS 932913",
  // ── Maintenance & Trades (Utrzymanie ruchu / rzemiosło) ──
  "Ślusarz — KZiS 722204",
  "Ślusarz narzędziowy — KZiS 722206",
  "Spawacz — KZiS 721204",
  "Elektryk — KZiS 741103",
  "Elektromonter instalacji elektrycznych — KZiS 741101",
  "Elektromonter (elektryk) zakładowy — KZiS 741207",
  "Technik utrzymania ruchu — KZiS 311514",
  "Konserwator budynków i stanu technicznego pomieszczeń — KZiS 711101",
  "Pomocnik mechanika — KZiS 932908",
  // ── Engineering (Inżynierowie) ──
  "Inżynier mechanik – maszyny i urządzenia przemysłowe — KZiS 214404",
  "Inżynier mechanik – technologia mechaniczna — KZiS 214407",
  "Inżynier elektryk — KZiS 215103",
  "Inżynier utrzymania ruchu — KZiS 214103",
  "Główny technolog — KZiS 214111",
  "Technik mechanik maszyn i urządzeń — KZiS 311508",
  "Technik elektryk — KZiS 311303",
  // ── Quality (Kontrola jakości) ──
  "Specjalista kontroli jakości — KZiS 214109",
  "Kontroler jakości wyrobów przemysłowych — KZiS 311937",
  "Kontroler jakości połączeń spawalniczych — KZiS 311517",
  // ── Health & Safety (BHP) ──
  "Specjalista bezpieczeństwa i higieny pracy — KZiS 229103",
  "Inspektor bezpieczeństwa i higieny pracy — KZiS 325502",
  "Technik bezpieczeństwa i higieny pracy — KZiS 325509",
  "Inspektor ochrony przeciwpożarowej — KZiS 311214",
  // ── Environmental (Ochrona środowiska) ──
  "Specjalista ochrony środowiska — KZiS 213303",
  "Inspektor ochrony środowiska — KZiS 325504",
  "Operator maszyn i urządzeń w gospodarce odpadami — KZiS 313211",
  "Operator spalarni odpadów komunalnych — KZiS 313206",
  // ── HR & Payroll (Kadry i płace) ──
  "Specjalista do spraw kadr — KZiS 242307",
  "Specjalista do spraw rekrutacji pracowników — KZiS 242309",
  "Specjalista do spraw wynagrodzeń — KZiS 242310",
  "Pracownik obsługi płacowej — KZiS 431301",
  // ── Training & Development (Szkolenia) ──
  "Specjalista do spraw szkoleń — KZiS 242403",
  // ── IT ──
  "Informatyk — KZiS 251106",
  "Programista aplikacji — KZiS 251401",
  "Programista aplikacji mobilnych — KZiS 251402",
  "Specjalista do spraw rozwoju oprogramowania — KZiS 251202",
  "Specjalista do spraw jakości oprogramowania — KZiS 251404",
  "Tester oprogramowania komputerowego — KZiS 251903",
  "Administrator baz danych — KZiS 252101",
  "Administrator systemów komputerowych — KZiS 252201",
  "Inżynier systemów i sieci komputerowych — KZiS 252302",
  "Specjalista bezpieczeństwa oprogramowania — KZiS 252901",
  // ── Finance & Accounting (Finanse i księgowość) ──
  "Specjalista do spraw rachunkowości — KZiS 241103",
  "Specjalista do spraw rachunkowości podatkowej — KZiS 241105",
  "Kontroler finansowy — KZiS 241107",
  "Analityk finansowy — KZiS 241306",
  "Ekonomista — KZiS 263102",
  // ── Legal, Compliance & Data protection (RODO/GDPR) ──
  "Inspektor ochrony danych — KZiS 242111",
  "Inspektor ochrony danych osobowych — KZiS 242212",
  "Specjalista ochrony informacji niejawnych — KZiS 242110",
  "Sekretarka w kancelarii prawnej — KZiS 334201",
  // ── Sales, Marketing & Customer Service ──
  "Przedstawiciel handlowy — KZiS 332203",
  "Sprzedawca — KZiS 522301",
  "Specjalista do spraw marketingu i handlu — KZiS 243106",
  "Pracownik centrum elektronicznej obsługi klienta — KZiS 332202",
  "Pracownik obsługi klienta instytucji finansowej — KZiS 331203",
  // ── Security (Ochrona osób i mienia) ──
  "Pracownik ochrony fizycznej — KZiS 541307",
  "Technik ochrony fizycznej osób i mienia — KZiS 541315",
  "Portier — KZiS 541306",
  "Dozorca — KZiS 962902",
  // ── Administration & Office (Biuro / Administracja) ──
  "Pracownik biurowy — KZiS 411003",
  "Sekretarka — KZiS 412001",
  "Recepcjonista — KZiS 422602",
  // ── Facilities & Cleaning (Obsługa obiektu) ──
  "Zarządca nieruchomości — KZiS 244003",
  "Kierownik firmy sprzątającej — KZiS 143907",
  "Robotnik gospodarczy — KZiS 515303",
  "Pracownik utrzymania czystości (sprzątaczka) — KZiS 911207",
  // ── Fallback for anything not on the official list ──
  "Inne / Other (poza klasyfikacją KZiS)",
];

const SITES = [
  "Warsaw Site", "Krakow Site", "Gdansk Site",
  "Poznan Site", "Warsaw HQ", "Wroclaw Site",
];

const MANAGERS = [
  "Marek Zielinski", "Katarzyna Wozniak",
  "Tomasz Kaczmarek", "Anna Mazur", "Piotr Lewandowski",
];

// These map to the EmployeeProfile schema enum
// Contract types allowed under Polish law (Kodeks pracy + Civil Code).
// The "value" saved here MUST match the contractType enum in the backend
// (models/Employee.js). "UOP" is kept as a general option so employees saved
// before we split it into subtypes still work (backward compatibility).
// Source: gov.pl — Ministry of Family, Labour and Social Policy.
const CONTRACT_TYPES = [
  { value: "UOP",            label: "UOP — Employment contract (general)" },
  { value: "UOP_PROBATION",  label: "UOP — Trial period (na okres próbny, max 3 months)" },
  { value: "UOP_FIXED",      label: "UOP — Fixed-term (na czas określony, max 33 months)" },
  { value: "UOP_INDEFINITE", label: "UOP — Permanent (na czas nieokreślony)" },
  { value: "UZ",             label: "UZ — Contract of mandate (Umowa Zlecenie)" },
  { value: "UOD",            label: "UOD — Contract for specific work (Umowa o Dzieło)" },
  { value: "B2B",            label: "B2B — Business to business (self-employment)" },
  { value: "INTERNSHIP",     label: "Internship / Traineeship (praktyka / staż)" },
  { value: "OTHER",          label: "Other" },
];

const RISK_CATEGORIES  = ["Low", "Medium", "High"];
const MEDICAL_EXAM_TYPES = ["Initial", "Periodic", "Control", "Specialized"];
const BHP_FREQUENCIES  = ["Annually", "Every 2 years", "Every 3 years", "Every 5 years"];

const INITIAL_FORM = {
  phone: "",
  dateOfBirth: "",
  pesel: "",
  department: "",
  jobRole: "",
  workSite: "",
  startDate: "",
  contractType: "",
  manager: "",
  employeeStatus: "Active",
  riskCategory: "Medium",
  requiresMedical: true,
  requiresBHP: true,
  requiresSpecialTraining: false,
  medicalExamType: "Periodic",
  initialBHPRequired: true,
  periodicBHPFrequency: "Every 3 years",
};

const STEPS = [
  { id: 1, label: "Select Employee",    description: "Pick from RegulaOne users" },
  { id: 2, label: "Employment Details", description: "Role, site & contract"      },
  { id: 3, label: "Compliance Setup",   description: "Safety & medical config"    },
];

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition
        ${props.disabled
          ? "border-slate-100 bg-slate-50 text-slate-500 cursor-not-allowed"
          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-50"}`}
    />
  );
}

function Select({ children, value, onChange }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>
  );
}

// A dropdown you can TYPE in to search.
// We use this for long lists (like Job Role and Department) so the user does
// not have to scroll through 100+ items — they just type a few letters and
// the list shrinks to matching options.
//
//   value       -> the currently stored value (what gets saved)
//   onChange    -> called with the picked value (just the value, not an event)
//   options     -> either an array of strings, OR an array of { value, label }
//                  objects. Objects let us SAVE one thing (e.g. "Warehouse")
//                  but SHOW another (e.g. "Magazyn / Warehouse").
//   placeholder -> greyed-out hint shown when nothing is selected
function SearchableSelect({ value, onChange, options, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);   // is the dropdown list showing?
  const [query, setQuery] = useState("");    // what the user has typed to search
  const boxRef = useRef(null);               // the whole widget, used to detect outside clicks

  // Turn every option into the same { value, label } shape so the rest of the
  // code does not care whether we were given plain strings or objects.
  const items = options.map((opt) =>
    typeof opt === "string" ? { value: opt, label: opt } : opt
  );

  // Find the label to show for the value that is currently saved.
  // If the saved value is not in the list (e.g. an old record), just show it.
  const selectedLabel = items.find((it) => it.value === value)?.label || value;

  // Close the list when the user clicks anywhere outside this widget.
  useEffect(() => {
    function handleOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Keep only the options whose label contains the typed text (any case).
  const filtered = items.filter((it) =>
    it.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  // The user clicked an option: save its value and close the list.
  function choose(val) {
    onChange(val);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        // When open we show what the user is typing; when closed we show the label.
        value={open ? query : selectedLabel}
        // If something is already chosen, keep showing it as a faint hint while searching.
        placeholder={selectedLabel || placeholder}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQuery(""); } }}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-sm text-slate-400">No matches found</li>
          ) : (
            filtered.map((it) => (
              <li
                key={it.value}
                // We use onMouseDown (not onClick) so the pick registers before
                // the input's blur/outside-click handler can close the list.
                onMouseDown={() => choose(it.value)}
                className={`cursor-pointer px-4 py-2 text-sm hover:bg-blue-50 ${
                  it.value === value ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700"
                }`}
              >
                {it.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function YesNoToggle({ label, hint, value, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button type="button" onClick={() => onChange(true)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${value ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
          Yes
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`rounded-md px-3 py-1.5 text-xs font-bold transition ${!value ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50"}`}>
          No
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 border-b border-slate-100 pb-4">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function AddEmployee() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const location  = useLocation();

  const { list: employees, loading: listLoading, submitting, submitError } = useSelector((s) => s.employees);

  const [currentStep, setCurrentStep]       = useState(1);
  const [form, setForm]                     = useState(INITIAL_FORM);
  const [selectedUser, setSelectedUser]     = useState(null);
  const [userSearch, setUserSearch]         = useState("");
  const [savedProfile, setSavedProfile]     = useState(null);

  // If navigated from "Setup Profile" button, pre-select the user
  useEffect(() => {
    const pre = location.state?.preselectedUser;
    if (pre) {
      setSelectedUser(pre);
      // If the user already has a partial profile, seed the form
      if (pre.profile) seedFormFromProfile(pre.profile);
    }
  }, []);

  // Load employee list if not already loaded (e.g. direct URL navigation)
  useEffect(() => {
    if (employees.length === 0 && !listLoading) {
      dispatch(fetchEmployees());
    }
  }, []);

  function seedFormFromProfile(profile) {
    setForm((prev) => ({
      ...prev,
      phone:         profile.phone        ?? prev.phone,
      dateOfBirth:   profile.dateOfBirth  ?? prev.dateOfBirth,
      pesel:         profile.pesel        ?? prev.pesel,
      department:    profile.department   ?? prev.department,
      jobRole:       profile.position     ?? prev.jobRole,
      workSite:      profile.site         ?? prev.workSite,
      contractType:  profile.contractType ?? prev.contractType,
      startDate:     profile.startDate    ?? prev.startDate,
      riskCategory:  profile.riskLevel
        ? profile.riskLevel.charAt(0) + profile.riskLevel.slice(1).toLowerCase()
        : prev.riskCategory,
    }));
  }

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Users that don't have a compliance profile yet — these need setup
  const usersNeedingProfile = employees.filter((e) => e.profileMissing);

  const filteredUsers = usersNeedingProfile.filter((u) => {
    if (!userSearch) return true;
    const text = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
    return text.includes(userSearch.toLowerCase());
  });

  function handleSelectUser(user) {
    setSelectedUser(user);
    if (user.profile) seedFormFromProfile(user.profile);
    setUserSearch("");
  }

  async function handleSubmit() {
    if (!selectedUser) return;

    dispatch(clearSubmitError());

    const profileData = {
      phone:       form.phone       || undefined,
      pesel:       form.pesel       || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      department:  form.department  || undefined,
      position:    form.jobRole     || undefined,
      site:        form.workSite    || undefined,
      contractType: form.contractType || undefined,
      startDate:   form.startDate   || undefined,
      isActive:    form.employeeStatus === "Active",
      riskLevel:   form.riskCategory.toUpperCase(),

      // Initialise certificate status as MISSING when required
      medicalCertificate: form.requiresMedical ? { status: "MISSING" } : undefined,
      bhpTraining:        form.requiresBHP     ? { status: "MISSING" } : undefined,
    };

    const result = await dispatch(upsertProfile({ employeeId: selectedUser._id, profileData }));

    if (upsertProfile.fulfilled.match(result)) {
      setSavedProfile({ ...selectedUser, profile: result.payload });
    }
  }

  // ─── Success screen ─────────────────────────────────────────────────────────
  if (savedProfile) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-10 text-center text-white shadow-xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 ring-1 ring-emerald-400/30">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Compliance Profile Saved</h2>
            <p className="mt-3 text-slate-300">
              {savedProfile.firstName} {savedProfile.lastName} has been registered in the SafeWork compliance system.
            </p>
            <div className="mt-6 rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Department</p>
                  <p className="mt-1 text-base font-bold">{savedProfile.profile?.department || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Site</p>
                  <p className="mt-1 text-base font-bold">{savedProfile.profile?.site || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">Risk Level</p>
                  <p className="mt-1 text-base font-bold">{form.riskCategory}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-200">BHP Required</p>
                  <p className="mt-1 text-base font-bold">{form.requiresBHP ? "Yes" : "No"}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => { setSavedProfile(null); setForm(INITIAL_FORM); setSelectedUser(null); setCurrentStep(1); }}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-blue-50"
              >
                Add Another
              </button>
              <button
                onClick={() => navigate("/employees")}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                View Employee List
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        {/* Page Header */}
        <div className="mb-6 rounded-3xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-100 ring-1 ring-white/20">
                SafeWork HR Compliance
              </p>
              <h1 className="text-3xl font-bold">Setup Employee Compliance Profile</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Select an existing RegulaOne user and configure their medical, BHP, and compliance requirements.
              </p>
            </div>
            <button
              onClick={() => navigate("/employees")}
              className="self-start rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 lg:self-auto"
            >
              ← Back to List
            </button>
          </div>
        </div>

        {/* Error */}
        {submitError && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Stepper */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-1 flex-col items-center text-center">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                    step.id < currentStep ? "bg-emerald-500 text-white"
                    : step.id === currentStep ? "bg-slate-900 text-white"
                    : "border-2 border-slate-200 text-slate-400"}`}>
                    {step.id < currentStep ? <CheckIcon /> : step.id}
                  </div>
                  <div className="mt-2.5 hidden sm:block">
                    <p className={`text-xs font-bold ${step.id === currentStep ? "text-slate-900" : "text-slate-400"}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-slate-400">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`mt-5 h-px flex-1 transition ${step.id < currentStep ? "bg-emerald-300" : "bg-slate-200"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ── Step 1: Select a RegulaOne user ────────────────────────────────── */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <SectionCard
              title="Select Employee"
              subtitle="Choose a user from RegulaOne who needs a compliance profile. Identity details are read-only."
            >
              {listLoading ? (
                <div className="flex items-center gap-3 py-4 text-sm text-slate-500">
                  <div className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  Loading users…
                </div>
              ) : usersNeedingProfile.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700">
                  All users already have compliance profiles set up.
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Search box for the user list */}
                  <input
                    type="text"
                    placeholder="Search by name or email…"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
                  />

                  {/* Scrollable user picker */}
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-400">No users match your search.</p>
                    ) : (
                      filteredUsers.map((user) => {
                        const isSelected = selectedUser?._id === user._id;
                        return (
                          <button
                            key={user._id}
                            type="button"
                            onClick={() => handleSelectUser(user)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                              isSelected ? "bg-blue-50" : "bg-white hover:bg-slate-50"}`}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              isSelected ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                              {(user.firstName?.[0] ?? user.email[0]).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="truncate text-xs text-slate-500">{user.email}</p>
                            </div>
                            <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                              {user.role?.replace("_", " ")}
                            </span>
                            {isSelected && (
                              <span className="shrink-0 text-blue-600">
                                <CheckIcon />
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </SectionCard>

            {/* Read-only identity preview + editable SafeWork-specific fields */}
            {selectedUser && (
              <SectionCard
                title="Employee Identity"
                subtitle="Name and email come from RegulaOne and cannot be changed here."
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="First Name">
                    <Input type="text" value={selectedUser.firstName ?? ""} disabled />
                  </FormField>
                  <FormField label="Last Name">
                    <Input type="text" value={selectedUser.lastName ?? ""} disabled />
                  </FormField>
                  <FormField label="Email Address">
                    <Input type="email" value={selectedUser.email ?? ""} disabled />
                  </FormField>
                  <FormField label="Phone Number">
                    <Input
                      type="tel"
                      placeholder="+48 600 000 000"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Date of Birth">
                    <Input
                      type="date"
                      value={form.dateOfBirth}
                      onChange={(e) => update("dateOfBirth", e.target.value)}
                    />
                  </FormField>
                  <FormField label="PESEL / National ID">
                    <Input
                      type="text"
                      placeholder="Polish national identifier"
                      value={form.pesel}
                      onChange={(e) => update("pesel", e.target.value)}
                    />
                  </FormField>
                </div>
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Step 2: Employment Details ──────────────────────────────────────── */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <SectionCard title="Role & Workplace" subtitle="Job role, department, and site assignment">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Department" required>
                  <SearchableSelect
                    value={form.department}
                    onChange={(v) => update("department", v)}
                    options={DEPARTMENTS}
                    placeholder="Search department..."
                  />
                </FormField>
                <FormField label="Job Role" required>
                  <SearchableSelect
                    value={form.jobRole}
                    onChange={(v) => update("jobRole", v)}
                    options={JOB_ROLES}
                    placeholder="Search job role..."
                  />
                </FormField>
                <FormField label="Work Site" required>
                  <Select value={form.workSite} onChange={(e) => update("workSite", e.target.value)}>
                    <option value="">Select site</option>
                    {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Contract Details" subtitle="Employment type, start date, and reporting manager">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField label="Employment Start Date" required>
                  <Input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
                </FormField>
                <FormField label="Contract Type" required>
                  <Select value={form.contractType} onChange={(e) => update("contractType", e.target.value)}>
                    <option value="">Select contract type</option>
                    {CONTRACT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="Manager">
                  <Select value={form.manager} onChange={(e) => update("manager", e.target.value)}>
                    <option value="">Select manager</option>
                    {MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </FormField>
              </div>
            </SectionCard>

            <SectionCard title="Employment Status" subtitle="Set the initial status for this employee record">
              <div className="flex gap-3">
                {["Active", "Inactive"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => update("employeeStatus", status)}
                    className={`flex-1 rounded-xl border px-4 py-4 text-sm font-bold transition sm:flex-none sm:px-12 ${
                      form.employeeStatus === status
                        ? status === "Active" ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Step 3: Compliance Setup ────────────────────────────────────────── */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <SectionCard title="Risk Classification" subtitle="Occupational risk level for this position">
              <div className="grid grid-cols-3 gap-3">
                {RISK_CATEGORIES.map((category) => {
                  const selected = form.riskCategory === category;
                  const colorMap = {
                    Low:    selected ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50/60",
                    Medium: selected ? "border-amber-300 bg-amber-50 text-amber-700"       : "border-slate-200 bg-slate-50 text-slate-500 hover:border-amber-200 hover:bg-amber-50/60",
                    High:   selected ? "border-red-300 bg-red-50 text-red-700"             : "border-slate-200 bg-slate-50 text-slate-500 hover:border-red-200 hover:bg-red-50/60",
                  };
                  const dotMap = { Low: "bg-emerald-500", Medium: "bg-amber-500", High: "bg-red-500" };
                  return (
                    <button key={category} type="button" onClick={() => update("riskCategory", category)}
                      className={`rounded-xl border px-4 py-5 text-sm font-bold transition ${colorMap[category]}`}>
                      <span className={`mx-auto mb-2 block h-3 w-3 rounded-full ${dotMap[category]}`} />
                      {category} Risk
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Medical Requirements" subtitle="Occupational health examination configuration">
              <div className="space-y-3">
                <YesNoToggle
                  label="Requires Medical Certificate"
                  hint="Badania medycyny pracy — occupational health examination required"
                  value={form.requiresMedical}
                  onChange={(val) => update("requiresMedical", val)}
                />
                {form.requiresMedical && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <FormField label="Medical Exam Type Required">
                      <Select value={form.medicalExamType} onChange={(e) => update("medicalExamType", e.target.value)}>
                        {MEDICAL_EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </Select>
                    </FormField>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="BHP Safety Training" subtitle="Bezpieczenstwo i Higiena Pracy — mandatory occupational safety training">
              <div className="space-y-3">
                <YesNoToggle
                  label="Requires BHP Training"
                  hint="Mandatory safety training under Polish Labour Code"
                  value={form.requiresBHP}
                  onChange={(val) => update("requiresBHP", val)}
                />
                {form.requiresBHP && (
                  <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                    <YesNoToggle
                      label="Initial BHP Required"
                      hint="One-time onboarding safety training on employment start date"
                      value={form.initialBHPRequired}
                      onChange={(val) => update("initialBHPRequired", val)}
                    />
                    <FormField label="Periodic BHP Frequency">
                      <Select value={form.periodicBHPFrequency} onChange={(e) => update("periodicBHPFrequency", e.target.value)}>
                        {BHP_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </FormField>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="Special Training" subtitle="Additional role-specific certifications and qualifications">
              <YesNoToggle
                label="Requires Special Training"
                hint="Equipment licenses, forklift certification, or role-specific qualifications"
                value={form.requiresSpecialTraining}
                onChange={(val) => update("requiresSpecialTraining", val)}
              />
            </SectionCard>

            {/* Compliance preview */}
            <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-5 shadow-sm">
              <p className="mb-4 text-xs font-bold uppercase tracking-wide text-blue-200">Compliance Profile Preview</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Risk Level</p>
                  <p className={`mt-1 text-sm font-bold ${form.riskCategory === "High" ? "text-red-300" : form.riskCategory === "Medium" ? "text-amber-300" : "text-emerald-300"}`}>
                    {form.riskCategory}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Medical</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresMedical ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresMedical ? form.medicalExamType : "Not Required"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">BHP Training</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresBHP ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresBHP ? form.periodicBHPFrequency : "Not Required"}
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20">
                  <p className="text-xs text-slate-400">Special Training</p>
                  <p className={`mt-1 text-sm font-bold ${form.requiresSpecialTraining ? "text-blue-300" : "text-slate-400"}`}>
                    {form.requiresSpecialTraining ? "Required" : "Not Required"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Footer */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/employees")}
              className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={currentStep === 1 && !selectedUser}
                className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !selectedUser}
                className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save Profile"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default AddEmployee;
