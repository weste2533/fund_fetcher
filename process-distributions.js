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
 *   .then(data => { /* handle data */ })
 *   .catch(error => { /* handle errors */ });
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
 * - Errors include descriptive messages for troubleshooting
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
async function getDistributionData(ticker, startDate, endDate = new Date()) {
    try {
        // Convert string dates to Date objects if needed
        startDate = startDate instanceof Date ? startDate : new Date(startDate);
        endDate = endDate instanceof Date ? endDate : new Date(endDate);
        
        // Fetch the fund data
        const fundData = await fetchFundData(ticker);
        
        if (!fundData) {
            return { 
                error: `No data found for ticker ${ticker}`,
                items: [] 
            };
        }
        
        // Process data based on fund type
        if (fundData.type === 'mmf') {
            return processMMFData(fundData.data, startDate, endDate);
        } else if (fundData.type === 'mutual') {
            return processMutualFundData(fundData.data, startDate, endDate);
        }
        
        return { 
            error: 'Unknown fund type',
            items: [] 
        };
    } catch (error) {
        console.error(`Error processing distribution data: ${error.message}`);
        return {
            error: `Failed to process data: ${error.message}`,
            items: []
        };
    }
}

/**
 * Fetch fund data from the appropriate file based on ticker
 * @param {string} ticker - The fund ticker
 * @return {Promise<Object|null>} Promise resolving to fund data and type, or null if not found
 */
async function fetchFundData(ticker) {
    try {
        // Determine file path based on ticker
        let filePath;
        let fundType;
        
        if (ticker.startsWith('AF')) {
            filePath = `mmf_${ticker}_distributions.txt`;
            fundType = 'mmf';
        } else {
            filePath = `mutual_${ticker}_distributions.txt`;
            fundType = 'mutual';
        }
        
        // Fetch the file
        const response = await fetch(filePath);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${filePath} (Status: ${response.status})`);
        }
        
        const data = await response.text();
        return { type: fundType, data: data };
    } catch (error) {
        console.error(`Error fetching fund data: ${error.message}`);
        return null;
    }
}

/**
 * Process money market fund data
 * @param {string} data - The raw data string
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @return {Object} Processed distribution data
 */
function processMMFData(data, startDate, endDate) {
    const lines = data.split('\n');
    const result = { items: [] };
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [rate, dateStr] = line.split('\t');
        
        // Parse the date (MM/DD/YYYY format)
        const [month, day, year] = dateStr.split('/');
        const date = new Date(`${year}-${month}-${day}`);
        
        // Check if date is within range
        if (date >= startDate && date <= endDate) {
            result.items.push({
                date: formatDate(date),
                nav: 1.00, // NAV is always 1.00 for MMF
                dist: parseFloat(rate)
            });
        }
    }
    
    // Sort items by date (oldest first)
    result.items.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return result;
}

/**
 * Process mutual fund data
 * @param {string} data - The raw data string
 * @param {Date} startDate - Start date for filtering
 * @param {Date} endDate - End date for filtering
 * @return {Object} Processed distribution data
 */
function processMutualFundData(data, startDate, endDate) {
    const lines = data.split('\n');
    const result = { items: [] };
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split('\t');
        
        // Parse record date (MM/DD/YY format)
        const recordDateStr = parts[0];
        const [month, day, year] = recordDateStr.split('/');
        const fullYear = year.length === 2 ? `20${year}` : year;
        const date = new Date(`${fullYear}-${month}-${day}`);
        
        // Check if date is within range
        if (date >= startDate && date <= endDate) {
            // Calculate total distribution amount (all dividends + all capital gains)
            const regDividend = parseFloat(parts[3].replace('$', '')) || 0;
            const specDividend = parseFloat(parts[4].replace('$', '')) || 0;
            const longTermGains = parseFloat(parts[5].replace('$', '')) || 0;
            const shortTermGains = parseFloat(parts[6].replace('$', '')) || 0;
            const nav = parseFloat(parts[7].replace('$', '')) || 0;
            
            const totalDist = regDividend + specDividend + longTermGains + shortTermGains;
            
            result.items.push({
                date: formatDate(date),
                nav: nav,
                dist: totalDist
            });
        }
    }
    
    // Sort items by date (oldest first)
    result.items.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return result;
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - The date to format
 * @return {string} Formatted date string
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// For browser usage
if (typeof window !== 'undefined') {
    window.getDistributionData = getDistributionData;
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDistributionData
    };
}
