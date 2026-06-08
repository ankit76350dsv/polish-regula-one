package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.exceptions.KsefAuthException;
import lombok.extern.slf4j.Slf4j;
import org.apache.xml.security.Init;
import org.apache.xml.security.algorithms.MessageDigestAlgorithm;
import org.apache.xml.security.c14n.Canonicalizer;
import org.apache.xml.security.signature.XMLSignature;
import org.apache.xml.security.transforms.Transforms;
import org.apache.xml.security.utils.Constants;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Base64;

/**
 * Produces a XAdES-BES <b>enveloped</b> signature over the KSeF 2.0
 * {@code AuthTokenRequest} document, as required by {@code POST /auth/xades-signature}.
 *
 * <p>What it builds (Apache Santuario / XML-DSig + ETSI XAdES v1.3.2):
 * <ul>
 *   <li>Canonicalisation: Exclusive C14N; SignatureMethod: RSA-SHA256; DigestMethod: SHA-256.</li>
 *   <li>Reference {@code URI=""} over the whole document with the
 *       {@code enveloped-signature} transform + exclusive C14N.</li>
 *   <li>A {@code ds:Object} carrying {@code xades:QualifyingProperties} →
 *       {@code SignedProperties} with {@code SigningTime} and {@code SigningCertificate}
 *       (cert SHA-256 digest + IssuerSerial), referenced from {@code SignedInfo} with
 *       {@code Type="http://uri.etsi.org/01903#SignedProperties"} — this is what makes
 *       the signature XAdES-BES rather than plain XML-DSig.</li>
 *   <li>{@code KeyInfo} with the full X.509 signing certificate.</li>
 * </ul>
 *
 * <p><b>Verification note:</b> the exact XAdES profile KSeF accepts must be confirmed
 * against the sandbox ({@code /auth/xades-signature} + {@code GET /auth/{ref}}); on
 * test, self-signed certificates are allowed.
 */
@Slf4j
@Component
public class XAdESSigner {

    private static final String XADES_NS = "http://uri.etsi.org/01903/v1.3.2#";
    private static final String SIGNED_PROPS_TYPE = "http://uri.etsi.org/01903#SignedProperties";

    static {
        // Idempotent — safe to call from a static initialiser and again per instance.
        if (!Init.isInitialized()) {
            Init.init();
        }
    }

    /**
     * Signs {@code unsignedXml} and returns the signed XML string with the enveloped
     * {@code ds:Signature} appended to the document element.
     *
     * @param unsignedXml the AuthTokenRequest XML (from {@link AuthTokenRequestBuilder})
     * @param privateKey  the tenant signing key (from the active certificate)
     * @param certificate the matching public X.509 certificate (placed in KeyInfo)
     */
    public String sign(String unsignedXml, PrivateKey privateKey, X509Certificate certificate) {
        try {
            Document doc = parse(unsignedXml);
            Element root = doc.getDocumentElement();

            final String signatureId = "sig-" + Integer.toHexString(System.identityHashCode(doc));
            final String signedPropsId = signatureId + "-signedprops";

            XMLSignature signature = new XMLSignature(
                    doc, "", XMLSignature.ALGO_ID_SIGNATURE_RSA_SHA256,
                    Canonicalizer.ALGO_ID_C14N_EXCL_OMIT_COMMENTS);
            signature.setId(signatureId);

            // Enveloped: the signature lives inside the document it signs.
            root.appendChild(signature.getElement());

            // ── XAdES qualifying properties (SignedProperties) ───────────────────────
            Element qualifyingProperties = buildQualifyingProperties(
                    doc, signatureId, signedPropsId, certificate);
            // Wrap in a ds:Object and attach to the signature so its Id is resolvable.
            org.apache.xml.security.signature.ObjectContainer object =
                    new org.apache.xml.security.signature.ObjectContainer(doc);
            object.appendChild(qualifyingProperties);
            signature.appendObject(object);

            // ── Reference 1: the whole document (enveloped) ──────────────────────────
            Transforms docTransforms = new Transforms(doc);
            docTransforms.addTransform(Transforms.TRANSFORM_ENVELOPED_SIGNATURE);
            docTransforms.addTransform(Canonicalizer.ALGO_ID_C14N_EXCL_OMIT_COMMENTS);
            signature.addDocument("", docTransforms, MessageDigestAlgorithm.ALGO_ID_DIGEST_SHA256);

            // ── Reference 2: the SignedProperties (XAdES) ────────────────────────────
            Transforms propsTransforms = new Transforms(doc);
            propsTransforms.addTransform(Canonicalizer.ALGO_ID_C14N_EXCL_OMIT_COMMENTS);
            signature.addDocument("#" + signedPropsId, propsTransforms,
                    MessageDigestAlgorithm.ALGO_ID_DIGEST_SHA256, null, SIGNED_PROPS_TYPE);

            // ── KeyInfo: include the signing certificate ─────────────────────────────
            signature.addKeyInfo(certificate);

            // ── Sign ─────────────────────────────────────────────────────────────────
            signature.sign(privateKey);

            return serialize(doc);
        } catch (Exception e) {
            throw new KsefAuthException("Failed to XAdES-sign the AuthTokenRequest: " + e.getMessage(), e);
        }
    }

