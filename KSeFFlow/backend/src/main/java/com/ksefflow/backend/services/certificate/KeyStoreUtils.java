package com.ksefflow.backend.services.certificate;

import com.ksefflow.backend.exceptions.KsefCertificateException;

import java.io.ByteArrayInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Enumeration;

// Pure static helpers for PKCS12 / X509 operations.
// No Spring context needed — all methods are stateless.
public final class KeyStoreUtils {

    private KeyStoreUtils() {
    }

    // Opens a PKCS12 KeyStore from raw .pfx bytes using the supplied password.
    // Throws KsefCertificateException if the file is invalid or the password is
    // wrong.
    public static KeyStore loadKeyStoreFromBytes(byte[] pfxBytes, String password) {
        try {
            // Inside a .pfx file there is usually:
                // Public certificate
                // Private key
                // Certificate chain
                // Metadataf
            KeyStore ks = KeyStore.getInstance("PKCS12"); //! Creates an empty PKCS12 keystore object.
            ks.load(new ByteArrayInputStream(pfxBytes), password.toCharArray());
            return ks;
        } catch (Exception e) {
            throw new KsefCertificateException(
                    "Invalid .pfx file or wrong password: " + e.getMessage(), e);
        }
    }

    // Finds and returns the first X509Certificate inside the KeyStore.
    // Iterates all aliases — works regardless of what alias name was used when
    // creating the .pfx.
    public static X509Certificate extractX509Certificate(KeyStore keyStore) {
        try {
            Enumeration<String> aliases = keyStore.aliases();
            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();
                //! finding the certificate 
                if (keyStore.isCertificateEntry(alias) || keyStore.isKeyEntry(alias)) {
                    //! get the certificate
                    java.security.cert.Certificate cert = keyStore.getCertificate(alias);
                    //! X509 is the standard format for digital certificates.
                    if (cert instanceof X509Certificate x509) { 
                        return x509;
                    }
                }
            }
            throw new KsefCertificateException(
                    "No X509Certificate found in the provided .pfx file");
        } catch (KsefCertificateException kce) {
            throw kce;
        } catch (Exception e) {
            throw new KsefCertificateException(
                    "Failed to extract X509Certificate: " + e.getMessage(), e);
        }
    }

    //! Finds and returns the PrivateKey inside the KeyStore.
    // The password is needed a second time here — Java requires it to unlock the key entry.
    public static PrivateKey extractPrivateKey(KeyStore keyStore, String password) {
        try {
            Enumeration<String> aliases = keyStore.aliases();
            while (aliases.hasMoreElements()) {
                String alias = aliases.nextElement();
                if (keyStore.isKeyEntry(alias)) {
                    return (PrivateKey) keyStore.getKey(alias, password.toCharArray());
                }
            }
            throw new KsefCertificateException(
                    "No private key found in the provided .pfx file");
        } catch (KsefCertificateException kce) {
            throw kce;
        } catch (Exception e) {
            throw new KsefCertificateException(
                    "Failed to extract private key: " + e.getMessage(), e);
        }
    }

    // Converts a legacy java.util.Date (returned by
    // X509Certificate.getNotBefore/getNotAfter)
    // to a modern LocalDate using the system default timezone.
    public static LocalDate toLocalDate(java.util.Date date) {
        return date.toInstant().atZone(ZoneId.systemDefault()).toLocalDate();
    }
}
