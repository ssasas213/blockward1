import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * RouteSeo — single source of truth for crawlability and per-page metadata.
 *
 * - Public pages get a proper title + full meta description and stay indexable.
 * - Every private/logged-in route gets a robots noindex tag, keeping the
 *   sitemap and crawler snapshots to the public site only.
 * - Page-level effects that set a title later (e.g. Verify's per-credential
 *   title) always win — they run after this one.
 */

const SITE_DESC = 'BlockWard gives students one portable profile of verified achievements, and gives schools and clubs one place to verify them.';

const PUBLIC_SEO = {
  '/': {
    title: 'BlockWard | Verified student achievements',
    description: SITE_DESC,
  },
  '/verify': {
    title: 'Verify a credential | BlockWard',
    description: 'Check any BlockWard credential by its verification ID or share link. See the full signer chain, the issuing organisation and the on-chain anchor — no account needed.',
  },
  '/ForOrganisations': {
    title: 'For schools & organisations | BlockWard',
    description: 'Connect your school, club or academy and verify member achievements with named signers, audit trails and public ledger anchors. Setup is self-serve and takes minutes.',
  },
  '/DemoProfile': {
    title: 'Example student profile | BlockWard',
    description: 'See exactly what universities and employers see: a sample BlockWard profile of verified achievements, built with fictional sample data.',
  },
  '/about': {
    title: 'About | BlockWard',
    description: 'Why BlockWard exists: verified, portable achievement records that any third party can check independently — for students, and the schools and clubs that believe in them.',
  },
  '/contact': {
    title: 'Contact | BlockWard',
    description: 'Talk to the BlockWard team — organisation setup, student support, verification help, security reports and privacy or data requests.',
  },
  '/documentation': {
    title: 'Documentation | BlockWard',
    description: 'How BlockWard works end to end: the credential lifecycle, verification tiers, handles and public profiles, team credentials, and how to check a credential yourself.',
  },
  '/security': {
    title: 'Security | BlockWard',
    description: 'How BlockWard keeps records tamper-evident and independently checkable: signer attribution, public ledger anchors, data isolation, and how to report an issue.',
  },
  '/privacy': {
    title: 'Privacy Policy | BlockWard',
    description: 'What data BlockWard collects and why, what is public versus private, what goes on-chain (a hash only — never personal data), retention, and student data rights.',
  },
  '/terms': {
    title: 'Terms of Service | BlockWard',
    description: 'The deal in plain language: organisation responsibilities, honest use, corrections and revocations, eligibility and parental consent, and the beta testnet disclaimer.',
  },
  '/Signup': {
    title: 'Create your account | BlockWard',
    description: 'Claim your BlockWard profile in minutes — students, teachers and organisation admins all start here.',
  },
};

function setMeta(attr, key, content, name = 'meta') {
  let el = document.head.querySelector(`${name}[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function RouteSeo() {
  const location = useLocation();
  const path = location.pathname;

  useEffect(() => {
    // Public student profiles (/@handle) are indexable by default; the
    // profile page itself narrows this to profiles the student made public.
    const isHandle = path.startsWith('/@');
    const isVerifyDetail = path.startsWith('/verify/');
    const seo = PUBLIC_SEO[path]
      || (isVerifyDetail ? PUBLIC_SEO['/verify'] : null)
      || (isHandle ? { title: 'Student profile | BlockWard', description: SITE_DESC } : null);
    const indexable = !!seo && path !== '/verify/demo';

    if (seo) {
      document.title = seo.title;
      setMeta('name', 'description', seo.description);
    }
    setMeta('name', 'robots', indexable ? 'index, follow' : 'noindex, nofollow');
  }, [path]);

  return null;
}