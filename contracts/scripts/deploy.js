const hre = require("hardhat");

async function main() {
  console.log("Deploying Agricultural Weather Insurance to Coston2...");
  
  // Get the account that will deploy the contract
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  
  // Set your treasury address (can be the same as deployer for testing)
  const treasuryAddress = deployer.address;
  
  // Deploy the contract
  const AgriculturalWeatherInsurance = await hre.ethers.getContractFactory("AgriculturalWeatherInsurance");
  const insurance = await AgriculturalWeatherInsurance.deploy(treasuryAddress);

  console.log("Waiting for deployment transaction to be mined...");
  await insurance.waitForDeployment();
  
  const contractAddress = await insurance.getAddress();
  console.log("Agricultural Weather Insurance deployed to:", contractAddress);
  
  // Fund the contract for claims
  console.log("Funding contract for claim payments...");
  const fundTx = await deployer.sendTransaction({
    to: contractAddress,
    value: ethers.parseEther("1.0") // Send 1 test FLR
  });
  await fundTx.wait();
  console.log("Contract funded with 1 test FLR");
  
  console.log("Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });