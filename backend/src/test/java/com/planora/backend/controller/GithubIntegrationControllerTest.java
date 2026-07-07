package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.annotation.WithMockUserPrincipal;
import com.planora.backend.dto.GithubCollaboratorInviteRequestDTO;
import com.planora.backend.dto.GithubCollaboratorInviteResponseDTO;
import com.planora.backend.dto.GithubLinkRequestDTO;
import com.planora.backend.dto.ProjectGithubRepositoryDTO;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.ProjectGithubIntegrationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(GithubIntegrationController.class)
class GithubIntegrationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProjectGithubIntegrationService integrationService;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    @MockBean
    private com.planora.backend.service.GithubTokenService githubTokenService;

    @Autowired
    private ObjectMapper objectMapper;

    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        User user = new User();
        user.setUserId(1L);
        user.setUsername("testuser");
        principal = new UserPrincipal(user);
    }

    @Test
    @WithMockUserPrincipal
    void linkRepository_success() throws Exception {
        GithubLinkRequestDTO req = new GithubLinkRequestDTO();
        req.setProjectId(10L);
        req.setRepositoryFullName("owner/repo");

        ProjectGithubRepositoryDTO resp = new ProjectGithubRepositoryDTO();
        resp.setIntegrationId(1L);
        resp.setRepositoryFullName("owner/repo");

        when(integrationService.linkRepository(any(), anyLong())).thenReturn(resp);

        mockMvc.perform(post("/api/github/link")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.integrationId").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void getLinkedRepositories_passesAuthenticatedUser() throws Exception {
        ProjectGithubRepositoryDTO resp = new ProjectGithubRepositoryDTO();
        resp.setIntegrationId(1L);
        resp.setRepositoryFullName("owner/repo");

        when(integrationService.getLinkedRepositories(10L, 1L)).thenReturn(java.util.List.of(resp));

        mockMvc.perform(get("/api/github/project/10/repos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].integrationId").value(1));
    }

    @Test
    @WithMockUserPrincipal
    void unlinkRepository_passesAuthenticatedUser() throws Exception {
        mockMvc.perform(delete("/api/github/link/1")
                        .with(csrf())
                        .param("projectId", "10"))
                .andExpect(status().isNoContent());

        verify(integrationService).unlinkRepository(1L, 10L, 1L);
    }

    @Test
    @WithMockUserPrincipal
    void inviteCollaborator_returnsCreatedForGithubInvitation() throws Exception {
        GithubCollaboratorInviteRequestDTO req = new GithubCollaboratorInviteRequestDTO();
        req.setIdentifier("octocat");
        req.setPermission("push");

        GithubCollaboratorInviteResponseDTO resp = GithubCollaboratorInviteResponseDTO.builder()
                .projectId(10L)
                .integrationId(1L)
                .repositoryFullName("owner/repo")
                .githubUsername("octocat")
                .permission("push")
                .githubStatus(201)
                .status("INVITATION_CREATED")
                .message("GitHub collaborator invitation created")
                .build();

        when(integrationService.inviteCollaborator(eq(10L), any(), eq(1L))).thenReturn(resp);

        mockMvc.perform(post("/api/github/project/10/collaborators")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.githubUsername").value("octocat"))
                .andExpect(jsonPath("$.githubStatus").value(201));
    }

    @Test
    @WithMockUserPrincipal
    void linkRepository_invalidPayload_returns400() throws Exception {
        GithubLinkRequestDTO req = new GithubLinkRequestDTO();
        req.setProjectId(-10L); // Negative ID
        req.setRepositoryFullName(""); // Blank name
        req.setTokenType("INVALID_TOKEN_TYPE"); // Invalid token type pattern

        mockMvc.perform(post("/api/github/link")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.fieldErrors").isArray());
    }
}
