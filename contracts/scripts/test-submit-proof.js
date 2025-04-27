// scripts/test-submit-proof.js with more complete structure
const { ethers } = require("hardhat");
const submitProofToContract = require('./submit-fdc-proof');
const fs = require('fs');

async function testWithMock() {
  console.log("Testing proof submission with mock data...");
  
  // Create a more complete mock proof for EVMTransaction
  const mockProofData = {
    merkleProof: [
      ethers.keccak256(ethers.toUtf8Bytes("simulated-request")),
      ethers.keccak256(ethers.toUtf8Bytes("weather-proof-1")),
      ethers.keccak256(ethers.toUtf8Bytes("weather-proof-2"))
    ],
    data: {
      attestationType: "0x" + Buffer.from("EVMTransaction").toString('hex').padEnd(64, "0"),
      sourceId: "0x" + Buffer.from("testETH").toString('hex').padEnd(64, "0"),
      votingRound: 1159188, // Add the missing voting round field
      requestBody: {
        transactionHash: "0x" + "1".repeat(64)
      },
      responseBody: {
        transactionHash: "0x" + "1".repeat(64),
        blockNumber: 12345678,
        timestamp: Math.floor(Date.now() / 1000),
        status: 1,
        events: [
          {
            topics: [
              ethers.keccak256(ethers.toUtf8Bytes("WeatherDataUpdated(uint256,uint256,uint8,uint256)"))
            ],
            data: ethers.AbiCoder.defaultAbiCoder().encode(
              ["uint256", "uint256", "uint8", "uint256"],
              [1, Math.floor(Date.now() / 1000), 0, 14] // County ID 1, current timestamp, event type 0 (Drought), measurement 14
            )
          }
        ]
      }
    }
  };
  
  // Save to file
  fs.writeFileSync('mock-proof.json', JSON.stringify(mockProofData, null, 2));
  console.log("Mock proof saved to mock-proof.json");
  
  // Load the mock proof
  const loadedMockProofData = JSON.parse(fs.readFileSync('mock-proof.json', 'utf8'));
  
  console.log("Mock proof loaded:", JSON.stringify(loadedMockProofData, null, 2));
  
  try {
    // Submit it to the contract
    console.log("Submitting proof to contract...");
    const txHash = await submitProofToContract(loadedMockProofData);
    
    console.log(`Test completed successfully! Transaction: ${txHash}`);
  } catch (error) {
    console.error("Error submitting proof to contract:", error.message);
    
    // For hackathon purposes - try with testSubmitWeatherData instead
    console.log("\nAttempting fallback to testSubmitWeatherData function...");
    
    try {
      // Connect to your insurance contract
      const contractAddress = "0x064540b6DC0962853B219b4F4655FC0820527fDE";
      const insurance = await ethers.getContractAt("AgriculturalWeatherInsurance", contractAddress);
      
      // Call the test function instead
      const tx = await insurance.testSubmitWeatherData(
        1, // County ID
        0, // WeatherEventType.Drought
        14 // 14 days of drought (extreme)
      );
      
      console.log(`Test function transaction hash: ${tx.hash}`);
      await tx.wait();
      console.log("Test function completed successfully!");
      
      // Check for new payouts
      const payoutCounter = await insurance.payoutCounter();
      console.log(`Total number of payouts: ${payoutCounter}`);
    } catch (fallbackError) {
      console.error("Error with fallback function:", fallbackError.message);
    }
  }
}

testWithMock()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Error in test:", error);
    process.exit(1);
  });