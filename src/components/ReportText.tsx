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

export function ReportText({ text }: { text: string }) {
  return (
    <div className="mt-4 whitespace-pre-wrap rounded-md bg-zinc-100 p-4 font-mono text-sm leading-6 text-zinc-950">
      {linkifyText(text)}
    </div>
  );
}
