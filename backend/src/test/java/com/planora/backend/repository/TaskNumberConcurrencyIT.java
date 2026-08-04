package com.planora.backend.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.planora.backend.PostgresIntegrationIT;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Task;
import com.planora.backend.model.Team;
import com.planora.backend.model.User;

class TaskNumberConcurrencyIT extends PostgresIntegrationIT {

    @Autowired private UserRepository userRepository;
    @Autowired private TeamRepository teamRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    @Timeout(15)
    void projectLock_serializesConcurrentTaskNumberAllocation() throws Exception {
        Project project = seedProject();
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<Long> first = executor.submit(() -> allocateTask(project.getId(), "first", ready, start));
            Future<Long> second = executor.submit(() -> allocateTask(project.getId(), "second", ready, start));

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            assertThat(List.of(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(1L, 2L);
            assertThat(taskRepository.findMaxProjectTaskNumberByProjectId(project.getId())).isEqualTo(2L);
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(Duration.ofSeconds(2).toMillis(), TimeUnit.MILLISECONDS)).isTrue();
        }
    }

    private long allocateTask(
            Long projectId,
            String title,
            CountDownLatch ready,
            CountDownLatch start) throws Exception {
        ready.countDown();
        assertThat(start.await(5, TimeUnit.SECONDS)).isTrue();

        return new TransactionTemplate(transactionManager).execute(status -> {
            Project lockedProject = projectRepository.findByIdWithLock(projectId).orElseThrow();
            long next = taskRepository.findMaxProjectTaskNumberByProjectId(projectId) + 1L;
            Task task = new Task();
            task.setTitle(title);
            task.setProject(lockedProject);
            task.setProjectTaskNumber(next);
            taskRepository.saveAndFlush(task);
            return next;
        });
    }

    private Project seedProject() {
        String suffix = UUID.randomUUID().toString();
        User owner = new User();
        owner.setUsername("concurrency-" + suffix);
        owner.setEmail("concurrency-" + suffix + "@example.test");
        owner.setPassword("Unused@1234");
        owner.setVerified(true);
        owner = userRepository.saveAndFlush(owner);

        Team team = new Team();
        team.setName("Concurrency " + suffix);
        team.setOwner(owner);
        team = teamRepository.saveAndFlush(team);

        Project project = new Project();
        project.setName("Concurrency project");
        project.setProjectKey("CON-" + suffix.substring(0, 8));
        project.setOwner(owner);
        project.setTeam(team);
        project.setType(ProjectType.AGILE);
        return projectRepository.saveAndFlush(project);
    }
}
