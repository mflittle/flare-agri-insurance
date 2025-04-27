// scripts/create-sepolia-tx.js
const { ethers } = require("hardhat");

async function main() {
  // Get signer
  const [signer] = await ethers.getSigners();
  
  console.log("Creating Sepolia transaction from:", signer.address);
  
  // Get current balance
  const balance = await ethers.provider.getBalance(signer.address);
  console.log("Current balance:", ethers.formatEther(balance), "ETH");
  
  // Create a simple transfer transaction (to self)
  const tx = await signer.sendTransaction({
    to: signer.address,  // Send to self
    value: ethers.parseEther("0.001"),  // Transfer a small amount
    gasLimit: 21000  // Standard gas limit for simple transfers
  });
  
  console.log("Transaction submitted:", tx.hash);
  console.log("Waiting for confirmation...");
  
  // Wait for the transaction to be confirmed
  const receipt = await tx.wait();
  
  console.log("Transaction confirmed in block:", receipt.blockNumber);
  console.log("Transaction hash:", tx.hash);
  console.log("Use this hash for your attestation request");
  
  // Return the transaction hash for later use
  return tx.hash;
}

main()
  .then((txHash) => {
    console.log("\nTransaction completed successfully:", txHash);
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error creating transaction:", error);
    process.exit(1);
  });