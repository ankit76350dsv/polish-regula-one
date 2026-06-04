package com.ksefflow.backend.services;

import com.ksefflow.backend.services.fa3xml.FA3XmlGeneratorService;
import com.ksefflow.backend.services.fa3xml.FA3XmlValidatorService;

import com.ksefflow.backend.services.ksefauth.KSeFAuthService;

import com.ksefflow.backend.config.KsefApiProperties;
import com.ksefflow.backend.dto.ksefapi.KsefInvoiceStatusResponse;
import com.ksefflow.backend.dto.ksefapi.KsefSendInvoiceResponse;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import com.ksefflow.backend.exceptions.KsefSubmissionException;
import com.ksefflow.backend.models.KsefInvoice;
import com.ksefflow.backend.models.utils.KsefCurrency;
import com.ksefflow.backend.models.utils.KsefEnvironment;
import com.ksefflow.backend.models.utils.KsefInvoiceStatus;
import com.ksefflow.backend.models.utils.KsefPaymentMethod;
import com.ksefflow.backend.models.utils.KsefVatRate;
import com.ksefflow.backend.repository.KsefAuditLogRepository;
import com.ksefflow.backend.repository.KsefInvoiceRepository;
import com.ksefflow.backend.services.ksefauth.KsefApiClient;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.atomic.AtomicInteger;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

// Pure unit tests — no Spring context, no MongoDB, no HTTP.
// All dependencies are mocked with Mockito.
@ExtendWith(MockitoExtension.class)
class KSeFInvoiceServiceTest {

    @Mock private KsefInvoiceRepository invoiceRepository;
    @Mock private KsefAuditLogRepository auditLogRepository;
    @Mock private FA3XmlGeneratorService xmlGeneratorService;
    @Mock private FA3XmlValidatorService xmlValidatorService;
    @Mock private KSeFAuthService authService;
    @Mock private KsefApiClient apiClient;
    @Mock private UPOStorageService upoStorageService;
    @Mock private OfflineQrService offlineQrService;
    @Mock private KsefApiProperties apiProperties;

    @InjectMocks
    private KSeFInvoiceService invoiceService;

    private static final String TENANT_ID   = "tenant-pl-001";
    private static final String INVOICE_ID  = "inv-abc-123";
    private static final String NIP         = "1234567890";
    private static final String SESSION_TOK = "gov-session-xyz";
    private static final String ELEM_REF    = "elem-ref-001";
    private static final String KSEF_ID     = "1234567890-20260526-ABCDEF1234567890";

    // ── createInvoice ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("createInvoice: saves invoice as DRAFT and returns saved entity")
    void createInvoice_validRequest_savedAsDraft() {
        KsefInvoice input = buildDraftInvoice();
        KsefInvoice saved = buildDraftInvoice();
        saved.setId(INVOICE_ID);

        when(apiProperties.getEnvironment()).thenReturn(KsefEnvironment.SANDBOX);
        when(invoiceRepository.findByTenantIdAndInvoiceNumber(TENANT_ID, "FV/2026/05/0001"))
                .thenReturn(Optional.empty());
        when(invoiceRepository.save(any(KsefInvoice.class))).thenReturn(saved);

        KsefInvoice result = invoiceService.createInvoice(input, null, null);

        assertThat(result.getId()).isEqualTo(INVOICE_ID);
        verify(invoiceRepository).save(argThat(inv ->
                inv.getStatus() == KsefInvoiceStatus.DRAFT &&
                inv.getKsefEnvironment() == KsefEnvironment.SANDBOX));
    }

