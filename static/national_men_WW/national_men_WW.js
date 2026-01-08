/* National Men WW - Frontend Module */

window.nationalMenWW = (function () {
    let allRecords = [];
    let appsScriptUrl = '';
    let filtersApplied = false;

    // Teams by continent mapping
    const teamsByContinent = {
        'africa': [
            'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Cape Verde',
            'Central African Republic', 'Chad', 'Comoros', 'Congo', 'DR Congo', 'Djibouti', 'Egypt',
            'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea',
            'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi',
            'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
            'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
            'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
        ],
        'asia': [
            'Afghanistan', 'Australia', 'Bahrain', 'Bangladesh', 'Bhutan', 'Brunei', 'Cambodia', 'China',
            'Chinese Taipei', 'East Timor', 'Hong Kong', 'India', 'Indonesia', 'Iran', 'Iraq', 'Japan',
            'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Lebanon', 'Macau', 'Malaysia',
            'Maldives', 'Mongolia', 'Myanmar', 'Nepal', 'North Korea', 'Oman', 'Pakistan', 'Palestine',
            'Philippines', 'Qatar', 'Saudi Arabia', 'Singapore', 'South Korea', 'Sri Lanka', 'Syria',
            'Tajikistan', 'Thailand', 'Turkmenistan', 'United Arab Emirates', 'Uzbekistan', 'Vietnam', 'Yemen'
        ],
        'europe': [
            'Albania', 'Andorra', 'Armenia', 'Austria', 'Azerbaijan', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
            'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'England', 'Estonia', 'Faroe Islands',
            'Finland', 'France', 'Georgia', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 'Israel',
            'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Malta', 'Moldova',
            'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia', 'Northern Ireland', 'Norway', 'Poland',
            'Portugal', 'Romania', 'Russia', 'San Marino', 'Scotland', 'Serbia', 'Slovakia', 'Slovenia',
            'Spain', 'Sweden', 'Switzerland', 'Turkey', 'Ukraine', 'Wales'
        ],
        'south-america': [
            'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Paraguay', 'Peru', 'Uruguay', 'Venezuela'
        ],
        'north-america': [
            'Antigua and Barbuda', 'Aruba', 'Bahamas', 'Barbados', 'Belize', 'Bermuda', 'Canada', 'Costa Rica',
            'Cuba', 'Curaçao', 'Dominica', 'Dominican Republic', 'El Salvador', 'Grenada', 'Guatemala', 'Haiti',
            'Honduras', 'Jamaica', 'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Saint Kitts and Nevis',
            'Saint Lucia', 'Saint Vincent and the Grenadines', 'Suriname', 'Trinidad and Tobago', 'United States'
        ],
        'oceania': [
            'American Samoa', 'Cook Islands', 'Fiji', 'Guam', 'Kiribati', 'Micronesia', 'New Caledonia',
            'New Zealand', 'Palau', 'Papua New Guinea', 'Samoa', 'Solomon Islands', 'Tahiti', 'Tonga',
            'Tuvalu', 'Vanuatu'
        ]
    };

    // Arab countries list
    const arabCountries = [
        'Algeria', 'Bahrain', 'Comoros', 'Djibouti', 'Egypt', 'Iraq', 'Jordan', 'Kuwait',
        'Lebanon', 'Libya', 'Mauritania', 'Morocco', 'Oman', 'Palestine', 'Qatar',
        'Saudi Arabia', 'Somalia', 'Sudan', 'Syria', 'Tunisia', 'United Arab Emirates', 'Yemen'
    ];

    // Helper function to get continent for a team
    function getTeamContinent(teamName) {
        const normalizedTeam = String(teamName || '').trim();
        for (const [continent, teams] of Object.entries(teamsByContinent)) {
            if (teams.some(t => t.toLowerCase() === normalizedTeam.toLowerCase())) {
                return continent;
            }
        }
        return null; // Unknown continent
    }

    // Helper function to check if team is Arab country
    function isArabCountry(teamName) {
        const normalizedTeam = String(teamName || '').trim();
        return arabCountries.some(country => country.toLowerCase() === normalizedTeam.toLowerCase());
    }

    // Virtual Scrolling state
    let virtualScrollState = {
        allData: [],
        currentViewData: [],
        startIndex: 0,
        endIndex: 25, // Render first 25 rows initially
        bufferSize: 25, // Buffer rows above and below visible area
        rowHeight: 50, // Estimated row height in pixels
        tableContainer: null,
        scrollHandler: null
    };

    function setupDynamicTableSearch() {
        const searchInput = document.getElementById('matches-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('keyup', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();

            if (!searchTerm) {
                // No search term, restore full filtered data
                virtualScrollState.allData = virtualScrollState.currentViewData || [];
            } else {
                // Filter data based on search within the already filtered view
                const filtered = (virtualScrollState.currentViewData || []).filter((rec) => {
                    const n = normalizeRecord(rec);
                    const cols = ['GAME', 'AGE', 'Season', 'Round', 'TeamA', 'TeamAScore', 'TeamBScore', 'TeamB'];
                    const rowText = cols.map(c => String(n[c] || '')).join(' ').toLowerCase();
                    return rowText.includes(searchTerm);
                });
                virtualScrollState.allData = filtered;
            }

            // Reset scroll position
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.scrollTop = 0;
            }

            // For small datasets, render all at once; for large datasets, use virtual scrolling
            if (virtualScrollState.allData.length <= 1000) {
                const tbody = document.getElementById('national-men-WW-tbody');
                if (tbody) {
                    const cols = ['GAME', 'AGE', 'Season', 'Round', 'TeamA', 'TeamAScore', 'TeamBScore', 'TeamB'];
                    const rowsHtml = virtualScrollState.allData.map((rec) => {
                        const n = normalizeRecord(rec);
                        const tds = cols.map((c) => `<td>${escapeHtml(String(n[c] ?? ''))}</td>`).join('');
                        const wl = getResultSymbol(n);
                        const wlClass = getResultClass(wl);
                        return `<tr>${tds}<td><span class="${wlClass}">${wl}</span></td></tr>`;
                    }).join('');
                    tbody.innerHTML = rowsHtml;
                }
                virtualScrollState.startIndex = 0;
                virtualScrollState.endIndex = virtualScrollState.allData.length;
            } else {
                // Use virtual scrolling for large datasets
                virtualScrollState.startIndex = 0;
                virtualScrollState.endIndex = Math.min(25, virtualScrollState.allData.length);
                renderVisibleRows();
            }
        });
    }

    function updateTeamsTotalRow() {
        const tableBody = document.getElementById('nmww-teams-stats-tbody');
        if (!tableBody) return;

        const rows = tableBody.getElementsByTagName('tr');
        let totalParticipations = 0;
        let totalMatches = 0;
        let totalWin = 0;
        let totalDraw = 0;
        let totalLoss = 0;
        let totalGF = 0;
        let totalGA = 0;

        // Calculate totals from visible rows only (excluding total row)
        for (const row of rows) {
            if (row.id === 'nmww-teams-total-row') continue; // Skip total row
            if (row.style.display === 'none') continue; // Skip hidden rows

            const cells = row.getElementsByTagName('td');
            if (cells.length >= 8) {
                totalParticipations += parseInt(cells[1].textContent.trim()) || 0;
                totalMatches += parseInt(cells[2].textContent.trim()) || 0;
                totalWin += parseInt(cells[3].textContent.trim()) || 0;
                totalDraw += parseInt(cells[4].textContent.trim()) || 0;
                totalLoss += parseInt(cells[5].textContent.trim()) || 0;
                totalGF += parseInt(cells[6].textContent.trim()) || 0;
                totalGA += parseInt(cells[7].textContent.trim()) || 0;
            }
        }

        // Update total row
        const totalParticipationsEl = document.getElementById('total-participations');
        const totalMatchesEl = document.getElementById('total-matches');
        const totalWinEl = document.getElementById('total-win');
        const totalDrawEl = document.getElementById('total-draw');
        const totalLossEl = document.getElementById('total-loss');
        const totalGFEl = document.getElementById('total-gf');
        const totalGAEl = document.getElementById('total-ga');

        if (totalParticipationsEl) totalParticipationsEl.textContent = totalParticipations;
        if (totalMatchesEl) totalMatchesEl.textContent = totalMatches;
        if (totalWinEl) totalWinEl.textContent = totalWin;
        if (totalDrawEl) totalDrawEl.textContent = totalDraw;
        if (totalLossEl) totalLossEl.textContent = totalLoss;
        if (totalGFEl) totalGFEl.textContent = totalGF;
        if (totalGAEl) totalGAEl.textContent = totalGA;
    }

    function setupContinentFilter() {
        const input = document.getElementById('nmww-continent-filter-input');
        const dropdown = document.getElementById('nmww-continent-dropdown');
        if (!input || !dropdown) {
            console.warn('Continent filter elements not found');
            return;
        }

        // Remove existing event listeners by cloning elements
        const newInput = input.cloneNode(true);
        const newDropdown = dropdown.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Track selected continents
        const selectedContinents = new Set();

        // Update input placeholder based on selections
        function updateInputPlaceholder() {
            if (selectedContinents.size === 0) {
                newInput.value = '';
                newInput.placeholder = 'Select Continents...';
            } else {
                const labels = {
                    'africa': 'Africa',
                    'asia': 'Asia',
                    'europe': 'Europe',
                    'south-america': 'South America',
                    'north-america': 'North America',
                    'oceania': 'Oceania',
                    'arab-countries': 'Arab Countries'
                };
                const selected = Array.from(selectedContinents).map(c => labels[c] || c);
                newInput.value = selected.join(', ');
            }
        }

        // Handle checkbox changes
        const checkboxes = newDropdown.querySelectorAll('.continent-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const value = e.target.value;
                if (e.target.checked) {
                    selectedContinents.add(value);
                } else {
                    selectedContinents.delete(value);
                }
                updateInputPlaceholder();

                // Get current filtered records
                const filtered = applyCurrentFilters();
                // Re-render teams stats with continent filter
                renderTeamStats(filtered);
                // Clear search input when filter changes
                const searchInput = document.getElementById('nmww-teams-search-input');
                if (searchInput) searchInput.value = '';
            });
        });

        // Toggle dropdown on input click
        newInput.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = newDropdown.style.display === 'block';
            newDropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!newInput.contains(e.target) && !newDropdown.contains(e.target)) {
                newDropdown.style.display = 'none';
            }
        };
        document.addEventListener('click', closeDropdown);

        // Prevent dropdown from closing when clicking inside
        newDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add hover effect to labels
        newDropdown.querySelectorAll('label').forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = '#f8f9fa';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
    }

    function setupMatchesContinentFilter() {
        const input = document.getElementById('nmww-matches-continent-filter-input');
        const dropdown = document.getElementById('nmww-matches-continent-dropdown');
        if (!input || !dropdown) {
            console.warn('Matches continent filter elements not found');
            return;
        }

        // Remove existing event listeners by cloning elements
        const newInput = input.cloneNode(true);
        const newDropdown = dropdown.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Track selected continents
        const selectedContinents = new Set();

        // Update input placeholder based on selections
        function updateInputPlaceholder() {
            if (selectedContinents.size === 0) {
                newInput.value = '';
                newInput.placeholder = 'Select Continents...';
            } else {
                const labels = {
                    'africa': 'Africa',
                    'asia': 'Asia',
                    'europe': 'Europe',
                    'south-america': 'South America',
                    'north-america': 'North America',
                    'oceania': 'Oceania',
                    'arab-countries': 'Arab Countries'
                };
                const selected = Array.from(selectedContinents).map(c => labels[c] || c);
                newInput.value = selected.join(', ');
            }
        }

        // Handle checkbox changes
        const checkboxes = newDropdown.querySelectorAll('.matches-continent-cb');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const value = e.target.value;
                if (e.target.checked) {
                    selectedContinents.add(value);
                } else {
                    selectedContinents.delete(value);
                }
                updateInputPlaceholder();

                // Re-apply all filters including continent filter
                // Get current filtered records from main filters
                const filtered = applyCurrentFilters();
                // Re-render matches table with continent filter applied
                renderTable(filtered);
                // Clear search input when filter changes
                const searchInput = document.getElementById('matches-search-input');
                if (searchInput) searchInput.value = '';
            });
        });

        // Toggle dropdown on input click
        newInput.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = newDropdown.style.display === 'block';
            newDropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!newInput.contains(e.target) && !newDropdown.contains(e.target)) {
                newDropdown.style.display = 'none';
            }
        };
        document.addEventListener('click', closeDropdown);

        // Prevent dropdown from closing when clicking inside
        newDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add hover effect to labels
        newDropdown.querySelectorAll('label').forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = '#f8f9fa';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
    }

    function updateTeamStatsSummary(records) {
        const selectedTeam = getSelectedTeamFilter();
        const summaryDiv = document.getElementById('nmww-team-stats-summary');

        if (!selectedTeam || !summaryDiv) {
            if (summaryDiv) summaryDiv.style.display = 'none';
            return;
        }

        // Calculate statistics for the selected team
        const selectedTeamLower = selectedTeam.toLowerCase();
        let matches = 0;
        let win = 0;
        let draw = 0;
        let loss = 0;
        let gf = 0;
        let ga = 0;

        records.forEach(r => {
            const teamA = String(r['TeamA'] || '').trim();
            const teamB = String(r['TeamB'] || '').trim();
            const teamALower = teamA.toLowerCase();
            const teamBLower = teamB.toLowerCase();

            const scoreA = parseInt(r['TeamAScore'], 10);
            const scoreB = parseInt(r['TeamBScore'], 10);

            if (isNaN(scoreA) || isNaN(scoreB)) return;

            if (teamALower === selectedTeamLower) {
                matches++;
                gf += scoreA;
                ga += scoreB;
                if (scoreA > scoreB) win++;
                else if (scoreA < scoreB) loss++;
                else draw++;
            } else if (teamBLower === selectedTeamLower) {
                matches++;
                gf += scoreB;
                ga += scoreA;
                if (scoreB > scoreA) win++;
                else if (scoreB < scoreA) loss++;
                else draw++;
            }
        });

        // Update summary display
        document.getElementById('team-stats-matches').textContent = matches;
        document.getElementById('team-stats-win').textContent = win;
        document.getElementById('team-stats-draw').textContent = draw;
        document.getElementById('team-stats-loss').textContent = loss;
        document.getElementById('team-stats-gf').textContent = gf;
        document.getElementById('team-stats-ga').textContent = ga;

        summaryDiv.style.display = 'block';
    }

    function setupH2HContinentFilters() {
        // Setup Continent 1 filter
        const input1 = document.getElementById('nmww-h2h-continent1-input');
        const dropdown1 = document.getElementById('nmww-h2h-continent1-dropdown');
        if (input1 && dropdown1) {
            setupH2HContinentDropdown(input1, dropdown1, 'h2h-continent1-cb', 1);
        }

        // Setup Continent 2 filter
        const input2 = document.getElementById('nmww-h2h-continent2-input');
        const dropdown2 = document.getElementById('nmww-h2h-continent2-dropdown');
        if (input2 && dropdown2) {
            setupH2HContinentDropdown(input2, dropdown2, 'h2h-continent2-cb', 2);
        }
    }

    function setupH2HContinentDropdown(input, dropdown, checkboxClass, continentNumber) {
        // Remove existing event listeners by cloning elements
        const newInput = input.cloneNode(true);
        const newDropdown = dropdown.cloneNode(true);
        input.parentNode.replaceChild(newInput, input);
        dropdown.parentNode.replaceChild(newDropdown, dropdown);

        // Track selected continent (only one can be selected)
        let selectedContinent = '';

        // Update input placeholder based on selection
        function updateInputPlaceholder() {
            if (!selectedContinent) {
                newInput.value = '';
                newInput.placeholder = 'Select Continent...';
            } else {
                const labels = {
                    'africa': 'Africa',
                    'asia': 'Asia',
                    'europe': 'Europe',
                    'south-america': 'South America',
                    'north-america': 'North America',
                    'oceania': 'Oceania',
                    'arab-countries': 'Arab Countries'
                };
                newInput.value = labels[selectedContinent] || selectedContinent;
            }
        }

        // Handle checkbox changes (only one can be selected)
        const checkboxes = newDropdown.querySelectorAll('.' + checkboxClass);
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const value = e.target.value;
                if (e.target.checked) {
                    // Uncheck all other checkboxes
                    checkboxes.forEach(otherCb => {
                        if (otherCb !== e.target) {
                            otherCb.checked = false;
                        }
                    });
                    selectedContinent = value;
                } else {
                    selectedContinent = '';
                }
                updateInputPlaceholder();

                // Update H2H table
                updateH2HTable();
            });
        });

        // Toggle dropdown on input click
        newInput.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = newDropdown.style.display === 'block';
            newDropdown.style.display = isVisible ? 'none' : 'block';
        });

        // Close dropdown when clicking outside
        const closeDropdown = (e) => {
            if (!newInput.contains(e.target) && !newDropdown.contains(e.target)) {
                newDropdown.style.display = 'none';
            }
        };
        document.addEventListener('click', closeDropdown);

        // Prevent dropdown from closing when clicking inside
        newDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Add hover effect to labels
        newDropdown.querySelectorAll('label').forEach(label => {
            label.addEventListener('mouseenter', () => {
                label.style.background = '#f8f9fa';
            });
            label.addEventListener('mouseleave', () => {
                label.style.background = 'transparent';
            });
        });
    }

    function updateH2HTable() {
        const tbody = document.getElementById('nmww-h2h-tbody');
        const header1 = document.getElementById('nmww-h2h-continent1-header');
        const header2 = document.getElementById('nmww-h2h-continent2-header');
        if (!tbody) return;

        // Get selected continents
        const checkboxes1 = document.querySelectorAll('.h2h-continent1-cb');
        const checkboxes2 = document.querySelectorAll('.h2h-continent2-cb');

        let continent1 = '';
        let continent2 = '';

        checkboxes1.forEach(cb => {
            if (cb.checked) continent1 = cb.value;
        });
        checkboxes2.forEach(cb => {
            if (cb.checked) continent2 = cb.value;
        });

        if (!continent1 || !continent2) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:2rem; color:#666;">Please select two continents to view H2H statistics</td></tr>';
            if (header1) header1.textContent = 'Continent 1';
            if (header2) header2.textContent = 'Continent 2';
            return;
        }

        // Get filtered records (apply main filters if any)
        const filtered = applyCurrentFilters();

        // Calculate H2H statistics
        const stats = calculateH2HStats(filtered, continent1, continent2);

        // Render table
        const labels = {
            'africa': 'Africa',
            'asia': 'Asia',
            'europe': 'Europe',
            'south-america': 'South America',
            'north-america': 'North America',
            'oceania': 'Oceania',
            'arab-countries': 'Arab Countries'
        };

        const continent1Label = labels[continent1] || continent1;
        const continent2Label = labels[continent2] || continent2;

        // Update headers
        if (header1) header1.textContent = continent1Label;
        if (header2) header2.textContent = continent2Label;

        // Render statistics - continents on left and right, labels in center column
        tbody.innerHTML = `
            <tr style="margin-bottom:0.75rem;">
                <td style="text-align:center; padding:1.5rem 0.75rem; vertical-align:middle;">
                    <div style="font-size:2.2rem; font-weight:700; margin-bottom:1.5rem; color:#333;">${escapeHtml(continent1Label)}</div>
                    <div style="display:flex; flex-direction:column; gap:0.75rem;">
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent1.matches}</div>
                        <div style="font-size:2rem; font-weight:600; color:#28a745; padding:0.5rem 0;">${stats.continent1.win}</div>
                        <div style="font-size:2rem; font-weight:600; color:#ff9f43; padding:0.5rem 0;">${stats.continent1.draw}</div>
                        <div style="font-size:2rem; font-weight:600; color:#dc3545; padding:0.5rem 0;">${stats.continent1.loss}</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent1.gf}</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent1.ga}</div>
                    </div>
                </td>
                <td style="text-align:center; padding:1.5rem 0.75rem; vertical-align:middle;">
                    <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:2.5rem;">
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">Matches</div>
                        <div style="font-size:2rem; font-weight:600; color:#28a745; padding:0.5rem 0;">Win</div>
                        <div style="font-size:2rem; font-weight:600; color:#ff9f43; padding:0.5rem 0;">Draw</div>
                        <div style="font-size:2rem; font-weight:600; color:#dc3545; padding:0.5rem 0;">Loss</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">Goals For</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">Goals Against</div>
                    </div>
                </td>
                <td style="text-align:center; padding:1.5rem 0.75rem; vertical-align:middle;">
                    <div style="font-size:2.2rem; font-weight:700; margin-bottom:1.5rem; color:#333;">${escapeHtml(continent2Label)}</div>
                    <div style="display:flex; flex-direction:column; gap:0.75rem;">
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent2.matches}</div>
                        <div style="font-size:2rem; font-weight:600; color:#28a745; padding:0.5rem 0;">${stats.continent2.win}</div>
                        <div style="font-size:2rem; font-weight:600; color:#ff9f43; padding:0.5rem 0;">${stats.continent2.draw}</div>
                        <div style="font-size:2rem; font-weight:600; color:#dc3545; padding:0.5rem 0;">${stats.continent2.loss}</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent2.gf}</div>
                        <div style="font-size:2rem; font-weight:600; padding:0.5rem 0;">${stats.continent2.ga}</div>
                    </div>
                </td>
            </tr>
        `;
    }

    function calculateH2HStats(records, continent1, continent2) {
        const stats = {
            continent1: { matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0 },
            continent2: { matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0 }
        };

        records.forEach(r => {
            const teamA = String(r['TeamA'] || '').trim();
            const teamB = String(r['TeamB'] || '').trim();
            const scoreA = parseInt(r['TeamAScore'], 10);
            const scoreB = parseInt(r['TeamBScore'], 10);

            if (isNaN(scoreA) || isNaN(scoreB)) return;

            // Get continents for both teams
            let teamAContinent = '';
            let teamBContinent = '';

            if (continent1 === 'arab-countries' || continent2 === 'arab-countries') {
                if (isArabCountry(teamA)) {
                    teamAContinent = 'arab-countries';
                } else {
                    teamAContinent = getTeamContinent(teamA);
                }
                if (isArabCountry(teamB)) {
                    teamBContinent = 'arab-countries';
                } else {
                    teamBContinent = getTeamContinent(teamB);
                }
            } else {
                teamAContinent = getTeamContinent(teamA);
                teamBContinent = getTeamContinent(teamB);
            }

            // Check if this match is between the two selected continents
            const isContinent1A = teamAContinent === continent1;
            const isContinent1B = teamBContinent === continent1;
            const isContinent2A = teamAContinent === continent2;
            const isContinent2B = teamBContinent === continent2;

            if ((isContinent1A && isContinent2B) || (isContinent1B && isContinent2A)) {
                // This is a match between the two continents
                if (isContinent1A && isContinent2B) {
                    // TeamA is continent1, TeamB is continent2
                    stats.continent1.matches++;
                    stats.continent2.matches++;
                    stats.continent1.gf += scoreA;
                    stats.continent1.ga += scoreB;
                    stats.continent2.gf += scoreB;
                    stats.continent2.ga += scoreA;

                    if (scoreA > scoreB) {
                        stats.continent1.win++;
                        stats.continent2.loss++;
                    } else if (scoreA < scoreB) {
                        stats.continent1.loss++;
                        stats.continent2.win++;
                    } else {
                        stats.continent1.draw++;
                        stats.continent2.draw++;
                    }
                } else {
                    // TeamA is continent2, TeamB is continent1
                    stats.continent1.matches++;
                    stats.continent2.matches++;
                    stats.continent1.gf += scoreB;
                    stats.continent1.ga += scoreA;
                    stats.continent2.gf += scoreA;
                    stats.continent2.ga += scoreB;

                    if (scoreB > scoreA) {
                        stats.continent1.win++;
                        stats.continent2.loss++;
                    } else if (scoreB < scoreA) {
                        stats.continent1.loss++;
                        stats.continent2.win++;
                    } else {
                        stats.continent1.draw++;
                        stats.continent2.draw++;
                    }
                }
            }
        });

        return stats;
    }

    function setupDynamicTeamsSearch() {
        const searchInput = document.getElementById('nmww-teams-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('keyup', () => {
            const tableBody = document.getElementById('nmww-teams-stats-tbody');
            if (!tableBody) return;
            const searchTerm = searchInput.value.toLowerCase().trim();
            const rows = tableBody.getElementsByTagName('tr');
            for (const row of rows) {
                // Always show total row
                if (row.id === 'nmww-teams-total-row') {
                    row.style.display = '';
                    continue;
                }
                const rowText = row.textContent.toLowerCase();
                row.style.display = rowText.includes(searchTerm) ? '' : 'none';
            }
            // Update total row based on visible rows
            updateTeamsTotalRow();
        });
    }

    async function getConfig() {
        const res = await fetch('/api/national-men-WW/config');
        if (!res.ok) throw new Error('Failed to load config');
        const cfg = await res.json();
        if (!cfg.success || !cfg.appsScriptUrl) throw new Error('Apps Script URL not configured');
        return cfg.appsScriptUrl;
    }

    async function fetchData(forceRefresh = false) {
        const fetchFunction = async () => {
            // Use backend API endpoint with caching instead of direct Google Apps Script
            const url = forceRefresh
                ? '/api/national-men-WW/data?refresh=true'
                : '/api/national-men-WW/data';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch data');
            const json = await res.json();
            if (!json.success || !Array.isArray(json.data)) {
                throw new Error('Invalid response from API');
            }
            return json.data;
        };
        // Backend already handles caching, so we can still use browser cache for offline support
        const records = await fetchWithBrowserCache('WW_Halls_national_men', fetchFunction, forceRefresh);
        return Array.isArray(records) ? records : [];
    }

    function normalizeRecord(rec) {
        const obj = {};
        (window.NATIONAL_MEN_WW_COLUMNS || []).forEach((k) => {
            const value = rec ? rec[k] : null;
            // This logic is borrowed from al_ahly_stats.js to correctly handle zero values
            obj[k] = (value == null ? '' : String(value)).trim();
        });
        return obj;
    }

    function applyCurrentFilters() {
        const cols = window.NATIONAL_MEN_WW_COLUMNS || [];
        const textFilters = {};
        cols.forEach((c) => {
            const el = document.getElementById(`filter-${c}`);
            if (el && el.value && c !== 'Date') {
                const filterValue = String(el.value).trim();
                if (filterValue) {
                    textFilters[c] = filterValue.toLowerCase();
                }
            }
        });
        // combined Teams filter (matches TeamA or TeamB)
        const teamFilterEl = document.getElementById('filter-Teams');
        const teamFilter = teamFilterEl && teamFilterEl.value ? String(teamFilterEl.value).trim().toLowerCase() : '';
        const dateFrom = document.getElementById('filter-DateFrom')?.value;
        const dateTo = document.getElementById('filter-DateTo')?.value;

        return allRecords.filter((r) => {
            // Apply all text filters (GAME, AGE, etc.) - must match ALL filters
            for (const k in textFilters) {
                const filterValue = textFilters[k];
                if (!filterValue) continue; // Skip empty filters

                const recordValue = String(r[k] || '').trim().toLowerCase();
                if (!recordValue || !recordValue.includes(filterValue)) {
                    return false;
                }
            }

            // Apply team filter (exact match)
            if (teamFilter) {
                const ta = String(r['TeamA'] || '').trim().toLowerCase();
                const tb = String(r['TeamB'] || '').trim().toLowerCase();
                if (ta !== teamFilter && tb !== teamFilter) {
                    return false;
                }
            }

            // Apply date filters
            if (dateFrom || dateTo) {
                const dStr = r['Date'];
                if (dStr) {
                    const d = new Date(dStr);
                    if (isFinite(d)) {
                        if (dateFrom && d < new Date(dateFrom)) return false;
                        if (dateTo && d > new Date(dateTo)) return false;
                    }
                } else if (dateFrom || dateTo) {
                    // If date filter is set but record has no date, exclude it
                    return false;
                }
            }

            return true;
        });
    }

    function getSelectedTeamFilter() {
        const el = document.getElementById('filter-Teams');
        return el && el.value ? String(el.value).trim() : '';
    }

    function getResultSymbol(n) {
        const selectedTeam = getSelectedTeamFilter();
        if (!selectedTeam) return '-';
        const teamA = String(n['TeamA'] || '').trim();
        const teamB = String(n['TeamB'] || '').trim();
        const a = parseInt(n['TeamAScore'], 10);
        const b = parseInt(n['TeamBScore'], 10);
        if (isNaN(a) || isNaN(b)) return '-';
        const sel = selectedTeam.toLowerCase();
        const isA = teamA.toLowerCase() === sel;
        const isB = teamB.toLowerCase() === sel;
        if (!isA && !isB) return '-';
        if (a === b) return 'D';
        if (isA) return a > b ? 'W' : 'L';
        // isB
        return b > a ? 'W' : 'L';
    }

    function getResultClass(symbol) {
        if (symbol === 'W') return 'wl-cell wl-win';
        if (symbol === 'D') return 'wl-cell wl-draw';
        if (symbol === 'L') return 'wl-cell wl-loss';
        return 'wl-cell';
    }

    // Helper function to render a single row
    function renderRow(rec) {
        const cols = ['GAME', 'AGE', 'Season', 'Round', 'TeamA', 'TeamAScore', 'TeamBScore', 'TeamB'];
        const n = normalizeRecord(rec);
        const tds = cols.map((c) => `<td>${escapeHtml(String(n[c] ?? ''))}</td>`).join('');
        const wl = getResultSymbol(n);
        const wlClass = getResultClass(wl);
        return `<tr>${tds}<td><span class="${wlClass}">${wl}</span></td></tr>`;
    }

    // Virtual scrolling render function
    function renderVisibleRows() {
        const tbody = document.getElementById('national-men-WW-tbody');
        if (!tbody) return;

        const { allData, startIndex, endIndex } = virtualScrollState;
        const visibleData = allData.slice(startIndex, endIndex);

        // Create spacer row for top (only if startIndex > 0)
        const topSpacer = startIndex > 0 ? `<tr style="height: ${startIndex * virtualScrollState.rowHeight}px;"><td colspan="9"></td></tr>` : '';
        // Render visible rows
        const rowsHtml = visibleData.map(renderRow).join('');
        // Create spacer row for bottom
        const bottomSpacer = `<tr style="height: ${Math.max(0, allData.length - endIndex) * virtualScrollState.rowHeight}px;"><td colspan="9"></td></tr>`;

        tbody.innerHTML = topSpacer + rowsHtml + bottomSpacer;
    }

    function renderTable(records) {
        const tbody = document.getElementById('national-men-WW-tbody');
        if (!tbody) return;

        // Get selected team from Teams filter
        const selectedTeam = getSelectedTeamFilter();
        const selectedTeamLower = selectedTeam ? selectedTeam.toLowerCase() : '';

        // Apply continent filter if any selected (always check current state)
        const checkboxes = document.querySelectorAll('.matches-continent-cb');
        const selectedContinents = new Set();
        checkboxes.forEach(cb => {
            if (cb && cb.checked) {
                selectedContinents.add(cb.value);
            }
        });

        let filteredRecords = records;
        if (selectedContinents.size > 0) {
            filteredRecords = records.filter(r => {
                const teamA = String(r['TeamA'] || '').trim();
                const teamB = String(r['TeamB'] || '').trim();
                const teamALower = teamA.toLowerCase();
                const teamBLower = teamB.toLowerCase();

                // If a specific team is selected, check if the OTHER team matches the continent
                if (selectedTeamLower) {
                    const isTeamA = teamALower === selectedTeamLower;
                    const isTeamB = teamBLower === selectedTeamLower;

                    if (isTeamA) {
                        // Selected team is TeamA, check if TeamB matches continent
                        for (const continent of selectedContinents) {
                            if (continent === 'arab-countries') {
                                if (isArabCountry(teamB)) return true;
                            } else {
                                const teamBContinent = getTeamContinent(teamB);
                                if (teamBContinent === continent) return true;
                            }
                        }
                        return false;
                    } else if (isTeamB) {
                        // Selected team is TeamB, check if TeamA matches continent
                        for (const continent of selectedContinents) {
                            if (continent === 'arab-countries') {
                                if (isArabCountry(teamA)) return true;
                            } else {
                                const teamAContinent = getTeamContinent(teamA);
                                if (teamAContinent === continent) return true;
                            }
                        }
                        return false;
                    } else {
                        // Selected team is not in this match, exclude it
                        return false;
                    }
                } else {
                    // No specific team selected, check if either team matches continent
                    for (const continent of selectedContinents) {
                        if (continent === 'arab-countries') {
                            if (isArabCountry(teamA) || isArabCountry(teamB)) return true;
                        } else {
                            const teamAContinent = getTeamContinent(teamA);
                            const teamBContinent = getTeamContinent(teamB);
                            if (teamAContinent === continent || teamBContinent === continent) return true;
                        }
                    }
                    return false;
                }
            });
        }

        // Always update virtualScrollState to track current data for search functionality
        virtualScrollState.allData = filteredRecords;
        virtualScrollState.currentViewData = filteredRecords;

        // Update team statistics summary if team filter is active
        updateTeamStatsSummary(filteredRecords);

        // Remove old scroll handlers first to prevent conflicts
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }

        // Reset scroll position to top when filters change
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.scrollTop = 0;
        }

        // For small datasets (< 1000 rows), render everything at once for better compatibility
        if (filteredRecords.length <= 1000) {
            const cols = ['GAME', 'AGE', 'Season', 'Round', 'TeamA', 'TeamAScore', 'TeamBScore', 'TeamB'];
            const rowsHtml = filteredRecords.map((rec) => {
                const n = normalizeRecord(rec);
                const tds = cols.map((c) => `<td>${escapeHtml(String(n[c] ?? ''))}</td>`).join('');
                const wl = getResultSymbol(n);
                const wlClass = getResultClass(wl);
                return `<tr>${tds}<td><span class="${wlClass}">${wl}</span></td></tr>`;
            }).join('');
            tbody.innerHTML = rowsHtml;
            // Reset scroll indices for consistency
            virtualScrollState.startIndex = 0;
            virtualScrollState.endIndex = filteredRecords.length;
            return;
        }

        // For large datasets, use virtual scrolling
        // Reset scroll state
        virtualScrollState.startIndex = 0;
        virtualScrollState.endIndex = Math.min(25, filteredRecords.length);

        // Initial render
        renderVisibleRows();

        // Setup virtual scrolling
        setupVirtualScrolling();
    }

    function setupVirtualScrolling() {
        // Remove old scroll handler if exists
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
            }
        }

        // Create new scroll handler
        virtualScrollState.scrollHandler = function handleScroll(e) {
            const container = e.target;
            if (!container) return;

            const scrollTop = container.scrollTop || 0;
            const containerHeight = container.clientHeight || 0;
            const { allData, rowHeight, bufferSize } = virtualScrollState;

            // Calculate which rows should be visible
            const visibleStart = Math.floor(scrollTop / rowHeight);
            const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);

            // Add buffer
            const bufferStart = Math.max(0, visibleStart - bufferSize);
            const bufferEnd = Math.min(allData.length, visibleEnd + bufferSize);

            // Only re-render if the visible range has changed significantly
            if (Math.abs(bufferStart - virtualScrollState.startIndex) > 5 ||
                Math.abs(bufferEnd - virtualScrollState.endIndex) > 5) {
                virtualScrollState.startIndex = bufferStart;
                virtualScrollState.endIndex = bufferEnd;
                renderVisibleRows();
            }
        };

        // Attach scroll listener to the table container
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.addEventListener('scroll', virtualScrollState.scrollHandler);
        }
    }

    function computeTeamStats(records) {
        const stats = new Map();
        function ensure(team) {
            if (!stats.has(team)) {
                stats.set(team, { team, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(team);
        }
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            const season = String(r['Season'] || '').trim();
            if (!aTeam || !bTeam || isNaN(a) || isNaN(b)) return;
            const sa = ensure(aTeam); const sb = ensure(bTeam);
            sa.matches += 1; sb.matches += 1;
            sa.gf += a; sa.ga += b;
            sb.gf += b; sb.ga += a;
            if (season) { sa.seasons.add(season); sb.seasons.add(season); }
            if (a > b) { sa.win += 1; sb.loss += 1; }
            else if (a < b) { sa.loss += 1; sb.win += 1; }
            else { sa.draw += 1; sb.draw += 1; }
        });
        return Array.from(stats.values()).map(s => ({
            team: s.team,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x, y) => y.matches - x.matches || x.team.localeCompare(y.team));
    }

    function renderTeamStats(records) {
        const tbody = document.getElementById('nmww-teams-stats-tbody');
        if (!tbody) return;
        const stats = computeTeamStats(records);

        // Get selected continents from checkboxes
        const checkboxes = document.querySelectorAll('.continent-cb');
        const selectedContinents = new Set();
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selectedContinents.add(cb.value);
            }
        });

        // Apply continent filter if any selected
        let filteredStats = stats;
        if (selectedContinents.size > 0) {
            filteredStats = stats.filter(s => {
                // Check if team matches any selected continent
                for (const continent of selectedContinents) {
                    if (continent === 'arab-countries') {
                        if (isArabCountry(s.team)) return true;
                    } else {
                        const teamContinent = getTeamContinent(s.team);
                        if (teamContinent === continent) return true;
                    }
                }
                return false;
            });
        }

        // Store filtered records for details view
        window.__nmww_filtered_records = records;
        const rows = filteredStats.map((s) => {
            return `
            <tr>
                <td style="cursor:pointer; color:#007bff; text-decoration:underline;" onclick="window.nationalMenWW.showTeamDetails('${escapeHtml(s.team).replace(/'/g, "\\'")}')">${escapeHtml(s.team)}</td>
                <td>${s.participations || 0}</td>
                <td>${s.matches}</td>
                <td>${s.win}</td>
                <td>${s.draw}</td>
                <td>${s.loss}</td>
                <td>${s.gf}</td>
                <td>${s.ga}</td>
            </tr>
        `;
        }).join('');

        // Calculate totals
        let totalParticipations = 0;
        let totalMatches = 0;
        let totalWin = 0;
        let totalDraw = 0;
        let totalLoss = 0;
        let totalGF = 0;
        let totalGA = 0;

        filteredStats.forEach(s => {
            totalParticipations += s.participations || 0;
            totalMatches += s.matches || 0;
            totalWin += s.win || 0;
            totalDraw += s.draw || 0;
            totalLoss += s.loss || 0;
            totalGF += s.gf || 0;
            totalGA += s.ga || 0;
        });

        // Add total row with id for easy access
        const totalRow = `
            <tr id="nmww-teams-total-row" style="background-color:#f8f9fa; font-weight:700;">
                <td><strong>Total</strong></td>
                <td><strong id="total-participations">${totalParticipations}</strong></td>
                <td><strong id="total-matches">${totalMatches}</strong></td>
                <td><strong id="total-win">${totalWin}</strong></td>
                <td><strong id="total-draw">${totalDraw}</strong></td>
                <td><strong id="total-loss">${totalLoss}</strong></td>
                <td><strong id="total-gf">${totalGF}</strong></td>
                <td><strong id="total-ga">${totalGA}</strong></td>
            </tr>
        `;

        tbody.innerHTML = rows + totalRow;

        // Store stats globally for search recalculation
        window.__nmww_teams_stats_data = filteredStats;
    }

    function computeTeamStatsByGame(teamName, records) {
        const stats = new Map();
        function ensure(game) {
            if (!stats.has(game)) {
                stats.set(game, { game, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(game);
        }
        const normalizedTeamName = String(teamName || '').trim();
        records.forEach(r => {
            const game = String(r['GAME'] || '').trim();
            if (!game) return;
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            if (isNaN(a) || isNaN(b)) return;
            // Use case-insensitive comparison to handle minor differences
            const isTeamA = aTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            const isTeamB = bTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            if (!isTeamA && !isTeamB) return;
            const s = ensure(game);
            s.matches += 1;
            const season = String(r['Season'] || '').trim();
            if (season) s.seasons.add(season);
            if (isTeamA) {
                s.gf += a; s.ga += b;
                if (a > b) s.win += 1;
                else if (a < b) s.loss += 1;
                else s.draw += 1;
            } else {
                s.gf += b; s.ga += a;
                if (b > a) s.win += 1;
                else if (b < a) s.loss += 1;
                else s.draw += 1;
            }
        });
        return Array.from(stats.values()).map(s => ({
            game: s.game,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x, y) => x.game.localeCompare(y.game));
    }

    function getTeamStatsByGameAndAge(teamName, gameName, records) {
        const normalizedTeamName = String(teamName || '').trim();
        const normalizedGameName = String(gameName || '').trim();
        const stats = new Map();

        function ensure(age) {
            if (!stats.has(age)) {
                stats.set(age, { AGE: age, matches: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, seasons: new Set() });
            }
            return stats.get(age);
        }

        records.forEach(r => {
            const game = String(r['GAME'] || '').trim();
            if (game !== normalizedGameName) return;

            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const a = parseInt(r['TeamAScore'], 10);
            const b = parseInt(r['TeamBScore'], 10);
            if (isNaN(a) || isNaN(b)) return;

            const isTeamA = aTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            const isTeamB = bTeam.toLowerCase() === normalizedTeamName.toLowerCase();
            if (!isTeamA && !isTeamB) return;

            const age = String(r['AGE'] || '').trim();
            if (!age) return;

            const s = ensure(age);
            s.matches += 1;
            const season = String(r['Season'] || '').trim();
            if (season) s.seasons.add(season);

            if (isTeamA) {
                s.gf += a;
                s.ga += b;
                if (a > b) s.win += 1;
                else if (a < b) s.loss += 1;
                else s.draw += 1;
            } else {
                s.gf += b;
                s.ga += a;
                if (b > a) s.win += 1;
                else if (b < a) s.loss += 1;
                else s.draw += 1;
            }
        });

        return Array.from(stats.values()).map(s => ({
            AGE: s.AGE,
            matches: s.matches,
            win: s.win,
            draw: s.draw,
            loss: s.loss,
            gf: s.gf,
            ga: s.ga,
            participations: s.seasons.size
        })).sort((x, y) => x.AGE.localeCompare(y.AGE));
    }

    function showTeamDetails(teamName) {
        const records = Array.isArray(window.__nmww_filtered_records) ? window.__nmww_filtered_records : [];
        const details = computeTeamStatsByGame(teamName, records);

        if (!details || details.length === 0) {
            alert(`No statistics available for ${teamName}`);
            return;
        }

        // Create unique ID for this modal
        const modalId = `nmww-team-modal-${Date.now()}`;

        // Create modal content
        let modalContent = `
            <div class="modal-overlay" id="${modalId}" onclick="window.nationalMenWW.closeTeamDetailsModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${escapeHtml(teamName)} - Statistics by Game</h3>
                        <button class="modal-close" onclick="window.nationalMenWW.closeTeamDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>Game</th>
                                    <th>Participations</th>
                                    <th>Matches</th>
                                    <th>Win</th>
                                    <th>Draw</th>
                                    <th>Loss</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        details.forEach((d, idx) => {
            const gameId = `game-row-${idx}`;
            const gameNameRaw = String(d.game || '');
            modalContent += `
                <tr id="${gameId}">
                    <td style="cursor:pointer; color:#007bff; text-decoration:underline; font-weight:600;" 
                        class="game-clickable" 
                        data-team="${escapeHtml(teamName).replace(/"/g, '&quot;')}" 
                        data-game="${escapeHtml(gameNameRaw).replace(/"/g, '&quot;')}" 
                        data-modal-id="${modalId}">${escapeHtml(gameNameRaw)}</td>
                    <td>${d.participations || 0}</td>
                    <td>${d.matches || 0}</td>
                    <td>${d.win || 0}</td>
                    <td>${d.draw || 0}</td>
                    <td>${d.loss || 0}</td>
                    <td>${d.gf || 0}</td>
                    <td>${d.ga || 0}</td>
                </tr>
            `;
        });

        // Calculate totals
        let totalMatches = 0, totalWin = 0, totalDraw = 0, totalLoss = 0, totalGF = 0, totalGA = 0;
        details.forEach(d => {
            totalMatches += d.matches || 0;
            totalWin += d.win || 0;
            totalDraw += d.draw || 0;
            totalLoss += d.loss || 0;
            totalGF += d.gf || 0;
            totalGA += d.ga || 0;
        });
        // Total participations = unique seasons for this team in all filtered records
        const totalSeasons = new Set();
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const season = String(r['Season'] || '').trim();
            if (!season) return;
            if (aTeam.toLowerCase() === String(teamName).toLowerCase() || bTeam.toLowerCase() === String(teamName).toLowerCase()) {
                totalSeasons.add(season);
            }
        });
        const totalParticipations = totalSeasons.size;

        modalContent += `
                                <tr class="total-row">
                                    <td><strong>Total</strong></td>
                                    <td><strong>${totalParticipations}</strong></td>
                                    <td><strong>${totalMatches}</strong></td>
                                    <td><strong>${totalWin}</strong></td>
                                    <td><strong>${totalDraw}</strong></td>
                                    <td><strong>${totalLoss}</strong></td>
                                    <td><strong>${totalGF}</strong></td>
                                    <td><strong>${totalGA}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.nationalMenWW.closeTeamDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalContent);

        // Store team name and records in modal for later use
        const modalElement = document.getElementById(modalId);
        if (modalElement) {
            modalElement._teamName = teamName;
            modalElement._records = records;
        }

        // Add event listeners to game-clickable cells
        setTimeout(() => {
            const gameCells = modalElement?.querySelectorAll('.game-clickable');
            gameCells?.forEach(cell => {
                cell.addEventListener('click', function () {
                    const team = this.getAttribute('data-team');
                    const game = this.getAttribute('data-game');
                    const parentModalId = this.getAttribute('data-modal-id');
                    toggleGameDetails(team, game, null, parentModalId);
                });
            });
        }, 10);
    }

    function toggleGameDetails(teamName, gameName, expandRowId, modalId) {
        // Get records from modal or global
        const modal = document.getElementById(modalId);
        const records = modal && modal._records ? modal._records : (Array.isArray(window.__nmww_filtered_records) ? window.__nmww_filtered_records : []);
        const stats = getTeamStatsByGameAndAge(teamName, gameName, records);

        if (!stats || stats.length === 0) {
            alert(`No statistics found for ${teamName} in ${gameName}`);
            return;
        }

        // Create a new modal for game statistics by AGE
        const gameModalId = `nmww-game-modal-${Date.now()}`;

        let modalContent = `
            <div class="modal-overlay" id="${gameModalId}" onclick="window.nationalMenWW.closeGameDetailsModal()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>${escapeHtml(teamName)} - ${escapeHtml(gameName)} - Statistics by AGE</h3>
                        <button class="modal-close" onclick="window.nationalMenWW.closeGameDetailsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <table class="modal-table">
                            <thead>
                                <tr>
                                    <th>AGE</th>
                                    <th>Participations</th>
                                    <th>Matches</th>
                                    <th>Win</th>
                                    <th>Draw</th>
                                    <th>Loss</th>
                                    <th>GF</th>
                                    <th>GA</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        stats.forEach(s => {
            modalContent += `
                <tr>
                    <td>${escapeHtml(String(s.AGE || ''))}</td>
                    <td>${s.participations || 0}</td>
                    <td>${s.matches || 0}</td>
                    <td>${s.win || 0}</td>
                    <td>${s.draw || 0}</td>
                    <td>${s.loss || 0}</td>
                    <td>${s.gf || 0}</td>
                    <td>${s.ga || 0}</td>
                </tr>
            `;
        });

        // Calculate totals
        let totalMatches = 0, totalWin = 0, totalDraw = 0, totalLoss = 0, totalGF = 0, totalGA = 0;
        stats.forEach(s => {
            totalMatches += s.matches || 0;
            totalWin += s.win || 0;
            totalDraw += s.draw || 0;
            totalLoss += s.loss || 0;
            totalGF += s.gf || 0;
            totalGA += s.ga || 0;
        });
        // Total participations = unique seasons for this team in this game across AGE
        const seasonsInGame = new Set();
        records.forEach(r => {
            const aTeam = String(r['TeamA'] || '').trim();
            const bTeam = String(r['TeamB'] || '').trim();
            const season = String(r['Season'] || '').trim();
            const game = String(r['GAME'] || '').trim();
            if (!season || game !== String(gameName).trim()) return;
            if (aTeam.toLowerCase() === String(teamName).toLowerCase() || bTeam.toLowerCase() === String(teamName).toLowerCase()) {
                seasonsInGame.add(season);
            }
        });
        const totalParticipations = seasonsInGame.size;

        modalContent += `
                                <tr class="total-row">
                                    <td><strong>Total</strong></td>
                                    <td><strong>${totalParticipations}</strong></td>
                                    <td><strong>${totalMatches}</strong></td>
                                    <td><strong>${totalWin}</strong></td>
                                    <td><strong>${totalDraw}</strong></td>
                                    <td><strong>${totalLoss}</strong></td>
                                    <td><strong>${totalGF}</strong></td>
                                    <td><strong>${totalGA}</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.nationalMenWW.closeGameDetailsModal()">Close</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalContent);
    }

    function closeGameDetailsModal() {
        const modals = document.querySelectorAll('.modal-overlay[id^="nmww-game-modal-"]');
        modals.forEach(modal => modal.remove());
    }

    function closeTeamDetailsModal() {
        // Close only team details modal, not game details modals
        const modals = document.querySelectorAll('.modal-overlay');
        modals.forEach(modal => {
            if (modal.id && modal.id.startsWith('nmww-team-modal-')) {
                modal.remove();
            } else if (!modal.id || !modal.id.startsWith('nmww-game-modal-')) {
                // Fallback for modals without ID
                modal.remove();
            }
        });
    }

    function hookTabs() {
        const btnMatches = document.getElementById('nmww-tab-matches-btn');
        const btnH2H = document.getElementById('nmww-tab-h2h-btn');
        const btnTeams = document.getElementById('nmww-tab-teams-btn');
        const btnRanking = document.getElementById('nmww-tab-ranking-btn');
        const tabMatches = document.getElementById('nmww-matches-tab');
        const tabH2H = document.getElementById('nmww-h2h-tab');
        const tabTeams = document.getElementById('nmww-teams-tab');
        const tabRanking = document.getElementById('nmww-ranking-tab');
        if (!btnMatches || !btnH2H || !btnTeams || !btnRanking || !tabMatches || !tabH2H || !tabTeams || !tabRanking) return;
        const activate = (name) => {
            // Close modal when switching tabs
            closeTeamDetailsModal();
            // Reset all buttons
            [btnMatches, btnH2H, btnTeams, btnRanking].forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = '#f1f3f5';
                btn.style.color = '#495057';
            });
            // Hide all tabs
            [tabMatches, tabH2H, tabTeams, tabRanking].forEach(tab => {
                tab.style.display = 'none';
            });

            if (name === 'matches') {
                btnMatches.classList.add('active');
                btnMatches.style.background = '#007bff';
                btnMatches.style.color = '#fff';
                tabMatches.style.display = 'block';
                // Setup continent filter when matches tab is activated
                setTimeout(() => setupMatchesContinentFilter(), 100);
            } else if (name === 'h2h') {
                btnH2H.classList.add('active');
                btnH2H.style.background = '#007bff';
                btnH2H.style.color = '#fff';
                tabH2H.style.display = 'block';
                // Setup H2H continent filters when H2H tab is activated
                setTimeout(() => setupH2HContinentFilters(), 100);
            } else if (name === 'teams') {
                btnTeams.classList.add('active');
                btnTeams.style.background = '#007bff';
                btnTeams.style.color = '#fff';
                tabTeams.style.display = 'block';
                // Setup continent filter when teams tab is activated
                setTimeout(() => setupContinentFilter(), 100);
            } else if (name === 'ranking') {
                btnRanking.classList.add('active');
                btnRanking.style.background = '#007bff';
                btnRanking.style.color = '#fff';
                tabRanking.style.display = 'block';
            }
        };
        btnMatches.addEventListener('click', () => activate('matches'));
        btnH2H.addEventListener('click', () => activate('h2h'));
        btnTeams.addEventListener('click', () => activate('teams'));
        btnRanking.addEventListener('click', () => activate('ranking'));
        // default active is matches
        activate('matches');
    }

    function showLoading(show) {
        const l = document.getElementById('loading-container');
        const c = document.getElementById('content-container');
        if (l) l.style.display = show ? 'flex' : 'none';
        if (c) c.style.display = show ? 'none' : 'block';
    }

    function escapeHtml(s) {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function loadData(forceRefresh = false, skipLoadingState = false) {
        const refreshBtn = document.querySelector('.btn-refresh');

        // Set loading state on button
        if (refreshBtn) {
            refreshBtn.disabled = true;
            const icon = refreshBtn.querySelector('svg');
            if (icon) icon.classList.add('spinning');

            // Handle text node update
            const textNode = Array.from(refreshBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (textNode) {
                textNode.textContent = ' Syncing...';
            } else {
                // If structure is different, fallback
                refreshBtn.innerHTML = `
                    <svg class="icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg> Syncing...`;
            }
        }

        try {
            if (!skipLoadingState) {
                showLoading(true);
            }
            const data = await fetchData(forceRefresh);
            allRecords = data.map(normalizeRecord);
            // expose for other helpers
            window.__nmww_records = allRecords;
            populateFilterOptions(allRecords);
            setupAllSearchableSelects();
            const filtered = applyCurrentFilters();
            renderTable(filtered);
            renderTeamStats(filtered);
            hookTabs();
            setupDynamicTeamsSearch();
            setupContinentFilter();
            setupMatchesContinentFilter();
            setupH2HContinentFilters();
            setupRankingTeamSearch();
            setupRankingSubTabs();
            if (!skipLoadingState) {
                showLoading(false);
            }
        } catch (e) {
            console.error('Failed to load National Men WW data:', e);
            allRecords = [];
            renderTable([]);
            renderTeamStats([]);
            if (!skipLoadingState) {
                showLoading(false);
            }
            if (forceRefresh) throw e;
        } finally {
            // Reset button only if NOT force refresh (initial load)
            if (!forceRefresh && refreshBtn) {
                refreshBtn.disabled = false;
                const icon = refreshBtn.querySelector('svg');
                if (icon) icon.classList.remove('spinning');

                const textNode = Array.from(refreshBtn.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                if (textNode) {
                    textNode.textContent = ' Sync Data';
                }
            }
        }
    }

    function applyFilters() {
        filtersApplied = true;
        const filtered = applyCurrentFilters();
        renderTable(filtered);
        renderTeamStats(filtered);
        updateH2HTable(); // Update H2H table when filters change
        // Close modal when filters change
        closeTeamDetailsModal();
        const searchInput = document.getElementById('matches-search-input');
        if (searchInput) searchInput.value = '';
        const teamSearchInput = document.getElementById('nmww-teams-search-input');
        if (teamSearchInput) teamSearchInput.value = '';
        // Note: Continent filter is preserved when applying other filters

        // Recalculate rankings if a team is selected
        if (window.__nmww_selected_team) {
            const btnLastAge = document.getElementById('nmww-subtab-last-age-btn');
            const isLastAgeActive = btnLastAge && btnLastAge.classList.contains('active');
            if (isLastAgeActive) {
                calculateAndRenderRankingsLastAge(window.__nmww_selected_team);
            } else {
                calculateAndRenderRankingsLastSeason(window.__nmww_selected_team);
            }
        }
    }

    function clearFilters() {
        filtersApplied = false;
        const cols = window.NATIONAL_MEN_WW_COLUMNS || [];
        cols.forEach((c) => {
            const el = document.getElementById(`filter-${c}`);
            if (el) el.value = '';
        });
        const teams = document.getElementById('filter-Teams');
        if (teams) teams.value = '';
        const df = document.getElementById('filter-DateFrom');
        const dt = document.getElementById('filter-DateTo');
        if (df) df.value = '';
        if (dt) dt.value = '';

        // Clear continent filter checkboxes (Teams tab)
        const continentCheckboxes = document.querySelectorAll('.continent-cb');
        continentCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        const continentInput = document.getElementById('nmww-continent-filter-input');
        if (continentInput) {
            continentInput.value = '';
            continentInput.placeholder = 'Select Continents...';
        }

        // Clear continent filter checkboxes (Matches tab)
        const matchesContinentCheckboxes = document.querySelectorAll('.matches-continent-cb');
        matchesContinentCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        const matchesContinentInput = document.getElementById('nmww-matches-continent-filter-input');
        if (matchesContinentInput) {
            matchesContinentInput.value = '';
            matchesContinentInput.placeholder = 'Select Continents...';
        }

        // Clear H2H continent filter checkboxes
        const h2hContinent1Checkboxes = document.querySelectorAll('.h2h-continent1-cb');
        const h2hContinent2Checkboxes = document.querySelectorAll('.h2h-continent2-cb');
        h2hContinent1Checkboxes.forEach(cb => { cb.checked = false; });
        h2hContinent2Checkboxes.forEach(cb => { cb.checked = false; });
        const h2hContinent1Input = document.getElementById('nmww-h2h-continent1-input');
        const h2hContinent2Input = document.getElementById('nmww-h2h-continent2-input');
        if (h2hContinent1Input) {
            h2hContinent1Input.value = '';
            h2hContinent1Input.placeholder = 'Select Continent...';
        }
        if (h2hContinent2Input) {
            h2hContinent2Input.value = '';
            h2hContinent2Input.placeholder = 'Select Continent...';
        }

        const searchInput = document.getElementById('matches-search-input');
        if (searchInput) searchInput.value = '';

        applyFilters();
    }

    // Refresh data with visual feedback
    async function refreshData() {
        const refreshBtn = event.target.closest('button');
        const refreshIcon = refreshBtn?.querySelector('svg');
        const originalText = refreshBtn.innerHTML;

        // Show loading state on button only
        refreshBtn.disabled = true;
        if (refreshIcon) {
            refreshIcon.classList.add('spinning');
        }
        refreshBtn.innerHTML = '<svg class="spinning" style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Syncing...';

        try {
            await loadData(true, true); // true = force refresh, true = skip loading state

            // Show success message
            refreshBtn.innerHTML = '<svg style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Synced!';

            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 2000);
        } catch (error) {
            refreshBtn.innerHTML = '<svg style="width: 18px; height: 18px; display: inline-block; vertical-align: middle; margin-right: 0.5rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Error!';

            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 2000);
        }
    }

    const initPage = () => {
        loadData(false);
        setupDynamicTableSearch();
        setupDynamicTeamsSearch();
        setupContinentFilter();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPage);
    } else {
        initPage();
    }

    return {
        loadData,
        applyFilters,
        clearFilters,
        refreshData,
        showTeamDetails,
        closeTeamDetailsModal,
        toggleGameDetails,
        closeGameDetailsModal,
        applyCurrentFilters,
        get filtersApplied() { return filtersApplied; }
    };
})();

