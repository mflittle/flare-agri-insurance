const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
require('dotenv').config();

// Configuration
const NOAA_TOKEN = process.env.NOAA_TOKEN;
const BASE_URL = 'https://www.ncdc.noaa.gov/cdo-web/api/v2';

// Top agricultural counties in Kentucky with their FIPS codes
// FIPS codes are used by NOAA to identify counties
const kyAgCounties = [
  { name: "Christian", fips: "21047" },
  { name: "Union", fips: "21225" },
  { name: "Todd", fips: "21219" },
  { name: "Henderson", fips: "21101" },
  { name: "Daviess", fips: "21059" },
  { name: "Warren", fips: "21227" }
];

// Weather stations with good historical data in Kentucky
// Will be populated by the findWeatherStations function
let countyStations = {};

// NOAA data sets
// GHCND = Global Historical Climatology Network Daily
// NORMAL_DLY = Daily Normals
const DATA_SETS = {
  DAILY: 'GHCND',
  NORMALS: 'NORMAL_DLY'
};

// Weather data types we want to retrieve
const DATA_TYPES = {
  TMAX: 'TMAX', // Maximum temperature (tenths of degrees C)
  TMIN: 'TMIN', // Minimum temperature (tenths of degrees C)
  PRCP: 'PRCP', // Precipitation (tenths of mm)
  SNOW: 'SNOW', // Snowfall (mm)
  AWND: 'AWND'  // Average daily wind speed (tenths of meters per second)
};

