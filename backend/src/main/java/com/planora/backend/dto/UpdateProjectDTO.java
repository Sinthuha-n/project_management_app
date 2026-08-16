package com.planora.backend.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateProjectDTO {
    @Size(max = 100, message = "Project name must be 100 characters or less")
    private String name;

    @Size(max = 2000, message = "Description must be 2000 characters or fewer")
    private String description;

    @Size(max = 1000, message = "Figma URL must be 1000 characters or fewer")
    private String figmaUrl;
}