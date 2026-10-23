import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import { exportPortfolioPDF, downloadCertificatePDF } from '@/lib/portfolioPdf';
import { Download, FileText, GraduationCap, Briefcase, Award, Share2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * PortfolioActions — the portfolio PDF export, per-achievement certificate
 * download and share-profile dialog. The documents themselves are built by
 * src/lib/portfolioPdf.js, shared with the My Achievements "More actions"
 * menu and the achievement detail view.
 */
export default function PortfolioActions({ records, profile, user }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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

  const handleExport = async (type) => {
    if (records.length === 0) { toast.error('No achievements to export yet'); return; }
    setExporting(true);
    try {
      await exportPortfolioPDF(records, profile, user, type);
      toast.success('Portfolio exported as PDF');
    } catch (e) {
      toast.error('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const downloadCertificate = (rec) => {
    downloadCertificatePDF(rec, profile).catch((e) => toast.error('Download failed: ' + e.message));
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