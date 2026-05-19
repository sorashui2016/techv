import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Platform } from "@prisma/client";
import type { ExtractedVideo } from "./types";

const execFileAsync = promisify(execFile);

export class SourceNameInferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceNameInferenceError";
  }
}

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

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function detectSourcePlatform(url: string) {
  return detectPlatform(url);
}

function normalizeUrlKey(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().toLowerCase();
  } catch {
    return sourceUrl.trim().toLowerCase();
  }
}

function sourceKeyFromMetadata(sourceUrl: string, raw?: Record<string, unknown>) {
  const platform = detectSourcePlatform(sourceUrl);

  if (platform === "YOUTUBE") {
    const channelId =
      cleanText(raw?.playlist_channel_id) ??
      cleanText(raw?.channel_id) ??
      cleanText(raw?.playlist_id);

    if (channelId) return `youtube:${channelId}`;

    const handle =
      cleanText(raw?.playlist_uploader_id) ??
      cleanText(raw?.uploader_id) ??
      cleanText(raw?.channel);

    if (handle) return `youtube:${handle.toLowerCase()}`;
  }

  return `${platform.toLowerCase()}:${normalizeUrlKey(sourceUrl)}`;
}

function fallbackSourceName(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment.trim()))
      .filter(Boolean);

    const handle = segments.find((segment) => segment.startsWith("@"));
    if (handle) return handle.slice(1);

    const channelIndex = segments.findIndex((segment) => segment === "channel");
    const channelId = channelIndex >= 0 ? segments.at(channelIndex + 1) : undefined;
    if (channelId) return channelId;

    const firstSegment = segments.at(0);
    if (firstSegment) return firstSegment.replace(/^@/, "");

    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown source";
  }
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

function isInstagramUrl(url: string) {
  return /instagram\.com/i.test(url);
}

function isVideoLike(raw: Record<string, unknown>, fallbackUrl: string) {
  if (!isInstagramUrl(fallbackUrl)) return true;
  if (/\/(reel|tv)\//i.test(fallbackUrl)) return true;
  if (typeof raw.duration === "number" && raw.duration > 0) return true;
  if (typeof raw.vcodec === "string" && raw.vcodec !== "none") return true;
  if (typeof raw.ext === "string" && !["jpg", "jpeg", "png", "webp"].includes(raw.ext.toLowerCase())) {
    return true;
  }
  if (typeof raw.url === "string" && /\.(mp4|mov)(\?|$)/i.test(raw.url)) return true;
  return false;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    const details =
      "stderr" in error && typeof error.stderr === "string" ? error.stderr.trim() : undefined;
    return details || error.message;
  }
  return "Unknown source name inference error";
}

export async function inferSourceName(sourceUrl: string, options: { strict?: boolean } = {}) {
  const metadata = await inferSourceMetadata(sourceUrl, options);
  return metadata.name;
}

export async function inferSourceMetadata(sourceUrl: string, options: { strict?: boolean } = {}) {
  const ytDlp = process.env.YTDLP_PATH ?? "yt-dlp";

  try {
    const { stdout } = await execFileAsync(ytDlp, buildLatestListArgs(sourceUrl), {
      maxBuffer: 1024 * 1024 * 4,
      timeout: 30_000,
    });
    const latest = parseRows(stdout).at(0) as Record<string, unknown> | undefined;
    const inferred =
      cleanText(latest?.playlist_channel) ??
      cleanText(latest?.playlist_uploader) ??
      cleanText(latest?.playlist_title)?.replace(/\s+-\s+Videos$/i, "") ??
      cleanText(latest?.channel) ??
      cleanText(latest?.uploader) ??
      cleanText(latest?.creator) ??
      cleanText(latest?.channel_id);

    if (inferred) {
      return {
        name: inferred,
        sourceKey: sourceKeyFromMetadata(sourceUrl, latest),
      };
    }
  } catch (error) {
    if (options.strict) {
      throw new SourceNameInferenceError(errorMessage(error));
    }
    // Fall back to a deterministic name from the URL so source creation still works.
  }

  return {
    name: fallbackSourceName(sourceUrl),
    sourceKey: sourceKeyFromMetadata(sourceUrl),
  };
}

export async function extractVideo(url: string): Promise<ExtractedVideo> {
  const ytDlp = process.env.YTDLP_PATH ?? "yt-dlp";
  const { stdout } = await execFileAsync(ytDlp, buildVideoArgs(url), {
    maxBuffer: 1024 * 1024 * 16,
  });
  const raw = JSON.parse(stdout);
  if (!isVideoLike(raw, url)) {
    throw new Error("Instagram item is not a video.");
  }
  return mapVideo(raw, url);
}

export async function extractRecentVideos(sourceUrl: string): Promise<ExtractedVideo[]> {
  const ytDlp = process.env.YTDLP_PATH ?? "yt-dlp";
  const { stdout } = await execFileAsync(ytDlp, buildLatestListArgs(sourceUrl), {
    maxBuffer: 1024 * 1024 * 32,
  });

  const latest = parseRows(stdout).at(0);
  if (!latest) return [];
  if (!isVideoLike(latest, sourceUrl)) return [];

  const lightweightVideo = mapVideo(latest, sourceUrl);

  try {
    return [await extractVideo(lightweightVideo.originalUrl)];
  } catch {
    return [lightweightVideo];
  }
}
