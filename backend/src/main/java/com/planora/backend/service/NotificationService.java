// Service layer for notification operations: creation, deduplication, retrieval, and status updates.
package com.planora.backend.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.NotificationFeedResponseDTO;
import com.planora.backend.dto.NotificationResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Notification;
import com.planora.backend.model.NotificationChannel;
import com.planora.backend.model.NotificationEventType;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPushToken;
import com.planora.backend.repository.NotificationRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.UserPushTokenRepository;

import jakarta.persistence.EntityNotFoundException;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

    private final NotificationRepository notificationRepository;
    private final UserPushTokenRepository userPushTokenRepository;
    private final SimpMessagingTemplate messagingTemplate;

    private final StringRedisTemplate stringRedisTemplate;

    @Value("${notifications.cache.redis.enabled:true}")
    private boolean notificationRedisCacheEnabled = true;

    private final NotificationPreferenceService notificationPreferenceService;

    private final TaskRepository taskRepository;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    private static final Duration UNREAD_COUNT_TTL = Duration.ofSeconds(30);
    private static final String UNREAD_COUNT_KEY_PREFIX = "notifications:unread-count:";
    private static final Pattern PROJECT_ID_PATH_PATTERN = Pattern.compile("/project/(\\d+)");
    private static final Pattern PROJECT_ID_QUERY_PATTERN = Pattern.compile("[?&]projectId=(\\d+)");
    private static final Pattern MEMBERS_ID_PATH_PATTERN = Pattern.compile("/members/(\\d+)");
    private static final Pattern TASK_ID_QUERY_PATTERN = Pattern.compile("[?&]taskId=(\\d+)");

    // =====================================================
    // NOTIFICATION CREATION & DEDUPLICATION
    // =====================================================

    /**
     * Unconditionally creates and persists a notification.
     * Used by TaskService for task-assignment and comment events
     * (where duplicates are not a concern).
     */
    @Transactional
    public void createNotification(User recipient, String message, String link) {
        createNotification(recipient, resolveProjectId(link), inferEventType(message, link), message, link);
    }

    @Transactional
    public void createNotification(User recipient, Long projectId, String eventType, String message, String link) {
        if (!shouldDeliverNotification(recipient, projectId, eventType, NotificationChannel.IN_APP)) {
            return;
        }

        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setMessage(message);
        notification.setLink(link);
        notification.setRead(false);
        notification.setCreatedAt(LocalDateTime.now());
        notification = notificationRepository.save(notification);

        sendExpoPushNotifications(recipient, notification, projectId, eventType);

        // Disptach via websocket for global realtime overlay
        NotificationResponseDTO dto = NotificationResponseDTO.builder()
                .id(notification.getId())
                .message(notification.getMessage())
                .link(notification.getLink())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .build();

        String destinationUsername = recipient.getUsername().toLowerCase(Locale.ROOT);
        messagingTemplate.convertAndSendToUser(
                destinationUsername,
                "/queue/notifications",
                dto
        );

        refreshUnreadCount(recipient);
    }

    /**
     * Creates a notification only if an identical one (same recipient, message,
     * and link) has NOT already been created within the last 60 seconds.
     *
     * This prevents duplicate notifications when chat events (DMs, @mentions)
     * may be triggered by multiple code paths for the same underlying message.
     */
    @Transactional
    public void createNotificationIfNotDuplicate(User recipient, String message, String link) {
        // Dedup window: 60 seconds
        LocalDateTime window = LocalDateTime.now().minusSeconds(60);
        createNotificationIfNotDuplicateSince(recipient, message, link, window);
    }

    /**
     * Creates a notification if no identical notification exists since {@code windowStart}.
     * Returns true when the notification was created, false when skipped as duplicate.
     */
    @Transactional
    public boolean createNotificationIfNotDuplicateSince(
            User recipient,
            String message,
            String link,
            LocalDateTime windowStart
    ) {
        return createNotificationIfNotDuplicateSince(recipient, resolveProjectId(link), inferEventType(message, link), message, link, windowStart);
        }

        @Transactional
        public boolean createNotificationIfNotDuplicateSince(
            User recipient,
            Long projectId,
            String eventType,
            String message,
            String link,
            LocalDateTime windowStart
        ) {
        if (!shouldDeliverNotification(recipient, projectId, eventType, NotificationChannel.IN_APP)) {
            return false;
        }

        boolean alreadyExists = notificationRepository
                .existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                        recipient.getUserId(), message, link, windowStart
                );
        if (alreadyExists) {
            return false;
        }
        createNotification(recipient, message, link);
        return true;
    }

    /**
     * Prevents repeated event notifications whose descriptive text can change
     * while their destination and stable event prefix remain the same.
     */
    @Transactional
    public boolean createNotificationIfNotDuplicateByLinkAndMessagePrefix(
            User recipient,
            String message,
            String link,
            String messagePrefix
    ) {
        return createNotificationIfNotDuplicateByLinkAndMessagePrefix(
            recipient, resolveProjectId(link), inferEventType(message, link), message, link, messagePrefix);
        }

        @Transactional
        public boolean createNotificationIfNotDuplicateByLinkAndMessagePrefix(
            User recipient,
            Long projectId,
            String eventType,
            String message,
            String link,
            String messagePrefix
        ) {
        if (!shouldDeliverNotification(recipient, projectId, eventType, NotificationChannel.IN_APP)) {
            return false;
        }

        boolean alreadyExists = notificationRepository
                .existsByRecipientUserIdAndLinkAndMessageStartingWith(
                        recipient.getUserId(), link, messagePrefix
                );
        if (alreadyExists) {
            return false;
        }
        createNotification(recipient, message, link);
        return true;
    }

    // =====================================================
    // NOTIFICATION RETRIEVAL & STATUS UPDATES
    // =====================================================

    // Retrieves all notifications for a specific user together with the unread count.
    public NotificationFeedResponseDTO getUserNotificationFeed(Long userId) {
        List<NotificationRepository.NotificationFeedRow> rows = notificationRepository.findNotificationFeedByRecipientUserId(userId);

        List<NotificationResponseDTO> notifications = rows.stream()
                .map(NotificationRepository.NotificationFeedRow::getNotification)
                .map(n -> NotificationResponseDTO.builder()
                        .id(n.getId())
                        .message(n.getMessage())
                        .link(n.getLink())
                        .isRead(n.isRead())
                        .createdAt(n.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        Long unreadCountValue = rows.isEmpty() ? null : rows.get(0).getUnreadCount();
        long unreadCount = unreadCountValue == null ? 0L : unreadCountValue;
        cacheUnreadCount(userId, unreadCount);

        return NotificationFeedResponseDTO.builder()
                .notifications(notifications)
                .unreadCount(unreadCount)
                .build();
    }

    // Gets the total count of unread notifications for a user.
    public long getUnreadCount(Long userId) {
        if (notificationRedisCacheEnabled) {
            String cacheKey = unreadCountCacheKey(userId);
            try {
                String cached = stringRedisTemplate.opsForValue().get(cacheKey);
                if (cached != null) {
                    return Long.parseLong(cached);
                }
            } catch (RuntimeException ex) {
                // Redis is a cache, not a source of truth. Fall back to the database.
            }
        }

        long count = notificationRepository.countByRecipientUserIdAndIsReadFalse(userId);
        cacheUnreadCount(userId, count);
        return count;
    }

    // Marks a specific notification as read, ensuring the user owns the notification.
    @Transactional
    public void markAsRead(Long notificationId, Long userId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        
        if (!notification.getRecipient().getUserId().equals(userId)) {
            throw new ForbiddenException("You cannot modify this notification");
        }
        
        notification.setRead(true);
        notificationRepository.save(notification);

        refreshUnreadCount(notification.getRecipient());
    }

    // Marks all unread notifications as read for a specific user.
    @Transactional
    public void markAllAsRead(Long userId) {
        List<Notification> unread = notificationRepository.findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(userId);

        if (unread.isEmpty()) {
            return;
        }

        User recipient = unread.get(0).getRecipient();
        
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);

        refreshUnreadCount(recipient);
    }

    // Deletes a notification by its ID.
    @Transactional
    public void deleteNotification(Long id, Long userId) {
        Notification notification = notificationRepository.findById(id).orElse(null);
        if (notification == null) {
            return;
        }

        if (!notification.getRecipient().getUserId().equals(userId)) {
            throw new ForbiddenException("You cannot delete this notification");
        }

        User recipient = notification.getRecipient();
        notificationRepository.delete(notification);

        refreshUnreadCount(recipient);
    }

    private long refreshUnreadCount(User recipient) {
        evictUnreadCountCache(recipient.getUserId());
        long unreadCount = notificationRepository.countByRecipientUserIdAndIsReadFalse(recipient.getUserId());
        cacheUnreadCount(recipient.getUserId(), unreadCount);
        sendUnreadCountUpdate(recipient, unreadCount);
        return unreadCount;
    }

    private void evictUnreadCountCache(Long userId) {
        if (!notificationRedisCacheEnabled) {
            return;
        }
        try {
            stringRedisTemplate.delete(unreadCountCacheKey(userId));
        } catch (RuntimeException ex) {
            // If Redis is unavailable, the database remains authoritative.
        }
    }

    private void cacheUnreadCount(Long userId, long unreadCount) {
        if (!notificationRedisCacheEnabled) {
            return;
        }
        try {
            stringRedisTemplate.opsForValue().set(unreadCountCacheKey(userId), Long.toString(unreadCount), UNREAD_COUNT_TTL);
        } catch (RuntimeException ex) {
            // If Redis is down, keep serving the live value.
        }
    }

    private void sendUnreadCountUpdate(User recipient, long unreadCount) {
        messagingTemplate.convertAndSendToUser(
                recipient.getUsername().toLowerCase(Locale.ROOT),
                "/queue/notifications-badge",
                Long.toString(unreadCount)
        );
    }

    private void sendExpoPushNotifications(User recipient, Notification notification, Long projectId, String eventType) {
        if (userPushTokenRepository == null) {
            // In some unit-tests the repository is not provided; treat as no push tokens.
            return;
        }

        List<UserPushToken> pushTokens = userPushTokenRepository.findByUserUserId(recipient.getUserId());
        if (pushTokens == null || pushTokens.isEmpty()) {
            return;
        }

        for (UserPushToken pushToken : pushTokens) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("to", pushToken.getToken());
            payload.put("title", buildExpoPushTitle(eventType));
            payload.put("body", notification.getMessage());

            Map<String, Object> data = new LinkedHashMap<>();
            if (notification.getLink() != null) {
                data.put("link", notification.getLink());
            }
            if (projectId != null) {
                data.put("projectId", projectId);
            }
            if (eventType != null) {
                data.put("eventType", eventType);
            }
            data.put("notificationId", notification.getId());
            payload.put("data", data);

            try {
                String body = objectMapper.writeValueAsString(payload);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(EXPO_PUSH_URL))
                        .timeout(Duration.ofSeconds(5))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();

                httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                        .thenAccept(response -> {
                            if (response.statusCode() >= 400) {
                                log.warn("Expo push API returned {} for user {} token {}", response.statusCode(), recipient.getUserId(), pushToken.getId());
                            }
                        })
                        .exceptionally(ex -> {
                            log.warn("Expo push API request failed for user {} token {}: {}", recipient.getUserId(), pushToken.getId(), ex.getMessage());
                            return null;
                        });
            } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
                log.warn("Unable to serialize Expo push notification for user {} token {}: {}", recipient.getUserId(), pushToken.getId(), ex.getMessage());
            }
        }
    }

    private String buildExpoPushTitle(String eventType) {
        if (eventType == null) {
            return "Planora";
        }

        return switch (eventType) {
            case "TASK_ACTIVITY" -> "Task update";
            case "CHAT_ACTIVITY" -> "Chat update";
            case "GITHUB_ACTIVITY" -> "GitHub update";
            case "TEAM_ACTIVITY" -> "Team update";
            case "REMINDER_ACTIVITY" -> "Reminder";
            default -> "Project update";
        };
    }

    private String unreadCountCacheKey(Long userId) {
        return UNREAD_COUNT_KEY_PREFIX + userId;
    }

    private boolean shouldDeliverNotification(User recipient, Long projectId, String eventType, NotificationChannel channel) {
        if (recipient == null || recipient.getUserId() == null) {
            return false;
        }
        return notificationPreferenceService.isEnabled(recipient.getUserId(), projectId, eventType, channel);
    }

    private Long resolveProjectId(String link) {
        if (link == null || link.isBlank()) {
            return null;
        }

        Matcher queryMatcher = PROJECT_ID_QUERY_PATTERN.matcher(link);
        if (queryMatcher.find()) {
            return Long.valueOf(queryMatcher.group(1));
        }

        Matcher pathMatcher = PROJECT_ID_PATH_PATTERN.matcher(link);
        if (pathMatcher.find()) {
            return Long.valueOf(pathMatcher.group(1));
        }

        Matcher membersMatcher = MEMBERS_ID_PATH_PATTERN.matcher(link);
        if (membersMatcher.find()) {
            return Long.valueOf(membersMatcher.group(1));
        }

        Matcher taskMatcher = TASK_ID_QUERY_PATTERN.matcher(link);
        if (taskMatcher.find()) {
            Long taskId = Long.valueOf(taskMatcher.group(1));
            return taskRepository.findById(taskId)
                    .map(task -> task.getProject() != null ? task.getProject().getId() : null)
                    .orElse(null);
        }

        return null;
    }

    private String inferEventType(String message, String link) {
        String normalizedMessage = message == null ? "" : message.toLowerCase(Locale.ROOT);
        String normalizedLink = link == null ? "" : link.toLowerCase(Locale.ROOT);

        if (normalizedLink.contains("github.com")
                || normalizedMessage.contains("pr merged")
                || normalizedMessage.contains("pr opened")
                || normalizedMessage.contains("review requested")
                || normalizedMessage.contains("issue")
                || normalizedMessage.contains("release")
                || normalizedMessage.contains("ci failed")) {
            return NotificationEventType.GITHUB_ACTIVITY.name();
        }

        if (normalizedMessage.contains("due in")
                || normalizedMessage.contains("overdue")
                || normalizedMessage.contains("reminder")) {
            return NotificationEventType.REMINDER_ACTIVITY.name();
        }

        if (normalizedLink.contains("/chat")
                || normalizedMessage.contains("mentioned")
                || normalizedMessage.contains("message in")
                || normalizedMessage.contains("replied in a thread")
                || normalizedMessage.contains("reacted")) {
            return NotificationEventType.CHAT_ACTIVITY.name();
        }

        if (normalizedMessage.contains("role")
                || normalizedMessage.contains("member")
                || normalizedMessage.contains("invited")
                || normalizedMessage.contains("joined")
                || normalizedMessage.contains("left project")
                || normalizedMessage.contains("removed you")) {
            return NotificationEventType.TEAM_ACTIVITY.name();
        }

        if (normalizedLink.contains("/taskcard")
                || normalizedMessage.contains("task")
                || normalizedMessage.contains("sprint")
                || normalizedMessage.contains("backlog")) {
            return NotificationEventType.TASK_ACTIVITY.name();
        }

        return NotificationEventType.PROJECT_ACTIVITY.name();
    }
}
