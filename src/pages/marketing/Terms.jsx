import React, { useEffect } from 'react';
import MarketingShell from '@/components/marketing/MarketingShell';

const SECTIONS = [
  {
    title: '1. The service',
    body: [
      'BlockWard lets organisations verify achievements and issue permanent, independently checkable credentials to their members, and gives members a public portfolio of those credentials. By using BlockWard — as an organisation, a member, or the public verification tool — you agree to these terms.',
    ],
  },
  {
    title: '2. Organisations and authority',
    body: [
      'When you connect an organisation to BlockWard, you confirm you are authorised to act for it, and that it is authorised (by the relevant federation, governing body, or institution) to verify the kinds of achievements you issue. Credentials you issue through BlockWard are your organisation\'s statements, backed by the named signers on each record. BlockWard provides the recording and verification infrastructure — it does not vouch for the underlying truth of any achievement.',
    ],
  },
  {
    title: '3. Honest use',
    body: [
      'Only verify achievements that actually happened, as accurately as you can. Creating fake or inflated credentials, impersonating signers, or automating sign-offs undermines every other member\'s records — it is grounds for removal from the platform and, where a credential was issued, its permanent public revocation. Revocation is visible on the verification page by design.',
    ],
  },
  {
    title: '4. Members',
    body: [
      'Keep your account credentials to yourself, submit only evidence you have the right to share, and don\'t misrepresent your role or organisation. Your handle and profile content are your responsibility; we may reserve or remove handles that impersonate others.',
    ],
  },
  {
    title: '5. The verification tool',
    body: [
      'The public verification tool reports the state of a credential in our records at the time you check it, including its signer chain and public-ledger anchor. It is provided as-is for information. It is a powerful check on credential authenticity, but it is not a legal certification, a background check, or a substitute for your own admission or hiring diligence.',
    ],
  },
  {
    title: '6. Permanence',
    body: [
      'Verified credentials are permanent by design: they cannot be edited or deleted after approval. Organisations should verify carefully before final approval, because the only correction mechanism is visible, permanent revocation. Think of the record as ink, not pencil.',
    ],
  },
  {
    title: '7. Intellectual property',
    body: [
      'You keep all rights to the achievements, evidence and content you submit. You grant BlockWard the licence needed to store it, display it on the pages you have chosen, and show it on verification pages. The BlockWard platform, name and design belong to us.',
    ],
  },
  {
    title: '8. Disclaimers and liability',
    body: [
      'We work hard to keep the service available and accurate, but the service is provided "as is" without warranty of uninterrupted availability. To the extent permitted by law, BlockWard is not liable for indirect or consequential damages arising from use of the service, and our total liability is limited to the fees you paid us in the twelve months before the claim (which for free accounts is zero).',
    ],
  },
  {
    title: '9. Termination and changes',
    body: [
      'You can stop using BlockWard at any time; organisations can be deactivated by their admins. We may suspend accounts that violate these terms. If we change these terms materially, we will notify members in the app. Continued use after that means you accept the update.',
    ],
  },
  {
    title: '10. Contact',
    body: [
      'Questions about these terms go through the contact page — mark the topic "Press & partnerships" if it\'s a legal or commercial matter, and we\'ll route it accordingly.',
    ],
  },
];

export default function Terms() {
  useEffect(() => { document.title = 'Terms of Service — BlockWard'; }, []);

  return (
    <MarketingShell
      title="Terms of Service"
      subtitle="The deal, in plain language. Last updated: September 2026."
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