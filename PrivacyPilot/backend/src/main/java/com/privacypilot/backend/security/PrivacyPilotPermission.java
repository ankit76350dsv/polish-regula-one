package com.privacypilot.backend.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * The set of PrivacyPilot-module permission codes a user can hold.
 *
 * These codes live on the RegulaOne user (in its generic {@code permissions} list)
 * and arrive here via the /api/auth/me response. RegulaOne stays app-agnostic — it
 * just stores the strings — while THIS enum is the single place that defines what
 * the PrivacyPilot module recognises and what each code is allowed to do.
 *
 * Why an enum here (and only strings in RegulaOne)?
 *   - Keeps the identity service decoupled from every app's permission model.
 *   - Gives the PrivacyPilot code type-safety and one obvious place to look up the rules.
 *
 * They are granted/revoked by an admin in RegulaOne Team Management (the same screen
 * used for the KSeF and SafeVoice codes); the catalogue the admin sees is in the
 * RegulaOne frontend (UserPermissionsPage.jsx). The codes below MUST match that
 * catalogue exactly.
 *
 * Rough meaning of each code (enforcement is added per-endpoint as needed):
 *   - PRIVACYPILOT_ADMIN            → full control of the company's privacy programme:
 *                                     manage the ROPA register, DPIAs, vendors, transfers,
 *                                     breaches and DSARs, generate notices, export, view the
 *                                     audit trail, and manage users/settings.
 *   - PRIVACYPILOT_COMPLIANCE_OFFICER→ runs the register day-to-day: create/edit activities,
 *                                     manage DPIAs, vendors, transfers, breaches and DSARs,
 *                                     generate notices and export — but NOT manage users/settings.
 *   - PRIVACYPILOT_DPO              → the Data Protection Officer (IOD): independent oversight —
 *                                     sign off DPIAs, approve activities, handle breaches and
 *                                     DSARs, and export. Kept separate from day-to-day editing
 *                                     to protect the DPO's independence.
 *   - PRIVACYPILOT_AUDITOR          → read-only access to the register and audit trail, plus
 *                                     export for the 10-year retention requirement. Must never
 *                                     be able to change the records it audits.
 *   - PRIVACYPILOT_EMPLOYEE         → baseline member access; no privacy-management rights.
 *
 * IMPORTANT: a single user usually holds MANY permission codes at once — several
 * PrivacyPilot ones AND codes from other apps (KSEF_*, SAFEVOICE_*, ...). They all
 * sit together in one flat list on the RegulaOne user. So the codes are declared
 * here MOST-PRIVILEGED FIRST: when we must show ONE code (e.g. the "acting as"
 * role in an audit line), we pick the highest one the user holds — see
 * {@link #primaryOf(Collection)}.
 */
public enum PrivacyPilotPermission {
    PRIVACYPILOT_ADMIN,
    PRIVACYPILOT_COMPLIANCE_OFFICER,
    PRIVACYPILOT_DPO,
    PRIVACYPILOT_AUDITOR,
    PRIVACYPILOT_EMPLOYEE;

    /**
     * Safe lookup: returns the matching enum value, or null if the string is not a
     * PrivacyPilot code (e.g. it belongs to another app like KSEF_*). Never throws.
     */
    public static PrivacyPilotPermission fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (PrivacyPilotPermission p : values()) {
            if (p.name().equals(code)) {
                return p;
            }
        }
        return null;
    }

    /**
     * Keeps ONLY the PrivacyPilot codes out of a mixed, cross-app list.
     *
     * A user's permission list can contain codes from every app. This walks the
     * whole list and drops anything that is not a PrivacyPilot code (fromCode
     * returns null for those), so the caller is left with just this module's
     * permissions. Never throws; a null or empty input gives an empty list.
     */
    public static List<PrivacyPilotPermission> fromCodes(Collection<String> codes) {
        List<PrivacyPilotPermission> result = new ArrayList<>();
        if (codes != null) {
            for (String code : codes) {
                PrivacyPilotPermission p = fromCode(code);
                if (p != null) {
                    result.add(p);
                }
            }
        }
        return result;
    }

    /**
     * Picks the ONE code to represent a user who may hold several — the most
     * privileged PrivacyPilot code they have (codes are declared most-privileged
     * first above, so the first match wins). Used for audit "acting as" labels.
     * Returns null if the user holds no PrivacyPilot code at all.
     */
    public static PrivacyPilotPermission primaryOf(Collection<String> codes) {
        if (codes != null) {
            // values() is in declaration order = privilege order, highest first.
            for (PrivacyPilotPermission p : values()) {
                if (codes.contains(p.name())) {
                    return p;
                }
            }
        }
        return null;
    }
}
