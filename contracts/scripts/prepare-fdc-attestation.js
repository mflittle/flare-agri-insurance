// scripts/prepare-fdc-attestation.js
const axios = require('axios');
require('dotenv').config();

// Simple hex encoding
function toHex(data) {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += data.charCodeAt(i).toString(16);
  }
  return result.padEnd(64, "0");
}

async function main() {
  // Get transaction hash from environment variable
  const txHash = process.env.TX_HASH;
  console.log("Reading transaction hash:", txHash);
  
  if (!txHash) {
    console.error("Please provide a transaction hash via TX_HASH environment variable");
    process.exit(1);
  }
  
  const VERIFIER_BASE_URL = process.env.FDC_VERIFIER_URL || "https://fdc-verifiers-testnet.flare.network/";
  const VERIFIER_API_KEY = process.env.VERIFIER_API_KEY || ""; // If you don't have an API key yet
  
  console.log(`Preparing attestation for transaction: ${txHash}`);
  
  const attestationType = "0x" + toHex("EVMTransaction");
  const sourceType = "0x" + toHex("testETH"); // For Sepolia testnet
  
  const requestData = {
    attestationType: attestationType,
    sourceId: sourceType,
    requestBody: {
      transactionHash: txHash,
      requiredConfirmations: "1",
      provideInput: true,
      listEvents: true,
      logIndices: []
    }
  };
  
  console.log("Preparing attestation request...");
  console.log("Request data:", JSON.stringify(requestData, null, 2));
  
  try {
    const response = await axios.post(
      `${VERIFIER_BASE_URL}verifier/eth/EVMTransaction/prepareRequest`,
      requestData,
      {
        headers: {
          "X-API-KEY": VERIFIER_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );
    
    console.log("Attestation request prepared successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
    
    // Save the encoded request for later use
    console.log("\n========== SAVE THIS INFORMATION ==========");
    console.log(`Transaction Hash: ${txHash}`);
    if (response.data.abiEncodedRequest) {
      console.log(`Encoded Request: ${response.data.abiEncodedRequest}`);
    }
    console.log("===========================================");
    
    return response.data;
  } catch (error) {
    console.error("Error preparing attestation request:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
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