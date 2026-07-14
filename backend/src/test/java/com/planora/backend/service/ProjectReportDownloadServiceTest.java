package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.member;
import static com.planora.backend.support.TestDataFactory.project;
import static com.planora.backend.support.TestDataFactory.team;
import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;

import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.TeamMember;
import com.planora.backend.model.TeamRole;
import com.planora.backend.model.User;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TeamMemberRepository;

@ExtendWith(MockitoExtension.class)
class ProjectReportDownloadServiceTest {

    @Mock private ProjectRepository projectRepository;
    @Mock private TeamMemberRepository teamMemberRepository;
    @Mock private ProjectReportDataService projectReportDataService;
    @Mock private ReportPdfBuilder pdfReportBuilder;
    @Mock private ReportExcelBuilder excelReportBuilder;

    private ReportDownloadService service;
    private Project project;
    private ProjectReportDataService.ReportSnapshot snapshot;

    @BeforeEach
    void setUp() {
        service = new ReportDownloadService(projectRepository, teamMemberRepository,
                projectReportDataService, pdfReportBuilder, excelReportBuilder);
        User owner = user(1L, "owner");
        Team team = team(10L, owner);
        project = project(20L, team, owner);
        project.setName("Quarterly / Delivery: 2026");
        snapshot = new ProjectReportDataService.ReportSnapshot(
                project, List.of(), List.of(), List.of(), List.of(), LocalDate.of(2026, 7, 14));
    }

    @Test
    void generatesPdfWithSafeFilenameAndContentType() {
        authorizeUser(7L);
        byte[] content = {1, 2, 3};
        when(pdfReportBuilder.build(snapshot)).thenReturn(content);

        ReportDownloadService.GeneratedReportFile result = service.generate(20L, 7L, " pdf ");

        assertThat(result.content()).isSameAs(content);
        assertThat(result.fileName()).isEqualTo("Quarterly___Delivery__2026_Report.pdf");
        assertThat(result.contentType()).isEqualTo(MediaType.APPLICATION_PDF);
        verify(excelReportBuilder, never()).build(snapshot);
    }

    @Test
    void generatesExcelCaseInsensitively() {
        authorizeUser(7L);
        byte[] content = {4, 5};
        when(excelReportBuilder.build(snapshot)).thenReturn(content);

        ReportDownloadService.GeneratedReportFile result = service.generate(20L, 7L, "eXcEl");

        assertThat(result.content()).isSameAs(content);
        assertThat(result.fileName()).endsWith("_Report.xlsx");
        assertThat(result.contentType().toString())
                .isEqualTo("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        verify(pdfReportBuilder, never()).build(snapshot);
    }

    @Test
    void rejectsNullBlankAndUnknownFormatsAfterAuthorization() {
        authorizeUser(7L);

        for (String format : new String[] {null, "", " ", "CSV"}) {
            assertThatThrownBy(() -> service.generate(20L, 7L, format))
                    .isInstanceOf(ResponseStatusException.class)
                    .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                            .isEqualTo(HttpStatus.BAD_REQUEST));
        }
        verify(pdfReportBuilder, never()).build(snapshot);
        verify(excelReportBuilder, never()).build(snapshot);
    }

    @Test
    void rejectsUnknownProjectBeforeMembershipOrSnapshotLookup() {
        when(projectRepository.findById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate(404L, 7L, "PDF"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Project not found");
        verify(teamMemberRepository, never()).findByTeamIdAndUserUserId(10L, 7L);
        verify(projectReportDataService, never()).loadSnapshot(404L);
    }

    @Test
    void rejectsNonMemberBeforeLoadingSensitiveReportData() {
        when(projectRepository.findById(20L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, 7L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate(20L, 7L, "PDF"))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("User is not a member of this project");
        verify(projectReportDataService, never()).loadSnapshot(20L);
    }

    private void authorizeUser(long userId) {
        User reportUser = user(userId, "reporter");
        TeamMember membership = member(30L, project.getTeam(), reportUser, TeamRole.MEMBER);
        when(projectRepository.findById(20L)).thenReturn(Optional.of(project));
        when(teamMemberRepository.findByTeamIdAndUserUserId(10L, userId))
                .thenReturn(Optional.of(membership));
        when(projectReportDataService.loadSnapshot(20L)).thenReturn(snapshot);
    }
}
