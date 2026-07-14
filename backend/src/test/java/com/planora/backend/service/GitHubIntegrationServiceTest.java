package com.planora.backend.service;

import com.planora.backend.model.User;
import com.planora.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withForbiddenRequest;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;

class GitHubIntegrationServiceTest {

    private GithubTokenService githubTokenService;
    private UserRepository userRepository;
    private CacheManager cacheManager;
    private Cache userProfileCache;
    private GitHubIntegrationService service;
    private MockRestServiceServer server;

    @BeforeEach
    void setUp() {
        githubTokenService = mock(GithubTokenService.class);
        userRepository = mock(UserRepository.class);
        cacheManager = mock(CacheManager.class);
        userProfileCache = mock(Cache.class);
        when(cacheManager.getCache("userProfile")).thenReturn(userProfileCache);

        service = new GitHubIntegrationService(githubTokenService, userRepository, mock(CiStatusResolver.class), cacheManager);
        ReflectionTestUtils.setField(service, "clientId", "client-id");
        ReflectionTestUtils.setField(service, "clientSecret", "client-secret");
        ReflectionTestUtils.setField(service, "mobileClientId", "client-id");
        ReflectionTestUtils.setField(service, "mobileClientSecret", "client-secret");
        RestTemplate restTemplate = (RestTemplate) ReflectionTestUtils.getField(service, "restTemplate");
        server = MockRestServiceServer.bindTo(restTemplate).build();
    }

    @Test
    void exchangeAndSaveToken_storesGithubUsernameAndPrimaryVerifiedEmail() {
        User user = new User();
        user.setUserId(7L);
        user.setEmail("planora-user@example.com");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findByGithubUserId(99L)).thenReturn(Optional.empty());

        server.expect(requestTo("https://github.com/login/oauth/access_token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"gh-token\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"id\":99,\"login\":\"octocat\",\"email\":null}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user/emails"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("[{\"email\":\"other@example.com\",\"primary\":false,\"verified\":true},{\"email\":\"octocat@example.com\",\"primary\":true,\"verified\":true}]", MediaType.APPLICATION_JSON));

        service.exchangeAndSaveToken(7L, "planora-user", "oauth-code", null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(githubTokenService).saveToken(7L, "gh-token");
        verify(userRepository).save(captor.capture());
        assertEquals("octocat", captor.getValue().getGithubUsername());
        assertEquals("octocat@example.com", captor.getValue().getGithubEmail());
        assertEquals(99L, captor.getValue().getGithubUserId());
        verify(userProfileCache).evict("planora-user@example.com");
        server.verify();
    }

    @Test
    void exchangeAndSaveToken_storesUsernameWithNullEmailWhenPrivate() {
        User user = new User();
        user.setUserId(7L);
        user.setEmail("planora-user@example.com");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(userRepository.findByGithubUserId(99L)).thenReturn(Optional.empty());

        server.expect(requestTo("https://github.com/login/oauth/access_token"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess("{\"access_token\":\"gh-token\"}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("{\"id\":99,\"login\":\"octocat\",\"email\":null}", MediaType.APPLICATION_JSON));
        server.expect(requestTo("https://api.github.com/user/emails"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withForbiddenRequest());

        service.exchangeAndSaveToken(7L, "planora-user", "oauth-code", null);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(captor.capture());
        assertEquals("octocat", captor.getValue().getGithubUsername());
        assertNull(captor.getValue().getGithubEmail());
        verify(userProfileCache).evict("planora-user@example.com");
        server.verify();
    }

    @Test
    void revokeToken_clearsTokenUsernameAndEmailEvenWhenGithubRevokeFails() {
        User user = new User();
        user.setUserId(7L);
        user.setEmail("planora-user@example.com");
        user.setGithubUsername("octocat");
        user.setGithubEmail("octocat@example.com");
        when(githubTokenService.getToken(7L)).thenReturn("gh-token");
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));

        server.expect(requestTo("https://api.github.com/applications/client-id/grant"))
                .andExpect(method(HttpMethod.DELETE))
                .andRespond(withServerError());

        service.revokeToken(7L);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(githubTokenService).clearToken(7L);
        verify(userRepository).save(captor.capture());
        assertNull(captor.getValue().getGithubUsername());
        assertNull(captor.getValue().getGithubEmail());
        verify(userProfileCache).evict("planora-user@example.com");
        server.verify();
    }
}
