package com.planora.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.model.CiStatus;

class CiStatusResolverTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private CiStatusResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new CiStatusResolver();
    }

    @Test
    void checkRunsUseFailureRunningPassingUnknownPrecedence() throws Exception {
        assertEquals(CiStatus.FAILED, resolver.resolveFromCheckRuns(json("""
                {"check_runs":[{"status":"completed","conclusion":"success"},
                  {"status":"completed","conclusion":"failure"}]}
                """)));
        assertEquals(CiStatus.RUNNING, resolver.resolveFromCheckRuns(json("""
                {"check_runs":[{"status":"completed","conclusion":"success"},
                  {"status":"queued","conclusion":null}]}
                """)));
        assertEquals(CiStatus.PASSING, resolver.resolveFromCheckRuns(json("""
                {"check_runs":[{"status":"completed","conclusion":"success"}]}
                """)));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCheckRuns(json("{\"check_runs\":[]}")));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCheckRuns(json("{}")));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCheckRuns(null));
    }

    @Test
    void commitStatusesUseFailureRunningPassingUnknownPrecedence() throws Exception {
        assertEquals(CiStatus.FAILED, resolver.resolveFromCommitStatuses(json("""
                [{"state":"success","context":"build"},{"state":"failure","context":"tests"}]
                """)));
        assertEquals(CiStatus.RUNNING, resolver.resolveFromCommitStatuses(json("""
                [{"state":"success","context":"build"},{"state":"pending","context":"tests"}]
                """)));
        assertEquals(CiStatus.PASSING,
                resolver.resolveFromCommitStatuses(json("[{\"state\":\"success\"}]")));
        assertEquals(CiStatus.UNKNOWN,
                resolver.resolveFromCommitStatuses(json("[{\"state\":\"unexpected\"}]")));
        assertEquals(CiStatus.PASSING, resolver.resolveFromCommitStatuses(json("""
                [{"state":"success","context":"build"},
                 {"state":"failure","context":"build"}]
                """)));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCommitStatuses(json("{}")));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCommitStatuses(null));
    }

    @Test
    void individualAndStoredResolversHandleMissingValues() throws Exception {
        assertEquals(CiStatus.RUNNING,
                resolver.resolveFromCheckRunEvent(json("{\"status\":\"queued\",\"conclusion\":null}")));
        assertEquals(CiStatus.UNKNOWN, resolver.resolveFromCheckRunEvent(null));
        assertEquals(CiStatus.FAILED, resolver.resolveFromStoredValue("failure"));
        assertEquals(CiStatus.PASSING, resolver.combine(CiStatus.PASSING, CiStatus.FAILED));
        assertEquals(CiStatus.FAILED, resolver.combine(CiStatus.UNKNOWN, CiStatus.FAILED));
    }

    private JsonNode json(String value) throws Exception {
        return objectMapper.readTree(value);
    }
}
