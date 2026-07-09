package com.safevoice.backend.service.crypto;

import com.safevoice.backend.dto.DataKeyResponse;
import com.safevoice.backend.exception.CryptoOperationException;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.kms.KmsClient;
import software.amazon.awssdk.services.kms.model.DataKeySpec;
import software.amazon.awssdk.services.kms.model.DecryptRequest;
import software.amazon.awssdk.services.kms.model.DecryptResponse;
import software.amazon.awssdk.services.kms.model.GenerateDataKeyRequest;
import software.amazon.awssdk.services.kms.model.GenerateDataKeyResponse;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the envelope-encryption service — the ONLY place that talks to AWS KMS.
 * The KMS client is mocked, so these tests verify OUR logic: the right request shape (key spec,
 * encryption context), correct Base64 handling, and safe failure behaviour. No real AWS calls.
 */
@ExtendWith(MockitoExtension.class)
class EnvelopeEncryptionServiceTest {

    private static final String KEY_ARN =
            "arn:aws:kms:eu-central-1:864456252731:key/5ded0d5b-2a18-42b0-8394-0ccb28f6d347";

    @Mock
    private KmsClient kmsClient;

    private EnvelopeEncryptionService service() {
        return new EnvelopeEncryptionService(kmsClient, KEY_ARN);
    }

    @Test
    void generateDataKey_returnsBase64KeysAndBindsTenantContext() {
        byte[] plainKey = "0123456789abcdef0123456789abcdef".getBytes(); // 32 bytes = AES-256
        byte[] wrapped = "wrapped-blob-bytes".getBytes();
        when(kmsClient.generateDataKey(any(GenerateDataKeyRequest.class))).thenReturn(
                GenerateDataKeyResponse.builder()
                        .plaintext(SdkBytes.fromByteArray(plainKey))
                        .ciphertextBlob(SdkBytes.fromByteArray(wrapped))
                        .keyId(KEY_ARN)
                        .build());

        DataKeyResponse response = service().generateDataKey("acme");

        // The plain + wrapped keys come back as Base64 of the original bytes.
        assertThat(Base64.getDecoder().decode(response.getPlaintextKey())).isEqualTo(plainKey);
        assertThat(Base64.getDecoder().decode(response.getWrappedKey())).isEqualTo(wrapped);
        assertThat(response.getKmsKeyId()).isEqualTo(KEY_ARN);
        assertThat(response.getAlgorithm()).isEqualTo("AES-256-GCM");

        // Verify the request we sent KMS: AES-256 key, our master key, tenant-bound context.
        ArgumentCaptor<GenerateDataKeyRequest> captor = ArgumentCaptor.forClass(GenerateDataKeyRequest.class);
        org.mockito.Mockito.verify(kmsClient).generateDataKey(captor.capture());
        GenerateDataKeyRequest req = captor.getValue();
        assertThat(req.keyId()).isEqualTo(KEY_ARN);
        assertThat(req.keySpec()).isEqualTo(DataKeySpec.AES_256);
        assertThat(req.encryptionContext())
                .containsEntry("tenantId", "acme")
                .containsEntry("purpose", "safevoice-report");
    }

    @Test
    void unwrapDataKey_returnsBase64PlainKeyAndUsesSameContext() {
        byte[] plainKey = "0123456789abcdef0123456789abcdef".getBytes();
        String wrappedB64 = Base64.getEncoder().encodeToString("wrapped".getBytes());
        when(kmsClient.decrypt(any(DecryptRequest.class))).thenReturn(
                DecryptResponse.builder().plaintext(SdkBytes.fromByteArray(plainKey)).build());

        String result = service().unwrapDataKey("acme", wrappedB64);

        assertThat(Base64.getDecoder().decode(result)).isEqualTo(plainKey);

        ArgumentCaptor<DecryptRequest> captor = ArgumentCaptor.forClass(DecryptRequest.class);
        org.mockito.Mockito.verify(kmsClient).decrypt(captor.capture());
        DecryptRequest req = captor.getValue();
        assertThat(req.keyId()).isEqualTo(KEY_ARN);
        assertThat(req.encryptionContext())
                .containsEntry("tenantId", "acme")
                .containsEntry("purpose", "safevoice-report");
        // The ciphertext blob we asked KMS to unwrap must be the decoded wrapped key.
        assertThat(req.ciphertextBlob().asByteArray()).isEqualTo("wrapped".getBytes());
    }

    @Test
    void generateDataKey_rejectsBlankTenant() {
        assertThatThrownBy(() -> service().generateDataKey("  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unwrapDataKey_rejectsBlankWrappedKey() {
        assertThatThrownBy(() -> service().unwrapDataKey("acme", "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void operations_failWhenNoMasterKeyConfigured() {
        EnvelopeEncryptionService unconfigured = new EnvelopeEncryptionService(kmsClient, "");
        assertThat(unconfigured.isConfigured()).isFalse();
        assertThatThrownBy(() -> unconfigured.generateDataKey("acme"))
                .isInstanceOf(CryptoOperationException.class);
        assertThatThrownBy(() -> unconfigured.unwrapDataKey("acme", "x"))
                .isInstanceOf(CryptoOperationException.class);
    }

    @Test
    void generateDataKey_wrapsKmsFailureAsNeutralCryptoError() {
        when(kmsClient.generateDataKey(any(GenerateDataKeyRequest.class)))
                .thenThrow(new RuntimeException("boom from AWS"));
        assertThatThrownBy(() -> service().generateDataKey("acme"))
                .isInstanceOf(CryptoOperationException.class)
                // The neutral message must NOT leak the underlying AWS detail.
                .hasMessageNotContaining("boom");
    }

    @Test
    void isConfigured_trueWhenKeyPresent() {
        assertThat(service().isConfigured()).isTrue();
    }
}
