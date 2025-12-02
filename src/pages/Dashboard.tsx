import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/VideoCard";
import { Plus, Video } from "lucide-react";
import { toast } from "sonner";

interface Video {
  id: string;
  topic: string;
  duration: number;
  style: string;
  status: string;
  video_url: string | null;
  created_at: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos();

    // Set up real-time subscription for video status updates
    const channel = supabase
      .channel('videos')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'videos'
        },
        () => {
          fetchVideos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast.error('Failed to load videos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    try {
      // Use Edge Function to delete video (bypasses RLS if needed)
      const { error } = await supabase.functions.invoke('delete-video', {
        body: { videoId: id }
      });

      if (error) throw error;

      setVideos(videos.filter(v => v.id !== id));
      toast.success('Video deleted successfully');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Failed to delete video: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-primary">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-accent/20" />
        <div className="relative container mx-auto px-4 py-16">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center gap-3">
                <Video className="w-10 h-10" />
                My Reels
              </h1>
              <p className="text-white/90 text-lg">
                Generate AI-powered vertical videos in seconds
              </p>
            </div>
            <Button
              onClick={() => navigate('/generate')}
              size="lg"
              className="bg-white text-primary hover:bg-white/90 shadow-glow"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Reel
            </Button>
          </div>
        </div>
      </div>

      {/* Videos Grid */}
      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-card rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-20">
            <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-2xl font-semibold mb-2">No reels yet</h3>
            <p className="text-muted-foreground mb-6">
              Create your first AI-generated reel to get started
            </p>
            <Button onClick={() => navigate('/generate')} size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Generate First Reel
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onDelete={handleDeleteVideo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;