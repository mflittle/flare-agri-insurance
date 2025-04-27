const fs = require('fs-extra');
const path = require('path');

// Function to check if we can write to the data directory
async function checkFileSystem() {
  console.log('Checking file system access...');
  
  // 1. Check current working directory
  const cwd = process.cwd();
  console.log(`Current working directory: ${cwd}`);
  
  // 2. Check if data directory exists, create it if not
  const dataDir = path.join(cwd, 'data');
  if (!fs.existsSync(dataDir)) {
    console.log(`Data directory doesn't exist, creating it at: ${dataDir}`);
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Data directory created successfully');
    } catch (error) {
      console.error('Error creating data directory:', error.message);
      return;
    }
  } else {
    console.log(`Data directory exists at: ${dataDir}`);
    
    // Check if we can read from it
    try {
      const files = fs.readdirSync(dataDir);
      console.log(`Files in data directory: ${files.join(', ') || 'none'}`);
    } catch (error) {
      console.error('Error reading data directory:', error.message);
    }
  }
  
  // 3. Try to write a test file
  const testFilePath = path.join(dataDir, 'test_file.json');
  try {
    console.log(`Attempting to write test file to: ${testFilePath}`);
    fs.writeJsonSync(testFilePath, { test: 'data', timestamp: new Date().toISOString() }, { spaces: 2 });
    console.log('Test file written successfully');
    
    // Read it back
    const testData = fs.readJsonSync(testFilePath);
    console.log('Test file read successfully:', testData);
  } catch (error) {
    console.error('Error writing/reading test file:', error.message);
    return;
  }
  
  // 4. Check for existing county data
  console.log('\nChecking for existing county data...');
  
  const counties = [
    "Christian", "Union", "Todd", "Henderson", "Daviess", "Warren"
  ];
  
  for (const county of counties) {
    const countyDir = path.join(dataDir, county);
    
    if (fs.existsSync(countyDir)) {
      console.log(`${county} County directory exists`);
      
      // Check for 2020 data file
      const dataFilePath = path.join(countyDir, '2020_data.json');
      if (fs.existsSync(dataFilePath)) {
        console.log(`- Found 2020 data file for ${county} County`);
        
        // Try to read a sample of the file
        try {
          const data = fs.readJsonSync(dataFilePath);
          if (data && data.data && data.data.timelines && data.data.timelines[0] && 
              data.data.timelines[0].intervals && data.data.timelines[0].intervals.length > 0) {
            console.log(`- File appears to be valid, contains ${data.data.timelines[0].intervals.length} days of data`);
          } else {
            console.log('- File exists but data structure is invalid');
          }
        } catch (error) {
          console.error(`- Error reading data file: ${error.message}`);
        }
      } else {
        console.log(`- No 2020 data file found for ${county} County`);
      }
    } else {
      console.log(`${county} County directory doesn't exist`);
    }
  }
  
  console.log('\nFile system check completed');
}

// Run the function
checkFileSystem().catch(error => {
  console.error('Unhandled error:', error);
});