# Agricultural Weather Insurance Framework for Kentucky Farmers

![Agricultural Insurance Banner](https://via.placeholder.com/1200x300?text=Agricultural+Weather+Insurance)

## Project Overview

This project implements a blockchain-based parametric weather insurance platform for Kentucky farmers using Flare Network's decentralized oracle capabilities. The system automatically triggers payouts based on weather data from NOAA, eliminating the need for traditional claims processing and providing farmers with financial protection against extreme weather events.

## Key Features

- **Parametric Insurance**: Automatic payouts based on predefined weather thresholds
- **Smart Contract Implementation**: Transparent, immutable insurance policies on the blockchain
- **Real-Time Weather Data**: Integration with NOAA weather data via Flare's oracle network
- **Flexible Coverage Options**: Farmers can select specific risks and coverage periods
- **User-Friendly Dashboard**: Easy policy management and weather monitoring

## Project Structure

This project consists of three integrated components:

### 1. NOAA Data Extraction Service

- Located in `/data-extraction`
- Python scripts for fetching and processing NOAA weather data
- Historical data analysis for establishing county-specific thresholds
- Data formatting for blockchain consumption

### 2. Smart Contracts

- Located in `/contracts`
- Solidity smart contracts deployed on the Sepolia testnet with Flare integration
- Core insurance logic and automatic payout mechanism
- Weather data verification through Flare's decentralized oracles

### 3. User Interface

- Located in `/agri-insurance-ui`
- React-based frontend for farmer interaction
- Policy purchase and management dashboard
- Weather event simulation for testing

## Flare Network Integration

This project leverages several key Flare Network technologies:

### Flare Time Series Oracle (FTSO)

- Used for retrieving reliable timestamp data to validate weather events
- Ensures trustworthy timing for policy activation and expiration

### Flare Data Connector (FDC)

- Core functionality for weather data attestation
- Connects the smart contracts with external NOAA weather data sources
- Files: `contracts/Helpers.sol` and `scripts/star-wars-api.js` demonstrate the implementation

### EVMTransaction Verification 

- Validates the authenticity of weather data submissions
- Ensures only authorized and valid weather events trigger payouts
- Implementation in `contracts/AgriculturalWeatherInsurance.sol` (function `submitWeatherData()`)

### Data Availability Layer

- Stores proofs of weather events for transparency and auditability
- Implemented in `scripts/get-fdc-proof-v2.js`

## Getting Started

### Prerequisites

- Node.js v16+
- Python 3.8+ (for data extraction)
- MetaMask wallet with Sepolia testnet configured
- Test ETH on Sepolia network

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/agri-insurance-flare.git
   cd agri-insurance-flare
   ```

2. Install smart contract dependencies:
   ```
   npm install
   ```

3. Install UI dependencies:
   ```
   cd agri-insurance-ui
   npm install
   ```

4. Configure environment:
   Create a `.env` file in the root directory with the following variables:
   ```
   PRIVATE_KEY=your_private_key_here
   ETHERSCAN_API_KEY=your_etherscan_api_key
   JQ_VERIFIER_URL_TESTNET=https://jq-verifier-test.flare.rocks/
   JQ_VERIFIER_API_KEY_TESTNET=your_api_key_here
   COSTON2_DA_LAYER_URL=https://ctn2-data-availability.flare.network/
   ```

### Running the Application

1. Start the UI development server:
   ```
   cd agri-insurance-ui
   npm start
   ```

2. Connect your MetaMask wallet to the application at http://localhost:3000

3. Purchase a policy by selecting coverage options and county

4. Simulate weather events to test the payout mechanism

## Insurance Structure

### Coverage Terms

- **Standard Term**: 6 months (covering a single growing season)
- **Annual Term**: 12 months (covering year-round operations)
- **Quarterly Term**: 3 months (for targeted seasonal protection)

### Event Coverage Options

Farmers can select from the following weather risks:
1. Drought protection
2. Excessive rainfall protection
3. Heat stress protection
4. Wind damage protection
5. Frost event protection

### Premium Calculation

Premiums are calculated based on:
- County-specific risk profiles
- Coverage selections
- Farm size (per acre)
- Term length

### Payout Structure

- **Moderate event**: 30% of coverage limit
- **Severe event**: 60% of coverage limit
- **Extreme event**: 100% of coverage limit

## Future Enhancements

1. Integration with additional weather data sources
2. Support for more Kentucky counties and other states
3. Enhanced dashboard with predictive weather analytics
4. Mobile application for on-the-go monitoring
5. Integration with traditional insurance systems

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Flare Network for providing oracle technology
- NOAA for weather data access
- Kentucky Department of Agriculture for county farming data

