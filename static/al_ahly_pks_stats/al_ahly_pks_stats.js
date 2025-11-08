// ============================================================================
// AL AHLY PKS STATISTICS MODULE - JAVASCRIPT FUNCTIONS
// ============================================================================

// Google Sheets Configuration
const PKS_SHEET_ID = '1NM06fKzqEQc-K9XLgaIgd0PyQQAMHmOCVBKttQicZwY';
const PKS_SHEET_NAME = 'PKS';

// Column mapping from Google Sheet
const PKS_COLUMNS = {
    'PKS System': 'PKS_SYSTEM',
    'CHAMPION System': 'CHAMPION_SYSTEM',
    'MATCH_ID': 'MATCH_ID',
    'SEASON': 'SEASON',
    'CHAMPION': 'CHAMPION',
    'ROUND': 'ROUND',
    'WHO START?': 'WHO_START',
    'OPPONENT TEAM': 'OPPONENT_TEAM',
    'OPPONENT PLAYER': 'OPPONENT_PLAYER',
    'OPPONENT STATUS': 'OPPONENT_STATUS',
    'HOWMISS OPPONENT': 'HOWMISS_OPPONENT',
    'AHLY GK': 'AHLY_GK',
    'MATCH RESULT': 'MATCH_RESULT',
    'PKS RESULT': 'PKS_RESULT',
    'PKS W-L': 'PKS_WL',
    'AHLY TEAM': 'AHLY_TEAM',
    'AHLY PLAYER': 'AHLY_PLAYER',
    'AHLY STATUS': 'AHLY_STATUS',
    'HOWMISS AHLY': 'HOWMISS_AHLY',
    'OPPONENT GK': 'OPPONENT_GK'
};

// ============================================================================
// PKS STATISTICS DATA MANAGEMENT
// ============================================================================

// Global variables for PKS statistics data
let alAhlyPKSStatsData = {
    allRecords: [],
    filteredRecords: [],
    filterOptions: {},
    currentFilters: {}
};

// ============================================================================
// GOOGLE SHEETS DATA FETCHING
// ============================================================================

/**
 * Fetch PKS data from Backend API (with Browser Cache - 24h TTL)
 */
async function fetchPKSDataFromGoogleSheets(forceRefresh = false) {
    try {
        // Use browser cache with 24h TTL
        const fetchFunction = async () => {
            console.log('🔄 Fetching PKS data from server...');
            
            const url = '/api/pks-stats-data';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch PKS data');
            }
            
            const records = data.records || [];
            console.log(`✅ Successfully fetched ${records.length} records`);
            
            return records;
        };
        
        // Fetch with browser cache (24h TTL)
        const records = await fetchWithBrowserCache('al_ahly_pks', fetchFunction, forceRefresh);
        
        return records || [];
        
    } catch (error) {
        console.error('❌ Error fetching PKS data:', error);
        console.error('Error details:', error.message);
        return [];
    }
}

/**
 * Load and process PKS data
 */
async function loadPKSData(forceRefresh = false) {
    try {
        showLoadingState(true);
        
        // Fetch data from Cache (or Google Sheets if cache miss)
        const records = await fetchPKSDataFromGoogleSheets(forceRefresh);
        
        if (records.length === 0) {
            // No PKS data available
            return;
        }
        
        // Store all records
        alAhlyPKSStatsData.allRecords = records;
        alAhlyPKSStatsData.filteredRecords = records;
        
        // Build filter options from data
        buildFilterOptions(records);
        
        // Populate filter dropdowns
        populateFilterDropdowns();
        
        // Update statistics
        updatePKSStatistics();
        
        // PKS data loaded successfully
        
    } catch (error) {
        console.error('Error loading PKS data:', error);
        // Failed to load PKS data
    } finally {
        showLoadingState(false);
    }
}

// ============================================================================
// FILTER MANAGEMENT
// ============================================================================

/**
 * Build filter options from records
 */
function buildFilterOptions(records) {
    const filterColumns = [
        'PKS System',
        'CHAMPION System',
        'MATCH_ID',
        'SEASON',
        'CHAMPION',
        'ROUND',
        'WHO START?',
        'OPPONENT TEAM',
        'OPPONENT PLAYER',
        'OPPONENT STATUS',
        'HOWMISS OPPONENT',
        'AHLY GK',
        'MATCH RESULT',
        'PKS RESULT',
        'PKS W-L',
        'AHLY TEAM',
        'AHLY PLAYER',
        'AHLY STATUS',
        'HOWMISS AHLY',
        'OPPONENT GK'
    ];
    
    const options = {};
    
    filterColumns.forEach(column => {
        const uniqueValues = new Set();
        records.forEach(record => {
            const value = record[column];
            if (value && value.toString().trim() !== '') {
                uniqueValues.add(value.toString().trim());
            }
        });
        options[column] = Array.from(uniqueValues).sort();
    });
    
    alAhlyPKSStatsData.filterOptions = options;
    console.log('📊 Filter options built:', options);
}

