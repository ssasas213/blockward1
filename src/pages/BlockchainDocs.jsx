import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlockchainArchitecture from '@/components/docs/BlockchainArchitecture';
import SmartContracts from '@/components/docs/SmartContracts';

export default function BlockchainDocs() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Blockchain Documentation</h1>
        <p className="text-slate-500">
          Complete guide to the Web3 architecture and smart contracts
        </p>
      </div>

      <Tabs defaultValue="architecture" className="space-y-6">
        <TabsList>
          <TabsTrigger value="architecture">Architecture</TabsTrigger>
          <TabsTrigger value="contracts">Smart Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="architecture">
          <BlockchainArchitecture />
        </TabsContent>

        <TabsContent value="contracts">
          <SmartContracts />
        </TabsContent>
      </Tabs>
    </div>
  );
}