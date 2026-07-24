package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class SecurityResponseHeadersFilterTest {
    @Test
    void addsSecurityAndCorrelationHeaders() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        new SecurityResponseHeadersFilter().doFilter(request, response, (req, res) -> { });

        assertNotNull(response.getHeader(SecurityResponseHeadersFilter.CORRELATION_ID));
        assertEquals("nosniff", response.getHeader("X-Content-Type-Options"));
        assertEquals("DENY", response.getHeader("X-Frame-Options"));
    }
}
