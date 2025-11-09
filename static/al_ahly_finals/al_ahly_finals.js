// ============================================================================
// AL AHLY FINALS STATISTICS MODULE - JAVASCRIPT FUNCTIONS
// ============================================================================

// Google Sheets Configuration
const FINALS_SHEET_ID = '18lO8QMRqNUifGmFRZDTL58fwbb2k03HvkKyvzAq9HJc';
const FINALS_SHEET_NAME = 'MATCHDETAILS';

// Column mapping from Google Sheet
const FINALS_COLUMNS = {
    'MATCH_ID': 'MATCH_ID',
    'CHAMPION System': 'CHAMPION_SYSTEM',
    'SEASON': 'SEASON',
    'TIMING': 'TIMING',
    'DATE': 'DATE',
    'CHAMPION': 'CHAMPION',
    'AHLY MANAGER': 'AHLY_MANAGER',
    'OPPONENT MANAGER': 'OPPONENT_MANAGER',
    'H/A/N': 'HOME_AWAY_NEUTRAL',
    'AHLY TEAM': 'AHLY_TEAM',
    'GF': 'GF',
    'GA': 'GA',
    'ET': 'ET',
    'PEN': 'PEN',
    'OPPONENT TEAM': 'OPPONENT_TEAM',
    'W-L MATCH': 'WL_MATCH',
    'C.S': 'CLEAN_SHEET',
    'W-L FINAL': 'WL_FINAL'
};

// ============================================================================
// FINALS STATISTICS DATA MANAGEMENT
// ============================================================================

// Global variables for Finals statistics data
let alAhlyFinalsStatsData = {
    allRecords: [],
    filteredRecords: [],
    filterOptions: {},
    currentFilters: {},
    playersData: [],
    lineupData: [],
    playerDatabase: [],
    selectedUnifiedPlayer: null
};

// ============================================================================
// GOOGLE SHEETS DATA FETCHING
// ============================================================================

/**
 * Fetch Finals data from Backend API (with Browser Cache - 24h TTL)
 */
async function fetchFinalsDataFromGoogleSheets(forceRefresh = false) {
    try {
        const fetchFunction = async () => {
            console.log('🔄 Fetching Finals data from server...');
            const response = await fetch('/api/finals-stats-data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch Finals data');
            console.log(`✅ Successfully fetched ${data.records?.length || 0} records`);
            return data.records || [];
        };
        return await fetchWithBrowserCache('al_ahly_finals_stats', fetchFunction, forceRefresh) || [];
    } catch (error) {
        console.error('❌ Error fetching Finals data:', error);
        return [];
    }
}

/**
 * Fetch Players data from Backend API (with Browser Cache - 24h TTL)
 */
async function fetchPlayersDataFromGoogleSheets(forceRefresh = false) {
    try {
        const fetchFunction = async () => {
            console.log('🔄 Fetching Players data from server...');
            const response = await fetch('/api/finals-players-data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch Players data');
            console.log(`✅ Successfully fetched ${data.records?.length || 0} player records`);
            return data.records || [];
        };
        return await fetchWithBrowserCache('al_ahly_finals_players', fetchFunction, forceRefresh) || [];
    } catch (error) {
        console.error('❌ Error fetching Players data:', error);
        return [];
    }
}

/**
 * Fetch Lineup data from Backend API (with Browser Cache - 24h TTL)
 */
async function fetchLineupDataFromGoogleSheets(forceRefresh = false) {
    try {
        const fetchFunction = async () => {
            console.log('🔄 Fetching Lineup data from server...');
            const response = await fetch('/api/finals-lineup-data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch Lineup data');
            console.log(`✅ Successfully fetched ${data.records?.length || 0} lineup records`);
            return data.records || [];
        };
        return await fetchWithBrowserCache('al_ahly_finals_lineup', fetchFunction, forceRefresh) || [];
    } catch (error) {
        console.error('❌ Error fetching Lineup data:', error);
        return [];
    }
}

/**
 * Fetch Player Database from Backend API (with Browser Cache - 24h TTL)
 */
async function fetchPlayerDatabaseFromGoogleSheets(forceRefresh = false) {
    try {
        const fetchFunction = async () => {
            console.log('🔄 Fetching Player Database from server...');
            const response = await fetch('/api/finals-playerdatabase-data');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Failed to fetch Player Database');
            return data.records || [];
        };
        return await fetchWithBrowserCache('al_ahly_finals_playerdb', fetchFunction, forceRefresh) || [];
    } catch (error) {
        console.error('❌ Error fetching Player Database:', error);
        return [];
    }
}

/**
 * Load and process Finals data
 */
async function loadFinalsData(forceRefresh = false) {
    try {
        showLoadingState(true);
        
        // Fetch data from Cache (or Google Sheets if cache miss)
        const records = await fetchFinalsDataFromGoogleSheets(forceRefresh);
        const playersData = await fetchPlayersDataFromGoogleSheets(forceRefresh);
        const lineupData = await fetchLineupDataFromGoogleSheets(forceRefresh);
        const playerDatabase = await fetchPlayerDatabaseFromGoogleSheets(forceRefresh);
        
        if (records.length === 0) {
            // No Finals data available
            return;
        }
        
        // Store all records
        alAhlyFinalsStatsData.allRecords = records;
        alAhlyFinalsStatsData.filteredRecords = records;
        alAhlyFinalsStatsData.playersData = playersData;
        alAhlyFinalsStatsData.lineupData = lineupData;
        alAhlyFinalsStatsData.playerDatabase = playerDatabase;
        
        // Build filter options from data
        buildFilterOptions(records);
        
        // Populate filter dropdowns
        populateFilterDropdowns();
        
        // Update statistics
        updateFinalsStatistics();
        
        // Initialize unified player search (By Players tab)
        initializeUnifiedPlayerSearch();
        
        // Finals data loaded successfully
        
    } catch (error) {
        console.error('Error loading Finals data:', error);
        // Failed to load Finals data
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
        'MATCH_ID',
        'CHAMPION System',
        'SEASON',
        'TIMING',
        'DATE',
        'CHAMPION',
        'AHLY MANAGER',
        'OPPONENT MANAGER',
        'H/A/N',
        'AHLY TEAM',
        'GF',
        'GA',
        'ET',
        'PEN',
        'OPPONENT TEAM',
        'W-L MATCH',
        'C.S',
        'W-L FINAL'
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
    
    alAhlyFinalsStatsData.filterOptions = options;
    console.log('📊 Filter options built:', options);
}

/**
 * Populate filter dropdowns with options
 */
function populateFilterDropdowns() {
    const filterMapping = {
        'match-id-filter': 'MATCH_ID',
        'champion-system-filter': 'CHAMPION System',
        'season-filter': 'SEASON',
        'timing-filter': 'TIMING',
        // 'date-filter' removed - now using date range inputs
        'champion-filter': 'CHAMPION',
        'ahly-manager-filter': 'AHLY MANAGER',
        'opponent-manager-filter': 'OPPONENT MANAGER',
        'han-filter': 'H/A/N',
        'ahly-team-filter': 'AHLY TEAM',
        'gf-filter': 'GF',
        'ga-filter': 'GA',
        'et-filter': 'ET',
        'pen-filter': 'PEN',
        'opponent-team-filter': 'OPPONENT TEAM',
        'wl-match-filter': 'W-L MATCH',
        'cs-filter': 'C.S',
        'wl-final-filter': 'W-L FINAL'
    };
    
    Object.keys(filterMapping).forEach(selectId => {
        const column = filterMapping[selectId];
        const options = alAhlyFinalsStatsData.filterOptions[column] || [];
        
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
        } else {
            console.warn(`Filter element not found: ${selectId}`);
        }
    });
    
    console.log('✅ Filter dropdowns populated');
    
    // Initialize searchable dropdowns after populating
    initializeSearchableFilters();
}

/**
 * Apply filters to data
 */
function applyFinalsFilters() {
    // Get current filter values with safe fallbacks
    const getFilterValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value : '';
    };
    
    const filters = {
        'MATCH_ID': getFilterValue('match-id-filter'),
        'CHAMPION System': getFilterValue('champion-system-filter'),
        'SEASON': getFilterValue('season-filter'),
        'TIMING': getFilterValue('timing-filter'),
        'CHAMPION': getFilterValue('champion-filter'),
        'AHLY MANAGER': getFilterValue('ahly-manager-filter'),
        'OPPONENT MANAGER': getFilterValue('opponent-manager-filter'),
        'H/A/N': getFilterValue('han-filter'),
        'AHLY TEAM': getFilterValue('ahly-team-filter'),
        'GF': getFilterValue('gf-filter'),
        'GA': getFilterValue('ga-filter'),
        'ET': getFilterValue('et-filter'),
        'PEN': getFilterValue('pen-filter'),
        'OPPONENT TEAM': getFilterValue('opponent-team-filter'),
        'W-L MATCH': getFilterValue('wl-match-filter'),
        'C.S': getFilterValue('cs-filter'),
        'W-L FINAL': getFilterValue('wl-final-filter')
    };
    
    // Get date range filters
    const dateFrom = document.getElementById('date-from-filter')?.value || '';
    const dateTo = document.getElementById('date-to-filter')?.value || '';
    
    // Store current filters
    alAhlyFinalsStatsData.currentFilters = filters;
    
    // Filter records
    let filteredRecords = alAhlyFinalsStatsData.allRecords;
    
    // Apply regular filters
    Object.keys(filters).forEach(column => {
        const filterValue = filters[column];
        if (filterValue) {
            filteredRecords = filteredRecords.filter(record => {
                const recordValue = record[column];
                return recordValue && recordValue.toString().trim() === filterValue;
            });
        }
    });
    
    // Apply date range filter
    if (dateFrom || dateTo) {
        filteredRecords = filteredRecords.filter(record => {
            const recordDate = record['DATE'];
            if (!recordDate) return false;
            
            // Parse date - handle various formats (DD/MM/YYYY, DD-MM-YYYY, etc.)
            const dateParts = recordDate.toString().split(/[\/\-\.]/);
            if (dateParts.length === 3) {
                // Assume DD/MM/YYYY or DD-MM-YYYY format
                const day = dateParts[0].padStart(2, '0');
                const month = dateParts[1].padStart(2, '0');
                const year = dateParts[2];
                const recordDateFormatted = `${year}-${month}-${day}`; // Convert to YYYY-MM-DD for comparison
                
                // Check if within range
                if (dateFrom && recordDateFormatted < dateFrom) return false;
                if (dateTo && recordDateFormatted > dateTo) return false;
            }
            
            return true;
        });
    }
    
    alAhlyFinalsStatsData.filteredRecords = filteredRecords;
    
    // Update statistics with filtered data
    updateFinalsStatistics();
}

