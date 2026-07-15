package com.planora.backend.model;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.stream.Stream;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class CiStatusTest {

    @ParameterizedTest
    @MethodSource("githubValues")
    void fromGitHub_normalizesStatusAndConclusion(String status, String conclusion, CiStatus expected) {
        assertEquals(expected, CiStatus.fromGitHub(status, conclusion));
    }

    static Stream<Arguments> githubValues() {
        return Stream.of(
                Arguments.of("completed", "success", CiStatus.PASSING),
                Arguments.of("completed", "neutral", CiStatus.PASSING),
                Arguments.of("completed", "skipped", CiStatus.PASSING),
                Arguments.of("completed", "failure", CiStatus.FAILED),
                Arguments.of("completed", "cancelled", CiStatus.FAILED),
                Arguments.of("completed", "timed_out", CiStatus.FAILED),
                Arguments.of("completed", "action_required", CiStatus.FAILED),
                Arguments.of("completed", "pending", CiStatus.RUNNING),
                Arguments.of("in_progress", null, CiStatus.RUNNING),
                Arguments.of("queued", "", CiStatus.RUNNING),
                Arguments.of("waiting", "null", CiStatus.RUNNING),
                Arguments.of("pending", null, CiStatus.RUNNING),
                Arguments.of("completed", null, CiStatus.UNKNOWN),
                Arguments.of(null, null, CiStatus.UNKNOWN));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"unknown", "unexpected"})
    void conclusion_unknownValuesReturnUnknown(String value) {
        assertEquals(CiStatus.UNKNOWN, CiStatus.fromGitHubConclusion(value));
    }

    @ParameterizedTest
    @MethodSource("legacyAndStoredValues")
    void legacyAndStoredValuesAreNormalized(String value, CiStatus expected) {
        assertEquals(expected, CiStatus.fromGitHubLegacyState(value));
        if (!"error".equals(value)) {
            assertEquals(expected, CiStatus.fromStoredValue(value));
        }
    }

    static Stream<Arguments> legacyAndStoredValues() {
        return Stream.of(
                Arguments.of("success", CiStatus.PASSING),
                Arguments.of("failure", CiStatus.FAILED),
                Arguments.of("pending", CiStatus.RUNNING),
                Arguments.of("error", CiStatus.FAILED),
                Arguments.of("unknown", CiStatus.UNKNOWN),
                Arguments.of(null, CiStatus.UNKNOWN));
    }

    @ParameterizedTest
    @ValueSource(strings = {"PASSING", "passing", "FAILED", "running", "UNKNOWN"})
    void storedCanonicalNamesAreCaseInsensitive(String value) {
        assertEquals(CiStatus.valueOf(value.toUpperCase()), CiStatus.fromStoredValue(value));
    }

    @Test
    void merge_usesFailureRunningPassingUnknownPrecedence() {
        assertEquals(CiStatus.FAILED, CiStatus.merge(CiStatus.PASSING, CiStatus.FAILED));
        assertEquals(CiStatus.RUNNING, CiStatus.merge(CiStatus.UNKNOWN, CiStatus.RUNNING));
        assertEquals(CiStatus.PASSING, CiStatus.merge(CiStatus.PASSING, CiStatus.UNKNOWN));
        assertEquals(CiStatus.UNKNOWN, CiStatus.merge(CiStatus.UNKNOWN, CiStatus.UNKNOWN));
    }
}
