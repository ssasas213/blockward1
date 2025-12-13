import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import WalletButton from './WalletButton';

// Contract ABI - Update after deployment
const BLOCKWARD_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "to", "type": "address"},
      {"internalType": "string", "name": "metadataURI", "type": "string"}
    ],
    "name": "mintBlockWard",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Update with your deployed contract address
const CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000';

export default function NFTMinter({ students = [] }) {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    studentAddress: '',
    title: '',
    description: '',
    category: '',
    imageUrl: ''
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const categories = [
    { value: 'academic', label: 'Academic Excellence' },
    { value: 'sports', label: 'Sports Achievement' },
    { value: 'arts', label: 'Arts & Creativity' },
    { value: 'leadership', label: 'Leadership' },
    { value: 'community', label: 'Community Service' },
    { value: 'special', label: 'Special Recognition' }
  ];

  const handleMint = async () => {
    if (!formData.studentAddress || !formData.title || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Create metadata JSON
    const metadata = {
      name: formData.title,
      description: formData.description,
      image: formData.imageUrl || 'ipfs://YOUR_DEFAULT_IMAGE',
      attributes: [
        { trait_type: 'Category', value: formData.category },
        { trait_type: 'Issued By', value: address },
        { trait_type: 'Date', value: new Date().toISOString() }
      ]
    };

    // In production, upload to IPFS first
    const metadataURI = `ipfs://QmYOUR_IPFS_HASH/${formData.title}`;

    try {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: BLOCKWARD_ABI,
        functionName: 'mintBlockWard',
        args: [formData.studentAddress, metadataURI],
      });
    } catch (err) {
      toast.error('Failed to mint NFT');
      console.error(err);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6 text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">BlockWard Minted!</h3>
          <p className="text-slate-600 mb-4">Your NFT has been successfully minted on Base.</p>
          {hash && (
            <Button variant="outline" asChild>
              <a 
                href={`https://basescan.org/tx/${hash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2"
              >
                View on Basescan
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
          <Button 
            className="mt-4 w-full" 
            onClick={() => {
              setFormData({
                studentAddress: '',
                title: '',
                description: '',
                category: '',
                imageUrl: ''
              });
              window.location.reload();
            }}
          >
            Mint Another
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle>Mint BlockWard NFT</CardTitle>
        <CardDescription>Issue a blockchain-verified achievement on Base</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isConnected ? (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">Connect your wallet to mint NFTs</p>
            <WalletButton />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Student Wallet Address *</Label>
              <Input
                value={formData.studentAddress}
                onChange={(e) => setFormData({ ...formData, studentAddress: e.target.value })}
                placeholder="0x..."
              />
            </div>

            <div className="space-y-2">
              <Label>Achievement Title *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g. Top in Mathematics - Term 1"
              />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
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
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the achievement..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL (optional)</Label>
              <Input
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="ipfs://... or https://..."
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error.message}
              </div>
            )}

            <Button
              onClick={handleMint}
              disabled={isPending || isConfirming}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {isPending || isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isPending ? 'Confirm in Wallet...' : 'Minting...'}
                </>
              ) : (
                'Mint BlockWard NFT'
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}