import Link from "next/link";
import { privacy } from "@/lib/i18n/en/info";
import { Card } from "@/components/ui/Card";
import { CONTACTS } from "@/lib/contact";
import { routes } from "@/lib/routes";

/**
 * The privacy policy in English: a faithful translation of the Swedish text in
 * app/(info)/integritet/page.tsx, with the same structure, headings and elements. Shown instead
 * of the Swedish text when the language is English. The Swedish version is authoritative.
 *
 * Rule: every change to the Swedish policy must be made here too, in the same place.
 */

const UPDATED = "2 October 2026";

/** Link in the summary, which sits outside .prose-body and is therefore styled here. */
const summaryLink = "font-medium text-accent underline underline-offset-2 decoration-accent/50 hover:decoration-accent";

/**
 * Body text. The heading's top spacing comes from .prose-body (globals.css) and sits outside
 * Tailwind's layers; only what prose-body does not already control is added here.
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

export function PrivacyEn() {
  return (
    <article className="mx-auto w-full max-w-[46rem] [&_code]:rounded-sm [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]">
      <header className="anim-fade-up mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{privacy.title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated: {UPDATED}</p>
      </header>

      <Card padding="lg" className="anim-fade-up" style={{ ["--i" as string]: 1 }} role="region" aria-labelledby="sammanfattning-rubrik">
        <h2 id="sammanfattning-rubrik" className="text-lg font-bold tracking-tight">
          In brief
        </h2>
        <ul className="mt-4 grid gap-3 leading-relaxed">
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>To study, you create an account. We store your name, your email address and your study progress. Nothing else.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>We have no analytics, no ads and no tracking cookies. You sign in with email and password.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>We only send emails you ask for yourself, such as a sign-in link or a new password. No reminders, no newsletters. Examiners of a course get a weekly summary of the course, which can be turned off.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>The course examiner sees only aggregated statistics, never individual students&apos; answers.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-2 w-2 shrink-0 rounded-full bg-accent" />
            <span>
              You can download everything we hold about you, and delete your account completely, yourself under{" "}
              <Link href={routes.account()} className={summaryLink}>
                Account
              </Link>
              .
            </span>
          </li>
        </ul>
      </Card>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">

        <section className={sectionClass}>
          <h2>Who is responsible for your data</h2>
          <p>
            Kuggfri is run on a non-profit basis by a student at Chalmers University of Technology, who is the
            controller for the processing described here. The service is not part of Chalmers&apos; IT environment,
            and Chalmers is not the controller. Send questions about your data to{" "}
            <a href={`mailto:${CONTACTS.operator.email}`}>{CONTACTS.operator.email}</a> ({CONTACTS.operator.name}). We
            have not appointed a data protection officer, as the activity does not require one.
          </p>
        </section>

        <section className={sectionClass}>
          <h2 id="uppgifter-rubrik">What data we process, why and for how long</h2>
          <p>
            Anyone who only reads the landing page, this page or the About page provides no personal data. For those
            who create an account, we process the following. “Legitimate interest” means Article 6(1)(f) of the
            General Data Protection Regulation (GDPR), “contract” Article 6(1)(b) and “consent” Article 6(1)(a).
          </p>
          {/* The table scrolls sideways on narrow screens; tabIndex makes that possible with the keyboard. */}
          <Card padding="none" className="overflow-x-auto" role="region" aria-labelledby="uppgifter-rubrik" tabIndex={0}>
            <table className="w-full min-w-[40rem] text-sm leading-normal">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Data
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Why
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    Legal basis
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">
                    How long
                  </th>
                </tr>
              </thead>
              <tbody>
                <Row
                  what="Email address"
                  why="Sign-in, password reset and being able to reach you about the account."
                  basis="Contract"
                  retention="Until you delete the account"
                />
                <Row
                  what="Name"
                  why="Shown to you in the app and in emails we send. Not visible to others."
                  basis="Contract"
                  retention="Until you delete the account"
                />
                <Row
                  what="Password"
                  why="Sign-in. Never stored in plain text, but as a cryptographic hash with our database provider."
                  basis="Contract"
                  retention="Until you delete the account"
                />
                <Row
                  what="Study progress per card"
                  why="The algorithm's state (next review date, stability, difficulty, number of reviews) and your latest rating 1–5. Without it we cannot schedule your reviews."
                  basis="Contract"
                  retention="Until you delete the account or reset your progress"
                />
                <Row
                  what="Attempts in exam mode"
                  why="Your answers to a past exam, the marking and your own assessments of the written questions, so that you can see the result and compare your attempts."
                  basis="Contract"
                  retention="Until you delete the account"
                />
                <Row
                  what="Review history"
                  why="One row per rating with time and mode. Gives you your own charts and the basis for the course's anonymous statistics."
                  basis="Contract"
                  retention="Until you delete the account or reset your progress"
                />
                <Row
                  what="Study sessions"
                  why="When a session started and ended, which course and how many cards. Gives you your statistics."
                  basis="Contract"
                  retention="Until you delete the account"
                />
                <Row
                  what="Your email address on the course participant list"
                  why="Courses are open only to the students taking them. The examiner adds the participants' email addresses, and only people on the list can create an account and see the course. Only the address is stored, never names or personal identity numbers."
                  basis="Legitimate interest (the course material may only be accessed by the course participants)"
                  retention="Until the address is removed from the list or the course is removed. If you delete your account, the address stays on the course list, but the link to your account is removed"
                />
                <Row
                  what="Error reports you send"
                  why="Your text, which card it concerns and the time, so that the course examiner can correct the error. An email address for a reply is optional."
                  basis="Legitimate interest (correcting errors in the course material)"
                  retention="The contact details are deleted after 180 days; resolved reports are deleted automatically after 180 days"
                />
                <Row
                  what="Email settings"
                  why="For examiners: whether they want the weekly digest."
                  basis="Consent"
                  retention="Until you change the setting or delete the account"
                />
                <Row
                  what="Language"
                  why="Whether the service is shown in Swedish or English, so that the same language applies on all your devices and in emails we send."
                  basis="Contract"
                  retention="Until you change the setting or delete the account"
                />
                <Row
                  what="Log of sent emails"
                  why="Subject line and time, so that we do not send the same email twice. Does not contain the text of the email."
                  basis="Legitimate interest (avoiding duplicate emails)"
                  retention="90 days, then deleted automatically"
                />
              </tbody>
            </table>
          </Card>
          <p>
            Beyond what is in the table, we collect nothing: no personal identity numbers, phone numbers, student numbers or IP addresses for profiling. We
            do not use automated decision-making that has legal effects for you. The scheduling of cards
            is a calculation that only affects which cards you see.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>What is stored in your own browser</h2>
          <p>
            A few conveniences are stored only locally in the browser on the device you use, under the following keys in{" "}
            <em>localStorage</em>. They are not sent to us.
          </p>
          <ul>
            <li>
              <code>kuggfri:progress:v1</code> and <code>kuggfri:reviews:v1</code>: progress and reviews from the
              time when Kuggfri could be used without an account. If they are still there, they are moved to your
              account the next time you sign in and are then removed from the browser.
            </li>
            <li>
              <code>kuggfri:prefs:v1</code>: how many new cards per day you have chosen and whether you prefer to study on weekdays.
            </li>
            <li>
              <code>kuggfri:outbox:v1</code>: ratings that could not be saved because of a poor connection, until
              they have been sent.
            </li>
            <li>
              <code>kuggfri:theme</code>: your choice of light or dark mode.
            </li>
            <li>
              <code>kuggfri:sidebar</code>: whether you have collapsed the sidebar.
            </li>
            <li>
              <code>kuggfri:sound</code>: whether you have turned off the sound when rating cards.
            </li>
            <li>
              <code>kuggfri:stars:v1</code>: which cards you have starred.
            </li>
            <li>
              <code>kuggfri:passinstallningar:v1</code>: your session settings in each mode, for example
              number of cards and order.
            </li>
          </ul>
          <p>All of this disappears if you clear the site data.</p>
        </section>

        <section className={sectionClass}>
          <h2>Emails we send</h2>
          <ul>
            <li>
              <strong>Sign-in and reset.</strong> Confirmation links, a link for a new password and confirmation
              of a new email address, when you ask for them yourself.
            </li>
            <li>
              <strong>Weekly digest for examiners.</strong> Only for those who are examiners for a course, with the
              course&apos;s aggregated statistics. Can be turned off under Account.
            </li>
          </ul>
          <p>
            We do not measure whether you open an email. There are no tracking pixels and no links routed through
            click tracking. We never send newsletters, advertising or emails from third parties.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Statistics for the course examiner</h2>
          <p>
            The course coordinator sees a course overview with aggregated statistics: how many have started, how many
            are active, which topics have the lowest average rating, which cards most people find difficult, and how
            far the students have got. The statistics never contain names, email addresses or individual students&apos;
            answers. Figures per topic or card are shown only once <strong>at least five students</strong> have
            rated, so that no individual student&apos;s answers can be worked out. The examiner sees only their own course.
          </p>
          <p>
            If you send an error report, the examiner sees your text and, if you have chosen to leave it, your email
            address for a reply. The report can therefore be linked to you, if you choose so.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Where the data is kept and who processes it for us</h2>
          <p>
            We use the following processors. None of them may use the data for their own purposes, and no data is
            sold or shared for marketing.
          </p>
          <ul>
            <li>
              <strong>Supabase</strong>: database and sign-in. The project is in an EU region (Ireland).
            </li>
            <li>
              <strong>Vercel</strong>: hosting of the website. The server code runs in Stockholm.
            </li>
            <li>
              <strong>Hostinger</strong>: sending emails: sign-in and confirmation emails, and the weekly digest
              for examiners described above.
            </li>
          </ul>
          <p>
            <strong>Sign-in with Google</strong> has been turned off since October 2026, because the account should
            belong to the address on the course participant list. Accounts created with Google before then remain and
            sign in with email (choose Forgot password). For them we received the name and email address from Google,
            and a link to the profile picture that is stored in the sign-in system but neither displayed nor used.
          </p>
          <p>
            The providers are American companies with operations in the EU. Should a transfer to a third country take
            place as part of their operations, it relies on the European Commission&apos;s standard contractual
            clauses. The course content (questions and answers) is version-controlled at GitHub, but contains no data
            about students.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Cookies</h2>
          <p>
            We use no analytics or tracking service and have no third-party cookies. The only cookie that is set is
            the session cookie that keeps you signed in, and it is set only when you sign in. It is necessary for the
            service, so no consent banner is needed. Your choice of colour theme and your study settings are kept in
            the browser&apos;s localStorage and are never sent to us.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>How we protect the data</h2>
          <ul>
            <li>All traffic goes over HTTPS, and the website tells browsers to always use it.</li>
            <li>
              The database is protected by row-level access rules (row level security). Each user can only read and
              change their own rows, and the rules are covered by automated tests.
            </li>
            <li>Passwords are stored as a hash, never in plain text, and we never see them.</li>
            <li>No employee or volunteer has routine access to your progress. Statistics are only accessed in aggregate.</li>
            <li>
              Backups are taken daily and kept locally on an encrypted disk with the person who runs the service. They
              contain the same data as the database and are deleted according to the same rules.
            </li>
          </ul>
        </section>

        <section className={sectionClass}>
          <h2>Your rights</h2>
          <ul>
            <li>
              <strong>Access and data portability.</strong> Under <Link href={routes.account()}>Account</Link> you download
              everything we hold about you as a JSON file yourself, straight away and without having to ask.
            </li>
            <li>
              <strong>Rectification.</strong> You change your name yourself under Account. Get in touch to change your email address.
            </li>
            <li>
              <strong>Erasure.</strong> Under Account you delete the whole account: email, name, progress,
              history and sessions disappear immediately and cannot be restored. Error reports you have sent
              are kept for the sake of the course, but are unlinked from you and the contact address is deleted. You can also
              just reset your progress and keep the account.
            </li>
            <li>
              <strong>Restriction and objection.</strong> You can object to processing that relies on
              legitimate interest. Get in touch, and we will stop processing the data for that purpose.
            </li>
            <li>
              <strong>Withdrawing consent.</strong> Examiners turn off the weekly digest under Account whenever they
              like. This does not affect what has already been sent.
            </li>
            <li>
              <strong>Complaints.</strong> You can lodge a complaint with the Swedish Authority for Privacy Protection (IMY), imy.se.
            </li>
          </ul>
          <p>
            We respond to requests as soon as we can and within one month at the latest. If you get in touch, we need
            to be able to verify that it is your account, so write from the email address of your account.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>If something goes wrong</h2>
          <p>
            If we discover a personal data breach that poses a risk to you, we report it to the Swedish Authority for
            Privacy Protection (IMY) within 72 hours and tell you if the risk is high. If you find a security problem
            yourself, we would be grateful if you got in touch instead of spreading it; we will respond and fix it as
            quickly as we can.
          </p>
        </section>

        <section className={sectionClass}>
          <h2>Changes to this policy</h2>
          <p>
            If the service changes in a way that affects the processing, we update the text and the date at the top. In the
            case of significant changes, we inform you in the app the next time you sign in.
          </p>
        </section>

        {/* Short summary that Google's review of Google sign-in looks for, kept from the Swedish page.
            The Swedish text is the authoritative version. */}
        <section className={sectionClass} data-testid="privacy-english">
          <h2>Summary</h2>
          <p>
            Kuggfri is a free, ad-free flashcard service for Chalmers courses, run on a non-profit basis by a Chalmers
            student. We store your name, email address and your study progress so that the app can schedule your
            reviews. We never sell or share your data for marketing, and we only send emails you ask for (sign-in and
            confirmation links).
          </p>
          <p>
            <strong>Google sign-in</strong> has been turned off since October 2026. For accounts created with Google
            before then, we received the name, email address and a link to the profile picture from Google. We use
            the name and email address only to identify the Kuggfri account; the picture link is stored by the
            sign-in system but not displayed or used. We do not use Google data for advertising and do not transfer
            it to anyone else. Kuggfri&apos;s use of information received from Google APIs adheres to the Google API
            Services User Data Policy, including the Limited Use requirements.
          </p>
          <p>
            You can download or delete all your data at any time under Account. Questions:{" "}
            <a href={`mailto:${CONTACTS.operator.email}`}>{CONTACTS.operator.email}</a>. This page is a translation; the
            Swedish version of this policy is the authoritative version.
          </p>
        </section>
      </div>
    </article>
  );
}
