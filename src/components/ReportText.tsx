const urlPattern = /(https?:\/\/[^\s)\]'"<>，。；、！？【】（）《》]+)([，。；、！？)]?)/g;

function linkifyText(text: string) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    const url = match[1];
    const trailing = match[2] ?? "";

    if (index > lastIndex) {
      nodes.push(text.slice(lastIndex, index));
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
    nodes.push(text.slice(lastIndex));
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
  "待核查问题",
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

export function ReportText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="mt-4 rounded-md bg-zinc-100 p-4 text-sm leading-6 text-zinc-950">
      {lines.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-3" />;

        if (isReportHeading(line)) {
          return (
            <div key={index} className="mt-4 first:mt-0 text-lg font-bold leading-7 text-zinc-950">
              {linkifyText(cleanHeadingText(line))}
            </div>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap font-mono text-sm leading-6">
            {linkifyText(line)}
          </p>
        );
      })}
    </div>
  );
}
