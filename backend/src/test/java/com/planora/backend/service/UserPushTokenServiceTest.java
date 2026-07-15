package com.planora.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPushToken;
import com.planora.backend.repository.UserPushTokenRepository;

@ExtendWith(MockitoExtension.class)
class UserPushTokenServiceTest {

    @Mock
    private UserService userService;
    @Mock
    private UserPushTokenRepository pushTokenRepository;
    @InjectMocks
    private UserPushTokenService service;

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t"})
    void rejectsMissingPushToken(String token) {
        assertThatThrownBy(() -> service.registerPushToken("member@example.com", token, "ios"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Push token is required");
        verify(userService, never()).getUserByEmail(any());
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\n"})
    void rejectsMissingPlatform(String platform) {
        assertThatThrownBy(() -> service.registerPushToken("member@example.com", "token", platform))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Platform is required");
        verify(userService, never()).getUserByEmail(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"web", "desktop", "iOSs"})
    void rejectsUnsupportedPlatform(String platform) {
        assertThatThrownBy(() -> service.registerPushToken("member@example.com", "token", platform))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Platform must be ios or android");
        verify(userService, never()).getUserByEmail(any());
    }

    @Test
    void createsTokenWithTrimmedTokenAndNormalizedPlatform() {
        User user = user(7L);
        when(userService.getUserByEmail("member@example.com")).thenReturn(user);
        when(pushTokenRepository.findByUserUserIdAndToken(7L, "device-token"))
                .thenReturn(Optional.empty());

        service.registerPushToken("member@example.com", "  device-token  ", "  IOS ");

        ArgumentCaptor<UserPushToken> captor = ArgumentCaptor.forClass(UserPushToken.class);
        verify(pushTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isSameAs(user);
        assertThat(captor.getValue().getToken()).isEqualTo("device-token");
        assertThat(captor.getValue().getPlatform()).isEqualTo("ios");
    }

    @Test
    void updatesExistingTokenInsteadOfCreatingDuplicate() {
        User user = user(7L);
        UserPushToken existing = new UserPushToken();
        existing.setId(31L);
        existing.setPlatform("ios");
        when(userService.getUserByEmail("member@example.com")).thenReturn(user);
        when(pushTokenRepository.findByUserUserIdAndToken(7L, "device-token"))
                .thenReturn(Optional.of(existing));

        service.registerPushToken("member@example.com", "device-token", "ANDROID");

        verify(pushTokenRepository).save(existing);
        assertThat(existing.getUser()).isSameAs(user);
        assertThat(existing.getPlatform()).isEqualTo("android");
    }

    private static User user(Long id) {
        User user = new User();
        user.setUserId(id);
        return user;
    }
}
