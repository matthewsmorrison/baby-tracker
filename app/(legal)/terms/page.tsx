import { LegalHeader } from "@/components/marketing/LegalHeader";
import {
  APP_NAME,
  CONTACT_EMAIL,
  GOVERNING_LAW,
  OPERATOR,
  OPERATOR_STATUS,
} from "@/lib/legal";

export const metadata = { title: `Terms of service — ${APP_NAME}` };

export default function TermsPage() {
  return (
    <article className="legal">
      <LegalHeader title="Terms of service" />

      <p>
        These terms govern your use of {APP_NAME}, operated by {OPERATOR},{" "}
        {OPERATOR_STATUS}. By creating an account or using {APP_NAME}, you agree
        to them.
      </p>

      <h2>Who can use it</h2>
      <p>
        You must be 18 or over and the parent or carer of the baby whose
        information you record (or acting with their parent’s permission). You’re
        responsible for anyone you invite to a baby, and for the information they
        add.
      </p>

      <h2>Not medical advice</h2>
      <p>
        <strong>
          {APP_NAME} is a tracking aid, not medical advice, diagnosis or
          treatment, and not a medical device.
        </strong>{" "}
        Expected ranges are general guidance, and automated labels and answers
        can be wrong. Always rely on your midwife, health visitor or doctor for
        medical decisions, and seek urgent help if you are worried. Please read
        our <a href="/disclaimer">medical disclaimer</a>, which forms part of
        these terms.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your sign-in secure and give accurate information. You’re
        responsible for activity under your account. Tell us promptly if you
        think it’s been accessed without your permission.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>Use {APP_NAME} only for its intended, lawful purpose.</li>
        <li>
          Don’t upload other people’s personal data without the right to do so;
          take nappy photos only, and avoid capturing identifiable images of
          your baby or others where you can.
        </li>
        <li>
          Don’t attempt to break, overload, reverse-engineer or misuse the
          service, or use it to build a competing product.
        </li>
      </ul>

      <h2>Bea, the AI assistant</h2>
      <p>
        Bea answers questions from the data you’ve logged and from general,
        publicly available guidance. Her answers are not a clinical assessment,
        may be inaccurate, and must be checked by you. Don’t rely on them for
        medical decisions.
      </p>

      <h2>Availability and changes</h2>
      <p>
        {APP_NAME} is provided “as is” and “as available”, free of charge. We may
        change, suspend or discontinue features, and we don’t guarantee it will
        always be available or error-free.
      </p>

      <h2>Liability</h2>
      <p>
        To the fullest extent permitted by law, we are not liable for any loss
        arising from your use of, or reliance on, {APP_NAME}, including any
        health decisions. <strong>Nothing in these terms limits or excludes our
        liability where it would be unlawful to do so</strong> — including
        liability for death or personal injury caused by negligence, or for
        fraud. Because {APP_NAME} is a free, non-clinical tool, you should not
        rely on it as a source of medical safety.
      </p>

      <h2>Your content</h2>
      <p>
        You keep ownership of the data you enter. You grant us the limited
        permission needed to store and process it to run the service for you (as
        described in our <a href="/privacy">privacy policy</a>). You can delete
        it at any time.
      </p>

      <h2>Ending your use</h2>
      <p>
        You can stop using {APP_NAME} and delete your account at any time. We may
        suspend or end access if these terms are breached.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by {GOVERNING_LAW}, and disputes are subject to
        the exclusive jurisdiction of its courts.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms? Email{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </article>
  );
}
