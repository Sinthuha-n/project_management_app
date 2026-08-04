package com.planora.backend.service;

import java.time.LocalDateTime;
import java.net.http.HttpClient;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import com.planora.backend.dto.NotificationFeedResponseDTO;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.NotificationResponseDTO;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Notification;
import com.planora.backend.model.NotificationChannel;
import com.planora.backend.model.User;
import com.planora.backend.repository.NotificationRepository;
import com.planora.backend.repository.TaskRepository;

import jakarta.persistence.EntityNotFoundException;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private StringRedisTemplate stringRedisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Mock
    private NotificationPreferenceService notificationPreferenceService;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private HttpClient httpClient;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private NotificationService notificationService;

    private User recipient;

    @BeforeEach
    @SuppressWarnings("unused")
    void setUp() {
        lenient().when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        lenient().when(notificationPreferenceService.isEnabled(anyLong(), nullable(Long.class), anyString(), eq(NotificationChannel.IN_APP)))
                .thenReturn(true);
        lenient().when(taskRepository.findById(anyLong())).thenReturn(Optional.empty());
        recipient = new User();
        recipient.setUserId(15L);
        recipient.setUsername("alice");
        recipient.setEmail("alice@example.com");
    }

    @Test
    void createNotification_persistsAndDispatchesRealtimeEvent() {
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(101L);
            return toSave;
        });
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(1L);

        notificationService.createNotification(recipient, "You were mentioned", "/project/8/chat");

        ArgumentCaptor<Notification> savedCaptor = ArgumentCaptor.forClass(Notification.class);
        verify(notificationRepository).save(savedCaptor.capture());
        Notification saved = savedCaptor.getValue();
        assertEquals(recipient, saved.getRecipient());
        assertEquals("You were mentioned", saved.getMessage());
        assertEquals("/project/8/chat", saved.getLink());
        assertFalse(saved.isRead());

        verify(messagingTemplate).convertAndSendToUser(
                eq("alice"),
                eq("/queue/notifications"),
                any(NotificationResponseDTO.class)
        );
        verify(messagingTemplate).convertAndSendToUser(
            eq("alice"),
            eq("/queue/notifications-badge"),
            eq("1")
        );
    }

    @Test
    void createNotification_normalizesDestinationUsernameToLowercase() {
        recipient.setUsername("AliceMixedCase");

        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(102L);
            return toSave;
        });
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(1L);

        notificationService.createNotification(recipient, "Realtime alert", "/project/10/chat");

        verify(messagingTemplate).convertAndSendToUser(
                eq("alicemixedcase"),
                eq("/queue/notifications"),
                any(NotificationResponseDTO.class)
        );
        verify(messagingTemplate).convertAndSendToUser(
            eq("alicemixedcase"),
            eq("/queue/notifications-badge"),
            eq("1")
        );
    }

    @Test
    void createNotificationIfNotDuplicate_createsWhenNoRecentDuplicate() {
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("New task assigned"), eq("/taskcard?taskId=10"), any(LocalDateTime.class)
        )).thenReturn(false);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(111L);
            return toSave;
        });
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(1L);

        notificationService.createNotificationIfNotDuplicate(recipient, "New task assigned", "/taskcard?taskId=10");

        verify(notificationRepository).existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("New task assigned"), eq("/taskcard?taskId=10"), any(LocalDateTime.class)
        );
        verify(notificationRepository).save(any(Notification.class));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications"), any(NotificationResponseDTO.class));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications-badge"), eq("1"));
    }

    @Test
    void createNotificationIfNotDuplicate_skipsWhenDuplicateExists() {
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                eq(15L), eq("Duplicate"), eq("/project/8/chat"), any(LocalDateTime.class)
        )).thenReturn(true);

        notificationService.createNotificationIfNotDuplicate(recipient, "Duplicate", "/project/8/chat");

        verify(notificationRepository, never()).save(any(Notification.class));
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
    }

    @Test
    void createNotificationIfNotDuplicateSince_createsWhenNoDuplicateInWindow() {
        LocalDateTime windowStart = LocalDateTime.parse("2026-04-18T00:00:00");
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                15L, "Task due soon", "/taskcard?taskId=10", windowStart
        )).thenReturn(false);
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification toSave = invocation.getArgument(0);
            toSave.setId(222L);
            return toSave;
        });
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(1L);

        boolean created = notificationService.createNotificationIfNotDuplicateSince(
                recipient,
                "Task due soon",
                "/taskcard?taskId=10",
                windowStart
        );

        assertTrue(created);
        verify(notificationRepository).save(any(Notification.class));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications"), any(NotificationResponseDTO.class));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications-badge"), eq("1"));
    }

    @Test
    void createNotificationIfNotDuplicateSince_skipsWhenDuplicateInWindow() {
        LocalDateTime windowStart = LocalDateTime.parse("2026-04-18T00:00:00");
        when(notificationRepository.existsByRecipientUserIdAndMessageAndLinkAndCreatedAtAfter(
                15L, "Task overdue", "/taskcard?taskId=12", windowStart
        )).thenReturn(true);

        boolean created = notificationService.createNotificationIfNotDuplicateSince(
                recipient,
                "Task overdue",
                "/taskcard?taskId=12",
                windowStart
        );

        assertFalse(created);
        verify(notificationRepository, never()).save(any(Notification.class));
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
    }

    @Test
    void createNotificationIfNotDuplicateByLinkAndMessagePrefix_skipsRepeatedEvent() {
        String prefix = "\uD83D\uDD00 PR opened: #17 ";
        String link = "https://github.com/planora/app/pull/17";
        when(notificationRepository.existsByRecipientUserIdAndLinkAndMessageStartingWith(
            15L, link, prefix)).thenReturn(true);

        boolean created = notificationService.createNotificationIfNotDuplicateByLinkAndMessagePrefix(
                recipient, prefix + "Improve sync by @octocat", link, prefix);

        assertFalse(created);
        verify(notificationRepository, never()).save(any(Notification.class));
        verify(messagingTemplate, never()).convertAndSendToUser(anyString(), anyString(), any());
    }

    @Test
    void getUserNotificationFeed_mapsEntitiesToDtosAndUnreadCount() {
        Notification first = new Notification();
        first.setId(1L);
        first.setRecipient(recipient);
        first.setMessage("m1");
        first.setLink("/l1");
        first.setRead(false);
        first.setCreatedAt(LocalDateTime.parse("2026-04-04T10:00:00"));

        Notification second = new Notification();
        second.setId(2L);
        second.setRecipient(recipient);
        second.setMessage("m2");
        second.setLink("/l2");
        second.setRead(true);
        second.setCreatedAt(LocalDateTime.parse("2026-04-04T09:00:00"));

        NotificationRepository.NotificationFeedRow firstRow = org.mockito.Mockito.mock(NotificationRepository.NotificationFeedRow.class);
        NotificationRepository.NotificationFeedRow secondRow = org.mockito.Mockito.mock(NotificationRepository.NotificationFeedRow.class);
        when(firstRow.getNotification()).thenReturn(first);
        when(firstRow.getUnreadCount()).thenReturn(1L);
        when(secondRow.getNotification()).thenReturn(second);
        when(notificationRepository.findNotificationFeedByRecipientUserId(15L)).thenReturn(List.of(firstRow, secondRow));

        NotificationFeedResponseDTO feed = notificationService.getUserNotificationFeed(15L);

        assertEquals(2, feed.getNotifications().size());
        assertEquals(1L, feed.getNotifications().get(0).getId());
        assertEquals("m1", feed.getNotifications().get(0).getMessage());
        assertFalse(feed.getNotifications().get(0).isRead());
        assertTrue(feed.getNotifications().get(1).isRead());
        assertEquals(1L, feed.getUnreadCount());
    }

    @Test
    void getUnreadCount_whenRedisCacheDisabled_readsDatabaseWithoutRedisAccess() {
        ReflectionTestUtils.setField(notificationService, "notificationRedisCacheEnabled", false);
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(7L);

        long unreadCount = notificationService.getUnreadCount(15L);

        assertEquals(7L, unreadCount);
        verify(notificationRepository).countByRecipientUserIdAndIsReadFalse(15L);
        verify(stringRedisTemplate, never()).opsForValue();
        verify(stringRedisTemplate, never()).delete(anyString());
        verify(valueOperations, never()).get(anyString());
        verify(valueOperations, never()).set(anyString(), anyString(), any());
    }

    @Test
    void markAsRead_updatesNotificationWhenOwnedByUser() {
        Notification notification = new Notification();
        notification.setId(80L);
        notification.setRecipient(recipient);
        notification.setRead(false);

        when(notificationRepository.findById(80L)).thenReturn(Optional.of(notification));
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(0L);

        notificationService.markAsRead(80L, 15L);

        assertTrue(notification.isRead());
        verify(notificationRepository).save(notification);
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications-badge"), eq("0"));
    }

    @Test
    void markAsRead_throwsWhenUserDoesNotOwnNotification() {
        Notification notification = new Notification();
        notification.setId(81L);
        notification.setRecipient(recipient);

        when(notificationRepository.findById(81L)).thenReturn(Optional.of(notification));

        ForbiddenException ex = assertThrows(ForbiddenException.class,
                () -> notificationService.markAsRead(81L, 99L));
        assertEquals("You cannot modify this notification", ex.getMessage());
        verify(notificationRepository, never()).save(any(Notification.class));
    }

    @Test
    void deleteNotification_deletesOnlyWhenOwnedByUser() {
        Notification notification = new Notification();
        notification.setId(82L);
        notification.setRecipient(recipient);
        when(notificationRepository.findById(82L)).thenReturn(Optional.of(notification));
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(0L);

        notificationService.deleteNotification(82L, 15L);

        verify(notificationRepository).delete(notification);
    }

    @Test
    void deleteNotification_rejectsAnotherUsersNotification() {
        Notification notification = new Notification();
        notification.setId(83L);
        notification.setRecipient(recipient);
        when(notificationRepository.findById(83L)).thenReturn(Optional.of(notification));

        assertThrows(ForbiddenException.class,
                () -> notificationService.deleteNotification(83L, 99L));
        verify(notificationRepository, never()).delete(any(Notification.class));
    }

    @Test
    void markAsRead_throwsWhenNotificationMissing() {
        when(notificationRepository.findById(anyLong())).thenReturn(Optional.empty());

        EntityNotFoundException ex = assertThrows(EntityNotFoundException.class,
                () -> notificationService.markAsRead(999L, 15L));
        assertEquals("Notification not found", ex.getMessage());
    }

    @Test
    void markAllAsRead_marksUnreadAndSavesAll() {
        Notification unread = new Notification();
        unread.setRecipient(recipient);
        unread.setRead(false);

        Notification read = new Notification();
        read.setRecipient(recipient);
        read.setRead(true);

        when(notificationRepository.findByRecipientUserIdAndIsReadFalseOrderByCreatedAtDesc(15L)).thenReturn(List.of(unread));
        when(notificationRepository.countByRecipientUserIdAndIsReadFalse(15L)).thenReturn(0L);

        notificationService.markAllAsRead(15L);

        assertTrue(unread.isRead());
        verify(notificationRepository, times(1)).saveAll(List.of(unread));
        verify(messagingTemplate).convertAndSendToUser(eq("alice"), eq("/queue/notifications-badge"), eq("0"));
    }
}
