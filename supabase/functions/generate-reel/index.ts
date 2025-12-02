import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoId } = await req.json();
    console.log('Generating reel for video:', videoId);

    if (!videoId) {
      throw new Error('videoId is required');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch video data
    const { data: video, error: fetchError } = await supabaseClient
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (fetchError || !video) {
      throw new Error('Video not found: ' + fetchError?.message);
    }

    console.log('Video data:', video);

    // Update status to PROCESSING
    await supabaseClient
      .from('videos')
      .update({ status: 'PROCESSING' })
      .eq('id', videoId);

    // Step 1: Generate script using Lovable AI (Gemini 2.5 Flash)
    console.log('Generating script with AI...');
    const scriptPrompt = `Generate a ${video.duration}-second ${video.style} reel script about "${video.topic}". 
    
Requirements:
- Create 5-7 short, punchy lines (each line should be 1-2 sentences max)
- Each line should be impactful and engaging
- Style: ${video.style}
- Format: Return each line on a new line, no numbering
- Keep it concise for a ${video.duration}-second video
- Make it viral-worthy and attention-grabbing`;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: scriptPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API Error:', aiResponse.status, errorText);
      throw new Error('Failed to generate script: ' + errorText);
    }

    const aiData = await aiResponse.json();
    const script = aiData.choices?.[0]?.message?.content;

    if (!script) {
      throw new Error('No script generated from AI');
    }

    console.log('Generated script:', script);

    // Step 2: Fetch video from Pexels
    console.log('Fetching stock footage from Pexels...');
    const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY');
    if (!PEXELS_API_KEY) {
      throw new Error('PEXELS_API_KEY not configured');
    }

    // Search for videos matching the topic
    const pexelsResponse = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(video.topic)}&orientation=portrait&per_page=5`,
      {
        headers: {
          'Authorization': PEXELS_API_KEY,
        },
      }
    );

    if (!pexelsResponse.ok) {
      console.error('Pexels API Error:', pexelsResponse.status);
      throw new Error('Failed to fetch Pexels videos');
    }

    const pexelsData = await pexelsResponse.json();
    console.log('Pexels response:', JSON.stringify(pexelsData).slice(0, 200));

    let videoUrl = null;

    // Try to get a video file
    if (pexelsData.videos && pexelsData.videos.length > 0) {
      const video = pexelsData.videos[0];
      // Get the highest quality vertical video file
      const videoFiles = video.video_files.filter((file: any) =>
        file.width && file.height && file.height > file.width
      );

      if (videoFiles.length > 0) {
        // Sort by quality and get the best one
        videoFiles.sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height));
        videoUrl = videoFiles[0].link;
        console.log('Using Pexels video:', videoUrl);
      }
    }
    // Step 3: Generate TTS audio using ElevenLabs
    console.log('Generating voiceover audio...');
    let audioContent = null;
    
    try {
      const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
      
      if (ELEVENLABS_API_KEY) {
        const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          }),
        });

        if (ttsResponse.ok) {
          // Convert to base64 in chunks to avoid stack overflow
          const audioBuffer = await ttsResponse.arrayBuffer();
          const bytes = new Uint8Array(audioBuffer);
          let binary = '';
          const chunkSize = 8192;
          
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          
          audioContent = `data:audio/mpeg;base64,${btoa(binary)}`;
          console.log('Audio generated successfully');
        } else {
          const errorText = await ttsResponse.text();
          console.log('TTS API error:', ttsResponse.status, errorText);
        }
      } else {
        console.log('No ELEVENLABS_API_KEY found, skipping audio generation');
      }
    } catch (audioError) {
      console.error('Audio generation failed:', audioError);
      // Continue without audio
    }

    // Step 4: Update database with all generated content
    console.log('Saving to database...');
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        script: script,
        video_url: videoUrl,
        audio_content: audioContent,
        status: 'COMPLETED'
      })
      .eq('id', videoId);

    if (updateError) {
      throw new Error('Failed to update video: ' + updateError.message);
    }

    console.log('Video generation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Video generated successfully',
        videoId,
        hasAudio: !!audioContent
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in generate-reel function:', error);

    // Try to update video status to FAILED
    if (error instanceof Error) {
      try {
        const { videoId } = await req.json();
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabaseClient
          .from('videos')
          .update({
            status: 'FAILED',
            error_message: error.message
          })
          .eq('id', videoId);
      } catch (updateError) {
        console.error('Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});