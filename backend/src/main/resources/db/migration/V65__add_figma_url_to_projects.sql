-- V65: Add figma_url column to projects table.
-- Stores the shared Figma file/prototype URL for a project, configurable by OWNER or ADMIN.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS figma_url VARCHAR(1000);