/**
 * Clear all filters
 */
function clearFinalsFilters() {
    // Reset all filter dropdowns with safe fallbacks
    const filterIds = [
        'match-id-filter', 'champion-system-filter', 'season-filter', 'timing-filter',
        'champion-filter', 'ahly-manager-filter', 'opponent-manager-filter',
        'han-filter', 'ahly-team-filter', 'gf-filter', 'ga-filter',
        'et-filter', 'pen-filter', 'opponent-team-filter', 'wl-match-filter',
        'cs-filter', 'wl-final-filter'
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
    
    // Clear date range inputs
    const dateFromInput = document.getElementById('date-from-filter');
    const dateToInput = document.getElementById('date-to-filter');
    if (dateFromInput) dateFromInput.value = '';
    if (dateToInput) dateToInput.value = '';
    
    // Reset to all records
    alAhlyFinalsStatsData.filteredRecords = alAhlyFinalsStatsData.allRecords;
    alAhlyFinalsStatsData.currentFilters = {};
    
    // Update statistics
    updateFinalsStatistics();
    
    // All filters cleared
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
 * Refresh Finals data (force refresh from Google Sheets)
 */
async function refreshFinalsStats() {
    console.log('🔄 Force refreshing Finals data...');
    await loadFinalsData(true); // true = force refresh, bypass cache
}

// ============================================================================
// STATISTICS CALCULATION AND DISPLAY
// ============================================================================

/**
 * Calculate overview statistics
 */
function calculateOverviewStats(records) {
    // Count unique finals (by MATCH_ID)
    const uniqueMatchIds = new Set();
    const finalsWonSet = new Set();
    const finalsWonBothSet = new Set();
    const finalsLostSet = new Set();
    
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        if (matchId) {
            uniqueMatchIds.add(matchId);
            
            const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
            if (wlFinal === 'W' || wlFinal === 'WE') {
                finalsWonSet.add(matchId);
                if (wlFinal === 'WE') {
                    finalsWonBothSet.add(matchId);
                }
            } else if (wlFinal === 'L') {
                finalsLostSet.add(matchId);
            }
        }
    });
    
    const finalsWon = finalsWonSet.size;
    const finalsLost = finalsLostSet.size;
    const totalMatches = finalsWon + finalsLost;
    
    // Count match wins/losses/draws based on W-L MATCH column
    let matchWins = 0;
    let matchLosses = 0;
    let matchDraws = 0;
    
    records.forEach(record => {
        const wlMatch = record['W-L MATCH'];
        if (wlMatch) {
            const result = wlMatch.toUpperCase().trim();
            if (result === 'W') {
                matchWins++;
            } else if (result === 'L') {
                matchLosses++;
            } else if (result === 'D' || result === 'D.') {
                matchDraws++;
            }
        }
    });
    
    // Calculate win rate
    const finalWinRate = totalMatches > 0 ? Math.round((finalsWon / totalMatches) * 100) : 0;
    
    // Count total goals scored and conceded
    let totalGoalsFor = 0;
    let totalGoalsAgainst = 0;
    
    records.forEach(record => {
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        totalGoalsFor += gf;
        totalGoalsAgainst += ga;
    });
    
    // Count clean sheets (when GA = 0)
    let cleanSheets = 0;
    records.forEach(record => {
        const ga = parseInt(record['GA']) || 0;
        if (ga === 0) {
            cleanSheets++;
        }
    });
    
    return {
        totalMatches,
        finalsWon,
        finalsLost,
        finalsWonBoth: finalsWonBothSet.size,
        matchWins,
        matchLosses,
        matchDraws,
        finalWinRate,
        totalGoalsFor,
        totalGoalsAgainst,
        cleanSheets
    };
}

/**
 * Update overview stat cards
 */
function updateOverviewCards(stats) {
    const totalMatchOutcomes = stats.matchWins + stats.matchDraws + stats.matchLosses;
    document.getElementById('total-finals-matches').textContent = stats.totalMatches;
    document.getElementById('finals-won').textContent = stats.finalsWon;
    document.getElementById('finals-lost').textContent = stats.finalsLost;
    document.getElementById('total-match-outcomes').textContent = totalMatchOutcomes;
    document.getElementById('match-wins').textContent = stats.matchWins;
    document.getElementById('match-losses').textContent = stats.matchLosses;
    document.getElementById('match-draws').textContent = stats.matchDraws;
    document.getElementById('final-win-rate').textContent = stats.finalWinRate + '%';
    document.getElementById('finals-won-both').textContent = stats.finalsWonBoth;
    document.getElementById('total-goals-for').textContent = stats.totalGoalsFor;
    document.getElementById('total-goals-against').textContent = stats.totalGoalsAgainst;
    document.getElementById('clean-sheets').textContent = stats.cleanSheets;
}

/**
 * Update finals matches table
 */
