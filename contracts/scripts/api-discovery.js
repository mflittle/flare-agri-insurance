const axios = require('axios');
require('dotenv').config();

async function testEndpoint(baseUrl, path, method = 'get', data = null) {
  const url = `${baseUrl}${path}`;
  try {
    console.log(`Testing ${method.toUpperCase()} ${url}`);
    let response;
    
    if (method.toLowerCase() === 'get') {
      response = await axios.get(url, { timeout: 10000 });
    } else {
      response = await axios.post(url, data, { 
        timeout: 10000,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    
    console.log(`✅ Success! Status: ${response.status}`);
    console.log("Response:", JSON.stringify(response.data, null, 2).substring(0, 500) + "...");
    return true;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      console.log(`❌ Failed with status: ${error.response.status}`);
      if (error.response.data) {
        const responseData = typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 200) 
          : JSON.stringify(error.response.data, null, 2).substring(0, 200);
        console.log(`Response data: ${responseData}...`);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.log('❌ No response received');
    } else {
      // Something happened in setting up the request
      console.log(`❌ Error: ${error.message}`);
    }
    return false;
  }
}

async function discoverApi() {
  // DA Layer URLs to test
  const baseUrls = [
    "https://ctn2-data-availability.flare.network/",
    "https://ctn-data-availability.flare.network/"
  ];
  
  // Basic paths to check if API is alive
  const basePaths = [
    "",
    "api/",
    "api/v1/",
    "api/v0/",
    "fdc/",
    "api/fdc/",
    "da/"
  ];
  
  // FDC specific paths
  const roundId = 960934;
  const fdcPaths = [
    `api/v1/fdc/votes-for-round/${roundId}`,
    `api/v1/fdc/requests-for-round/${roundId}`,
    `api/v0/fdc/votes-for-round/${roundId}`,
    `api/v0/fdc/requests-for-round/${roundId}`,
    `api/fdc/votes-for-round/${roundId}`,
    `api/fdc/requests-for-round/${roundId}`,
    `fdc/votes-for-round/${roundId}`,
    `fdc/requests-for-round/${roundId}`,
    `api/v1/votes-for-round/${roundId}`,
    `api/v0/votes-for-round/${roundId}`,
    `votes-for-round/${roundId}`,
    `requests-for-round/${roundId}`
  ];
  
  console.log("=== API DISCOVERY TOOL ===");
  console.log("This tool will test various URLs and endpoints to find the correct API structure");
  console.log("---------------------------------------------------------------");
  
  // Test base URLs first to see if servers are responding
  for (const baseUrl of baseUrls) {
    console.log(`\n=== Testing base URL: ${baseUrl} ===`);
    for (const path of basePaths) {
      await testEndpoint(baseUrl, path);
    }
  }
  
  // Test FDC specific endpoints
  for (const baseUrl of baseUrls) {
    console.log(`\n=== Testing FDC endpoints at ${baseUrl} ===`);
    for (const path of fdcPaths) {
      await testEndpoint(baseUrl, path);
    }
  }
  
  console.log("\n=== Testing proof endpoints ===");
  // Test the proof retrieval endpoints
  const encodedRequest = process.env.ENCODED_REQUEST || "0x45564d5472616e73616374696f6e0000000000000000000000000000000000007465737445544800000000000000000000000000000000000000000000000000a0442155e3e9623f1778745f7370596f5ea83ccf8c37be535a875d4d2427bb80000000000000000000000000000000000000000000000000000000000000002013ce2bac647732000a8c463c494b052cd02fd49a816b8da70532b6818c7cd91e00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000000";
  
  const proofPaths = [
    "api/v1/fdc/proof-by-request-round-raw",
    "api/v0/fdc/proof-by-request-round-raw",
    "api/fdc/proof-by-request-round-raw",
    "fdc/proof-by-request-round-raw",
    "api/v1/fdc/get-proof-round-id-bytes",
    "api/v0/fdc/get-proof-round-id-bytes",
    "api/fdc/get-proof-round-id-bytes",
    "fdc/get-proof-round-id-bytes"
  ];
  
  for (const baseUrl of baseUrls) {
    for (const path of proofPaths) {
      const data = {
        votingRoundId: roundId,
        requestBytes: encodedRequest
      };
      await testEndpoint(baseUrl, path, 'post', data);
    }
  }
  
  console.log("\n=== API Discovery Complete ===");
}

if (require.main === module) {
  discoverApi()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}

module.exports = discoverApi;