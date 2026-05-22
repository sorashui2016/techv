import { access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type VideoMediaInfo = {
  resolution?: string;
  width?: number;
  height?: number;
  codec?: string;
  durationSeconds?: number;
  error?: string;
};

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
};

type FfprobeOutput = {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
};

function parseDuration(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function readVideoMediaInfo(filePath?: string | null): Promise<VideoMediaInfo | null> {
  if (!filePath) return null;

  try {
    await access(filePath);
  } catch {
    return { error: "文件不存在" };
  }

  const ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";

  try {
    const { stdout } = await execFileAsync(
      ffprobe,
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,codec_name,duration:format=duration",
        "-of",
        "json",
        filePath,
      ],
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    );
    const data = JSON.parse(stdout) as FfprobeOutput;
    const stream = data.streams?.find((item) => item.codec_type === "video") ?? data.streams?.[0];
    const width = stream?.width;
    const height = stream?.height;
    const durationSeconds = parseDuration(stream?.duration) ?? parseDuration(data.format?.duration);

    return {
      resolution: width && height ? `${width}x${height}` : undefined,
      width,
      height,
      codec: stream?.codec_name,
      durationSeconds,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message.slice(0, 160) : "无法读取视频信息",
    };
  }
}

