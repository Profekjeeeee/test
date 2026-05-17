-- Staff-only notes about patient (dental_clients.internal_notes).
ALTER TABLE public.dental_clients
  ADD COLUMN IF NOT EXISTS internal_notes text;
