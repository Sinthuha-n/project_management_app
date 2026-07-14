package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.project;
import static com.planora.backend.support.TestDataFactory.task;
import static com.planora.backend.support.TestDataFactory.team;
import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Task;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;

@ExtendWith(MockitoExtension.class)
class SearchServiceTest {

    @Mock ProjectRepository projectRepository;
    @Mock TaskRepository taskRepository;
    @InjectMocks SearchService service;

    @Test
    void blankQueriesReturnNoResultsWithoutRepositoryCalls() {
        assertThat(service.globalSearch(null, 1L)).isEmpty();
        assertThat(service.globalSearch("   ", 1L)).isEmpty();
        verify(projectRepository, never()).searchProjectsByName(
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    void searchMapsProjectsBoardsAndTasksWithFallbackKeysAndRoutes() {
        var owner = user(1, "owner");
        var team = team(2, owner);
        Project agile = project(10, team, owner);
        agile.setType(ProjectType.AGILE);
        Project kanban = project(11, team, owner);
        kanban.setType(ProjectType.KANBAN);
        kanban.setProjectKey(null);
        Task task = task(20, agile);
        task.setStatus("IN_PROGRESS");
        when(projectRepository.searchProjectsByName(eq("plan"), eq(1L),
                org.mockito.ArgumentMatchers.any(Pageable.class))).thenReturn(List.of(agile, kanban));
        when(taskRepository.searchTasksByTitle(eq("plan"), eq(1L),
                org.mockito.ArgumentMatchers.any(Pageable.class))).thenReturn(List.of(task));

        var results = service.globalSearch("plan", 1L);

        assertThat(results).hasSize(5);
        assertThat(results).extracting("type").containsExactly("PROJECT", "PROJECT", "BOARD", "BOARD", "TASK");
        assertThat(results.get(1).getSubtitle()).isEqualTo("Project • PRJ");
        assertThat(results.get(2).getLink()).isEqualTo("/sprint-board?projectId=10");
        assertThat(results.get(3).getLink()).isEqualTo("/kanban?projectId=11");
        assertThat(results.get(4).getSubtitle()).isEqualTo("Project 10 • IN_PROGRESS");
    }
}
