import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { Play, Clock, Tag, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "./ui/button";

interface VideoCardProps {
  video: {
    id: string;
    topic: string;
    duration: number;
    style: string;
    status: string;
    video_url: string | null;
    created_at: string;
  };
  onDelete: (id: string) => void;
}

export const VideoCard = ({ video, onDelete }: VideoCardProps) => {
  const navigate = useNavigate();

  // Helper to get the first video URL if it's a JSON array
  const getVideoSrc = (url: string | null) => {
    if (!url) return undefined;
    try {
      const parsed = JSON.parse(url);
      return Array.isArray(parsed) ? parsed[0] : url;
    } catch {
      return url;
    }
  };

  const videoSrc = getVideoSrc(video.video_url);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this video?")) {
      onDelete(video.id);
    }
  };

  return (
    <Card
      onClick={() => navigate(`/result/${video.id}`)}
      className="group cursor-pointer overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 bg-card relative"
    >
      <CardContent className="p-0">
        {/* Thumbnail */}
        <div className="relative aspect-[9/16] bg-gradient-subtle overflow-hidden">
          {videoSrc && video.status === 'COMPLETED' ? (
            <video
              src={videoSrc}
              className="w-full h-full object-cover"
              muted
              playsInline
              onMouseOver={(e) => e.currentTarget.play()}
              onMouseOut={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-primary">
              <Play className="w-16 h-16 text-white/80" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <StatusBadge status={video.status} />
          </div>

          {/* Delete Button - Always visible on top left */}
          <div className="absolute top-3 left-3 z-10">
            <Button
              variant="destructive"
              size="icon"
              className="h-8 w-8 rounded-full shadow-lg opacity-90 hover:opacity-100 transition-opacity"
              onClick={handleDelete}
              title="Delete Video"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Play Button on Hover */}
          {video.status === 'COMPLETED' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {video.topic}
          </h3>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{video.duration}s</span>
            </div>
            <div className="flex items-center gap-1">
              <Tag className="w-4 h-4" />
              <span className="capitalize">{video.style}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(video.created_at), { addSuffix: true })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};