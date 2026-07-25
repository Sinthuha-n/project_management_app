package com.planora.backend.controller;

import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.beans.factory.annotation.Value;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;

import com.planora.backend.dto.ChatAttachmentUploadCapabilitiesDTO;
import com.planora.backend.dto.ChatAttachmentUploadFinalizeRequestDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitRequestDTO;
import com.planora.backend.dto.ChatAttachmentUploadInitResponseDTO;
import com.planora.backend.dto.ChatAttachmentUploadResponseDTO;
import com.planora.backend.dto.ChatMessageDTO;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatRoom;
import com.planora.backend.model.ChatRoomMember;
import com.planora.backend.service.ChatPresenceService;
import com.planora.backend.service.ChatService;
import com.planora.backend.service.ChatWebhookService;
import com.planora.backend.service.NotificationService;
import com.planora.backend.service.ProjectMembershipService;
import com.planora.backend.service.UserCacheService;

import com.planora.backend.service.ChatDocumentService;

@RestController
@RequestMapping("/api/projects/{projectId}/chat")
public class ChatRestController {
    private static final Logger log = LoggerFactory.getLogger(ChatRestController.class);
    public static record ChatRoomResponse(Long id,
                                          String name,
                                          Long projectId,
                                          String createdBy,
                                          String topic,
                                          String description,
                                          boolean archived,
                                          Long pinnedMessageId,
                                          String createdAt,
                                          String updatedAt) {}

    public static record ChatSidebarResponse(ChatService.TeamChatSummary team,
                                             List<ChatService.RoomChatSummary> rooms,
                                             List<ChatService.DirectChatSummary> directMessages) {}

    public static record PresenceResponse(List<String> onlineUsers, int onlineCount) {}

    public static record UnreadBadgeResponse(long teamUnread,
                                             long roomsUnread,
                                             long directsUnread,
                                             long totalUnread) {}

    public static record FeatureFlagsResponse(boolean phaseDEnabled,
                                              boolean phaseEEnabled,
                                              boolean webhooksEnabled,
                                              boolean telemetryEnabled) {}

    public static record SearchResultResponse(Long messageId,
                                              String sender,
                                              String content,
                                              String context,
                                              Long roomId,
                                              String recipient,
                                              String timestamp) {}

    public static record ChatWebhookRequest(String url,
                                            List<String> events,
                                            Boolean active,
                                            String secret) {}

    public static record ChatWebhookResponse(String id,
                                             String url,
                                             List<String> events,
                                             boolean active,
                                             String createdAt) {}

    public static record TelemetryEventRequest(String eventName,
                                               String scope,
                                               String metadata) {}

    private final ChatService chatService;

    private final UserCacheService userCacheService;

    private final ProjectMembershipService projectMembershipService;

    private final SimpMessagingTemplate simpMessagingTemplate;

    private final ChatPresenceService chatPresenceService;

    private final ChatWebhookService chatWebhookService;

    private final ChatDocumentService chatDocumentService;

    private final NotificationService notificationService;

    public ChatRestController(ChatService chatService,
                              UserCacheService userCacheService,
                              ProjectMembershipService projectMembershipService,
                              SimpMessagingTemplate simpMessagingTemplate,
                              ChatPresenceService chatPresenceService,
                              ChatWebhookService chatWebhookService,
                              ChatDocumentService chatDocumentService,
                              NotificationService notificationService) {
        this.chatService = chatService;
        this.userCacheService = userCacheService;
        this.projectMembershipService = projectMembershipService;
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.chatPresenceService = chatPresenceService;
        this.chatWebhookService = chatWebhookService;
        this.chatDocumentService = chatDocumentService;
        this.notificationService = notificationService;
    }
    /**
     * Upload a document to chat (S3-backed, like WhatsApp)
     */
    @PostMapping("/messages/upload-document")
    public ResponseEntity<String> uploadChatDocument(
            @PathVariable Long projectId,
            @RequestPart("file") MultipartFile file,
            Authentication authentication
    ) {
        resolveValidatedTeamId(projectId, authentication.getName());
        var user = resolveAuthenticatedUser(authentication);
        String url = chatDocumentService.uploadChatDocument(file, projectId, user.getUserId());
        return ResponseEntity.ok(url);
    }

    @GetMapping("/attachments/upload-capabilities")
    public ResponseEntity<ChatAttachmentUploadCapabilitiesDTO> getChatAttachmentUploadCapabilities(
            @PathVariable Long projectId,
            Authentication authentication
    ) {
        resolveValidatedTeamId(projectId, authentication.getName());
        return ResponseEntity.ok(chatDocumentService.capabilities(directUploadEnabled));
    }

    @PostMapping("/attachments/upload/init")
    public ResponseEntity<ChatAttachmentUploadInitResponseDTO> initChatAttachmentUpload(
            @PathVariable Long projectId,
            @Valid @RequestBody ChatAttachmentUploadInitRequestDTO request,
            Authentication authentication
    ) {
        resolveValidatedTeamId(projectId, authentication.getName());
        var user = resolveAuthenticatedUser(authentication);
        return ResponseEntity.ok(chatDocumentService.initUpload(projectId, user.getUserId(), request));
    }

    @PostMapping("/attachments/upload/finalize")
    public ResponseEntity<ChatAttachmentUploadResponseDTO> finalizeChatAttachmentUpload(
            @PathVariable Long projectId,
            @Valid @RequestBody ChatAttachmentUploadFinalizeRequestDTO request,
            Authentication authentication
    ) {
        resolveValidatedTeamId(projectId, authentication.getName());
        var user = resolveAuthenticatedUser(authentication);
        return ResponseEntity.ok(chatDocumentService.finalizeUpload(projectId, user.getUserId(), request));
    }

    /**
     * Get a fresh pre-signed S3 URL for a previously uploaded document
     */
    @GetMapping("/messages/refresh-document")
    public ResponseEntity<String> refreshChatDocument(
            @PathVariable Long projectId,
            @RequestParam("url") String expiredUrl,
            Authentication authentication
    ) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        
        if (expiredUrl == null || expiredUrl.isBlank()) {
            return ResponseEntity.badRequest().body("URL is required");
        }
        
