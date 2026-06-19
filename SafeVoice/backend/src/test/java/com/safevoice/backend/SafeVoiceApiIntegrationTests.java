package com.safevoice.backend;

import tools.jackson.databind.ObjectMapper;
import com.safevoice.backend.dto.CaseRetrievalRequest;
import com.safevoice.backend.dto.CaseSubmissionRequest;
import com.safevoice.backend.dto.CaseSubmissionResponse;
import com.safevoice.backend.model.document.CaseMessage;
import com.safevoice.backend.model.document.CaseReport;
import com.safevoice.backend.model.enums.case_report.DisclosureMode;
import com.safevoice.backend.model.enums.case_report.IntakeChannel;
import com.safevoice.backend.model.enums.case_report.ReportCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SafeVoiceApiIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        mongoTemplate.dropCollection("case_reports");
        mongoTemplate.dropCollection("case_messages");
        mongoTemplate.dropCollection("audit_logs");
        mongoTemplate.dropCollection("tenant_keys");
    }

    @Test
    void testStandardWhistleblowerSubmissionAndRetrieval() throws Exception {
        CaseSubmissionRequest submission = new CaseSubmissionRequest();
        submission.setCategory(ReportCategory.CORRUPTION);
        submission.setDescription("Bribe taken in procurement dept");
        submission.setIncidentDate(Instant.now());
        submission.setDepartment("Procurement");
        submission.setDisclosureMode(DisclosureMode.ANONYMOUS);
        submission.setIntakeChannel(IntakeChannel.ANONYMOUS_WEB_PORTAL);

        // 1. Submit Case
        MvcResult submitResult = mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases")
                        .header("X-Tenant-ID", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.trackingCode", notNullValue()))
                .andExpect(jsonPath("$.pin", notNullValue()))
                .andExpect(jsonPath("$.disclosureMode", is("ANONYMOUS")))
                .andReturn();

        CaseSubmissionResponse response = objectMapper.readValue(
                submitResult.getResponse().getContentAsString(),
                CaseSubmissionResponse.class
        );

        // 2. Retrieve Case with correct PIN
        CaseRetrievalRequest retrieval = new CaseRetrievalRequest();
        retrieval.setTrackingCode(response.getTrackingCode());
        retrieval.setPin(response.getPin());

        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases/retrieve")
                        .header("X-Tenant-ID", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retrieval)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(response.getId().toString())))
                .andExpect(jsonPath("$.trackingCode", is(response.getTrackingCode())))
                .andExpect(jsonPath("$.description", is("Bribe taken in procurement dept")));

        // 3. Retrieve Case with INCORRECT PIN
        CaseRetrievalRequest badRetrieval = new CaseRetrievalRequest();
        badRetrieval.setTrackingCode(response.getTrackingCode());
        badRetrieval.setPin("wrongpin");

        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases/retrieve")
                        .header("X-Tenant-ID", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(badRetrieval)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void testLabourDisputeSubmissionAndRetrieval() throws Exception {
        CaseSubmissionRequest submission = new CaseSubmissionRequest();
        submission.setCategory(ReportCategory.LABOUR_DISPUTE); // Trigger rule
        submission.setDescription("Salary payment dispute");
        submission.setDisclosureMode(DisclosureMode.ANONYMOUS);
        submission.setIntakeChannel(IntakeChannel.HR_GRIEVANCE_HANDOFF);

        // 1. Submit Dispute Report (PIN must be null, Mode forced to HR_HANDOFF)
        MvcResult submitResult = mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases")
                        .header("X-Tenant-ID", "tenant-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pin", nullValue()))
                .andExpect(jsonPath("$.disclosureMode", is("HR_HANDOFF")))
                .andReturn();

        CaseSubmissionResponse response = objectMapper.readValue(
                submitResult.getResponse().getContentAsString(),
                CaseSubmissionResponse.class
        );

        // 2. Retrieve Dispute (does not enforce PIN matching because PIN is not generated)
        CaseRetrievalRequest retrieval = new CaseRetrievalRequest();
        retrieval.setTrackingCode(response.getTrackingCode());

        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases/retrieve")
                        .header("X-Tenant-ID", "tenant-2")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(retrieval)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(response.getId().toString())))
                .andExpect(jsonPath("$.description", is("Salary payment dispute")));
    }

    @Test
    void testChatMessagesExchangeAndAudits() throws Exception {
        // Setup a case
        CaseSubmissionRequest submission = new CaseSubmissionRequest();
        submission.setCategory(ReportCategory.FRAUD);
        submission.setDescription("Fraud investigation case");
        submission.setDisclosureMode(DisclosureMode.ANONYMOUS);
        submission.setIntakeChannel(IntakeChannel.ANONYMOUS_WEB_PORTAL);

        MvcResult submitResult = mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases")
                        .header("X-Tenant-ID", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andReturn();
        CaseSubmissionResponse caseInfo = objectMapper.readValue(
                submitResult.getResponse().getContentAsString(),
                CaseSubmissionResponse.class
        );

        // 1. Reporter posts chat message
        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases/" + caseInfo.getId() + "/messages")
                        .header("X-Tenant-ID", "tenant-1")
                        .param("trackingCode", caseInfo.getTrackingCode())
                        .param("pin", caseInfo.getPin())
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("This is additional context from the reporter."))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sender", is("Reporter")))
                .andExpect(jsonPath("$.text", is("This is additional context from the reporter.")))
                .andExpect(jsonPath("$.readByReporter", is(true)))
                .andExpect(jsonPath("$.readByAdmin", is(false)));

        // 2. Investigator posts chat message
        mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/internal/cases/" + caseInfo.getId() + "/messages")
                        .header("X-Tenant-ID", "tenant-1")
                        .header("X-Actor-Role", "Investigator")
                        .header("X-Actor-ID", "inv-456")
                        .contentType(MediaType.TEXT_PLAIN)
                        .content("We are reviewing the report details."))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sender", is("Investigator")))
                .andExpect(jsonPath("$.text", is("We are reviewing the report details.")))
                .andExpect(jsonPath("$.readByReporter", is(false)))
                .andExpect(jsonPath("$.readByAdmin", is(true)));

        // 3. Reporter retrieves chat stream
        mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/public/cases/" + caseInfo.getId() + "/messages")
                        .header("X-Tenant-ID", "tenant-1")
                        .param("trackingCode", caseInfo.getTrackingCode())
                        .param("pin", caseInfo.getPin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].sender", is("Reporter")))
                .andExpect(jsonPath("$[1].sender", is("Investigator")));
    }

    @Test
    void testSecureAttachmentUploadAndDownload() throws Exception {
        // Setup a case
        CaseSubmissionRequest submission = new CaseSubmissionRequest();
        submission.setCategory(ReportCategory.CYBERSECURITY);
        submission.setDescription("Database leak evidence");
        submission.setDisclosureMode(DisclosureMode.ANONYMOUS);
        submission.setIntakeChannel(IntakeChannel.ANONYMOUS_WEB_PORTAL);

        MvcResult submitResult = mockMvc.perform(MockMvcRequestBuilders.post("/api/v1/public/cases")
                        .header("X-Tenant-ID", "tenant-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andReturn();
        CaseSubmissionResponse caseInfo = objectMapper.readValue(
                submitResult.getResponse().getContentAsString(),
                CaseSubmissionResponse.class
        );

        // 1. Upload mock valid PDF file
        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "evidence_doc.pdf",
                MediaType.APPLICATION_PDF_VALUE,
                "Cybersecurity breach evidence files data content bytes".getBytes()
        );

        MvcResult uploadResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/v1/public/cases/" + caseInfo.getId() + "/attachments")
                        .file(mockFile)
                        .header("X-Tenant-ID", "tenant-1")
                        .param("trackingCode", caseInfo.getTrackingCode())
                        .param("pin", caseInfo.getPin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName", is("evidence_doc.pdf")))
                .andExpect(jsonPath("$.extension", is("PDF")))
                .andExpect(jsonPath("$.metadataStripped", is(true)))
                .andExpect(jsonPath("$.sha256Checksum", notNullValue()))
                .andReturn();

        CaseReport updatedReport = caseReportServiceGet(caseInfo.getId(), "tenant-1");
        assertEquals(1, updatedReport.getAttachments().size());
        UUID attachmentId = updatedReport.getAttachments().get(0).getId();

        // 2. Reject uploading invalid extension (EXE file)
        MockMultipartFile maliciousFile = new MockMultipartFile(
                "file",
                "attack.exe",
                MediaType.APPLICATION_OCTET_STREAM_VALUE,
                "malware payload bytes".getBytes()
        );

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/v1/public/cases/" + caseInfo.getId() + "/attachments")
                        .file(maliciousFile)
                        .header("X-Tenant-ID", "tenant-1")
                        .param("trackingCode", caseInfo.getTrackingCode())
                        .param("pin", caseInfo.getPin()))
                .andExpect(status().isBadRequest());

        // 3. Download the uploaded valid attachment securely
        mockMvc.perform(MockMvcRequestBuilders.get("/api/v1/internal/cases/" + caseInfo.getId() + "/attachments/" + attachmentId)
                        .header("X-Tenant-ID", "tenant-1"))
                .andExpect(status().isOk())
                .andExpect(result -> assertEquals("Cybersecurity breach evidence files data content bytes", result.getResponse().getContentAsString()));
    }

    private CaseReport caseReportServiceGet(UUID id, String tenantId) {
        return mongoTemplate.findById(id, CaseReport.class);
    }
}