    // Builds <xades:QualifyingProperties Target="#sig"> with SignedProperties containing
    // SigningTime and SigningCertificate (CertDigest + IssuerSerial).
    private Element buildQualifyingProperties(Document doc, String signatureId,
                                              String signedPropsId, X509Certificate cert) throws Exception {
        Element qualifyingProperties = doc.createElementNS(XADES_NS, "xades:QualifyingProperties");
        qualifyingProperties.setAttributeNS(Constants.NamespaceSpecNS, "xmlns:ds", Constants.SignatureSpecNS);
        qualifyingProperties.setAttribute("Target", "#" + signatureId);

        Element signedProperties = doc.createElementNS(XADES_NS, "xades:SignedProperties");
        signedProperties.setAttribute("Id", signedPropsId);
        // Mark Id as an XML id so the same-document URI "#signedPropsId" resolves.
        signedProperties.setIdAttribute("Id", true);
        qualifyingProperties.appendChild(signedProperties);

        Element ssp = doc.createElementNS(XADES_NS, "xades:SignedSignatureProperties");
        signedProperties.appendChild(ssp);

        // SigningTime (UTC, ISO-8601). Server clock; KSeF tolerates the challenge's 10-min window.
        Element signingTime = doc.createElementNS(XADES_NS, "xades:SigningTime");
        signingTime.setTextContent(java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC)
                .truncatedTo(java.time.temporal.ChronoUnit.SECONDS).toString());
        ssp.appendChild(signingTime);

        // SigningCertificate → Cert → (CertDigest, IssuerSerial)
        Element signingCertificate = doc.createElementNS(XADES_NS, "xades:SigningCertificate");
        ssp.appendChild(signingCertificate);
        Element certEl = doc.createElementNS(XADES_NS, "xades:Cert");
        signingCertificate.appendChild(certEl);

        Element certDigest = doc.createElementNS(XADES_NS, "xades:CertDigest");
        certEl.appendChild(certDigest);
        Element digestMethod = doc.createElementNS(Constants.SignatureSpecNS, "ds:DigestMethod");
        digestMethod.setAttribute("Algorithm", MessageDigestAlgorithm.ALGO_ID_DIGEST_SHA256);
        certDigest.appendChild(digestMethod);
        Element digestValue = doc.createElementNS(Constants.SignatureSpecNS, "ds:DigestValue");
        byte[] certSha256 = MessageDigest.getInstance("SHA-256").digest(cert.getEncoded());
        digestValue.setTextContent(Base64.getEncoder().encodeToString(certSha256));
        certDigest.appendChild(digestValue);

        Element issuerSerial = doc.createElementNS(XADES_NS, "xades:IssuerSerial");
        certEl.appendChild(issuerSerial);
        Element issuerName = doc.createElementNS(Constants.SignatureSpecNS, "ds:X509IssuerName");
        issuerName.setTextContent(cert.getIssuerX500Principal().getName());
        issuerSerial.appendChild(issuerName);
        Element serialNumber = doc.createElementNS(Constants.SignatureSpecNS, "ds:X509SerialNumber");
        serialNumber.setTextContent(cert.getSerialNumber().toString());
        issuerSerial.appendChild(serialNumber);

        return qualifyingProperties;
    }

    private static Document parse(String xml) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return dbf.newDocumentBuilder().parse(
                new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    private static String serialize(Document doc) throws Exception {
        TransformerFactory tf = TransformerFactory.newInstance();
        Transformer t = tf.newTransformer();
        t.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        StringWriter sw = new StringWriter();
        t.transform(new DOMSource(doc), new StreamResult(sw));
        return sw.toString();
    }
}
