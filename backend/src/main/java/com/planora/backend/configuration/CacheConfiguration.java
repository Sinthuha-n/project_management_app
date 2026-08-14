package com.planora.backend.configuration;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.convert.DurationStyle;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.GenericToStringSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.jsontype.BasicPolymorphicTypeValidator;
import com.github.benmanes.caffeine.cache.Caffeine;

@Configuration
@EnableCaching
public class CacheConfiguration implements CachingConfigurer {

    private static final Logger log = LoggerFactory.getLogger(CacheConfiguration.class);

    private static final List<String> LOCAL_CACHE_NAMES = List.of(
            "users-by-identity",
            "user-details",
            "team-member");

    private static final List<String> REDIS_CACHE_NAMES = List.of(
            "project-membership",
            "project-team-id",
            "github-issues",
            "github-issue-comments",
            "userProfile",
            "userPhotoUrls",
            "project-recent",
            "project-favorites");

    @Value("${app.cache.redis.enabled:true}")
    private boolean redisCacheEnabled;

    @Value("${app.cache.redis.fail-open:true}")
    private boolean redisCacheFailOpen;

    @Value("${app.cache.redis.ttl.project-membership:120s}")
    private String projectMembershipTtl;

    @Value("${app.cache.redis.ttl.project-team-id:600s}")
    private String projectTeamIdTtl;

    @Value("${app.cache.redis.ttl.github-issues:300s}")
    private String githubIssuesTtl;

    @Value("${app.cache.redis.ttl.github-issue-comments:300s}")
    private String githubIssueCommentsTtl;

    @Value("${app.cache.redis.ttl.user-profile:300s}")
    private String userProfileTtl;

    @Value("${app.cache.redis.ttl.user-photo-urls:2700s}")
    private String userPhotoUrlsTtl;

    @Value("${app.cache.redis.ttl.project-recent:60s}")
    private String projectRecentTtl;

