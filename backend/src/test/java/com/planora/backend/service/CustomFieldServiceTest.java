package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.member;
import static com.planora.backend.support.TestDataFactory.project;
import static com.planora.backend.support.TestDataFactory.task;
import static com.planora.backend.support.TestDataFactory.team;
import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.dto.CustomFieldRequestDTO;
import com.planora.backend.dto.TaskFieldValuePatchDTO;
import com.planora.backend.model.CustomField;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.TaskFieldValue;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.CustomFieldRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskFieldValueRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;

import jakarta.persistence.EntityNotFoundException;

@ExtendWith(MockitoExtension.class)
class CustomFieldServiceTest {

    @Mock CustomFieldRepository customFieldRepository;
    @Mock TaskFieldValueRepository taskFieldValueRepository;
    @Mock ProjectRepository projectRepository;
    @Mock TaskRepository taskRepository;
    @Mock TeamMemberRepository teamMemberRepository;
    @InjectMocks CustomFieldService service;

    private User owner;
    private Team team;
    private TeamMember membership;
    private Project project;
    private Task task;
    private CustomField field;

    @BeforeEach
    void setUp() {
        owner = user(1, "owner");
        team = team(2, owner);
        membership = member(3, team, owner, TeamRole.OWNER);
        project = project(10, team, owner);
        task = task(20, project);
        field = field(30, project, "Environment", "SELECT", List.of("Dev", "Prod"), 1);
    }

    @Test
    void projectFields_requireProjectAndMembershipAndPreserveOrdering() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.findByProjectIdOrderByPositionAscIdAsc(10L)).thenReturn(List.of(field));

        assertThat(service.getProjectCustomFields(10L, 1L)).singleElement().satisfies(result -> {
            assertThat(result.getId()).isEqualTo(30L);
            assertThat(result.getName()).isEqualTo("Environment");
            assertThat(result.getOptions()).containsExactly("Dev", "Prod");
        });

        when(projectRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getProjectCustomFields(404L, 1L))
                .isInstanceOf(EntityNotFoundException.class);
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getProjectCustomFields(10L, 99L))
                .isInstanceOf(RuntimeException.class).hasMessageContaining("not a member");
    }

    @Test
    void create_mapsRequestAndDefaultsPosition() {
        CustomFieldRequestDTO request = new CustomFieldRequestDTO("Estimate", "NUMBER", null, null);
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            CustomField saved = invocation.getArgument(0);
            saved.setId(31L);
            return saved;
        });

        var response = service.createCustomField(10L, request, 1L);

        assertThat(response.getId()).isEqualTo(31L);
        assertThat(response.getName()).isEqualTo("Estimate");
        assertThat(response.getPosition()).isZero();
    }

    @Test
    void delete_rejectsMissingAndCrossProjectFields() {
        when(projectRepository.findById(10L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.findById(30L)).thenReturn(Optional.of(field));

        service.deleteCustomField(10L, 30L, 1L);
        verify(customFieldRepository).delete(field);

        when(customFieldRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.deleteCustomField(10L, 404L, 1L))
                .isInstanceOf(EntityNotFoundException.class);
        Project other = project(11, team, owner);
        CustomField foreign = field(32, other, "Foreign", "TEXT", null, 0);
        when(customFieldRepository.findById(32L)).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> service.deleteCustomField(10L, 32L, 1L))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void taskFields_mergePersistedValuesAndUseFirstDuplicate() {
        CustomField unset = field(31, project, "Unset", "TEXT", null, 2);
        TaskFieldValue first = value(1, task, field, "Prod");
        TaskFieldValue duplicate = value(2, task, field, "Dev");
        when(taskRepository.findById(20L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.findByProjectIdOrderByPositionAscIdAsc(10L)).thenReturn(List.of(field, unset));
        when(taskFieldValueRepository.findByTaskId(20L)).thenReturn(List.of(first, duplicate));

        assertThat(service.getTaskCustomFields(20L, 1L))
                .extracting("value").containsExactly("Prod", null);

        when(taskRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getTaskCustomFields(404L, 1L))
                .isInstanceOf(EntityNotFoundException.class);
    }

    @Test
    void patch_updatesExistingValueOrCreatesANewOne() {
        TaskFieldValue existing = value(1, task, field, "Dev");
        when(taskRepository.findById(20L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.findById(30L)).thenReturn(Optional.of(field));
        when(taskFieldValueRepository.findByTaskIdAndCustomFieldId(20L, 30L))
                .thenReturn(Optional.of(existing), Optional.empty());

        service.patchTaskCustomField(20L, new TaskFieldValuePatchDTO(30L, "Prod"), 1L);
        assertThat(existing.getValue()).isEqualTo("Prod");
        verify(taskFieldValueRepository).save(existing);

        service.patchTaskCustomField(20L, new TaskFieldValuePatchDTO(30L, "Stage"), 1L);
        verify(taskFieldValueRepository).save(org.mockito.ArgumentMatchers.argThat(created ->
                created.getId() == null && created.getTask() == task && created.getCustomField() == field
                        && "Stage".equals(created.getValue())));
    }

    @Test
    void patch_rejectsMissingAndCrossProjectFields() {
        when(taskRepository.findById(20L)).thenReturn(Optional.of(task));
        when(teamMemberRepository.findByTeamIdAndUserUserId(2L, 1L)).thenReturn(Optional.of(membership));
        when(customFieldRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.patchTaskCustomField(
                20L, new TaskFieldValuePatchDTO(404L, "x"), 1L)).isInstanceOf(EntityNotFoundException.class);

        Project other = project(11, team, owner);
        CustomField foreign = field(32, other, "Foreign", "TEXT", null, 0);
        when(customFieldRepository.findById(32L)).thenReturn(Optional.of(foreign));
        assertThatThrownBy(() -> service.patchTaskCustomField(
                20L, new TaskFieldValuePatchDTO(32L, "x"), 1L)).isInstanceOf(IllegalArgumentException.class);
    }

    private CustomField field(long id, Project ownerProject, String name, String type,
                              List<String> options, int position) {
        CustomField result = new CustomField();
        result.setId(id);
        result.setProject(ownerProject);
        result.setName(name);
        result.setFieldType(type);
        result.setOptions(options);
        result.setPosition(position);
        return result;
    }

    private TaskFieldValue value(long id, Task ownerTask, CustomField customField, String value) {
        TaskFieldValue result = new TaskFieldValue();
        result.setId(id);
        result.setTask(ownerTask);
        result.setCustomField(customField);
        result.setValue(value);
        return result;
    }
}
