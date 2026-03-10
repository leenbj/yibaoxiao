-- Ensure storage bucket exists
-- Run this with service role key or via SQL Editor

-- Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Verify bucket exists
SELECT * FROM storage.buckets WHERE id = 'attachments';
