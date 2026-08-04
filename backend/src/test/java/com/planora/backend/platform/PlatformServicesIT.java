package com.planora.backend.platform;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;

import com.planora.backend.PlatformIntegrationIT;
import com.planora.backend.service.EmailService;
import com.planora.backend.service.GithubApiClient;
import com.planora.backend.service.S3StorageService;

class PlatformServicesIT extends PlatformIntegrationIT {

    @Autowired StringRedisTemplate redis;
    @Autowired S3StorageService storage;
    @Autowired GithubApiClient github;
    @Autowired EmailService emailService;

    @Test
    void redisSupportsAtomicCountersTtlAndSingleUseValues() {
        assertThat(redis.opsForValue().increment("rate:user:7")).isOne();
        assertThat(redis.opsForValue().increment("rate:user:7")).isEqualTo(2L);
        assertThat(redis.expire("rate:user:7", Duration.ofMinutes(1))).isTrue();
        assertThat(redis.getExpire("rate:user:7", TimeUnit.SECONDS)).isPositive();

        redis.opsForValue().set("oauth:state", "transaction", Duration.ofMinutes(10));
        assertThat(redis.opsForValue().getAndDelete("oauth:state")).isEqualTo("transaction");
        assertThat(redis.opsForValue().getAndDelete("oauth:state")).isNull();
    }

    @Test
    void localstackSupportsUploadHeadPresignedDownloadAndDelete() throws Exception {
        byte[] payload = "planora integration document".getBytes(StandardCharsets.UTF_8);
        storage.putObject("integration-documents", "projects/1/report.txt", "text/plain",
                new ByteArrayInputStream(payload), payload.length);
        storage.verifyObjectExists("integration-documents", "projects/1/report.txt");

        String url = storage.generatePresignedDownloadUrl(
                "integration-documents", "projects/1/report.txt", Duration.ofMinutes(2));
        HttpResponse<byte[]> response = HttpClient.newHttpClient().send(
                HttpRequest.newBuilder(URI.create(url)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).isEqualTo(payload);

        storage.deleteObject("integration-documents", "projects/1/report.txt");
        assertThatThrownBy(() -> storage.verifyObjectExists(
                "integration-documents", "projects/1/report.txt"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void githubClientUsesStubbedEndpointAndMapsRateLimit() {
        GITHUB.stubFor(get(urlEqualTo("/repos/planora/backend"))
                .willReturn(aResponse().withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"id\":17,\"full_name\":\"planora/backend\"}")));

        assertThat(github.fetchRepository("planora/backend", "test-token").path("id").asLong())
                .isEqualTo(17L);
        GITHUB.verify(getRequestedFor(urlEqualTo("/repos/planora/backend"))
                .withHeader("Authorization", equalTo("Bearer test-token")));

        GITHUB.resetAll();
        GITHUB.stubFor(get(urlEqualTo("/repos/planora/limited"))
                .willReturn(aResponse().withStatus(403)
                        .withHeader("X-RateLimit-Remaining", "0")
                        .withBody("{\"message\":\"rate limited\"}")));
        assertThatThrownBy(() -> github.fetchRepository("planora/limited", "test-token"))
                .isInstanceOf(GithubApiClient.GithubApiException.class)
                .satisfies(error -> assertThat(((GithubApiClient.GithubApiException) error).getStatusCode())
                        .isEqualTo(429));
    }

    @Test
    void greenMailReceivesInvitationWithoutExternalDelivery() {
        emailService.sendProjectInvitationEmail(
                "member@example.test", "Project Owner", "Integration Project");

        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            assertThat(SMTP.getReceivedMessages()).hasSize(1);
            var message = SMTP.getReceivedMessages()[0];
            assertThat(message.getSubject()).isEqualTo("Planora - Project Invitation");
            assertThat(message.getAllRecipients()[0].toString()).isEqualTo("member@example.test");
            assertThat(message.getContent().toString()).contains("Integration Project", "Project Owner");
        });
    }
}
