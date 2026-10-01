import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { CardEditor } from "@/components/admin/CardEditor";
import { routes } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.newCard };
}

export default async function NewCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kategori?: string }>;
}) {
  const sv = await getT();
  const [{ id }, { kategori }] = await Promise.all([params, searchParams]);
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const category = kategori ? (data.categories.find((c) => c.id === kategori) ?? null) : null;
  const backHref = routes.admin.category(data.deck.id, category ? category.id : "ingen");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <nav aria-label={sv.admin.breadcrumb} className="flex min-w-0 items-center gap-1 text-sm text-muted">
        <Link href={routes.admin.content(data.deck.id)} className="inline-flex min-h-8 items-center gap-1 rounded-full font-semibold hover:text-fg">
          {sv.admin.tabContent}
        </Link>
        {category ? (
          <>
            <ChevronRight size={15} aria-hidden className="shrink-0 text-subtle" />
            <Link href={backHref} className="flex min-h-8 min-w-0 items-center rounded-full font-semibold hover:text-fg">
              <span className="truncate">{category.title}</span>
            </Link>
          </>
        ) : null}
      </nav>
      <h2 className="text-2xl font-bold tracking-tight">{sv.admin.newCard}</h2>
      <CardEditor
        deckId={data.deck.id}
        categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
        initialCategoryId={category?.id ?? null}
        backHref={category ? backHref : routes.admin.content(data.deck.id)}
      />
    </div>
  );
}