    @Test
    @DisplayName("createInvoice: throws when an existing invoice with the same number is no longer a DRAFT")
    void createInvoice_duplicateNumber_throws() {
        // A finalized (non-DRAFT) invoice with the same number is a real conflict.
        KsefInvoice existingSent = buildDraftInvoice();
        existingSent.setId(INVOICE_ID);
        existingSent.setStatus(KsefInvoiceStatus.SENT);
        when(invoiceRepository.findByTenantIdAndInvoiceNumber(TENANT_ID, "FV/2026/05/0001"))
                .thenReturn(Optional.of(existingSent));

        assertThatThrownBy(() -> invoiceService.createInvoice(buildDraftInvoice(), null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("already exists");

        verify(invoiceRepository, never()).save(any());
    }

    @Test
    @DisplayName("createInvoice: updates the existing DRAFT in place (idempotent) instead of throwing")
    void createInvoice_existingDraft_updatedInPlace() {
        KsefInvoice existingDraft = buildDraftInvoice();
        existingDraft.setId(INVOICE_ID);
        existingDraft.setStatus(KsefInvoiceStatus.DRAFT);

        when(apiProperties.getEnvironment()).thenReturn(KsefEnvironment.SANDBOX);
        when(invoiceRepository.findByTenantIdAndInvoiceNumber(TENANT_ID, "FV/2026/05/0001"))
                .thenReturn(Optional.of(existingDraft));
        when(invoiceRepository.save(any(KsefInvoice.class))).thenAnswer(inv -> inv.getArgument(0));

        KsefInvoice result = invoiceService.createInvoice(buildDraftInvoice(), null, null);

        // Reuses the existing draft's id and stays a DRAFT — no duplicate, no exception.
        assertThat(result.getId()).isEqualTo(INVOICE_ID);
        assertThat(result.getStatus()).isEqualTo(KsefInvoiceStatus.DRAFT);
    }

    // ── submitInvoice: happy path ──────────────────────────────────────────────

    @Test
    @DisplayName("submitInvoice: full happy path — DRAFT → SENT with ksefId + upoDocumentId set")
    void submitInvoice_happyPath_transitionsDraftToSent() {
        KsefInvoice draft = buildDraftInvoice();
        draft.setId(INVOICE_ID);

        // thenAnswer returns the invoice as-is for intermediate saves, and enriches it on
        // the final SENT save — avoids NPE from argThat receiving null during mock matching.
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(draft));
        when(invoiceRepository.save(any(KsefInvoice.class))).thenAnswer(invMock -> {
            KsefInvoice inv = invMock.getArgument(0);
            if (inv.getStatus() == KsefInvoiceStatus.SENT) {
                inv.setKsefId(KSEF_ID);
                inv.setUpoDocumentId("upo-doc-999");
            }
            return inv;
        });

        FA3XmlGeneratorService.FA3XmlResult xmlResult =
                new FA3XmlGeneratorService.FA3XmlResult("<Faktura/>", "deadbeef");
        when(xmlGeneratorService.generateXml(any())).thenReturn(xmlResult);
        when(authService.openSession(TENANT_ID, NIP)).thenReturn(SESSION_TOK);

        KsefSendInvoiceResponse sendResp = new KsefSendInvoiceResponse();
        sendResp.setElementReferenceNumber(ELEM_REF);
        sendResp.setProcessingCode(200);
        when(apiClient.sendInvoice(SESSION_TOK, "<Faktura/>")).thenReturn(sendResp);

        KsefInvoiceStatusResponse statusResp = new KsefInvoiceStatusResponse();
        KsefInvoiceStatusResponse.InvoiceStatus invoiceStatus =
                new KsefInvoiceStatusResponse.InvoiceStatus();
        invoiceStatus.setKsefReferenceNumber(KSEF_ID);
        statusResp.setInvoiceStatus(invoiceStatus);
        when(apiClient.getInvoiceStatus(SESSION_TOK, ELEM_REF)).thenReturn(statusResp);

        when(upoStorageService.storeUpo(eq(INVOICE_ID), eq(TENANT_ID), eq(KSEF_ID),
                anyString(), any())).thenReturn("upo-doc-999");

        when(apiProperties.getEnvironment()).thenReturn(KsefEnvironment.SANDBOX);

        KsefInvoice result = invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null);

        assertThat(result.getStatus()).isEqualTo(KsefInvoiceStatus.SENT);
        assertThat(result.getKsefId()).isEqualTo(KSEF_ID);
        assertThat(result.getUpoDocumentId()).isEqualTo("upo-doc-999");

        verify(xmlValidatorService).validateStrict("<Faktura/>");
        verify(upoStorageService).storeUpo(eq(INVOICE_ID), eq(TENANT_ID), eq(KSEF_ID),
                anyString(), any());
    }

    // ── submitInvoice: guard checks ────────────────────────────────────────────

    @Test
    @DisplayName("submitInvoice: throws when invoice not found")
    void submitInvoice_notFound_throws() {
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not found");
    }

