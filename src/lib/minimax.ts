import { z } from "zod";
import type { AiVideoInput, AiVideoOutput } from "./types";

const aiOutputSchema = z.object({
  chineseTitle: z.string().min(1),
  chineseSummary: z.string().max(120),
  score: z.number().int().min(0).max(100),
  scoreReason: z.string().min(1).max(200),
});

function fallbackScore(input: AiVideoInput) {
  let score = input.sourceTier === "IMPORTANT" ? 70 : 50;
  const title = input.title.toLowerCase();

  if (/(ai|robot|iphone|nvidia|openai|google|tesla|apple|meta|chip|gpu)/i.test(title)) {
    score += 12;
  }

  if (input.likeCount && input.likeCount > 1000) {
    score += 8;
  }

  if (input.publishedAt) {
    const ageHours = (Date.now() - input.publishedAt.getTime()) / 36e5;
    if (ageHours <= 24) score += 10;
    if (ageHours > 168) score -= 12;
  }

  return Math.max(0, Math.min(100, score));
}

export async function analyzeVideoWithMinimax(input: AiVideoInput): Promise<AiVideoOutput> {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    return {
      chineseTitle: input.title,
      chineseSummary: "Minimax API key 尚未配置，已保留原始标题，等待后续重新生成摘要。",
      score: fallbackScore(input),
      scoreReason: "使用本地规则临时评分，等待 AI 处理。",
    };
  }

  const apiUrl =
    process.env.MINIMAX_API_URL ?? "https://api.minimax.chat/v1/text/chatcompletion_v2";
  const model = process.env.MINIMAX_MODEL ?? "abab6.5s-chat";
  const groupId = process.env.MINIMAX_GROUP_ID;
  const url = groupId ? `${apiUrl}?GroupId=${groupId}` : apiUrl;

  const prompt = [
    "你是科技视频选题编辑。请把输入视频处理成 JSON。",
    "要求：chineseTitle 为中文标题；chineseSummary 不超过 100 个中文字符；score 为 0-100 整数；scoreReason 简短说明评分依据。",
    "只输出 JSON，不要输出 Markdown。",
    "",
    `平台：${input.platform ?? "未知"}`,
    `来源：${input.sourceName ?? "未知"}`,
    `来源等级：${input.sourceTier ?? "NORMAL"}`,
    `标题：${input.title}`,
    `描述：${input.description ?? ""}`,
    `发布时间：${input.publishedAt?.toISOString() ?? "未知"}`,
    `点赞数：${input.likeCount ?? "未知"}`,
  ].join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ sender_type: "USER", text: prompt }],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Minimax request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text =
    data?.reply ??
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.base_resp?.status_msg;

  if (typeof text !== "string") {
    throw new Error("Minimax response did not include text content.");
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const parsed = aiOutputSchema.parse(JSON.parse(jsonMatch?.[0] ?? text));

  return {
    ...parsed,
    chineseSummary:
      parsed.chineseSummary.length > 100
        ? `${parsed.chineseSummary.slice(0, 100)}`
        : parsed.chineseSummary,
  };
}
