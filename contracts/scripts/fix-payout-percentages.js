// scripts/fix-payout-percentages.js
const { ethers } = require("hardhat");

async function main() {
  const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
  const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
  
  console.log("Updating payout percentages...");
  
  // Multiply current percentages by 100 to get the correct values
  const tx = await insurance.setPayoutPercentages(
    3000,  // 30% for moderate (stored as 3000)
    6000,  // 60% for severe (stored as 6000)
    10000  // 100% for extreme (stored as 10000)
  );
  
  await tx.wait();
  console.log("Payout percentages updated successfully!");
  
  // Verify the new values
  const moderatePercent = await insurance.moderatePayoutPercent();
  const severePercent = await insurance.severePayoutPercent();
  const extremePercent = await insurance.extremePayoutPercent();
  
  console.log("\nNew payout percentages:");
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