import type { Metadata } from "next";
import Link from "next/link";
import { sv } from "@/lib/i18n/sv";

export const metadata: Metadata = { title: sv.privacy.title };

/**
 * Integritetspolicy. Texten beskriver exakt vad appen gör. Uppdatera den om
 * datamodellen eller lagringen ändras.
 */
export default function PrivacyPage() {
  return (
    <article className="prose-body grid gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{sv.privacy.title}</h1>
        <p className="mt-2 text-sm text-muted">Senast uppdaterad: 11 september 2026</p>
      </header>

      <section>
        <h2>Vem ansvarar för dina uppgifter</h2>
        <p>
          Plugget drivs ideellt av en student vid Chalmers och är personuppgiftsansvarig för de uppgifter som
          beskrivs här. Kontaktuppgifter finns på sidan <Link href="/om">Om Plugget</Link>.
        </p>
      </section>

      <section>
        <h2>Vilka uppgifter vi behandlar</h2>
        <p>Du kan använda Plugget helt utan konto. Då lämnar du inga personuppgifter till oss alls.</p>
        <p>Om du väljer att skapa ett konto behandlar vi följande:</p>
        <ul>
          <li>
            <strong>E-postadress.</strong> Används för inloggning (lösenord eller inloggningslänk) och för att
            kunna nå dig om ditt konto. Vi skickar inga nyhetsbrev.
          </li>
          <li>
            <strong>Visningsnamn (valfritt).</strong> Ett namn du själv väljer. Det visas bara för dig.
          </li>
          <li>
            <strong>Studieprogress.</strong> För varje kort du repeterar sparar vi när det ska repeteras nästa
            gång, algoritmens tillstånd (stabilitet, svårighet, antal repetitioner) och din senaste
            självskattning 1–5. Vi sparar också när en studiesession startade och slutade, vilket deck den gällde
            och hur många kort du gick igenom.
          </li>
        </ul>
        <p>Vi samlar inte in namn, personnummer, telefonnummer, IP-adress för profilering eller något annat.</p>
      </section>

      <section>
        <h2>Utan konto: lagring i din webbläsare</h2>
        <p>
          Som gäst sparas din progress endast i din egen webbläsare (localStorage) på den enhet du använder. Den
          skickas aldrig till oss. Den försvinner om du rensar webbplatsdata. Skapar du senare ett konto flyttas den
          lokala progressen till kontot och tas bort från webbläsaren.
        </p>
      </section>

      <section>
        <h2>Rättslig grund</h2>
        <p>
          Behandlingen sker för att fullgöra avtalet med dig om att tillhandahålla tjänsten (artikel 6.1 b GDPR):
          utan e-post kan vi inte logga in dig, och utan studieprogress kan vi inte schemalägga dina repetitioner.
          Statistik för att förbättra korten bygger på aggregerade och avidentifierade värden (artikel 6.1 f,
          berättigat intresse).
        </p>
      </section>

      <section>
        <h2>Lagringstid</h2>
        <p>
          Uppgifterna sparas så länge ditt konto finns. Du kan när som helst radera kontot under{" "}
          <Link href="/konto">Konto</Link>; då raderas e-post, visningsnamn, all progress och alla sessioner
          omedelbart och fullständigt. Konton som inte använts på 24 månader kan raderas av oss.
        </p>
      </section>

      <section>
        <h2>Var uppgifterna lagras</h2>
        <p>
          Databasen och inloggningen tillhandahålls av Supabase och ligger i en datacenterregion inom EU.
          Webbplatsen levereras via Vercel. Inga uppgifter säljs eller delas med tredje part för marknadsföring.
        </p>
      </section>

      <section>
        <h2>Kakor och spårning</h2>
        <p>
          Vi använder ingen analys- eller spårningstjänst. Den enda kakan som sätts är sessionskakan som håller dig
          inloggad, och den sätts först när du loggar in. Därför behövs ingen samtyckesbanner. Ditt val av
          färgtema sparas i webbläsarens localStorage och skickas aldrig till oss.
        </p>
      </section>

      <section>
        <h2>Dina rättigheter</h2>
        <ul>
          <li>
            <strong>Tillgång och dataportabilitet.</strong> Under <Link href="/konto">Konto</Link> kan du ladda ner
            allt vi har om dig som en JSON-fil.
          </li>
          <li>
            <strong>Rättelse.</strong> Du kan ändra ditt visningsnamn själv. Kontakta oss för byte av e-postadress.
          </li>
          <li>
            <strong>Radering.</strong> Radera kontot själv under Konto. Du kan också nollställa din progress utan att
            radera kontot.
          </li>
          <li>
            <strong>Klagomål.</strong> Du har rätt att klaga hos Integritetsskyddsmyndigheten (IMY).
          </li>
        </ul>
      </section>
    </article>
  );
}
