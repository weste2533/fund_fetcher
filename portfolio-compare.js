/**
 * portfolio_compare.js
 * 
 * This module provides functions to calculate and compare performance between
 * a Money Market Fund (MMF) portfolio and a Mutual Fund portfolio.
 */

// Portfolio tracking and comparison functions
const PortfolioCompare = (function() {
    // Initial portfolio holdings as of 12/31/2024
    const INITIAL_HOLDINGS = {
        mmf: {
            AFAXX: 77650.78 // Initial units
        },
        mutualFund: {
            AGTHX: 104.855, // Initial shares
            ANCFX: 860.672  // Initial shares
        }
    };
    
    // Store calculated portfolio data
    let portfolioData = {
        mmf: {
            dailyValues: [],
            summary: {}
        },
        mutualFund: {
            AGTHX: {
                dailyValues: [],
                summary: {}
            },
            ANCFX: {
                dailyValues: [],
                summary: {}
            },
            combined: {
                dailyValues: [],
                summary: {}
            }
        }
    };
    
    /**
     * Calculate portfolio values based on NAV data and distribution ratios
     * @param {Object} fundData - The fund data object containing NAV and distribution information
     * @returns {Object} - The calculated portfolio data
     */
    function calculatePortfolios(fundData) {
        // Clear previous calculations
        resetPortfolioData();
        
        // Calculate MMF portfolio (AFAXX)
        if (fundData.AFAXX && fundData.AFAXX.nav.length > 0) {
            calculateMMFPortfolio(fundData.AFAXX);
        }
        
        // Calculate Mutual Fund portfolio (AGTHX and ANCFX)
        let hasAncfx = fundData.ANCFX && fundData.ANCFX.nav.length > 0;
        let hasAgthx = fundData.AGTHX && fundData.AGTHX.nav.length > 0;
        
        if (hasAncfx) {
            calculateMutualFundComponent(fundData.ANCFX, 'ANCFX');
        }
        
        if (hasAgthx) {
            calculateMutualFundComponent(fundData.AGTHX, 'AGTHX');
        }
        
        // Combine the mutual funds if both are available
        if (hasAncfx && hasAgthx) {
            combineMutualFundPortfolio();
        }
        
        // Return the calculated data
        return portfolioData;
    }
    
    /**
     * Reset the portfolio data structure
     */
    function resetPortfolioData() {
        portfolioData = {
            mmf: {
                dailyValues: [],
                summary: {}
            },
            mutualFund: {
                AGTHX: {
                    dailyValues: [],
                    summary: {}
                },
                ANCFX: {
                    dailyValues: [],
                    summary: {}
                },
                combined: {
                    dailyValues: [],
                    summary: {}
                }
            }
        };
    }
    
    /**
     * Calculate the Money Market Fund portfolio (AFAXX)
     * @param {Object} fundData - The fund data for AFAXX
     */
    function calculateMMFPortfolio(fundData) {
        // Create a merged dataset with NAV and distribution ratios
        const mergedData = mergeNavAndDistributions(fundData.nav, fundData.distributions);
        
        // Sort by date in ascending order for chronological calculation
        mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let currentUnits = INITIAL_HOLDINGS.mmf.AFAXX;
        const startDate = mergedData[0].date;
        
        // Process each day's data
        mergedData.forEach((dayData) => {
            // For AFAXX, NAV is always 1.00
            const nav = 1.00;
            
            // If there was a distribution, add units
            if (dayData.distRatio > 0) {
                const newUnits = currentUnits * dayData.distRatio;
                currentUnits += newUnits;
            }
            
            // Calculate current value
            const currentValue = currentUnits * nav;
            
            // Add to the dailyValues array
            portfolioData.mmf.dailyValues.push({
                date: dayData.date,
                nav: nav,
                units: currentUnits,
                value: currentValue,
                distRatio: dayData.distRatio
            });
        });
        
        // Calculate summary data
        const initialValue = INITIAL_HOLDINGS.mmf.AFAXX * 1.00;
        const currentValue = currentUnits * 1.00;
        const percentChange = ((currentValue / initialValue) - 1) * 100;
        
        portfolioData.mmf.summary = {
            startDate: startDate,
            endDate: mergedData[mergedData.length - 1].date,
            initialHoldings: INITIAL_HOLDINGS.mmf.AFAXX,
            initialValue: initialValue,
            currentHoldings: currentUnits,
            currentValue: currentValue,
            percentChange: percentChange
        };
    }
    
    /**
     * Calculate a mutual fund component (AGTHX or ANCFX)
     * @param {Object} fundData - The fund data for the mutual fund
     * @param {string} ticker - The ticker symbol of the fund
     */
    function calculateMutualFundComponent(fundData, ticker) {
        // Create a merged dataset with NAV and distribution ratios
        const mergedData = mergeNavAndDistributions(fundData.nav, fundData.distributions);
        
        // Sort by date in ascending order for chronological calculation
        mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let currentShares = INITIAL_HOLDINGS.mutualFund[ticker];
        const startDate = mergedData[0].date;
        const initialNav = mergedData[0].nav;
        
        // Process each day's data
        mergedData.forEach((dayData) => {
            // Get NAV for the day (should never be null after merge fix)
            const nav = dayData.nav;
            
            // If there was a distribution, add shares
            if (dayData.distRatio > 0) {
                const newShares = currentShares * dayData.distRatio;
                currentShares += newShares;
            }
            
            // Calculate current value
            const currentValue = currentShares * nav;
            
            // Add to the dailyValues array
            portfolioData.mutualFund[ticker].dailyValues.push({
                date: dayData.date,
                nav: nav,
                shares: currentShares,
                value: currentValue,
                distRatio: dayData.distRatio
            });
        });
        
        // Calculate summary data
        const initialValue = INITIAL_HOLDINGS.mutualFund[ticker] * initialNav;
        const currentNav = mergedData[mergedData.length - 1].nav;
        const currentValue = currentShares * currentNav;
        const percentChange = ((currentValue / initialValue) - 1) * 100;
        
        portfolioData.mutualFund[ticker].summary = {
            startDate: startDate,
            endDate: mergedData[mergedData.length - 1].date,
            initialHoldings: INITIAL_HOLDINGS.mutualFund[ticker],
            initialNav: initialNav,
            initialValue: initialValue,
            currentHoldings: currentShares,
            currentNav: currentNav,
            currentValue: currentValue,
            percentChange: percentChange
        };
    }
    
    /**
     * Combine the mutual fund components into a single portfolio
     */
    function combineMutualFundPortfolio() {
        const agthxValues = portfolioData.mutualFund.AGTHX.dailyValues;
        const ancfxValues = portfolioData.mutualFund.ANCFX.dailyValues;
        
        // Create maps of dates for easier lookup
        const agthxByDate = {};
        const ancfxByDate = {};
        
        agthxValues.forEach(item => { agthxByDate[item.date] = item; });
        ancfxValues.forEach(item => { ancfxByDate[item.date] = item; });
        
        // Get all unique dates and sort them
        const allDates = [...new Set([...Object.keys(agthxByDate), ...Object.keys(ancfxByDate)])];
        allDates.sort((a, b) => new Date(a) - new Date(b));
        
        // Track last known values for forward-filling
        let lastAGTHXValue = 0;
        let lastANCFXValue = 0;
        
        // Combine values for each date
        allDates.forEach(date => {
            const agthxData = agthxByDate[date];
            const ancfxData = ancfxByDate[date];
            
            // Update last known values if available
            if (agthxData) lastAGTHXValue = agthxData.value;
            if (ancfxData) lastANCFXValue = ancfxData.value;
            
            // Calculate combined value using last known values
            const combinedValue = lastAGTHXValue + lastANCFXValue;
            
            portfolioData.mutualFund.combined.dailyValues.push({
                date: date,
                value: combinedValue,
                agthxValue: lastAGTHXValue,
                ancfxValue: lastANCFXValue
            });
        });
        
        // Calculate combined summary data
        const agthxSummary = portfolioData.mutualFund.AGTHX.summary;
        const ancfxSummary = portfolioData.mutualFund.ANCFX.summary;
        
        const initialValue = agthxSummary.initialValue + ancfxSummary.initialValue;
        const currentValue = agthxSummary.currentValue + ancfxSummary.currentValue;
        const percentChange = ((currentValue / initialValue) - 1) * 100;
        
        portfolioData.mutualFund.combined.summary = {
            startDate: allDates[0],
            endDate: allDates[allDates.length - 1],
            initialValue: initialValue,
            currentValue: currentValue,
            percentChange: percentChange,
            components: {
                AGTHX: agthxSummary,
                ANCFX: ancfxSummary
            }
        };
    }
    
    /**
     * Merge NAV and distribution data for calculation
     * @param {Array} navData - Array of NAV data points
     * @param {Array} distData - Array of distribution data points
     * @returns {Array} - Merged data array with nav and distribution ratios
     */
    function mergeNavAndDistributions(navData, distData) {
        // Create maps for NAVs from both sources
        const navByDate = {};
        const distNavByDate = {};
        
        navData.forEach(item => {
            navByDate[item.date] = item.nav;
        });
        
        distData.forEach(item => {
            distNavByDate[item.date] = item.nav; // Store NAV from distribution
        });
        
        // Create distribution ratio map
        const distByDate = {};
        distData.forEach(item => {
            const ratio = item.dist / item.nav;
            distByDate[item.date] = ratio;
        });
        
        // Get all unique dates
        const allDates = [...new Set([
            ...Object.keys(navByDate),
            ...Object.keys(distNavByDate)
        ])];
        
        // Merge data with priority to daily NAVs
        return allDates.map(date => ({
            date: date,
            nav: navByDate[date] ?? distNavByDate[date] ?? null,
            distRatio: distByDate[date] || 0
        }));
    }
    
    // ... (Keep the formatCurrency, formatPercentage, generateComparisonHTML, 
    // and generateChartData functions unchanged from original code)
    
    // Public API
    return {
        calculatePortfolios: calculatePortfolios,
        getPortfolioData: function() { return portfolioData; },
        generateComparisonHTML: generateComparisonHTML,
        generateChartData: generateChartData,
        formatCurrency: formatCurrency,
        formatPercentage: formatPercentage
    };
})();

// CommonJS export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = PortfolioCompare;
}
