package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.User;
import com.planora.backend.repository.ChatRoomMemberRepository;
import com.planora.backend.repository.ChatRoomRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.service.ChatDocumentService;
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.NotificationService;
import com.planora.backend.service.ProjectMembershipService;
import com.planora.backend.service.UserCacheService;
import com.planora.backend.dto.ChatAttachmentUploadCapabilitiesDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitResponseDTO;
import com.planora.backend.dto.ChatMessageDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ChatRestController.class)
class ChatRestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatService chatService;
    @MockBean
    private ProjectRepository projectRepository;
    @MockBean
    private TeamMemberRepository teamMemberRepository;
    @MockBean
    private UserCacheService userCacheService;
    @MockBean
    private ProjectMembershipService projectMembershipService;
    @MockBean
    private UserRepository userRepository;
    @MockBean
    private ChatRoomRepository chatRoomRepository;
    @MockBean
    private ChatRoomMemberRepository chatRoomMemberRepository;
    @MockBean
    private SimpMessagingTemplate simpMessagingTemplate;
    @MockBean
    private ChatPresenceService chatPresenceService;
    @MockBean
    private ChatWebhookService chatWebhookService;
    @MockBean
    private ChatDocumentService chatDocumentService;
    @MockBean
    private NotificationService notificationService;
    @MockBean
    private JWTService jwtService;
    @MockBean
    private UserDetailsService userDetailsService;

    private User alice;
    private Team team;

    @BeforeEach
    void setUp() {
        team = new Team();
        team.setId(7L);

        var project = new com.planora.backend.model.Project();
        project.setId(5L);
        project.setTeam(team);

        alice = new User();
        alice.setUserId(10L);
        alice.setUsername("alice");
        alice.setEmail("alice@example.com");

        TeamMember member = new TeamMember();
        member.setUser(alice);
        member.setTeam(team);

        when(projectRepository.findById(5L)).thenReturn(Optional.of(project));
        when(projectMembershipService.resolveProjectTeamId(5L)).thenReturn(7L);
        when(userCacheService.resolveUserByEmailOrUsername("alice")).thenReturn(alice);
        when(userCacheService.resolveUserByEmailOrUsername("alice@example.com")).thenReturn(alice);
        when(teamMemberRepository.findByTeamIdAndUserUserId(7L, 10L)).thenReturn(Optional.of(member));
        when(teamMemberRepository.findByTeamId(7L)).thenReturn(List.of(member));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void uploadDocumentUsesResolvedNumericUserIdForEmailPrincipal() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "Quarterly Résumé 2026.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                new byte[]{1, 2, 3});
        when(chatDocumentService.uploadChatDocument(any(), eq(5L), eq(10L)))
                .thenReturn("https://download.example/document");

        mockMvc.perform(multipart("/api/projects/5/chat/messages/upload-document")
                        .file(file)
                        .with(csrf()))
                .andExpect(status().isOk())
                .andExpect(content().string("https://download.example/document"));

        verify(chatDocumentService).uploadChatDocument(any(), eq(5L), eq(10L));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void attachmentCapabilitiesDescribeDirectUploadPolicy() throws Exception {
        when(chatDocumentService.capabilities(true)).thenReturn(
                new ChatAttachmentUploadCapabilitiesDTO(
                        25L * 1024 * 1024,
                        List.of("pdf", "xlsx"),
                        Map.of("pdf", List.of("application/pdf")),
                        true));

        mockMvc.perform(get("/api/projects/5/chat/attachments/upload-capabilities"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maxFileSizeBytes").value(25L * 1024 * 1024))
                .andExpect(jsonPath("$.allowedExtensions[0]").value("pdf"))
                .andExpect(jsonPath("$.directUploadEnabled").value(true));
    }

    @Test
    @WithMockUserPrincipal(email = "alice@example.com")
    void initAttachmentUploadReturnsPresignedContract() throws Exception {
        when(chatDocumentService.initUpload(eq(5L), eq(10L), any())).thenReturn(
                new ChatAttachmentUploadInitResponseDTO(
                        "https://upload.example/presigned",
                        "project-5/user-10/id-report.pdf",
                        "application/pdf",
                        600L));

        mockMvc.perform(post("/api/projects/5/chat/attachments/upload/init")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"fileName":"report.pdf","contentType":"application/pdf","fileSize":512}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.uploadUrl").value("https://upload.example/presigned"))
                .andExpect(jsonPath("$.objectKey").value("project-5/user-10/id-report.pdf"))
                .andExpect(jsonPath("$.contentType").value("application/pdf"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void getRoomMessages_marksAsRead_andReturnsPayload() throws Exception {
		ChatMessageDTO message = new ChatMessageDTO();
		message.setId(21L);
		message.setContent("Hello room");

        ChatRoom room = new ChatRoom();
        room.setId(9L);
        room.setProjectId(5L);

        ChatRoomMember roomMember = new ChatRoomMember();
        roomMember.setUser(alice);
        roomMember.setChatRoom(room);

        when(chatRoomRepository.findById(9L)).thenReturn(Optional.of(room));
        when(chatRoomMemberRepository.findByChatRoomIdAndUserUserId(9L, 10L)).thenReturn(Optional.of(roomMember));
        when(chatService.getRoomMessages(5L, 9L)).thenReturn(List.of(message));

        mockMvc.perform(get("/api/projects/5/chat/messages")
                        .param("roomId", "9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(21L))
                .andExpect(jsonPath("$[0].content").value("Hello room"));

        verify(chatService).markRoomAsRead(5L, 9L, "alice");
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void getPrivateMessages_marksConversationRead() throws Exception {
        User bob = new User();
        bob.setUserId(11L);
        bob.setUsername("bob");
        bob.setEmail("bob@example.com");

        when(userCacheService.resolveUserByEmailOrUsername("bob")).thenReturn(bob);
        when(userCacheService.resolveUserByEmailOrUsername("bob@example.com")).thenReturn(bob);

		ChatMessageDTO dm = new ChatMessageDTO();
		dm.setId(30L);
		dm.setSender("alice");
		dm.setRecipient("bob");

        when(chatService.getPrivateConversation(5L, "alice", "bob")).thenReturn(List.of(dm));

        mockMvc.perform(get("/api/projects/5/chat/messages")
                        .param("recipient", "alice")
                        .param("with", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].recipient").value("bob"));

        verify(chatService).markPrivateConversationAsRead(5L, "alice", "bob");
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void getPrivateMessages_succeedsEvenIfWithUserNotTeamMember() throws Exception {
        // withUser team membership is no longer validated — conversation history
        // must remain accessible even after the other party leaves the project.
        User former = new User();
        former.setUserId(99L);
        former.setUsername("former");

        when(userCacheService.resolveUserByEmailOrUsername("former")).thenReturn(former);

        ChatMessageDTO dm = new ChatMessageDTO();
        dm.setId(55L);
        dm.setSender("former");
        dm.setRecipient("alice");

        when(chatService.getPrivateConversation(5L, "alice", "former")).thenReturn(List.of(dm));

        mockMvc.perform(get("/api/projects/5/chat/messages")
                        .param("recipient", "alice")
                        .param("with", "former"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(55L));
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void createThreadReply_rejectsBlankContent() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ThreadReplyRequest("   ", ChatMessage.FormatType.PLAIN);

        mockMvc.perform(post("/api/projects/5/chat/messages/1/thread/replies")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void createThreadReply_returnsCreatedMessage() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ThreadReplyRequest("reply", ChatMessage.FormatType.PLAIN);
		ChatMessageDTO saved = new ChatMessageDTO();
		saved.setId(77L);
		saved.setContent("reply");

		when(chatService.saveThreadReply(eq(5L), eq(1L), any(ChatMessage.class))).thenReturn(saved);

        mockMvc.perform(post("/api/projects/5/chat/messages/1/thread/replies")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(77L))
                .andExpect(jsonPath("$.content").value("reply"));
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void toggleReaction_blankEmojiReturnsBadRequest() throws Exception {
            @SuppressWarnings("null")
        var request = new ChatRestController.ReactionToggleRequest(" ");

        mockMvc.perform(post("/api/projects/5/chat/messages/9/reactions/toggle")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void toggleReaction_returnsSummaries() throws Exception {
        var request = new ChatRestController.ReactionToggleRequest("👍");
        var summary = new ChatService.ChatReactionSummary("👍", 1L, true);
        when(chatService.toggleReaction(5L, 9L, "alice", "👍")).thenReturn(List.of(summary));

        mockMvc.perform(post("/api/projects/5/chat/messages/9/reactions/toggle")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].emoji").value("👍"))
                .andExpect(jsonPath("$[0].reactedByCurrentUser").value(true));
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void getFeatureFlags_returnsConfigValues() throws Exception {
        mockMvc.perform(get("/api/projects/5/chat/features"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phaseDEnabled").value(true))
                .andExpect(jsonPath("$.phaseEEnabled").value(true))
                .andExpect(jsonPath("$.webhooksEnabled").value(true))
                .andExpect(jsonPath("$.telemetryEnabled").value(true));
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void getFeatureFlags_validatesProjectMembershipViaService() throws Exception {
        mockMvc.perform(get("/api/projects/5/chat/features"))
                .andExpect(status().isOk());

        verify(projectMembershipService).assertTeamMembership(7L, alice);
    }

    @Test
    @WithMockUserPrincipal(email = "alice")
    void createRoom_notifiesOnlyAddedMembers() throws Exception {
        User bob = new User();
        bob.setUserId(11L);
        bob.setUsername("bob");
        bob.setEmail("bob@example.com");

        TeamMember bobMember = new TeamMember();
        bobMember.setUser(bob);
        bobMember.setTeam(team);

        TeamMember aliceMember = new TeamMember();
        aliceMember.setUser(alice);
        aliceMember.setTeam(team);

        when(userCacheService.resolveUserByEmailOrUsername("bob")).thenReturn(bob);
        when(userCacheService.resolveUserByEmailOrUsername("bob@example.com")).thenReturn(bob);
        when(teamMemberRepository.findByTeamIdAndUserUserId(7L, 11L)).thenReturn(Optional.of(bobMember));
        when(teamMemberRepository.findByTeamId(7L)).thenReturn(List.of(bobMember, aliceMember));

        ChatRoom savedRoom = new ChatRoom();
        savedRoom.setId(91L);
        savedRoom.setName("incident");
        savedRoom.setProjectId(5L);
        savedRoom.setCreatedBy("alice");
        savedRoom.setArchived(false);

        when(chatService.createRoom(eq(5L), eq(7L), eq("alice"), eq("incident"), eq(List.of("bob"))))
            .thenReturn(new ChatService.CreatedRoomResult(savedRoom, Set.of(bob, alice)));
        when(chatService.getProjectName(5L)).thenReturn("the project");

        var request = new ChatRestController.ChatRoomRequest("incident", List.of("bob"));

        mockMvc.perform(post("/api/projects/5/chat/rooms")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(91L))
                .andExpect(jsonPath("$.name").value("incident"));

        verify(notificationService).createNotification(
                eq(bob),
                contains("added you to #incident"),
                eq("/project/5/chat?roomId=91"));
    }
}