/**
 * Populate filter dropdowns with options
 */
function populateFilterDropdowns() {
    const filterMapping = {
        'pks-system-filter': 'PKS System',
        'champion-system-filter': 'CHAMPION System',
        'match-id-filter': 'MATCH_ID',
        'season-filter': 'SEASON',
        'champion-filter': 'CHAMPION',
        'round-filter': 'ROUND',
        'who-start-filter': 'WHO START?',
        'opponent-team-filter': 'OPPONENT TEAM',
        'opponent-player-filter': 'OPPONENT PLAYER',
        'opponent-status-filter': 'OPPONENT STATUS',
        'howmiss-opponent-filter': 'HOWMISS OPPONENT',
        'ahly-gk-filter': 'AHLY GK',
        'match-result-filter': 'MATCH RESULT',
        'pks-result-filter': 'PKS RESULT',
        'pks-wl-filter': 'PKS W-L',
        'ahly-team-filter': 'AHLY TEAM',
        'ahly-player-filter': 'AHLY PLAYER',
        'ahly-status-filter': 'AHLY STATUS',
        'howmiss-ahly-filter': 'HOWMISS AHLY',
        'opponent-gk-filter': 'OPPONENT GK'
    };
    
    Object.keys(filterMapping).forEach(selectId => {
        const column = filterMapping[selectId];
        const options = alAhlyPKSStatsData.filterOptions[column] || [];
        
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            // Keep the "All" option
            selectElement.innerHTML = '<option value="">All</option>';
            
            // Add options from data
            options.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                selectElement.appendChild(option);
            });
        }
    });
    
    console.log('✅ Filter dropdowns populated');
    
    // Initialize searchable dropdowns after populating
    initializeSearchableFilters();
}

/**
 * Initialize searchable dropdowns for all filter selects
 */
function initializeSearchableFilters() {
    const selects = document.querySelectorAll('.filter-item select');
    selects.forEach(select => {
        makeSelectSearchable(select);
    });
    console.log('✅ Searchable filters initialized');
}

/**
 * Convert a regular select to a searchable dropdown
 */
function makeSelectSearchable(select) {
    if (!select || select.dataset.searchable === 'true') return;
    
    select.style.display = 'none';
    select.dataset.searchable = 'true';
    
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = select.options[0]?.text || 'Search...';
    input.value = '';
    
    const dropdown = document.createElement('div');
    dropdown.className = 'dropdown-options';
    dropdown.style.display = 'none';
    
    select.parentElement.insertBefore(container, select);
    container.appendChild(input);
    container.appendChild(dropdown);
    container.appendChild(select);
    
    function renderOptions(filterText = '') {
        dropdown.innerHTML = '';
        const text = filterText.toLowerCase();
        Array.from(select.options).forEach((opt, idx) => {
            if (idx === 0) return; // skip "All" option
            const label = String(opt.text || '').trim();
            const value = String(opt.value || '').trim();
            if (!text || label.toLowerCase().includes(text) || value.toLowerCase().includes(text)) {
                const div = document.createElement('div');
                div.textContent = label;
                div.dataset.value = value;
                div.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    select.value = value;
                    input.value = label;
                    dropdown.style.display = 'none';
                    
                    // Trigger change event
                    const ev = new Event('change', { bubbles: true });
                    select.dispatchEvent(ev);
                });
                dropdown.appendChild(div);
            }
        });
        dropdown.style.display = dropdown.children.length ? 'block' : 'none';
    }
    
    input.addEventListener('focus', () => renderOptions(input.value));
    input.addEventListener('input', () => renderOptions(input.value));
    input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));
    
    // Sync input when select changes programmatically
    select.addEventListener('change', () => {
        const opt = select.options[select.selectedIndex];
        input.value = opt && opt.value ? opt.text : '';
    });
    
    // Set initial value if select has a selection
    const initialOpt = select.options[select.selectedIndex];
    if (initialOpt && initialOpt.value) {
        input.value = initialOpt.text;
    }
}

/**
 * Update searchable input displays
 */
function updateAllSearchableInputs() {
    const selects = document.querySelectorAll('.filter-item select[data-searchable="true"]');
    selects.forEach(select => {
        const container = select.closest('.searchable-select-container');
        if (container) {
            const input = container.querySelector('input');
            if (input) {
                const selectedOption = select.options[select.selectedIndex];
                input.value = selectedOption && selectedOption.value ? selectedOption.text : '';
            }
        }
    });
}

/**
 * Apply filters to data
 */
