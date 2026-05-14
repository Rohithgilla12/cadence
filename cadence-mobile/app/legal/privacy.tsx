import { LegalHeading, LegalParagraph, LegalScreenLayout } from '@/components/legal';

// Plain-language summary of how Cadence handles data, anchored to PRD §15
// "Privacy & data philosophy." The legal-counsel version comes later when
// we leave TestFlight — for now this is the contract we hold ourselves to.
export default function PrivacyScreen() {
  return (
    <LegalScreenLayout title="Privacy" subtitle="What stays with you, what we keep, what we never do.">
      <LegalParagraph>
        Cadence holds your data lightly. The short version: health data stays on your
        device, habit data is yours, and we never sell, share, or look at your
        information for any reason other than making the app work for you.
      </LegalParagraph>

      <LegalHeading>WHAT STAYS ON YOUR PHONE</LegalHeading>
      <LegalParagraph>
        Raw Apple Health samples — heart rate, GPS routes, workout details, sleep
        stages, mindful sessions — are read locally and never uploaded. Only a daily
        rollup (sleep hours, total steps, resting HR, HRV, sleep stage totals) is
        sent to our server so the pattern engine has something to chew on.
      </LegalParagraph>

      <LegalHeading>WHAT WE STORE</LegalHeading>
      <LegalParagraph>
        Your account info (Apple or Google sign-in identifier, display name),
        your habits and daily check-ins, the daily rollups described above, and
        any circles and pacts you choose to share with friends.
      </LegalParagraph>

      <LegalHeading>WHAT WE NEVER DO</LegalHeading>
      <LegalParagraph>
        We don't sell your data. We don't run ads. We don't share habit logs or
        health data with circle members beyond exactly what you opt into per
        habit. We don't use a third party that learns from your data.
      </LegalParagraph>

      <LegalHeading>CIRCLES</LegalHeading>
      <LegalParagraph>
        Inside a circle, the other members see: your display name, the fact that
        you completed a shared habit, and your participation in pacts. They never
        see your other habits, your mood, your sleep, your run pace, or anything
        else from your health data.
      </LegalParagraph>

      <LegalHeading>YOUR DATA, YOUR CALL</LegalHeading>
      <LegalParagraph>
        You can delete your account and everything tied to it in one tap from the
        You tab. Deletion is immediate and cascades through habits, logs, health
        summaries, check-ins, circle memberships, and reactions.
      </LegalParagraph>

      <LegalHeading>CONTACT</LegalHeading>
      <LegalParagraph>
        Questions or corrections: support@cadence.gilla.fun.
      </LegalParagraph>
    </LegalScreenLayout>
  );
}
