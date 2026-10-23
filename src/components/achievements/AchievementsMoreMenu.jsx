import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ProfileShareDialog from '@/components/profile/ProfileShareDialog';
import { exportPortfolioPDF, downloadCertificatePDF } from '@/lib/portfolioPdf';
import { toast } from 'sonner';
import { MoreHorizontal, History, FileText, GraduationCap, Briefcase, Share2, FolderKanban, Download, Loader2 } from 'lucide-react';

/**
 * AchievementsMoreMenu — every secondary dashboard action in one clearly
 * labelled dropdown: add a past achievement, export the portfolio (full /
 * university / CV), download a certificate, share the portfolio and manage
 * categories. One primary button stays in the header; nothing else.
 */
export default function AchievementsMoreMenu({ records, profile, user, onAddPast, onManageCategories }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const certRecords = records.filter((r) => r.verify_id);

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

  const downloadCertificate = (rec) => downloadCertificatePDF(rec, profile).catch((e) => toast.error('Download failed: ' + e.message));

  const openShare = () => {
    if (!profile?.handle) {
      toast.info('Claim your profile link first — it takes seconds');
      navigate(createPageUrl('Profile'));
      return;
    }
    setShareOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MoreHorizontal className="h-4 w-4 mr-2" />} More actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onAddPast}>
            <History className="h-4 w-4 mr-2" /> Add past achievement
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FileText className="h-4 w-4 mr-2" /> Export portfolio
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onClick={() => handleExport('full')}>PDF Portfolio</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('university')}><GraduationCap className="h-4 w-4 mr-2" /> University</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('cv')}><Briefcase className="h-4 w-4 mr-2" /> CV</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download className="h-4 w-4 mr-2" /> Download certificate
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {certRecords.length === 0 ? (
                <DropdownMenuItem disabled>No verified achievements yet</DropdownMenuItem>
              ) : certRecords.map((rec) => (
                <DropdownMenuItem key={rec.id || rec.verify_id} onClick={() => downloadCertificate(rec)}>
                  {rec.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={openShare}>
            <Share2 className="h-4 w-4 mr-2" /> Share portfolio
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageCategories}>
            <FolderKanban className="h-4 w-4 mr-2" /> Manage categories
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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