// scripts/store-weather-data.js
const { ethers } = require("hardhat");

// Replace with your deployed contract address
const STORAGE_CONTRACT_ADDRESS = "0xCdB810eD073e2B40aB6141f45F7C1680E335f3DA";

async function main() {
  // Connect to the contract
  const WeatherDataStorage = await ethers.getContractFactory("WeatherDataStorage");
  const storage = WeatherDataStorage.attach(STORAGE_CONTRACT_ADDRESS);
  
  console.log("Storing weather data on Sepolia...");
  
  // Example weather data
  const countyId = 0; // Christian County
  const timestamp = Math.floor(Date.now() / 1000); // Current timestamp
  const eventType = 0; // Drought
  const measurement = 14; // Extreme drought level
  
  // Store the data
  const tx = await storage.storeWeatherData(
    countyId,
    timestamp,
    eventType,
    measurement
  );
  
  console.log(`Transaction hash: ${tx.hash}`);
  await tx.wait();
  console.log("Weather data stored successfully!");
  console.log("Use this transaction hash for FDC attestation:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });