const axios = require('axios');
require('dotenv').config();

async function getProof(roundId, encodedRequest, verbose = false, waitTime = 180000) {
  const log = verbose ? console.log : () => {};
  
  // Use the Coston2 DA Layer URL as specified in the reference project
  const DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
  
  console.log(`Using Round ID: ${roundId}`);
  console.log(`Using Encoded Request: ${encodedRequest.substring(0, 50)}...`);
  console.log(`Using DA Layer URL: ${DA_LAYER_URL}`);
  
  if (waitTime > 0) {
    console.log(`Waiting for round finalization (${waitTime/1000} seconds)...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log("Skipping wait time for round finalization...");
  }
  
  console.log(`Retrieving proof from DA Layer...`);
  
  // Using the correct endpoint format based on API discovery
  const endpoint = `${DA_LAYER_URL}api/v1/fdc/proof-by-request-round-raw`;
  
  try {
    console.log(`Trying endpoint: ${endpoint}`);
    
    // According to the API discovery, this endpoint works but expects the parameters differently
    const response = await axios.post(
      endpoint,
      {
        roundId: roundId,       // Changed from votingRoundId to roundId
        requestBytes: encodedRequest
      },
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    // Check if the proof array is empty
    if (response.data && response.data.proof && response.data.proof.length === 0) {
      console.log("Received an empty proof array. This likely means one of the following:");
      console.log("1. The attestation request doesn't exist for this round");
      console.log("2. The round ID is too old and has been pruned from the system");
      console.log("3. The request hasn't been processed yet");
      
      // Return the empty response so the caller can handle it
      console.log("Full response:", JSON.stringify(response.data, null, 2));
      return response.data;
    }
    
    console.log("Proof retrieved successfully!");
    return response.data;
  } catch (error) {
    console.log(`Failed with endpoint ${endpoint}: ${error.message}`);
    
    // Detailed error logging
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      console.log(`Response data: ${JSON.stringify(error.response.data)}`);
      
      // If rate limited (429), suggest waiting and retrying
      if (error.response.status === 429) {
        console.log("Received rate limit (429) error. Wait a minute and try again.");
      }
      
      throw new Error(`API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      throw new Error(`Failed to connect to FDC Data Availability Layer. Error: ${error.message}`);
    }
  }
  
  // If called directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let roundId = null;
  let encodedRequest = null;
  let verbose = false;
  let waitTime = 180000; // Default wait time (3 minutes)
  
  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--wait' || args[i] === '-w') {
      waitTime = parseInt(args[i+1]) * 1000; // Convert to milliseconds
      i++; // Skip the next arg
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log("Usage: npx hardhat run scripts/get-fdc-proof.js [options] [roundId] [encodedRequest]");
      console.log("");
      console.log("Options:");
      console.log("  --verbose, -v       Enable verbose logging");
      console.log("  --wait, -w <seconds> Set custom wait time in seconds (default: 180)");
      console.log("  --no-wait           Skip waiting for round finalization");
      console.log("  --help, -h          Show this help message");
      console.log("");
      console.log("Environment variables:");
      console.log("  ROUND_ID            Round ID to query");
      console.log("  ENCODED_REQUEST     Encoded request bytes");
      console.log("  COSTON2_DA_LAYER_URL Data Availability Layer URL for Coston2");
      console.log("");
      console.log("Examples:");
      console.log("  With environment variables:");
      console.log("    ROUND_ID=123456 ENCODED_REQUEST=0x... npx hardhat run scripts/get-fdc-proof.js --network sepolia");
      console.log("");
      console.log("  With command line arguments:");
      console.log("    npx hardhat run scripts/get-fdc-proof.js --network sepolia 123456 0x...");
      process.exit(0);
    } else if (args[i] === '--no-wait') {
      waitTime = 0;
    } else if (roundId === null) {
      roundId = args[i];
    } else if (encodedRequest === null) {
      encodedRequest = args[i];
    }
  }
  
  // Check environment variables if not set from command line
  if (roundId === null) {
    roundId = process.env.ROUND_ID;
  }
  
  if (encodedRequest === null) {
    encodedRequest = process.env.ENCODED_REQUEST;
  }
  
  // Final check that we have both required values
  if (!roundId || !encodedRequest) {
    console.error("Error: Missing required parameters roundId and/or encodedRequest");
    console.error("Run with --help for usage information");
    process.exit(1);
  }
  
  // Convert roundId to integer if it's a string
  roundId = parseInt(roundId);
  
  if (verbose) {
    console.log("Running with options:");
    console.log(`  Round ID: ${roundId}`);
    console.log(`  Encoded Request: ${encodedRequest.substring(0, 50)}...`);
    console.log(`  Verbose: ${verbose}`);
    console.log(`  Wait Time: ${waitTime/1000} seconds`);
    console.log(`  DA Layer URL: ${process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/"}`);
  }
  
  getProof(roundId, encodedRequest, verbose, waitTime)
    .then(data => {
      console.log("Proof and data retrieved:");
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error("Error retrieving proof:");
      console.error(error.message);
      process.exit(1);
    });
} else {
  module.exports = getProof;
}
}

