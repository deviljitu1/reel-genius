import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Download, Loader2, AlertCircle, Edit2, Save, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { ffmpegService } from "@/lib/ffmpeg";
import { Progress } from "@/components/ui/progress";

interface Video {
  id: string;
  topic: string;
  duration: number;
  style: string;
  status: string;
  script: string | null;
  video_url: string | null;
  audio_content: string | null;
  error_message: string | null;
  created_at: string;
}

const Result = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit & Render State
  const [isEditing, setIsEditing] = useState(false);
  const [editedScript, setEditedScript] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!id) return;

    fetchVideo();

    // Set up real-time subscription
    const channel = supabase
      .channel(`video-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${id}`
        },
        (payload) => {
          const newVideo = payload.new as Video;
          setVideo(newVideo);
          if (newVideo.script && !editedScript) {
            setEditedScript(newVideo.script);
          }

          if (payload.new.status === 'COMPLETED') {
            toast.success('Your reel is ready!');
          } else if (payload.new.status === 'FAILED') {
            toast.error('Video generation failed');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchVideo = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setVideo(data);
      if (data.script) {
        setEditedScript(data.script);
      }
    } catch (error: any) {
      toast.error('Failed to load video: ' + error.message);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        if (audioRef.current) audioRef.current.pause();
      } else {
        videoRef.current.play();
        if (audioRef.current) {
          audioRef.current.currentTime = videoRef.current.currentTime;
          audioRef.current.play();
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleRender = async () => {
    if (!video?.video_url || !editedScript) return;

    setIsRendering(true);
    setRenderProgress(0);

    try {
      let videoSource: string | string[] = video.video_url;
      try {
        const parsed = JSON.parse(video.video_url);
        if (Array.isArray(parsed)) {
          videoSource = parsed;
        }
      } catch (e) {
        // Not a JSON array, treat as single URL
      }

      const blob = await ffmpegService.renderVideo(
        videoSource,
        video.audio_content,
        editedScript,
        video.duration,
        (progress) => setRenderProgress(Math.round(progress * 100))
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reel-${video.topic.replace(/\s+/g, '-').toLowerCase()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Video rendered and downloaded!");
    } catch (error: any) {
      console.error("Rendering error:", error);
      toast.error("Failed to render video: " + error.message);
    } finally {
      setIsRendering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Video not found</h2>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
        <div className="relative container mx-auto px-4 py-12">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="text-white hover:bg-white/10 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              {video.topic}
            </h1>
            <StatusBadge status={video.status} />
          </div>
          <p className="text-white/90">
            {video.style} • {video.duration}s
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left Column: Video Preview */}
          <div className="space-y-6">
            {(video.status === 'PENDING' || video.status === 'PROCESSING') ? (
              <div className="bg-card rounded-2xl p-12 text-center shadow-card border border-border aspect-[9/16] flex flex-col items-center justify-center">
                <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
                <h2 className="text-2xl font-bold mb-2">
                  {video.status === 'PENDING' ? 'Queued...' : 'Generating your reel...'}
                </h2>
                <p className="text-muted-foreground mb-6">
                  This usually takes 30-60 seconds. Please wait...
                </p>
              </div>
            ) : video.status === 'FAILED' ? (
              <div className="bg-card rounded-2xl p-12 text-center shadow-card border border-destructive aspect-[9/16] flex flex-col items-center justify-center">
                <AlertCircle className="w-16 h-16 mx-auto mb-6 text-destructive" />
                <h2 className="text-2xl font-bold mb-2">Generation Failed</h2>
                <p className="text-muted-foreground mb-6">
                  {video.error_message || 'Something went wrong during video generation'}
                </p>
                <Button onClick={() => navigate('/generate')}>Try Again</Button>
              </div>
            ) : (
              <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl aspect-[9/16] max-w-sm mx-auto">
                {video.video_url ? (
                  <>
                    <video
                      ref={videoRef}
                      src={(() => {
                        try {
                          const parsed = JSON.parse(video.video_url);
                          return Array.isArray(parsed) ? parsed[0] : video.video_url;
                        } catch {
                          return video.video_url;
                        }
                      })()}
                      className="w-full h-full object-cover"
                      playsInline
                      onEnded={handleVideoEnded}
                      onClick={handlePlayPause}
                    />
                    {/* Text Overlay Preview */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
                      <p className="text-white text-3xl font-bold text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]" style={{ textShadow: '2px 2px 4px black' }}>
                        {/* Simple preview: show first line or all lines? Let's show all for now or just a placeholder if it's too long. 
                                        Actually, let's just show the raw script for now as a static overlay to verify position.
                                        In a real player we'd sync it. For now, static center.
                                    */}
                        {editedScript.split('\n')[0]}
                      </p>
                    </div>

                    {/* Play Button Overlay */}
                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer" onClick={handlePlayPause}>
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </div>
                    )}

                    {/* Audio Element (Hidden) */}
                    {video.audio_content && (
                      <audio ref={audioRef} src={video.audio_content} />
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    No video URL
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Controls & Script */}
          <div className="space-y-6">
            {video.status === 'COMPLETED' && (
              <>
                <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Script & Audio</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(!isEditing)}
                    >
                      {isEditing ? <Save className="w-4 h-4 mr-2" /> : <Edit2 className="w-4 h-4 mr-2" />}
                      {isEditing ? 'Done Editing' : 'Edit Text'}
                    </Button>
                  </div>

                  {isEditing ? (
                    <Textarea
                      value={editedScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      className="min-h-[300px] text-lg font-medium"
                      placeholder="Enter your script here..."
                    />
                  ) : (
                    <div className="prose prose-invert max-w-none bg-muted p-6 rounded-xl">
                      <pre className="whitespace-pre-wrap font-sans text-lg text-foreground">
                        {editedScript}
                      </pre>
                    </div>
                  )}

                  {video.audio_content ? (
                    <div className="mt-4 p-4 bg-green-500/10 text-green-500 rounded-lg flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      AI Voiceover Generated
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-yellow-500/10 text-yellow-500 rounded-lg">
                      No audio generated (Check API Key)
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
                  <h2 className="text-2xl font-bold mb-4">Download Reel</h2>
                  <p className="text-muted-foreground mb-6">
                    Render the final video with your text overlay and AI voiceover.
                  </p>

                  {isRendering && (
                    <div className="mb-6 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Rendering...</span>
                        <span>{renderProgress}%</span>
                      </div>
                      <Progress value={renderProgress} className="h-2" />
                    </div>
                  )}

                  <Button
                    onClick={handleRender}
                    size="lg"
                    className="w-full bg-gradient-primary hover:opacity-90 text-white shadow-glow h-14 text-lg font-semibold"
                    disabled={isRendering}
                  >
                    {isRendering ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Rendering Video...
                      </>
                    ) : (
                      <>
                        <Download className="w-5 h-5 mr-2" />
                        Render & Download
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Result;