package com.ksefflow.backend.config;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.convert.converter.Converter;

import java.time.LocalDate;
import java.util.TimeZone;

import static org.assertj.core.api.Assertions.assertThat;

// Proves the date is stored as plain text "yyyy-MM-dd" and NEVER shifts by a day,
// no matter which timezone the server runs in (India, UTC, or Poland).
class MongoDateConfigTest {

    private final Converter<LocalDate, String> toString =
            new MongoDateConfig.LocalDateToStringConverter();
    private final Converter<String, LocalDate> toDate =
            new MongoDateConfig.StringToLocalDateConverter();

    private final TimeZone original = TimeZone.getDefault();

    @AfterEach
    void restoreTimezone() {
        TimeZone.setDefault(original);
    }

    @Test
    @DisplayName("LocalDate is written as an ISO yyyy-MM-dd string")
    void writesIsoString() {
        assertThat(toString.convert(LocalDate.of(2026, 6, 4))).isEqualTo("2026-06-04");
    }

    @Test
    @DisplayName("Round-trip keeps the EXACT same day in IST, UTC and CET")
    void noDateShiftAcrossTimezones() {
        LocalDate original = LocalDate.of(2026, 6, 4);

        for (String tz : new String[] { "Asia/Kolkata", "UTC", "Europe/Warsaw" }) {
            TimeZone.setDefault(TimeZone.getTimeZone(tz));

            String stored = toString.convert(original);
            LocalDate readBack = toDate.convert(stored);

            // Text is identical everywhere…
            assertThat(stored).as("stored text in %s", tz).isEqualTo("2026-06-04");
            // …and the day never moves.
            assertThat(readBack).as("read-back date in %s", tz).isEqualTo(original);
        }
    }

    @Test
    @DisplayName("A date written in IST reads back as the SAME day in UTC")
    void crossTimezoneWriteThenRead() {
        LocalDate issueDate = LocalDate.of(2026, 1, 1); // a New-Year edge case

        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        String stored = toString.convert(issueDate);

        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        LocalDate readBack = toDate.convert(stored);

        assertThat(readBack).isEqualTo(LocalDate.of(2026, 1, 1));
    }
}
