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
    const { notebookId, filePath, sourceType } = await req.json();

    if (!notebookId || !sourceType) {
      return new Response(
        JSON.stringify({ error: 'notebookId and sourceType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing request:', { notebookId, filePath, sourceType });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient
      .from('notebooks')
      .update({ generation_status: 'generating' })
      .eq('id', notebookId);

    const useCodeBasedGenerator = Deno.env.get('USE_CODE_BASED_GENERATOR') === 'true';
    console.log('🚦 Feature flag USE_CODE_BASED_GENERATOR:', useCodeBasedGenerator);

    let payload: any = {
      sourceType: sourceType
    };

    if (filePath) {
      payload.filePath = filePath;
    } else {
      const { data: source } = await supabaseClient
        .from('sources')
        .select('content')
        .eq('notebook_id', notebookId)
        .single();

      if (source?.content) {
        payload.content = source.content.substring(0, 5000);
      }
    }

    let response: Response;
    let generatorUsed: string;

    if (useCodeBasedGenerator) {
      console.log('✅ Using NEW code-based generator (generate-notebook-details-v2)');
      generatorUsed = 'code-based-v2';

      const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-notebook-details-v2`;

      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify(payload)
      });
    } else {
      console.log('⚠️  Using OLD n8n webhook (fallback)');
      generatorUsed = 'n8n-webhook';

      const webServiceUrl = Deno.env.get('NOTEBOOK_GENERATION_URL');
      const authHeader = Deno.env.get('NOTEBOOK_GENERATION_AUTH');

      if (!webServiceUrl || !authHeader) {
        console.error('Missing environment variables:', {
          hasUrl: !!webServiceUrl,
          hasAuth: !!authHeader
        });

        return new Response(
          JSON.stringify({ error: 'Web service configuration missing' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      response = await fetch(webServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify(payload)
      });
    }

    if (!response.ok) {
      console.error('Web service error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      await supabaseClient
        .from('notebooks')
        .update({ generation_status: 'failed' })
        .eq('id', notebookId);

      return new Response(
        JSON.stringify({ error: 'Failed to generate content from web service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generatedData = await response.json();
    console.log('Generated data:', generatedData);

    let title, description, notebookIcon, backgroundColor, exampleQuestions;
    
    if (generatedData && generatedData.output) {
      const output = generatedData.output;
      title = output.title;
      description = output.summary;
      notebookIcon = output.notebook_icon;
      backgroundColor = output.background_color;
      exampleQuestions = output.example_questions || [];
    } else {
      console.error('Unexpected response format:', generatedData);
      
      await supabaseClient
        .from('notebooks')
        .update({ generation_status: 'failed' })
        .eq('id', notebookId);

      return new Response(
        JSON.stringify({ error: 'Invalid response format from web service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!title) {
      console.error('No title returned from web service');
      
      await supabaseClient
        .from('notebooks')
        .update({ generation_status: 'failed' })
        .eq('id', notebookId);

      return new Response(
        JSON.stringify({ error: 'No title in response from web service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: notebookError } = await supabaseClient
      .from('notebooks')
      .update({
        title: title,
        description: description || null,
        icon: notebookIcon || '📝',
        color: backgroundColor || 'bg-gray-100',
        example_questions: exampleQuestions || [],
        generation_status: 'completed'
      })
      .eq('id', notebookId);

    if (notebookError) {
      console.error('Notebook update error:', notebookError);
      return new Response(
        JSON.stringify({ error: 'Failed to update notebook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully updated notebook with example questions:', exampleQuestions);
    console.log(`📊 Generator used: ${generatorUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        title,
        description,
        icon: notebookIcon,
        color: backgroundColor,
        exampleQuestions,
        generatorUsed,
        message: 'Notebook content generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});