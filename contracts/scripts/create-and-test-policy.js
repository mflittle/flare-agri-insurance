// scripts/create-and-test-policy.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
  const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
  
  console.log("Creating a new policy...");
  
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
  await tx.wait();
  console.log("Policy purchased successfully!");
  
  // Get policy counter
  const policyCounter = await insurance.policyCounter();
  console.log(`New policy ID: ${policyCounter}`);
  
  // Submit weather data to trigger a payout
  console.log("\nSubmitting weather data to trigger a payout...");
  const initialBalance = await insurance.getContractBalance();
  console.log(`Initial contract balance: ${ethers.formatEther(initialBalance)} FLR`);
  
  const weatherTx = await insurance.testSubmitWeatherData(countyId, 0, 14); // Drought with extreme severity
  await weatherTx.wait();
  console.log("Weather data submitted successfully!");
  
  // Check for payouts
  const payoutCounter = await insurance.payoutCounter();
  console.log(`Total number of payouts: ${payoutCounter}`);
  
  // Get the latest payout
  if (payoutCounter > 1) {
    const latestPayout = await insurance.payoutRecords(payoutCounter);
    console.log("\nLatest payout details:");
    console.log(`- Policy ID: ${latestPayout[0]}`);
    console.log(`- Amount: ${ethers.formatEther(latestPayout[1])} FLR`);
    console.log(`- Event Type: ${latestPayout[2]}`);
    console.log(`- Severity: ${latestPayout[3]}`);
  }
  
  // Check final balance
  const finalBalance = await insurance.getContractBalance();
  console.log(`Final contract balance: ${ethers.formatEther(finalBalance)} FLR`);
  console.log(`Balance change: ${ethers.formatEther(initialBalance - finalBalance)} FLR`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });