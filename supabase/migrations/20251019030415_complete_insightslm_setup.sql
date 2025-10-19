/*
  # Complete InsightsLM Database Setup
  
  This migration sets up all remaining database components:
  
  1. Extensions
    - uuid-ossp for UUID generation
    - vector for embeddings
  
  2. Database Functions
    - handle_new_user() - Creates profile when user signs up
    - update_updated_at_column() - Auto-updates timestamps
    - is_notebook_owner() - Checks notebook ownership
    - is_notebook_owner_for_document() - Checks document ownership
    - match_documents() - Vector similarity search
  
  3. Indexes
    - Performance indexes for notebooks, sources, notes
    - Vector similarity index for documents
  
  4. RLS Policies
    - Comprehensive security policies for all tables
  
  5. Triggers
    - Auto-update timestamps on record changes
    - Auto-create profile on user signup
  
  6. Realtime Configuration
    - Enable realtime updates for notebooks, sources, notes, chat
  
  7. Storage Buckets
    - sources bucket (50MB limit, private)
    - audio bucket (100MB limit, private)
    - public-images bucket (10MB limit, public)
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types
DO $$ BEGIN
    CREATE TYPE source_type AS ENUM ('pdf', 'text', 'website', 'youtube', 'audio');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON public.notebooks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON public.sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON public.sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON public.sources(processing_status);
CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON public.notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON public.n8n_chat_histories(session_id);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
    );
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    new.updated_at = timezone('utc'::text, now());
    RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_notebook_owner(notebook_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.notebooks 
        WHERE id = notebook_id_param 
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.is_notebook_owner_for_document(doc_metadata jsonb)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.notebooks 
        WHERE id = (doc_metadata->>'notebook_id')::uuid 
        AND user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.match_documents(
    query_embedding vector,
    match_count integer DEFAULT NULL,
    filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    id bigint,
    content text,
    metadata jsonb,
    similarity double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        documents.id,
        documents.content,
        documents.metadata,
        1 - (documents.embedding <=> query_embedding) as similarity
    FROM public.documents
    WHERE documents.metadata @> filter
    ORDER BY documents.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
CREATE POLICY "Users can view their own notebooks"
    ON public.notebooks FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
CREATE POLICY "Users can create their own notebooks"
    ON public.notebooks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
CREATE POLICY "Users can update their own notebooks"
    ON public.notebooks FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
CREATE POLICY "Users can delete their own notebooks"
    ON public.notebooks FOR DELETE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view sources from their notebooks" ON public.sources;
CREATE POLICY "Users can view sources from their notebooks"
    ON public.sources FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = sources.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create sources in their notebooks" ON public.sources;
CREATE POLICY "Users can create sources in their notebooks"
    ON public.sources FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = sources.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update sources in their notebooks" ON public.sources;
CREATE POLICY "Users can update sources in their notebooks"
    ON public.sources FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = sources.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete sources from their notebooks" ON public.sources;
CREATE POLICY "Users can delete sources from their notebooks"
    ON public.sources FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = sources.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view notes from their notebooks" ON public.notes;
CREATE POLICY "Users can view notes from their notebooks"
    ON public.notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = notes.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create notes in their notebooks" ON public.notes;
CREATE POLICY "Users can create notes in their notebooks"
    ON public.notes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = notes.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update notes in their notebooks" ON public.notes;
CREATE POLICY "Users can update notes in their notebooks"
    ON public.notes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = notes.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete notes from their notebooks" ON public.notes;
CREATE POLICY "Users can delete notes from their notebooks"
    ON public.notes FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.notebooks 
            WHERE notebooks.id = notes.notebook_id 
            AND notebooks.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view documents from their notebooks" ON public.documents;
CREATE POLICY "Users can view documents from their notebooks"
    ON public.documents FOR SELECT
    USING (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can create documents in their notebooks" ON public.documents;
CREATE POLICY "Users can create documents in their notebooks"
    ON public.documents FOR INSERT
    WITH CHECK (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can update documents in their notebooks" ON public.documents;
CREATE POLICY "Users can update documents in their notebooks"
    ON public.documents FOR UPDATE
    USING (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can delete documents from their notebooks" ON public.documents;
CREATE POLICY "Users can delete documents from their notebooks"
    ON public.documents FOR DELETE
    USING (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can view chat histories from their notebooks"
    ON public.n8n_chat_histories FOR SELECT
    USING (public.is_notebook_owner(session_id::uuid));

DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can create chat histories in their notebooks"
    ON public.n8n_chat_histories FOR INSERT
    WITH CHECK (public.is_notebook_owner(session_id::uuid));

DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can delete chat histories from their notebooks"
    ON public.n8n_chat_histories FOR DELETE
    USING (public.is_notebook_owner(session_id::uuid));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON public.notebooks;
DROP TRIGGER IF EXISTS update_sources_updated_at ON public.sources;
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notebooks_updated_at
    BEFORE UPDATE ON public.notebooks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sources_updated_at
    BEFORE UPDATE ON public.sources
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
    BEFORE UPDATE ON public.notes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- REALTIME CONFIGURATION
-- ============================================================================

ALTER TABLE public.notebooks REPLICA IDENTITY FULL;
ALTER TABLE public.sources REPLICA IDENTITY FULL;
ALTER TABLE public.notes REPLICA IDENTITY FULL;
ALTER TABLE public.n8n_chat_histories REPLICA IDENTITY FULL;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notebooks;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sources;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.n8n_chat_histories;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('sources', 'sources', false, 52428800, ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a'
  ]),
  ('audio', 'audio', false, 104857600, ARRAY[
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/m4a'
  ]),
  ('public-images', 'public-images', true, 10485760, ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  public = EXCLUDED.public;