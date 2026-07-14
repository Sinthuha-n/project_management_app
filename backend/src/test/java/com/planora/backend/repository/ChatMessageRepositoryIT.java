package com.planora.backend.repository;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import com.planora.backend.PostgresDataJpaIT;

import com.planora.backend.model.ChatMessage;
import com.planora.backend.model.ChatReaction;
import com.planora.backend.model.Project;
import com.planora.backend.model.ProjectType;
import com.planora.backend.model.Team;
import com.planora.backend.model.User;

class ChatMessageRepositoryIT extends PostgresDataJpaIT {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ChatReactionRepository chatReactionRepository;

    @Test
    void deleteById_cascadesToReactions() {
        User user = new User();
        user.setEmail("reactor@example.com");
        user.setUsername("reactor");
        user.setPassword("ValidPassword123!");
        user.setVerified(true);
        entityManager.persist(user);

        Team team = new Team();
        team.setName("Chat integration team");
        team.setOwner(user);
        entityManager.persist(team);

        Project project = new Project();
        project.setName("Chat integration project");
        project.setProjectKey("CHAT-IT");
        project.setOwner(user);
        project.setTeam(team);
        project.setType(ProjectType.KANBAN);
        entityManager.persist(project);

        ChatMessage message = new ChatMessage();
        message.setType(ChatMessage.MessageType.CHAT);
        message.setContent("Message with reactions");
        message.setSender("owner");
        message.setRecipient(null);
        message.setProjectId(project.getId());
        message.setChatType(ChatMessage.ChatType.GROUP);
        entityManager.persist(message);

        entityManager.persist(buildReaction(message, user, "👍"));
        entityManager.persist(buildReaction(message, user, "🔥"));
        entityManager.persist(buildReaction(message, user, "🎉"));
        entityManager.flush();
        entityManager.clear();

        assertEquals(3L, chatReactionRepository.count());

        chatMessageRepository.deleteById(message.getId());
        entityManager.flush();
        entityManager.clear();

        assertEquals(0L, chatReactionRepository.count());
        assertEquals(List.of(), chatReactionRepository.findByMessageIdOrderByCreatedAtAsc(message.getId()));
    }

    private ChatReaction buildReaction(ChatMessage message, User user, String emoji) {
        ChatReaction reaction = new ChatReaction();
        reaction.setMessage(message);
        reaction.setUser(user);
        reaction.setEmoji(emoji);
        message.getReactions().add(reaction);
        return reaction;
    }
}
