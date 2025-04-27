// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import the Flare periphery contracts
import {IEVMTransactionVerification} from "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransactionVerification.sol";
import {IEVMTransaction} from "@flarenetwork/flare-periphery-contracts/coston2/IEVMTransaction.sol";
import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";

/**
 * @title Agricultural Weather Insurance
 * @notice Smart contract for weather-based agricultural insurance using Flare's Data Connector
 * @dev Allows farmers to purchase weather insurance and receive automatic payouts based on validated weather data
 */
contract AgriculturalWeatherInsurance {
    // ======== Enums and Structs ========
    
    enum WeatherEventType { Drought, ExcessiveRain, HeatStress, WindDamage, FrostEvent }
    enum EventSeverity { None, Moderate, Severe, Extreme }
    
    struct CountyData {
        bool isActive;
        mapping(WeatherEventType => mapping(EventSeverity => uint256)) thresholds; // Stores thresholds for each weather event and severity
        mapping(uint256 => mapping(WeatherEventType => uint256)) monthlyMeasurements; // month => eventType => measurement
        mapping(uint256 => bool) dataVerified; // month => isVerified
    }
    
    struct Policy {
        address farmer;
        uint256 countyId;
        uint256 coveragePerAcre;
        uint256 acres;
        uint256 startTime;
        uint256 endTime;
        bool[] coveredEvents; // Array of booleans indicating which weather events are covered
        bool isActive;
        uint256 premiumPaid;
    }
    
    struct WeatherData {
        uint256 countyId;
        uint256 timestamp;
        WeatherEventType eventType;
        uint256 measurement;
        bytes32 dataHash; // For verification purposes
    }
    
    struct PayoutRecord {
        uint256 policyId;
        uint256 amount;
        WeatherEventType eventType;
        EventSeverity severity;
        uint256 timestamp;
    }

    // ======== State Variables ========
    
    address public owner;
    address public treasury;
    
    uint256 public policyCounter;
    uint256 public payoutCounter;
    
    // County ID => CountyData
    mapping(uint256 => CountyData) public counties;
    
    // Policy ID => Policy
    mapping(uint256 => Policy) public policies;
    
    // Policy ID => Month => Event Type => Already Paid Out
    mapping(uint256 => mapping(uint256 => mapping(WeatherEventType => bool))) public policyPayouts;
    
    // Payout ID => PayoutRecord
    mapping(uint256 => PayoutRecord) public payoutRecords;
    
    // Rate multipliers for premium calculation (multiplied by 100 for precision)
    uint256[5] public eventRiskMultipliers = [125, 150, 175, 130, 140]; // For each WeatherEventType
    uint256[3] public termLengthMultipliers = [90, 85, 80]; // For 3, 6, 12 months
    
    // Payout percentages (multiplied by 100 for precision)
    uint256 public moderatePayoutPercent = 30;
    uint256 public severePayoutPercent = 60;
    uint256 public extremePayoutPercent = 100;
    
    // Base premium rate per $100 of coverage (multiplied by 100 for precision)
    uint256 public basePremiumRate = 500; // $5.00 per $100 of coverage
    
    // ======== Events ========
    
    event CountyRegistered(uint256 indexed countyId);
    event PolicyPurchased(uint256 indexed policyId, address indexed farmer, uint256 premium);
    event WeatherDataUpdated(uint256 indexed countyId, uint256 timestamp, WeatherEventType indexed eventType);
    event PolicyPayout(uint256 indexed policyId, uint256 amount, WeatherEventType indexed eventType, EventSeverity severity);
    event TreasuryFundsRequested(uint256 amount, bool success);
    
    // ======== Constructor ========
    
    constructor(address _treasury) {
        owner = msg.sender;
        treasury = _treasury;
        
        // Initialize Kentucky counties with data from contract_parameters.json
        
        // Christian County (Index 0)
        uint256 christianCountyId = 0;
        counties[christianCountyId].isActive = true;
        
        // Drought thresholds
        counties[christianCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Moderate] = 5;
        counties[christianCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Severe] = 7;
        counties[christianCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Extreme] = 10;
        
        // Heat wave thresholds
        counties[christianCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Moderate] = 4; 
        counties[christianCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Severe] = 6;
        counties[christianCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Extreme] = 8;
        
        // Excessive rain thresholds (multiplied by 100 for integer storage)
        counties[christianCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Moderate] = 370; // 3.7 inches
        counties[christianCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Severe] = 470; // 4.7 inches
        counties[christianCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Extreme] = 490; // 4.9 inches
        
        // Wind thresholds (multiplied by 10 for integer storage)
        counties[christianCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Moderate] = 204; // 20.4 mph
        counties[christianCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Severe] = 244; // 24.4 mph
        counties[christianCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Extreme] = 285; // 28.5 mph
        
        emit CountyRegistered(christianCountyId);
        
        // Union County (Index 1)
        uint256 unionCountyId = 1;
        counties[unionCountyId].isActive = true;
        
        // Drought thresholds
        counties[unionCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Moderate] = 6;
        counties[unionCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Severe] = 9;
        counties[unionCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Extreme] = 12;
        
        // Heat wave thresholds
        counties[unionCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Moderate] = 4; 
        counties[unionCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Severe] = 6;
        counties[unionCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Extreme] = 7;
        
        // Excessive rain thresholds (multiplied by 100 for integer storage)
        counties[unionCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Moderate] = 310; // 3.1 inches
        counties[unionCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Severe] = 800; // 8.0 inches
        counties[unionCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Extreme] = 820; // 8.2 inches
        
        // Wind thresholds (multiplied by 10 for integer storage)
        counties[unionCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Moderate] = 204; // 20.4 mph
        counties[unionCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Severe] = 244; // 24.4 mph
        counties[unionCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Extreme] = 285; // 28.5 mph
        
        emit CountyRegistered(unionCountyId);
        
        // Daviess County (Index 4)
        uint256 daviessCountyId = 4;
        counties[daviessCountyId].isActive = true;
        
        // Drought thresholds
        counties[daviessCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Moderate] = 5;
        counties[daviessCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Severe] = 8;
        counties[daviessCountyId].thresholds[WeatherEventType.Drought][EventSeverity.Extreme] = 11;
        
        // Heat wave thresholds
        counties[daviessCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Moderate] = 3; 
        counties[daviessCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Severe] = 6;
        counties[daviessCountyId].thresholds[WeatherEventType.HeatStress][EventSeverity.Extreme] = 7;
        
        // Excessive rain thresholds (multiplied by 100 for integer storage)
        counties[daviessCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Moderate] = 350; // 3.5 inches
        counties[daviessCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Severe] = 390; // 3.9 inches
        counties[daviessCountyId].thresholds[WeatherEventType.ExcessiveRain][EventSeverity.Extreme] = 410; // 4.1 inches
        
        // Wind thresholds (multiplied by 10 for integer storage)
        counties[daviessCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Moderate] = 210; // 21.0 mph
        counties[daviessCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Severe] = 235; // 23.5 mph
        counties[daviessCountyId].thresholds[WeatherEventType.WindDamage][EventSeverity.Extreme] = 245; // 24.5 mph
        
        emit CountyRegistered(daviessCountyId);
    }
    
    // ======== Modifiers ========
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier activeCounty(uint256 _countyId) {
        require(counties[_countyId].isActive, "County not registered or inactive");
        _;
    }
    
    modifier activePolicy(uint256 _policyId) {
        require(policies[_policyId].isActive, "Policy not active");
        _;
    }
    
    // ======== Admin Functions ========
    
    /**
     * @notice Register a new county with thresholds for weather events
     * @param _countyId ID of the county to register
     * @param _eventTypes Array of weather event types
     * @param _severityLevels Array of severity levels for each event type
     * @param _thresholdValues Array of threshold values for each combination
     */
    function registerCounty(
        uint256 _countyId,
        WeatherEventType[] calldata _eventTypes,
        EventSeverity[] calldata _severityLevels,
        uint256[] calldata _thresholdValues
    ) external onlyOwner {
        require(!counties[_countyId].isActive, "County already registered");
        require(_eventTypes.length == _severityLevels.length && _eventTypes.length == _thresholdValues.length, "Arrays length mismatch");
        
        counties[_countyId].isActive = true;
        
        for (uint256 i = 0; i < _eventTypes.length; i++) {
            require(_severityLevels[i] != EventSeverity.None, "Invalid severity level");
            counties[_countyId].thresholds[_eventTypes[i]][_severityLevels[i]] = _thresholdValues[i];
        }
        
        emit CountyRegistered(_countyId);
    }
    
    /**
     * @notice Update threshold values for a specific county
     * @param _countyId ID of the county to update
     * @param _eventType Weather event type
     * @param _severityLevel Severity level
     * @param _threshold New threshold value
     */
    function updateThreshold(
        uint256 _countyId,
        WeatherEventType _eventType,
        EventSeverity _severityLevel,
        uint256 _threshold
    ) external onlyOwner activeCounty(_countyId) {
        require(_severityLevel != EventSeverity.None, "Invalid severity level");
        counties[_countyId].thresholds[_eventType][_severityLevel] = _threshold;
    }
    
    /**
     * @notice Set premium rate parameters
     * @param _basePremiumRate Base premium rate per $100 of coverage (multiplied by 100)
     * @param _eventRiskMultipliers Multipliers for each weather event type (multiplied by 100)
     * @param _termLengthMultipliers Multipliers for term lengths of 3, 6, and 12 months (multiplied by 100)
     */
    function setPremiumParameters(
        uint256 _basePremiumRate,
        uint256[5] calldata _eventRiskMultipliers,
        uint256[3] calldata _termLengthMultipliers
    ) external onlyOwner {
        basePremiumRate = _basePremiumRate;
        
        for (uint256 i = 0; i < 5; i++) {
            eventRiskMultipliers[i] = _eventRiskMultipliers[i];
        }
        
        for (uint256 i = 0; i < 3; i++) {
            termLengthMultipliers[i] = _termLengthMultipliers[i];
        }
    }
    
    /**
     * @notice Set payout percentages for different severity levels
     * @param _moderatePercent Payout percentage for moderate events (multiplied by 100)
     * @param _severePercent Payout percentage for severe events (multiplied by 100)
     * @param _extremePercent Payout percentage for extreme events (multiplied by 100)
     */
    function setPayoutPercentages(
        uint256 _moderatePercent,
        uint256 _severePercent,
        uint256 _extremePercent
    ) external onlyOwner {
        require(_moderatePercent <= _severePercent && _severePercent <= _extremePercent, "Invalid percentage order");
        require(_extremePercent <= 100 * 100, "Percentage cannot exceed 100%");
        
        moderatePayoutPercent = _moderatePercent;
        severePayoutPercent = _severePercent;
        extremePayoutPercent = _extremePercent;
    }
    
    /**
     * @notice Update the treasury address
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        treasury = _newTreasury;
    }
    
    /**
     * @notice Transfer ownership of the contract
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid owner address");
        owner = _newOwner;
    }
    
    // ======== Main Functions ========
    
    /**
     * @notice Purchase a weather insurance policy
     * @param _countyId The county ID for the policy
     * @param _acres Number of acres to insure
     * @param _coveragePerAcre Coverage amount per acre in USD (scaled by 1e2)
     * @param _months Number of months for policy term (1, 3, 6, or 12)
     * @param _coveredEvents Array of booleans indicating which weather events are covered
     * @return policyId ID of the newly created policy
     */
    function purchasePolicy(
        uint256 _countyId,
        uint256 _acres,
        uint256 _coveragePerAcre,
        uint256 _months,
        bool[5] calldata _coveredEvents
    ) external payable activeCounty(_countyId) returns (uint256) {
        require(_acres > 0, "Acres must be greater than zero");
        require(_coveragePerAcre > 0, "Coverage must be greater than zero");
        require(_months == 1 || _months == 3 || _months == 6 || _months == 12, "Invalid policy term");
        
        bool atLeastOneEventCovered = false;
        for (uint256 i = 0; i < 5; i++) {
            if (_coveredEvents[i]) {
                atLeastOneEventCovered = true;
                break;
            }
        }
        require(atLeastOneEventCovered, "At least one event must be covered");
        
        // Calculate premium
        uint256 premium = calculatePremium(_coveragePerAcre, _acres, _months, _coveredEvents);
        require(msg.value >= premium, "Insufficient payment for premium");
        
        // Return excess payment
        uint256 excess = msg.value - premium;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }
        
        // Split premium: 70% to treasury, 30% kept for claims reserve
        uint256 treasuryAmount = (premium * 70) / 100;
        // remainder stays in contract as claims reserve
        
        // Transfer portion to treasury
        payable(treasury).transfer(treasuryAmount);
        
        // Create new policy
        policyCounter++;
        Policy storage newPolicy = policies[policyCounter];
        newPolicy.farmer = msg.sender;
        newPolicy.countyId = _countyId;
        newPolicy.coveragePerAcre = _coveragePerAcre;
        newPolicy.acres = _acres;
        newPolicy.startTime = block.timestamp;
        newPolicy.endTime = block.timestamp + (_months * 30 days);
        newPolicy.isActive = true;
        newPolicy.premiumPaid = premium;
        
        // Store covered events
        newPolicy.coveredEvents = new bool[](5);
        for (uint256 i = 0; i < 5; i++) {
            newPolicy.coveredEvents[i] = _coveredEvents[i];
        }
        
        emit PolicyPurchased(policyCounter, msg.sender, premium);
        
        return policyCounter;
    }
    
    /**
     * @notice Submit and verify weather data through Flare Data Connector
     * @param _transaction EVMTransaction proof containing weather data
     * @return success Whether the data submission was successful
     */
    function submitWeatherData(IEVMTransaction.Proof calldata _transaction) external returns (bool) {
        // Verify that this EVMTransaction has been confirmed by the FDC
        require(
            isEVMTransactionProofValid(_transaction),
            "Invalid transaction proof"
        );
        
        // Extract the county ID, event type, measurement, and timestamp from the transaction data
        (uint256 countyId, uint256 timestamp, uint8 eventTypeRaw, uint256 measurement) = decodeWeatherData(_transaction);
        WeatherEventType eventType = WeatherEventType(eventTypeRaw);
        
        // Store the weather data
        uint256 monthId = getMonthId(timestamp);
        counties[countyId].monthlyMeasurements[monthId][eventType] = measurement;
        counties[countyId].dataVerified[monthId] = true;
        
        emit WeatherDataUpdated(countyId, timestamp, eventType);
        
        // Process payouts for policies affected by this weather data
        processPayouts(countyId, monthId, eventType, measurement);
        
        return true;
    }
    
    /**
     * @notice Test-only function to directly submit weather data without FDC validation
     * @param _countyId County ID
     * @param _eventType Weather event type
     * @param _measurement Weather measurement value
     */
    function testSubmitWeatherData(
        uint256 _countyId,
        WeatherEventType _eventType,
        uint256 _measurement
    ) external {
        // Skip FDC validation for testing
        
        // Store the weather data
        uint256 timestamp = block.timestamp;
        uint256 monthId = getMonthId(timestamp);
        counties[_countyId].monthlyMeasurements[monthId][_eventType] = _measurement;
        counties[_countyId].dataVerified[monthId] = true;
        
        emit WeatherDataUpdated(_countyId, timestamp, _eventType);
        
        // Process payouts for policies affected by this weather data
        processPayouts(_countyId, monthId, _eventType, _measurement);
    }
    
    /**
     * @notice Test-only function with more detailed error handling
     */
    function testSubmitWeatherDataWithChecks(
        uint256 _countyId,
        WeatherEventType _eventType,
        uint256 _measurement
    ) external {
        // Check if county exists
        require(counties[_countyId].isActive, "County not active");
        
        // Store the weather data
        uint256 timestamp = block.timestamp;
        uint256 monthId = getMonthId(timestamp);
        
        // Log the month ID for debugging
        emit WeatherDataUpdated(_countyId, timestamp, _eventType); // This event should show up if we get this far
        
        counties[_countyId].monthlyMeasurements[monthId][_eventType] = _measurement;
        counties[_countyId].dataVerified[monthId] = true;
        
        // Process payouts with careful error handling
        EventSeverity severity = determineEventSeverity(_countyId, _eventType, _measurement);
        require(severity != EventSeverity.None, "Measurement below threshold");
        
        // At this point we know the severity is sufficient to trigger a payout
        // Check if we have active policies
        bool foundActivePolicy = false;
        for (uint256 i = 1; i <= policyCounter; i++) {
            Policy storage policy = policies[i];
            if (policy.isActive && policy.countyId == _countyId) {
                foundActivePolicy = true;
                break;
            }
        }
        require(foundActivePolicy, "No active policies for this county");
        
        // Now try processing payouts
        processPayouts(_countyId, monthId, _eventType, _measurement);
    }
    
    /**
     * @notice Request funds from treasury for payouts if reserves are low
     * @param _amount Amount of funds to request
     * @return success Whether the funds were successfully transferred
     */
    function requestFundsFromTreasury(uint256 _amount) external returns (bool) {
        // Only the contract itself or the owner can call this
        require(msg.sender == address(this) || msg.sender == owner, "Unauthorized");
        
        (bool success, ) = treasury.call{value: 0, gas: 50000}(
            abi.encodeWithSignature("transferFundsToContract(uint256)", _amount)
        );
        
        emit TreasuryFundsRequested(_amount, success);
        
        return success;
    }
    
    /**
     * @notice Deposit funds into the contract for payouts
     */
    function depositFunds() external payable {
        // No need for additional logic, the receive function will handle the incoming ETH
    }
    
    /**
     * @notice Check policy details
     * @param _policyId ID of the policy to check
     * @return farmer Address of the policy owner
     * @return countyId County ID
     * @return coveragePerAcre Coverage per acre
     * @return acres Number of acres insured
     * @return startTime Policy start time
     * @return endTime Policy end time
     * @return isActive Whether the policy is active
     * @return coveredEvents Array of booleans indicating covered events
     */
    function getPolicyDetails(uint256 _policyId) external view returns (
        address farmer,
        uint256 countyId,
        uint256 coveragePerAcre,
        uint256 acres,
        uint256 startTime,
        uint256 endTime,
        bool isActive,
        bool[] memory coveredEvents
    ) {
        Policy storage policy = policies[_policyId];
        return (
            policy.farmer,
            policy.countyId,
            policy.coveragePerAcre,
            policy.acres,
            policy.startTime,
            policy.endTime,
            policy.isActive,
            policy.coveredEvents
        );
    }
    
    /**
     * @notice View threshold for a specific county, weather event, and severity
     * @param _countyId County ID
     * @param _eventType Weather event type
     * @param _severity Severity level
     * @return threshold Threshold value
     */
    function getThreshold(uint256 _countyId, WeatherEventType _eventType, EventSeverity _severity) 
        external 
        view 
        activeCounty(_countyId) 
        returns (uint256) 
    {
        require(_severity != EventSeverity.None, "Invalid severity level");
        return counties[_countyId].thresholds[_eventType][_severity];
    }
    
    /**
     * @notice Calculate premium for a policy
     * @param _coveragePerAcre Coverage amount per acre
     * @param _acres Number of acres to insure
     * @param _months Number of months for policy term
     * @param _coveredEvents Array of booleans indicating covered events
     * @return premium Total premium amount
     */
    function calculatePremium(
        uint256 _coveragePerAcre,
        uint256 _acres,
        uint256 _months,
        bool[5] calldata _coveredEvents
    ) public view returns (uint256) {
        // Base premium calculation
        uint256 totalCoverage = _coveragePerAcre * _acres;
        uint256 premium = (totalCoverage * basePremiumRate) / 10000; // Base rate per $100 of coverage
        
        // Apply event risk multipliers
        uint256 eventMultiplier = 0;
        uint256 eventCount = 0;
        
        for (uint256 i = 0; i < 5; i++) {
            if (_coveredEvents[i]) {
                eventMultiplier += eventRiskMultipliers[i];
                eventCount++;
            }
        }
        
        if (eventCount > 0) {
            eventMultiplier = eventMultiplier / eventCount;
        } else {
            eventMultiplier = 100; // Default to 1x if no events selected
        }
        
        premium = (premium * eventMultiplier) / 100;
        
        // Apply term length discount
        uint256 termMultiplier;
        if (_months == 3) {
            termMultiplier = termLengthMultipliers[0];
        } else if (_months == 6) {
            termMultiplier = termLengthMultipliers[1];
        } else if (_months == 12) {
            termMultiplier = termLengthMultipliers[2];
        } else {
            termMultiplier = 100; // No discount for 1-month policies
        }
        
        premium = (premium * termMultiplier) / 100;
        premium = premium * _months; // Scale by number of months
        
        return premium;
    }
    
    /**
     * @notice Get contract balance
     * @return balance Current contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Check thresholds for testing
     */
    function testCheckThresholds(
        uint256 _countyId, 
        WeatherEventType _eventType, 
        uint256 _measurement
    ) external view returns (EventSeverity) {
        return determineEventSeverity(_countyId, _eventType, _measurement);
    }
    
    // ======== Internal/Private Functions ========
    
    /**
    * @notice Verify EVMTransaction proof using Flare Data Connector
    * @param _transaction EVMTransaction proof to verify
    * @return isValid Whether the proof is valid
    */
    function isEVMTransactionProofValid(
        IEVMTransaction.Proof calldata _transaction
    ) internal view returns (bool) {
        // For development on Coston2, use the fixed address from the documentation
        // The correct FDC address on Coston2 is in the documentation
        address fdcVerificationAddress = 0x1c78A073E3BD2aCa4cc327d55FB0cD4f0549B55b; // FDC Hub Address
        
        // For hackathon simplicity, return true for now
        return true;
        
        // The correct implementation (uncomment for production):
        // IEVMTransactionVerification verifier = IEVMTransactionVerification(fdcVerificationAddress);
        // return verifier.verifyEVMTransaction(_transaction);
    }
    
    /**
     * @notice Decode weather data from EVMTransaction
     * @param _transaction EVMTransaction proof containing weather data
     * @return countyId County ID
     * @return timestamp Timestamp of the weather data
     * @return eventType Weather event type
     * @return measurement Weather measurement value
     */
    function decodeWeatherData(IEVMTransaction.Proof calldata _transaction) 
        internal 
        view
        returns (uint256 countyId, uint256 timestamp, uint8 eventType, uint256 measurement) 
    {
        // For testnet deployment, use simple mock values
        countyId = 1;  // Example county ID
        timestamp = block.timestamp;  // Current block timestamp
        eventType = 0;  // Drought event
        measurement = 14;  // 14 days (extreme drought)
        
        // We'll implement the real decoding logic later
        return (countyId, timestamp, eventType, measurement);
    }
    
    /**
     * @notice Process payouts for policies affected by weather data
     * @param _countyId County ID
     * @param _monthId Month ID
     * @param _eventType Weather event type
     * @param _measurement Weather measurement value
     */
    function processPayouts(
        uint256 _countyId,
        uint256 _monthId,
        WeatherEventType _eventType,
        uint256 _measurement
    ) internal {
        // Determine the severity of the event
        EventSeverity severity = determineEventSeverity(_countyId, _eventType, _measurement);
        
        // If no threshold is breached, no payouts are needed
        if (severity == EventSeverity.None) {
            return;
        }
        
        // Calculate total payout needed for this event
        uint256 totalPayoutNeeded = 0;
        uint256[] memory eligiblePolicies = new uint256[](policyCounter);
        uint256 eligibleCount = 0;
        
        // First pass: identify eligible policies and calculate total needed
        for (uint256 i = 1; i <= policyCounter; i++) {
            Policy storage policy = policies[i];
            
            // Skip if policy is inactive, from a different county, or doesn't cover this event type
            if (!policy.isActive || 
                policy.countyId != _countyId || 
                !policy.coveredEvents[uint8(_eventType)] ||
                block.timestamp > policy.endTime ||
                block.timestamp < policy.startTime) {
                continue;
            }
            
            // Skip if this policy has already received a payout for this event type this month
            if (policyPayouts[i][_monthId][_eventType]) {
                continue;
            }
            
            // Calculate payout amount based on severity
            uint256 payoutPercentage;
            if (severity == EventSeverity.Moderate) {
                payoutPercentage = moderatePayoutPercent;
            } else if (severity == EventSeverity.Severe) {
                payoutPercentage = severePayoutPercent;
            } else {
                payoutPercentage = extremePayoutPercent;
            }
            
            uint256 payoutAmount = (policy.coveragePerAcre * policy.acres * payoutPercentage) / 100;
            totalPayoutNeeded += payoutAmount;
            
            // Store eligible policy
            eligiblePolicies[eligibleCount] = i;
            eligibleCount++;
        }
        
        // Check if we have enough funds
        if (totalPayoutNeeded > 0 && totalPayoutNeeded > address(this).balance) {
            // Not enough funds in contract, attempt to request from treasury
            this.requestFundsFromTreasury(totalPayoutNeeded - address(this).balance);
            
            // For testing, we'll continue even if the treasury request fails
            // In production, you might want to handle this differently
        }
        
        // Second pass: process the payouts for eligible policies
        for (uint256 j = 0; j < eligibleCount; j++) {
            uint256 policyId = eligiblePolicies[j];
            Policy storage policy = policies[policyId];
            
            // Calculate payout amount
            uint256 payoutPercentage;
            if (severity == EventSeverity.Moderate) {
                payoutPercentage = moderatePayoutPercent;
            } else if (severity == EventSeverity.Severe) {
                payoutPercentage = severePayoutPercent;
            } else {
                payoutPercentage = extremePayoutPercent;
            }
            
            uint256 payoutAmount = (policy.coveragePerAcre * policy.acres * payoutPercentage) / 10000;
            
            // Skip if contract doesn't have enough balance for this payout
            if (payoutAmount > address(this).balance) {
                continue; // Skip this payout
            }
            
            // Record that this policy has received a payout for this event type this month
            policyPayouts[policyId][_monthId][_eventType] = true;
            
            // Create payout record
            payoutCounter++;
            payoutRecords[payoutCounter] = PayoutRecord({
                policyId: policyId,
                amount: payoutAmount,
                eventType: _eventType,
                severity: severity,
                timestamp: block.timestamp
            });
            
            // Send payout to the farmer
            payable(policy.farmer).transfer(payoutAmount);
            
            emit PolicyPayout(policyId, payoutAmount, _eventType, severity);
        }
    }
    
    /**
     * @notice Determine the severity of a weather event
     * @param _countyId County ID
     * @param _eventType Weather event type
     * @param _measurement Weather measurement value
     * @return severity Severity level of the event
     */
    function determineEventSeverity(
        uint256 _countyId,
        WeatherEventType _eventType,
        uint256 _measurement
    ) internal view returns (EventSeverity) {
        // Get thresholds for this county and event type
        uint256 moderateThreshold = counties[_countyId].thresholds[_eventType][EventSeverity.Moderate];
        uint256 severeThreshold = counties[_countyId].thresholds[_eventType][EventSeverity.Severe];
        uint256 extremeThreshold = counties[_countyId].thresholds[_eventType][EventSeverity.Extreme];
        
        // For some event types, higher values are worse (e.g., heat, rain)
        // For others, lower values are worse (e.g., drought)
        // This implementation assumes higher values are worse
        if (_measurement >= extremeThreshold) {
            return EventSeverity.Extreme;
        } else if (_measurement >= severeThreshold) {
            return EventSeverity.Severe;
        } else if (_measurement >= moderateThreshold) {
            return EventSeverity.Moderate;
        } else {
            return EventSeverity.None;
        }
    }
    
    /**
     * @notice Convert a timestamp to a month ID (YYYYMM format)
     * @param _timestamp Unix timestamp
     * @return monthId Month ID in YYYYMM format
     */
    function getMonthId(uint256 _timestamp) internal pure returns (uint256) {
        // Extract year and month from timestamp
        uint256 secondsPerDay = 24 * 60 * 60;
        uint256 secondsPerYear = 365 * secondsPerDay;
        uint256 secondsPerMonth = 30 * secondsPerDay;
        
        uint256 year = 1970 + (_timestamp / secondsPerYear);
        uint256 month = 1 + ((_timestamp % secondsPerYear) / secondsPerMonth);
        
        // Adjust month (simplified calculation)
        if (month > 12) {
            month = month % 12;
            if (month == 0) month = 12;
        }
        
        return (year * 100) + month; // e.g., 202304 for April 2023
    }
    
    /**
     * @notice Withdraw excess funds from the contract
     * @param _amount Amount to withdraw
     */
    function withdrawFunds(uint256 _amount) external onlyOwner {
        require(_amount <= address(this).balance, "Insufficient contract balance");
        payable(owner).transfer(_amount);
    }
    
    /**
     * @notice Receive function to accept ETH payments
     */
    receive() external payable {}
    
    /**
     * @notice Fallback function
     */
    fallback() external payable {}
}