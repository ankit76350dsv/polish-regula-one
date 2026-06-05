package com.ksefflow.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.convert.WritingConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Makes MongoDB store a calendar date as plain text.
 *
 * SIMPLE EXPLANATION (like for a 5th grader):
 *   A date like "2026-06-04" should mean just that day — no clock, no timezone.
 *   By default, MongoDB saves a date together with a time and a timezone. When a
 *   different computer (in another country/timezone) reads it back, the day can
 *   jump to the day before or after. That is bad for invoices!
 *
 *   The fix: we save the date as simple text "2026-06-04". Text never changes when
 *   you move it between countries, so the day always stays exactly the same in
 *   India (IST), the UK/Poland (CET), or the world clock (UTC).
 *
 * TECHNICAL: registers two MongoDB converters so every {@code java.time.LocalDate}
 * field (e.g. invoice issueDate / dueDate) is written as an ISO "yyyy-MM-dd" String
 * and read back the same way — never as a BSON Date.
 *
 * NOTE: old documents that were already saved as a BSON Date keep their old type;
 * a one-time data migration should rewrite them as strings. New writes are correct.
 */
@Configuration
public class MongoDateConfig {

    private static final DateTimeFormatter ISO_DATE = DateTimeFormatter.ISO_LOCAL_DATE; // yyyy-MM-dd

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(
                new LocalDateToStringConverter(),
                new StringToLocalDateConverter()));
    }

    /** When SAVING: turn the date object into the text "yyyy-MM-dd". */
    @WritingConverter
    static class LocalDateToStringConverter implements Converter<LocalDate, String> {
        @Override
        public String convert(LocalDate source) {
            return source.format(ISO_DATE);
        }
    }

    /** When READING: turn the text "yyyy-MM-dd" back into a date object. */
    @ReadingConverter
    static class StringToLocalDateConverter implements Converter<String, LocalDate> {
        @Override
        public LocalDate convert(String source) {
            return LocalDate.parse(source, ISO_DATE);
        }
    }
}
