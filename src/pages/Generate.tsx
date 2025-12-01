import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const Generate = () => {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("30");
  const [style, setStyle] = useState("motivational");
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }

    setGenerating(true);
    try {
      // Create video record
      const { data: video, error: insertError } = await supabase
        .from('videos')
        .insert({
          topic: topic.trim(),
          duration: parseInt(duration),
          style,
          status: 'PENDING'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to generate video
      const { error: functionError } = await supabase.functions.invoke('generate-reel', {
        body: { videoId: video.id }
      });

      if (functionError) throw functionError;

      toast.success("Video generation started!");
      navigate(`/result/${video.id}`);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error('Failed to start generation: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

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
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center gap-3">
            <Sparkles className="w-10 h-10" />
            Generate AI Reel
          </h1>
          <p className="text-white/90 text-lg">
            Create a stunning vertical video in seconds
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="bg-card rounded-2xl p-8 shadow-card border border-border">
            <div className="space-y-6">
              {/* Topic Input */}
              <div className="space-y-2">
                <Label htmlFor="topic" className="text-lg font-semibold">
                  Topic
                </Label>
                <Input
                  id="topic"
                  placeholder="E.g., 'Success mindset tips' or 'Morning routine ideas'"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="h-12 text-lg"
                  disabled={generating}
                />
                <p className="text-sm text-muted-foreground">
                  What should your reel be about?
                </p>
              </div>

              {/* Duration Select */}
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-lg font-semibold">
                  Duration
                </Label>
                <Select value={duration} onValueChange={setDuration} disabled={generating}>
                  <SelectTrigger id="duration" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">60 seconds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Style Select */}
              <div className="space-y-2">
                <Label htmlFor="style" className="text-lg font-semibold">
                  Style
                </Label>
                <Select value={style} onValueChange={setStyle} disabled={generating}>
                  <SelectTrigger id="style" className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motivational">Motivational</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="emotional">Emotional</SelectItem>
                    <SelectItem value="facts">Facts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={generating}
                size="lg"
                className="w-full bg-gradient-primary hover:opacity-90 text-white shadow-glow h-14 text-lg font-semibold"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generate Reel
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <div className="mt-8 p-6 bg-muted rounded-xl border border-border">
            <h3 className="font-semibold mb-2">How it works:</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>AI generates a compelling script based on your topic</li>
              <li>Stock footage is automatically selected from Pexels</li>
              <li>Video is rendered with animated subtitles overlay</li>
              <li>Your vertical reel is ready to download and share!</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generate;