function updateFinalsMatchesTable(records) {
    const tbody = document.querySelector('#finals-matches-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Sort by date (newest first)
    const sortedRecords = [...records].sort((a, b) => {
        const dateA = new Date(a['DATE'] || '1900-01-01');
        const dateB = new Date(b['DATE'] || '1900-01-01');
        
        return dateB - dateA; // Newest first
    });
    
    sortedRecords.forEach(match => {
        const row = document.createElement('tr');
        
        // Status badge based on W-L FINAL
        let finalStatusBadge = '';
        const wlFinal = match['W-L FINAL'];
        if (wlFinal) {
            if (wlFinal.toUpperCase() === 'W') {
                finalStatusBadge = '<span class="badge badge-success">Won</span>';
            } else if (wlFinal.toUpperCase() === 'L') {
                finalStatusBadge = '<span class="badge badge-danger">Lost</span>';
            }
        }
        
        // Match result badge based on W-L MATCH
        let matchStatusBadge = '';
        const wlMatch = match['W-L MATCH'];
        if (wlMatch) {
            const result = wlMatch.toUpperCase().trim();
            if (result === 'W') {
                matchStatusBadge = '<span class="badge badge-success">W</span>';
            } else if (result === 'L') {
                matchStatusBadge = '<span class="badge badge-danger">L</span>';
            } else if (result === 'D' || result === 'D.') {
                matchStatusBadge = '<span class="badge badge-warning">D</span>';
            }
        }
        
        row.innerHTML = `
            <td>${match['MATCH_ID'] || '-'}</td>
            <td>${match['SEASON'] || '-'}</td>
            <td>${match['CHAMPION'] || '-'}</td>
            <td>${match['TIMING'] || '-'}</td>
            <td>${match['OPPONENT TEAM'] || '-'}</td>
            <td>${match['H/A/N'] || '-'}</td>
            <td>${match['GF'] || '0'} - ${match['GA'] || '0'}</td>
            <td>${match['ET'] || '-'}</td>
            <td>${match['PEN'] || '-'}</td>
            <td>${matchStatusBadge}</td>
            <td>${finalStatusBadge}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Show message if no matches found
    if (sortedRecords.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="11" class="empty-state">
                <div style="padding: 2rem; text-align: center; color: #6c757d;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 1rem; opacity: 0.5;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3>No Finals Matches Found</h3>
                    <p>Try adjusting your filters or check if data is available.</p>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    }
}

/**
 * Calculate opponent statistics
 */
function calculateOpponentStats(records) {
    // Count unique finals won/lost from opponent perspective (inverse of Al Ahly)
    const finalsWonSet = new Set();
    const finalsWonBothSet = new Set();
    const finalsLostSet = new Set();
    
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        const wlFinal = record['W-L FINAL'];
        
        if (matchId && wlFinal) {
            const wlFinalUpper = wlFinal.toUpperCase().trim();
            if (wlFinalUpper === 'L' || wlFinalUpper === 'LE') {
                finalsWonSet.add(matchId); // Opponents win when Ahly loses
                if (wlFinalUpper === 'LE') {
                    finalsWonBothSet.add(matchId);
                }
            } else if (wlFinalUpper === 'W' || wlFinalUpper === 'WE') {
                finalsLostSet.add(matchId); // Opponents lose when Ahly wins
            }
        }
    });
    
    const finalsWon = finalsWonSet.size;
    const finalsLost = finalsLostSet.size;
    const totalMatches = finalsWon + finalsLost;
    
    // Count match wins/losses/draws from opponent perspective
    let matchWins = 0;
    let matchLosses = 0;
    let matchDraws = 0;
    
    records.forEach(record => {
        const wlMatch = record['W-L MATCH'];
        if (wlMatch) {
            const result = wlMatch.toUpperCase().trim();
            if (result === 'L') {
                matchWins++; // Opponents win when Ahly loses
            } else if (result === 'W') {
                matchLosses++; // Opponents lose when Ahly wins
            } else if (result === 'D' || result === 'D.') {
                matchDraws++;
            }
        }
    });
    
    // Calculate win rate
    const winRate = totalMatches > 0 ? Math.round((finalsWon / totalMatches) * 100) : 0;
    
    // Count total goals (GA for Ahly = GF for opponents, and vice versa)
    let totalGoalsFor = 0;
    let totalGoalsAgainst = 0;
    
    records.forEach(record => {
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        totalGoalsFor += ga; // Opponent goals = Ahly GA
        totalGoalsAgainst += gf; // Opponent conceded = Ahly GF
    });
    
    // Count clean sheets (when GF = 0, opponents kept clean sheet)
    let cleanSheets = 0;
    records.forEach(record => {
        const gf = parseInt(record['GF']) || 0;
        if (gf === 0) {
            cleanSheets++;
        }
    });
    
    return {
        totalMatches,
        finalsWon,
        finalsLost,
        matchWins,
        matchLosses,
        matchDraws,
        winRate,
        finalsWonBoth: finalsWonBothSet.size,
        totalGoalsFor,
        totalGoalsAgainst,
        cleanSheets
    };
}

/**
 * Update opponent overview cards
 */
function updateOpponentOverviewCards(stats) {
    const totalMatchOutcomes = stats.matchWins + stats.matchDraws + stats.matchLosses;
    document.getElementById('opponent-total-finals').textContent = stats.totalMatches;
    document.getElementById('opponent-finals-won').textContent = stats.finalsWon;
    document.getElementById('opponent-finals-won-both').textContent = stats.finalsWonBoth;
    document.getElementById('opponent-finals-lost').textContent = stats.finalsLost;
    document.getElementById('opponent-match-wins').textContent = stats.matchWins;
    document.getElementById('opponent-match-losses').textContent = stats.matchLosses;
    document.getElementById('opponent-match-draws').textContent = stats.matchDraws;
    document.getElementById('opponent-win-rate').textContent = stats.winRate + '%';
    document.getElementById('opponent-total-match-outcomes').textContent = totalMatchOutcomes;
    document.getElementById('opponent-goals-for').textContent = stats.totalGoalsFor;
    document.getElementById('opponent-goals-against').textContent = stats.totalGoalsAgainst;
    document.getElementById('opponent-clean-sheets').textContent = stats.cleanSheets;
}

/**
 * Process players data for filtered matches
 */
function processPlayersData(matchRecords, playersData) {
    // Get MATCH_IDs from filtered matches
    const matchIds = new Set(matchRecords.map(r => r['MATCH_ID']));
    
    // Filter players data for these matches only
    const filteredPlayers = playersData.filter(p => matchIds.has(p['MATCH_ID']));
    
    return filteredPlayers;
}

/**
 * Calculate Al Ahly players statistics
 */
function calculateAhlyPlayersStats(matchRecords, playersData, lineupData) {
    const matchIds = new Set(matchRecords.map(r => r['MATCH_ID']));
    
    // Group by player name
    const playerStats = {};
    
    // Process PLAYERDETAILS data for goals and assists AND as secondary source for match participation
    const filteredPlayers = playersData.filter(p => matchIds.has(p['MATCH_ID']));
    
    filteredPlayers.forEach(record => {
        const playerName = record['PLAYER NAME'];
        const matchId = record['MATCH_ID'];
        const gaTotal = parseInt(record['GATOTAL']) || 0;
        const gaType = record['GA'] || '';
        
        if (!playerName || playerName.trim() === '') return;
        
        if (!playerStats[playerName]) {
            playerStats[playerName] = {
                name: playerName,
                matches: new Set(),
                finalsPlayed: 0,
                finalsWon: 0,
                finalsLost: 0,
                goals: 0,
                assists: 0,
                totalContributions: 0
            };
        }
        
        // Add match to set (PLAYERDETAILS as primary source for participation)
        if (matchId) {
            playerStats[playerName].matches.add(matchId);
        }
        
        // Count contributions
        if (gaType.toUpperCase().includes('G')) {
            playerStats[playerName].goals += gaTotal;
        } else if (gaType.toUpperCase().includes('A')) {
            playerStats[playerName].assists += gaTotal;
        }
        
        playerStats[playerName].totalContributions += gaTotal;
    });
    
    // Process LINEUP11 data to add matches where player appeared but didn't score/assist
    // This serves as a secondary source to catch players who were in lineup but had no contributions
    const filteredLineup = lineupData.filter(l => matchIds.has(l['MATCH_ID']));
    
    filteredLineup.forEach(record => {
        const playerName = record['PLAYER NAME'];
        const matchId = record['MATCH_ID'];
        
        if (!playerName || playerName.trim() === '') return;
        
        if (!playerStats[playerName]) {
            playerStats[playerName] = {
                name: playerName,
                matches: new Set(),
                finalsPlayed: 0,
                finalsWon: 0,
                finalsLost: 0,
                goals: 0,
                assists: 0,
                totalContributions: 0
            };
        }
        
        // Add match to set (if already added from PLAYERDETAILS, Set will ignore duplicate)
        if (matchId) {
            playerStats[playerName].matches.add(matchId);
        }
    });
    
    // Calculate finals won and lost for each player
    Object.keys(playerStats).forEach(playerName => {
        const player = playerStats[playerName];
        
        // Count unique finals won and lost (by MATCH_ID)
        const finalsWonSet = new Set();
        const finalsLostSet = new Set();
        matchRecords.forEach(match => {
            const matchId = match['MATCH_ID'];
            if (matchId && player.matches.has(matchId)) {
                if (match['W-L FINAL'] === 'W') {
                    finalsWonSet.add(matchId);
                } else if (match['W-L FINAL'] === 'L') {
                    finalsLostSet.add(matchId);
                }
            }
        });
        player.finalsWon = finalsWonSet.size;
        player.finalsLost = finalsLostSet.size;
        
        // Calculate Finals Played as sum of won + lost finals
        player.finalsPlayed = player.finalsWon + player.finalsLost;
        
        // Calculate win rate
        player.winRate = player.finalsPlayed > 0 ? 
            ((player.finalsWon / player.finalsPlayed) * 100).toFixed(1) : '0.0';
    });
    
    return Object.values(playerStats);
}

/**
 * Update Al Ahly players table
 */
function updateAhlyPlayersTable(matchRecords, playersData, lineupData) {
    const tbody = document.querySelector('#ahly-players-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const players = calculateAhlyPlayersStats(matchRecords, playersData, lineupData);
    
    // Sort by total contributions (goals + assists) descending
    players.sort((a, b) => b.totalContributions - a.totalContributions);
    
    players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.name}</td>
            <td>${player.finalsPlayed}</td>
            <td>${player.finalsWon}</td>
            <td>${player.winRate}%</td>
            <td>${player.finalsLost}</td>
            <td>${player.totalContributions}</td>
            <td>${player.goals}</td>
            <td>${player.assists}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Show message if no players found
    if (players.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="8" class="empty-state">
                <div style="padding: 2rem; text-align: center; color: #6c757d;">
                    <h3>No Al Ahly Players Found</h3>
                    <p>Try adjusting your filters or check if data is available.</p>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    }
}

/**
 * Update opponent players table (placeholder)
 */
function updateOpponentPlayersTable(matchRecords, playersData) {
    const tbody = document.querySelector('#opponent-players-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const row = document.createElement('tr');
    row.innerHTML = `
        <td colspan="7" class="empty-state">
            <div style="padding: 2rem; text-align: center; color: #6c757d;">
                <h3>Opponent Players Data Not Available</h3>
                <p>Only Al Ahly players data is tracked in PLAYERDETAILS sheet.</p>
            </div>
        </td>
    `;
    tbody.appendChild(row);
}

/**
 * Update finals statistics
 */
function updateFinalsStatistics() {
    const records = alAhlyFinalsStatsData.filteredRecords;
    const playersData = alAhlyFinalsStatsData.playersData;
    const lineupData = alAhlyFinalsStatsData.lineupData;
    
    // Calculate overview statistics
    const stats = calculateOverviewStats(records);
    const opponentStats = calculateOpponentStats(records);
    
    // Update overview cards
    updateOverviewCards(stats);
    updateOpponentOverviewCards(opponentStats);
    
    // Update matches table
    updateFinalsMatchesTable(records);
    
    // Update H2H Teams table
    populateH2HTeamsTable();
    
    // Update Managers tables
    populateAhlyManagersTable();
    populateOpponentManagersTable();
    
    // Update players tables
    updateAhlyPlayersTable(records, playersData, lineupData);
    updateOpponentPlayersTable(records, playersData);
    
    // Update player overview if a player is selected (with proper team filtering)
    if (alAhlyFinalsStatsData.selectedAhlyPlayer) {
        displayPlayerOverview('ahly', alAhlyFinalsStatsData.selectedAhlyPlayer);
    }
    
    if (alAhlyFinalsStatsData.selectedOpponentPlayer) {
        displayPlayerOverview('opponent', alAhlyFinalsStatsData.selectedOpponentPlayer);
    }
    
    console.log('📊 Finals statistics updated');
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

/**
 * Show/hide loading state
 */
function showLoadingState(show) {
    const refreshBtn = document.querySelector('.finals-refresh-btn');
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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize Al Ahly Finals Stats module
 */
function initializeAlAhlyFinalsStats() {
    console.log('🚀 Initializing Al Ahly Finals Statistics Module...');
    
    // Add event listeners for date range filters
    const dateFromInput = document.getElementById('date-from-filter');
    const dateToInput = document.getElementById('date-to-filter');
    
    if (dateFromInput) {
        dateFromInput.addEventListener('change', () => {
            applyFinalsFilters();
        });
    }
    
    if (dateToInput) {
        dateToInput.addEventListener('change', () => {
            applyFinalsFilters();
        });
    }
    
    // Load Finals data on initialization
    loadFinalsData();
    
    console.log('✅ Al Ahly Finals Statistics Module Initialized');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAlAhlyFinalsStats);
} else {
    initializeAlAhlyFinalsStats();
}

// Re-initialize when page is shown (back/forward cache)
window.addEventListener('pageshow', function(event) {
    // If the page was restored from bfcache, reload the data
    if (event.persisted) {
        console.log('🔄 Page restored from cache, reloading data...');
        loadFinalsData();
    }
});

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
    
    // Populate H2H Teams table when switching to it
    if (tabName === 'h2h-teams') {
        populateH2HTeamsTable();
    }
    
    // Populate Managers tables when switching to managers tab
    if (tabName === 'managers') {
        populateAhlyManagersTable();
        populateOpponentManagersTable();
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
    
    // Reset nested sub tabs to first option
    resetNestedSubTabs(subTabName);
    
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
                
                // Also reset nested sub tabs
                resetNestedSubTabs(firstSubTabName);
            }
        }
    }
}

/**
 * Reset nested sub tabs to first option
 */
function resetNestedSubTabs(subTabName) {
    const subTabElement = document.getElementById(subTabName);
    if (subTabElement) {
        const nestedSubTabsNav = subTabElement.querySelector('.sub-tabs-nav-nested');
        if (nestedSubTabsNav) {
            const firstNestedSubTabButton = nestedSubTabsNav.querySelector('.sub-tab-nested-btn');
            if (firstNestedSubTabButton) {
                const firstNestedSubTabName = firstNestedSubTabButton.getAttribute('onclick')
                    .match(/switchNestedSubTab\('([^']+)'\)/)[1];
                switchNestedSubTab(firstNestedSubTabName);
            }
        }
    }
}

// ============================================================================
// NESTED SUB TAB MANAGEMENT
// ============================================================================

/**
 * Switch between nested sub tabs
 */
function switchNestedSubTab(nestedSubTabName) {
    console.log(`🔄 Switching to nested sub tab: ${nestedSubTabName}`);
    
    // Find the parent sub tab
    const nestedSubTabElement = document.getElementById(nestedSubTabName);
    const subTabElement = nestedSubTabElement.closest('.sub-tab-content');
    
    // Remove active class from all nested sub tab buttons in this sub tab
    const nestedSubTabsNav = subTabElement.querySelector('.sub-tabs-nav-nested');
    if (nestedSubTabsNav) {
        nestedSubTabsNav.querySelectorAll('.sub-tab-nested-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    }
    
    // Hide all nested sub tab contents in this sub tab
    subTabElement.querySelectorAll('.sub-tab-nested-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Activate selected nested sub tab button
    const activeNestedButton = document.querySelector(`[onclick="switchNestedSubTab('${nestedSubTabName}')"]`);
    if (activeNestedButton) {
        activeNestedButton.classList.add('active');
    }
    
    // Show selected nested sub tab content
    if (nestedSubTabElement) {
        nestedSubTabElement.classList.add('active');
    }
    
    console.log(`✅ Switched to nested sub tab: ${nestedSubTabName}`);
}

/**
 * Update player matches table
 */
function updatePlayerMatchesTable(playerName, teamFilter) {
    console.log('🔄 Updating player matches table:', { playerName, teamFilter });
    
    const tbody = document.querySelector('#player-matches-table tbody');
    if (!tbody) {
        console.log('❌ Player matches table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    const matchRecords = alAhlyFinalsStatsData.filteredRecords;
    const lineupData = alAhlyFinalsStatsData.lineupData;
    const playersData = alAhlyFinalsStatsData.playersData;
    
    // Get match IDs from filtered matches
    const matchIds = new Set(matchRecords.map(r => r['MATCH_ID']));
    
    // Get player matches from both PLAYERDETAILS (primary) and LINEUP11 (secondary)
    const playerMatches = new Set();
    
    // Get matches from PLAYERDETAILS (PRIMARY SOURCE)
    const playerContributions = playersData.filter(p => {
        if (!matchIds.has(p['MATCH_ID'])) return false;
        if (p['PLAYER NAME'] !== playerName) return false;
        
        // Apply team filter if set
        if (teamFilter) {
            const team = (p['TEAM'] || '').trim();
            return team === teamFilter;
        }
        
        return true;
    });
    
    // Get matches from LINEUP11 (SECONDARY SOURCE)
    const playerLineup = lineupData.filter(l => {
        if (!matchIds.has(l['MATCH_ID'])) return false;
        if (l['PLAYER NAME'] !== playerName) return false;
        
        // Apply team filter if set
        if (teamFilter) {
            const team = (l['TEAM'] || '').trim();
            return team === teamFilter;
        }
        
        return true;
    });
    
    // Add matches from both sources (PLAYERDETAILS first, then LINEUP11)
    playerContributions.forEach(contribution => {
        const matchId = contribution['MATCH_ID'];
        if (matchId) {
            playerMatches.add(matchId);
        }
    });
    
    playerLineup.forEach(lineup => {
        const matchId = lineup['MATCH_ID'];
        if (matchId) {
            playerMatches.add(matchId);
        }
    });
    
    console.log('📊 Found player matches:', playerMatches.size);
    
    // Group contributions by match
    const contributionsByMatch = {};
    playerContributions.forEach(contribution => {
        const matchId = contribution['MATCH_ID'];
        const gaTotal = parseInt(contribution['GATOTAL']) || 0;
        const gaType = (contribution['GA'] || '').toUpperCase().trim();
        
        if (!contributionsByMatch[matchId]) {
            contributionsByMatch[matchId] = { goals: 0, assists: 0 };
        }
        
        // Count goals and assists
        if (gaType === 'G' || gaType === 'GOAL') {
            contributionsByMatch[matchId].goals += gaTotal;
        }
        
        if (gaType === 'A' || gaType === 'ASSIST') {
            contributionsByMatch[matchId].assists += gaTotal;
        }
    });
    
    // Create table rows for each match
    const playerMatchList = Array.from(playerMatches).map(matchId => {
        const match = matchRecords.find(r => r['MATCH_ID'] === matchId);
        const contributions = contributionsByMatch[matchId] || { goals: 0, assists: 0 };
        
        return {
            matchId,
            date: match['DATE'] || '-',
            season: match['SEASON'] || '-',
            han: match['H/A/N'] || '-',
            opponent: match['OPPONENT TEAM'] || '-',
            finalWl: match['W-L FINAL'] || '-',
            goals: contributions.goals,
            assists: contributions.assists
        };
    });
    
    // Sort by date (newest first)
    playerMatchList.sort((a, b) => {
        const dateA = new Date(a.date || '1900-01-01');
        const dateB = new Date(b.date || '1900-01-01');
        return dateB - dateA;
    });
    
    console.log('📋 Player match list:', playerMatchList.length, 'matches');
    
    // Populate table
    playerMatchList.forEach(match => {
        const row = document.createElement('tr');
        
        // Highlight goals and assists if > 0 (wrap number in span)
        const goalsHTML = match.goals > 0 
            ? `<span class="highlight-value" style="font-size: 1.1em;">${match.goals}</span>` 
            : match.goals;
        const assistsHTML = match.assists > 0 
            ? `<span class="highlight-value" style="font-size: 1.1em;">${match.assists}</span>` 
            : match.assists;
        
        // Final W/L badge
        let finalWlHTML = match.finalWl;
        if (match.finalWl && match.finalWl !== '-') {
            const finalWl = match.finalWl.toUpperCase().trim();
            if (finalWl === 'W') {
                finalWlHTML = '<span class="badge badge-success">W</span>';
            } else if (finalWl === 'L') {
                finalWlHTML = '<span class="badge badge-danger">L</span>';
            }
        }
        
        row.innerHTML = `
            <td>${match.date}</td>
            <td>${match.season}</td>
            <td>${match.han}</td>
            <td>${match.opponent}</td>
            <td>${finalWlHTML}</td>
            <td>${goalsHTML}</td>
            <td>${assistsHTML}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Show message if no matches found
    if (playerMatchList.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="7" class="empty-state">
                <div style="padding: 2rem; text-align: center; color: #6c757d;">
                    <h3>No Matches Found</h3>
                    <p>No matches found for this player with the selected team filter.</p>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    }
}

// ============================================================================
// UNIFIED PLAYER SEARCH (By Players Tab)
// ============================================================================

/**
 * Initialize unified player search with team filter
 */
function initializeUnifiedPlayerSearch() {
    console.log('🔍 Initializing unified player search...');
    
    const searchInput = document.getElementById('unified-player-search');
    const dropdown = document.getElementById('unified-player-dropdown');
    const teamFilter = document.getElementById('player-team-filter');
    
    if (!searchInput || !dropdown || !teamFilter) {
        console.log('❌ Unified player search elements not found');
        return;
    }
    
    // Populate team filter dropdown
    populateTeamFilter();
    
    // Search input handlers
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.trim().toLowerCase();
        const selectedTeam = teamFilter.value;
        if (searchTerm.length > 0) {
            showUnifiedPlayerDropdown(searchTerm, selectedTeam);
        } else {
            dropdown.style.display = 'none';
        }
    });
    
    searchInput.addEventListener('focus', function() {
        const searchTerm = this.value.trim().toLowerCase();
        const selectedTeam = teamFilter.value;
        if (searchTerm.length > 0) {
            showUnifiedPlayerDropdown(searchTerm, selectedTeam);
        }
    });
    
    searchInput.addEventListener('blur', function() {
        setTimeout(() => {
            dropdown.style.display = 'none';
        }, 300);
    });
    
    // Team filter change handler
    teamFilter.addEventListener('change', function() {
        const selectedPlayer = alAhlyFinalsStatsData.selectedUnifiedPlayer;
        const selectedTeam = this.value;
        
        if (selectedPlayer) {
            // Update overview with new team filter
            displayUnifiedPlayerOverview(selectedPlayer, selectedTeam);
            // Update player matches table
            updatePlayerMatchesTable(selectedPlayer, selectedTeam);
        }
    });
    
    console.log('✅ Unified player search initialized');
}

/**
 * Populate team filter dropdown with unique teams
 */
function populateTeamFilter() {
    const teamFilter = document.getElementById('player-team-filter');
    if (!teamFilter) return;
    
    const playerDatabase = alAhlyFinalsStatsData.playerDatabase;
    
    // Get unique teams
    const teams = new Set();
    playerDatabase.forEach(player => {
        const team = player['TEAM'];
        if (team && team.trim() !== '') {
            teams.add(team.trim());
        }
    });
    
    // Clear and repopulate dropdown
    teamFilter.innerHTML = '<option value="">All Teams</option>';
    
    // Sort teams alphabetically
    const sortedTeams = Array.from(teams).sort();
    
    sortedTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
}

/**
 * Show unified player dropdown with team filtering
 */
function showUnifiedPlayerDropdown(searchTerm, teamFilter) {
    const dropdown = document.getElementById('unified-player-dropdown');
    if (!dropdown) return;
    
    // Filter players by search term and team (if selected)
    const filteredPlayers = alAhlyFinalsStatsData.playerDatabase.filter(player => {
        const playerName = (player['PLAYER NAME'] || '').toLowerCase();
        const team = (player['TEAM'] || '').trim();
        
        const matchesSearch = playerName.includes(searchTerm);
        const matchesTeam = !teamFilter || team === teamFilter;
        
        return matchesSearch && matchesTeam && playerName !== '';
    });
    
    // Remove duplicates by player name
    const uniquePlayers = [];
    const seenNames = new Set();
    
    filteredPlayers.forEach(player => {
        const name = player['PLAYER NAME'];
        if (!seenNames.has(name)) {
            seenNames.add(name);
            uniquePlayers.push(player);
        }
    });
    
    // Populate dropdown
    dropdown.innerHTML = '';
    
    if (uniquePlayers.length === 0) {
        dropdown.innerHTML = '<div class="player-dropdown-item">No players found</div>';
        dropdown.style.display = 'block';
        return;
    }
    
    uniquePlayers.slice(0, 10).forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-dropdown-item';
        div.innerHTML = `
            <div class="player-name">${player['PLAYER NAME']}</div>
        `;
        
        div.addEventListener('mousedown', function(e) {
            e.preventDefault();
            selectUnifiedPlayer(player['PLAYER NAME']);
        });
        
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
}

/**
 * Select a player in unified search
 */
function selectUnifiedPlayer(playerName) {
    console.log(`🎯 Selected player: ${playerName}`);
    
    const searchInput = document.getElementById('unified-player-search');
    const dropdown = document.getElementById('unified-player-dropdown');
    const teamFilter = document.getElementById('player-team-filter');
    
    if (searchInput) {
        searchInput.value = playerName;
    }
    
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Store selected player
    alAhlyFinalsStatsData.selectedUnifiedPlayer = playerName;
    
    // Display player overview
    const selectedTeam = teamFilter ? teamFilter.value : '';
    displayUnifiedPlayerOverview(playerName, selectedTeam);
    
    // Update player matches table
    updatePlayerMatchesTable(playerName, selectedTeam);
}

/**
 * Display unified player overview with team filter
 */
function displayUnifiedPlayerOverview(playerName, teamFilter) {
    const container = document.getElementById('unified-player-overview-cards');
    if (!container) return;
    
    // Calculate player statistics with team filter
    const stats = calculateUnifiedPlayerStats(playerName, teamFilter);
    
    // Create overview cards HTML
    container.innerHTML = `
        <div class="player-overview-card">
            <h3>Matches Played</h3>
            <p class="player-overview-value">${stats.matchesPlayed}</p>
            <p class="player-overview-label">Finals Appearances</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Finals Played</h3>
            <p class="player-overview-value">${stats.finalsPlayed}</p>
            <p class="player-overview-label">Total Finals</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Finals Won</h3>
            <p class="player-overview-value">${stats.finalsWon}</p>
            <p class="player-overview-label">Championships</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Win Rate</h3>
            <p class="player-overview-value">${stats.winRate}%</p>
            <p class="player-overview-label">Success Rate</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Finals Lost</h3>
            <p class="player-overview-value">${stats.finalsLost}</p>
            <p class="player-overview-label">Runner-up</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Goals + Assists</h3>
            <p class="player-overview-value">${stats.goalsAndAssists}</p>
            <p class="player-overview-label">Total Contributions</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Goals</h3>
            <p class="player-overview-value">${stats.goals}</p>
            <p class="player-overview-label">Goals Scored</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Assists</h3>
            <p class="player-overview-value">${stats.assists}</p>
            <p class="player-overview-label">Assists Made</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Penalty Goals</h3>
            <p class="player-overview-value">${stats.penaltyGoals ?? 0}</p>
            <p class="player-overview-label">Goals from Penalties</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Penalty AG</h3>
            <p class="player-overview-value">${stats.penaltyAG ?? 0}</p>
            <p class="player-overview-label">Penalty Assist Goals</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Penalties Missed</h3>
            <p class="player-overview-value">${stats.penMissed ?? 0}</p>
            <p class="player-overview-label">Missed Penalties</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Braces</h3>
            <p class="player-overview-value">${stats.braces}</p>
            <p class="player-overview-label">2 Goals in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Hat-tricks</h3>
            <p class="player-overview-value">${stats.hatTricks}</p>
            <p class="player-overview-label">3 Goals in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>4+ Goals</h3>
            <p class="player-overview-value">${stats.fourPlusGoals}</p>
            <p class="player-overview-label">4+ Goals in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Assist Braces</h3>
            <p class="player-overview-value">${stats.assistBraces}</p>
            <p class="player-overview-label">2 Assists in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Assist Hat-tricks</h3>
            <p class="player-overview-value">${stats.assistHatTricks}</p>
            <p class="player-overview-label">3 Assists in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>4+ Assists</h3>
            <p class="player-overview-value">${stats.fourPlusAssists}</p>
            <p class="player-overview-label">4+ Assists in a Match</p>
        </div>
        
        <div class="player-overview-card">
            <h3>Free Kicks</h3>
            <p class="player-overview-value">${stats.fkCount ?? 0}</p>
            <p class="player-overview-label">Goals from Free Kicks</p>
        </div>
    `;
}

/**
 * Calculate unified player statistics with team filter
 */
function calculateUnifiedPlayerStats(playerName, teamFilter) {
    const matchRecords = alAhlyFinalsStatsData.filteredRecords;
    const lineupData = alAhlyFinalsStatsData.lineupData;
    const playersData = alAhlyFinalsStatsData.playersData;
    
    // Get match IDs from filtered matches
    const matchIds = new Set(matchRecords.map(r => r['MATCH_ID']));
    
    // Collect all matches for this player (with team filter)
    const playerMatches = new Set();
    
    // Filter player contributions by team (if filter is set) - PRIMARY SOURCE
    const playerContributions = playersData.filter(p => {
        if (!matchIds.has(p['MATCH_ID'])) return false;
        if (p['PLAYER NAME'] !== playerName) return false;
        
        // Apply team filter if set
        if (teamFilter) {
            const team = (p['TEAM'] || '').trim();
            return team === teamFilter;
        }
        
        return true;
    });
    
    // Add matches from PLAYERDETAILS (PRIMARY SOURCE for participation)
    playerContributions.forEach(contribution => {
        const matchId = contribution['MATCH_ID'];
        if (matchId) {
            playerMatches.add(matchId);
        }
    });
    
    // Filter lineup data by team (if filter is set) - SECONDARY SOURCE
    const playerLineup = lineupData.filter(l => {
        if (!matchIds.has(l['MATCH_ID'])) return false;
        if (l['PLAYER NAME'] !== playerName) return false;
        
        // Apply team filter if set
        if (teamFilter) {
            const team = (l['TEAM'] || '').trim();
            return team === teamFilter;
        }
        
        return true;
    });
    
    // Add matches from LINEUP11 (SECONDARY SOURCE - catches players in lineup with no contributions)
    playerLineup.forEach(lineup => {
        const matchId = lineup['MATCH_ID'];
        if (matchId) {
            playerMatches.add(matchId);
        }
    });
    
    // Count matches played
    const matchesPlayed = playerLineup.length;
    
    // Determine if player is with Ahly or opponent based on team filter
    let isAhlyPlayer = true; // Default to Ahly player
    if (teamFilter) {
        const teamUpper = teamFilter.toUpperCase();
        isAhlyPlayer = teamUpper.includes('AHLY') || teamUpper.includes('الأهلي');
    }
    
    // Count unique finals won and lost (by MATCH_ID)
    const finalsWonSet = new Set();
    const finalsLostSet = new Set();
    matchRecords.forEach(match => {
        const matchId = match['MATCH_ID'];
        if (!matchId || !playerMatches.has(matchId)) return;
        
        const wlFinal = match['W-L FINAL'];
        if (isAhlyPlayer) {
            if (wlFinal === 'W') finalsWonSet.add(matchId);
            if (wlFinal === 'L') finalsLostSet.add(matchId);
        } else {
            if (wlFinal === 'L') finalsWonSet.add(matchId);
            if (wlFinal === 'W') finalsLostSet.add(matchId);
        }
    });
    const finalsWon = finalsWonSet.size;
    const finalsLost = finalsLostSet.size;
    
    // Finals played = sum of won + lost finals
    const finalsPlayed = finalsWon + finalsLost;
    
    // Calculate win rate
    const winRate = finalsPlayed > 0 ? Math.round((finalsWon / finalsPlayed) * 100) : 0;
    
    // Calculate goals and assists
    let goals = 0;
    let assists = 0;
    let penaltyGoals = 0;
    let penaltyAG = 0;
    let penMissed = 0;
    let fkCount = 0;
    
    const goalsPerMatch = {};
    const assistsPerMatch = {};
    
    playerContributions.forEach(contribution => {
        const matchId = contribution['MATCH_ID'];
        const gaTotal = parseInt(contribution['GATOTAL']) || 0;
        const gaType = (contribution['GA'] || '').toUpperCase().trim();
        const goalType = (contribution['TYPE'] || '').toUpperCase();
        
        // Count FK
        if (goalType.includes('FK')) {
            const fkMatches = goalType.match(/FK/g);
            if (fkMatches) {
                fkCount += fkMatches.length;
            }
        }
        
        // Check for PENASSISTGOAL
        if (gaType === 'PENASSISTGOAL') {
            penaltyAG += gaTotal;
        }
        
        // Check for PENMISSED
        if (gaType === 'PENMISSED') {
            penMissed += gaTotal;
        }
        
        // Check for goals
        if (gaType === 'G' || gaType === 'GOAL') {
            goals += gaTotal;
            goalsPerMatch[matchId] = (goalsPerMatch[matchId] || 0) + gaTotal;
            
            // Count penalty goals
            if (goalType.includes('PENGOAL')) {
                const pengoalMatches = goalType.match(/PENGOAL/g);
                if (pengoalMatches) {
                    penaltyGoals += pengoalMatches.length;
                }
            }
        }
        
        // Check for assists
        if (gaType === 'A' || gaType === 'ASSIST') {
            assists += gaTotal;
            assistsPerMatch[matchId] = (assistsPerMatch[matchId] || 0) + gaTotal;
        }
    });
    
    const goalsAndAssists = goals + assists;
    
    // Calculate braces, hat-tricks, 4+ for goals
    let braces = 0;
    let hatTricks = 0;
    let fourPlusGoals = 0;
    
    Object.values(goalsPerMatch).forEach(matchGoals => {
        if (matchGoals === 2) braces++;
        else if (matchGoals === 3) hatTricks++;
        else if (matchGoals >= 4) fourPlusGoals++;
    });
    
    // Calculate braces, hat-tricks, 4+ for assists
    let assistBraces = 0;
    let assistHatTricks = 0;
    let fourPlusAssists = 0;
    
    Object.values(assistsPerMatch).forEach(matchAssists => {
        if (matchAssists === 2) assistBraces++;
        else if (matchAssists === 3) assistHatTricks++;
        else if (matchAssists >= 4) fourPlusAssists++;
    });
    
    return {
        matchesPlayed,
        finalsPlayed,
        finalsWon,
        winRate,
        finalsLost,
        goalsAndAssists,
        goals,
        assists,
        penaltyGoals,
        penaltyAG,
        penMissed,
        fkCount,
        braces,
        hatTricks,
        fourPlusGoals,
        assistBraces,
        assistHatTricks,
        fourPlusAssists
    };
}

// ============================================================================
// H2H TEAMS STATISTICS
// ============================================================================

/**
 * Populate H2H Teams table with statistics
 */
function populateH2HTeamsTable() {
    const records = alAhlyFinalsStatsData.filteredRecords;
    
    if (!records || records.length === 0) {
        console.warn('⚠️ No data available for H2H Teams');
        return;
    }
    
    console.log('📊 Populating H2H Teams table with', records.length, 'records');
    
    // Store original data for filtering
    if (!window.h2hTeamsOriginalData) {
        window.h2hTeamsOriginalData = [];
    }
    
    // Group by opponent team
    const teamStats = {};
    
    records.forEach(record => {
        const opponentTeam = record['OPPONENT TEAM'] || 'Unknown';
        const matchId = record['MATCH_ID'] || '';
        const wlMatch = (record['W-L MATCH'] || '').toUpperCase().trim();
        const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        const et = (record['ET'] || '').toUpperCase().trim();
        
        if (!teamStats[opponentTeam]) {
            teamStats[opponentTeam] = {
                team: opponentTeam,
                uniqueMatchIds: new Set(),
                finalsWonIds: new Set(),
                finalsLostIds: new Set(),
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0
            };
        }
        
        const stats = teamStats[opponentTeam];
        
        // Track unique MATCH_ID for finals count
        if (matchId) {
            stats.uniqueMatchIds.add(matchId);
            
            // Track finals won/lost by unique MATCH_ID
            if (wlFinal === 'W') {
                stats.finalsWonIds.add(matchId);
            } else if (wlFinal === 'L') {
                stats.finalsLostIds.add(matchId);
            }
        }
        
        // Count matches (all records)
        stats.matches++;
        stats.goalsFor += gf;
        stats.goalsAgainst += ga;
        
        // Count match results based on W-L MATCH column
        if (wlMatch === 'W') {
            stats.wins++;
        } else if (wlMatch === 'D' || wlMatch === 'D.') {
            // Count both D and D. as draws
            stats.draws++;
        } else if (wlMatch === 'L') {
            stats.losses++;
        }
    });
    
    // Convert Sets to counts
    Object.values(teamStats).forEach(stats => {
        stats.finalsWon = stats.finalsWonIds.size;
        stats.finalsLost = stats.finalsLostIds.size;
        stats.finals = stats.finalsWon + stats.finalsLost; // Sum of won + lost finals
        // Clean up Sets (no longer needed)
        delete stats.uniqueMatchIds;
        delete stats.finalsWonIds;
        delete stats.finalsLostIds;
    });
    
    // Convert to array and sort by finals (descending)
    let teamsArray = Object.values(teamStats);
    teamsArray.sort((a, b) => b.finals - a.finals);
    
    // Store original data for filtering
    window.h2hTeamsOriginalData = teamsArray;
    
    // Render table with all data initially
    renderH2HTeamsTable(teamsArray);
    
    // Initialize search functionality
    initializeH2HTeamsSearch();
    
    console.log('✅ H2H Teams table populated with', teamsArray.length, 'teams');
}

/**
 * Render H2H Teams table with given data
 */
function renderH2HTeamsTable(teamsArray) {
    // Calculate totals for the filtered data
    const totals = {
        finals: 0,
        finalsWon: 0,
        finalsLost: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0
    };
    
    // Sum stats from filtered teams
    teamsArray.forEach(stats => {
        totals.finals += stats.finals;
        totals.finalsWon += stats.finalsWon;
        totals.finalsLost += stats.finalsLost;
        totals.matches += stats.matches;
        totals.wins += stats.wins;
        totals.draws += stats.draws;
        totals.losses += stats.losses;
        totals.goalsFor += stats.goalsFor;
        totals.goalsAgainst += stats.goalsAgainst;
    });
    
    // Populate table
    const tbody = document.querySelector('#h2h-teams-table tbody');
    if (!tbody) {
        console.error('❌ H2H Teams table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    teamsArray.forEach(stats => {
        const gd = stats.goalsFor - stats.goalsAgainst;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stats.team}</td>
            <td>${stats.finals}</td>
            <td>${stats.finalsWon}</td>
            <td>${stats.finalsLost}</td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.draws}</td>
            <td>${stats.losses}</td>
            <td>${stats.goalsFor}</td>
            <td>${stats.goalsAgainst}</td>
            <td class="${gdClass}">${gd > 0 ? '+' : ''}${gd}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update totals
    document.getElementById('h2h-total-finals').textContent = totals.finals;
    document.getElementById('h2h-total-finals-won').textContent = totals.finalsWon;
    document.getElementById('h2h-total-finals-lost').textContent = totals.finalsLost;
    document.getElementById('h2h-total-matches').textContent = totals.matches;
    document.getElementById('h2h-total-wins').textContent = totals.wins;
    document.getElementById('h2h-total-draws').textContent = totals.draws;
    document.getElementById('h2h-total-losses').textContent = totals.losses;
    document.getElementById('h2h-total-gf').textContent = totals.goalsFor;
    document.getElementById('h2h-total-ga').textContent = totals.goalsAgainst;
    
    const totalGd = totals.goalsFor - totals.goalsAgainst;
    const totalGdElement = document.getElementById('h2h-total-gd');
    totalGdElement.textContent = (totalGd > 0 ? '+' : '') + totalGd;
    totalGdElement.className = totalGd > 0 ? 'positive' : totalGd < 0 ? 'negative' : '';
}

/**
 * Initialize H2H Teams search functionality
 */
function initializeH2HTeamsSearch() {
    const searchInput = document.getElementById('h2h-teams-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        filterH2HTeamsTable(searchTerm);
    });
}

/**
 * Filter H2H Teams table based on search term
 */
function filterH2HTeamsTable(searchTerm) {
    if (!window.h2hTeamsOriginalData) return;
    
    let filteredTeams = window.h2hTeamsOriginalData;
    
    if (searchTerm) {
        filteredTeams = window.h2hTeamsOriginalData.filter(team => 
            team.team.toLowerCase().includes(searchTerm)
        );
    }
    
    renderH2HTeamsTable(filteredTeams);
}

/**
 * Sort H2H Teams table
 */
let h2hTeamsSortColumn = 'finals';
let h2hTeamsSortDirection = 'desc';

function sortH2HTeamsTable(column) {
    // Toggle sort direction if same column
    if (h2hTeamsSortColumn === column) {
        h2hTeamsSortDirection = h2hTeamsSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        h2hTeamsSortColumn = column;
        h2hTeamsSortDirection = 'desc';
    }
    
    // Get current filtered data or original data
    const currentData = window.h2hTeamsOriginalData || [];
    
    // Sort the data
    const sortedData = [...currentData].sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'team':
                aVal = a.team;
                bVal = b.team;
                return h2hTeamsSortDirection === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            case 'finals':
                aVal = a.finals;
                bVal = b.finals;
                break;
            case 'finalsWon':
                aVal = a.finalsWon;
                bVal = b.finalsWon;
                break;
            case 'finalsLost':
                aVal = a.finalsLost;
                bVal = b.finalsLost;
                break;
            case 'matches':
                aVal = a.matches;
                bVal = b.matches;
                break;
            case 'wins':
                aVal = a.wins;
                bVal = b.wins;
                break;
            case 'draws':
                aVal = a.draws;
                bVal = b.draws;
                break;
            case 'losses':
                aVal = a.losses;
                bVal = b.losses;
                break;
            case 'goalsFor':
                aVal = a.goalsFor;
                bVal = b.goalsFor;
                break;
            case 'goalsAgainst':
                aVal = a.goalsAgainst;
                bVal = b.goalsAgainst;
                break;
            case 'goalDifference':
                aVal = a.goalsFor - a.goalsAgainst;
                bVal = b.goalsFor - b.goalsAgainst;
                break;
            default:
                return 0;
        }
        
        return h2hTeamsSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    // Re-render table with sorted data
    renderH2HTeamsTable(sortedData);
    
    // Update sort icons
    document.querySelectorAll('#h2h-teams-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeHeader = document.querySelector(`#h2h-teams-table th[onclick="sortH2HTeamsTable('${column}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(h2hTeamsSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

// ============================================================================
// MANAGERS STATISTICS
// ============================================================================

/**
 * Populate Ahly Managers Table
 */
function populateAhlyManagersTable() {
    const records = alAhlyFinalsStatsData.filteredRecords;
    
    if (!records || records.length === 0) {
        console.warn('⚠️ No data available for Ahly Managers');
        return;
    }
    
    console.log('📊 Populating Ahly Managers table with', records.length, 'records');
    
    // Group by Ahly manager
    const managerStats = {};
    
    records.forEach(record => {
        const manager = record['AHLY MANAGER'] || 'Unknown';
        const matchId = record['MATCH_ID'] || '';
        const wlMatch = (record['W-L MATCH'] || '').toUpperCase().trim();
        const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        
        if (!managerStats[manager]) {
            managerStats[manager] = {
                manager: manager,
                uniqueMatchIds: new Set(),
                finalsWonIds: new Set(),
                finalsLostIds: new Set(),
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0
            };
        }
        
        const stats = managerStats[manager];
        
        // Track unique MATCH_ID for finals count
        if (matchId) {
            stats.uniqueMatchIds.add(matchId);
            
            // Track finals won/lost by unique MATCH_ID
            if (wlFinal === 'W') {
                stats.finalsWonIds.add(matchId);
            } else if (wlFinal === 'L') {
                stats.finalsLostIds.add(matchId);
            }
        }
        
        // Count matches (all records)
        stats.matches++;
        stats.goalsFor += gf;
        stats.goalsAgainst += ga;
        
        // Count match results based on W-L MATCH column
        if (wlMatch === 'W') {
            stats.wins++;
        } else if (wlMatch === 'D' || wlMatch === 'D.') {
            stats.draws++;
        } else if (wlMatch === 'L') {
            stats.losses++;
        }
    });
    
    // Convert Sets to counts
    Object.values(managerStats).forEach(stats => {
        stats.finalsWon = stats.finalsWonIds.size;
        stats.finalsLost = stats.finalsLostIds.size;
        stats.finals = stats.finalsWon + stats.finalsLost; // Sum of won + lost finals
        // Clean up Sets (no longer needed)
        delete stats.uniqueMatchIds;
        delete stats.finalsWonIds;
        delete stats.finalsLostIds;
    });
    
    // Convert to array and sort by finals (descending)
    let managersArray = Object.values(managerStats);
    managersArray.sort((a, b) => b.finals - a.finals);
    
    // Calculate totals (unique MATCH_IDs from original records)
    const totalFinalsWonIds = new Set();
    const totalFinalsLostIds = new Set();
    
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        if (matchId) {
            const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
            if (wlFinal === 'W') {
                totalFinalsWonIds.add(matchId);
            } else if (wlFinal === 'L') {
                totalFinalsLostIds.add(matchId);
            }
        }
    });
    
    const totals = {
        finalsWon: totalFinalsWonIds.size,
        finalsLost: totalFinalsLostIds.size,
        finals: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0
    };
    
    // Calculate Total Finals as sum of Finals Won + Finals Lost
    totals.finals = totals.finalsWon + totals.finalsLost;
    
    // Sum match stats and goals
    managersArray.forEach(stats => {
        totals.matches += stats.matches;
        totals.wins += stats.wins;
        totals.draws += stats.draws;
        totals.losses += stats.losses;
        totals.goalsFor += stats.goalsFor;
        totals.goalsAgainst += stats.goalsAgainst;
    });
    
    // Populate table
    const tbody = document.querySelector('#ahly-managers-table tbody');
    if (!tbody) {
        console.error('❌ Ahly Managers table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    managersArray.forEach(stats => {
        const gd = stats.goalsFor - stats.goalsAgainst;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stats.manager}</td>
            <td>${stats.finals}</td>
            <td>${stats.finalsWon}</td>
            <td>${stats.finalsLost}</td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.draws}</td>
            <td>${stats.losses}</td>
            <td>${stats.goalsFor}</td>
            <td>${stats.goalsAgainst}</td>
            <td class="${gdClass}">${gd > 0 ? '+' : ''}${gd}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update totals
    document.getElementById('ahly-mgr-total-finals').textContent = totals.finals;
    document.getElementById('ahly-mgr-total-finals-won').textContent = totals.finalsWon;
    document.getElementById('ahly-mgr-total-finals-lost').textContent = totals.finalsLost;
    document.getElementById('ahly-mgr-total-matches').textContent = totals.matches;
    document.getElementById('ahly-mgr-total-wins').textContent = totals.wins;
    document.getElementById('ahly-mgr-total-draws').textContent = totals.draws;
    document.getElementById('ahly-mgr-total-losses').textContent = totals.losses;
    document.getElementById('ahly-mgr-total-gf').textContent = totals.goalsFor;
    document.getElementById('ahly-mgr-total-ga').textContent = totals.goalsAgainst;
    
    const totalGd = totals.goalsFor - totals.goalsAgainst;
    const totalGdElement = document.getElementById('ahly-mgr-total-gd');
    totalGdElement.textContent = (totalGd > 0 ? '+' : '') + totalGd;
    totalGdElement.className = totalGd > 0 ? 'positive' : totalGd < 0 ? 'negative' : '';
    
    console.log('✅ Ahly Managers table populated with', managersArray.length, 'managers');
}

