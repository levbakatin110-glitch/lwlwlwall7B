"use client";

import { Fragment, type ReactNode } from "react";
import { LinkifiedText } from "@/components/LinkifiedText";

/** Лёгкий markdown для пузыря Маи: **жирный**, списки, переносы */
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      nodes.push(
        <LinkifiedText key={`t${i++}`} text={text.slice(last, m.index)} />,
      );
    }
    const raw = m[0];
    if (raw.startsWith("**") && raw.endsWith("**")) {
      nodes.push(
        <strong key={`b${i++}`} className="font-semibold text-foreground">
          {raw.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(
        <em key={`i${i++}`} className="italic">
          {raw.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + raw.length;
  }
  if (last < text.length) {
    nodes.push(
      <LinkifiedText key={`t${i++}`} text={text.slice(last)} />,
    );
  }
  return nodes;
}

function renderBlock(text: string): ReactNode {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!list.length) return;
    out.push(
      <ul key={`ul${key++}`} className="my-1.5 list-disc space-y-1 pl-5">
        {list.map((item, idx) => (
          <li key={idx}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  };

  for (const line of lines) {
    const bullet = line.match(/^\s*[-•*]\s+(.+)$/);
    const numbered = line.match(/^\s*(\d+[.)]\s+)(.+)$/);
    if (bullet) {
      list.push(bullet[1]!);
      continue;
    }
    if (numbered) {
      flushList();
      out.push(
        <p key={`n${key++}`} className="my-0.5">
          <span className="mr-1 tabular-nums text-muted">{numbered[1]}</span>
          {renderInline(numbered[2]!)}
        </p>,
      );
      continue;
    }
    flushList();
    if (line.trim() === "") {
      out.push(<div key={`sp${key++}`} className="h-2" />);
      continue;
    }
    out.push(
      <p key={`p${key++}`} className="my-0.5">
        {renderInline(line)}
      </p>,
    );
  }
  flushList();
  return <Fragment>{out}</Fragment>;
}

type Props = {
  text: string;
  /** Идёт стрим — курсор и мягкая «печать» */
  live?: boolean;
};

export function MayaChatText({ text, live }: Props) {
  if (!text) return null;
  return (
    <div
      className={`maya-chat-text text-[15px] leading-relaxed ${
        live ? "maya-chat-text--live" : ""
      }`}
    >
      {renderBlock(text)}
      {live ? <span className="maya-stream-caret" aria-hidden /> : null}
    </div>
  );
}
