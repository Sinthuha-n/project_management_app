package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.repository.UserRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

/**
 * It only understands objects that implement its internal "UserDetails" interface.
 * This service is automatically called by Spring during the login process to fetch
 *  the user's credentials and account state from the database.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JpaUserDetailedService implements UserDetailsService {

    private final UserRepository repository;

    /**
     * Loads the user's security profile based on their primary identifier.
     * * CACHING: Spring Security might call this method frequently (e.g., during filter chains).
     * Caching the result prevents a database query on every single secured API request.
     * sync = true prevents multiple threads from simultaneously querying the DB for the same uncached user.
     */
    @Override
    @Cacheable(cacheNames = "user-details", key = "#username.toLowerCase()", sync = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {

        // Step 1. Fetch the user.
        // Note: Spring Security uses the parameter name "username" universally to mean "primary identity".
        // In our specific system architecture, the primary identity for login is actually the email.
        User user = repository.findFirstByEmailIgnoreCase(username).orElse(null);

        // Step 2. Fail fast if the user doesn't exist in our database.
        if(user == null){
            log.debug("No user found for supplied authentication identity");
            throw new UsernameNotFoundException("User is not found");
        }

        // Step 3. Return the account state through UserDetails. DaoAuthenticationProvider
        // enforces isEnabled() during login, while JwtFilter needs the disabled principal
        // in order to return the actionable EMAIL_NOT_VERIFIED response for a valid token.
        return new UserPrincipal(user);
    }
}
