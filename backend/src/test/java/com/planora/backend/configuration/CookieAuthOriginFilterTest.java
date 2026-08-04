package com.planora.backend.configuration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;

class CookieAuthOriginFilterTest {

    private final CookieAuthOriginFilter filter =
            new CookieAuthOriginFilter("https://app.example.com,http://localhost:3000");

    @Test
    void rejectsCrossSiteBrowserRefresh() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Origin", "https://evil.example");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_FORBIDDEN, response.getStatus());
        verify(chain, never()).doFilter(request, response);
    }

    @Test
    void allowsConfiguredOriginAndNativeClient() throws Exception {
        FilterChain browserChain = mock(FilterChain.class);
        MockHttpServletRequest browserRequest = new MockHttpServletRequest("POST", "/api/auth/logout");
        browserRequest.addHeader("Origin", "https://app.example.com");
        MockHttpServletResponse browserResponse = new MockHttpServletResponse();
        filter.doFilterInternal(browserRequest, browserResponse, browserChain);
        verify(browserChain).doFilter(browserRequest, browserResponse);

        FilterChain nativeChain = mock(FilterChain.class);
        MockHttpServletRequest nativeRequest = new MockHttpServletRequest("POST", "/api/auth/refresh");
        MockHttpServletResponse nativeResponse = new MockHttpServletResponse();
        filter.doFilterInternal(nativeRequest, nativeResponse, nativeChain);
        verify(nativeChain).doFilter(nativeRequest, nativeResponse);
    }

    @Test
    void rejectsBrowserMetadataWithoutOrigin() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Sec-Fetch-Site", "same-origin");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilterInternal(request, response, chain);

        assertEquals(HttpServletResponse.SC_FORBIDDEN, response.getStatus());
        verify(chain, never()).doFilter(request, response);
    }
}
