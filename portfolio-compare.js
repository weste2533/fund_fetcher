function calculatePortfolioPerformance(mergedData, portfolio1Name, portfolio2Name) {
    const startDate = '2024-12-31';

    // Define portfolios with tickers and starting holdings
    const portfolios = {
        [portfolio1Name]: {
            tickers: ['AFAXX'],
            holdings: [77650.78], // Starting units for AFAXX
            data: []
        },
        [portfolio2Name]: {
            tickers: ['AGTHX', 'ANCFX'],
            holdings: [104.855, 860.672], // Starting shares for AGTHX, ANCFX
            data: []
        }
    };

    // Filter and sort data for each fund, ensuring ascending order
    const fundData = {};
    ['AFAXX', 'AGTHX', 'ANCFX'].forEach(ticker => {
        fundData[ticker] = mergedData[ticker]
            .filter(item => new Date(item.date) >= new Date(startDate))
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    });

    // Get all unique dates across all funds
    const allDates = [...new Set(
        Object.values(fundData).flatMap(data => data.map(item => item.date))
    )].sort((a, b) => new Date(a) - new Date(b));

    // Process each date
    allDates.forEach((date, index) => {
        const dailyData = { date };

        Object.entries(portfolios).forEach(([portfolioName, portfolio]) => {
            let portfolioTotalValue = 0;
            const details = [];

            portfolio.tickers.forEach((ticker, i) => {
                const fundDay = fundData[ticker].find(item => item.date === date);
                if (!fundDay) return; // Skip if no data for this date

                // Get starting units: initial holdings on first day, previous day's total otherwise
                const startingUnits = index === 0
                    ? portfolio.holdings[i]
                    : portfolios[portfolioName].data[index - 1].details[i].totalUnits;

                // Calculate added units from distribution
                const addedUnits = startingUnits * fundDay.distRatio;
                const totalUnits = startingUnits + addedUnits;
                const nav = fundDay.nav;
                const value = totalUnits * nav;

                details.push({
                    ticker,
                    startingUnits,
                    addedUnits,
                    totalUnits,
                    nav,
                    value
                });

                portfolioTotalValue += value;

                // Update holdings for next iteration
                if (index === allDates.length - 1) {
                    portfolio.holdings[i] = totalUnits;
                }
            });

            dailyData[portfolioName] = {
                details,
                totalValue: portfolioTotalValue
            };
        });

        // Store daily data
        Object.values(portfolios).forEach(portfolio => portfolio.data.push(dailyData));
    });

    return portfolios;
}