// If called directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let roundId = null;
  let encodedRequest = null;
  let verbose = false;
  let waitTime = 180000; // Default wait time (3 minutes)
  
  // Parse args
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--wait' || args[i] === '-w') {
      waitTime = parseInt(args[i+1]) * 1000; // Convert to milliseconds
      i++; // Skip the next arg
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log("Usage: npx hardhat run scripts/get-fdc-proof.js [options] [roundId] [encodedRequest]");
      console.log("");
      console.log("Options:");
      console.log("  --verbose, -v       Enable verbose logging");
      console.log("  --wait, -w <seconds> Set custom wait time in seconds (default: 180)");
      console.log("  --no-wait           Skip waiting for round finalization");
      console.log("  --help, -h          Show this help message");
      console.log("");
      console.log("Environment variables:");
      console.log("  ROUND_ID            Round ID to query");
      console.log("  ENCODED_REQUEST     Encoded request bytes");
      console.log("  COSTON2_DA_LAYER_URL Data Availability Layer URL for Coston2");
      console.log("");
      console.log("Examples:");
      console.log("  With environment variables:");
      console.log("    ROUND_ID=123456 ENCODED_REQUEST=0x... npx hardhat run scripts/get-fdc-proof.js --network sepolia");
      console.log("");
      console.log("  With command line arguments:");
      console.log("    npx hardhat run scripts/get-fdc-proof.js --network sepolia 123456 0x...");
      process.exit(0);
    } else if (args[i] === '--no-wait') {
      waitTime = 0;
    } else if (roundId === null) {
      roundId = args[i];
    } else if (encodedRequest === null) {
      encodedRequest = args[i];
    }
  }
  
  // Check environment variables if not set from command line
  if (roundId === null) {
    roundId = process.env.ROUND_ID;
  }
  
  if (encodedRequest === null) {
    encodedRequest = process.env.ENCODED_REQUEST;
  }
  
  // Final check that we have both required values
  if (!roundId || !encodedRequest) {
    console.error("Error: Missing required parameters roundId and/or encodedRequest");
    console.error("Run with --help for usage information");
    process.exit(1);
  }
  
  // Convert roundId to integer if it's a string
  roundId = parseInt(roundId);
  
  if (verbose) {
    console.log("Running with options:");
    console.log(`  Round ID: ${roundId}`);
    console.log(`  Encoded Request: ${encodedRequest.substring(0, 50)}...`);
    console.log(`  Verbose: ${verbose}`);
    console.log(`  Wait Time: ${waitTime/1000} seconds`);
    console.log(`  DA Layer URL: ${process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/"}`);
  }
  
  getProof(roundId, encodedRequest, verbose, waitTime)
    .then(data => {
      console.log("Proof and data retrieved:");
      console.log(JSON.stringify(data, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error("Error retrieving proof:");
      console.error(error.response ? error.response.data : error.message);
      process.exit(1);
    });
} else {
  module.exports = getProof;
}