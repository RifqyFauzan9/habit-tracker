-- The AI cache is disposable infrastructure, not user data: soft delete only
-- bought a partial unique index, which ON CONFLICT (cols) cannot infer — so
-- every cache write failed and every request hit the model.
drop index if exists idx_ai_cache_key_unique;

alter table public.ai_response_cache drop column if exists deleted_at;

alter table public.ai_response_cache
  add constraint ai_response_cache_key_unique unique (user_id, feature, cache_key);
