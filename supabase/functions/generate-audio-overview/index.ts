import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { notebookId } = await req.json();
    
    if (!notebookId) {
      return new Response(
        JSON.stringify({ error: 'Notebook ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabase
      .from('notebooks')
      .update({
        audio_overview_generation_status: 'generating'
      })
      .eq('id', notebookId);

    if (updateError) {
      console.error('Error updating notebook status:', updateError);
      throw updateError;
    }

    const audioGenerationWebhookUrl = Deno.env.get('AUDIO_GENERATION_WEBHOOK_URL');
    const authHeader = Deno.env.get('NOTEBOOK_GENERATION_AUTH');

    if (!audioGenerationWebhookUrl || !authHeader) {
      console.error('Missing audio generation webhook URL or auth');
      return new Response(
        JSON.stringify({ error: 'Audio generation service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Starting audio overview generation for notebook:', notebookId);

    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const audioResponse = await fetch(audioGenerationWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
            },
            body: JSON.stringify({
              notebook_id: notebookId,
              callback_url: `${supabaseUrl}/functions/v1/audio-generation-callback`
            })
          });

          if (!audioResponse.ok) {
            const errorText = await audioResponse.text();
            console.error('Audio generation webhook failed:', errorText);
            
            await supabase
              .from('notebooks')
              .update({ audio_overview_generation_status: 'failed' })
              .eq('id', notebookId);
          } else {
            console.log('Audio generation webhook called successfully for notebook:', notebookId);
          }
        } catch (error) {
          console.error('Background audio generation error:', error);
          
          await supabase
            .from('notebooks')
            .update({ audio_overview_generation_status: 'failed' })
            .eq('id', notebookId);
        }
      })()
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Audio generation started',
        status: 'generating'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in generate-audio-overview:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to start audio generation' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});