// Helper function to make API requests with proper headers
async function makeRequest(endpoint, params = {}) {
  try {
    const response = await axios.get(`${BASE_URL}/${endpoint}`, {
      params,
      headers: {
        'token': NOAA_TOKEN
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error making request to ${endpoint}:`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
    }
    throw error;
  }
}

// Execute main function if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });
}

// Find weather stations for each county
async function findWeatherStations() {
  console.log('\nFinding weather stations for each county...');
  
  for (const county of kyAgCounties) {
    try {
      console.log(`Searching for stations in ${county.name} County...`);
      
      // Look for stations in this county that have GHCND data
      const result = await makeRequest('stations', {
        locationid: `FIPS:${county.fips}`,
        datasetid: DATA_SETS.DAILY,
        limit: 1000
      });
      
      // Filter for stations with good data coverage
      if (result.results && result.results.length > 0) {
        // Sort by data coverage (prefer stations with more data)
        const sortedStations = result.results
          .filter(station => station.datacoverage >= 0.9) // At least 90% data coverage
          .sort((a, b) => b.datacoverage - a.datacoverage);
        
        if (sortedStations.length > 0) {
          countyStations[county.name] = sortedStations.slice(0, 3); // Keep top 3 stations
          console.log(`  Found ${sortedStations.length} stations, keeping top 3`);
        } else {
          console.log(`  No stations with good data coverage found in ${county.name} County`);
          
          // If no good stations in this county, look in nearby counties
          const nearbyStations = await makeRequest('stations', {
            extent: getCountyExtent(county.fips),
            datasetid: DATA_SETS.DAILY,
            limit: 1000
          });
          
          if (nearbyStations.results && nearbyStations.results.length > 0) {
            const sortedNearby = nearbyStations.results
              .filter(station => station.datacoverage >= 0.9)
              .sort((a, b) => b.datacoverage - a.datacoverage);
            
            if (sortedNearby.length > 0) {
              countyStations[county.name] = sortedNearby.slice(0, 3);
              console.log(`  Found ${sortedNearby.length} nearby stations, keeping top 3`);
            } else {
              countyStations[county.name] = [];
              console.log(`  No stations with good data coverage found nearby`);
            }
          }
        }
      } else {
        countyStations[county.name] = [];
        console.log(`  No stations found for ${county.name} County`);
      }
      
      // Add a delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`Error finding stations for ${county.name} County:`, error.message);
      countyStations[county.name] = [];
    }
  }
  
  // Save station information
  const stationsDir = path.join(process.cwd(), 'data');
  fs.ensureDirSync(stationsDir);
  fs.writeJsonSync(path.join(stationsDir, 'weather_stations.json'), countyStations, { spaces: 2 });
  
  console.log('\nWeather stations data saved');
  return countyStations;
}

// Helper to create a bounding box around a county
function getCountyExtent(fips) {
  // This is a simplified approach - in a real app, you'd use actual county boundaries
  // For this example, we're just using a generic extent that should cover nearby areas
  // The NOAA API uses a bounding box with format: north,west,south,east
  return '38.2,-87.6,36.5,-85.7'; // Rough extent covering central/western Kentucky
}

// Fetch weather data for a specific year and county
async function fetchYearData(county, year) {
  console.log(`\nFetching ${year} data for ${county.name} County...`);
  
  // Get stations for this county
  const stations = countyStations[county.name];
  if (!stations || stations.length === 0) {
    console.log(`  No stations available for ${county.name} County, skipping`);
    return null;
  }
  
  // Create date range for the year
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  
  // Collect data from all stations for this county
  const allStationData = [];
  
  for (const station of stations) {
    console.log(`  Fetching data from station ${station.name} (${station.id})...`);
    
    try {
      // NOAA limits to 1000 results per request, so fetch data by month
      for (let month = 1; month <= 12; month++) {
        const monthStart = moment(`${year}-${month}-01`).format('YYYY-MM-DD');
        const monthEnd = moment(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
        
        console.log(`    Fetching data for ${monthStart} to ${monthEnd}...`);
        
        // Get data for all data types at once
        const dataTypes = Object.values(DATA_TYPES).join(',');
        
        const result = await makeRequest('data', {
          datasetid: DATA_SETS.DAILY,
          stationid: station.id,
          startdate: monthStart,
          enddate: monthEnd,
          datatypeid: dataTypes,
          limit: 1000,
          units: 'standard' // Use standard units (metric)
        });
        
        if (result.results && result.results.length > 0) {
          allStationData.push(...result.results);
          console.log(`    Retrieved ${result.results.length} records`);
        } else {
          console.log(`    No data found for this month`);
        }
        
        // Add a delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  Error fetching data for station ${station.id}:`, error.message);
    }
  }
  
  if (allStationData.length === 0) {
    console.log(`  No data found for ${county.name} County in ${year}`);
    return null;
  }
  
  console.log(`  Total records retrieved for ${county.name} County in ${year}: ${allStationData.length}`);
  
  // Process and organize the data
  const processedData = processRawData(allStationData, year);
  
  // Save the data
  const countyDir = path.join(process.cwd(), 'data', county.name);
  fs.ensureDirSync(countyDir);
  fs.writeJsonSync(path.join(countyDir, `${year}_data.json`), processedData, { spaces: 2 });
  
  console.log(`  Data saved for ${county.name} County in ${year}`);
  return processedData;
}

// Process raw NOAA data into a more usable format
function processRawData(rawData, year) {
  // First, organize data by date and data type
  const dataByDate = {};
  
  rawData.forEach(record => {
    const date = record.date.split('T')[0]; // Extract just the date part
    
    if (!dataByDate[date]) {
      dataByDate[date] = {};
    }
    
    // Store the value for this data type
    // NOAA provides values as strings, convert to numbers
    dataByDate[date][record.datatype] = parseFloat(record.value);
  });
  
  // Convert to array of daily records in a format similar to Tomorrow.io
  const dailyRecords = [];
  
  // Get all dates in chronological order
  const dates = Object.keys(dataByDate).sort();
  
  dates.forEach(date => {
    const dayData = dataByDate[date];
    
    // Convert units and format data
    const record = {
      startTime: `${date}T00:00:00Z`,
      values: {
        // Temperature: convert tenths of Celsius to Fahrenheit
        temperatureMax: dayData.TMAX ? (dayData.TMAX / 10) * 9/5 + 32 : null,
        temperatureMin: dayData.TMIN ? (dayData.TMIN / 10) * 9/5 + 32 : null,
        
        // Precipitation: convert tenths of mm to inches
        precipitationIntensity: dayData.PRCP ? dayData.PRCP / 254 : 0, // 25.4mm = 1 inch, and PRCP is in tenths of mm
        
        // Wind speed: convert tenths of m/s to mph
        windSpeed: dayData.AWND ? (dayData.AWND / 10) * 2.23694 : null,
        
        // Snowfall: convert mm to inches
        snowfall: dayData.SNOW ? dayData.SNOW / 25.4 : 0
      }
    };
    
    dailyRecords.push(record);
  });
  
  return {
    year: year,
    totalRecords: dailyRecords.length,
    data: {
      timelines: [{
        timestep: "1d",
        startTime: `${year}-01-01T00:00:00Z`,
        endTime: `${year}-12-31T23:59:59Z`,
        intervals: dailyRecords
      }]
    }
  };
}

// Process county data into insurance metrics
function processCountyData(countyName) {
  console.log(`\nProcessing insurance metrics for ${countyName} County...`);
  
  const countyDir = path.join(process.cwd(), 'data', countyName);
  fs.ensureDirSync(countyDir);
  
  const countyData = {
    countyName: countyName,
    droughtMetrics: {}, // Days below precipitation thresholds
    excessRainMetrics: {}, // Days above precipitation thresholds
    heatStressMetrics: {}, // Days above temperature thresholds
    frostEventMetrics: {}, // Days below freezing during growing season
    windEventMetrics: {}, // Days with high wind speeds
  };
  
  // Current year
  const currentYear = new Date().getFullYear();
  
  // Process each year's data
  for (let year = currentYear - 10; year < currentYear; year++) {
    try {
      const filePath = path.join(countyDir, `${year}_data.json`);
      
      if (!fs.existsSync(filePath)) {
        console.log(`  No data file for ${countyName} County, year ${year}`);
        continue;
      }
      
      const yearData = fs.readJsonSync(filePath);
      
      // Check if timeline data exists
      if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0]) {
        console.log(`  No timeline data for ${countyName} County, year ${year}`);
        continue;
      }
      
      // Extract timeline data
      const timelineData = yearData.data.timelines[0].intervals;
      
      // Process daily data for metrics
      processDailyMetrics(timelineData, year, countyData);
      
      console.log(`  Processed ${timelineData.length} days of data for ${year}`);
      
    } catch (error) {
      console.error(`  Error processing ${year} data for ${countyName}:`, error.message);
    }
  }
  
  // Save processed metrics
  fs.writeJsonSync(path.join(countyDir, 'processed_metrics.json'), countyData, { spaces: 2 });
  
  console.log(`Processed metrics saved for ${countyName} County`);
  return countyData;
}

