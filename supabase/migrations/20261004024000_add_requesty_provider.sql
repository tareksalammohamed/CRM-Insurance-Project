-- Add Requesty as an AI provider.
-- Requesty is used only through its free model catalog in the application layer.

ALTER TABLE public.ai_providers DROP CONSTRAINT IF EXISTS ai_providers_provider_check;
ALTER TABLE public.ai_providers
  ADD CONSTRAINT ai_providers_provider_check
  CHECK (provider IN ('openrouter', 'groq', 'cloudflare', 'ocrspace', 'gemini', 'nararouter', 'requesty'));

ALTER TABLE public.ai_provider_models DROP CONSTRAINT IF EXISTS ai_provider_models_provider_check;
ALTER TABLE public.ai_provider_models
  ADD CONSTRAINT ai_provider_models_provider_check
  CHECK (provider IN ('openrouter', 'groq', 'cloudflare', 'ocrspace', 'gemini', 'nararouter', 'requesty'));

INSERT INTO public.ai_providers (provider, display_name, enabled, priority, provider_type)
VALUES ('requesty', 'Requesty', false, 6, 'ai')
ON CONFLICT (provider) DO UPDATE
SET display_name = EXCLUDED.display_name,
    provider_type = 'ai';
