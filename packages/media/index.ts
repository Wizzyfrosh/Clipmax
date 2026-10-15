import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { z } from "zod";
export async function command(
  bin: string,
  args: string[],
  signal?: AbortSignal,
  timeout = 300000,
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(bin, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      signal,
    });
    let output = "",
      error = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Error("MEDIA_TIMEOUT"));
    }, timeout);
    child.stdout.on("data", (b) => {
      output += b.toString();
      if (output.length > 2_000_000) {
        child.kill("SIGKILL");
        reject(Error("MEDIA_OUTPUT_LIMIT"));
      }
    });
    child.stderr.on("data", (b) => {
      error = (error + b.toString()).slice(-4000);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output);
      else reject(Error(`MEDIA_FAILED_${code}: ${error.slice(-300)}`));
    });
  });
}
export async function probe(
  path: string,
  signal?: AbortSignal,
  minDuration = 120000,
) {
  if ((await stat(path)).size > 500_000_000) throw Error("VIDEO_TOO_LARGE");
  const raw = JSON.parse(
    await command(
      "ffprobe",
      [
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-show_streams",
        "-show_format",
        "-of",
        "json",
        path,
      ],
      signal,
      30000,
    ),
  );
  const meta = z
    .object({
      streams: z.array(
        z.object({
          codec_type: z.string(),
          codec_name: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          avg_frame_rate: z.string().optional(),
        }),
      ),
      format: z.object({ duration: z.string(), format_name: z.string() }),
    })
    .parse(raw);
  const video = meta.streams.find((s) => s.codec_type === "video"),
    audio = meta.streams.find((s) => s.codec_type === "audio");
  const durationMs = Math.round(Number(meta.format.duration) * 1000);
  const [n, d] = (video?.avg_frame_rate ?? "0/1").split("/").map(Number);
  const fps = n / d;
  if (
    !video ||
    !audio ||
    !["h264", "hevc", "mpeg4"].includes(video.codec_name ?? "") ||
    !["aac", "mp3", "pcm_s16le"].includes(audio.codec_name ?? "")
  )
    throw Error("UNSUPPORTED_MEDIA");
  if (
    !meta.format.format_name.split(",").some((n) => ["mov", "mp4"].includes(n))
  )
    throw Error("UNSUPPORTED_CONTAINER");
  if (
    !Number.isFinite(durationMs) ||
    durationMs < minDuration ||
    durationMs > 1800000
  )
    throw Error("INVALID_DURATION");
  if (
    !video.width ||
    !video.height ||
    Math.max(video.width, video.height) > 1920 ||
    Math.min(video.width, video.height) > 1080 ||
    !Number.isFinite(fps) ||
    fps <= 0 ||
    fps > 60
  )
    throw Error("UNSUPPORTED_RESOLUTION");
  return { durationMs, width: video.width, height: video.height };
}
export async function extract(
  source: string,
  audio: string,
  signal?: AbortSignal,
) {
  await command(
    "ffmpeg",
    [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-i",
      source,
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "48k",
      audio,
    ],
    signal,
  );
}
export async function render(
  source: string,
  path: string,
  startMs: number,
  endMs: number,
  layout: string,
  signal?: AbortSignal,
) {
  if (
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    startMs < 0 ||
    endMs <= startMs ||
    endMs - startMs > 60000
  )
    throw Error("INVALID_RANGE");
  const scale =
    layout === "vertical"
      ? "scale=w='min(iw,404)':h='min(ih,720)':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=404:720:(ow-iw)/2:(oh-ih)/2:color=0x180e21,setsar=1"
      : "scale=w='min(iw,1280)':h='min(ih,720)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1";
  await command(
    "ffmpeg",
    [
      "-nostdin",
      "-y",
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-ss",
      String(startMs / 1000),
      "-i",
      source,
      "-t",
      String((endMs - startMs) / 1000),
      "-map",
      "0:v:0",
      "-map",
      "0:a:0",
      "-vf",
      scale,
      "-r",
      "30",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-threads",
      "2",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      path,
    ],
    signal,
  );
  const out = await probe(path, signal, 1);
  if (Math.abs(out.durationMs - (endMs - startMs)) > 1000)
    throw Error("OUTPUT_DURATION_MISMATCH");
}
