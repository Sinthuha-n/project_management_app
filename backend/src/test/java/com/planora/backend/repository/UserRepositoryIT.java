package com.planora.backend.repository;

import com.planora.backend.model.ProjectType;

import com.planora.backend.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import com.planora.backend.PostgresDataJpaIT;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class UserRepositoryIT extends PostgresDataJpaIT {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = new User();
        alice.setEmail("alice@example.com");
        alice.setUsername("alice");
        alice.setPassword("HashedPass1!");
        alice.setVerified(true);
        entityManager.persist(alice);

        bob = new User();
        bob.setEmail("Bob@Example.COM");  // Mixed case to test case-insensitive
        bob.setUsername("BobUser");
        bob.setPassword("HashedPass2!");
        bob.setVerified(true);
        entityManager.persist(bob);

        entityManager.flush();
    }

    // ── findByEmail ──────────────────────────────────────────────────────────

    @Test
    void findByEmail_returnsUser_whenExactMatch() {
        User result = userRepository.findByEmail("alice@example.com");
        assertNotNull(result);
        assertEquals("alice", result.getUsername());
    }

    @Test
    void findByEmail_returnsNull_whenNotFound() {
        User result = userRepository.findByEmail("ghost@example.com");
        assertNull(result);
    }

    // ── findFirstByEmailIgnoreCase ────────────────────────────────────────────────

    @Test
    void findFirstByEmailIgnoreCase_returnsUser_withLowerCaseInput() {
        Optional<User> result = userRepository.findFirstByEmailIgnoreCase("bob@example.com");
        assertTrue(result.isPresent());
        assertEquals("BobUser", result.get().getUsername());
    }

    @Test
    void findFirstByEmailIgnoreCase_returnsUser_withUpperCaseInput() {
        Optional<User> result = userRepository.findFirstByEmailIgnoreCase("ALICE@EXAMPLE.COM");
        assertTrue(result.isPresent());
        assertEquals("alice", result.get().getUsername());
    }

    @Test
    void findFirstByEmailIgnoreCase_returnsEmpty_whenNotFound() {
        Optional<User> result = userRepository.findFirstByEmailIgnoreCase("nobody@example.com");
        assertTrue(result.isEmpty());
    }

    // ── findByUsername ───────────────────────────────────────────────────────

    @Test
    void findByUsername_returnsUser_forExactUsername() {
        Optional<User> result = userRepository.findFirstByUsername("alice");
        assertTrue(result.isPresent());
        assertEquals("alice@example.com", result.get().getEmail());
    }

    @Test
    void findByUsername_returnsEmpty_whenCaseDiffers() {
        // findByUsername is case-sensitive
        Optional<User> result = userRepository.findFirstByUsername("ALICE");
        assertTrue(result.isEmpty());
    }

    @Test
    void findByUsername_returnsEmpty_whenUserNotFound() {
        Optional<User> result = userRepository.findFirstByUsername("ghost");
        assertTrue(result.isEmpty());
    }

    // ── findFirstByUsernameIgnoreCase ─────────────────────────────────────────────

    @Test
    void findFirstByUsernameIgnoreCase_returnsUser_withDifferentCase() {
        Optional<User> result = userRepository.findFirstByUsernameIgnoreCase("BOBUSER");
        assertTrue(result.isPresent());
        assertEquals("Bob@Example.COM", result.get().getEmail());
    }

    @Test
    void findFirstByUsernameIgnoreCase_returnsEmpty_whenNotFound() {
        Optional<User> result = userRepository.findFirstByUsernameIgnoreCase("unknownuser");
        assertTrue(result.isEmpty());
    }

    // ── existsByEmail ────────────────────────────────────────────────────────

    @Test
    void existsByEmail_returnsTrue_whenEmailExists() {
        assertTrue(userRepository.existsByEmail("alice@example.com"));
    }

    @Test
    void existsByEmail_returnsFalse_whenEmailNotFound() {
        assertFalse(userRepository.existsByEmail("nobody@example.com"));
    }

    @Test
    void existsByEmail_isCaseSensitive() {
        // The non-ignoreCase variant is case-sensitive
        assertFalse(userRepository.existsByEmail("ALICE@EXAMPLE.COM"));
    }

    // ── existsByEmailIgnoreCase ──────────────────────────────────────────────

    @Test
    void existsByEmailIgnoreCase_returnsTrueForAnyCase() {
        assertTrue(userRepository.existsByEmailIgnoreCase("ALICE@EXAMPLE.COM"));
        assertTrue(userRepository.existsByEmailIgnoreCase("alice@example.com"));
        assertTrue(userRepository.existsByEmailIgnoreCase("Alice@Example.Com"));
    }

    @Test
    void existsByEmailIgnoreCase_returnsFalse_whenNotFound() {
        assertFalse(userRepository.existsByEmailIgnoreCase("ghost@example.com"));
    }

    // ── existsByUsername ─────────────────────────────────────────────────────

    @Test
    void existsByUsername_returnsTrue_whenUsernameExists() {
        assertTrue(userRepository.existsByUsername("alice"));
    }

    @Test
    void existsByUsername_returnsFalse_whenUsernameNotFound() {
        assertFalse(userRepository.existsByUsername("unknownuser"));
    }

    // ── Standard CRUD ────────────────────────────────────────────────────────

    @Test
    void save_persistsNewUser_andCanBeFoundByEmail() {
        User charlie = new User();
        charlie.setEmail("charlie@example.com");
        charlie.setUsername("charlie");
        charlie.setPassword("HashedPass3!");
        charlie.setVerified(false);

        User saved = userRepository.save(charlie);

        assertNotNull(saved.getUserId());
        assertEquals("charlie", userRepository.findByEmail("charlie@example.com").getUsername());
    }

    @Test
    void findById_returnsUser_whenExists() {
        Optional<User> result = userRepository.findById(alice.getUserId());
        assertTrue(result.isPresent());
        assertEquals("alice@example.com", result.get().getEmail());
    }

    @Test
    void findById_returnsEmpty_whenNotFound() {
        Optional<User> result = userRepository.findById(9999L);
        assertTrue(result.isEmpty());
    }

    @Test
    void delete_removesUser() {
        Long id = alice.getUserId();
        userRepository.deleteById(id);
        entityManager.flush();
        assertFalse(userRepository.findById(id).isPresent());
    }

    @Test
    void update_changesEmail() {
        alice.setEmail("alice-new@example.com");
        userRepository.save(alice);
        entityManager.flush();
        entityManager.clear();

        assertNotNull(userRepository.findByEmail("alice-new@example.com"));
        assertNull(userRepository.findByEmail("alice@example.com"));
    }

    @Test
    void findAll_returnsAllUsers() {
        assertEquals(2, userRepository.findAll().size());
    }
}