// ============================================================================
// RANKING FUNCTIONS
// ============================================================================

// Setup ranking team search
function setupRankingTeamSearch() {
    const input = document.getElementById('nmww-ranking-team-search');
    const dropdown = document.getElementById('nmww-ranking-team-dropdown');

    if (!input || !dropdown) return;

    // Get all unique teams from TeamA and TeamB
    const allTeams = new Set();
    const records = window.__nmww_records || [];

    records.forEach(record => {
        if (record['TeamA']) allTeams.add(String(record['TeamA']).trim());
        if (record['TeamB']) allTeams.add(String(record['TeamB']).trim());
    });

    const sortedTeams = Array.from(allTeams).filter(t => t).sort();

    // Remove previous listeners by cloning
    const container = input.parentElement;
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    const newInput = newContainer.querySelector('input');
    const newDropdown = newContainer.querySelector('.dropdown-options');

    if (!newInput || !newDropdown) return;

    // Setup search
    newInput.addEventListener('focus', () => {
        renderTeamOptions(newInput, newDropdown, sortedTeams, newInput.value || '');
    });

    newInput.addEventListener('input', (e) => {
        renderTeamOptions(newInput, newDropdown, sortedTeams, e.target.value);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.searchable-select-container')) {
            newDropdown.style.display = 'none';
        }
    });
}

function renderTeamOptions(input, dropdown, teams, filterText) {
    const filter = filterText.toLowerCase().trim();
    const filtered = teams.filter(team =>
        team.toLowerCase().includes(filter)
    );

    dropdown.innerHTML = '';

    if (filtered.length === 0) {
        dropdown.style.display = 'none';
        return;
    }

    filtered.forEach(team => {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = team;
        div.addEventListener('click', () => {
            input.value = team;
            dropdown.style.display = 'none';
            // Store selected team globally
            window.__nmww_selected_team = team;
            // Calculate and display rankings - Last AGE is now the default
            calculateAndRenderRankingsLastAge(team);
        });
        dropdown.appendChild(div);
    });

    dropdown.style.display = 'block';
}

// Setup ranking sub tabs
function setupRankingSubTabs() {
    const btnLastSeason = document.getElementById('nmww-subtab-last-season-btn');
    const btnLastAge = document.getElementById('nmww-subtab-last-age-btn');
    const contentLastSeason = document.getElementById('nmww-subtab-last-season-content');
    const contentLastAge = document.getElementById('nmww-subtab-last-age-content');

    if (!btnLastSeason || !btnLastAge || !contentLastSeason || !contentLastAge) return;

    const activate = (type) => {
        // Reset all buttons
        [btnLastSeason, btnLastAge].forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = '#f1f3f5';
            btn.style.color = '#495057';
        });

        // Hide all contents
        [contentLastSeason, contentLastAge].forEach(content => {
            content.style.display = 'none';
        });

        if (type === 'last-age') {
            btnLastAge.classList.add('active');
            btnLastAge.style.background = '#007bff';
            btnLastAge.style.color = '#fff';
            contentLastAge.style.display = 'block';
            // Recalculate if team is selected
            if (window.__nmww_selected_team) {
                calculateAndRenderRankingsLastAge(window.__nmww_selected_team);
            }
        } else if (type === 'last-season') {
            btnLastSeason.classList.add('active');
            btnLastSeason.style.background = '#007bff';
            btnLastSeason.style.color = '#fff';
            contentLastSeason.style.display = 'block';
            // Recalculate if team is selected
            if (window.__nmww_selected_team) {
                calculateAndRenderRankingsLastSeason(window.__nmww_selected_team);
            }
        }
    };

    btnLastAge.addEventListener('click', () => activate('last-age'));
    btnLastSeason.addEventListener('click', () => activate('last-season'));
}

