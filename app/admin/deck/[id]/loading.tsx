/** Skelett medan en flik laddar, så att flikbytet känns omedelbart. Rubrik och flikar ligger i layouten och står kvar. */
export default function DeckLoading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" aria-busy="true" aria-live="polite">
      <div className="h-6 w-48 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg bg-surface-2" />
    </div>
  );
}
