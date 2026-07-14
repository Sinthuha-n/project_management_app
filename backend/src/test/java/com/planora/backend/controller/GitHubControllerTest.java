package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.planora.backend.dto.GitHubRepositoryDTO;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.GitHubIntegrationService;
import com.planora.backend.service.GithubTokenService;
import com.planora.backend.service.JWTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GitHubController.class)
class GitHubControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private GitHubIntegrationService gitHubIntegrationService;

    @MockitoBean
    private GithubTokenService githubTokenService;

    @MockitoBean
    private UserRepository userRepository;

    @MockitoBean
    private JWTService jwtService;

    @MockitoBean
    private UserDetailsService userDetailsService;

    private User userEntity;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        userEntity = new User();
        userEntity.setUserId(1L);
        userEntity.setUsername("testuser");
        userEntity.setEmail("test@example.com");
        userEntity.setGithubUsername("gituser");
        principal = new UserPrincipal(userEntity);
    }

    @Test
    void getOAuthConfig_returnsPublicClientIdOnly() throws Exception {
        when(gitHubIntegrationService.getMobileClientId()).thenReturn("github-client-id");
        when(gitHubIntegrationService.getMobileRedirectUri()).thenReturn("mobile://github-callback");

        mockMvc.perform(get("/api/github/oauth-config")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.clientId").value("github-client-id"))
                .andExpect(jsonPath("$.redirectUri").value("mobile://github-callback"))
                .andExpect(jsonPath("$.clientSecret").doesNotExist())
                .andExpect(jsonPath("$.secret").doesNotExist());
    }

    @Test
    void getStatus_returnsConnectedTrueWhenTokenExists() throws Exception {
        when(githubTokenService.getToken(1L)).thenReturn("decrypted-token");
        when(gitHubIntegrationService.getConnectedUsername(1L)).thenReturn("gituser");

        mockMvc.perform(get("/api/github/status")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.username").value("gituser"));
    }

    @Test
    void getStatus_returnsConnectedFalseWhenTokenMissing() throws Exception {
        when(githubTokenService.getToken(1L)).thenReturn(null);

        mockMvc.perform(get("/api/github/status")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(false));
    }

    @Test
    void getRepositories_returnsListWhenConnected() throws Exception {
        String mockToken = "decrypted-token";
        when(githubTokenService.getToken(1L)).thenReturn(mockToken);

        GitHubRepositoryDTO repo = new GitHubRepositoryDTO();
        repo.setId(101L);
        repo.setName("test-repo");
        repo.setFullName("owner/test-repo");

        when(gitHubIntegrationService.fetchUserRepositories(mockToken)).thenReturn(List.of(repo));

        mockMvc.perform(get("/api/github/repositories")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(101))
                .andExpect(jsonPath("$[0].name").value("test-repo"));
    }

    @Test
    void getRepositories_unauthorizedWhenNoToken() throws Exception {
        when(githubTokenService.getToken(1L)).thenReturn(null);

        mockMvc.perform(get("/api/github/repositories")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void exchangeToken_savesTokenAndReturnsSuccessWithoutTokenInResponse() throws Exception {
        mockMvc.perform(post("/api/github/token")
                        .with(user(principal))
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", "auth-code"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.access_token").doesNotExist())
                .andExpect(jsonPath("$.token").doesNotExist());

        verify(gitHubIntegrationService).exchangeAndSaveToken(1L, "test@example.com", "auth-code", null);
    }

    @Test
    void revokeToken_callsServiceAndReturnsSuccess() throws Exception {
        mockMvc.perform(post("/api/github/revoke")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        verify(gitHubIntegrationService).revokeToken(1L);
    }

    @Test
    void getGitHubUser_proxiesUserDetails() throws Exception {
        String mockToken = "decrypted-token";
        when(githubTokenService.getToken(1L)).thenReturn(mockToken);

        ObjectNode mockUser = objectMapper.createObjectNode();
        mockUser.put("login", "gituser");
        mockUser.put("id", 12345);
        mockUser.put("access_token", "must-not-leak");
        mockUser.put("githubAccessToken", "must-not-leak");

        when(gitHubIntegrationService.fetchGitHubUser(mockToken)).thenReturn(mockUser);

        mockMvc.perform(get("/api/github/user")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.login").value("gituser"))
                .andExpect(jsonPath("$.id").value(12345))
                .andExpect(jsonPath("$.access_token").doesNotExist())
                .andExpect(jsonPath("$.githubAccessToken").doesNotExist());
    }

    @Test
    void getPullRequests_stripsTokenFieldsFromProxiedResponse() throws Exception {
        String mockToken = "decrypted-token";
        when(githubTokenService.getToken(1L)).thenReturn(mockToken);

        ObjectNode author = objectMapper.createObjectNode();
        author.put("login", "octocat");
        author.put("token", "must-not-leak");
        ObjectNode pr = objectMapper.createObjectNode();
        pr.put("number", 17);
        pr.set("user", author);
        pr.put("access_token", "must-not-leak");
        var pullRequests = objectMapper.createArrayNode().add(pr);

        when(gitHubIntegrationService.fetchPullRequests("planora", "app", mockToken)).thenReturn(pullRequests);

        mockMvc.perform(get("/api/github/pull-requests")
                        .with(user(principal))
                        .param("owner", "planora")
                        .param("repo", "app"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].number").value(17))
                .andExpect(jsonPath("$[0].access_token").doesNotExist())
                .andExpect(jsonPath("$[0].user.token").doesNotExist());
    }

    @Test
    void getCommits_stripsTokenFieldsFromProxiedResponse() throws Exception {
        String mockToken = "decrypted-token";
        when(githubTokenService.getToken(1L)).thenReturn(mockToken);

        ObjectNode commit = objectMapper.createObjectNode();
        commit.put("sha", "abc123");
        commit.put("github_access_token", "must-not-leak");
        var commits = objectMapper.createArrayNode().add(commit);

        when(gitHubIntegrationService.fetchCommits("planora", "app", mockToken)).thenReturn(commits);

        mockMvc.perform(get("/api/github/commits")
                        .with(user(principal))
                        .param("owner", "planora")
                        .param("repo", "app"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].sha").value("abc123"))
                .andExpect(jsonPath("$[0].github_access_token").doesNotExist());
    }

    @Test
    void getRepositories_returns503WhenIntegrationDisabled() throws Exception {
        doThrow(new com.planora.backend.exception.GithubIntegrationDisabledException("GitHub integration is disabled"))
                .when(githubTokenService).validateGithubIntegration();

        mockMvc.perform(get("/api/github/repositories")
                        .with(user(principal))
                        .with(csrf()))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode").value("INTEGRATION_DISABLED"))
                .andExpect(jsonPath("$.message").value("GitHub integration is disabled"));
    }
}
