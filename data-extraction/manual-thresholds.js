const fs = require('fs-extra');
const path = require('path');

// Our selected counties based on data quality assessment
const selectedCounties = [
  { name: "Christian", index: 0 },
  { name: "Union", index: 2 },
  { name: "Todd", index: 3 },
  { name: "Henderson", index: 5 },
  { name: "Daviess", index: 6 },
  { name: "Warren", index: 8 }
];

// Create realistic thresholds based on agricultural research for Kentucky
function generateRealisticThresholds() {
  console.log('Generating realistic agricultural insurance thresholds for Kentucky counties...');
  
  const thresholds = {
    generatedAt: new Date().toISOString(),
    counties: {}
  };
  
  // Set region-specific baseline thresholds with variation between counties
  selectedCounties.forEach((county, idx) => {
    // Add some variation between counties (±15%)
    const variationFactor = 0.85 + (idx * 0.06);
    
    thresholds.counties[county.name] = {
      countyIndex: county.index,
      thresholds: {
        // Drought thresholds (consecutive days with minimal precipitation)
        drought: {
          eventType: 0,
          moderate: Math.round(10 * variationFactor), // ~7-14 days
          severe: Math.round(14 * variationFactor),   // ~12-18 days
          extreme: Math.round(21 * variationFactor)   // ~18-28 days
        },
        
        // Heat wave thresholds (consecutive days above 90°F)
        heatWave: {
          eventType: 3,
          moderate: Math.round(5 * variationFactor),  // ~4-7 days
          severe: Math.round(7 * variationFactor),    // ~6-10 days
          extreme: Math.round(10 * variationFactor)   // ~8-13 days
        },
        
        // Excessive rain thresholds (inches in 24 hours)
        excessiveRain: {
          eventType: 1,
          moderate: parseFloat((2.0 * variationFactor).toFixed(1)), // ~1.7-2.6 inches
          severe: parseFloat((3.5 * variationFactor).toFixed(1)),   // ~3.0-4.5 inches
          extreme: parseFloat((5.0 * variationFactor).toFixed(1))   // ~4.3-6.5 inches
        },
        
        // Wind thresholds (sustained mph)
        wind: {
          eventType: 4,
          moderate: parseFloat((25 * variationFactor).toFixed(1)), // ~21-32 mph
          severe: parseFloat((35 * variationFactor).toFixed(1)),   // ~30-45 mph
          extreme: parseFloat((45 * variationFactor).toFixed(1))   // ~38-58 mph
        }
      }
    };
  });
  
  // Add crop-specific adjustment factors based on county agricultural profiles
  // Christian County - Major corn producer (more sensitive to drought)
  thresholds.counties["Christian"].thresholds.drought.moderate -= 1;
  thresholds.counties["Christian"].thresholds.drought.severe -= 1;
  thresholds.counties["Christian"].thresholds.drought.extreme -= 2;
  
  // Todd County - Tobacco producer (more sensitive to excessive rain)
  thresholds.counties["Todd"].thresholds.excessiveRain.moderate -= 0.2;
  thresholds.counties["Todd"].thresholds.excessiveRain.severe -= 0.3;
  
  // Daviess County - Grain crops (more sensitive to wind)
  thresholds.counties["Daviess"].thresholds.wind.moderate -= 2;
  thresholds.counties["Daviess"].thresholds.wind.severe -= 3;
  
  // Henderson County - Soybean producer (more sensitive to heat)
  thresholds.counties["Henderson"].thresholds.heatWave.moderate -= 1;
  thresholds.counties["Henderson"].thresholds.heatWave.severe -= 1;
  
  // Save the realistic thresholds
  const dataDir = path.join(process.cwd(), 'data');
  fs.ensureDirSync(dataDir);
  
  const outputPath = path.join(dataDir, 'realistic_contract_parameters.json');
  fs.writeJsonSync(outputPath, thresholds, { spaces: 2 });
  
  console.log(`Realistic thresholds saved to ${outputPath}`);
  return thresholds;
}

// Generate premium calculations based on thresholds
function generatePremiumStructure(thresholds) {
  console.log('Generating premium structure based on thresholds...');
  
  const premiumStructure = {
    generatedAt: new Date().toISOString(),
    baseAnnualRate: 0.025, // 2.5% of coverage amount as base rate
    counties: {}
  };
  
  // Calculate premiums for each county and coverage level
  Object.keys(thresholds.counties).forEach(countyName => {
    const county = thresholds.counties[countyName];
    
    premiumStructure.counties[countyName] = {
      countyIndex: county.countyIndex,
      countyRiskMultiplier: 1.0, // Default multiplier
      coverageLevels: {
        moderate: {
          droughtPremiumFactor: calculatePremiumFactor(county.thresholds.drought.moderate, 'drought', 'moderate'),
          heatWavePremiumFactor: calculatePremiumFactor(county.thresholds.heatWave.moderate, 'heatWave', 'moderate'),
          excessiveRainPremiumFactor: calculatePremiumFactor(county.thresholds.excessiveRain.moderate, 'excessiveRain', 'moderate'),
          windPremiumFactor: calculatePremiumFactor(county.thresholds.wind.moderate, 'wind', 'moderate')
        },
        severe: {
          droughtPremiumFactor: calculatePremiumFactor(county.thresholds.drought.severe, 'drought', 'severe'),
          heatWavePremiumFactor: calculatePremiumFactor(county.thresholds.heatWave.severe, 'heatWave', 'severe'),
          excessiveRainPremiumFactor: calculatePremiumFactor(county.thresholds.excessiveRain.severe, 'excessiveRain', 'severe'),
          windPremiumFactor: calculatePremiumFactor(county.thresholds.wind.severe, 'wind', 'severe')
        },
        extreme: {
          droughtPremiumFactor: calculatePremiumFactor(county.thresholds.drought.extreme, 'drought', 'extreme'),
          heatWavePremiumFactor: calculatePremiumFactor(county.thresholds.heatWave.extreme, 'heatWave', 'extreme'),
          excessiveRainPremiumFactor: calculatePremiumFactor(county.thresholds.excessiveRain.extreme, 'excessiveRain', 'extreme'),
          windPremiumFactor: calculatePremiumFactor(county.thresholds.wind.extreme, 'wind', 'extreme')
        }
      }
    };
    
    // Adjust county risk multiplier based on historical risk profiles
    // These would normally be based on historical loss ratios
    switch(countyName) {
      case "Christian":
        premiumStructure.counties[countyName].countyRiskMultiplier = 1.15; // Higher risk
        break;
      case "Daviess":
        premiumStructure.counties[countyName].countyRiskMultiplier = 0.90; // Lower risk
        break;
      case "Warren":
        premiumStructure.counties[countyName].countyRiskMultiplier = 1.05; // Slightly higher risk
        break;
      default:
        // Keep default multiplier
    }
  });
  
  // Save the premium structure
  const dataDir = path.join(process.cwd(), 'data');
  const outputPath = path.join(dataDir, 'premium_structure.json');
  fs.writeJsonSync(outputPath, premiumStructure, { spaces: 2 });
  
  console.log(`Premium structure saved to ${outputPath}`);
  return premiumStructure;
}

