// Al Ahly VS Zamalek Statistics JavaScript

// Global Variables
let zamalekMatchesData = [];
let zamalekPlayerDetails = [];
let zamalekLineupAhly = [];
let zamalekLineupZamalek = [];
let zamalekPlayerDatabase = [];
let currentFilters = {};
let currentMainTab = 'overview';
let currentSubTab = 'overview-ahly';
let currentManagerFilter = 'all';
let currentManagerSearch = '';
let currentRefereeAhlySearch = '';
let currentRefereeZamalekSearch = '';
  let currentPlayerFilter = 'all';
  let currentPlayerSearch = '';
  let currentPlayerSort = { column: 'matches', direction: 'desc' };
  let currentH2HFilter = 'all';
  let currentH2HWithSearch = '';
  let currentH2HAgainstSearch = '';
  let currentH2HSort = { column: 'matches', direction: 'desc' };
  let currentByPlayer = '';
  let currentByPlayerFilter = 'all';
  
  // Initialize Al Ahly VS Zamalek Stats module
async function initializeZamalekStats() {
    console.log('🚀 Initializing Al Ahly VS Zamalek Statistics Module...');
    
    try {
        // Load all data
        await loadAllZamalekData();
        
        console.log(`📊 After loadAllZamalekData, zamalekMatchesData.length = ${zamalekMatchesData.length}`);
        
        if (zamalekMatchesData && zamalekMatchesData.length > 0) {
            console.log(`✅ Proceeding with ${zamalekMatchesData.length} matches`);
            
            // Populate filters
            populateFilters();
            
            // Initialize displays
            updateOverviewStats();
            populateMatchesTable();
            populateChampionshipsTable();
            populateSeasonsTable();
            populateManagersTable();
            populateRefereesAhlyTable();
            populateRefereesZamalekTable();
            populatePlayersTable();
            populateH2HTable();
            populateH2HPlayersList();
            populateByPlayerList();
            
            console.log('✅ Initialization complete');
        } else {
            console.error('❌ No data loaded, zamalekMatchesData:', zamalekMatchesData);
        }
    } catch (error) {
        console.error('❌ Error during initialization:', error);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeZamalekStats());
} else {
    initializeZamalekStats();
}

// Load all data from API with caching
async function loadAllZamalekData(forceRefresh = false) {
    try {
        console.log('📡 Loading Al Ahly VS Zamalek data from API...');
        
        // Always use direct fetch - backend has its own cache
        return await loadAllZamalekDataDirect(forceRefresh);
        
        // OLD CODE (using frontend cacheServices - disabled)
        /*
        // Check if cacheServices is available
        if (typeof window.cacheServices === 'undefined') {
            console.warn('⚠️ CacheServices not available, using direct fetch');
            return await loadAllZamalekDataDirect();
        }
        
        // Fetch matches data using cache
        const data = await window.cacheServices.getAhlyVsZamalekMatches();
        console.log('📦 Raw data received:', data);
        console.log('📦 Data type:', typeof data);
        console.log('📦 Is array?', Array.isArray(data));
        console.log('📦 Has matches?', data.hasOwnProperty('matches'));
        
        // Check if data has matches array
        if (data.matches && Array.isArray(data.matches)) {
            zamalekMatchesData = data.matches;
            console.log(`✅ Loaded ${zamalekMatchesData.length} matches from data.matches`);
            console.log('📋 First match sample:', zamalekMatchesData[0]);
        } else if (Array.isArray(data)) {
            zamalekMatchesData = data;
            console.log(`✅ Loaded ${zamalekMatchesData.length} matches (array format)`);
            console.log('📋 First match sample:', zamalekMatchesData[0]);
        } else {
            console.error('❌ Invalid data format:', data);
            zamalekMatchesData = [];
            return false;
        }
        
        // Fetch player details data using cache
        await loadPlayerDetails();
        
        // Fetch lineup data using cache
        await loadLineupData();
        
        // Fetch player database using cache
        await loadPlayerDatabase();
        
        // Double check the data is still there
        console.log(`🔍 Final check: zamalekMatchesData.length = ${zamalekMatchesData.length}`);
        
        return zamalekMatchesData.length > 0;
        */
    } catch (error) {
        console.error('❌ Error loading Ahly VS Zamalek data:', error);
        console.error('❌ Error stack:', error.stack);
        showError('No Data Available');
        zamalekMatchesData = [];
        return false;
    }
}

// Fallback: Load all data from API directly (without cache)
async function loadAllZamalekDataDirect(forceRefresh = false) {
    try {
        console.log('📡 Loading Al Ahly VS Zamalek data from API (direct)...');
        
        // Fetch matches data with optional force refresh
        const url = forceRefresh ? '/api/ahly-vs-zamalek/matches?force_refresh=true' : '/api/ahly-vs-zamalek/matches';
        const response = await fetch(url);
        console.log('📥 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Response error:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Check if data has matches array
        if (data.matches && Array.isArray(data.matches)) {
            zamalekMatchesData = data.matches;
            console.log(`✅ Loaded ${zamalekMatchesData.length} matches from data.matches`);
        } else if (Array.isArray(data)) {
            zamalekMatchesData = data;
            console.log(`✅ Loaded ${zamalekMatchesData.length} matches (array format)`);
        } else {
            console.error('❌ Invalid data format:', data);
            zamalekMatchesData = [];
            return false;
        }
        
        // Fetch player details data
        await loadPlayerDetails();
        
        // Fetch lineup data
        await loadLineupData();
        
        // Fetch player database
        await loadPlayerDatabase();
        
        return zamalekMatchesData.length > 0;
    } catch (error) {
        console.error('❌ Error loading Ahly VS Zamalek data:', error);
        zamalekMatchesData = [];
        return false;
    }
}

// Load player details from API (backend handles caching)
async function loadPlayerDetails() {
    try {
        console.log('📡 Loading player details from API...');
        
        const response = await fetch('/api/ahly-vs-zamalek/player-details');
        
        if (!response.ok) {
            console.warn('⚠️ Player details not available');
            zamalekPlayerDetails = [];
            return false;
        }
        
        const data = await response.json();
        
        if (data.playerDetails && Array.isArray(data.playerDetails)) {
            zamalekPlayerDetails = data.playerDetails;
            console.log(`✅ Loaded ${zamalekPlayerDetails.length} player details`);
        } else {
            zamalekPlayerDetails = [];
        }
        
        return zamalekPlayerDetails.length > 0;
    } catch (error) {
        console.error('❌ Error loading player details:', error);
        zamalekPlayerDetails = [];
        return false;
    }
}

// Load lineup data from API (backend handles caching)
async function loadLineupData() {
    try {
        console.log('📡 Loading lineup data from API...');
        
        // Load Ahly lineup
        const ahlyResponse = await fetch('/api/ahly-vs-zamalek/lineupahly');
        if (ahlyResponse.ok) {
            const ahlyData = await ahlyResponse.json();
            if (ahlyData.lineupAhly && Array.isArray(ahlyData.lineupAhly)) {
                zamalekLineupAhly = ahlyData.lineupAhly;
                console.log(`✅ Loaded ${zamalekLineupAhly.length} Ahly lineup records`);
            }
        } else {
            console.warn('⚠️ Ahly lineup not available');
            zamalekLineupAhly = [];
        }
        
        // Load Zamalek lineup
        const zamalekResponse = await fetch('/api/ahly-vs-zamalek/lineupzamalek');
        if (zamalekResponse.ok) {
            const zamalekData = await zamalekResponse.json();
            if (zamalekData.lineupZamalek && Array.isArray(zamalekData.lineupZamalek)) {
                zamalekLineupZamalek = zamalekData.lineupZamalek;
                console.log(`✅ Loaded ${zamalekLineupZamalek.length} Zamalek lineup records`);
            }
        } else {
            console.warn('⚠️ Zamalek lineup not available');
            zamalekLineupZamalek = [];
        }
        
        return true;
    } catch (error) {
        console.error('❌ Error loading lineup data:', error);
        zamalekLineupAhly = [];
        zamalekLineupZamalek = [];
        return false;
    }
}

// Load player database from API (backend handles caching)
async function loadPlayerDatabase() {
    try {
        console.log('📡 Loading player database from API...');
        
        const response = await fetch('/api/ahly-vs-zamalek/playerdatabase');
        
        if (!response.ok) {
            console.warn('⚠️ Player database not available');
            zamalekPlayerDatabase = [];
            return false;
        }
        
        const data = await response.json();
        
        if (data.players && Array.isArray(data.players)) {
            zamalekPlayerDatabase = data.players;
            console.log(`✅ Loaded ${zamalekPlayerDatabase.length} players from database`);
        } else {
            zamalekPlayerDatabase = [];
        }
        
        return zamalekPlayerDatabase.length > 0;
    } catch (error) {
        console.error('❌ Error loading player database:', error);
        zamalekPlayerDatabase = [];
        return false;
    }
}

// Populate filter dropdowns
function populateFilters() {
    console.log('🔧 Populating filters with', zamalekMatchesData?.length, 'matches');
    if (!zamalekMatchesData || zamalekMatchesData.length === 0) {
        console.warn('⚠️ No data available for filters');
        return;
    }
    
    const filters = {
        'match-id-filter': new Set(),
        'champion-system-filter': new Set(),
        'year-filter': new Set(),
        'season-filter': new Set(),
        'ahly-manager-filter': new Set(),
        'zamalek-manager-filter': new Set(),
        'referee-filter': new Set(),
        'champion-filter': new Set(),
        'round-filter': new Set(),
        'han-filter': new Set(),
        'stadium-filter': new Set(),
        'ahly-filter': new Set(),
        'gf-filter': new Set(),
        'ga-filter': new Set(),
        'et-filter': new Set(),
        'pen-filter': new Set(),
        'zamalek-filter': new Set(),
        'wdl-filter': new Set(),
        'clean-sheet-filter': new Set(),
        'finals-filter': new Set(),
        'q-filter': new Set()
    };
    
    zamalekMatchesData.forEach(match => {
        filters['match-id-filter'].add(match.MATCH_ID || '');
        filters['champion-system-filter'].add(match['CHAMPION SYSTEM'] || '');
        filters['year-filter'].add(match.YEAR || '');
        filters['season-filter'].add(match.SEASON || '');
        filters['ahly-manager-filter'].add(match['AHLY MANAGER'] || '');
        filters['zamalek-manager-filter'].add(match['ZAMALEK MANAGER'] || '');
        filters['referee-filter'].add(match.REFEREE || '');
        filters['champion-filter'].add(match.CHAMPION || '');
        filters['round-filter'].add(match.ROUND || '');
        filters['han-filter'].add(match['H-A-N'] || '');
        filters['stadium-filter'].add(match.STADIUM || '');
        filters['ahly-filter'].add(match.AHLY || '');
        filters['gf-filter'].add(match.GF || '');
        filters['ga-filter'].add(match.GA || '');
        filters['et-filter'].add(match.ET || '');
        filters['pen-filter'].add(match.PEN || '');
        filters['zamalek-filter'].add(match.ZAMALEK || '');
        filters['wdl-filter'].add(match['W-D-L'] || '');
        filters['clean-sheet-filter'].add(match['CLEAN SHEET'] || '');
        filters['finals-filter'].add(match.FINALS || '');
        filters['q-filter'].add(match.Q || '');
    });
    
    // Populate each dropdown
    Object.keys(filters).forEach(filterId => {
        const select = document.getElementById(filterId);
        if (select) {
            const values = Array.from(filters[filterId]).filter(v => v !== '').sort();
            select.innerHTML = '<option value="">All</option>';
            values.forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = value;
                select.appendChild(option);
            });
        }
    });
    
    // Initialize searchable dropdowns after populating
    initializeSearchableFilters();
}

// Apply filters
function applyZamalekFilters() {
    currentFilters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || '',
        year: document.getElementById('year-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        ahlyManager: document.getElementById('ahly-manager-filter')?.value || '',
        zamalekManager: document.getElementById('zamalek-manager-filter')?.value || '',
        referee: document.getElementById('referee-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        han: document.getElementById('han-filter')?.value || '',
        stadium: document.getElementById('stadium-filter')?.value || '',
        ahly: document.getElementById('ahly-filter')?.value || '',
        gf: document.getElementById('gf-filter')?.value || '',
        ga: document.getElementById('ga-filter')?.value || '',
        et: document.getElementById('et-filter')?.value || '',
        pen: document.getElementById('pen-filter')?.value || '',
        zamalek: document.getElementById('zamalek-filter')?.value || '',
        wdl: document.getElementById('wdl-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        finals: document.getElementById('finals-filter')?.value || '',
        q: document.getElementById('q-filter')?.value || ''
    };
    
    console.log('Filters applied:', currentFilters);
    
    // Update all displays
    updateOverviewStats();
    calculateHowWinStats(); // Update HOW WIN tab
    populateMatchesTable();
    populateChampionshipsTable();
    populateSeasonsTable();
    populateManagersTable();
    populateRefereesAhlyTable();
    populateRefereesZamalekTable();
    populatePlayersTable();
    populateH2HTable();
    
    // Update BY Players if a player is selected
    if (currentByPlayer) {
        updateByPlayerStats();
        populateByPlayerMatches();
        populateByPlayerChampionships();
        populateByPlayerSeasons();
    }
}

// Clear filters
function clearZamalekFilters() {
    document.querySelectorAll('.zamalek-filter-control').forEach(select => {
        select.value = '';
        
        // Clear searchable input as well
        const container = select.closest('.searchable-select-container');
        if (container) {
            const input = container.querySelector('input[type="text"]');
            if (input) {
                input.value = '';
            }
        }
    });
    
    currentFilters = {};
    applyZamalekFilters();
}

// Refresh data
async function refreshZamalekStats() {
    console.log('🔄 Force refreshing Ahly VS Zamalek data...');
    
    // Show loading state
    showLoadingState(true);
    
    try {
        // Reload data with force refresh
        await loadAllZamalekData(true);
        
        // Repopulate filters
        populateFilters();
        
        // Update displays
        updateOverviewStats();
        populateMatchesTable();
        populateChampionshipsTable();
        populateSeasonsTable();
        populateManagersTable();
        populateRefereesAhlyTable();
        populateRefereesZamalekTable();
        populatePlayersTable();
        populateH2HTable();
        populateH2HPlayersList();
        
        console.log('✅ Data refreshed successfully');
    } catch (error) {
        console.error('❌ Error refreshing data:', error);
    } finally {
        // Hide loading state
        showLoadingState(false);
    }
}

// Show/hide loading state
function showLoadingState(show) {
    const refreshBtn = document.querySelector('.zamalek-refresh-btn');
    if (refreshBtn) {
        if (show) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px; animation: spin 1s linear infinite;">
                    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Loading...
            `;
        } else {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                Sync Data
            `;
        }
    }
}

// Filter matches based on current filters
function getFilteredMatches() {
    console.log('🔍 getFilteredMatches called, zamalekMatchesData:', zamalekMatchesData);
    console.log('🔍 zamalekMatchesData length:', zamalekMatchesData?.length);
    console.log('🔍 currentFilters:', currentFilters);
    
    if (!zamalekMatchesData || zamalekMatchesData.length === 0) {
        console.warn('⚠️ No data in zamalekMatchesData');
        return [];
    }
    
    return zamalekMatchesData.filter(match => {
        if (currentFilters.matchId && match.MATCH_ID !== currentFilters.matchId) return false;
        if (currentFilters.championSystem && match['CHAMPION SYSTEM'] !== currentFilters.championSystem) return false;
        
        // Date range filter (From - To)
        if (currentFilters.dateFrom || currentFilters.dateTo) {
            const matchDate = match.DATE; // Already in YYYY-MM-DD format
            
            if (matchDate) {
                // Direct comparison (both are in YYYY-MM-DD format)
                if (currentFilters.dateFrom && matchDate < currentFilters.dateFrom) return false;
                if (currentFilters.dateTo && matchDate > currentFilters.dateTo) return false;
            }
        }
        
        if (currentFilters.year && match.YEAR !== currentFilters.year) return false;
        if (currentFilters.season && match.SEASON !== currentFilters.season) return false;
        if (currentFilters.ahlyManager && match['AHLY MANAGER'] !== currentFilters.ahlyManager) return false;
        if (currentFilters.zamalekManager && match['ZAMALEK MANAGER'] !== currentFilters.zamalekManager) return false;
        if (currentFilters.referee && match.REFEREE !== currentFilters.referee) return false;
        if (currentFilters.champion && match.CHAMPION !== currentFilters.champion) return false;
        if (currentFilters.round && match.ROUND !== currentFilters.round) return false;
        if (currentFilters.han && match['H-A-N'] !== currentFilters.han) return false;
        if (currentFilters.stadium && match.STADIUM !== currentFilters.stadium) return false;
        if (currentFilters.ahly && match.AHLY !== currentFilters.ahly) return false;
        if (currentFilters.gf && match.GF !== currentFilters.gf) return false;
        if (currentFilters.ga && match.GA !== currentFilters.ga) return false;
        if (currentFilters.et && match.ET !== currentFilters.et) return false;
        if (currentFilters.pen && match.PEN !== currentFilters.pen) return false;
        if (currentFilters.zamalek && match.ZAMALEK !== currentFilters.zamalek) return false;
        if (currentFilters.wdl && match['W-D-L'] !== currentFilters.wdl) return false;
        if (currentFilters.cleanSheet && match['CLEAN SHEET'] !== currentFilters.cleanSheet) return false;
        if (currentFilters.finals && match.FINALS !== currentFilters.finals) return false;
        if (currentFilters.q && match.Q !== currentFilters.q) return false;
        
        return true;
    });
}

// Get filtered player details based on filtered matches
function getFilteredPlayerDetails() {
    const filteredMatches = getFilteredMatches();
    const matchIds = filteredMatches.map(m => String(m.MATCH_ID));
    
    return zamalekPlayerDetails.filter(detail => {
        return matchIds.includes(String(detail.MATCH_ID));
    });
}

// Get filtered lineup data for Ahly based on filtered matches
function getFilteredLineupAhly() {
    const filteredMatches = getFilteredMatches();
    const matchIds = filteredMatches.map(m => String(m.MATCH_ID));
    
    return zamalekLineupAhly.filter(lineup => {
        return matchIds.includes(String(lineup.MATCH_ID));
    });
}

// Get filtered lineup data for Zamalek based on filtered matches
function getFilteredLineupZamalek() {
    const filteredMatches = getFilteredMatches();
    const matchIds = filteredMatches.map(m => String(m.MATCH_ID));
    
    return zamalekLineupZamalek.filter(lineup => {
        return matchIds.includes(String(lineup.MATCH_ID));
    });
}

// Calculate penalty goals from player details
function calculatePenaltyGoals(matches, isZamalek = false) {
    if (!zamalekPlayerDetails || zamalekPlayerDetails.length === 0) {
        return 0;
    }
    
    // Get match IDs from filtered matches
    const matchIds = matches.map(m => m.MATCH_ID);
    
    // Filter player details for these matches
    const relevantDetails = zamalekPlayerDetails.filter(detail => {
        return matchIds.includes(detail.MATCH_ID) && detail.TYPE === 'PENGOAL';
    });
    
    // If we're calculating for Zamalek, we need goals against Ahly
    // Otherwise, we need goals by Ahly (which means team should be AHLY or not ZAMALEK)
    let count = 0;
    
    if (isZamalek) {
        // Count PENGOAL for Zamalek team
        count = relevantDetails.filter(detail => {
            const team = detail.TEAM || '';
            return team.toUpperCase().includes('ZAMALEK');
        }).length;
    } else {
        // Count PENGOAL for Ahly team
        count = relevantDetails.filter(detail => {
            const team = detail.TEAM || '';
            return team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        }).length;
    }
    
    return count;
}

// Calculate penalty misses from player details (GA column)
function calculatePenaltyMisses(matches, isZamalek = false) {
    if (!zamalekPlayerDetails || zamalekPlayerDetails.length === 0) {
        return 0;
    }
    
    // Get match IDs from filtered matches
    const matchIds = matches.map(m => m.MATCH_ID);
    
    // Filter player details for these matches where GA = 'PENMISSED'
    const relevantDetails = zamalekPlayerDetails.filter(detail => {
        return matchIds.includes(detail.MATCH_ID) && detail.GA === 'PENMISSED';
    });
    
    let count = 0;
    
    if (isZamalek) {
        // Count PENMISSED for Zamalek team
        count = relevantDetails.filter(detail => {
            const team = detail.TEAM || '';
            return team.toUpperCase().includes('ZAMALEK');
        }).length;
    } else {
        // Count PENMISSED for Ahly team
        count = relevantDetails.filter(detail => {
            const team = detail.TEAM || '';
            return team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        }).length;
    }
    
    return count;
}

// Calculate longest streak for a result type
function calculateLongestStreak(matches, resultType) {
    let maxStreak = 0;
    let currentStreak = 0;
    let maxStreakStart = null;
    let maxStreakEnd = null;
    let currentStreakStart = null;
    
    matches.forEach((match, index) => {
        const result = match['W-D-L'];
        let isMatch = false;
        
        if (resultType === 'W' && result === 'W') {
            isMatch = true;
        } else if (resultType === 'D' && (result === 'D' || result === 'D.')) {
            isMatch = true;
        } else if (resultType === 'L' && result === 'L') {
            isMatch = true;
        }
        
        if (isMatch) {
            if (currentStreak === 0) {
                currentStreakStart = match.DATE;
            }
            currentStreak++;
            
            if (currentStreak > maxStreak) {
                maxStreak = currentStreak;
                maxStreakStart = currentStreakStart;
                maxStreakEnd = match.DATE;
            }
        } else {
            currentStreak = 0;
            currentStreakStart = null;
        }
    });
    
    return {
        count: maxStreak,
        startDate: maxStreakStart,
        endDate: maxStreakEnd
    };
}

// Update overview statistics
function updateOverviewStats() {
    const matches = getFilteredMatches();
    console.log('📊 Updating overview stats with', matches.length, 'filtered matches');
    
    // Al Ahly Stats
    const ahlyWins = matches.filter(m => m['W-D-L'] === 'W').length;
    const ahlyDraws = matches.filter(m => m['W-D-L'] === 'D' || m['W-D-L'] === 'D.').length;
    const ahlyLosses = matches.filter(m => m['W-D-L'] === 'L').length;
    const ahlyGoalsFor = matches.reduce((sum, m) => sum + (parseInt(m.GF) || 0), 0);
    const ahlyGoalsAgainst = matches.reduce((sum, m) => sum + (parseInt(m.GA) || 0), 0);
    const ahlyCleanSheetsFor = matches.filter(m => (m.GA === '0' || m.GA === 0)).length;
    const ahlyCleanSheetsAgainst = matches.filter(m => (m.GF === '0' || m.GF === 0)).length;
    const ahlyWinRate = matches.length > 0 ? ((ahlyWins / matches.length) * 100).toFixed(1) : 0;
    
    // Calculate streaks
    const ahlyWinStreakData = calculateLongestStreak(matches, 'W');
    const ahlyDrawStreakData = calculateLongestStreak(matches, 'D');
    const ahlyLossStreakData = calculateLongestStreak(matches, 'L');
    
    // Calculate penalty goals and misses
    const ahlyPenaltyGoals = calculatePenaltyGoals(matches);
    const zamalekPenaltyGoals = calculatePenaltyGoals(matches, true);
    const ahlyPenaltyMisses = calculatePenaltyMisses(matches);
    const zamalekPenaltyMisses = calculatePenaltyMisses(matches, true);
    
    // Update Al Ahly overview
    document.getElementById('ahly-total-matches').textContent = matches.length;
    document.getElementById('ahly-wins').textContent = ahlyWins;
    document.getElementById('ahly-draws').textContent = ahlyDraws;
    document.getElementById('ahly-losses').textContent = ahlyLosses;
    document.getElementById('ahly-win-rate').textContent = ahlyWinRate + '%';
    document.getElementById('ahly-goals-for').textContent = ahlyGoalsFor;
    document.getElementById('ahly-goals-against').textContent = ahlyGoalsAgainst;
    document.getElementById('ahly-clean-sheets-for').textContent = ahlyCleanSheetsFor;
    document.getElementById('ahly-clean-sheets-against').textContent = ahlyCleanSheetsAgainst;
    document.getElementById('ahly-win-streak').textContent = ahlyWinStreakData.count;
    document.getElementById('ahly-draw-streak').textContent = ahlyDrawStreakData.count;
    document.getElementById('ahly-loss-streak').textContent = ahlyLossStreakData.count;
    if (document.getElementById('ahly-penalty-goals')) {
        document.getElementById('ahly-penalty-goals').textContent = ahlyPenaltyGoals;
    }
    if (document.getElementById('ahly-penalty-misses')) {
        document.getElementById('ahly-penalty-misses').textContent = ahlyPenaltyMisses;
    }
    if (document.getElementById('zamalek-penalty-goals-opponent')) {
        document.getElementById('zamalek-penalty-goals-opponent').textContent = zamalekPenaltyGoals;
    }
    if (document.getElementById('zamalek-penalty-misses-opponent')) {
        document.getElementById('zamalek-penalty-misses-opponent').textContent = zamalekPenaltyMisses;
    }
    
    // Update streak periods
    const ahlyWinPeriod = ahlyWinStreakData.count > 0 ? `${ahlyWinStreakData.startDate} - ${ahlyWinStreakData.endDate}` : '-';
    const ahlyDrawPeriod = ahlyDrawStreakData.count > 0 ? `${ahlyDrawStreakData.startDate} - ${ahlyDrawStreakData.endDate}` : '-';
    const ahlyLossPeriod = ahlyLossStreakData.count > 0 ? `${ahlyLossStreakData.startDate} - ${ahlyLossStreakData.endDate}` : '-';
    
    document.getElementById('ahly-win-streak-period').textContent = ahlyWinPeriod;
    document.getElementById('ahly-draw-streak-period').textContent = ahlyDrawPeriod;
    document.getElementById('ahly-loss-streak-period').textContent = ahlyLossPeriod;
    
    // Zamalek Stats (inverse of Ahly)
    const zamalekWins = ahlyLosses;
    const zamalekDraws = ahlyDraws;
    const zamalekLosses = ahlyWins;
    const zamalekGoalsFor = ahlyGoalsAgainst;
    const zamalekGoalsAgainst = ahlyGoalsFor;
    const zamalekCleanSheetsFor = ahlyCleanSheetsAgainst;  // Zamalek clean sheet when Ahly scored 0
    const zamalekCleanSheetsAgainst = ahlyCleanSheetsFor;  // Zamalek conceded 0 when Ahly kept clean sheet
    const zamalekWinRate = matches.length > 0 ? ((zamalekWins / matches.length) * 100).toFixed(1) : 0;
    
    // Zamalek streaks (inverse of Ahly)
    const zamalekWinStreakData = ahlyLossStreakData;  // Zamalek wins when Ahly loses
    const zamalekDrawStreakData = ahlyDrawStreakData;  // Same draw streak
    const zamalekLossStreakData = ahlyWinStreakData;  // Zamalek loses when Ahly wins
    
    // Update Zamalek overview
    document.getElementById('zamalek-total-matches').textContent = matches.length;
    document.getElementById('zamalek-wins').textContent = zamalekWins;
    document.getElementById('zamalek-draws').textContent = zamalekDraws;
    document.getElementById('zamalek-losses').textContent = zamalekLosses;
    document.getElementById('zamalek-win-rate').textContent = zamalekWinRate + '%';
    document.getElementById('zamalek-goals-for').textContent = zamalekGoalsFor;
    document.getElementById('zamalek-goals-against').textContent = zamalekGoalsAgainst;
    document.getElementById('zamalek-clean-sheets-for').textContent = zamalekCleanSheetsFor;
    document.getElementById('zamalek-clean-sheets-against').textContent = zamalekCleanSheetsAgainst;
    document.getElementById('zamalek-win-streak').textContent = zamalekWinStreakData.count;
    document.getElementById('zamalek-draw-streak').textContent = zamalekDrawStreakData.count;
    document.getElementById('zamalek-loss-streak').textContent = zamalekLossStreakData.count;
    if (document.getElementById('zamalek-penalty-goals')) {
        document.getElementById('zamalek-penalty-goals').textContent = zamalekPenaltyGoals;
    }
    if (document.getElementById('zamalek-penalty-misses')) {
        document.getElementById('zamalek-penalty-misses').textContent = zamalekPenaltyMisses;
    }
    if (document.getElementById('ahly-penalty-goals-opponent')) {
        document.getElementById('ahly-penalty-goals-opponent').textContent = ahlyPenaltyGoals;
    }
    if (document.getElementById('ahly-penalty-misses-opponent')) {
        document.getElementById('ahly-penalty-misses-opponent').textContent = ahlyPenaltyMisses;
    }
    
    // Update streak periods
    const zamalekWinPeriod = zamalekWinStreakData.count > 0 ? `${zamalekWinStreakData.startDate} - ${zamalekWinStreakData.endDate}` : '-';
    const zamalekDrawPeriod = zamalekDrawStreakData.count > 0 ? `${zamalekDrawStreakData.startDate} - ${zamalekDrawStreakData.endDate}` : '-';
    const zamalekLossPeriod = zamalekLossStreakData.count > 0 ? `${zamalekLossStreakData.startDate} - ${zamalekLossStreakData.endDate}` : '-';
    
    document.getElementById('zamalek-win-streak-period').textContent = zamalekWinPeriod;
    document.getElementById('zamalek-draw-streak-period').textContent = zamalekDrawPeriod;
    document.getElementById('zamalek-loss-streak-period').textContent = zamalekLossPeriod;
}

// Populate matches table
function populateMatchesTable() {
    const matches = getFilteredMatches();
    console.log('📋 Populating matches table with', matches.length, 'matches');
    const tbody = document.querySelector('#zamalek-matches-table tbody');
    
    if (!tbody) {
        console.error('❌ Table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem; color: #6c757d;">No matches found</td></tr>';
        return;
    }
    
    // Sort matches by date (newest first)
    const sortedMatches = [...matches].sort((a, b) => {
        const dateA = new Date(a.DATE);
        const dateB = new Date(b.DATE);
        return dateB - dateA; // Descending order (newest first)
    });
    
    sortedMatches.forEach(match => {
        const row = document.createElement('tr');
        
        const resultBadge = getResultBadge(match['W-D-L']);
        
        row.innerHTML = `
            <td><strong>${match.MATCH_ID || ''}</strong></td>
            <td>${match.DATE || ''}</td>
            <td>${match.SEASON || ''}</td>
            <td>${match.ROUND || ''}</td>
            <td>${match['AHLY MANAGER'] || ''}</td>
            <td>${match['ZAMALEK MANAGER'] || ''}</td>
            <td><strong>${match.GF || 0}</strong></td>
            <td><strong>${match.GA || 0}</strong></td>
            <td>${resultBadge}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Get result badge HTML
function getResultBadge(result) {
    if (result === 'W') return '<span class="badge badge-success">Win</span>';
    if (result === 'L') return '<span class="badge badge-danger">Loss</span>';
    if (result === 'D' || result === 'D.') return '<span class="badge badge-warning">Draw</span>';
    return result || '';
}

// Populate championships table
function populateChampionshipsTable() {
    const matches = getFilteredMatches();
    console.log('🏆 Populating championships table with', matches.length, 'matches');
    const tbody = document.querySelector('#zamalek-championships-table tbody');
    
    if (!tbody) {
        console.error('❌ Championships table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #6c757d;">No matches found</td></tr>';
        updateTotalsChampionships([], true);
        return;
    }
    
    // Calculate statistics by championship
    const championshipsMap = new Map();
    
    matches.forEach(match => {
        const championship = match['CHAMPION'] || 'Unknown';
        
        if (!championshipsMap.has(championship)) {
            championshipsMap.set(championship, {
                championship: championship,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                csf: 0,
                csa: 0
            });
        }
        
        const stats = championshipsMap.get(championship);
        stats.matches++;
        
        const result = match['W-D-L'];
        if (result === 'W') stats.wins++;
        else if (result === 'D' || result === 'D.') stats.draws++;
        else if (result === 'L') stats.losses++;
        
        const gf = parseInt(match.GF) || 0;
        const ga = parseInt(match.GA) || 0;
        stats.gf += gf;
        stats.ga += ga;
        
        if (ga === 0) stats.csf++; // Clean Sheet For (opponent didn't score)
        if (gf === 0) stats.csa++; // Clean Sheet Against (we didn't score)
    });
    
    // Convert to array and sort by matches (descending)
    const championshipsArray = Array.from(championshipsMap.values());
    championshipsArray.sort((a, b) => b.matches - a.matches);
    
    // Populate table
    championshipsArray.forEach(stat => {
        const row = document.createElement('tr');
        const gd = stat.gf - stat.ga;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        row.innerHTML = `
            <td>${stat.championship}</td>
            <td>${stat.matches}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
            <td>${stat.gf}</td>
            <td>${stat.ga}</td>
            <td class="${gdClass}"><strong>${gd > 0 ? '+' : ''}${gd}</strong></td>
            <td>${stat.csf}</td>
            <td>${stat.csa}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateTotalsChampionships(championshipsArray);
}

// Update totals row for championships table
function updateTotalsChampionships(championships, clear = false) {
    if (clear) {
        document.getElementById('total-champ-p').textContent = '0';
        document.getElementById('total-champ-w').textContent = '0';
        document.getElementById('total-champ-d').textContent = '0';
        document.getElementById('total-champ-l').textContent = '0';
        document.getElementById('total-champ-gf').textContent = '0';
        document.getElementById('total-champ-ga').textContent = '0';
        document.getElementById('total-champ-gd').textContent = '0';
        document.getElementById('total-champ-csf').textContent = '0';
        document.getElementById('total-champ-csa').textContent = '0';
        return;
    }
    
    const totals = championships.reduce((acc, champ) => {
        acc.matches += champ.matches;
        acc.wins += champ.wins;
        acc.draws += champ.draws;
        acc.losses += champ.losses;
        acc.gf += champ.gf;
        acc.ga += champ.ga;
        acc.csf += champ.csf;
        acc.csa += champ.csa;
        return acc;
    }, { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, csf: 0, csa: 0 });
    
    const gd = totals.gf - totals.ga;
    
    document.getElementById('total-champ-p').textContent = totals.matches;
    document.getElementById('total-champ-w').textContent = totals.wins;
    document.getElementById('total-champ-d').textContent = totals.draws;
    document.getElementById('total-champ-l').textContent = totals.losses;
    document.getElementById('total-champ-gf').textContent = totals.gf;
    document.getElementById('total-champ-ga').textContent = totals.ga;
    document.getElementById('total-champ-gd').textContent = (gd > 0 ? '+' : '') + gd;
    document.getElementById('total-champ-csf').textContent = totals.csf;
    document.getElementById('total-champ-csa').textContent = totals.csa;
}

// Populate seasons table
function populateSeasonsTable() {
    const matches = getFilteredMatches();
    console.log('📅 Populating seasons table with', matches.length, 'matches');
    const tbody = document.querySelector('#zamalek-seasons-table tbody');
    
    if (!tbody) {
        console.error('❌ Seasons table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #6c757d;">No matches found</td></tr>';
        updateTotalsSeasons([], true);
        return;
    }
    
    // Calculate statistics by season
    const seasonsMap = new Map();
    
    matches.forEach(match => {
        const season = match['SEASON'] || 'Unknown';
        
        if (!seasonsMap.has(season)) {
            seasonsMap.set(season, {
                season: season,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                csf: 0,
                csa: 0
            });
        }
        
        const stats = seasonsMap.get(season);
        stats.matches++;
        
        const result = match['W-D-L'];
        if (result === 'W') stats.wins++;
        else if (result === 'D' || result === 'D.') stats.draws++;
        else if (result === 'L') stats.losses++;
        
        const gf = parseInt(match.GF) || 0;
        const ga = parseInt(match.GA) || 0;
        stats.gf += gf;
        stats.ga += ga;
        
        if (ga === 0) stats.csf++; // Clean Sheet For (opponent didn't score)
        if (gf === 0) stats.csa++; // Clean Sheet Against (we didn't score)
    });
    
    // Convert to array and sort by season (newest first)
    const seasonsArray = Array.from(seasonsMap.values());
    seasonsArray.sort(sortSeasons);
    
    // Populate table
    seasonsArray.forEach(stat => {
        const row = document.createElement('tr');
        const gd = stat.gf - stat.ga;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        row.innerHTML = `
            <td>${stat.season}</td>
            <td>${stat.matches}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
            <td>${stat.gf}</td>
            <td>${stat.ga}</td>
            <td class="${gdClass}"><strong>${gd > 0 ? '+' : ''}${gd}</strong></td>
            <td>${stat.csf}</td>
            <td>${stat.csa}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateTotalsSeasons(seasonsArray);
}

// Update totals row for seasons table
function updateTotalsSeasons(seasons, clear = false) {
    if (clear) {
        document.getElementById('total-season-p').textContent = '0';
        document.getElementById('total-season-w').textContent = '0';
        document.getElementById('total-season-d').textContent = '0';
        document.getElementById('total-season-l').textContent = '0';
        document.getElementById('total-season-gf').textContent = '0';
        document.getElementById('total-season-ga').textContent = '0';
        document.getElementById('total-season-gd').textContent = '0';
        document.getElementById('total-season-csf').textContent = '0';
        document.getElementById('total-season-csa').textContent = '0';
        return;
    }
    
    const totals = seasons.reduce((acc, season) => {
        acc.matches += season.matches;
        acc.wins += season.wins;
        acc.draws += season.draws;
        acc.losses += season.losses;
        acc.gf += season.gf;
        acc.ga += season.ga;
        acc.csf += season.csf;
        acc.csa += season.csa;
        return acc;
    }, { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, csf: 0, csa: 0 });
    
    const gd = totals.gf - totals.ga;
    
    document.getElementById('total-season-p').textContent = totals.matches;
    document.getElementById('total-season-w').textContent = totals.wins;
    document.getElementById('total-season-d').textContent = totals.draws;
    document.getElementById('total-season-l').textContent = totals.losses;
    document.getElementById('total-season-gf').textContent = totals.gf;
    document.getElementById('total-season-ga').textContent = totals.ga;
    document.getElementById('total-season-gd').textContent = (gd > 0 ? '+' : '') + gd;
    document.getElementById('total-season-csf').textContent = totals.csf;
    document.getElementById('total-season-csa').textContent = totals.csa;
}

// Populate managers table
function populateManagersTable() {
    const tbody = document.querySelector('#zamalek-managers-table tbody');
    
    if (!tbody) {
        console.error('❌ Managers table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    let managersStats = calculateManagersStats();
    
    if (managersStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem; color: #6c757d;">No data found</td></tr>';
        updateTotalsRow([], true);
        return;
    }
    
    // Apply search filter
    if (currentManagerSearch) {
        const searchLower = currentManagerSearch.toLowerCase();
        managersStats = managersStats.filter(stat => 
            stat.manager.toLowerCase().includes(searchLower)
        );
    }
    
    // Sort by matches played (descending)
    managersStats.sort((a, b) => b.matches - a.matches);
    
    managersStats.forEach(stat => {
        const row = document.createElement('tr');
        const gd = stat.gf - stat.ga;
        const gdClass = gd > 0 ? 'positive' : gd < 0 ? 'negative' : '';
        
        row.innerHTML = `
            <td>${stat.manager}</td>
            <td>${stat.matches}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
            <td>${stat.gf}</td>
            <td>${stat.ga}</td>
            <td class="${gdClass}"><strong>${gd > 0 ? '+' : ''}${gd}</strong></td>
            <td>${stat.csf}</td>
            <td>${stat.csa}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update totals row
    updateTotalsRow(managersStats, false);
}

// Update totals row
function updateTotalsRow(stats, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-matches').textContent = '0';
        document.getElementById('total-wins').textContent = '0';
        document.getElementById('total-draws').textContent = '0';
        document.getElementById('total-losses').textContent = '0';
        document.getElementById('total-gf').textContent = '0';
        document.getElementById('total-ga').textContent = '0';
        document.getElementById('total-gd').textContent = '0';
        document.getElementById('total-csf').textContent = '0';
        document.getElementById('total-csa').textContent = '0';
        return;
    }
    
    const totals = stats.reduce((acc, stat) => {
        acc.matches += stat.matches;
        acc.wins += stat.wins;
        acc.draws += stat.draws;
        acc.losses += stat.losses;
        acc.gf += stat.gf;
        acc.ga += stat.ga;
        acc.csf += stat.csf;
        acc.csa += stat.csa;
        return acc;
    }, { matches: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, csf: 0, csa: 0 });
    
    const totalGd = totals.gf - totals.ga;
    
    document.getElementById('total-matches').textContent = totals.matches;
    document.getElementById('total-wins').textContent = totals.wins;
    document.getElementById('total-draws').textContent = totals.draws;
    document.getElementById('total-losses').textContent = totals.losses;
    document.getElementById('total-gf').textContent = totals.gf;
    document.getElementById('total-ga').textContent = totals.ga;
    document.getElementById('total-gd').textContent = totalGd > 0 ? '+' + totalGd : totalGd;
    document.getElementById('total-csf').textContent = totals.csf;
    document.getElementById('total-csa').textContent = totals.csa;
}

// Calculate managers statistics
function calculateManagersStats() {
    const matches = getFilteredMatches();
    const managersMap = new Map();
    
    matches.forEach(match => {
        const ahlyManager = match['AHLY MANAGER'];
        const zamalekManager = match['ZAMALEK MANAGER'];
        const result = match['W-D-L'];
        const gf = parseInt(match.GF) || 0;
        const ga = parseInt(match.GA) || 0;
        
        // Process Ahly manager
        if (ahlyManager && (currentManagerFilter === 'all' || currentManagerFilter === 'ahly')) {
            if (!managersMap.has(ahlyManager)) {
                managersMap.set(ahlyManager, {
                    manager: ahlyManager,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    gf: 0,
                    ga: 0,
                    csf: 0,
                    csa: 0
                });
            }
            
            const stats = managersMap.get(ahlyManager);
            stats.matches++;
            stats.gf += gf;
            stats.ga += ga;
            
            if (result === 'W') stats.wins++;
            else if (result === 'D' || result === 'D.') stats.draws++;
            else if (result === 'L') stats.losses++;
            
            if (ga === 0) stats.csf++;
            if (gf === 0) stats.csa++;
        }
        
        // Process Zamalek manager
        if (zamalekManager && (currentManagerFilter === 'all' || currentManagerFilter === 'zamalek')) {
            if (!managersMap.has(zamalekManager)) {
                managersMap.set(zamalekManager, {
                    manager: zamalekManager,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    gf: 0,
                    ga: 0,
                    csf: 0,
                    csa: 0
                });
            }
            
            const stats = managersMap.get(zamalekManager);
            stats.matches++;
            stats.gf += ga; // Zamalek's goals are Ahly's GA
            stats.ga += gf; // Zamalek's conceded are Ahly's GF
            
            // Inverse result for Zamalek
            if (result === 'L') stats.wins++;
            else if (result === 'D' || result === 'D.') stats.draws++;
            else if (result === 'W') stats.losses++;
            
            if (gf === 0) stats.csf++; // Zamalek clean sheet when Ahly scored 0
            if (ga === 0) stats.csa++; // Zamalek conceded when Ahly kept clean sheet
        }
    });
    
    return Array.from(managersMap.values());
}

// Filter managers
function filterManagers() {
    const filterSelect = document.getElementById('managers-filter');
    currentManagerFilter = filterSelect.value;
    populateManagersTable();
}

// Search managers
function searchManagers() {
    const searchInput = document.getElementById('managers-search');
    currentManagerSearch = searchInput.value;
    populateManagersTable();
}

// Calculate referees statistics for Ahly
function calculateRefereesAhlyStats() {
    const matches = getFilteredMatches();
    const refereesMap = new Map();
    
    matches.forEach(match => {
        const referee = match['REFEREE'];
        const result = match['W-D-L'];
        const matchId = match.MATCH_ID;
        
        if (referee) {
            if (!refereesMap.has(referee)) {
                refereesMap.set(referee, {
                    referee: referee,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    penFor: 0,
                    penAgainst: 0
                });
            }
            
            const stats = refereesMap.get(referee);
            stats.matches++;
            
            if (result === 'W') stats.wins++;
            else if (result === 'D' || result === 'D.') stats.draws++;
            else if (result === 'L') stats.losses++;
            
            // Calculate penalties for this match
            if (zamalekPlayerDetails && zamalekPlayerDetails.length > 0) {
                // Penalties For (Ahly)
                const ahlyPenGoals = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.TYPE === 'PENGOAL' &&
                    (detail.TEAM?.toUpperCase().includes('AHLY') || detail.TEAM?.toUpperCase().includes('الأهلي'))
                ).length;
                
                const ahlyPenMisses = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.GA === 'PENMISSED' &&
                    (detail.TEAM?.toUpperCase().includes('AHLY') || detail.TEAM?.toUpperCase().includes('الأهلي'))
                ).length;
                
                stats.penFor += ahlyPenGoals + ahlyPenMisses;
                
                // Penalties Against (Zamalek)
                const zamalekPenGoals = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.TYPE === 'PENGOAL' &&
                    detail.TEAM?.toUpperCase().includes('ZAMALEK')
                ).length;
                
                const zamalekPenMisses = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.GA === 'PENMISSED' &&
                    detail.TEAM?.toUpperCase().includes('ZAMALEK')
                ).length;
                
                stats.penAgainst += zamalekPenGoals + zamalekPenMisses;
            }
        }
    });
    
    return Array.from(refereesMap.values());
}

// Calculate referees statistics for Zamalek
function calculateRefereesZamalekStats() {
    const matches = getFilteredMatches();
    const refereesMap = new Map();
    
    matches.forEach(match => {
        const referee = match['REFEREE'];
        const result = match['W-D-L'];
        const matchId = match.MATCH_ID;
        
        if (referee) {
            if (!refereesMap.has(referee)) {
                refereesMap.set(referee, {
                    referee: referee,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    penFor: 0,
                    penAgainst: 0
                });
            }
            
            const stats = refereesMap.get(referee);
            stats.matches++;
            
            // Inverse result for Zamalek
            if (result === 'L') stats.wins++;
            else if (result === 'D' || result === 'D.') stats.draws++;
            else if (result === 'W') stats.losses++;
            
            // Calculate penalties for this match
            if (zamalekPlayerDetails && zamalekPlayerDetails.length > 0) {
                // Penalties For (Zamalek)
                const zamalekPenGoals = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.TYPE === 'PENGOAL' &&
                    detail.TEAM?.toUpperCase().includes('ZAMALEK')
                ).length;
                
                const zamalekPenMisses = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.GA === 'PENMISSED' &&
                    detail.TEAM?.toUpperCase().includes('ZAMALEK')
                ).length;
                
                stats.penFor += zamalekPenGoals + zamalekPenMisses;
                
                // Penalties Against (Ahly)
                const ahlyPenGoals = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.TYPE === 'PENGOAL' &&
                    (detail.TEAM?.toUpperCase().includes('AHLY') || detail.TEAM?.toUpperCase().includes('الأهلي'))
                ).length;
                
                const ahlyPenMisses = zamalekPlayerDetails.filter(detail => 
                    detail.MATCH_ID === matchId && 
                    detail.GA === 'PENMISSED' &&
                    (detail.TEAM?.toUpperCase().includes('AHLY') || detail.TEAM?.toUpperCase().includes('الأهلي'))
                ).length;
                
                stats.penAgainst += ahlyPenGoals + ahlyPenMisses;
            }
        }
    });
    
    return Array.from(refereesMap.values());
}

