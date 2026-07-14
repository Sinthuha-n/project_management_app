package com.planora.backend.service;

import com.planora.backend.exception.DocumentUploadException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class VirusScanServiceTest {
    @Test
    void disabledScannerAllowsLocalAndTestUploads() {
        VirusScanService service = new VirusScanService(mock(S3StorageService.class), "clamav", 3310, 1000, false);
        assertThatCode(() -> service.scanFile("documents", "object", "report.pdf")).doesNotThrowAnyException();
    }

    @Test
    void enabledScannerFailsClosedWhenStorageCannotBeRead() {
        VirusScanService service = new VirusScanService(mock(S3StorageService.class), "clamav", 3310, 1000, true);
        assertThatThrownBy(() -> service.scanFile("documents", "object", "report.pdf"))
                .isInstanceOf(DocumentUploadException.class)
                .extracting(error -> ((DocumentUploadException) error).getErrorCode())
                .isEqualTo("SCAN_UNAVAILABLE");
    }
}
