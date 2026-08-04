package com.planora.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.planora.backend.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    User findByEmail(String email);
    
    Optional<User> findFirstByEmailIgnoreCase(String email);

    Optional<User> findFirstByUsername(String username);

    Optional<User> findFirstByUsernameIgnoreCase(String username);

    List<User> findByGithubUsernameIgnoreCase(String githubUsername);

    Optional<User> findByGithubUserId(Long githubUserId);

    List<User> findByGithubEmailIgnoreCase(String githubEmail);
    
    boolean existsByEmail(String email);
    
    boolean existsByEmailIgnoreCase(String email);
    
    boolean existsByUsername(String username);
}
