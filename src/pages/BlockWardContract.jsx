import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Shield, Lock, Zap, FileCode, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function BlockWardContract() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <FileCode className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">BlockWard Smart Contract</h1>
            <p className="text-slate-500">Solidity implementation for Polygon deployment</p>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">Testnet Only for Students</h3>
              <p className="text-sm text-amber-800">
                This contract is production-ready but should only be deployed to Polygon testnet by students. 
                Mainnet deployment requires adult supervision, security audits, and proper gas wallet management.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Overview */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Contract Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Contract Details</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Solidity Version: ^0.8.20</li>
                <li>• Standard: ERC721 + Extensions</li>
                <li>• Network: Polygon (Mumbai testnet / Mainnet)</li>
                <li>• Name: BlockWard</li>
                <li>• Symbol: BWARD</li>
              </ul>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg">
              <h4 className="font-semibold text-slate-900 mb-2">Key Features</h4>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>• Soulbound (non-transferable) NFTs</li>
                <li>• Role-based access control</li>
                <li>• On-chain metadata storage</li>
                <li>• Revocation capability</li>
                <li>• Event emissions for tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Access Roles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 bg-violet-50 rounded-lg border border-violet-200">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-violet-600">DEFAULT_ADMIN_ROLE</Badge>
            </div>
            <p className="text-sm text-slate-600">
              Granted to contract deployer. Can revoke BlockWards and manage roles.
            </p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-blue-600">ISSUER_ROLE</Badge>
            </div>
            <p className="text-sm text-slate-600">
              Granted to backend gas wallet. Can mint BlockWards to students.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Full Contract Code */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Complete Solidity Contract
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-6 overflow-x-auto text-sm">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title BlockWardSoulbound
 * @dev Soulbound NFT for student achievements on Polygon
 * Non-transferable tokens that permanently record student accomplishments
 */