    @Test
    @DisplayName("submitInvoice: throws when tenantId does not match invoice")
    void submitInvoice_wrongTenant_throws() {
        KsefInvoice draft = buildDraftInvoice();
        draft.setId(INVOICE_ID);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> invoiceService.submitInvoice("wrong-tenant", INVOICE_ID, NIP, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    @DisplayName("submitInvoice: throws when invoice is not in DRAFT status")
    void submitInvoice_notDraft_throws() {
        KsefInvoice sent = buildDraftInvoice();
        sent.setId(INVOICE_ID);
        sent.setStatus(KsefInvoiceStatus.SENT);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(sent));

        assertThatThrownBy(() -> invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DRAFT");
    }

    // ── submitInvoice: offline mode ────────────────────────────────────────────

    @Test
    @DisplayName("submitInvoice: switches to OFFLINE_MODE when KSeF API is unreachable")
    void submitInvoice_ksefUnreachable_switchesToOfflineMode() {
        KsefInvoice draft = buildDraftInvoice();
        draft.setId(INVOICE_ID);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(draft));
        when(invoiceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FA3XmlGeneratorService.FA3XmlResult xmlResult =
                new FA3XmlGeneratorService.FA3XmlResult("<Faktura/>", "deadbeef");
        when(xmlGeneratorService.generateXml(any())).thenReturn(xmlResult);
        when(authService.openSession(TENANT_ID, NIP)).thenReturn(SESSION_TOK);
        when(apiClient.sendInvoice(any(), any()))
                .thenThrow(new KsefSubmissionException("KSeF API is unreachable — triggering offline mode"));
        // Offline QR codes are generated server-side; an OFFLINE certificate is available here.
        when(offlineQrService.generateCertificateCode(any()))
                .thenReturn("https://qr-test.ksef.mf.gov.pl/certificate/Nip/1234567890/1234567890/01F2/HASH/SEAL");
        when(offlineQrService.generateInvoiceCode(any()))
                .thenReturn("https://qr-test.ksef.mf.gov.pl/invoice/1234567890/26-05-2026/HASH");
        // apiProperties.getEnvironment() is NOT called in the offline path — no stub needed

        KsefInvoice result = invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null);

        assertThat(result.getStatus()).isEqualTo(KsefInvoiceStatus.OFFLINE_MODE);
        assertThat(result.getLastErrorMessage()).contains("unreachable");
        assertThat(result.getQrCodeInvoice()).isNotNull();
        assertThat(result.getQrCodeCertificate()).isNotNull();

        // UPO must NOT be stored in offline mode
        verify(upoStorageService, never()).storeUpo(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("submitInvoice: offline with NO offline certificate → blocks CODE II (both QR null, compliance error)")
    void submitInvoice_offlineNoOfflineCert_blocksCodeII() {
        KsefInvoice draft = buildDraftInvoice();
        draft.setId(INVOICE_ID);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(draft));
        when(invoiceRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FA3XmlGeneratorService.FA3XmlResult xmlResult =
                new FA3XmlGeneratorService.FA3XmlResult("<Faktura/>", "deadbeef");
        when(xmlGeneratorService.generateXml(any())).thenReturn(xmlResult);
        // KSeF unreachable → falls into offline handling.
        when(authService.openSession(TENANT_ID, NIP))
                .thenThrow(new KsefSubmissionException("KSeF API is unreachable"));
        // No OFFLINE certificate provisioned → CODE II generation must throw, blocking a
        // compliant offline visualization (the auth cert must NOT be substituted).
        when(offlineQrService.generateCertificateCode(any()))
                .thenThrow(new KsefCertificateException("No active OFFLINE-type KSeF certificate"));

        KsefInvoice result = invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null);

        assertThat(result.getStatus()).isEqualTo(KsefInvoiceStatus.OFFLINE_MODE);
        // No fabricated/partial visualization — BOTH QR codes are left empty.
        assertThat(result.getQrCodeInvoice()).isNull();
        assertThat(result.getQrCodeCertificate()).isNull();
        // The compliance block is recorded on the invoice for the UI/audit.
        assertThat(result.getLastErrorMessage()).contains("OFFLINE_CERT_REQUIRED");
    }

    @Test
    @DisplayName("submitInvoice: increments submissionAttempts on each call")
    void submitInvoice_multipleAttempts_incrementsCounter() {
        KsefInvoice draft = buildDraftInvoice();
        draft.setId(INVOICE_ID);
        draft.setSubmissionAttempts(2);

        // Use AtomicInteger to capture the attempt count AT THE MOMENT the PENDING save fires.
        // ArgumentCaptor captures object references — since KsefInvoice is mutable, by the time
        // we verify, the object has been mutated to OFFLINE_MODE. Side-effect capture is correct here.
        AtomicInteger capturedAttempts = new AtomicInteger(-1);

        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(draft));
        when(invoiceRepository.save(any())).thenAnswer(invMock -> {
            KsefInvoice inv = invMock.getArgument(0);
            if (inv.getStatus() == KsefInvoiceStatus.PENDING) {
                capturedAttempts.set(inv.getSubmissionAttempts());
            }
            return inv;
        });

        FA3XmlGeneratorService.FA3XmlResult xmlResult =
                new FA3XmlGeneratorService.FA3XmlResult("<Faktura/>", "abc");
        when(xmlGeneratorService.generateXml(any())).thenReturn(xmlResult);
        when(authService.openSession(TENANT_ID, NIP))
                .thenThrow(new KsefSubmissionException("auth failed"));
        // offlineQrService is a mock; its QR methods return null here, which is fine —
        // we only assert the PENDING-state submissionAttempts counter below.

        invoiceService.submitInvoice(TENANT_ID, INVOICE_ID, NIP, null, null);

        assertThat(capturedAttempts.get()).isEqualTo(3);
    }

    // ── getInvoice ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("getInvoice: returns invoice when tenantId matches")
    void getInvoice_matchingTenant_returnsInvoice() {
        KsefInvoice inv = buildDraftInvoice();
        inv.setId(INVOICE_ID);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        KsefInvoice result = invoiceService.getInvoice(TENANT_ID, INVOICE_ID);
        assertThat(result.getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("getInvoice: throws when invoice belongs to different tenant")
    void getInvoice_differentTenant_throws() {
        KsefInvoice inv = buildDraftInvoice();
        inv.setId(INVOICE_ID);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> invoiceService.getInvoice("other-tenant", INVOICE_ID))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("getInvoice: throws when invoice is soft-deleted")
    void getInvoice_softDeleted_throws() {
        KsefInvoice inv = buildDraftInvoice();
        inv.setId(INVOICE_ID);
        inv.setSoftDeleted(true);
        when(invoiceRepository.findById(INVOICE_ID)).thenReturn(Optional.of(inv));

        assertThatThrownBy(() -> invoiceService.getInvoice(TENANT_ID, INVOICE_ID))
                .isInstanceOf(IllegalArgumentException.class);
    }

    // ── Builder helpers ────────────────────────────────────────────────────────

    private KsefInvoice buildDraftInvoice() {
        KsefInvoice invoice = new KsefInvoice();
        invoice.setTenantId(TENANT_ID);
        invoice.setInvoiceNumber("FV/2026/05/0001");
        invoice.setIssueDate(LocalDate.of(2026, 5, 26));
        invoice.setDueDate(LocalDate.of(2026, 6, 26));
        invoice.setCurrency(KsefCurrency.PLN);
        invoice.setStatus(KsefInvoiceStatus.DRAFT);

        invoice.setSellerName("DSV Corp Sp. z o.o.");
        invoice.setSellerNip("1234567890");
        invoice.setSellerAddress("ul. Testowa 1");
        invoice.setSellerPostalCode("00-001");
        invoice.setSellerCity("Warszawa");

        invoice.setBuyerName("Klient ABC S.A.");
        invoice.setBuyerNip("9876543210");
        invoice.setBuyerAddress("ul. Kupiecka 5");
        invoice.setBuyerPostalCode("30-001");
        invoice.setBuyerCity("Kraków");

        KsefInvoice.InvoiceItem item = new KsefInvoice.InvoiceItem();
        item.setItemId("item-001");
        item.setProductName("Consulting");
        item.setUnit("godz.");
        item.setQuantity(BigDecimal.TEN);
        item.setUnitPrice(new BigDecimal("100.00"));
        item.setVatRate(KsefVatRate.VAT_23);
        item.setNetAmount(new BigDecimal("1000.00"));
        item.setVatAmount(new BigDecimal("230.00"));
        item.setGrossAmount(new BigDecimal("1230.00"));

        invoice.setItems(List.of(item));
        invoice.setTotalNet(new BigDecimal("1000.00"));
        invoice.setTotalVat(new BigDecimal("230.00"));
        invoice.setTotalGross(new BigDecimal("1230.00"));
        invoice.setPaymentMethod(KsefPaymentMethod.TRANSFER);
        invoice.setSubmissionAttempts(0);
        invoice.setSoftDeleted(false);

        return invoice;
    }
}
