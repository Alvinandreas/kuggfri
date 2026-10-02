import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { getDeckEnrollments, getDeckForAdmin } from "@/lib/admin/queries";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import { StatBlock } from "@/components/admin/StatBlock";

export async function generateMetadata(): Promise<Metadata> {
  const sv = await getT();
  return { title: sv.admin.tabEnrollments };
}

/** Kursens deltagarlista: bara de som står här kan skapa konto och se kursen (lib/enrollment). */
export default async function EnrollmentsPage({ params }: { params: Promise<{ id: string }> }) {
  const sv = await getT();
  const { id } = await params;
  const data = await getDeckForAdmin(id);
  if (!data) notFound();
  const { entries, total, registered } = await getDeckEnrollments(id);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-1">
        <h2 className="text-xl font-bold tracking-tight">{sv.admin.tabEnrollments}</h2>
        <p className="text-sm text-muted">{sv.admin.enrollHelp}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
        <StatBlock label={sv.admin.enrollOnList} value={total} testId="enroll-total" />
        <StatBlock label={sv.admin.enrollRegistered} value={registered} testId="enroll-registered" />
      </dl>
      <EnrollmentManager deckId={id} entries={entries} />
    </div>
  );
}
