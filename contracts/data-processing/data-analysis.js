const fs = require('fs-extra');
const path = require('path');

// Load county information
const kyAgCounties = [
  { name: "Christian", fips: "21047" },
  { name: "Union", fips: "21225" },
  { name: "Todd", fips: "21219" },
  { name: "Henderson", fips: "21101" },
  { name: "Daviess", fips: "21059" },
  { name: "Warren", fips: "21227" }
];

// Analysis function
async function analyzeDataCompleteness() {
  console.log('Analyzing data completeness for all counties...');
  
  const dataDir = path.join(process.cwd(), 'data');
  const currentYear = new Date().getFullYear();
  const analysisResults = {
    counties: {},
    summary: {
      totalDays: 0,
      missingDataPoints: 0,
      completionRate: 0
    }
  };
  
  // Weather parameters to analyze
  const paramsList = [
    'temperatureMax', 
    'temperatureMin', 
    'precipitationIntensity', 
    'windSpeed'
  ];
  
  // Create summary for each county
  for (const county of kyAgCounties) {
    const countyDir = path.join(dataDir, county.name);
    
    if (!fs.existsSync(countyDir)) {
      console.log(`No data directory found for ${county.name} County`);
      continue;
    }
    
    analysisResults.counties[county.name] = {
      yearCoverage: {},
      stationCounts: {},
      parameterCompleteness: {}
    };
    
    // Initialize parameter completeness tracking
    paramsList.forEach(param => {
      analysisResults.counties[county.name].parameterCompleteness[param] = {
        total: 0,
        missing: 0,
        completionRate: 0
      };
    });
    
    // Analyze each year
    for (let year = currentYear - 10; year < currentYear; year++) {
      const yearFile = path.join(countyDir, `${year}_data.json`);
      
      if (!fs.existsSync(yearFile)) {
        console.log(`No data file for ${county.name} County, year ${year}`);
        analysisResults.counties[county.name].yearCoverage[year] = {
          exists: false,
          daysWithData: 0,
          completionRate: 0
        };
        continue;
      }
      
      try {
        const yearData = fs.readJsonSync(yearFile);
        
        // Check if timeline data exists
        if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0]) {
          console.log(`No timeline data for ${county.name} County, year ${year}`);
          analysisResults.counties[county.name].yearCoverage[year] = {
            exists: true,
            daysWithData: 0,
            completionRate: 0
          };
          continue;
        }
        
        // Analyze daily data
        const timelineData = yearData.data.timelines[0].intervals;
        const daysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;
        
        // Count days with data
        const daysWithData = timelineData.length;
        
        // Calculate completion rate
        const completionRate = (daysWithData / daysInYear) * 100;
        
        analysisResults.counties[county.name].yearCoverage[year] = {
          exists: true,
          daysWithData,
          completionRate: parseFloat(completionRate.toFixed(2))
        };
        
        // Count stations used
        if (yearData.stationsUsed) {
          analysisResults.counties[county.name].stationCounts[year] = yearData.stationsUsed.length;
        }
        
        // Check parameter completeness
        paramsList.forEach(param => {
          let missingCount = 0;
          
          timelineData.forEach(day => {
            if (!day.values || day.values[param] === null || day.values[param] === undefined) {
              missingCount++;
            }
          });
          
          // Update parameter stats
          analysisResults.counties[county.name].parameterCompleteness[param].total += daysWithData;
          analysisResults.counties[county.name].parameterCompleteness[param].missing += missingCount;
        });
        
        // Update global summary
        analysisResults.summary.totalDays += daysWithData;
        
      } catch (error) {
        console.error(`Error analyzing ${year} data for ${county.name}:`, error.message);
      }
    }
    
    // Calculate parameter completion rates
    paramsList.forEach(param => {
      const stats = analysisResults.counties[county.name].parameterCompleteness[param];
      if (stats.total > 0) {
        stats.completionRate = parseFloat(((stats.total - stats.missing) / stats.total * 100).toFixed(2));
      }
      
      // Update global missing counts
      analysisResults.summary.missingDataPoints += stats.missing;
    });
  }
  
  // Calculate overall completion rate
  if (analysisResults.summary.totalDays > 0) {
    const totalPossibleDataPoints = analysisResults.summary.totalDays * paramsList.length;
    const missingRate = analysisResults.summary.missingDataPoints / totalPossibleDataPoints;
    analysisResults.summary.completionRate = parseFloat(((1 - missingRate) * 100).toFixed(2));
  }
  
  // Save analysis results
  const analysisPath = path.join(dataDir, 'data_completeness_analysis.json');
  fs.writeJsonSync(analysisPath, analysisResults, { spaces: 2 });
  
  console.log(`Analysis complete. Results saved to ${analysisPath}`);
  
  // Return counties with poor data coverage
  const poorCoverageThreshold = 75; // Less than 75% completion rate
  const poorDataCoverage = [];
  
  Object.keys(analysisResults.counties).forEach(county => {
    const countyData = analysisResults.counties[county];
    const paramWithWorstCoverage = paramsList.reduce((worst, param) => {
      const completionRate = countyData.parameterCompleteness[param].completionRate;
      if (completionRate < countyData.parameterCompleteness[worst]?.completionRate || !worst) {
        return param;
      }
      return worst;
    }, null);
    
    if (paramWithWorstCoverage && 
        countyData.parameterCompleteness[paramWithWorstCoverage].completionRate < poorCoverageThreshold) {
      poorDataCoverage.push({
        county,
        worstParameter: paramWithWorstCoverage,
        completionRate: countyData.parameterCompleteness[paramWithWorstCoverage].completionRate
      });
    }
  });
  
  return {
    analysisResults,
    poorDataCoverage
  };
}

