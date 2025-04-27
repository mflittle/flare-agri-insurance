// scripts/json-api-simple.js
const { ethers } = require("hardhat");
require('dotenv').config();

// Configuration
const JQ_VERIFIER_URL_TESTNET = process.env.JQ_VERIFIER_URL_TESTNET || "https://jq-verifier-test.flare.rocks/";
const VERIFIER_API_KEY = "flare-oxford-2025";
const COSTON2_DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
const FDC_HUB_ADDRESS = "0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b";

// Constants
const firstVotingRoundStartTs = 1658429955;
const votingEpochDurationSeconds = 90;

// Configuration constants
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";

// Use a public API that doesn't require authentication
const publicApiUrl = "https://jsonplaceholder.typicode.com/posts/1";

// Simple JQ transform
const postprocessJq = `{
  id: .id,
  title: .title,
  body: .body,
  userId: .userId
}`;

// ABI structure
const abiSignature = `{
  "components": [
    {
      "internalType": "uint256",
      "name": "id",
      "type": "uint256"
    },
    {
      "internalType": "string",
      "name": "title",
      "type": "string"
    },
    {
      "internalType": "string",
      "name": "body",
      "type": "string"
    },
    {
      "internalType": "uint256",
      "name": "userId",
      "type": "uint256"
    }
  ],
  "internalType": "struct JsonPost",
  "name": "post",
  "type": "tuple"
}`;

// Helper functions
function toHex(data) {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += data.charCodeAt(i).toString(16);
  }
  return result.padEnd(64, "0");
}

function toUtf8HexString(data) {
  return "0x" + toHex(data);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prepare the attestation request
async function prepareAttestationRequest() {
  console.log("Preparing attestation request for URL:", publicApiUrl);
  
  const attestationType = toUtf8HexString(attestationTypeBase);
  const sourceId = toUtf8HexString(sourceIdBase);
  
  const requestBody = {
    url: publicApiUrl,
    postprocessJq: postprocessJq,
    abi_signature: abiSignature,
  };
  
  const url = `${JQ_VERIFIER_URL_TESTNET}JsonApi/prepareRequest`;
  console.log("Request URL:", url);
  
  try {
    console.log("Using API Key:", VERIFIER_API_KEY);
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": VERIFIER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attestationType: attestationType,
        sourceId: sourceId,
        requestBody: requestBody
      }),
    });
    
    if (response.status !== 200) {
      throw new Error(`Response status is not OK, status ${response.status} ${response.statusText}`);
    }
    
    console.log("Request prepared successfully!");
    const data = await response.json();
    console.log("Status:", data.status);
    console.log("Encoded Request:", data.abiEncodedRequest.substring(0, 50) + "...");
    
    return data;
  } catch (error) {
    console.error("Error preparing request:", error.message);
    throw error;
  }
}

// Submit the attestation request to FDC Hub
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
    
    // Submit attestation with fee
    const requestFee = ethers.parseEther("0.5");
    const tx = await fdcHub.requestAttestation(
      abiEncodedRequest,
      { 
        value: requestFee,
        gasLimit: 500000
      }
    );
    
    console.log(`Transaction submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    
    // Get block details and calculate round ID
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    const roundId = Math.floor(
      (block.timestamp - firstVotingRoundStartTs) / votingEpochDurationSeconds
    );
    
    console.log(`FDC Round ID: ${roundId}`);
    console.log(`Check round progress at: https://coston2-systems-explorer.flare.rocks/voting-epoch/${roundId}?tab=fdc`);
    
    return roundId;
  } catch (error) {
    console.error("Error submitting attestation:", error.message);
    throw error;
  }
}

// Retrieve the proof and data
async function retrieveDataAndProof(abiEncodedRequest, roundId) {
  const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
  console.log(`\nRetrieving proof for round ${roundId} from ${url}`);
  console.log(`Waiting for round to be finalized...`);
  
  // Wait for the round to finalize
  const waitTimeMs = 7 * 60 * 1000; // 7 minutes
  console.log(`Waiting ${waitTimeMs/1000/60} minutes for round finalization...`);
  await sleep(waitTimeMs);
  
  console.log("Attempting to retrieve proof now...");
  
  try {
    const request = {
      votingRoundId: roundId,
      requestBytes: abiEncodedRequest,
    };
    
    console.log("Prepared request:", JSON.stringify(request, null, 2));
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });
    
    if (response.status !== 200) {
      throw new Error(`Response status is not OK, status ${response.status} ${response.statusText}`);
    }
    
    console.log("Proof retrieval succeeded!");
    
    const data = await response.json();
    
    if (!data || !data.proof || data.proof.length === 0) {
      console.log("Received an empty proof array.");
      return null;
    }
    
    console.log("Proof retrieved successfully!");
    return data;
  } catch (error) {
    console.error("Error retrieving proof:", error.message);
    throw error;
  }
}

// Main workflow function
async function runWorkflow() {
  try {
    // 1. Prepare the attestation request
    const preparedRequest = await prepareAttestationRequest();
    
    // 2. Submit the attestation
    const roundId = await submitAttestationRequest(preparedRequest.abiEncodedRequest);
    
    // 3. Retrieve the proof and data
    const proofAndData = await retrieveDataAndProof(
      preparedRequest.abiEncodedRequest, 
      roundId
    );
    
    console.log("\n========== WORKFLOW RESULTS ==========");
    console.log(`Round ID: ${roundId}`);
    console.log(`Encoded Request: ${preparedRequest.abiEncodedRequest.substring(0, 50)}...`);
    
    if (proofAndData) {
      console.log("Proof and data retrieved successfully!");
      console.log("Proof:", proofAndData.proof);
      if (proofAndData.response_hex) {
        console.log("Response Hex:", proofAndData.response_hex.substring(0, 50) + "...");
      }
    } else {
      console.log("Failed to retrieve proof and data or proof generation is still in progress.");
      console.log("You may need to try again later using the round ID and encoded request above.");
    }
    
    return {
      roundId,
      encodedRequest: preparedRequest.abiEncodedRequest,
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