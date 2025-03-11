function calculatePortfolioPerformance() {
    // Verify that merged data is available for all required funds
    if (!mergedFundData['AFAXX'] || !mergedFundData['AGTHX'] || !mergedFundData['ANCFX']) {
        console.error('Merged data not fully loaded for all funds');
        return;
    }

    // Sort merged data for each fund in ascending order by date
    const sortedAFAXX = [...mergedFundData['AFAXX']].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedAGTHX = [...mergedFundData['AGTHX']].sort((a, b) => new Date(a.date) - new Date(b.date));
    const sortedANCFX = [...mergedFundData['ANCFX']].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Initialize holdings as of 12/31/2024
    let holdingsAFAXX = 77650.78; // Units for AFAXX
    let holdingsAGTHX = 104.855;  // Shares for AGTHX
    let holdingsANCFX = 860.672;  // Shares for ANCFX

    // Create maps for efficient date-based lookups
    const dataAFAXX = new Map(sortedAFAXX.map(d => [d.date, d]));
    const dataAGTHX = new Map(sortedAGTHX.map(d => [d.date, d]));
    const dataANCFX = new Map(sortedANCFX.map(d => [d.date, d]));

    // Use AFAXX dates as the reference timeline (assumes daily business day data)
    const allDates = sortedAFAXX.map(d => d.date);

    // Arrays to store daily portfolio values
    const portfolio1Values = []; // MMF Portfolio (AFAXX)
    const portfolio2Values = []; // Mutual Fund Portfolio (AGTHX + ANCFX)

    // Calculate daily values for each portfolio
    allDates.forEach(date => {
        // Portfolio 1: AFAXX (MMF)
        const afaxxData = dataAFAXX.get(date);
        if (afaxxData) {
            const valueAFAXX = holdingsAFAXX * afaxxData.nav;
            portfolio1Values.push({ date, value: valueAFAXX });
            // Reinvest distributions (daily for MMF)
            if (afaxxData.distRatio > 0) {
                holdingsAFAXX *= (1 + afaxxData.distRatio);
            }
        }

        // Portfolio 2: AGTHX
        let valueAGTHX = 0;
        const agthxData = dataAGTHX.get(date);
        if (agthxData) {
            valueAGTHX = holdingsAGTHX * agthxData.nav;
            // Reinvest distributions when applicable
            if (agthxData.distRatio > 0) {
                holdingsAGTHX *= (1 + agthxData.distRatio);
            }
        }

        // Portfolio 2: ANCFX
        let valueANCFX = 0;
        const ancfxData = dataANCFX.get(date);
        if (ancfxData) {
            valueANCFX = holdingsANCFX * ancfxData.nav;
            // Reinvest distributions when applicable
            if (ancfxData.distRatio > 0) {
                holdingsANCFX *= (1 + ancfxData.distRatio);
            }
        }

        // Total value for Portfolio 2
        const portfolio2Value = valueAGTHX + valueANCFX;
        portfolio2Values.push({ date, value: portfolio2Value });
    });

    // Display the comparison
    displayPortfolioComparison(allDates, portfolio1Values, portfolio2Values);
}

function displayPortfolioComparison(dates, portfolio1Values, portfolio2Values) {
    const container = document.getElementById('portfolio-comparison-container');
    const table = document.createElement('table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>Date</th>
                <th>MMF Portfolio Value</th>
                <th>Mutual Fund Portfolio Value</th>
            </tr>
        </thead>
        <tbody>
            ${dates.map((date, index) => `
                <tr>
                    <td>${date}</td>
                    <td>$${portfolio1Values[index].value.toFixed(2)}</td>
                    <td>$${portfolio2Values[index].value.toFixed(2)}</td>
                </tr>
            `).join('')}
        </tbody>
    `;
    container.appendChild(table);
}