// Calculate team rankings - Last Season (last position in last season for each GAME+AGE)
function calculateAndRenderRankingsLastSeason(teamName) {
    // Use filtered records only if Apply Filter was clicked
    const records = window.nationalMenWW?.filtersApplied ?
        (window.nationalMenWW.applyCurrentFilters ? window.nationalMenWW.applyCurrentFilters() : window.__nmww_records || []) :
        (window.__nmww_records || []);
    const teamNameLower = String(teamName).toLowerCase().trim();

    const teamMatches = records.filter(r => {
        const teamA = String(r['TeamA'] || '').toLowerCase().trim();
        const teamB = String(r['TeamB'] || '').toLowerCase().trim();
        return teamA === teamNameLower || teamB === teamNameLower;
    });

    if (teamMatches.length === 0) {
        showRankingMessage('No matches found for this team');
        return;
    }

    // Group matches by (GAME, AGE)
    const groupedByGameAge = {};
    teamMatches.forEach(match => {
        const game = String(match['GAME'] || '').trim();
        const age = String(match['AGE'] || '').trim();
        if (!game && !age) return;
        const key = `${game}|${age}`;
        if (!groupedByGameAge[key]) groupedByGameAge[key] = [];
        groupedByGameAge[key].push(match);
    });

    const rankings = [];

    const getRoundPriority = (round) => {
        const roundLower = String(round).toLowerCase().trim();
        if (roundLower === 'final' || roundLower.includes('final')) return 1;
        const num = parseInt(round);
        if (!isNaN(num) && num >= 1 && num <= 7) return num + 1;
        return 999;
    };

    Object.keys(groupedByGameAge).forEach(key => {
        const matches = groupedByGameAge[key];
        const [game, competition] = key.split('|');

        // Find the last match to get context like season and result
        const sortedMatches = matches.slice().sort((a, b) => {
            const seasonA = String(a['Season'] || '');
            const seasonB = String(b['Season'] || '');
            if (seasonA !== seasonB) return seasonB.localeCompare(seasonA);

            const dateA = new Date(String(a['Date'] || ''));
            const dateB = new Date(String(b['Date'] || ''));
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            return 0;
        });

        if (sortedMatches.length === 0) return;
        const lastMatch = sortedMatches[0];

        const lastSeason = String(lastMatch['Season'] || '');
        const gameFull = String(lastMatch['GAME'] || game || '');

        const position = String(lastMatch['Round'] || '');

        // Always add a row
        let result = '-';
        const teamA = String(lastMatch['TeamA'] || '').toLowerCase().trim();
        const teamB = String(lastMatch['TeamB'] || '').toLowerCase().trim();
        const scoreA = parseInt(lastMatch['TeamAScore'] || '0', 10);
        const scoreB = parseInt(lastMatch['TeamBScore'] || '0', 10);

        if (teamA === teamNameLower) {
            if (scoreA > scoreB) result = 'W'; else if (scoreA < scoreB) result = 'L'; else result = 'D';
        } else if (teamB === teamNameLower) {
            if (scoreB > scoreA) result = 'W'; else if (scoreB < scoreA) result = 'L'; else result = 'D';
        }

        rankings.push({
            game: gameFull,
            age: competition,
            position: position,
            season: lastSeason,
            result: result
        });
    });

    rankings.sort((a, b) => {
        if (a.game !== b.game) return a.game.localeCompare(b.game);
        if (a.age !== b.age) return a.age.localeCompare(b.age);
        return getRoundPriority(a.position) - getRoundPriority(b.position);
    });

    renderRankingTableLastSeason(rankings);
}

