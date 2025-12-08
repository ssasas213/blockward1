import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Shield, Plus, Search, ExternalLink, Clock, User,
  Loader2, Award, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function BlockWards() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [blockWards, setBlockWards] = useState([]);
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showMintDialog, setShowMintDialog] = useState(false);
  const [minting, setMinting] = useState(false);
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);
  const [newBlockWard, setNewBlockWard] = useState({
    student_email: '',
    title: '',
    description: '',
    category: ''
  });

  const categories = [
    { value: 'academic', label: 'Academic Excellence', color: 'from-blue-500 to-cyan-500' },
    { value: 'sports', label: 'Sports Achievement', color: 'from-emerald-500 to-green-500' },
    { value: 'arts', label: 'Arts & Creativity', color: 'from-pink-500 to-rose-500' },
    { value: 'leadership', label: 'Leadership', color: 'from-violet-500 to-purple-500' },
    { value: 'community', label: 'Community Service', color: 'from-amber-500 to-orange-500' },
    { value: 'special', label: 'Special Recognition', color: 'from-indigo-500 to-blue-500' }
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        const userProfile = profiles[0];
        setProfile(userProfile);

        // Load BlockWards based on user type
        let bwData = [];
        if (userProfile.user_type === 'student') {
          bwData = await base44.entities.BlockWard.filter({ student_email: user.email }, '-created_date');
        } else if (userProfile.user_type === 'teacher') {
          bwData = await base44.entities.BlockWard.filter({ issuer_email: user.email }, '-created_date');
          // Load students for minting
          const allProfiles = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setStudents(allProfiles);
        } else {
          bwData = await base44.entities.BlockWard.list('-created_date');
          const allProfiles = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setStudents(allProfiles);
        }
        setBlockWards(bwData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateTokenId = () => {
    return `BW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const generateTransactionHash = () => {
    const chars = '0123456789abcdef';
    let hash = '0x';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  };

  const handleMintBlockWard = async () => {
    if (!newBlockWard.student_email || !newBlockWard.title || !newBlockWard.category) return;
    
    setMinting(true);
    try {
      const user = await base44.auth.me();
      const studentProfile = students.find(s => s.user_email === newBlockWard.student_email);
      
      if (!studentProfile) {
        toast.error('Student not found');
        setMinting(false);
        return;
      }

      const blockWardData = {
        ...newBlockWard,
        student_name: `${studentProfile.first_name} ${studentProfile.last_name}`,
        student_wallet: studentProfile.wallet_address,
        issuer_email: user.email,
        issuer_name: `${profile.first_name} ${profile.last_name}`,
        issuer_wallet: profile.wallet_address,
        school_id: profile.school_id,
        token_id: generateTokenId(),
        transaction_hash: generateTransactionHash(),
        block_number: Math.floor(Math.random() * 1000000) + 50000000,
        minted_at: new Date().toISOString(),
        status: 'active'
      };

      await base44.entities.BlockWard.create(blockWardData);
      
      setShowMintDialog(false);
      setNewBlockWard({ student_email: '', title: '', description: '', category: '' });
      loadData();
      toast.success('BlockWard minted successfully!');
    } catch (error) {
      console.error('Error minting BlockWard:', error);
      toast.error('Failed to mint BlockWard');
    } finally {
      setMinting(false);
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
      loadData();
      setSelectedBlockWard(null);
      toast.success('BlockWard revoked');
    } catch (error) {
      toast.error('Failed to revoke BlockWard');
    }
  };

  const getCategoryInfo = (cat) => categories.find(c => c.value === cat) || categories[5];

  const filteredBlockWards = blockWards.filter(bw => 
    bw.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    bw.student_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canMint = profile?.user_type === 'teacher' && profile?.can_issue_blockwards || profile?.user_type === 'admin';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">BlockWards</h1>
          <p className="text-slate-500 mt-1">
            {profile?.user_type === 'student' 
              ? 'Your blockchain-verified achievements' 
              : 'Manage soulbound achievement tokens'}
          </p>
        </div>
        {canMint && (
          <Dialog open={showMintDialog} onOpenChange={setShowMintDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Shield className="h-4 w-4 mr-2" />
                Mint BlockWard
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Mint New BlockWard</DialogTitle>
                <DialogDescription>
                  Issue a soulbound NFT achievement to a student
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Student *</Label>
                  <Select
                    value={newBlockWard.student_email}
                    onValueChange={(value) => setNewBlockWard({ ...newBlockWard, student_email: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.user_email}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input
                    value={newBlockWard.title}
                    onChange={(e) => setNewBlockWard({ ...newBlockWard, title: e.target.value })}
                    placeholder="e.g. Top in Mathematics - Term 1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <Select
                    value={newBlockWard.category}
                    onValueChange={(value) => setNewBlockWard({ ...newBlockWard, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newBlockWard.description}
                    onChange={(e) => setNewBlockWard({ ...newBlockWard, description: e.target.value })}
                    placeholder="Describe the achievement..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowMintDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleMintBlockWard} 
                  disabled={!newBlockWard.student_email || !newBlockWard.title || !newBlockWard.category || minting}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600"
                >
                  {minting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Mint BlockWard
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {profile?.user_type === 'teacher' && !profile?.can_issue_blockwards && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Not authorized to mint
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
                    {selectedBlockWard.status === 'active' ? 'Verified on Polygon' : 'Revoked'}
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
                <div className="pt-2 border-t">
                  <p className="text-sm text-slate-500 mb-1">Transaction Hash</p>
                  <p className="font-mono text-xs text-slate-600 break-all">{selectedBlockWard.transaction_hash}</p>
                </div>
              </div>
              {(profile?.user_type === 'admin' && selectedBlockWard.status === 'active') && (
                <DialogFooter className="pt-4">
                  <Button 
                    variant="destructive" 
                    onClick={() => handleRevokeBlockWard(selectedBlockWard)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Revoke BlockWard
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}