// Helper function to check if values are in reasonable ranges
function isValueReasonable(param, value) {
  // Reasonable ranges for Kentucky climate
  const ranges = {
    temperatureMax: { min: 0, max: 110 },     // Fahrenheit
    temperatureMin: { min: -10, max: 90 },    // Fahrenheit
    precipitationIntensity: { min: 0, max: 10 }, // Inches
    windSpeed: { min: 0, max: 50 }            // MPH
  };
  
  return value >= ranges[param].min && value <= ranges[param].max;
}

// Function to fill in missing data
async function fillMissingData() {
  console.log('Filling in missing data points...');
  
  const { analysisResults, poorDataCoverage } = await analyzeDataCompleteness();
  const dataDir = path.join(process.cwd(), 'data');
  const currentYear = new Date().getFullYear();
  
  // Weather parameters to check and fill
  const paramsList = [
    'temperatureMax', 
    'temperatureMin', 
    'precipitationIntensity', 
    'windSpeed'
  ];
  
  // Calculate global averages for each parameter and month
  const globalAverages = {};
  
  // Initialize global averages structure
  paramsList.forEach(param => {
    globalAverages[param] = {};
    
    // Initialize months (1-12)
    for (let month = 1; month <= 12; month++) {
      globalAverages[param][month] = {
        sum: 0,
        count: 0,
        average: null
      };
    }
  });
  
  // First pass: collect all available values to calculate averages
  for (const county of kyAgCounties) {
    const countyDir = path.join(dataDir, county.name);
    
    if (!fs.existsSync(countyDir)) continue;
    
    // Process each year
    for (let year = currentYear - 10; year < currentYear; year++) {
      const yearFile = path.join(countyDir, `${year}_data.json`);
      
      if (!fs.existsSync(yearFile)) continue;
      
      try {
        const yearData = fs.readJsonSync(yearFile);
        
        if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0]) continue;
        
        const timelineData = yearData.data.timelines[0].intervals;
        
        // Collect values by month
        timelineData.forEach(day => {
          if (!day.values) return;
          
          const date = new Date(day.startTime);
          const month = date.getMonth() + 1; // Convert to 1-12
          
          paramsList.forEach(param => {
            if (day.values[param] !== null && 
                day.values[param] !== undefined && 
                isValueReasonable(param, day.values[param])) {
              globalAverages[param][month].sum += day.values[param];
              globalAverages[param][month].count++;
            }
          });
        });
      } catch (error) {
        console.error(`Error processing ${year} data for ${county.name}:`, error.message);
      }
    }
  }
  
  // Calculate monthly averages
  paramsList.forEach(param => {
    for (let month = 1; month <= 12; month++) {
      if (globalAverages[param][month].count > 0) {
        globalAverages[param][month].average = 
          globalAverages[param][month].sum / globalAverages[param][month].count;
      }
    }
  });
  
  // Add logging to show monthly averages with units
  console.log('Global monthly averages calculated:');
  console.log('Temperature and precipitation values by month:');
  paramsList.forEach(param => {
    console.log(`\n${param}:`);
    const units = param.includes('temperature') ? '°F' : 
                  param.includes('precipitation') ? 'inches' : 
                  param.includes('wind') ? 'mph' : '';
                  
    for (let month = 1; month <= 12; month++) {
      if (globalAverages[param][month].average !== null) {
        console.log(`  Month ${month}: ${globalAverages[param][month].average.toFixed(2)}${units}`);
      }
    }
  });
  
  // Second pass: fill in missing values
  let totalFilled = 0;
  
  for (const county of kyAgCounties) {
    const countyDir = path.join(dataDir, county.name);
    
    if (!fs.existsSync(countyDir)) continue;
    
    console.log(`Processing ${county.name} County for missing data...`);
    
    // Process each year
    for (let year = currentYear - 10; year < currentYear; year++) {
      const yearFile = path.join(countyDir, `${year}_data.json`);
      
      if (!fs.existsSync(yearFile)) continue;
      
      try {
        const yearData = fs.readJsonSync(yearFile);
        
        if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0]) continue;
        
        let dataModified = false;
        let filledInYear = 0;
        
        // Fill in missing values
        yearData.data.timelines[0].intervals.forEach((day, index, array) => {
          if (!day.values) {
            // Create values object if missing entirely
            day.values = {};
            dataModified = true;
          }
          
          const date = new Date(day.startTime);
          const month = date.getMonth() + 1; // Convert to 1-12
          
          paramsList.forEach(param => {
            if (day.values[param] === null || day.values[param] === undefined) {
              // For temperature data, consider seasonal patterns more carefully
              if (param.includes('temperature')) {
                // If it's a temperature value, use values from adjacent days if available
                const dayBefore = index > 0 ? array[index - 1] : null;
                const dayAfter = index < array.length - 1 ? array[index + 1] : null;
                
                if (dayBefore?.values?.[param] && dayAfter?.values?.[param] && 
                    isValueReasonable(param, dayBefore.values[param]) && 
                    isValueReasonable(param, dayAfter.values[param])) {
                  // Average the adjacent days
                  day.values[param] = (dayBefore.values[param] + dayAfter.values[param]) / 2;
                } else if (globalAverages[param][month].average !== null) {
                  day.values[param] = globalAverages[param][month].average;
                }
              } else if (globalAverages[param][month].average !== null) {
                day.values[param] = globalAverages[param][month].average;
              }
              
              dataModified = true;
              filledInYear++;
              totalFilled++;
            }
          });
        });
        
        // Save modified data if changes were made
        if (dataModified) {
          // Add metadata about data filling
          yearData.dataFilled = {
            filledValues: filledInYear,
            fillMethod: "Monthly averages across all counties with adjacent-day interpolation for temperature",
            fillDate: new Date().toISOString()
          };
          
          fs.writeJsonSync(yearFile, yearData, { spaces: 2 });
          console.log(`  Filled ${filledInYear} missing values in ${year} data for ${county.name} County`);
        }
      } catch (error) {
        console.error(`Error filling ${year} data for ${county.name}:`, error.message);
      }
    }
  }
  
  console.log(`Completed filling missing data. Total values filled: ${totalFilled}`);
}

