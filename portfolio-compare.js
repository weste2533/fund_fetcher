/**
 * Portfolio Comparison Module
 * Compares performance between a Money Market Fund portfolio and a Mutual Funds portfolio
 * Tracks daily values with distribution reinvestment
 */

/**
 * Calculate the comparison between two portfolios
 * @param {Object} fundData - The fund data object containing NAV and distribution data
 * @param {Object} portfolioConfig - Configuration for the portfolios
 * @returns {Object} - Comparison results for both portfolios
 */
function calculatePortfolioComparison(fundData, portfolioConfig) {
    // Validate inputs
    if (!fundData || !portfolioConfig) {
        throw new Error('Missing required data for portfolio comparison');
    }
    
    if (!fundData.AFAXX || !fundData.AGTHX || !fundData.ANCFX) {
        throw new Error('Missing required fund data for portfolio comparison');
    }
    
    // Preparation: Standardize the format of merged data for all funds
    // Ensure dates are in ascending order (oldest first)
    const preparedData = {
        AFAXX: prepareTimeSeries(fundData.AFAXX.merged),
        AGTHX: prepareTimeSeries(fundData.AGTHX.merged),
        ANCFX: prepareTimeSeries(fundData.ANCFX.merged)
    };
    
    // Get a list of all available dates from all funds
    const allDates = getAllDates([
        preparedData.AFAXX,
        preparedData.AGTHX,
        preparedData.ANCFX
    ]);
    
    // Calculate MMF Portfolio (AFAXX)
    const mmfPortfolio = calculateMMFPortfolio(
        preparedData.AFAXX,
        portfolioConfig.mmf.units,
        portfolioConfig.mmf.startDate
    );
    
    // Calculate Mutual Funds Portfolio (AGTHX + ANCFX)
    const mutualFundsPortfolio = calculateMutualFundsPortfolio(
        preparedData.AGTHX,
        preparedData.ANCFX,
        portfolioConfig.mutualFunds.AGTHX,
        portfolioConfig.mutualFunds.ANCFX,
        portfolioConfig.mutualFunds.startDate
    );
    
    // Calculate daily value for both portfolios on the same date scale
    const commonDailyValues = alignPortfolioSeries(mmfPortfolio, mutualFundsPortfolio, allDates);
    
    // Compare the performance metrics
    const comparison = {
        mmfPortfolio: summarizePortfolio(mmfPortfolio, 'MMF Portfolio'),
        mutualFundsPortfolio: summarizePortfolio(mutualFundsPortfolio, 'Mutual Funds Portfolio'),
        dailyValues: commonDailyValues
    };
    
    return comparison;
}

/**
 * Prepare time series data for calculations by standardizing format and ordering
 * @param {Array} data - The fund data array
 * @returns {Array} - Sorted and standardized data
 */
function prepareTimeSeries(data) {
    if (!data || data.length === 0) {
        return [];
    }
    
    // Create a copy to avoid modifying the original data
    const processed = [...data];
    
    // Sort by date (ascending - oldest first)
    processed.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return processed;
}

/**
 * Get a merged array of all unique dates from multiple time series
 * @param {Array} dataSeries - Array of data series, each containing date entries
 * @returns {Array} - Sorted array of unique dates
 */
function getAllDates(dataSeries) {
    const dateSet = new Set();
    
    // Collect all dates from all series
    dataSeries.forEach(series => {
        series.forEach(item => {
            dateSet.add(item.date);
        });
    });
    
    // Convert to array and sort chronologically
    const dateArray = Array.from(dateSet);
    dateArray.sort((a, b) => new Date(a) - new Date(b));
    
    return dateArray;
}

/**
 * Calculate the MMF portfolio value over time
 * @param {Array} mmfData - The AFAXX fund data
 * @param {Number} initialUnits - Initial number of units
 * @param {String} startDate - Starting date for tracking
 * @returns {Object} - Portfolio tracking data
 */
function calculateMMFPortfolio(mmfData, initialUnits, startDate) {
    const portfolio = {
        name: 'MMF Portfolio',
        ticker: 'AFAXX',
        initialUnits: initialUnits,
        initialDate: startDate,
        currentUnits: initialUnits,
        dailyValues: []
    };
    
    // Filter data to only include dates from the start date
    const filteredData = mmfData.filter(item => {
        return new Date(item.date) >= new Date(startDate);
    });
    
    if (filteredData.length === 0) {
        return portfolio;
    }
    
    // Initial portfolio value
    let units = initialUnits;
    let initialNav = filteredData[0].nav;
    let initialValue = units * initialNav;
    
    // Calculate daily values with reinvestment
    filteredData.forEach(item => {
        // Add distribution to the portfolio (reinvest)
        if (item.distRatio > 0) {
            // Calculate additional units from distribution
            const additionalUnits = units * item.distRatio;
            units += additionalUnits;
        }
        
        // Calculate portfolio value for this day
        const dailyValue = units * item.nav;
        
        // Add to daily values array
        portfolio.dailyValues.push({
            date: item.date,
            units: units,
            nav: item.nav,
            value: dailyValue,
            changeFromStart: ((dailyValue - initialValue) / initialValue) * 100
        });
    });
    
    // Update current units
    portfolio.currentUnits = units;
    
    return portfolio;
}

/**
 * Calculate the Mutual Funds portfolio value over time
 * @param {Array} agthxData - The AGTHX fund data
 * @param {Array} ancfxData - The ANCFX fund data
 * @param {Number} agthxUnits - Initial AGTHX units
 * @param {Number} ancfxUnits - Initial ANCFX units
 * @param {String} startDate - Starting date for tracking
 * @returns {Object} - Portfolio tracking data
 */
function calculateMutualFundsPortfolio(agthxData, ancfxData, agthxUnits, ancfxUnits, startDate) {
    const portfolio = {
        name: 'Mutual Funds Portfolio',
        initialDate: startDate,
        initialAGTHXUnits: agthxUnits,
        initialANCFXUnits: ancfxUnits,
        currentAGTHXUnits: agthxUnits,
        currentANCFXUnits: ancfxUnits,
        dailyValues: []
    };
    
    // Filter data to only include dates from the start date
    const filteredAGTHX = agthxData.filter(item => {
        return new Date(item.date) >= new Date(startDate);
    });
    
    const filteredANCFX = ancfxData.filter(item => {
        return new Date(item.date) >= new Date(startDate);
    });
    
    if (filteredAGTHX.length === 0 || filteredANCFX.length === 0) {
        return portfolio;
    }
    
    // Create a date map for easy lookups
    const agthxByDate = {};
    filteredAGTHX.forEach(item => {
        agthxByDate[item.date] = item;
    });
    
    const ancfxByDate = {};
    filteredANCFX.forEach(item => {
        ancfxByDate[item.date] = item;
    });
    
    // Get all dates from both funds
    const allDates = getAllDates([filteredAGTHX, filteredANCFX]);
    
    // Initial values
    let agthxUnitsCount = agthxUnits;
    let ancfxUnitsCount = ancfxUnits;
    
    // Calculate initial portfolio value
    const initialDate = allDates[0];
    let initialAgthxNav = 0;
    let initialAncfxNav = 0;
    
    // Find closest date with data for initial values
    for (let i = 0; i < allDates.length; i++) {
        const date = allDates[i];
        if (!initialAgthxNav && agthxByDate[date]) {
            initialAgthxNav = agthxByDate[date].nav;
        }
        if (!initialAncfxNav && ancfxByDate[date]) {
            initialAncfxNav = ancfxByDate[date].nav;
        }
        if (initialAgthxNav && initialAncfxNav) break;
    }
    
    const initialValue = (agthxUnits * initialAgthxNav) + (ancfxUnits * initialAncfxNav);
    
    // Calculate daily values with reinvestment
    let lastAgthxNav = initialAgthxNav;
    let lastAncfxNav = initialAncfxNav;
    
    allDates.forEach(date => {
        // Process AGTHX for this date
        if (agthxByDate[date]) {
            const agthxItem = agthxByDate[date];
            lastAgthxNav = agthxItem.nav;
            
            // Add distribution to the portfolio (reinvest)
            if (agthxItem.distRatio > 0) {
                // Calculate additional units from distribution
                const additionalUnits = agthxUnitsCount * agthxItem.distRatio;
                agthxUnitsCount += additionalUnits;
            }
        }
        
        // Process ANCFX for this date
        if (ancfxByDate[date]) {
            const ancfxItem = ancfxByDate[date];
            lastAncfxNav = ancfxItem.nav;
            
            // Add distribution to the portfolio (reinvest)
            if (ancfxItem.distRatio > 0) {
                // Calculate additional units from distribution
                const additionalUnits = ancfxUnitsCount * ancfxItem.distRatio;
                ancfxUnitsCount += additionalUnits;
            }
        }
        
        // Calculate combined portfolio value for this day
        const agthxValue = agthxUnitsCount * lastAgthxNav;
        const ancfxValue = ancfxUnitsCount * lastAncfxNav;
        const totalValue = agthxValue + ancfxValue;
        
        // Add to daily values array
        portfolio.dailyValues.push({
            date: date,
            agthxUnits: agthxUnitsCount,
            ancfxUnits: ancfxUnitsCount,
            agthxNav: lastAgthxNav,
            ancfxNav: lastAncfxNav,
            agthxValue: agthxValue,
            ancfxValue: ancfxValue,
            value: totalValue,
            changeFromStart: ((totalValue - initialValue) / initialValue) * 100
        });
    });
    
    // Update current units
    portfolio.currentAGTHXUnits = agthxUnitsCount;
    portfolio.currentANCFXUnits = ancfxUnitsCount;
    
    return portfolio;
}

