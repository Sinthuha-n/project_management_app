package com.planora.backend.controller;

import com.planora.backend.dto.MobileGithubOAuthStartRequest;
import com.planora.backend.dto.MobileGithubOAuthStartResponse;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.MobileGithubOAuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.net.URI;

@RestController
@RequestMapping("/api/github/mobile/oauth")
@RequiredArgsConstructor
public class MobileGithubOAuthController {
    private final MobileGithubOAuthService oauthService;

    @PostMapping("/start")
    public MobileGithubOAuthStartResponse start(
            @Valid @RequestBody MobileGithubOAuthStartRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.UNAUTHORIZED, "Authentication is required");
        }
        return oauthService.start(principal.getUserId(), request);
    }

    @GetMapping("/callback")
    public ResponseEntity<Void> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        String returnUri = oauthService.complete(code, state, error);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .location(URI.create(returnUri))
                .build();
    }
}
