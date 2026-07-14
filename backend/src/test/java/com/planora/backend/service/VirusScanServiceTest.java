package com.planora.backend.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class VirusScanServiceTest {

    private final VirusScanService service = new VirusScanService();

    @Test
    void acceptsCleanFile() {
        assertThatCode(() -> service.scanFile("documents/7/report.pdf", "report.pdf"))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {"malware.exe", "VIRUS.pdf", "invoice-malware.PDF"})
    void rejectsThreatMarkersCaseInsensitively(String fileName) {
        assertThatThrownBy(() -> service.scanFile("quarantine/object", fileName))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("File threat detected");
    }
}
