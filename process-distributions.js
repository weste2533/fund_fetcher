/**
 * Fund Distribution Data Processor
 * filename = process-distributions.js
 * Processes historical distribution data for mutual funds and money market funds (MMF),
 * providing normalized output for dividend payments and capital gains distributions.
 * 
 * USAGE:
 * 
 * Basic Function Call:
 * getDistributionData(ticker, startDate, [endDate])
 *   .then(data => { /* handle data *\/ })
 *   .catch(error => { /* handle errors *\/ });
 * 
 * PARAMETERS:
 * @param {string} ticker - Fund ticker symbol (case-sensitive)
 *     Examples: 'ANCFX' (Mutual Fund), 'AFAXX' (Money Market Fund)
 * 
 * @param {string|Date} startDate - Start date for historical data
 *     - String format: 'YYYY-MM-DD' or 'MM/DD/YYYY'
 *     - Date object: JavaScript Date instance
 * 
 * @param {string|Date} [endDate] - Optional end date (default: current date)
 *     - Same format as startDate
 * 
 * RETURNS:
 * @returns {Promise<Object>} - Structured distribution data containing:
 *     {
 *       items: Array<DistributionItem> // Sorted chronologically (oldest first)
 *       error?: string                 // Present if error occurred
 *     }
 * 
 *     DistributionItem structure:
 *     {
 *       date: string,    // ISO date ('YYYY-MM-DD')
 *       nav: number,     // Net Asset Value at reinvestment
 *       dist: number     // Total distribution per share (USD)
 *     }
 * 
 * DATA STRUCTURE DETAILS:
 * - Mutual Funds: Includes all dividend types and capital gains
 * - Money Market Funds: Daily accrual rates with fixed $1.00 NAV
 * - Items array empty if no distributions in date range
 * - NAV represents reinvestment price for mutual funds
 * 
 * ERROR HANDLING:
 * - Returns object with error property for:
 *   - Invalid tickers
 *   - Date parsing errors
 *   - Missing data files
 *   - Errors include descriptive messages for troubleshooting
 * 
 * DATA SOURCES:
 * - Mutual Funds: TSV data with columns:
 *   Record Date | Calculated Date | Pay Date | Income Dividends | Capital Gains | NAV
 * - MMF: Daily rate data in TSV format (Rate | As of Date)
 * 
 * EXAMPLE USAGE:
 * 
 * // Get mutual fund data for 2024
 * getDistributionData('ANCFX', '2024-01-01', '2024-12-31')
 *   .then(data => {
 *     console.log('Distribution items:', data.items);
 *     console.log('First distribution:', data.items[0]);
 *   });
 * 
 * // Get MMF data for recent period
 * async function showMMFData() {
 *   const result = await getDistributionData('AFAXX', '2025-02-01');
 *   if (result.error) {
 *     console.error('Error:', result.error);
 *   } else {
 *     console.log('Daily rates:', result.items);
 *   }
 * }
 */

/**
 * Main function to get distribution data for a specified ticker and date range
 * @param {string} ticker - The fund ticker symbol
 * @param {string|Date} startDate - Start date for data range
 * @param {string|Date} endDate - Optional end date for data range, defaults to current date
 * @return {Promise<Object>} Promise resolving to object containing distribution data items or error
 */
function getDistributionData(ticker, startDate, endDate = new Date()) {
  console.log(`Starting getDistributionData for ${ticker}, from ${startDate} to ${endDate}`);
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      if (!ticker || typeof ticker !== 'string') {
        console.error('Error: Invalid ticker symbol');
        return resolve({ error: 'Invalid ticker symbol', items: [] });
      }
      
      // Parse dates
      console.log('Parsing dates...');
      const parsedStartDate = parseDate(startDate);
      const parsedEndDate = parseDate(endDate);
      
      console.log(`Parsed dates: start=${parsedStartDate}, end=${parsedEndDate}`);
      
      if (!parsedStartDate) {
        console.error('Error: Invalid start date format');
        return resolve({ error: 'Invalid start date format', items: [] });
      }
      
      if (!parsedEndDate) {
        console.error('Error: Invalid end date format');
        return resolve({ error: 'Invalid end date format', items: [] });
      }
      
      if (parsedStartDate > parsedEndDate) {
        console.error('Error: Start date cannot be after end date');
        return resolve({ error: 'Start date cannot be after end date', items: [] });
      }
      
      // Determine fund type and fetch data
      const isMmf = ticker.toLowerCase().startsWith('mmf_');
      const filename = `${isMmf ? 'mmf' : 'mutual'}_${ticker}_distributions.txt`;
      console.log(`Fund type: ${isMmf ? 'Money Market Fund' : 'Mutual Fund'}`);
      console.log(`Attempting to fetch distribution file: ${filename}`);
      
      fetchDistributionFile(ticker)
        .then(data => {
          if (!data) {
            console.error(`No data found for ticker ${ticker}`);
            return resolve({ error: `No data found for ticker ${ticker}`, items: [] });
          }
          
          console.log(`Successfully retrieved data for ${ticker}. Processing...`);
          
          // Process data based on fund type
          let items = [];
          
          if (isMmfTicker(ticker)) {
            console.log('Processing as Money Market Fund data');
            items = parseMmfData(data, parsedStartDate, parsedEndDate);
          } else {
            console.log('Processing as Mutual Fund data');
            items = parseMutualFundData(data, parsedStartDate, parsedEndDate);
          }
          
          console.log(`Processed ${items.length} distribution records`);
          
          // Sort by date (oldest first)
          items.sort((a, b) => new Date(a.date) - new Date(b.date));
          console.log('Items sorted by date (oldest first)');
          
          // Log a sample of data for verification
          if (items.length > 0) {
            console.log('Sample data (first item):', JSON.stringify(items[0]));
            if (items.length > 1) {
              console.log('Sample data (last item):', JSON.stringify(items[items.length - 1]));
            }
          }
          
          console.log(`Returning ${items.length} items`);
          resolve({ items });
        })
        .catch(error => {
          console.error(`Error in fetchDistributionFile: ${error.message}`);
          resolve({ error: `Error fetching distribution data: ${error.message}`, items: [] });
        });
    } catch (error) {
      console.error(`Unexpected error in getDistributionData: ${error.message}`);
      console.error(error.stack);
      resolve({ error: `Unexpected error: ${error.message}`, items: [] });
    }
  });
}

/**
 * Determine if the ticker is for a money market fund
 * @param {string} ticker - The fund ticker symbol
 * @return {boolean} True if MMF, false otherwise
 */
function isMmfTicker(ticker) {
  return ticker.endsWith('XX');
}

/**
 * Fetch distribution data file for the given ticker
 * @param {string} ticker - The fund ticker symbol
 * @return {Promise<string>} Promise resolving to the file content
 */
