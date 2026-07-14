package com.planora.backend.configuration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class UtcLocalDateTimeSerializerTest {

    @Test
    void serializesLocalDateTimeAsUtcRfc3339Instant() throws Exception {
        JavaTimeModule module = new JavaTimeModule();
        module.addSerializer(LocalDateTime.class, new UtcLocalDateTimeSerializer());
        ObjectMapper mapper = new ObjectMapper().registerModule(module);

        assertThat(mapper.writeValueAsString(LocalDateTime.of(2026, 7, 14, 10, 30)))
                .isEqualTo("\"2026-07-14T10:30:00Z\"");
    }
}