// Helper function to calculate premium factors based on event type and severity
function calculatePremiumFactor(threshold, eventType, severity) {
  // Base premium factors by event type
  const baseFactors = {
    drought: 1.2,
    heatWave: 1.0,
    excessiveRain: 1.3,
    wind: 1.1
  };
  
  // Severity multipliers
  const severityMultipliers = {
    moderate: 0.6,
    severe: 1.0,
    extreme: 1.5
  };
  
  // Calculate inverse relationship with threshold
  // Lower thresholds = higher premiums (higher risk)
  let thresholdFactor;
  
  switch(eventType) {
    case 'drought':
      thresholdFactor = 15 / (threshold + 5); // Inverse relationship
      break;
    case 'heatWave':
      thresholdFactor = 8 / (threshold + 3);
      break;
    case 'excessiveRain':
      thresholdFactor = 3 / (threshold + 1);
      break;
    case 'wind':
      thresholdFactor = 30 / (threshold + 10);
      break;
    default:
      thresholdFactor = 1.0;
  }
  
  // Combine factors and normalize to a reasonable range (0.2 to 2.0)
  const rawFactor = baseFactors[eventType] * severityMultipliers[severity] * thresholdFactor;
  
  // Ensure premium factors are within reasonable bounds
  return Math.min(Math.max(rawFactor, 0.2), 2.0).toFixed(3);
}

// Generate example contract parameters for the smart contract
function generateContractExamples(thresholds, premiumStructure) {
  console.log('Generating example contract parameters for smart contract testing...');
  
  const examples = {
    generatedAt: new Date().toISOString(),
    description: "Example parameters for agricultural insurance smart contracts",
    contracts: []
  };
  
  // Generate example contracts for different counties and event types
  const counties = Object.keys(thresholds.counties);
  const eventTypes = ["drought", "heatWave", "excessiveRain", "wind"];
  const severityLevels = ["moderate", "severe", "extreme"];
  
  // Generate a variety of example contracts
  counties.forEach(county => {
    eventTypes.forEach(eventType => {
      severityLevels.forEach(severity => {
        // Skip some combinations to keep the examples list manageable
        if (Math.random() < 0.7) return;
        
        // Get threshold value for this combination
        const threshold = thresholds.counties[county].thresholds[eventType][severity];
        
        // Get premium factor
        const premiumFactor = premiumStructure.counties[county].coverageLevels[severity][`${eventType}PremiumFactor`];
        
        // Calculate example premium and coverage
        const coverageAmount = Math.round((10000 + Math.random() * 90000) / 1000) * 1000; // Random amount between $10K-$100K, rounded to nearest $1000
        const annualPremium = (coverageAmount * premiumStructure.baseAnnualRate * premiumFactor * 
                              premiumStructure.counties[county].countyRiskMultiplier).toFixed(2);
        
        // Create example contract
        examples.contracts.push({
          county: county,
          countyIndex: thresholds.counties[county].countyIndex,
          eventType: eventType,
          eventTypeIndex: thresholds.counties[county].thresholds[eventType].eventType,
          severity: severity,
          threshold: threshold,
          coverageAmount: coverageAmount,
          annualPremium: parseFloat(annualPremium),
          premiumFactor: parseFloat(premiumFactor)
        });
      });
    });
  });
  
  // Save the example contracts
  const dataDir = path.join(process.cwd(), 'data');
  const outputPath = path.join(dataDir, 'contract_examples.json');
  fs.writeJsonSync(outputPath, examples, { spaces: 2 });
  
  console.log(`Contract examples saved to ${outputPath}`);
  console.log(`Generated ${examples.contracts.length} example contracts`);
  return examples;
}

// Main function to run everything
async function main() {
  try {
    // Generate realistic thresholds
    const thresholds = generateRealisticThresholds();
    
    // Generate premium structure
    const premiumStructure = generatePremiumStructure(thresholds);
    
    // Generate example contracts
    generateContractExamples(thresholds, premiumStructure);
    
    console.log('\nAll files generated successfully!');
  } catch (error) {
    console.error('Error generating files:', error);
  }
}

// Run the script
main();