function applyPKSFilters() {
    // Get current filter values
    const filters = {
        'PKS System': document.getElementById('pks-system-filter')?.value || '',
        'CHAMPION System': document.getElementById('champion-system-filter')?.value || '',
        'MATCH_ID': document.getElementById('match-id-filter')?.value || '',
        'SEASON': document.getElementById('season-filter')?.value || '',
        'CHAMPION': document.getElementById('champion-filter')?.value || '',
        'ROUND': document.getElementById('round-filter')?.value || '',
        'WHO START?': document.getElementById('who-start-filter')?.value || '',
        'OPPONENT TEAM': document.getElementById('opponent-team-filter')?.value || '',
        'OPPONENT PLAYER': document.getElementById('opponent-player-filter')?.value || '',
        'OPPONENT STATUS': document.getElementById('opponent-status-filter')?.value || '',
        'HOWMISS OPPONENT': document.getElementById('howmiss-opponent-filter')?.value || '',
        'AHLY GK': document.getElementById('ahly-gk-filter')?.value || '',
        'MATCH RESULT': document.getElementById('match-result-filter')?.value || '',
        'PKS RESULT': document.getElementById('pks-result-filter')?.value || '',
        'PKS W-L': document.getElementById('pks-wl-filter')?.value || '',
        'AHLY TEAM': document.getElementById('ahly-team-filter')?.value || '',
        'AHLY PLAYER': document.getElementById('ahly-player-filter')?.value || '',
        'AHLY STATUS': document.getElementById('ahly-status-filter')?.value || '',
        'HOWMISS AHLY': document.getElementById('howmiss-ahly-filter')?.value || '',
        'OPPONENT GK': document.getElementById('opponent-gk-filter')?.value || ''
    };
    
    // Store current filters
    alAhlyPKSStatsData.currentFilters = filters;
    
    // Filter records
    let filteredRecords = alAhlyPKSStatsData.allRecords;
    
    Object.keys(filters).forEach(column => {
        const filterValue = filters[column];
        if (filterValue) {
            filteredRecords = filteredRecords.filter(record => {
                const recordValue = record[column];
                return recordValue && recordValue.toString().trim() === filterValue;
            });
        }
    });
    
    alAhlyPKSStatsData.filteredRecords = filteredRecords;
    
    // Update ALL statistics with filtered data - this updates ALL tabs
    updatePKSStatistics();
}

/**
 * Clear all filters
 */
function clearPKSFilters() {
    // Reset all filter dropdowns
    const filterIds = [
        'pks-system-filter', 'champion-system-filter', 'match-id-filter', 'season-filter',
        'champion-filter', 'round-filter', 'who-start-filter', 'opponent-team-filter',
        'opponent-player-filter', 'opponent-status-filter', 'howmiss-opponent-filter',
        'ahly-gk-filter', 'match-result-filter', 'pks-result-filter', 'pks-wl-filter',
        'ahly-team-filter', 'ahly-player-filter', 'ahly-status-filter', 'howmiss-ahly-filter',
        'opponent-gk-filter'
    ];
    
    filterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.value = '';
            
            // Clear searchable input as well
            const container = element.closest('.searchable-select-container');
            if (container) {
                const input = container.querySelector('input[type="text"]');
                if (input) {
                    input.value = '';
                }
            }
        }
    });
    
    // Reset to all records
    alAhlyPKSStatsData.filteredRecords = alAhlyPKSStatsData.allRecords;
    alAhlyPKSStatsData.currentFilters = {};
    
    // Update statistics
    updatePKSStatistics();
    
    // All filters cleared
}

/**
 * Refresh PKS data (force refresh from Google Sheets)
 */
async function refreshPKSStats() {
    console.log('🔄 Force refreshing PKS data...');
    await loadPKSData(true); // true = force refresh, bypass cache
}

// ============================================================================
// STATISTICS CALCULATION AND DISPLAY
// ============================================================================


/**
 * Calculate overview statistics
 */
function calculateOverviewStats(records) {
    // Group records by MATCH_ID to count unique PKS matches
    const uniqueMatches = new Set();
    records.forEach(record => {
        if (record['MATCH_ID']) {
            uniqueMatches.add(record['MATCH_ID']);
        }
    });
    
    const totalPKSMatches = uniqueMatches.size;
    
    // Count wins and losses (based on PKS W-L column) - UNIQUE per MATCH_ID
    // Get unique matches with their PKS W-L results
    const uniqueMatchResults = new Map();
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        const pksWL = record['PKS W-L'];
        if (matchId && pksWL) {
            uniqueMatchResults.set(matchId, pksWL);
        }
    });
    
    // Count unique wins and losses for Al Ahly
    const pksWins = Array.from(uniqueMatchResults.values()).filter(result => result === 'W').length;
    const pksLosses = Array.from(uniqueMatchResults.values()).filter(result => result === 'L').length;
    
    // Count total penalties (all records are individual penalty attempts)
    const totalPenalties = records.length;
    
    // Count goals scored by Ahly (assuming AHLY STATUS shows if goal was scored)
    const ahlyGoals = records.filter(r => {
        const status = r['AHLY STATUS'];
        return status && (status.includes('GOAL') || status.includes('✓') || status === 'G');
    }).length;
    
    // Count misses
    const ahlyMisses = records.filter(r => {
        const howmiss = r['HOWMISS AHLY'];
        return howmiss && howmiss.trim() !== '';
    }).length;
    
    // Calculate rates
    const successRate = totalPenalties > 0 ? Math.round((ahlyGoals / totalPenalties) * 100) : 0;
    const winRate = totalPKSMatches > 0 ? Math.round((pksWins / totalPKSMatches) * 100) : 0;
    
    return {
        totalPKSMatches,
        pksWins,
        pksLosses,
        totalPenalties,
        ahlyGoals,
        ahlyMisses,
        successRate,
        winRate
    };
}

