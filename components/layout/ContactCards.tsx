import { Mail } from "lucide-react";
import { CONTACTS } from "@/lib/contact";
import { Card } from "@/components/ui/Card";

/** Två kontaktkort: den som driver tjänsten och kursens examinator. */
export function ContactCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-testid="contact-cards">
      {[CONTACTS.operator, CONTACTS.examiner].map((c) => (
        <Card key={c.email} padding="md" className="flex gap-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent-ink">
            <Mail size={19} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-bold">{c.name}</p>
            <p className="text-sm text-muted">{c.role}</p>
            <a href={`mailto:${c.email}`} className="mt-1 inline-block break-all font-semibold text-accent underline-offset-2 hover:underline">
              {c.email}
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}
