// scripts/check-policy.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
  const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
  
  // Get policy details
  const policyId = 1;
  const policyDetails = await insurance.getPolicyDetails(policyId);
  
  console.log("Policy details:");
  console.log(`- Farmer: ${policyDetails[0]}`);
  console.log(`- County: ${policyDetails[1]}`);
  console.log(`- Coverage per acre: ${policyDetails[2]} (raw value)`);
  console.log(`- Coverage per acre: $${Number(policyDetails[2]) / 100} (formatted)`);
  console.log(`- Acres: ${policyDetails[3]}`);
  console.log(`- Start time: ${new Date(Number(policyDetails[4]) * 1000).toLocaleString()}`);
  console.log(`- End time: ${new Date(Number(policyDetails[5]) * 1000).toLocaleString()}`);
  console.log(`- Active: ${policyDetails[6]}`);
  console.log(`- Covered events: ${policyDetails[7]}`);
  
  // Check payout percentages
  const moderatePercent = await insurance.moderatePayoutPercent();
  const severePercent = await insurance.severePayoutPercent();
  const extremePercent = await insurance.extremePayoutPercent();
  
  console.log("\nPayout percentages:");
  console.log(`- Moderate: ${Number(moderatePercent) / 100}%`);
  console.log(`- Severe: ${Number(severePercent) / 100}%`);
  console.log(`- Extreme: ${Number(extremePercent) / 100}%`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });