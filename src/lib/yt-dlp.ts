import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Platform } from "@prisma/client";
import type { ExtractedVideo } from "./types";

const execFileAsync = promisify(execFile);

function detectPlatform(url: string): Platform {
  if (/youtu\.?be|youtube\.com/i.test(url)) return "YOUTUBE";
  if (/instagram\.com/i.test(url)) return "INSTAGRAM";
  if (/tiktok\.com/i.test(url)) return "TIKTOK";
  return "WEB";
}

function toDate(value: unknown) {
  if (typeof value === "number") return new Date(value * 1000);
  if (typeof value !== "string") return undefined;
  if (/^\d{8}$/.test(value)) {
    return new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function buildVideoArgs(url: string) {
  const args = ["--dump-json", "--no-warnings", "--no-playlist"];
  const cookiesBrowser = process.env.YTDLP_COOKIES_BROWSER;

  if (cookiesBrowser) {
    args.push("--cookies-from-browser", cookiesBrowser);
  }

  args.push(url);
  return args;
}

function buildLatestListArgs(url: string) {
  const args = ["--flat-playlist", "--playlist-end", "1", "--dump-json", "--no-warnings"];
  const cookiesBrowser = process.env.YTDLP_COOKIES_BROWSER;

  if (cookiesBrowser) {
    args.push("--cookies-from-browser", cookiesBrowser);
  }

  args.push(url);
  return args;
}

function parseRows(stdout: string) {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function mapVideo(raw: Record<string, unknown>, fallbackUrl: string): ExtractedVideo {
  const fallbackIsYoutube = /youtu\.?be|youtube\.com/i.test(fallbackUrl);
  const url =
    typeof raw.webpage_url === "string"
      ? raw.webpage_url
      : typeof raw.url === "string" && /^https?:\/\//.test(raw.url)
        ? raw.url
        : typeof raw.id === "string" && fallbackIsYoutube
          ? `https://www.youtube.com/watch?v=${raw.id}`
          : typeof raw.url === "string" && fallbackIsYoutube
            ? `https://www.youtube.com/watch?v=${raw.url}`
            : fallbackUrl;

  return {
    platform: detectPlatform(url),
    platformVideoId: typeof raw.id === "string" ? raw.id : undefined,
    originalUrl: url,
    canonicalUrl: typeof raw.webpage_url === "string" ? raw.webpage_url : undefined,
    thumbnailUrl: typeof raw.thumbnail === "string" ? raw.thumbnail : undefined,
    originalTitle: typeof raw.title === "string" ? raw.title : "Untitled video",
    description: typeof raw.description === "string" ? raw.description : undefined,
    publishedAt: toDate(raw.timestamp ?? raw.release_timestamp ?? raw.upload_date),
    likeCount: typeof raw.like_count === "number" ? raw.like_count : undefined,
    sourceName:
      (typeof raw.channel === "string" && raw.channel) ||
      (typeof raw.uploader === "string" && raw.uploader) ||
      (typeof raw.creator === "string" && raw.creator) ||
      "Unknown source",
  };
}

export async function extractVideo(url: string): Promise<ExtractedVideo> {
  const ytDlp = process.env.YTDLP_PATH ?? "yt-dlp";
  const { stdout } = await execFileAsync(ytDlp, buildVideoArgs(url), {
    maxBuffer: 1024 * 1024 * 16,
  });
  return mapVideo(JSON.parse(stdout), url);
}

export async function extractRecentVideos(sourceUrl: string): Promise<ExtractedVideo[]> {
  const ytDlp = process.env.YTDLP_PATH ?? "yt-dlp";
  const { stdout } = await execFileAsync(ytDlp, buildLatestListArgs(sourceUrl), {
    maxBuffer: 1024 * 1024 * 32,
  });

  const latest = parseRows(stdout).at(0);
  if (!latest) return [];

  const lightweightVideo = mapVideo(latest, sourceUrl);

  try {
    return [await extractVideo(lightweightVideo.originalUrl)];
  } catch {
    return [lightweightVideo];
  }
}
