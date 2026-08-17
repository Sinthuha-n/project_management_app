package com.planora.backend.service;

import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.dto.KanbanColumnSettingsDTO;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.model.Project;
import com.planora.backend.model.User;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KanbanColumnServiceTest {

    @Mock
    private KanbanColumnRepository kanbanColumnRepository;

    @Mock
    private KanbanRepository kanbanRepository;

    @Mock
    private ProjectRepository projectRepository;

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private KanbanColumnService kanbanColumnService;

    private Kanban testKanban;
    private KanbanColumn testColumn;
    private Project testProject;
    private KanbanColumnRequestDTO columnRequestDTO;

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

        User owner = new User();
        owner.setUserId(42L);
        testProject = new Project();
        testProject.setId(10L);
        testProject.setOwner(owner);

        columnRequestDTO = new KanbanColumnRequestDTO();
        columnRequestDTO.setName("New Column");
        columnRequestDTO.setPosition(1);
        columnRequestDTO.setKanbanId(1L);
    }

    @Test
    void createKanbanColumn_Success() {
        when(kanbanRepository.findById(1L)).thenReturn(Optional.of(testKanban));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(testColumn);

        KanbanColumn result = kanbanColumnService.createKanbanColumn(columnRequestDTO);

        assertNotNull(result);
        assertEquals("To Do", result.getName());
        assertEquals(0, result.getPosition());
        verify(kanbanRepository, times(1)).findById(1L);
        verify(kanbanColumnRepository, times(1)).save(any(KanbanColumn.class));
    }

    @Test
    void createKanbanColumn_GeneratesStatusFromName() {
        ArgumentCaptor<KanbanColumn> columnCaptor = ArgumentCaptor.forClass(KanbanColumn.class);
        columnRequestDTO.setName("In Review");
        
        when(kanbanRepository.findById(1L)).thenReturn(Optional.of(testKanban));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(testColumn);

        kanbanColumnService.createKanbanColumn(columnRequestDTO);

        verify(kanbanColumnRepository).save(columnCaptor.capture());
        KanbanColumn captured = columnCaptor.getValue();
        assertEquals("IN_REVIEW", captured.getStatus());
    }

    @Test
    void createKanbanColumn_KanbanNotExists_ThrowsException() {
        when(kanbanRepository.findById(999L)).thenReturn(Optional.empty());
        columnRequestDTO.setKanbanId(999L);

        assertThrows(RuntimeException.class, 
            () -> kanbanColumnService.createKanbanColumn(columnRequestDTO));
        
        verify(kanbanRepository, times(1)).findById(999L);
        verify(kanbanColumnRepository, never()).save(any(KanbanColumn.class));
    }

    @Test
    void getColumnsByKanbanId_ReturnsOrderedColumns() {
        KanbanColumn column1 = new KanbanColumn();
        column1.setId(1L);
        column1.setName("To Do");
        column1.setPosition(0);

        KanbanColumn column2 = new KanbanColumn();
        column2.setId(2L);
        column2.setName("In Progress");
        column2.setPosition(1);

        List<KanbanColumn> columns = Arrays.asList(column1, column2);
        when(kanbanColumnRepository.findByKanbanIdOrderByPosition(1L)).thenReturn(columns);

        List<KanbanColumn> result = kanbanColumnService.getColumnsByKanbanId(1L);

        assertEquals(2, result.size());
        assertEquals("To Do", result.get(0).getName());
        assertEquals("In Progress", result.get(1).getName());
        verify(kanbanColumnRepository, times(1)).findByKanbanIdOrderByPosition(1L);
    }

    @Test
    void getColumnsByKanbanId_NoColumns_ReturnsEmpty() {
        when(kanbanColumnRepository.findByKanbanIdOrderByPosition(999L)).thenReturn(List.of());

        List<KanbanColumn> result = kanbanColumnService.getColumnsByKanbanId(999L);

        assertTrue(result.isEmpty());
    }

    @Test
    void getKanbanColumnById_Exists_ReturnsColumn() {
        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));

        Optional<KanbanColumn> result = kanbanColumnService.getKanbanColumnById(1L);

        assertTrue(result.isPresent());
        assertEquals("To Do", result.get().getName());
        verify(kanbanColumnRepository, times(1)).findById(1L);
    }

    @Test
    void getKanbanColumnById_NotExists_ReturnsEmpty() {
        when(kanbanColumnRepository.findById(999L)).thenReturn(Optional.empty());

        Optional<KanbanColumn> result = kanbanColumnService.getKanbanColumnById(999L);

        assertFalse(result.isPresent());
    }

    @Test
    void updateKanbanColumn_Success() {
        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("Updated Column");
        updatedColumn.setPosition(2);
        
        columnRequestDTO.setName("Updated Column");
        columnRequestDTO.setPosition(2);

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(updatedColumn);

        KanbanColumn result = kanbanColumnService.updateKanbanColumn(1L, columnRequestDTO);

        assertEquals("Updated Column", result.getName());
        assertEquals(2, result.getPosition());
        verify(kanbanColumnRepository, times(1)).findById(1L);
        verify(kanbanColumnRepository, times(1)).save(any(KanbanColumn.class));
    }

    @Test
    void updateKanbanColumn_NotExists_ThrowsException() {
        when(kanbanColumnRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, 
            () -> kanbanColumnService.updateKanbanColumn(999L, columnRequestDTO));
        
        verify(kanbanColumnRepository, never()).save(any(KanbanColumn.class));
    }

    @Test
    void deleteKanbanColumn_Success() {
        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(testProject));
        when(taskRepository.countByKanbanColumnId(1L)).thenReturn(0L);
        when(kanbanColumnRepository.findByKanbanIdOrderByPosition(1L)).thenReturn(List.of());

        kanbanColumnService.deleteKanbanColumn(1L, 42L);

        verify(kanbanColumnRepository, times(1)).delete(testColumn);
        verify(kanbanColumnRepository, times(1)).saveAll(List.of());
    }

    @Test
    void deleteKanbanColumn_NotOwner_ThrowsForbidden() {
        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(testProject));

        assertThrows(ForbiddenException.class,
            () -> kanbanColumnService.deleteKanbanColumn(1L, 99L));

        verify(taskRepository, never()).countByKanbanColumnId(anyLong());
        verify(kanbanColumnRepository, never()).delete(any(KanbanColumn.class));
    }

    @Test
    void deleteKanbanColumn_WithTasks_ThrowsBadRequest() {
        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(projectRepository.findById(10L)).thenReturn(Optional.of(testProject));
        when(taskRepository.countByKanbanColumnId(1L)).thenReturn(2L);

        assertThrows(BadRequestException.class,
            () -> kanbanColumnService.deleteKanbanColumn(1L, 42L));

        verify(kanbanColumnRepository, never()).delete(any(KanbanColumn.class));
    }

    @Test
    void reorderColumns_Success() {
        List<Map<String, Integer>> reorderRequest = Arrays.asList(
            Map.of("id", 3, "position", 0),
            Map.of("id", 1, "position", 1),
            Map.of("id", 2, "position", 2)
        );

        doNothing().when(kanbanColumnRepository).updatePosition(anyLong(), any(Integer.class));

        kanbanColumnService.reorderColumns(reorderRequest);

        verify(kanbanColumnRepository, times(3)).updatePosition(anyLong(), any(Integer.class));
    }

    @Test
    void reorderColumns_CallsUpdatePositionForEachEntry() {
        List<Map<String, Integer>> reorderRequest = Arrays.asList(
            Map.of("id", 3, "position", 0),
            Map.of("id", 1, "position", 1)
        );

        ArgumentCaptor<Long> idCaptor = ArgumentCaptor.forClass(Long.class);
        ArgumentCaptor<Integer> posCaptor = ArgumentCaptor.forClass(Integer.class);

        doNothing().when(kanbanColumnRepository).updatePosition(anyLong(), any(Integer.class));

        kanbanColumnService.reorderColumns(reorderRequest);

        verify(kanbanColumnRepository, times(2)).updatePosition(
            idCaptor.capture(), posCaptor.capture());
        
        List<Long> capturedIds = idCaptor.getAllValues();
        List<Integer> capturedPositions = posCaptor.getAllValues();
        
        assertEquals(3L, capturedIds.get(0));
        assertEquals(0, capturedPositions.get(0));
        assertEquals(1L, capturedIds.get(1));
        assertEquals(1, capturedPositions.get(1));
    }

    @Test
    void renameColumn_Success() {
        KanbanColumn renamedColumn = new KanbanColumn();
        renamedColumn.setId(1L);
        renamedColumn.setName("Renamed Column");

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(renamedColumn);

        KanbanColumn result = kanbanColumnService.renameColumn(1L, "Renamed Column");

        assertEquals("Renamed Column", result.getName());
        verify(kanbanColumnRepository, times(1)).findById(1L);
        verify(kanbanColumnRepository, times(1)).save(any(KanbanColumn.class));
    }

    @Test
    void renameColumn_NotExists_ThrowsException() {
        when(kanbanColumnRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, 
            () -> kanbanColumnService.renameColumn(999L, "New Name"));
        
        verify(kanbanColumnRepository, never()).save(any(KanbanColumn.class));
    }

    @Test
    void updateColumnSettings_UpdatesColor() {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor("#FF0000");
        settingsDTO.setWipLimit(null);

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#FF0000");
        updatedColumn.setWipLimit(0);

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(updatedColumn);

        KanbanColumn result = kanbanColumnService.updateColumnSettings(1L, settingsDTO);

        assertEquals("#FF0000", result.getColor());
        verify(kanbanColumnRepository, times(1)).save(any(KanbanColumn.class));
    }

    @Test
    void updateColumnSettings_UpdatesWipLimit() {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor(null);
        settingsDTO.setWipLimit(10);

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#F3F4F6");
        updatedColumn.setWipLimit(10);

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(updatedColumn);

        KanbanColumn result = kanbanColumnService.updateColumnSettings(1L, settingsDTO);

        assertEquals(10, result.getWipLimit());
        verify(kanbanColumnRepository, times(1)).save(any(KanbanColumn.class));
    }

    @Test
    void updateColumnSettings_UpdatesBoth() {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor("#00FF00");
        settingsDTO.setWipLimit(15);

        KanbanColumn updatedColumn = new KanbanColumn();
        updatedColumn.setId(1L);
        updatedColumn.setName("To Do");
        updatedColumn.setColor("#00FF00");
        updatedColumn.setWipLimit(15);

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(testColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(updatedColumn);

        KanbanColumn result = kanbanColumnService.updateColumnSettings(1L, settingsDTO);

        assertEquals("#00FF00", result.getColor());
        assertEquals(15, result.getWipLimit());
    }

    @Test
    void updateColumnSettings_NotExists_ThrowsException() {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor("#FF0000");

        when(kanbanColumnRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, 
            () -> kanbanColumnService.updateColumnSettings(999L, settingsDTO));
        
        verify(kanbanColumnRepository, never()).save(any(KanbanColumn.class));
    }

    @Test
    void updateColumnSettings_IgnoresNullValues() {
        KanbanColumnSettingsDTO settingsDTO = new KanbanColumnSettingsDTO();
        settingsDTO.setColor(null);
        settingsDTO.setWipLimit(null);

        KanbanColumn originalColumn = new KanbanColumn();
        originalColumn.setId(1L);
        originalColumn.setName("To Do");
        originalColumn.setColor("#F3F4F6");
        originalColumn.setWipLimit(0);

        when(kanbanColumnRepository.findById(1L)).thenReturn(Optional.of(originalColumn));
        when(kanbanColumnRepository.save(any(KanbanColumn.class))).thenReturn(originalColumn);

        KanbanColumn result = kanbanColumnService.updateColumnSettings(1L, settingsDTO);

        assertEquals("#F3F4F6", result.getColor());
        assertEquals(0, result.getWipLimit());
    }
}
