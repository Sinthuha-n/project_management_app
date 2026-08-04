package com.planora.backend.service;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import static org.mockito.ArgumentMatchers.anyList;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.model.Team;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class TeamMemberServiceTest {

    @Mock
    private TeamMemberRepository teamMemberRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private NotificationService notificationService;

    @InjectMocks
    private TeamMemberService teamMemberService;

    private TeamMember creatorMember;
    private TeamMember legacyOwnerMember;

    @BeforeEach
    void setUp() {
        creatorMember = member(1L, TeamRole.ADMIN);
        legacyOwnerMember = member(2L, TeamRole.OWNER);
    }

    @Test
    void enforceCreatorOnlyOwnerRole_demotesLegacyOwnerAndPromotesCreator() {
        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(creatorMember, legacyOwnerMember));

        teamMemberService.enforceCreatorOnlyOwnerRole(50L, 1L);

        assertEquals(TeamRole.OWNER, creatorMember.getRole());
        assertEquals(TeamRole.ADMIN, legacyOwnerMember.getRole());
        verify(teamMemberRepository).saveAll(anyList());
    }

    @Test
    void enforceCreatorOnlyOwnerRole_createsOwnerMembershipWhenCreatorIsMissing() {
        Team team = new Team();
        team.setId(50L);
        User creator = new User();
        creator.setUserId(1L);
        creator.setEmail("owner@example.com");

        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(legacyOwnerMember));
        when(teamRepository.findById(50L)).thenReturn(Optional.of(team));
        when(userRepository.findById(1L)).thenReturn(Optional.of(creator));

        teamMemberService.enforceCreatorOnlyOwnerRole(50L, 1L);

        assertEquals(TeamRole.ADMIN, legacyOwnerMember.getRole());
        verify(teamMemberRepository).save(org.mockito.ArgumentMatchers.argThat(member ->
                member.getTeam() == team
                        && member.getUser() == creator
                        && member.getRole() == TeamRole.OWNER));
        verify(teamMemberRepository).saveAll(anyList());
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsOwnerAssignmentForNonCreator() {
        TeamMember currentOwner = member(1L, TeamRole.OWNER);
        TeamMember targetMember = member(2L, TeamRole.MEMBER);

        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(currentOwner, targetMember));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 1L)).thenReturn(Optional.of(currentOwner));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(targetMember));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L,
                2L,
                "OWNER",
                1L,
                99L,
                "Apollo",
                1L));

        verify(teamMemberRepository, never()).save(targetMember);
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsDemotingProjectCreator() {
        TeamMember currentOwner = member(1L, TeamRole.OWNER);

        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(currentOwner));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 1L)).thenReturn(Optional.of(currentOwner));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L,
                1L,
                "ADMIN",
                1L,
                99L,
                "Apollo",
                1L));
    }

    @Test
    void changeMemberRoleWithPermissions_ownerCanAssignEveryNonOwnerRoleToEveryNonOwner() {
        TeamMember owner = member(1L, TeamRole.OWNER);
        long targetUserId = 10L;

        for (TeamRole currentRole : List.of(TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.VIEWER)) {
            for (TeamRole destinationRole : List.of(TeamRole.ADMIN, TeamRole.MEMBER, TeamRole.VIEWER)) {
                TeamMember target = member(targetUserId++, currentRole);
                Long userId = target.getUser().getUserId();
                when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(owner, target));
                when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 1L)).thenReturn(Optional.of(owner));
                when(teamMemberRepository.findByTeamIdAndUserUserId(50L, userId)).thenReturn(Optional.of(target));
                when(teamMemberRepository.save(target)).thenReturn(target);

                TeamMember result = teamMemberService.changeMemberRoleWithPermissions(
                        50L, userId, destinationRole.name(), 1L, 99L, "Apollo", 1L);

                assertEquals(destinationRole, result.getRole());
            }
        }
    }

    @Test
    void changeMemberRoleWithPermissions_adminCanSwitchMembersAndViewers() {
        TeamMember owner = member(1L, TeamRole.OWNER);
        TeamMember admin = member(2L, TeamRole.ADMIN);
        long targetUserId = 20L;

        for (TeamRole currentRole : List.of(TeamRole.MEMBER, TeamRole.VIEWER)) {
            for (TeamRole destinationRole : List.of(TeamRole.MEMBER, TeamRole.VIEWER)) {
                TeamMember target = member(targetUserId++, currentRole);
                Long userId = target.getUser().getUserId();
                when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(owner, admin, target));
                when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(admin));
                when(teamMemberRepository.findByTeamIdAndUserUserId(50L, userId)).thenReturn(Optional.of(target));
                when(teamMemberRepository.save(target)).thenReturn(target);

                TeamMember result = teamMemberService.changeMemberRoleWithPermissions(
                        50L, userId, destinationRole.name(), 2L, 99L, "Apollo", 1L);

                assertEquals(destinationRole, result.getRole());
            }
        }
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsAdminEditingAnotherAdmin() {
        TeamMember owner = member(1L, TeamRole.OWNER);
        TeamMember actor = member(2L, TeamRole.ADMIN);
        TeamMember target = member(3L, TeamRole.ADMIN);
        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(owner, actor, target));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(actor));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 3L)).thenReturn(Optional.of(target));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L, 3L, "VIEWER", 2L, 99L, "Apollo", 1L));
        verify(teamMemberRepository, never()).save(target);
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsAdminPromotionToAdmin() {
        TeamMember owner = member(1L, TeamRole.OWNER);
        TeamMember actor = member(2L, TeamRole.ADMIN);
        TeamMember target = member(3L, TeamRole.MEMBER);
        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(owner, actor, target));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(actor));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 3L)).thenReturn(Optional.of(target));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L, 3L, "ADMIN", 2L, 99L, "Apollo", 1L));
        verify(teamMemberRepository, never()).save(target);
    }

    @Test
    void changeMemberRoleWithPermissions_rejectsMemberActorSelfChangeAndInvalidRole() {
        TeamMember owner = member(1L, TeamRole.OWNER);
        TeamMember memberActor = member(2L, TeamRole.MEMBER);
        TeamMember target = member(3L, TeamRole.VIEWER);
        when(teamMemberRepository.findByTeamId(50L)).thenReturn(List.of(owner, memberActor, target));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 2L)).thenReturn(Optional.of(memberActor));
        when(teamMemberRepository.findByTeamIdAndUserUserId(50L, 3L)).thenReturn(Optional.of(target));

        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L, 3L, "MEMBER", 2L, 99L, "Apollo", 1L));
        assertThrows(AccessDeniedException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L, 2L, "VIEWER", 2L, 99L, "Apollo", 1L));
        assertThrows(BadRequestException.class, () -> teamMemberService.changeMemberRoleWithPermissions(
                50L, 3L, "SUPER_ADMIN", 2L, 99L, "Apollo", 1L));
        verify(teamMemberRepository, never()).save(target);
        verify(teamMemberRepository, never()).save(memberActor);
    }

    private TeamMember member(Long userId, TeamRole role) {
        User user = new User();
        user.setUserId(userId);
        user.setEmail("user" + userId + "@example.com");

        TeamMember member = new TeamMember();
        member.setUser(user);
        member.setRole(role);
        return member;
    }
}
