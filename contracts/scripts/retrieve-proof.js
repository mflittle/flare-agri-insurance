// scripts/retrieve-proof.js
const axios = require("axios");
require('dotenv').config();

// Configuration
const COSTON2_DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
const ROUND_ID = process.env.ROUND_ID;
const ENCODED_REQUEST = process.env.ENCODED_REQUEST;

async function retrieveProof() {
  if (!ROUND_ID || !ENCODED_REQUEST) {
    console.error("Please provide ROUND_ID and ENCODED_REQUEST environment variables");
    process.exit(1);
  }
  
  console.log(`Retrieving proof for round ${ROUND_ID}...`);
  
  const url = `${COSTON2_DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
  
  const request = {
    votingRoundId: parseInt(ROUND_ID),
    requestBytes: ENCODED_REQUEST
  };
  
  try {
    const response = await axios.post(url, request, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Proof retrieval response received.");
    
    if (response.data.response_hex) {
      console.log("Proof generation is complete!");
      console.log("\nProof:", response.data.proof);
      console.log("\nResponse Hex (first 100 chars):", response.data.response_hex.substring(0, 100) + "...");
    } else {
      console.log("Proof is still being generated. Please try again later.");
      console.log("\nResponse data:", response.data);
    }
  } catch (error) {
    console.error("Error retrieving proof:", error.message);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

retrieveProof()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });