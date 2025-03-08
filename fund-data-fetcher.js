/**
 * Fund Data Fetcher (with Debug Logging)
 * 
 * This module fetches historical NAV data and logs data structures to console.
 */

// List of CORS proxies to try (will attempt each in order until success)
const PROXIES = [
    "https://api.allorigins.win/get?url=",
    "https://corsproxy.io/?", 
    "https://thingproxy.freeboard.io/fetch/",
    "https://cors-anywhere.herokuapp.com/"
];

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
        console.log(`Starting fetch for ${ticker} from ${start.toISOString()} to ${end.toISOString()}`);
        const data = await fetchWithProxy(url);
        
        // Log raw response structure
        console.log(`RAW YAHOO RESPONSE FOR ${ticker}:`, JSON.parse(JSON.stringify(data)));
        
        if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('Invalid or empty response from Yahoo Finance');
        }
        
        const result = data.chart.result[0];
        // Log chart result structure
        console.log(`CHART RESULT STRUCTURE FOR ${ticker}:`, {
            meta: result.meta,
            timestamp: result.timestamp?.length,
            indicators: Object.keys(result.indicators?.quote?.[0] || {})
        });
        
        const timestamps = result.timestamp || [];
        const prices = result.indicators?.quote?.[0]?.close || [];
        
        // Create processed data array
        const processedData = timestamps.map((timestamp, index) => {
            const date = new Date(timestamp * 1000);
            return {
                date: formatDate(date),
                nav: prices[index]
            };
        });

        // Log final processed data structure
        console.log(`PROCESSED DATA FOR ${ticker}:`, {
            dataPoints: processedData.length,
            firstEntry: processedData[0],
            lastEntry: processedData[processedData.length - 1]
        });
        
        return processedData;
    } catch (error) {
        console.error(`ERROR STRUCTURE FOR ${ticker}:`, {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n')[0]
        });
        throw new Error(`Failed to fetch data for ${ticker}: ${error.message}`);
    }
}

async function fetchWithProxy(url) {
    for (let proxyIndex = 0; proxyIndex < PROXIES.length; proxyIndex++) {
        const proxyUrl = PROXIES[proxyIndex] + encodeURIComponent(url);
        console.log(`Attempting proxy #${proxyIndex + 1}: ${PROXIES[proxyIndex]}`);
        
        try {
            const response = await fetch(proxyUrl, { cache: 'no-cache' });
            console.log(`Proxy #${proxyIndex + 1} response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
            
            const text = await response.text();
            console.log(`Proxy #${proxyIndex + 1} response length: ${text.length} chars`);
            
            if (proxyUrl.includes('allorigins.win')) {
                const jsonResponse = JSON.parse(text);
                if (jsonResponse.contents) {
                    return JSON.parse(jsonResponse.contents);
                }
            }
            
            return JSON.parse(text);
        } catch (error) {
            console.warn(`Proxy #${proxyIndex + 1} failed: ${error.message}`);
            continue;
        }
    }
    
    throw new Error('All proxies failed to fetch data');
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Export the main function
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchFundData };
}