// Calculate team rankings - Last AGE (last position in last AGE for each GAME+Season)
function calculateAndRenderRankingsLastAge(teamName) {
    // Use filtered records only if Apply Filter was clicked
    const records = window.nationalMenWW?.filtersApplied ?
        (window.nationalMenWW.applyCurrentFilters ? window.nationalMenWW.applyCurrentFilters() : window.__nmww_records || []) :
        (window.__nmww_records || []);
    const teamNameLower = String(teamName).toLowerCase().trim();

    const teamMatches = records.filter(r => {
        const teamA = String(r['TeamA'] || '').toLowerCase().trim();
        const teamB = String(r['TeamB'] || '').toLowerCase().trim();
        return teamA === teamNameLower || teamB === teamNameLower;
    });

    if (teamMatches.length === 0) {
        showRankingMessageLastAge('No matches found for this team');
        return;
    }

    // Group matches by (GAME, Season)
    const groupedByGameSeason = {};
    teamMatches.forEach(match => {
        const game = String(match['GAME'] || '').trim();
        const season = String(match['Season'] || '').trim();
        if (!game && !season) return;
        const key = `${game}|${season}`;
        if (!groupedByGameSeason[key]) groupedByGameSeason[key] = [];
        groupedByGameSeason[key].push(match);
    });

    const rankings = [];

    const getRoundPriority = (round) => {
        const roundLower = String(round).toLowerCase().trim();
        if (roundLower === 'final' || roundLower.includes('final')) return 1;
        const num = parseInt(round);
        if (!isNaN(num) && num >= 1 && num <= 7) return num + 1;
        return 999;
    };

    Object.keys(groupedByGameSeason).forEach(key => {
        const matches = groupedByGameSeason[key];
        const [game, season] = key.split('|');

        // Find the last match to get context like AGE and result
        const sortedMatches = matches.slice().sort((a, b) => {
            const ageA = String(a['AGE'] || '').trim();
            const ageB = String(b['AGE'] || '').trim();
            if (ageA !== ageB) return ageB.localeCompare(ageA);

            const dateA = new Date(String(a['Date'] || ''));
            const dateB = new Date(String(b['Date'] || ''));
            if (!isNaN(dateA) && !isNaN(dateB)) return dateB - dateA;
            return 0;
        });

        if (sortedMatches.length === 0) return;
        const lastMatch = sortedMatches[0];

        const gameFull = String(lastMatch['GAME'] || game || '');
        const age = String(lastMatch['AGE'] || '').trim();
        const position = String(lastMatch['Round'] || '');

        // Always add a row
        let result = '-';
        const teamA = String(lastMatch['TeamA'] || '').toLowerCase().trim();
        const teamB = String(lastMatch['TeamB'] || '').toLowerCase().trim();
        const scoreA = parseInt(lastMatch['TeamAScore'] || '0', 10);
        const scoreB = parseInt(lastMatch['TeamBScore'] || '0', 10);

        if (teamA === teamNameLower) {
            if (scoreA > scoreB) result = 'W'; else if (scoreA < scoreB) result = 'L'; else result = 'D';
        } else if (teamB === teamNameLower) {
            if (scoreB > scoreA) result = 'W'; else if (scoreB < scoreA) result = 'L'; else result = 'D';
        }

        rankings.push({
            game: gameFull,
            age: age,
            position: position,
            season: season,
            result: result
        });
    });

    rankings.sort((a, b) => {
        if (a.game !== b.game) return a.game.localeCompare(b.game);
        if (a.age !== b.age) return a.age.localeCompare(b.age);
        if (a.season !== b.season) return b.season.localeCompare(a.season);
        return getRoundPriority(a.position) - getRoundPriority(b.position);
    });

    renderRankingTableLastAge(rankings);
}

