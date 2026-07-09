ALTER TABLE verification_tokens
    ADD COLUMN IF NOT EXISTS previous_token VARCHAR(255),
    ADD COLUMN IF NOT EXISTS previous_token_expires_at TIMESTAMP WITH TIME ZONE;
