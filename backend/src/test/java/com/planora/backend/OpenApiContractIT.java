package com.planora.backend;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

class OpenApiContractIT extends BaseIntegrationIT {

    @Autowired TestRestTemplate restTemplate;
    @Autowired ObjectMapper objectMapper;

    @Test
    void apiDocumentExposesCriticalBackendContracts() throws Exception {
        ResponseEntity<String> response = restTemplate.getForEntity("/v3/api-docs", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode document = objectMapper.readTree(response.getBody());
        assertThat(document.path("openapi").asText()).startsWith("3.");
        JsonNode paths = document.path("paths");
        assertThat(paths.path("/api/auth/login").has("post")).isTrue();
        assertThat(paths.path("/api/projects").has("post")).isTrue();
        assertThat(paths.path("/api/tasks/{taskId}").isObject()).isTrue();
        assertThat(paths.path("/api/projects/{projectId}/documents").has("get")).isTrue();
        assertThat(paths.path("/api/github/webhook").has("post")).isTrue();
        assertThat(document.path("components").path("schemas").isObject()).isTrue();
    }
}
