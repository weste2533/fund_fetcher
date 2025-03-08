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
 * @returns {Object} - Structured distribution data containing:
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
 */

/**
 * Main function to get distribution data for a specified ticker and date range
 * @param {string} ticker - The fund ticker symbol
 * @param {string|Date} startDate - Start date for data range
 * @param {string|Date} endDate - Optional end date for data range, defaults to current date
 * @return {Promise<Object>} Promise resolving to object containing distribution data items or error
 */
async function getDistributionData(ticker, startDate, endDate = new Date()) {
    // Convert string dates to Date objects if needed
    startDate = startDate instanceof Date ? startDate : new Date(startDate);
    endDate = endDate instanceof Date ? endDate : new Date(endDate);
    
    try {
        // Determine fund type and get appropriate data
        const fundData = await findFundData(ticker);
        
        if (!fundData) {
            return { error: `No data found for ticker ${ticker}` };
        }
        
        // Process data based on fund type
        if (fundData.type === 'mmf') {
            return processMMFData(fundData.data, startDate, endDate);
        } else if (fundData.type === 'mutual') {
            return processMutualFundData(fundData.data, startDate, endDate);
        }
        
        return { error: 'Unknown fund type' };
    } catch (error) {
        return { error: `Error processing data: ${error.message}` };
    }
}

/**
 * Find the fund data for a specific ticker by reading from text files
 * @param {string} ticker - The fund ticker symbol
 * @return {Promise<Object|null>} Promise resolving to fund data and type, or null if not found
 */
async function findFundData(ticker) {
    try {
        // Determine file path and type based on ticker
        let filePath;
        let fundType;
        
        if (ticker.startsWith('AF')) {
            filePath = `mmf_${ticker}_distributions.txt`;
            fundType = 'mmf';
        } else {
            filePath = `mutual_${ticker}_distributions.txt`;
            fundType = 'mutual';
        }
        
        // Read file content
        const data = await readFileContent(filePath);
        if (!data) {
            throw new Error(`No data found in file for ticker ${ticker}`);
        }
        
        return { type: fundType, data: data };
    } catch (error) {
        console.error(`Error finding fund data: ${error.message}`);
        return null;
    }
}

/**
 * Read the content of a file
 * @param {string} filePath - Path to the file
 * @return {Promise<string|null>} Promise resolving to file content or null if file not found
 */
async function readFileContent(filePath) {
    try {
        // In a browser environment, use fetch
        if (typeof window !== 'undefined') {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${filePath}`);
            }
            return await response.text();
        } 
        // In Node.js environment, use fs module
        else if (typeof require !== 'undefined') {
            const fs = require('fs');
            return fs.readFileSync(filePath, 'utf8');
        }
        
        throw new Error('Unsupported environment for file reading');
    } catch (error) {
        console.error(`Error reading file ${filePath}: ${error.message}`);
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
            const regDividend = parseFloat(parts[3].replace('$', ''));
            const specDividend = parseFloat(parts[4].replace('$', ''));
            const longTermGains = parseFloat(parts[5].replace('$', ''));
            const shortTermGains = parseFloat(parts[6].replace('$', ''));
            const nav = parseFloat(parts[7].replace('$', ''));
            
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

/**
 * Example usage with the actual data files
 */
async function exampleUsage() {
    try {
        // Example 1: Get ANCFX data for 2024
        const ancfxData = await getDistributionData('ANCFX', '2024-01-01', '2024-12-31');
        console.log('ANCFX Distribution items:', ancfxData.items);
        
        // Example 2: Get MMF data for recent period
        const mmfData = await getDistributionData('AFAXX', '2025-01-01');
        if (mmfData.error) {
            console.error('Error:', mmfData.error);
        } else {
            console.log('AFAXX Daily rates:', mmfData.items);
        }
        
        // Example 3: Get AGTHX data for all available dates
        const agthxData = await getDistributionData('AGTHX', '2024-01-01');
        console.log('AGTHX Distribution items:', agthxData.items);
    } catch (error) {
        console.error('Error in example usage:', error);
    }
}

// For browser usage
if (typeof window !== 'undefined') {
    window.getDistributionData = getDistributionData;
    window.exampleUsage = exampleUsage;
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDistributionData
    };
}
