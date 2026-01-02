import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Award, History } from 'lucide-react';
import VaultStatusCard from '@/components/blockwards/VaultStatusCard';
import IssuerStatusCard from '@/components/blockwards/IssuerStatusCard';
import BlockWardIssueForm from '@/components/blockwards/BlockWardIssueForm';
import StudentVaultView from '@/components/blockwards/StudentVaultView';
import VaultDetailsModal from '@/components/blockwards/VaultDetailsModal';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

function Web3BlockWardsContent() {
  const { profile } = useAuth();
  const [vaultModalOpen, setVaultModalOpen] = useState(false);

  // Load students if teacher/admin
  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      if (profile?.user_type === 'teacher' || profile?.user_type === 'admin') {
        return await base44.entities.UserProfile.filter({ user_type: 'student' });
      }
      return [];
    },
    enabled: !!profile && (profile.user_type === 'teacher' || profile.user_type === 'admin')
  });

  // Load BlockWards
  const { data: blockWards = [], refetch: refetchBlockWards } = useQuery({
    queryKey: ['blockwards', profile?.user_type],
    queryFn: async () => {
      if (profile?.user_type === 'student') {
        return await base44.entities.BlockWard.filter({ 
          student_email: profile.user_email,
          status: 'active'
        });
      } else if (profile?.user_type === 'teacher' || profile?.user_type === 'admin') {
        return await base44.entities.BlockWard.filter({ 
          issuer_email: profile.user_email 
        }, '-created_date', 50);
      }
      return [];
    },
    enabled: !!profile
  });

  const isTeacherOrAdmin = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">BlockWard Vault</h1>
          <p className="text-slate-500 mt-1">
            {isTeacherOrAdmin 
              ? 'Issue verified achievements to students' 
              : 'Your secure collection of achievements'}
          </p>
        </div>
        <div>
          {!isTeacherOrAdmin && (
            <Button
              onClick={() => setVaultModalOpen(true)}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              <Shield className="h-4 w-4 mr-2" />
              My BlockWard Vault
            </Button>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900 mb-1">
                    {isTeacherOrAdmin ? 'Authorized Issuer' : 'Secure BlockWard Vault'}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {isTeacherOrAdmin 
                      ? 'BlockWards are stored in student vaults automatically. No wallet setup required for students.'
                      : 'BlockWards are stored in your secure BlockWard Vault. No wallet setup required.'}
                  </p>
                </div>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">
                  Testnet: Polygon Amoy
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-violet-100 text-violet-700">
                  Fully Managed
                </Badge>
                <Badge className="bg-indigo-100 text-indigo-700">
                  {isTeacherOrAdmin ? 'Gas Sponsored' : 'Zero Setup'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teacher/Admin View */}
      {isTeacherOrAdmin ? (
        <Tabs defaultValue="issue" className="space-y-6">
          <TabsList>
            <TabsTrigger value="issue">
              <Shield className="h-4 w-4 mr-2" />
              Issue BlockWard
            </TabsTrigger>
            <TabsTrigger value="issued">
              <History className="h-4 w-4 mr-2" />
              Issued History ({blockWards.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issue" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BlockWardIssueForm 
                  students={students} 
                  onIssueSuccess={refetchBlockWards}
                />
              </div>
              <div>
                <IssuerStatusCard profile={profile} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="issued">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                {blockWards.length > 0 ? (
                  <div className="space-y-3">
                    {blockWards.map((bw) => (
                      <div key={bw.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                            <Shield className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{bw.title}</p>
                            <p className="text-sm text-slate-500">
                              Issued to {bw.student_name} • {new Date(bw.created_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge className="bg-violet-100 text-violet-700">
                          {bw.category}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No BlockWards issued yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        /* Student View */
        <Tabs defaultValue="collection" className="space-y-6">
          <TabsList>
            <TabsTrigger value="collection">
              <Award className="h-4 w-4 mr-2" />
              My Collection ({blockWards.length})
            </TabsTrigger>
            <TabsTrigger value="vault">
              <Shield className="h-4 w-4 mr-2" />
              Vault Info
            </TabsTrigger>
          </TabsList>

          <TabsContent value="collection" className="space-y-6">
            <VaultStatusCard 
              walletAddress={profile?.wallet_address}
              onOpenVault={() => setVaultModalOpen(true)}
            />

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                {blockWards.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {blockWards.map((bw) => (
                      <div key={bw.id} className="p-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl text-white">
                        <div className="flex items-center justify-between mb-4">
                          <Shield className="h-8 w-8" />
                          <Badge className="bg-white/20 text-white border-0">
                            Verified
                          </Badge>
                        </div>
                        <h3 className="text-xl font-bold mb-1">{bw.title}</h3>
                        <p className="text-white/80 text-sm mb-3">{bw.description}</p>
                        <div className="flex items-center justify-between text-white/60 text-xs">
                          <span>{bw.category}</span>
                          <span>{new Date(bw.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-400">
                    <Award className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="mb-2">No BlockWards yet</p>
                    <p className="text-sm">Your teacher will issue BlockWards as you earn achievements</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vault">
            <StudentVaultView />
          </TabsContent>
        </Tabs>
      )}

      {/* Vault Details Modal */}
      <VaultDetailsModal
        open={vaultModalOpen}
        onClose={() => setVaultModalOpen(false)}
        vaultData={{
          status: 'active',
          createdAt: profile?.created_date || new Date().toISOString(),
          publicAddress: profile?.wallet_address || '0x...'
        }}
      />
    </div>
  );
}

export default function Web3BlockWards() {
  return (
    <ProtectedRoute>
      <Web3BlockWardsContent />
    </ProtectedRoute>
  );
}