function renderRankingTableLastSeason(rankings) {
    const tbody = document.getElementById('nmww-ranking-tbody');
    const resultsDiv = document.getElementById('nmww-ranking-results');
    const noTeamDiv = document.getElementById('nmww-ranking-no-team');
    const searchInput = document.getElementById('nmww-ranking-search');

    if (!tbody || !resultsDiv || !noTeamDiv) return;

    if (rankings.length === 0) {
        resultsDiv.style.display = 'none';
        noTeamDiv.style.display = 'block';
        if (searchInput) searchInput.style.display = 'none';
        return;
    }

    noTeamDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    if (searchInput) searchInput.style.display = 'block';

    // Store rankings globally for filtering
    window.__nmww_last_season_rankings = rankings;

    // Format position for display
    const formatPosition = (pos) => {
        if (pos.toLowerCase() === 'final') return 'Final';
        return pos;
    };

    // Format result for display
    const formatResult = (result) => {
        const resultUpper = String(result || '').toUpperCase();
        if (resultUpper === 'W') return '<span style="color: #28a745; font-weight: 700;">W</span>';
        if (resultUpper === 'D') return '<span style="color: #ffc107; font-weight: 700;">D</span>';
        if (resultUpper === 'L') return '<span style="color: #dc3545; font-weight: 700;">L</span>';
        return '<span style="color: #6c757d;">-</span>';
    };

    // Render function
    const renderRows = (data) => {
        tbody.innerHTML = data.map(r => {
            return `
                <tr>
                    <td>${escapeHtml(r.game || '')}</td>
                    <td>${escapeHtml(r.age || '')}</td>
                    <td style="font-weight: 600; color: #007bff;">${formatPosition(r.position)}</td>
                    <td style="text-align: center;">${formatResult(r.result)}</td>
                    <td>${escapeHtml(r.season || '')}</td>
                </tr>
            `;
        }).join('');

        // Show message if no results
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                        No results found matching your search
                    </td>
                </tr>
            `;
        }
    };

    // Initial render
    renderRows(rankings);

    // Setup search functionality
    if (searchInput) {
        // Remove previous listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const sourceRankings = window.__nmww_last_season_rankings;

            if (!sourceRankings) return;

            if (!searchTerm) {
                renderRows(sourceRankings);
                return;
            }

            const filtered = sourceRankings.filter(r => {
                const game = String(r.game || '').toLowerCase();
                const age = String(r.age || '').toLowerCase();
                const position = String(r.position || '').toLowerCase();
                const result = String(r.result || '').toLowerCase();
                const season = String(r.season || '').toLowerCase();

                return game.includes(searchTerm) ||
                    age.includes(searchTerm) ||
                    position.includes(searchTerm) ||
                    result.includes(searchTerm) ||
                    season.includes(searchTerm);
            });

            renderRows(filtered);
        });
    }
}

function renderRankingTableLastAge(rankings) {
    const tbody = document.getElementById('nmww-last-age-tbody');
    const resultsDiv = document.getElementById('nmww-last-age-results');
    const noTeamDiv = document.getElementById('nmww-last-age-no-team');
    const searchInput = document.getElementById('nmww-last-age-search');

    if (!tbody || !resultsDiv || !noTeamDiv) return;

    if (rankings.length === 0) {
        resultsDiv.style.display = 'none';
        noTeamDiv.style.display = 'block';
        if (searchInput) searchInput.style.display = 'none';
        return;
    }

    noTeamDiv.style.display = 'none';
    resultsDiv.style.display = 'block';
    if (searchInput) searchInput.style.display = 'block';

    // Store rankings globally for filtering
    window.__nmww_last_age_rankings = rankings;

    // Format position for display
    const formatPosition = (pos) => {
        if (pos.toLowerCase() === 'final') return 'Final';
        return pos;
    };

    // Format result for display
    const formatResult = (result) => {
        const resultUpper = String(result || '').toUpperCase();
        if (resultUpper === 'W') return '<span style="color: #28a745; font-weight: 700;">W</span>';
        if (resultUpper === 'D') return '<span style="color: #ffc107; font-weight: 700;">D</span>';
        if (resultUpper === 'L') return '<span style="color: #dc3545; font-weight: 700;">L</span>';
        return '<span style="color: #6c757d;">-</span>';
    };

    // Render function
    const renderRows = (data) => {
        tbody.innerHTML = data.map(r => {
            return `
                <tr>
                    <td>${escapeHtml(r.game || '')}</td>
                    <td>${escapeHtml(r.age || '')}</td>
                    <td style="font-weight: 600; color: #007bff;">${formatPosition(r.position)}</td>
                    <td style="text-align: center;">${formatResult(r.result)}</td>
                    <td>${escapeHtml(r.season || '')}</td>
                </tr>
            `;
        }).join('');

        // Show message if no results
        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                        No results found matching your search
                    </td>
                </tr>
            `;
        }
    };

    // Initial render
    renderRows(rankings);

    // Setup search functionality
    if (searchInput) {
        // Remove previous listeners
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase().trim();
            const sourceRankings = window.__nmww_last_age_rankings;

            if (!sourceRankings) return;

            if (!searchTerm) {
                renderRows(sourceRankings);
                return;
            }

            const filtered = sourceRankings.filter(r => {
                const game = String(r.game || '').toLowerCase();
                const age = String(r.age || '').toLowerCase();
                const position = String(r.position || '').toLowerCase();
                const result = String(r.result || '').toLowerCase();
                const season = String(r.season || '').toLowerCase();

                return game.includes(searchTerm) ||
                    age.includes(searchTerm) ||
                    position.includes(searchTerm) ||
                    result.includes(searchTerm) ||
                    season.includes(searchTerm);
            });

            renderRows(filtered);
        });
    }
}

