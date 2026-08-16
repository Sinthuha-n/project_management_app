package com.planora.backend.tools;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CORSConfiguration;
import software.amazon.awssdk.services.s3.model.CORSRule;
import software.amazon.awssdk.services.s3.model.PutBucketCorsRequest;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.*;

/**
 * Utility tool to apply the standard Planora CORS policy to all configured S3 buckets
 * using the project's AWS credentials without requiring the AWS CLI tool.
 */
public class ApplyS3Cors {

    public static void main(String[] args) {
        Map<String, String> env = loadEnvironment();

        String accessKey = getEnv(env, "AWS_ACCESS_KEY", "AWS_ACCESS_KEY_ID");
        String secretKey = getEnv(env, "AWS_SECRET_KEY", "AWS_SECRET_ACCESS_KEY");
        String regionStr = getEnv(env, "AWS_REGION", "AWS_DEFAULT_REGION", "eu-north-1");

        List<String> bucketKeys = List.of(
                "AWS_S3_CHAT_BUCKET", "AWS_CHAT_BUCKET",
                "AWS_S3_DMS_BUCKET", "AWS_DMS_BUCKET",
                "AWS_S3_PROFILE_BUCKET", "AWS_PROFILE_PHOTOS_BUCKET",
                "AWS_S3_TASK_BUCKET", "AWS_TASK_STORAGE_BUCKET"
        );

        Set<String> buckets = new LinkedHashSet<>();
        // Production defaults if not explicitly found in env
        buckets.add("planora-prod-chat-attachments-657347292859-eu-north-1-an");
        buckets.add("planora-prod-dms-documents");
        buckets.add("planora-prod-profile-photos-657347292859-eu-north-1-an");
        buckets.add("planora-prod-task-attachments-657347292859-eu-north-1-an");

        for (String key : bucketKeys) {
            String val = env.get(key);
            if (val != null && !val.isBlank()) {
                buckets.add(val.trim());
            }
        }

        System.out.println("========================================================");
        System.out.println("Planora S3 CORS Configurator");
        System.out.println("Region: " + regionStr);
        System.out.println("Buckets: " + buckets);
        System.out.println("========================================================");

        AwsCredentialsProvider credentialsProvider;
        if (accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank()) {
            credentialsProvider = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
            System.out.println("Using static credentials from environment/dotenv.");
        } else {
            credentialsProvider = DefaultCredentialsProvider.create();
            System.out.println("Using AWS default credentials provider chain.");
        }

        try (S3Client s3Client = S3Client.builder()
                .region(Region.of(regionStr))
                .credentialsProvider(credentialsProvider)
                .build()) {

            CORSRule rule = CORSRule.builder()
                    .allowedHeaders("*")
                    .allowedMethods("GET", "PUT", "POST", "DELETE", "HEAD")
                    .allowedOrigins(
                            "https://planora-pma.netlify.app",
                            "http://localhost:3000",
                            "http://localhost:3001",
                            "http://127.0.0.1:3000"
                    )
                    .exposeHeaders("ETag", "x-amz-request-id", "x-amz-id-2", "Content-Type", "Content-Length")
                    .maxAgeSeconds(3600)
                    .build();

            CORSConfiguration corsConfiguration = CORSConfiguration.builder()
                    .corsRules(rule)
                    .build();

            for (String bucket : buckets) {
                try {
                    System.out.print("Applying CORS to bucket [" + bucket + "] ... ");
                    PutBucketCorsRequest request = PutBucketCorsRequest.builder()
                            .bucket(bucket)
                            .corsConfiguration(corsConfiguration)
                            .build();
                    s3Client.putBucketCors(request);
                    System.out.println("SUCCESS!");
                } catch (Exception ex) {
                    System.out.println("FAILED: " + ex.getMessage());
                }
            }

        } catch (Exception ex) {
            System.err.println("Fatal error initializing S3 client: " + ex.getMessage());
            ex.printStackTrace();
        }

        System.out.println("========================================================");
        System.out.println("Done.");
    }

    private static String getEnv(Map<String, String> env, String... keys) {
        for (String k : keys) {
            String v = env.get(k);
            if (v != null && !v.isBlank()) return v;
            v = System.getenv(k);
            if (v != null && !v.isBlank()) return v;
            v = System.getProperty(k);
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private static Map<String, String> loadEnvironment() {
        Map<String, String> env = new HashMap<>();
        // Check root .env and backend/.env
        List<File> candidates = List.of(
                new File(".env"),
                new File("../.env"),
                new File("backend/.env"),
                new File("../../.env")
        );
        for (File f : candidates) {
            if (f.exists() && f.isFile()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(f))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) continue;
                        int idx = line.indexOf('=');
                        String k = line.substring(0, idx).trim();
                        String v = line.substring(idx + 1).trim();
                        if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))) {
                            v = v.substring(1, v.length() - 1);
                        }
                        env.putIfAbsent(k, v);
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return env;
    }
}
