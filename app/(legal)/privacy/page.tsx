import { LegalHeader } from "@/components/marketing/LegalHeader";
import {
  APP_NAME,
  CONTACT_EMAIL,
  OPERATOR,
  OPERATOR_LOCATION,
  OPERATOR_STATUS,
} from "@/lib/legal";

export const metadata = { title: `Privacy policy — ${APP_NAME}` };

export default function PrivacyPage() {
  return (
    <article className="legal">
      <LegalHeader title="Privacy policy" />

      <p>
        This policy explains what personal data {APP_NAME} (“we”, “us”) collects,
        why, and your rights over it. It is written to meet the UK GDPR and the
        Data Protection Act 2018.
      </p>

      <h2>Who is responsible for your data</h2>
      <p>
        {APP_NAME} is operated by {OPERATOR}, {OPERATOR_STATUS} based in{" "}
        {OPERATOR_LOCATION}, who is the “data controller” for the personal data
        described here. You can contact us about privacy at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>The data we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your email address, and (if you
          sign in with Google) your name and profile email.
        </li>
        <li>
          <strong>Baby profile</strong> — the name, date and time of birth and
          birth weight you enter, and settings such as feed intervals.
        </li>
        <li>
          <strong>Care logs (health data)</strong> — feeds, nappies (including
          any photos you take), weights, sleep, pumping, notes, and the
          mother’s medication. Some of this is “special category” health data
          about your baby and, where you record it, about the mother.
        </li>
        <li>
          <strong>Notifications</strong> — if you enable them, a push
          subscription for your device.
        </li>
        <li>
          <strong>Technical data</strong> — a sign-in session cookie and basic
          information needed to run and secure the service.
        </li>
      </ul>

      <h2>How we use it, and our lawful bases</h2>
      <ul>
        <li>
          <strong>To provide the service</strong> (store and show your logs,
          share with carers you invite) — on the basis of our{" "}
          <strong>contract</strong> with you (our Terms).
        </li>
        <li>
          <strong>Health data and optional features</strong> (recording care
          logs, AI photo labelling, the Ask assistant, and notifications) — on
          the basis of your <strong>explicit consent</strong>, which you give by
          choosing to use them and can withdraw at any time by turning them off
          or deleting your data.
        </li>
        <li>
          <strong>Keeping the service secure and working</strong> — on the basis
          of our <strong>legitimate interests</strong>.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        We do not sell your data or use it for advertising. We share it only
        with the service providers that run {APP_NAME} on our behalf
        (“processors”):
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — database, authentication and photo
          storage (hosted in the EU).
        </li>
        <li>
          <strong>Anthropic</strong> — powers the AI photo labelling and the Ask
          assistant. When you use these features, the relevant photo or text
          from your logs is sent to Anthropic to generate a response. It is not
          used to train their models.
        </li>
        <li>
          <strong>Vercel</strong> — hosts and serves the application.
        </li>
      </ul>
      <p>
        We also share your baby’s data with the carers you explicitly invite.
      </p>

      <h2>International transfers</h2>
      <p>
        Some providers (for example Anthropic) process data outside the UK/EEA.
        Where that happens, appropriate safeguards such as the UK International
        Data Transfer Agreement or Standard Contractual Clauses are relied upon
        to protect your data.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data for as long as your account is active. You can delete
        individual entries, a baby and all its data, or your whole account at
        any time from within the app; deletion removes the data from our live
        systems, and from routine backups within a short period afterwards.
      </p>

      <h2>Your rights</h2>
      <p>Under UK data protection law you have the right to:</p>
      <ul>
        <li>access a copy of your data (the app also lets you export it);</li>
        <li>have inaccurate data corrected;</li>
        <li>have your data erased;</li>
        <li>restrict or object to certain processing;</li>
        <li>data portability;</li>
        <li>withdraw consent at any time.</li>
      </ul>
      <p>
        To exercise any of these, email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You also have the
        right to complain to the Information Commissioner’s Office (ICO) at{" "}
        <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
          ico.org.uk
        </a>
        , though we’d appreciate the chance to help first.
      </p>

      <h2>Children’s data</h2>
      <p>
        {APP_NAME} is for use by adults (18 or over) who are the parent or carer
        of the baby whose information is recorded. The data about the baby is
        provided and controlled by you as their parent or carer. The service is
        not intended for use by children.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit, access is restricted by row-level security
        so you and your invited carers only see your own baby’s data, and photos
        are held in private storage. No system is perfectly secure, so we cannot
        guarantee absolute security.
      </p>

      <h2>Changes</h2>
      <p>
        We may update this policy from time to time; the “last updated” date
        above shows when. Material changes will be highlighted in the app.
      </p>
    </article>
  );
}
