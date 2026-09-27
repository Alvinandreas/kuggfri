"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, Copy, Flame, MoreHorizontal, Pencil, Settings, Share2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { Card, CardLink, SectionTitle } from "@/components/ui/Card";
import { Countdown } from "@/components/ui/Countdown";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextField } from "@/components/ui/TextField";
import { ToggleRow } from "@/components/ui/Toggle";
import { ThemeSwitcher } from "@/components/ui/ThemeToggle";

const SWATCHES: Array<[string, string]> = [
  ["bg", "Duken"],
  ["sidebar", "Sidomenyn"],
  ["surface", "Block"],
  ["surface-2", "Fält, hovring"],
  ["surface-3", "Vald post"],
  ["inverse", "Vald flik"],
  ["accent", "Handling"],
  ["accent-soft", "Accent, mjuk"],
  ["danger", "Fara"],
  ["fg", "Text"],
  ["muted", "Dämpad text"],
  ["subtle", "Etiketter"],
];

// Ett tentadatum en bit fram, så att nedräkningen har något att räkna.
const EXAM = new Date(Date.now() + ((7 * 24 + 20) * 60 + 42) * 60_000);

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="anim-fade-up mt-14 first:mt-0">
      <SectionTitle>{title}</SectionTitle>
      {lead ? <p className="-mt-2 mb-5 max-w-2xl text-muted">{lead}</p> : null}
      {children}
    </section>
  );
}

export function Showcase() {
  const [view, setView] = useState<"schema" | "ova" | "kategorier">("schema");
  const [page, setPage] = useState<"skapa" | "resurser">("resurser");
  const [modalOpen, setModalOpen] = useState(false);
  const [opts, setOpts] = useState({ shuffle: true, write: false, starred: false, reminders: true });
  const [replay, setReplay] = useState(0);
  const set = (k: keyof typeof opts) => (v: boolean) => setOpts((o) => ({ ...o, [k]: v }));

  return (
    <div key={replay}>
      <header className="anim-fade-up mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-accent">Kuggfri 2.0</p>
          <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Designsystem</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">
            Byggstenarna för hemsidan, sidomenyn och allt som kommer efter. Samma komponenter överallt gör att allt känns som en
            och samma produkt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          <Button variant="secondary" size="sm" onClick={() => setReplay((n) => n + 1)}>
            Spela upp animationerna
          </Button>
        </div>
      </header>

      <Section title="Så kan hemsidan se ut" lead="Ett kursblock i Knowts anda: nedräkning till tentan, kunskapsestimat och fördelning per kategori.">
        <Card padding="lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-accent-soft text-accent">
                <BookOpen size={22} aria-hidden />
              </span>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Materialteknik</h3>
                <p className="text-sm text-muted">MTM081 · 144 kort</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Countdown to={EXAM} label="Tid kvar till tentan" />
              <IconButton label="Kursinställningar" variant="outline">
                <Settings size={18} aria-hidden />
              </IconButton>
            </div>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="sm:border-r sm:border-line sm:pr-8">
              <p className="text-5xl font-extrabold tracking-tight">
                68<span className="text-2xl text-muted"> %</span>
              </p>
              <p className="mt-1 font-semibold">Kunskapsestimat</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {[
                ["Metaller och legeringar", 0.74, "accent"],
                ["Polymerer", 0.41, "chart-2"],
                ["Keramer och kompositer", 0.12, "chart-3"],
                ["Brott och utmattning", 0.03, "danger"],
              ].map(([name, v, tone]) => (
                <div key={name as string}>
                  <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{name as string}</span>
                    <span className="tabular-nums text-muted">{Math.round((v as number) * 100)} %</span>
                  </div>
                  <ProgressBar value={v as number} label={name as string} tone={tone as "accent"} />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {(
            [
              ["schema", "Schema"],
              ["ova", "Snabbövning"],
              ["kategorier", "Kategorier"],
            ] as const
          ).map(([v, label]) => (
            <Button key={v} variant={view === v ? "inverse" : "outline"} size="sm" onClick={() => setView(v)} aria-pressed={view === v}>
              {label}
            </Button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["I dag", "20 nya · 34 repetitioner", "Fortsätt"],
            ["Snabbövning", "30 slumpade kort, som på tentan", "Starta"],
            ["Svåraste korten", "De 15 du missat oftast", "Öva"],
          ].map(([title, sub, cta], i) => (
            <CardLink key={title} href="#" padding="lg" className="anim-fade-up" style={{ ["--i" as string]: i + 1 }} data-testid={`demo-card-${i}`}>
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                  {i === 0 ? <Badge tone="accent">54 kvar</Badge> : <Badge tone="strong">Ny</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">{sub}</p>
                <p className="mt-6 inline-flex items-center gap-1.5 font-semibold text-accent">
                  {cta}
                  <ArrowRight size={16} aria-hidden className="transition-transform duration-200 group-hover:translate-x-1" />
                </p>
              </div>
            </CardLink>
          ))}
        </div>
      </Section>

      <Section title="Färger" lead="Mörkt läge skiljer ytor åt med ljushet i stället för linjer. Accenten är Kuggfri-grön.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {SWATCHES.map(([token, name]) => (
            <div key={token} className="overflow-hidden rounded-md border border-line">
              <div className="h-16" style={{ background: `var(--${token})` }} />
              <div className="bg-surface px-3 py-2">
                <p className="text-sm font-semibold">{name}</p>
                <p className="font-mono text-xs text-muted">--{token}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typografi" lead="Figtree, självhostad. Rundad och vänlig, men stram i rubrikerna.">
        <Card padding="lg" className="space-y-3">
          <p className="text-4xl font-extrabold tracking-tight">Hej Alvin, dags att plugga</p>
          <p className="text-2xl font-bold tracking-tight">Mina kurser</p>
          <p className="text-lg font-semibold">Metaller och legeringar</p>
          <p>Brödtext för förklaringar och kortens innehåll. Läsbar i långa stycken, med gott radavstånd.</p>
          <p className="text-muted">Dämpad text för stödinformation och metadata.</p>
          <p className="text-xs font-semibold text-subtle">SEKTIONSETIKETT</p>
        </Card>
      </Section>

      <Section title="Knappar" lead="Allt är piller. En grön huvudhandling per vy; resten är grå, kantade eller rena textknappar.">
        <Card padding="lg" className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Fortsätt plugga</Button>
            <Button variant="secondary">Sekundär</Button>
            <Button variant="outline">Visa</Button>
            <Button variant="inverse">Vald</Button>
            <Button variant="ghost">Textknapp</Button>
            <Button variant="danger">Nollställ</Button>
            <Button disabled>Inaktiv</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Liten</Button>
            <Button size="md">Mellan</Button>
            <Button size="lg">Stor</Button>
            <LinkButton href="#" variant="outline" size="sm">
              Länk som knapp
            </LinkButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton label="Inställningar">
              <Settings size={18} aria-hidden />
            </IconButton>
            <IconButton label="Dela" variant="outline">
              <Share2 size={18} aria-hidden />
            </IconButton>
            <IconButton label="Redigera" variant="secondary">
              <Pencil size={18} aria-hidden />
            </IconButton>
            <IconButton label="Mer" variant="outline" size="sm">
              <MoreHorizontal size={16} aria-hidden />
            </IconButton>
          </div>
        </Card>
      </Section>

      <Section title="Flikar och etiketter" lead="Segmentväljaren låter den valda pillern glida mellan lägena.">
        <Card padding="lg" className="space-y-5">
          <div className="flex justify-center">
            <SegmentedControl
              label="Vy"
              value={page}
              onChange={setPage}
              segments={[
                { value: "skapa", label: "Skapa" },
                { value: "resurser", label: "Resurser" },
              ]}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              label="Period"
              size="sm"
              value={view}
              onChange={setView}
              segments={[
                { value: "schema", label: "7 dagar" },
                { value: "ova", label: "30 dagar" },
                { value: "kategorier", label: "Hela kursen" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>Inga uppgifter</Badge>
            <Badge tone="strong">Klar</Badge>
            <Badge tone="accent">
              <Flame size={12} aria-hidden /> 4 dagar i rad
            </Badge>
            <Badge tone="danger">3 rapporter</Badge>
            <Badge tone="outline">MTM081</Badge>
          </div>
        </Card>
      </Section>

      <Section title="Menyer" lead="Som Knowts profilmeny: poppar fram från knappen, pilar och Esc fungerar, klick utanför stänger. Profilmenyn finns längst ner i sidomenyn.">
        <Card padding="lg" className="flex flex-wrap items-center gap-3">
          <Menu
            label="Kursåtgärder"
            trigger={(p) => (
              <Button {...p} variant="secondary">
                Öppna meny
              </Button>
            )}
          >
            <MenuItem icon={<Pencil size={18} />}>Byt namn</MenuItem>
            <MenuItem icon={<Copy size={18} />} trailing="Ctrl D">
              Duplicera
            </MenuItem>
            <MenuItem icon={<Share2 size={18} />}>Dela länk</MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Trash2 size={18} />} tone="danger">
              Ta bort
            </MenuItem>
          </Menu>
          <Menu
            label="Mer"
            placement="bottom-end"
            width="13rem"
            trigger={(p) => (
              <IconButton {...p} label="Mer" variant="outline">
                <MoreHorizontal size={18} aria-hidden />
              </IconButton>
            )}
          >
            <MenuItem icon={<Settings size={18} />}>Inställningar</MenuItem>
            <MenuItem icon={<Share2 size={18} />}>Dela</MenuItem>
          </Menu>
        </Card>
      </Section>

      <Section title="Reglage och dialoger" lead="Inställningsrader i Knowts stil, i ett block eller i en dialog.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card padding="lg">
            <h3 className="mb-2 text-lg font-bold">Pluggläge</h3>
            <div className="divide-y divide-line">
              <ToggleRow title="Blanda korten" checked={opts.shuffle} onChange={set("shuffle")} />
              <ToggleRow title="Skriv svaret" description="Skriv innan du vänder kortet." checked={opts.write} onChange={set("write")} />
              <ToggleRow title="Bara stjärnmärkta" checked={opts.starred} onChange={set("starred")} />
            </div>
          </Card>
          <Card padding="lg" className="flex flex-col items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold">Dialog</h3>
              <p className="mt-1 text-muted">Tonar in, fångar fokus och stängs med Esc, krysset eller klick utanför.</p>
            </div>
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Öppna inställningar
            </Button>
          </Card>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Inställningar för sessionen"
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalOpen(false)}>
                Avbryt
              </Button>
              <Button onClick={() => setModalOpen(false)}>Spara</Button>
            </>
          }
        >
          <p className="mb-2 text-sm font-semibold text-subtle">Pluggläge</p>
          <div className="divide-y divide-line">
            <ToggleRow title="Blanda korten" checked={opts.shuffle} onChange={set("shuffle")} />
            <ToggleRow title="Skriv svaret" checked={opts.write} onChange={set("write")} />
            <ToggleRow title="Påminnelse via e-post" description="Ett mejl när du har kort att repetera." checked={opts.reminders} onChange={set("reminders")} />
          </div>
        </Modal>
      </Section>

      <Section title="Fält" lead="Mjuka fält utan hård kant; fokus ger en grön ring.">
        <Card padding="lg" className="grid max-w-xl gap-4">
          <TextField label="Namn" placeholder="Förnamn Efternamn" autoComplete="off" />
          <TextField label="E-post" type="email" placeholder="namn@student.chalmers.se" hint="Vi skickar bara inloggningslänkar hit." autoComplete="off" />
          <TextField label="Lösenord" type="password" defaultValue="kort" error="Lösenordet måste vara minst 8 tecken." autoComplete="off" />
        </Card>
      </Section>
    </div>
  );
}
