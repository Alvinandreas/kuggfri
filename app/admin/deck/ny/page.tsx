import type { Metadata } from "next";
import { sv } from "@/lib/i18n/sv";
import { DeckForm } from "@/components/admin/DeckForm";

export const metadata: Metadata = { title: sv.admin.newDeck };

export default function NewDeckPage() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{sv.admin.newDeck}</h1>
      <DeckForm />
    </div>
  );
}
