package com.planora.backend.exception;

/** Raised when a validated profile photo cannot be persisted to object storage. */
public class ProfilePhotoStorageException extends RuntimeException {

    public ProfilePhotoStorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
