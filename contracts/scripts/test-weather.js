// scripts/test-weather.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
  const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
  
  console.log("Testing weather data submission...");
  
  // Check contract balance
  const balance = await insurance.getContractBalance();
  console.log(`Contract balance: ${ethers.formatEther(balance)} FLR`);
  
  // Submit test weather data for Christian County (0)
  // Drought event (0) with extreme level (14 days without rain)
  const tx = await insurance.testSubmitWeatherData(0, 0, 14);
  
  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log("Weather data submitted successfully!");
  
  // Check if a payout was created
  const payoutCounter = await insurance.payoutCounter();
  console.log(`Number of payouts: ${payoutCounter}`);
  
  if (payoutCounter > 0) {
    const payoutRecord = await insurance.payoutRecords(1);
    console.log("Payout details:");
    console.log(`- Policy ID: ${payoutRecord[0]}`);
    console.log(`- Amount: ${ethers.formatEther(payoutRecord[1])} FLR`);
    console.log(`- Event Type: ${payoutRecord[2]}`);
    console.log(`- Severity: ${payoutRecord[3]}`);
  }
  
  // Check new contract balance
  const newBalance = await insurance.getContractBalance();
  console.log(`New contract balance: ${ethers.formatEther(newBalance)} FLR`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });