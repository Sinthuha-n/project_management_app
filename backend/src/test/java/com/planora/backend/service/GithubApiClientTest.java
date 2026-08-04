package com.planora.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GithubApiClientTest {

    @Mock HttpClient httpClient;
    @Mock HttpResponse<String> response;
    private GithubApiClient client;

    @BeforeEach
    void setUp() {
        client = new GithubApiClient(httpClient, new ObjectMapper());
        ReflectionTestUtils.setField(client, "githubApiBaseUrl", "https://github.test");
    }

    @AfterEach
    void clearInterruptedFlag() {
        Thread.interrupted();
    }

    @Test
    void fetchesListsWithAuthenticationPaginationAndPerPageCap() throws Exception {
        respond(200, "[{\"id\":1},{\"id\":2}]", Map.of());

        assertThat(client.fetchPullRequests("planora/backend", "token", "all", 3, 500)).hasSize(2);

        HttpRequest request = capturedRequest();
        assertThat(request.uri().toString()).isEqualTo(
                "https://github.test/repos/planora/backend/pulls?state=all&per_page=100&page=3");
        assertThat(request.headers().firstValue("Authorization")).contains("Bearer token");
        assertThat(request.headers().firstValue("X-GitHub-Api-Version")).contains("2022-11-28");
    }

    @Test
    void mapsRepositoryUserPermissionCommitIssueAndUserRepositoryResponses() throws Exception {
        respond(200, "{\"id\":17,\"permission\":\"admin\"}", Map.of());
        assertThat(client.fetchRepository("planora/backend", "token").path("id").asLong()).isEqualTo(17);

        respond(200, "{\"login\":\"octo cat\"}", Map.of());
        assertThat(client.fetchPublicUser("octo cat", "token").path("login").asText()).isEqualTo("octo cat");
        assertThat(capturedRequest().uri().getRawPath()).endsWith("/users/octo%20cat");

        respond(200, "{\"permission\":\"write\"}", Map.of());
        assertThat(client.getRepositoryPermission("planora/backend", "octo cat", "token")
                .path("permission").asText()).isEqualTo("write");

        respond(200, "[]", Map.of());
        assertThat(client.fetchCommits("planora/backend", "token", 2, 25)).isEmpty();
        respond(200, "[]", Map.of());
        assertThat(client.fetchIssues("planora/backend", "token", "open", 1, 25)).isEmpty();
        respond(200, "[]", Map.of());
        assertThat(client.fetchUserRepositories("token", 4)).isEmpty();
    }

    @Test
    void createsIssueAndInvitesCollaboratorIncludingEmptySuccessBody() throws Exception {
        respond(201, "{\"number\":42}", Map.of());
        assertThat(client.createIssue("planora/backend", "token", "Bug", null, null)
                .path("number").asInt()).isEqualTo(42);
        assertThat(capturedRequest().method()).isEqualTo("POST");

        respond(204, "", Map.of());
        var invite = client.addRepositoryCollaborator("planora/backend", "octo cat", "push", "token");
        assertThat(invite.statusCode()).isEqualTo(204);
        assertThat(invite.body()).isEmpty();
        assertThat(capturedRequest().method()).isEqualTo("PUT");
        assertThat(capturedRequest().uri().getRawPath()).endsWith("/collaborators/octo%20cat");
    }

    @ParameterizedTest
    @MethodSource("errorResponses")
    void mapsGithubErrorStatuses(int status, Map<String, String> headers, int expectedStatus) throws Exception {
        respond(status, "{\"message\":\"failure\"}", headers);

        assertThatThrownBy(() -> client.fetchRepository("planora/backend", "token"))
                .isInstanceOf(GithubApiClient.GithubApiException.class)
                .satisfies(error -> assertThat(((GithubApiClient.GithubApiException) error).getStatusCode())
                        .isEqualTo(expectedStatus));
    }

    static List<Arguments> errorResponses() {
        return List.of(
                Arguments.of(401, Map.of(), 401),
                Arguments.of(403, Map.of("X-RateLimit-Remaining", "0"), 429),
                Arguments.of(403, Map.of("X-RateLimit-Remaining", "12"), 403),
                Arguments.of(404, Map.of(), 404),
                Arguments.of(422, Map.of(), 422),
                Arguments.of(429, Map.of(), 429),
                Arguments.of(500, Map.of(), 500));
    }

    @Test
    void wrapsTransportAndMalformedResponseFailures() throws Exception {
        when(httpClient.send(any(), anyStringBodyHandler())).thenThrow(new IOException("connection reset"));
        assertThatThrownBy(() -> client.fetchRepository("planora/backend", "token"))
                .isInstanceOf(GithubApiClient.GithubApiException.class)
                .hasMessageContaining("GitHub GET failed");

        respond(200, "not-json", Map.of());
        assertThatThrownBy(() -> client.fetchIssues("planora/backend", "token", "all", 1, 10))
                .isInstanceOf(GithubApiClient.GithubApiException.class)
                .hasMessageContaining("GET-list failed");
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void respond(int status, String body, Map<String, String> headers) throws Exception {
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        java.net.http.HttpHeaders httpHeaders = java.net.http.HttpHeaders.of(
                headers.entrySet().stream().collect(java.util.stream.Collectors.toMap(
                        Map.Entry::getKey, entry -> List.of(entry.getValue()))),
                (name, value) -> true);
        when(response.headers()).thenReturn(httpHeaders);
        when(httpClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(response);
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static HttpResponse.BodyHandler<String> anyStringBodyHandler() {
        return (HttpResponse.BodyHandler) any(HttpResponse.BodyHandler.class);
    }

    private HttpRequest capturedRequest() throws Exception {
        ArgumentCaptor<HttpRequest> captor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient, atLeastOnce()).send(captor.capture(), anyStringBodyHandler());
        return captor.getValue();
    }
}
