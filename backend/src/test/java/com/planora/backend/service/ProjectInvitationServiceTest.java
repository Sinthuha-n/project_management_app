package com.planora.backend.service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;

import com.planora.backend.controller.ProjectMemberController;
import com.planora.backend.dto.ProjectInviteRequest;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.exception.InvitationExpiredException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamInvitation;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamInvitationRepository;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class ProjectInvitationServiceTest {

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamInvitationRepository teamInvitationRepository;

    @Mock
    private TeamMemberService teamMemberService;

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private SimpMessagingTemplate simpMessagingTemplate;

    @Mock
    private UserService userService;

    @InjectMocks
    private ProjectInvitationService projectInvitationService;

    @Test
    void inviteToProject_success() {
        ProjectInviteRequest request = new ProjectInviteRequest();
        request.setEmail("new@example.com");
        request.setRole(TeamRole.MEMBER);

        Project project = project(77L, 10L, "creator@example.com");
        User inviter = new User();
        inviter.setUserId(10L);
        inviter.setFullName("Inviter Name");

        when(projectRepository.findById(77L)).thenReturn(Optional.of(project));
        when(userRepository.findById(10L)).thenReturn(Optional.of(inviter));
        when(userRepository.findFirstByEmailIgnoreCase("new@example.com")).thenReturn(Optional.empty());
        when(teamInvitationRepository.findByTeamIdAndEmail(11L, "new@example.com")).thenReturn(List.of());

        projectInvitationService.inviteToProject(77L, request, 10L);

        verify(teamInvitationRepository).save(any(TeamInvitation.class));
        verify(emailService).sendProjectInvitationHtmlEmail(eq("new@example.com"), eq("Inviter Name"), eq("Apollo"), anyString());
    }

    @Test
    void inviteToProject_rejectsDuplicateInvite() {
        ProjectInviteRequest request = new ProjectInviteRequest();
        request.setEmail("already@example.com");
        request.setRole(TeamRole.MEMBER);

        Project project = project(77L, 10L, "creator@example.com");
        TeamInvitation existingInvite = new TeamInvitation();
        existingInvite.setStatus("PENDING");
        existingInvite.setExpiresAt(LocalDateTime.now().plusDays(1));

        when(projectRepository.findById(77L)).thenReturn(Optional.of(project));
        when(userRepository.findFirstByEmailIgnoreCase("already@example.com")).thenReturn(Optional.empty());
        when(teamInvitationRepository.findByTeamIdAndEmail(11L, "already@example.com")).thenReturn(List.of(existingInvite));

        assertThrows(ConflictException.class, () -> projectInvitationService.inviteToProject(77L, request, 10L));
    }

    @Test
    void inviteToProject_rejectsOwnerInviteForNonCreatorEmail() {
        ProjectInviteRequest request = new ProjectInviteRequest();
        request.setEmail("teammate@example.com");
        request.setRole(TeamRole.OWNER);

        Project project = project(77L, 10L, "creator@example.com");
        when(projectRepository.findById(77L)).thenReturn(Optional.of(project));

        assertThrows(AccessDeniedException.class, () -> projectInvitationService.inviteToProject(77L, request, 10L));

        verify(teamMemberService).enforceCreatorOnlyOwnerRole(11L, 10L);
        verify(teamMemberService).validateOwnerOrAdmin(11L, 10L);
        verify(teamInvitationRepository, never()).save(any(TeamInvitation.class));
    }

    @Test
    void acceptInvitation_success() {
        Team team = new Team();
        team.setId(11L);

        Project project = project(77L, 10L, "creator@example.com");
        project.setTeam(team);
        team.setProjects(Set.of(project));

        TeamInvitation invitation = new TeamInvitation();
        invitation.setToken("token-1");
        invitation.setEmail("invitee@example.com");
        invitation.setTeam(team);
        invitation.setRole("MEMBER");
        invitation.setExpiresAt(LocalDateTime.now().plusDays(1));

        User invitee = new User();
        invitee.setUserId(20L);
        invitee.setEmail("invitee@example.com");

        when(teamInvitationRepository.findByTokenOrHashedTokenWithLock(eq("token-1"), anyString())).thenReturn(Optional.of(invitation));
        when(userRepository.findById(20L)).thenReturn(Optional.of(invitee));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 20L)).thenReturn(Optional.empty());

        projectInvitationService.acceptInvitation("token-1", 20L);

        verify(teamMemberRepository).save(any(TeamMember.class));
        assertEquals("ACCEPTED", invitation.getStatus());
    }

    @Test
    void acceptInvitation_isIdempotentWhenUserAlreadyJoined() {
        Team team = new Team();
        team.setId(11L);

        Project project = project(77L, 10L, "creator@example.com");
        project.setTeam(team);
        team.setProjects(Set.of(project));

        TeamInvitation invitation = new TeamInvitation();
        invitation.setToken("token-1");
        invitation.setEmail("invitee@example.com");
        invitation.setTeam(team);
        invitation.setRole("ADMIN");
        invitation.setStatus("PENDING");
        invitation.setExpiresAt(LocalDateTime.now().plusDays(1));

        User invitee = new User();
        invitee.setUserId(20L);
        invitee.setEmail("invitee@example.com");

        TeamMember existingMember = new TeamMember();
        existingMember.setTeam(team);
        existingMember.setUser(invitee);
        existingMember.setRole(TeamRole.ADMIN);

        when(teamInvitationRepository.findByTokenOrHashedTokenWithLock(eq("token-1"), anyString())).thenReturn(Optional.of(invitation));
        when(userRepository.findById(20L)).thenReturn(Optional.of(invitee));
        when(teamMemberRepository.findByTeamIdAndUserUserId(11L, 20L)).thenReturn(Optional.of(existingMember));

        projectInvitationService.acceptInvitation("token-1", 20L);

        assertEquals("ACCEPTED", invitation.getStatus());
        verify(teamInvitationRepository).save(invitation);
        verify(teamMemberRepository, never()).save(any(TeamMember.class));
        verify(notificationService, never()).createNotification(any(User.class), anyString(), anyString());
        verify(simpMessagingTemplate, never()).convertAndSend(anyString(), any(ProjectMemberController.MemberEvent.class));
    }

    @Test
    void acceptInvitation_rejectsExpired() {
        TeamInvitation invitation = new TeamInvitation();
        invitation.setToken("expired-token");
        invitation.setExpiresAt(LocalDateTime.now().minusDays(1));
        invitation.setTeam(new Team());

        when(teamInvitationRepository.findByTokenOrHashedTokenWithLock(eq("expired-token"), anyString())).thenReturn(Optional.of(invitation));

        assertThrows(InvitationExpiredException.class, () -> projectInvitationService.acceptInvitation("expired-token", 20L));
        assertEquals("EXPIRED", invitation.getStatus());
        verify(teamInvitationRepository).save(invitation);
    }

    @Test
    void acceptInvitation_rejectsEmailMismatch() {
        TeamInvitation invitation = new TeamInvitation();
        invitation.setToken("token-1");
        invitation.setEmail("expected@example.com");
        invitation.setExpiresAt(LocalDateTime.now().plusDays(1));
        invitation.setTeam(new Team());

        User actualUser = new User();
        actualUser.setUserId(20L);
        actualUser.setEmail("actual@example.com");

        when(teamInvitationRepository.findByTokenOrHashedTokenWithLock(eq("token-1"), anyString())).thenReturn(Optional.of(invitation));
        when(userRepository.findById(20L)).thenReturn(Optional.of(actualUser));

        assertThrows(BadRequestException.class, () -> projectInvitationService.acceptInvitation("token-1", 20L));
    }

    private Project project(Long projectId, Long ownerId, String ownerEmail) {
        User owner = new User();
        owner.setUserId(ownerId);
        owner.setEmail(ownerEmail);

        Team team = new Team();
        team.setId(11L);

        Project project = new Project();
        project.setId(projectId);
        project.setName("Apollo");
        project.setOwner(owner);
        project.setTeam(team);
        return project;
    }
}
