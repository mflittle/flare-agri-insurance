// data-processing/blockchain-adapter.js
const { fetchMonthlyData } = require('./noaa-data-fetcher');
const { processCountyData } = require('./fixed-weather-processor');

/**
 * Processes data and formats it for blockchain submission
 */
async function prepareMonthlyDataForBlockchain(year, month) {
  // Fetch raw data
  const rawData = await fetchMonthlyData(year, month);
  
  // Process data using your existing logic
  const processedData = processCountyData(rawData);
  
  // Format for blockchain submission
  const blockchainFormatted = [];
  
  for (const county of Object.keys(processedData)) {
    const countyData = processedData[county];
    const countyIndex = getCountyIndex(county); // Map county name to index
    
    // Format each weather event metric
    for (const [metricName, value] of Object.entries(countyData.metrics)) {
      const eventType = mapMetricToEventType(metricName); // Map to contract enum
      
      blockchainFormatted.push({
        countyId: countyIndex,
        timestamp: new Date(`${year}-${month}-01`).getTime() / 1000,
        eventType,
        measurement: convertMeasurement(metricName, value) // Convert to contract format
      });
    }
  }
  
  return blockchainFormatted;
}

/**
 * Helper functions to map your data to contract format
 */
function getCountyIndex(countyName) {
  const countyMap = {
    "Christian": 0,
    "Union": 1,
    "Todd": 2,
    "Henderson": 3,
    "Daviess": 4,
    "Warren": 5
  };
  return countyMap[countyName] || 0;
}

function mapMetricToEventType(metricName) {
  const metricMap = {
    "dryDays": 0, // Drought
    "rainfall": 1, // ExcessiveRain
    "heatDays": 2, // HeatStress
    "windSpeed": 3, // WindDamage
    "frostHours": 4  // FrostEvent
  };
  return metricMap[metricName] || 0;
}

function convertMeasurement(metricName, value) {
  // Convert to integer format required by the contract
  if (metricName === "rainfall") {
    return Math.round(value * 100); // Convert to hundredths of inches
  } else if (metricName === "windSpeed") {
    return Math.round(value * 10); // Convert to tenths of mph
  }
  return Math.round(value); // Already an integer
}

module.exports = {
  prepareMonthlyDataForBlockchain
};