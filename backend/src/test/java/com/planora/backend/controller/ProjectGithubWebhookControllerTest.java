package com.planora.backend.controller;

import com.planora.backend.service.GithubWebhookService;
import com.planora.backend.service.GithubWebhookDeliveryService;
import com.planora.backend.util.GithubWebhookSignatureVerifier;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ProjectGithubWebhookControllerTest {

    @Test
    void webhookRejectsInvalidSignatureBeforeProcessingPayload() throws Exception {
        GithubWebhookService webhookService = mock(GithubWebhookService.class);
        ProjectGithubWebhookController controller = new ProjectGithubWebhookController(
                webhookService,
                new GithubWebhookSignatureVerifier("webhook-test-secret"),
                mock(GithubWebhookDeliveryService.class));
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
        String payload = "{\"action\":\"opened\"}";

        mockMvc.perform(post("/api/github/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-GitHub-Event", "pull_request")
                        .header("X-Hub-Signature-256", "sha256=deadbeef")
                        .content(payload))
                .andExpect(status().isUnauthorized());

        verify(webhookService, never()).handleEvent("pull_request", payload);
    }
}
