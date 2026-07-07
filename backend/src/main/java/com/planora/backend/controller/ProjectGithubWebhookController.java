package com.planora.backend.controller;

import com.planora.backend.service.GithubWebhookService;
import com.planora.backend.util.GithubWebhookSignatureVerifier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/github")
@RequiredArgsConstructor
public class ProjectGithubWebhookController {
    private final GithubWebhookService webhookService;
    private final GithubWebhookSignatureVerifier signatureVerifier;

    @PostMapping("/webhook")
    public ResponseEntity<Void> handleWebhook(
            @RequestHeader(value = "X-GitHub-Event", defaultValue = "unknown") String eventType,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody String payload) {
        if (!signatureVerifier.isValid(payload, signature)) {
            log.warn("GitHub webhook signature validation failed for event: {}", eventType);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        log.info("Received GitHub webhook: {}", eventType);
        webhookService.handleEvent(eventType, payload);
        return ResponseEntity.ok().build();
    }
}
