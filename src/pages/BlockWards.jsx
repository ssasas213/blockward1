import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Shield, Search, ExternalLink, User, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

const categories = [
  { value: 'academic', label: 'Academic Excellence', color: 'from-blue-500 to-cyan-500' },
  { value: 'sports', label: 'Sports Achievement', color: 'from-emerald-500 to-green-500' },
  { value: 'arts', label: 'Arts & Creativity', color: 'from-pink-500 to-rose-500' },
  { value: 'leadership', label: 'Leadership', color: 'from-violet-500 to-purple-500' },
  { value: 'community', label: 'Community Service', color: 'from-amber-500 to-orange-500' },
  { value: 'special', label: 'Special Recognition', color: 'from-indigo-500 to-blue-500' }
];

const getCategoryInfo = (cat) => categories.find(c => c.value === cat) || categories[5];

export default function BlockWards() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [blockWards, setBlockWards] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      if (profiles.length === 0) return;

      const userProfile = profiles[0];
      setProfile(userProfile);
      const schoolId = userProfile.school_id;

      let bwData = [];
      if (userProfile.user_type === 'student') {
        bwData = await base44.entities.BlockWard.filter({ student_email: user.email }, '-created_date');
      } else if (userProfile.user_type === 'teacher') {
        bwData = await base44.entities.BlockWard.filter({ issuer_email: user.email }, '-created_date');
      } else {
        // Admin
        bwData = schoolId
          ? await base44.entities.BlockWard.filter({ school_id: schoolId }, '-created_date')
          : await base44.entities.BlockWard.list('-created_date');
      }
      setBlockWards(bwData || []);
    } catch (error) {
      toast.error('Failed to load BlockWards');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeBlockWard = async (blockWard) => {
    try {
      const user = await base44.auth.me();
      await base44.entities.BlockWard.update(blockWard.id, {
        status: 'revoked',
        revoked_by: user.email,
        revoked_at: new Date().toISOString()
      });
      setSelectedBlockWard(null);
      loadData();
      toast.success('BlockWard revoked');
    } catch (error) {
      toast.error('Failed to revoke BlockWard');
    }
  };

  const filteredBlockWards = blockWards.filter(bw =>
    bw.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bw.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ONLY approved teachers can create/submit achievements. Admins NEVER issue directly.
  const canIssue = profile?.user_type === 'teacher' && profile?.can_issue_blockwards === true;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">BlockWards</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {profile?.user_type === 'student'
              ? 'Your blockchain-verified achievements'
              : profile?.user_type === 'admin'
                ? 'View minted achievement tokens — created via the approval workflow'
                : 'Your issued achievement tokens — created via the approval workflow'}
          </p>
        </div>
        {canIssue && (
          <Button
            className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            asChild
          >
            <Link to={createPageUrl('IssueBlockWard')}>
              <Shield className="h-4 w-4 mr-2" />
              Create Achievement Record
            </Link>
          </Button>
        )}
        {profile?.user_type === 'teacher' && !profile?.can_issue_blockwards && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Pending approval to submit achievements
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search BlockWards..."
          className="pl-10"
        />
      </div>

      {/* BlockWards Grid */}
      {filteredBlockWards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBlockWards.map((bw, i) => {
            const catInfo = getCategoryInfo(bw.category);
            return (
              <motion.div
                key={bw.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                onClick={() => setSelectedBlockWard(bw)}
                className="cursor-pointer"
              >
                <Card className={`border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden ${bw.status === 'revoked' ? 'opacity-60' : ''}`}>
                  <div className={`h-32 bg-gradient-to-br ${catInfo.color} p-6 flex flex-col justify-between`}>
                    <div className="flex items-center justify-between">
                      <Shield className="h-8 w-8 text-white" />
                      <Badge className={`${bw.status === 'active' ? 'bg-white/20 text-white' : 'bg-red-500/80 text-white'} border-0`}>
                        {bw.status === 'active' ? 'Verified' : 'Revoked'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-white/80 text-xs">{catInfo.label}</p>
                      <h3 className="text-white font-bold text-lg truncate">{bw.title}</h3>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{bw.student_name}</p>
                        <p className="text-xs text-slate-500">
                          {bw.minted_at && format(new Date(bw.minted_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-mono truncate">{bw.token_id}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="border-0 shadow-lg">
          <CardContent className="text-center py-16">
            <Shield className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No BlockWards yet</h3>
            <p className="text-slate-500 mb-6">
              {profile?.user_type === 'student'
                ? 'Keep up the great work and earn your first BlockWard!'
                : profile?.user_type === 'admin'
                  ? 'No BlockWard records found. Teachers issue BlockWards to students.'
                  : 'Issue BlockWards to recognize student achievements'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* BlockWard Detail Dialog */}
      <Dialog open={!!selectedBlockWard} onOpenChange={() => setSelectedBlockWard(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedBlockWard && (
            <>
              <div className={`-mx-6 -mt-6 h-40 bg-gradient-to-br ${getCategoryInfo(selectedBlockWard.category).color} p-6 flex flex-col justify-between rounded-t-lg`}>
                <div className="flex items-center justify-between">
                  <Shield className="h-10 w-10 text-white" />
                  <Badge className={`${selectedBlockWard.status === 'active' ? 'bg-white/20 text-white' : 'bg-red-500/80 text-white'} border-0`}>
                    {selectedBlockWard.status === 'active' ? 'Verified on Sepolia' : 'Revoked'}
                  </Badge>
                </div>
                <div>
                  <p className="text-white/80 text-sm">{getCategoryInfo(selectedBlockWard.category).label}</p>
                  <h3 className="text-white font-bold text-2xl">{selectedBlockWard.title}</h3>
                </div>
              </div>
              <div className="space-y-4 pt-4">
                {selectedBlockWard.description && (
                  <p className="text-slate-600">{selectedBlockWard.description}</p>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Awarded To</p>
                    <p className="font-medium">{selectedBlockWard.student_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Issued By</p>
                    <p className="font-medium">{selectedBlockWard.issuer_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Date Minted</p>
                    <p className="font-medium">
                      {selectedBlockWard.minted_at && format(new Date(selectedBlockWard.minted_at), 'PPP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Token ID</p>
                    <p className="font-medium font-mono text-sm">{selectedBlockWard.token_id}</p>
                  </div>
                </div>
                <div className="pt-2 border-t space-y-3">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Transaction Hash</p>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${selectedBlockWard.transaction_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-violet-600 hover:text-violet-700 break-all flex items-center gap-2"
                    >
                      {selectedBlockWard.transaction_hash}
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Block Number</p>
                    <p className="font-mono text-xs text-slate-600">{selectedBlockWard.block_number?.toLocaleString()}</p>
                  </div>
                  {selectedBlockWard.transaction_hash && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Network</p>
                      <Badge variant="outline" className="text-xs">Sepolia Testnet</Badge>
                    </div>
                  )}
                </div>
              </div>
              {/* Admins do not have direct revoke — managed via approval workflow */}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}