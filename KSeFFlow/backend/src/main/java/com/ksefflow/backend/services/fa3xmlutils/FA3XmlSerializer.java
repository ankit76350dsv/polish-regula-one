package com.ksefflow.backend.services.fa3xmlutils;

import com.ksefflow.backend.exceptions.KsefXmlGenerationException;
import org.w3c.dom.Document;

import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;

// Converts a DOM Document to a UTF-8 XML string.
//
// Output characteristics:
// - XML declaration: <?xml version="1.0" encoding="UTF-8"?>
// - Pretty-printed with 2-space indentation for readability and audit tracing
// - Namespace declared on root element (Faktura)
// - No DOCTYPE — KSeF does not use DTD validation
//
// All pure static — no Spring context, no I/O side effects.
public final class FA3XmlSerializer {

    private FA3XmlSerializer() {}

    public static String serialize(Document doc) {
        try {
            TransformerFactory factory = TransformerFactory.newInstance();

            // Disable external entity/stylesheet processing — OWASP XXE prevention
            factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalDTD", "");
            factory.setAttribute("http://javax.xml.XMLConstants/property/accessExternalStylesheet", "");

            Transformer transformer = factory.newTransformer();
            transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
            transformer.setOutputProperty(OutputKeys.INDENT, "yes");
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
            transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");

            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(doc), new StreamResult(writer));
            return writer.toString();

        } catch (Exception e) {
            throw new KsefXmlGenerationException(
                    "Failed to serialize FA(3) DOM Document to XML string: " + e.getMessage(), e);
        }
    }
}