// Populate referees Ahly table
function populateRefereesAhlyTable() {
    const tbody = document.querySelector('#zamalek-referees-ahly-table tbody');
    
    if (!tbody) {
        console.error('❌ Referees Ahly table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    let refereesStats = calculateRefereesAhlyStats();
    
    if (refereesStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">No data found</td></tr>';
        updateTotalsRefereesAhly([], true);
        return;
    }
    
    // Apply search filter
    if (currentRefereeAhlySearch) {
        const searchLower = currentRefereeAhlySearch.toLowerCase();
        refereesStats = refereesStats.filter(stat => 
            stat.referee.toLowerCase().includes(searchLower)
        );
    }
    
    // Sort by matches played (descending)
    refereesStats.sort((a, b) => b.matches - a.matches);
    
    refereesStats.forEach(stat => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${stat.referee}</td>
            <td>${stat.matches}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
            <td>${stat.penFor}</td>
            <td>${stat.penAgainst}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update totals row
    updateTotalsRefereesAhly(refereesStats, false);
}

// Populate referees Zamalek table
function populateRefereesZamalekTable() {
    const tbody = document.querySelector('#zamalek-referees-zamalek-table tbody');
    
    if (!tbody) {
        console.error('❌ Referees Zamalek table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    let refereesStats = calculateRefereesZamalekStats();
    
    if (refereesStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #6c757d;">No data found</td></tr>';
        updateTotalsRefereesZamalek([], true);
        return;
    }
    
    // Apply search filter
    if (currentRefereeZamalekSearch) {
        const searchLower = currentRefereeZamalekSearch.toLowerCase();
        refereesStats = refereesStats.filter(stat => 
            stat.referee.toLowerCase().includes(searchLower)
        );
    }
    
    // Sort by matches played (descending)
    refereesStats.sort((a, b) => b.matches - a.matches);
    
    refereesStats.forEach(stat => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${stat.referee}</td>
            <td>${stat.matches}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
            <td>${stat.penFor}</td>
            <td>${stat.penAgainst}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update totals row
    updateTotalsRefereesZamalek(refereesStats, false);
}

// Update totals row for Ahly referees
function updateTotalsRefereesAhly(stats, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-ref-ahly-matches').textContent = '0';
        document.getElementById('total-ref-ahly-wins').textContent = '0';
        document.getElementById('total-ref-ahly-draws').textContent = '0';
        document.getElementById('total-ref-ahly-losses').textContent = '0';
        document.getElementById('total-ref-ahly-pen-for').textContent = '0';
        document.getElementById('total-ref-ahly-pen-against').textContent = '0';
        return;
    }
    
    const totals = stats.reduce((acc, stat) => {
        acc.matches += stat.matches;
        acc.wins += stat.wins;
        acc.draws += stat.draws;
        acc.losses += stat.losses;
        acc.penFor += stat.penFor;
        acc.penAgainst += stat.penAgainst;
        return acc;
    }, { matches: 0, wins: 0, draws: 0, losses: 0, penFor: 0, penAgainst: 0 });
    
    document.getElementById('total-ref-ahly-matches').textContent = totals.matches;
    document.getElementById('total-ref-ahly-wins').textContent = totals.wins;
    document.getElementById('total-ref-ahly-draws').textContent = totals.draws;
    document.getElementById('total-ref-ahly-losses').textContent = totals.losses;
    document.getElementById('total-ref-ahly-pen-for').textContent = totals.penFor;
    document.getElementById('total-ref-ahly-pen-against').textContent = totals.penAgainst;
}

// Update totals row for Zamalek referees
function updateTotalsRefereesZamalek(stats, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-ref-zamalek-matches').textContent = '0';
        document.getElementById('total-ref-zamalek-wins').textContent = '0';
        document.getElementById('total-ref-zamalek-draws').textContent = '0';
        document.getElementById('total-ref-zamalek-losses').textContent = '0';
        document.getElementById('total-ref-zamalek-pen-for').textContent = '0';
        document.getElementById('total-ref-zamalek-pen-against').textContent = '0';
        return;
    }
    
    const totals = stats.reduce((acc, stat) => {
        acc.matches += stat.matches;
        acc.wins += stat.wins;
        acc.draws += stat.draws;
        acc.losses += stat.losses;
        acc.penFor += stat.penFor;
        acc.penAgainst += stat.penAgainst;
        return acc;
    }, { matches: 0, wins: 0, draws: 0, losses: 0, penFor: 0, penAgainst: 0 });
    
    document.getElementById('total-ref-zamalek-matches').textContent = totals.matches;
    document.getElementById('total-ref-zamalek-wins').textContent = totals.wins;
    document.getElementById('total-ref-zamalek-draws').textContent = totals.draws;
    document.getElementById('total-ref-zamalek-losses').textContent = totals.losses;
    document.getElementById('total-ref-zamalek-pen-for').textContent = totals.penFor;
    document.getElementById('total-ref-zamalek-pen-against').textContent = totals.penAgainst;
}

// Search referees for Ahly
function searchRefereesAhly() {
    const searchInput = document.getElementById('referees-ahly-search');
    currentRefereeAhlySearch = searchInput.value;
    populateRefereesAhlyTable();
}

// Search referees for Zamalek
function searchRefereesZamalek() {
    const searchInput = document.getElementById('referees-zamalek-search');
    currentRefereeZamalekSearch = searchInput.value;
    populateRefereesZamalekTable();
}

// Switch main tab
function switchMainTab(tabName) {
    currentMainTab = tabName;
    
    // Update buttons
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Load specific data for HOW WIN tab
    if (tabName === 'how-win') {
        calculateHowWinStats();
    }
}

// Calculate HOW WIN statistics
function calculateHowWinStats() {
    console.log('🔍 Calculating How Win stats...');
    console.log('📊 Data available:', {
        playerDetails: zamalekPlayerDetails ? zamalekPlayerDetails.length : 0,
        matches: zamalekMatchesData ? zamalekMatchesData.length : 0
    });
    
    // Initialize counters
    const ahlyStats = {
        leadWon: 0,
        leadDrew: 0,
        leadLost: 0,
        comebackWon: 0,
        comebackDrew: 0,
        behindLost: 0
    };
    
    const zamalekStats = {
        leadWon: 0,
        leadDrew: 0,
        leadLost: 0,
        comebackWon: 0,
        comebackDrew: 0,
        behindLost: 0
    };
    
    // Get filtered matches first
    const filteredMatches = getFilteredMatches();
    const filteredMatchIds = new Set(filteredMatches.map(m => m['MATCH_ID']));
    
    // First pass: Check which matches have ANY unknown minutes
    const matchesWithUnknownMinutes = new Set();
    
    zamalekPlayerDetails.forEach(detail => {
        const matchId = detail['MATCH_ID'];
        const minute = detail['MINUTE'];
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) {
            return;
        }
        
        // Mark match if it has unknown minute
        // Check for: empty, null, undefined, "?" (English), "؟" (Arabic), or string containing them
        const minuteStr = String(minute || '').trim();
        const isUnknown = !minute || 
                          minute === '' || 
                          minuteStr === '?' || 
                          minuteStr === '؟' ||   // Arabic question mark
                          minuteStr.includes('?') || 
                          minuteStr.includes('؟') ||  // Arabic question mark
                          minuteStr.toLowerCase() === 'unknown';
        
        if (isUnknown) {
            matchesWithUnknownMinutes.add(matchId);
        }
    });
    
    // Second pass: Group goals by match ID (ONLY for matches with ALL known minutes)
    const matchGoals = {};
    let totalGoals = 0;
    let skippedGoals = 0;
    
    zamalekPlayerDetails.forEach(detail => {
        totalGoals++;
        const matchId = detail['MATCH_ID'];
        const minute = detail['MINUTE'];
        const team = detail['TEAM'];
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) {
            skippedGoals++;
            return;
        }
        
        // Skip ENTIRE match if it has ANY unknown minutes
        if (matchesWithUnknownMinutes.has(matchId)) {
            skippedGoals++;
            return;
        }
        
        // Skip if minute contains "?" or "؟" (this should not happen now, but keep as safety)
        if (!minute || minute.includes('?') || minute.includes('؟')) {
            skippedGoals++;
            return;
        }
        
        if (!matchGoals[matchId]) {
            matchGoals[matchId] = [];
        }
        
        // Parse minute (handle 90+5 format)
        let minuteValue = 0;
        if (minute.includes('+')) {
            const parts = minute.split('+');
            minuteValue = parseInt(parts[0]) + parseInt(parts[1]) / 100; // 90+5 = 90.05
        } else {
            minuteValue = parseInt(minute);
        }
        
        matchGoals[matchId].push({
            minute: minuteValue,
            team: team,
            matchId: matchId
        });
    });
    
    // Process each match
    let processedMatches = 0;
    
    Object.keys(matchGoals).forEach(matchId => {
        const goals = matchGoals[matchId];
        
        // Sort goals by minute
        goals.sort((a, b) => a.minute - b.minute);
        
        if (goals.length === 0) return;
        
        // First goal determines who scored first
        const firstGoal = goals[0];
        const firstScorer = firstGoal.team;
        
        // Get match result
        const match = zamalekMatchesData.find(m => m['MATCH_ID'] === matchId);
        if (!match) {
            return;
        }
        
        const result = match['W-D-L'];
        
        processedMatches++;
        
        // Determine stats based on first scorer and result
        if (firstScorer && firstScorer.toUpperCase().includes('AHLY')) {
            // Ahly scored first
            if (result === 'W') {
                ahlyStats.leadWon++;
            } else if (result === 'D') {
                ahlyStats.leadDrew++;
            } else if (result === 'L') {
                ahlyStats.leadLost++;
            }
        } else if (firstScorer && firstScorer.toUpperCase().includes('ZAMALEK')) {
            // Zamalek scored first (Ahly was behind)
            if (result === 'W') {
                ahlyStats.comebackWon++;
            } else if (result === 'D') {
                ahlyStats.comebackDrew++;
            } else if (result === 'L') {
                ahlyStats.behindLost++;
            }
        }
        
        // Now calculate for Zamalek
        if (firstScorer && firstScorer.toUpperCase().includes('ZAMALEK')) {
            // Zamalek scored first
            if (result === 'L') { // From Ahly perspective, so Zamalek won
                zamalekStats.leadWon++;
            } else if (result === 'D') {
                zamalekStats.leadDrew++;
            } else if (result === 'W') { // Ahly won, Zamalek lost
                zamalekStats.leadLost++;
            }
        } else if (firstScorer && firstScorer.toUpperCase().includes('AHLY')) {
            // Ahly scored first (Zamalek was behind)
            if (result === 'L') { // From Ahly perspective, so Zamalek won
                zamalekStats.comebackWon++;
            } else if (result === 'D') {
                zamalekStats.comebackDrew++;
            } else if (result === 'W') {
                zamalekStats.behindLost++;
            }
        }
    });
    
    // Update UI
    document.getElementById('ahly-lead-won').textContent = ahlyStats.leadWon;
    document.getElementById('ahly-lead-drew').textContent = ahlyStats.leadDrew;
    document.getElementById('ahly-lead-lost').textContent = ahlyStats.leadLost;
    document.getElementById('ahly-comeback-won').textContent = ahlyStats.comebackWon;
    document.getElementById('ahly-comeback-drew').textContent = ahlyStats.comebackDrew;
    document.getElementById('ahly-behind-lost').textContent = ahlyStats.behindLost;
    
    document.getElementById('zamalek-lead-won').textContent = zamalekStats.leadWon;
    document.getElementById('zamalek-lead-drew').textContent = zamalekStats.leadDrew;
    document.getElementById('zamalek-lead-lost').textContent = zamalekStats.leadLost;
    document.getElementById('zamalek-comeback-won').textContent = zamalekStats.comebackWon;
    document.getElementById('zamalek-comeback-drew').textContent = zamalekStats.comebackDrew;
    document.getElementById('zamalek-behind-lost').textContent = zamalekStats.behindLost;
    
    // Update excluded matches count
    const excludedCount = matchesWithUnknownMinutes.size;
    document.getElementById('how-win-excluded-count').textContent = excludedCount;
    document.getElementById('how-win-excluded-count-zamalek').textContent = excludedCount;
}

// Switch sub tab
function switchSubTab(tabName) {
    currentSubTab = tabName;
    
    // Find the parent tab to determine which sub-tab group we're in
    const parentTab = document.getElementById(`${currentMainTab}-tab`);
    if (!parentTab) return;
    
    // Update sub-tab buttons within the parent tab
    parentTab.querySelectorAll('.sub-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Find and activate the clicked button
    const clickedButton = event.target;
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
    
    // Update sub-tab content within the parent tab
    parentTab.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetContent = document.getElementById(tabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

// Error display
function showError(message) {
    console.error(message);
    // You can add a UI notification here
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
    
    // Get the computed width or inline style width of the select
    const selectStyle = window.getComputedStyle(select);
    const selectWidth = select.style.width || selectStyle.width;
    const selectMaxWidth = select.style.maxWidth || selectStyle.maxWidth;
    
    select.style.display = 'none';
    select.dataset.searchable = 'true';
    
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    
    // Apply the same width to the container
    if (selectWidth && selectWidth !== 'auto' && selectWidth !== '0px') {
        container.style.width = selectWidth;
    }
    if (selectMaxWidth && selectMaxWidth !== 'none' && selectMaxWidth !== '0px') {
        container.style.maxWidth = selectMaxWidth;
    }
    
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

// Calculate players statistics
function calculatePlayersStats() {
    const playersMap = new Map();
    
    // Get unique players from player database
    if (zamalekPlayerDatabase && zamalekPlayerDatabase.length > 0) {
        zamalekPlayerDatabase.forEach(player => {
            const playerName = player['PLAYER NAME'];
            if (playerName && !playersMap.has(playerName)) {
                playersMap.set(playerName, {
                    playerName: playerName,
                    matches: 0,
                    minutes: 0,
                    goals: 0,
                    twoGoals: 0,
                    threeGoals: 0,
                    fourPlusGoals: 0,
                    assists: 0,
                    twoAssists: 0,
                    threePlusAssists: 0,
                    penGoals: 0,
                    penMisses: 0,
                    teamAhly: false,
                    teamZamalek: false
                });
            }
        });
    }
    
    // Count matches and minutes from FILTERED lineups
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        if (playerName) {
            if (!playersMap.has(playerName)) {
                playersMap.set(playerName, {
                    playerName: playerName,
                    matches: 0,
                    minutes: 0,
                    goals: 0,
                    twoGoals: 0,
                    threeGoals: 0,
                    fourPlusGoals: 0,
                    assists: 0,
                    twoAssists: 0,
                    threePlusAssists: 0,
                    penGoals: 0,
                    penMisses: 0,
                    teamAhly: false,
                    teamZamalek: false
                });
            }
            
            const stats = playersMap.get(playerName);
            stats.matches++;
            stats.minutes += minutes;
            
            // Track which team the player played for
            if (team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي')) {
                stats.teamAhly = true;
            } else if (team.toUpperCase().includes('ZAMALEK')) {
                stats.teamZamalek = true;
            }
        }
    });
    
    // Count goals and assists from FILTERED player details
    const filteredPlayerDetails = getFilteredPlayerDetails();
    if (filteredPlayerDetails && filteredPlayerDetails.length > 0) {
        // Group goals and assists by player and match
        const goalsPerMatch = new Map();
        const assistsPerMatch = new Map();
        
        filteredPlayerDetails.forEach(detail => {
            const playerName = detail['PLAYER NAME'];
            const ga = detail['GA'];
            const matchId = detail['MATCH_ID'];
            const team = detail['TEAM'] || '';
            
            if (playerName) {
                if (!playersMap.has(playerName)) {
                    playersMap.set(playerName, {
                        playerName: playerName,
                        matches: 0,
                        minutes: 0,
                        goals: 0,
                        twoGoals: 0,
                        threeGoals: 0,
                        fourPlusGoals: 0,
                        assists: 0,
                        teamAhly: false,
                        teamZamalek: false
                    });
                }
                
                const stats = playersMap.get(playerName);
                const type = detail['TYPE'];
                
                // Count goals (exact match)
                if (ga === 'GOAL') {
                    stats.goals++;
                    
                    // Track goals per match for this player
                    const key = `${playerName}_${matchId}`;
                    if (!goalsPerMatch.has(key)) {
                        goalsPerMatch.set(key, 0);
                    }
                    goalsPerMatch.set(key, goalsPerMatch.get(key) + 1);
                }
                
                // Count assists (exact match)
                if (ga === 'ASSIST') {
                    stats.assists++;
                    
                    // Track assists per match for this player
                    const key = `${playerName}_${matchId}`;
                    if (!assistsPerMatch.has(key)) {
                        assistsPerMatch.set(key, 0);
                    }
                    assistsPerMatch.set(key, assistsPerMatch.get(key) + 1);
                }
                
                // Count penalty goals (exact match)
                if (type === 'PENGOAL') {
                    stats.penGoals++;
                }
                
                // Count penalty misses (exact match)
                if (ga === 'PENMISSED') {
                    stats.penMisses++;
                }
                
                // Track which team the player played for
                if (team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي')) {
                    stats.teamAhly = true;
                } else if (team.toUpperCase().includes('ZAMALEK')) {
                    stats.teamZamalek = true;
                }
            }
        });
        
        // Calculate 2G, 3G, 4G+ for each player
        goalsPerMatch.forEach((goalCount, key) => {
            const playerName = key.split('_')[0];
            const stats = playersMap.get(playerName);
            
            if (stats) {
                if (goalCount === 2) {
                    stats.twoGoals++;
                } else if (goalCount === 3) {
                    stats.threeGoals++;
                } else if (goalCount >= 4) {
                    stats.fourPlusGoals++;
                }
            }
        });
        
        // Calculate 2A, 3A+ for each player
        assistsPerMatch.forEach((assistCount, key) => {
            const playerName = key.split('_')[0];
            const stats = playersMap.get(playerName);
            
            if (stats) {
                if (assistCount === 2) {
                    stats.twoAssists++;
                } else if (assistCount >= 3) {
                    stats.threePlusAssists++;
                }
            }
        });
    }
    
    return Array.from(playersMap.values());
}

// Filter players based on team selection
function filterPlayers() {
    const filterSelect = document.getElementById('players-filter');
    currentPlayerFilter = filterSelect.value;
    populatePlayersTable();
}

// Search players
function searchPlayers() {
    const searchInput = document.getElementById('players-search');
    currentPlayerSearch = searchInput.value;
    populatePlayersTable();
}

// Sort players table
function sortPlayersTable(column) {
    // Toggle direction if same column, otherwise set to descending
    if (currentPlayerSort.column === column) {
        currentPlayerSort.direction = currentPlayerSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentPlayerSort.column = column;
        currentPlayerSort.direction = 'desc';
    }
    
    populatePlayersTable();
}

// Populate players table
function populatePlayersTable() {
    const tbody = document.querySelector('#zamalek-players-table tbody');
    
    if (!tbody) {
        console.error('❌ Players table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    let playersStats = calculatePlayersStats();
    
    if (playersStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #6c757d;">No data found</td></tr>';
        updateTotalsPlayers([], true);
        return;
    }
    
    // Apply team filter
    if (currentPlayerFilter === 'ahly') {
        playersStats = playersStats.filter(stat => stat.teamAhly);
    } else if (currentPlayerFilter === 'zamalek') {
        playersStats = playersStats.filter(stat => stat.teamZamalek);
    }
    
    // Apply search filter
    if (currentPlayerSearch) {
        const searchLower = currentPlayerSearch.toLowerCase();
        playersStats = playersStats.filter(stat => 
            stat.playerName.toLowerCase().includes(searchLower)
        );
    }
    
    // Filter out players with no stats
    playersStats = playersStats.filter(stat => 
        stat.matches > 0 || stat.minutes > 0 || stat.goals > 0 || stat.assists > 0
    );
    
    // Sort based on current sort settings
    playersStats.sort((a, b) => {
        let aVal = a[currentPlayerSort.column];
        let bVal = b[currentPlayerSort.column];
        
        // Handle string sorting for player names
        if (currentPlayerSort.column === 'playerName') {
            aVal = (aVal || '').toLowerCase();
            bVal = (bVal || '').toLowerCase();
            if (currentPlayerSort.direction === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        }
        
        // Handle numeric sorting
        if (currentPlayerSort.direction === 'asc') {
            return aVal - bVal;
        } else {
            return bVal - aVal;
        }
    });
    
    // Update sort indicators in table headers
    document.querySelectorAll('#zamalek-players-table thead th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const columnMap = {
        'playerName': 0,
        'matches': 1,
        'minutes': 2,
        'goals': 3,
        'twoGoals': 4,
        'threeGoals': 5,
        'fourPlusGoals': 6,
        'assists': 7,
        'twoAssists': 8,
        'threePlusAssists': 9,
        'penGoals': 10,
        'penMisses': 11
    };
    
    const columnIndex = columnMap[currentPlayerSort.column];
    if (columnIndex !== undefined) {
        const th = document.querySelector(`#zamalek-players-table thead th:nth-child(${columnIndex + 1})`);
        if (th) {
            th.classList.add(currentPlayerSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }
    
    playersStats.forEach(stat => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${stat.playerName}</td>
            <td>${stat.matches}</td>
            <td>${stat.minutes}</td>
            <td>${stat.goals}</td>
            <td>${stat.twoGoals}</td>
            <td>${stat.threeGoals}</td>
            <td>${stat.fourPlusGoals}</td>
            <td>${stat.assists}</td>
            <td>${stat.twoAssists}</td>
            <td>${stat.threePlusAssists}</td>
            <td>${stat.penGoals}</td>
            <td>${stat.penMisses}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update totals row
    updateTotalsPlayers(playersStats, false);
}

// Update totals row for players
function updateTotalsPlayers(stats, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-players-matches').textContent = '0';
        document.getElementById('total-players-minutes').textContent = '0';
        document.getElementById('total-players-goals').textContent = '0';
        document.getElementById('total-players-2g').textContent = '0';
        document.getElementById('total-players-3g').textContent = '0';
        document.getElementById('total-players-4g').textContent = '0';
        document.getElementById('total-players-assists').textContent = '0';
        document.getElementById('total-players-2a').textContent = '0';
        document.getElementById('total-players-3a').textContent = '0';
        document.getElementById('total-players-pen-g').textContent = '0';
        document.getElementById('total-players-pen-m').textContent = '0';
        return;
    }
    
    const totals = stats.reduce((acc, stat) => {
        acc.matches += stat.matches;
        acc.minutes += stat.minutes;
        acc.goals += stat.goals;
        acc.twoGoals += stat.twoGoals;
        acc.threeGoals += stat.threeGoals;
        acc.fourPlusGoals += stat.fourPlusGoals;
        acc.assists += stat.assists;
        acc.twoAssists += stat.twoAssists;
        acc.threePlusAssists += stat.threePlusAssists;
        acc.penGoals += stat.penGoals;
        acc.penMisses += stat.penMisses;
        return acc;
    }, { matches: 0, minutes: 0, goals: 0, twoGoals: 0, threeGoals: 0, fourPlusGoals: 0, assists: 0, twoAssists: 0, threePlusAssists: 0, penGoals: 0, penMisses: 0 });
    
    document.getElementById('total-players-matches').textContent = totals.matches;
    document.getElementById('total-players-minutes').textContent = totals.minutes;
    document.getElementById('total-players-goals').textContent = totals.goals;
    document.getElementById('total-players-2g').textContent = totals.twoGoals;
    document.getElementById('total-players-3g').textContent = totals.threeGoals;
    document.getElementById('total-players-4g').textContent = totals.fourPlusGoals;
    document.getElementById('total-players-assists').textContent = totals.assists;
    document.getElementById('total-players-2a').textContent = totals.twoAssists;
    document.getElementById('total-players-3a').textContent = totals.threePlusAssists;
    document.getElementById('total-players-pen-g').textContent = totals.penGoals;
    document.getElementById('total-players-pen-m').textContent = totals.penMisses;
}

// Calculate H2H player statistics
function calculateH2HStats() {
    return calculateH2HStatsFiltered(new Set(), 'all');
}

// Calculate H2H player statistics with filtered match IDs
function calculateH2HStatsFiltered(relevantMatchIds, teamFilter) {
    const playersMap = new Map();
    
    // Use FILTERED lineups based on main filters
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    const filteredMatches = getFilteredMatches();
    
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        const matchId = lineup['MATCH_ID'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        // If we have H2H filtered match IDs (WITH/AGAINST), only process those matches
        if (relevantMatchIds.size > 0 && !relevantMatchIds.has(matchId)) {
            return;
        }
        
        // Track which team the player played for
        const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        const isZamalek = team.toUpperCase().includes('ZAMALEK');
        
        // Apply team filter at lineup level
        if (teamFilter === 'ahly' && !isAhly) {
            return;
        }
        if (teamFilter === 'zamalek' && !isZamalek) {
            return;
        }
        
        if (playerName) {
            if (!playersMap.has(playerName)) {
                playersMap.set(playerName, {
                    playerName: playerName,
                    matches: 0,
                    minutes: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    teamAhly: false,
                    teamZamalek: false,
                    matchIds: []
                });
            }
            
            const stats = playersMap.get(playerName);
            stats.matches++;
            stats.minutes += minutes;
            stats.matchIds.push(matchId);
            
            // Track which team the player played for
            if (isAhly) {
                stats.teamAhly = true;
            } else if (isZamalek) {
                stats.teamZamalek = true;
            }
            
            // Find match result from FILTERED matches
            const match = filteredMatches.find(m => m.MATCH_ID === matchId);
            if (match) {
                const result = match['W-D-L'];
                
                // If player was with Ahly
                if (isAhly) {
                    if (result === 'W') stats.wins++;
                    else if (result === 'D' || result === 'D.') stats.draws++;
                    else if (result === 'L') stats.losses++;
                }
                // If player was with Zamalek (reverse result)
                else if (isZamalek) {
                    if (result === 'L') stats.wins++;
                    else if (result === 'D' || result === 'D.') stats.draws++;
                    else if (result === 'W') stats.losses++;
                }
            }
        }
    });
    
    return Array.from(playersMap.values());
}

// Filter H2H players
function filterH2HPlayers() {
    const filterSelect = document.getElementById('h2h-filter');
    currentH2HFilter = filterSelect.value;
    populateH2HTable();
}

// Clear H2H filters
function clearH2HFilters() {
    // Reset filter variables
    currentH2HFilter = 'all';
    currentH2HWithSearch = '';
    currentH2HAgainstSearch = '';
    
    // Reset dropdown filter
    const filterSelect = document.getElementById('h2h-filter');
    if (filterSelect) {
        filterSelect.value = 'all';
    }
    
    // Reset WITH search dropdown
    const withSelect = document.getElementById('h2h-with-search');
    if (withSelect) {
        withSelect.value = '';
        const withInput = withSelect.parentElement.querySelector('.searchable-input');
        if (withInput) {
            withInput.value = '';
        }
    }
    
    // Reset AGAINST search dropdown
    const againstSelect = document.getElementById('h2h-against-search');
    if (againstSelect) {
        againstSelect.value = '';
        const againstInput = againstSelect.parentElement.querySelector('.searchable-input');
        if (againstInput) {
            againstInput.value = '';
        }
    }
    
    // Refresh table
    populateH2HTable();
}

// Search H2H players WITH (teammates)
function searchH2HWith() {
    const searchSelect = document.getElementById('h2h-with-search');
    currentH2HWithSearch = searchSelect.value || '';
    
    // Clear the searchable input if dropdown is cleared
    const searchInput = searchSelect.parentElement.querySelector('.searchable-input');
    if (searchInput && !currentH2HWithSearch) {
        searchInput.value = '';
    }
    
    populateH2HTable();
}

// Search H2H players AGAINST (opponents)
function searchH2HAgainst() {
    const searchSelect = document.getElementById('h2h-against-search');
    currentH2HAgainstSearch = searchSelect.value || '';
    
    // Clear the searchable input if dropdown is cleared
    const searchInput = searchSelect.parentElement.querySelector('.searchable-input');
    if (searchInput && !currentH2HAgainstSearch) {
        searchInput.value = '';
    }
    
    populateH2HTable();
}

// Sort H2H table
function sortH2HTable(column) {
    if (currentH2HSort.column === column) {
        currentH2HSort.direction = currentH2HSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentH2HSort.column = column;
        currentH2HSort.direction = 'desc';
    }
    populateH2HTable();
}

// Get players who played WITH the searched player
function getTeammates(searchedPlayerName) {
    if (!searchedPlayerName || searchedPlayerName.trim() === '') return new Set();
    
    // Use FILTERED lineups based on main filters
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    
    const searchedPlayerMatches = new Map(); // matchId -> team
    
    // Find all matches for searched player and their team (exact match)
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        if (playerName === searchedPlayerName) {
            const matchId = lineup['MATCH_ID'];
            const team = lineup['TEAM'] || '';
            searchedPlayerMatches.set(matchId, team);
        }
    });
    
    // Find teammates (same team, same match)
    const teammates = new Set();
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        const matchId = lineup['MATCH_ID'];
        const team = lineup['TEAM'] || '';
        
        if (playerName && searchedPlayerMatches.has(matchId)) {
            const searchedTeam = searchedPlayerMatches.get(matchId);
            // Same team = teammate
            if (team === searchedTeam) {
                teammates.add(playerName);
            }
        }
    });
    
    return teammates;
}

// Get players who played AGAINST the searched player
function getOpponents(searchedPlayerName) {
    if (!searchedPlayerName || searchedPlayerName.trim() === '') return new Set();
    
    // Use FILTERED lineups based on main filters
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    
    const searchedPlayerMatches = new Map(); // matchId -> team
    
    // Find all matches for searched player and their team (exact match)
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        if (playerName === searchedPlayerName) {
            const matchId = lineup['MATCH_ID'];
            const team = lineup['TEAM'] || '';
            searchedPlayerMatches.set(matchId, team);
        }
    });
    
    // Find opponents (different team, same match)
    const opponents = new Set();
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        const matchId = lineup['MATCH_ID'];
        const team = lineup['TEAM'] || '';
        
        if (playerName && searchedPlayerMatches.has(matchId)) {
            const searchedTeam = searchedPlayerMatches.get(matchId);
            // Different team = opponent
            if (team !== searchedTeam) {
                opponents.add(playerName);
            }
        }
    });
    
    return opponents;
}

// Populate H2H table
function populateH2HTable() {
    const tbody = document.querySelector('#zamalek-h2h-table tbody');
    
    if (!tbody) {
        console.error('❌ H2H table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    // Get match IDs based on filters (empty Set = all matches)
    let relevantMatchIds = new Set();
    
    // If WITH search is active, get only matches where searched player played
    if (currentH2HWithSearch && currentH2HWithSearch.trim() !== '') {
        const allLineups = [...zamalekLineupAhly, ...zamalekLineupZamalek];
        allLineups.forEach(lineup => {
            const playerName = lineup['PLAYER NAME'];
            if (playerName === currentH2HWithSearch) {
                relevantMatchIds.add(lineup['MATCH_ID']);
            }
        });
    }
    
    // If AGAINST search is active, get only matches where searched player played
    if (currentH2HAgainstSearch && currentH2HAgainstSearch.trim() !== '') {
        const allLineups = [...zamalekLineupAhly, ...zamalekLineupZamalek];
        const againstMatchIds = new Set();
        allLineups.forEach(lineup => {
            const playerName = lineup['PLAYER NAME'];
            if (playerName === currentH2HAgainstSearch) {
                againstMatchIds.add(lineup['MATCH_ID']);
            }
        });
        
        // Intersect with existing filter if WITH search was also active
        if (currentH2HWithSearch && currentH2HWithSearch.trim() !== '' && relevantMatchIds.size > 0) {
            relevantMatchIds = new Set([...relevantMatchIds].filter(id => againstMatchIds.has(id)));
        } else if (!currentH2HWithSearch || currentH2HWithSearch.trim() === '') {
            relevantMatchIds = againstMatchIds;
        }
    }
    
    // Calculate stats with filtered match IDs and team filter
    let h2hStats = calculateH2HStatsFiltered(relevantMatchIds, currentH2HFilter);
    
    if (h2hStats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6c757d;">No data found</td></tr>';
        updateTotalsH2H([], true);
        return;
    }
    
    // Apply WITH search (teammates) - for filtering player names only
    if (currentH2HWithSearch && currentH2HWithSearch.trim() !== '') {
        const teammates = getTeammates(currentH2HWithSearch);
        h2hStats = h2hStats.filter(stat => teammates.has(stat.playerName));
    }
    
    // Apply AGAINST search (opponents) - for filtering player names only
    if (currentH2HAgainstSearch && currentH2HAgainstSearch.trim() !== '') {
        const opponents = getOpponents(currentH2HAgainstSearch);
        h2hStats = h2hStats.filter(stat => opponents.has(stat.playerName));
    }
    
    // Filter out players with no stats (after all filtering)
    h2hStats = h2hStats.filter(stat => stat.matches > 0);
    
    // Sort based on current sort settings
    h2hStats.sort((a, b) => {
        let aVal = a[currentH2HSort.column];
        let bVal = b[currentH2HSort.column];
        
        if (currentH2HSort.column === 'playerName') {
            aVal = (aVal || '').toLowerCase();
            bVal = (bVal || '').toLowerCase();
            if (currentH2HSort.direction === 'asc') {
                return aVal.localeCompare(bVal);
            } else {
                return bVal.localeCompare(aVal);
            }
        }
        
        if (currentH2HSort.direction === 'asc') {
            return aVal - bVal;
        } else {
            return bVal - aVal;
        }
    });
    
    // Update sort indicators
    document.querySelectorAll('#zamalek-h2h-table thead th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const columnMap = {
        'playerName': 0,
        'matches': 1,
        'minutes': 2,
        'wins': 3,
        'draws': 4,
        'losses': 5
    };
    
    const columnIndex = columnMap[currentH2HSort.column];
    if (columnIndex !== undefined) {
        const th = document.querySelector(`#zamalek-h2h-table thead th:nth-child(${columnIndex + 1})`);
        if (th) {
            th.classList.add(currentH2HSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }
    }
    
    h2hStats.forEach(stat => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${stat.playerName}</td>
            <td>${stat.matches}</td>
            <td>${stat.minutes}</td>
            <td>${stat.wins}</td>
            <td>${stat.draws}</td>
            <td>${stat.losses}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    updateTotalsH2H(h2hStats, false);
}

// Update totals row for H2H
function updateTotalsH2H(stats, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-h2h-matches').textContent = '0';
        document.getElementById('total-h2h-minutes').textContent = '0';
        document.getElementById('total-h2h-wins').textContent = '0';
        document.getElementById('total-h2h-draws').textContent = '0';
        document.getElementById('total-h2h-losses').textContent = '0';
        return;
    }
    
    const totals = stats.reduce((acc, stat) => {
        acc.matches += stat.matches;
        acc.minutes += stat.minutes;
        acc.wins += stat.wins;
        acc.draws += stat.draws;
        acc.losses += stat.losses;
        return acc;
    }, { matches: 0, minutes: 0, wins: 0, draws: 0, losses: 0 });
    
    document.getElementById('total-h2h-matches').textContent = totals.matches;
    document.getElementById('total-h2h-minutes').textContent = totals.minutes;
    document.getElementById('total-h2h-wins').textContent = totals.wins;
    document.getElementById('total-h2h-draws').textContent = totals.draws;
    document.getElementById('total-h2h-losses').textContent = totals.losses;
}

// Populate H2H players lists for searchable dropdowns
function populateH2HPlayersList() {
    const withSelect = document.getElementById('h2h-with-search');
    const againstSelect = document.getElementById('h2h-against-search');
    
    if (!withSelect || !againstSelect) {
        console.error('❌ H2H player selects not found!');
        return;
    }
    
    // Get unique player names from lineups
    const playerNames = new Set();
    const allLineups = [...zamalekLineupAhly, ...zamalekLineupZamalek];
    
    allLineups.forEach(lineup => {
        const playerName = lineup['PLAYER NAME'];
        if (playerName) {
            playerNames.add(playerName);
        }
    });
    
    // Sort player names alphabetically
    const sortedNames = Array.from(playerNames).sort((a, b) => a.localeCompare(b));
    
    // Populate WITH select
    withSelect.innerHTML = '<option value="">Search players WITH...</option>';
    sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        withSelect.appendChild(option);
    });
    
    // Populate AGAINST select
    againstSelect.innerHTML = '<option value="">Search players AGAINST...</option>';
    sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        againstSelect.appendChild(option);
    });
    
    // Make both selects searchable
    makeSelectSearchable(withSelect);
    makeSelectSearchable(againstSelect);
    
    console.log(`✅ Populated ${sortedNames.length} player names for H2H searchable dropdowns`);
}

