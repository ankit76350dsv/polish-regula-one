package com.ksefflow.backend.services;

import com.ksefflow.backend.dto.ksefapi.*;
import com.ksefflow.backend.services.ksefauth.KSeFAuthService;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * KsefPermissionsService — managing KSeF permissions (uprawnienia), gap C2.
 *
 * SIMPLE EXPLANATION (why this exists):
 * In KSeF, the company owner does not have to do everything personally. They can GRANT specific
 * rights to other people — an employee who issues invoices, or an accounting office (biuro
 * rachunkowe) that handles the books. KSeF tracks these rights centrally. Before this, KSeFFlow
 * relied only on its own RegulaOne roles and had no way to set up the KSeF-side permissions a
 * real company needs. This service does that: grant a right, list who has what, and take a right
 * away.
 *
 * The common KSeF person-permission codes are: CredentialsManage (manage others' permissions),
 * CredentialsRead, InvoiceWrite (issue invoices), InvoiceRead (view/receive invoices),
 * Introspection, SubunitManage, EnforcementOperations.
 *
 * Permission changes are asynchronous: each grant/revoke returns a referenceNumber that can be
 * polled with getOperationStatus() to confirm KSeF finished the change.
 *
 * Official reference: KSeF 2.0 manual part I (permissions model) + the /permissions/* API.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class KsefPermissionsService {

    private final KSeFAuthService authService;
    private final KsefApiClient ksefApiClient;

    // Sensible defaults so the simplest caller does not have to know KSeF's vocabulary.
    private static final String DEFAULT_SUBJECT_DETAILS_TYPE = "PersonByIdentifier";
    private static final String DEFAULT_QUERY_TYPE = "PermissionsGrantedInCurrentContext";

    /**
     * Grants a person one or more permissions in this tenant's KSeF context.
     *
     * @param nip                the tenant's own NIP (the context we are granting within)
     * @param subjectType        how the person is identified: "Nip", "Pesel" or "Fingerprint"
     * @param subjectValue       the identifier value
     * @param permissions        the KSeF permission codes to grant (e.g. ["InvoiceWrite","InvoiceRead"])
     * @param description        a short note explaining the grant (required by KSeF)
     * @param subjectDetailsType optional; defaults to "PersonByIdentifier"
     * @return the referenceNumber of the async grant operation
     */
    public String grantToPerson(String tenantId, String nip, String subjectType, String subjectValue,
                                List<String> permissions, String description, String subjectDetailsType) {
        log.info("[grantToPerson]:1 Granting {} permission(s) to {}={} for tenant [{}]",
                permissions != null ? permissions.size() : 0, subjectType, subjectValue, tenantId);

        String accessToken = authService.openSession(tenantId, nip);
        PersonPermissionsGrantRequest request = new PersonPermissionsGrantRequest(
                new PersonPermissionsGrantRequest.SubjectIdentifier(subjectType, subjectValue),
                permissions,
                description,
                new PersonPermissionsGrantRequest.SubjectDetails(
                        subjectDetailsType != null ? subjectDetailsType : DEFAULT_SUBJECT_DETAILS_TYPE));

        PermissionsOperationResponse response = ksefApiClient.grantPersonPermissions(accessToken, request);

        KSeFAuditLogService.writeAuditLog(tenantId, "PERMISSION_GRANTED", null, null,
                "subject=" + subjectType + ":" + subjectValue + " perms=" + permissions + " ref=" + response.referenceNumber(),
                null, null);
        log.info("[grantToPerson]:2 Grant submitted — referenceNumber [{}]", response.referenceNumber());
        return response.referenceNumber();
    }

    /** Lists person permissions in the current context (paged). */
    public QueryPersonPermissionsResponse listPersonPermissions(String tenantId, String nip, String queryType,
                                                                List<String> permissionTypes,
                                                                int pageOffset, int pageSize) {
        String accessToken = authService.openSession(tenantId, nip);
        PersonPermissionsQueryRequest request = new PersonPermissionsQueryRequest(
                queryType != null ? queryType : DEFAULT_QUERY_TYPE,
                (permissionTypes != null && !permissionTypes.isEmpty()) ? permissionTypes : null);
        return ksefApiClient.queryPersonPermissions(accessToken, request, pageOffset, pageSize);
    }

    /** Revokes a single granted permission by its id. Returns the async operation referenceNumber. */
    public String revoke(String tenantId, String nip, String permissionId) {
        log.info("[revoke]:1 Revoking permission [{}] for tenant [{}]", permissionId, tenantId);
        String accessToken = authService.openSession(tenantId, nip);
        PermissionsOperationResponse response = ksefApiClient.revokePermission(accessToken, permissionId);

        KSeFAuditLogService.writeAuditLog(tenantId, "PERMISSION_REVOKED", permissionId, null,
                "ref=" + response.referenceNumber(), null, null);
        log.info("[revoke]:2 Revoke submitted — referenceNumber [{}]", response.referenceNumber());
        return response.referenceNumber();
    }

    /** Checks how an earlier grant/revoke operation finished. */
    public PermissionsOperationStatusResponse getOperationStatus(String tenantId, String nip, String referenceNumber) {
        String accessToken = authService.openSession(tenantId, nip);
        return ksefApiClient.getPermissionsOperationStatus(accessToken, referenceNumber);
    }
}
