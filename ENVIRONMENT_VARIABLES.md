# Environment Variables Configuration

## Frontend Variables (Vite - in .env file)
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous/public API key

## Edge Function Variables (Set in Supabase Dashboard)

### Feature Flags
- `USE_CODE_BASED_GENERATOR`: Enable/disable code-based notebook generator (default: false)
  - `true`: Use new code-based edge function
  - `false`: Use existing n8n webhook

### N8N Webhook URLs (Legacy/Fallback)
- `NOTEBOOK_GENERATION_URL`: N8N webhook for generating notebook details
- `NOTEBOOK_CHAT_URL`: N8N webhook for chat functionality
- `AUDIO_GENERATION_WEBHOOK_URL`: N8N webhook for audio/podcast generation
- `DOCUMENT_PROCESSING_WEBHOOK_URL`: N8N webhook for document processing

### Authentication
- `NOTEBOOK_GENERATION_AUTH`: Authentication header value for N8N webhooks

### External APIs (for code-based functions)
- `OPENAI_API_KEY`: OpenAI API key for LLM and Whisper transcription
- `JINA_API_KEY`: Jina.ai API key for web scraping (optional, may work without)

### System Variables (Auto-provided by Supabase)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin operations
- `SUPABASE_ANON_KEY`: Anonymous key for public operations

## How to Set Edge Function Environment Variables

1. Go to Supabase Dashboard
2. Navigate to: Project Settings > Edge Functions > Environment Variables
3. Add the variables listed above
4. Click "Save"
5. Edge functions will pick up new variables on next invocation (no redeploy needed)

## Rollback Instructions

To rollback from code-based to n8n-based generator:

1. Open Supabase Dashboard
2. Go to: Project Settings > Edge Functions > Environment Variables
3. Find `USE_CODE_BASED_GENERATOR`
4. Change value from `true` to `false`
5. Save
6. System immediately routes to n8n webhook (takes effect in ~30 seconds)
