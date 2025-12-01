import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ArrowLeft, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  topic: string;
  duration: number;
  style: string;
  status: string;
  script: string | null;
  video_url: string | null;
  error_message: string | null;
  created_at: string;
}

const Result = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

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
          setVideo(payload.new as Video);
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
    } catch (error: any) {
      toast.error('Failed to load video: ' + error.message);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (video?.video_url) {
      window.open(video.video_url, '_blank');
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
        <div className="max-w-4xl mx-auto">
          {/* Processing State */}
          {(video.status === 'PENDING' || video.status === 'PROCESSING') && (
            <div className="bg-card rounded-2xl p-12 text-center shadow-card border border-border">
              <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
              <h2 className="text-2xl font-bold mb-2">
                {video.status === 'PENDING' ? 'Queued...' : 'Generating your reel...'}
              </h2>
              <p className="text-muted-foreground mb-6">
                This usually takes 30-60 seconds. Please wait...
              </p>
              <div className="space-y-3 text-left max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm">Generating AI script</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm">Finding perfect stock footage</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm">Rendering video with subtitles</span>
                </div>
              </div>
            </div>
          )}

          {/* Failed State */}
          {video.status === 'FAILED' && (
            <div className="bg-card rounded-2xl p-12 text-center shadow-card border border-destructive">
              <AlertCircle className="w-16 h-16 mx-auto mb-6 text-destructive" />
              <h2 className="text-2xl font-bold mb-2">Generation Failed</h2>
              <p className="text-muted-foreground mb-6">
                {video.error_message || 'Something went wrong during video generation'}
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => navigate('/generate')}>
                  Try Again
                </Button>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  Back to Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Completed State */}
          {video.status === 'COMPLETED' && (
            <div className="space-y-8">
              {/* Video Player */}
              <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
                <h2 className="text-2xl font-bold mb-6">Your Reel</h2>
                {video.video_url ? (
                  <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-xl overflow-hidden">
                    <video
                      src={video.video_url}
                      controls
                      className="w-full h-full"
                      playsInline
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                ) : (
                  <div className="aspect-[9/16] max-w-sm mx-auto bg-muted rounded-xl flex items-center justify-center">
                    <p className="text-muted-foreground">Video URL not available</p>
                  </div>
                )}

                <div className="mt-8 flex justify-center">
                  <Button
                    onClick={handleDownload}
                    size="lg"
                    className="bg-gradient-primary hover:opacity-90 text-white shadow-glow"
                    disabled={!video.video_url}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download Video
                  </Button>
                </div>
              </div>

              {/* Script */}
              {video.script && (
                <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
                  <h3 className="text-xl font-bold mb-4">AI-Generated Script</h3>
                  <div className="prose prose-invert max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted p-4 rounded-lg">
                      {video.script}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Result;