/**
 * Update overview stat cards
 */
function updateOverviewCards(stats) {
    // Update stat values
    document.getElementById('total-pks-matches').textContent = stats.totalPKSMatches;
    document.getElementById('pks-wins').textContent = stats.pksWins;
    document.getElementById('pks-losses').textContent = stats.pksLosses;
    document.getElementById('total-penalties').textContent = stats.totalPenalties;
    document.getElementById('penalty-goals').textContent = stats.ahlyGoals;
    document.getElementById('penalty-misses').textContent = stats.ahlyMisses;
    document.getElementById('pks-success-rate').textContent = stats.successRate + '%';
    document.getElementById('pks-win-rate').textContent = stats.winRate + '%';
    
    // Success rate is now displayed as simple percentage
}


/**
 * Update detailed tables
 */
function updateDetailedTables(records) {
    updateRecentPKSTable(records);
    updateTopPenaltyTakersTable(records);
    updateOpponentPenaltyTakersTable(records);
    updateGoalkeeperPKSTable(records);
}

/**
 * Update all PKS matches table
 */
function updateRecentPKSTable(records) {
    const ahlyTbody = document.getElementById('ahly-matches-tbody');
    const opponentTbody = document.getElementById('opponent-matches-tbody');
    if (!ahlyTbody || !opponentTbody) return;

    ahlyTbody.innerHTML = '';
    opponentTbody.innerHTML = '';

    if (!records || records.length === 0) {
        const renderEmpty = (tbody, colSpan) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="${colSpan}" style="text-align: center; padding: 2rem; color: #666;">No records found</td>
            `;
            tbody.appendChild(row);
        };
        renderEmpty(ahlyTbody, 7);
        renderEmpty(opponentTbody, 7);
        return;
    }

    const ahlyFragment = document.createDocumentFragment();
    const opponentFragment = document.createDocumentFragment();

    records.forEach(record => {
        const ahlyStatus = record['AHLY STATUS'] || '';
        const opponentStatus = record['OPPONENT STATUS'] || '';
        const pksResult = record['PKS W-L'] || '';

        const normalize = (value) => value ? value.toString().toUpperCase() : '';

        const buildStatusBadge = (status, isAhly = true) => {
            if (!status) return '';
            const normalized = normalize(status);

            if (normalized.includes('GOAL') || normalized.includes('✓') || normalized === 'G') {
                return `<span class="badge badge-scored">${status}</span>`;
            }

            if (normalized.includes('MISS') || normalized.includes('X') || normalized.includes('OFF')) {
                return `<span class="badge badge-missed">${status}</span>`;
            }

            return `<span class="badge badge-info">${status}</span>`;
        };

        const buildResultBadge = (result) => {
            if (!result) return '';
            const normalized = normalize(result);
            if (normalized === 'W') {
                return `<span class="badge badge-win">WIN</span>`;
            }
            if (normalized === 'L') {
                return `<span class="badge badge-loss">LOSS</span>`;
            }
            return `<span class="badge badge-info">${result}</span>`;
        };

        const ahlyRow = document.createElement('tr');
        ahlyRow.innerHTML = `
            <td>${record['SEASON'] || ''}</td>
            <td>${record['OPPONENT TEAM'] || ''}</td>
            <td>${record['AHLY PLAYER'] || ''}</td>
            <td>${buildStatusBadge(ahlyStatus)}</td>
            <td>${record['HOWMISS AHLY'] || ''}</td>
            <td>${record['OPPONENT GK'] || ''}</td>
            <td>${buildResultBadge(pksResult)}</td>
        `;
        ahlyFragment.appendChild(ahlyRow);

        const opponentRow = document.createElement('tr');
        opponentRow.innerHTML = `
            <td>${record['SEASON'] || ''}</td>
            <td>${record['OPPONENT TEAM'] || ''}</td>
            <td>${record['OPPONENT PLAYER'] || ''}</td>
            <td>${buildStatusBadge(opponentStatus, false)}</td>
            <td>${record['HOWMISS OPPONENT'] || ''}</td>
            <td>${record['AHLY GK'] || ''}</td>
            <td>${buildResultBadge(pksResult)}</td>
        `;
        opponentFragment.appendChild(opponentRow);
    });

    ahlyTbody.appendChild(ahlyFragment);
    opponentTbody.appendChild(opponentFragment);
}

/**
 * Update all penalty takers table (Al Ahly)
 */
function updateTopPenaltyTakersTable(records) {
    const tbody = document.getElementById('ahly-players-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const playerStats = {};

    records.forEach(record => {
        const player = record['AHLY PLAYER'];
        if (!player || player.trim() === '') {
            return;
        }

        if (!playerStats[player]) {
            playerStats[player] = {
                totalPenalties: 0,
                goals: 0,
                misses: 0
            };
        }

        const status = record['AHLY STATUS'] || '';
        const normalizedStatus = status.toUpperCase();

        playerStats[player].totalPenalties++;

        const isGoal = normalizedStatus.includes('GOAL') || normalizedStatus.includes('✓') || normalizedStatus === 'G';

        if (isGoal) {
            playerStats[player].goals++;
        } else {
            playerStats[player].misses++;
        }
    });

    const players = Object.keys(playerStats).map(name => {
        const stats = playerStats[name];
        const successRate = stats.totalPenalties > 0
            ? Math.round((stats.goals / stats.totalPenalties) * 100)
            : 0;

        return {
            name,
            totalPenalties: stats.totalPenalties,
            goals: stats.goals,
            misses: stats.misses,
            successRate
        };
    }).sort((a, b) => b.totalPenalties - a.totalPenalties);

    if (players.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No records found</td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    const fragment = document.createDocumentFragment();

    players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${player.name}</td>
            <td>${player.totalPenalties}</td>
            <td><span class="badge badge-scored">${player.goals}</span></td>
            <td><span class="badge badge-win">${player.successRate}%</span></td>
            <td><span class="badge badge-missed">${player.misses}</span></td>
        `;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/**
 * Update all opponent penalty takers table
 */
function updateOpponentPenaltyTakersTable(records) {
    const tbody = document.getElementById('opponent-players-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const playerStats = {};

    records.forEach(record => {
        const player = record['OPPONENT PLAYER'];
        if (!player || player.trim() === '') {
            return;
        }

        if (!playerStats[player]) {
            playerStats[player] = {
                totalPenalties: 0,
                goals: 0,
                misses: 0
            };
        }

        const status = record['OPPONENT STATUS'] || '';
        const normalizedStatus = status.toUpperCase();

        playerStats[player].totalPenalties++;

        const isGoal = normalizedStatus.includes('GOAL') || normalizedStatus.includes('✓') || normalizedStatus === 'G';

        if (isGoal) {
            playerStats[player].goals++;
        } else {
            playerStats[player].misses++;
        }
    });

    const players = Object.keys(playerStats).map(name => {
        const stats = playerStats[name];
        const successRate = stats.totalPenalties > 0
            ? Math.round((stats.goals / stats.totalPenalties) * 100)
            : 0;

        return {
            name,
            totalPenalties: stats.totalPenalties,
            goals: stats.goals,
            misses: stats.misses,
            successRate
        };
    }).sort((a, b) => b.totalPenalties - a.totalPenalties);

    if (players.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No records found</td>
        `;
        tbody.appendChild(emptyRow);
        return;
    }

    const fragment = document.createDocumentFragment();

    players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${player.name}</td>
            <td>${player.totalPenalties}</td>
            <td><span class="badge badge-scored">${player.goals}</span></td>
            <td><span class="badge badge-win">${player.successRate}%</span></td>
            <td><span class="badge badge-missed">${player.misses}</span></td>
        `;
        fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
}

/**
 * Update goalkeeper PKS stats table
 */
function updateGoalkeeperPKSTable(records) {
    const tbody = document.querySelector('#goalkeeper-pks-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group by goalkeeper and calculate stats
    const gkStats = {};
    
    records.forEach(record => {
        const gk = record['AHLY GK'];
        if (gk && gk.trim() !== '') {
            if (!gkStats[gk]) {
                gkStats[gk] = {
                    name: gk,
                    matches: new Set(),
                    penaltiesFaced: 0,
                    saved: 0,
                    goalsConceded: 0
                };
            }
            
            // Add match to set
            if (record['MATCH_ID']) {
                gkStats[gk].matches.add(record['MATCH_ID']);
            }
            
            // Count opponent penalties faced
            if (record['OPPONENT PLAYER'] && record['OPPONENT PLAYER'].trim() !== '') {
                gkStats[gk].penaltiesFaced++;
                
                // Check if saved (look for 'الحارس' in HOWMISS OPPONENT)
                const howmiss = record['HOWMISS OPPONENT'];
                if (howmiss && howmiss.includes('الحارس')) {
                    gkStats[gk].saved++;
                }
                
                // Count goals conceded (look for 'GOAL' in OPPONENT STATUS)
                const status = record['OPPONENT STATUS'];
                if (status && status.includes('GOAL')) {
                    gkStats[gk].goalsConceded++;
                }
            }
        }
    });
    
    // Convert to array and calculate save rates
    const goalkeepers = Object.values(gkStats)
        .map(gk => ({
            name: gk.name,
            pksMatches: gk.matches.size,
            penaltiesFaced: gk.penaltiesFaced,
            saved: gk.saved,
            goalsConceded: gk.goalsConceded,
            saveRate: gk.penaltiesFaced > 0 ? ((gk.saved / gk.penaltiesFaced) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.pksMatches - a.pksMatches);
    
    goalkeepers.forEach(gk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${gk.name}</td>
            <td>${gk.pksMatches}</td>
            <td>${gk.penaltiesFaced}</td>
            <td>${gk.saved}</td>
            <td>${gk.saveRate}%</td>
            <td>${gk.goalsConceded}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Show/hide loading state
 */
function showLoadingState(show) {
    const refreshBtn = document.querySelector('.pks-refresh-btn');
    if (refreshBtn) {
        if (show) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Syncing...
            `;
        } else {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>
                Synced!
            `;
            
            // Return to original text after 2 seconds
            setTimeout(() => {
                if (refreshBtn) {
                    refreshBtn.innerHTML = `
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                        </svg>
                        Sync Data
                    `;
                }
            }, 2000);
        }
    }
}

/**
 * Show flash message - DISABLED
 */
function showFlashMessage(message, type = 'info') {
    // Flash messages disabled
    console.log(`${type.toUpperCase()}: ${message}`);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Al Ahly PKS Stats module
 */
function initializeAlAhlyPKSStats() {
    console.log('🚀 Initializing Al Ahly PKS Statistics Module...');
    
    // Load PKS data on initialization
    loadPKSData();
    
    console.log('✅ Al Ahly PKS Statistics Module Initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAlAhlyPKSStats);
} else {
    initializeAlAhlyPKSStats();
}

// ============================================================================
// TAB MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Switch between main tabs
 */
function switchMainTab(tabName) {
    console.log(`🔄 Switching to main tab: ${tabName}`);
    
    // Remove active class from all main tab buttons
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate selected tab button
    const activeButton = document.querySelector(`[onclick="switchMainTab('${tabName}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    // Show selected tab content
    const activeContent = document.getElementById(`${tabName}-tab`);
    if (activeContent) {
        activeContent.classList.add('active');
    }
    
    // Reset sub-tabs to first option when switching main tabs
    resetSubTabs(tabName);
    
    // Populate H2H Teams table if switching to that tab
    if (tabName === 'h2h-teams') {
        populateH2HTeamsPKSTable();
    }
    
    console.log(`✅ Switched to main tab: ${tabName}`);
}

/**
 * Switch between sub tabs
 */
function switchSubTab(subTabName) {
    console.log(`🔄 Switching to sub tab: ${subTabName}`);
    
    // Find the parent main tab
    const subTabElement = document.getElementById(subTabName);
    const mainTabElement = subTabElement.closest('.tab-content');
    const mainTabId = mainTabElement.id;
    const mainTabName = mainTabId.replace('-tab', '');
    
    // Remove active class from all sub tab buttons in this main tab
    const subTabsNav = mainTabElement.querySelector('.sub-tabs-nav');
    if (subTabsNav) {
        subTabsNav.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    // Hide all sub tab contents in this main tab
    mainTabElement.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate selected sub tab button
    const activeSubButton = document.querySelector(`[onclick="switchSubTab('${subTabName}')"]`);
    if (activeSubButton) {
        activeSubButton.classList.add('active');
    }
    
    // Show selected sub tab content
    if (subTabElement) {
        subTabElement.classList.add('active');
    }
    
    console.log(`✅ Switched to sub tab: ${subTabName}`);
}

/**
 * Reset sub tabs to first option
 */
function resetSubTabs(mainTabName) {
    const mainTabElement = document.getElementById(`${mainTabName}-tab`);
    if (mainTabElement) {
        const subTabsNav = mainTabElement.querySelector('.sub-tabs-nav');
        if (subTabsNav) {
            const firstSubTabButton = subTabsNav.querySelector('.sub-tab-btn');
            if (firstSubTabButton) {
                const firstSubTabName = firstSubTabButton.getAttribute('onclick')
                    .match(/switchSubTab\('([^']+)'\)/)[1];
                switchSubTab(firstSubTabName);
            }
        }
    }
}

// ============================================================================
// ENHANCED STATISTICS CALCULATION
// ============================================================================

/**
 * Calculate opponent statistics
 */
function calculateOpponentStats(records) {
    // Group records by MATCH_ID to count unique PKS matches for opponents
    const uniqueMatches = new Set();
    records.forEach(record => {
        if (record['MATCH_ID']) {
            uniqueMatches.add(record['MATCH_ID']);
        }
    });
    
    const totalPKSMatches = uniqueMatches.size;
    
    // Count wins and losses for opponents (based on PKS W-L column) - UNIQUE per MATCH_ID
    // PKS W-L refers to Al Ahly's result, so for opponents it's inverted:
    // When Ahly wins (W), opponents lose
    // When Ahly loses (L), opponents win
    
    // Get unique matches with their PKS W-L results
    const uniqueMatchResults = new Map();
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        const pksWL = record['PKS W-L'];
        if (matchId && pksWL) {
            uniqueMatchResults.set(matchId, pksWL);
        }
    });
    
    // Count unique wins and losses
    const pksWins = Array.from(uniqueMatchResults.values()).filter(result => result === 'L').length; // Opponents win when Ahly loses
    const pksLosses = Array.from(uniqueMatchResults.values()).filter(result => result === 'W').length; // Opponents lose when Ahly wins
    
    // Count opponent penalties
    const opponentPenalties = records.filter(r => r['OPPONENT PLAYER'] && r['OPPONENT PLAYER'].trim() !== '').length;
    
    // Count opponent goals
    const opponentGoals = records.filter(r => {
        const status = r['OPPONENT STATUS'];
        return status && (status.includes('GOAL') || status.includes('✓') || status === 'G');
    }).length;
    
    // Count opponent misses
    const opponentMisses = records.filter(r => {
        const howmiss = r['HOWMISS OPPONENT'];
        return howmiss && howmiss.trim() !== '';
    }).length;
    
    // Calculate rates
    const opponentSuccessRate = opponentPenalties > 0 ? Math.round((opponentGoals / opponentPenalties) * 100) : 0;
    const opponentWinRate = totalPKSMatches > 0 ? Math.round((pksWins / totalPKSMatches) * 100) : 0;
    
    return {
        totalPKSMatches,
        pksWins,
        pksLosses,
        opponentPenalties,
        opponentGoals,
        opponentMisses,
        opponentSuccessRate,
        opponentWinRate
    };
}

/**
 * Update opponent statistics display
 */
function updateOpponentStatistics(records) {
    console.log('🔄 Updating opponent statistics...', records.length, 'records');
    const stats = calculateOpponentStats(records);
    console.log('📊 Opponent stats calculated:', stats);
    
    // Update opponent stat values - matching Al Ahly layout exactly
    document.getElementById('opponent-total-pks-matches').textContent = stats.totalPKSMatches;
    document.getElementById('opponent-pks-wins').textContent = stats.pksWins;
    document.getElementById('opponent-pks-win-rate').textContent = stats.opponentWinRate + '%';
    document.getElementById('opponent-pks-losses').textContent = stats.pksLosses;
    document.getElementById('opponent-total-penalties').textContent = stats.opponentPenalties;
    document.getElementById('opponent-goals').textContent = stats.opponentGoals;
    document.getElementById('opponent-misses').textContent = stats.opponentMisses;
    document.getElementById('opponent-success-rate').textContent = stats.opponentSuccessRate + '%';
    
    console.log('✅ Opponent statistics updated successfully');
}


/**
 * Update opponent goalkeeper PKS stats table
 */
function updateOpponentGoalkeeperPKSTable(records) {
    const tbody = document.querySelector('#opponent-goalkeeper-pks-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group by opponent goalkeeper and calculate stats
    const gkStats = {};
    
    records.forEach(record => {
        const gk = record['OPPONENT GK'];
        if (gk && gk.trim() !== '') {
            if (!gkStats[gk]) {
                gkStats[gk] = {
                    name: gk,
                    matches: new Set(),
                    penaltiesFaced: 0,
                    saved: 0,
                    goalsConceded: 0
                };
            }
            
            // Add match to set
            if (record['MATCH_ID']) {
                gkStats[gk].matches.add(record['MATCH_ID']);
            }
            
            // Count Ahly penalties faced
            if (record['AHLY PLAYER'] && record['AHLY PLAYER'].trim() !== '') {
                gkStats[gk].penaltiesFaced++;
                
                // Check if saved (look for 'الحارس' in HOWMISS AHLY)
                const howmiss = record['HOWMISS AHLY'];
                if (howmiss && howmiss.includes('الحارس')) {
                    gkStats[gk].saved++;
                }
                
                // Count goals conceded (look for 'GOAL' in AHLY STATUS)
                const status = record['AHLY STATUS'];
                if (status && status.includes('GOAL')) {
                    gkStats[gk].goalsConceded++;
                }
            }
        }
    });
    
    // Convert to array and calculate save rates
    const goalkeepers = Object.values(gkStats)
        .map(gk => ({
            name: gk.name,
            pksMatches: gk.matches.size,
            penaltiesFaced: gk.penaltiesFaced,
            saved: gk.saved,
            goalsConceded: gk.goalsConceded,
            saveRate: gk.penaltiesFaced > 0 ? ((gk.saved / gk.penaltiesFaced) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.pksMatches - a.pksMatches);
    
    goalkeepers.forEach(gk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${gk.name}</td>
            <td>${gk.pksMatches}</td>
            <td>${gk.penaltiesFaced}</td>
            <td>${gk.saved}</td>
            <td>${gk.saveRate}%</td>
            <td>${gk.goalsConceded}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * Enhanced update statistics function
 */
function updatePKSStatistics() {
    const records = alAhlyPKSStatsData.filteredRecords;
    
    // Calculate overview statistics
    const stats = calculateOverviewStats(records);
    
    // Update Al Ahly overview cards
    updateOverviewCards(stats);
    
    // Update opponent statistics
    updateOpponentStatistics(records);
    
    // Update detailed tables
    updateDetailedTables(records);
    
    // Update opponent goalkeeper table (opponent penalty takers already updated in updateDetailedTables)
    updateOpponentGoalkeeperPKSTable(records);
    
    // Update H2H Teams table
    populateH2HTeamsPKSTable();
    
    console.log('📊 PKS statistics updated (enhanced)');
}

// ============================================================================
// H2H TEAMS PKS STATISTICS
// ============================================================================

/**
 * Populate H2H Teams PKS table with statistics
 */
function populateH2HTeamsPKSTable() {
    const records = alAhlyPKSStatsData.filteredRecords;
    
    if (!records || records.length === 0) {
        console.warn('⚠️ No data available for H2H Teams PKS');
        return;
    }
    
    console.log('📊 Populating H2H Teams PKS table with', records.length, 'records');
    
    // Group by opponent team and MATCH_ID to count unique matches
    const teamMatchesMap = {};
    
    records.forEach(record => {
        const opponentTeam = record['OPPONENT TEAM'] || 'Unknown';
        const matchId = record['MATCH_ID'] || '';
        const pksWL = (record['PKS W-L'] || '').toUpperCase().trim();
        
        if (!teamMatchesMap[opponentTeam]) {
            teamMatchesMap[opponentTeam] = {
                team: opponentTeam,
                matchIds: new Set(),
                matchResults: {} // Store result per match
            };
        }
        
        // Add match ID to set (automatically handles duplicates)
        teamMatchesMap[opponentTeam].matchIds.add(matchId);
        
        // Store result for this match (last one wins if there are duplicates)
        if (matchId && pksWL) {
            teamMatchesMap[opponentTeam].matchResults[matchId] = pksWL;
        }
    });
    
    // Calculate statistics per team
    const teamStats = [];
    Object.values(teamMatchesMap).forEach(teamData => {
        const matches = teamData.matchIds.size;
        let wins = 0;
        let losses = 0;
        
        // Count wins and losses per unique match
        Object.values(teamData.matchResults).forEach(result => {
            if (result === 'W') {
                wins++;
            } else if (result === 'L') {
                losses++;
            }
        });
        
        teamStats.push({
            team: teamData.team,
            matches: matches,
            wins: wins,
            losses: losses
        });
    });
    
    // Sort by matches (descending)
    teamStats.sort((a, b) => b.matches - a.matches);
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        losses: 0
    };
    
    teamStats.forEach(stats => {
        totals.matches += stats.matches;
        totals.wins += stats.wins;
        totals.losses += stats.losses;
    });
    
    // Populate table
    const tbody = document.querySelector('#h2h-teams-pks-table tbody');
    if (!tbody) {
        console.error('❌ H2H Teams PKS table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    teamStats.forEach(stats => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stats.team}</td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.losses}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update totals
    document.getElementById('h2h-pks-total-matches').textContent = totals.matches;
    document.getElementById('h2h-pks-total-wins').textContent = totals.wins;
    document.getElementById('h2h-pks-total-losses').textContent = totals.losses;
    
    console.log('✅ H2H Teams PKS table populated with', teamStats.length, 'teams');
}

/**
 * Sort H2H Teams PKS table
 */
let h2hTeamsPKSSortColumn = 'matches';
let h2hTeamsPKSSortDirection = 'desc';

function sortH2HTeamsPKSTable(column) {
    // Toggle sort direction if same column
    if (h2hTeamsPKSSortColumn === column) {
        h2hTeamsPKSSortDirection = h2hTeamsPKSSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        h2hTeamsPKSSortColumn = column;
        h2hTeamsPKSSortDirection = 'desc';
    }
    
    const tbody = document.querySelector('#h2h-teams-pks-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'team':
                aVal = a.cells[0].textContent;
                bVal = b.cells[0].textContent;
                return h2hTeamsPKSSortDirection === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            case 'matches':
                aVal = parseInt(a.cells[1].textContent) || 0;
                bVal = parseInt(b.cells[1].textContent) || 0;
                break;
            case 'wins':
                aVal = parseInt(a.cells[2].textContent) || 0;
                bVal = parseInt(b.cells[2].textContent) || 0;
                break;
            case 'losses':
                aVal = parseInt(a.cells[3].textContent) || 0;
                bVal = parseInt(b.cells[3].textContent) || 0;
                break;
            default:
                return 0;
        }
        
        return h2hTeamsPKSSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
    
    // Update sort icons
    document.querySelectorAll('#h2h-teams-pks-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeHeader = document.querySelector(`#h2h-teams-pks-table th[onclick="sortH2HTeamsPKSTable('${column}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(h2hTeamsPKSSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

// Export functions for global access
window.loadPKSData = loadPKSData;
window.applyPKSFilters = applyPKSFilters;
window.clearPKSFilters = clearPKSFilters;
window.refreshPKSStats = refreshPKSStats;
window.initializeAlAhlyPKSStats = initializeAlAhlyPKSStats;
window.switchMainTab = switchMainTab;
window.switchSubTab = switchSubTab;
window.populateH2HTeamsPKSTable = populateH2HTeamsPKSTable;
window.sortH2HTeamsPKSTable = sortH2HTeamsPKSTable;
