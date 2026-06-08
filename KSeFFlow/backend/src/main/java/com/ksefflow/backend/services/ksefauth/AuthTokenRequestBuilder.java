package com.ksefflow.backend.services.ksefauth;

import com.ksefflow.backend.exceptions.KsefAuthException;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;

/**
 * Builds the KSeF 2.0 {@code AuthTokenRequest} XML document (namespace
 * {@code http://ksef.mf.gov.pl/auth/token/2.0}) that is XAdES-signed and posted to
 * {@code POST /auth/xades-signature}.
 *
 * Structure (per AuthTokenRequest.xsd):
 * <pre>{@code
 * <AuthTokenRequest xmlns="http://ksef.mf.gov.pl/auth/token/2.0">
 *   <Challenge>20260608-CR-AB12CD34EF-1122334455-AB</Challenge>
 *   <ContextIdentifier><Nip>1234567890</Nip></ContextIdentifier>
 *   <SubjectIdentifierType>certificateSubject</SubjectIdentifierType>
 * </AuthTokenRequest>
 * }</pre>
 *
 * The authenticating subject (NIP/PESEL/fingerprint) is read by KSeF from the signing
 * certificate, so {@code certificateSubject} is the default subject-identifier type.
 */
public final class AuthTokenRequestBuilder {

    public static final String AUTH_NAMESPACE = "http://ksef.mf.gov.pl/auth/token/2.0";

    // Subject identity is taken from the certificate (NIP/PESEL in the subject DN).
    public static final String SUBJECT_CERTIFICATE_SUBJECT = "certificateSubject";
    // Subject identity is taken from the certificate SHA-1 fingerprint registered in KSeF.
    public static final String SUBJECT_CERTIFICATE_FINGERPRINT = "certificateFingerprint";

    private AuthTokenRequestBuilder() {
    }

    /**
     * Builds an unsigned {@code AuthTokenRequest} XML for a NIP context using the
     * {@code certificateSubject} identification method.
     *
     * @param challenge the value returned by POST /auth/challenge (10-minute lifetime)
     * @param nip       the 10-digit NIP context the session acts for
     * @return the serialized, unsigned XML ready to be XAdES-signed
     */
    public static String buildForNip(String challenge, String nip) {
        return buildForNip(challenge, nip, SUBJECT_CERTIFICATE_SUBJECT);
    }

    public static String buildForNip(String challenge, String nip, String subjectIdentifierType) {
        if (challenge == null || challenge.isBlank()) {
            throw new KsefAuthException("Cannot build AuthTokenRequest — challenge is missing");
        }
        if (nip == null || !nip.matches("\\d{10}")) {
            throw new KsefAuthException("Cannot build AuthTokenRequest — NIP must be exactly 10 digits");
        }
        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(true);
            // Harden the parser (defence in depth, even though we only build here).
            dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            Document doc = dbf.newDocumentBuilder().newDocument();

            Element root = doc.createElementNS(AUTH_NAMESPACE, "AuthTokenRequest");
            doc.appendChild(root);

            Element challengeEl = doc.createElementNS(AUTH_NAMESPACE, "Challenge");
            challengeEl.setTextContent(challenge);
            root.appendChild(challengeEl);

            Element ctx = doc.createElementNS(AUTH_NAMESPACE, "ContextIdentifier");
            Element nipEl = doc.createElementNS(AUTH_NAMESPACE, "Nip");
            nipEl.setTextContent(nip);
            ctx.appendChild(nipEl);
            root.appendChild(ctx);

            Element subjType = doc.createElementNS(AUTH_NAMESPACE, "SubjectIdentifierType");
            subjType.setTextContent(subjectIdentifierType);
            root.appendChild(subjType);

            return serialize(doc);
        } catch (KsefAuthException e) {
            throw e;
        } catch (Exception e) {
            throw new KsefAuthException("Failed to build AuthTokenRequest XML: " + e.getMessage(), e);
        }
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
