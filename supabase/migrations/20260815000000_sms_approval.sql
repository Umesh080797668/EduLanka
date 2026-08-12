-- Add SMS approval toggle to tenants table

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS sms_approved BOOLEAN NOT NULL DEFAULT false;

-- Super Admin can approve SMS for specific tenants
-- We don't need additional policies since public.tenants is already admin-only for writes
