const axios = require('axios');
require('dotenv').config();

/**
 * Searches for a recent valid round ID on the Flare network
 * @returns {Promise<number>} A valid recent round ID
 */
async function findRecentRound() {
  const DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
  
  // Try to get the current block number to estimate the round ID
  const FLARE_RPC_URL = process.env.COSTON2_RPC_URL || "https://coston2-api.flare.network/ext/bc/C/rpc";
  
  console.log("Trying to determine the latest round ID...");
  
  try {
    // Get the latest block number from the Flare RPC
    const response = await axios.post(
      FLARE_RPC_URL,
      {
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1
      },
      {
        headers: { "Content-Type": "application/json" }
      }
    );
    
    if (response.data && response.data.result) {
      const blockNumber = parseInt(response.data.result, 16);
      console.log(`Current block number: ${blockNumber}`);
      
      // Estimate the round ID based on block number
      // Assuming rounds occur approximately every 90 seconds (30 blocks)
      // This is a rough estimation and may not be accurate
      const estimatedRound = Math.floor(blockNumber / 30);
      
      // Try with a few recent rounds
      const roundsToTry = [
        estimatedRound,
        estimatedRound - 1,
        estimatedRound - 2,
        estimatedRound - 5,
        estimatedRound - 10
      ];
      
      console.log("Will try with these round IDs:", roundsToTry);
      
      // Loop through rounds to find a valid one
      for (const round of roundsToTry) {
        try {
          console.log(`Checking if round ${round} exists...`);
          // Try to get proof for this round with an empty request
          // Just to see if the round exists
          const proofResponse = await axios.post(
            `${DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`,
            {
              roundId: round,
              requestBytes: "0x"
            },
            {
              headers: { "Content-Type": "application/json" },
              timeout: 5000
            }
          );
          
          // If we get here, the round exists
          console.log(`Round ${round} exists.`);
          return round;
        } catch (error) {
          console.log(`Round ${round} doesn't exist or returned an error.`);
          if (error.response) {
            console.log(`Status: ${error.response.status}`);
          }
        }
      }
      
      // If we can't find a valid round, return the estimated one anyway
      console.log(`Could not verify any round, using estimated round: ${estimatedRound}`);
      return estimatedRound;
    }
  } catch (error) {
    console.log("Error getting block number:", error.message);
  }
  
  // Fallback: return the current timestamp / 90 as an estimation
  // (assuming 90 seconds per round)
  const fallbackRound = Math.floor(Date.now() / 1000 / 90);
  console.log(`Fallback to timestamp-based estimation: ${fallbackRound}`);
  return fallbackRound;
}

/**
 * Attempts to retrieve a proof using a recent round ID
 */
async function getProofWithRecentRound(encodedRequest) {
  const DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
  
  // Find a recent round ID
  const recentRound = await findRecentRound();
  console.log(`Using recent round ID: ${recentRound}`);
  
  // Try to get the proof
  try {
    console.log(`Retrieving proof with recent round ID...`);
    const response = await axios.post(
      `${DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`,
      {
        roundId: recentRound,
        requestBytes: encodedRequest
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      }
    );
    
    console.log("Proof response:", JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`Error retrieving proof: ${error.message}`);
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Data: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

if (require.main === module) {
  const encodedRequest = process.env.ENCODED_REQUEST || process.argv[2] || "0x45564d5472616e73616374696f6e0000000000000000000000000000000000007465737445544800000000000000000000000000000000000000000000000000a0442155e3e9623f1778745f7370596f5ea83ccf8c37be535a875d4d2427bb80000000000000000000000000000000000000000000000000000000000000002013ce2bac647732000a8c463c494b052cd02fd49a816b8da70532b6818c7cd91e00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000";
  
  getProofWithRecentRound(encodedRequest)
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}

module.exports = {
  findRecentRound,
  getProofWithRecentRound
};