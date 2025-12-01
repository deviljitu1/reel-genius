# AI Reel Video Generator

A full-stack web application that generates AI-powered vertical video reels (9:16 format) for social media platforms like TikTok, Instagram Reels, and YouTube Shorts.

## ✨ What's Implemented

### Frontend (React + Vite + TypeScript + Tailwind)
- **Landing Page**: Animated hero section with gradient backgrounds, feature showcase, and CTAs
- **Dashboard**: Grid view of all generated reels with real-time status updates
- **Generate Page**: Form to create new reels with topic, duration (15s/30s/60s), and style selection
- **Result Page**: Real-time video status tracking with video player and download button

### Backend (Lovable Cloud / Supabase)
- **Database**: PostgreSQL table for video tracking with status management
- **Edge Function**: `generate-reel` handles the complete generation workflow
- **Storage**: Public bucket for video file hosting
- **Real-time**: Live updates when video status changes

### AI Integration (Lovable AI)
- **Script Generation**: Uses Google Gemini 2.5 Flash to create engaging, punchy scripts
- **Smart Prompting**: Generates scripts optimized for the selected style and duration

### Stock Footage (Pexels API)
- **Automatic Selection**: Fetches relevant vertical (portrait) videos from Pexels
- **Quality Sorting**: Selects the highest quality vertical video available
- **Free Tier**: Uses Pexels free API (no payment required)

## 🎨 Design System

The app features a bold, vibrant design inspired by modern video platforms:
- **Colors**: Electric purple-pink gradients, deep navy backgrounds
- **Animations**: Smooth fade-ins, gradient animations, pulse effects
- **Typography**: Bold headings with clean body text
- **Components**: Glass-morphic cards, status badges with animations

## 📋 Current MVP Implementation

The current version implements a **functional demo** that:
1. ✅ Accepts user input (topic, duration, style)
2. ✅ Generates AI scripts using Gemini 2.5 Flash
3. ✅ Fetches stock footage from Pexels
4. ✅ Stores results in database
5. ✅ Provides real-time status updates
6. ⚠️ Uses Pexels video directly (not custom-rendered)

## 🚀 What's Next: Full Video Rendering

To implement complete custom video rendering with ffmpeg, you'll need:

### Option 1: External Video Processing Service
The most robust solution for production:
- **Service**: Use a dedicated video processing service (e.g., AWS Lambda with FFmpeg layer, Cloudflare Workers, or a custom Node.js server)
- **Workflow**:
  1. Edge function triggers external service
  2. Service downloads Pexels clips
  3. Renders video with ffmpeg (add subtitles, transitions, music)
  4. Uploads to Supabase Storage
  5. Updates database with final URL

### Option 2: Deno + FFmpeg (Advanced)
Requires custom Deno Deploy setup with FFmpeg binary:
- Compile FFmpeg for Deno Deploy environment
- Implement video processing in Edge Functions
- Handle memory/timeout limitations
- This is complex and has significant constraints

### Video Rendering Features to Add:
- **Subtitle Overlay**: Animated text captions synced to script lines
- **Transitions**: Smooth cuts between video clips
- **Background Music**: Public domain audio track
- **Custom Branding**: Intro/outro frames
- **Multi-clip Stitching**: Combine multiple Pexels clips
- **Image Fallback**: Ken Burns effect on static images when video unavailable

## 🛠️ Technical Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Backend**: Lovable Cloud (Supabase)
- **Database**: PostgreSQL with Row Level Security
- **AI**: Lovable AI (Google Gemini 2.5 Flash)
- **Storage**: Supabase Storage with public bucket
- **Real-time**: Supabase Realtime subscriptions
- **Stock Media**: Pexels API (free tier)

## 📦 Environment Variables

All secrets are managed through Lovable Cloud:
- `LOVABLE_API_KEY` - Auto-configured for AI generation
- `PEXELS_API_KEY` - Already configured
- `SUPABASE_*` - Auto-configured by Lovable Cloud

## 🚦 API Endpoints

### Edge Function: `generate-reel`
- **URL**: `${SUPABASE_URL}/functions/v1/generate-reel`
- **Method**: POST
- **Body**: `{ videoId: string }`
- **Auth**: Public (verify_jwt = false)
- **Process**:
  1. Updates status to PROCESSING
  2. Calls Lovable AI for script generation
  3. Fetches Pexels video footage
  4. Updates record with results

## 📊 Database Schema

### Table: `videos`
```sql
- id (UUID, primary key)
- topic (TEXT, not null)
- duration (INTEGER, 15/30/60)
- style (TEXT, motivational/business/emotional/facts)
- status (TEXT, PENDING/PROCESSING/COMPLETED/FAILED)
- script (TEXT, AI-generated)
- video_url (TEXT, final video URL)
- error_message (TEXT, if failed)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## 🎯 Usage Instructions

1. **Landing Page**: Click "Generate Your First Reel"
2. **Generate Form**: 
   - Enter a topic (e.g., "Morning routine tips")
   - Select duration (15s, 30s, or 60s)
   - Choose style (motivational, business, emotional, facts)
   - Click "Generate Reel"
3. **Processing**: Wait 30-60 seconds for generation
4. **Result Page**: View, download, and share your reel

## 🔐 Security Notes

- All tables have Row Level Security (RLS) enabled
- Public access policies for MVP (no authentication required)
- For production: Add user authentication and user-specific policies

## 🌟 Future Enhancements

1. **Authentication**: Google login with user accounts
2. **User Dashboard**: Personal video library
3. **Custom Rendering**: Full ffmpeg implementation
4. **Voice-over**: Text-to-speech integration (when paid API budget available)
5. **Templates**: Pre-made styles and effects
6. **Batch Generation**: Create multiple reels at once
7. **Analytics**: Track views and engagement
8. **Social Sharing**: Direct posting to platforms

## 📝 Notes

- Current implementation uses Pexels videos directly for MVP demo
- Full custom video rendering requires additional infrastructure
- All AI generation uses free Lovable AI credits
- Pexels API is free with attribution requirements
- No payment integration needed for this MVP

## 🤝 Contributing

This is a Lovable project. To make changes:
1. Use Lovable's chat interface to request modifications
2. All changes deploy automatically
3. Backend functions update immediately
4. Frontend requires clicking "Update" in publish dialog

---

Built with ❤️ using Lovable Cloud and AI