/**
 * Align portfolio time series to have values for all common dates
 * @param {Object} portfolio1 - First portfolio
 * @param {Object} portfolio2 - Second portfolio
 * @param {Array} allDates - Array of all dates to include
 * @returns {Array} - Array of daily comparison data points
 */
function alignPortfolioSeries(portfolio1, portfolio2, allDates) {
    const result = [];
    
    // Create date maps for each portfolio
    const p1ByDate = {};
    portfolio1.dailyValues.forEach(item => {
        p1ByDate[item.date] = item;
    });
    
    const p2ByDate = {};
    portfolio2.dailyValues.forEach(item => {
        p2ByDate[item.date] = item;
    });
    
    // Find first date where both portfolios have data
    let startDate = null;
    let p1StartValue = null;
    let p2StartValue = null;
    
    for (const date of allDates) {
        if (p1ByDate[date] && p2ByDate[date]) {
            startDate = date;
            p1StartValue = p1ByDate[date].value;
            p2StartValue = p2ByDate[date].value;
            break;
        }
    }
    
    if (!startDate) {
        return result; // No common dates found
    }
    
    // For each date, create a comparison point
    allDates.forEach(date => {
        // Only include dates after the start date
        if (new Date(date) >= new Date(startDate)) {
            const p1 = p1ByDate[date];
            const p2 = p2ByDate[date];
            
            if (p1 && p2) {
                // Calculate relative performance (indexed to 100 at start)
                const p1Index = (p1.value / p1StartValue) * 100;
                const p2Index = (p2.value / p2StartValue) * 100;
                
                result.push({
                    date: date,
                    p1Value: p1.value,
                    p2Value: p2.value,
                    p1Index: p1Index,
                    p2Index: p2Index,
                    difference: p2Index - p1Index // Positive means p2 outperforms
                });
            }
        }
    });
    
    return result;
}

/**
 * Generate summary statistics for a portfolio
 * @param {Object} portfolio - Portfolio data
 * @param {String} name - Portfolio name
 * @returns {Object} - Summary statistics
 */
function summarizePortfolio(portfolio, name) {
    if (!portfolio.dailyValues || portfolio.dailyValues.length === 0) {
        return {
            name: name,
            initialValue: 0,
            currentValue: 0,
            change: 0,
            changePercent: 0
        };
    }
    
    const initialValue = portfolio.dailyValues[0].value;
    const currentValue = portfolio.dailyValues[portfolio.dailyValues.length - 1].value;
    const change = currentValue - initialValue;
    const changePercent = (change / initialValue) * 100;
    
    // Calculate annualized return
    const startDate = new Date(portfolio.dailyValues[0].date);
    const endDate = new Date(portfolio.dailyValues[portfolio.dailyValues.length - 1].date);
    const yearFraction = (endDate - startDate) / (365 * 24 * 60 * 60 * 1000);
    
    // Only calculate if we have reasonable data (at least 7 days)
    let annualizedReturn = 0;
    if (yearFraction > 0.02) { // More than ~7 days
        annualizedReturn = (Math.pow((currentValue / initialValue), (1 / yearFraction)) - 1) * 100;
    }
    
    // Find minimum and maximum values
    let minValue = Infinity;
    let maxValue = -Infinity;
    let minDate = '';
    let maxDate = '';
    
    portfolio.dailyValues.forEach(day => {
        if (day.value < minValue) {
            minValue = day.value;
            minDate = day.date;
        }
        if (day.value > maxValue) {
            maxValue = day.value;
            maxDate = day.date;
        }
    });
    
    // Calculate volatility (standard deviation of daily returns)
    let sumReturns = 0;
    let sumSquaredReturns = 0;
    let countReturns = 0;
    
    for (let i = 1; i < portfolio.dailyValues.length; i++) {
        const previousValue = portfolio.dailyValues[i-1].value;
        const currentValue = portfolio.dailyValues[i].value;
        const dailyReturn = (currentValue - previousValue) / previousValue;
        
        sumReturns += dailyReturn;
        sumSquaredReturns += dailyReturn * dailyReturn;
        countReturns++;
    }
    
    const avgReturn = sumReturns / countReturns;
    const variance = (sumSquaredReturns / countReturns) - (avgReturn * avgReturn);
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
    
    return {
        name: name,
        initialValue: initialValue,
        currentValue: currentValue,
        change: change,
        changePercent: changePercent,
        annualizedReturn: annualizedReturn,
        minValue: minValue,
        maxValue: maxValue,
        minDate: minDate,
        maxDate: maxDate,
        volatility: volatility,
        currentUnits: portfolio.currentUnits || null,
        currentAGTHXUnits: portfolio.currentAGTHXUnits || null,
        currentANCFXUnits: portfolio.currentANCFXUnits || null
    };
}

/**
 * Display the portfolio comparison results on the page
 * @param {Object} comparison - Portfolio comparison data
 */
function displayPortfolioComparison(comparison) {
    const mmf = comparison.mmfPortfolio;
    const mutualFunds = comparison.mutualFundsPortfolio;
    
    // Format the portfolio cards
    const container = document.getElementById('portfolio-cards');
    container.innerHTML = '';
    
    // MMF Portfolio Card
    const mmfCard = document.createElement('div');
    mmfCard.className = 'portfolio-card mmf';
    mmfCard.innerHTML = `
        <h3>Money Market Fund (AFAXX)</h3>
        <div class="portfolio-stat">
            <span class="portfolio-label">Current Value:</span>
            <span class="portfolio-value">$${mmf.currentValue ? mmf.currentValue.toFixed(2) : '0.00'}</span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Initial Value:</span>
            <span class="portfolio-value">$${mmf.initialValue ? mmf.initialValue.toFixed(2) : '0.00'}</span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Change:</span>
            <span class="portfolio-value ${mmf.change >= 0 ? 'positive-change' : 'negative-change'}">
                $${mmf.change ? mmf.change.toFixed(2) : '0.00'} (${mmf.changePercent ? mmf.changePercent.toFixed(2) : '0.00'}%)
            </span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Annualized Return:</span>
            <span class="portfolio-value ${mmf.annualizedReturn >= 0 ? 'positive-change' : 'negative-change'}">
                ${mmf.annualizedReturn ? mmf.annualizedReturn.toFixed(2) : '0.00'}%
            </span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Volatility:</span>
            <span class="portfolio-value">${mmf.volatility ? mmf.volatility.toFixed(2) : '0.00'}%</span>
        </div>
        <div class="holdings-details">
            <div class="holdings-title">Current Holdings</div>
            <div class="portfolio-stat">
                <span class="portfolio-label">AFAXX Units:</span>
                <span class="portfolio-value">${mmf.currentUnits ? mmf.currentUnits.toFixed(2) : 'N/A'}</span>
            </div>
        </div>
    `;
    
    // Mutual Funds Portfolio Card
    const mutualFundsCard = document.createElement('div');
    mutualFundsCard.className = 'portfolio-card mutual-funds';
    mutualFundsCard.innerHTML = `
        <h3>Mutual Funds Portfolio</h3>
        <div class="portfolio-stat">
            <span class="portfolio-label">Current Value:</span>
            <span class="portfolio-value">$${mutualFunds.currentValue ? mutualFunds.currentValue.toFixed(2) : '0.00'}</span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Initial Value:</span>
            <span class="portfolio-value">$${mutualFunds.initialValue ? mutualFunds.initialValue.toFixed(2) : '0.00'}</span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Change:</span>
            <span class="portfolio-value ${mutualFunds.change >= 0 ? 'positive-change' : 'negative-change'}">
                $${mutualFunds.change ? mutualFunds.change.toFixed(2) : '0.00'} (${mutualFunds.changePercent ? mutualFunds.changePercent.toFixed(2) : '0.00'}%)
            </span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Annualized Return:</span>
            <span class="portfolio-value ${mutualFunds.annualizedReturn >= 0 ? 'positive-change' : 'negative-change'}">
                ${mutualFunds.annualizedReturn ? mutualFunds.annualizedReturn.toFixed(2) : '0.00'}%
            </span>
        </div>
        <div class="portfolio-stat">
            <span class="portfolio-label">Volatility:</span>
            <span class="portfolio-value">${mutualFunds.volatility ? mutualFunds.volatility.toFixed(2) : '0.00'}%</span>
        </div>
        <div class="holdings-details">
            <div class="holdings-title">Current Holdings</div>
            <div class="portfolio-stat">
                <span class="portfolio-label">AGTHX Units:</span>
                <span class="portfolio-value">${mutualFunds.currentAGTHXUnits ? mutualFunds.currentAGTHXUnits.toFixed(3) : 'N/A'}</span>
            </div>
            <div class="portfolio-stat">
                <span class="portfolio-label">ANCFX Units:</span>
                <span class="portfolio-value">${mutualFunds.currentANCFXUnits ? mutualFunds.currentANCFXUnits.toFixed(3) : 'N/A'}</span>
            </div>
        </div>
    `;
    
    // Add to container
    container.appendChild(mmfCard);
    container.appendChild(mutualFundsCard);
    
    // Add comparison chart
    // This would typically use a charting library like Chart.js
    // For this example, we'll just console log the data
    console.log('Portfolio comparison data for charting:', comparison.dailyValues);
}
