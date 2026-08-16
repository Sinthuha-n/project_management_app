package com.planora.backend.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.dto.NotificationPreferenceRequestDTO;
import com.planora.backend.dto.NotificationPreferenceResponseDTO;
import com.planora.backend.model.NotificationChannel;
import com.planora.backend.model.NotificationEventType;
import com.planora.backend.model.NotificationPreference;
import com.planora.backend.repository.NotificationPreferenceRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class NotificationPreferenceService {

    private static final List<String> SUPPORTED_EVENT_TYPES = List.of(
            NotificationEventType.CHAT_ACTIVITY.name(),
            NotificationEventType.TASK_ACTIVITY.name(),
            NotificationEventType.PROJECT_ACTIVITY.name(),
            NotificationEventType.TEAM_ACTIVITY.name(),
            NotificationEventType.REMINDER_ACTIVITY.name()
    );

    private final NotificationPreferenceRepository notificationPreferenceRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;

    @Transactional(readOnly = true)
    public List<NotificationPreferenceResponseDTO> getPreferenceMatrix(Long userId, Long projectId) {
        Map<String, NotificationPreferenceResponseDTO> current = new LinkedHashMap<>();

        for (String eventType : SUPPORTED_EVENT_TYPES) {
            for (NotificationChannel channel : NotificationChannel.values()) {
                boolean enabled = isEnabled(userId, projectId, eventType, channel);
                NotificationPreferenceResponseDTO dto = NotificationPreferenceResponseDTO.builder()
                        .eventType(eventType)
                        .channel(channel)
                        .enabled(enabled)
                        .projectId(projectId)
                        .build();
                current.put(matrixKey(eventType, channel), dto);
            }
        }

        return new ArrayList<>(current.values());
    }

    @Transactional
    public NotificationPreferenceResponseDTO upsertPreference(Long userId, NotificationPreferenceRequestDTO request) {
        String eventType = normalizeEventType(request.getEventType());
        NotificationChannel channel = request.getChannel();
        Long projectId = request.getProjectId();

        NotificationPreference preference = projectId == null
                ? notificationPreferenceRepository.findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(userId, eventType, channel)
                        .orElseGet(NotificationPreference::new)
                : notificationPreferenceRepository.findByUserUserIdAndProjectIdAndEventTypeAndChannel(userId, projectId, eventType, channel)
                        .orElseGet(NotificationPreference::new);

        preference.setUser(userRepository.getReferenceById(userId));
        preference.setProject(projectId == null ? null : projectRepository.getReferenceById(projectId));
        preference.setEventType(eventType);
        preference.setChannel(channel);
        preference.setEnabled(request.isEnabled());

        NotificationPreference saved = notificationPreferenceRepository.save(preference);
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(Long userId, Long projectId, String eventType, NotificationChannel channel) {
        String normalizedEventType = normalizeEventType(eventType);

        if (projectId != null) {
            var projectOverride = notificationPreferenceRepository
                    .findByUserUserIdAndProjectIdAndEventTypeAndChannel(userId, projectId, normalizedEventType, channel);
            if (projectOverride.isPresent()) {
                return projectOverride.get().isEnabled();
            }
        }

        return notificationPreferenceRepository
                .findByUserUserIdAndProjectIsNullAndEventTypeAndChannel(userId, normalizedEventType, channel)
                .map(NotificationPreference::isEnabled)
                .orElse(true);
    }

    private NotificationPreferenceResponseDTO toDto(NotificationPreference preference) {
        return NotificationPreferenceResponseDTO.builder()
                .id(preference.getId())
                .projectId(preference.getProject() != null ? preference.getProject().getId() : null)
                .eventType(preference.getEventType())
                .channel(preference.getChannel())
                .enabled(preference.isEnabled())
                .build();
    }

    private String normalizeEventType(String eventType) {
        if (eventType == null || eventType.isBlank()) {
            return NotificationEventType.PROJECT_ACTIVITY.name();
        }
        return eventType.trim().toUpperCase(Locale.ROOT);
    }

    private String matrixKey(String eventType, NotificationChannel channel) {
        return eventType + ':' + channel.name();
    }
}