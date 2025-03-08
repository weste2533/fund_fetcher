/**
 * Fund Distribution Data Processor
 * Processes distribution data for both mutual funds and money market funds
 */

/**
 * Main function to get distribution data for a specified ticker and date range
 * @param {string} ticker - The fund ticker symbol
 * @param {string|Date} startDate - Start date for data range
 * @param {string|Date} endDate - Optional end date for data range, defaults to current date
 * @return {Object} Object containing distribution data
 */
function getDistributionData(ticker, startDate, endDate = new Date()) {
    // Convert string dates to Date objects if needed
    startDate = startDate instanceof Date ? startDate : new Date(startDate);
    endDate = endDate instanceof Date ? endDate : new Date(endDate);
    
    // Determine fund type and get appropriate data
    const fundData = findFundData(ticker);
    
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
}

/**
 * Find the fund data for a specific ticker
 * @param {string} ticker - The fund ticker symbol
 * @return {Object|null} Fund data and type, or null if not found
 */
function findFundData(ticker) {
    // This would normally read from files, but for demonstration we'll use the provided data
    const fundsData = {
        'ANCFX': {
            type: 'mutual',
            data: `Record Date\tCalculated Date\tPay Date\tIncome Dividend Regular\tIncome Dividend Special\tCap. Gains Long-Term\tCap. Gains Short-Term\tReinvest NAV
03/13/24\t03/13/24\t03/14/24\t$0.17\t$0.00\t$0.00\t$0.00\t$77.91
06/12/24\t06/12/24\t06/13/24\t$0.17\t$0.00\t$0.498\t$0.00\t$80.73
09/18/24\t09/18/24\t09/19/24\t$0.17\t$0.00\t$0.00\t$0.00\t$83.16
12/18/24\t12/18/24\t12/19/24\t$0.17\t$0.238\t$5.7645\t$0.00\t$81.01
01/17/25\t01/17/25\t01/18/24\t$0.17\t$0.238\t$5.7645\t$0.00\t$83.38`
        },
        'AGTHX': {
            type: 'mutual',
            data: `Record Date\tCalculated Date\tPay Date\tIncome Dividend Regular\tIncome Dividend Special\tCap. Gains Long-Term\tCap. Gains Short-Term\tReinvest NAV
12/18/24\t12/18/24\t12/19/24\t$0.31\t$0.00\t$6.381\t$0.00\t$74.88
01/17/25\t01/17/25\t01/18/25\t$0.31\t$0.00\t$6.381\t$0.00\t$76.98`
        },
        'AFAXX': {
            type: 'mmf',
            data: generateMMFDataObject()
        }
    };
    
    return fundsData[ticker] || null;
}

/**
 * Generate a data object from the MMF text file format
 * @return {Object} Structured MMF data
 */
function generateMMFDataObject() {
    // This would normally parse the file, but for demonstration we'll use a small sample
    const mmfSampleLines = [
        "Rate\tAs of Date",
        "0.00026731\t01/02/2024",
        "0.00013392\t01/03/2024",
        "0.00013540\t01/04/2024",
        // Add more recent entries to demonstrate cutoff functionality
        "0.00010609\t02/11/2025",
        "0.00010599\t02/12/2025",
        "0.00010600\t02/13/2025",
        "0.00010577\t02/14/2025",
        "0.00042388\t02/18/2025",
        "0.00010597\t02/19/2025",
        "0.00010562\t02/20/2025",
        "0.00010590\t02/21/2025",
        "0.00030173\t02/24/2025",
        "0.00010574\t02/25/2025",
        "0.00010570\t02/26/2025",
        "0.00010551\t02/27/2025",
        "0.00010574\t02/28/2025"
    ].join("\n");
    
    return mmfSampleLines;
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
 * Reads actual text file data from the server
 * In a real-world scenario, this would fetch the file based on the ticker
 * @param {string} ticker - The fund ticker
 * @return {Promise<Object>} Fund data and type
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
            throw new Error(`Failed to fetch ${filePath}`);
        }
        
        const data = await response.text();
        return { type: fundType, data: data };
    } catch (error) {
        console.error(`Error fetching fund data: ${error.message}`);
        return null;
    }
}

/**
 * The actual implementation that would be used in a real-world scenario
 * This version fetches the data from actual text files
 */
async function getDistributionDataFromFiles(ticker, startDate, endDate = new Date()) {
    // Convert string dates to Date objects if needed
    startDate = startDate instanceof Date ? startDate : new Date(startDate);
    endDate = endDate instanceof Date ? endDate : new Date(endDate);
    
    // Fetch the fund data
    const fundData = await fetchFundData(ticker);
    
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
}

// For browser usage
if (typeof window !== 'undefined') {
    window.getDistributionData = getDistributionData;
    window.getDistributionDataFromFiles = getDistributionDataFromFiles;
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDistributionData,
        getDistributionDataFromFiles
    };
}
