package com.planora.backend.service;

import static com.planora.backend.support.TestDataFactory.project;
import static com.planora.backend.support.TestDataFactory.team;
import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.planora.backend.dto.PortfolioDTO;
import com.planora.backend.dto.PortfolioResponseDTO;
import com.planora.backend.dto.ProjectMetricsDTO;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Portfolio;
import com.planora.backend.model.Project;
import com.planora.backend.model.Team;
import com.planora.backend.model.User;
import com.planora.backend.repository.PortfolioRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.UserRepository;

@ExtendWith(MockitoExtension.class)
class PortfolioServiceTest {

    @Mock PortfolioRepository portfolioRepository;
    @Mock ProjectRepository projectRepository;
    @Mock UserRepository userRepository;
    @Mock ProjectService projectService;
    @InjectMocks PortfolioService service;

    private User owner;
    private Team team;
    private Project firstProject;
    private Portfolio portfolio;

    @BeforeEach
    void setUp() {
        owner = user(1, "owner");
        team = team(2, owner);
        firstProject = project(10, team, owner);
        portfolio = new Portfolio();
        portfolio.setId(20L);
        portfolio.setName("Delivery");
        portfolio.setColor("#123456");
        portfolio.setOwner(owner);
        portfolio.setProjects(new ArrayList<>(List.of(firstProject)));
    }

    @Test
    void create_populatesProjectsDefaultColorAndAggregatedMetrics() {
        PortfolioDTO request = PortfolioDTO.builder().name("Delivery").projectIds(List.of(10L)).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findAllById(List.of(10L))).thenReturn(List.of(firstProject));
        when(portfolioRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(invocation -> {
            Portfolio saved = invocation.getArgument(0);
            saved.setId(20L);
            return saved;
        });
        when(projectService.getProjectMetrics(10L)).thenReturn(metrics(10L, 4L, 2L, 3L));

        PortfolioResponseDTO response = service.createPortfolio(request, 1L);

        assertThat(response.getColor()).isEqualTo("#155DFC");
        assertThat(response.getProjectCount()).isOne();
        assertThat(response.getTotalTasks()).isEqualTo(10);
        assertThat(response.getCompletedTasks()).isEqualTo(4);
        assertThat(response.getOverdueTasks()).isEqualTo(2);
        assertThat(response.getTotalMembers()).isEqualTo(3);
        assertThat(response.getHealthScore()).isEqualTo(52);
    }

    @Test
    void create_handlesNoProjectsAndMissingUser() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
        when(portfolioRepository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(i -> i.getArgument(0));
        PortfolioResponseDTO response = service.createPortfolio(
                PortfolioDTO.builder().name("Empty").color("#abcdef").projectIds(List.of()).build(), 1L);
        assertThat(response.getHealthScore()).isEqualTo(100);
        assertThat(response.getColor()).isEqualTo("#abcdef");
        verify(projectRepository, never()).findAllById(org.mockito.ArgumentMatchers.any());

        when(userRepository.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.createPortfolio(PortfolioDTO.builder().name("x").build(), 99L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void listAndDetail_mapProjectsAndTolerateMetricFailuresAndNulls() {
        Project second = project(11, team, owner);
        portfolio.setProjects(new ArrayList<>(List.of(firstProject, second)));
        when(portfolioRepository.findByOwner_UserId(1L)).thenReturn(List.of(portfolio));
        when(portfolioRepository.findByIdWithProjects(20L)).thenReturn(Optional.of(portfolio));
        when(projectService.getProjectMetrics(10L)).thenReturn(metrics(null, null, null, null));
        when(projectService.getProjectMetrics(11L)).thenThrow(new IllegalStateException("metrics unavailable"));

        assertThat(service.getPortfoliosForUser(1L)).singleElement()
                .satisfies(result -> assertThat(result.getHealthScore()).isEqualTo(100));
        PortfolioResponseDTO detail = service.getPortfolioById(20L, 1L);
        assertThat(detail.getProjects()).extracting("id").containsExactly(10L, 11L);
        assertThat(detail.getOwnerName()).isEqualTo("owner");

        when(portfolioRepository.findByIdWithProjects(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.getPortfolioById(404L, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void update_appliesOnlyProvidedValuesAndProjects() {
        PortfolioDTO request = PortfolioDTO.builder()
                .name("Renamed").description("Updated").emoji("📁").projectIds(List.of()).build();
        when(portfolioRepository.findByIdWithProjects(20L)).thenReturn(Optional.of(portfolio));
        when(projectRepository.findAllById(List.of())).thenReturn(List.of());
        when(portfolioRepository.save(portfolio)).thenReturn(portfolio);

        PortfolioResponseDTO result = service.updatePortfolio(20L, request);

        assertThat(result.getName()).isEqualTo("Renamed");
        assertThat(result.getDescription()).isEqualTo("Updated");
        assertThat(result.getEmoji()).isEqualTo("📁");
        assertThat(result.getColor()).isEqualTo("#123456");
        assertThat(result.getProjectCount()).isZero();

        when(portfolioRepository.findByIdWithProjects(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.updatePortfolio(404L, request))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void addProject_isIdempotentAndValidatesBothResources() {
        when(portfolioRepository.findByIdWithProjects(20L)).thenReturn(Optional.of(portfolio));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(firstProject));
        service.addProject(20L, 10L, 1L);
        verify(portfolioRepository, never()).save(portfolio);

        Project added = project(11, team, owner);
        when(projectRepository.findById(11L)).thenReturn(Optional.of(added));
        service.addProject(20L, 11L, 1L);
        assertThat(portfolio.getProjects()).contains(added);
        verify(portfolioRepository).save(portfolio);

        when(projectRepository.findById(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.addProject(20L, 404L, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
        when(portfolioRepository.findByIdWithProjects(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.addProject(404L, 10L, 1L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void removeAndDelete_validatePortfolioExistence() {
        when(portfolioRepository.findByIdWithProjects(20L)).thenReturn(Optional.of(portfolio));
        service.removeProject(20L, 10L);
        assertThat(portfolio.getProjects()).isEmpty();
        verify(portfolioRepository).save(portfolio);

        when(portfolioRepository.existsById(20L)).thenReturn(true);
        service.deletePortfolio(20L);
        verify(portfolioRepository).deleteById(20L);

        when(portfolioRepository.existsById(404L)).thenReturn(false);
        assertThatThrownBy(() -> service.deletePortfolio(404L)).isInstanceOf(ResourceNotFoundException.class);
        when(portfolioRepository.findByIdWithProjects(404L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.removeProject(404L, 10L)).isInstanceOf(ResourceNotFoundException.class);
    }

    private ProjectMetricsDTO metrics(Long total, Long completed, Long overdue, Long members) {
        return ProjectMetricsDTO.builder().totalTasks(total).completedTasks(completed)
                .overdueTasks(overdue).memberCount(members).build();
    }
}