// Process daily data into insurance-relevant metrics
function processDailyMetrics(dailyData, year, countyData) {
  // Initialize year metrics if not exist
  if (!countyData.droughtMetrics[year]) {
    countyData.droughtMetrics[year] = { 
      totalDroughtDays: 0,
      longestDroughtStreak: 0,
      droughtStreaks: [] 
    };
  }
  
  if (!countyData.excessRainMetrics[year]) {
    countyData.excessRainMetrics[year] = {
      daysAbove1Inch: 0,
      daysAbove2Inches: 0,
      daysAbove3Inches: 0,
      maxDailyRainfall: 0
    };
  }
  
  if (!countyData.heatStressMetrics[year]) {
    countyData.heatStressMetrics[year] = {
      daysAbove90F: 0,
      daysAbove95F: 0,
      daysAbove100F: 0,
      longestHeatStreak: 0,
      heatStreaks: []
    };
  }
  
  if (!countyData.frostEventMetrics[year]) {
    countyData.frostEventMetrics[year] = {
      growingSeasonFrostDays: 0, // Frost during Apr 15 - Oct 15
      lateFrostDates: [],
      earlyFrostDates: []
    };
  }
  
  if (!countyData.windEventMetrics[year]) {
    countyData.windEventMetrics[year] = {
      daysAbove25mph: 0,
      daysAbove35mph: 0,
      daysAbove45mph: 0,
      maxWindSpeed: 0
    };
  }
  
  // Variables to track consecutive day events
  let currentDroughtStreak = 0;
  let currentHeatStreak = 0;
  
  // Process each day
  dailyData.forEach(day => {
    if (!day.values) {
      return; // Skip days with missing values
    }
    
    const date = new Date(day.startTime);
    const values = day.values;
    
    // Extract values (with fallbacks in case data is missing)
    const dailyRainfall = values.precipitationIntensity || 0;
    const maxTemp = values.temperatureMax || 0;
    const minTemp = values.temperatureMin || 0;
    const windSpeed = values.windSpeed || 0;
    
    // Month for seasonal analysis (0-indexed)
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    
    // --- Drought Analysis ---
    if (dailyRainfall < 0.1) { // Less than 0.1 inches of rain
      currentDroughtStreak++;
      countyData.droughtMetrics[year].totalDroughtDays++;
    } else {
      // If we had a drought streak, record it
      if (currentDroughtStreak > 0) {
        countyData.droughtMetrics[year].droughtStreaks.push(currentDroughtStreak);
        countyData.droughtMetrics[year].longestDroughtStreak = Math.max(
          countyData.droughtMetrics[year].longestDroughtStreak,
          currentDroughtStreak
        );
      }
      currentDroughtStreak = 0;
    }
    
    // --- Excess Rain Analysis ---
    if (dailyRainfall >= 1) {
      countyData.excessRainMetrics[year].daysAbove1Inch++;
    }
    if (dailyRainfall >= 2) {
      countyData.excessRainMetrics[year].daysAbove2Inches++;
    }
    if (dailyRainfall >= 3) {
      countyData.excessRainMetrics[year].daysAbove3Inches++;
    }
    countyData.excessRainMetrics[year].maxDailyRainfall = Math.max(
      countyData.excessRainMetrics[year].maxDailyRainfall,
      dailyRainfall
    );
    
    // --- Heat Stress Analysis ---
    if (maxTemp >= 90) {
      countyData.heatStressMetrics[year].daysAbove90F++;
      currentHeatStreak++;
    } else {
      // If we had a heat streak, record it
      if (currentHeatStreak > 0) {
        countyData.heatStressMetrics[year].heatStreaks.push(currentHeatStreak);
        countyData.heatStressMetrics[year].longestHeatStreak = Math.max(
          countyData.heatStressMetrics[year].longestHeatStreak,
          currentHeatStreak
        );
      }
      currentHeatStreak = 0;
    }
    
    if (maxTemp >= 95) {
      countyData.heatStressMetrics[year].daysAbove95F++;
    }
    
    if (maxTemp >= 100) {
      countyData.heatStressMetrics[year].daysAbove100F++;
    }
    
    // --- Frost Event Analysis ---
    // Check for frost during growing season (April 15 - October 15)
    const isGrowingSeason = (month > 3 || (month === 3 && dayOfMonth >= 15)) && 
                            (month < 9 || (month === 9 && dayOfMonth <= 15));
    
    if (minTemp <= 32 && isGrowingSeason) {
      countyData.frostEventMetrics[year].growingSeasonFrostDays++;
      
      // Record late spring frosts (after April 15)
      if (month === 3 && dayOfMonth >= 15 || month === 4) {
        countyData.frostEventMetrics[year].lateFrostDates.push(date.toISOString().split('T')[0]);
      }
      
      // Record early fall frosts (before October 15)
      if (month === 8 || (month === 9 && dayOfMonth <= 15)) {
        countyData.frostEventMetrics[year].earlyFrostDates.push(date.toISOString().split('T')[0]);
      }
    }
    
    // --- Wind Event Analysis ---
    if (windSpeed >= 25) {
      countyData.windEventMetrics[year].daysAbove25mph++;
    }
    
    if (windSpeed >= 35) {
      countyData.windEventMetrics[year].daysAbove35mph++;
    }
    
    if (windSpeed >= 45) {
      countyData.windEventMetrics[year].daysAbove45mph++;
    }
    
    countyData.windEventMetrics[year].maxWindSpeed = Math.max(
      countyData.windEventMetrics[year].maxWindSpeed,
      windSpeed
    );
  });
  
  // Handle any ongoing streaks at the end of the year
  if (currentDroughtStreak > 0) {
    countyData.droughtMetrics[year].droughtStreaks.push(currentDroughtStreak);
    countyData.droughtMetrics[year].longestDroughtStreak = Math.max(
      countyData.droughtMetrics[year].longestDroughtStreak,
      currentDroughtStreak
    );
  }
  
  if (currentHeatStreak > 0) {
    countyData.heatStressMetrics[year].heatStreaks.push(currentHeatStreak);
    countyData.heatStressMetrics[year].longestHeatStreak = Math.max(
      countyData.heatStressMetrics[year].longestHeatStreak,
      currentHeatStreak
    );
  }
}

// Generate insurance thresholds based on historical data
function generateInsuranceThresholds() {
  console.log('\nGenerating insurance thresholds...');
  
  const thresholds = {
    generatedAt: new Date().toISOString(),
    counties: {}
  };
  
  // Process each county
  for (const county of kyAgCounties) {
    try {
      const metricsPath = path.join(process.cwd(), 'data', county.name, 'processed_metrics.json');
      
      if (!fs.existsSync(metricsPath)) {
        console.log(`No processed metrics found for ${county.name} County`);
        continue;
      }
      
      const metrics = fs.readJsonSync(metricsPath);
      
      // Current year
      const currentYear = new Date().getFullYear();
      
      // Collect data across years
      const droughtStreaks = [];
      const heatStreaks = [];
      const maxRainfalls = [];
      const windSpeeds = [];
      
      for (let year = currentYear - 10; year < currentYear; year++) {
        if (metrics.droughtMetrics[year]) {
          droughtStreaks.push(...metrics.droughtMetrics[year].droughtStreaks);
        }
        
        if (metrics.heatStressMetrics[year]) {
          heatStreaks.push(...metrics.heatStressMetrics[year].heatStreaks);
        }
        
        if (metrics.excessRainMetrics[year]) {
          maxRainfalls.push(metrics.excessRainMetrics[year].maxDailyRainfall);
        }
        
        if (metrics.windEventMetrics[year]) {
          windSpeeds.push(metrics.windEventMetrics[year].maxWindSpeed);
        }
      }
      
      // Sort arrays for percentile calculations
      droughtStreaks.sort((a, b) => a - b);
      heatStreaks.sort((a, b) => a - b);
      maxRainfalls.sort((a, b) => a - b);
      windSpeeds.sort((a, b) => a - b);
      
      // Calculate thresholds - using 75th, 90th and 95th percentiles
      thresholds.counties[county.name] = {
        drought: calculatePercentileThresholds(droughtStreaks),
        heatWave: calculatePercentileThresholds(heatStreaks),
        excessiveRain: calculatePercentileThresholds(maxRainfalls),
        wind: calculatePercentileThresholds(windSpeeds)
      };
      
    } catch (error) {
      console.error(`Error processing thresholds for ${county.name}:`, error.message);
    }
  }
  
  // Save thresholds summary
  const summaryPath = path.join(process.cwd(), 'data', 'insurance_thresholds.json');
  fs.writeJsonSync(summaryPath, thresholds, { spaces: 2 });
  
  console.log(`Insurance thresholds saved to ${summaryPath}`);
  return thresholds;
}

