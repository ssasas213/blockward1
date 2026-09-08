import React from 'react';
import { useParams } from 'react-router-dom';
import PublicProfile from '@/pages/PublicProfile';
import PageNotFound from '@/lib/PageNotFound';

/**
 * HandleRoute — public /@handle profiles.
 *
 * React Router v6 requires ":param" (and "*") to occupy an ENTIRE path
 * segment, so any pattern with a literal "@" prefix inside the segment
 * ("/@:handle", "/@*") can never match. Instead we declare a full-segment
 * dynamic route "/:handleSegment" and split it here:
 *   - "@<handle>" → PublicProfile, with the handle normalised
 *     (leading "@" stripped, trailing slash stripped, lowercased)
 *   - anything else → generic 404, so unknown single-segment URLs still
 *     fall through exactly like the old catch-all did.
 *
 * React Router v6 ranks static segments above dynamic ones, so every
 * explicitly declared route (/StudentDashboard, /Verify, /JoinSchool, …)
 * still wins over /:handleSegment.
 */
export default function HandleRoute() {
  const { handleSegment } = useParams();
  const raw = decodeURIComponent(handleSegment || '');
  if (!raw.startsWith('@')) return <PageNotFound />;

  const handle = raw.slice(1).replace(/\/+$/, '').trim().toLowerCase();

  // TEMPORARY — verification log for the /@handle 404 fix. Remove once the
  // route is confirmed to match (component must mount and print this).
  console.log('[HandleRoute] segment:', raw, '→ resolved handle:', handle);

  return <PublicProfile handle={handle} />;
}