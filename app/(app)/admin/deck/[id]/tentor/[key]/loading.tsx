/** Skelett medan facitvyn laddar, så att Visa facit ger besked direkt. */
export default function ExamKeyLoading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" aria-busy="true" aria-live="polite">
      <div className="h-5 w-24 animate-pulse rounded-md bg-surface-2" />
      <div className="h-8 w-2/3 animate-pulse rounded-md bg-surface-2" />
      <div className="h-4 w-1/2 animate-pulse rounded-md bg-surface-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}