// Populate BY Player dropdown list
function populateByPlayerList() {
    const playerSelect = document.getElementById('by-player-search');
    
    if (!playerSelect) {
        console.error('❌ BY player search select not found!');
        return;
    }
    
    // Get unique player names from player database
    const playerNames = new Set();
    
    if (zamalekPlayerDatabase && zamalekPlayerDatabase.length > 0) {
        zamalekPlayerDatabase.forEach(player => {
            const playerName = player['PLAYER NAME'];
            if (playerName) {
                playerNames.add(playerName);
            }
        });
    }
    
    // Sort player names alphabetically
    const sortedNames = Array.from(playerNames).sort((a, b) => a.localeCompare(b));
    
    // Populate select
    playerSelect.innerHTML = '<option value="">Search for a player...</option>';
    sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        playerSelect.appendChild(option);
    });
    
    // Make select searchable
    makeSelectSearchable(playerSelect);
    
    // Fix width for BY Player search container
    setTimeout(() => {
        const container = playerSelect.closest('.searchable-select-container');
        if (container) {
            container.style.width = '250px';
            container.style.maxWidth = '250px';
            container.style.display = 'inline-block';
        }
    }, 100);
    
    console.log(`✅ Populated ${sortedNames.length} player names for BY Player dropdown`);
}

