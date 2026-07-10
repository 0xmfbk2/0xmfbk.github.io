ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS posts_ordering_idx
  ON public.posts (is_pinned DESC, priority DESC, published_at DESC NULLS LAST);