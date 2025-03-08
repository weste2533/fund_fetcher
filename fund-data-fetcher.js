/**
 * Fund Data Fetcher
 * 
 * This module fetches historical Net Asset Value (NAV) data for mutual funds
 * from Yahoo Finance and returns it in a simplified date/NAV format.
 * 
 * FUNCTIONS:
 * 
 * fetchFundData(ticker, startDate, endDate = null)
 *   Fetches historical NAV data for a specified fund within a date range.
 *   
 *   Parameters:
 *     - ticker (String): The fund's ticker symbol (e.g., 'ANCFX', 'AGTHX')
 *     - startDate (String or Date): Start date in 'YYYY-MM-DD' format or Date object
 *     - endDate (String or Date, optional): End date in 'YYYY-MM-DD' format or Date object,
 *                                           defaults to current date if not provided
 *   
 *   Returns:
 *     - Promise that resolves to an Array of objects, each containing:
 *       {
 *         date: String (in 'YYYY-MM-DD' format),
 *         nav: Number (the fund's NAV value)
 *       }
 * 
 * USAGE EXAMPLE:
 * 
 * fetchFundData('ANCFX', '2024-01-01')
 *   .then(data => console.log(data))
 *   .catch(error => console.error('Error:', error));
 */

// List of CORS proxies to try (will attempt each in order until success)
const PROXIES = [
    "https://api.allorigins.win/get?url=",
    "https://corsproxy.io/?", 
    "https://thingproxy.freeboard.io/fetch/",
    "https://cors-anywhere.herokuapp.com/"
];

/**
 * Fetches fund NAV data from Yahoo Finance for the specified ticker and date range
 * 
 * @param {string} ticker - Fund ticker symbol (e.g., 'ANCFX')
 * @param {string|Date} startDate - Start date in 'YYYY-MM-DD' format or Date object
 * @param {string|Date|null} endDate - End date (optional, defaults to current date)
 * @returns {Promise<Array>} - Promise resolving to array of {date, nav} objects
 */
async function fetchFundData(ticker, startDate, endDate = null) {
    // Convert date parameters to Date objects if they're strings
    const start = startDate instanceof Date ? startDate : new Date(startDate);
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : new Date();
    
    // Convert to Unix timestamps (seconds)
    const period1 = Math.floor(start.getTime() / 1000);
    const period2 = Math.floor(end.getTime() / 1000);
    
    // Yahoo Finance API URL
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
    
    try {
        // Fetch data using proxy
        const data = await fetchWithProxy(url);
        
        // Process the response
        if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('Invalid or empty response from Yahoo Finance');
        }
        
        const result = data.chart.result[0];
        const timestamps = result.timestamp || [];
        const prices = result.indicators?.quote?.[0]?.close || [];
        
        // Create an array of {date, nav} objects
        return timestamps.map((timestamp, index) => {
            const date = new Date(timestamp * 1000);
            return {
                date: formatDate(date),
                nav: prices[index]
            };
        });
    } catch (error) {
        throw new Error(`Failed to fetch data for ${ticker}: ${error.message}`);
    }
}

/**
 * Attempts to fetch data using multiple CORS proxies
 * 
 * @param {string} url - The URL to fetch
 * @returns {Promise<Object>} - The parsed JSON response
 */
async function fetchWithProxy(url) {
    for (let proxyIndex = 0; proxyIndex < PROXIES.length; proxyIndex++) {
        const proxyUrl = PROXIES[proxyIndex] + encodeURIComponent(url);
        
        try {
            const response = await fetch(proxyUrl, { cache: 'no-cache' });
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const text = await response.text();
            
            // Handle allorigins.win specific response format
            if (proxyUrl.includes('allorigins.win')) {
                const jsonResponse = JSON.parse(text);
                if (jsonResponse.contents) {
                    return JSON.parse(jsonResponse.contents);
                }
            }
            
            return JSON.parse(text);
        } catch (error) {
            // Try next proxy if this one fails
            continue;
        }
    }
    
    throw new Error('All proxies failed to fetch data');
}

/**
 * Formats a Date object to YYYY-MM-DD string
 * 
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Export the main function
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchFundData };
}
