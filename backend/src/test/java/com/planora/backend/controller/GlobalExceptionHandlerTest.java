package com.planora.backend.controller;

import com.planora.backend.annotation.WithMockUserPrincipal;
import com.planora.backend.exception.ConflictException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import(GlobalExceptionHandler.class)
class GlobalExceptionHandlerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private UserDetailsService userDetailsService;

    private static final String VALID_USER_JSON = "{\"email\":\"test@example.com\",\"password\":\"Test@1234\",\"username\":\"testuser\"}";

    @Test
    @WithMockUserPrincipal
    void whenResourceNotFound_thenReturnStandardShape() throws Exception {
        when(userService.register(any())).thenThrow(new ResourceNotFoundException("User not found"));

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_USER_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.errorCode").value("RESOURCE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("User not found"))
                .andExpect(jsonPath("$.path").value("/api/auth/register"))
                .andExpect(jsonPath("$.fieldErrors").doesNotExist());
    }

    @Test
    @WithMockUserPrincipal
    void whenForbidden_thenReturnStandardShape() throws Exception {
        when(userService.register(any())).thenThrow(new ForbiddenException("Access forbidden"));

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_USER_JSON))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.errorCode").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("Access forbidden"))
                .andExpect(jsonPath("$.path").value("/api/auth/register"));
    }

    @Test
    @WithMockUserPrincipal
    void whenConflict_thenReturnStandardShape() throws Exception {
        when(userService.register(any())).thenThrow(new ConflictException("Conflict occurred"));

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_USER_JSON))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.errorCode").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Conflict occurred"))
                .andExpect(jsonPath("$.path").value("/api/auth/register"));
    }

    @Test
    @WithMockUserPrincipal
    void whenRuntimeException_thenReturnStandardShapeAndOpaqueMessage() throws Exception {
        when(userService.register(any())).thenThrow(new RuntimeException("Sensitive database or internal error details"));

        mockMvc.perform(post("/api/auth/register")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_USER_JSON))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.errorCode").value("INTERNAL_SERVER_ERROR"))
                .andExpect(jsonPath("$.message").value("An unexpected error occurred"))
                .andExpect(jsonPath("$.path").value("/api/auth/register"));
    }

    @Test
    @WithMockUserPrincipal
    void whenHeadRequestOnPostOnlyEndpoint_thenReturnMethodNotAllowed() throws Exception {
        mockMvc.perform(head("/api/auth/refresh")
                        .with(csrf()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.status").value(405))
                .andExpect(jsonPath("$.errorCode").value("METHOD_NOT_ALLOWED"))
                .andExpect(jsonPath("$.path").value("/api/auth/refresh"));
    }

    @Test
    @WithMockUserPrincipal
    void whenPathVariableHasWrongType_thenReturnBadRequest() throws Exception {
        mockMvc.perform(get("/api/auth/users/not-a-number/photo"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.errorCode").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid request parameter"))
                .andExpect(jsonPath("$.path").value("/api/auth/users/not-a-number/photo"));
    }
}
