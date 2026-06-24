/**
 * StudentPortfolioVault — Native BlockWard Portfolio Vault.
 * Every student automatically has a portfolio. No Google Drive required.
 * Google Drive is an OPTIONAL sync/backup destination.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { jsPDF } from 'jspdf';
import {
  HardDrive, Loader2, Trophy, Shield, CheckCircle2,
  Download, FileText, GraduationCap, Briefcase, FolderArchive, Link2, Sparkles, PenLine, Award
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import BlockWardCard from '@/components/blockwards/BlockWardCard';
import BlockWardDetailModal from '@/components/blockwards/BlockWardDetailModal';
import { loadEarnedAchievements } from '@/lib/achievementLifecycle';

const CONNECTOR_ID = '6a2967c08ac8557a7b3a1b2e';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'academic', label: 'Academic' },
  { key: 'sports', label: 'Sports' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'community', label: 'Community Service' },
  { key: 'arts', label: 'Arts & Music' },
  { key: 'special', label: 'Other' },
];

const CATEGORY_STYLE = {
  academic: { gradient: 'from-blue-500 to-indigo-500', badge: 'bg-blue-100 text-blue-700' },
  sports: { gradient: 'from-green-500 to-emerald-500', badge: 'bg-green-100 text-green-700' },
  arts: { gradient: 'from-pink-500 to-rose-500', badge: 'bg-pink-100 text-pink-700' },
  leadership: { gradient: 'from-purple-500 to-violet-500', badge: 'bg-purple-100 text-purple-700' },
  community: { gradient: 'from-amber-500 to-orange-500', badge: 'bg-amber-100 text-amber-700' },
  behaviour: { gradient: 'from-red-500 to-rose-500', badge: 'bg-red-100 text-red-700' },
  special: { gradient: 'from-indigo-500 to-purple-500', badge: 'bg-indigo-100 text-indigo-700' },
};

const CATEGORY_WEIGHT = { academic: 1, leadership: 2, sports: 3, arts: 4, community: 5, special: 9, behaviour: 9 };

export default function StudentPortfolioVault() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [signatures, setSignatures] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [blockWards, setBlockWards] = useState([]);
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);

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
    try {
      const connStatus = await base44.connectors.getAppUserConnectionStatus(CONNECTOR_ID);
      setDriveConnected(!!connStatus?.connected);
    } catch { setDriveConnected(false); }
    setLoading(false);
  };

  const loadPortfolio = async (email, schoolId) => {
    const targetEmail = email || user?.email;
    try {
      // Fetch ALL the student's records, then keep only verified ones
      // (teacher + admin both signed). Only pass school_id when it is
      // actually defined — passing school_id: undefined filters out ALL
      // records (no record has school_id === undefined).
      const recordFilter = { student_email: targetEmail };
      if (schoolId) recordFilter.school_id = schoolId;
      const allRecords = await base44.entities.StudentRecord.filter(recordFilter);
      const all = allRecords
        .filter(r => r.teacher_signed && r.admin_signed && (r.status === 'delivered_to_vault' || r.status === 'archived'))
        .sort((a, b) =>
          new Date(b.approved_at || b.created_date) - new Date(a.approved_at || a.created_date)
        );
      setRecords(all);
      const sigMap = {};
      await Promise.all(all.map(async (rec) => {
        try {
          const sigs = await base44.entities.DigitalSignature.filter({ record_id: rec.id });
          sigMap[rec.id] = {
            teacher: sigs.find(s => s.signer_role === 'teacher') || null,
            admin: sigs.find(s => s.signer_role === 'admin') || null,
          };
        } catch { sigMap[rec.id] = { teacher: null, admin: null }; }
      }));
      setSignatures(sigMap);
    } catch {
      setRecords([]);
    }
    // Load earned achievements from the single source of truth (StudentRecord)
    // BlockWard NFT data is joined by record_id inside the loader.
    try {
      const achievements = await loadEarnedAchievements(targetEmail, schoolId);
      setBlockWards(achievements);
    } catch {
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

  // ---- PDF Export ----
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
      ['Status', 'Verified & Archived'],
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
    doc.text(`Verify at: ${window.location.origin}/Verify?id=${rec.verify_id || rec.id}`, 105, 285, { align: 'center' });
    doc.text(`Generated by BlockWard on ${format(new Date(), 'MMM d, yyyy')}`, 105, 290, { align: 'center' });

    doc.save(`BlockWard_Certificate_${rec.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.pdf`);
  };

  // ---- Optional Google Drive sync ----
  const handleConnectDrive = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, '_blank', 'width=500,height=600');
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          if (profile?.id) {
            try {
              base44.entities.UserProfile.update(profile.id, {
                connected_google_email: user.email,
                drive_connected_at: new Date().toISOString(),
              });
            } catch { /* best-effort */ }
          }
          checkDriveStatus();
          toast.success('Google Drive connected. Optional sync enabled.');
        }
      }, 500);
    } catch (e) {
      setConnecting(false);
      toast.error('Failed to start connection: ' + e.message);
    }
  };

  const handleDisconnectDrive = async () => {
    await base44.connectors.disconnectAppUser(CONNECTOR_ID);
    setDriveConnected(false);
    toast.success('Google Drive sync disabled');
  };

  const checkDriveStatus = async () => {
    try {
      const connStatus = await base44.connectors.getAppUserConnectionStatus(CONNECTOR_ID);
      setDriveConnected(!!connStatus?.connected);
    } catch { setDriveConnected(false); }
  };

  const handleSyncToDrive = async () => {
    setSyncing(true);
    try {
      let count = 0;
      for (const rec of records) {
        try {
          const res = await base44.functions.invoke('saveToStudentDrive', { recordId: rec.id });
          if (res.data?.ok) count++;
        } catch { /* continue */ }
      }
      toast.success(`${count} achievement${count !== 1 ? 's' : ''} synced to Google Drive`);
    } catch (e) {
      toast.error('Sync failed: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  const stats = [
    { label: 'Total Achievements', value: records.length, icon: Trophy, color: 'from-violet-500 to-indigo-500' },
    { label: 'Categories', value: Object.keys(categoryCounts).length, icon: FolderArchive, color: 'from-blue-500 to-cyan-500' },
    { label: 'Verified', value: records.filter(r => r.teacher_signed && r.admin_signed).length, icon: Shield, color: 'from-emerald-500 to-green-500' },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Portfolio Vault</h1>
          <p className="text-slate-500 mt-1">Your permanent digital achievement portfolio — automatically maintained by BlockWard.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to={createPageUrl('StudentMyRecords')}>
            <FileText className="h-4 w-4 mr-2" /> My Records
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* My BlockWards — minted NFT badges */}
      {blockWards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-semibold text-slate-900">My BlockWards</h2>
            <Badge className="bg-violet-100 text-violet-700 border-0">{blockWards.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {blockWards.map(bw => (
              <BlockWardCard key={bw.id} blockWard={bw} onClick={() => setSelectedBlockWard(bw)} />
            ))}
          </div>
        </div>
      )}

      {/* Export Bar — students only */}
      {profile?.user_type === 'student' && (
      <Card className="border-0 shadow-md bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Download className="h-4 w-4 text-violet-600" /> Export Your Portfolio</h3>
              <p className="text-sm text-slate-500 mt-0.5">Download your verified achievements for university, CV, or personal records.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => handleExport('full')} disabled={exporting} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <FileText className="h-4 w-4 mr-1" /> PDF Portfolio
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('university')} disabled={exporting}>
                <GraduationCap className="h-4 w-4 mr-1" /> University
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleExport('cv')} disabled={exporting}>
                <Briefcase className="h-4 w-4 mr-1" /> CV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat.key
                ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
            {cat.key !== 'all' && categoryCounts[cat.key] ? (
              <span className={`ml-1.5 text-xs ${activeCategory === cat.key ? 'text-white/80' : 'text-slate-400'}`}>{categoryCounts[cat.key]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Records */}
      {filteredRecords.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center">
            <Trophy className="h-14 w-14 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-500">{records.length === 0 ? 'Your portfolio is ready and waiting' : 'No achievements in this category yet'}</p>
            <p className="text-sm text-slate-400 mt-1">
              {records.length === 0 ? 'Verified achievements will appear here automatically once your teacher and admin sign them.' : 'Try a different category filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredRecords.map(rec => {
            const style = CATEGORY_STYLE[rec.category] || CATEGORY_STYLE.special;
            return (
              <Card key={rec.id} className="border-0 shadow-md overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${style.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Trophy className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 leading-tight">{rec.title}</h3>
                        <p className="text-xs text-slate-400 capitalize">{rec.category}</p>
                      </div>
                    </div>
                    {rec.verify_id && (
                      <Badge className={`${style.badge} border-0`}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 mb-3">
                    <div><span className="text-slate-400">Date:</span> {rec.date_achieved ? format(new Date(rec.date_achieved), 'MMM d, yyyy') : '—'}</div>
                    {rec.points > 0 && <div><span className="text-slate-400">Points:</span> {rec.points}</div>}
                    <div className="col-span-2"><span className="text-slate-400">Verify ID:</span> <span className="font-mono">{rec.verify_id || '—'}</span></div>
                  </div>

                  {rec.file_url && rec.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
                    <img src={rec.file_url} alt="Evidence" className="w-full h-32 object-cover rounded-lg mb-3" />
                  )}

                  <div className="flex items-center gap-4 mb-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <PenLine className={`h-3.5 w-3.5 ${rec.teacher_signed ? 'text-amber-500' : 'text-slate-300'}`} />
                      <span className={rec.teacher_signed ? 'text-slate-600' : 'text-slate-400'}>{rec.teacher_name || 'Teacher'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield className={`h-3.5 w-3.5 ${rec.admin_signed ? 'text-violet-600' : 'text-slate-300'}`} />
                      <span className={rec.admin_signed ? 'text-slate-600' : 'text-slate-400'}>{rec.admin_name || 'Admin'}</span>
                    </div>
                  </div>

                  {rec.nft_token_id && (
                    <div className="flex items-center gap-1.5 mb-3 text-xs text-violet-600 bg-violet-50 rounded-lg px-2 py-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> NFT Minted · Token #{rec.nft_token_id}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <Button size="sm" variant="outline" onClick={() => downloadCertificate(rec)}>
                      <Download className="h-3.5 w-3.5 mr-1" /> Certificate
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link to={createPageUrl(`RecordDetail?id=${rec.id}`)}>
                        <Link2 className="h-3.5 w-3.5" /> Details
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Optional Google Drive Sync */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${driveConnected ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                <HardDrive className={`h-5 w-5 ${driveConnected ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-800">Google Drive (Optional)</p>
                  <Badge className={driveConnected ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-slate-100 text-slate-500 border-0'}>
                    {driveConnected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {driveConnected
                    ? 'Your portfolio is stored safely in BlockWard. Optionally sync a backup copy to your Google Drive.'
                    : 'Optional backup. Your portfolio is fully stored in BlockWard — no Drive connection needed.'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {driveConnected ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleSyncToDrive} disabled={syncing}>
                    {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <HardDrive className="h-4 w-4 mr-1" />}
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleDisconnectDrive} className="text-red-600 hover:bg-red-50">
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="outline" onClick={handleConnectDrive} disabled={connecting}>
                  {connecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <HardDrive className="h-4 w-4 mr-1" />}
                  {connecting ? 'Connecting...' : 'Connect Drive'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BlockWard detail modal */}
      <BlockWardDetailModal
        blockWard={selectedBlockWard}
        open={!!selectedBlockWard}
        onClose={() => setSelectedBlockWard(null)}
      />
    </div>
  );
}