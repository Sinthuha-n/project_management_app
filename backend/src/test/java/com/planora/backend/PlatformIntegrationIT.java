package com.planora.backend;

import static org.testcontainers.containers.localstack.LocalStackContainer.Service.S3;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.utility.DockerImageName;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.icegreen.greenmail.util.GreenMail;
import com.icegreen.greenmail.util.ServerSetup;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;

@Import(PlatformIntegrationIT.PlatformStorageConfiguration.class)
public abstract class PlatformIntegrationIT extends PostgresIntegrationIT {

    protected static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
                    .withExposedPorts(6379);
    protected static final LocalStackContainer LOCALSTACK =
            new LocalStackContainer(DockerImageName.parse("localstack/localstack:3.8"))
                    .withServices(S3);
    protected static final WireMockServer GITHUB = new WireMockServer(0);
    protected static final GreenMail SMTP =
            new GreenMail(new ServerSetup(0, "127.0.0.1", ServerSetup.PROTOCOL_SMTP));

    @BeforeAll
    static void createBuckets() {
        ensurePlatformStarted();
        try (S3Client client = s3Client()) {
            for (String bucket : bucketNames()) {
                if (!client.listBuckets().buckets().stream().anyMatch(item -> bucket.equals(item.name()))) {
                    client.createBucket(request -> request.bucket(bucket));
                }
            }
        }
    }

    @AfterEach
    void resetPlatformState() throws Exception {
        GITHUB.resetAll();
        SMTP.purgeEmailFromAllMailboxes();
        REDIS.execInContainer("redis-cli", "FLUSHDB");
        try (S3Client client = s3Client()) {
            for (String bucket : bucketNames()) {
                var objects = client.listObjectsV2(request -> request.bucket(bucket)).contents();
                if (!objects.isEmpty()) {
                    client.deleteObjects(DeleteObjectsRequest.builder()
                            .bucket(bucket)
                            .delete(delete -> delete.objects(objects.stream()
                                    .map(item -> ObjectIdentifier.builder().key(item.key()).build())
                                    .toList()))
                            .build());
                }
            }
        }
    }

    @DynamicPropertySource
    static void configurePlatform(DynamicPropertyRegistry registry) {
        ensurePlatformStarted();
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("app.cache.redis.enabled", () -> true);
        registry.add("notifications.cache.redis.enabled", () -> true);
        registry.add("spring.mail.host", () -> "127.0.0.1");
        registry.add("spring.mail.port", () -> SMTP.getSmtp().getPort());
        registry.add("spring.mail.username", () -> "");
        registry.add("spring.mail.password", () -> "");
        registry.add("spring.mail.properties.mail.smtp.auth", () -> false);
        registry.add("github.api-base-url", GITHUB::baseUrl);
        registry.add("github.oauth-base-url", GITHUB::baseUrl);
    }

    protected static synchronized void ensurePlatformStarted() {
        ensurePostgresStarted();
        if (!REDIS.isRunning()) REDIS.start();
        if (!LOCALSTACK.isRunning()) LOCALSTACK.start();
        if (!GITHUB.isRunning()) GITHUB.start();
        if (!SMTP.isRunning()) SMTP.start();
    }

    protected static List<String> bucketNames() {
        return List.of("integration-profile", "integration-documents", "integration-chat", "integration-tasks");
    }

    protected static S3Client s3Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(
                LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey());
        return S3Client.builder()
                .endpointOverride(LOCALSTACK.getEndpointOverride(S3))
                .region(Region.of(LOCALSTACK.getRegion()))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build();
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PlatformStorageConfiguration {
        @Bean
        @Primary
        S3Client integrationS3Client() {
            return s3Client();
        }

        @Bean
        @Primary
        S3Presigner integrationS3Presigner() {
            AwsBasicCredentials credentials = AwsBasicCredentials.create(
                    LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey());
            return S3Presigner.builder()
                    .endpointOverride(LOCALSTACK.getEndpointOverride(S3))
                    .region(Region.of(LOCALSTACK.getRegion()))
                    .credentialsProvider(StaticCredentialsProvider.create(credentials))
                    .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                    .build();
        }
    }
}