// Select BY Player
function selectByPlayer() {
    const playerSelect = document.getElementById('by-player-search');
    currentByPlayer = playerSelect.value || '';
    
    console.log('🎯 selectByPlayer called, selected:', currentByPlayer);
    console.log('📊 Available data - LineupAhly:', zamalekLineupAhly?.length, 'LineupZamalek:', zamalekLineupZamalek?.length);
    console.log('📊 Available data - Matches:', zamalekMatchesData?.length, 'PlayerDetails:', zamalekPlayerDetails?.length);
    
    if (!currentByPlayer) {
        // Hide content, show "no selection" message
        document.getElementById('by-player-content').style.display = 'none';
        document.getElementById('by-player-no-selection').style.display = 'block';
        return;
    }
    
    // Show content, hide "no selection" message
    document.getElementById('by-player-content').style.display = 'block';
    document.getElementById('by-player-no-selection').style.display = 'none';
    
    // Update player stats
    updateByPlayerStats();
    populateByPlayerMatches();
    populateByPlayerChampionships();
    populateByPlayerSeasons();
}

// Filter BY Player stats (by team)
function filterByPlayer() {
    const filterSelect = document.getElementById('by-player-filter');
    currentByPlayerFilter = filterSelect.value;
    
    if (currentByPlayer) {
        updateByPlayerStats();
        populateByPlayerMatches();
        populateByPlayerChampionships();
        populateByPlayerSeasons();
    }
}

// Calculate stats for selected player
function calculateByPlayerStats(playerName, teamFilter) {
    const stats = {
        matches: 0,
        minutes: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals: 0,
        assists: 0,
        twoGoals: 0,
        threeGoals: 0,
        fourPlusGoals: 0,
        twoAssists: 0,
        threePlusAssists: 0,
        penGoals: 0,
        penMakeGoals: 0,
        penAssistGoals: 0,
        penAssistMisses: 0,
        penMisses: 0
    };
    
    if (!playerName) return stats;
    
    // Use FILTERED lineups and matches based on main filters
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    const filteredMatches = getFilteredMatches();
    
    // Track goals and assists per match
    const goalsPerMatch = new Map();
    const assistsPerMatch = new Map();
    
    // Count matches and minutes from lineups
    allLineups.forEach(lineup => {
        const name = lineup['PLAYER NAME'];
        if (name !== playerName) return;
        
        const matchId = lineup['MATCH_ID'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        // Determine team
        const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        const isZamalek = team.toUpperCase().includes('ZAMALEK');
        
        // Apply team filter
        if (teamFilter === 'ahly' && !isAhly) return;
        if (teamFilter === 'zamalek' && !isZamalek) return;
        
        stats.matches++;
        stats.minutes += minutes;
        
        // Find match result from FILTERED matches
        const match = filteredMatches.find(m => m.MATCH_ID === matchId);
        if (match) {
            const result = match['W-D-L'];
            
            // If player was with Ahly
            if (isAhly) {
                if (result === 'W') stats.wins++;
                else if (result === 'D' || result === 'D.') stats.draws++;
                else if (result === 'L') stats.losses++;
            }
            // If player was with Zamalek (reverse result)
            else if (isZamalek) {
                if (result === 'L') stats.wins++;
                else if (result === 'D' || result === 'D.') stats.draws++;
                else if (result === 'W') stats.losses++;
            }
        }
    });
    
    // Count goals and assists from FILTERED player details
    const filteredPlayerDetails = getFilteredPlayerDetails();
    if (filteredPlayerDetails && filteredPlayerDetails.length > 0) {
        filteredPlayerDetails.forEach(detail => {
            const name = detail['PLAYER NAME'];
            if (name !== playerName) return;
            
            const matchId = detail['MATCH_ID'];
            const ga = detail['GA'];
            const type = detail['TYPE'];
            const team = detail['TEAM'] || '';
            
            // Determine team
            const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
            const isZamalek = team.toUpperCase().includes('ZAMALEK');
            
            // Apply team filter
            if (teamFilter === 'ahly' && !isAhly) return;
            if (teamFilter === 'zamalek' && !isZamalek) return;
            
            // Count goals
            if (ga === 'GOAL') {
                stats.goals++;
                
                const key = `${matchId}`;
                if (!goalsPerMatch.has(key)) {
                    goalsPerMatch.set(key, 0);
                }
                goalsPerMatch.set(key, goalsPerMatch.get(key) + 1);
            }
            
            // Count assists
            if (ga === 'ASSIST') {
                stats.assists++;
                
                const key = `${matchId}`;
                if (!assistsPerMatch.has(key)) {
                    assistsPerMatch.set(key, 0);
                }
                assistsPerMatch.set(key, assistsPerMatch.get(key) + 1);
            }
            
            // Count penalty goals
            if (type === 'PENGOAL') {
                stats.penGoals++;
            }
            
            // Count penalty make goals
            if (ga === 'PENMAKEGOAL') {
                stats.penMakeGoals++;
            }
            
            // Count penalty assist goals
            if (ga === 'PENASSISTGOAL') {
                stats.penAssistGoals++;
            }
            
            // Count penalty assist misses
            if (ga === 'PENASSISTMISSED') {
                stats.penAssistMisses++;
            }
            
            // Count penalty misses
            if (ga === 'PENMISSED') {
                stats.penMisses++;
            }
        });
        
        // Calculate multi-goal/assist stats
        goalsPerMatch.forEach(goalCount => {
            if (goalCount === 2) stats.twoGoals++;
            else if (goalCount === 3) stats.threeGoals++;
            else if (goalCount >= 4) stats.fourPlusGoals++;
        });
        
        assistsPerMatch.forEach(assistCount => {
            if (assistCount === 2) stats.twoAssists++;
            else if (assistCount >= 3) stats.threePlusAssists++;
        });
    }
    
    return stats;
}

// Update BY Player overview stats
function updateByPlayerStats() {
    if (!currentByPlayer) return;
    
    const stats = calculateByPlayerStats(currentByPlayer, currentByPlayerFilter);
    
    // Update player name in title
    document.getElementById('by-player-name').textContent = `${currentByPlayer} Statistics`;
    
    // Update stats cards
    document.getElementById('by-player-matches').textContent = stats.matches;
    document.getElementById('by-player-minutes').textContent = stats.minutes;
    document.getElementById('by-player-wins').textContent = stats.wins;
    document.getElementById('by-player-draws').textContent = stats.draws;
    document.getElementById('by-player-losses').textContent = stats.losses;
    document.getElementById('by-player-goals').textContent = stats.goals;
    document.getElementById('by-player-assists').textContent = stats.assists;
    document.getElementById('by-player-2g').textContent = stats.twoGoals;
    document.getElementById('by-player-3g').textContent = stats.threeGoals;
    document.getElementById('by-player-4g').textContent = stats.fourPlusGoals;
    document.getElementById('by-player-2a').textContent = stats.twoAssists;
    document.getElementById('by-player-3a').textContent = stats.threePlusAssists;
    document.getElementById('by-player-pen-g').textContent = stats.penGoals;
    document.getElementById('by-player-pen-make-g').textContent = stats.penMakeGoals;
    document.getElementById('by-player-pen-assist-g').textContent = stats.penAssistGoals;
    document.getElementById('by-player-pen-assist-m').textContent = stats.penAssistMisses;
    document.getElementById('by-player-pen-m').textContent = stats.penMisses;
}

// Populate BY Player matches table
function populateByPlayerMatches() {
    const tbody = document.querySelector('#by-player-matches-table tbody');
    
    if (!tbody) {
        console.error('❌ BY player matches table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!currentByPlayer) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6c757d;">Please select a player</td></tr>';
        return;
    }
    
    console.log('🔍 Populating matches for player:', currentByPlayer, 'with filter:', currentByPlayerFilter);
    
    // Use FILTERED lineups and matches based on main filters
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    const filteredMatches = getFilteredMatches();
    const playerMatches = [];
    
    console.log('📊 Total FILTERED lineups:', allLineups.length);
    console.log('📊 Total FILTERED matches data:', filteredMatches.length);
    
    // Get all matches where player participated
    allLineups.forEach(lineup => {
        const name = lineup['PLAYER NAME'];
        if (name !== currentByPlayer) return;
        
        const matchId = lineup['MATCH_ID'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        console.log('✅ Found lineup for player:', name, 'Match ID:', matchId, 'Team:', team, 'Minutes:', minutes);
        
        // Determine team
        const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        const isZamalek = team.toUpperCase().includes('ZAMALEK');
        
        // Apply team filter
        if (currentByPlayerFilter === 'ahly' && !isAhly) {
            console.log('⏭️ Skipping - not Ahly match');
            return;
        }
        if (currentByPlayerFilter === 'zamalek' && !isZamalek) {
            console.log('⏭️ Skipping - not Zamalek match');
            return;
        }
        
        // Find match details from FILTERED matches (compare as strings to handle type differences)
        const match = filteredMatches.find(m => String(m.MATCH_ID) === String(matchId));
        if (!match) {
            console.log('❌ Match not found for ID:', matchId);
            return;
        }
        
        console.log('✅ Match found:', match['DATE'], match['SEASON']);
        
        // Count goals and assists for this match from FILTERED player details
        let goals = 0;
        let assists = 0;
        
        const filteredPlayerDetails = getFilteredPlayerDetails();
        if (filteredPlayerDetails && filteredPlayerDetails.length > 0) {
            filteredPlayerDetails.forEach(detail => {
                // Compare as strings to handle type differences
                if (detail['PLAYER NAME'] === currentByPlayer && String(detail['MATCH_ID']) === String(matchId)) {
                    const ga = detail['GA'];
                    if (ga === 'GOAL') goals++;
                    if (ga === 'ASSIST') assists++;
                }
            });
        }
        
        console.log('⚽ Goals:', goals, 'Assists:', assists, 'for match', matchId);
        
        // Get result based on which team the player was on
        let result = match['W-D-L'];
        if (isZamalek) {
            // Reverse result for Zamalek
            if (result === 'W') result = 'L';
            else if (result === 'L') result = 'W';
        }
        
        playerMatches.push({
            date: match['DATE'],
            season: match['SEASON'],
            ahlyManager: match['AHLY MANAGER'] || '-',
            zamalekManager: match['ZAMALEK MANAGER'] || '-',
            result: result,
            minutes: minutes,
            goals: goals,
            assists: assists
        });
    });
    
    console.log('📋 Total player matches found:', playerMatches.length);
    
    // Sort by date (newest first)
    playerMatches.sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateB - dateA;
    });
    
    // Populate table
    if (playerMatches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6c757d;">No matches found for this player</td></tr>';
        console.log('❌ No matches to display');
        return;
    }
    
    playerMatches.forEach(match => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${match.date}</td>
            <td>${match.season}</td>
            <td>${match.ahlyManager}</td>
            <td>${match.zamalekManager}</td>
            <td>${match.result}</td>
            <td>${match.goals}</td>
            <td>${match.assists}</td>
            <td>${match.minutes}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    console.log('✅ Successfully populated', playerMatches.length, 'matches in table');
}

// Helper function to extract year from season string (e.g., "2024/25" -> 2024, "Super Cup 2024/25" -> 2024)
function extractSeasonYear(seasonStr) {
    const yearMatch = seasonStr.match(/(\d{4})\/(\d{2})/);
    if (yearMatch) {
        return parseInt(yearMatch[1]);
    }
    return 0;
}

// Sort seasons: alphabetically by prefix, then by year (newest first)
function sortSeasons(a, b) {
    // Extract prefix (text before the year)
    const prefixA = a.season.replace(/\d{4}\/\d{2}/, '').trim();
    const prefixB = b.season.replace(/\d{4}\/\d{2}/, '').trim();
    
    // If prefixes are different, sort alphabetically
    if (prefixA !== prefixB) {
        return prefixA.localeCompare(prefixB);
    }
    
    // If same prefix, sort by year (newest first)
    const yearA = extractSeasonYear(a.season);
    const yearB = extractSeasonYear(b.season);
    return yearB - yearA;
}

// Populate BY Player Seasons table
function populateByPlayerSeasons() {
    const tbody = document.querySelector('#by-player-seasons-table tbody');
    if (!tbody) return;
    
    if (!currentByPlayer) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6c757d;">Please select a player</td></tr>';
        updateTotalsByPlayerSeasons([], true);
        return;
    }
    
    console.log('📅 Populating seasons for player:', currentByPlayer);
    
    const seasonsMap = new Map();
    
    // First, collect matches and minutes ONLY from FILTERED LINEUPAHLY and LINEUPZAMALEK
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    const filteredMatches = getFilteredMatches();
    allLineups.forEach(lineup => {
        const name = lineup['PLAYER NAME'];
        if (name !== currentByPlayer) return;
        
        const matchId = lineup['MATCH_ID'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        // Determine team
        const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        const isZamalek = team.toUpperCase().includes('ZAMALEK');
        
        // Apply team filter
        if (currentByPlayerFilter === 'ahly' && !isAhly) return;
        if (currentByPlayerFilter === 'zamalek' && !isZamalek) return;
        
        // Find match details from FILTERED matches
        const match = filteredMatches.find(m => String(m.MATCH_ID) === String(matchId));
        if (!match) return;
        
        const season = match['SEASON'] || 'Unknown';
        
        // Initialize season stats if not exists
        if (!seasonsMap.has(season)) {
            seasonsMap.set(season, {
                season: season,
                matchIds: new Set(),
                minutes: 0,
                goals: 0,
                assists: 0
            });
        }
        
        const seasonStats = seasonsMap.get(season);
        seasonStats.matchIds.add(String(matchId));
        seasonStats.minutes += minutes;
    });
    
    // Now add goals and assists from FILTERED PLAYERDETAILS (even if not in lineup)
    const filteredPlayerDetails = getFilteredPlayerDetails();
    if (filteredPlayerDetails && filteredPlayerDetails.length > 0) {
        filteredPlayerDetails.forEach(detail => {
            const name = detail['PLAYER NAME'];
            if (name !== currentByPlayer) return;
            
            const matchId = String(detail['MATCH_ID']);
            const ga = detail['GA'];
            const team = detail['TEAM'] || '';
            
            // Determine team
            const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
            const isZamalek = team.toUpperCase().includes('ZAMALEK');
            
            // Apply team filter
            if (currentByPlayerFilter === 'ahly' && !isAhly) return;
            if (currentByPlayerFilter === 'zamalek' && !isZamalek) return;
            
            // Only count goals and assists
            if (ga !== 'GOAL' && ga !== 'ASSIST') return;
            
            // Find match details from FILTERED matches
            const match = filteredMatches.find(m => String(m.MATCH_ID) === matchId);
            if (!match) return;
            
            const season = match['SEASON'] || 'Unknown';
            
            // Add goals/assists (create season if doesn't exist)
            if (!seasonsMap.has(season)) {
                seasonsMap.set(season, {
                    season: season,
                    matchIds: new Set(),
                    minutes: 0,
                    goals: 0,
                    assists: 0
                });
            }
            
            const seasonStats = seasonsMap.get(season);
            if (ga === 'GOAL') seasonStats.goals++;
            if (ga === 'ASSIST') seasonStats.assists++;
        });
    }
    
    // Calculate matches count from matchIds Set
    seasonsMap.forEach(season => {
        season.matches = season.matchIds.size;
        delete season.matchIds; // Remove matchIds as we don't need it anymore
    });
    
    // Convert map to array and calculate G+A
    const seasonsArray = Array.from(seasonsMap.values());
    seasonsArray.forEach(season => {
        season.ga = season.goals + season.assists;
    });
    
    // Sort by season (newest first, with alphabetical prefix sorting)
    seasonsArray.sort(sortSeasons);
    
    // Populate table
    if (seasonsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6c757d;">No data available</td></tr>';
        updateTotalsByPlayerSeasons([], true);
        return;
    }
    
    tbody.innerHTML = '';
    seasonsArray.forEach(season => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${season.season}</td>
            <td>${season.matches}</td>
            <td>${season.minutes}</td>
            <td>${season.ga}</td>
            <td>${season.goals}</td>
            <td>${season.assists}</td>
        `;
        tbody.appendChild(row);
    });
    
    updateTotalsByPlayerSeasons(seasonsArray);
    console.log('✅ Seasons table populated with', seasonsArray.length, 'seasons');
}

// Update totals row for BY Player Seasons table
function updateTotalsByPlayerSeasons(seasons, clear = false) {
    if (clear) {
        document.getElementById('total-season-matches').textContent = '0';
        document.getElementById('total-season-minutes').textContent = '0';
        document.getElementById('total-season-ga').textContent = '0';
        document.getElementById('total-season-goals').textContent = '0';
        document.getElementById('total-season-assists').textContent = '0';
        return;
    }
    
    const totals = seasons.reduce((acc, season) => {
        acc.matches += season.matches;
        acc.minutes += season.minutes;
        acc.goals += season.goals;
        acc.assists += season.assists;
        return acc;
    }, { matches: 0, minutes: 0, goals: 0, assists: 0 });
    
    // Calculate G+A
    totals.ga = totals.goals + totals.assists;
    
    document.getElementById('total-season-matches').textContent = totals.matches;
    document.getElementById('total-season-minutes').textContent = totals.minutes;
    document.getElementById('total-season-ga').textContent = totals.ga;
    document.getElementById('total-season-goals').textContent = totals.goals;
    document.getElementById('total-season-assists').textContent = totals.assists;
}

// Populate BY Player championships table
function populateByPlayerChampionships() {
    const tbody = document.querySelector('#by-player-championships-table tbody');
    
    if (!tbody) {
        console.error('❌ BY player championships table tbody not found!');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!currentByPlayer) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6c757d;">Please select a player</td></tr>';
        updateTotalsByPlayerChampionships([], true);
        return;
    }
    
    console.log('🏆 Populating championships for player:', currentByPlayer);
    
    const championshipsMap = new Map();
    
    // First, collect matches and minutes ONLY from FILTERED LINEUPAHLY and LINEUPZAMALEK
    const filteredLineupAhly = getFilteredLineupAhly();
    const filteredLineupZamalek = getFilteredLineupZamalek();
    const allLineups = [...filteredLineupAhly, ...filteredLineupZamalek];
    const filteredMatches = getFilteredMatches();
    allLineups.forEach(lineup => {
        const name = lineup['PLAYER NAME'];
        if (name !== currentByPlayer) return;
        
        const matchId = lineup['MATCH_ID'];
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        const team = lineup['TEAM'] || '';
        
        // Determine team
        const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
        const isZamalek = team.toUpperCase().includes('ZAMALEK');
        
        // Apply team filter
        if (currentByPlayerFilter === 'ahly' && !isAhly) return;
        if (currentByPlayerFilter === 'zamalek' && !isZamalek) return;
        
        // Find match details from FILTERED matches
        const match = filteredMatches.find(m => String(m.MATCH_ID) === String(matchId));
        if (!match) return;
        
        const championship = match['CHAMPION'] || 'Unknown';
        
        // Initialize championship stats if not exists
        if (!championshipsMap.has(championship)) {
            championshipsMap.set(championship, {
                championship: championship,
                matchIds: new Set(),
                minutes: 0,
                goals: 0,
                assists: 0
            });
        }
        
        const champStats = championshipsMap.get(championship);
        champStats.matchIds.add(String(matchId));
        champStats.minutes += minutes;
    });
    
    // Now add goals and assists from FILTERED PLAYERDETAILS (even if not in lineup)
    const filteredPlayerDetails = getFilteredPlayerDetails();
    if (filteredPlayerDetails && filteredPlayerDetails.length > 0) {
        filteredPlayerDetails.forEach(detail => {
            const name = detail['PLAYER NAME'];
            if (name !== currentByPlayer) return;
            
            const matchId = String(detail['MATCH_ID']);
            const ga = detail['GA'];
            const team = detail['TEAM'] || '';
            
            // Determine team
            const isAhly = team.toUpperCase().includes('AHLY') || team.toUpperCase().includes('الأهلي');
            const isZamalek = team.toUpperCase().includes('ZAMALEK');
            
            // Apply team filter
            if (currentByPlayerFilter === 'ahly' && !isAhly) return;
            if (currentByPlayerFilter === 'zamalek' && !isZamalek) return;
            
            // Only count goals and assists
            if (ga !== 'GOAL' && ga !== 'ASSIST') return;
            
            // Find match details from FILTERED matches
            const match = filteredMatches.find(m => String(m.MATCH_ID) === matchId);
            if (!match) return;
            
            const championship = match['CHAMPION'] || 'Unknown';
            
            // Add goals/assists (create championship if doesn't exist)
            if (!championshipsMap.has(championship)) {
                championshipsMap.set(championship, {
                    championship: championship,
                    matchIds: new Set(),
                    minutes: 0,
                    goals: 0,
                    assists: 0
                });
            }
            
            const champStats = championshipsMap.get(championship);
            if (ga === 'GOAL') champStats.goals++;
            if (ga === 'ASSIST') champStats.assists++;
        });
    }
    
    // Calculate matches count from matchIds Set
    championshipsMap.forEach(champ => {
        champ.matches = champ.matchIds.size;
        delete champ.matchIds; // Remove matchIds as we don't need it anymore
    });
    
    // Convert map to array and calculate G+A
    const championshipsArray = Array.from(championshipsMap.values());
    championshipsArray.forEach(champ => {
        champ.ga = champ.goals + champ.assists;
    });
    
    // Sort by G+A (descending)
    championshipsArray.sort((a, b) => b.ga - a.ga);
    
    console.log('🏆 Total championships found:', championshipsArray.length);
    
    if (championshipsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #6c757d;">No championships found for this player</td></tr>';
        updateTotalsByPlayerChampionships([], true);
        return;
    }
    
    // Populate table
    championshipsArray.forEach(champ => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${champ.championship}</td>
            <td>${champ.matches}</td>
            <td>${champ.minutes}</td>
            <td>${champ.ga}</td>
            <td>${champ.goals}</td>
            <td>${champ.assists}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update totals
    updateTotalsByPlayerChampionships(championshipsArray, false);
    
    console.log('✅ Successfully populated', championshipsArray.length, 'championships in table');
}

// Update totals row for championships
function updateTotalsByPlayerChampionships(championships, isEmpty) {
    if (isEmpty) {
        document.getElementById('total-champ-matches').textContent = '0';
        document.getElementById('total-champ-minutes').textContent = '0';
        document.getElementById('total-champ-ga').textContent = '0';
        document.getElementById('total-champ-goals').textContent = '0';
        document.getElementById('total-champ-assists').textContent = '0';
        return;
    }
    
    const totals = championships.reduce((acc, champ) => {
        acc.matches += champ.matches;
        acc.minutes += champ.minutes;
        acc.goals += champ.goals;
        acc.assists += champ.assists;
        return acc;
    }, { matches: 0, minutes: 0, goals: 0, assists: 0 });
    
    // Calculate G+A
    totals.ga = totals.goals + totals.assists;
    
    document.getElementById('total-champ-matches').textContent = totals.matches;
    document.getElementById('total-champ-minutes').textContent = totals.minutes;
    document.getElementById('total-champ-ga').textContent = totals.ga;
    document.getElementById('total-champ-goals').textContent = totals.goals;
    document.getElementById('total-champ-assists').textContent = totals.assists;
}

// ============================================
// SEARCH MATCH FUNCTIONALITY
// ============================================

// Search for a match by ID
function searchZamalekMatchById() {
    const searchInput = document.getElementById('zamalek-match-search-input');
    const matchId = searchInput.value.trim();
    
    console.log('🔍 Searching for match ID:', matchId);
    
    if (!matchId) {
        alert('Please enter a Match ID');
        return;
    }
    
    // Find match in data
    const match = zamalekMatchesData.find(m => String(m.MATCH_ID) === String(matchId));
    
    if (!match) {
        console.log('❌ No match found with ID:', matchId);
        document.getElementById('zamalek-match-details-container').style.display = 'none';
        document.getElementById('zamalek-no-match-found').style.display = 'block';
        return;
    }
    
    console.log('✅ Match found:', match);
    
    // Hide no results message
    document.getElementById('zamalek-no-match-found').style.display = 'none';
    
    // Show match details
    displayZamalekMatchDetails(match);
    
    // Show details container
    document.getElementById('zamalek-match-details-container').style.display = 'block';
}

// Display match details
function displayZamalekMatchDetails(match) {
    console.log('📋 Displaying match details for:', match.MATCH_ID);
    
    // Display match header
    displayZamalekMatchHeader(match);
    
    // Display lineup (default tab)
    displayZamalekMatchLineup(match);
    
    // Display goals
    displayZamalekMatchGoals(match);
}

// Display match header
function displayZamalekMatchHeader(match) {
    const headerContainer = document.getElementById('zamalek-match-header');
    
    const date = match.DATE || '';
    const season = match.SEASON || '';
    const championship = match.CHAMPION || '';
    const round = match.ROUND || '';
    const stadium = match.STADIUM || '';
    const referee = match.REFREE || '';
    const ahlyScore = match.GF || 0;
    const zamalekScore = match.GA || 0;
    
    headerContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 3rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #dc143c; margin: 0;">Al Ahly</h2>
                ${match['AHLY MANAGER'] ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${match['AHLY MANAGER']}</p>` : ''}
            </div>
            <div style="font-size: 3rem; font-weight: 700; color: #333;">
                ${ahlyScore} - ${zamalekScore}
            </div>
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #333; margin: 0;">Zamalek</h2>
                ${match['ZAMALEK MANAGER'] ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${match['ZAMALEK MANAGER']}</p>` : ''}
            </div>
        </div>
        <div style="border-top: 2px solid #e5e7eb; padding-top: 1rem; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; font-size: 0.95rem; color: #666;">
            ${date ? `<span><strong>Date:</strong> ${date}</span>` : ''}
            ${season ? `<span><strong>Season:</strong> ${season}</span>` : ''}
            ${stadium ? `<span><strong>Stadium:</strong> ${stadium}</span>` : ''}
            ${round ? `<span><strong>Round:</strong> ${round}</span>` : ''}
            ${championship ? `<span><strong>Championship:</strong> ${championship}</span>` : ''}
            ${referee ? `<span><strong>Referee:</strong> ${referee}</span>` : ''}
        </div>
    `;
}

// Display match lineup (Ahly on left, Zamalek on right)
function displayZamalekMatchLineup(match) {
    const matchId = String(match.MATCH_ID);
    const container = document.getElementById('zamalek-match-lineup-container');
    
    console.log('👥 Displaying lineup for match:', matchId);
    
    // Get lineups for this match
    const ahlyLineup = zamalekLineupAhly.filter(l => String(l.MATCH_ID) === matchId);
    const zamalekLineup = zamalekLineupZamalek.filter(l => String(l.MATCH_ID) === matchId);
    
    console.log('Al Ahly lineup:', ahlyLineup.length, 'players');
    console.log('Zamalek lineup:', zamalekLineup.length, 'players');
    
    // Get goals data for this match
    const matchGoals = zamalekPlayerDetails.filter(detail => 
        String(detail.MATCH_ID) === matchId && (detail.GA === 'GOAL' || detail.GA === 'ASSIST')
    );
    
    if (ahlyLineup.length === 0 && zamalekLineup.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No lineup data available for this match</p>';
        return;
    }
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Ahly Lineup
    html += `
        <div>
            <h3 style="color: #dc143c; margin-bottom: 1rem;">🔴 Al Ahly</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Status</th>
                            <th>Minutes</th>
                            <th>Goals</th>
                            <th>Assists</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    if (ahlyLineup.length > 0) {
        ahlyLineup.forEach((player, index) => {
            const playerName = player['PLAYER NAME'] || 'Unknown';
            const minutes = player.MINTOTAL || player.MINMAT || 0;
            const playerOut = player.PLAYEROUT || player['PLAYER NAME OUT'] || '';
            const minOut = player.MINOUT || '';
            
            const isSubFromStatus = typeof player.STATU === 'string' && player.STATU.toUpperCase().includes('SUB');
            const isSubstitute = isSubFromStatus || index >= 11;
            
            let status = '';
            if (!isSubstitute) {
                status = '<span class="badge badge-success">Starting XI</span>';
            } else {
                status = '<span class="badge badge-warning">Substitute</span>';
                if (playerOut) {
                    status += `<br><small style="color: #666;">(Replaced ${playerOut} at ${minOut}')</small>`;
                }
            }
            
            // Calculate goals and assists for this player
            const playerGoalRecords = matchGoals.filter(g => g['PLAYER NAME'] === playerName && g.GA === 'GOAL' && g.TEAM === 'AHLY');
            const playerAssistRecords = matchGoals.filter(g => g['PLAYER NAME'] === playerName && g.GA === 'ASSIST' && g.TEAM === 'AHLY');
            
            const playerGoals = playerGoalRecords.reduce((total, goal) => total + (goal.GATOTAL || 1), 0);
            const playerAssists = playerAssistRecords.reduce((total, assist) => total + (assist.GATOTAL || 1), 0);
            
            const goalsDisplay = playerGoals > 0 ? 
                `<span style="color: #28a745; font-weight: bold;">${parseInt(playerGoals)} ⚽</span>` : 
                '<span style="color: #999;">-</span>';
            
            const assistsDisplay = playerAssists > 0 ? 
                `<span style="color: #007bff; font-weight: bold;">${parseInt(playerAssists)} 🎯</span>` : 
                '<span style="color: #999;">-</span>';
            
            let playerNameWithArrows = `<strong>${playerName}</strong>`;
            
            const isGoalkeeper = index === 0;
            if (isGoalkeeper) {
                playerNameWithArrows += ` <span style="color: #6c757d; font-weight: bold; font-size: 0.9em;" title="Goalkeeper">GK 🧤</span>`;
            }
            
            const wasSubstitutedIn = index >= 11;
            if (wasSubstitutedIn) {
                playerNameWithArrows += ` <span style="color: #28a745; font-size: 1.5em;" title="Substituted In">↑</span>`;
            }
            
            html += `
                <tr>
                    <td>${playerNameWithArrows}</td>
                    <td>${status}</td>
                    <td>${minutes}'</td>
                    <td style="text-align: center;">${goalsDisplay}</td>
                    <td style="text-align: center;">${assistsDisplay}</td>
                </tr>
            `;
        });
    } else {
        html += '<tr><td colspan="5" style="text-align: center; color: #999;">No lineup</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Zamalek Lineup
    html += `
        <div>
            <h3 style="color: #333; margin-bottom: 1rem;">⚪ Zamalek</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Status</th>
                            <th>Minutes</th>
                            <th>Goals</th>
                            <th>Assists</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    if (zamalekLineup.length > 0) {
        zamalekLineup.forEach((player, index) => {
            const playerName = player['PLAYER NAME'] || 'Unknown';
            const minutes = player.MINTOTAL || player.MINMAT || 0;
            const playerOut = player.PLAYEROUT || player['PLAYER NAME OUT'] || '';
            const minOut = player.MINOUT || '';
            
            const isSubFromStatus = typeof player.STATU === 'string' && player.STATU.toUpperCase().includes('SUB');
            const isSubstitute = isSubFromStatus || index >= 11;
            
            let status = '';
            if (!isSubstitute) {
                status = '<span class="badge badge-success">Starting XI</span>';
            } else {
                status = '<span class="badge badge-warning">Substitute</span>';
                if (playerOut) {
                    status += `<br><small style=\"color: #666;\">(Replaced ${playerOut} at ${minOut}')` + `</small>`;
                }
            }
            
            // Calculate goals and assists for this player
            const playerGoalRecords = matchGoals.filter(g => g['PLAYER NAME'] === playerName && g.GA === 'GOAL' && g.TEAM === 'ZAMALEK');
            const playerAssistRecords = matchGoals.filter(g => g['PLAYER NAME'] === playerName && g.GA === 'ASSIST' && g.TEAM === 'ZAMALEK');
            
            const playerGoals = playerGoalRecords.reduce((total, goal) => total + (goal.GATOTAL || 1), 0);
            const playerAssists = playerAssistRecords.reduce((total, assist) => total + (assist.GATOTAL || 1), 0);
            
            const goalsDisplay = playerGoals > 0 ? 
                `<span style="color: #28a745; font-weight: bold;">${parseInt(playerGoals)} ⚽</span>` : 
                '<span style="color: #999;">-</span>';
            
            const assistsDisplay = playerAssists > 0 ? 
                `<span style="color: #007bff; font-weight: bold;">${parseInt(playerAssists)} 🎯</span>` : 
                '<span style="color: #999;">-</span>';
            
            let playerNameWithArrows = `<strong>${playerName}</strong>`;
            
            const isGoalkeeper = index === 0;
            if (isGoalkeeper) {
                playerNameWithArrows += ` <span style="color: #6c757d; font-weight: bold; font-size: 0.9em;" title="Goalkeeper">GK 🧤</span>`;
            }
            
            const wasSubstitutedIn = index >= 11;
            if (wasSubstitutedIn) {
                playerNameWithArrows += ` <span style="color: #28a745; font-size: 1.5em;" title="Substituted In">↑</span>`;
            }
            
            html += `
                <tr>
                    <td>${playerNameWithArrows}</td>
                    <td>${status}</td>
                    <td>${minutes}'</td>
                    <td style="text-align: center;">${goalsDisplay}</td>
                    <td style="text-align: center;">${assistsDisplay}</td>
                </tr>
            `;
        });
    } else {
        html += '<tr><td colspan="5" style="text-align: center; color: #999;">No lineup</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Display match goals
function displayZamalekMatchGoals(match) {
    const matchId = String(match.MATCH_ID);
    const container = document.getElementById('zamalek-match-goals-container');
    
    console.log('⚽ Displaying goals for match:', matchId);
    
    const matchGoals = zamalekPlayerDetails.filter(detail => {
        const mid = String(detail.MATCH_ID);
        const ga = (detail.GA || '').toUpperCase();
        return mid === matchId && (ga === 'GOAL' || ga === 'ASSIST');
    });
    
    if (matchGoals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No goals data available for this match</p>';
        return;
    }
    
    // Helper function to find assist for a goal
    const findAssist = (minute, isAhlyGoal) => {
        return matchGoals.find(g => {
            const gMin = parseInt(g.MINUTE || g.MIN || 0, 10); // Convert assist minute to integer
            const goalMinute = parseInt(minute, 10); // Convert goal minute to integer
            const gGA = (g.GA || '').toUpperCase();
            const gTeam = (g.TEAM || '').toUpperCase();
            const gIsAhly = gTeam === 'AHLY';
            return gGA === 'ASSIST' && gMin === goalMinute && gIsAhly === isAhlyGoal;
        });
    };
    
    // Separate Ahly and Zamalek goals
    const ahlyGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toUpperCase();
        return ga === 'GOAL' && team === 'AHLY';
    });
    
    const zamalekGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toUpperCase();
        return ga === 'GOAL' && team === 'ZAMALEK';
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Ahly Goals
    html += `
        <div>
            <h3 style="color: #dc143c; margin-bottom: 1rem;">🔴 Al Ahly Goals</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                                <tr>
                                    <th>Minute</th>
                                    <th>Player</th>
                                    <th>Type</th>
                                </tr>
                    </thead>
                    <tbody>
    `;
    
    ahlyGoals.forEach(goal => {
        const minute = goal.MINUTE || goal.MIN || 0;
        const player = goal['PLAYER NAME'] || 'Unknown';
        const gatotal = goal.GATOTAL || 1;
        const type = goal.TYPE || 'Regular';
        const elnady = goal.ELNADY || '-';
        const assist = findAssist(minute, true);
        const assistPlayer = assist ? assist['PLAYER NAME'] : null;
        
        html += `
                    <tr>
                        <td><strong>${minute}'</strong></td>
                        <td>
                            <strong>${player}</strong> <span style="color: #dc143c; font-weight: 600;">(${gatotal})</span>
                            ${assistPlayer ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assistPlayer}</div>` : ''}
                        </td>
                        <td>${type}</td>
                    </tr>
        `;
    });
    
    if (ahlyGoals.length === 0) {
        html += '<tr><td colspan="3" style="text-align: center; color: #999;">No goals</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Zamalek Goals
    html += `
        <div>
            <h3 style="color: #333; margin-bottom: 1rem;">⚪ Zamalek Goals</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                                <tr>
                                    <th>Minute</th>
                                    <th>Player</th>
                                    <th>Type</th>
                                </tr>
                    </thead>
                    <tbody>
    `;
    
    zamalekGoals.forEach(goal => {
        const minute = goal.MINUTE || goal.MIN || 0;
        const player = goal['PLAYER NAME'] || 'Unknown';
        const gatotal = goal.GATOTAL || 1;
        const type = goal.TYPE || 'Regular';
        const elnady = goal.ELNADY || '-';
        const assist = findAssist(minute, false);
        const assistPlayer = assist ? assist['PLAYER NAME'] : null;
        
        html += `
            <tr>
                <td><strong>${minute}'</strong></td>
                <td>
                    <strong>${player}</strong> <span style="color: #333; font-weight: 600;">(${gatotal})</span>
                    ${assistPlayer ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assistPlayer}</div>` : ''}
                </td>
                <td>${type}</td>
            </tr>
        `;
    });
    
    if (zamalekGoals.length === 0) {
        html += '<tr><td colspan="3" style="text-align: center; color: #999;">No goals</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    html += '</div>';
    
    container.innerHTML = html;
}

