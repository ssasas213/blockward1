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
import { api, blockWardCategories } from '@/components/blockwards/mockData';
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
      const [bwData, vaultData] = await Promise.all([
        api.getStudentBlockWards(),
        api.getStudentVault()
      ]);
      setBlockWards(bwData);
      setVault(vaultData);
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
        <h1 className="text-3xl font-bold text-slate-900">My BlockWards</h1>
        <p className="text-slate-500 mt-1">
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
          <Card className="border-0 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total BlockWards</p>
                  <p className="text-4xl font-bold text-slate-900 mt-1">{blockWards.length}</p>
                  <p className="text-sm text-slate-600 mt-1">Achievements earned</p>
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
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-green-500 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-green-900">Vault Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <Badge className="bg-green-100 text-green-700 border-green-300">
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-green-800 mb-4">
                Your achievements are securely stored by BlockWard
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVaultModal(true)}
                className="w-full border-green-300 hover:bg-green-100"
              >
                View Vault Details
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Collection */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">My Collection</CardTitle>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {blockWardCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredBlockWards.length === 0 ? (
            <div className="text-center py-16">
              <Award className="h-20 w-20 mx-auto text-slate-200 mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                {blockWards.length === 0 ? 'No BlockWards Yet' : 'No matches found'}
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
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
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-violet-600 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">About Your BlockWards</h3>
              <p className="text-sm text-slate-600">
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

export default function StudentBlockWards() {
  return (
    <ProtectedRoute>
      <StudentBlockWardsContent />
    </ProtectedRoute>
  );
}