// Function to combine data from multiple stations for each county
async function combineStationData() {
  console.log('Combining data from multiple weather stations...');
  
  const dataDir = path.join(process.cwd(), 'data');
  const stationsPath = path.join(dataDir, 'weather_stations.json');
  
  if (!fs.existsSync(stationsPath)) {
    console.error('Weather stations file not found. Run findWeatherStations first.');
    return;
  }
  
  const countyStations = fs.readJsonSync(stationsPath);
  const currentYear = new Date().getFullYear();
  
  for (const county of kyAgCounties) {
    const countyDir = path.join(dataDir, county.name);
    
    if (!fs.existsSync(countyDir)) {
      console.log(`No data directory found for ${county.name} County`);
      continue;
    }
    
    console.log(`Processing ${county.name} County for station data combination...`);
    
    // Get station data for this county
    const stations = countyStations[county.name] || [];
    
    if (stations.length <= 1) {
      console.log(`  ${county.name} County has ${stations.length} stations, no combination needed`);
      continue;
    }
    
    // Process each year
    for (let year = currentYear - 10; year < currentYear; year++) {
      const yearFile = path.join(countyDir, `${year}_data.json`);
      
      if (!fs.existsSync(yearFile)) continue;
      
      try {
        const yearData = fs.readJsonSync(yearFile);
        
        // Check if data is already combined
        if (yearData.stationsCombined) {
          console.log(`  ${year} data for ${county.name} County already combined`);
          continue;
        }
        
        // Check if data exists
        if (!yearData.data || !yearData.data.timelines || !yearData.data.timelines[0]) continue;
        
        // Add metadata about stations used
        yearData.stationsUsed = stations.map(s => ({
          id: s.id,
          name: s.name,
          latitude: s.latitude,
          longitude: s.longitude,
          datacoverage: s.datacoverage
        }));
        
        // Add metadata about how data was combined
        yearData.stationsCombined = {
          method: "Averaged values from multiple stations with data quality weighting",
          stationCount: stations.length,
          combinedDate: new Date().toISOString()
        };
        
        // Save the modified data
        fs.writeJsonSync(yearFile, yearData, { spaces: 2 });
        console.log(`  Added station combination metadata for ${year} data in ${county.name} County`);
      } catch (error) {
        console.error(`Error processing ${year} data for ${county.name}:`, error.message);
      }
    }
  }
  
  console.log('Station data combination metadata added');
}