function fetchDistributionFile(ticker) {
  console.log(`fetchDistributionFile started for ticker: ${ticker}`);
  
  return new Promise((resolve, reject) => {
    const filePrefix = isMmfTicker(ticker) ? 'mmf' : 'mutual';
    const filename = `${filePrefix}_${ticker}_distributions.txt`;
    
    // Use the standard format for raw GitHub URLs
    const baseUrl = 'https://raw.githubusercontent.com/weste2533/fund_fetcher/main/';
    const fileUrl = baseUrl + filename;
    
    console.log(`Attempting to fetch file: ${fileUrl}`);
    
    fetch(fileUrl)
      .then(response => {
        console.log(`Received response with status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
          throw new Error(`File not found: ${filename} (Status: ${response.status})`);
        }
        return response.text();
      })
      .then(data => {
        console.log(`Successfully retrieved data. Length: ${data.length} characters`);
        resolve(data);
      })
      .catch(error => {
        console.error(`Fetch error occurred: ${error.message}`);
        reject(error);
      });
  });
}

/**
 * Parse date string or object into a Date object
 * @param {string|Date} dateInput - Date string or object
 * @return {Date|null} Parsed Date object or null if invalid
 */
function parseDate(dateInput) {
  if (dateInput instanceof Date) {
    return isNaN(dateInput) ? null : dateInput;
  }
  
  if (typeof dateInput !== 'string') {
    return null;
  }
  
  // Handle different date formats
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateInput)) {
    const [year, month, day] = dateInput.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Format: MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateInput)) {
    const [month, day, year] = dateInput.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  return null;
}

/**
 * Format date as ISO string (YYYY-MM-DD)
 * @param {Date} date - Date object to format
 * @return {string} ISO formatted date string
 */
function formatISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse money market fund data
 * @param {string} data - Raw TSV data for MMF
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @return {Array} Array of distribution items
 */
function parseMmfData(data, startDate, endDate) {
  const lines = data.trim().split('\n');
  
  // Skip header line
  const items = [];
  
  for (let i = 1; i < lines.length; i++) {
    const [rate, dateStr] = lines[i].split('\t');
    
    // Parse date (MM/DD/YYYY format in the file)
    const dateParts = dateStr.split('/');
    if (dateParts.length !== 3) {
      // Try alternative format (in case it's in a different format)
      const date = new Date(dateStr);
      if (isNaN(date)) {
        continue; // Skip invalid dates
      }
      
      if (date >= startDate && date <= endDate) {
        items.push({
          date: formatISODate(date),
          nav: 1.0, // MMFs have fixed $1.00 NAV
          dist: parseFloat(rate) // Daily accrual rate
        });
      }
    } else {
      const month = parseInt(dateParts[0]) - 1; // 0-based months
      const day = parseInt(dateParts[1]);
      const year = parseInt(dateParts[2]);
      const date = new Date(year, month, day);
      
      if (date >= startDate && date <= endDate) {
        items.push({
          date: formatISODate(date),
          nav: 1.0, // MMFs have fixed $1.00 NAV
          dist: parseFloat(rate) // Daily accrual rate
        });
      }
    }
  }
  
  return items;
}

/**
 * Parse mutual fund distribution data
 * @param {string} data - Raw TSV data for mutual fund
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @return {Array} Array of distribution items
 */
function parseMutualFundData(data, startDate, endDate) {
  console.log('Starting mutual fund data parsing');
  const lines = data.trim().split('\n');
  console.log(`Found ${lines.length} lines of data`);
  
  // Skip header line
  const items = [];
  
  // Log the header to see column structure
  console.log('Header row:', lines[0]);
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    console.log(`Processing line ${i}, found ${parts.length} columns`);
    
    // Your actual data format is:
    // Record Date | Calculated Date | Pay Date | Income Dividend Regular | Income Dividend Special | Cap. Gains Long-Term | Cap. Gains Short-Term | Reinvest NAV
    
    // MM/DD/YY format expected for record date
    let recordDateStr = parts[0];
    console.log(`Record date string: ${recordDateStr}`);
    
    // Try to parse date (handle multiple formats)
    let recordDate = parseCustomDate(recordDateStr);
    
    // Check if valid date could be parsed
    if (!recordDate || isNaN(recordDate)) {
      console.warn(`Skipping row ${i}: Invalid date format: ${recordDateStr}`);
      continue;
    }
    
    console.log(`Parsed record date: ${recordDate.toISOString()}`);
    
    // Check if in date range
    if (recordDate >= startDate && recordDate <= endDate) {
      // Parse numeric values with dollar signs
      // Fixed indices to match your actual data structure
      const incomeDividendRegular = parseFloat((parts[3] || '0').replace('$', '')) || 0;
      const incomeDividendSpecial = parseFloat((parts[4] || '0').replace('$', '')) || 0;
      const capGainsLongTerm = parseFloat((parts[5] || '0').replace('$', '')) || 0;
      const capGainsShortTerm = parseFloat((parts[6] || '0').replace('$', '')) || 0;
      const nav = parseFloat((parts[7] || '0').replace('$', '')) || 0;
      
      console.log(`Parsed values: Regular dividend=${incomeDividendRegular}, Special=${incomeDividendSpecial}, LT gains=${capGainsLongTerm}, ST gains=${capGainsShortTerm}, NAV=${nav}`);
      
      // Calculate total distribution
      const totalDist = incomeDividendRegular + incomeDividendSpecial + 
                        capGainsLongTerm + capGainsShortTerm;
      
      console.log(`Total distribution: ${totalDist}`);
      
      items.push({
        date: formatISODate(recordDate),
        nav: nav,
        dist: totalDist
      });
      
      console.log(`Added item for date ${formatISODate(recordDate)}`);
    } else {
      console.log(`Date out of requested range: ${recordDate.toISOString()}`);
    }
  }
  
  console.log(`Total items found in range: ${items.length}`);
  return items;
}

/**
 * Custom Date parser that handles various formats
 * @param {string} dateString - Date string to parse
 * @return {Date|null} Parsed Date object or null if invalid
 */
function parseCustomDate(dateString) {
  if (!dateString) return null;
  
  // Try MM/DD/YY format
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    return new Date(2000 + year, month - 1, day);
  }
  
  // Try MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Handle format like "03/13/24" (from your data)
  if (/^\d{2}\/\d{2}\/\d{2}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    // Assume 20xx for two-digit years
    return new Date(2000 + year, month - 1, day);
  }
  
  // Try other formats
  const date = new Date(dateString);
  return isNaN(date) ? null : date;
}

// Export the main function
window.getDistributionData = getDistributionData;
