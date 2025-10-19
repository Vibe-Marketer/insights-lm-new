import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

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
    const { content } = await req.json();

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    let textContent = content;
    try {
      const parsed = JSON.parse(content);
      if (parsed.segments && parsed.segments.length > 0) {
        textContent = parsed.segments
          .slice(0, 3)
          .map((segment: any) => segment.text)
          .join(' ');
      }
    } catch (e) {
      // Content is already plain text
    }

    const truncatedContent = textContent.substring(0, 1000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant that generates concise, descriptive titles. Generate a title that is exactly 5 words or fewer, capturing the main topic or theme of the content. Return only the title, nothing else.' 
          },
          { 
            role: 'user', 
            content: `Generate a 5-word title for this content: ${truncatedContent}` 
          }
        ],
        max_tokens: 20,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedTitle = data.choices[0].message.content.trim();

    console.log('Generated title:', generatedTitle);

    return new Response(
      JSON.stringify({ title: generatedTitle }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in generate-note-title function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});