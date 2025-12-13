import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Code, Shield, FileCode, Rocket } from 'lucide-react';

export default function SmartContracts() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Smart Contracts</h1>
        <p className="text-slate-500">
          Complete Solidity contracts for Base mainnet deployment
        </p>
      </div>

      <Alert className="border-violet-200 bg-violet-50">
        <Shield className="h-4 w-4 text-violet-600" />
        <AlertDescription className="text-violet-900">
          These contracts are designed for Base mainnet. Deploy using Hardhat or Foundry with proper testing and auditing.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="main" className="space-y-6">
        <TabsList>
          <TabsTrigger value="main">Main Contract</TabsTrigger>
          <TabsTrigger value="deploy">Deployment Script</TabsTrigger>
          <TabsTrigger value="setup">Setup Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="main">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">BlockWard.sol</CardTitle>
                <Badge>ERC-721</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg overflow-x-auto text-sm">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title BlockWard
 * @dev ERC-721 NFT contract for educational achievement certificates
 * @notice This contract is designed for Base mainnet deployment
 */
contract BlockWard is ERC721, ERC721URIStorage, AccessControl {
    using Counters for Counters.Counter;

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    Counters.Counter private _tokenIdCounter;

    // Events
    event BlockWardMinted(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed issuer,
        string metadataURI
    );
    
    event BlockWardRevoked(
        uint256 indexed tokenId,
        address indexed revokedBy,
        string reason
    );

    // Mapping to track revoked tokens
    mapping(uint256 => bool) public revokedTokens;
    mapping(uint256 => string) public revokeReasons;

    constructor() ERC721("BlockWard", "BWARD") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
    }

    /**
     * @dev Mints a new BlockWard NFT
     * @param to Recipient's wallet address (student)
     * @param metadataURI IPFS URI containing NFT metadata
     */
    function mintBlockWard(
        address to,
        string memory metadataURI
    ) public onlyRole(ISSUER_ROLE) returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(bytes(metadataURI).length > 0, "Metadata URI required");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit BlockWardMinted(tokenId, to, msg.sender, metadataURI);

        return tokenId;
    }

    /**
     * @dev Batch mint multiple BlockWards
     * @param recipients Array of recipient addresses
     * @param metadataURIs Array of metadata URIs
     */
    function batchMintBlockWards(
        address[] calldata recipients,
        string[] calldata metadataURIs
    ) external onlyRole(ISSUER_ROLE) {
        require(
            recipients.length == metadataURIs.length,
            "Arrays length mismatch"
        );
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length <= 50, "Batch size too large");

        for (uint256 i = 0; i < recipients.length; i++) {
            mintBlockWard(recipients[i], metadataURIs[i]);
        }
    }

    /**
     * @dev Revokes a BlockWard (marks as invalid)
     * @param tokenId Token ID to revoke
     * @param reason Reason for revocation
     */
    function revokeBlockWard(
        uint256 tokenId,
        string memory reason
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        require(!revokedTokens[tokenId], "Token already revoked");

        revokedTokens[tokenId] = true;
        revokeReasons[tokenId] = reason;

        emit BlockWardRevoked(tokenId, msg.sender, reason);
    }

    /**
     * @dev Returns all token IDs owned by an address
     * @param owner Address to query
     */
    function tokensOfOwner(address owner) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](tokenCount);
        uint256 index = 0;

        for (uint256 i = 0; i < _tokenIdCounter.current(); i++) {
            if (_exists(i) && ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
            }
        }

        return tokenIds;
    }

    /**
     * @dev Checks if a token is valid (not revoked)
     * @param tokenId Token ID to check
     */
    function isValidToken(uint256 tokenId) 
        external 
        view 
        returns (bool) 
    {
        return _exists(tokenId) && !revokedTokens[tokenId];
    }

    /**
     * @dev Returns total number of minted tokens
     */
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter.current();
    }

    // Override required functions
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Prevent transfers (soulbound)
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal virtual override {
        require(
            from == address(0) || to == address(0),
            "BlockWards are soulbound and cannot be transferred"
        );
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deploy">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Hardhat Deployment Script</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg overflow-x-auto text-sm">
{`// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  console.log("Deploying BlockWard contract to Base mainnet...");

  const BlockWard = await hre.ethers.getContractFactory("BlockWard");
  const blockward = await BlockWard.deploy();

  await blockward.deployed();

  console.log("BlockWard deployed to:", blockward.address);
  console.log("Transaction hash:", blockward.deployTransaction.hash);

  // Grant ISSUER_ROLE to teacher addresses
  const teacherAddresses = [
    "0xYourTeacherAddress1",
    "0xYourTeacherAddress2"
  ];

  const ISSUER_ROLE = await blockward.ISSUER_ROLE();
  
  for (const teacher of teacherAddresses) {
    const tx = await blockward.grantRole(ISSUER_ROLE, teacher);
    await tx.wait();
    console.log(\`Granted ISSUER_ROLE to \${teacher}\`);
  }

  console.log("\\nDeployment complete! Update CONTRACT_ADDRESS in:");
  console.log("- components/web3/NFTMinter.jsx");
  console.log("- components/web3/NFTGallery.jsx");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`}
              </pre>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg mt-6">
            <CardHeader>
              <CardTitle className="text-lg">hardhat.config.js</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-6 rounded-lg overflow-x-auto text-sm">
{`require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    base: {
      url: "https://mainnet.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 8453,
    },
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: {
      base: process.env.BASESCAN_API_KEY,
    },
  },
};`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Complete Setup Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Code className="h-5 w-5 text-violet-600" />
                  1. Install Dependencies
                </h3>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm">
{`npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts dotenv`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <FileCode className="h-5 w-5 text-violet-600" />
                  2. Create .env File
                </h3>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm">
{`PRIVATE_KEY=your_wallet_private_key
BASESCAN_API_KEY=your_basescan_api_key
ALCHEMY_API_KEY=your_alchemy_api_key`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-violet-600" />
                  3. Deploy to Base
                </h3>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-sm">
{`# Test on Sepolia testnet first
npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to mainnet
npx hardhat run scripts/deploy.js --network base

# Verify contract
npx hardhat verify --network base DEPLOYED_CONTRACT_ADDRESS`}
                </pre>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">4. Update Frontend</h3>
                <p className="text-sm text-slate-600 mb-2">
                  After deployment, update these files with your contract address:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  <li>components/web3/NFTMinter.jsx</li>
                  <li>components/web3/NFTGallery.jsx</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">5. Get WalletConnect Project ID</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Visit https://cloud.walletconnect.com</li>
                  <li>Create a new project</li>
                  <li>Copy the Project ID</li>
                  <li>Update components/web3/Web3Provider.jsx</li>
                </ol>
              </div>

              <div>
                <h3 className="font-semibold text-slate-900 mb-3">6. Setup IPFS (Pinata)</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                  <li>Create account at https://pinata.cloud</li>
                  <li>Get API keys</li>
                  <li>Upload NFT images and metadata JSON files</li>
                  <li>Use IPFS URIs in minting interface</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}