// scripts/submit-fdc-attestation.js
const { ethers } = require("hardhat");
require('dotenv').config();

// FDC Hub address on Coston2
const FDC_HUB_ADDRESS = "0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b";

// First voting round timestamp and duration for calculating round ID
const firstVotingRoundStartTs = 1658429955;
const votingEpochDurationSeconds = 90;

// Maximum wait time for transaction confirmation (in milliseconds)
const MAX_CONFIRMATION_WAIT = 180000; // 3 minutes

async function main() {
  // Get transaction hash and encoded request from environment variables
  const txHash = process.env.TX_HASH;
  const encodedRequest = process.env.ENCODED_REQUEST;
  
  if (!encodedRequest) {
    console.error("Please provide an encoded request via ENCODED_REQUEST environment variable");
    process.exit(1);
  }

  console.log("Submitting attestation to FDC Hub...");
  console.log(`Using encoded request: ${encodedRequest.substring(0, 50)}...`);
  
  // Connect to FDC Hub
  const [signer] = await ethers.getSigners();
  console.log(`Submitting with account: ${signer.address}`);
  
  // FDC Hub ABI (expanded to include more functionality)
  const fdcHubAbi = [
    "function requestAttestation(bytes calldata _encodedRequest) external payable returns (bool)",
    "function getRequestStatus(bytes32 _requestId) external view returns (uint8, uint256)"
  ];
  
  // Connect to FDC Hub
  const fdcHub = new ethers.Contract(FDC_HUB_ADDRESS, fdcHubAbi, signer);
  
  try {
    // Increase gas limit and potentially gas price for better chances of inclusion
    // Submit attestation with higher fee to increase priority
    const tx = await fdcHub.requestAttestation(
      encodedRequest,
      { 
        value: ethers.parseEther("0.2"), // Increased fee for attestation
        gasLimit: 500000 // Explicit gas limit to prevent failure
      }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    
    // Wait for confirmation with a timeout
    console.log("Waiting for transaction confirmation...");
    const receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction confirmation timeout")), MAX_CONFIRMATION_WAIT)
      )
    ]);
    
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Calculate round ID
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const timestamp = block.timestamp;
    const roundId = Math.floor((timestamp - firstVotingRoundStartTs) / votingEpochDurationSeconds);
    
    // Calculate when the round will be finalized (approximately)
    const timeUntilFinalization = (roundId + 4) * votingEpochDurationSeconds + firstVotingRoundStartTs - timestamp;
    const finalizationTimestamp = timestamp + timeUntilFinalization;
    const finalizationDate = new Date(finalizationTimestamp * 1000);
    
    console.log(`FDC Round ID: ${roundId}`);
    console.log(`Round should be finalized around: ${finalizationDate.toLocaleString()}`);
    
    // Save this information for the next step
    console.log("\n========== SAVE THIS INFORMATION ==========");
    console.log(`Transaction Hash: ${tx.hash}`);
    console.log(`Encoded Request: ${encodedRequest}`);
    console.log(`Round ID: ${roundId}`);
    console.log("===========================================");
    console.log(`Check round progress at: https://coston2-explorer.flare.network/voting-epoch/${roundId}?tab=fdc`);
    console.log(`After round is finalized, use: ROUND_ID=${roundId} ENCODED_REQUEST=${encodedRequest} npx hardhat run scripts/get-fdc-proof-v2.js --network sepolia`);
    
    return {
      txHash: tx.hash,
      roundId: roundId,
      encodedRequest: encodedRequest
    };
  } catch (error) {
    console.error("Error submitting attestation:");
    console.error(error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
    process.exit(1);
  }
}

// Execute main function
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });