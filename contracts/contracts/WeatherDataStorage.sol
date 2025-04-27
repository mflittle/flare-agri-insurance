// contracts/WeatherDataStorage.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract WeatherDataStorage {
    event WeatherDataUpdated(
        uint256 countyId,
        uint256 timestamp,
        uint8 eventType,
        uint256 measurement
    );
    
    function storeWeatherData(
        uint256 countyId,
        uint256 timestamp,
        uint8 eventType,
        uint256 measurement
    ) external {
        emit WeatherDataUpdated(countyId, timestamp, eventType, measurement);
    }
}