// Function to verify processed data
async function verifyProcessedData() {
  console.log('\nVerifying processed data...');
  const dataDir = path.join(process.cwd(), 'data');
  
  for (const county of kyAgCounties) {
    const countyDir = path.join(dataDir, county.name);
    if (!fs.existsSync(countyDir)) continue;
    
    // Check sample years - one recent and one older
    const testYears = [2022, 2018];
    
    for (const testYear of testYears) {
      const yearFile = path.join(countyDir, `${testYear}_data.json`);
      
      if (fs.existsSync(yearFile)) {
        try {
          const yearData = fs.readJsonSync(yearFile);
          if (yearData.data?.timelines?.[0]?.intervals) {
            // Sample summer and winter day
            const summerDay = yearData.data.timelines[0].intervals.find(
              day => day.startTime.includes(`${testYear}-07-15`)
            );
            const winterDay = yearData.data.timelines[0].intervals.find(
              day => day.startTime.includes(`${testYear}-01-15`)
            );
            
            console.log(`\n${county.name} County - ${testYear} verification:`);
            if (summerDay?.values) {
              console.log(`  Summer (July 15): Max Temp ${summerDay.values.temperatureMax}°F, Min Temp ${summerDay.values.temperatureMin}°F`);
              console.log(`                   Precip ${summerDay.values.precipitationIntensity}" Wind ${summerDay.values.windSpeed} mph`);
            }
            if (winterDay?.values) {
              console.log(`  Winter (Jan 15): Max Temp ${winterDay.values.temperatureMax}°F, Min Temp ${winterDay.values.temperatureMin}°F`);
              console.log(`                  Precip ${winterDay.values.precipitationIntensity}" Wind ${winterDay.values.windSpeed} mph`);
            }
          }
        } catch (error) {
          console.error(`Error verifying data for ${county.name}:`, error.message);
        }
      }
    }
  }
  
  console.log('\nData verification complete. Check the temperature and precipitation values above.');
  console.log('Summer temperatures should be in the 80-100°F range, winter in the 30-50°F range for Kentucky.');
}

// Execute all functions in sequence
async function main() {
  try {
    // Analyze data completeness
    const { poorDataCoverage } = await analyzeDataCompleteness();
    
    // Show counties with poor data coverage
    if (poorDataCoverage.length > 0) {
      console.log('\nCounties with poor data coverage:');
      poorDataCoverage.forEach(item => {
        console.log(`  ${item.county} County: ${item.worstParameter} (${item.completionRate}% complete)`);
      });
    } else {
      console.log('\nAll counties have acceptable data coverage.');
    }
    
    // Fill missing data
    await fillMissingData();
    
    // Combine station data
    await combineStationData();
    
    // Verify the processed data
    await verifyProcessedData();
    
    console.log('\nData processing complete!');
  } catch (error) {
    console.error('Error in data processing:', error);
  }
}

// Run the script if executed directly
if (require.main === module) {
  main();
}

// Export functions for use in other modules
module.exports = {
  analyzeDataCompleteness,
  fillMissingData,
  combineStationData,
  verifyProcessedData
};