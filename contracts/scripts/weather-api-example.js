// scripts/weather-api-example-corrected.js
const { ethers } = require("hardhat");
const axios = require("axios");
require('dotenv').config();

// Configuration from your .env file
const JQ_VERIFIER_URL_TESTNET = process.env.JQ_VERIFIER_URL_TESTNET || "https://jq-verifier-test.flare.rocks/";
const JQ_VERIFIER_API_KEY_TESTNET = process.env.VERIFIER_API_KEY || "flare-oxford-2025";
const COSTON2_DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
const OPEN_WEATHER_API_KEY = process.env.OPEN_WEATHER_API_KEY || "";

// FDC Hub address (you can also get this dynamically using Helpers contract)
const FDC_HUB_ADDRESS = "0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b"; // Coston2 FDC Hub

// Constants for round ID calculation
const firstVotingRoundStartTs = 1658429955;
const votingEpochDurationSeconds = 90;

// Weather parameters - New York City coordinates
const latitude = 40.7128;
const longitude = -74.0060;
const units = "metric";

// Configuration constants
const attestationTypeBase = "IJsonApi";
const sourceIdBase = "WEB2";
const verifierUrlBase = JQ_VERIFIER_URL_TESTNET;

// JQ transform to process the API response
const postprocessJq = `{
  latitude: (.coord.lat | if . != null then .*pow(10;6) else null end),
  longitude: (.coord.lon | if . != null then .*pow(10;6) else null end),
  description: .weather[0].description,
  temperature: (.main.temp | if . != null then .*pow(10;6) else null end),
  minTemp: (.main.temp_min | if . != null then .*pow(10;6) else null end),
  windSpeed: (.wind.speed | if . != null then . *pow(10;6) end),
  windDeg: .wind.deg
}`;

// ABI structure for the response
const abiSignature = `{
  "components": [
    {
      "internalType": "int256",
      "name": "latitude",
      "type": "int256"
    },
    {
      "internalType": "int256",
      "name": "longitude",
      "type": "int256"
    },
    {
      "internalType": "string",
      "name": "description",
      "type": "string"
    },
    {
      "internalType": "int256",
      "name": "temperature",
      "type": "int256"
    },
    {
      "internalType": "int256",
      "name": "minTemp",
      "type": "int256"
    },
    {
      "internalType": "uint256",
      "name": "windSpeed",
      "type": "uint256"
    },
    {
      "internalType": "uint256",
      "name": "windDeg",
      "type": "uint256"
    }
  ],
  "internalType": "struct DataTransportObject",
  "name": "dto",
  "type": "tuple"
}`;

// Helper function to convert string to padded hex
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

// Sleep function to wait
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Prepare the URL for OpenWeatherMap API
async function prepareUrl() {
  return `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=${units}&appid=${OPEN_WEATHER_API_KEY}`;
}

// 2. Prepare the attestation request - using the format from your reference implementation
async function prepareAttestationRequest(apiUrl) {
  console.log("Preparing attestation request for URL:", apiUrl);
  
  const attestationType = toUtf8HexString(attestationTypeBase);
  const sourceId = toUtf8HexString(sourceIdBase);
  
  const requestBody = {
    url: apiUrl,
    postprocessJq: postprocessJq,
    abi_signature: abiSignature,
  };
  
  const url = `${verifierUrlBase}JsonApi/prepareRequest`;
  console.log("Request URL:", url);
  
  try {
    console.log("Using API Key:", JQ_VERIFIER_API_KEY_TESTNET);
    
    // Using Fetch API as in your reference
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-KEY": JQ_VERIFIER_API_KEY_TESTNET,
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

// 3. Submit the attestation request to FDC Hub
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
    
    // In a full implementation, we would get the request fee from the FDC contract
    // For simplicity, we'll use a fixed fee
    const requestFee = ethers.parseEther("0.5");
    
    // Submit attestation
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
    
    // Get block details
    const block = await ethers.provider.getBlock(receipt.blockNumber);
    
    // Calculate round ID
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

// 4. Retrieve the proof and data
async function retrieveDataAndProof(abiEncodedRequest, roundId) {
  const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
  console.log(`\nRetrieving proof for round ${roundId} from ${url}`);
  console.log(`Waiting for round to be finalized...`);
  
  // Wait for the round to finalize (simplified for this example)
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
    
    // Wait a bit before making the request
    await sleep(10000);
    
    // Use the endpoint from your example
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
    
    // Check if we have a valid response
    if (!data.response_hex) {
      console.log("Waiting for the DA Layer to generate the proof...");
      // In a production environment, you would poll until response_hex is available
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
    // 1. Prepare the URL
    const apiUrl = await prepareUrl();
    
    // 2. Prepare the attestation request
    const preparedRequest = await prepareAttestationRequest(apiUrl);
    
    // 3. Submit the attestation
    const roundId = await submitAttestationRequest(preparedRequest.abiEncodedRequest);
    
    // 4. Retrieve the proof and data
    const proofAndData = await retrieveDataAndProof(
      preparedRequest.abiEncodedRequest, 
      roundId
    );
    
    console.log("\n========== WORKFLOW RESULTS ==========");
    console.log(`Round ID: ${roundId}`);
    console.log(`Encoded Request: ${preparedRequest.abiEncodedRequest.substring(0, 50)}...`);
    
    if (proofAndData && proofAndData.response_hex) {
      console.log("Proof and data retrieved successfully!");
      console.log("Proof:", proofAndData.proof);
      console.log("Response Hex:", proofAndData.response_hex.substring(0, 50) + "...");
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