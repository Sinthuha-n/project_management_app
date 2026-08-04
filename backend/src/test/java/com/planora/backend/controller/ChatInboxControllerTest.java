package com.planora.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import com.planora.backend.service.ChatInboxService;

class ChatInboxControllerTest {

    private ChatInboxService service;
    private ChatInboxController controller;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        service = mock(ChatInboxService.class);
        controller = new ChatInboxController(service);
        authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn("member@example.test");
    }

    @Test
    void inbox_normalizesStatusAndCapsLimits() {
        controller.getInbox(1L, authentication, 999, 2000, " UNREAD ");
        verify(service).getInbox(1L, "member@example.test", 500, 1000, "unread");

        controller.getInbox(1L, authentication, -1, 0, "unsupported");
        verify(service).getInbox(1L, "member@example.test", 0, 1, "all");

        controller.getInbox(1L, authentication, 20, 100, null);
        verify(service).getInbox(1L, "member@example.test", 20, 100, "all");
    }

    @Test
    void inbox_rejectsIncompleteAuthentication() {
        assertThat(controller.getInbox(null, authentication, 20, 100, "all").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(controller.getInbox(1L, null, 20, 100, "all").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        when(authentication.getName()).thenReturn(" ");
        assertThat(controller.getInbox(1L, authentication, 20, 100, "all").getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(service, never()).getInbox(org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyString());
    }
}
