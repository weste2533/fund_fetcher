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
        mergedData.forEach((dayData, index) => {
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
        const initialValue = INITIAL_HOLDINGS.mmf.AFAXX * 1.00; // Always $1.00 NAV
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
        mergedData.forEach((dayData, index) => {
            // Get NAV for the day
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
        
        // Create a map of dates for easier lookup
        const agthxByDate = {};
        const ancfxByDate = {};
        
        agthxValues.forEach(item => { agthxByDate[item.date] = item; });
        ancfxValues.forEach(item => { ancfxByDate[item.date] = item; });
        
        // Get all unique dates
        const allDates = [...new Set([...Object.keys(agthxByDate), ...Object.keys(ancfxByDate)])];
        allDates.sort((a, b) => new Date(a) - new Date(b)); // Sort dates chronologically
        
        // Combine values for each date
        allDates.forEach(date => {
            const agthxData = agthxByDate[date];
            const ancfxData = ancfxByDate[date];
            
            let combinedValue = 0;
            
            if (agthxData) {
                combinedValue += agthxData.value;
            }
            
            if (ancfxData) {
                combinedValue += ancfxData.value;
            }
            
            portfolioData.mutualFund.combined.dailyValues.push({
                date: date,
                value: combinedValue,
                agthxValue: agthxData ? agthxData.value : null,
                ancfxValue: ancfxData ? ancfxData.value : null
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
        // Create maps for quick lookup
        const navByDate = {};
        navData.forEach(item => {
            navByDate[item.date] = item.nav;
        });
        
        const distByDate = {};
        distData.forEach(item => {
            // Calculate distribution reinvestment ratio
            const ratio = item.dist / item.nav;
            distByDate[item.date] = ratio;
        });
        
        // Get all unique dates
        const allDates = [...new Set([...Object.keys(navByDate), ...Object.keys(distByDate)])];
        
        // Merge the data
        return allDates.map(date => {
            return {
                date: date,
                nav: navByDate[date] || null,
                distRatio: distByDate[date] || 0
            };
        });
    }
    
    /**
     * Format currency for display
     * @param {number} value - The currency value to format
     * @returns {string} - Formatted currency string
     */
    function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    /**
     * Format percentage for display
     * @param {number} value - The percentage value to format
     * @returns {string} - Formatted percentage string
     */
    function formatPercentage(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value / 100);
    }
    
    /**
     * Generate HTML for displaying portfolio comparison
     * @returns {string} - HTML string for portfolio comparison
     */
    function generateComparisonHTML() {
        const mmfSummary = portfolioData.mmf.summary;
        const mutualFundSummary = portfolioData.mutualFund.combined.summary;
        
        if (!mmfSummary.initialValue || !mutualFundSummary.initialValue) {
            return '<div class="error">Insufficient data to generate comparison</div>';
        }
        
        return `
            <div class="comparison-container">
                <h2>Portfolio Comparison</h2>
                <div class="date-range">
                    Period: ${mmfSummary.startDate} to ${mmfSummary.endDate}
                </div>
                
                <div class="portfolio-section">
                    <h3>Money Market Fund Portfolio (AFAXX)</h3>
                    <table>
                        <tr>
                            <td>Initial Units:</td>
                            <td>${mmfSummary.initialHoldings.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Initial Value:</td>
                            <td>${formatCurrency(mmfSummary.initialValue)}</td>
                        </tr>
                        <tr>
                            <td>Current Units:</td>
                            <td>${mmfSummary.currentHoldings.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td>Current Value:</td>
                            <td>${formatCurrency(mmfSummary.currentValue)}</td>
                        </tr>
                        <tr>
                            <td>Performance:</td>
                            <td>${formatPercentage(mmfSummary.percentChange)}</td>
                        </tr>
                    </table>
                </div>
                
                <div class="portfolio-section">
                    <h3>Mutual Fund Portfolio (AGTHX + ANCFX)</h3>
                    <table>
                        <tr>
                            <td>Initial Value:</td>
                            <td>${formatCurrency(mutualFundSummary.initialValue)}</td>
                        </tr>
                        <tr>
                            <td>Current Value:</td>
                            <td>${formatCurrency(mutualFundSummary.currentValue)}</td>
                        </tr>
                        <tr>
                            <td>Performance:</td>
                            <td>${formatPercentage(mutualFundSummary.percentChange)}</td>
                        </tr>
                    </table>
                    
                    <div class="fund-breakdown">
                        <h4>AGTHX Component</h4>
                        <table>
                            <tr>
                                <td>Initial Shares:</td>
                                <td>${mutualFundSummary.components.AGTHX.initialHoldings.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>Initial NAV:</td>
                                <td>${formatCurrency(mutualFundSummary.components.AGTHX.initialNav)}</td>
                            </tr>
                            <tr>
                                <td>Initial Value:</td>
                                <td>${formatCurrency(mutualFundSummary.components.AGTHX.initialValue)}</td>
                            </tr>
                            <tr>
                                <td>Current Shares:</td>
                                <td>${mutualFundSummary.components.AGTHX.currentHoldings.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>Current NAV:</td>
                                <td>${formatCurrency(mutualFundSummary.components.AGTHX.currentNav)}</td>
                            </tr>
                            <tr>
                                <td>Current Value:</td>
                                <td>${formatCurrency(mutualFundSummary.components.AGTHX.currentValue)}</td>
                            </tr>
                            <tr>
                                <td>Performance:</td>
                                <td>${formatPercentage(mutualFundSummary.components.AGTHX.percentChange)}</td>
                            </tr>
                        </table>
                        
                        <h4>ANCFX Component</h4>
                        <table>
                            <tr>
                                <td>Initial Shares:</td>
                                <td>${mutualFundSummary.components.ANCFX.initialHoldings.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>Initial NAV:</td>
                                <td>${formatCurrency(mutualFundSummary.components.ANCFX.initialNav)}</td>
                            </tr>
                            <tr>
                                <td>Initial Value:</td>
                                <td>${formatCurrency(mutualFundSummary.components.ANCFX.initialValue)}</td>
                            </tr>
                            <tr>
                                <td>Current Shares:</td>
                                <td>${mutualFundSummary.components.ANCFX.currentHoldings.toFixed(3)}</td>
                            </tr>
                            <tr>
                                <td>Current NAV:</td>
                                <td>${formatCurrency(mutualFundSummary.components.ANCFX.currentNav)}</td>
                            </tr>
                            <tr>
                                <td>Current Value:</td>
                                <td>${formatCurrency(mutualFundSummary.components.ANCFX.currentValue)}</td>
                            </tr>
                            <tr>
                                <td>Performance:</td>
                                <td>${formatPercentage(mutualFundSummary.components.ANCFX.percentChange)}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    /**
     * Generate chart data for visual comparison
     * @returns {Object} - Data formatted for chart visualization
     */
    function generateChartData() {
        const mmfValues = portfolioData.mmf.dailyValues;
        const mfCombined = portfolioData.mutualFund.combined.dailyValues;
        
        // Create a map of all dates from both portfolios
        const allDatesSet = new Set();
        mmfValues.forEach(item => allDatesSet.add(item.date));
        mfCombined.forEach(item => allDatesSet.add(item.date));
        
        // Convert to array and sort
        const allDates = Array.from(allDatesSet).sort();
        
        // Create maps for quick lookup
        const mmfByDate = {};
        mmfValues.forEach(item => { mmfByDate[item.date] = item; });
        
        const mfByDate = {};
        mfCombined.forEach(item => { mfByDate[item.date] = item; });
        
        // Create data points for each date
        const chartData = allDates.map(date => {
            const mmfData = mmfByDate[date];
            const mfData = mfByDate[date];
            
            return {
                date: date,
                mmfValue: mmfData ? mmfData.value : null,
                mutualFundValue: mfData ? mfData.value : null
            };
        });
        
        return chartData;
    }
    
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

// If this script is loaded in a CommonJS environment (Node.js)
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = PortfolioCompare;
}
