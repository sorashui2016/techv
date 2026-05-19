import { createHmac } from "node:crypto";

export type FeishuVideoMessage = {
  title: string;
  originalTitle: string;
  summary?: string | null;
  score: number;
  sourceName: string;
  originalUrl: string;
  publishedAt?: Date | null;
};

function sign(timestamp: number, secret: string) {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

function dateText(date?: Date | null) {
  if (!date) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export async function sendFeishuVideoMessage(video: FeishuVideoMessage) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) return { skipped: true };

  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.FEISHU_WEBHOOK_SECRET;
  const lines = [
    "重要账号有新视频",
    `来源：${video.sourceName}`,
    `评分：${video.score}`,
    `发布时间：${dateText(video.publishedAt)}`,
    "",
    `中文标题：${video.title}`,
    `原始标题：${video.originalTitle}`,
    video.summary ? `摘要：${video.summary}` : null,
    "",
    `原始链接：${video.originalUrl}`,
  ].filter(Boolean);

  const payload = {
    ...(secret ? { timestamp: String(timestamp), sign: sign(timestamp, secret) } : {}),
    msg_type: "text",
    content: {
      text: lines.join("\n"),
    },
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Feishu webhook failed: ${response.status} ${text}`);
  }

  const data = text ? JSON.parse(text) : null;
  if (data?.StatusCode && data.StatusCode !== 0) {
    throw new Error(`Feishu webhook failed: ${data.StatusMessage ?? text}`);
  }
  if (data?.code && data.code !== 0) {
    throw new Error(`Feishu webhook failed: ${data.msg ?? text}`);
  }

  return { skipped: false, response: data };
}
