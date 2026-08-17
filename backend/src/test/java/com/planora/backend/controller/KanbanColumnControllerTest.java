package com.planora.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.dto.KanbanColumnSettingsDTO;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.model.User;
import com.planora.backend.model.UserPrincipal;
import com.planora.backend.service.JWTService;
import com.planora.backend.service.KanbanColumnService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(KanbanColumnController.class)
class KanbanColumnControllerTest {

    @Autowired
    private MockMvc mockMvc;

        @MockBean
    private KanbanColumnService kanbanColumnService;

        @MockBean
    private JWTService jwtService;

        @MockBean
        private UserDetailsService userDetailsService;

    @Autowired
    private ObjectMapper objectMapper;

    private KanbanColumn testColumn;
    private Kanban testKanban;
    private KanbanColumnRequestDTO columnRequestDTO;
    private UserPrincipal testUser;

    @BeforeEach
    void setUp() {
        testKanban = new Kanban();
        testKanban.setId(1L);
        testKanban.setName("Test Kanban");
        testKanban.setProjectId(10L);

        testColumn = new KanbanColumn();
        testColumn.setId(1L);
        testColumn.setName("To Do");
        testColumn.setStatus("TODO");
        testColumn.setPosition(0);
        testColumn.setColor("#F3F4F6");
        testColumn.setWipLimit(0);
        testColumn.setKanban(testKanban);

        columnRequestDTO = new KanbanColumnRequestDTO();
        columnRequestDTO.setName("To Do");
        columnRequestDTO.setPosition(0);
        columnRequestDTO.setKanbanId(1L);

        User user = new User();
        user.setUserId(42L);
        user.setUsername("testuser");
        user.setEmail("testuser@example.com");
        user.setPassword("ValidPassword123!");
        user.setVerified(true);
        testUser = new UserPrincipal(user);
    }

