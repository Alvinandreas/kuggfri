const HEIGHT = { sm: "max-h-64", md: "max-h-72", lg: "max-h-[26rem]" } as const;

/** Uppgiftens figurer (data-URI:er ur tentabanken), i ordning och bredvid varandra när de får plats. */
export function ExamFigures({ images, size, className = "" }: { images: string[]; size: keyof typeof HEIGHT; className?: string }) {
  if (images.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-start gap-3 ${className}`.trim()}>
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- bilden är en data-URI ur tentabanken
        <img
          key={i}
          src={src}
          alt={images.length > 1 ? `Figur ${i + 1}` : ""}
          className={`${HEIGHT[size]} w-auto max-w-full rounded-md border border-line bg-white p-2`}
        />
      ))}
    </div>
  );
}
