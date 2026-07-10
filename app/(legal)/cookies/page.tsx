import { LegalHeader } from "@/components/marketing/LegalHeader";
import { APP_NAME, CONTACT_EMAIL } from "@/lib/legal";

export const metadata = { title: `Cookie policy — ${APP_NAME}` };

export default function CookiesPage() {
  return (
    <article className="legal">
      <LegalHeader title="Cookie policy" />

      <p>
        {APP_NAME} uses only the minimum storage needed to work. We don’t use
        advertising or third-party tracking cookies, and we don’t track you
        across other websites.
      </p>

      <h2>What we store on your device</h2>
      <ul>
        <li>
          <strong>Sign-in session (strictly necessary)</strong> — a cookie that
          keeps you logged in. Without it you can’t use your account.
        </li>
        <li>
          <strong>Preferences</strong> — your theme choice (light/dark) and your
          active baby are stored locally in your browser so the app remembers
          them. These stay on your device.
        </li>
      </ul>

      <h2>Do we need a consent banner?</h2>
      <p>
        Because we only use strictly necessary storage and a preference you set
        yourself — no analytics or advertising — we don’t show a cookie consent
        banner, in line with the Privacy and Electronic Communications
        Regulations (PECR). If we ever add non-essential cookies, we’ll ask for
        your consent first.
      </p>

      <h2>Managing cookies</h2>
      <p>
        You can clear or block cookies in your browser settings, but doing so
        will sign you out and stop {APP_NAME} working properly.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}
