const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration - Use environment variable for API key
const API_KEY = process.env.TOMORROW_API_KEY;
const BASE_URL = 'https://api.tomorrow.io/v4/timelines';

// Top agricultural counties in Kentucky with their coordinates
const kyAgCounties = [
  { name: "Christian", lat: 36.8455, lon: -87.4934 },
  { name: "Union", lat: 37.6606, lon: -87.9431 },
  { name: "Todd", lat: 36.8397, lon: -87.1716 },
  { name: "Henderson", lat: 37.8361, lon: -87.5700 },
  { name: "Daviess", lat: 37.7336, lon: -87.0867 },
  { name: "Warren", lat: 36.9685, lon: -86.4808 }
];

// Important agricultural weather parameters 
const fields = [
  'temperature',           // Temperature in Celsius
  'temperatureApparent',   // Feels like temperature
  'humidity',              // Relative humidity
  'windSpeed',             // Wind speed
  'windGust',              // Wind gust
  'windDirection',         // Wind direction
  'pressureSurfaceLevel',  // Atmospheric pressure
  'precipitationIntensity',// Precipitation intensity
  'precipitationType',     // Type of precipitation (rain, snow, etc.)
  'precipitationProbability', // Probability of precipitation
  'temperatureMin',        // Minimum temperature
  'temperatureMax',        // Maximum temperature
  'uvIndex',               // UV index
  'evapotranspiration',    // Important for agriculture
  'soilMoisture',          // Critical for crop growth analysis
  'soilTemperature',       // Affects seed germination
  'visibility'             // Important for operations
];

// Function to ensure directory exists
function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
    console.log(`Created directory: ${directoryPath}`);
  }
}

// Function to fetch 1 year of historical data for a county
async function fetchYearData(county, year) {
  // Calculate start and end dates for the year
  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, 11, 31); // December 31st
  
  // Format dates as ISO strings for the API
  const startTime = startDate.toISOString();
  const endTime = endDate.toISOString();

  // Prepare request parameters
  const params = {
    apikey: API_KEY,
    location: `${county.lat},${county.lon}`,
    fields: fields.join(','),
    timesteps: 'day',  // Daily data points
    startTime: startTime,
    endTime: endTime,
    units: 'imperial' // Use imperial units (Fahrenheit, inches, etc.)
  };

  try {
    console.log(`Fetching ${year} data for ${county.name} County...`);
    const response = await axios.get(BASE_URL, { params });
    
    // Create directory structure
    const dataDir = path.join(process.cwd(), 'data');
    const countyDir = path.join(dataDir, county.name);
    ensureDirectoryExists(dataDir);
    ensureDirectoryExists(countyDir);
    
    // Save the response to a JSON file
    const filePath = path.join(countyDir, `${year}_data.json`);
    fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
    
    console.log(`Saved ${year} data for ${county.name} County to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error fetching data for ${county.name} County (${year}):`);
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Error details:', error.response.data);
    } else if (error.request) {
      console.error('No response received from server');
    } else {
      console.error('Error setting up request:', error.message);
    }
    return false;
  }
}

