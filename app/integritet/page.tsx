import type { Metadata } from "next";
import Link from "next/link";
import { sv } from "@/lib/i18n/sv";

export const metadata: Metadata = { title: sv.privacy.title };

/**
 * Integritetspolicy. Texten ska alltid beskriva exakt vad appen gör.
 *
 * Regel: läggs en ny tabell med personuppgifter till, eller en ny nyckel i localStorage,
 * ska den beskrivas här OCH i docs/PERSONUPPGIFTER.md OCH tas med i dataexporten
 * (app/api/konto/export/route.ts). Testet i tests/unit/privacy hjälper till att påminna.
 */

const UPDATED = "20 september 2026";

function Row({ what, why, basis, retention }: { what: string; why: string; basis: string; retention: string }) {
  return (
    <tr className="border-b border-line last:border-b-0 align-top">
      <th scope="row" className="py-3 pr-4 text-left font-medium">
        {what}
      </th>
      <td className="py-3 pr-4">{why}</td>
      <td className="py-3 pr-4 text-muted">{basis}</td>
      <td className="py-3 text-muted">{retention}</td>
    </tr>
  );
}

export default function PrivacyPage() {
  return (
    <article className="prose-body mx-auto grid max-w-[46rem] gap-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{sv.privacy.title}</h1>
        <p className="mt-2 text-sm text-muted">Senast uppdaterad: {UPDATED}</p>
      </header>

      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="mt-0">Kort sammanfattning</h2>
        <ul>
          <li>Du kan använda Kuggfri helt utan konto. Då lämnar du inga uppgifter till oss alls.</li>
          <li>Skapar du konto sparar vi din e-postadress, ett valfritt visningsnamn och din studieprogress. Inget annat.</li>
          <li>Vi har ingen analys, inga annonser, inga spårningskakor och inga tredjepartsinloggningar.</li>
          <li>Vi skickar aldrig mejl du inte bett om. Påminnelser är avstängda tills du själv slår på dem.</li>
          <li>Kursens examinator ser bara sammanställd statistik, aldrig enskilda studenters svar.</li>
          <li>Du kan ladda ner allt vi har om dig, och radera kontot helt, själv under <Link href="/konto">Konto</Link>.</li>
        </ul>
      </section>

      <section>
        <h2>Vem ansvarar för dina uppgifter</h2>
        <p>
          Kuggfri drivs ideellt av en student vid Chalmers tekniska högskola, som är personuppgiftsansvarig för
          behandlingen som beskrivs här. Tjänsten är inte en del av Chalmers IT-miljö, och Chalmers är inte
          personuppgiftsansvarig. Kontaktuppgifter finns på <Link href="/om">Om Kuggfri</Link>. Vi har ingen
          utsedd dataskyddsombud, eftersom verksamheten inte kräver det.
        </p>
      </section>

      <section>
        <h2>Vilka uppgifter vi behandlar, varför och hur länge</h2>
        <p>
          Utan konto behandlar vi inga personuppgifter. Med konto behandlar vi följande. ”Berättigat intresse”
          betyder artikel 6.1 f i dataskyddsförordningen, ”avtal” artikel 6.1 b och ”samtycke” artikel 6.1 a.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Uppgift
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Varför
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Rättslig grund
                </th>
                <th scope="col" className="py-2 font-medium">
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
                what="Visningsnamn (valfritt)"
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
                why="När en session började och slutade, vilket deck och hur många kort. Ger dig statistiken på kontosidan."
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
        </div>
        <p>
          Vi samlar inte in namn, personnummer, telefonnummer, studentnummer eller IP-adresser för profilering. Vi
          använder inte automatiserat beslutsfattande som har rättsliga följder för dig. Schemaläggningen av kort
          är en beräkning som bara påverkar vilka kort du får se.
        </p>
      </section>

      <section>
        <h2>Utan konto: det som sparas i din egen webbläsare</h2>
        <p>
          Som gäst skickas ingenting till oss. Din progress sparas lokalt i webbläsaren på den enhet du använder,
          under följande nycklar i <em>localStorage</em>:
        </p>
        <ul>
          <li>
            <code>kuggfri:progress:v1</code> – din progress per kort.
          </li>
          <li>
            <code>kuggfri:reviews:v1</code> – dina repetitioner, som ger dig diagrammen.
          </li>
          <li>
            <code>kuggfri:prefs:v1</code> – hur många nya kort per dag du valt och om du pluggar helst på vardagar.
          </li>
          <li>
            <code>kuggfri:outbox:v1</code> – skattningar som inte kunnat sparas på grund av dålig anslutning, tills
            de skickats. Används bara när du är inloggad.
          </li>
          <li>
            <code>kuggfri:theme</code> – ditt val av ljust eller mörkt läge.
          </li>
        </ul>
        <p>
          Allt detta försvinner om du rensar webbplatsdata. Skapar du senare ett konto flyttas progressen och
          historiken till kontot och tas bort ur webbläsaren.
        </p>
      </section>

      <section>
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

      <section>
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

      <section>
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

      <section>
        <h2>Kakor</h2>
        <p>
          Vi använder ingen analys- eller spårningstjänst och har inga kakor från tredje part. Den enda kakan som
          sätts är sessionskakan som håller dig inloggad, och den sätts först när du loggar in. Den är nödvändig
          för tjänsten, så det behövs ingen samtyckesbanner. Ditt val av färgtema och dina studieinställningar
          ligger i webbläsarens localStorage och skickas aldrig till oss.
        </p>
      </section>

      <section>
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

      <section>
        <h2>Dina rättigheter</h2>
        <ul>
          <li>
            <strong>Tillgång och dataportabilitet.</strong> Under <Link href="/konto">Konto</Link> laddar du själv
            ner allt vi har om dig som en JSON-fil, direkt och utan att behöva fråga.
          </li>
          <li>
            <strong>Rättelse.</strong> Visningsnamn ändrar du själv. Hör av dig för byte av e-postadress.
          </li>
          <li>
            <strong>Radering.</strong> Under Konto raderar du hela kontot: e-post, visningsnamn, progress,
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

      <section>
        <h2>Om något går fel</h2>
        <p>
          Upptäcker vi en personuppgiftsincident som innebär en risk för dig anmäler vi den till
          Integritetsskyddsmyndigheten inom 72 timmar och berättar för dig om risken är hög. Hittar du själv ett
          säkerhetsproblem är vi tacksamma om du hör av dig i stället för att sprida det; vi svarar och rättar så
          fort vi kan.
        </p>
      </section>

      <section>
        <h2>Ändringar i den här policyn</h2>
        <p>
          Ändras tjänsten så att behandlingen påverkas uppdaterar vi texten och datumet överst. Vid väsentliga
          ändringar informerar vi dig i appen nästa gång du loggar in.
        </p>
      </section>
    </article>
  );
}
