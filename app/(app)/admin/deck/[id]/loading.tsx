/** Skelett medan en flik laddar, så att flikbytet känns omedelbart. Rubrik och flikar ligger i layouten och står kvar. */
export default function DeckLoading() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" aria-busy="true" aria-live="polite">
      <div className="h-7 w-48 animate-pulse rounded-md bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-surface-2" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-72 animate-pulse rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
