import { tagBgClass } from "@/lib/ui/tag-colors";

type Props = {
  title: string;
  colorIndex: number;
  size?: "sm" | "md";
  className?: string;
};

/** Färgad kategoritagg i Notion-stil. Färgen kommer från tokens, texten är alltid --fg. */
export function CategoryTag({ title, colorIndex, size = "sm", className = "" }: Props) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md font-medium text-fg ${tagBgClass(colorIndex)} ${
        size === "sm" ? "truncate px-2 py-0.5 text-xs" : "px-2.5 py-1 text-left text-sm leading-snug"
      } ${className}`.trim()}
      title={title}
    >
      {title}
    </span>
  );
}