        return ResponseEntity.ok(chatDocumentService.refreshPresignedUrl(expiredUrl, projectId));
    }

    @Value("${chat.attachments.direct-upload-enabled:true}")
    private boolean directUploadEnabled;

    @Value("${chat.features.phase-d-enabled:true}")
    private boolean phaseDEnabled;

    @Value("${chat.features.phase-e-enabled:true}")
    private boolean phaseEEnabled;

    @Value("${chat.features.webhooks-enabled:true}")
    private boolean webhooksEnabled;

    @Value("${chat.features.telemetry-enabled:true}")
    private boolean telemetryEnabled;

    public static record RoomEvent(String action, Long roomId, ChatRoomResponse room) {}

    public static record EditMessageRequest(String content, ChatMessage.FormatType formatType) {}

    public static record SendMessageRequest(String content,
                                            String recipient,
                                            Long roomId,
                                            String localId,
                                            ChatMessage.FormatType formatType) {}

    public static record ThreadReplyRequest(String content, ChatMessage.FormatType formatType) {}

    public static record ReactionToggleRequest(String emoji) {}

    public static record RoomMetaUpdateRequest(String name, String topic, String description) {}

    public static record RoomPinRequest(Long messageId) {}

    public static record RoomRoleUpdateRequest(String role) {}

    /**
     * Get group or private chat history for a project.
     */
    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessageDTO>> getMessages(
            @PathVariable Long projectId,
            @RequestParam(value = "roomId", required = false) Long roomId,
            @RequestParam(value = "recipient", required = false) String recipient,
            @RequestParam(value = "with", required = false) String withUser,
            Authentication authentication
    ) {
        String username = authentication.getName();
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateTeamMembership(teamId, username);
        if (roomId != null) {
            // Room reads are marked immediately so unread badges stay accurate for sidebar views.
            chatService.ensureRoomMembership(roomId, username);
            var roomMessages = chatService.getRoomMessages(projectId, roomId);
            chatService.markRoomAsRead(projectId, roomId, username);
            return new ResponseEntity<>(roomMessages, HttpStatus.OK);
        }
        if (recipient == null && withUser == null) {
            return new ResponseEntity<>(chatService.getGroupMessages(projectId), HttpStatus.OK);
        }

        var privateConversation = chatService.getPrivateConversation(projectId, username, withUser);
        chatService.markPrivateConversationAsRead(projectId, username, withUser);
        return new ResponseEntity<>(privateConversation, HttpStatus.OK);
    }

    @GetMapping("/messages/{messageId}/thread")
    public ResponseEntity<List<ChatMessageDTO>> getThreadMessages(@PathVariable Long projectId,
                                                                @PathVariable Long messageId,
                                                                Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        return new ResponseEntity<>(chatService.getThreadMessages(projectId, messageId), HttpStatus.OK);
    }

    @PostMapping("/messages")
    public ResponseEntity<ChatMessageDTO> createMessage(@PathVariable Long projectId,
                                                        @RequestBody SendMessageRequest request,
                                                        Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

        if (request.content() == null || request.content().trim().isEmpty()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var message = new ChatMessage();
        message.setSender(resolveCanonicalChatIdentifier(username));
        message.setContent(request.content().trim());
        message.setType(ChatMessage.MessageType.CHAT);
        message.setFormatType(request.formatType() != null ? request.formatType() : ChatMessage.FormatType.PLAIN);
        message.setProjectId(projectId);

        if (request.roomId() != null) {
            validateRoomMembership(request.roomId(), username);
            var room = chatService.getChatRoomByIdAndProjectId(request.roomId(), projectId);
            if (Boolean.TRUE.equals(room.getArchived())) {
                return new ResponseEntity<>(HttpStatus.CONFLICT);
            }
            message.setRoomId(request.roomId());
            message.setChatType(ChatMessage.ChatType.GROUP);
        } else if (request.recipient() != null && !request.recipient().isBlank()) {
            validateTeamMembership(teamId, request.recipient());
            message.setRecipient(resolveCanonicalChatIdentifier(request.recipient()));
            message.setChatType(ChatMessage.ChatType.PRIVATE);
        } else {
            message.setChatType(ChatMessage.ChatType.GROUP);
        }

        var saved = chatService.saveMessage(message);
        saved.setLocalId(request.localId());

        if (request.roomId() != null) {
            simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/room/" + request.roomId(), saved);
        } else if (saved.getRecipient() != null && !saved.getRecipient().isBlank()) {
            sendPrivateMessageToConversationParticipants(projectId, saved);
        } else {
            simpMessagingTemplate.convertAndSend("/topic/project/" + projectId + "/public", saved);
        }

        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PostMapping("/messages/{messageId}/thread/replies")
    public ResponseEntity<ChatMessageDTO> createThreadReply(@PathVariable Long projectId,
                                                         @PathVariable Long messageId,
                                                         @RequestBody ThreadReplyRequest request,
                                                         Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);

        if (request.content() == null || request.content().trim().isEmpty()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var reply = new ChatMessage();
        reply.setSender(resolveCanonicalChatIdentifier(username));
        reply.setContent(request.content().trim());
        reply.setType(ChatMessage.MessageType.CHAT);
        reply.setFormatType(request.formatType() != null ? request.formatType() : ChatMessage.FormatType.PLAIN);

        var saved = chatService.saveThreadReply(projectId, messageId, reply);
        return new ResponseEntity<>(saved, HttpStatus.CREATED);
    }

    @PatchMapping("/messages/{messageId}")
    public ResponseEntity<ChatMessageDTO> editMessage(@PathVariable Long projectId,
                                                   @PathVariable Long messageId,
                                                   @RequestBody EditMessageRequest request,
                                                   Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);

        if (request.content() == null || request.content().trim().isEmpty()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var updated = chatService.editMessage(
                projectId,
                messageId,
                username,
                request.content().trim(),
                request.formatType());

        return new ResponseEntity<>(updated, HttpStatus.OK);
    }

    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<ChatMessageDTO> deleteMessage(@PathVariable Long projectId,
                                                     @PathVariable Long messageId,
                                                     Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);

        var deleted = chatService.softDeleteMessage(projectId, messageId, username);
        return new ResponseEntity<>(deleted, HttpStatus.OK);
    }

    @GetMapping("/messages/{messageId}/reactions")
    public ResponseEntity<List<ChatService.ChatReactionSummary>> getMessageReactions(@PathVariable Long projectId,
                                                                                      @PathVariable Long messageId,
                                                                                      Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        return new ResponseEntity<>(chatService.getMessageReactions(projectId, messageId, username), HttpStatus.OK);
    }

    @PostMapping("/messages/{messageId}/reactions/toggle")
    public ResponseEntity<List<ChatService.ChatReactionSummary>> toggleMessageReaction(@PathVariable Long projectId,
                                                                                        @PathVariable Long messageId,
                                                                                        @RequestBody ReactionToggleRequest request,
                                                                                        Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);

        if (request.emoji() == null || request.emoji().isBlank()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var reactions = chatService.toggleReaction(projectId, messageId, username, request.emoji());
        return new ResponseEntity<>(reactions, HttpStatus.OK);
    }

    /**
     * Get list of project members' usernames for chat.
     */
    @GetMapping("/members")
    @Transactional(readOnly = true)
    public ResponseEntity<List<String>> getProjectMembers(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);
        var usernames = chatService.getProjectMemberUsernames(teamId, username);
        return new ResponseEntity<>(usernames, HttpStatus.OK);
    }

    @GetMapping("/presence")
    public ResponseEntity<PresenceResponse> getPresence(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        var onlineUsers = chatPresenceService.getOnlineUsers(projectId);
        return new ResponseEntity<>(new PresenceResponse(onlineUsers, onlineUsers.size()), HttpStatus.OK);
    }

    @GetMapping("/features")
    public ResponseEntity<FeatureFlagsResponse> getFeatureFlags(@PathVariable Long projectId, Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        return new ResponseEntity<>(
                new FeatureFlagsResponse(
                        phaseDEnabled,
                        phaseEEnabled,
                        webhooksEnabled,
                        telemetryEnabled),
                HttpStatus.OK);
    }

    @GetMapping("/search")
    @Transactional(readOnly = true)
    public ResponseEntity<List<SearchResultResponse>> searchMessages(@PathVariable Long projectId,
                                                                     @RequestParam("query") String query,
                                                                     @RequestParam(value = "limit", required = false, defaultValue = "20") int limit,
                                                                     Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);

        var visibleRoomIds = chatService.getChatRoomsForProject(projectId, username, false).stream().map(ChatRoom::getId).collect(java.util.stream.Collectors.toSet());
        // Search results are filtered by room visibility to avoid leaking room content.
        var matches = chatService.searchMessages(projectId, username, query, visibleRoomIds, limit);

        var response = matches.stream().map(message -> {
            String context = message.getRoomId() != null
                    ? "ROOM"
                    : (message.getRecipient() != null && !message.getRecipient().isBlank() ? "PRIVATE" : "TEAM");

            return new SearchResultResponse(
                    message.getId(),
                    message.getSender(),
                    message.getContent(),
                    context,
                    message.getRoomId(),
                    message.getRecipient(),
                    message.getTimestamp() != null ? message.getTimestamp().toString() : null);
        }).toList();

        return new ResponseEntity<>(response, HttpStatus.OK);
    }

    @GetMapping("/webhooks")
    public ResponseEntity<List<ChatWebhookResponse>> listWebhooks(@PathVariable Long projectId,
                                                                   Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        if (!webhooksEnabled) {
            return new ResponseEntity<>(List.of(), HttpStatus.OK);
        }

        var hooks = chatWebhookService.listWebhooks(projectId).stream()
                .map(this::toWebhookResponse)
                .toList();
        return new ResponseEntity<>(hooks, HttpStatus.OK);
    }

    @PostMapping("/webhooks")
    public ResponseEntity<ChatWebhookResponse> createWebhook(@PathVariable Long projectId,
                                                              @RequestBody ChatWebhookRequest request,
                                                              Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        if (!webhooksEnabled || request.url() == null || request.url().isBlank()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var webhook = chatWebhookService.createWebhook(projectId, request.url().trim(), request.events(), request.active(), request.secret());
        return new ResponseEntity<>(toWebhookResponse(webhook), HttpStatus.CREATED);
    }

    @DeleteMapping("/webhooks/{webhookId}")
    public ResponseEntity<Void> deleteWebhook(@PathVariable Long projectId,
                                              @PathVariable String webhookId,
                                              Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        if (!webhooksEnabled) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        boolean deleted = chatWebhookService.deleteWebhook(projectId, webhookId);
        return new ResponseEntity<>(deleted ? HttpStatus.NO_CONTENT : HttpStatus.NOT_FOUND);
    }

    @PostMapping("/webhooks/test")
    public ResponseEntity<String> testWebhooks(@PathVariable Long projectId,
                                               Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        if (!webhooksEnabled) {
            return new ResponseEntity<>("Webhooks disabled", HttpStatus.BAD_REQUEST);
        }

        int dispatched = chatWebhookService.testWebhooks(projectId);
        return new ResponseEntity<>("Dispatched test payload to " + dispatched + " webhook(s)", HttpStatus.OK);
    }

    @PostMapping("/telemetry")
    public ResponseEntity<Void> ingestTelemetry(@PathVariable Long projectId,
                                                @RequestBody TelemetryEventRequest request,
                                                Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        if (!telemetryEnabled) {
            return new ResponseEntity<>(HttpStatus.ACCEPTED);
        }

        // Deliberately omit arbitrary client metadata: it can contain message text,
        // tokens, or other user-controlled sensitive values.
        log.info("event=chat_telemetry projectId={} user={} name={} scope={}",
                projectId, username, request.eventName(), request.scope());
        return new ResponseEntity<>(HttpStatus.ACCEPTED);
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<ChatRoomResponse>> getRooms(@PathVariable Long projectId,
                                                           @RequestParam(value = "includeArchived", required = false, defaultValue = "false") boolean includeArchived,
                                                           Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        var visibleRooms = chatService.getChatRoomsForProject(projectId, username, includeArchived).stream()
            .map(this::toRoomResponse)
            .toList();

        return new ResponseEntity<>(visibleRooms, HttpStatus.OK);
    }

    @GetMapping("/summaries")
    @Transactional(readOnly = true)
    public ResponseEntity<ChatSidebarResponse> getChatSummaries(@PathVariable Long projectId,
                                                                @RequestParam(value = "includeArchived", required = false, defaultValue = "false") boolean includeArchived,
                                                                Authentication authentication) {
        String username = authentication.getName();
        com.planora.backend.model.User currentUser = resolveAuthenticatedUser(authentication);
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateTeamMembership(teamId, currentUser);

        var participants = chatService.getProjectParticipantUsernames(teamId);

        var visibleRooms = chatService.getChatRoomsForProject(projectId, username, includeArchived, currentUser);
        var response = new ChatSidebarResponse(
                chatService.buildTeamSummary(projectId, currentUser, username),
                chatService.buildRoomSummaries(projectId, currentUser, username, visibleRooms),
                chatService.buildDirectSummaries(projectId, currentUser, username, participants));

        return new ResponseEntity<>(response, HttpStatus.OK);
    }

        @GetMapping("/unread-badge")
        @Transactional(readOnly = true)
        public ResponseEntity<UnreadBadgeResponse> getUnreadBadge(@PathVariable Long projectId,
                                       @RequestParam(value = "includeArchived", required = false, defaultValue = "false") boolean includeArchived,
                                       Authentication authentication) {
        String username = authentication.getName();
        com.planora.backend.model.User currentUser = resolveAuthenticatedUser(authentication);
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateTeamMembership(teamId, currentUser);

        var participants = chatService.getProjectParticipantUsernames(teamId);
        var visibleRooms = chatService.getChatRoomsForProject(projectId, username, includeArchived, currentUser);
        var badge = chatService.buildUnreadBadge(projectId, currentUser, username, visibleRooms, participants);

        return new ResponseEntity<>(
            new UnreadBadgeResponse(
                badge.teamUnread(),
                badge.roomsUnread(),
                badge.directsUnread(),
                badge.totalUnread()),
            HttpStatus.OK);
        }

    @PostMapping("/team/read")
    public ResponseEntity<Void> markTeamChatAsRead(@PathVariable Long projectId,
                                                   Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        chatService.markTeamAsRead(projectId, username);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @PostMapping("/rooms/{roomId}/read")
    public ResponseEntity<Void> markRoomChatAsRead(@PathVariable Long projectId,
                                                   @PathVariable Long roomId,
                                                   Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        validateRoomMembership(roomId, username);
        chatService.markRoomAsRead(projectId, roomId, username);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @PostMapping("/direct/read")
    public ResponseEntity<Void> markDirectChatAsRead(@PathVariable Long projectId,
                                                     @RequestParam("with") String withUser,
                                                     Authentication authentication) {
        String username = authentication.getName();
        resolveValidatedTeamId(projectId, username);
        chatService.markPrivateConversationAsRead(projectId, username, withUser);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    public static record ChatRoomRequest(String name, List<String> members) {}

    @PostMapping("/rooms")
    @Transactional
    public ResponseEntity<ChatRoomResponse> createRoom(@PathVariable Long projectId,
                                                       @RequestBody ChatRoomRequest roomRequest,
                                                       Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

        if (roomRequest.name() == null || roomRequest.name().trim().isEmpty()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        var createdRoom = chatService.createRoom(projectId, teamId, username, roomRequest.name().trim(), roomRequest.members());
        var savedRoom = createdRoom.room();
        var usersToAdd = createdRoom.addedUsers();

        // Persisted notifications complement websocket room events for offline users.
        publishRoomCreatedNotifications(projectId, savedRoom, username, usersToAdd);

        simpMessagingTemplate.convertAndSend(
                "/topic/project/" + projectId + "/rooms",
            new RoomEvent("CREATED", savedRoom.getId(), toRoomResponse(savedRoom)));

        return new ResponseEntity<>(toRoomResponse(savedRoom), HttpStatus.CREATED);
    }

        @PatchMapping("/rooms/{roomId}/meta")
        @Transactional
        public ResponseEntity<ChatRoomResponse> updateRoomMeta(@PathVariable Long projectId,
                                   @PathVariable Long roomId,
                                   @RequestBody RoomMetaUpdateRequest request,
                                   Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

            var room = chatService.getChatRoomByIdAndProjectId(roomId, projectId);
            chatService.requireRoomAdminOrOwner(teamId, room, username);

            var saved = chatService.updateRoomMeta(projectId, roomId, request.name(), request.topic(), request.description());
        publishRoomUpdatedNotifications(projectId, saved, username);
        simpMessagingTemplate.convertAndSend(
            "/topic/project/" + projectId + "/rooms",
            new RoomEvent("UPDATED", saved.getId(), toRoomResponse(saved)));

        return new ResponseEntity<>(toRoomResponse(saved), HttpStatus.OK);
        }

        @PatchMapping("/rooms/{roomId}/pin")
        @Transactional
        public ResponseEntity<ChatRoomResponse> pinRoomMessage(@PathVariable Long projectId,
                                   @PathVariable Long roomId,
                                   @RequestBody RoomPinRequest request,
                                   Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

            var room = chatService.getChatRoomByIdAndProjectId(roomId, projectId);
            chatService.requireRoomAdminOrOwner(teamId, room, username);

        if (request.messageId() != null) {
            chatService.getRoomMessages(projectId, roomId).stream()
                .filter(message -> message.getId() != null && message.getId().equals(request.messageId()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Message does not belong to this room"));
        }

            var saved = chatService.pinRoomMessage(projectId, roomId, request.messageId());

        simpMessagingTemplate.convertAndSend(
            "/topic/project/" + projectId + "/rooms",
            new RoomEvent("UPDATED", saved.getId(), toRoomResponse(saved)));

        return new ResponseEntity<>(toRoomResponse(saved), HttpStatus.OK);
        }

        @PatchMapping("/rooms/{roomId}/members/{memberUserId}/role")
        @Transactional
        public ResponseEntity<Void> updateRoomMemberRole(@PathVariable Long projectId,
                                 @PathVariable Long roomId,
                                 @PathVariable Long memberUserId,
                                 @RequestBody RoomRoleUpdateRequest request,
                                 Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

            var room = chatService.getChatRoomByIdAndProjectId(roomId, projectId);
            chatService.requireRoomAdminOrOwner(teamId, room, username);

        if (request.role() == null || request.role().isBlank()) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        ChatRoomMember.RoomRole role;
        try {
            role = ChatRoomMember.RoomRole.valueOf(request.role().trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return new ResponseEntity<>(HttpStatus.BAD_REQUEST);
        }

        chatService.updateRoomMemberRole(projectId, roomId, memberUserId, role);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
        }

    @DeleteMapping("/rooms/{roomId}")
    @Transactional
    public ResponseEntity<Void> deleteRoom(@PathVariable Long projectId,
                                           @PathVariable Long roomId,
                                           Authentication authentication) {
        String username = authentication.getName();
        Long teamId = resolveValidatedTeamId(projectId, username);

        var room = chatService.getChatRoomByIdAndProjectId(roomId, projectId);
        chatService.requireRoomAdminOrOwner(teamId, room, username);

        // Snapshot recipients before members are deleted.
        publishRoomDeletedNotifications(projectId, room, username);

        chatService.deleteRoom(projectId, roomId);
        simpMessagingTemplate.convertAndSend(
            "/topic/project/" + projectId + "/rooms",
                new RoomEvent("DELETED", roomId, toRoomResponse(room)));
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    private ChatRoomResponse toRoomResponse(ChatRoom room) {
        return new ChatRoomResponse(
                room.getId(),
                room.getName(),
                room.getProjectId(),
                room.getCreatedBy(),
                room.getTopic(),
                room.getDescription(),
                Boolean.TRUE.equals(room.getArchived()),
                room.getPinnedMessageId(),
                room.getCreatedAt() != null ? room.getCreatedAt().toString() : null,
                room.getUpdatedAt() != null ? room.getUpdatedAt().toString() : null);
    }

    private void publishRoomCreatedNotifications(Long projectId,
                                                 ChatRoom room,
                                                 String actorAlias,
                                                 Set<com.planora.backend.model.User> addedUsers) {
        if (room == null || addedUsers == null || addedUsers.isEmpty()) {
            return;
        }

        var actor = userCacheService.resolveUserByEmailOrUsername(actorAlias);
        if (actor == null || actor.getUserId() == null) {
            return;
        }

        String actorDisplay = actor.getFullName() != null && !actor.getFullName().isBlank()
                ? actor.getFullName()
                : actor.getUsername();
        String roomName = room.getName() != null && !room.getName().isBlank() ? room.getName() : "channel";
        String projectName = chatService.getProjectName(projectId);
        String link = "/project/" + projectId + "/chat?roomId=" + room.getId();
        String message = actorDisplay + " added you to #" + roomName + " in \"" + projectName + "\" chat";

        addedUsers.stream()
                .filter(Objects::nonNull)
                .filter(user -> user.getUserId() != null && !user.getUserId().equals(actor.getUserId()))
                .forEach(user -> notificationService.createNotification(user, message, link));
    }

    private void publishRoomUpdatedNotifications(Long projectId, ChatRoom room, String actorAlias) {
        publishRoomLifecycleNotifications(
                projectId,
                room,
                actorAlias,
                "updated",
                "/project/" + projectId + "/chat?roomId=" + room.getId());
    }

    private void publishRoomDeletedNotifications(Long projectId, ChatRoom room, String actorAlias) {
        publishRoomLifecycleNotifications(
                projectId,
                room,
                actorAlias,
                "deleted",
                "/project/" + projectId + "/chat?view=team");
    }

    private void publishRoomLifecycleNotifications(Long projectId,
                                                   ChatRoom room,
                                                   String actorAlias,
                                                   String action,
                                                   String link) {
        if (room == null) {
            return;
        }

        var actor = userCacheService.resolveUserByEmailOrUsername(actorAlias);
        if (actor == null || actor.getUserId() == null) {
            return;
        }

        var recipients = resolveRoomRecipients(room, actor.getUserId());
        if (recipients.isEmpty()) {
            return;
        }

        String actorDisplay = actor.getFullName() != null && !actor.getFullName().isBlank()
                ? actor.getFullName()
                : actor.getUsername();
        String roomName = room.getName() != null && !room.getName().isBlank() ? room.getName() : "channel";
        String projectName = chatService.getProjectName(projectId);
        String message = actorDisplay + " " + action + " #" + roomName + " in \"" + projectName + "\" chat";

        recipients.forEach(recipient -> notificationService.createNotification(recipient, message, link));
    }

    private List<com.planora.backend.model.User> resolveRoomRecipients(ChatRoom room, Long excludedUserId) {
        return chatService.resolveRoomRecipients(room, excludedUserId);
    }

    private ChatWebhookResponse toWebhookResponse(ChatWebhookService.ChatWebhook webhook) {
        return new ChatWebhookResponse(
                webhook.id(),
                webhook.url(),
                webhook.events(),
                webhook.active(),
                webhook.createdAt());
    }

    private void validateRoomMembership(Long roomId, String usernameOrEmail) {
        chatService.ensureRoomMembership(roomId, usernameOrEmail);
    }

    private void sendPrivateMessageToConversationParticipants(Long projectId, ChatMessageDTO savedMessage) {
        var destination = "/queue/project/" + projectId + "/messages";
        var aliases = List.of(savedMessage.getSender(), savedMessage.getRecipient());

        aliases.stream()
                .filter(alias -> alias != null && !alias.isBlank())
                .map(userCacheService::resolveUserByEmailOrUsername)
                .filter(Objects::nonNull)
                .forEach(user -> sendToUserDestinations(user, destination, savedMessage));
    }

    private void sendToUserDestinations(com.planora.backend.model.User user, String destination, Object payload) {
        if (user == null || destination == null || destination.isBlank() || payload == null) {
            return;
        }

        var identities = new java.util.LinkedHashSet<String>();
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            identities.add(user.getUsername().toLowerCase());
        }
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            identities.add(user.getEmail().toLowerCase());
        }
        identities.forEach(identity -> simpMessagingTemplate.convertAndSendToUser(identity, destination, payload));
    }

    private String resolveCanonicalChatIdentifier(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return usernameOrEmail;
        }

        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            return usernameOrEmail.toLowerCase();
        }

        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername().toLowerCase();
        }

        return user.getEmail() != null ? user.getEmail().toLowerCase() : usernameOrEmail.toLowerCase();
    }

    private Long resolveValidatedTeamId(Long projectId, String usernameOrEmail) {
        Long teamId = projectMembershipService.resolveProjectTeamId(projectId);
        validateTeamMembership(teamId, usernameOrEmail);
        return teamId;
    }

    private void validateTeamMembership(Long teamId, String usernameOrEmail) {
        var user = userCacheService.resolveUserByEmailOrUsername(usernameOrEmail);
        if (user == null) {
            throw new RuntimeException("User is not found");
        }
        validateTeamMembership(teamId, user);
    }

    private void validateTeamMembership(Long teamId, com.planora.backend.model.User user) {
        projectMembershipService.assertTeamMembership(teamId, user);
    }

    private com.planora.backend.model.User resolveAuthenticatedUser(Authentication authentication) {
        return userCacheService.resolveUserByEmailOrUsername(authentication.getName());
    }

}
