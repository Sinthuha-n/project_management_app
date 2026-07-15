package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;

import com.planora.backend.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import com.planora.backend.PostgresDataJpaIT;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class DocumentRepositoryIT extends PostgresDataJpaIT {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private DocumentRepository documentRepository;

    private Project project;
    private User uploader;

    @BeforeEach
    void setUp() {
        
        User owner = new User();
        owner.setEmail("owner@test.com");
        owner.setUsername("owner");
        owner.setPassword("ValidPassword123!");
        owner.setVerified(true);
        entityManager.persist(owner);

        Team team = new Team();
        team.setName("Dev Team");
        team.setOwner(owner);
        entityManager.persist(team);

        project = new Project(); project.setName("Docs Project"); project.setTeam(team); project.setOwner(owner); project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        uploader = new User();
        uploader.setEmail("alice@example.com");
        uploader.setUsername("alice");
        uploader.setPassword("ValidPassword123!");
        uploader.setVerified(true);
        entityManager.persist(uploader);

        entityManager.flush();
    }

    private Document buildDocument(String fileName, DocumentStatus status, LocalDateTime deletedAt) {
        Document doc = new Document();
        doc.setProject(project);
        doc.setUploadedBy(uploader);
        doc.setName(fileName);
        doc.setLatestObjectKey("project-10/" + fileName);
        doc.setContentType("application/pdf");
        doc.setFileSize(100L);
        doc.setStatus(status);
        doc.setDeletedAt(deletedAt);
        return doc;
    }

    @Test
    void findExpiredSoftDeleted_returnsOnlyExpiredSoftDeletedDocsWithDeletedAt() {
        Document old = buildDocument("old.pdf", DocumentStatus.SOFT_DELETED, LocalDateTime.now().minusDays(31));
        Document recent = buildDocument("recent.pdf", DocumentStatus.SOFT_DELETED, LocalDateTime.now().minusDays(5));
        Document activeWithStaleDeletedAt = buildDocument("active.pdf", DocumentStatus.ACTIVE, LocalDateTime.now().minusDays(31));
        Document softDeletedWithoutDeletedAt = buildDocument("missing-deleted-at.pdf", DocumentStatus.SOFT_DELETED, null);
        entityManager.persist(old);
        entityManager.persist(recent);
        entityManager.persist(activeWithStaleDeletedAt);
        entityManager.persist(softDeletedWithoutDeletedAt);
        entityManager.flush();

        List<Document> result = documentRepository.findExpiredSoftDeleted(
                DocumentStatus.SOFT_DELETED, LocalDateTime.now().minusDays(30));

        assertEquals(1, result.size());
        assertEquals("old.pdf", result.get(0).getName());
    }

    @Test
    void findByIdAndProjectId_returnsDocument_whenExists() {
        Document doc = buildDocument("spec.pdf", DocumentStatus.ACTIVE, null);
        entityManager.persist(doc);
        entityManager.flush();

        Optional<Document> result = documentRepository.findByIdAndProjectId(doc.getId(), project.getId());

        assertTrue(result.isPresent());
        assertEquals("spec.pdf", result.get().getName());
    }

    @Test
    void findByIdAndProjectId_returnsEmpty_whenProjectIdMismatch() {
        Document doc = buildDocument("spec.pdf", DocumentStatus.ACTIVE, null);
        entityManager.persist(doc);
        entityManager.flush();

        Optional<Document> result = documentRepository.findByIdAndProjectId(doc.getId(), 999L);

        assertTrue(result.isEmpty());
    }

    @Test
    void countByFolderIdAndStatus_returnsCorrectCount() {
        DocumentFolder folder = new DocumentFolder();
        folder.setProject(project);
        folder.setName("Folder1");
        folder.setCreatedBy(uploader);
        entityManager.persist(folder);

        Document doc = buildDocument("in-folder.pdf", DocumentStatus.ACTIVE, null);
        doc.setFolder(folder);
        entityManager.persist(doc);
        entityManager.flush();

        long count = documentRepository.countByFolderIdAndStatus(folder.getId(), DocumentStatus.ACTIVE);

        assertEquals(1, count);
    }
}
