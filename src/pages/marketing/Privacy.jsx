import React, { useEffect } from 'react';
import MarketingShell from '@/components/marketing/MarketingShell';

const SECTIONS = [
  {
    title: '1. Who we are',
    body: [
      'BlockWard is a platform that lets schools, clubs, academies and other organisations verify achievements and issue permanent, independently checkable credentials to their members. This policy explains what data we collect, why, and the control you have over it.',
      'When we say "organisation", we mean the school, club, academy or employer that uses BlockWard to issue credentials. When we say "you", we mean a member — usually a student — or a person using our public verification tool.',
    ],
  },
  {
    title: '2. What we collect',
    body: [
      'Account data: your name, email address, and the role your organisation gives you. If you are a student, your organisation may also record your year or grade level and parent/guardian contact details for school communication.',
      'Achievement data: the title, description, date, category and evidence you (or your organisation) submit for verification. Evidence files are stored with restricted access, and evidence is only shown on public pages when the student has chosen to publish it.',
      'Credential records: once an achievement is verified, a permanent public record is created containing the credential details, the issuing organisation, and each signer\'s name, role, verification method and timestamp. These records cannot be edited or deleted — that permanence is the product.',
      'Usage data: we keep basic technical logs (for example, which public credential was checked, and when) to operate the service and report aggregate platform statistics. We do not run advertising trackers.',
    ],
  },
  {
    title: '3. What is public — and what you control',
    body: [
      'Verified credentials are shown on public verification pages, because third-party verification is the entire purpose of the product. These pages deliberately exclude your email address, phone number and private notes.',
      'Your public profile is under your control. You choose whether it is public, link-only, or private, and you can withdraw individual credentials from the profile grid without revoking the underlying record.',
      'For team credentials, you appear on the shared team record only after you accept. Declining removes you from the public team page entirely.',
    ],
  },
  {
    title: '4. Students and minors',
    body: [
      'Most BlockWard members are students, many under 18. Organisations are responsible for obtaining the consent their local law requires (typically from a parent or guardian) before adding a student and recording their achievements. We never publish a minor\'s contact details anywhere public, and public profiles show only the display name the student and their organisation have chosen.',
    ],
  },
  {
    title: '5. Email',
    body: [
      'We send you email about things that directly concern your record: verification updates, invitations, and the notification types you have enabled. Every notification type can be switched off individually in your settings, including email per type. We do not send marketing email to members.',
    ],
  },
  {
    title: '6. Data sharing',
    body: [
      'We never sell your data, and we do not share it with advertisers or data brokers. We share data only to run the service: the credential data shown on public verification pages, invitations sent by organisations you are invited to, and infrastructure providers who host and store the service under contract.',
      'If the law requires us to disclose information, we will — but permanent, public credential records cannot be "unpublished" on request without losing the integrity that makes them worth anything. Choose what you verify accordingly.',
    ],
  },
  {
    title: '7. Retention',
    body: [
      'Account and profile data is kept while your account is active. Verified credential records are permanent by design — that is stated on every marketing page and here. You can make your profile private or deactivate your account, which hides your profile, but the cryptographic record of issued credentials remains verifiable. This is the deal, stated plainly.',
    ],
  },
  {
    title: '8. Your rights',
    body: [
      'You can correct your profile details, change your handle (old links redirect), change your profile and per-credential visibility, adjust notification preferences, and request deletion of your account and non-credential personal data. Where you live, you may have additional rights (access, portability, objection); contact us and we will help.',
    ],
  },
  {
    title: '9. Changes and contact',
    body: [
      'If this policy changes materially, we will notify members in the app. Questions or requests: use the contact page and we will route it to the right person.',
    ],
  },
];

export default function Privacy() {
  useEffect(() => { document.title = 'Privacy Policy — BlockWard'; }, []);

  return (
    <MarketingShell
      title="Privacy Policy"
      subtitle="Written in plain language. Last updated: September 2026."
    >
      <section className="py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-10">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <h2 className="text-lg font-semibold text-foreground mb-3">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-3">{p}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}