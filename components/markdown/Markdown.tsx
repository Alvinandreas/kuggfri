"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

type Props = {
  text: string;
  /** "card" för kortens stora typografi, "body" för löptext. */
  variant?: "card" | "body";
  className?: string;
};

/**
 * Renderar markdown + KaTeX. Rå HTML i texten renderas aldrig (react-markdown
 * eskaperar den), så innehållet kan inte injicera skript.
 */
export const Markdown = memo(function Markdown({ text, variant = "card", className = "" }: Props) {
  return (
    <div className={`${variant === "card" ? "prose-card" : "prose-body"} ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
