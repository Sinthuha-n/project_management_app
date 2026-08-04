package com.planora.backend.repository;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import com.planora.backend.PostgresIntegrationIT;
import com.planora.backend.model.User;

class DatabaseConstraintsIT extends PostgresIntegrationIT {

    @Autowired UserRepository userRepository;

    @Test
    void rejectsDuplicateEmailAndUsername() {
        String suffix = UUID.randomUUID().toString();
        User first = user("same-" + suffix, "same-" + suffix + "@example.test");
        userRepository.saveAndFlush(first);

        assertThatThrownBy(() -> userRepository.saveAndFlush(
                user("different-" + suffix, first.getEmail())))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void githubIdentityIsUniqueWhenPresentButAllowsMultipleNullValues() {
        String suffix = UUID.randomUUID().toString();
        User firstNull = user("null-a-" + suffix, "null-a-" + suffix + "@example.test");
        User secondNull = user("null-b-" + suffix, "null-b-" + suffix + "@example.test");
        userRepository.saveAndFlush(firstNull);
        userRepository.saveAndFlush(secondNull);

        User linked = user("linked-a-" + suffix, "linked-a-" + suffix + "@example.test");
        linked.setGithubUserId(424242L);
        userRepository.saveAndFlush(linked);

        User duplicate = user("linked-b-" + suffix, "linked-b-" + suffix + "@example.test");
        duplicate.setGithubUserId(424242L);
        assertThatThrownBy(() -> userRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    private User user(String username, String email) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword("ValidPassword123!");
        user.setVerified(true);
        return user;
    }
}
