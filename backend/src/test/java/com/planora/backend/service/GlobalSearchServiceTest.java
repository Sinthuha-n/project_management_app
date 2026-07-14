package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.chatMessage;
import static com.planora.backend.support.TestDataFactory.document;
import static com.planora.backend.support.TestDataFactory.member;
import static com.planora.backend.support.TestDataFactory.project;
import static com.planora.backend.support.TestDataFactory.task;
import static com.planora.backend.support.TestDataFactory.team;
import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import com.planora.backend.dto.GlobalSearchResponseDTO;
import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.Document;
import com.planora.backend.model.Project;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.DocumentRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

@ExtendWith(MockitoExtension.class)
class GlobalSearchServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock DocumentRepository documentRepository;
    @Mock UserRepository userRepository;
    @Mock TeamMemberRepository teamMemberRepository;
    @Mock ProjectRepository projectRepository;
    @Mock EntityManager entityManager;

    private GlobalSearchService service;
    private User owner;
    private Team team;
    private TeamMember membership;
    private Project project;

    @BeforeEach
    void setUp() {
        service = new GlobalSearchService(taskRepository, documentRepository, userRepository,
                teamMemberRepository, projectRepository);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        owner = user(1, "alice");
        owner.setFullName("Alice Example");
        team = team(2, owner);
        membership = member(3, team, owner, TeamRole.OWNER);
        project = project(10, team, owner);
    }

    @Test
    void shortQueriesAndUsersWithoutTeamsReturnEmptyGroups() {
        assertEmpty(service.search(null, null, 1L));
        assertEmpty(service.search(" a ", null, 1L));
        when(teamMemberRepository.findByUserUserId(1L)).thenReturn(List.of());
        assertEmpty(service.search("valid", null, 1L));
    }

    @Test
    void inaccessibleExplicitProjectReturnsEmptyGroups() {
        when(teamMemberRepository.findByUserUserId(1L)).thenReturn(List.of(membership));
        when(projectRepository.findByTeamIn(List.of(team))).thenReturn(List.of(project));

        assertEmpty(service.search("valid", 999L, 1L));
    }

    @Test
    void searchMapsAllResultTypesAndTeamMessageDeepLink() {
        Task task = task(20, project);
        task.setStatus(null);
        Document document = document(30, project, owner);
        ChatMessage message = chatMessage(40, 10, "alice");
        message.setContent("A useful deployment message");
        message.setTimestamp(LocalDateTime.of(2026, 1, 15, 10, 0));
        message.setRoomId(null);
        message.setRecipient(null);
        prepareScope();
        prepareQueries(List.of(task), List.of(document), List.of(membership), List.of(project),
                List.<Object[]>of(new Object[] {message, "Alice Example"}));

        GlobalSearchResponseDTO result = service.search("deployment", null, 1L);

        assertThat(result.getTasks()).singleElement().satisfies(found -> {
            assertThat(found.getStatus()).isEqualTo("UNKNOWN");
            assertThat(found.getUrl()).contains("projectId=10", "taskId=20");
        });
        assertThat(result.getDocuments()).singleElement().extracting("title").isEqualTo("document-30.txt");
        assertThat(result.getMembers()).singleElement().extracting("name").isEqualTo("Alice Example");
        assertThat(result.getProjects()).singleElement().extracting("title").isEqualTo("Project 10");
        assertThat(result.getMessages()).singleElement().satisfies(found -> {
            assertThat(found.getHighlightedContent()).isEqualTo("A useful deployment message");
            assertThat(found.getDeepLinkUrl()).endsWith("&view=team");
            assertThat(found.getTimestamp()).isEqualTo("2026-01-15T10:00:00");
        });
    }

    @Test
    void searchBuildsRoomAndDirectLinksAndBoundedExcerpts() {
        ChatMessage room = chatMessage(41, 10, "alice");
        room.setRoomId(50L);
        room.setContent("x".repeat(60) + "needle" + "y".repeat(60));
        ChatMessage direct = chatMessage(42, 10, "alice");
        direct.setRecipient("BOB");
        direct.setContent(null);
        prepareScope();
        prepareQueries(List.of(), List.of(), List.of(), List.of(),
                List.<Object[]>of(new Object[] {room, null}, new Object[] {direct, "Alice"}));

        GlobalSearchResponseDTO result = service.search("needle", 10L, 1L);

        assertThat(result.getMessages()).hasSize(2);
        assertThat(result.getMessages().get(0).getDeepLinkUrl()).contains("roomId=50");
        assertThat(result.getMessages().get(0).getHighlightedContent()).startsWith("...").endsWith("...");
        assertThat(result.getMessages().get(1).getDeepLinkUrl()).endsWith("&with=bob");
        assertThat(result.getMessages().get(1).getHighlightedContent()).isEmpty();
    }

    private void prepareScope() {
        when(teamMemberRepository.findByUserUserId(1L)).thenReturn(List.of(membership));
        when(projectRepository.findByTeamIn(List.of(team))).thenReturn(List.of(project, project));
    }

    private void prepareQueries(List<Task> tasks, List<Document> documents, List<TeamMember> members,
                                List<Project> projects, List<Object[]> messages) {
        TypedQuery<Task> taskQuery = query(tasks);
        TypedQuery<Document> documentQuery = query(documents);
        TypedQuery<TeamMember> memberQuery = query(members);
        TypedQuery<Project> projectQuery = query(projects);
        TypedQuery<Object[]> messageQuery = query(messages);
        when(entityManager.createQuery(anyString(), eq(Task.class))).thenReturn(taskQuery);
        when(entityManager.createQuery(anyString(), eq(Document.class))).thenReturn(documentQuery);
        when(entityManager.createQuery(anyString(), eq(TeamMember.class))).thenReturn(memberQuery);
        when(entityManager.createQuery(anyString(), eq(Project.class))).thenReturn(projectQuery);
        when(entityManager.createQuery(anyString(), eq(Object[].class))).thenReturn(messageQuery);
    }

    @SuppressWarnings("unchecked")
    private <T> TypedQuery<T> query(List<T> results) {
        TypedQuery<T> query = mock(TypedQuery.class);
        when(query.setParameter(anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(query);
        when(query.setMaxResults(org.mockito.ArgumentMatchers.anyInt())).thenReturn(query);
        when(query.getResultList()).thenReturn(results);
        return query;
    }

    private void assertEmpty(GlobalSearchResponseDTO result) {
        assertThat(result.getTasks()).isEmpty();
        assertThat(result.getDocuments()).isEmpty();
        assertThat(result.getMembers()).isEmpty();
        assertThat(result.getProjects()).isEmpty();
        assertThat(result.getMessages()).isEmpty();
    }
}
