import type { ReactNode } from "react";

/** Rubrik, förklaring och knappar för 404, 403 och fel. */
export function StatusMessage({ title, body, actions }: { title: string; body?: string; actions: ReactNode }) {
  return (
    <div className="anim-fade-up mx-auto max-w-md py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {body ? <p className="mt-2 text-muted">{body}</p> : null}
      <div className="mt-8 flex flex-wrap justify-center gap-2">{actions}</div>
    </div>
  );
}

/** Helsidesram för när ingen layout omger sidan (okänd adress). */
export function FullPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-1 items-center justify-center px-4">{children}</main>;
}
