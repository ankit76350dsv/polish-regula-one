package com.regulaone.backend.tenant;

import com.regulaone.backend.billing.BillingService;
import com.regulaone.backend.billing.PackageRepository;
import com.regulaone.backend.models.AppPackage;
import com.regulaone.backend.models.PackageStatus;
import com.regulaone.backend.models.Tenant;
import com.regulaone.backend.models.User;
import com.regulaone.backend.tenant.dto.TenantRequest;
import com.regulaone.backend.tenant.dto.TenantResponse;
import com.regulaone.backend.tenant.dto.UpdateOrgRequest;
import com.regulaone.backend.user.UserRepository;
import com.regulaone.backend.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * What a COMPANY ADMINISTRATOR does with their own organisation: create it on first
 * login, and keep its contact details up to date.
 *
 * WHY THIS IS NOT PART OF TenantService
 *   {@link TenantService} is the platform operator's CRUD over any company. This class
 *   is the self-service side: an administrator acting on the one organisation they
 *   belong to, which is resolved from their session token and never from the request.
 *   The two have different audiences and different rules, so they are different classes.
 *
 * WHY IT IS NOT PART OF UserService EITHER
 *   It used to be. Creating a company, assigning it a plan and raising its first invoice
 *   are not user administration; they only started there because the endpoints happen to
 *   sit under /api/admin. The behaviour is unchanged — only its home is.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OrganisationService {

    /**
     * The plan every brand-new organisation starts on.
     *
     * Configurable rather than compiled in, so the catalogue can change without a code
     * change. The default keeps the id this platform has always used.
     */
    @Value("${regulaone.default-package-id:6a0466e9361d1caa88cba7ed}")
    private String defaultPackageId;

    private final TenantService tenantService;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PackageRepository packageRepository;
    private final BillingService billingService;

    /**
     * FIRST-TIME SETUP: create the administrator's organisation and put it on the default
     * plan.
     *
     * What it does, in order:
     *   1. Refuses if this administrator already has an organisation (no double setup).
     *   2. Creates the company (name/NIP/e-mail uniqueness is checked by TenantService).
     *   3. Puts it on the default plan, and records that period in the plan history so the
     *      billing ledger starts from day one.
     *   4. Raises a FREE invoice for that plan — zero amount, so the ledger is complete
     *      without charging for a no-cost plan.
     *   5. Links the company to the administrator and grants them the modules the plan
     *      includes, so their sidebar matches what was bought.
     *
     * After this, {@code GET /api/auth/me} reports tenantStatus == "ACTIVE", which is how
     * the frontend knows to close the setup modal and unlock the platform.
     *
     * {@code @Transactional} so a company is never left half-created: the tenant, the
     * invoice and the user link either all happen or none do.
     *
     * @param cognitoSub the administrator, taken from their verified session token
     */
    @Transactional
    public UserResponse setupOrganisation(String cognitoSub, TenantRequest request) {

        User currentAdminUser = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Guard: prevent double-setup if the admin already has an organisation
        if (currentAdminUser.getTenant() != null) {
            throw new IllegalStateException("Organisation is already set up for this account");
        }

        TenantResponse created = tenantService.createTenant(request);

        Tenant tenant = tenantRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Tenant creation failed unexpectedly"));

        AppPackage basicPackage = packageRepository
                .findById(defaultPackageId)
                .orElseThrow(() -> new IllegalStateException("Default package not found"));

        // A retired plan must not be handed to a new customer.
        if (basicPackage.getStatus() != PackageStatus.ACTIVE) {
            throw new IllegalStateException(
                    "Cannot setup organisation because the default package is inactive");
        }

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiryDate = now.plusDays(basicPackage.getDuration());
        String usersCapacity = String.valueOf(basicPackage.getUsersCapacity());

        // The live plan…
        tenant.setCurrentPackage(Tenant.PackageDetails.builder()
                .appPackage(basicPackage)
                .planStarted(now)
                .planExpiring(expiryDate)
                .usersCapacity(usersCapacity)
                .build());

        // …and the same period written into the history ledger, which is what the revenue
        // report and the plan-assignment table read.
        tenant.getPackageHistory().add(Tenant.PackageHistory.builder()
                .appPackage(basicPackage)
                .planStarted(now)
                .planExpired(expiryDate)
                .usersCapacity(usersCapacity)
                .build());

        tenant.setUpdatedAt(now);
        tenantRepository.save(tenant);

        // isFree=true so amount=0 and status=FREE — the default plan is no-charge.
        billingService.generateInvoice(tenant, basicPackage, true);

        currentAdminUser.setTenant(tenant);
        currentAdminUser.setUpdatedAt(now);

        // Assign the plan's module list to the admin so the sidebar reflects exactly what
        // the purchased plan includes from day one.
        currentAdminUser.setModuleIds(basicPackage.getAppIds());

        userRepository.save(currentAdminUser);

        return UserResponse.from(currentAdminUser);
    }

    /**
     * Lets a ROLE_ADMIN update their OWN organisation's contact and address details.
     *
     * Deliberately excludes nip, regon and status: those are the company's legal
     * identity and its account state, and changing them is a platform-operator action
     * (they appear on invoices and in government filings).
     *
     * Every field is optional — a null field is left as it was.
     *
     * Called by PUT /api/admin/org.
     */
    public TenantResponse updateMyOrg(String cognitoSub, UpdateOrgRequest request) {
        User user = userRepository.findByCognitoSub(cognitoSub)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // User stores a @DBRef to the full Tenant object, not a raw tenantId field.
        if (user.getTenant() == null) {
            throw new IllegalStateException("No organisation linked to this account");
        }

        Tenant tenant = tenantRepository.findById(user.getTenant().getId())
                .orElseThrow(() -> new IllegalArgumentException(
                        "Organisation not found with id: " + user.getTenant().getId()));

        if (request.getName() != null)       tenant.setName(request.getName());
        if (request.getEmail() != null)      tenant.setEmail(request.getEmail());
        if (request.getPhone() != null)      tenant.setPhone(request.getPhone());
        if (request.getAddress() != null)    tenant.setAddress(request.getAddress());
        if (request.getCity() != null)       tenant.setCity(request.getCity());
        if (request.getPostalCode() != null) tenant.setPostalCode(request.getPostalCode());
        tenant.setUpdatedAt(LocalDateTime.now());

        return TenantResponse.from(tenantRepository.save(tenant));
    }
}
