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
    console.log('Entering calculatePortfolioComparison with fundData:', Object.keys(fundData), 'portfolioConfig:', portfolioConfig);

    // Validate inputs
    if (!fundData || !portfolioConfig) {
        throw new Error('Missing required data for portfolio comparison');
    }
    
    if (!fundData.AFAXX || !fundData.AGTHX || !fundData.ANCFX) {
        throw new Error('Missing required fund data for portfolio comparison');
    }

    console.log('Post-validation - AGTHX merged length:', fundData.AGTHX.merged.length); // Debug
    
    // Preparation: Standardize the format of merged data for all funds
    console.log('Preparing time series data...');
    const preparedData = {
        AFAXX: prepareTimeSeries(fundData.AFAXX.merged),
        AGTHX: prepareTimeSeries(fundData.AGTHX.merged),
        ANCFX: prepareTimeSeries(fundData.ANCFX.merged)
    };
    console.log('Prepared data lengths - AFAXX:', preparedData.AFAXX.length, 'AGTHX:', preparedData.AGTHX.length, 'ANCFX:', preparedData.ANCFX.length);
    console.log('Sample AFAXX[0]:', preparedData.AFAXX[0], 'AGTHX[0]:', preparedData.AGTHX[0], 'ANCFX[0]:', preparedData.ANCFX[0]);
    
    // Get a list of all available dates from all funds
    const allDates = getAllDates([
        preparedData.AFAXX,
        preparedData.AGTHX,
        preparedData.ANCFX
    ]);
    console.log('Total unique dates:', allDates.length, 'First date:', allDates[0], 'Last date:', allDates[allDates.length - 1]);
    
    // Calculate MMF Portfolio (AFAXX)
    console.log('Calculating MMF Portfolio...');
    const mmfPortfolio = calculateMMFPortfolio(
        preparedData.AFAXX,
        portfolioConfig.mmf.units,
        portfolioConfig.mmf.startDate
    );
    
    // Calculate Mutual Funds Portfolio (AGTHX + ANCFX)
    console.log('Calculating Mutual Funds Portfolio...');
    const mutualFundsPortfolio = calculateMutualFundsPortfolio(
        preparedData.AGTHX,
        preparedData.ANCFX,
        portfolioConfig.mutualFunds.AGTHX,
        portfolioConfig.mutualFunds.ANCFX,
        portfolioConfig.mutualFunds.startDate
    );
    
    // Calculate daily value for both portfolios on the same date scale
    console.log('Aligning portfolio series...');
    const commonDailyValues = alignPortfolioSeries(mmfPortfolio, mutualFundsPortfolio, allDates);
    console.log('Common daily values length:', commonDailyValues.length, 'Sample:', commonDailyValues[0]);
    
    // Compare the performance metrics
    const comparison = {
        mmfPortfolio: summarizePortfolio(mmfPortfolio, 'MMF Portfolio'),
        mutualFundsPortfolio: summarizePortfolio(mutualFundsPortfolio, 'Mutual Funds Portfolio'),
        dailyValues: commonDailyValues
    };
    console.log('Comparison summary - MMF:', comparison.mmfPortfolio, 'Mutual Funds:', comparison.mutualFundsPortfolio);
    
    return comparison;
}

/**
 * Prepare time series data for calculations by standardizing format and ordering
 * @param {Array} data - The fund data array
 * @returns {Array} - Sorted and standardized data
 */
function prepareTimeSeries(data) {
    if (!data || data.length === 0) {
        console.log('prepareTimeSeries: Empty or null data received');
        return [];
    }
    
    const processed = [...data];
    processed.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log('prepareTimeSeries: Sorted', processed.length, 'items, first:', processed[0]);
    return processed;
}

/**
 * Get a merged array of all unique dates from multiple time series
 * @param {Array} dataSeries - Array of data series, each containing date entries
 * @returns {Array} - Sorted array of unique dates
 */
function getAllDates(dataSeries) {
    const dateSet = new Set();
    dataSeries.forEach(series => {
        series.forEach(item => {
            dateSet.add(item.date);
        });
    });
    const dateArray = Array.from(dateSet);
    dateArray.sort((a, b) => new Date(a) - new Date(b));
    console.log('getAllDates: Unique dates:', dateArray.length);
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
    
    const filteredData = mmfData.filter(item => new Date(item.date) >= new Date(startDate));
    console.log('MMF filtered data length:', filteredData.length, 'First item:', filteredData[0]);
    
    if (filteredData.length === 0) {
        console.log('MMF: No data after startDate', startDate);
        return portfolio;
    }
    
    let units = initialUnits;
    let initialNav = filteredData[0].nav;
    let initialValue = units * initialNav;
    console.log('MMF Initial: units:', units, 'nav:', initialNav, 'value:', initialValue);
    
    filteredData.forEach(item => {
        if (item.distRatio > 0) {
            const additionalUnits = units * item.distRatio;
            units += additionalUnits;
        }
        const dailyValue = units * item.nav;
        portfolio.dailyValues.push({
            date: item.date,
            units: units,
            nav: item.nav,
            value: dailyValue,
            changeFromStart: ((dailyValue - initialValue) / initialValue) * 100
        });
    });
    portfolio.currentUnits = units;
    console.log('MMF Final: units:', units, 'dailyValues length:', portfolio.dailyValues.length, 'Last value:', portfolio.dailyValues[portfolio.dailyValues.length - 1]);
    
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
    // Log the unfiltered lengths for debugging purposes
    console.log('Mutual Funds unfiltered - AGTHX length:', agthxData.length, 'ANCFX length:', ancfxData.length);
 
    
    const portfolio = {
        name: 'Mutual Funds Portfolio',
        initialDate: startDate,
        initialAGTHXUnits: agthxUnits,
        initialANCFXUnits: ancfxUnits,
        currentAGTHXUnits: agthxUnits,
        currentANCFXUnits: ancfxUnits,
        dailyValues: []
    };
    
    const filteredAGTHX = agthxData.filter(item => new Date(item.date) >= new Date(startDate));
    const filteredANCFX = ancfxData.filter(item => new Date(item.date) >= new Date(startDate));
    console.log('Mutual Funds filtered - AGTHX length:', filteredAGTHX.length, 'First:', filteredAGTHX[0]);
    console.log('Mutual Funds filtered - ANCFX length:', filteredANCFX.length, 'First:', filteredANCFX[0]);
    
    if (filteredAGTHX.length === 0 || filteredANCFX.length === 0) {
        console.log('Mutual Funds: Empty filtered data - AGTHX:', filteredAGTHX.length, 'ANCFX:', filteredANCFX.length);
        return portfolio;
    }
    
    const agthxByDate = {};
    filteredAGTHX.forEach(item => agthxByDate[item.date] = item);
    const ancfxByDate = {};
    filteredANCFX.forEach(item => ancfxByDate[item.date] = item);
    
    const allDates = getAllDates([filteredAGTHX, filteredANCFX]);
    console.log('Mutual Funds allDates length:', allDates.length);
    
    let agthxUnitsCount = agthxUnits;
    let ancfxUnitsCount = ancfxUnits;
    
    let initialAgthxNav = filteredAGTHX[0]?.nav || 0;
    let initialAncfxNav = filteredANCFX[0]?.nav || 0;
    console.log('Mutual Funds Initial NAVs - AGTHX:', initialAgthxNav, 'ANCFX:', initialAncfxNav);
    
    const initialValue = (agthxUnits * initialAgthxNav) + (ancfxUnits * initialAncfxNav);
    console.log('Mutual Funds Initial Value:', initialValue);
    
    let lastAgthxNav = initialAgthxNav;
    let lastAncfxNav = initialAncfxNav;
    
    allDates.forEach(date => {
        if (agthxByDate[date]) {
            const agthxItem = agthxByDate[date];
            lastAgthxNav = agthxItem.nav;
            if (agthxItem.distRatio > 0) {
                const additionalUnits = agthxUnitsCount * agthxItem.distRatio;
                agthxUnitsCount += additionalUnits;
            }
        }
        if (ancfxByDate[date]) {
            const ancfxItem = ancfxByDate[date];
            lastAncfxNav = ancfxItem.nav;
            if (ancfxItem.distRatio > 0) {
                const additionalUnits = ancfxUnitsCount * ancfxItem.distRatio;
                ancfxUnitsCount += additionalUnits;
            }
        }
        
        const agthxValue = agthxUnitsCount * lastAgthxNav;
        const ancfxValue = ancfxUnitsCount * lastAncfxNav;
        const totalValue = agthxValue + ancfxValue;
        
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
    
    portfolio.currentAGTHXUnits = agthxUnitsCount;
    portfolio.currentANCFXUnits = ancfxUnitsCount;
    console.log('Mutual Funds Final - AGTHX units:', agthxUnitsCount, 'ANCFX units:', ancfxUnitsCount);
    console.log('Mutual Funds dailyValues length:', portfolio.dailyValues.length, 'Sample:', portfolio.dailyValues[0]);
    
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
    const p1ByDate = {};
    portfolio1.dailyValues.forEach(item => p1ByDate[item.date] = item);
    const p2ByDate = {};
    portfolio2.dailyValues.forEach(item => p2ByDate[item.date] = item);
    
    let startDate = null, p1StartValue = null, p2StartValue = null;
    for (const date of allDates) {
        if (p1ByDate[date] && p2ByDate[date]) {
            startDate = date;
            p1StartValue = p1ByDate[date].value;
            p2StartValue = p2ByDate[date].value;
            break;
        }
    }
    console.log('alignPortfolioSeries - Start date:', startDate, 'P1 start value:', p1StartValue, 'P2 start value:', p2StartValue);
    
    if (!startDate) {
        console.log('alignPortfolioSeries: No common dates found');
        return result;
    }
    
    allDates.forEach(date => {
        if (new Date(date) >= new Date(startDate)) {
            const p1 = p1ByDate[date];
            const p2 = p2ByDate[date];
            if (p1 && p2) {
                const p1Index = (p1.value / p1StartValue) * 100;
                const p2Index = (p2.value / p2StartValue) * 100;
                result.push({
                    date: date,
                    p1Value: p1.value,
                    p2Value: p2.value,
                    p1Index: p1Index,
                    p2Index: p2Index,
                    difference: p2Index - p1Index
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
        console.log('summarizePortfolio: No daily values for', name);
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
    
    const startDate = new Date(portfolio.dailyValues[0].date);
    const endDate = new Date(portfolio.dailyValues[portfolio.dailyValues.length - 1].date);
    const yearFraction = (endDate - startDate) / (365 * 24 * 60 * 60 * 1000);
    let annualizedReturn = 0;
    if (yearFraction > 0.02) {
        annualizedReturn = (Math.pow((currentValue / initialValue), (1 / yearFraction)) - 1) * 100;
    }
    
    let minValue = Infinity, maxValue = -Infinity, minDate = '', maxDate = '';
    portfolio.dailyValues.forEach(day => {
        if (day.value < minValue) { minValue = day.value; minDate = day.date; }
        if (day.value > maxValue) { maxValue = day.value; maxDate = day.date; }
    });
    
    let sumReturns = 0, sumSquaredReturns = 0, countReturns = 0;
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
    const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    
    const summary = {
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
    console.log('summarizePortfolio:', name, 'Summary:', summary);
    return summary;
}

/**
 * Display the portfolio comparison results on the page
 * @param {Object} comparison - Portfolio comparison data
 */
function displayPortfolioComparison(comparison) {
    const mmf = comparison.mmfPortfolio;
    const mutualFunds = comparison.mutualFundsPortfolio;
    
    const container = document.getElementById('portfolio-cards');
    container.innerHTML = '';
    
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
    
    container.appendChild(mmfCard);
    container.appendChild(mutualFundsCard);
    
    console.log('Portfolio comparison data for charting:', comparison.dailyValues);
}
