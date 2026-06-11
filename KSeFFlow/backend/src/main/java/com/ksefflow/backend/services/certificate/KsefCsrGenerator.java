package com.ksefflow.backend.services.certificate;

import com.ksefflow.backend.dto.ksefapi.CertificateEnrollmentDataResponse;
import com.ksefflow.backend.exceptions.KsefCertificateException;
import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.asn1.x500.X500NameBuilder;
import org.bouncycastle.asn1.x500.style.BCStyle;
import org.bouncycastle.operator.ContentSigner;
import org.bouncycastle.operator.jcajce.JcaContentSignerBuilder;
import org.bouncycastle.pkcs.PKCS10CertificationRequest;
import org.bouncycastle.pkcs.jcajce.JcaPKCS10CertificationRequestBuilder;
import org.springframework.stereotype.Component;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;

// SIMPLE EXPLANATION:
// To get a KSeF certificate, we must send KSeF a "certificate signing request" (CSR). A CSR is
// a small signed document that says "here is my public key and who I am — please issue me a
// certificate". We make a brand-new key pair (a private key we keep secret + a public key we
// put in the CSR), fill in the identity fields EXACTLY as KSeF told us to, and sign the CSR
// with our own private key to prove we own it.
//
// The Java standard library cannot build a CSR, so we use BouncyCastle (a well-known crypto
// library). We sign with SHA-256 + RSA, which KSeF accepts.
@Slf4j
@Component
public class KsefCsrGenerator {

    // RSA key size. 2048 bits is the modern minimum and is accepted by KSeF.
    private static final int RSA_KEY_SIZE = 2048;
    private static final String SIGNATURE_ALGORITHM = "SHA256withRSA";

    // The result: the private key we MUST keep (it pairs with the certificate KSeF will issue)
    // and the CSR itself, already Base64-encoded DER, ready to send to KSeF.
    public record CsrResult(KeyPair keyPair, String csrDerBase64) {}

    /**
     * Builds a fresh key pair and a PKCS#10 CSR whose subject is filled in from the data KSeF
     * returned at GET /certificates/enrollments/data. We must use those exact values.
     */
    public CsrResult generate(CertificateEnrollmentDataResponse data) {
        try {
            // 1. Make a new RSA key pair (private key stays with us, public key goes in the CSR).
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
            kpg.initialize(RSA_KEY_SIZE);
            KeyPair keyPair = kpg.generateKeyPair();

            // 2. Build the "subject" (who this certificate is for) from KSeF's data. We add each
            //    field only if KSeF gave us a value for it.
            X500NameBuilder subject = new X500NameBuilder(BCStyle.INSTANCE);
            addIfPresent(subject, BCStyle.CN, data.commonName());
            addIfPresent(subject, BCStyle.C, data.countryName());
            addIfPresent(subject, BCStyle.O, data.organizationName());
            addIfPresent(subject, BCStyle.ORGANIZATION_IDENTIFIER, data.organizationIdentifier());
            addIfPresent(subject, BCStyle.GIVENNAME, data.givenName());
            addIfPresent(subject, BCStyle.SURNAME, data.surname());
            addIfPresent(subject, BCStyle.SERIALNUMBER, data.serialNumber());
            // NOTE: uniqueIdentifier is intentionally not added as a subject RDN — in X.500 it is a
            // BIT STRING attribute, not a plain text field, and KSeF marks it optional. The required
            // identity (CN, O, organizationIdentifier, serialNumber) above is what KSeF matches on.

            // 3. Build and sign the CSR with our private key.
            JcaPKCS10CertificationRequestBuilder csrBuilder =
                    new JcaPKCS10CertificationRequestBuilder(subject.build(), keyPair.getPublic());
            ContentSigner signer = new JcaContentSignerBuilder(SIGNATURE_ALGORITHM).build(keyPair.getPrivate());
            PKCS10CertificationRequest csr = csrBuilder.build(signer);

            // 4. Encode the CSR as DER bytes, then Base64 — the format KSeF expects.
            String csrBase64 = Base64.getEncoder().encodeToString(csr.getEncoded());
            log.info("[generate]:1 Built PKCS#10 CSR for subject CN=[{}] ({} bytes DER)",
                    data.commonName(), csr.getEncoded().length);
            return new CsrResult(keyPair, csrBase64);
        } catch (Exception e) {
            throw new KsefCertificateException("Could not build the certificate signing request (CSR): "
                    + e.getMessage(), e);
        }
    }

    // Adds one subject field, but only when KSeF actually provided a value.
    private void addIfPresent(X500NameBuilder builder,
                              org.bouncycastle.asn1.ASN1ObjectIdentifier field, String value) {
        if (value != null && !value.isBlank()) {
            builder.addRDN(field, value);
        }
    }
}
