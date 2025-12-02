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
        videoUrls: string | string[],
        audioBase64: string | null,
        script: string,
        duration: number,
        onProgress: (progress: number) => void
    ): Promise<Blob> {
        if (!this.loaded) await this.load();

        const ffmpeg = this.ffmpeg;
        const urls = Array.isArray(videoUrls) ? videoUrls : [videoUrls];

        // Write video files
        const inputFiles: string[] = [];
        for (let i = 0; i < urls.length; i++) {
            const fileName = `input${i}.mp4`;
            const videoData = await fetchFile(urls[i]);
            await ffmpeg.writeFile(fileName, videoData);
            inputFiles.push(fileName);
        }

        // Write audio file if exists
        let hasAudio = false;
        if (audioBase64) {
            const audioData = await fetchFile(audioBase64);
            await ffmpeg.writeFile('input.mp3', audioData);
            hasAudio = true;
        }

        // Create subtitles/text overlay
        const lines = script.split('\n').filter(line => line.trim());

        // Calculate duration per line based on word count
        const totalWords = lines.reduce((acc, line) => acc + line.split(' ').length, 0);
        let currentTime = 0;

        // Load font
        const fontUrl = 'https://raw.githubusercontent.com/ffmpegwasm/testdata/master/arial.ttf';
        const fontData = await fetchFile(fontUrl);
        await ffmpeg.writeFile('arial.ttf', fontData);

        // Build drawtext filters
        const textFilters = lines.map((line) => {
            const words = line.split(' ').length;
            const lineDuration = (words / totalWords) * duration;
            const startTime = currentTime;
            const endTime = currentTime + lineDuration;
            currentTime = endTime;

            // Escape single quotes and colons
            const safeLine = line.replace(/'/g, "\\'").replace(/:/g, "\\:");

            // Split long lines into two if needed (simple heuristic)
            // For now, let's just use the simple drawtext. 
            // Ideally we would use a more complex filter for wrapping, but drawtext doesn't wrap automatically.
            // We'll rely on the script generation to keep lines short.

            return `drawtext=fontfile=arial.ttf:text='${safeLine}':fontcolor=white:fontsize=48:box=1:boxcolor=black@0.5:boxborderw=5:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,${startTime},${endTime})'`;
        }).join(',');

        ffmpeg.on('progress', ({ progress }) => {
            onProgress(progress);
        });

        // Construct command
        const args: string[] = [];
        let filterComplex = '';

        // Input all video files
        inputFiles.forEach(file => {
            args.push('-i', file);
        });

        if (hasAudio) {
            args.push('-i', 'input.mp3');
        }

        // Build filter complex for concatenation and scaling
        // Scale all inputs to 1080x1920 and concat
        inputFiles.forEach((_, i) => {
            filterComplex += `[${i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v${i}];`;
        });

        inputFiles.forEach((_, i) => {
            filterComplex += `[v${i}]`;
        });

        filterComplex += `concat=n=${inputFiles.length}:v=1:a=0[vbase];`;

        // Apply text overlay to the concatenated video
        filterComplex += `[vbase]${textFilters}[vout]`;

        args.push('-filter_complex', filterComplex);

        // Map output
        args.push('-map', '[vout]');
        if (hasAudio) {
            // Map audio from the last input (which is the audio file)
            args.push('-map', `${inputFiles.length}:a`);
            // Cut video to audio length
            args.push('-shortest');
        }

        args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', 'output.mp4');

        await ffmpeg.exec(args);

        const data = await ffmpeg.readFile('output.mp4');
        const blobData = data instanceof Uint8Array ? data : new Uint8Array();
        return new Blob([blobData] as BlobPart[], { type: 'video/mp4' });
    }
}

export const ffmpegService = new FFmpegService();
