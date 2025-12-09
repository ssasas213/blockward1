import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Server, Wallet, Shield, Zap } from 'lucide-react';

export default function BlockchainArchitecture() {
  return (
    <div className="space-y-8 max-w-6xl mx-auto p-8">
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">BlockWard Blockchain Architecture</h1>
        <p className="text-slate-600">Complete guide for Polygon integration with custodial wallets and meta-transactions</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contracts">Smart Contracts</TabsTrigger>
          <TabsTrigger value="backend">Backend</TabsTrigger>
          <TabsTrigger value="api">API Design</TabsTrigger>
          <TabsTrigger value="flow">Flow Diagram</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Architecture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-violet-50 rounded-lg">
                  <Shield className="h-8 w-8 text-violet-600 mb-2" />
                  <h3 className="font-semibold mb-2">Teachers</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>✓ No wallets needed</li>
                    <li>✓ No gas fees</li>
                    <li>✓ Sign off-chain only</li>
                    <li>✓ Issue BlockWards via UI</li>
                  </ul>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <Wallet className="h-8 w-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold mb-2">Students</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>✓ Custodial wallets</li>
                    <li>✓ Auto-generated</li>
                    <li>✓ Soulbound NFTs only</li>
                    <li>✓ View in UI + PolygonScan</li>
                  </ul>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <Server className="h-8 w-8 text-emerald-600 mb-2" />
                  <h3 className="font-semibold mb-2">BlockWard Backend</h3>
                  <ul className="text-sm text-slate-600 space-y-1">
                    <li>✓ Manages all wallets</li>
                    <li>✓ Pays all gas fees</li>
                    <li>✓ Executes meta-transactions</li>
                    <li>✓ Controls smart contracts</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>BlockWardSoulbound.sol</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract BlockWardSoulbound is ERC721, AccessControl, ERC2771Context {
    using Counters for Counters.Counter;
    
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    Counters.Counter private _tokenIds;
    
    struct BlockWardMetadata {
        address student;
        string teacherId;      // Off-chain teacher identifier
        string schoolId;       // Off-chain school identifier
        string title;
        string description;
        string category;       // academic, sports, arts, leadership, etc.
        uint256 issuedAt;
        string metadataURI;
    }
    
    mapping(uint256 => BlockWardMetadata) public blockwards;
    mapping(address => uint256[]) public studentBlockWards;
    
    event BlockWardIssued(
        uint256 indexed tokenId,
        address indexed student,
        string teacherId,
        string title,
        string category,
        uint256 issuedAt
    );
    
    constructor(
        address trustedForwarder
    ) ERC721("BlockWard", "BLKWRD") ERC2771Context(trustedForwarder) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }
    
    /**
     * @dev Issue a new BlockWard to a student
     * Only callable by addresses with MINTER_ROLE (backend wallet)
     */
    function issueBlockWard(
        address student,
        string memory teacherId,
        string memory schoolId,
        string memory title,
        string memory description,
        string memory category,
        string memory metadataURI
    ) public onlyRole(MINTER_ROLE) returns (uint256) {
        require(student != address(0), "Invalid student address");
        
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        
        _safeMint(student, newTokenId);
        
        blockwards[newTokenId] = BlockWardMetadata({
            student: student,
            teacherId: teacherId,
            schoolId: schoolId,
            title: title,
            description: description,
            category: category,
            issuedAt: block.timestamp,
            metadataURI: metadataURI
        });
        
        studentBlockWards[student].push(newTokenId);
        
        emit BlockWardIssued(
            newTokenId,
            student,
            teacherId,
            title,
            category,
            block.timestamp
        );
        
        return newTokenId;
    }
    
    /**
     * @dev Get all BlockWards owned by a student
     */
    function getStudentBlockWards(address student) 
        public 
        view 
        returns (uint256[] memory) 
    {
        return studentBlockWards[student];
    }
    
    /**
     * @dev Get BlockWard metadata
     */
    function getBlockWard(uint256 tokenId) 
        public 
        view 
        returns (BlockWardMetadata memory) 
    {
        require(_exists(tokenId), "BlockWard does not exist");
        return blockwards[tokenId];
    }
    
    /**
     * @dev Override tokenURI to return metadata URI
     */
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override 
        returns (string memory) 
    {
        require(_exists(tokenId), "Token does not exist");
        return blockwards[tokenId].metadataURI;
    }
    
    // SOULBOUND: Disable all transfer functions
    function transferFrom(
        address,
        address,
        uint256
    ) public pure override {
        revert("BlockWards are soulbound and cannot be transferred");
    }
    
    function safeTransferFrom(
        address,
        address,
        uint256,
        bytes memory
    ) public pure override {
        revert("BlockWards are soulbound and cannot be transferred");
    }
    
    function safeTransferFrom(
        address,
        address,
        uint256
    ) public pure override {
        revert("BlockWards are soulbound and cannot be transferred");
    }
    
    function approve(address, uint256) public pure override {
        revert("BlockWards are soulbound and cannot be approved");
    }
    
    function setApprovalForAll(address, bool) public pure override {
        revert("BlockWards are soulbound and cannot be approved");
    }
    
    // Required overrides for ERC2771Context
    function _msgSender() 
        internal 
        view 
        override(Context, ERC2771Context) 
        returns (address) 
    {
        return ERC2771Context._msgSender();
    }
    
    function _msgData() 
        internal 
        view 
        override(Context, ERC2771Context) 
        returns (bytes calldata) 
    {
        return ERC2771Context._msgData();
    }
    
    // Required override for AccessControl
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TrustedForwarder.sol (EIP-2771)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/metatx/MinimalForwarder.sol";

/**
 * @dev Trusted forwarder for meta-transactions
 * This allows teachers to sign transactions off-chain
 * while BlockWard backend pays the gas
 */
contract BlockWardForwarder is MinimalForwarder {
    // Inherits all functionality from OpenZeppelin's MinimalForwarder
    // This contract verifies signatures and forwards calls
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Backend Architecture (Node.js + ethers.js)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// backend/config/blockchain.js
require('dotenv').config();
const { ethers } = require('ethers');

// Polygon Mumbai (testnet) or Mainnet
const POLYGON_RPC = process.env.POLYGON_RPC_URL;
const GAS_WALLET_PRIVATE_KEY = process.env.GAS_WALLET_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.BLOCKWARD_CONTRACT_ADDRESS;
const FORWARDER_ADDRESS = process.env.FORWARDER_CONTRACT_ADDRESS;

const provider = new ethers.JsonRpcProvider(POLYGON_RPC);
const gasWallet = new ethers.Wallet(GAS_WALLET_PRIVATE_KEY, provider);

const contractABI = [...]; // Import from compiled contract
const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, gasWallet);

const forwarderABI = [...]; // Import forwarder ABI
const forwarder = new ethers.Contract(FORWARDER_ADDRESS, forwarderABI, gasWallet);

module.exports = { provider, gasWallet, contract, forwarder };`}
              </pre>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// backend/services/walletService.js
const { ethers } = require('ethers');
const crypto = require('crypto');

class WalletService {
  /**
   * Create a custodial wallet for a student
   * Private key is encrypted and stored securely
   */
  async createStudentWallet(studentEmail) {
    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    
    // Encrypt private key with app's master key
    const encryptedKey = this.encryptPrivateKey(wallet.privateKey);
    
    return {
      address: wallet.address,
      encryptedPrivateKey: encryptedKey
    };
  }
  
  encryptPrivateKey(privateKey) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decryptPrivateKey(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

module.exports = new WalletService();`}
              </pre>

              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// backend/services/blockwardService.js
const { contract, gasWallet } = require('../config/blockchain');
const { ethers } = require('ethers');

class BlockWardService {
  /**
   * Issue a BlockWard NFT to a student
   * This is called by the backend after teacher initiates
   */
  async issueBlockWard(data) {
    const {
      studentAddress,
      teacherId,
      schoolId,
      title,
      description,
      category,
      metadataURI
    } = data;
    
    try {
      // Call smart contract to mint NFT
      // Gas is paid by BlockWard's gas wallet
      const tx = await contract.issueBlockWard(
        studentAddress,
        teacherId,
        schoolId,
        title,
        description,
        category,
        metadataURI
      );
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      
      // Extract token ID from event
      const event = receipt.logs.find(
        log => log.eventName === 'BlockWardIssued'
      );
      const tokenId = event.args.tokenId;
      
      return {
        success: true,
        tokenId: tokenId.toString(),
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      };
    } catch (error) {
      console.error('Error issuing BlockWard:', error);
      throw error;
    }
  }
  
  /**
   * Get all BlockWards for a student
   */
  async getStudentBlockWards(studentAddress) {
    try {
      const tokenIds = await contract.getStudentBlockWards(studentAddress);
      
      const blockwards = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const metadata = await contract.getBlockWard(tokenId);
          return {
            tokenId: tokenId.toString(),
            ...metadata
          };
        })
      );
      
      return blockwards;
    } catch (error) {
      console.error('Error fetching BlockWards:', error);
      throw error;
    }
  }
  
  /**
   * Generate metadata JSON and upload to IPFS
   */
  async createMetadata(data) {
    const metadata = {
      name: data.title,
      description: data.description,
      image: data.imageUrl || 'ipfs://default-blockward-image',
      attributes: [
        {
          trait_type: "Category",
          value: data.category
        },
        {
          trait_type: "School",
          value: data.schoolName
        },
        {
          trait_type: "Issued By",
          value: data.teacherName
        },
        {
          trait_type: "Date Issued",
          value: new Date().toISOString()
        }
      ]
    };
    
    // Upload to IPFS (use Pinata, NFT.storage, etc.)
    const metadataURI = await this.uploadToIPFS(metadata);
    return metadataURI;
  }
  
  async uploadToIPFS(metadata) {
    // Implementation depends on your IPFS service
    // Example with NFT.storage or Pinata
    // Return: ipfs://QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
  }
}

module.exports = new BlockWardService();`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoints</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// backend/routes/blockward.js
const express = require('express');
const router = express.Router();
const blockwardService = require('../services/blockwardService');
const walletService = require('../services/walletService');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * POST /api/blockward/issue
 * Issue a new BlockWard (teachers only)
 */
router.post('/issue', authenticate, requireRole('teacher'), async (req, res) => {
  try {
    const {
      studentEmail,
      title,
      description,
      category,
      imageUrl
    } = req.body;
    
    // Get student profile from database
    const student = await db.getUserProfile(studentEmail);
    if (!student || !student.wallet_address) {
      return res.status(404).json({ error: 'Student not found or no wallet' });
    }
    
    // Get teacher info
    const teacher = await db.getUserProfile(req.user.email);
    
    // Create metadata and upload to IPFS
    const metadataURI = await blockwardService.createMetadata({
      title,
      description,
      category,
      imageUrl,
      schoolName: teacher.schoolName,
      teacherName: \`\${teacher.first_name} \${teacher.last_name}\`
    });
    
    // Issue BlockWard on blockchain
    const result = await blockwardService.issueBlockWard({
      studentAddress: student.wallet_address,
      teacherId: teacher.user_email,
      schoolId: teacher.school_id,
      title,
      description,
      category,
      metadataURI
    });
    
    // Save to database
    await db.createBlockWard({
      token_id: result.tokenId,
      student_email: studentEmail,
      student_wallet: student.wallet_address,
      issuer_email: req.user.email,
      issuer_name: \`\${teacher.first_name} \${teacher.last_name}\`,
      title,
      description,
      category,
      metadata_uri: metadataURI,
      transaction_hash: result.transactionHash,
      block_number: result.blockNumber,
      minted_at: new Date()
    });
    
    res.json({
      success: true,
      blockward: result,
      polygonScanUrl: \`https://polygonscan.com/tx/\${result.transactionHash}\`
    });
  } catch (error) {
    console.error('Error issuing BlockWard:', error);
    res.status(500).json({ error: 'Failed to issue BlockWard' });
  }
});

/**
 * GET /api/blockward/student/:email
 * Get all BlockWards for a student
 */
router.get('/student/:email', authenticate, async (req, res) => {
  try {
    const student = await db.getUserProfile(req.params.email);
    if (!student || !student.wallet_address) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Fetch from blockchain
    const blockwards = await blockwardService.getStudentBlockWards(
      student.wallet_address
    );
    
    res.json({ blockwards });
  } catch (error) {
    console.error('Error fetching BlockWards:', error);
    res.status(500).json({ error: 'Failed to fetch BlockWards' });
  }
});

/**
 * POST /api/wallet/create
 * Create custodial wallet for new student
 */
router.post('/wallet/create', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { studentEmail } = req.body;
    
    const wallet = await walletService.createStudentWallet(studentEmail);
    
    // Save to database
    await db.updateUserProfile(studentEmail, {
      wallet_address: wallet.address,
      wallet_private_key_encrypted: JSON.stringify(wallet.encryptedPrivateKey)
    });
    
    res.json({
      success: true,
      address: wallet.address
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    res.status(500).json({ error: 'Failed to create wallet' });
  }
});

module.exports = router;`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Frontend Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// Frontend: Teacher issues BlockWard
async function issueBlockWard(studentEmail, blockwardData) {
  try {
    const response = await fetch('/api/blockward/issue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${authToken}\`
      },
      body: JSON.stringify({
        studentEmail,
        title: blockwardData.title,
        description: blockwardData.description,
        category: blockwardData.category,
        imageUrl: blockwardData.imageUrl
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      toast.success('BlockWard issued successfully!');
      
      // Optionally show PolygonScan link
      console.log('View on PolygonScan:', result.polygonScanUrl);
    }
  } catch (error) {
    toast.error('Failed to issue BlockWard');
  }
}

// Frontend: Student views their BlockWards
async function getStudentBlockWards(studentEmail) {
  try {
    const response = await fetch(\`/api/blockward/student/\${studentEmail}\`, {
      headers: {
        'Authorization': \`Bearer \${authToken}\`
      }
    });
    
    const { blockwards } = await response.json();
    return blockwards;
  } catch (error) {
    console.error('Error fetching BlockWards:', error);
    return [];
  }
}`}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flow" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Complete Flow Diagram</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-violet-600" />
                    1. Student Onboarding
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">1</div>
                      <p>Student signs up → Backend creates custodial wallet</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">2</div>
                      <p>Private key encrypted and stored in secure database</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs">3</div>
                      <p>Wallet address saved to student profile</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    2. Teacher Issues BlockWard
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</div>
                      <p>Teacher clicks "Issue BlockWard" in UI</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</div>
                      <p>Frontend sends POST request to /api/blockward/issue</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</div>
                      <p>Backend validates teacher permissions</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</div>
                      <p>Backend creates metadata JSON and uploads to IPFS</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">5</div>
                      <p>Backend calls smart contract with gas wallet</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">6</div>
                      <p>Smart contract mints NFT to student's custodial wallet</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">7</div>
                      <p>Transaction confirmed on Polygon</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">8</div>
                      <p>Backend saves record to database</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">9</div>
                      <p>Frontend shows success + PolygonScan link</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-lg">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                    3. Student Views BlockWards
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</div>
                      <p>Student opens dashboard</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</div>
                      <p>Frontend fetches BlockWards from /api/blockward/student/:email</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</div>
                      <p>Backend queries smart contract with student's wallet address</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">4</div>
                      <p>Returns all BlockWards with metadata</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">5</div>
                      <p>UI displays BlockWards in beautiful cards</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">6</div>
                      <p>Student can click "View on PolygonScan" for any NFT</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Deploy BlockWardSoulbound.sol to Polygon</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Deploy TrustedForwarder.sol to Polygon</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Create gas wallet with MATIC tokens</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Grant MINTER_ROLE to gas wallet</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Set up IPFS/Pinata for metadata storage</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Deploy backend API with secure key storage</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Configure environment variables</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Test on Polygon Mumbai testnet first</span>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" className="h-4 w-4" />
                  <span className="text-sm">Verify contracts on PolygonScan</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}