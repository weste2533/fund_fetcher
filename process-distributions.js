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
  return new Promise((resolve, reject) => {
    try {
      // Validate inputs
      if (!ticker || typeof ticker !== 'string') {
        return resolve({ error: 'Invalid ticker symbol', items: [] });
      }
      
      // Parse dates
      const parsedStartDate = parseDate(startDate);
      const parsedEndDate = parseDate(endDate);
      
      if (!parsedStartDate) {
        return resolve({ error: 'Invalid start date format', items: [] });
      }
      
      if (!parsedEndDate) {
        return resolve({ error: 'Invalid end date format', items: [] });
      }
      
      if (parsedStartDate > parsedEndDate) {
        return resolve({ error: 'Start date cannot be after end date', items: [] });
      }
      
      // Determine fund type and fetch data
      const filename = `${ticker.toLowerCase().startsWith('mmf_') ? 'mmf' : 'mutual'}_${ticker}_distributions.txt`;

      console.log(`Starting fetch for {filename}`);
      
      fetchDistributionFile(ticker)
        .then(data => {
          if (!data) {
            return resolve({ error: `No data found for ticker ${ticker}`, items: [] });
            console.log('No data found for ticker ${ticker}');
          }
          
          // Process data based on fund type
          let items = [];
          
          if (isMmfTicker(ticker)) {
            items = parseMmfData(data, parsedStartDate, parsedEndDate);
          } else {
            items = parseMutualFundData(data, parsedStartDate, parsedEndDate);
          }
          
          // Sort by date (oldest first)
          items.sort((a, b) => new Date(a.date) - new Date(b.date));
          
          resolve({ items });
        })
        .catch(error => {
          resolve({ error: `Error fetching distribution data: ${error.message}`, items: [] });
        });
    } catch (error) {
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
  return new Promise((resolve, reject) => {
    // In a real implementation, this would use fetch to get the file from the server
    // For GitHub Pages, we'll use the file pattern
    const filePrefix = isMmfTicker(ticker) ? 'mmf' : 'mutual';
    const filename = `${filePrefix}_${ticker}_distributions.txt`;
    
    fetch(filename)
      .then(response => {
        if (!response.ok) {
          throw new Error(`File not found: ${filename}`);
        }
        return response.text();
      })
      .then(data => resolve(data))
      .catch(error => reject(error));
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
  const lines = data.trim().split('\n');
  
  // Skip header line
  const items = [];
  
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split('\t');
    
    // MM/DD/YY format expected for record date
    let recordDateStr = parts[0];
    
    // Try to parse date in MM/DD/YY format
    let recordDate;
    if (recordDateStr.includes('/')) {
      const [month, day, year] = recordDateStr.split('/').map(Number);
      recordDate = new Date(2000 + year, month - 1, day); // Assumes 20xx for year
    } else {
      // Alternative format like MM/DD/YYYY
      recordDate = new Date(recordDateStr);
    }
    
    // Check if valid date could be parsed
    if (isNaN(recordDate)) {
      continue; // Skip invalid dates
    }
    
    // Check if in date range
    if (recordDate >= startDate && recordDate <= endDate) {
      // Parse numeric values with dollar signs
      const incomeDividendRegular = parseFloat(parts[3].replace('$', '')) || 0;
      const incomeDividendSpecial = parseFloat(parts[4].replace('$', '')) || 0;
      const capGainsLongTerm = parseFloat(parts[5].replace('$', '')) || 0;
      const capGainsShortTerm = parseFloat(parts[6].replace('$', '')) || 0;
      const nav = parseFloat(parts[7].replace('$', '')) || 0;
      
      // Calculate total distribution
      const totalDist = incomeDividendRegular + incomeDividendSpecial + 
                         capGainsLongTerm + capGainsShortTerm;
      
      items.push({
        date: formatISODate(recordDate),
        nav: nav,
        dist: totalDist
      });
    }
  }
  
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
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  
  // Try other formats
  const date = new Date(dateString);
  return isNaN(date) ? null : date;
}

// Export the main function
window.getDistributionData = getDistributionData;