// Helper function to calculate percentile thresholds
function calculatePercentileThresholds(values) {
  if (values.length === 0) {
    return { moderate: 0, severe: 0, extreme: 0 };
  }
  
  // Calculate percentiles
  const p75Index = Math.floor(values.length * 0.75);
  const p90Index = Math.floor(values.length * 0.90);
  const p95Index = Math.floor(values.length * 0.95);
  
  return {
    moderate: parseFloat((values[p75Index] || 0).toFixed(1)), // 75th percentile
    severe: parseFloat((values[p90Index] || 0).toFixed(1)),   // 90th percentile
    extreme: parseFloat((values[p95Index] || 0).toFixed(1))   // 95th percentile
  };
}

// Function to generate smart contract parameters
function generateSmartContractParams() {
  console.log('\nGenerating smart contract parameters...');
  
  const thresholdsPath = path.join(process.cwd(), 'data', 'insurance_thresholds.json');
  
  if (!fs.existsSync(thresholdsPath)) {
    console.error('No thresholds file found. Run generateInsuranceThresholds first.');
    return;
  }
  
  const thresholds = fs.readJsonSync(thresholdsPath);
  
  // Map county names to contract enum indices
  const countyIndices = {};
  kyAgCounties.forEach((county, index) => {
    countyIndices[county.name] = index;
  });
  
  // Weather event types defined in the smart contract
  const eventTypes = {
    'drought': 0,
    'excessiveRain': 1,
    'frost': 2,
    'heatWave': 3,
    'wind': 4
  };
  
  // Generate parameters for the smart contract
  const contractParams = {
    generatedAt: new Date().toISOString(),
    counties: {}
  };
  
  Object.keys(thresholds.counties).forEach(countyName => {
    if (countyIndices[countyName] === undefined) return;
    
    contractParams.counties[countyName] = {
      countyIndex: countyIndices[countyName],
      thresholds: {}
    };
    
    // Drought thresholds
    if (thresholds.counties[countyName].drought) {
      contractParams.counties[countyName].thresholds.drought = {
        eventType: eventTypes.drought,
        moderate: thresholds.counties[countyName].drought.moderate,
        severe: thresholds.counties[countyName].drought.severe,
        extreme: thresholds.counties[countyName].drought.extreme
      };
    }
    
    // Heat wave thresholds
    if (thresholds.counties[countyName].heatWave) {
      contractParams.counties[countyName].thresholds.heatWave = {
        eventType: eventTypes.heatWave,
        moderate: thresholds.counties[countyName].heatWave.moderate,
        severe: thresholds.counties[countyName].heatWave.severe,
        extreme: thresholds.counties[countyName].heatWave.extreme
      };
    }
    
    // Excessive rain thresholds
    if (thresholds.counties[countyName].excessiveRain) {
      contractParams.counties[countyName].thresholds.excessiveRain = {
        eventType: eventTypes.excessiveRain,
        moderate: thresholds.counties[countyName].excessiveRain.moderate,
        severe: thresholds.counties[countyName].excessiveRain.severe,
        extreme: thresholds.counties[countyName].excessiveRain.extreme
      };
    }
    
    // Wind thresholds
    if (thresholds.counties[countyName].wind) {
      contractParams.counties[countyName].thresholds.wind = {
        eventType: eventTypes.wind,
        moderate: thresholds.counties[countyName].wind.moderate,
        severe: thresholds.counties[countyName].wind.severe,
        extreme: thresholds.counties[countyName].wind.extreme
      };
    }
  });
  
  // Save contract parameters
  const paramsPath = path.join(process.cwd(), 'data', 'contract_parameters.json');
  fs.writeJsonSync(paramsPath, contractParams, { spaces: 2 });
  
  console.log(`Smart contract parameters saved to ${paramsPath}`);
  return contractParams;
}

