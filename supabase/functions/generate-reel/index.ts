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

    // If no suitable video found, throw error
    if (!videoUrl) {
      throw new Error('No suitable vertical video found on Pexels for this topic. Try a different topic.');
    }

    // Step 3: Update video record with script and video URL
    // Note: In a full implementation, this is where ffmpeg would render a custom video
    // For MVP, we're using the Pexels video directly with the AI-generated script
    const { error: updateError } = await supabaseClient
      .from('videos')
      .update({
        status: 'COMPLETED',
        script: script,
        video_url: videoUrl,
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
        videoId 
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