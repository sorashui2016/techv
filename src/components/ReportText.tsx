const urlPattern = /(https?:\/\/[^\s)\]'"<>，。；、！？【】（）《》]+)([，。；、！？)]?)/g;

const keywordTerms = [
  "AI",
  "机器人",
  "脑机接口",
  "仿生",
  "具身智能",
  "开源",
  "众筹",
  "原型机",
  "传感器",
  "芯片",
  "模型",
  "算法",
  "3D打印",
  "医疗",
  "手术",
  "假肢",
  "外骨骼",
  "材料",
  "桌面工厂",
  "CNC",
  "UV打印",
  "激光雷达",
  "自动驾驶",
  "AR",
  "VR",
  "MR",
];

const keywordPattern = new RegExp(
  [
    "[“「《]([^”」》]{2,40})[”」》]",
    "\\b(?:[A-Z][A-Za-z0-9+-]{1,}|[A-Z]{2,})(?:\\s+(?:[A-Z][A-Za-z0-9+-]{1,}|[0-9][A-Za-z0-9+-]*)){0,4}\\b",
    ...keywordTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  ].join("|"),
  "g",
);

function underlineKeywords(text: string, keyPrefix: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(keywordPattern)) {
    const index = match.index ?? 0;
    const value = match[0];
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    nodes.push(
      <span
        key={`${keyPrefix}-kw-${index}`}
        className="underline underline-offset-4"
        style={{ textDecorationColor: "#18181b", textDecorationThickness: "1px" }}
      >
        {value}
      </span>,
    );
    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes.length > 0 ? nodes : [text];
}

function renderInlineText(text: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    const url = match[1];
    const trailing = match[2] ?? "";

    if (index > lastIndex) {
      nodes.push(...underlineKeywords(text.slice(lastIndex, index), `text-${lastIndex}`));
    }

    nodes.push(
      <a
        key={`${url}-${index}`}
        href={url}
        target="_blank"
        rel="noreferrer"
        className="break-all text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-900"
      >
        {url}
      </a>,
    );

    if (trailing) nodes.push(trailing);
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(...underlineKeywords(text.slice(lastIndex), `text-${lastIndex}`));
  }

  return nodes;
}

const reportHeadingTexts = [
  "一句话结论",
  "这个东西到底是什么",
  "关键细节",
  "为什么适合做视频",
  "相关周边",
  "可拍视频角度",
  "素材线索",
  "来源链接",
  "来源清单",
  "上一版报告摘要",
];

function cleanHeadingText(line: string) {
  return line
    .trim()
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\d+[.、]\s*/, "")
    .replace(/^[一二三四五六七八九十]+[.、]\s*/, "")
    .replace(/[：:]\s*$/, "")
    .trim();
}

function isReportHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("报告生成时间")) return false;
  if (/^#{1,6}\s+\S+/.test(trimmed)) return true;
  if (/^\d+[.、]\s*\S{2,24}[：:]?$/.test(trimmed)) return true;
  if (/^[一二三四五六七八九十]+[.、]\s*\S{2,24}[：:]?$/.test(trimmed)) return true;

  const heading = cleanHeadingText(trimmed);
  return reportHeadingTexts.includes(heading);
}

function visibleReportLines(text: string) {
  const blockedHeadings = ["待核查问题", "还需要继续核查的问题", "需要继续核查的问题"];
  const lines = text.split("\n");
  const output: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const heading = cleanHeadingText(line);
    if (isReportHeading(line) && blockedHeadings.includes(heading)) {
      skipping = true;
      continue;
    }
    if (skipping && isReportHeading(line)) {
      skipping = false;
    }
    if (!skipping) output.push(line);
  }

  return output;
}

export function ReportText({ text }: { text: string }) {
  const lines = visibleReportLines(text);

  return (
    <div className="mt-4 rounded-md bg-zinc-100 p-4 text-sm leading-6 text-zinc-950">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-3" />;

        if (isReportHeading(line)) {
          return (
            <div key={index} className="mt-4 first:mt-0 text-lg font-bold leading-7 text-zinc-950">
              {renderInlineText(cleanHeadingText(line))}
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap font-mono text-sm leading-6">
            {renderInlineText(line)}
          </p>
        );
      })}
    </div>
  );
}
