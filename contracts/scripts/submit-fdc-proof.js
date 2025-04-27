// scripts/submit-fdc-proof.js
const { ethers } = require("hardhat");
require('dotenv').config();

async function submitProofToContract(proofData) {
    // Connect to your insurance contract
    const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
    const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
    
    console.log("Submitting proof to insurance contract...");
    
    // No need for special formatting - the mock is already in the correct format
    // Submit the proof directly
    console.log("Submitting proof to contract...");
    const tx = await insurance.submitWeatherData(proofData);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    
    console.log("Proof submitted successfully!");
    
    // Check for new payouts
    const payoutCounter = await insurance.payoutCounter();
    console.log(`Total number of payouts: ${payoutCounter}`);
    
    return tx.hash;
  }

// If called directly
if (require.main === module) {
  if (process.argv.length < 3) {
    console.error("Please provide the proof data JSON file path");
    process.exit(1);
  }
  
  const proofPath = process.argv[2];
  const proofData = require(proofPath);
  
  submitProofToContract(proofData)
    .then(txHash => {
      console.log(`Proof submitted with transaction: ${txHash}`);
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
} else {
  module.exports = submitProofToContract;
}