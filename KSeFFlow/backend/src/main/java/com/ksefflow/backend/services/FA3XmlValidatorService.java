package com.ksefflow.backend.services;

import com.ksefflow.backend.services.fa3xmlutils.FA3XmlValidator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

// Spring @Service facade over the static FA3XmlValidator utility.
//
// FA3XmlValidator is a stateless final class with static methods — it has no
// Spring dependencies and cannot be @Autowired. This wrapper makes it injectable
// as a bean so KSeFInvoiceService can call it through a constructor-injected dependency
// (which enables clean Mockito mocking in unit tests).
//
// Two modes:
//   validate(xml)         — dev/non-strict: missing XSD logs a warning and continues
//   validateStrict(xml)   — production: missing XSD is a hard error; used before submission
@Service
@Slf4j
public class FA3XmlValidatorService {

    // Pre-submission strict validation — call this in KSeFInvoiceService before
    // sending to the government API. KSeF counts rejected submissions against the
    // company's compliance score, so we never send without local validation passing.
    public void validateStrict(String xml) {
        log.debug("Running strict FA(3) XML validation before KSeF submission");
        FA3XmlValidator.validate(xml, true);
        log.debug("Strict FA(3) XML validation passed");
    }

    // Non-strict validation — used during invoice creation/preview in dev.
    // Missing XSD logs a warning instead of throwing.
    public void validate(String xml) {
        FA3XmlValidator.validate(xml, false);
    }
}
