const axios = require('axios');
require('dotenv').config();

// This is our best guess at what retrieveDataAndProofBase does
// based on the reference implementation
async function retrieveDataAndProofBase(url, abiEncodedRequest, roundId) {
  console.log(`Using URL: ${url}`);
  console.log(`Using Round ID: ${roundId}`);
  console.log(`Using Encoded Request: ${abiEncodedRequest.substring(0, 50)}...`);
  
  try {
    // Using the format from the reference implementation
    // Note that we don't know the exact parameter names, so we're guessing
    const data = {
      roundId: roundId,
      requestBytes: abiEncodedRequest
    };
    
    console.log(`Request data: ${JSON.stringify(data)}`);
    
    const response = await axios.post(url, data, {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 30000
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.data && response.data.proof && response.data.proof.length === 0) {
      console.log("Retrieved empty proof array");
    } else {
      console.log("Retrieved proof successfully");
    }
    
    return response.data;
  } catch (error) {
    console.error(`Error retrieving data: ${error.message}`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

async function retrieveProof() {
  const roundId = process.env.ROUND_ID || parseInt(process.argv[2]);
  const encodedRequest = process.env.ENCODED_REQUEST || process.argv[3];
  
  if (!roundId || !encodedRequest) {
    console.error("Please provide ROUND_ID and ENCODED_REQUEST environment variables or command line arguments");
    process.exit(1);
  }
  
  const url = `${process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/"}api/v1/fdc/proof-by-request-round-raw`;
  
  try {
    const result = await retrieveDataAndProofBase(url, encodedRequest, roundId);
    console.log("Final result:", JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error("Failed to retrieve proof:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  retrieveProof()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
} else {
  module.exports = {
    retrieveDataAndProofBase,
    retrieveProof
  };
}