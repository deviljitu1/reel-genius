import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export class FFmpegService {
    private ffmpeg: FFmpeg;
    private loaded: boolean = false;

    constructor() {
        this.ffmpeg = new FFmpeg();
    }

    async load() {
        if (this.loaded) return;

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.loaded = true;
    }

    async renderVideo(
        videoUrl: string,
        audioBase64: string | null,
        script: string,
        duration: number,
        onProgress: (progress: number) => void
    ): Promise<Blob> {
        if (!this.loaded) await this.load();

        const ffmpeg = this.ffmpeg;

        // Write video file
        const videoData = await fetchFile(videoUrl);
        await ffmpeg.writeFile('input.mp4', videoData);

        // Write audio file if exists
        let hasAudio = false;
        if (audioBase64) {
            const audioData = await fetchFile(audioBase64);
            await ffmpeg.writeFile('input.mp3', audioData);
            hasAudio = true;
        }

        // Create subtitles/text overlay
        // For MVP, we'll split the script into lines and show them sequentially
        const lines = script.split('\n').filter(line => line.trim());
        const durationPerLine = duration / lines.length;

        // Create a complex filter for drawtext
        // We need to load a font. For simplicity, we'll try to use a default or download one.
        // Actually, let's use a simple SRT file approach first as it's cleaner if supported,
        // but drawtext is more reliable without font config issues if we use default sans.
        // However, wasm ffmpeg often needs a font file.
        // Let's try to load a font from a CDN.
        const fontUrl = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf';
        const fontData = await fetchFile(fontUrl);
        await ffmpeg.writeFile('arial.ttf', fontData);

        // Build drawtext filters
        const filters = lines.map((line, index) => {
            const startTime = index * durationPerLine;
            const endTime = (index + 1) * durationPerLine;
            // Escape single quotes and colons
            const safeLine = line.replace(/'/g, "\\'").replace(/:/g, "\\:");

            return `drawtext=fontfile=arial.ttf:text='${safeLine}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startTime},${endTime})'`;
        }).join(',');

        ffmpeg.on('progress', ({ progress }) => {
            onProgress(progress);
        });

        // Construct command
        // -i input.mp4 [-i input.mp3] -vf "filters" -c:v libx264 -preset ultrafast -c:a aac output.mp4
        const args = ['-i', 'input.mp4'];
        if (hasAudio) {
            args.push('-i', 'input.mp3');
        }

        args.push('-vf', filters);

        // Map audio if present, otherwise just video
        if (hasAudio) {
            // If video has audio, we might want to replace it or mix it. 
            // For now, let's assume we replace it or just map the new audio.
            // -map 0:v -map 1:a (use video from 0, audio from 1)
            args.push('-map', '0:v', '-map', '1:a');
            // Shortest to cut video to audio length or vice versa? 
            // Usually we want video length.
            args.push('-shortest');
        }

        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4');

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile('output.mp4');
        return new Blob([data], { type: 'video/mp4' });
    }
}

export const ffmpegService = new FFmpegService();
