package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.planora.backend.exception.BadRequestException;

class OutboundUrlPolicyTest {

    private final OutboundUrlPolicy policy = new OutboundUrlPolicy();

    @Test
    void acceptsPublicHttpsUrl() {
        assertEquals("https://93.184.216.34/hooks/planora",
                policy.requirePublicHttpUrl("https://93.184.216.34/hooks/planora").toString());
    }

    @Test
    void rejectsLoopbackPrivateAndNonHttpTargets() {
        assertThrows(BadRequestException.class,
                () -> policy.requirePublicHttpUrl("http://127.0.0.1:8080/admin"));
        assertThrows(BadRequestException.class,
                () -> policy.requirePublicHttpUrl("http://10.0.0.1/internal"));
        assertThrows(BadRequestException.class,
                () -> policy.requirePublicHttpUrl("file:///etc/passwd"));
        assertThrows(BadRequestException.class,
                () -> policy.requirePublicHttpUrl("https://user:secret@example.com/hook"));
    }
}
