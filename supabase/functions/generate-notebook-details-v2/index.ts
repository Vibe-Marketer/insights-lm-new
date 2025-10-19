import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import OpenAI from 'npm:openai@4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotebookDetailsRequest {
  filePath?: string;
  sourceType: 'text' | 'website' | 'file' | 'audio';
  content?: string;
}

interface NotebookDetailsResponse {
  title: string;
  summary: string;
  notebook_icon: string;
  background_color: string;
  example_questions: string[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { filePath, sourceType, content }: NotebookDetailsRequest = await req.json();

    console.log('Processing request:', { filePath, sourceType, hasContent: !!content });

    if (!sourceType) {
      return new Response(
        JSON.stringify({ error: 'sourceType is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const openai = new OpenAI({ apiKey: openaiApiKey });

    let extractedText = '';

    if (sourceType === 'text' && content) {
      extractedText = content;
      console.log('Using provided text content');
    } else if (sourceType === 'website' && filePath) {
      console.log('Fetching website content with Jina.ai:', filePath);
      extractedText = await extractWebsiteContent(filePath);
    } else if (sourceType === 'website' && content) {
      extractedText = content;
      console.log('Using provided website content');
    } else if (filePath) {
      console.log('Extracting text from file:', filePath);
      extractedText = await extractTextFromFile(supabase, filePath, openai);
    } else {
      throw new Error('Either filePath or content must be provided');
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Failed to extract text from source');
    }

    console.log('Extracted text length:', extractedText.length);

    const truncatedText = extractedText.substring(0, 50000);

    console.log('Generating notebook details with LLM...');
    const details = await generateNotebookDetails(openai, truncatedText);

    console.log('Generated details:', details);

    return new Response(
      JSON.stringify({ output: details }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-notebook-details-v2:', error);

    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to generate notebook details'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function extractWebsiteContent(url: string): Promise<string> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;

    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Jina.ai request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.data?.content) {
      return data.data.content;
    } else if (data.content) {
      return data.content;
    } else {
      throw new Error('No content returned from Jina.ai');
    }
  } catch (error) {
    console.error('Error fetching website content:', error);
    throw new Error(`Failed to fetch website content: ${error.message}`);
  }
}

async function extractTextFromFile(
  supabase: any,
  filePath: string,
  openai: OpenAI
): Promise<string> {
  try {
    const { data: signedUrlData, error: signError } = await supabase
      .storage
      .from('sources')
      .createSignedUrl(filePath, 60);

    if (signError || !signedUrlData?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${signError?.message}`);
    }

    console.log('Downloading file from signed URL');
    const fileResponse = await fetch(signedUrlData.signedUrl);

    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }

    const contentType = fileResponse.headers.get('content-type') || '';
    console.log('File content type:', contentType);

    if (contentType.includes('application/pdf')) {
      return await extractPdfText(fileResponse);
    } else if (contentType.includes('audio/')) {
      return await transcribeAudio(openai, fileResponse);
    } else if (contentType.includes('text/')) {
      return await fileResponse.text();
    } else {
      const text = await fileResponse.text();
      if (text && text.trim().length > 0) {
        return text;
      }
      throw new Error(`Unsupported file type: ${contentType}`);
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

async function extractPdfText(fileResponse: Response): Promise<string> {
  try {
    const arrayBuffer = await fileResponse.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const text = new TextDecoder().decode(uint8Array);

    const cleanText = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length < 100) {
      throw new Error('PDF appears to be empty or unreadable');
    }

    return cleanText;
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    throw new Error('PDF text extraction failed. This PDF may contain only images or be encrypted.');
  }
}

async function transcribeAudio(openai: OpenAI, fileResponse: Response): Promise<string> {
  try {
    const blob = await fileResponse.blob();
    const file = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });

    console.log('Transcribing audio with OpenAI Whisper...');
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
    });

    return transcription.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error(`Audio transcription failed: ${error.message}`);
  }
}

async function generateNotebookDetails(
  openai: OpenAI,
  extractedText: string
): Promise<NotebookDetailsResponse> {
  const prompt = `Based on the data provided, output an appropriate title and summary of the document.

Also output an appropriate UTF-8 emoji for the notebook - example: 🏆
And output an appropriate color from this list:

slate, gray, zinc, neutral, stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue, indigo, violet, purple, fuchsia, pink, rose

Also output a list of 5 Example Questions that could be asked of this document. For example "How are the rules and regulations of tennis enforced?" - Maximum 10 words each

Only output in JSON format with this exact structure:
{
  "title": "...",
  "summary": "...",
  "notebook_icon": "...",
  "background_color": "...",
  "example_questions": ["...", "...", "...", "...", "..."]
}

Document content:
${extractedText}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates structured metadata for documents. Always respond with valid JSON only, no additional text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response from OpenAI');
    }

    console.log('LLM raw response:', responseText);

    const parsed = JSON.parse(responseText);

    const details: NotebookDetailsResponse = {
      title: parsed.title || 'Untitled Notebook',
      summary: parsed.summary || 'No summary available',
      notebook_icon: parsed.notebook_icon || '📝',
      background_color: parsed.background_color || 'slate',
      example_questions: Array.isArray(parsed.example_questions)
        ? parsed.example_questions.slice(0, 5)
        : []
    };

    return details;
  } catch (error) {
    console.error('Error generating notebook details:', error);

    return {
      title: 'Error Generating Title',
      summary: 'Failed to generate summary',
      notebook_icon: '📄',
      background_color: 'gray',
      example_questions: []
    };
  }
}
