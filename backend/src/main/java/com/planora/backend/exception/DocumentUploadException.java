package com.planora.backend.exception;

import org.springframework.http.HttpStatus;

public class DocumentUploadException extends RuntimeException {
    private final String errorCode;
    private final HttpStatus status;

    public DocumentUploadException(String errorCode, String message, HttpStatus status) {
        super(message);
        this.errorCode = errorCode;
        this.status = status;
    }

    public String getErrorCode() { return errorCode; }
    public HttpStatus getStatus() { return status; }
}