contract BlockWardSoulbound is ERC721, ERC721URIStorage, AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    uint256 private _nextTokenId;

    struct WardData {
        address student;      // Student's wallet address
        bytes32 schoolId;     // School identifier
        string title;         // Achievement title
        string description;   // Achievement description
        string category;      // Category: academic, sports, arts, etc.
        uint64 issuedAt;      // Timestamp of issuance
        bool revoked;         // Revocation status
    }

    // Mapping from token ID to achievement data
    mapping(uint256 => WardData) public wardData;

    // Events
    event BlockWardIssued(
        address indexed student,
        uint256 indexed tokenId,
        bytes32 indexed schoolId,
        string category,
        uint64 issuedAt
    );

    event BlockWardRevoked(
        uint256 indexed tokenId,
        address indexed admin,
        uint64 revokedAt
    );

    /**
     * @dev Constructor sets up roles and initializes token counter
     * @param issuer Address of the backend wallet that will mint tokens
     */
    constructor(address issuer) ERC721("BlockWard", "BWARD") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, issuer);
        _nextTokenId = 1;
    }

    /**
     * @dev Issue a new BlockWard to a student
     * @param student The student's wallet address
     * @param schoolId The school's unique identifier
     * @param title Achievement title
     * @param description Achievement description
     * @param category Achievement category
     * @param tokenURI_ Metadata URI (typically IPFS)
     */
    function issueBlockWard(
        address student,
        bytes32 schoolId,
        string calldata title,
        string calldata description,
        string calldata category,
        string calldata tokenURI_
    ) external onlyRole(ISSUER_ROLE) {
        require(student != address(0), "Invalid student address");

        uint256 tokenId = _nextTokenId++;
        _safeMint(student, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        wardData[tokenId] = WardData({
            student: student,
            schoolId: schoolId,
            title: title,
            description: description,
            category: category,
            issuedAt: uint64(block.timestamp),
            revoked: false
        });

        emit BlockWardIssued(
            student, 
            tokenId, 
            schoolId, 
            category, 
            uint64(block.timestamp)
        );
    }

    /**
     * @dev Revoke a BlockWard (admin only)
     * @param tokenId The token ID to revoke
     */
    function revokeBlockWard(uint256 tokenId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        
        wardData[tokenId].revoked = true;
        _burn(tokenId);

        emit BlockWardRevoked(
            tokenId, 
            msg.sender, 
            uint64(block.timestamp)
        );
    }

    /**
     * @dev Get all BlockWards for a student
     * @param student The student's address
     * @return Array of token IDs owned by the student
     */
    function getStudentBlockWards(address student) 
        external 
        view 
        returns (uint256[] memory) 
    {
        uint256 balance = balanceOf(student);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;
        
        for (uint256 tokenId = 1; tokenId < _nextTokenId; tokenId++) {
            if (_ownerOf(tokenId) == student) {
                tokens[index] = tokenId;
                index++;
            }
        }
        
        return tokens;
    }

    // --- SOULBOUND: Disable transfers and approvals ---

    /**
     * @dev Override _update to prevent transfers (soulbound)
     * Allows minting (from address(0)) and burning (to address(0)) only
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721) returns (address) {
        address from = _ownerOf(tokenId);
        
        // Allow minting and burning, block transfers
        if (from != address(0) && to != address(0)) {
            revert("Soulbound: transfers disabled");
        }
        
        return super._update(to, tokenId, auth);
    }

    /**
     * @dev Disable approve function for soulbound tokens
     */
    function approve(address, uint256) public pure override {
        revert("Soulbound: approvals disabled");
    }

    /**
     * @dev Disable setApprovalForAll for soulbound tokens
     */
    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: approvals disabled");
    }

    // --- Required overrides ---

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
}`}
          </pre>
        </CardContent>
      </Card>

      {/* Function Explanations */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            How It Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Main Functions:</h3>
            
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <code className="text-violet-600 font-semibold">issueBlockWard()</code>
                <p className="text-sm text-slate-600 mt-2">
                  Called by backend (ISSUER_ROLE) to mint a new achievement NFT to a student. 
                  Stores all metadata on-chain and emits an event for indexing.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <code className="text-violet-600 font-semibold">revokeBlockWard()</code>
                <p className="text-sm text-slate-600 mt-2">
                  Admin-only function to burn a token if an achievement needs to be revoked. 
                  Sets the revoked flag and permanently removes the token.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <code className="text-violet-600 font-semibold">getStudentBlockWards()</code>
                <p className="text-sm text-slate-600 mt-2">
                  View function that returns all token IDs owned by a specific student. 
                  Useful for displaying a student's achievement collection.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <code className="text-violet-600 font-semibold">_update()</code>
                <p className="text-sm text-slate-600 mt-2">
                  Internal override that enforces soulbound behavior. Blocks all transfers 
                  between addresses while still allowing minting and burning.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Soulbound Implementation:</h3>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-slate-700">
                <strong>Non-transferable:</strong> Once minted, BlockWards cannot be transferred, 
                sold, or given away. They are permanently bound to the student's wallet address, 
                ensuring achievements remain authentic and cannot be traded.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Instructions */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Deployment Steps (Testnet)</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">1.</span>
              <span>Install Hardhat or Foundry development environment</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">2.</span>
              <span>Install OpenZeppelin contracts: <code className="bg-slate-100 px-2 py-1 rounded">npm install @openzeppelin/contracts</code></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">3.</span>
              <span>Get Mumbai testnet MATIC from a faucet (free)</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">4.</span>
              <span>Create backend wallet address to pass as <code className="bg-slate-100 px-2 py-1 rounded">issuer</code> parameter</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">5.</span>
              <span>Deploy contract: <code className="bg-slate-100 px-2 py-1 rounded">npx hardhat run scripts/deploy.js --network mumbai</code></span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">6.</span>
              <span>Save the deployed contract address</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 font-bold text-violet-600">7.</span>
              <span>Verify on PolygonScan: <code className="bg-slate-100 px-2 py-1 rounded">npx hardhat verify --network mumbai [ADDRESS] [ISSUER]</code></span>
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Required Dependencies */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Required Dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-sm">
{`{
  "dependencies": {
    "@openzeppelin/contracts": "^5.0.0"
  },
  "devDependencies": {
    "hardhat": "^2.19.0",
    "@nomicfoundation/hardhat-toolbox": "^4.0.0"
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}