// Switch between match sub-tabs (lineup, goals)
function showZamalekMatchSubTab(event, tabName) {
    console.log('🔄 Switching to match sub-tab:', tabName);
    
    // Remove active class from all tab buttons
    const buttons = document.querySelectorAll('#zamalek-match-details-container .tab-button');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button
    event.currentTarget.classList.add('active');
    
    // Hide all tab contents
    const contents = document.querySelectorAll('#zamalek-match-details-container .tab-content');
    contents.forEach(content => content.classList.remove('active'));
    
    // Show selected tab content
    const selectedContent = document.getElementById(`zamalek-match-${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
}

// Make functions globally accessible
window.initializeZamalekStats = initializeZamalekStats;
window.applyZamalekFilters = applyZamalekFilters;
window.clearZamalekFilters = clearZamalekFilters;
window.refreshZamalekStats = refreshZamalekStats;
window.switchMainTab = switchMainTab;
window.switchSubTab = switchSubTab;
window.filterManagers = filterManagers;
window.searchManagers = searchManagers;
window.searchRefereesAhly = searchRefereesAhly;
window.searchRefereesZamalek = searchRefereesZamalek;
window.filterPlayers = filterPlayers;
window.searchPlayers = searchPlayers;
window.sortPlayersTable = sortPlayersTable;
window.filterH2HPlayers = filterH2HPlayers;
window.clearH2HFilters = clearH2HFilters;
window.searchH2HWith = searchH2HWith;
window.searchH2HAgainst = searchH2HAgainst;
window.sortH2HTable = sortH2HTable;
window.selectByPlayer = selectByPlayer;
window.filterByPlayer = filterByPlayer;
window.searchZamalekMatchById = searchZamalekMatchById;
window.showZamalekMatchSubTab = showZamalekMatchSubTab;

console.log('✅ Al Ahly VS Zamalek JavaScript loaded');

