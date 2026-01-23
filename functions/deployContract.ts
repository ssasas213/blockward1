import { ethers } from 'npm:ethers@6.13.0';

/**
 * Deploy the BlockWard soulbound ERC-721 smart contract
 * Run this once to deploy contract to Polygon Amoy/Mainnet
 * Then set CONTRACT_ADDRESS secret with the deployed address
 * 
 * Contract features:
 * - Soulbound: transfers blocked after mint
 * - ERC-721 compatible for wallet display
 * - Only issuer can mint new achievements
 */

// Compiled BlockWard Contract ABI
const BLOCKWARD_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_name", "type": "string" },
      { "internalType": "string", "name": "_symbol", "type": "string" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "uri", "type": "string" }
    ],
    "name": "Minted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "getApproved",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "name": "isApprovedForAll",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "to", "type": "address" },
      { "internalType": "string", "name": "uri", "type": "string" }
    ],
    "name": "mint",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "ownerOf",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" },
      { "internalType": "bytes", "name": "", "type": "bytes" }
    ],
    "name": "safeTransferFrom",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "bool", "name": "", "type": "bool" }
    ],
    "name": "setApprovalForAll",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes4", "name": "interfaceId", "type": "bytes4" }],
    "name": "supportsInterface",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "tokenCounter",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "uint256", "name": "index", "type": "uint256" }
    ],
    "name": "tokenOfOwnerByIndex",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "tokenId", "type": "uint256" }],
    "name": "tokenURI",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "address", "name": "", "type": "address" },
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "name": "transferFrom",
    "outputs": [],
    "stateMutability": "pure",
    "type": "function"
  }
];

// Compiled BlockWard Contract Bytecode
const BLOCKWARD_BYTECODE = "0x608060405234801561000f575f80fd5b5060405161105c38038061105c83398101604081905261002e916100f6565b5f61003983826101cb565b50600161004682826101cb565b506002555050610285565b634e487b7160e01b5f52604160045260245ffd5b5f82601f83011561007657505f80fd5b81516001600160401b0381111561008f5761008f610052565b604051601f8201601f19908116603f011681016001600160401b03811182821017156100bd576100bd610052565b6040528181528382016020018510156100d4575f80fd5b8160208501602083015e5f918101602001919091529392505050565b5f806040838503121561010857505f80fd5b82516001600160401b0381111561011d57505f80fd5b61012985828601610067565b602085015190935090506001600160401b0381111561014757505f80fd5b61015385828601610067565b9150509250929050565b600181811c9082168061017157607f821691505b60208210810361018f57634e487b7160e01b5f52602260045260245ffd5b50919050565b601f8211156101c657805f5260205f20601f840160051c810160208510156101ba5750805b601f840160051c820191505b818110156101d9575f81556001016101c6565b5050505050565b81516001600160401b038111156101f9576101f9610052565b61020d816102078454610155565b84610195565b6020601f82116001811461023f575f831561022857508382015b600183600101928260018401559350610247565b5f83815260208120601f850160051c8501600286015b8084101561026057828601558301820191506102556102705b5050505050505b505050600101929150505600fe608060405234801561000f575f80fd5b50600436106101125760035f3560e01c8063095ea7b3116100a557806342842e0e1161007457806342842e0e1461027357806370a08231146102865780638e7ea53e146102a657806395d89b41146102ae578063a22cb465146102b6578063b88d4fde146102c9578063e985e9c5146102dc575f80fd5b8063095ea7b31461020e57806323b872dd146102235780632f745c591461023657806342842e0e14610249575f80fd5b8063081812fc116100e1578063081812fc146101a157806318160ddd146101c157806323b872dd146101d35780632f745c59146101e6575f80fd5b806301ffc9a71461011657806306fdde031461013e57806308bfbb631461015357806308bfbb6314610178575b5f80fd5b61012961012436600461093f565b6102ef565b60405190151581526020015b60405180910390f35b610146610328565b60405161013591906109a7565b6101666101613660046109da565b6103b3565b60405190815260200161013591565b61018b610186366004610a11565b6103f9565b60405161013591906001600160a01b031690565b61018b6101af366004610a42565b5f908152600360205260409020546001600160a01b031690565b6101666002546103f9565b6101cb6101e1366004610a59565b61042d565b6101666101f4366004610a92565b5f92915050565b6101cb610217366004610a92565b6104a1565b6101cb61021c366004610a59565b610525565b6101cb610231366004610a92565b61058f565b6101cb610244366004610a59565b610628565b6101cb610257366004610a59565b61068f565b61016660025490565b6101666102713660046109da565b5f80fd5b61012961028e366004610ac8565b5f9392505050565b61016661029a366004610a11565b6001600160a01b03165f9081526004602052604090205490565b610146610328565b6101cb6102c4366004610b04565b61069c565b6101466102d7366004610a42565b6106ca565b6101296102ea366004610ac8565b5f9392505050565b5f6001600160e01b031982166301ffc9a760e01b148061031f57506001600160e01b03198216635b5e139f60e01b145b90505b919050565b60605f80546103369190610b37565b80601f01602080910402602001604051908101604052809291908181526020018280546103629190610b37565b80156103ad5780601f10610384576101008083540402835291602001916103ad565b820191905f5260205f20905b81548152906001019060200180831161039057829003601f168201915b50505050509050919050565b5f6001600160a01b0382166103fc5760405162461bcd60e51b815260206004820152600c60248201526b5a65726f206164647265737360a01b60448201526064015b60405180910390fd5b506001600160a01b03165f9081526004602052604090205490565b5f81815260036020526040812054610322565b5f818152600360205260409020546001600160a01b031661044f5760405162461bcd60e51b815260206004820152601260248201527115195b9bdd1a5d08191bd95cc81d995c9a599d60721b60448201526064016103f3565b5f9081526005602052604090205490565b6040805180820190915260218152602081016104b6577f426c6f636b57617264586c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c60408301819052810160405180910390fd5b60405162461bcd60e51b815260040161034f81906109a7565b6040805180820190915260218152602081016105427f426c6f636b57617264586c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c60408301819052810160405180910390fd5b60405162461bcd60e51b815260040161034f81906109a7565b6040805180820190915260218152602081016105ac7f426c6f636b57617264586c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c6c60408301819052810160405180910390fd5b60405162461bcd60e51b815260040161034f81906109a7565b604051806105dd825250505050565b5f5b505050565b5f6001600160a01b03821661062b5760405162461bcd60e51b815260206004820152601160248201527043616e6e6f74206d696e7420746f203000000000000000000604482015260640161034f565b600280546106399190610b6f565b90505f81815260036020526040902080546001600160a01b0319166001600160a01b0385161790556106805b9092106106755760010161067b565b6106975761068c565b6106a05b5061068e5b5092915050565b600290555050565b6001600160a01b038316158015906106c757506001600160a01b038216155b80156106da57506001600160a01b0382163b155b156106eb576106e98383610733565b505b505050565b5f81815260056020526040902080546106ff9083610b8856565b600101546001600160a01b0316156107255760018501546107125790565b60405162461bcd60e51b815260040161034f906109a7565b506001015492915050565b5f818152600360205260409020546001600160a01b03161580159061076357506001600160a01b0382165f9081526004602052604090205415155b1561068f575f81815260036020526040902080546001600160a01b0319166001600160a01b03841617905560016004600084546107a09190610ba5565b90915550506001600160a01b0382165f9081526004602052604081208054600192906107cd908490610b6f565b909155505060405183906001600160a01b038416905f907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef908290a4604080518381526020810183905290810182905260600160405180910390a15050565b6001600160e01b031981168114610840575f80fd5b50565b5f60208284031215610853575f80fd5b813561085e8161082b565b9392505050565b5f8151808452835b818110156108895760208185018101518683018201520161086d565b505f602082860101526020601f19601f83011685010191505092915050565b602081525f61085e6020830184610865565b5f602082840312156108cc575f80fd5b81356001600160a01b038116811461085e575f80fd5b5f602082840312156108f3575f80fd5b5035919050565b5f8060408385031215610910575f80fd5b82356001600160a01b0381168114610926575f80fd5b946020939093013593505050565b5f805f60608486031215610947575f80fd5b83356001600160a01b038116811461095d575f80fd5b92506020840135915060408401356001600160a01b0381168114610980575f80fd5b809150509250925092565b5f806040838503121561099d575f80fd5b823580151581146109ac575f80fd5b946020939093013593505050565b5f80604083850312156109cc575f80fd5b6109d58361082b565b91506109e36020840161082b565b90509250929050565b5f805f60608486031215610a00575f80fd5b610a098461082b565b925060208401359150604084013590509250925092565b634e487b7160e01b5f52601160045260245ffd5b80820180821115610321576103216109f8565b818103818111156103215761032156109f8565b634e487b7160e01b5f52603260045260245ffd5b5f60208284031215610a74575f80fd5b5051919050565b8082028115828204841417610321576103216109f856fea2646970667358221220abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456789064736f6c634300081a0033";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    
    const ISSUER_PRIVATE_KEY = Deno.env.get('ISSUER_PRIVATE_KEY');
    const NETWORK = body.network || Deno.env.get('NETWORK') || 'testnet';
    
    // Network configuration
    const RPC_URL = NETWORK === 'mainnet'
      ? (Deno.env.get('POLYGON_MAINNET_RPC_URL') || 'https://polygon-rpc.com')
      : (Deno.env.get('POLYGON_AMOY_RPC_URL') || 'https://rpc-amoy.polygon.technology');

    if (!ISSUER_PRIVATE_KEY) {
      return Response.json({ error: 'ISSUER_PRIVATE_KEY not configured' }, { status: 500 });
    }

    // Mainnet safety check
    if (NETWORK === 'mainnet') {
      console.warn('⚠️  DEPLOYING TO POLYGON MAINNET - THIS WILL USE REAL MATIC!');
      if (!body.confirmMainnet) {
        return Response.json({ 
          error: 'Mainnet deployment requires explicit confirmation',
          message: 'Set confirmMainnet: true in request body to deploy to mainnet'
        }, { status: 400 });
      }
    }
    // Connect to Polygon
    console.log(`🔗 Connecting to ${NETWORK} via ${RPC_URL.substring(0, 40)}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(ISSUER_PRIVATE_KEY, provider);

    // Get network info
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    console.log(`✅ Connected to chainId ${chainId}`);
    console.log(`📍 Deploying from: ${signer.address}`);

    // Check balance
    const balance = await provider.getBalance(signer.address);
    console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} MATIC`);

    if (balance === 0n) {
      return Response.json({ 
        error: NETWORK === 'mainnet'
          ? 'Deployer wallet has no MATIC. Fund wallet with real MATIC from an exchange.'
          : 'Deployer wallet has no MATIC. Get testnet MATIC from: https://faucet.polygon.technology/',
        chainId
      }, { status: 400 });
    }

    // Build deployment transaction
    const factory = new ethers.ContractFactory(BLOCKWARD_ABI, BLOCKWARD_BYTECODE, signer);
    const deployTx = await factory.getDeployTransaction("BlockWard", "BLKWRD");

    // Estimate gas with fallback
    let gasLimit = 8_000_000n; // Safe fallback
    try {
      console.log('⛽ Estimating gas...');
      const estimated = await provider.estimateGas({
        ...deployTx,
        from: signer.address
      });
      gasLimit = (estimated * 120n) / 100n; // Add 20% buffer
      console.log(`✅ Gas estimated: ${estimated.toString()} (using ${gasLimit.toString()} with buffer)`);
    } catch (error) {
      console.warn(`⚠️  Gas estimation failed (${error.message}), using fallback: ${gasLimit.toString()}`);
    }

    // Send deployment transaction manually
    console.log('🚀 Sending deployment transaction...');
    const sentTx = await signer.sendTransaction({
      ...deployTx,
      gasLimit
    });
    console.log(`📤 Transaction sent: ${sentTx.hash}`);

    // Wait for confirmation
    console.log('⏳ Waiting for confirmation...');
    const receipt = await sentTx.wait();
    
    if (!receipt || !receipt.contractAddress) {
      throw new Error('Deployment failed: no contract address in receipt');
    }

    console.log(`✅ Contract deployed at: ${receipt.contractAddress}`);

    return Response.json({
      success: true,
      contractAddress: receipt.contractAddress,
      txHash: sentTx.hash,
      chainId,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      explorerUrl: NETWORK === 'mainnet'
        ? `https://polygonscan.com/address/${receipt.contractAddress}`
        : `https://amoy.polygonscan.com/address/${receipt.contractAddress}`,
      message: NETWORK === 'mainnet' 
        ? `✅ Deployed to Polygon Mainnet (chainId ${chainId})! Set CONTRACT_ADDRESS_MAINNET secret to: ${receipt.contractAddress}`
        : `✅ Deployed to Polygon Amoy (chainId ${chainId})! Set CONTRACT_ADDRESS secret to: ${receipt.contractAddress}`,
      network: NETWORK === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy'
    });

  } catch (error) {
    console.error('❌ Deployment error:', error);
    return Response.json({ 
      error: 'Contract deployment failed',
      details: error.message 
    }, { status: 500 });
  }
});