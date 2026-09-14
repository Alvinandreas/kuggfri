import { tagBgClass } from "@/lib/ui/tag-colors";

type Props = {
  title: string;
  colorIndex: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "truncate px-2.5 py-1 text-xs",
  md: "px-3.5 py-1.5 text-left text-sm leading-snug",
  lg: "px-4 py-2 text-left text-base leading-snug",
} as const;

/** Färgad kategoritagg i Notion-stil. Färgen kommer från tokens, texten är alltid --fg. */
export function CategoryTag({ title, colorIndex, size = "sm", className = "" }: Props) {
  return (
    <span className={`inline-flex max-w-full items-center rounded-full font-medium text-fg ${tagBgClass(colorIndex)} ${sizes[size]} ${className}`.trim()} title={title}>
      {title}
    </span>
  );
}
