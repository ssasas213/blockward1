// Client-side PDF export of the full verified portfolio, with a QR code
// linking to the live public profile.
import { jsPDF } from 'jspdf';
import { DOMAIN_ORDER, DOMAIN_LABELS } from '@/lib/achievementDomains';

const M = 14; // page margin (mm)
const W = 210; // A4 width

const fmt = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

async function qrDataUrl(url) {
  try {
    const res = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=6&data=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

/**
 * exportPortfolioPdf — renders the verified portfolio (grouped by category,
 * every organisation included) to a downloadable A4 PDF.
 * `data` is the publicProfileData response; `profileUrl` is the live URL
 * encoded into the QR code.
 */
export async function exportPortfolioPdf(data, profileUrl) {
  const { student, orgs = [], achievements = [] } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ── Header band ─────────────────────────────────────────────────────────
  doc.setFillColor(11, 10, 16);
  doc.rect(0, 0, W, 46, 'F');
  doc.setTextColor(247, 245, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(student.name || 'Student', M, 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(167, 139, 250);
  doc.text(`@${student.handle} · BlockWard verified portfolio`, M, 24);

  doc.setTextColor(180, 173, 190);
  doc.setFontSize(9);
  let hy = 30;
  if (student.bio) {
    doc.text(doc.splitTextToSize(student.bio, W - 2 * M - 32), M, hy);
    hy += 5;
  }
  const orgLine = orgs.map((o) => o.name).filter(Boolean).join('  ·  ');
  if (orgLine) {
    doc.text(doc.splitTextToSize(orgLine, W - 2 * M - 32), M, hy);
  }

  const qr = await qrDataUrl(profileUrl);
  if (qr) {
    doc.addImage(qr, 'PNG', W - M - 26, 8, 26, 26);
    doc.setFontSize(7);
    doc.setTextColor(180, 173, 190);
    doc.text('Scan to verify live', W - M - 26, 37.5);
  }

  // ── Summary line ────────────────────────────────────────────────────────
  let y = 56;
  doc.setTextColor(23, 18, 31);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const summary = `${achievements.length} verified achievement${achievements.length === 1 ? '' : 's'} across ${orgs.length} organisation${orgs.length === 1 ? '' : 's'}`;
  doc.text(summary, M, y);
  y += 9;

  // ── Grouped sections ────────────────────────────────────────────────────
  const groups = {};
  for (const a of achievements) {
    const d = a.domain || 'other';
    (groups[d] = groups[d] || []).push(a);
  }

  for (const d of DOMAIN_ORDER) {
    const items = (groups[d] || []).sort((a, b) =>
      new Date(b.date_achieved || b.date_delivered || 0) - new Date(a.date_achieved || a.date_delivered || 0)
    );
    if (!items.length) continue;

    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(124, 58, 237);
    doc.text(`${DOMAIN_LABELS[d] || d}  (${items.length})`, M, y);
    y += 2.5;
    doc.setDrawColor(215, 210, 225);
    doc.line(M, y, W - M, y);
    y += 6;

    for (const a of items) {
      if (y > 272) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(23, 18, 31);
      const titleLines = doc.splitTextToSize(a.title || 'Achievement', W - 2 * M);
      doc.text(titleLines, M, y);
      y += titleLines.length * 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(110, 104, 120);
      const meta = [
        a.organisation_name,
        a.date_achieved && `achieved ${fmt(a.date_achieved)}`,
        a.verification_id,
        a.endorsement_count > 0 ? `${a.endorsement_count} peer endorsement${a.endorsement_count === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join('  ·  ');
      const metaLines = doc.splitTextToSize(meta, W - 2 * M);
      doc.text(metaLines, M, y);
      y += metaLines.length * 4.4 + 2.5;
    }
    y += 4;
  }

  // ── Self-reported note + footer ─────────────────────────────────────────
  const selfCount = (data.self_reported || []).length;
  if (selfCount > 0) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 145, 160);
    doc.text(doc.splitTextToSize(
      `${selfCount} further achievement${selfCount === 1 ? '' : 's'} on this profile ${selfCount === 1 ? 'is' : 'are'} self-reported and not yet verified — see the live profile for their status.`,
      W - 2 * M,
    ), M, y);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 145, 160);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')} · ${profileUrl}`, M, 288);

  doc.save(`blockward-portfolio-${student.handle || 'student'}.pdf`);
}