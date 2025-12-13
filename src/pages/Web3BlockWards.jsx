import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Wallet } from 'lucide-react';
import NFTMinter from '@/components/web3/NFTMinter';
import NFTGallery from '@/components/web3/NFTGallery';
import WalletButton from '@/components/web3/WalletButton';

export default function Web3BlockWards() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [students, setStudents] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ user_email: user.email });
      
      if (profiles.length > 0) {
        setProfile(profiles[0]);
        
        if (profiles[0].user_type === 'teacher' || profiles[0].user_type === 'admin') {
          const allProfiles = await base44.entities.UserProfile.filter({ user_type: 'student' });
          setStudents(allProfiles);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const isTeacherOrAdmin = profile?.user_type === 'teacher' || profile?.user_type === 'admin';

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Web3 BlockWards</h1>
          <p className="text-slate-500 mt-1">
            Real blockchain NFTs on Base network
          </p>
        </div>
        <WalletButton />
      </div>

      {/* Info Banner */}
      <Card className="border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">Connected to Base Network</h3>
              <p className="text-sm text-slate-600">
                All NFTs are minted on Base mainnet (Layer 2 Ethereum). Students need to connect their MetaMask wallet to receive and view their achievements.
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-violet-100 text-violet-700">
                  Low Gas Fees
                </Badge>
                <Badge className="bg-indigo-100 text-indigo-700">
                  ERC-721 Standard
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isTeacherOrAdmin ? (
        <Tabs defaultValue="mint" className="space-y-6">
          <TabsList>
            <TabsTrigger value="mint">Mint NFT</TabsTrigger>
            <TabsTrigger value="gallery">My Collection</TabsTrigger>
          </TabsList>

          <TabsContent value="mint">
            <NFTMinter students={students} />
          </TabsContent>

          <TabsContent value="gallery">
            <NFTGallery />
          </TabsContent>
        </Tabs>
      ) : (
        <NFTGallery />
      )}

      {/* Setup Instructions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg">Setup Requirements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">For Administrators:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Deploy the BlockWard smart contract to Base mainnet</li>
              <li>Update CONTRACT_ADDRESS in components/web3/NFTMinter.jsx</li>
              <li>Get a WalletConnect Project ID from https://cloud.walletconnect.com</li>
              <li>Update projectId in components/web3/Web3Provider.jsx</li>
              <li>Set up IPFS for metadata storage (Pinata recommended)</li>
            </ol>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 mb-2">For Students:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
              <li>Install MetaMask browser extension</li>
              <li>Add Base network to MetaMask</li>
              <li>Get some ETH on Base for transactions (can bridge from Ethereum)</li>
              <li>Connect wallet to view your NFT collection</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}