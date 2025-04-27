// scripts/submit-to-sepolia.js
const { ethers } = require("hardhat");
require('dotenv').config();

// Replace with your deployed contract address
const STORAGE_CONTRACT_ADDRESS = "0xCdB810eD073e2B40aB6141f45F7C1680E335f3DA";

async function main() {
  console.log("Submitting weather data to Sepolia...");
  
  // For ethers v6
  // Use the provider and signer from hardhat directly
  const [signer] = await ethers.getSigners();
  
  // Connect to the contract - ethers v6 style
  const abi = [
    "function storeWeatherData(uint256 countyId, uint256 timestamp, uint8 eventType, uint256 measurement)"
  ];
  const storageContract = new ethers.Contract(STORAGE_CONTRACT_ADDRESS, abi, signer);
  
  // Example weather data
  const countyId = 0; // Christian County
  const timestamp = Math.floor(Date.now() / 1000); // Current timestamp
  const eventType = 0; // Drought
  const measurement = 14; // Extreme drought level
  
  console.log("Storing weather data on Sepolia...");
  console.log(`Data: County ${countyId}, Timestamp ${timestamp}, Event ${eventType}, Measurement ${measurement}`);
  
  // Store the data
  const tx = await storageContract.storeWeatherData(
    countyId,
    timestamp,
    eventType,
    measurement
  );
  
  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log("Weather data stored successfully!");
  
  return tx.hash; // Return the transaction hash for FDC verification
}

main()
  .then((txHash) => {
    console.log(`Use this transaction hash for FDC attestation: ${txHash}`);
    process.exit(0);
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });