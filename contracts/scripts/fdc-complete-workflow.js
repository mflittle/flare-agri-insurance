// scripts/fdc-complete-workflow.js
const { ethers } = require("hardhat");
const axios = require("axios");
require('dotenv').config();

// Configuration
const VERIFIER_BASE_URL = "https://fdc-verifiers-testnet.flare.network/";
const VERIFIER_API_KEY = process.env.VERIFIER_API_KEY || ""; // Set this in your .env file
const FDC_HUB_ADDRESS = "0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b"; // Coston2 FDC Hub
const DA_LAYER_URL = "https://ctn2-data-availability.flare.network/";

// Timing constants
const firstVotingRoundStartTs = 1658429955;
const votingEpochDurationSeconds = 90;

// Use either an existing transaction or specify a new one
const TX_HASH = process.env.TX_HASH || "0x11a547f79d040ffd96421692590adfb65944e7d8ee5c20ee9bbdb06eca06a171";

// Helper function to convert string to padded hex
function toHex(data) {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += data.charCodeAt(i).toString(16);
  }
  return result.padEnd(64, "0");
}

// 1. Prepare the attestation request
async function prepareRequest() {
  console.log("Preparing attestation request for transaction:", TX_HASH);
  
  const attestationType = "0x" + toHex("EVMTransaction");
  const sourceType = "0x" + toHex("testETH");
  
  const requestData = {
    attestationType: attestationType,
    sourceId: sourceType,
    requestBody: {
      transactionHash: TX_HASH,
      requiredConfirmations: "6",  // Increased to 6 confirmations
      provideInput: true,
      listEvents: true,
      logIndices: [],
    },
  };
  
  try {
    const response = await axios.post(
      `${VERIFIER_BASE_URL}verifier/eth/EVMTransaction/prepareRequest`,
      requestData,
      {
        headers: {
          "X-API-KEY": VERIFIER_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );
    
    console.log("Request prepared successfully!");
    console.log("Status:", response.data.status);
    console.log("Encoded Request:", response.data.abiEncodedRequest.substring(0, 50) + "...");
    
    return response.data;
  } catch (error) {
    console.error("Error preparing request:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

// 2. Submit the attestation request to FDC Hub
async function submitAttestationRequest(abiEncodedRequest) {
  console.log("Submitting attestation to FDC Hub...");
  
  try {
    // Get a signer
    const [signer] = await ethers.getSigners();
    console.log(`Submitting with account: ${signer.address}`);
    
    // FDC Hub ABI (simplified)
    const fdcHubAbi = [
      "function requestAttestation(bytes calldata _encodedRequest) external payable returns (bool)"
    ];
    
    // Connect to FDC Hub
    const fdcHub = new ethers.Contract(FDC_HUB_ADDRESS, fdcHubAbi, signer);
    
    // Submit attestation
    const tx = await fdcHub.requestAttestation(
      abiEncodedRequest,
      { 
        value: ethers.parseEther("0.5"), // Fee for attestation
        gasLimit: 500000 // Explicit gas limit
      }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Get block details
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    
    // Calculate round ID
    const roundId = Math.floor(
      (block.timestamp - firstVotingRoundStartTs) / votingEpochDurationSeconds
    );
    
    // Calculate when the round will be finalized (approximately)
    const timeUntilFinalization = (roundId + 4) * votingEpochDurationSeconds + firstVotingRoundStartTs - block.timestamp;
    const finalizationTimestamp = block.timestamp + timeUntilFinalization;
    const finalizationDate = new Date(finalizationTimestamp * 1000);
    
    console.log(`FDC Round ID: ${roundId}`);
    console.log(`Round should be finalized around: ${finalizationDate.toLocaleString()}`);
    console.log(`Check round progress at: https://coston2-systems-explorer.flare.rocks/voting-epoch/${roundId}?tab=fdc`);
    
    return {
      txHash: tx.hash,
      roundId: roundId,
      abiEncodedRequest: abiEncodedRequest
    };
  } catch (error) {
    console.error("Error submitting attestation:");
    console.error(error.message);
    throw error;
  }
}

// 3. Retrieve the proof and data
async function retrieveDataAndProof(abiEncodedRequest, roundId) {
  console.log(`\nRetrieving proof for round ${roundId}...`);
  console.log(`Waiting for round to be finalized...`);
  
  // Since we're doing this right after submission, wait for a while
  const waitTimeMs = 7 * 60 * 1000; // 7 minutes (longer than the typical 6-minute round finalization)
  console.log(`Waiting ${waitTimeMs/1000/60} minutes for round finalization...`);
  await new Promise(resolve => setTimeout(resolve, waitTimeMs));
  
  console.log("Attempting to retrieve proof now...");
  
  try {
    // First try the v1 endpoint
    const response = await axios.post(
      `${DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`,
      {
        requestBytes: abiEncodedRequest,
        roundId: roundId
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log("Proof retrieval succeeded!");
    
    if (response.data && response.data.proof && response.data.proof.length === 0) {
      console.log("Received an empty proof array. This likely means one of the following:");
      console.log("1. The attestation request doesn't exist for this round");
      console.log("2. The round ID is too old and has been pruned from the system");
      console.log("3. The request hasn't been processed yet");
      
      return null;
    }
    
    console.log("Proof retrieved successfully!");
    return response.data;
  } catch (error) {
    console.error("Error retrieving proof:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(error.message);
    }
    
    // Try the v0 endpoint as fallback
    console.log("Trying v0 endpoint as fallback...");
    try {
      const fallbackResponse = await axios.post(
        `${DA_LAYER_URL}api/v0/fdc/get-proof-round-id-bytes`,
        {
          votingRoundId: roundId,
          requestBytes: abiEncodedRequest
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log("Fallback succeeded!");
      return fallbackResponse.data;
    } catch (fallbackError) {
      console.error("Fallback approach also failed");
      throw fallbackError;
    }
  }
}

// Main workflow function
async function runWorkflow() {
  try {
    // 1. Prepare the request
    const preparedRequest = await prepareRequest();
    
    // 2. Submit the attestation
    const submission = await submitAttestationRequest(preparedRequest.abiEncodedRequest);
    
    // 3. Retrieve the proof and data
    const proofAndData = await retrieveDataAndProof(
      preparedRequest.abiEncodedRequest, 
      submission.roundId
    );
    
    // 4. Log the results
    console.log("\n========== WORKFLOW RESULTS ==========");
    console.log(`Transaction Hash: ${submission.txHash}`);
    console.log(`Round ID: ${submission.roundId}`);
    console.log(`Encoded Request: ${preparedRequest.abiEncodedRequest}`);
    
    if (proofAndData) {
      console.log("Proof and data retrieved successfully!");
      console.log("Proof:", proofAndData.proof);
      console.log("Response:", proofAndData.response);
    } else {
      console.log("Failed to retrieve proof and data.");
    }
    
    return {
      submission,
      proofAndData
    };
  } catch (error) {
    console.error("Workflow failed:", error.message);
  }
}

// Run the workflow
runWorkflow()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });