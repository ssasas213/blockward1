import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import { Download, FileText, GraduationCap, Briefcase, Award, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const CATEGORY_WEIGHT = { academic: 1, leadership: 2, sports: 3, arts: 4, community: 5, special: 9, behaviour: 9 };

/**
 * PortfolioActions — the header actions carried over from StudentPortfolioVault:
 * PDF export (full / university / CV), per-achievement certificate download, and
 * the share-profile dialog. The PDF generation code is unchanged — only the
 * entry point moved into the My BlockWards header.
 */
export default function PortfolioActions({ records, profile, user }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const buildPDF = (type) => {
    const doc = new jsPDF();
    const studentName = profile ? `${profile.first_name} ${profile.last_name}` : user?.email;
    const left = 14;
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(91, 33, 182);
    doc.text('BlockWard Portfolio', left, y);
    y += 8;
    doc.setFontSize(11);
    doc.setTextColor(100);
    const subtitle = type === 'university' ? 'University Application Portfolio'
      : type === 'cv' ? 'CV Achievement Summary'
      : 'Complete Achievement Portfolio';
    doc.text(subtitle, left, y);
    y += 6;
    doc.text(`Student: ${studentName}`, left, y);
    if (profile?.grade_level) { y += 5; doc.text(`Grade: ${profile.grade_level}`, left, y); }
    y += 5;
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, left, y);
    y += 4;
    doc.setDrawColor(91, 33, 182);
    doc.line(left, y, 196, y);
    y += 8;

    const list = type === 'university'
      ? [...records].sort((a, b) => (CATEGORY_WEIGHT[a.category] || 9) - (CATEGORY_WEIGHT[b.category] || 9))
      : records;

    if (list.length === 0) {
      doc.setFontSize(12);
      doc.setTextColor(150);
      doc.text('No achievements to display.', left, y);
    }

    list.forEach((rec, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(13);
      doc.setTextColor(30);
      doc.text(`${idx + 1}. ${rec.title}`, left, y);
      y += 6;
      doc.setFontSize(9);
      doc.setTextColor(120);
      const meta = [
        rec.category ? `Category: ${rec.category}` : '',
        rec.date_achieved ? `Date: ${format(new Date(rec.date_achieved), 'MMM d, yyyy')}` : '',
        rec.points ? `Points: ${rec.points}` : '',
        rec.verify_id ? `Verify ID: ${rec.verify_id}` : '',
      ].filter(Boolean).join('  |  ');
      doc.text(meta, left, y);
      y += 5;
      if (type !== 'cv' && rec.description) {
        const desc = doc.splitTextToSize(rec.description, 180);
        doc.setTextColor(90);
        doc.text(desc, left, y);
        y += desc.length * 5;
      }
      if (rec.teacher_name || rec.admin_name) {
        doc.setTextColor(110);
        const sig = [
          rec.teacher_name ? `Teacher: ${rec.teacher_name}` : '',
          rec.admin_name ? `Admin: ${rec.admin_name}` : '',
        ].filter(Boolean).join('  |  ');
        doc.text(sig, left, y);
        y += 5;
      }
      y += 4;
    });

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`BlockWard — Verified Digital Portfolio  |  Page ${i} of ${pages}`, left, 290);
    }

    const fileName = `BlockWard_${type === 'university' ? 'University' : type === 'cv' ? 'CV' : 'Portfolio'}_${studentName.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
  };

  // Share flows through the public /@handle page. A student without a handle
  // is sent to the claim card at the top of their Profile page first.
  const openShare = () => {
    if (!profile?.handle) {
      toast.info('Claim your profile link first — it takes seconds');
      navigate(createPageUrl('Profile'));
      return;
    }
    setShareOpen(true);
  };

  const handleExport = (type) => {
    if (records.length === 0) { toast.error('No achievements to export yet'); return; }
    setExporting(true);
    try {
      buildPDF(type);
      toast.success('Portfolio exported as PDF');
    } catch (e) {
      toast.error('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadCertificate = (rec) => {
    const doc = new jsPDF();
    const studentName = profile ? `${profile.first_name} ${profile.last_name}` : rec.student_name;
    doc.setFillColor(91, 33, 182);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.text('BlockWard Verified Achievement', 105, 25, { align: 'center' });

    doc.setTextColor(30);
    doc.setFontSize(18);
    let y = 60;
    doc.text(rec.title, 105, y, { align: 'center' });
    y += 10;
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Awarded to ${studentName}`, 105, y, { align: 'center' });
    y += 14;
    doc.setDrawColor(91, 33, 182);
    doc.line(60, y, 150, y);
    y += 12;

    doc.setFontSize(11);
    const rows = [
      ['Category', rec.category || '—'],
      ['Date Achieved', rec.date_achieved ? format(new Date(rec.date_achieved), 'MMM d, yyyy') : '—'],
      ['Points', rec.points ? String(rec.points) : '—'],
      ['Teacher', rec.teacher_name || '—'],
      ['Admin', rec.admin_name || '—'],
      ['Verification ID', rec.verify_id || '—'],
      ['Status', 'Delivered to BlockWard Vault'],
    ];
    rows.forEach(([k, v]) => {
      doc.setTextColor(120);
      doc.text(`${k}:`, 50, y);
      doc.setTextColor(40);
      doc.text(String(v), 90, y);
      y += 8;
    });

    if (rec.description) {
      y += 4;
      doc.setTextColor(120);
      doc.text('Description:', 50, y);
      y += 6;
      const desc = doc.splitTextToSize(rec.description, 120);
      doc.setTextColor(50);
      doc.text(desc, 50, y);
    }

    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(`Verify at: ${window.location.origin}/verify/${rec.verify_id || rec.id}`, 105, 285, { align: 'center' });
    doc.text(`Generated by BlockWard on ${format(new Date(), 'MMM d, yyyy')}`, 105, 290, { align: 'center' });

    doc.save(`BlockWard_Certificate_${rec.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting || records.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export portfolio
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport('full')}>
            <FileText className="h-4 w-4 mr-2" /> PDF Portfolio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('university')}>
            <GraduationCap className="h-4 w-4 mr-2" /> University
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('cv')}>
            <Briefcase className="h-4 w-4 mr-2" /> CV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={records.length === 0}>
            <Award className="h-4 w-4 mr-2" /> Download certificate
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
          {records.map(rec => (
            <DropdownMenuItem key={rec.id} onClick={() => downloadCertificate(rec)}>
              {rec.title}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" onClick={openShare}>
        <Share2 className="h-4 w-4 mr-2" /> Share my page
      </Button>

      <ProfileShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        profile={{
          name: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : '',
          handle: profile?.handle,
          bio: profile?.bio || null,
          avatar_url: profile?.avatar_url || null,
          count: records.length,
        }}
      />
    </>
  );
}