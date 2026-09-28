import type { ReactNode } from "react";

function inlineMarkdown(value: string): ReactNode[] {
  const parts = value.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

/** Lightweight, safe Markdown for AI coaching text. HTML is deliberately not supported. */
export default function MarkdownText({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={`list-${blocks.length}`}>
        {list.items.map((item, index) => (
          <li key={index}>{inlineMarkdown(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:[-*+]\s+|(\d+)[.)]\s+)(.+)$/);
    if (match) {
      const ordered = match[1] !== undefined;
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(match[2] ?? trimmed.replace(/^[-*+]\s+/, ""));
      continue;
    }
    flushList();
    if (!trimmed) continue;
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(
        <h5 key={`heading-${blocks.length}`}>{inlineMarkdown(heading[1])}</h5>,
      );
    } else {
      blocks.push(
        <p key={`paragraph-${blocks.length}`}>{inlineMarkdown(trimmed)}</p>,
      );
    }
  }
  flushList();
  return <div className="training-markdown">{blocks}</div>;
}
