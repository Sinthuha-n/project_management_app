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

import com.planora.backend.dto.PortfolioDTO;
import com.planora.backend.dto.PortfolioResponseDTO;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.PortfolioService;

@ExtendWith(MockitoExtension.class)
class PortfolioControllerTest {

    @Mock PortfolioService service;
    private PortfolioController controller;
    private UserPrincipal principal;
    private PortfolioDTO request;
    private PortfolioResponseDTO response;

    @BeforeEach
    void setUp() {
        controller = new PortfolioController(service);
        principal = new UserPrincipal(user(1, "owner"));
        request = PortfolioDTO.builder().name("Delivery").build();
        response = PortfolioResponseDTO.builder().id(10L).name("Delivery").build();
    }

    @Test
    void createListGetAndUpdateDelegateWithExpectedStatus() {
        when(service.createPortfolio(request, 1L)).thenReturn(response);
        when(service.getPortfoliosForUser(1L)).thenReturn(List.of(response));
        when(service.getPortfolioById(10L, 1L)).thenReturn(response);
        when(service.updatePortfolio(10L, request)).thenReturn(response);

        assertThat(controller.create(request, principal).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(controller.list(principal).getBody()).containsExactly(response);
        assertThat(controller.get(10L, principal).getBody()).isSameAs(response);
        assertThat(controller.update(10L, request).getBody()).isSameAs(response);
    }

    @Test
    void deleteAddAndRemoveProjectDelegateWithExpectedStatus() {
        when(service.addProject(10L, 20L, 1L)).thenReturn(response);

        assertThat(controller.addProject(10L, 20L, principal).getBody()).isSameAs(response);
        assertThat(controller.removeProject(10L, 20L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.delete(10L).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        verify(service).removeProject(10L, 20L);
        verify(service).deletePortfolio(10L);
    }
}
