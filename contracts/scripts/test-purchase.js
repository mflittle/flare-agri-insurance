// scripts/test-purchase.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
  const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
  
  console.log("Testing policy purchase...");
  
  // Example policy parameters
  const countyId = 0; // Christian County
  const acres = 100;
  const coveragePerAcre = 30000; // $300.00
  const months = 1;
  const coveredEvents = [true, false, true, false, false]; // Drought and HeatStress
  
  // Calculate premium
  const premium = await insurance.calculatePremium(coveragePerAcre, acres, months, coveredEvents);
  console.log(`Premium: ${ethers.formatEther(premium)} FLR`);
  
  // Purchase policy
  const tx = await insurance.purchasePolicy(
    countyId,
    acres,
    coveragePerAcre,
    months,
    coveredEvents,
    { value: premium }
  );
  
  console.log(`Transaction hash: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log("Policy purchased successfully!");
  
  // Get policy details
  const policyId = 1; // First policy
  const policyDetails = await insurance.getPolicyDetails(policyId);
  console.log("Policy details:");
  console.log(`- Farmer: ${policyDetails[0]}`); // Using array indices instead of property names
  console.log(`- County: ${policyDetails[1]}`);
  console.log(`- Coverage: $${Number(policyDetails[2]) / 100} per acre`);
  console.log(`- Acres: ${policyDetails[3]}`);
  console.log(`- Active: ${policyDetails[6]}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });