package com.planora.backend.configuration;

import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PostConstruct;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;
import java.util.TimeZone;

@Configuration
public class UtcDateTimeConfiguration {

    @PostConstruct
    void useUtcApplicationClock() {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    }

    @Bean
    Jackson2ObjectMapperBuilderCustomizer utcLocalDateTimeCustomizer() {
        return builder -> {
            JavaTimeModule module = new JavaTimeModule();
            module.addSerializer(LocalDateTime.class, new UtcLocalDateTimeSerializer());
            builder.modulesToInstall(module);
            builder.timeZone(TimeZone.getTimeZone("UTC"));
        };
    }
}

