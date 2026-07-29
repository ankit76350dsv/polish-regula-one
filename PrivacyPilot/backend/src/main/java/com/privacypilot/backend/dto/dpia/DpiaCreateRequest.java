package com.privacypilot.backend.dto.dpia;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * The payload for OPENING a DPIA. A DPIA is always about ONE processing activity
 * (Art. 35), so the only thing the client sends is which activity it is for.
 *
 * Everything else is set by the server from that activity and the session — the
 * title, the matched screening criteria, the initial description, the sign-off
 * lines and the status. A client can therefore never spoof those fields.
 */
@Data
public class DpiaCreateRequest {

    @NotBlank(message = "activityId is required")
    private String activityId;
}
