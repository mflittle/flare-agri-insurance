const axios = require('axios');
require('dotenv').config();

async function checkRound(roundId) {
  // Use the Coston2 DA Layer URL as specified in the reference project
  const DA_LAYER_URL = process.env.COSTON2_DA_LAYER_URL || "https://ctn2-data-availability.flare.network/";
  
  console.log(`Checking Round ID: ${roundId}`);
  console.log(`Using DA Layer URL: ${DA_LAYER_URL}`);
  
  // Using the correct API endpoint format based on Weather Insurance example
  const endpoint = `${DA_LAYER_URL}api/v1/fdc/votes-for-round/${roundId}`;
  
  try {
    console.log(`Trying endpoint: ${endpoint}`);
    
    const response = await axios.get(endpoint, {
      timeout: 30000
    });
    
    console.log("Response received!");
    console.log(JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`Failed with endpoint ${endpoint}: ${error.message}`);
    
    if (error.response) {
      console.log(`Response status: ${error.response.status}`);
      console.log(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    // Try alternate endpoint format
    const alternateEndpoint = `${DA_LAYER_URL}api/v1/fdc/requests-for-round/${roundId}`;
    
    try {
      console.log(`Trying alternate endpoint: ${alternateEndpoint}`);
      
      const altResponse = await axios.get(alternateEndpoint, {
        timeout: 30000
      });
      
      console.log("Response received from alternate endpoint!");
      console.log(JSON.stringify(altResponse.data, null, 2));
      return altResponse.data;
    } catch (altError) {
      console.log(`Failed with alternate endpoint ${alternateEndpoint}: ${altError.message}`);
      
      if (altError.response) {
        console.log(`Response status: ${altError.response.status}`);
        console.log(`Response data: ${JSON.stringify(altError.response.data)}`);
      }
    }
  }
  
  console.log("Failed to retrieve information about this round.");
}

if (require.main === module) {
  const roundId = process.argv[2] || 960934;
  
  checkRound(parseInt(roundId))
    .then(() => process.exit(0))
    .catch(error => {
      console.error("Error:", error.message);
      process.exit(1);
    });
}

module.exports = checkRound;