    @Value("${app.cache.redis.ttl.project-favorites:60s}")
    private String projectFavoritesTtl;

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory redisConnectionFactory, ObjectMapper objectMapper) {
        CaffeineCacheManager localCacheManager = localCacheManager(redisCacheEnabled);

        if (!redisCacheEnabled) {
            return localCacheManager;
        }

        RedisCacheManager redisCacheManager = redisCacheManager(redisConnectionFactory, objectMapper);
        redisCacheManager.initializeCaches();
        return new RoutedCacheManager(localCacheManager, redisCacheManager, Set.copyOf(REDIS_CACHE_NAMES));
    }

    @Bean
    @Override
    public CacheErrorHandler errorHandler() {
        return new FailOpenCacheErrorHandler(redisCacheFailOpen);
    }

    private CaffeineCacheManager localCacheManager(boolean redisEnabled) {
        List<String> cacheNames = redisEnabled
                ? LOCAL_CACHE_NAMES
                : java.util.stream.Stream.concat(LOCAL_CACHE_NAMES.stream(), REDIS_CACHE_NAMES.stream()).toList();

        var manager = new CaffeineCacheManager(cacheNames.toArray(String[]::new));
        manager.setCaffeine(Caffeine.newBuilder()
                .expireAfterWrite(Duration.ofSeconds(60))
                .maximumSize(500));
        manager.registerCustomCache("project-membership",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(projectMembershipTtl))
                        .maximumSize(1_000)
                        .build());
        manager.registerCustomCache("team-member",
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofSeconds(60))
                        .maximumSize(2_000)
                        .build());
        manager.registerCustomCache("project-team-id",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(projectTeamIdTtl))
                        .maximumSize(1_000)
                        .build());
        manager.registerCustomCache("github-issues",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(githubIssuesTtl))
                        .maximumSize(500)
                        .build());
        manager.registerCustomCache("github-issue-comments",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(githubIssueCommentsTtl))
                        .maximumSize(1_000)
                        .build());
        manager.registerCustomCache("userProfile",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(userProfileTtl))
                        .maximumSize(1_000)
                        .build());
        manager.registerCustomCache("userPhotoUrls",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(userPhotoUrlsTtl))
                        .maximumSize(1_000)
                        .build());
        manager.registerCustomCache("project-recent",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(projectRecentTtl))
                        .maximumSize(2_000)
                        .build());
        manager.registerCustomCache("project-favorites",
                Caffeine.newBuilder()
                        .expireAfterWrite(parseDuration(projectFavoritesTtl))
                        .maximumSize(2_000)
                        .build());
        return manager;
    }

    private RedisCacheManager redisCacheManager(RedisConnectionFactory redisConnectionFactory, ObjectMapper objectMapper) {
        RedisCacheConfiguration defaults = redisDefaults(objectMapper);
        Map<String, RedisCacheConfiguration> configurations = new LinkedHashMap<>();
        configurations.put("project-membership", defaults.entryTtl(parseDuration(projectMembershipTtl)));
        configurations.put("project-team-id", projectTeamIdRedisCacheConfiguration(defaults));
        configurations.put("github-issues", defaults.entryTtl(parseDuration(githubIssuesTtl)));
        configurations.put("github-issue-comments", defaults.entryTtl(parseDuration(githubIssueCommentsTtl)));
        configurations.put("userProfile", defaults.entryTtl(parseDuration(userProfileTtl)));
        configurations.put("userPhotoUrls", defaults.entryTtl(parseDuration(userPhotoUrlsTtl)));
        configurations.put("project-recent", defaults.entryTtl(parseDuration(projectRecentTtl)));
        configurations.put("project-favorites", defaults.entryTtl(parseDuration(projectFavoritesTtl)));

        return RedisCacheManager.builder(redisConnectionFactory)
                .cacheDefaults(defaults)
                .withInitialCacheConfigurations(configurations)
                .disableCreateOnMissingCache()
                .build();
    }

    RedisCacheConfiguration projectTeamIdRedisCacheConfiguration(RedisCacheConfiguration defaults) {
        return defaults.entryTtl(parseDuration(projectTeamIdTtl))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericToStringSerializer<>(Long.class)));
    }

    private RedisCacheConfiguration redisDefaults(ObjectMapper objectMapper) {
        ObjectMapper cacheObjectMapper = objectMapper.copy();
        BasicPolymorphicTypeValidator typeValidator = BasicPolymorphicTypeValidator.builder()
                .allowIfBaseType("com.planora.backend")
                .allowIfBaseType("java.util")
                .allowIfBaseType("java.time")
                .allowIfSubType("com.planora.backend")
                .allowIfSubType("java.util")
                .allowIfSubType("java.time")
                .build();
        cacheObjectMapper.activateDefaultTypingAsProperty(
                typeValidator,
                ObjectMapper.DefaultTyping.NON_FINAL,
                "@class");

        GenericJackson2JsonRedisSerializer valueSerializer =
                new GenericJackson2JsonRedisSerializer(cacheObjectMapper);

        return RedisCacheConfiguration.defaultCacheConfig()
                .disableCachingNullValues()
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(valueSerializer));
    }

    private Duration parseDuration(String value) {
        return DurationStyle.detectAndParse(value);
    }

    private static class RoutedCacheManager implements CacheManager {
        private final CacheManager localCacheManager;
        private final CacheManager redisCacheManager;
        private final Set<String> redisCaches;

        private RoutedCacheManager(CacheManager localCacheManager, CacheManager redisCacheManager, Set<String> redisCaches) {
            this.localCacheManager = localCacheManager;
            this.redisCacheManager = redisCacheManager;
            this.redisCaches = redisCaches;
        }

        @Override
        public Cache getCache(String name) {
            return redisCaches.contains(name)
                    ? redisCacheManager.getCache(name)
                    : localCacheManager.getCache(name);
        }

        @Override
        public Collection<String> getCacheNames() {
            return java.util.stream.Stream.concat(
                            localCacheManager.getCacheNames().stream(),
                            redisCacheManager.getCacheNames().stream())
                    .distinct()
                    .toList();
        }
    }

    private static class FailOpenCacheErrorHandler implements CacheErrorHandler {
        private final boolean failOpen;

        private FailOpenCacheErrorHandler(boolean failOpen) {
            this.failOpen = failOpen;
        }

        @Override
        public void handleCacheGetError(RuntimeException exception, Cache cache, Object key) {
            handle(exception, cache, key, "get");
            if (failOpen && cache != null && key != null) {
                try {
                    // A payload written by an older serializer should fail open once,
                    // then be removed so the backing method can repopulate it.
                    cache.evict(key);
                } catch (RuntimeException evictionException) {
                    log.debug("Could not evict unreadable cache entry cache={} key={}: {}",
                            cache.getName(), key, evictionException.getMessage());
                }
            }
        }

        @Override
        public void handleCachePutError(RuntimeException exception, Cache cache, Object key, Object value) {
            handle(exception, cache, key, "put");
        }

        @Override
        public void handleCacheEvictError(RuntimeException exception, Cache cache, Object key) {
            handle(exception, cache, key, "evict");
        }

        @Override
        public void handleCacheClearError(RuntimeException exception, Cache cache) {
            handle(exception, cache, null, "clear");
        }

        private void handle(RuntimeException exception, Cache cache, Object key, String operation) {
            if (!failOpen) {
                throw exception;
            }
            log.warn("Cache {} failed for cache={} key={}; continuing without cache: {}",
                    operation,
                    cache != null ? cache.getName() : "unknown",
                    key,
                    exception.getMessage());
        }
    }
}
