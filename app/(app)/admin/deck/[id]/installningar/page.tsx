import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getAdminContext } from "@/lib/admin/access";
import { getDeckExaminers, getDeckForAdmin } from "@/lib/admin/queries";
import { DeckForm } from "@/components/admin/DeckForm";
import { ExaminerManager } from "@/components/admin/ExaminerManager";
import { ExamModeToggle } from "@/components/tenta/ExamModeToggle";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  return { title: data ? `${sv.admin.tabSettings}: ${data.deck.title}` : sv.admin.tabSettings };
}

export default async function AdminSettingsPage({ params }: { params: Params }) {
  const sv = await getT();
  const { id } = await params;
  const [data, ctx] = await Promise.all([getDeckForAdmin(id), getAdminContext()]);
  if (!data) notFound();
  const isAdmin = ctx?.isAdmin === true;
  const examiners = isAdmin ? await getDeckExaminers(data.deck.id) : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <section aria-labelledby="deck-form" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div>
          <h2 id="deck-form" className="text-xl font-bold tracking-tight">
            {sv.admin.deckSettings}
          </h2>
          <p className="mt-1 text-sm text-muted">{sv.admin.deckSettingsHelp}</p>
        </div>
        <DeckForm deck={data.deck} canDelete={isAdmin} canManage={isAdmin} />
      </section>
      <section aria-labelledby="tentalaget" className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div>
          <h2 id="tentalaget" className="text-xl font-bold tracking-tight">
            {sv.tenta.title}
          </h2>
        </div>
        <ExamModeToggle deckId={data.deck.id} open={data.deck.exam_mode_open === true} />
      </section>
      {isAdmin ? (
        <section aria-labelledby="examinatorer" className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div>
            <h2 id="examinatorer" className="text-xl font-bold tracking-tight">
              {sv.admin.examiners}
            </h2>
            <p className="mt-1 text-sm text-muted">{sv.admin.examinersHelp}</p>
          </div>
          <ExaminerManager deckId={data.deck.id} examiners={examiners} />
        </section>
      ) : null}
    </div>
  );
}
