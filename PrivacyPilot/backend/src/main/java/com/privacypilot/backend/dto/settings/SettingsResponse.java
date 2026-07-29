package com.privacypilot.backend.dto.settings;

import com.privacypilot.backend.model.document.Tenant;
import com.privacypilot.backend.model.document.TenantSettings;
import com.privacypilot.backend.model.embedded.AiPreferences;
import com.privacypilot.backend.model.embedded.CompanyDetails;
import com.privacypilot.backend.model.embedded.DpoDetails;
import lombok.Data;

/**
 * What the Settings API returns to the client.
 *
 * It joins TWO sources so the front-end still sees one tidy "settings" object:
 *   - company  → READ-ONLY, copied from the shared RegulaOne tenant (the single
 *                source of truth for the company's legal identity). PrivacyPilot
 *                never writes it; it is edited on RegulaOne's company profile page.
 *   - dpo, ai  → PrivacyPilot's own, editable settings (saved via PUT).
 *
 * Keeping the same {@code company / dpo / ai} shape means the register header,
 * privacy notices and breach report keep reading {@code settings.company.*}
 * exactly as before — only the *origin* of the company data changed.
 */
@Data
public class SettingsResponse {

    // The company legal identity, READ-ONLY (owned by RegulaOne).
    private CompanyDetails company = new CompanyDetails();

    // The Data Protection Officer contact + UODO tracking (editable here).
    private DpoDetails dpo = new DpoDetails();

    // The AI assistant preferences (editable here).
    private AiPreferences ai = new AiPreferences();

    /**
     * Build the response from the PrivacyPilot settings row and the shared tenant.
     * The tenant may be null (should not happen for a valid session, but we stay
     * defensive) — in that case the company block is simply left blank.
     */
    public static SettingsResponse of(TenantSettings settings, Tenant tenant) {
        SettingsResponse r = new SettingsResponse();
        r.setDpo(settings.getDpo() != null ? settings.getDpo() : new DpoDetails());
        r.setAi(settings.getAi() != null ? settings.getAi() : new AiPreferences());
        r.setCompany(companyFrom(tenant));
        return r;
    }

    // Map the RegulaOne tenant's flat fields onto the company shape the app expects.
    // RegulaOne stores the address in three parts (address / postalCode / city); we
    // join them into one readable line for notices and the ROPA header. RegulaOne does
    // not track KRS or a website today, so those stay blank (added there later if needed).
    private static CompanyDetails companyFrom(Tenant t) {
        CompanyDetails c = new CompanyDetails();
        if (t == null) return c;
        c.setName(t.getName());
        c.setNip(t.getNip());
        c.setRegon(t.getRegon());
        c.setAddress(joinAddress(t));
        return c;
    }

    // Turn "ul. Prosta 68" + "00-838" + "Warszawa" into "ul. Prosta 68, 00-838 Warszawa",
    // skipping any part the tenant has not filled in.
    private static String joinAddress(Tenant t) {
        StringBuilder cityLine = new StringBuilder();
        if (hasText(t.getPostalCode())) cityLine.append(t.getPostalCode().trim());
        if (hasText(t.getCity())) {
            if (cityLine.length() > 0) cityLine.append(' ');
            cityLine.append(t.getCity().trim());
        }
        StringBuilder full = new StringBuilder();
        if (hasText(t.getAddress())) full.append(t.getAddress().trim());
        if (cityLine.length() > 0) {
            if (full.length() > 0) full.append(", ");
            full.append(cityLine);
        }
        return full.length() > 0 ? full.toString() : null;
    }

    private static boolean hasText(String s) {
        return s != null && !s.trim().isEmpty();
    }
}
