package com.planora.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.dto.NotificationPreferenceRequestDTO;
import com.planora.backend.dto.NotificationPreferenceResponseDTO;
import com.planora.backend.model.NotificationChannel;
import com.planora.backend.model.NotificationPreference;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import com.planora.backend.repository.NotificationPreferenceRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class NotificationPreferenceServiceTest {

    @Mock
    private NotificationPreferenceRepository preferenceRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private ProjectRepository projectRepository;

    private NotificationPreferenceService service;

    @BeforeEach
    void setUp() {
        service = new NotificationPreferenceService(preferenceRepository, userRepository, projectRepository);
    }

    @Test
    void projectOverrideTakesPrecedenceOverGlobalPreference() {
        NotificationPreference override = preference(false);
        when(preferenceRepository.findByUserUserIdAndProjectIdAndEventTypeAndChannel(
                7L, 11L, "TASK_ACTIVITY", NotificationChannel.EMAIL))
                .thenReturn(Optional.of(override));

        assertThat(service.isEnabled(7L, 11L, " task_activity ", NotificationChannel.EMAIL)).isFalse();
        verify(preferenceRepository, never())
                .findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(any(), any(), any());
    }

    @Test
    void globalPreferenceIsFallbackForProjectAndGlobalScopes() {
        NotificationPreference global = preference(false);
        when(preferenceRepository.findByUserUserIdAndProjectIdAndEventTypeAndChannel(
                7L, 11L, "CHAT_ACTIVITY", NotificationChannel.IN_APP))
                .thenReturn(Optional.empty());
        when(preferenceRepository.findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(
                7L, "CHAT_ACTIVITY", NotificationChannel.IN_APP))
                .thenReturn(Optional.of(global));

        assertThat(service.isEnabled(7L, 11L, "chat_activity", NotificationChannel.IN_APP)).isFalse();
        assertThat(service.isEnabled(7L, null, "chat_activity", NotificationChannel.IN_APP)).isFalse();
    }

    @Test
    void missingPreferenceDefaultsToEnabledAndBlankEventDefaultsToProjectActivity() {
        when(preferenceRepository.findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(
                7L, "PROJECT_ACTIVITY", NotificationChannel.EMAIL))
                .thenReturn(Optional.empty());

        assertThat(service.isEnabled(7L, null, null, NotificationChannel.EMAIL)).isTrue();
        assertThat(service.isEnabled(7L, null, "  ", NotificationChannel.EMAIL)).isTrue();
    }

    @Test
    void createsGlobalPreferenceWithNormalizedEventType() {
        User user = new User();
        user.setUserId(7L);
        when(userRepository.getReferenceById(7L)).thenReturn(user);
        when(preferenceRepository.findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(
                7L, "GITHUB_ACTIVITY", NotificationChannel.EMAIL))
                .thenReturn(Optional.empty());
        when(preferenceRepository.save(any())).thenAnswer(invocation -> {
            NotificationPreference saved = invocation.getArgument(0);
            saved.setId(19L);
            return saved;
        });

        NotificationPreferenceResponseDTO result = service.upsertPreference(7L,
                request(null, " github_activity ", NotificationChannel.EMAIL, false));

        assertThat(result.getId()).isEqualTo(19L);
        assertThat(result.getProjectId()).isNull();
        assertThat(result.getEventType()).isEqualTo("GITHUB_ACTIVITY");
        assertThat(result.getChannel()).isEqualTo(NotificationChannel.EMAIL);
        assertThat(result.isEnabled()).isFalse();
        verify(projectRepository, never()).getReferenceById(any());
    }

    @Test
    void updatesExistingProjectPreferenceAndReturnsItsScope() {
        User user = new User();
        Project project = new Project();
        project.setId(11L);
        NotificationPreference existing = preference(false);
        existing.setId(29L);
        when(userRepository.getReferenceById(7L)).thenReturn(user);
        when(projectRepository.getReferenceById(11L)).thenReturn(project);
        when(preferenceRepository.findByUserUserIdAndProjectIdAndEventTypeAndChannel(
                7L, 11L, "REMINDER_ACTIVITY", NotificationChannel.IN_APP))
                .thenReturn(Optional.of(existing));
        when(preferenceRepository.save(existing)).thenReturn(existing);

        NotificationPreferenceResponseDTO result = service.upsertPreference(7L,
                request(11L, "REMINDER_ACTIVITY", NotificationChannel.IN_APP, true));

        assertThat(result.getId()).isEqualTo(29L);
        assertThat(result.getProjectId()).isEqualTo(11L);
        assertThat(result.isEnabled()).isTrue();
        ArgumentCaptor<NotificationPreference> captor = ArgumentCaptor.forClass(NotificationPreference.class);
        verify(preferenceRepository).save(captor.capture());
        assertThat(captor.getValue().getUser()).isSameAs(user);
        assertThat(captor.getValue().getProject()).isSameAs(project);
    }

    @Test
    void preferenceMatrixContainsEveryEventAndChannelInStableOrder() {
        when(preferenceRepository.findByUserUserIdAndProjectIdAndEventTypeAndChannel(
                any(), any(), any(), any())).thenReturn(Optional.empty());
        when(preferenceRepository.findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(
                any(), any(), any())).thenReturn(Optional.empty());

        List<NotificationPreferenceResponseDTO> result = service.getPreferenceMatrix(7L, 11L);

        assertThat(result).hasSize(10).allSatisfy(item -> {
            assertThat(item.getProjectId()).isEqualTo(11L);
            assertThat(item.isEnabled()).isTrue();
        });
        assertThat(result).extracting(NotificationPreferenceResponseDTO::getEventType)
                .containsExactly(
                        "CHAT_ACTIVITY", "CHAT_ACTIVITY",
                        "TASK_ACTIVITY", "TASK_ACTIVITY",
                        "PROJECT_ACTIVITY", "PROJECT_ACTIVITY",
                        "TEAM_ACTIVITY", "TEAM_ACTIVITY",
                        "REMINDER_ACTIVITY", "REMINDER_ACTIVITY");
        assertThat(result).extracting(NotificationPreferenceResponseDTO::getChannel)
                .containsExactly(
                        NotificationChannel.IN_APP, NotificationChannel.EMAIL,
                        NotificationChannel.IN_APP, NotificationChannel.EMAIL,
                        NotificationChannel.IN_APP, NotificationChannel.EMAIL,
                        NotificationChannel.IN_APP, NotificationChannel.EMAIL,
                        NotificationChannel.IN_APP, NotificationChannel.EMAIL);
    }

    private static NotificationPreferenceRequestDTO request(Long projectId, String eventType,
            NotificationChannel channel, boolean enabled) {
        return NotificationPreferenceRequestDTO.builder()
                .projectId(projectId)
                .eventType(eventType)
                .channel(channel)
                .enabled(enabled)
                .build();
    }

    private static NotificationPreference preference(boolean enabled) {
        NotificationPreference preference = new NotificationPreference();
        preference.setEnabled(enabled);
        return preference;
    }
}
