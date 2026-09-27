import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sv } from "@/lib/i18n/sv";
import { getDeckForAdmin } from "@/lib/admin/queries";
import { CardEditor } from "@/components/admin/CardEditor";

export const metadata: Metadata = { title: sv.admin.newCard };

export default async function NewCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kategori?: string }>;
}) {
  const [{ id }, { kategori }] = await Promise.all([params, searchParams]);
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const category = kategori ? (data.categories.find((c) => c.id === kategori) ?? null) : null;
  const backHref = `/admin/deck/${data.deck.id}/kategori/${category ? category.id : "ingen"}`;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <nav aria-label={sv.admin.breadcrumb} className="text-sm text-muted">
        <Link href={`/admin/deck/${data.deck.id}/innehall`} className="hover:text-fg">
          {sv.admin.tabContent}
        </Link>
        {category ? (
          <>
            {" › "}
            <Link href={backHref} className="hover:text-fg">
              {category.title}
            </Link>
          </>
        ) : null}
      </nav>
      <h2 className="text-xl font-semibold tracking-tight">{sv.admin.newCard}</h2>
      <CardEditor
        deckId={data.deck.id}
        categories={data.categories.map((c) => ({ id: c.id, title: c.title }))}
        initialCategoryId={category?.id ?? null}
        backHref={category ? backHref : `/admin/deck/${data.deck.id}/innehall`}
      />
    </div>
  );
}
