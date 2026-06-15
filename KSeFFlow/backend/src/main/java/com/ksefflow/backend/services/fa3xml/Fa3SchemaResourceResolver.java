package com.ksefflow.backend.services.fa3xml;

import org.w3c.dom.ls.LSInput;
import org.w3c.dom.ls.LSResourceResolver;

import java.io.InputStream;
import java.io.Reader;

// SIMPLE EXPLANATION:
// The official FA(3) schema file says "import some other schema files from crd.gov.pl".
// We do NOT want our app to call the internet while checking an invoice.
// So when the schema reader asks for one of those files, this class hands it the
// SAME file that we already saved inside the app (in resources/xsd/fa3/).
// This makes the FA(3) check work fully offline.
public class Fa3SchemaResourceResolver implements LSResourceResolver {

    // The folder inside the app where the official FA(3) schema files live.
    private static final String LOCAL_DIR = "/xsd/fa3/";

    @Override
    public LSInput resolveResource(String type, String namespaceURI, String publicId,
                                   String systemId, String baseURI) {
        if (systemId == null) {
            return null;
        }
        // Take only the file name from the web address. Example:
        // "http://crd.gov.pl/.../StrukturyDanych_v10-0E.xsd" -> "StrukturyDanych_v10-0E.xsd"
        String fileName = systemId.substring(systemId.lastIndexOf('/') + 1);

        InputStream localFile = getClass().getResourceAsStream(LOCAL_DIR + fileName);
        if (localFile == null) {
            // We do not have this file saved locally. Return null on purpose so the
            // check fails loudly — we never secretly download it from the internet.
            return null;
        }
        return new ClasspathInput(publicId, systemId, baseURI, localFile);
    }

    // A small box that gives the schema reader the bytes of one local file.
    // The reader only really needs the byte stream; the other fields just describe it.
    static final class ClasspathInput implements LSInput {
        private String publicId;
        private String systemId;
        private String baseURI;
        private InputStream byteStream;

        ClasspathInput(String publicId, String systemId, String baseURI, InputStream byteStream) {
            this.publicId = publicId;
            this.systemId = systemId;
            this.baseURI = baseURI;
            this.byteStream = byteStream;
        }

        @Override public InputStream getByteStream() { return byteStream; }
        @Override public void setByteStream(InputStream byteStream) { this.byteStream = byteStream; }
        @Override public String getSystemId() { return systemId; }
        @Override public void setSystemId(String systemId) { this.systemId = systemId; }
        @Override public String getPublicId() { return publicId; }
        @Override public void setPublicId(String publicId) { this.publicId = publicId; }
        @Override public String getBaseURI() { return baseURI; }
        @Override public void setBaseURI(String baseURI) { this.baseURI = baseURI; }

        // Not needed for our case — we always use the byte stream above.
        @Override public Reader getCharacterStream() { return null; }
        @Override public void setCharacterStream(Reader characterStream) { }
        @Override public String getStringData() { return null; }
        @Override public void setStringData(String stringData) { }
        @Override public String getEncoding() { return null; }
        @Override public void setEncoding(String encoding) { }
        @Override public boolean getCertifiedText() { return false; }
        @Override public void setCertifiedText(boolean certifiedText) { }
    }
}