// Function to fetch all 10 years of data for all counties
async function fetchHistoricalData() {
  // Get current year
  const currentYear = new Date().getFullYear();
  
  // Loop through all counties
  for (const county of kyAgCounties) {
    console.log(`\n===== Processing ${county.name} County =====`);
    
    // Fetch 10 years of data
    for (let year = currentYear - 10; year < currentYear; year++) {
      // Add delay between requests to avoid hitting rate limits
      if (year > currentYear - 10) {
        const delayTime = 1500; // 1.5 seconds between requests
        console.log(`Waiting ${delayTime}ms before next request...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }
      
      const success = await fetchYearData(county, year);
      
      // If request failed, pause for longer before trying next one
      if (!success) {
        console.log('Request failed. Pausing for 30 seconds before next request...');
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
  }
  
  console.log('\n✅ All historical data fetching completed!');
}

// Process data for a single county
function processCountyData(countyName) {
  console.log(`\nProcessing data for ${countyName} County...`);
  
  const countyDataDir = path.join(process.cwd(), 'data', countyName);
  if (!fs.existsSync(countyDataDir)) {
    console.error(`Directory for ${countyName} not found!`);
    return null;
  }
  
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
      const filePath = path.join(countyDataDir, `${year}_data.json`);
      if (!fs.existsSync(filePath)) {
        console.log(`No data file for ${countyName} County, year ${year}`);
        continue;
      }
      
      const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Check if timelines exist
      if (!rawData.data || !rawData.data.timelines || !rawData.data.timelines[0]) {
        console.log(`No timeline data for ${countyName} County, year ${year}`);
        continue;
      }
      
      // Extract timeline data
      const timelineData = rawData.data.timelines[0].intervals;
      
      // Process daily data for metrics
      processDailyMetrics(timelineData, year, countyData);
      
    } catch (error) {
      console.error(`Error processing ${year} data for ${countyName}:`, error.message);
    }
  }
  
  // Save processed metrics
  const metricsPath = path.join(countyDataDir, 'processed_metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify(countyData, null, 2));
  
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
    // Skip if missing values object
    if (!day.values) {
      console.log(`Missing values for day: ${day.startTime}`);
      return;
    }
    
    const date = new Date(day.startTime);
    const values = day.values;
    
    // Extract values (with fallbacks in case data is missing)
    const dailyRainfall = values.precipitationIntensity || 0;
    const maxTemp = values.temperatureMax || values.temperature || 0;
    const minTemp = values.temperatureMin || values.temperature || 0;
    const windSpeed = values.windSpeed || 0;
    const windGust = values.windGust || 0;
    
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
    const effectiveWindSpeed = Math.max(windSpeed, windGust);
    
    if (effectiveWindSpeed >= 25) {
      countyData.windEventMetrics[year].daysAbove25mph++;
    }
    
    if (effectiveWindSpeed >= 35) {
      countyData.windEventMetrics[year].daysAbove35mph++;
    }
    
    if (effectiveWindSpeed >= 45) {
      countyData.windEventMetrics[year].daysAbove45mph++;
    }
    
    countyData.windEventMetrics[year].maxWindSpeed = Math.max(
      countyData.windEventMetrics[year].maxWindSpeed,
      effectiveWindSpeed
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

// Function to generate summary thresholds for all counties
function generateInsuranceThresholds() {
  console.log('\nCalculating insurance thresholds for all counties...');
  
  const summaryData = {
    generatedAt: new Date().toISOString(),
    counties: {}
  };
  
  // Process data for all counties
  kyAgCounties.forEach(county => {
    const countyDir = path.join(process.cwd(), 'data', county.name);
    const metricsPath = path.join(countyDir, 'processed_metrics.json');
    
    if (!fs.existsSync(metricsPath)) {
      console.log(`No processed metrics found for ${county.name} County`);
      return;
    }
    
    try {
      const countyMetrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      
      // Current year
      const currentYear = new Date().getFullYear();
      
      // Collect data across years
      const droughtStreaks = [];
      const heatStreaks = [];
      const maxRainfalls = [];
      const windSpeeds = [];
      
      for (let year = currentYear - 10; year < currentYear; year++) {
        if (countyMetrics.droughtMetrics[year]) {
          droughtStreaks.push(...countyMetrics.droughtMetrics[year].droughtStreaks);
        }
        
        if (countyMetrics.heatStressMetrics[year]) {
          heatStreaks.push(...countyMetrics.heatStressMetrics[year].heatStreaks);
        }
        
        if (countyMetrics.excessRainMetrics[year]) {
          maxRainfalls.push(countyMetrics.excessRainMetrics[year].maxDailyRainfall);
        }
        
        if (countyMetrics.windEventMetrics[year]) {
          windSpeeds.push(countyMetrics.windEventMetrics[year].maxWindSpeed);
        }
      }
      
      // Sort arrays for percentile calculations
      droughtStreaks.sort((a, b) => a - b);
      heatStreaks.sort((a, b) => a - b);
      maxRainfalls.sort((a, b) => a - b);
      windSpeeds.sort((a, b) => a - b);
      
      // Calculate thresholds - using 75th, 90th and 95th percentiles
      summaryData.counties[county.name] = {
        drought: calculateThresholds(droughtStreaks),
        heatWave: calculateThresholds(heatStreaks),
        excessiveRain: calculateThresholds(maxRainfalls),
        wind: calculateThresholds(windSpeeds)
      };
      
    } catch (error) {
      console.error(`Error processing thresholds for ${county.name}:`, error.message);
    }
  });
  
  // Save thresholds summary
  const summaryPath = path.join(process.cwd(), 'data', 'insurance_thresholds.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
  
  console.log(`Insurance thresholds saved to ${summaryPath}`);
  return summaryData;
}

// Helper function to calculate thresholds from array of values
function calculateThresholds(values) {
  if (values.length === 0) return { moderate: 0, severe: 0, extreme: 0 };
  
  // Calculate percentiles
  const p75Index = Math.floor(values.length * 0.75);
  const p90Index = Math.floor(values.length * 0.90);
  const p95Index = Math.floor(values.length * 0.95);
  
  return {
    moderate: Math.round(values[p75Index] * 10) / 10, // 75th percentile
    severe: Math.round(values[p90Index] * 10) / 10,   // 90th percentile
    extreme: Math.round(values[p95Index] * 10) / 10   // 95th percentile
  };
}

// Command line argument processing
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'fetch':
      console.log('Starting historical data fetch for Kentucky counties...');
      await fetchHistoricalData();
      break;
      
    case 'process':
      console.log('Processing raw data for all counties...');
      kyAgCounties.forEach(county => processCountyData(county.name));
      break;
      
    case 'thresholds':
      console.log('Generating insurance thresholds...');
      generateInsuranceThresholds();
      break;
      
    case 'all':
      console.log('Running complete workflow: fetch, process, generate thresholds');
      await fetchHistoricalData();
      kyAgCounties.forEach(county => processCountyData(county.name));
      generateInsuranceThresholds();
      break;
      
    case 'help':
    default:
      console.log(`
Agricultural Insurance Weather Data Tool
=======================================

Usage:
  node data-fetcher.js [command]

Commands:
  fetch       Fetch historical weather data from Tomorrow.io
  process     Process raw data into insurance metrics
  thresholds  Generate insurance thresholds
  all         Run complete workflow (fetch -> process -> thresholds)
  help        Show this help message

Examples:
  node data-fetcher.js fetch
  node data-fetcher.js all
      `);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Error in main execution:', error);
  process.exit(1);
});