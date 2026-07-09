package com.planora.backend.configuration;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class StorageBucketStartupValidator implements ApplicationRunner {

    private final Environment environment;

    @Value("${aws.s3.profile-bucket:}")
    private String profilePhotosBucket;

    @Value("${aws.s3.dms-bucket:}")
    private String dmsBucket;

    @Value("${aws.s3.chat-bucket:}")
    private String chatBucket;

    @Value("${aws.s3.task-bucket:}")
    private String taskStorageBucket;

    @Value("${aws.region:}")
    private String awsRegion;

    public StorageBucketStartupValidator(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        log.info(
                "[Startup] AWS S3 config: region={}, profileBucket={}, dmsBucket={}, chatBucket={}, taskBucket={}",
                awsRegion,
                maskIfBlank(profilePhotosBucket),
                maskIfBlank(dmsBucket),
                maskIfBlank(chatBucket),
                maskIfBlank(taskStorageBucket));

        if (!isProductionProfile()) {
            return;
        }

        List<String> missing = new ArrayList<>();
        requireBucket(missing, profilePhotosBucket, "AWS_PROFILE_PHOTOS_BUCKET");
        requireBucket(missing, dmsBucket, "AWS_DMS_BUCKET");
        requireBucket(missing, chatBucket, "AWS_CHAT_BUCKET");
        requireBucket(missing, taskStorageBucket, "AWS_TASK_STORAGE_BUCKET");

        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "[STARTUP] Production object storage bucket configuration is incomplete. " +
                    "Set real bucket names for these environment variables before starting the application: " +
                    String.join(", ", missing));
        }
    }

    private boolean isProductionProfile() {
        return Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equalsIgnoreCase(profile) || "production".equalsIgnoreCase(profile));
    }

    private void requireBucket(List<String> missing, String value, String envName) {
        if (value == null || value.isBlank() || value.startsWith("your-")) {
            missing.add(envName);
        }
    }

    private String maskIfBlank(String value) {
        if (value == null || value.isBlank()) {
            return "<missing>";
        }
        return value;
    }
}
