package com.regulaone.backend.dto.notification;

import lombok.Data;

import java.util.Map;

// Body for PUT /api/notifications/preferences — the user replaces their channel choices.
// All fields optional; null means "leave unchanged".
@Data
public class UpdatePreferenceRequest {
    private Map<String, Boolean> channelDefaults;            // channel name → enabled
    private Map<String, Map<String, Boolean>> perCategory;   // category → (channel → enabled)
    private Boolean quietHoursEnabled;
    private Integer quietHoursFromHour;
    private Integer quietHoursToHour;
    private String timezone;
    private String digestFrequency;                          // IMMEDIATE | HOURLY | DAILY
}
