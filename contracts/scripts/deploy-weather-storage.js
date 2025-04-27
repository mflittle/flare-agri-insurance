// scripts/deploy-weather-storage.js
const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying WeatherDataStorage to Sepolia...");
  
  // Get the account that will deploy the contract
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Deploy the contract
  const WeatherDataStorage = await ethers.getContractFactory("WeatherDataStorage");
  const storage = await WeatherDataStorage.deploy();
  
  await storage.waitForDeployment();
  const storageAddress = await storage.getAddress();
  
  console.log("WeatherDataStorage deployed to:", storageAddress);
  console.log("Keep this address for your FDC integration!");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });