package com.planora.backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Legacy native-client refresh payload. Browsers authenticate this endpoint with
 * the HttpOnly refresh cookie and must not submit a token in the request body.
 */
@Getter
@Setter
@NoArgsConstructor
public class RefreshRequest {

    @Size(max = 4096)
    private String refreshToken;
}
