/**
 * Fund Distribution Data Processor
 * Processes historical distribution data for mutual funds and money market funds (MMF),
 * loading text files from the server and outputting normalized distribution data.
 *
 * Each output item includes:
 *  - date:   Formatted as YYYY-MM-DD
 *  - nav:    Net Asset Value (for MMF funds, always 1.00)
 *  - dist:   Distribution per share (USD)
 *
 * Usage (from an index.html file):
 * 
 *   getDistributionData(ticker, startDate, [endDate])
 *     .then(data => {
 *       if(data.error) {
 *         console.error(data.error);
 *       } else {
 *         console.log(data.items);
 *       }
 *     })
 *     .catch(error => console.error(error));
 */

/**
 * Fetches and processes distribution data for a given ticker and date range.
 * @param {string} ticker - Fund ticker symbol (case-sensitive)
 * @param {string|Date} startDate - Start date for historical data (YYYY-MM-DD or Date)
 * @param {string|Date} [endDate] - Optional end date (defaults to current date)
 * @returns {Promise<Object>} - Object containing an items array or an error property.
 */
async function getDistributionData(ticker, startDate, endDate = new Date()) {
    // Convert string dates to Date objects if needed
    startDate = (startDate instanceof Date) ? startDate : new Date(startDate);
    endDate = (endDate instanceof Date) ? endDate : new Date(endDate);

    // Fetch the fund data from the corresponding text file
    const fundData = await fetchFundData(ticker);
    if (!fundData) {
        return { error: `No data found for ticker ${ticker}` };
    }

    // Process the data based on fund type
    if (fundData.type === 'mmf') {
        return processMMFData(fundData.data, startDate, endDate);
    } else if (fundData.type === 'mutual') {
        return processMutualFundData(fundData.data, startDate, endDate);
    } else {
        return { error: 'Unknown fund type' };
    }
}

/**
 * Fetches the fund data text file from the server.
 * @param {string} ticker - The fund ticker.
 * @returns {Promise<Object|null>} - Object with 'type' and 'data' properties, or null if an error occurs.
 */
async function fetchFundData(ticker) {
    try {
        let filePath;
        let fundType;

        // Determine file path and type based on ticker naming convention.
        // For MMF funds, file names start with 'mmf_'
        if (ticker.startsWith('AF')) {
            filePath = `mmf_${ticker}_distributions.txt`;
            fundType = 'mmf';
        } else {
            filePath = `mutual_${ticker}_distributions.txt`;
            fundType = 'mutual';
        }

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
 * Processes money market fund (MMF) data.
 * Expects data in TSV format with headers: "Rate" and "As of Date".
 * @param {string} data - Raw text data.
 * @param {Date} startDate - Start date for filtering.
 * @param {Date} endDate - End date for filtering.
 * @returns {Object} - Object containing an items array.
 */
function processMMFData(data, startDate, endDate) {
    const lines = data.split('\n');
    const result = { items: [] };

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [rate, dateStr] = line.split('\t');

        // Parse the date (assumed format MM/DD/YYYY)
        const [month, day, year] = dateStr.split('/');
        const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const date = new Date(formattedDate);

        // Check if date is within the specified range
        if (date >= startDate && date <= endDate) {
            result.items.push({
                date: formatDate(date),
                nav: 1.00, // MMF funds have a constant NAV of 1.00
                dist: parseFloat(rate)
            });
        }
    }

    return result;
}

/**
 * Processes mutual fund data.
 * Expects data in TSV format with headers:
 * "Record Date", "Calculated Date", "Pay Date", "Income Dividend Regular",
 * "Income Dividend Special", "Cap. Gains Long-Term", "Cap. Gains Short-Term", "Reinvest NAV"
 * @param {string} data - Raw text data.
 * @param {Date} startDate - Start date for filtering.
 * @param {Date} endDate - End date for filtering.
 * @returns {Object} - Object containing an items array.
 */
function processMutualFundData(data, startDate, endDate) {
    const lines = data.split('\n');
    const result = { items: [] };

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split('\t');

        // Parse record date (assumed format MM/DD/YY or MM/DD/YYYY)
        const recordDateStr = parts[0];
        const [month, day, year] = recordDateStr.split('/');
        const fullYear = (year.length === 2) ? `20${year}` : year;
        const formattedDate = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        const date = new Date(formattedDate);

        // Check if date is within the specified range
        if (date >= startDate && date <= endDate) {
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
 * Formats a Date object as a string in YYYY-MM-DD format.
 * @param {Date} date - The date to format.
 * @returns {string} - Formatted date string.
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Expose the getDistributionData function for usage in index.html
if (typeof window !== 'undefined') {
    window.getDistributionData = getDistributionData;
}

// For Node.js usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getDistributionData,
        fetchFundData,
        processMMFData,
        processMutualFundData,
        formatDate
    };
}
