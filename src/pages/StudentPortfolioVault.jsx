import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import {
  Trophy, Shield, CheckCircle2,
  Download, FileText, GraduationCap, Briefcase, FolderArchive, Link2, Award, Share2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '@/components/ui/page-header';
import StatCard from '@/components/ui/stat-card';
import EmptyState from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/loading-skeleton';
import BlockWardCard from '@/components/blockwards/BlockWardCard';
import BlockWardDetailModal from '@/components/blockwards/BlockWardDetailModal';
import SharePortfolioDialog from '@/components/portfolio/SharePortfolioDialog';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'academic', label: 'Academic' },
  { key: 'sports', label: 'Sports' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'community', label: 'Community' },
  { key: 'arts', label: 'Arts & Music' },
  { key: 'special', label: 'Other' },
];

const CATEGORY_STYLE = {
  academic: { badge: 'bg-blue-500/10 text-blue-400' },
  sports: { badge: 'bg-green-500/10 text-green-400' },
  arts: { badge: 'bg-purple-500/10 text-purple-400' },
  leadership: { badge: 'bg-amber-500/10 text-amber-400' },
  community: { badge: 'bg-rose-500/10 text-rose-400' },
  behaviour: { badge: 'bg-red-500/10 text-red-400' },
  special: { badge: 'bg-indigo-500/10 text-indigo-400' },
};

const CATEGORY_WEIGHT = { academic: 1, leadership: 2, sports: 3, arts: 4, community: 5, special: 9, behaviour: 9 };

export default function StudentPortfolioVault() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [blockWards, setBlockWards] = useState([]);
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const authed = await base44.auth.isAuthenticated();
    if (!authed) { base44.auth.redirectToLogin(); return; }
    const me = await base44.auth.me();
    setUser(me);
    const profiles = await base44.entities.UserProfile.filter({ user_email: me.email });
    const p = profiles[0] || null;
    setProfile(p);
    await loadPortfolio(me.email, p?.school_id);
    setLoading(false);
  };

  const loadPortfolio = async (email, schoolId) => {
    const targetEmail = email || user?.email;
    try {
      const res = await base44.functions.invoke('getStudentVault', {});
      const data = res.data;
      if (data?.ok) {
        const achievements = data.achievements || [];
        setBlockWards(achievements);
        setRecords(achievements);
      } else {
        setRecords([]);
        setBlockWards([]);
      }
    } catch {
      setRecords([]);
      setBlockWards([]);
    }
  };

  const filteredRecords = useMemo(() => {
    if (activeCategory === 'all') return records;
    return records.filter(r => r.category === activeCategory);
  }, [records, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    records.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });
    return counts;
  }, [records]);

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

  if (loading) return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Portfolio Vault"
        description="Your permanent collection of verified achievements."
      >
        <Button variant="outline" onClick={() => setShareOpen(true)}>
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
        <Button variant="outline" asChild>
          <Link to={createPageUrl('StudentMyRecords')}>
            <FileText className="h-4 w-4 mr-2" /> My Records
          </Link>
        </Button>
      </PageHeader>

      <SharePortfolioDialog open={shareOpen} onOpenChange={setShareOpen} studentId={profile?.portfolio_public_id || profile?.id} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Achievements" value={records.length} icon={Trophy} />
        <StatCard label="Categories" value={Object.keys(categoryCounts).length} icon={FolderArchive} />
        <StatCard label="Verified" value={records.filter(r => r.teacher_signed && r.admin_signed).length} icon={Shield} />
      </div>

      {/* BlockWards Grid */}
      {blockWards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">My BlockWards</h2>
            <Badge variant="outline">{blockWards.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {blockWards.map(bw => (
              <BlockWardCard key={bw.id} blockWard={bw} onClick={() => setSelectedBlockWard(bw)} />
            ))}
          </div>
        </div>
      )}

      {/* Export Bar */}
      {profile?.user_type === 'student' && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-foreground flex items-center gap-2">
                  <Download className="h-4 w-4 text-muted-foreground" /> Export Your Portfolio
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">Download verified achievements for university, CV, or personal records.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => handleExport('full')} disabled={exporting}>
                  <FileText className="h-4 w-4 mr-1.5" /> PDF Portfolio
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport('university')} disabled={exporting}>
                  <GraduationCap className="h-4 w-4 mr-1.5" /> University
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport('cv')} disabled={exporting}>
                  <Briefcase className="h-4 w-4 mr-1.5" /> CV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
              activeCategory === cat.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            )}
          >
            {cat.label}
            {cat.key !== 'all' && categoryCounts[cat.key] ? (
              <span className={cn("ml-1.5 text-xs", activeCategory === cat.key ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {categoryCounts[cat.key]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <Card className="shadow-sm">
          <EmptyState
            icon={Trophy}
            title={records.length === 0 ? 'Your portfolio is ready and waiting' : 'No achievements in this category'}
            description={records.length === 0
              ? 'Verified achievements will appear here automatically once your teacher and admin sign them.'
              : 'Try a different category filter.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecords.map(rec => {
            const style = CATEGORY_STYLE[rec.category] || CATEGORY_STYLE.special;
            return (
              <Card key={rec.id} className="shadow-sm overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                        <Trophy className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground leading-tight truncate">{rec.title}</h3>
                        <p className="text-xs text-muted-foreground capitalize">{rec.category}</p>
                      </div>
                    </div>
                    {rec.verify_id && (
                      <Badge variant="outline" className={cn("flex-shrink-0", style.badge)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    <div><span className="text-muted-foreground/70">Date:</span> {rec.date_achieved ? format(new Date(rec.date_achieved), 'MMM d, yyyy') : '—'}</div>
                    {rec.points > 0 && <div><span className="text-muted-foreground/70">Points:</span> {rec.points}</div>}
                    <div className="col-span-2"><span className="text-muted-foreground/70">Verify ID:</span> <span className="font-mono">{rec.verify_id || '—'}</span></div>
                  </div>

                  {rec.file_url && rec.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                    <img src={rec.file_url} alt="Evidence" className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}

                  <div className="flex items-center gap-4 mb-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className={rec.teacher_signed ? 'text-success' : 'text-muted-foreground/40'}>✓</span>
                      <span className={rec.teacher_signed ? 'text-foreground' : 'text-muted-foreground'}>{rec.teacher_name || 'Teacher'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={rec.admin_signed ? 'text-success' : 'text-muted-foreground/40'}>✓</span>
                      <span className={rec.admin_signed ? 'text-foreground' : 'text-muted-foreground'}>{rec.admin_name || 'Admin'}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button size="sm" variant="outline" onClick={() => downloadCertificate(rec)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Certificate
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={createPageUrl(`RecordDetail?id=${rec.record_id || rec.id}`)}>
                        <Link2 className="h-3.5 w-3.5 mr-1" /> Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BlockWard detail modal */}
      <BlockWardDetailModal
        blockWard={selectedBlockWard}
        open={!!selectedBlockWard}
        onClose={() => setSelectedBlockWard(null)}
      />
    </div>
  );
}