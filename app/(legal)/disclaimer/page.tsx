import { LegalHeader } from "@/components/marketing/LegalHeader";
import { APP_NAME } from "@/lib/legal";

export const metadata = { title: `Medical disclaimer — ${APP_NAME}` };

export default function DisclaimerPage() {
  return (
    <article className="legal">
      <LegalHeader title="Medical disclaimer" />

      <p>
        <strong>
          {APP_NAME} is a tracking aid to help you record and make sense of your
          baby’s day-to-day patterns. It is not medical advice, diagnosis or
          treatment, and it is not a medical device.
        </strong>
      </p>

      <h2>Not a substitute for professional care</h2>
      <p>
        Nothing in {APP_NAME} replaces the judgement of a qualified healthcare
        professional. Always follow the guidance of your midwife, health
        visitor, GP or other clinician, and speak to them about any question or
        concern regarding your baby’s or your own health. Never delay seeking
        advice, or disregard advice you’ve been given, because of something you
        have read or seen in {APP_NAME}.
      </p>

      <h2>Expected ranges are general guidance</h2>
      <p>
        The “expected” nappy counts, colours, feed frequencies and weight
        ranges shown in {APP_NAME} are drawn from general, publicly available
        newborn guidance (for example NCT and NHS material). They are typical
        patterns, not personalised medical targets. Every baby is different, and
        being outside a range is often completely normal.
      </p>

      <h2>Automated labels and summaries</h2>
      <p>
        Some features use artificial intelligence to label nappy photos and to
        answer questions about your logged data. These outputs are estimates and
        can be wrong. They do not constitute a clinical assessment. {APP_NAME}{" "}
        deliberately avoids giving an “all clear”, and highlights things worth
        checking (such as pale, chalky or white stools, or blood) — but the
        absence of a flag does not mean everything is fine. Always use your own
        judgement and check the labels yourself.
      </p>

      <h2>If you are worried</h2>
      <p>
        If you are concerned about your baby or yourself, contact your midwife,
        health visitor or GP, or call <strong>NHS 111</strong>. In an emergency,
        or if your baby is seriously unwell, call <strong>999</strong> or go to
        your nearest A&amp;E. Trust your instincts — you know your baby best.
      </p>

      <h2>No professional relationship</h2>
      <p>
        Using {APP_NAME} does not create a doctor–patient or any other
        professional relationship between you and the operator of {APP_NAME}.
        You are responsible for any decisions you make, and we accept no
        liability for decisions made in reliance on the app to the extent
        permitted by law (see our Terms).
      </p>
    </article>
  );
}
