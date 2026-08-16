-- V64: Add color to springcolumns table for sprint board column theming
ALTER TABLE springcolumns ADD COLUMN IF NOT EXISTS color VARCHAR(50);
