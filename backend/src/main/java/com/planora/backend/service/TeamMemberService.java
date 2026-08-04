// Service layer for all team membership operations: adding, removing, role changes, and permission enforcement.
package com.planora.backend.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.repository.TeamMemberRepository;
import com.planora.backend.repository.TeamRepository;
import com.planora.backend.repository.UserRepository;
import com.planora.backend.repository.TaskRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TeamMemberService {
        // Change member role with owner/admin permission logic
        @Transactional
        public TeamMember changeMemberRoleWithPermissions(
                        Long teamId,
                        Long targetUserId,
                        String newRoleStr,
                        Long currentUserId,
                        Long projectId,
                        String projectName,
                        Long projectOwnerUserId) {
                enforceCreatorOnlyOwnerRole(teamId, projectOwnerUserId);

                TeamMember currentMember = validateMembership(teamId, currentUserId);
                TeamMember targetMember = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                TeamRole newRole = parseTeamRole(newRoleStr);

                if (targetUserId.equals(currentUserId)) {
                        throw new AccessDeniedException("Members cannot change their own role");
                }
                // The project creator is the sole OWNER; ownership cannot be transferred or edited here.
                if (targetUserId.equals(projectOwnerUserId) || targetMember.getRole() == TeamRole.OWNER) {
                        throw new AccessDeniedException("Project OWNER role cannot be changed");
                }
                if (newRole == TeamRole.OWNER) {
                        throw new AccessDeniedException("OWNER role cannot be assigned");
                }

                if (currentMember.getRole() == TeamRole.OWNER) {
                        // OWNER can assign any non-owner role to any other non-owner member.
                } else if (currentMember.getRole() == TeamRole.ADMIN) {
                        // ADMIN can only switch MEMBER and VIEWER users between those same two roles.
                        if (targetMember.getRole() != TeamRole.MEMBER && targetMember.getRole() != TeamRole.VIEWER) {
                                throw new AccessDeniedException("Admin can only change roles of MEMBER or VIEWER");
                        }
                        if (newRole != TeamRole.MEMBER && newRole != TeamRole.VIEWER) {
                                throw new AccessDeniedException("Admin can only assign MEMBER or VIEWER roles");
                        }
                } else {
                        throw new AccessDeniedException("Only OWNER or ADMIN can change roles");
                }

                TeamRole oldRole = targetMember.getRole();
                targetMember.setRole(newRole);
                TeamMember updated = teamMemberRepository.save(targetMember);

                if (oldRole != newRole) {
                        String resolvedProjectName = resolveProjectName(projectName);
                        String membersLink = buildMembersLink(projectId);
                        String actorName = resolveDisplayName(currentMember.getUser());
                        String targetName = resolveDisplayName(targetMember.getUser());

                        if (!targetUserId.equals(currentUserId)) {
                                String targetMessage = actorName + " changed your role to " + newRole.name()
                                                + " in project \"" + resolvedProjectName + "\"";
                                notificationService.createNotification(targetMember.getUser(), targetMessage,
                                                membersLink);
                        }

                        String adminMessage = actorName + " changed " + targetName + "'s role from "
                                        + oldRole.name() + " to " + newRole.name() + " in project \""
                                        + resolvedProjectName + "\"";

                        // Notify other OWNER/ADMIN members (excluding the actor and the affected user) about the change.
                        teamMemberRepository.findByTeamId(teamId).stream()
                                        .filter(member -> member.getRole() == TeamRole.OWNER
                                                        || member.getRole() == TeamRole.ADMIN)
                                        .filter(member -> !member.getUser().getUserId().equals(currentUserId))
                                        .filter(member -> !member.getUser().getUserId().equals(targetUserId))
                                        .forEach(member -> notificationService.createNotification(member.getUser(),
                                                        adminMessage, membersLink));
                }

                return updated;
        }

        private TeamRole parseTeamRole(String role) {
                if (role == null || role.isBlank()) {
                        throw new BadRequestException("Invalid role");
                }
                try {
                        return TeamRole.valueOf(role.trim().toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException ex) {
                        throw new BadRequestException("Invalid role");
                }
        }

        // =====================================================
        // HELPER : VALIDATE OWNER OR ADMIN (STRICT)
        // =====================================================
        public TeamMember validateOwnerOrAdmin(Long teamId, Long userId) {
                TeamMember member = validateMembership(teamId, userId);
                if (member.getRole() != TeamRole.OWNER && member.getRole() != TeamRole.ADMIN) {
                        throw new AccessDeniedException("Only TEAM OWNER or ADMIN can perform this action");
                }
                return member;
        }

        private final TeamMemberRepository teamMemberRepository;
        private final TeamRepository teamRepository;
        private final UserRepository userRepository;
        private final NotificationService notificationService;
        private final TaskRepository taskRepository;

        // =====================================================
        // ADD MEMBER TO TEAM (OWNER ONLY)
        // =====================================================
        public TeamMember addMember(
                        Long teamId,
                        Long targetUserId,
                        TeamRole role,
                        Long currentUserId) {
                // Only OWNER can add members
                validateOwner(teamId, currentUserId);

                Team team = teamRepository.findById(teamId)
                                .orElseThrow(() -> new RuntimeException("Team not found"));

                User targetUser = userRepository.findById(targetUserId)
                                .orElseThrow(() -> new RuntimeException("User not found"));

                // Prevent duplicate membership
                teamMemberRepository.findByTeamIdAndUserUserId(teamId, targetUserId)
                                .ifPresent(m -> {
                                        throw new RuntimeException("User already a team member");
                                });

                TeamMember member = new TeamMember();
                member.setTeam(team);
                member.setUser(targetUser);
                member.setRole(role);

                return teamMemberRepository.save(member);
        }

        // =====================================================
        // GET ALL MEMBERS OF A TEAM (ANY MEMBER)
        // =====================================================
        @Transactional(readOnly = true)
        public List<TeamMember> getTeamMembers(Long teamId) {
                return teamMemberRepository.findByTeamId(teamId);
        }

        // =====================================================
        // UPDATE MEMBER ROLE (OWNER ONLY)
        // =====================================================
        public TeamMember updateMemberRole(
                        Long teamId,
                        Long targetUserId,
                        TeamRole newRole,
                        Long currentUserId) {
                // Only OWNER can change roles
                validateOwner(teamId, currentUserId);

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                member.setRole(newRole);
                return teamMemberRepository.save(member);
        }

        // =====================================================
        // REMOVE MEMBER FROM TEAM (OWNER ONLY)
        // =====================================================
        @Transactional
        public void removeMember(
                        Long teamId,
                        Long targetUserId,
                        Long currentUserId) {
                // Only OWNER can remove members
                validateOwner(teamId, currentUserId);

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                taskRepository.nullifyAssigneeForMember(member.getId());
                taskRepository.nullifyReporterForMember(member.getId());
                taskRepository.removeFromTaskAssignees(member.getId());

                teamMemberRepository.delete(member);
        }

        // =====================================================
        // REMOVE MEMBER FROM TEAM WITH PERMISSIONS
        // =====================================================
        @Transactional
        public void removeMemberWithPermissions(
                        Long teamId,
                        Long targetUserId,
                        Long currentUserId,
                        Long projectId,
                        String projectName,
                        Long projectOwnerUserId) {
                enforceCreatorOnlyOwnerRole(teamId, projectOwnerUserId);

                TeamMember currentMember = validateMembership(teamId, currentUserId);
                TeamMember targetMember = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, targetUserId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));

                if (currentMember.getRole() == TeamRole.OWNER) {
                        // Owner can remove anyone except themselves
                        if (targetMember.getUser().getUserId().equals(currentUserId)) {
                                throw new IllegalArgumentException("Owner cannot remove themselves");
                        }
                } else if (currentMember.getRole() == TeamRole.ADMIN) {
                        // Admin can only remove MEMBER or VIEWER
                        if (targetMember.getRole() == TeamRole.OWNER || targetMember.getRole() == TeamRole.ADMIN) {
                                throw new AccessDeniedException("Admin can only remove MEMBER or VIEWER");
                        }
                } else {
                        // MEMBER and VIEWER cannot remove anyone
                        throw new AccessDeniedException("Only OWNER or ADMIN can remove members");
                }

                String resolvedProjectName = resolveProjectName(projectName);
                String membersLink = buildMembersLink(projectId);
                String actorName = resolveDisplayName(currentMember.getUser());
                String targetName = resolveDisplayName(targetMember.getUser());

                taskRepository.nullifyAssigneeForMember(targetMember.getId());
                taskRepository.nullifyReporterForMember(targetMember.getId());
                taskRepository.removeFromTaskAssignees(targetMember.getId());

                teamMemberRepository.delete(targetMember);

                if (!targetUserId.equals(currentUserId)) {
                        String targetMessage = actorName + " removed you from project \""
                                        + resolvedProjectName + "\"";
                        notificationService.createNotification(targetMember.getUser(), targetMessage, "/dashboard");
                }

                String adminMessage = actorName + " removed " + targetName + " from project \""
                                + resolvedProjectName + "\"";

                teamMemberRepository.findByTeamId(teamId).stream()
                                .filter(member -> member.getRole() == TeamRole.OWNER
                                                || member.getRole() == TeamRole.ADMIN)
                                .filter(member -> !member.getUser().getUserId().equals(currentUserId))
                                .forEach(member -> notificationService.createNotification(member.getUser(),
                                                adminMessage, membersLink));
        }

        // =====================================================
        // LEAVE PROJECT (any non-owner member)
        // =====================================================
        @Transactional
        public void leaveProject(Long teamId, Long userId, Long projectId, String projectName,
                        Long projectOwnerUserId) {
                if (userId.equals(projectOwnerUserId)) {
                        throw new IllegalArgumentException(
                                        "Project owner cannot leave. Transfer ownership or delete the project instead.");
                }

                TeamMember member = teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, userId)
                                .orElseThrow(() -> new RuntimeException("You are not a member of this project"));

                taskRepository.nullifyAssigneeForMember(member.getId());
                taskRepository.nullifyReporterForMember(member.getId());
                taskRepository.removeFromTaskAssignees(member.getId());

                teamMemberRepository.delete(member);

                String resolvedProjectName = resolveProjectName(projectName);
                String membersLink = buildMembersLink(projectId);
                String actorName = resolveDisplayName(member.getUser());
                String adminMessage = actorName + " left project \"" + resolvedProjectName + "\"";

                teamMemberRepository.findByTeamId(teamId).stream()
                                .filter(m -> m.getRole() == TeamRole.OWNER || m.getRole() == TeamRole.ADMIN)
                                .forEach(m -> notificationService.createNotification(m.getUser(), adminMessage,
                                                membersLink));
        }

        // Returns a safe project name fallback to avoid exposing null or blank values in notification messages.
        private String resolveProjectName(String projectName) {
                if (projectName == null || projectName.isBlank()) {
                        return "your project";
                }
                return projectName;
        }

        // Builds the deep-link used in notifications; falls back to "/members" when no project ID is available.
        private String buildMembersLink(Long projectId) {
                if (projectId == null) {
                        return "/members";
                }
                return "/members/" + projectId;
        }

        // Resolves the best available display name for a user, prioritising fullName → username → email.
        private String resolveDisplayName(User user) {
                if (user == null) {
                        return "A team member";
                }
                if (user.getFullName() != null && !user.getFullName().isBlank()) {
                        return user.getFullName();
                }
                if (user.getUsername() != null && !user.getUsername().isBlank()) {
                        return user.getUsername();
                }
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                        return user.getEmail();
                }
                return "A team member";
        }

        // =====================================================
        // HELPER : VALIDATE MEMBERSHIP (GENERIC)
        // =====================================================
        public TeamMember validateMembership(Long teamId, Long userId) {

                return teamMemberRepository
                                .findByTeamIdAndUserUserId(teamId, userId)
                                .orElseThrow(() -> new RuntimeException("User is not a member of this team"));
        }

        // =====================================================
        // HELPER : VALIDATE OWNER (STRICT)
        // =====================================================
        public TeamMember validateOwner(Long teamId, Long userId) {

                TeamMember member = validateMembership(teamId, userId);

                if (member.getRole() != TeamRole.OWNER) {
                        throw new AccessDeniedException("Only TEAM OWNER can perform this action");
                }

                return member;
        }

        // =====================================================
        // ENFORCE CREATOR-ONLY OWNER ROLE
        // Ensures exactly one OWNER exists (the project creator);
        // demotes any non-creator who was previously marked OWNER.
        // =====================================================
        @Transactional
        public void enforceCreatorOnlyOwnerRole(Long teamId, Long projectOwnerUserId) {
                if (teamId == null || projectOwnerUserId == null) {
                        return;
                }

                List<TeamMember> members = teamMemberRepository.findByTeamId(teamId);
                if (members.isEmpty()) {
                        return;
                }

                List<TeamMember> toUpdate = new ArrayList<>();
                TeamMember creatorMember = null;

                for (TeamMember member : members) {
                        if (member.getUser() == null || member.getUser().getUserId() == null) {
                                continue;
                        }

                        Long userId = member.getUser().getUserId();
                        if (projectOwnerUserId.equals(userId)) {
                                creatorMember = member;
                                continue;
                        }

                        if (member.getRole() == TeamRole.OWNER) {
                                member.setRole(TeamRole.ADMIN);
                                toUpdate.add(member);
                        }
                }

                if (creatorMember != null && creatorMember.getRole() != TeamRole.OWNER) {
                        creatorMember.setRole(TeamRole.OWNER);
                        toUpdate.add(creatorMember);
                }

                if (creatorMember == null) {
                        Team team = teamRepository.findById(teamId)
                                        .orElseThrow(() -> new RuntimeException("Team not found"));
                        User creator = userRepository.findById(projectOwnerUserId)
                                        .orElseThrow(() -> new RuntimeException("Project owner not found"));

                        TeamMember ownerMember = new TeamMember();
                        ownerMember.setTeam(team);
                        ownerMember.setUser(creator);
                        ownerMember.setRole(TeamRole.OWNER);
                        teamMemberRepository.save(ownerMember);
                }

                if (!toUpdate.isEmpty()) {
                        teamMemberRepository.saveAll(toUpdate);
                }
        }

}
