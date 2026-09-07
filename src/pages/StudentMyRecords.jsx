import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Plus, Trophy, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import RecordStatusBadge from '@/components/records/RecordStatusBadge';
import { toast } from 'sonner';
import { useSchool } from '@/lib/SchoolContext';

const CATEGORY_COLORS = {
  academic: 'from-blue-500 to-indigo-500',
  sports: 'from-green-500 to-emerald-500',
  arts: 'from-purple-500 to-fuchsia-500',
  leadership: 'from-amber-500 to-orange-500',
  community: 'from-rose-500 to-pink-500',
  behaviour: 'from-red-500 to-rose-500',
  special: 'from-violet-500 to-purple-500',
};

import RoleGuard from '@/components/auth/RoleGuard';
export default function StudentMyRecords() { return <RoleGuard roles={['student']}><StudentMyRecordsImpl/></RoleGuard>; }
function StudentMyRecordsImpl() {
  const { testMode } = useSchool();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deliveredAchievements, setDeliveredAchievements] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: currentUser.email });
      const p = profiles[0];

      // Fetch all student records (direct, for showing teacher-issued records
      // and in-flight submissions). Legacy submissions that were migrated to
      // the achievement-request flow are tracked there — they show once, on
      // "My achievement requests", never twice.
      const effectiveEmail = testMode?.isTestSuperUser && testMode.effectiveEmail ? testMode.effectiveEmail : currentUser.email;
      const recordFilter = { student_email: effectiveEmail };
      if (p?.school_id) recordFilter.school_id = p.school_id;
      const recs = await base44.entities.StudentRecord.filter(recordFilter, '-created_date');
      setRecords(recs.filter(r => !r.migrated_request_id));

      // Fetch DELIVERED achievements via the shared vault loader — same source as
      // Dashboard, My BlockWards, and Portfolio Vault. This guarantees the
      // "Verified" count matches every other page.
      try {
        const vaultRes = await base44.functions.invoke('getStudentVault', {});
        if (vaultRes.data?.ok) {
          setDeliveredAchievements(vaultRes.data.achievements || []);
        }
      } catch (e) { /* shared loader error — counts will show 0 */ }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Use the shared vault loader for delivered achievements — same count as Dashboard,
  // My BlockWards, and Portfolio Vault.
  const mintedRecords = deliveredAchievements;
  const pendingRecords = records.filter(r => !['delivered_to_vault', 'archived', 'rejected'].includes(r.status));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Achievements</h1>
          <p className="text-slate-500 mt-1">Your verified achievements and everything still in review</p>
        </div>
        <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
          <Link to="/AchievementRequests">
            <Plus className="h-4 w-4 mr-2" /> Request an Achievement
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: records.length, color: 'bg-slate-100 text-slate-600' },
          { label: 'In Progress', value: pendingRecords.length, color: 'bg-amber-100 text-amber-700' },
          { label: 'Verified Records', value: mintedRecords.length, color: 'bg-violet-100 text-violet-700' },
          { label: 'Rejected', value: records.filter(r => r.status === 'rejected').length, color: 'bg-red-100 text-red-600' },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-md">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.color.split(' ')[1]}`}>{s.value}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Verified achievements showcase */}
      {mintedRecords.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" /> My Verified Achievements
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mintedRecords.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden">
                  {r.nft_image_url ? (
                    <img src={r.nft_image_url} alt={r.title} className="w-full h-40 object-cover" />
                  ) : (
                    <div className={`h-40 bg-gradient-to-br ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'} flex items-center justify-center`}>
                      <Trophy className="h-16 w-16 text-white/80" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <p className="font-bold text-slate-900 mb-1">{r.title}</p>
                    <p className="text-xs text-slate-500 mb-2">{r.description?.slice(0, 80)}{r.description?.length > 80 ? '...' : ''}</p>
                    <div className="flex items-center justify-between">
                      <Badge className="text-xs bg-violet-100 text-violet-700 border-0 capitalize">{r.category}</Badge>
                      <span className="text-xs text-slate-400">{r.minted_at ? format(new Date(r.minted_at), 'MMM d, yyyy') : ''}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Records */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">All Submissions</h2>
        {records.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-16 text-center text-slate-400">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium text-slate-600">No achievements yet</p>
              <p className="text-sm mb-4">Request your first achievement to get it verified and permanently recorded</p>
              <Button asChild className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Link to="/AchievementRequests">
                  <Plus className="h-4 w-4 mr-2" /> Request an Achievement
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {records.map(r => (
              <Link key={r.id} to={createPageUrl(`RecordDetail?id=${r.id}`)}>
                <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${CATEGORY_COLORS[r.category] || 'from-slate-400 to-slate-500'} flex items-center justify-center flex-shrink-0`}>
                      {r.file_url && r.file_url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                        ? <img src={r.file_url} alt="" className="h-full w-full object-cover rounded-xl" />
                        : <Trophy className="h-6 w-6 text-white" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{r.title}</p>
                      <p className="text-xs text-slate-500 capitalize">{r.category} · {r.created_date ? format(new Date(r.created_date), 'MMM d, yyyy') : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <RecordStatusBadge status={r.status} student />
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}