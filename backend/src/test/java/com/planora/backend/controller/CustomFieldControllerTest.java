package com.planora.backend.controller;

import static com.planora.backend.support.TestDataFactory.user;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import com.planora.backend.dto.CustomFieldRequestDTO;
import com.planora.backend.dto.CustomFieldResponseDTO;
import com.planora.backend.dto.TaskCustomFieldResponseDTO;
import com.planora.backend.dto.TaskFieldValuePatchDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.CustomFieldService;

@ExtendWith(MockitoExtension.class)
class CustomFieldControllerTest {

    @Mock CustomFieldService service;
    private CustomFieldController controller;
    private UserPrincipal principal;

    @BeforeEach
    void setUp() {
        controller = new CustomFieldController(service);
        principal = new UserPrincipal(user(1, "owner"));
    }

    @Test
    void projectFieldEndpointsDelegate() {
        CustomFieldRequestDTO request = new CustomFieldRequestDTO("Estimate", "NUMBER", null, 0);
        CustomFieldResponseDTO response = new CustomFieldResponseDTO(2L, "Estimate", "NUMBER", null, 0);
        when(service.getProjectCustomFields(10L, 1L)).thenReturn(List.of(response));
        when(service.createCustomField(10L, request, 1L)).thenReturn(response);

        assertThat(controller.getProjectCustomFields(10L, principal).getBody()).containsExactly(response);
        assertThat(controller.createCustomField(10L, request, principal).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(controller.deleteCustomField(10L, 2L, principal).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteCustomField(10L, 2L, 1L);
    }

    @Test
    void taskFieldEndpointsDelegate() {
        TaskCustomFieldResponseDTO response = new TaskCustomFieldResponseDTO(2L, "Estimate", "NUMBER", null, "8");
        TaskFieldValuePatchDTO request = new TaskFieldValuePatchDTO(2L, "8");
        when(service.getTaskCustomFields(20L, 1L)).thenReturn(List.of(response));

        assertThat(controller.getTaskCustomFields(20L, principal).getBody()).containsExactly(response);
        assertThat(controller.patchTaskCustomField(20L, request, principal).getStatusCode()).isEqualTo(HttpStatus.OK);
        verify(service).patchTaskCustomField(20L, request, 1L);
    }
}