// Export functions for potential reuse in other modules
module.exports = {
  findWeatherStations,
  fetchYearData,
  processCountyData,
  generateInsuranceThresholds,
  generateSmartContractParams
};

// Command line argument processing
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'stations':
      console.log('Finding weather stations for Kentucky counties...');
      await findWeatherStations();
      break;
      
    case 'fetch':
      console.log('Starting historical data fetch from NOAA...');
      // Load station data if available
      const stationsPath = path.join(process.cwd(), 'data', 'weather_stations.json');
      if (fs.existsSync(stationsPath)) {
        countyStations = fs.readJsonSync(stationsPath);
      } else {
        await findWeatherStations();
      }
      
      // Fetch data for all counties
      const currentYear = new Date().getFullYear();
      for (const county of kyAgCounties) {
        for (let year = currentYear - 10; year < currentYear; year++) {
          await fetchYearData(county, year);
        }
      }
      break;
      
    case 'fetch-year':
      if (!args[1] || !args[2]) {
        console.log('Please specify county name and year: node noaa-data-fetcher.js fetch-year "Christian" 2020');
        break;
      }
      
      // Load station data
      const stationsPath2 = path.join(process.cwd(), 'data', 'weather_stations.json');
      if (fs.existsSync(stationsPath2)) {
        countyStations = fs.readJsonSync(stationsPath2);
      } else {
        await findWeatherStations();
      }
      
      // Find the county
      const countyName = args[1];
      const year = parseInt(args[2]);
      const county = kyAgCounties.find(c => c.name.toLowerCase() === countyName.toLowerCase());
      
      if (!county) {
        console.log(`County "${countyName}" not found. Available counties: ${kyAgCounties.map(c => c.name).join(', ')}`);
        break;
      }
      
      await fetchYearData(county, year);
      break;
      
    case 'process':
      console.log('Processing raw data for all counties...');
      for (const county of kyAgCounties) {
        processCountyData(county.name);
      }
      break;
      
    case 'thresholds':
      console.log('Generating insurance thresholds...');
      generateInsuranceThresholds();
      break;
      
    case 'contract-params':
      console.log('Generating smart contract parameters...');
      generateSmartContractParams();
      break;
      
    case 'all':
      console.log('Running complete workflow: stations -> fetch -> process -> thresholds -> contract-params');
      await findWeatherStations();
      
      const currentYear2 = new Date().getFullYear();
      for (const county of kyAgCounties) {
        for (let year = currentYear2 - 10; year < currentYear2; year++) {
          await fetchYearData(county, year);
        }
        processCountyData(county.name);
      }
      
      generateInsuranceThresholds();
      generateSmartContractParams();
      break;
      
    case 'help':
    default:
      console.log(`
Agricultural Insurance Weather Data Tool (NOAA Version)
======================================================

Usage:
  node noaa-data-fetcher.js [command]

Commands:
  stations         Find weather stations for Kentucky counties
  fetch            Fetch all historical weather data from NOAA (10 years)
  fetch-year       Fetch data for specific county and year
                   Example: node noaa-data-fetcher.js fetch-year "Christian" 2020
  process          Process raw data into insurance metrics
  thresholds       Generate insurance thresholds based on processed data
  contract-params  Generate smart contract parameters for Solidity
  all              Run complete workflow (stations -> fetch -> process -> thresholds -> contract-params)
  help             Show this help message

Examples:
  node noaa-data-fetcher.js stations
  node noaa-data-fetcher.js fetch
  node noaa-data-fetcher.js process
      `);
  }
}