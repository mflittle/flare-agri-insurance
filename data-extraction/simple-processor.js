const fs = require('fs-extra');
const path = require('path');

// Process a single county for simplicity
function processSingleCounty(countyName) {
  console.log(`\nProcessing ${countyName} County data...`);
  
  // Set up paths
  const cwd = process.cwd();
  const dataDir = path.join(cwd, 'data');
  const countyDir = path.join(dataDir, countyName);
  
  if (!fs.existsSync(countyDir)) {
    console.error(`County directory not found: ${countyDir}`);
    return false;
  }
  
  // Look for data files
  console.log(`Looking for data files in: ${countyDir}`);
  const files = fs.readdirSync(countyDir);
  const dataFiles = files.filter(file => file.endsWith('_data.json'));
  
  if (dataFiles.length === 0) {
    console.error(`No data files found in: ${countyDir}`);
    return false;
  }
  
  console.log(`Found ${dataFiles.length} data files: ${dataFiles.join(', ')}`);
  
  // Process each data file
  const processedMetrics = {
    countyName: countyName,
    droughtMetrics: {},
    excessRainMetrics: {},
    heatStressMetrics: {},
    frostEventMetrics: {},
    windEventMetrics: {}
  };
  
  let processedCount = 0;
  
  dataFiles.forEach(file => {
    try {
      // Extract year from filename
      const year = parseInt(file.split('_')[0]);
      if (isNaN(year)) {
        console.log(`Skipping file with invalid year format: ${file}`);
        return;
      }
      
      console.log(`Processing file: ${file} (year: ${year})`);
      
      // Read data file
      const filePath = path.join(countyDir, file);
      const yearData = fs.readJsonSync(filePath);
      
      // Check for required data structure
      if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0] ||
          !yearData.data.timelines[0].intervals) {
        console.log(`File ${file} has invalid data structure, skipping`);
        return;
      }
      
      const intervals = yearData.data.timelines[0].intervals;
      console.log(`File contains ${intervals.length} days of data`);
      
      // Process this year's data
      processYearData(intervals, year, processedMetrics);
      processedCount++;
      
    } catch (error) {
      console.error(`Error processing file ${file}:`, error.message);
    }
  });
  
  if (processedCount === 0) {
    console.error('No files were successfully processed');
    return false;
  }
  
  // Save processed metrics
  const outputPath = path.join(countyDir, 'simple_processed_metrics.json');
  console.log(`Saving processed metrics to: ${outputPath}`);
  
  try {
    fs.writeJsonSync(outputPath, processedMetrics, { spaces: 2 });
    console.log('Metrics saved successfully!');
    return true;
  } catch (error) {
    console.error('Error saving metrics file:', error.message);
    return false;
  }
}

// Process daily weather data for a specific year
function processYearData(intervals, year, metrics) {
  // Initialize year metrics
  metrics.droughtMetrics[year] = { 
    totalDroughtDays: 0,
    longestDroughtStreak: 0,
    droughtStreaks: [] 
  };
  
  metrics.excessRainMetrics[year] = {
    daysAbove1Inch: 0,
    daysAbove2Inches: 0,
    daysAbove3Inches: 0,
    maxDailyRainfall: 0
  };
  
  metrics.heatStressMetrics[year] = {
    daysAbove90F: 0,
    daysAbove95F: 0,
    daysAbove100F: 0,
    longestHeatStreak: 0,
    heatStreaks: []
  };
  
  // Calculate metrics
  let currentDroughtStreak = 0;
  let currentHeatStreak = 0;
  
  intervals.forEach(day => {
    if (!day.values) return;
    
    const values = day.values;
    
    // Drought calculation (consecutive days below precipitation threshold)
    if (values.precipitationIntensity < 0.1) {
      currentDroughtStreak++;
      metrics.droughtMetrics[year].totalDroughtDays++;
    } else {
      // End of drought streak
      if (currentDroughtStreak > 0) {
        metrics.droughtMetrics[year].droughtStreaks.push(currentDroughtStreak);
        metrics.droughtMetrics[year].longestDroughtStreak = Math.max(
          metrics.droughtMetrics[year].longestDroughtStreak,
          currentDroughtStreak
        );
      }
      currentDroughtStreak = 0;
    }
    
    // Excessive rain
    const rainfall = values.precipitationIntensity || 0;
    if (rainfall >= 1) metrics.excessRainMetrics[year].daysAbove1Inch++;
    if (rainfall >= 2) metrics.excessRainMetrics[year].daysAbove2Inches++;
    if (rainfall >= 3) metrics.excessRainMetrics[year].daysAbove3Inches++;
    metrics.excessRainMetrics[year].maxDailyRainfall = Math.max(
      metrics.excessRainMetrics[year].maxDailyRainfall,
      rainfall
    );
    
    // Heat wave calculation
    const maxTemp = values.temperatureMax || 0;
    if (maxTemp >= 90) {
      currentHeatStreak++;
      metrics.heatStressMetrics[year].daysAbove90F++;
    } else {
      if (currentHeatStreak > 0) {
        metrics.heatStressMetrics[year].heatStreaks.push(currentHeatStreak);
        metrics.heatStressMetrics[year].longestHeatStreak = Math.max(
          metrics.heatStressMetrics[year].longestHeatStreak,
          currentHeatStreak
        );
      }
      currentHeatStreak = 0;
    }
    
    if (maxTemp >= 95) metrics.heatStressMetrics[year].daysAbove95F++;
    if (maxTemp >= 100) metrics.heatStressMetrics[year].daysAbove100F++;
  });
  
  // Check for ongoing streaks at the end of the data
  if (currentDroughtStreak > 0) {
    metrics.droughtMetrics[year].droughtStreaks.push(currentDroughtStreak);
    metrics.droughtMetrics[year].longestDroughtStreak = Math.max(
      metrics.droughtMetrics[year].longestDroughtStreak,
      currentDroughtStreak
    );
  }
  
  if (currentHeatStreak > 0) {
    metrics.heatStressMetrics[year].heatStreaks.push(currentHeatStreak);
    metrics.heatStressMetrics[year].longestHeatStreak = Math.max(
      metrics.heatStressMetrics[year].longestHeatStreak,
      currentHeatStreak
    );
  }
  
  console.log(`Year ${year} processed. Drought days: ${metrics.droughtMetrics[year].totalDroughtDays}, ` +
    `Longest drought: ${metrics.droughtMetrics[year].longestDroughtStreak}, ` +
    `Max rainfall: ${metrics.excessRainMetrics[year].maxDailyRainfall.toFixed(3)} inches`);
}

// Run for a single county
const countyName = process.argv[2] || "Daviess"; // Default to Daviess County
processSingleCounty(countyName);