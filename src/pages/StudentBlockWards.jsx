import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BlockWardCard from '@/components/blockwards/BlockWardCard';
import BlockWardDetailModal from '@/components/blockwards/BlockWardDetailModal';
import VaultDetailsModal from '@/components/blockwards/VaultDetailsModal';
import { base44 } from '@/api/base44Client';
import { Shield, Award, Loader2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

function StudentBlockWardsContent() {
  const [loading, setLoading] = useState(true);
  const [blockWards, setBlockWards] = useState([]);
  const [vault, setVault] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedBlockWard, setSelectedBlockWard] = useState(null);
  const [showVaultModal, setShowVaultModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Use the backend function to fetch earned achievements — bypasses RLS
      // and guarantees the student sees their BlockWards immediately after delivery.
      const res = await base44.functions.invoke('getStudentVault', {});
      const data = res.data;
      if (data?.ok) {
        setBlockWards(data.achievements || []);
      }

      // Load profile for vault display
      const userProfiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      const profile = userProfiles[0] || null;

      if (profile) {
        setVault({
          studentId: profile.id,
          status: 'active',
          publicAddress: profile.wallet_address,
          createdAt: profile.created_date
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBlockWards = blockWards.filter(bw => 
    categoryFilter === 'all' || bw.category === categoryFilter
  );

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
      <div>
        <h1 className="text-3xl font-bold text-foreground">My BlockWards</h1>
        <p className="text-muted-foreground mt-1">
          Your achievements are stored securely in your BlockWard Vault
        </p>
      </div>

      {/* Stats & Vault */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total BlockWards</p>
                  <p className="text-4xl font-bold text-foreground mt-1">{blockWards.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">Achievements earned</p>
                </div>
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <Award className="h-8 w-8 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="shadow-lg bg-success/5 border-success/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-success flex items-center justify-center">
                    <Shield className="h-6 w-6 text-success-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Vault Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <Badge className="bg-success/10 text-success border-success/30">
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Your achievements are securely stored by BlockWard
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVaultModal(true)}
                className="w-full border-success/30 hover:bg-success/10"
              >
                View Vault Details
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Collection */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">My Collection</CardTitle>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="academic">Academic</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="arts">Arts</SelectItem>
                <SelectItem value="leadership">Leadership</SelectItem>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="special">Special</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBlockWards.length === 0 ? (
            <div className="text-center py-16">
              <Award className="h-20 w-20 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                {blockWards.length === 0 ? 'No BlockWards Yet' : 'No matches found'}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {blockWards.length === 0 
                  ? "When your teacher issues awards, they'll show up here. Keep up the great work!"
                  : 'Try selecting a different category'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBlockWards.map((bw, index) => (
                <motion.div
                  key={bw.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <BlockWardCard
                    blockWard={bw}
                    onClick={() => setSelectedBlockWard(bw)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">About Your BlockWards</h3>
              <p className="text-sm text-muted-foreground">
                Your BlockWards are unique achievements that are permanently tied to you. 
                They cannot be transferred or given away - they're proof of what you've accomplished!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <BlockWardDetailModal
        blockWard={selectedBlockWard}
        open={!!selectedBlockWard}
        onClose={() => setSelectedBlockWard(null)}
      />

      <VaultDetailsModal
        vault={vault}
        open={showVaultModal}
        onClose={() => setShowVaultModal(false)}
      />
    </div>
  );
}

import RoleGuard from '@/components/auth/RoleGuard';
export default function StudentBlockWards() { return <RoleGuard roles={['student']}><StudentBlockWardsImpl/></RoleGuard>; }
function StudentBlockWardsImpl() {
  return (
    <ProtectedRoute>
      <StudentBlockWardsContent />
    </ProtectedRoute>
  );
}