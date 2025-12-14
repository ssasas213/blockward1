import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ExternalLink, Loader2 } from 'lucide-react';
import WalletButton from './WalletButton';
import NFTDetailModal from './NFTDetailModal';
import { motion } from 'framer-motion';

// Contract ABI for reading
const BLOCKWARD_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "tokensOfOwner",
    "outputs": [{"internalType": "uint256[]", "name": "", "type": "uint256[]"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "tokenURI",
    "outputs": [{"internalType": "string", "name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function NFTGallery() {
  const { address, isConnected } = useAccount();
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);

  // Read user's NFT token IDs
  const { data: tokenIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: BLOCKWARD_ABI,
    functionName: 'tokensOfOwner',
    args: [address],
    enabled: !!address,
  });

  useEffect(() => {
    if (tokenIds && tokenIds.length > 0) {
      loadNFTMetadata();
    }
  }, [tokenIds]);

  const loadNFTMetadata = async () => {
    setLoading(true);
    try {
      // In production, fetch metadata for each token
      const mockNFTs = [
        {
          id: 1,
          name: 'Top Mathematics Student',
          description: 'Outstanding achievement in Mathematics - Term 1 2024',
          image: 'https://via.placeholder.com/400x400/8B5CF6/ffffff?text=Math+Award',
          category: 'academic',
          date: '2024-01-15'
        },
        {
          id: 2,
          name: 'Leadership Excellence',
          description: 'Demonstrated exceptional leadership in student council',
          image: 'https://via.placeholder.com/400x400/3B82F6/ffffff?text=Leadership',
          category: 'leadership',
          date: '2024-02-20'
        }
      ];
      setNfts(mockNFTs);
    } catch (error) {
      console.error('Error loading NFT metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const categoryColors = {
    academic: 'from-blue-500 to-cyan-500',
    sports: 'from-emerald-500 to-green-500',
    arts: 'from-pink-500 to-rose-500',
    leadership: 'from-violet-500 to-purple-500',
    community: 'from-amber-500 to-orange-500',
    special: 'from-indigo-500 to-blue-500'
  };

  if (!isConnected) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-16">
          <Shield className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">Connect Your Wallet</h3>
          <p className="text-slate-500 mb-6">
            Connect your wallet to view your BlockWard NFT collection
          </p>
          <WalletButton />
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="text-center py-16">
          <Shield className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No BlockWards Yet</h3>
          <p className="text-slate-500">
            Your NFT achievements will appear here once you earn them!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nfts.map((nft, i) => (
          <motion.div
            key={nft.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.1 }}
          >
            <Card 
              className="border-0 shadow-lg hover:shadow-xl transition-all overflow-hidden group cursor-pointer"
              onClick={() => setSelectedNFT(nft)}
            >
            <div className={`h-48 bg-gradient-to-br ${categoryColors[nft.category]} relative`}>
              <img 
                src={nft.image} 
                alt={nft.name}
                className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-4 right-4">
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                  Verified
                </Badge>
              </div>
            </div>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-violet-600" />
                <h3 className="font-bold text-slate-900">{nft.name}</h3>
              </div>
              <p className="text-sm text-slate-600 mb-3">{nft.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">#{nft.id}</span>
                <a 
                  href={`https://basescan.org/nft/${CONTRACT_ADDRESS}/${nft.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1"
                >
                  View on Basescan
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      
      <NFTDetailModal 
        nft={selectedNFT} 
        open={!!selectedNFT} 
        onClose={() => setSelectedNFT(null)} 
      />
    </>
  );
}