function showRankingMessageLastAge(message) {
    const resultsDiv = document.getElementById('nmww-last-age-results');
    const noTeamDiv = document.getElementById('nmww-last-age-no-team');

    if (resultsDiv) resultsDiv.style.display = 'none';
    if (noTeamDiv) {
        noTeamDiv.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p style="font-size: 1.1rem; margin-top: 1rem;">${message}</p>
        `;
        noTeamDiv.style.display = 'block';
    }
}

function showRankingMessage(message) {
    const resultsDiv = document.getElementById('nmww-ranking-results');
    const noTeamDiv = document.getElementById('nmww-ranking-no-team');

    if (resultsDiv) resultsDiv.style.display = 'none';
    if (noTeamDiv) {
        noTeamDiv.innerHTML = `
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <p style="font-size: 1.1rem; margin-top: 1rem;">${message}</p>
        `;
        noTeamDiv.style.display = 'block';
    }
}

function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Build unique options and attach datalists to filter inputs
function populateFilterOptions(records) {
    try {
        const escapeVal = (s) => String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');

        const fieldsToSuggest = [
            'GAME', 'AGE', 'Season', 'Host Country', 'Category', 'Round', 'TeamAPEN', 'TeamBPEN'
        ];

        fieldsToSuggest.forEach((field) => {
            const input = document.getElementById(`filter-${field}`);
            if (!input) return;

            // Remove old datalist-based suggestions if exist (we now use custom searchable dropdowns)
            const existingListId = input.getAttribute('list');
            if (existingListId) {
                const oldDl = document.getElementById(existingListId);
                if (oldDl && oldDl.parentElement) {
                    oldDl.parentElement.removeChild(oldDl);
                }
                input.removeAttribute('list');
            }
        });

        // Also ensure Teams input has no datalist
        const teamsInput = document.getElementById('filter-Teams');
        if (teamsInput) {
            const listId = teamsInput.getAttribute('list');
            if (listId) {
                const oldDl = document.getElementById(listId);
                if (oldDl && oldDl.parentElement) oldDl.parentElement.removeChild(oldDl);
                teamsInput.removeAttribute('list');
            }
        }
    } catch (e) {
        console.warn('populateFilterOptions failed:', e);
    }
}


// Searchable select helpers (mirror behavior from other tabs)
function setupSearchableSelect(inputId, fieldName) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const container = input.closest('.searchable-select-container');
    if (!container) return;
    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    const getUniqueValues = () => {
        const recs = Array.isArray(window.__nmww_records) ? window.__nmww_records : [];
        const vals = recs.map(r => r[fieldName]).filter(v => v !== undefined && v !== null);
        const unique = Array.from(new Set(vals.map(v => String(v).trim()).filter(v => v !== '')));
        return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    function showDropdownOptions(options) {
        dropdown.innerHTML = '';
        const allOption = document.createElement('div');
        allOption.className = 'dropdown-option';
        allOption.textContent = 'All';
        allOption.addEventListener('click', function () {
            input.value = '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(allOption);

        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.textContent = option;
            optionDiv.addEventListener('click', function () {
                input.value = option;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(optionDiv);
        });

        dropdown.style.display = 'block';
    }

    input.addEventListener('focus', function () {
        showDropdownOptions(getUniqueValues());
    });

    input.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const filtered = getUniqueValues().filter(opt => opt.toLowerCase().includes(searchTerm));
        showDropdownOptions(filtered);
    });

    document.addEventListener('click', function (e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function setupAllSearchableSelects() {
    const fields = ['GAME', 'AGE', 'Season', 'Host Country', 'Category', 'Round', 'TeamAPEN', 'TeamBPEN'];
    fields.forEach((f) => setupSearchableSelect(`filter-${f}`, f));
    setupTeamsSearchableSelect();
}

function setupTeamsSearchableSelect() {
    const input = document.getElementById('filter-Teams');
    if (!input) return;
    const container = input.closest('.searchable-select-container');
    if (!container) return;
    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    const getTeamOptions = () => {
        const recs = Array.isArray(window.__nmww_records) ? window.__nmww_records : [];
        const teams = [];
        recs.forEach(r => {
            if (r['TeamA']) teams.push(String(r['TeamA']).trim());
            if (r['TeamB']) teams.push(String(r['TeamB']).trim());
        });
        return Array.from(new Set(teams.filter(v => v))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };

    function showDropdownOptions(options) {
        dropdown.innerHTML = '';
        const allOption = document.createElement('div');
        allOption.className = 'dropdown-option';
        allOption.textContent = 'All';
        allOption.addEventListener('click', function () {
            input.value = '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(allOption);

        options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'dropdown-option';
            optionDiv.textContent = option;
            optionDiv.addEventListener('click', function () {
                input.value = option;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(optionDiv);
        });

        dropdown.style.display = 'block';
    }

    input.addEventListener('focus', function () {
        showDropdownOptions(getTeamOptions());
    });

    input.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const filtered = getTeamOptions().filter(opt => opt.toLowerCase().includes(searchTerm));
        showDropdownOptions(filtered);
    });

    document.addEventListener('click', function (e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}


