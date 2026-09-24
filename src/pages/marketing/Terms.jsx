import React, { useEffect } from 'react';
import MarketingShell from '@/components/marketing/MarketingShell';

const SECTIONS = [
  {
    title: '1. The service',
    body: [
      'BlockWard lets organisations verify achievements and issue portable, independently checkable credentials to their members, and gives members a public profile of those credentials. By using BlockWard — as an organisation, a member, or the public verification tool — you agree to these terms.',
      'These terms are an agreement between you and [COMPANY LEGAL NAME] ("BlockWard", "we", "us"). They are governed by the laws of [GOVERNING LAW JURISDICTION], and the courts of [GOVERNING LAW JURISDICTION] have exclusive jurisdiction over disputes arising from them.',
    ],
  },
  {
    title: '2. Eligibility and parental consent',
    body: [
      'You must be at least 13 years old to create a BlockWard account. Members under 18 need permission from a parent or guardian, as their local law requires. Accounts for members under 13 stay locked until a parent or guardian consents through the link we email them, and profiles for members under 16 default to private visibility. Organisations are responsible for obtaining whatever consent their local law requires before adding a member or recording their achievements.',
    ],
  },
  {
    title: '3. Organisations and authority',
    body: [
      'When you connect an organisation to BlockWard, you confirm you are authorised to act for it, and that it is authorised (by the relevant federation, governing body, or institution) to verify the kinds of achievements you issue. Credentials you issue through BlockWard are your organisation\'s statements, backed by the named signers on each record. BlockWard provides the recording and verification infrastructure — it does not vouch for the underlying truth of any achievement.',
    ],
  },
  {
    title: '4. Honest use',
    body: [
      'Only verify achievements that actually happened, as accurately as you can. Creating fake or inflated credentials, impersonating signers, or automating sign-offs undermines every other member\'s records — it is grounds for removal from the platform and, where a credential was issued, its permanent public revocation. Revocation is visible on the verification page by design.',
    ],
  },
  {
    title: '5. Members',
    body: [
      'Keep your account credentials to yourself, submit only evidence you have the right to share, and don\'t misrepresent your role or organisation. Your handle and profile content are your responsibility; we may reserve or remove handles that impersonate others.',
    ],
  },
  {
    title: '6. The verification tool',
    body: [
      'The public verification tool reports the state of a credential in our records at the time you check it, including its signer chain and public-ledger anchor. It is provided as-is for information. It is a powerful check on credential authenticity, but it is not a legal certification, a background check, or a substitute for your own admission or hiring diligence.',
    ],
  },
  {
    title: '7. Corrections, revocations and the record',
    body: [
      'Verified credentials cannot be quietly edited after approval: their content is fingerprinted and anchored on a public ledger, so any change is detectable. If an achievement turns out to be wrong, the fix is visible — a correction that lands as a new, re-signed version of the record (with the old version retained), or a permanent revocation shown on the verification page. Organisations should verify carefully before final approval. Think of the record as ink, not pencil.',
    ],
  },
  {
    title: '8. Beta and testnet',
    body: [
      'BlockWard is currently in beta. Features may change, and some are disabled while we finish them. During beta, blockchain anchors are written to the Sepolia TESTNET: the anchors are real on-chain transactions, but on a test network — they must not be represented as mainnet registrations or certificates of title.',
    ],
  },
  {
    title: '9. Intellectual property',
    body: [
      'You keep all rights to the achievements, evidence and content you submit. You grant BlockWard the licence needed to store it, display it on the pages you have chosen, and show it on verification pages. The BlockWard platform, name and design belong to us.',
    ],
  },
  {
    title: '10. Disclaimers and liability',
    body: [
      'We work hard to keep the service available and accurate, but the service is provided "as is" without warranty of uninterrupted availability. To the extent permitted by law, BlockWard is not liable for indirect or consequential damages arising from use of the service, and our total liability is limited to the fees you paid us in the twelve months before the claim (which for free accounts is zero).',
    ],
  },
  {
    title: '11. Termination and changes',
    body: [
      'You can stop using BlockWard at any time; organisations can be deactivated by their admins. We may suspend accounts that violate these terms. If we change these terms materially, we will notify members in the app. Continued use after that means you accept the update.',
    ],
  },
  {
    title: '12. Contact',
    body: [
      'Questions about these terms go through the contact page. For security issues use the "Security report" topic; for data and privacy requests use "Privacy / data request".',
    ],
  },
];

export default function Terms() {
  useEffect(() => { document.title = 'Terms of Service — BlockWard'; }, []);

  return (
    <MarketingShell
      title="Terms of Service"
      subtitle="The deal, in plain language. Last updated: September 2026. Operated by [COMPANY LEGAL NAME] · Governing law: [GOVERNING LAW JURISDICTION] · Draft — pending legal review."
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