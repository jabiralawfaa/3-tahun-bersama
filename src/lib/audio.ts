/**
 * lib/audio.ts
 * ------------------------------------------------------------------
 * Client-side audio compression & validation utilities.
 * Uses Web Audio API + MediaRecorder for compression.
 * ------------------------------------------------------------------
 */

export interface AudioCompressionOptions {
  /** Target bitrate in kbps (default: 128) */
  bitrate?: number;
  /** Target sample rate (default: 44100) */
  sampleRate?: number;
  /** Number of channels (1 = mono, 2 = stereo) */
  channels?: number;
  /** Max file size in bytes (default: 4MB for Vercel) */
  maxSize?: number;
}

export interface CompressionResult {
  /** Compressed audio blob */
  blob: Blob;
  /** Original size in bytes */
  originalSize: number;
  /** Compressed size in bytes */
  compressedSize: number;
  /** Compression ratio */
  ratio: number;
  /** Duration in seconds */
  duration: number;
  /** Whether compression was applied (false if already small enough) */
  compressed: boolean;
}

/** Default compression options for Vercel deployment */
export const DEFAULT_COMPRESSION_OPTIONS: Required<AudioCompressionOptions> = {
  bitrate: 128_000, // 128 kbps
  sampleRate: 44100,
  channels: 1, // mono saves ~50%
  maxSize: 3 * 1024 * 1024, // 3MB - auto compress above this
};

/**
 * Check if audio file is within size limits.
 * Returns null if OK, or error message if too large.
 */
export function validateAudioSize(file: File, maxSize = DEFAULT_COMPRESSION_OPTIONS.maxSize): string | null {
  if (file.size <= maxSize) return null;
  const mb = (file.size / (1024 * 1024)).toFixed(1);
  const maxMb = (maxSize / (1024 * 1024)).toFixed(1);
  return `File audio terlalu besar (${mb} MB). Maksimal ${maxMb} MB. Silakan kompres atau potong durasi lagu.`;
}

/**
 * Compress audio file using Web Audio API + MediaRecorder.
 * Falls back to original file if compression fails or not supported.
 */
export async function compressAudio(
  file: File,
  options: AudioCompressionOptions = {}
): Promise<CompressionResult> {
  const opts = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };

  // Already small enough, no compression needed
  if (file.size <= opts.maxSize) {
    return {
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      ratio: 1,
      duration: await getAudioDuration(file),
      compressed: false,
    };
  }

  try {
    const compressedBlob = await compressWithWebAudio(file, opts);
    const compressedSize = compressedBlob.size;

    // If still too large after compression, return anyway (caller will handle warning)
    return {
      blob: compressedBlob,
      originalSize: file.size,
      compressedSize,
      ratio: compressedSize / file.size,
      duration: await getAudioDuration(file),
      compressed: true,
    };
  } catch (error) {
    console.warn("Audio compression failed, using original:", error);
    // Return original file on failure
    return {
      blob: file,
      originalSize: file.size,
      compressedSize: file.size,
      ratio: 1,
      duration: await getAudioDuration(file),
      compressed: false,
    };
  }
}

/** Get audio duration in seconds */
function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    });
    audio.addEventListener("error", () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });
    audio.src = url;
  });
}

/** Compress using Web Audio API (decode -> process -> MediaRecorder) */
async function compressWithWebAudio(file: File, opts: Required<AudioCompressionOptions>): Promise<Blob> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Create offline audio context for processing
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: opts.sampleRate,
  });

  // Decode audio data
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Create mono version if needed
  let processedBuffer: AudioBuffer;
  if (opts.channels === 1 && audioBuffer.numberOfChannels > 1) {
    processedBuffer = audioContext.createBuffer(1, audioBuffer.length, opts.sampleRate);
    // Mix down to mono
    const inputL = audioBuffer.getChannelData(0);
    const inputR = audioBuffer.getChannelData(1);
    const output = processedBuffer.getChannelData(0);
    for (let i = 0; i < audioBuffer.length; i++) {
      output[i] = (inputL[i] + (inputR[i] || 0)) / 2;
    }
  } else if (opts.channels === 2 && audioBuffer.numberOfChannels === 1) {
    // Up-mix mono to stereo
    processedBuffer = audioContext.createBuffer(2, audioBuffer.length, opts.sampleRate);
    const input = audioBuffer.getChannelData(0);
    processedBuffer.getChannelData(0).set(input);
    processedBuffer.getChannelData(1).set(input);
  } else {
    processedBuffer = audioBuffer;
  }

  // Use OfflineAudioContext to render at target sample rate
  const offlineContext = new OfflineAudioContext(
    opts.channels,
    processedBuffer.length,
    opts.sampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = processedBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  const renderedBuffer = await offlineContext.startRendering();

  // Convert to WAV (uncompressed) then use MediaRecorder for compressed output
  // Note: MediaRecorder in browser typically outputs WebM/Opus, not MP3
  // For MP3 we'd need lamejs, but WebM/Opus is widely supported
  const wavBlob = audioBufferToWav(renderedBuffer);
  
  // Use MediaRecorder to compress to Opus (WebM)
  return await compressWithMediaRecorder(wavBlob, opts.bitrate);
}

/** Convert AudioBuffer to WAV Blob */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2; // 16-bit = 2 bytes
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM format chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, length, true);

  // Write PCM data
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Compress WAV to Opus/WebM using MediaRecorder */
async function compressWithMediaRecorder(wavBlob: Blob, targetBitrate: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const audioBuffer = await audioContext.decodeAudioData(reader.result as ArrayBuffer);
        
        // Create a stream destination for MediaRecorder
        const dest = audioContext.createMediaStreamDestination();
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(dest);
        source.connect(audioContext.destination); // for monitoring if needed
        source.start(0);

        const mediaRecorder = new MediaRecorder(dest.stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: targetBitrate,
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
          resolve(blob);
        };

        mediaRecorder.onerror = (e) => reject(e.error);

        mediaRecorder.start();
        
        // Stop after audio finishes playing
        source.onended = () => {
          setTimeout(() => mediaRecorder.stop(), 100);
        };
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read WAV blob"));
    reader.readAsArrayBuffer(wavBlob);
  });
}

/** Format bytes to human readable string */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format duration to mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}