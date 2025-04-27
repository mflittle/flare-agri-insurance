// tasks/weather-tasks.js
task("submit-monthly-data", "Fetches, processes and submits monthly weather data")
  .setAction(async (taskArgs, hre) => {
    const submitScript = require("../scripts/submit-weather-data.js");
    await submitScript.main();
  });