/**
 * Populate Opponent Managers Table
 */
function populateOpponentManagersTable() {
    const records = alAhlyFinalsStatsData.filteredRecords;
    
    if (!records || records.length === 0) {
        console.warn('⚠️ No data available for Opponent Managers');
        return;
    }
    
    console.log('📊 Populating Opponent Managers table with', records.length, 'records');
    
    // Group by opponent manager
    const managerStats = {};
    
    records.forEach(record => {
        const manager = record['OPPONENT MANAGER'] || 'Unknown';
        const matchId = record['MATCH_ID'] || '';
        const wlMatch = (record['W-L MATCH'] || '').toUpperCase().trim();
        const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
        const gf = parseInt(record['GF']) || 0;
        const ga = parseInt(record['GA']) || 0;
        
        if (!managerStats[manager]) {
            managerStats[manager] = {
                manager: manager,
                uniqueMatchIds: new Set(),
                finalsWonIds: new Set(),
                finalsLostIds: new Set(),
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0
            };
        }
        
        const stats = managerStats[manager];
        
        // Track unique MATCH_ID for finals count
        if (matchId) {
            stats.uniqueMatchIds.add(matchId);
            
            // Track finals won/lost by unique MATCH_ID (reversed for opponents)
            if (wlFinal === 'W') {
                stats.finalsLostIds.add(matchId);  // Ahly won = opponent lost
            } else if (wlFinal === 'L') {
                stats.finalsWonIds.add(matchId);   // Ahly lost = opponent won
            }
        }
        
        // Count matches (all records)
        stats.matches++;
        // For opponent managers, GF and GA are reversed
        stats.goalsFor += ga;
        stats.goalsAgainst += gf;
        
        // Count match results (reversed for opponents)
        if (wlMatch === 'W') {
            stats.losses++;  // Ahly won = opponent lost
        } else if (wlMatch === 'D' || wlMatch === 'D.') {
            stats.draws++;
        } else if (wlMatch === 'L') {
            stats.wins++;  // Ahly lost = opponent won
        }
    });
    
    // Convert Sets to counts
    Object.values(managerStats).forEach(stats => {
        stats.finalsWon = stats.finalsWonIds.size;
        stats.finalsLost = stats.finalsLostIds.size;
        stats.finals = stats.finalsWon + stats.finalsLost; // Sum of won + lost finals
        // Clean up Sets (no longer needed)
        delete stats.uniqueMatchIds;
        delete stats.finalsWonIds;
        delete stats.finalsLostIds;
    });
    
    // Convert to array and sort by finals (descending)
    let managersArray = Object.values(managerStats);
    managersArray.sort((a, b) => b.finals - a.finals);
    
    // Calculate totals (unique MATCH_IDs from original records)
    const totalFinalsWonIds = new Set();
    const totalFinalsLostIds = new Set();
    
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        if (matchId) {
            const wlFinal = (record['W-L FINAL'] || '').toUpperCase().trim();
            // For opponent: Ahly's L = opponent's W
            if (wlFinal === 'L') {
                totalFinalsWonIds.add(matchId);
            } else if (wlFinal === 'W') {
                totalFinalsLostIds.add(matchId);
            }
        }
    });
    
    const totals = {
        finalsWon: totalFinalsWonIds.size,
        finalsLost: totalFinalsLostIds.size,
        finals: 0,
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0
    };
    
    // Calculate Total Finals as sum of Finals Won + Finals Lost
    totals.finals = totals.finalsWon + totals.finalsLost;
    
    // Sum match stats and goals
    managersArray.forEach(stats => {
        totals.matches += stats.matches;
        totals.wins += stats.wins;
        totals.draws += stats.draws;
        totals.losses += stats.losses;
        totals.goalsFor += stats.goalsFor;
        totals.goalsAgainst += stats.goalsAgainst;
    });
    
    // Populate table
    const tbody = document.querySelector('#opponent-managers-table tbody');
    if (!tbody) {
        console.error('❌ Opponent Managers table body not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    managersArray.forEach(stats => {
        const gd = stats.goalsFor - stats.goalsAgainst;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${stats.manager}</td>
            <td>${stats.finals}</td>
            <td>${stats.finalsWon}</td>
            <td>${stats.finalsLost}</td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.draws}</td>
            <td>${stats.losses}</td>
            <td>${stats.goalsFor}</td>
            <td>${stats.goalsAgainst}</td>
            <td class="${gdClass}">${gd > 0 ? '+' : ''}${gd}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update totals
    document.getElementById('opp-mgr-total-finals').textContent = totals.finals;
    document.getElementById('opp-mgr-total-finals-won').textContent = totals.finalsWon;
    document.getElementById('opp-mgr-total-finals-lost').textContent = totals.finalsLost;
    document.getElementById('opp-mgr-total-matches').textContent = totals.matches;
    document.getElementById('opp-mgr-total-wins').textContent = totals.wins;
    document.getElementById('opp-mgr-total-draws').textContent = totals.draws;
    document.getElementById('opp-mgr-total-losses').textContent = totals.losses;
    document.getElementById('opp-mgr-total-gf').textContent = totals.goalsFor;
    document.getElementById('opp-mgr-total-ga').textContent = totals.goalsAgainst;
    
    const totalGd = totals.goalsFor - totals.goalsAgainst;
    const totalGdElement = document.getElementById('opp-mgr-total-gd');
    totalGdElement.textContent = (totalGd > 0 ? '+' : '') + totalGd;
    totalGdElement.className = totalGd > 0 ? 'positive' : totalGd < 0 ? 'negative' : '';
    
    console.log('✅ Opponent Managers table populated with', managersArray.length, 'managers');
}

