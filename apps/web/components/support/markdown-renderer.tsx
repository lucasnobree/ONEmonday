"use client";

import { useMemo } from "react";
import {
  parseMarkdown,
  type InlineNode,
  type MarkdownBlock,
} from "@/lib/support/markdown";

interface MarkdownRendererProps {
  content: string;
}

function InlineNodes({ nodes }: { nodes: InlineNode[] }) {
  return (
    <>
      {nodes.map((node, idx) => {
        switch (node.type) {
          case "bold":
            return (
              <strong key={idx} className="font-semibold">
                {node.value}
              </strong>
            );
          case "italic":
            return (
              <em key={idx} className="italic">
                {node.value}
              </em>
            );
          case "code":
            return (
              <code
                key={idx}
                className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
              >
                {node.value}
              </code>
            );
          case "link":
            return (
              <a
                key={idx}
                href={node.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                {node.value}
              </a>
            );
          default:
            return <span key={idx}>{node.value}</span>;
        }
      })}
    </>
  );
}

function Block({ block }: { block: MarkdownBlock }) {
  if (block.type === "heading") {
    const className =
      block.level === 1
        ? "text-lg font-semibold mt-4 mb-1.5 first:mt-0"
        : block.level === 2
          ? "text-base font-semibold mt-3 mb-1 first:mt-0"
          : "text-sm font-semibold mt-2 mb-1 first:mt-0";
    if (block.level === 1)
      return (
        <h1 className={className}>
          <InlineNodes nodes={block.inline} />
        </h1>
      );
    if (block.level === 2)
      return (
        <h2 className={className}>
          <InlineNodes nodes={block.inline} />
        </h2>
      );
    return (
      <h3 className={className}>
        <InlineNodes nodes={block.inline} />
      </h3>
    );
  }

  if (block.type === "list") {
    const itemNodes = block.items.map((item, idx) => (
      <li key={idx}>
        <InlineNodes nodes={item} />
      </li>
    ));
    return block.ordered ? (
      <ol className="my-2 ml-5 list-decimal space-y-1">{itemNodes}</ol>
    ) : (
      <ul className="my-2 ml-5 list-disc space-y-1">{itemNodes}</ul>
    );
  }

  return (
    <p className="my-2 leading-relaxed first:mt-0 last:mb-0">
      <InlineNodes nodes={block.inline} />
    </p>
  );
}

/**
 * Renders a minimal subset of Markdown (headings, bold/italic, inline code,
 * links, lists) without a third-party dependency. See lib/support/markdown.ts.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">Sem conteúdo.</p>;
  }

  return (
    <div className="text-sm">
      {blocks.map((block, idx) => (
        <Block key={idx} block={block} />
      ))}
    </div>
  );
}
