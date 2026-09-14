import type { Metadata } from "next";
import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { getDecksForAbout } from "@/lib/content/queries";

export const metadata: Metadata = { title: sv.about.title };

export default async function AboutPage() {
  const decks = await getDecksForAbout();
  return (
    <article className="prose-body mx-auto grid max-w-[44rem] gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.about.title}</h1>
      <p>{sv.about.intro}</p>

      <section>
        <h2>{sv.about.why}</h2>
        <p>{sv.about.whyBody}</p>
      </section>

      <section>
        <h2>{sv.about.how}</h2>
        <p>{sv.about.howBody}</p>
      </section>

      <section>
        <h2>{sv.about.sources}</h2>
        <p>{sv.about.sourcesBody}</p>
        <ul className="mt-3 grid gap-3">
          {decks.map((d) => (
            <li key={d.id} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-medium">
                <Link href={`/d/${d.slug}`} className="underline underline-offset-2 decoration-line-strong hover:decoration-fg">
                  {d.title}
                </Link>
                {d.course_code ? <span className="text-muted"> · {d.course_code}</span> : null}
              </p>
              <p className="mt-1 text-sm text-muted">{d.source_credit ?? sv.about.noSource}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{sv.about.privacy}</h2>
        <p>
          {sv.about.privacyBody}{" "}
          <Link href="/integritet" className="text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent">
            {sv.footer.privacy}
          </Link>
          .
        </p>
      </section>
    </article>
  );
}
