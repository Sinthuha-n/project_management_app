package com.planora.backend.support;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.Document;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.Notification;
import com.planora.backend.model.Priority;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Sprint;
import com.planora.backend.model.SprintStatus;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;

/** Deterministic domain fixtures shared by unit and integration tests. */
public final class TestDataFactory {

    public static final Instant NOW = Instant.parse("2026-01-15T10:00:00Z");
    public static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private TestDataFactory() {
    }

    public static User user(long id, String username) {
        User user = new User();
        user.setUserId(id);
        user.setUsername(username);
        user.setEmail(username + "@example.test");
        user.setPassword("EncodedPassword123!");
        user.setVerified(true);
        return user;
    }

    public static Team team(long id, User owner) {
        Team team = new Team();
        team.setId(id);
        team.setName("Team " + id);
        team.setOwner(owner);
        return team;
    }

    public static TeamMember member(long id, Team team, User user, TeamRole role) {
        TeamMember member = new TeamMember();
        member.setId(id);
        member.setTeam(team);
        member.setUser(user);
        member.setRole(role);
        return member;
    }

    public static Project project(long id, Team team, User owner) {
        Project project = new Project();
        project.setId(id);
        project.setName("Project " + id);
        project.setProjectKey("PRJ-" + id);
        project.setType(ProjectType.AGILE);
        project.setTeam(team);
        project.setOwner(owner);
        return project;
    }

    public static Sprint sprint(long id, Project project) {
        Sprint sprint = new Sprint();
        sprint.setId(id);
        sprint.setName("Sprint " + id);
        sprint.setProject(project);
        sprint.setStatus(SprintStatus.NOT_STARTED);
        sprint.setStartDate(LocalDate.of(2026, 1, 15));
        sprint.setEndDate(LocalDate.of(2026, 1, 29));
        return sprint;
    }

    public static Task task(long id, Project project) {
        Task task = new Task();
        task.setId(id);
        task.setTitle("Task " + id);
        task.setProject(project);
        task.setStatus("TODO");
        task.setPriority(Priority.MEDIUM);
        return task;
    }

    public static Kanban kanban(long id, Project project) {
        Kanban kanban = new Kanban();
        kanban.setId(id);
        kanban.setName("Board " + id);
        kanban.setProjectId(project.getId());
        return kanban;
    }

    public static ChatMessage chatMessage(long id, long projectId, String sender) {
        ChatMessage message = new ChatMessage();
        message.setId(id);
        message.setProjectId(projectId);
        message.setSender(sender);
        message.setContent("Message " + id);
        message.setChatType(ChatMessage.ChatType.GROUP);
        return message;
    }

    public static Document document(long id, Project project, User uploader) {
        Document document = new Document();
        document.setId(id);
        document.setName("document-" + id + ".txt");
        document.setContentType("text/plain");
        document.setFileSize(128L);
        document.setProject(project);
        document.setUploadedBy(uploader);
        document.setLatestObjectKey("projects/" + project.getId() + "/documents/" + id);
        return document;
    }

    public static Notification notification(long id, User recipient) {
        Notification notification = new Notification();
        notification.setId(id);
        notification.setRecipient(recipient);
        notification.setMessage("Notification " + id);
        notification.setLink("/notifications/" + id);
        return notification;
    }
}
