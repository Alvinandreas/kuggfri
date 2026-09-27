import type { Metadata } from "next";
import Link from "next/link";
import { sv } from "@/lib/i18n/sv";
import { Card } from "@/components/ui/Card";
import { CONTACTS } from "@/lib/contact";

export const metadata: Metadata = { title: sv.privacy.title };

/**
 * Integritetspolicy. Texten ska alltid beskriva exakt vad appen gör.
 *
 * Regel: läggs en ny tabell med personuppgifter till, eller en ny nyckel i localStorage,
 * ska den beskrivas här OCH i docs/PERSONUPPGIFTER.md OCH tas med i dataexporten
 * (app/api/konto/export/route.ts). Testet i tests/unit/privacy hjälper till att påminna.
 */

const UPDATED = "27 september 2026";

/** Länk i sammanfattningen, som ligger utanför .prose-body och därför stylas här. */
const summaryLink = "font-medium text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent";

/**
 * Löptexten. Rubrikens avstånd uppåt kommer från .prose-body (globals.css) och ligger
 * utanför Tailwinds lager; här läggs bara det till som prose-body inte redan styr.
 */
const sectionClass = "prose-body [&_h2]:tracking-tight [&_li+li]:mt-1.5 [&_a]:underline-offset-2";

function Row({ what, why, basis, retention }: { what: string; why: string; basis: string; retention: string }) {
  return (
    <tr className="border-b border-line align-top last:border-b-0">
      <th scope="row" className="px-4 py-3 text-left font-semibold">
        {what}
      </th>
      <td className="px-4 py-3">{why}</td>
      <td className="px-4 py-3 text-muted">{basis}</td>
      <td className="px-4 py-3 text-muted">{retention}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-[46rem] [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
      <header className="anim-fade-up mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{sv.privacy.title}</h1>
        <p className="mt-2 text-sm text-muted">Senast uppdaterad: {UPDATED}</p>
      </header>

      <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 1 }} role="region" aria-labelledby="sammanfattning-rubrik">
        <h2 id="sammanfattning-rubrik" className="text-lg font-bold tracking-tight">
          Kort sammanfattning
        </h2>
        <ul className="mt-4 grid gap-3 leading-relaxed">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>För att plugga skapar du ett konto. Vi sparar ditt namn, din e-postadress och din studieprogress. Inget annat.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>Vi har ingen analys, inga annonser, inga spårningskakor och inga tredjepartsinloggningar.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>Vi skickar aldrig mejl du inte bett om. Påminnelser är avstängda tills du själv slår på dem.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>Kursens examinator ser bara sammanställd statistik, aldrig enskilda studenters svar.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>
              Du kan ladda ner allt vi har om dig, och radera kontot helt, själv under{" "}
              <Link href="/konto" className={summaryLink}>
                Konto
              </Link>
              .
            </span>
          </li>
        </ul>
      </Card>

      <div className="mt-4 grid gap-3">

        <section className={sectionClass}>
          <h2>Vem ansvarar för dina uppgifter</h2>
          <p>
            Kuggfri drivs ideellt av en student vid Chalmers tekniska högskola, som är personuppgiftsansvarig för
            behandlingen som beskrivs här. Tjänsten är inte en del av Chalmers IT-miljö, och Chalmers är inte
            personuppgiftsansvarig. Frågor om dina uppgifter skickar du till{" "}
            <a href={`mailto:${CONTACTS.operator.email}`}>{CONTACTS.operator.email}</a> ({CONTACTS.operator.name}). Vi har
            ingen utsedd dataskyddsombud, eftersom verksamheten inte kräver det.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 id="uppgifter-rubrik">Vilka uppgifter vi behandlar, varför och hur länge</h2>
          <p>
            Den som bara läser landningssidan, den här sidan eller Om Kuggfri lämnar inga personuppgifter. För den
            som skapar konto behandlar vi följande. ”Berättigat intresse”
            betyder artikel 6.1 f i dataskyddsförordningen, ”avtal” artikel 6.1 b och ”samtycke” artikel 6.1 a.
          </p>
          {/* Tabellen rullar i sidled på smala skärmar; tabIndex gör att det går med tangentbordet. */}
          <Card padding="none" className="overflow-x-auto" role="region" aria-labelledby="uppgifter-rubrik" tabIndex={0}>
            <table className="w-full min-w-[40rem] text-sm leading-normal">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Uppgift
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Varför
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Rättslig grund
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Hur länge
                  </th>
                </tr>
              </thead>
              <tbody>
                <Row
                  what="E-postadress"
                  why="Inloggning, återställning av lösenord och för att kunna nå dig om kontot."
                  basis="Avtal"
                  retention="Tills du raderar kontot"
                />
                <Row
                  what="Namn"
                  why="Visas för dig själv i appen och i mejl vi skickar. Syns inte för andra."
                  basis="Avtal"
                  retention="Tills du raderar kontot"
                />
                <Row
                  what="Lösenord"
                  why="Inloggning. Lagras aldrig i klartext utan som en kryptografisk hash hos vår databasleverantör."
                  basis="Avtal"
                  retention="Tills du raderar kontot"
                />
                <Row
                  what="Studieprogress per kort"
                  why="Algoritmens tillstånd (nästa repetitionsdatum, stabilitet, svårighet, antal repetitioner) och din senaste skattning 1–5. Utan den kan vi inte schemalägga dina repetitioner."
                  basis="Avtal"
                  retention="Tills du raderar kontot eller nollställer progressen"
                />
                <Row
                  what="Repetitionshistorik"
                  why="En rad per skattning med tidpunkt och läge. Ger dig dina egna diagram och underlag för kursens anonyma statistik."
                  basis="Avtal"
                  retention="Tills du raderar kontot eller nollställer progressen"
                />
                <Row
                  what="Studiesessioner"
                  why="När en session började och slutade, vilken kurs och hur många kort. Ger dig din statistik."
                  basis="Avtal"
                  retention="Tills du raderar kontot"
                />
                <Row
                  what="Felrapporter du skickar"
                  why="Din text, vilket kort det gäller och tidpunkten, så att kursens examinator kan rätta felet. E-post för svar är frivillig."
                  basis="Berättigat intresse (rätta fel i kursmaterialet)"
                  retention="Kontaktuppgiften raderas efter 180 dagar; åtgärdade rapporter raderas automatiskt efter 180 dagar"
                />
                <Row
                  what="Inställningar för mejl"
                  why="Om du vill ha påminnelser, och för examinatorer om de vill ha veckobrevet."
                  basis="Samtycke"
                  retention="Tills du ändrar valet eller raderar kontot"
                />
                <Row
                  what="Logg över skickade mejl"
                  why="Ämnesrad och tidpunkt, så att vi inte skickar samma mejl två gånger. Innehåller inte mejlets text."
                  basis="Berättigat intresse (undvika dubbla utskick)"
                  retention="90 dagar, raderas sedan automatiskt"
                />
              </tbody>
            </table>
          </Card>
          <p>
            Vi samlar inte in namn, personnummer, telefonnummer, studentnummer eller IP-adresser för profilering. Vi
            använder inte automatiserat beslutsfattande som har rättsliga följder för dig. Schemaläggningen av kort
            är en beräkning som bara påverkar vilka kort du får se.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Det som sparas i din egen webbläsare</h2>
          <p>
            Några bekvämligheter sparas bara lokalt i webbläsaren på den enhet du använder, under följande nycklar i{" "}
            <em>localStorage</em>. De skickas inte till oss.
          </p>
          <ul>
            <li>
              <code>kuggfri:progress:v1</code> och <code>kuggfri:reviews:v1</code> – progress och repetitioner från
              tiden då Kuggfri gick att använda utan konto. Finns de kvar flyttas de till ditt konto nästa gång du
              loggar in och tas sedan bort ur webbläsaren.
            </li>
            <li>
              <code>kuggfri:prefs:v1</code> – hur många nya kort per dag du valt och om du pluggar helst på vardagar.
            </li>
            <li>
              <code>kuggfri:outbox:v1</code> – skattningar som inte kunnat sparas på grund av dålig anslutning, tills
              de skickats.
            </li>
            <li>
              <code>kuggfri:theme</code> – ditt val av ljust eller mörkt läge.
            </li>
            <li>
              <code>kuggfri:sidebar</code> – om du fällt ihop sidomenyn.
          </li>
          <li>
            <code>kuggfri:sound</code> – om du stängt av ljudet när du skattar kort.
          </li>
          <li>
            <code>kuggfri:stars:v1</code> – vilka kort du har stjärnmärkt.
            </li>
          </ul>
          <p>Allt detta försvinner om du rensar webbplatsdata.</p>
        </section>

        <section className={sectionClass}>
          <h2>Mejl vi skickar</h2>
          <ul>
            <li>
              <strong>Inloggning och återställning.</strong> Bekräftelselänkar och länk för nytt lösenord, när du
              själv begär dem.
            </li>
            <li>
              <strong>Påminnelser.</strong> Avstängda som standard. Slår du på dem under <Link href="/konto">Konto</Link>{" "}
              får du högst ett mejl per dag, bara när du har kort att repetera, inget efter kursens tenta, och inget
              alls efter två veckor utan repetition. Du kan stänga av dem när som helst.
            </li>
            <li>
              <strong>Veckobrev till examinatorer.</strong> Bara för den som är examinator för en kurs, med kursens
              sammanställda statistik. Kan stängas av under Konto.
            </li>
          </ul>
          <p>
            Vi mäter inte om du öppnar ett mejl. Det finns inga spårpixlar och inga klicklänkar som går via någon
            mätning. Vi skickar aldrig nyhetsbrev, reklam eller mejl från tredje part.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Statistik till kursens examinator</h2>
          <p>
            Kursansvarig ser en kursöversikt med sammanställd statistik: hur många som börjat, hur många som är
            aktiva, vilka områden som har lägst genomsnittlig skattning, vilka kort flest tycker är svåra, och hur
            långt studenterna kommit. Statistiken innehåller aldrig namn, e-postadresser eller enskilda studenters
            svar. Siffror per kategori eller kort visas först när <strong>minst fem studenter</strong> har skattat,
            så att ingen enskild students svar ska gå att räkna ut. Examinatorn ser bara sin egen kurs.
          </p>
          <p>
            Skickar du en felrapport ser examinatorn din text och, om du valt att lämna den, din e-postadress för
            svar. Rapporten kan alltså knytas till dig om du själv väljer det.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Var uppgifterna finns och vilka som behandlar dem åt oss</h2>
          <p>
            Vi anlitar följande personuppgiftsbiträden. Ingen av dem får använda uppgifterna för egna ändamål, och
            inga uppgifter säljs eller delas för marknadsföring.
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> – databas och inloggning. Projektet ligger i en EU-region (Irland).
            </li>
            <li>
              <strong>Vercel</strong> – drift av webbplatsen. Serverkoden körs i Stockholm.
            </li>
            <li>
              <strong>Hostinger</strong> – e-postutskick: både inloggnings- och bekräftelsemejl och de
              påminnelser och sammanställningar som beskrivs ovan.
            </li>
          </ul>
          <p>
            Leverantörerna är amerikanska företag med verksamhet i EU. Skulle en överföring till tredjeland ske
            inom ramen för deras drift, stödjer den sig på EU-kommissionens standardavtalsklausuler. Kursernas
            innehåll (frågor och svar) versionshanteras hos GitHub, men innehåller inga uppgifter om studenter.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Kakor</h2>
          <p>
            Vi använder ingen analys- eller spårningstjänst och har inga kakor från tredje part. Den enda kakan som
            sätts är sessionskakan som håller dig inloggad, och den sätts först när du loggar in. Den är nödvändig
            för tjänsten, så det behövs ingen samtyckesbanner. Ditt val av färgtema och dina studieinställningar
            ligger i webbläsarens localStorage och skickas aldrig till oss.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Hur vi skyddar uppgifterna</h2>
          <ul>
            <li>All trafik går över HTTPS, och webbplatsen begär att webbläsaren alltid använder det.</li>
            <li>
              Databasen skyddas av åtkomstregler på radnivå (row level security). Varje användare kan bara läsa och
              ändra sina egna rader, och reglerna är täckta av automatiska tester.
            </li>
            <li>Lösenord lagras som hash, aldrig i klartext, och vi ser dem aldrig.</li>
            <li>Ingen anställd eller frivillig har rutinmässig åtkomst till din progress. Statistik nås bara aggregerad.</li>
            <li>
              Säkerhetskopior tas dagligen och förvaras lokalt på en krypterad disk hos den som driver tjänsten. De
              innehåller samma uppgifter som databasen och raderas enligt samma regler.
            </li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2>Dina rättigheter</h2>
          <ul>
            <li>
              <strong>Tillgång och dataportabilitet.</strong> Under <Link href="/konto">Konto</Link> laddar du själv
              ner allt vi har om dig som en JSON-fil, direkt och utan att behöva fråga.
            </li>
            <li>
              <strong>Rättelse.</strong> Namnet ändrar du själv under Konto. Hör av dig för byte av e-postadress.
            </li>
            <li>
              <strong>Radering.</strong> Under Konto raderar du hela kontot: e-post, namn, progress,
              historik och sessioner försvinner omedelbart och går inte att återskapa. Felrapporter du skickat
              behålls för kursens skull, men kopplas bort från dig och kontaktadressen raderas. Du kan också bara
              nollställa progressen och behålla kontot.
            </li>
            <li>
              <strong>Begränsning och invändning.</strong> Du kan invända mot behandling som stöder sig på
              berättigat intresse. Hör av dig, så slutar vi behandla uppgifterna för det ändamålet.
            </li>
            <li>
              <strong>Återkalla samtycke.</strong> Stäng av påminnelser under Konto när du vill. Det påverkar inte
              det som redan skickats.
            </li>
            <li>
              <strong>Klagomål.</strong> Du kan klaga hos Integritetsskyddsmyndigheten (IMY), imy.se.
            </li>
          </ul>
          <p>
            Vi svarar på begäranden så snart vi kan och senast inom en månad. Om du hör av dig behöver vi kunna
            avgöra att det är ditt konto det gäller, så skriv från den adress kontot har.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Om något går fel</h2>
          <p>
            Upptäcker vi en personuppgiftsincident som innebär en risk för dig anmäler vi den till
            Integritetsskyddsmyndigheten inom 72 timmar och berättar för dig om risken är hög. Hittar du själv ett
            säkerhetsproblem är vi tacksamma om du hör av dig i stället för att sprida det; vi svarar och rättar så
            fort vi kan.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Ändringar i den här policyn</h2>
          <p>
            Ändras tjänsten så att behandlingen påverkas uppdaterar vi texten och datumet överst. Vid väsentliga
            ändringar informerar vi dig i appen nästa gång du loggar in.
          </p>
        </section>
      </div>
    </article>
  );
}
