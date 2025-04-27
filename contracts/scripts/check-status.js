const axios = require('axios');
require('dotenv').config();

async function checkStatus() {
  // DA Layer URLs to test
  const baseUrls = [
    "https://ctn2-data-availability.flare.network/",
    "https://ctn-data-availability.flare.network/",
    "https://flr-data-availability.flare.network/",
    "https://sgb-data-availability.flare.network/"
  ];
  
  // Status endpoints to try
  const statusEndpoints = [
    "api/v1/fdc/status",
    "api/v0/fdc/status",
    "api/fdc/status",
    "fdc/status",
    "api/v1/status",
    "api/v0/status",
    "api/status",
    "status",
    "api/v1/fdc/proof/status",
    "api/v0/fdc/proof/status",
    "api/fdc/proof/status",
    "fdc/proof/status",
    "api/proof/status"
  ];
  
  console.log("=== FDC Service Status Check ===");
  
  for (const baseUrl of baseUrls) {
    console.log(`\n--- Checking ${baseUrl} ---`);
    
    for (const endpoint of statusEndpoints) {
      const url = `${baseUrl}${endpoint}`;
      try {
        console.log(`Trying ${url}...`);
        const response = await axios.get(url, { timeout: 8000 });
        console.log(`✅ Success! Status: ${response.status}`);
        console.log("Response:", JSON.stringify(response.data, null, 2));
        
        // If we found a status endpoint, try to get the latest round ID
        if (response.data && (response.data.latestRoundId || response.data.roundId)) {
          const latestRoundId = response.data.latestRoundId || response.data.roundId;
          console.log(`\n✅ FOUND LATEST ROUND ID: ${latestRoundId}`);
          
          // Try to test with the latest round ID
          if (latestRoundId) {
            console.log(`\nTesting endpoints with latest round ID: ${latestRoundId}`);
            
            const roundEndpoints = [
              `api/v1/fdc/votes-for-round/${latestRoundId}`,
              `api/v0/fdc/votes-for-round/${latestRoundId}`,
              `api/fdc/votes-for-round/${latestRoundId}`,
              `fdc/votes-for-round/${latestRoundId}`
            ];
            
            for (const roundEndpoint of roundEndpoints) {
              const roundUrl = `${baseUrl}${roundEndpoint}`;
              try {
                console.log(`Trying ${roundUrl}...`);
                const roundResponse = await axios.get(roundUrl, { timeout: 8000 });
                console.log(`✅ Success! Status: ${roundResponse.status}`);
                console.log("First 200 chars of response:", 
                  JSON.stringify(roundResponse.data).substring(0, 200) + "...");
                
                // Found a working endpoint!
                console.log(`\n✅✅✅ FOUND WORKING ENDPOINT FOR ROUNDS: ${roundEndpoint}`);
                console.log(`Try using: ${baseUrl}${roundEndpoint.replace(latestRoundId, 'YOUR_ROUND_ID')}`);
              } catch (error) {
                console.log(`❌ Failed`);
                if (error.response) {
                  console.log(`   Status: ${error.response.status}`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`❌ Failed`);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
        }
      }
    }
  }
  
  console.log("\n=== Status Check Complete ===");
}

if (require.main === module) {
  checkStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}

module.exports = checkStatus;