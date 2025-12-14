import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Network, CheckCircle2 } from 'lucide-react';

export default function NetworkSwitcher() {
  const { chain } = useAccount();
  const { switchChain } = useSwitchChain();

  const networks = [
    { id: base.id, name: 'Base Mainnet', chain: base },
    { id: baseSepolia.id, name: 'Base Sepolia', chain: baseSepolia }
  ];

  if (!chain) return null;

  const isWrongNetwork = chain.id !== base.id && chain.id !== baseSepolia.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={isWrongNetwork ? "destructive" : "outline"} 
          size="sm"
          className="gap-2"
        >
          <Network className="h-4 w-4" />
          {chain.name}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {networks.map((network) => (
          <DropdownMenuItem
            key={network.id}
            onClick={() => switchChain({ chainId: network.id })}
            className="flex items-center justify-between gap-3"
          >
            <span>{network.name}</span>
            {chain.id === network.id && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}