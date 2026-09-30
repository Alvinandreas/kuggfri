/**
 * Text där datum som "25-10-30" och "2022-10-29" hålls ihop: webbläsaren bryter annars raden
 * vid bindestrecket, och tentornas namn blev "MTT085, 25-" på en rad och "10-30" på nästa.
 */
export function KeepDates({ children }: { children: string }) {
  const parts = children.split(/(\S*\d-\d\S*)/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