    @Test
    void createKanbanColumn_Returns200WithCreatedColumn() throws Exception {
        when(kanbanColumnService.createKanbanColumn(any(KanbanColumnRequestDTO.class)))
                .thenReturn(testColumn);

        mockMvc.perform(post("/api/kanban-columns")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(columnRequestDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("To Do"))
                .andExpect(jsonPath("$.status").value("TODO"))
                .andExpect(jsonPath("$.position").value(0));

        verify(kanbanColumnService, times(1)).createKanbanColumn(any(KanbanColumnRequestDTO.class));
    }

    @Test
    void getColumnsByKanbanId_Returns200WithColumns() throws Exception {
        KanbanColumn column2 = new KanbanColumn();
        column2.setId(2L);
        column2.setName("In Progress");
        column2.setStatus("IN_PROGRESS");
        column2.setPosition(1);

        List<KanbanColumn> columns = Arrays.asList(testColumn, column2);
        when(kanbanColumnService.getColumnsByKanbanId(1L)).thenReturn(columns);

        mockMvc.perform(get("/api/kanban-columns/kanban/1")
                .with(user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("To Do"))
                .andExpect(jsonPath("$[1].id").value(2))
                .andExpect(jsonPath("$[1].name").value("In Progress"));

        verify(kanbanColumnService, times(1)).getColumnsByKanbanId(1L);
    }

    @Test
    void getColumnsByKanbanId_NoColumns_Returns200WithEmpty() throws Exception {
        when(kanbanColumnService.getColumnsByKanbanId(999L)).thenReturn(List.of());

        mockMvc.perform(get("/api/kanban-columns/kanban/999")
                .with(user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void getKanbanColumnById_Exists_Returns200() throws Exception {
        when(kanbanColumnService.getKanbanColumnById(1L)).thenReturn(Optional.of(testColumn));

        mockMvc.perform(get("/api/kanban-columns/1")
                .with(user(testUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("To Do"))
                .andExpect(jsonPath("$.color").value("#F3F4F6"));

        verify(kanbanColumnService, times(1)).getKanbanColumnById(1L);
    }

    @Test
    void getKanbanColumnById_NotExists_Returns404() throws Exception {
        when(kanbanColumnService.getKanbanColumnById(999L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/kanban-columns/999")
                .with(user(testUser)))
                .andExpect(status().isNotFound());

        verify(kanbanColumnService, times(1)).getKanbanColumnById(999L);
    }

    @Test
    void updateKanbanColumn_Returns200WithUpdatedColumn() throws Exception {
        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("Updated Column");
        updatedColumn.setPosition(2);

        KanbanColumnRequestDTO updateDTO = new KanbanColumnRequestDTO();
        updateDTO.setName("Updated Column");
        updateDTO.setPosition(2);
        updateDTO.setKanbanId(1L);

        when(kanbanColumnService.updateKanbanColumn(eq(1L), any(KanbanColumnRequestDTO.class)))
                .thenReturn(updatedColumn);

        mockMvc.perform(put("/api/kanban-columns/1")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Column"))
                .andExpect(jsonPath("$.position").value(2));

        verify(kanbanColumnService, times(1)).updateKanbanColumn(eq(1L), any(KanbanColumnRequestDTO.class));
    }

    @Test
    void deleteKanbanColumn_Returns204NoContent() throws Exception {
        doNothing().when(kanbanColumnService).deleteKanbanColumn(1L, 42L);

        mockMvc.perform(delete("/api/kanban-columns/1")
                .with(user(testUser))
                .with(csrf()))
                .andExpect(status().isNoContent());

        verify(kanbanColumnService, times(1)).deleteKanbanColumn(1L, 42L);
    }

    @Test
    void reorderColumns_Returns204NoContent() throws Exception {
        List<Map<String, Integer>> reorderRequest = Arrays.asList(
            Map.of("id", 3, "position", 0),
            Map.of("id", 1, "position", 1),
            Map.of("id", 2, "position", 2)
        );

        doNothing().when(kanbanColumnService).reorderColumns(any());

        mockMvc.perform(patch("/api/kanban-columns/reorder")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reorderRequest)))
                .andExpect(status().isNoContent());

        verify(kanbanColumnService, times(1)).reorderColumns(any());
    }

    @Test
    void renameColumn_Returns200WithRenamedColumn() throws Exception {
        KanbanColumn renamedColumn = new KanbanColumn();
        renamedColumn.setId(1L);
        renamedColumn.setName("Renamed Column");

        Map<String, String> renameRequest = new HashMap<>();
        renameRequest.put("name", "Renamed Column");

        when(kanbanColumnService.renameColumn(eq(1L), eq("Renamed Column")))
                .thenReturn(renamedColumn);

        mockMvc.perform(patch("/api/kanban-columns/1/rename")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(renameRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed Column"));

        verify(kanbanColumnService, times(1)).renameColumn(eq(1L), eq("Renamed Column"));
    }

    @Test
    void updateColumnSettings_UpdatesColor_Returns200() throws Exception {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor("#FF0000");

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#FF0000");
        updatedColumn.setWipLimit(0);

        when(kanbanColumnService.updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class)))
                .thenReturn(updatedColumn);

        mockMvc.perform(patch("/api/kanban-columns/1/settings")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.color").value("#FF0000"));

        verify(kanbanColumnService, times(1)).updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class));
    }

    @Test
    void updateColumnSettings_UpdatesWipLimit_Returns200() throws Exception {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setWipLimit(10);

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#F3F4F6");
        updatedColumn.setWipLimit(10);

        when(kanbanColumnService.updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class)))
                .thenReturn(updatedColumn);

        mockMvc.perform(patch("/api/kanban-columns/1/settings")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.wipLimit").value(10));

        verify(kanbanColumnService, times(1)).updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class));
    }

    @Test
    void updateColumnSettings_UpdatesBothColorAndWipLimit_Returns200() throws Exception {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor("#00FF00");
        settingsDTO.setWipLimit(15);

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#00FF00");
        updatedColumn.setWipLimit(15);

        when(kanbanColumnService.updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class)))
                .thenReturn(updatedColumn);

        mockMvc.perform(patch("/api/kanban-columns/1/settings")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(settingsDTO)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.color").value("#00FF00"))
                .andExpect(jsonPath("$.wipLimit").value(15));

        verify(kanbanColumnService, times(1)).updateColumnSettings(eq(1L), any(KanbanColumnSettingsDTO.class));
    }

    @Test
    void createKanbanColumn_InvalidPayload_Returns400() throws Exception {
        mockMvc.perform(post("/api/kanban-columns")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{invalid json}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void getColumnsByKanbanId_VerifyCorrectEndpointPath() throws Exception {
        when(kanbanColumnService.getColumnsByKanbanId(1L)).thenReturn(List.of(testColumn));

        mockMvc.perform(get("/api/kanban-columns/kanban/1")
                .with(user(testUser)))
                .andExpect(status().isOk());
    }

    @Test
    void renameColumn_WithEmptyName_Returns200() throws Exception {
        KanbanColumn renamedColumn = new KanbanColumn();
        renamedColumn.setId(1L);
        renamedColumn.setName("");

        Map<String, String> renameRequest = new HashMap<>();
        renameRequest.put("name", "");

        when(kanbanColumnService.renameColumn(eq(1L), eq("")))
                .thenReturn(renamedColumn);

        mockMvc.perform(patch("/api/kanban-columns/1/rename")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(renameRequest)))
                .andExpect(status().isOk());
    }

    @Test
    void reorderColumns_SingleColumn_Returns204() throws Exception {
        List<Map<String, Integer>> reorderRequest = Arrays.asList(
            Map.of("id", 1, "position", 0)
        );

        doNothing().when(kanbanColumnService).reorderColumns(any());

        mockMvc.perform(patch("/api/kanban-columns/reorder")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reorderRequest)))
                .andExpect(status().isNoContent());
    }

    @Test
    void reorderColumns_EmptyList_Returns204() throws Exception {
        List<Map<String, Integer>> reorderRequest = List.of();

        doNothing().when(kanbanColumnService).reorderColumns(any());

        mockMvc.perform(patch("/api/kanban-columns/reorder")
                .with(user(testUser))
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(reorderRequest)))
                .andExpect(status().isNoContent());
    }
}