/**
 * Sort Ahly Managers table
 */
let ahlyManagersSortColumn = 'finals';
let ahlyManagersSortDirection = 'desc';

function sortAhlyManagersTable(column) {
    // Toggle sort direction if same column
    if (ahlyManagersSortColumn === column) {
        ahlyManagersSortDirection = ahlyManagersSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        ahlyManagersSortColumn = column;
        ahlyManagersSortDirection = 'desc';
    }
    
    const tbody = document.querySelector('#ahly-managers-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'manager':
                aVal = a.cells[0].textContent;
                bVal = b.cells[0].textContent;
                return ahlyManagersSortDirection === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            case 'finals':
                aVal = parseInt(a.cells[1].textContent) || 0;
                bVal = parseInt(b.cells[1].textContent) || 0;
                break;
            case 'finalsWon':
                aVal = parseInt(a.cells[2].textContent) || 0;
                bVal = parseInt(b.cells[2].textContent) || 0;
                break;
            case 'finalsLost':
                aVal = parseInt(a.cells[3].textContent) || 0;
                bVal = parseInt(b.cells[3].textContent) || 0;
                break;
            case 'matches':
                aVal = parseInt(a.cells[4].textContent) || 0;
                bVal = parseInt(b.cells[4].textContent) || 0;
                break;
            case 'wins':
                aVal = parseInt(a.cells[5].textContent) || 0;
                bVal = parseInt(b.cells[5].textContent) || 0;
                break;
            case 'draws':
                aVal = parseInt(a.cells[6].textContent) || 0;
                bVal = parseInt(b.cells[6].textContent) || 0;
                break;
            case 'losses':
                aVal = parseInt(a.cells[7].textContent) || 0;
                bVal = parseInt(b.cells[7].textContent) || 0;
                break;
            case 'goalsFor':
                aVal = parseInt(a.cells[8].textContent) || 0;
                bVal = parseInt(b.cells[8].textContent) || 0;
                break;
            case 'goalsAgainst':
                aVal = parseInt(a.cells[9].textContent) || 0;
                bVal = parseInt(b.cells[9].textContent) || 0;
                break;
            case 'goalDifference':
                aVal = parseInt(a.cells[10].textContent.replace('+', '')) || 0;
                bVal = parseInt(b.cells[10].textContent.replace('+', '')) || 0;
                break;
            default:
                return 0;
        }
        
        return ahlyManagersSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
    
    // Update sort icons
    document.querySelectorAll('#ahly-managers-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeHeader = document.querySelector(`#ahly-managers-table th[onclick="sortAhlyManagersTable('${column}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(ahlyManagersSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

/**
 * Sort Opponent Managers table
 */
let opponentManagersSortColumn = 'finals';
let opponentManagersSortDirection = 'desc';

function sortOpponentManagersTable(column) {
    // Toggle sort direction if same column
    if (opponentManagersSortColumn === column) {
        opponentManagersSortDirection = opponentManagersSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        opponentManagersSortColumn = column;
        opponentManagersSortDirection = 'desc';
    }
    
    const tbody = document.querySelector('#opponent-managers-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    rows.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'manager':
                aVal = a.cells[0].textContent;
                bVal = b.cells[0].textContent;
                return opponentManagersSortDirection === 'asc' 
                    ? aVal.localeCompare(bVal) 
                    : bVal.localeCompare(aVal);
            case 'finals':
                aVal = parseInt(a.cells[1].textContent) || 0;
                bVal = parseInt(b.cells[1].textContent) || 0;
                break;
            case 'finalsWon':
                aVal = parseInt(a.cells[2].textContent) || 0;
                bVal = parseInt(b.cells[2].textContent) || 0;
                break;
            case 'finalsLost':
                aVal = parseInt(a.cells[3].textContent) || 0;
                bVal = parseInt(b.cells[3].textContent) || 0;
                break;
            case 'matches':
                aVal = parseInt(a.cells[4].textContent) || 0;
                bVal = parseInt(b.cells[4].textContent) || 0;
                break;
            case 'wins':
                aVal = parseInt(a.cells[5].textContent) || 0;
                bVal = parseInt(b.cells[5].textContent) || 0;
                break;
            case 'draws':
                aVal = parseInt(a.cells[6].textContent) || 0;
                bVal = parseInt(b.cells[6].textContent) || 0;
                break;
            case 'losses':
                aVal = parseInt(a.cells[7].textContent) || 0;
                bVal = parseInt(b.cells[7].textContent) || 0;
                break;
            case 'goalsFor':
                aVal = parseInt(a.cells[8].textContent) || 0;
                bVal = parseInt(b.cells[8].textContent) || 0;
                break;
            case 'goalsAgainst':
                aVal = parseInt(a.cells[9].textContent) || 0;
                bVal = parseInt(b.cells[9].textContent) || 0;
                break;
            case 'goalDifference':
                aVal = parseInt(a.cells[10].textContent.replace('+', '')) || 0;
                bVal = parseInt(b.cells[10].textContent.replace('+', '')) || 0;
                break;
            default:
                return 0;
        }
        
        return opponentManagersSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
    
    // Update sort icons
    document.querySelectorAll('#opponent-managers-table th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const activeHeader = document.querySelector(`#opponent-managers-table th[onclick="sortOpponentManagersTable('${column}')"]`);
    if (activeHeader) {
        activeHeader.classList.add(opponentManagersSortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    }
}

// Export functions for global access
window.loadFinalsData = loadFinalsData;
window.applyFinalsFilters = applyFinalsFilters;
window.clearFinalsFilters = clearFinalsFilters;
window.refreshFinalsStats = refreshFinalsStats;
window.initializeAlAhlyFinalsStats = initializeAlAhlyFinalsStats;
window.switchMainTab = switchMainTab;
window.switchSubTab = switchSubTab;
window.switchNestedSubTab = switchNestedSubTab;
window.populateH2HTeamsTable = populateH2HTeamsTable;
window.renderH2HTeamsTable = renderH2HTeamsTable;
window.initializeH2HTeamsSearch = initializeH2HTeamsSearch;
window.filterH2HTeamsTable = filterH2HTeamsTable;
window.sortH2HTeamsTable = sortH2HTeamsTable;
window.populateAhlyManagersTable = populateAhlyManagersTable;
window.populateOpponentManagersTable = populateOpponentManagersTable;
window.sortAhlyManagersTable = sortAhlyManagersTable;
window.sortOpponentManagersTable = sortOpponentManagersTable;
