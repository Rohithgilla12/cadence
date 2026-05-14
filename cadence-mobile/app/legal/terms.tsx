import { LegalHeading, LegalParagraph, LegalScreenLayout } from '@/components/legal';

export default function TermsScreen() {
  return (
    <LegalScreenLayout title="Terms" subtitle="The basics of using Cadence.">
      <LegalParagraph>
        By using Cadence you agree to the following. We'll keep them short
        because nobody reads long terms and it's better that you actually
        understand what you've signed up for.
      </LegalParagraph>

      <LegalHeading>WHAT CADENCE IS</LegalHeading>
      <LegalParagraph>
        A habit tracker with context-aware analytics, built for runners first
        and for anyone who appreciates a quiet, observational approach to
        keeping a rhythm.
      </LegalParagraph>

      <LegalHeading>WHAT IT ISN'T</LegalHeading>
      <LegalParagraph>
        Not a medical device, not a coach, not a substitute for advice from
        anyone qualified to give it. The patterns we surface are observational
        — "you do X more often when Y" — not prescriptive.
      </LegalParagraph>

      <LegalHeading>YOUR ACCOUNT</LegalHeading>
      <LegalParagraph>
        You sign in via Apple or Google. You're responsible for your account
        and the actions taken from it. Don't share your sign-in. If you spot
        unusual activity, sign out and contact us.
      </LegalParagraph>

      <LegalHeading>CIRCLES</LegalHeading>
      <LegalParagraph>
        Be a good circle member. No harassment, no impersonation. We can
        remove anyone from a circle or from the service for violating that.
      </LegalParagraph>

      <LegalHeading>CHANGES</LegalHeading>
      <LegalParagraph>
        If we change anything material in these terms, we'll surface it in
        the app before applying it. Continued use after that counts as
        acceptance.
      </LegalParagraph>

      <LegalHeading>NO WARRANTY</LegalHeading>
      <LegalParagraph>
        Cadence is provided as-is. We try hard not to lose your data — Phase 1
        of the build includes daily backups — but software has bugs. Use
        Cadence as a companion, not a single source of truth.
      </LegalParagraph>
    </LegalScreenLayout>
  );
}
