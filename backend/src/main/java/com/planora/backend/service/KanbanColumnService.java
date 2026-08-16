package com.planora.backend.service;


import com.planora.backend.dto.KanbanColumnRequestDTO;
import com.planora.backend.dto.KanbanColumnSettingsDTO;
import com.planora.backend.exception.BadRequestException;
import com.planora.backend.exception.ForbiddenException;
import com.planora.backend.exception.ResourceNotFoundException;
import com.planora.backend.model.Kanban;
import com.planora.backend.model.KanbanColumn;
import com.planora.backend.model.Project;
import com.planora.backend.repository.KanbanColumnRepository;
import com.planora.backend.repository.KanbanRepository;
import com.planora.backend.repository.ProjectRepository;
import com.planora.backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import lombok.RequiredArgsConstructor;

//Manages column lifecycle, automatic status generation, and reordering integrity
@Service
@RequiredArgsConstructor
public class KanbanColumnService {

    private final KanbanColumnRepository kanbanColumnRepository;

    private final KanbanRepository kanbanRepository;

    private final ProjectRepository projectRepository;

    private final TaskRepository taskRepository;

    //Creates a new column and automatically generates a logic-friendly 'status' key.
    public KanbanColumn createKanbanColumn(KanbanColumnRequestDTO dto) {
        Optional<Kanban> optionalKanban = kanbanRepository.findById(dto.getKanbanId());
        if (optionalKanban.isPresent()) {
            KanbanColumn column = new KanbanColumn();
            column.setName(dto.getName());
            column.setPosition(dto.getPosition());
            // Auto-generate status from name: "In Review" → "IN_REVIEW"
            String autoStatus = dto.getName().trim().toUpperCase().replaceAll("\\s+", "_").replaceAll("[^A-Z0-9_]", "");
            column.setStatus(autoStatus);
            column.setKanban(optionalKanban.get());
            return kanbanColumnRepository.save(column);
        }
        throw new RuntimeException("Kanban not found");
    }

    public List<KanbanColumn> getColumnsByKanbanId(Long kanbanId) {
        return kanbanColumnRepository.findByKanbanIdOrderByPosition(kanbanId);
    }

    public Optional<KanbanColumn> getKanbanColumnById(Long id) {
        return kanbanColumnRepository.findById(id);
    }

    public KanbanColumn updateKanbanColumn(Long id, KanbanColumnRequestDTO dto) {
        Optional<KanbanColumn> optionalColumn = kanbanColumnRepository.findById(id);
        if (optionalColumn.isPresent()) {
            KanbanColumn column = optionalColumn.get();
            column.setName(dto.getName());
            column.setPosition(dto.getPosition());
            // KanbanId cannot be changed
            return kanbanColumnRepository.save(column);
        }
        throw new RuntimeException("KanbanColumn not found");
    }

    @Transactional
    public void deleteKanbanColumn(Long id, Long currentUserId) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("KanbanColumn not found"));

        Kanban kanban = column.getKanban();
        if (kanban == null || kanban.getProjectId() == null) {
            throw new ResourceNotFoundException("Kanban project not found");
        }

        Project project = projectRepository.findById(kanban.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        Long ownerId = project.getOwner() != null ? project.getOwner().getUserId() : null;
        if (currentUserId == null || ownerId == null || !ownerId.equals(currentUserId)) {
            throw new ForbiddenException("Only the project owner can delete board columns");
        }

        long taskCount = taskRepository.countByKanbanColumnId(id);
        if (taskCount > 0) {
            throw new BadRequestException("Move all tasks out of this column before deleting it");
        }

        Long kanbanId = kanban.getId();
        kanbanColumnRepository.delete(column);

        List<KanbanColumn> remainingColumns = kanbanColumnRepository.findByKanbanIdOrderByPosition(kanbanId);
        for (int index = 0; index < remainingColumns.size(); index++) {
            remainingColumns.get(index).setPosition(index);
        }
        kanbanColumnRepository.saveAll(remainingColumns);
    }

    @Transactional
    public void reorderColumns(List<Map<String, Integer>> reorderRequest) {
        for (Map<String, Integer> entry : reorderRequest) {
            Long columnId = Long.valueOf(entry.get("id"));
            Integer position = entry.get("position");
            kanbanColumnRepository.updatePosition(columnId, position);
        }
    }

    public KanbanColumn renameColumn(Long id, String name) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found"));
        column.setName(name);
        return kanbanColumnRepository.save(column);
    }

    public KanbanColumn updateColumnSettings(Long id, KanbanColumnSettingsDTO dto) {
        KanbanColumn column = kanbanColumnRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("KanbanColumn not found"));
        if (dto.getColor() != null) {
            column.setColor(dto.getColor());
        }
        if (dto.getWipLimit() != null) {
            column.setWipLimit(dto.getWipLimit());
        }
        return kanbanColumnRepository.save(column);
    }
}


