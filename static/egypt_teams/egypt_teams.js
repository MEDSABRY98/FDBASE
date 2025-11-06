// ============================================================================
// EGYPT TEAMS MODULE - JAVASCRIPT
// ============================================================================

// Global data storage
let egyptTeamsData = {
    allRecords: [],
    filteredRecords: [],
    totalMatches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    totalGoalsFor: 0,
    totalGoalsAgainst: 0,
    cleanSheetFor: 0,
    cleanSheetAgainst: 0,
    longestWinStreak: 0,
    longestDrawStreak: 0,
    longestLossStreak: 0,
    filterOptions: {},
    players: [],
    allPlayers: [],
    playerDatabase: [],
    playerDetails: [],
    lineupDetails: [],
    gkDetails: [],
    howPenMissed: [],
    playersLoaded: false,
    playerDetailsLoaded: false,
    currentSortColumn: 'totalGA',
    currentSortDirection: 'desc',
    selectedPlayer: null,
    currentGKSortColumn: 'matches',
    currentGKSortDirection: 'desc',
    goalkeepersData: []
};

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

// ============================================================================
// MAIN DATA LOADING FUNCTION
// ============================================================================

async function loadEgyptTeamsData(forceRefresh = false) {
    try {
        showLoading();
        
        const url = forceRefresh ? '/api/egypt-teams/matches?refresh=true' : '/api/egypt-teams/matches';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Store data
        egyptTeamsData.allRecords = data.matches || [];
        egyptTeamsData.filteredRecords = [...egyptTeamsData.allRecords];
        
        // Populate filter options
        populateFilterOptions();
        
        // Calculate statistics
        calculateStatistics();
        
        // Update UI
        updateOverviewStats();
        displayMatches();
        setupDynamicTableSearch();
        
        // If force refresh and players data is loaded, refresh player details too
        if (forceRefresh && egyptTeamsData.playersLoaded) {
            console.log('🔄 Force refreshing player details...');
            egyptTeamsData.playersLoaded = false;
            egyptTeamsData.playerDetailsLoaded = false;
            await loadPlayersData(true);
        }
        
        // If force refresh and player details loaded (for referees), refresh it
        if (forceRefresh && egyptTeamsData.playerDetailsLoaded && !egyptTeamsData.playersLoaded) {
            console.log('🔄 Force refreshing player details only...');
            egyptTeamsData.playerDetailsLoaded = false;
            await loadPlayerDetailsOnly(true);
        }
        
        hideLoading();
        
        console.log('✅ Egypt Teams data refreshed successfully');
        
    } catch (error) {
        console.error('Error loading Egypt Teams data:', error);
        hideLoading();
        showError('No Data Available');
    }
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

// Helper function to calculate longest streak
function calculateLongestStreak(records, resultTypes) {
    let longestStreak = 0;
    let currentStreak = 0;
    
    records.forEach(record => {
        const result = record['W-D-L'];
        if (resultTypes.includes(result)) {
            currentStreak++;
            longestStreak = Math.max(longestStreak, currentStreak);
        } else {
            currentStreak = 0;
        }
    });
    
    return longestStreak;
}

function calculateStatistics() {
    const records = egyptTeamsData.filteredRecords;
    
    egyptTeamsData.totalMatches = records.length;
    egyptTeamsData.wins = records.filter(r => r['W-D-L'] === 'W').length;
    egyptTeamsData.draws = records.filter(r => ['D', 'D WITH G', 'D.'].includes(r['W-D-L'])).length;
    egyptTeamsData.losses = records.filter(r => r['W-D-L'] === 'L').length;
    egyptTeamsData.totalGoalsFor = records.reduce((sum, r) => sum + (parseInt(r['GF'] || 0)), 0);
    egyptTeamsData.totalGoalsAgainst = records.reduce((sum, r) => sum + (parseInt(r['GA'] || 0)), 0);
    
    // Clean Sheet For: matches where GA = 0 (no goals conceded)
    egyptTeamsData.cleanSheetFor = records.filter(r => parseInt(r['GA'] || 0) === 0).length;
    
    // Clean Sheet Against: matches where GF = 0 (no goals scored)
    egyptTeamsData.cleanSheetAgainst = records.filter(r => parseInt(r['GF'] || 0) === 0).length;
    
    // Calculate longest streaks
    egyptTeamsData.longestWinStreak = calculateLongestStreak(records, ['W']);
    egyptTeamsData.longestDrawStreak = calculateLongestStreak(records, ['D', 'D WITH G', 'D.']);
    egyptTeamsData.longestLossStreak = calculateLongestStreak(records, ['L']);
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

function updateOverviewStats() {
    document.getElementById('total-matches').textContent = egyptTeamsData.totalMatches;
    document.getElementById('total-wins').textContent = egyptTeamsData.wins;
    document.getElementById('total-draws').textContent = egyptTeamsData.draws;
    document.getElementById('total-losses').textContent = egyptTeamsData.losses;
    document.getElementById('total-goals-for').textContent = egyptTeamsData.totalGoalsFor;
    document.getElementById('total-goals-against').textContent = egyptTeamsData.totalGoalsAgainst;
    document.getElementById('clean-sheet-for').textContent = egyptTeamsData.cleanSheetFor;
    document.getElementById('clean-sheet-against').textContent = egyptTeamsData.cleanSheetAgainst;
    document.getElementById('longest-win-streak').textContent = egyptTeamsData.longestWinStreak;
    document.getElementById('longest-draw-streak').textContent = egyptTeamsData.longestDrawStreak;
    document.getElementById('longest-loss-streak').textContent = egyptTeamsData.longestLossStreak;
}

// Helper function to render a single row
function renderMatchRow(match) {
    const matchId = match['MATCH_ID'] || '';
    const date = match['DATE'] || '';
    const managerEgy = match['MANAGER EGY'] || '';
    const managerOpponent = match['MANAGER OPPONENT'] || '';
    const season = match['SEASON'] || '';
    const place = match['PLACE'] || '';
    const egyptTeam = match['Egypt TEAM'] || '';
    const gf = match['GF'] || 0;
    const ga = match['GA'] || 0;
    const opponent = match['OPPONENT TEAM'] || '';
    const result = match['W-D-L'] || '';
    
    let resultBadge = '';
    if (result === 'W') {
        resultBadge = '<span class="badge badge-success">W</span>';
    } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
        resultBadge = '<span class="badge badge-warning">D</span>';
    } else if (result === 'L') {
        resultBadge = '<span class="badge badge-danger">L</span>';
    }
    
    return `
        <tr>
            <td><strong>${escapeHtml(matchId)}</strong></td>
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(managerEgy)}</td>
            <td>${escapeHtml(managerOpponent)}</td>
            <td>${escapeHtml(season)}</td>
            <td>${escapeHtml(place)}</td>
            <td>${escapeHtml(egyptTeam)}</td>
            <td><strong>${gf}</strong></td>
            <td><strong>${ga}</strong></td>
            <td>${escapeHtml(opponent)}</td>
            <td>${resultBadge}</td>
        </tr>
    `;
}

// Virtual scrolling render function
function renderVisibleMatchRows() {
    const tbody = document.getElementById('matches-tbody');
    if (!tbody) return;
    
    const { allData, startIndex, endIndex } = virtualScrollState;
    const visibleData = allData.slice(startIndex, endIndex);
    
    // Create spacer row for top
    const topSpacer = `<tr style="height: ${startIndex * virtualScrollState.rowHeight}px;"><td colspan="11"></td></tr>`;
    // Render visible rows
    const rowsHtml = visibleData.map(renderMatchRow).join('');
    // Create spacer row for bottom
    const bottomSpacer = `<tr style="height: ${Math.max(0, allData.length - endIndex) * virtualScrollState.rowHeight}px;"><td colspan="11"></td></tr>`;
    
    tbody.innerHTML = topSpacer + rowsHtml + bottomSpacer;
}

function displayMatches() {
    const tbody = document.getElementById('matches-tbody');
    if (!tbody) return;
    
    const matches = egyptTeamsData.filteredRecords.slice().reverse(); // Show latest first
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
        // Remove scroll handlers if they exist
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    // For small datasets (< 1000 rows), render everything at once for better compatibility
    if (matches.length <= 1000) {
        const rowsHtml = matches.map(renderMatchRow).join('');
        tbody.innerHTML = rowsHtml;
        // Remove scroll handlers if they exist
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    // For large datasets, use virtual scrolling
    virtualScrollState.allData = matches;
    virtualScrollState.currentViewData = matches;
    
    // Reset scroll state
    virtualScrollState.startIndex = 0;
    virtualScrollState.endIndex = Math.min(25, matches.length);
    
    // Reset scroll position
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.scrollTop = 0;
    }
    
    // Initial render
    renderVisibleMatchRows();
    
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
            renderVisibleMatchRows();
        }
    };
    
    // Attach scroll listener to the table container
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.addEventListener('scroll', virtualScrollState.scrollHandler);
    }
}

// Setup dynamic table search
function setupDynamicTableSearch() {
    const searchInput = document.getElementById('matches-search-input');
    if (!searchInput) return;

    // Remove previous listeners by cloning the input
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('keyup', () => {
        const searchTerm = newSearchInput.value.toLowerCase().trim();
        
        // Get current filtered records (after apply filters button)
        const currentMatches = egyptTeamsData.filteredRecords.slice().reverse();
        
        // If dataset is small, use regular filtering without virtual scroll
        if (currentMatches.length <= 1000) {
            if (!searchTerm) {
                // No search term, restore full data
                displayMatches();
                return;
            } else {
                // Filter data based on search
                const tbody = document.getElementById('matches-tbody');
                if (!tbody) return;
                
                const filtered = currentMatches.filter((match) => {
                    const cols = ['MATCH_ID', 'DATE', 'MANAGER EGY', 'MANAGER OPPONENT', 'SEASON', 'PLACE', 'Egypt TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-D-L'];
                    const rowText = cols.map(c => String(match[c] || '')).join(' ').toLowerCase();
                    return rowText.includes(searchTerm);
                });
                
                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
                } else {
                    const rowsHtml = filtered.map(renderMatchRow).join('');
                    tbody.innerHTML = rowsHtml;
                }
                return;
            }
        }
        
        // For large datasets with virtual scrolling
        if (!searchTerm) {
            // No search term, restore full data
            virtualScrollState.allData = currentMatches;
            virtualScrollState.currentViewData = currentMatches;
        } else {
            // Filter data based on search from current filtered records
            const filtered = currentMatches.filter((match) => {
                const cols = ['MATCH_ID', 'DATE', 'MANAGER EGY', 'MANAGER OPPONENT', 'SEASON', 'PLACE', 'Egypt TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-D-L'];
                const rowText = cols.map(c => String(match[c] || '')).join(' ').toLowerCase();
                return rowText.includes(searchTerm);
            });
            virtualScrollState.allData = filtered;
            // Keep currentViewData as the original (before search) for when user clears search
            virtualScrollState.currentViewData = currentMatches;
        }
        
        // Reset scroll position
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.scrollTop = 0;
        }
        
        // Reset scroll and re-render
        virtualScrollState.startIndex = 0;
        virtualScrollState.endIndex = Math.min(25, virtualScrollState.allData.length);
        renderVisibleMatchRows();
    });
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

// Setup searchable select functionality
function setupSearchableSelect(inputId, fieldName) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const container = input.closest('.searchable-select-container');
    if (!container) return;

    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    // Get unique values for this field
    const uniqueValues = [...new Set(egyptTeamsData.allRecords
        .map(r => r[fieldName])
        .filter(val => val && val.trim() !== ''))]
        .sort();

    // Store the values on the input element
    input.dataset.options = JSON.stringify(uniqueValues);
    input.dataset.allOptions = JSON.stringify(uniqueValues);

    // Handle input focus - show all options
    input.addEventListener('focus', function() {
        showDropdownOptions(this, uniqueValues);
    });

    // Handle input - filter options
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredOptions = uniqueValues.filter(opt => 
            opt.toLowerCase().includes(searchTerm)
        );
        showDropdownOptions(this, filteredOptions);
    });

    // Handle clicking outside to close dropdown
    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

// Show dropdown options
function showDropdownOptions(input, options) {
    const container = input.closest('.searchable-select-container');
    const dropdown = container.querySelector('.dropdown-options');
    
    dropdown.innerHTML = '';
    
    // Add "All" option
    const allOption = document.createElement('div');
    allOption.className = 'dropdown-option';
    allOption.textContent = 'All';
    allOption.addEventListener('click', function() {
        input.value = '';
        dropdown.style.display = 'none';
    });
    dropdown.appendChild(allOption);

    // Add filtered options
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.textContent = option;
        optionDiv.addEventListener('click', function() {
            input.value = option;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(optionDiv);
    });

    dropdown.style.display = 'block';
}

function populateFilterOptions() {
    const records = egyptTeamsData.allRecords;
    
    // Extract unique values for each filter
    const filterFields = {
        'filter-champion-system': 'CHAMPION SYSTEM',
        'filter-manager-egy': 'MANAGER EGY',
        'filter-manager-opponent': 'MANAGER OPPONENT',
        'filter-refree': 'REFREE',
        'filter-champion': 'CHAMPION',
        'filter-season': 'SEASON',
        'filter-round': 'ROUND',
        'filter-place': 'PLACE',
        'filter-han': 'H-A-N',
        'filter-egypt-team': 'Egypt TEAM',
        'filter-opponent-team': 'OPPONENT TEAM',
        'filter-result': 'W-D-L',
        'filter-cs': 'CLEAN SHEET',
        'filter-et': 'ET',
        'filter-pen': 'PEN'
    };
    
    // Setup searchable selects for all filter fields
    Object.entries(filterFields).forEach(([filterId, fieldName]) => {
        setupSearchableSelect(filterId, fieldName);
    });
    
    // Show filters section
    document.getElementById('filters-section').style.display = 'block';
}

function applyFilters() {
    const filters = {
        matchId: document.getElementById('filter-match-id').value.trim(),
        championSystem: document.getElementById('filter-champion-system').value,
        dateFrom: document.getElementById('filter-date-from').value,
        dateTo: document.getElementById('filter-date-to').value,
        managerEgy: document.getElementById('filter-manager-egy').value,
        managerOpponent: document.getElementById('filter-manager-opponent').value,
        refree: document.getElementById('filter-refree').value,
        champion: document.getElementById('filter-champion').value,
        season: document.getElementById('filter-season').value,
        round: document.getElementById('filter-round').value,
        place: document.getElementById('filter-place').value,
        han: document.getElementById('filter-han').value,
        egyptTeam: document.getElementById('filter-egypt-team').value,
        opponentTeam: document.getElementById('filter-opponent-team').value,
        result: document.getElementById('filter-result').value,
        cs: document.getElementById('filter-cs').value,
        et: document.getElementById('filter-et').value,
        pen: document.getElementById('filter-pen').value,
        gf: document.getElementById('filter-gf').value,
        ga: document.getElementById('filter-ga').value
    };
    
    // Filter records
    egyptTeamsData.filteredRecords = egyptTeamsData.allRecords.filter(record => {
        // Match ID filter
        if (filters.matchId && !record['MATCH_ID']?.includes(filters.matchId)) return false;
        
        // Dropdown filters
        if (filters.championSystem && record['CHAMPION SYSTEM'] !== filters.championSystem) return false;
        if (filters.managerEgy && record['MANAGER EGY'] !== filters.managerEgy) return false;
        if (filters.managerOpponent && record['MANAGER OPPONENT'] !== filters.managerOpponent) return false;
        if (filters.refree && record['REFREE'] !== filters.refree) return false;
        if (filters.champion && record['CHAMPION'] !== filters.champion) return false;
        if (filters.season && record['SEASON'] !== filters.season) return false;
        if (filters.round && record['ROUND'] !== filters.round) return false;
        if (filters.place && record['PLACE'] !== filters.place) return false;
        if (filters.han && record['H-A-N'] !== filters.han) return false;
        if (filters.egyptTeam && record['Egypt TEAM'] !== filters.egyptTeam) return false;
        if (filters.opponentTeam && record['OPPONENT TEAM'] !== filters.opponentTeam) return false;
        if (filters.result && record['W-D-L'] !== filters.result) return false;
        if (filters.cs && record['CLEAN SHEET'] !== filters.cs) return false;
        if (filters.et && record['ET'] !== filters.et) return false;
        if (filters.pen && record['PEN'] !== filters.pen) return false;
        
        // Date filters
        if (filters.dateFrom && record['DATE'] && new Date(record['DATE']) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && record['DATE'] && new Date(record['DATE']) > new Date(filters.dateTo)) return false;
        
        // Number filters
        if (filters.gf && parseInt(record['GF'] || 0) !== parseInt(filters.gf)) return false;
        if (filters.ga && parseInt(record['GA'] || 0) !== parseInt(filters.ga)) return false;
        
        return true;
    });
    
    // Recalculate statistics and update display
    calculateStatistics();
    updateOverviewStats();
    displayMatches();
    
    // Clear search input when filters are applied
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) searchInput.value = '';
    
    // Recalculate H2H stats
    loadH2HStats();
    
    // Recalculate managers stats
    loadManagersStats();
    
    // Recalculate referees stats
    loadRefereesStats();
    
    // Recalculate player statistics if players are loaded
    if (egyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
    }
    
    // Recalculate selected player stats if a player is selected
    if (egyptTeamsData.selectedPlayer) {
        calculatePlayerIndividualStats(egyptTeamsData.selectedPlayer);
    }
    
    // Recalculate selected goalkeeper stats if a goalkeeper is selected
    if (selectedGoalkeeper) {
        calculateGoalkeeperIndividualStats(selectedGoalkeeper);
    }
    
    // Update ELNADY tab if it's active
    const elnadyTab = document.getElementById('elnady-tab');
    if (elnadyTab && elnadyTab.classList.contains('active')) {
        // Check which sub-tab is active
        const allClubsTab = document.getElementById('elnady-all-clubs-tab');
        if (allClubsTab && allClubsTab.classList.contains('active')) {
            loadAllClubsStats();
        }
        // Update search options for By ELNADY tab
        setupElnadySearch();
        
        // If a club is selected, refresh its stats
        const clubContent = document.getElementById('elnady-club-content');
        const selectedClubName = document.getElementById('selected-club-name');
        if (clubContent && clubContent.style.display !== 'none' && selectedClubName) {
            const clubName = selectedClubName.textContent;
            if (clubName) {
                loadClubStats(clubName);
            }
        }
    }
    
    // Recalculate goalkeepers stats if goalkeepers tab is active
    const goalkeepersTab = document.getElementById('goalkeepers-tab');
    if (goalkeepersTab && goalkeepersTab.classList.contains('active') && egyptTeamsData.playersLoaded) {
        loadGoalkeepersStats();
    }
    
    // Recalculate selected goalkeeper stats if BY Goalkeepers tab is active
    const byGoalkeepersTab = document.getElementById('bygoalkeepers-tab');
    if (byGoalkeepersTab && byGoalkeepersTab.classList.contains('active') && selectedGoalkeeper) {
        calculateGoalkeeperIndividualStats(selectedGoalkeeper);
    }
    
    // Update main stats if mainstats tab is active
    const mainstatsTab = document.getElementById('mainstats-tab');
    if (mainstatsTab && mainstatsTab.classList.contains('active')) {
        // Check which sub-tab is active
        const championshipsTab = document.getElementById('mainstats-championships-tab');
        if (championshipsTab && championshipsTab.classList.contains('active')) {
            loadMainStatsChampionships();
        } else {
            loadMainStatsSeasons();
        }
    }
    
    console.log(`Filtered ${egyptTeamsData.filteredRecords.length} of ${egyptTeamsData.allRecords.length} matches`);
}

function clearFilters() {
    document.getElementById('filter-match-id').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-gf').value = '';
    document.getElementById('filter-ga').value = '';
    
    // Reset all searchable select inputs
    const searchableInputs = document.querySelectorAll('.searchable-select-container input');
    searchableInputs.forEach(input => {
        input.value = '';
    });
    
    // Hide all dropdowns
    const dropdowns = document.querySelectorAll('.dropdown-options');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    
    // Reset filtered records to all records
    egyptTeamsData.filteredRecords = [...egyptTeamsData.allRecords];
    
    // Reset filter options to show all available values
    populateFilterOptions();
    
    // Recalculate and update display
    calculateStatistics();
    updateOverviewStats();
    displayMatches();
    
    // Recalculate H2H stats
    loadH2HStats();
    
    // Recalculate managers stats
    loadManagersStats();
    
    // Recalculate referees stats
    loadRefereesStats();
    
    // Recalculate player statistics if players are loaded
    if (egyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
    }
    
    // Recalculate selected player stats if a player is selected
    if (egyptTeamsData.selectedPlayer) {
        calculatePlayerIndividualStats(egyptTeamsData.selectedPlayer);
    }
    
    // Recalculate selected goalkeeper stats if a goalkeeper is selected
    if (selectedGoalkeeper) {
        calculateGoalkeeperIndividualStats(selectedGoalkeeper);
    }
    
    // Update ELNADY tab if it's active
    const elnadyTab = document.getElementById('elnady-tab');
    if (elnadyTab && elnadyTab.classList.contains('active')) {
        // Check which sub-tab is active
        const allClubsTab = document.getElementById('elnady-all-clubs-tab');
        if (allClubsTab && allClubsTab.classList.contains('active')) {
            loadAllClubsStats();
        }
        // Update search options for By ELNADY tab
        setupElnadySearch();
        
        // If a club is selected, refresh its stats
        const clubContent = document.getElementById('elnady-club-content');
        const selectedClubName = document.getElementById('selected-club-name');
        if (clubContent && clubContent.style.display !== 'none' && selectedClubName) {
            const clubName = selectedClubName.textContent;
            if (clubName) {
                loadClubStats(clubName);
            }
        }
    }
    
    // Recalculate goalkeepers stats if goalkeepers tab is active
    const goalkeepersTab = document.getElementById('goalkeepers-tab');
    if (goalkeepersTab && goalkeepersTab.classList.contains('active') && egyptTeamsData.playersLoaded) {
        loadGoalkeepersStats();
    }
    
    console.log('Filters cleared');
}

// ============================================================================
// PLAYERS DATA FUNCTIONS
// ============================================================================

async function loadPlayerDetailsOnly(forceRefresh = false) {
    try {
        const url = forceRefresh ? '/api/egypt-teams/player-details?refresh=true' : '/api/egypt-teams/player-details';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        egyptTeamsData.playerDetails = data.playerDetails || [];
        egyptTeamsData.gkDetails = data.gkDetails || [];
        egyptTeamsData.howPenMissed = data.howPenMissed || [];
        egyptTeamsData.playerDetailsLoaded = true;
        
        console.log('✅ Player details loaded for referees stats');
        
    } catch (error) {
        console.error('Error loading player details:', error);
    }
}

async function loadPlayersData(forceRefresh = false) {
    try {
        showPlayersLoading();
        
        const url = forceRefresh ? '/api/egypt-teams/player-details?refresh=true' : '/api/egypt-teams/player-details';
        const response = await fetch(url);
        
        if (!response.ok) {
            // Try to get error details from the response
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage = errorData.error;
                }
            } catch (e) {
                // If parsing JSON fails, use the default error message
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        egyptTeamsData.playerDatabase = data.playerDatabase || [];
        egyptTeamsData.playerDetails = data.playerDetails || [];
        egyptTeamsData.lineupDetails = data.lineupDetails || [];
        egyptTeamsData.gkDetails = data.gkDetails || [];
        egyptTeamsData.howPenMissed = data.howPenMissed || [];
        egyptTeamsData.playersLoaded = true;
        egyptTeamsData.playerDetailsLoaded = true;
        
        // Calculate player statistics from filtered matches
        calculatePlayerStatistics();
        
        displayPlayers();
        hidePlayersLoading();
        
    } catch (error) {
        console.error('Error loading players data:', error);
        hidePlayersLoading();
        showPlayersError('No Data Available');
    }
}

function calculatePlayerStatistics() {
    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Separate official and friendly match IDs
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const championSystem = match['CHAMPION SYSTEM'] || '';
        const matchId = match['MATCH_ID'] || '';
        if (matchId) {
            if (championSystem === 'OFI') {
                officialMatchIds.add(matchId);
            } else if (championSystem === 'FRI') {
                friendlyMatchIds.add(matchId);
            }
        }
    });
    
    // Calculate matches and minutes for each player
    const playersMatches = {};
    const playersMinutes = {};
    
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const playerName = (lineup['PLAYER NAME'] || '').trim();
        const matchId = (lineup['MATCH_ID'] || '').trim();
        
        if (!playerName || !filteredMatchIds.has(matchId)) return;
        
        // Count matches
        if (!playersMatches[playerName]) {
            playersMatches[playerName] = new Set();
        }
        playersMatches[playerName].add(matchId);
        
        // Sum minutes
        const minutes = parseInt(lineup['MINTOTAL']) || 0;
        playersMinutes[playerName] = (playersMinutes[playerName] || 0) + minutes;
    });
    
    // Calculate goals and assists for each player
    const playersOfficialGoals = {};
    const playersFriendlyGoals = {};
    const playersOfficialAssists = {};
    const playersFriendlyAssists = {};
    
    egyptTeamsData.playerDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        if (!playerName) return;
        
        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        // Only count if match is in filtered matches
        if (!filteredMatchIds.has(matchId)) return;
        
        let gatotal = parseInt(detail['GATOTAL']) || 0;
        
        // Count goals
        if (gaValue === 'GOAL') {
            if (officialMatchIds.has(matchId)) {
                playersOfficialGoals[playerName] = (playersOfficialGoals[playerName] || 0) + gatotal;
            }
            if (friendlyMatchIds.has(matchId)) {
                playersFriendlyGoals[playerName] = (playersFriendlyGoals[playerName] || 0) + gatotal;
            }
        }
        // Count assists
        else if (gaValue === 'ASSIST') {
            if (officialMatchIds.has(matchId)) {
                playersOfficialAssists[playerName] = (playersOfficialAssists[playerName] || 0) + gatotal;
            }
            if (friendlyMatchIds.has(matchId)) {
                playersFriendlyAssists[playerName] = (playersFriendlyAssists[playerName] || 0) + gatotal;
            }
        }
    });
    
    // Build map of player teams from PLAYERDETAILS
    const playerTeams = new Map();
    egyptTeamsData.playerDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        const team = (detail['TEAM'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        // Only count if match is in filtered matches
        if (playerName && team && filteredMatchIds.has(matchId)) {
            playerTeams.set(playerName, team);
        }
    });
    
    // Build players list from player database using Map to ensure unique names
    const playersMap = new Map();
    
    egyptTeamsData.playerDatabase.forEach((player, index) => {
        const playerName = (player['PLAYER NAME'] || '').trim();
        
        if (!playerName) return;
        
        // Only add if not already in map (ensures unique player names)
        if (!playersMap.has(playerName)) {
            const matches = playersMatches[playerName] ? playersMatches[playerName].size : 0;
            const minutes = playersMinutes[playerName] || 0;
            const officialGoals = playersOfficialGoals[playerName] || 0;
            const friendlyGoals = playersFriendlyGoals[playerName] || 0;
            const officialAssists = playersOfficialAssists[playerName] || 0;
            const friendlyAssists = playersFriendlyAssists[playerName] || 0;
            const totalGA = officialGoals + friendlyGoals + officialAssists + friendlyAssists;
            
            // Only include players who have at least one stat > 0
            const hasStats = matches > 0 || minutes > 0 || totalGA > 0 || 
                           officialGoals > 0 || friendlyGoals > 0 || 
                           officialAssists > 0 || friendlyAssists > 0;
            
            if (hasStats) {
                // Get team from PLAYERDETAILS
                const team = playerTeams.get(playerName) || '';
                
                playersMap.set(playerName, {
                    playerName: playerName,
                    team: team,
                    matches: matches,
                    minutes: minutes,
                    totalGA: totalGA,
                    officialGoals: officialGoals,
                    friendlyGoals: friendlyGoals,
                    officialAssists: officialAssists,
                    friendlyAssists: friendlyAssists
                });
            }
        }
    });
    
    // Convert Map to array
    egyptTeamsData.allPlayers = Array.from(playersMap.values());
    
    // Set players to all players by default
    egyptTeamsData.players = [...egyptTeamsData.allPlayers];
    
    // Apply team filter if dropdown exists
    const filterSelect = document.getElementById('players-team-filter');
    if (filterSelect) {
        filterPlayersByTeam();
    }
}

function filterPlayersByTeam() {
    const filterSelect = document.getElementById('players-team-filter');
    if (!filterSelect) {
        // If dropdown doesn't exist yet, show all players
        egyptTeamsData.players = [...egyptTeamsData.allPlayers];
        return;
    }
    
    const filterValue = filterSelect.value;
    
    if (filterValue === 'all') {
        egyptTeamsData.players = [...egyptTeamsData.allPlayers];
    } else if (filterValue === 'egypt') {
        // Filter players where team contains "Egypt" or "مصر" (case insensitive)
        egyptTeamsData.players = egyptTeamsData.allPlayers.filter(player => {
            const team = (player.team || '').toLowerCase();
            return team.includes('egypt') || team.includes('مصر');
        });
    } else if (filterValue === 'opponent') {
        // Filter players where team does NOT contain "Egypt" or "مصر"
        egyptTeamsData.players = egyptTeamsData.allPlayers.filter(player => {
            const team = (player.team || '').toLowerCase();
            return !team.includes('egypt') && !team.includes('مصر');
        });
    }
    
    displayPlayers();
    console.log(`Filtered players: ${egyptTeamsData.players.length} of ${egyptTeamsData.allPlayers.length}`);
}

function sortPlayersBy(column) {
    // Toggle sort direction if clicking the same column
    if (egyptTeamsData.currentSortColumn === column) {
        egyptTeamsData.currentSortDirection = egyptTeamsData.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Default to descending for new column (except for playerName)
        egyptTeamsData.currentSortColumn = column;
        egyptTeamsData.currentSortDirection = column === 'playerName' ? 'asc' : 'desc';
    }
    
    // Update header classes
    const headers = document.querySelectorAll('.sortable-header');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    // Add class to current sorted column
    const currentHeader = document.querySelector(`[onclick="sortPlayersBy('${column}')"]`);
    if (currentHeader) {
        currentHeader.classList.add(`sorted-${egyptTeamsData.currentSortDirection}`);
    }
    
    displayPlayers();
}

function displayPlayers() {
    const tbody = document.getElementById('players-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Check if there's an active search
    const searchInput = document.getElementById('all-players-search');
    const searchTerm = searchInput && searchInput.value ? searchInput.value.toLowerCase().trim() : '';
    
    // Determine which players to display
    let playersToDisplay = egyptTeamsData.players;
    
    // If there's a search term, filter the players
    if (searchTerm) {
        playersToDisplay = egyptTeamsData.players.filter((player) => {
            const playerName = String(player.playerName || '').toLowerCase();
            const matches = String(player.matches || '').toLowerCase();
            const minutes = String(player.minutes || '').toLowerCase();
            const totalGA = String(player.totalGA || '').toLowerCase();
            const officialGoals = String(player.officialGoals || '').toLowerCase();
            const friendlyGoals = String(player.friendlyGoals || '').toLowerCase();
            const officialAssists = String(player.officialAssists || '').toLowerCase();
            const friendlyAssists = String(player.friendlyAssists || '').toLowerCase();
            
            const rowText = `${playerName} ${matches} ${minutes} ${totalGA} ${officialGoals} ${friendlyGoals} ${officialAssists} ${friendlyAssists}`;
            return rowText.includes(searchTerm);
        });
    }
    
    if (playersToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No players found</td></tr>';
        return;
    }
    
    // Sort players based on current sort column and direction
    const sortedPlayers = [...playersToDisplay].sort((a, b) => {
        const column = egyptTeamsData.currentSortColumn;
        const direction = egyptTeamsData.currentSortDirection;
        
        let valueA = a[column];
        let valueB = b[column];
        
        // Handle string sorting (playerName)
        if (column === 'playerName') {
            valueA = (valueA || '').toLowerCase();
            valueB = (valueB || '').toLowerCase();
            if (direction === 'asc') {
                return valueA.localeCompare(valueB);
            } else {
                return valueB.localeCompare(valueA);
            }
        }
        
        // Handle number sorting
        valueA = valueA || 0;
        valueB = valueB || 0;
        
        if (direction === 'asc') {
            return valueA - valueB;
        } else {
            return valueB - valueA;
        }
    });
    
    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(player.playerName)}</strong></td>
            <td style="text-align: center;"><span style="font-weight: 600;">${player.matches}</span></td>
            <td style="text-align: center;"><span style="font-weight: 600;">${player.minutes}</span></td>
            <td style="text-align: center; background-color: #f0f3ff;"><span style="color: #667eea; font-weight: bold; font-size: 1.2rem;">${player.totalGA}</span></td>
            <td style="text-align: center;"><span style="color: #667eea; font-weight: bold; font-size: 1.1rem;">${player.officialGoals}</span></td>
            <td style="text-align: center;"><span style="color: #28a745; font-weight: bold; font-size: 1.1rem;">${player.friendlyGoals}</span></td>
            <td style="text-align: center;"><span style="color: #ff6b35; font-weight: bold; font-size: 1.1rem;">${player.officialAssists}</span></td>
            <td style="text-align: center;"><span style="color: #ffc107; font-weight: bold; font-size: 1.1rem;">${player.friendlyAssists}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

function showPlayersLoading() {
    document.getElementById('players-loading').style.display = 'flex';
    document.getElementById('players-table-container').style.display = 'none';
}

function hidePlayersLoading() {
    document.getElementById('players-loading').style.display = 'none';
    document.getElementById('players-table-container').style.display = 'block';
}

function showPlayersError(message) {
    const tbody = document.getElementById('players-tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align: center; padding: 2rem; color: #dc3545;">
                <strong>${message}</strong>
            </td>
        </tr>
    `;
    hidePlayersLoading();
}

// ============================================================================
// BY PLAYER FUNCTIONS
// ============================================================================

function setupPlayerSearch() {
    const searchInput = document.getElementById('player-search');
    if (!searchInput) return;
    
    // Remove existing listener if any
    searchInput.removeEventListener('input', handlePlayerSearch);
    searchInput.addEventListener('input', handlePlayerSearch);
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        const searchResults = document.getElementById('player-search-results');
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function handlePlayerSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const searchResults = document.getElementById('player-search-results');
    
    if (!searchTerm) {
        searchResults.style.display = 'none';
        return;
    }
    
    // Get unique player names from playerDatabase
    const uniquePlayers = [...new Set(egyptTeamsData.playerDatabase
        .map(p => (p['PLAYER NAME'] || '').trim())
        .filter(name => name && name.toLowerCase().includes(searchTerm))
    )].sort();
    
    if (uniquePlayers.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: #999;">No players found</div>';
        searchResults.style.display = 'block';
        return;
    }
    
    searchResults.innerHTML = uniquePlayers.map(playerName => 
        `<div class="player-search-item" onclick="selectPlayer('${playerName.replace(/'/g, "\\'")}')">${playerName}</div>`
    ).join('');
    
    searchResults.style.display = 'block';
}

function selectPlayer(playerName) {
    egyptTeamsData.selectedPlayer = playerName;
    
    // Hide search results
    document.getElementById('player-search-results').style.display = 'none';
    document.getElementById('player-search').value = playerName;
    
    // Calculate and display player stats
    calculatePlayerIndividualStats(playerName);
    
    // Show player info container
    document.getElementById('player-info-container').style.display = 'block';
    document.getElementById('no-player-selected').style.display = 'none';
    document.getElementById('selected-player-name').textContent = playerName;
}

function calculatePlayerIndividualStats(playerName) {
    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Separate official and friendly match IDs
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const championSystem = match['CHAMPION SYSTEM'] || '';
        const matchId = match['MATCH_ID'] || '';
        if (matchId) {
            if (championSystem === 'OFI') {
                officialMatchIds.add(matchId);
            } else if (championSystem === 'FRI') {
                friendlyMatchIds.add(matchId);
            }
        }
    });
    
    // Calculate matches and minutes from lineup
    const playerMatches = new Set();
    let totalMinutes = 0;
    
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const matchId = (lineup['MATCH_ID'] || '').trim();
        
        if (name === playerName && filteredMatchIds.has(matchId)) {
            playerMatches.add(matchId);
            totalMinutes += parseInt(lineup['MINTOTAL']) || 0;
        }
    });
    
    // Calculate goals and assists
    let officialGoals = 0, friendlyGoals = 0;
    let officialAssists = 0, friendlyAssists = 0;
    let officialBraces = 0, friendlyBraces = 0;
    let officialHattricks = 0, friendlyHattricks = 0;
    let official4Plus = 0, friendly4Plus = 0;
    let officialBracesAssists = 0, friendlyBracesAssists = 0;
    let officialHattricksAssists = 0, friendlyHattricksAssists = 0;
    let official4PlusAssists = 0, friendly4PlusAssists = 0;
    let penaltyGoals = 0;
    let penaltyAssistGoals = 0;
    let penaltyMissed = 0;
    let penaltyAssistMissed = 0;
    let penaltyMakeGoal = 0;
    
    egyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        if (name !== playerName) return;
        
        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        if (!filteredMatchIds.has(matchId)) return;
        
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        const typeValue = (detail['TYPE'] || '').trim();
        
        // Count PENGOAL occurrences (can appear multiple times in one cell)
        if (typeValue) {
            const pengoalMatches = typeValue.match(/PENGOAL/g);
            if (pengoalMatches) {
                penaltyGoals += pengoalMatches.length;
            }
        }
        
        if (gaValue === 'GOAL') {
            if (officialMatchIds.has(matchId)) {
                officialGoals += gatotal;
                // Count braces (exactly 2 goals in one match)
                if (gatotal === 2) officialBraces++;
                // Count hat-tricks (exactly 3 goals in one match)
                if (gatotal === 3) officialHattricks++;
                // Count 4+ goals in one match
                if (gatotal >= 4) official4Plus++;
            }
            if (friendlyMatchIds.has(matchId)) {
                friendlyGoals += gatotal;
                // Count braces (exactly 2 goals in one match)
                if (gatotal === 2) friendlyBraces++;
                // Count hat-tricks (exactly 3 goals in one match)
                if (gatotal === 3) friendlyHattricks++;
                // Count 4+ goals in one match
                if (gatotal >= 4) friendly4Plus++;
            }
        } else if (gaValue === 'PENASSISTGOAL') {
            // Count penalty assist goals (earned penalties that resulted in goals)
            penaltyAssistGoals += gatotal;
        } else if (gaValue === 'PENMISSED') {
            // Count missed penalties
            penaltyMissed += gatotal;
        } else if (gaValue === 'PENASSISTMISSED') {
            // Count earned penalties that were missed
            penaltyAssistMissed += gatotal;
        } else if (gaValue === 'PENMAKEGOAL') {
            // Count penalty make goals
            penaltyMakeGoal += gatotal;
        } else if (gaValue === 'ASSIST') {
            if (officialMatchIds.has(matchId)) {
                officialAssists += gatotal;
                // Count braces (exactly 2 assists in one match)
                if (gatotal === 2) officialBracesAssists++;
                // Count hat-tricks (exactly 3 assists in one match)
                if (gatotal === 3) officialHattricksAssists++;
                // Count 4+ assists in one match
                if (gatotal >= 4) official4PlusAssists++;
            }
            if (friendlyMatchIds.has(matchId)) {
                friendlyAssists += gatotal;
                // Count braces (exactly 2 assists in one match)
                if (gatotal === 2) friendlyBracesAssists++;
                // Count hat-tricks (exactly 3 assists in one match)
                if (gatotal === 3) friendlyHattricksAssists++;
                // Count 4+ assists in one match
                if (gatotal >= 4) friendly4PlusAssists++;
            }
        }
    });
    
    // Helper function to update card and show/hide based on value
    const updateCard = (elementId, value) => {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
            // Show/hide the parent card based on value
            const card = element.closest('.stat-card');
            if (card) {
                if (value > 0) {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            }
        }
    };
    
    // Update stats cards and show/hide based on values
    updateCard('player-total-matches', playerMatches.size);
    updateCard('player-total-minutes', totalMinutes);
    updateCard('player-total-goals', officialGoals + friendlyGoals);
    updateCard('player-total-assists', officialAssists + friendlyAssists);
    updateCard('player-official-goals', officialGoals);
    updateCard('player-friendly-goals', friendlyGoals);
    updateCard('player-official-assists', officialAssists);
    updateCard('player-friendly-assists', friendlyAssists);
    updateCard('player-official-braces', officialBraces);
    updateCard('player-friendly-braces', friendlyBraces);
    updateCard('player-official-hattricks', officialHattricks);
    updateCard('player-friendly-hattricks', friendlyHattricks);
    updateCard('player-official-4plus', official4Plus);
    updateCard('player-friendly-4plus', friendly4Plus);
    updateCard('player-official-braces-assists', officialBracesAssists);
    updateCard('player-friendly-braces-assists', friendlyBracesAssists);
    updateCard('player-official-hattricks-assists', officialHattricksAssists);
    updateCard('player-friendly-hattricks-assists', friendlyHattricksAssists);
    updateCard('player-official-4plus-assists', official4PlusAssists);
    updateCard('player-friendly-4plus-assists', friendly4PlusAssists);
    updateCard('player-penalty-goals', penaltyGoals);
    updateCard('player-penalty-assist-goals', penaltyAssistGoals);
    updateCard('player-penalty-missed', penaltyMissed);
    updateCard('player-penalty-assist-missed', penaltyAssistMissed);
    updateCard('player-penalty-make-goal', penaltyMakeGoal);
    
    // Load player matches
    loadPlayerMatches(playerName, playerMatches);
    
    // Load player championships
    loadPlayerChampionships(playerName, playerMatches);
    
    // Load player seasons
    loadPlayerSeasons(playerName, playerMatches);
    
    // Load player vs teams
    loadPlayerVsTeams(playerName, playerMatches);
    
    // Load player ELNADY stats
    loadPlayerElnadyStats(playerName, playerMatches);
}

function loadPlayerMatches(playerName, playerMatchIds) {
    const tbody = document.getElementById('player-matches-tbody');
    tbody.innerHTML = '';
    
    if (playerMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
        return;
    }
    
    // Get match details for player matches
    const playerMatches = egyptTeamsData.filteredRecords.filter(match => 
        playerMatchIds.has(match['MATCH_ID'])
    ).reverse(); // Latest first
    
    playerMatches.forEach(match => {
        const matchId = match['MATCH_ID'];
        
        // Get minutes from lineup
        const lineupRecord = egyptTeamsData.lineupDetails.find(l => 
            (l['PLAYER NAME'] || '').trim() === playerName && 
            (l['MATCH_ID'] || '').trim() === matchId
        );
        const minutes = lineupRecord ? (parseInt(lineupRecord['MINTOTAL']) || 0) : 0;
        
        // Get goals, assists, and penalty goals
        let goals = 0, assists = 0, penaltyGoals = 0;
        egyptTeamsData.playerDetails.forEach(detail => {
            if ((detail['PLAYER NAME'] || '').trim() === playerName && 
                (detail['MATCH_ID'] || '').trim() === matchId) {
                const gaValue = (detail['GA'] || '').trim();
                const typeValue = (detail['TYPE'] || '').trim();
                const gatotal = parseInt(detail['GATOTAL']) || 0;
                
                if (gaValue === 'GOAL') goals += gatotal;
                if (gaValue === 'ASSIST') assists += gatotal;
                
                // Count PENGOAL occurrences
                if (typeValue) {
                    const pengoalMatches = typeValue.match(/PENGOAL/g);
                    if (pengoalMatches) {
                        penaltyGoals += pengoalMatches.length;
                    }
                }
            }
        });
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${match['DATE'] || ''}</td>
            <td>${match['SEASON'] || ''}</td>
            <td>${match['MANAGER EGY'] || ''}</td>
            <td>${match['OPPONENT TEAM'] || ''}</td>
            <td style="text-align: center;">${minutes}'</td>
            <td style="text-align: center;"><strong style="color: #667eea;">${goals}</strong></td>
            <td style="text-align: center;"><strong style="color: #10b981;">${penaltyGoals}</strong></td>
            <td style="text-align: center;"><strong style="color: #ff6b35;">${assists}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

function loadPlayerChampionships(playerName, playerMatchIds) {
    const tbody = document.getElementById('player-championships-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group stats by championship
    const championshipStats = new Map();
    
    // Get official and friendly match IDs from filtered records
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();
    const matchIdToChampionship = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const championship = (match['CHAMPION'] || 'Unknown').trim();
        
        matchIdToChampionship.set(matchId, championship);
        
        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });
    
    // Get all match IDs where player played (from LINEUPEGYPT)
    const playerPlayedMatchIds = new Set();
    
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
        
        if (name === playerName && matchIdToChampionship.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });
    
    if (playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No championships found</td></tr>';
        return;
    }
    
    // First, get all championships where player has played
    const championshipsWithStats = new Set();
    playerPlayedMatchIds.forEach(matchId => {
        const championship = matchIdToChampionship.get(matchId) || 'Unknown';
        championshipsWithStats.add(championship);
    });
    
    // Calculate stats per championship
    championshipsWithStats.forEach(championship => {
        if (!championshipStats.has(championship)) {
            championshipStats.set(championship, {
                matchesInLineup: new Set(),
                minutes: 0,
                officialGoals: 0,
                friendlyGoals: 0,
                officialAssists: 0,
                friendlyAssists: 0
            });
        }
        
        const stats = championshipStats.get(championship);
        
        // Get ALL matches and minutes from LINEUPEGYPT for this championship
        egyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupChampionship = matchIdToChampionship.get(lineupMatchId);
            
            if (name === playerName && lineupChampionship === championship) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });
        
        // Get goals and assists for matches where player played
        playerPlayedMatchIds.forEach(matchId => {
            if (matchIdToChampionship.get(matchId) !== championship) return;
            
            egyptTeamsData.playerDetails.forEach(detail => {
                const name = (detail['PLAYER NAME'] || '').trim();
                const detailMatchId = (detail['MATCH_ID'] || '').trim();
                
                if (name === playerName && detailMatchId === matchId) {
                    const gaValue = (detail['GA'] || '').trim();
                    const gatotal = parseInt(detail['GATOTAL']) || 0;
                    
                    if (gaValue === 'GOAL') {
                        if (officialMatchIds.has(matchId)) stats.officialGoals += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyGoals += gatotal;
                    } else if (gaValue === 'ASSIST') {
                        if (officialMatchIds.has(matchId)) stats.officialAssists += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyAssists += gatotal;
                    }
                }
            });
        });
    });
    
    // Convert to array and sort by G+A (descending), then by Matches (descending)
    const championshipArray = Array.from(championshipStats.entries()).map(([championship, stats]) => {
        const totalGA = stats.officialGoals + stats.friendlyGoals + stats.officialAssists + stats.friendlyAssists;
        return {
            championship,
            matches: stats.matchesInLineup.size,  // Count only matches from LINEUPEGYPT
            minutes: stats.minutes,
            totalGA,
            officialGoals: stats.officialGoals,
            friendlyGoals: stats.friendlyGoals,
            officialAssists: stats.officialAssists,
            friendlyAssists: stats.friendlyAssists
        };
    }).sort((a, b) => {
        if (b.totalGA !== a.totalGA) return b.totalGA - a.totalGA;
        return b.matches - a.matches;
    });
    
    // Display championships
    championshipArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.championship}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.minutes}'</td>
            <td style="text-align: center;"><strong style="color: #667eea; font-size: 1.4rem;">${stats.totalGA}</strong></td>
            <td style="text-align: center; color: ${stats.officialGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.officialGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialGoals}</td>
            <td style="text-align: center; color: ${stats.friendlyGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.friendlyGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyGoals}</td>
            <td style="text-align: center; color: ${stats.officialAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.officialAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialAssists}</td>
            <td style="text-align: center; color: ${stats.friendlyAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.friendlyAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyAssists}</td>
        `;
    });
}

function loadPlayerSeasons(playerName, playerMatchIds) {
    const tbody = document.getElementById('player-seasons-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group stats by season
    const seasonStats = new Map();
    
    // Get official and friendly match IDs from filtered records
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();
    const matchIdToSeason = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const season = (match['SEASON'] || 'Unknown').trim();
        
        matchIdToSeason.set(matchId, season);
        
        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });
    
    // Get all match IDs where player played (from LINEUPEGYPT)
    const playerPlayedMatchIds = new Set();
    
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
        
        if (name === playerName && matchIdToSeason.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });
    
    if (playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No seasons found</td></tr>';
        return;
    }
    
    // First, get all seasons where player has played
    const seasonsWithStats = new Set();
    playerPlayedMatchIds.forEach(matchId => {
        const season = matchIdToSeason.get(matchId) || 'Unknown';
        seasonsWithStats.add(season);
    });
    
    // Calculate stats per season
    seasonsWithStats.forEach(season => {
        if (!seasonStats.has(season)) {
            seasonStats.set(season, {
                matchesInLineup: new Set(),
                minutes: 0,
                officialGoals: 0,
                friendlyGoals: 0,
                officialAssists: 0,
                friendlyAssists: 0
            });
        }
        
        const stats = seasonStats.get(season);
        
        // Get ALL matches and minutes from LINEUPEGYPT for this season
        egyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupSeason = matchIdToSeason.get(lineupMatchId);
            
            if (name === playerName && lineupSeason === season) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });
        
        // Get goals and assists for matches where player played
        playerPlayedMatchIds.forEach(matchId => {
            if (matchIdToSeason.get(matchId) !== season) return;
            
            egyptTeamsData.playerDetails.forEach(detail => {
                const name = (detail['PLAYER NAME'] || '').trim();
                const detailMatchId = (detail['MATCH_ID'] || '').trim();
                
                if (name === playerName && detailMatchId === matchId) {
                    const gaValue = (detail['GA'] || '').trim();
                    const gatotal = parseInt(detail['GATOTAL']) || 0;
                    
                    if (gaValue === 'GOAL') {
                        if (officialMatchIds.has(matchId)) stats.officialGoals += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyGoals += gatotal;
                    } else if (gaValue === 'ASSIST') {
                        if (officialMatchIds.has(matchId)) stats.officialAssists += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyAssists += gatotal;
                    }
                }
            });
        });
    });
    
    // Convert to array and sort alphabetically (newest first - reverse alphabetical by year)
    const seasonArray = Array.from(seasonStats.entries()).map(([season, stats]) => {
        const totalGA = stats.officialGoals + stats.friendlyGoals + stats.officialAssists + stats.friendlyAssists;
        return {
            season,
            matches: stats.matchesInLineup.size,
            minutes: stats.minutes,
            totalGA,
            officialGoals: stats.officialGoals,
            friendlyGoals: stats.friendlyGoals,
            officialAssists: stats.officialAssists,
            friendlyAssists: stats.friendlyAssists
        };
    }).sort((a, b) => {
        // Sort alphabetically in reverse order (newest first)
        // This will put "World Cup Qualifiers 2026" before "World Cup Qualifiers 2022"
        return b.season.localeCompare(a.season);
    });
    
    // Display seasons
    seasonArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.season}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.minutes}'</td>
            <td style="text-align: center;"><strong style="color: #667eea; font-size: 1.4rem;">${stats.totalGA}</strong></td>
            <td style="text-align: center; color: ${stats.officialGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.officialGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialGoals}</td>
            <td style="text-align: center; color: ${stats.friendlyGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.friendlyGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyGoals}</td>
            <td style="text-align: center; color: ${stats.officialAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.officialAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialAssists}</td>
            <td style="text-align: center; color: ${stats.friendlyAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.friendlyAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyAssists}</td>
        `;
    });
}

function loadPlayerVsTeams(playerName, playerMatchIds) {
    const tbody = document.getElementById('player-vsteams-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group stats by opponent team
    const teamStats = new Map();
    
    // Get official and friendly match IDs from filtered records
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();
    const matchIdToOpponent = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const opponent = (match['OPPONENT TEAM'] || 'Unknown').trim();
        
        matchIdToOpponent.set(matchId, opponent);
        
        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });
    
    // Get all match IDs where player played (from LINEUPEGYPT)
    const playerPlayedMatchIds = new Set();
    
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
        
        if (name === playerName && matchIdToOpponent.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });
    
    if (playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No opponent teams found</td></tr>';
        return;
    }
    
    // First, get all opponent teams where player has played
    const opponentsWithStats = new Set();
    playerPlayedMatchIds.forEach(matchId => {
        const opponent = matchIdToOpponent.get(matchId) || 'Unknown';
        opponentsWithStats.add(opponent);
    });
    
    // Calculate stats per opponent team
    opponentsWithStats.forEach(opponent => {
        if (!teamStats.has(opponent)) {
            teamStats.set(opponent, {
                matchesInLineup: new Set(),
                minutes: 0,
                officialGoals: 0,
                friendlyGoals: 0,
                officialAssists: 0,
                friendlyAssists: 0
            });
        }
        
        const stats = teamStats.get(opponent);
        
        // Get ALL matches and minutes from LINEUPEGYPT for this opponent
        egyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupOpponent = matchIdToOpponent.get(lineupMatchId);
            
            if (name === playerName && lineupOpponent === opponent) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });
        
        // Get goals and assists for matches where player played
        playerPlayedMatchIds.forEach(matchId => {
            if (matchIdToOpponent.get(matchId) !== opponent) return;
            
            egyptTeamsData.playerDetails.forEach(detail => {
                const name = (detail['PLAYER NAME'] || '').trim();
                const detailMatchId = (detail['MATCH_ID'] || '').trim();
                
                if (name === playerName && detailMatchId === matchId) {
                    const gaValue = (detail['GA'] || '').trim();
                    const gatotal = parseInt(detail['GATOTAL']) || 0;
                    
                    if (gaValue === 'GOAL') {
                        if (officialMatchIds.has(matchId)) stats.officialGoals += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyGoals += gatotal;
                    } else if (gaValue === 'ASSIST') {
                        if (officialMatchIds.has(matchId)) stats.officialAssists += gatotal;
                        if (friendlyMatchIds.has(matchId)) stats.friendlyAssists += gatotal;
                    }
                }
            });
        });
    });
    
    // Convert to array and sort by G+A (descending), then by Matches (descending)
    const teamArray = Array.from(teamStats.entries()).map(([opponent, stats]) => {
        const totalGA = stats.officialGoals + stats.friendlyGoals + stats.officialAssists + stats.friendlyAssists;
        return {
            opponent,
            matches: stats.matchesInLineup.size,
            minutes: stats.minutes,
            totalGA,
            officialGoals: stats.officialGoals,
            friendlyGoals: stats.friendlyGoals,
            officialAssists: stats.officialAssists,
            friendlyAssists: stats.friendlyAssists
        };
    }).sort((a, b) => {
        if (b.totalGA !== a.totalGA) return b.totalGA - a.totalGA;
        return b.matches - a.matches;
    });
    
    // Display opponent teams
    teamArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.opponent}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.minutes}'</td>
            <td style="text-align: center;"><strong style="color: #667eea; font-size: 1.4rem;">${stats.totalGA}</strong></td>
            <td style="text-align: center; color: ${stats.officialGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.officialGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialGoals}</td>
            <td style="text-align: center; color: ${stats.friendlyGoals > 0 ? '#10b981' : '#9ca3af'}; font-weight: ${stats.friendlyGoals > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyGoals}</td>
            <td style="text-align: center; color: ${stats.officialAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.officialAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.officialAssists}</td>
            <td style="text-align: center; color: ${stats.friendlyAssists > 0 ? '#f59e0b' : '#9ca3af'}; font-weight: ${stats.friendlyAssists > 0 ? 'bold' : 'normal'}; font-size: 1.4rem;">${stats.friendlyAssists}</td>
        `;
    });
}

async function loadPlayerElnadyStats(playerName, playerMatchIds) {
    const container = document.getElementById('player-elnady-cards');
    if (!container) return;
    
    container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999; grid-column: 1 / -1;">Loading...</div>';
    
    // Load player details if not already loaded
    if (!egyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }
    
    // Check if playerDetails is available
    if (!egyptTeamsData.playerDetails || egyptTeamsData.playerDetails.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999; grid-column: 1 / -1;">No data available</div>';
        return;
    }
    
    container.innerHTML = '';
    
    // Group goals by ELNADY (club)
    const clubGoals = {};
    
    // Get all clubs from LINEUPEGYPT where player played
    egyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        if (name !== playerName) return;
        
        const elnady = (lineup['ELNADY'] || '').trim();
        if (elnady && !clubGoals[elnady]) {
            clubGoals[elnady] = 0;
        }
    });
    
    // Count goals for each club
    egyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        if (name !== playerName) return;
        
        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        const elnady = (detail['ELNADY'] || '').trim();
        
        // Count ALL goals for this player
        if (gaValue === 'GOAL' && elnady) {
            const gatotal = parseInt(detail['GATOTAL']) || 0;
            clubGoals[elnady] = (clubGoals[elnady] || 0) + gatotal;
        }
    });
    
    // Convert to array and sort by goals descending, then by club name ascending
    const clubsArray = Object.entries(clubGoals).map(([club, goals]) => ({
        club,
        goals
    })).sort((a, b) => {
        // First: Sort by goals (highest first)
        if (a.goals !== b.goals) {
            return b.goals - a.goals;
        }
        // Second: Sort by club name (alphabetical)
        return a.club.localeCompare(b.club);
    });
    
    if (clubsArray.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999; grid-column: 1 / -1;">No club data available</div>';
        return;
    }
    
    // Create card for each club
    clubsArray.forEach(clubData => {
        const card = document.createElement('div');
        card.className = 'elnady-club-card';
        card.innerHTML = `
            <div class="elnady-club-name">${clubData.club}</div>
            <div class="elnady-club-goals">${clubData.goals}</div>
            <div class="elnady-club-label">Goals</div>
        `;
        container.appendChild(card);
    });
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

// Main tabs switching (compatible with showStatsTab(event, 'name') and showStatsTab('name'))
function showStatsTab(arg1, arg2) {
    const isEvent = arg1 && typeof arg1 === 'object' && typeof arg1.preventDefault === 'function';
    const evt = isEvent ? arg1 : null;
    const tabName = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : 'search');

    // Hide all tab contents
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content (fallback to search if missing)
    const selectedTab = document.getElementById(`${tabName}-tab`) || document.getElementById('search-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked tab (support clicks on nested SVG)
    const clickedBtn = evt && evt.target && evt.target.closest ? evt.target.closest('button.stats-tab') : null;
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    } else {
        const btn = document.querySelector(`.stats-tab[onclick*="'${tabName}'"]`) || document.querySelector(`.stats-tab[onclick*="'search'"]`);
        if (btn) btn.classList.add('active');
    }
    
    // Load specific data for each tab
    if (tabName === 'search') {
        // Load player details and lineup if not already loaded
        if (!egyptTeamsData.playersLoaded) {
            loadPlayersData();
        }
    } else if (tabName === 'h2h') {
        loadH2HStats();
    } else if (tabName === 'managers') {
        loadManagersStats();
    } else if (tabName === 'referees') {
        // Load only PLAYERDETAILS if not already loaded (needed for penalty counting)
        if (!egyptTeamsData.playerDetailsLoaded) {
            loadPlayerDetailsOnly().then(() => {
                loadRefereesStats();
            });
        } else {
            loadRefereesStats();
        }
    } else if (tabName === 'players') {
        // Load players data if not already loaded
        if (!egyptTeamsData.playersLoaded) {
            loadPlayersData();
        }
    } else if (tabName === 'byplayer') {
        // Setup player search if not already setup
        setupPlayerSearch();
    } else if (tabName === 'goalkeepers') {
        // Load goalkeepers data if not already loaded
        if (!egyptTeamsData.playersLoaded) {
            loadPlayersData().then(() => {
                loadGoalkeepersStats();
            });
        } else {
            loadGoalkeepersStats();
        }
    } else if (tabName === 'bygoalkeepers') {
        // Load player details if not already loaded (needed for gkDetails)
        if (!egyptTeamsData.playerDetailsLoaded) {
            loadPlayerDetailsOnly().then(() => {
                setupGoalkeeperSearch();
            });
        } else {
            setupGoalkeeperSearch();
        }
    } else if (tabName === 'elnady') {
        // Load all clubs stats by default
        loadAllClubsStats();
    } else if (tabName === 'mainstats') {
        // Load main stats championships by default
        loadMainStatsChampionships();
    }
}

// Keep the old function name for backward compatibility
function switchTab(tabName) {
    showStatsTab(tabName);
}

function switchPlayerTab(tabName) {
    // Remove active class from player tab buttons
    const playerTabButtons = document.querySelectorAll('#player-info-container .tab-button');
    playerTabButtons.forEach(button => button.classList.remove('active'));
    
    // Hide all player tab contents
    document.querySelectorAll('#player-overview-tab, #player-matches-tab, #player-championships-tab, #player-seasons-tab, #player-vsteams-tab, #player-elnady-tab').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'player-overview') {
        document.getElementById('player-overview-tab').classList.add('active');
        playerTabButtons[0].classList.add('active');
    } else if (tabName === 'player-matches') {
        document.getElementById('player-matches-tab').classList.add('active');
        playerTabButtons[1].classList.add('active');
    } else if (tabName === 'player-championships') {
        document.getElementById('player-championships-tab').classList.add('active');
        playerTabButtons[2].classList.add('active');
    } else if (tabName === 'player-seasons') {
        document.getElementById('player-seasons-tab').classList.add('active');
        playerTabButtons[3].classList.add('active');
    } else if (tabName === 'player-vsteams') {
        document.getElementById('player-vsteams-tab').classList.add('active');
        playerTabButtons[4].classList.add('active');
    } else if (tabName === 'player-elnady') {
        document.getElementById('player-elnady-tab').classList.add('active');
        playerTabButtons[5].classList.add('active');
    }
}

// Store full stats for search filtering
let h2hFullStats = [];
let egyptManagersFullStats = [];
let opponentManagersFullStats = [];
let refereesFullStats = [];

function loadH2HStats() {
    const tbody = document.getElementById('h2h-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!egyptTeamsData.filteredRecords || egyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    // Group stats by opponent team
    const h2hStats = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const opponent = (match['OPPONENT TEAM'] || 'Unknown').trim();
        const wdl = (match['W-D-L'] || '').trim().toUpperCase();
        const gf = parseInt(match['GF']) || 0;
        const ga = parseInt(match['GA']) || 0;
        
        if (!h2hStats.has(opponent)) {
            h2hStats.set(opponent, {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheetFor: 0,
                cleanSheetAgainst: 0
            });
        }
        
        const stats = h2hStats.get(opponent);
        stats.matches++;
        stats.goalsFor += gf;
        stats.goalsAgainst += ga;
        
        // Count W-D-L
        if (wdl === 'W') stats.wins++;
        else if (wdl === 'D' || wdl === 'D.' || wdl === 'D WITH G') stats.draws++;
        else if (wdl === 'L') stats.losses++;
        
        // Count clean sheets
        if (ga === 0) stats.cleanSheetFor++;
        if (gf === 0) stats.cleanSheetAgainst++;
    });
    
    // Convert to array and sort by matches count
    h2hFullStats = Array.from(h2hStats.entries()).map(([opponent, stats]) => ({
        opponent,
        ...stats,
        goalDifference: stats.goalsFor - stats.goalsAgainst
    })).sort((a, b) => b.matches - a.matches);
    
    // Display H2H stats
    displayH2HStats(h2hFullStats);
    
    // Setup search listener
    setupH2HSearch();
}

function displayH2HStats(statsArray) {
    const tbody = document.getElementById('h2h-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No teams found</td></tr>';
        return;
    }
    
    statsArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.opponent}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #667eea;">${stats.goalsFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.goalsAgainst}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: ${stats.goalDifference > 0 ? '#10b981' : stats.goalDifference < 0 ? '#ef4444' : '#6b7280'};">${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.cleanSheetFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.cleanSheetAgainst}</td>
        `;
    });
}

function setupH2HSearch() {
    const searchInput = document.getElementById('h2h-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displayH2HStats(h2hFullStats);
            return;
        }
        
        const filtered = h2hFullStats.filter(stats => 
            stats.opponent.toLowerCase().includes(searchTerm)
        );
        
        displayH2HStats(filtered);
    });
}

function loadManagersStats() {
    loadEgyptManagersStats();
    loadOpponentManagersStats();
    setupManagersSearch();
}

function switchManagersTab(tabName) {
    // Hide all managers sub-tabs
    document.querySelectorAll('#managers-tab .tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from managers sub-tab buttons
    document.querySelectorAll('#managers-tab .tabs-header .tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'egypt') {
        document.getElementById('egypt-managers-tab').classList.add('active');
        document.querySelectorAll('#managers-tab .tabs-header .tab-button')[0].classList.add('active');
    } else if (tabName === 'opponent') {
        document.getElementById('opponent-managers-tab').classList.add('active');
        document.querySelectorAll('#managers-tab .tabs-header .tab-button')[1].classList.add('active');
    }
}

function loadEgyptManagersStats() {
    const tbody = document.getElementById('egypt-managers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!egyptTeamsData.filteredRecords || egyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    // Group stats by Egypt manager
    const managersStats = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const manager = (match['MANAGER EGY'] || 'Unknown').trim();
        const wdl = (match['W-D-L'] || '').trim().toUpperCase();
        const gf = parseInt(match['GF']) || 0;
        const ga = parseInt(match['GA']) || 0;
        
        if (!managersStats.has(manager)) {
            managersStats.set(manager, {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheetFor: 0,
                cleanSheetAgainst: 0
            });
        }
        
        const stats = managersStats.get(manager);
        stats.matches++;
        stats.goalsFor += gf;
        stats.goalsAgainst += ga;
        
        // Count W-D-L
        if (wdl === 'W') stats.wins++;
        else if (wdl === 'D' || wdl === 'D.' || wdl === 'D WITH G') stats.draws++;
        else if (wdl === 'L') stats.losses++;
        
        // Count clean sheets
        if (ga === 0) stats.cleanSheetFor++;
        if (gf === 0) stats.cleanSheetAgainst++;
    });
    
    // Convert to array and sort by matches count
    egyptManagersFullStats = Array.from(managersStats.entries()).map(([manager, stats]) => ({
        manager,
        ...stats,
        goalDifference: stats.goalsFor - stats.goalsAgainst
    })).sort((a, b) => b.matches - a.matches);
    
    // Display managers stats
    displayEgyptManagersStats(egyptManagersFullStats);
}

function displayEgyptManagersStats(statsArray) {
    const tbody = document.getElementById('egypt-managers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No managers found</td></tr>';
        return;
    }
    
    // Calculate totals
    let totalMatches = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0, totalCleanSheetFor = 0, totalCleanSheetAgainst = 0;
    
    statsArray.forEach(stats => {
        totalMatches += stats.matches;
        totalWins += stats.wins;
        totalDraws += stats.draws;
        totalLosses += stats.losses;
        totalGoalsFor += stats.goalsFor;
        totalGoalsAgainst += stats.goalsAgainst;
        totalCleanSheetFor += stats.cleanSheetFor;
        totalCleanSheetAgainst += stats.cleanSheetAgainst;
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.manager}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #667eea;">${stats.goalsFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.goalsAgainst}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: ${stats.goalDifference > 0 ? '#10b981' : stats.goalDifference < 0 ? '#ef4444' : '#6b7280'};">${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.cleanSheetFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.cleanSheetAgainst}</td>
        `;
    });
    
    // Add total row
    const totalGD = totalGoalsFor - totalGoalsAgainst;
    const totalRow = tbody.insertRow();
    totalRow.style.backgroundColor = '#f3f4f6';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td style="font-weight: 700; color: #1f2937;">Total</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #1f2937;">${totalMatches}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalWins}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${totalDraws}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalLosses}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #667eea;">${totalGoalsFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalGoalsAgainst}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: ${totalGD > 0 ? '#10b981' : totalGD < 0 ? '#ef4444' : '#6b7280'};">${totalGD > 0 ? '+' : ''}${totalGD}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalCleanSheetFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalCleanSheetAgainst}</td>
    `;
}

function loadOpponentManagersStats() {
    const tbody = document.getElementById('opponent-managers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!egyptTeamsData.filteredRecords || egyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    // Group stats by opponent manager
    const managersStats = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const manager = (match['MANAGER OPPONENT'] || 'Unknown').trim();
        const wdl = (match['W-D-L'] || '').trim().toUpperCase();
        const gf = parseInt(match['GF']) || 0;
        const ga = parseInt(match['GA']) || 0;
        
        if (!managersStats.has(manager)) {
            managersStats.set(manager, {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheetFor: 0,
                cleanSheetAgainst: 0
            });
        }
        
        const stats = managersStats.get(manager);
        stats.matches++;
        stats.goalsFor += gf;
        stats.goalsAgainst += ga;
        
        // Count W-D-L
        if (wdl === 'W') stats.wins++;
        else if (wdl === 'D' || wdl === 'D.' || wdl === 'D WITH G') stats.draws++;
        else if (wdl === 'L') stats.losses++;
        
        // Count clean sheets
        if (ga === 0) stats.cleanSheetFor++;
        if (gf === 0) stats.cleanSheetAgainst++;
    });
    
    // Convert to array and sort by matches count
    opponentManagersFullStats = Array.from(managersStats.entries()).map(([manager, stats]) => ({
        manager,
        ...stats,
        goalDifference: stats.goalsFor - stats.goalsAgainst
    })).sort((a, b) => b.matches - a.matches);
    
    // Display managers stats
    displayOpponentManagersStats(opponentManagersFullStats);
}

function displayOpponentManagersStats(statsArray) {
    const tbody = document.getElementById('opponent-managers-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No managers found</td></tr>';
        return;
    }
    
    // Calculate totals
    let totalMatches = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0, totalCleanSheetFor = 0, totalCleanSheetAgainst = 0;
    
    statsArray.forEach(stats => {
        totalMatches += stats.matches;
        totalWins += stats.wins;
        totalDraws += stats.draws;
        totalLosses += stats.losses;
        totalGoalsFor += stats.goalsFor;
        totalGoalsAgainst += stats.goalsAgainst;
        totalCleanSheetFor += stats.cleanSheetFor;
        totalCleanSheetAgainst += stats.cleanSheetAgainst;
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.manager}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #667eea;">${stats.goalsFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.goalsAgainst}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: ${stats.goalDifference > 0 ? '#10b981' : stats.goalDifference < 0 ? '#ef4444' : '#6b7280'};">${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.cleanSheetFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.cleanSheetAgainst}</td>
        `;
    });
    
    // Add total row
    const totalGD = totalGoalsFor - totalGoalsAgainst;
    const totalRow = tbody.insertRow();
    totalRow.style.backgroundColor = '#f3f4f6';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td style="font-weight: 700; color: #1f2937;">Total</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #1f2937;">${totalMatches}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalWins}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${totalDraws}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalLosses}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #667eea;">${totalGoalsFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalGoalsAgainst}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: ${totalGD > 0 ? '#10b981' : totalGD < 0 ? '#ef4444' : '#6b7280'};">${totalGD > 0 ? '+' : ''}${totalGD}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalCleanSheetFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalCleanSheetAgainst}</td>
    `;
}

function setupManagersSearch() {
    const searchInput = document.getElementById('managers-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        // Filter Egypt managers
        const filteredEgypt = searchTerm 
            ? egyptManagersFullStats.filter(stats => stats.manager.toLowerCase().includes(searchTerm))
            : egyptManagersFullStats;
        
        // Filter opponent managers
        const filteredOpponent = searchTerm 
            ? opponentManagersFullStats.filter(stats => stats.manager.toLowerCase().includes(searchTerm))
            : opponentManagersFullStats;
        
        displayEgyptManagersStats(filteredEgypt);
        displayOpponentManagersStats(filteredOpponent);
    });
}

function loadRefereesStats() {
    const tbody = document.getElementById('referees-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!egyptTeamsData.filteredRecords || egyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    // Group stats by referee
    const refereesStats = new Map();
    
    // Create a set of filtered match IDs for quick lookup
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(m => m['MATCH_ID']));
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const referee = (match['REFREE'] || 'Unknown').trim();
        const wdl = (match['W-D-L'] || '').trim().toUpperCase();
        const matchId = match['MATCH_ID'];
        
        if (!refereesStats.has(referee)) {
            refereesStats.set(referee, {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                penaltiesFor: 0,
                penaltiesAgainst: 0,
                matchIds: new Set()
            });
        }
        
        const stats = refereesStats.get(referee);
        stats.matches++;
        stats.matchIds.add(matchId);
        
        // Count W-D-L
        if (wdl === 'W') stats.wins++;
        else if (wdl === 'D' || wdl === 'D.' || wdl === 'D WITH G') stats.draws++;
        else if (wdl === 'L') stats.losses++;
    });
    
    // Count penalties from PLAYERDETAILS for each referee
    if (egyptTeamsData.playerDetails && egyptTeamsData.playerDetails.length > 0) {
        egyptTeamsData.playerDetails.forEach(detail => {
            const matchId = (detail['MATCH_ID'] || '').trim();
            const typeValue = (detail['TYPE'] || '').trim();
            const gaValue = (detail['GA'] || '').trim().toUpperCase();
            const teamValue = (detail['TEAM'] || '').trim().toUpperCase();
            const gatotal = parseInt(detail['GATOTAL']) || 0;
            
            // Only process if this match is in filtered matches
            if (!filteredMatchIds.has(matchId)) return;
            
            let penaltyCount = 0;
            
            // Count PENGOAL occurrences in TYPE column (scored penalties)
            if (typeValue) {
                const pengoalMatches = typeValue.match(/PENGOAL/g);
                if (pengoalMatches) {
                    penaltyCount += pengoalMatches.length;
                }
            }
            
            // Count PENMISSED in GA column (missed penalties)
            if (gaValue === 'PENMISSED') {
                penaltyCount += gatotal;
            }
            
            // Add to referee stats
            if (penaltyCount > 0) {
                // Find which referee handled this match
                refereesStats.forEach((stats, refereeName) => {
                    if (stats.matchIds.has(matchId)) {
                        // If team is EGYPT, count as penalties for
                        if (teamValue === 'EGYPT') {
                            stats.penaltiesFor += penaltyCount;
                        } else {
                            // Otherwise count as penalties against
                            stats.penaltiesAgainst += penaltyCount;
                        }
                    }
                });
            }
        });
    }
    
    // Convert to array and sort by matches count
    refereesFullStats = Array.from(refereesStats.entries()).map(([referee, stats]) => ({
        referee,
        matches: stats.matches,
        wins: stats.wins,
        draws: stats.draws,
        losses: stats.losses,
        penaltiesFor: stats.penaltiesFor,
        penaltiesAgainst: stats.penaltiesAgainst
    })).sort((a, b) => b.matches - a.matches);
    
    // Display referees stats
    displayRefereesStats(refereesFullStats);
    
    // Setup search listener
    setupRefereesSearch();
}

function displayRefereesStats(statsArray) {
    const tbody = document.getElementById('referees-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (statsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No referees found</td></tr>';
        return;
    }
    
    // Calculate totals
    let totalMatches = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalPenaltiesFor = 0, totalPenaltiesAgainst = 0;
    
    statsArray.forEach(stats => {
        totalMatches += stats.matches;
        totalWins += stats.wins;
        totalDraws += stats.draws;
        totalLosses += stats.losses;
        totalPenaltiesFor += stats.penaltiesFor;
        totalPenaltiesAgainst += stats.penaltiesAgainst;
        
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.referee}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.penaltiesFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.penaltiesAgainst}</td>
        `;
    });
    
    // Add total row
    const totalRow = tbody.insertRow();
    totalRow.style.backgroundColor = '#f3f4f6';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td style="font-weight: 700; color: #1f2937;">Total</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #1f2937;">${totalMatches}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalWins}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${totalDraws}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalLosses}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalPenaltiesFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalPenaltiesAgainst}</td>
    `;
}

function setupRefereesSearch() {
    const searchInput = document.getElementById('referees-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        
        if (!searchTerm) {
            displayRefereesStats(refereesFullStats);
            return;
        }
        
        const filtered = refereesFullStats.filter(stats => 
            stats.referee.toLowerCase().includes(searchTerm)
        );
        
        displayRefereesStats(filtered);
    });
}

// ============================================================================
// ELNADY TAB FUNCTIONS
// ============================================================================

function switchElnadyTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('#elnady-tab > .tabs-header .tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.getElementById('elnady-all-clubs-tab').classList.remove('active');
    document.getElementById('elnady-by-club-tab').classList.remove('active');
    
    if (tabName === 'all-clubs') {
        document.getElementById('elnady-all-clubs-tab').classList.add('active');
        loadAllClubsStats();
    } else if (tabName === 'by-club') {
        document.getElementById('elnady-by-club-tab').classList.add('active');
        // Setup search if not already done
        setupElnadySearch();
    }
}

let allClubsFullData = [];
let allClubsSearchSetup = false;

async function loadAllClubsStats() {
    // Load player details if not already loaded
    if (!egyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Calculate goals and unique players per club (only from filtered matches)
    const clubGoals = {};
    const clubPlayers = {};
    
    egyptTeamsData.playerDetails.forEach(detail => {
        const elnady = (detail['ELNADY'] || '').trim();
        const playerName = (detail['PLAYER NAME'] || '').trim();
        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        
        if (!elnady || !filteredMatchIds.has(matchId)) return;
        
        // Count goals
        if (gaValue === 'GOAL') {
            clubGoals[elnady] = (clubGoals[elnady] || 0) + gatotal;
        }
        
        // Track unique players
        if (playerName) {
            if (!clubPlayers[elnady]) {
                clubPlayers[elnady] = new Set();
            }
            clubPlayers[elnady].add(playerName);
        }
    });
    
    // Convert to array and sort by goals descending
    allClubsFullData = Object.entries(clubGoals).map(([club, goals]) => ({
        club,
        players: clubPlayers[club] ? clubPlayers[club].size : 0,
        goals
    })).sort((a, b) => b.goals - a.goals);
    
    // Setup search if not already setup
    if (!allClubsSearchSetup) {
        setupAllClubsSearch();
        allClubsSearchSetup = true;
    }
    
    // Display all clubs
    displayAllClubs(allClubsFullData);
}

function setupAllClubsSearch() {
    const searchInput = document.getElementById('all-clubs-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // Show all clubs if search is empty
            displayAllClubs(allClubsFullData);
            return;
        }
        
        // Filter clubs by search term
        const filtered = allClubsFullData.filter(club => 
            club.club.toLowerCase().includes(searchTerm)
        );
        
        displayAllClubs(filtered);
    });
}

function displayAllClubs(clubsArray) {
    const tbody = document.getElementById('all-clubs-tbody');
    tbody.innerHTML = '';
    
    if (clubsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem;">No clubs found</td></tr>';
        return;
    }
    
    // Calculate totals
    let totalPlayers = 0;
    let totalGoals = 0;
    const uniquePlayers = new Set();
    
    clubsArray.forEach((club, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${club.club}</strong></td>
            <td style="text-align: center; font-weight: 600;">${club.players}</td>
            <td style="text-align: center; font-weight: 600;">${club.goals}</td>
        `;
        tbody.appendChild(row);
        
        // Accumulate totals
        totalPlayers += club.players;
        totalGoals += club.goals;
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.fontWeight = 'bold';
    totalRow.style.borderTop = '3px solid #667eea';
    totalRow.innerHTML = `
        <td style="text-align: center; font-weight: 700; color: #667eea;">TOTAL</td>
        <td style="text-align: center; font-weight: 700; color: #667eea;">${totalPlayers}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea;">${totalGoals}</td>
    `;
    tbody.appendChild(totalRow);
}

let elnadySearchSetup = false;
let currentElnadyOptions = [];

async function setupElnadySearch() {
    // Load player details if not already loaded
    if (!egyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Extract unique ELNADY values (only from filtered matches)
    const elnadyValues = new Set();
    egyptTeamsData.playerDetails.forEach(detail => {
        const elnady = (detail['ELNADY'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        if (elnady && filteredMatchIds.has(matchId)) {
            elnadyValues.add(elnady);
        }
    });
    
    currentElnadyOptions = Array.from(elnadyValues).sort();
    
    // Setup searchable select (only once)
    if (!elnadySearchSetup) {
        const input = document.getElementById('elnady-search');
        const container = input.closest('.searchable-select-container');
        const dropdown = container.querySelector('.dropdown-options');
        
        // Setup event listeners
        input.addEventListener('focus', function() {
            showElnadyDropdownOptions(input, currentElnadyOptions);
        });
        
        input.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const filtered = currentElnadyOptions.filter(opt => opt.toLowerCase().includes(searchTerm));
            showElnadyDropdownOptions(input, filtered);
        });
        
        // Handle clicking outside to close dropdown
        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        elnadySearchSetup = true;
    }
}

// Show ELNADY dropdown options with custom behavior
function showElnadyDropdownOptions(input, options) {
    const container = input.closest('.searchable-select-container');
    const dropdown = container.querySelector('.dropdown-options');
    
    dropdown.innerHTML = '';
    
    // Add "All" option
    const allOption = document.createElement('div');
    allOption.className = 'dropdown-option';
    allOption.textContent = 'All';
    allOption.addEventListener('click', function() {
        input.value = '';
        dropdown.style.display = 'none';
        document.getElementById('elnady-club-content').style.display = 'none';
        document.getElementById('no-club-selected').style.display = 'block';
    });
    dropdown.appendChild(allOption);

    // Add filtered options
    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'dropdown-option';
        optionDiv.textContent = option;
        optionDiv.addEventListener('click', function() {
            input.value = option;
            dropdown.style.display = 'none';
            // Load club stats immediately when option is clicked
            loadClubStats(option);
        });
        dropdown.appendChild(optionDiv);
    });

    dropdown.style.display = 'block';
}

function switchClubTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('#elnady-club-content .tabs-header .tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.getElementById('club-players-tab').classList.remove('active');
    document.getElementById('club-championships-tab').classList.remove('active');
    document.getElementById('club-seasons-tab').classList.remove('active');
    document.getElementById('club-opponents-tab').classList.remove('active');
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function loadClubStats(clubName) {
    // Show club content
    document.getElementById('elnady-club-content').style.display = 'block';
    document.getElementById('no-club-selected').style.display = 'none';
    document.getElementById('selected-club-name').textContent = clubName;
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Filter player details for this club AND filtered matches
    const clubDetails = egyptTeamsData.playerDetails.filter(detail => {
        const elnady = (detail['ELNADY'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        return elnady === clubName && filteredMatchIds.has(matchId);
    });
    
    // Calculate players stats
    const playersGoals = {};
    clubDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        const gaValue = (detail['GA'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        
        if (playerName && gaValue === 'GOAL') {
            playersGoals[playerName] = (playersGoals[playerName] || 0) + gatotal;
        }
    });
    
    const playersArray = Object.entries(playersGoals).map(([player, goals]) => ({
        player,
        goals
    })).sort((a, b) => b.goals - a.goals);
    
    displayClubPlayers(playersArray);
    
    // Calculate championships stats
    const championshipsGoals = {};
    clubDetails.forEach(detail => {
        const gaValue = (detail['GA'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        if (gaValue === 'GOAL' && matchId) {
            // Find match to get championship
            const match = egyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
            if (match) {
                const champion = (match['CHAMPION'] || '').trim();
                if (champion) {
                    championshipsGoals[champion] = (championshipsGoals[champion] || 0) + gatotal;
                }
            }
        }
    });
    
    const championshipsArray = Object.entries(championshipsGoals).map(([championship, goals]) => ({
        championship,
        goals
    })).sort((a, b) => b.goals - a.goals);
    
    displayClubChampionships(championshipsArray);
    
    // Calculate seasons stats
    const seasonsGoals = {};
    clubDetails.forEach(detail => {
        const gaValue = (detail['GA'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        if (gaValue === 'GOAL' && matchId) {
            // Find match to get season
            const match = egyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
            if (match) {
                const season = (match['SEASON'] || '').trim();
                if (season) {
                    seasonsGoals[season] = (seasonsGoals[season] || 0) + gatotal;
                }
            }
        }
    });
    
    const seasonsArray = Object.entries(seasonsGoals).map(([season, goals]) => ({
        season,
        goals
    })).sort((a, b) => {
        // Sort by season (newest first), then by goals
        if (a.season !== b.season) {
            return b.season.localeCompare(a.season); // Descending order (newest first)
        }
        return b.goals - a.goals;
    });
    
    displayClubSeasons(seasonsArray);
    
    // Calculate opponents stats
    const opponentsGoals = {};
    clubDetails.forEach(detail => {
        const gaValue = (detail['GA'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;
        const matchId = (detail['MATCH_ID'] || '').trim();
        
        if (gaValue === 'GOAL' && matchId) {
            // Find match to get opponent
            const match = egyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
            if (match) {
                const opponent = (match['OPPONENT TEAM'] || '').trim();
                if (opponent) {
                    opponentsGoals[opponent] = (opponentsGoals[opponent] || 0) + gatotal;
                }
            }
        }
    });
    
    const opponentsArray = Object.entries(opponentsGoals).map(([opponent, goals]) => ({
        opponent,
        goals
    })).sort((a, b) => b.goals - a.goals);
    
    displayClubOpponents(opponentsArray);
}

function displayClubPlayers(playersArray) {
    const tbody = document.getElementById('club-players-tbody');
    tbody.innerHTML = '';
    
    if (playersArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    playersArray.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${player.player}</strong></td>
            <td style="text-align: center; font-weight: 600;">${player.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubChampionships(championshipsArray) {
    const tbody = document.getElementById('club-championships-tbody');
    tbody.innerHTML = '';
    
    if (championshipsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    championshipsArray.forEach((championship, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${championship.championship}</strong></td>
            <td style="text-align: center; font-weight: 600;">${championship.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubSeasons(seasonsArray) {
    const tbody = document.getElementById('club-seasons-tbody');
    tbody.innerHTML = '';
    
    if (seasonsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    seasonsArray.forEach((season, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${season.season}</strong></td>
            <td style="text-align: center; font-weight: 600;">${season.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubOpponents(opponentsArray) {
    const tbody = document.getElementById('club-opponents-tbody');
    tbody.innerHTML = '';
    
    if (opponentsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    opponentsArray.forEach((opponent, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${opponent.opponent}</strong></td>
            <td style="text-align: center; font-weight: 600;">${opponent.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// LOADING & ERROR FUNCTIONS
// ============================================================================

function showLoading() {
    const loadingContainer = document.getElementById('loading-container');
    const contentTabs = document.getElementById('content-tabs');
    
    if (loadingContainer) {
        loadingContainer.style.display = 'flex';
    }
    
    if (contentTabs) {
        contentTabs.style.display = 'none';
    }
}

function hideLoading() {
    const loadingContainer = document.getElementById('loading-container');
    const contentTabs = document.getElementById('content-tabs');
    
    if (loadingContainer) {
        loadingContainer.style.display = 'none';
    }
    
    if (contentTabs) {
        contentTabs.style.display = 'block';
    }
}

// Refresh Egypt Teams data with visual feedback
async function refreshEgyptTeamsData() {
    const refreshBtn = event.target.closest('button');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<svg class="filter-btn-icon" style="animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Syncing...';
    
    try {
        await loadEgyptTeamsData(true);
        
        // Show success message
        refreshBtn.innerHTML = '<svg class="filter-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Synced!';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    } catch (error) {
        refreshBtn.innerHTML = '<svg class="filter-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Error!';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    }
}

function showError(message) {
    const container = document.getElementById('loading-container');
    container.innerHTML = `
        <div style="text-align: center; color: #dc3545;">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <h3 style="margin-top: 1rem;">${message}</h3>
            <button class="refresh-btn" onclick="loadEgyptTeamsData(true)" style="margin-top: 1rem;">
                Try Again
            </button>
        </div>
    `;
    container.style.display = 'flex';
}

// ============================================================================
// GOALKEEPERS STATISTICS
// ============================================================================

function loadGoalkeepersStats() {
    const tbody = document.getElementById('goalkeepers-tbody');
    const loadingDiv = document.getElementById('goalkeepers-loading');
    const tableContainer = document.getElementById('goalkeepers-table-container');
    
    loadingDiv.style.display = 'flex';
    tableContainer.style.display = 'none';
    
    try {
        const gkDetails = egyptTeamsData.gkDetails || [];
        
        // Get filtered match IDs
        const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
        
        // Filter GK records to only include filtered matches
        const filteredGKDetails = gkDetails.filter(record => {
            const matchId = record.MATCH_ID || record['MATCH ID'] || '';
            return filteredMatchIds.has(matchId);
        });
        
        // Create a map to track all GKs per match per team
        const allGKsByMatch = new Map();
        filteredGKDetails.forEach(record => {
            const matchId = record.MATCH_ID || record['MATCH ID'] || '';
            const team = (record.TEAM || '').trim().toLowerCase();
            const key = `${matchId}_${team}`;
            
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        });
        
        // Get penalty goals with their minutes (opponent penalties against Egypt GKs)
        const playerDetails = egyptTeamsData.playerDetails || [];
        const penaltiesByMatchMinute = []; // Array of {matchId, minute}
        
        playerDetails.forEach(detail => {
            const matchId = detail['MATCH_ID'] || detail['MATCH ID'] || '';
            const team = (detail['TEAM'] || '').trim();
            const typeValue = (detail['TYPE'] || '').trim();
            const gaValue = (detail['GA'] || '').trim();
            const minute = (detail['MINUTE'] || '').toString().trim();
            
            // Only count PENGOAL scored by opponent (not Egypt)
            if (gaValue === 'GOAL' && typeValue && team && team !== 'EGYPT' && filteredMatchIds.has(matchId)) {
                const pengoalMatches = typeValue.match(/PENGOAL/g);
                if (pengoalMatches) {
                    // Add each penalty with its minute (minute can be empty)
                    pengoalMatches.forEach(() => {
                        penaltiesByMatchMinute.push({ matchId, minute: minute || '' });
                    });
                }
            }
        });
        
        // Get penalty saves from HOWPENMISSED
        const howPenMissed = egyptTeamsData.howPenMissed || [];
        const penaltySavesByGK = new Map();
        
        howPenMissed.forEach(record => {
            const matchId = record.MATCH_ID || record['MATCH ID'] || '';
            const gkName = (record['PLAYER NAME'] || '').trim();
            
            // Only count if match is in filtered records
            if (gkName && filteredMatchIds.has(matchId)) {
                penaltySavesByGK.set(gkName, (penaltySavesByGK.get(gkName) || 0) + 1);
            }
        });
        
        // Group by goalkeeper name
        const gkStats = {};
        
        filteredGKDetails.forEach(record => {
            const gkName = (record['PLAYER NAME'] || '').trim();
            const goalsConceded = parseInt(record['GOALS CONCEDED']) || 0;
            const matchId = record.MATCH_ID || record['MATCH ID'] || '';
            const team = (record.TEAM || '').trim().toLowerCase();
            const key = `${matchId}_${team}`;
            const gkGoalMinutes = (record['GOAL MINUTE'] || '').toString().trim();
            
            if (!gkName) return;
            
            if (!gkStats[gkName]) {
                gkStats[gkName] = {
                    name: gkName,
                    matches: 0,
                    totalGoalsConceded: 0,
                    cleanSheets: 0,
                    penaltiesConceded: 0,
                    penaltiesSaved: penaltySavesByGK.get(gkName) || 0
                };
            }
            
            gkStats[gkName].matches += 1;
            gkStats[gkName].totalGoalsConceded += goalsConceded;
            
            // Count penalties conceded
            const allGKsInMatch = allGKsByMatch.get(key) || [];
            const onlyOneGK = allGKsInMatch.length === 1;
            
            if (onlyOneGK) {
                // If only one goalkeeper in this match, he gets all penalties (no minute matching needed)
                penaltiesByMatchMinute.forEach(penalty => {
                    if (penalty.matchId === matchId) {
                        gkStats[gkName].penaltiesConceded += 1;
                    }
                });
            } else {
                // Multiple goalkeepers: match by minute only if minutes are available
                if (gkGoalMinutes) {
                    // Split GOAL MINUTE into array (e.g., "10, 45, 60" -> ["10", "45", "60"])
                    const gkMinutesArray = gkGoalMinutes.split(',').map(m => m.trim());
                    
                    // Check each penalty for this match
                    penaltiesByMatchMinute.forEach(penalty => {
                        if (penalty.matchId === matchId) {
                            // If penalty has minute, match it. If no minute, skip for multiple GKs
                            if (penalty.minute && gkMinutesArray.includes(penalty.minute)) {
                                gkStats[gkName].penaltiesConceded += 1;
                            }
                        }
                    });
                }
            }
            
            // Clean sheet only if goalkeeper was THE ONLY ONE from his team in this match
            if (goalsConceded === 0 && onlyOneGK) {
                gkStats[gkName].cleanSheets += 1;
            }
        });
        
        // Convert to array and store
        egyptTeamsData.goalkeepersData = Object.values(gkStats);
        
        // Sort and display
        sortAndDisplayGoalkeepers();
        
        loadingDiv.style.display = 'none';
        tableContainer.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading goalkeepers stats:', error);
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #dc2626;">Error loading data</td></tr>';
        loadingDiv.style.display = 'none';
        tableContainer.style.display = 'block';
    }
}

// Sort goalkeepers by column
function sortGoalkeepersBy(column) {
    // Toggle direction if same column, otherwise default to desc
    if (egyptTeamsData.currentGKSortColumn === column) {
        egyptTeamsData.currentGKSortDirection = egyptTeamsData.currentGKSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        egyptTeamsData.currentGKSortColumn = column;
        egyptTeamsData.currentGKSortDirection = column === 'name' ? 'asc' : 'desc';
    }
    
    sortAndDisplayGoalkeepers();
}

// Sort and display goalkeepers
function sortAndDisplayGoalkeepers() {
    const tbody = document.getElementById('goalkeepers-tbody');
    const gkArray = [...egyptTeamsData.goalkeepersData];
    
    if (gkArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">No goalkeeper data available</td></tr>';
        return;
    }
    
    // Sort the array
    gkArray.sort((a, b) => {
        let aVal, bVal;
        
        switch (egyptTeamsData.currentGKSortColumn) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                break;
            case 'matches':
                aVal = a.matches;
                bVal = b.matches;
                break;
            case 'goalsConceded':
                aVal = a.totalGoalsConceded;
                bVal = b.totalGoalsConceded;
                break;
            case 'cleanSheets':
                aVal = a.cleanSheets;
                bVal = b.cleanSheets;
                break;
            case 'penaltiesConceded':
                aVal = a.penaltiesConceded;
                bVal = b.penaltiesConceded;
                break;
            case 'penaltiesSaved':
                aVal = a.penaltiesSaved;
                bVal = b.penaltiesSaved;
                break;
            default:
                aVal = a.matches;
                bVal = b.matches;
        }
        
        if (egyptTeamsData.currentGKSortDirection === 'asc') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
        } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
        }
    });
    
    // Update header classes
    document.querySelectorAll('#goalkeepers-table-container .sortable-header').forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    const headerMap = {
        'name': 0,
        'matches': 1,
        'goalsConceded': 2,
        'cleanSheets': 3,
        'penaltiesConceded': 4,
        'penaltiesSaved': 5
    };
    
    const headerIndex = headerMap[egyptTeamsData.currentGKSortColumn];
    if (headerIndex !== undefined) {
        const headers = document.querySelectorAll('#goalkeepers-table-container .sortable-header');
        if (headers[headerIndex]) {
            headers[headerIndex].classList.add(
                egyptTeamsData.currentGKSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc'
            );
        }
    }
    
    // Display goalkeepers
    tbody.innerHTML = '';
    gkArray.forEach((gk, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong>${gk.name}</strong></td>
            <td>${gk.matches}</td>
            <td>${gk.totalGoalsConceded}</td>
            <td>${gk.cleanSheets}</td>
            <td>${gk.penaltiesConceded}</td>
            <td>${gk.penaltiesSaved || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// SEARCH MATCH FUNCTIONS
// ============================================================================

// Search for match by ID
async function searchEgyptMatchById() {
    const searchInput = document.getElementById('egypt-match-search-input');
    const matchId = searchInput.value.trim();
    
    if (!matchId) {
        return;
    }
    
    console.log('🔍 Searching for match ID:', matchId);
    console.log('🔍 Player details loaded before search:', egyptTeamsData.playerDetailsLoaded);
    
    // Make sure player data is loaded
    if (!egyptTeamsData.playerDetailsLoaded) {
        console.log('🔄 Loading player data...');
        try {
            await loadPlayersData();
            console.log('✅ Player data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading player data:', error);
            showError('No Data Available');
            return;
        }
    }
    
    const matches = egyptTeamsData.allRecords;
    const match = matches.find(m => {
        const mid = m.MATCH_ID || m['MATCH ID'] || '';
        return mid.toString().toLowerCase() === matchId.toLowerCase();
    });
    
    console.log('🔍 Match found:', !!match);
    if (match) {
        console.log('🔍 Match details:', match);
    }
    
    const detailsContainer = document.getElementById('egypt-match-details-container');
    const noMatchFound = document.getElementById('egypt-no-match-found');
    
    if (match) {
        // Display match details
        displayEgyptMatchDetails(match);
        displayEgyptMatchLineup(matchId);
        displayEgyptMatchGoals(matchId);
        displayEgyptMatchGoalkeepers(matchId);
        
        detailsContainer.style.display = 'block';
        noMatchFound.style.display = 'none';
    } else {
        detailsContainer.style.display = 'none';
        noMatchFound.style.display = 'block';
    }
}

// Display match header details
function displayEgyptMatchDetails(match) {
    const headerContainer = document.getElementById('egypt-match-header');
    
    const egyptTeam = match['Egypt TEAM'] || 'Egypt';
    const opponentTeam = match['OPPONENT TEAM'] || 'Unknown';
    const egyptScore = match.GF || 0;
    const opponentScore = match.GA || 0;
    const date = match.DATE || '';
    const season = match.SEASON || '';
    const stadium = match.PLACE || '';
    const venue = match['H-A-N'] || '';
    const round = match.ROUND || '';
    const egyptManager = match['MANAGER EGY'] || '';
    const opponentManager = match['MANAGER OPPONENT'] || '';
    const referee = match.REFREE || '';
    
    headerContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 3rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #dc2626; margin: 0;">${egyptTeam}</h2>
                ${egyptManager ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${egyptManager}</p>` : ''}
            </div>
            <div style="font-size: 3rem; font-weight: 700; color: #333;">
                ${egyptScore} - ${opponentScore}
            </div>
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #3b82f6; margin: 0;">${opponentTeam}</h2>
                ${opponentManager ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${opponentManager}</p>` : ''}
            </div>
        </div>
        <div style="border-top: 2px solid #e5e7eb; padding-top: 1rem; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; font-size: 0.95rem; color: #666;">
            ${date ? `<span><strong>Date:</strong> ${date}</span>` : ''}
            ${season ? `<span><strong>Season:</strong> ${season}</span>` : ''}
            ${stadium ? `<span><strong>Stadium:</strong> ${stadium}</span>` : ''}
            ${venue ? `<span><strong>Venue:</strong> ${venue}</span>` : ''}
            ${round ? `<span><strong>Round:</strong> ${round}</span>` : ''}
            ${referee ? `<span><strong>Referee:</strong> ${referee}</span>` : ''}
        </div>
    `;
}

// Display match lineup
function displayEgyptMatchLineup(matchId) {
    const container = document.getElementById('egypt-match-lineup-container');
    const lineupDetails = egyptTeamsData.lineupDetails || [];
    const playerDetails = egyptTeamsData.playerDetails || [];
    
    console.log('🔍 Match ID:', matchId);
    console.log('🔍 Total lineup details available:', lineupDetails.length);
    console.log('🔍 Total player details available:', playerDetails.length);
    console.log('🔍 Player details loaded:', egyptTeamsData.playerDetailsLoaded);
    console.log('🔍 Players loaded:', egyptTeamsData.playersLoaded);
    
    // Debug: Show first few lineup records to understand structure
    if (lineupDetails.length > 0) {
        console.log('🔍 Sample lineup record:', lineupDetails[0]);
        console.log('🔍 Available lineup fields:', Object.keys(lineupDetails[0]));
    }
    
    // Get Egypt lineup from LINEUPEGYPT data (Egypt players only)
    const egyptLineup = lineupDetails.filter(player => {
        const mid = player.MATCH_ID || player['MATCH ID'] || '';
        const sourceTeam = player.SOURCE_TEAM || '';
        return mid.toString().toLowerCase() === matchId.toLowerCase() && 
               sourceTeam === 'EGYPT';
    });
    
    // Get Opponent lineup from LINEUPOPPONENT data (Opponent players only)
    const opponentLineup = lineupDetails.filter(player => {
        const mid = player.MATCH_ID || player['MATCH ID'] || '';
        const sourceTeam = player.SOURCE_TEAM || '';
        return mid.toString().toLowerCase() === matchId.toLowerCase() && 
               sourceTeam === 'OPPONENT';
    });
    
    // Get goals data for this match
    const matchGoals = playerDetails.filter(player => {
        const mid = player.MATCH_ID || player['MATCH ID'] || '';
        return mid.toString().toLowerCase() === matchId.toLowerCase();
    });
    
    // Separate Egypt goals and assists
    const egyptGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toLowerCase();
        const isEgypt = team.includes('egypt') || team.includes('مصر');
        const isGoalOrAssist = ga === 'GOAL' || ga === 'ASSIST';
        return isEgypt && isGoalOrAssist;
    });
    
    // Separate Opponent goals and assists
    const opponentGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toLowerCase();
        const isOpponent = !team.includes('egypt') && !team.includes('مصر');
        const isGoalOrAssist = ga === 'GOAL' || ga === 'ASSIST';
        return isOpponent && isGoalOrAssist;
    });
    
    console.log('🔍 Egypt lineup found:', egyptLineup.length);
    console.log('🔍 Opponent lineup found:', opponentLineup.length);
    console.log('🔍 Egypt lineup data:', egyptLineup);
    console.log('🔍 Opponent lineup data:', opponentLineup);
    
    // Check if data is not loaded yet
    if (!egyptTeamsData.playerDetailsLoaded) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">Loading lineup data...</p>';
        return;
    }
    
    if (egyptLineup.length === 0 && opponentLineup.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #999; padding: 2rem;">
                <p>No lineup data available for this match</p>
                <p style="font-size: 0.9rem; margin-top: 1rem;">
                    Total lineup records: ${lineupDetails.length}<br>
                    Match ID searched: ${matchId}
                </p>
            </div>
        `;
        return;
    }
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; width: 100%;">';
    
    // Egypt Lineup (Left Side)
    html += `
        <div>
            <h3 style="color: #dc143c; margin-bottom: 1rem;">🇪🇬 Egypt</h3>
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
    
    // Display Egypt players
    if (egyptLineup.length > 0) {
        egyptLineup.forEach((player, index) => {
            const playerName = player['PLAYER NAME'] || 'Unknown';
            const minutes = player.MINTOTAL || player.MINMAT || 0;
            const playerOut = player['PLAYER NAME OUT'] || '';
            const minOut = player.MINOUT || '';
            
            let status = '';
            if (index < 11) {
                status = '<span class="badge badge-success">Starting XI</span>';
            } else {
                status = `<span class="badge badge-warning">Substitute</span>`;
                if (playerOut) {
                    status += `<br><small style="color: #666;">(Replaced ${playerOut} at ${minOut}')</small>`;
                }
            }
            
            // Calculate goals and assists for this player in this match
            const playerGoalRecords = egyptGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'GOAL');
            const playerAssistRecords = egyptGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'ASSIST');
            
            // Sum up GATOTAL for multiple goals/assists
            const playerGoals = playerGoalRecords.reduce((total, goal) => total + (goal.GATOTAL || 1), 0);
            const playerAssists = playerAssistRecords.reduce((total, assist) => total + (assist.GATOTAL || 1), 0);
            
            // Create goals display with icon (only show icon if player scored)
            const goalsDisplay = playerGoals > 0 ? 
                `<span style="color: #28a745; font-weight: bold;">${parseInt(playerGoals)} ⚽</span>` : 
                '<span style="color: #999;">-</span>';
            
            // Create assists display with icon (only show icon if player assisted)
            const assistsDisplay = playerAssists > 0 ? 
                `<span style="color: #007bff; font-weight: bold;">${parseInt(playerAssists)} 🎯</span>` : 
                '<span style="color: #999;">-</span>';
            
            // Add substitution arrows and GK indicator
            let playerNameWithArrows = `<strong>${playerName}</strong>`;
            
            // Check if this player is a goalkeeper (first player in lineup is usually GK)
            const isGoalkeeper = index === 0;
            if (isGoalkeeper) {
                playerNameWithArrows += ` <span style="color: #6c757d; font-weight: bold; font-size: 0.9em;" title="Goalkeeper">GK 🧤</span>`;
            }
            
            // Check if this player was substituted out (red arrow down)
            const wasSubstitutedOut = egyptLineup.some(p => p['PLAYER NAME OUT'] === playerName);
            if (wasSubstitutedOut) {
                playerNameWithArrows += ` <span style="color: #dc3545; font-size: 1.5em;" title="Substituted Out">↓</span>`;
            }
            
            // Check if this player was substituted in (green arrow up)
            // For substitutes, they are the ones who came in (not in starting XI)
            const wasSubstitutedIn = index >= 11; // Substitutes start from index 11
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
        html += '<tr><td colspan="5" style="text-align: center; color: #999;">No Egypt lineup</td></tr>';
    }
    
    html += `
                </tbody>
            </table>
        </div>
    </div>
    `;
    
    // Opponent Lineup (Right Side)
    html += `
        <div>
            <h3 style="color: #333; margin-bottom: 1rem;">⚽ Opponent</h3>
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
    
    // Display Opponent players
    if (opponentLineup.length > 0) {
        opponentLineup.forEach((player, index) => {
            const playerName = player['PLAYER NAME'] || 'Unknown';
            const minutes = player.MINTOTAL || player.MINMAT || 0;
            const playerOut = player['PLAYER NAME OUT'] || '';
            const minOut = player.MINOUT || '';
            
            let status = '';
            if (index < 11) {
                status = '<span class="badge badge-success">Starting XI</span>';
            } else {
                status = `<span class="badge badge-warning">Substitute</span>`;
                if (playerOut) {
                    status += `<br><small style="color: #666;">(Replaced ${playerOut} at ${minOut}')</small>`;
                }
            }
            
            // Calculate goals and assists for this player in this match
            const playerGoalRecords = opponentGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'GOAL');
            const playerAssistRecords = opponentGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'ASSIST');
            
            // Sum up GATOTAL for multiple goals/assists
            const playerGoals = playerGoalRecords.reduce((total, goal) => total + (goal.GATOTAL || 1), 0);
            const playerAssists = playerAssistRecords.reduce((total, assist) => total + (assist.GATOTAL || 1), 0);
            
            // Create goals display with icon (only show icon if player scored)
            const goalsDisplay = playerGoals > 0 ? 
                `<span style="color: #28a745; font-weight: bold;">${parseInt(playerGoals)} ⚽</span>` : 
                '<span style="color: #999;">-</span>';
            
            // Create assists display with icon (only show icon if player assisted)
            const assistsDisplay = playerAssists > 0 ? 
                `<span style="color: #007bff; font-weight: bold;">${parseInt(playerAssists)} 🎯</span>` : 
                '<span style="color: #999;">-</span>';
            
            // Add substitution arrows and GK indicator
            let playerNameWithArrows = `<strong>${playerName}</strong>`;
            
            // Check if this player is a goalkeeper (first player in lineup is usually GK)
            const isGoalkeeper = index === 0;
            if (isGoalkeeper) {
                playerNameWithArrows += ` <span style="color: #6c757d; font-weight: bold; font-size: 0.9em;" title="Goalkeeper">GK 🧤</span>`;
            }
            
            // Check if this player was substituted out (red arrow down)
            const wasSubstitutedOut = opponentLineup.some(p => p['PLAYER NAME OUT'] === playerName);
            if (wasSubstitutedOut) {
                playerNameWithArrows += ` <span style="color: #dc3545; font-size: 1.5em;" title="Substituted Out">↓</span>`;
            }
            
            // Check if this player was substituted in (green arrow up)
            // For substitutes, they are the ones who came in (not in starting XI)
            const wasSubstitutedIn = index >= 11; // Substitutes start from index 11
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
        html += '<tr><td colspan="5" style="text-align: center; color: #999;">No Opponent lineup</td></tr>';
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
function displayEgyptMatchGoals(matchId) {
    const container = document.getElementById('egypt-match-goals-container');
    const playerDetails = egyptTeamsData.playerDetails || [];
    
    const matchGoals = playerDetails.filter(detail => {
        const mid = detail.MATCH_ID || detail['MATCH ID'] || '';
        const ga = (detail.GA || '').toUpperCase();
        return mid.toString().toLowerCase() === matchId.toLowerCase() && 
               (ga === 'GOAL' || ga === 'ASSIST');
    });
    
    if (matchGoals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No goals data available for this match</p>';
        return;
    }
    
    // Helper function to find assist for a goal
    const findAssist = (minute, isEgyptGoal) => {
        return matchGoals.find(g => {
            const gMin = g.MINUTE || g.MIN || 0;
            const gGA = (g.GA || '').toUpperCase();
            const gTeam = (g.TEAM || '').toLowerCase();
            const gIsEgypt = gTeam.includes('egypt') || gTeam.includes('مصر');
            return gGA === 'ASSIST' && gMin === minute && gIsEgypt === isEgyptGoal;
        });
    };
    
    // Separate Egypt and opponent goals
    const egyptGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toLowerCase();
        const isEgypt = team.includes('egypt') || team.includes('مصر');
        return ga === 'GOAL' && isEgypt;
    });
    
    const opponentGoals = matchGoals.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toLowerCase();
        const isEgypt = team.includes('egypt') || team.includes('مصر');
        return ga === 'GOAL' && !isEgypt;
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Egypt Goals
    html += `
        <div>
            <h3 style="color: #dc2626; margin-bottom: 1rem;">Egypt Goals</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Club</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    egyptGoals.forEach(goal => {
        const minute = goal.MINUTE || goal.MIN || 0;
        const player = goal['PLAYER NAME'] || 'Unknown';
        const gatotal = goal.GATOTAL || 1;
        const type = goal.TYPE || 'Regular';
        const elnady = goal.ELNADY || '-';
        const assist = findAssist(minute, true);
        const assistPlayer = assist ? assist['PLAYER NAME'] : null;
        
        html += `
            <tr>
                <td>
                    <strong>${player}</strong> <span style="color: #dc2626; font-weight: 600;">(${gatotal})</span>
                    ${assistPlayer ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assistPlayer}</div>` : ''}
                </td>
                <td>${elnady}</td>
                <td>${type}</td>
            </tr>
        `;
    });
    
    if (egyptGoals.length === 0) {
        html += '<tr><td colspan="3" style="text-align: center; color: #999;">No goals</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Opponent Goals
    html += `
        <div>
            <h3 style="color: #3b82f6; margin-bottom: 1rem;">Opponent Goals</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Player</th>
                            <th>Club</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    opponentGoals.forEach(goal => {
        const minute = goal.MINUTE || goal.MIN || 0;
        const player = goal['PLAYER NAME'] || 'Unknown';
        const gatotal = goal.GATOTAL || 1;
        const type = goal.TYPE || 'Regular';
        const elnady = goal.ELNADY || '-';
        const assist = findAssist(minute, false);
        const assistPlayer = assist ? assist['PLAYER NAME'] : null;
        
        html += `
            <tr>
                <td>
                    <strong>${player}</strong> <span style="color: #3b82f6; font-weight: 600;">(${gatotal})</span>
                    ${assistPlayer ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assistPlayer}</div>` : ''}
                </td>
                <td>${elnady}</td>
                <td>${type}</td>
            </tr>
        `;
    });
    
    if (opponentGoals.length === 0) {
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

// Display match goalkeepers
function displayEgyptMatchGoalkeepers(matchId) {
    const container = document.getElementById('egypt-match-goalkeepers-container');
    const gkDetails = egyptTeamsData.gkDetails || [];
    
    const matchGKs = gkDetails.filter(gk => {
        const mid = gk.MATCH_ID || gk['MATCH ID'] || '';
        return mid.toString().toLowerCase() === matchId.toLowerCase();
    });
    
    if (matchGKs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No goalkeeper data available for this match</p>';
        return;
    }
    
    // Group by team (Egypt vs Opponent)
    const egyptGKs = matchGKs.filter(gk => {
        const team = (gk.TEAM || '').toLowerCase();
        return team.includes('egypt') || team.includes('مصر');
    });
    
    const opponentGKs = matchGKs.filter(gk => {
        const team = (gk.TEAM || '').toLowerCase();
        return !team.includes('egypt') && !team.includes('مصر');
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Egypt Goalkeepers
    html += `
        <div>
            <h3 style="color: #dc2626; margin-bottom: 1rem;">Egypt Goalkeeper</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Goalkeeper</th>
                            <th>Goals Conceded</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    egyptGKs.forEach(gk => {
        const gkName = gk['PLAYER NAME'] || 'Unknown';
        const goalsConceded = gk['GOALS CONCEDED'] || 0;
        
        html += `
            <tr>
                <td><strong>${gkName}</strong></td>
                <td>${goalsConceded}</td>
            </tr>
        `;
    });
    
    if (egyptGKs.length === 0) {
        html += '<tr><td colspan="2" style="text-align: center; color: #999;">No data</td></tr>';
    }
    
    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Opponent Goalkeepers
    html += `
        <div>
            <h3 style="color: #3b82f6; margin-bottom: 1rem;">Opponent Goalkeeper</h3>
            <div style="overflow-x: auto;">
                <table class="matches-table">
                    <thead>
                        <tr>
                            <th>Goalkeeper</th>
                            <th>Goals Conceded</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    opponentGKs.forEach(gk => {
        const gkName = gk['PLAYER NAME'] || 'Unknown';
        const goalsConceded = gk['GOALS CONCEDED'] || 0;
        
        html += `
            <tr>
                <td><strong>${gkName}</strong></td>
                <td>${goalsConceded}</td>
            </tr>
        `;
    });
    
    if (opponentGKs.length === 0) {
        html += '<tr><td colspan="2" style="text-align: center; color: #999;">No data</td></tr>';
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

// Show match sub-tab
function showEgyptMatchSubTab(event, tabName) {
    // Remove active class from all match sub-tabs
    const parentContainer = event.target.closest('#egypt-match-details-container');
    const tabButtons = parentContainer.querySelectorAll('.tab-button');
    tabButtons.forEach(tab => tab.classList.remove('active'));
    
    // Remove active class from all match sub-tab contents
    document.querySelectorAll('#egypt-match-lineup-content, #egypt-match-goals-content, #egypt-match-goalkeepers-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab button and content
    event.target.classList.add('active');
    
    if (tabName === 'lineup') {
        document.getElementById('egypt-match-lineup-content').classList.add('active');
    } else if (tabName === 'goals') {
        document.getElementById('egypt-match-goals-content').classList.add('active');
    } else if (tabName === 'goalkeepers') {
        document.getElementById('egypt-match-goalkeepers-content').classList.add('active');
    }
}

// ============================================================================
// ALL PLAYERS SEARCH FUNCTIONALITY
// ============================================================================

function setupAllPlayersSearch() {
    const searchInput = document.getElementById('all-players-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('keyup', () => {
        // Simply call displayPlayers, which now handles search internally
        displayPlayers();
    });
}

// ============================================================================
// MAIN STATS TAB FUNCTIONALITY
// ============================================================================

function switchMainStatsTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('#mainstats-tab > .tabs-header .tab-button');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Add active class to clicked button using selector
    const clickedBtn = document.querySelector(`#mainstats-tab > .tabs-header .tab-button[onclick*="'${tabName}'"]`);
    if (clickedBtn) clickedBtn.classList.add('active');
    
    // Update tab content
    document.getElementById('mainstats-championships-tab').classList.remove('active');
    document.getElementById('mainstats-seasons-tab').classList.remove('active');
    
    if (tabName === 'championships') {
        document.getElementById('mainstats-championships-tab').classList.add('active');
        loadMainStatsChampionships();
    } else if (tabName === 'seasons') {
        document.getElementById('mainstats-seasons-tab').classList.add('active');
        loadMainStatsSeasons();
    }
}

function loadMainStatsChampionships() {
    const tbody = document.getElementById('mainstats-championships-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group stats by championship
    const championshipStats = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const championship = (match['CHAMPION'] || 'Unknown').trim();
        const result = match['W-D-L'] || '';
        const gf = parseInt(match['GF']) || 0;
        const ga = parseInt(match['GA']) || 0;
        
        if (!championshipStats.has(championship)) {
            championshipStats.set(championship, {
                championship,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                cleanSheetsFor: 0,
                cleanSheetsAgainst: 0
            });
        }
        
        const stats = championshipStats.get(championship);
        stats.matches++;
        stats.gf += gf;
        stats.ga += ga;
        
        if (result === 'W') stats.wins++;
        else if (result === 'D' || result === 'D.') stats.draws++;
        else if (result === 'L') stats.losses++;
        
        if (ga === 0) stats.cleanSheetsFor++;
        if (gf === 0) stats.cleanSheetsAgainst++;
    });
    
    // Convert to array and sort by matches (descending)
    const championshipsArray = Array.from(championshipStats.values())
        .sort((a, b) => b.matches - a.matches);
    
    if (championshipsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No championship data available</td></tr>';
        return;
    }
    
    // Display championships
    championshipsArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${escapeHtml(stats.championship)}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.gf}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.ga}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #17a2b8;">${stats.cleanSheetsFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #fd7e14;">${stats.cleanSheetsAgainst}</td>
        `;
    });
    
    // Add totals row
    const totalMatches = championshipsArray.reduce((sum, s) => sum + s.matches, 0);
    const totalWins = championshipsArray.reduce((sum, s) => sum + s.wins, 0);
    const totalDraws = championshipsArray.reduce((sum, s) => sum + s.draws, 0);
    const totalLosses = championshipsArray.reduce((sum, s) => sum + s.losses, 0);
    const totalGF = championshipsArray.reduce((sum, s) => sum + s.gf, 0);
    const totalGA = championshipsArray.reduce((sum, s) => sum + s.ga, 0);
    const totalCleanSheetsFor = championshipsArray.reduce((sum, s) => sum + s.cleanSheetsFor, 0);
    const totalCleanSheetsAgainst = championshipsArray.reduce((sum, s) => sum + s.cleanSheetsAgainst, 0);
    
    const totalRow = tbody.insertRow();
    totalRow.style.backgroundColor = '#f3f4f6';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td style="font-weight: 700; color: #1f2937;">Total</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #1f2937;">${totalMatches}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalWins}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${totalDraws}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalLosses}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalGF}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalGA}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #17a2b8;">${totalCleanSheetsFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #fd7e14;">${totalCleanSheetsAgainst}</td>
    `;
}

function loadMainStatsSeasons() {
    const tbody = document.getElementById('mainstats-seasons-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Group stats by season
    const seasonStats = new Map();
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const season = (match['SEASON'] || 'Unknown').trim();
        const result = match['W-D-L'] || '';
        const gf = parseInt(match['GF']) || 0;
        const ga = parseInt(match['GA']) || 0;
        
        if (!seasonStats.has(season)) {
            seasonStats.set(season, {
                season,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                gf: 0,
                ga: 0,
                cleanSheetsFor: 0,
                cleanSheetsAgainst: 0
            });
        }
        
        const stats = seasonStats.get(season);
        stats.matches++;
        stats.gf += gf;
        stats.ga += ga;
        
        if (result === 'W') stats.wins++;
        else if (result === 'D' || result === 'D.') stats.draws++;
        else if (result === 'L') stats.losses++;
        
        if (ga === 0) stats.cleanSheetsFor++;
        if (gf === 0) stats.cleanSheetsAgainst++;
    });
    
    // Convert to array and sort alphabetically in reverse order (newest first)
    const seasonsArray = Array.from(seasonStats.values())
        .sort((a, b) => b.season.localeCompare(a.season));
    
    if (seasonsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 2rem;">No season data available</td></tr>';
        return;
    }
    
    // Display seasons
    seasonsArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${escapeHtml(stats.season)}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.wins}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${stats.draws}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.losses}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${stats.gf}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${stats.ga}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #17a2b8;">${stats.cleanSheetsFor}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #fd7e14;">${stats.cleanSheetsAgainst}</td>
        `;
    });
    
    // Add totals row
    const totalMatches = seasonsArray.reduce((sum, s) => sum + s.matches, 0);
    const totalWins = seasonsArray.reduce((sum, s) => sum + s.wins, 0);
    const totalDraws = seasonsArray.reduce((sum, s) => sum + s.draws, 0);
    const totalLosses = seasonsArray.reduce((sum, s) => sum + s.losses, 0);
    const totalGF = seasonsArray.reduce((sum, s) => sum + s.gf, 0);
    const totalGA = seasonsArray.reduce((sum, s) => sum + s.ga, 0);
    const totalCleanSheetsFor = seasonsArray.reduce((sum, s) => sum + s.cleanSheetsFor, 0);
    const totalCleanSheetsAgainst = seasonsArray.reduce((sum, s) => sum + s.cleanSheetsAgainst, 0);
    
    const totalRow = tbody.insertRow();
    totalRow.style.backgroundColor = '#f3f4f6';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td style="font-weight: 700; color: #1f2937;">Total</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #1f2937;">${totalMatches}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalWins}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #f59e0b;">${totalDraws}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalLosses}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #10b981;">${totalGF}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #ef4444;">${totalGA}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #17a2b8;">${totalCleanSheetsFor}</td>
        <td style="text-align: center; font-size: 1.4rem; font-weight: bold; color: #fd7e14;">${totalCleanSheetsAgainst}</td>
    `;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// ============================================================================
// BY GOALKEEPER FUNCTIONS
// ============================================================================

let selectedGoalkeeper = null;

function setupGoalkeeperSearch() {
    const searchInput = document.getElementById('goalkeeper-search');
    if (!searchInput) return;
    
    // Remove existing listener if any
    searchInput.removeEventListener('input', handleGoalkeeperSearch);
    searchInput.addEventListener('input', handleGoalkeeperSearch);
    
    // Close search results when clicking outside
    document.addEventListener('click', function(e) {
        const searchResults = document.getElementById('goalkeeper-search-results');
        if (!searchInput.contains(e.target) && searchResults && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

function handleGoalkeeperSearch(e) {
    const searchTerm = e.target.value.toLowerCase().trim();
    const searchResults = document.getElementById('goalkeeper-search-results');
    
    if (!searchResults) return;
    
    if (!searchTerm) {
        searchResults.style.display = 'none';
        return;
    }
    
    // Get unique goalkeeper names from goalkeepersData
    const gkDetails = egyptTeamsData.gkDetails || [];
    const uniqueGoalkeepers = [...new Set(gkDetails
        .map(gk => (gk['PLAYER NAME'] || '').trim())
        .filter(name => name && name.toLowerCase().includes(searchTerm))
    )].sort();
    
    if (uniqueGoalkeepers.length === 0) {
        searchResults.innerHTML = '<div style="padding: 1rem; text-align: center; color: #999;">No goalkeepers found</div>';
        searchResults.style.display = 'block';
        return;
    }
    
    searchResults.innerHTML = uniqueGoalkeepers.map(gkName => 
        `<div class="player-search-item" onclick="selectGoalkeeper('${gkName.replace(/'/g, "\\'")}')">${gkName}</div>`
    ).join('');
    
    searchResults.style.display = 'block';
}

function selectGoalkeeper(goalkeeperName) {
    selectedGoalkeeper = goalkeeperName;
    
    // Hide search results
    const searchResults = document.getElementById('goalkeeper-search-results');
    if (searchResults) searchResults.style.display = 'none';
    const searchInput = document.getElementById('goalkeeper-search');
    if (searchInput) searchInput.value = goalkeeperName;
    
    // Calculate and display goalkeeper stats
    calculateGoalkeeperIndividualStats(goalkeeperName);
    
    // Show goalkeeper info container
    const infoContainer = document.getElementById('goalkeeper-info-container');
    const noGKSelected = document.getElementById('no-goalkeeper-selected');
    const selectedGKName = document.getElementById('selected-goalkeeper-name');
    
    if (infoContainer) infoContainer.style.display = 'block';
    if (noGKSelected) noGKSelected.style.display = 'none';
    if (selectedGKName) selectedGKName.textContent = goalkeeperName;
}

function calculateGoalkeeperIndividualStats(goalkeeperName) {
    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(egyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Get goalkeeper matches from gkDetails
    const gkDetails = egyptTeamsData.gkDetails || [];
    const goalkeeperMatches = new Set();
    
    gkDetails.forEach(gk => {
        const name = (gk['PLAYER NAME'] || '').trim();
        const matchId = (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim();
        const team = (gk['TEAM'] || '').trim().toLowerCase();
        
        // Only include Egypt team goalkeepers
        if (name === goalkeeperName && filteredMatchIds.has(matchId) && team === 'egypt') {
            goalkeeperMatches.add(matchId);
        }
    });
    
    // Load goalkeeper sub-tabs
    loadGoalkeeperMatches(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperChampionships(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperSeasons(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperVsTeams(goalkeeperName, goalkeeperMatches);
}

function loadGoalkeeperMatches(goalkeeperName, goalkeeperMatchIds) {
    const tbody = document.getElementById('goalkeeper-matches-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (goalkeeperMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
        return;
    }
    
    // Get match details for goalkeeper matches
    const goalkeeperMatchesList = egyptTeamsData.filteredRecords.filter(match => 
        goalkeeperMatchIds.has(match['MATCH_ID'])
    ).reverse(); // Latest first
    
    const gkDetails = egyptTeamsData.gkDetails || [];
    const playerDetails = egyptTeamsData.playerDetails || [];
    const howPenMissed = egyptTeamsData.howPenMissed || [];
    
    // Get all GKs by match for penalty calculation
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const team = (record.TEAM || '').trim().toLowerCase();
        if (team === 'egypt' && goalkeeperMatchIds.has(matchId)) {
            const key = `${matchId}_${team}`;
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        }
    });
    
    // Get penalty saves for this goalkeeper
    const penaltySavesByMatch = new Map();
    howPenMissed.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const gkName = (record['PLAYER NAME'] || '').trim();
        if (gkName === goalkeeperName && goalkeeperMatchIds.has(matchId)) {
            penaltySavesByMatch.set(matchId, (penaltySavesByMatch.get(matchId) || 0) + 1);
        }
    });
    
    goalkeeperMatchesList.forEach(match => {
        const matchId = match['MATCH_ID'];
        
        // Get goalkeeper details for goals conceded
        const gkRecord = gkDetails.find(gk => 
            (gk['PLAYER NAME'] || '').trim() === goalkeeperName && 
            (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim() === matchId &&
            (gk['TEAM'] || '').trim().toLowerCase() === 'egypt'
        );
        const goalsConceded = gkRecord ? (parseInt(gkRecord['GOALS CONCEDED'] || 0)) : 0;
        
        // Calculate penalties conceded (same logic as loadGoalkeepersStats)
        let penaltiesConceded = 0;
        const team = 'egypt';
        const key = `${matchId}_${team}`;
        const allGKsInMatch = allGKsByMatch.get(key) || [];
        const onlyOneGK = allGKsInMatch.length === 1;
        const gkGoalMinutes = gkRecord ? (gkRecord['GOAL MINUTE'] || '').toString().trim() : '';
        
        // Get penalties for this match from playerDetails
        playerDetails.forEach(detail => {
            const detailMatchId = detail['MATCH_ID'] || detail['MATCH ID'] || '';
            const detailTeam = (detail['TEAM'] || '').trim();
            const typeValue = (detail['TYPE'] || '').trim();
            const gaValue = (detail['GA'] || '').trim();
            const minute = (detail['MINUTE'] || '').toString().trim();
            
            // Only count PENGOAL scored by opponent (not Egypt)
            if (detailMatchId === matchId && gaValue === 'GOAL' && typeValue && detailTeam && detailTeam !== 'EGYPT') {
                const pengoalMatches = typeValue.match(/PENGOAL/g);
                if (pengoalMatches) {
                    pengoalMatches.forEach(() => {
                        if (onlyOneGK) {
                            penaltiesConceded += 1;
                        } else if (gkGoalMinutes && minute) {
                            const gkMinutesArray = gkGoalMinutes.split(',').map(m => m.trim());
                            if (gkMinutesArray.includes(minute)) {
                                penaltiesConceded += 1;
                            }
                        }
                    });
                }
            }
        });
        
        // Get penalties saved for this match
        const penaltiesSaved = penaltySavesByMatch.get(matchId) || 0;
        
        // Create searchable text from all columns
        const searchableText = [
            match['DATE'] || '',
            match['SEASON'] || '',
            match['MANAGER EGY'] || '',
            match['OPPONENT TEAM'] || '',
            goalsConceded.toString(),
            penaltiesConceded.toString(),
            penaltiesSaved.toString()
        ].join(' ').toLowerCase();
        
        const row = document.createElement('tr');
        row.setAttribute('data-search', searchableText);
        row.innerHTML = `
            <td>${match['DATE'] || ''}</td>
            <td>${match['SEASON'] || ''}</td>
            <td>${match['MANAGER EGY'] || ''}</td>
            <td>${match['OPPONENT TEAM'] || ''}</td>
            <td style="text-align: center;">${goalsConceded === 0 ? '-' : goalsConceded}</td>
            <td style="text-align: center;">${penaltiesConceded === 0 ? '-' : penaltiesConceded}</td>
            <td style="text-align: center;">${penaltiesSaved === 0 ? '-' : penaltiesSaved}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Setup search functionality
    setupGoalkeeperMatchesSearch();
}

function setupGoalkeeperMatchesSearch() {
    const searchInput = document.getElementById('goalkeeper-matches-search-input');
    if (!searchInput) return;
    
    // Remove previous listeners by cloning the input
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    newSearchInput.addEventListener('keyup', () => {
        const searchTerm = newSearchInput.value.toLowerCase().trim();
        const tbody = document.getElementById('goalkeeper-matches-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach(row => {
            const searchText = row.getAttribute('data-search') || '';
            if (!searchTerm || searchText.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// Helper function to calculate penalties for a goalkeeper in a match
function calculateGoalkeeperPenaltiesForMatch(goalkeeperName, matchId, allGKsByMatch, playerDetails, howPenMissed) {
    const team = 'egypt';
    const key = `${matchId}_${team}`;
    const allGKsInMatch = allGKsByMatch.get(key) || [];
    const onlyOneGK = allGKsInMatch.length === 1;
    
    // Get goalkeeper record
    const gkRecord = allGKsInMatch.find(gk => 
        (gk['PLAYER NAME'] || '').trim() === goalkeeperName
    );
    const gkGoalMinutes = gkRecord ? (gkRecord['GOAL MINUTE'] || '').toString().trim() : '';
    
    // Calculate penalties conceded
    let penaltiesConceded = 0;
    playerDetails.forEach(detail => {
        const detailMatchId = detail['MATCH_ID'] || detail['MATCH ID'] || '';
        const detailTeam = (detail['TEAM'] || '').trim();
        const typeValue = (detail['TYPE'] || '').trim();
        const gaValue = (detail['GA'] || '').trim();
        const minute = (detail['MINUTE'] || '').toString().trim();
        
        // Only count PENGOAL scored by opponent (not Egypt)
        if (detailMatchId === matchId && gaValue === 'GOAL' && typeValue && detailTeam && detailTeam !== 'EGYPT') {
            const pengoalMatches = typeValue.match(/PENGOAL/g);
            if (pengoalMatches) {
                pengoalMatches.forEach(() => {
                    if (onlyOneGK) {
                        penaltiesConceded += 1;
                    } else if (gkGoalMinutes && minute) {
                        const gkMinutesArray = gkGoalMinutes.split(',').map(m => m.trim());
                        if (gkMinutesArray.includes(minute)) {
                            penaltiesConceded += 1;
                        }
                    }
                });
            }
        }
    });
    
    // Calculate penalties saved
    let penaltiesSaved = 0;
    howPenMissed.forEach(record => {
        const recordMatchId = record.MATCH_ID || record['MATCH ID'] || '';
        const gkName = (record['PLAYER NAME'] || '').trim();
        if (recordMatchId === matchId && gkName === goalkeeperName) {
            penaltiesSaved += 1;
        }
    });
    
    return { penaltiesConceded, penaltiesSaved };
}

function loadGoalkeeperChampionships(goalkeeperName, goalkeeperMatchIds) {
    const tbody = document.getElementById('goalkeeper-championships-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (goalkeeperMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No championships found</td></tr>';
        return;
    }
    
    // Group stats by championship
    const championshipStats = new Map();
    const gkDetails = egyptTeamsData.gkDetails || [];
    const playerDetails = egyptTeamsData.playerDetails || [];
    const howPenMissed = egyptTeamsData.howPenMissed || [];
    
    // Get all GKs by match for penalty calculation
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const team = (record.TEAM || '').trim().toLowerCase();
        if (team === 'egypt' && goalkeeperMatchIds.has(matchId)) {
            const key = `${matchId}_${team}`;
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        }
    });
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = match['MATCH_ID'];
        if (!goalkeeperMatchIds.has(matchId)) return;
        
        const championship = match['CHAMPION'] || 'Unknown';
        
        // Get goalkeeper details for goals conceded
        const gkRecord = gkDetails.find(gk => 
            (gk['PLAYER NAME'] || '').trim() === goalkeeperName && 
            (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim() === matchId &&
            (gk['TEAM'] || '').trim().toLowerCase() === 'egypt'
        );
        
        if (!championshipStats.has(championship)) {
            championshipStats.set(championship, {
                matches: 0,
                goalsConceded: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }
        
        const stats = championshipStats.get(championship);
        stats.matches++;
        if (gkRecord) {
            stats.goalsConceded += parseInt(gkRecord['GOALS CONCEDED'] || 0);
            
            // Calculate penalties for this match
            const penalties = calculateGoalkeeperPenaltiesForMatch(goalkeeperName, matchId, allGKsByMatch, playerDetails, howPenMissed);
            stats.penaltiesConceded += penalties.penaltiesConceded;
            stats.penaltiesSaved += penalties.penaltiesSaved;
        }
    });
    
    // Convert to array and sort by matches (desc) then goals conceded (desc)
    const championshipArray = Array.from(championshipStats.entries()).map(([championship, stats]) => ({
        championship,
        ...stats
    })).sort((a, b) => {
        // First sort by matches (descending)
        if (b.matches !== a.matches) {
            return b.matches - a.matches;
        }
        // Then sort by goals conceded (descending)
        return b.goalsConceded - a.goalsConceded;
    });
    
    // Display championships
    championshipArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.championship}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.goalsConceded === 0 ? '-' : stats.goalsConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesConceded === 0 ? '-' : stats.penaltiesConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesSaved === 0 ? '-' : stats.penaltiesSaved}</td>
        `;
    });
}

function loadGoalkeeperSeasons(goalkeeperName, goalkeeperMatchIds) {
    const tbody = document.getElementById('goalkeeper-seasons-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (goalkeeperMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No seasons found</td></tr>';
        return;
    }
    
    // Group stats by season
    const seasonStats = new Map();
    const gkDetails = egyptTeamsData.gkDetails || [];
    const playerDetails = egyptTeamsData.playerDetails || [];
    const howPenMissed = egyptTeamsData.howPenMissed || [];
    
    // Get all GKs by match for penalty calculation
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const team = (record.TEAM || '').trim().toLowerCase();
        if (team === 'egypt' && goalkeeperMatchIds.has(matchId)) {
            const key = `${matchId}_${team}`;
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        }
    });
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = match['MATCH_ID'];
        if (!goalkeeperMatchIds.has(matchId)) return;
        
        const season = match['SEASON'] || 'Unknown';
        
        // Get goalkeeper details for goals conceded
        const gkRecord = gkDetails.find(gk => 
            (gk['PLAYER NAME'] || '').trim() === goalkeeperName && 
            (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim() === matchId &&
            (gk['TEAM'] || '').trim().toLowerCase() === 'egypt'
        );
        
        if (!seasonStats.has(season)) {
            seasonStats.set(season, {
                matches: 0,
                goalsConceded: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }
        
        const stats = seasonStats.get(season);
        stats.matches++;
        if (gkRecord) {
            stats.goalsConceded += parseInt(gkRecord['GOALS CONCEDED'] || 0);
            
            // Calculate penalties for this match
            const penalties = calculateGoalkeeperPenaltiesForMatch(goalkeeperName, matchId, allGKsByMatch, playerDetails, howPenMissed);
            stats.penaltiesConceded += penalties.penaltiesConceded;
            stats.penaltiesSaved += penalties.penaltiesSaved;
        }
    });
    
    // Convert to array and sort alphabetically (newest first - reverse alphabetical by year)
    const seasonArray = Array.from(seasonStats.entries()).map(([season, stats]) => ({
        season,
        ...stats
    })).sort((a, b) => b.season.localeCompare(a.season));
    
    // Display seasons
    seasonArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.season}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.goalsConceded === 0 ? '-' : stats.goalsConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesConceded === 0 ? '-' : stats.penaltiesConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesSaved === 0 ? '-' : stats.penaltiesSaved}</td>
        `;
    });
}

function loadGoalkeeperVsTeams(goalkeeperName, goalkeeperMatchIds) {
    const tbody = document.getElementById('goalkeeper-vsteams-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (goalkeeperMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No teams found</td></tr>';
        return;
    }
    
    // Group stats by opponent team
    const teamStats = new Map();
    const gkDetails = egyptTeamsData.gkDetails || [];
    const playerDetails = egyptTeamsData.playerDetails || [];
    const howPenMissed = egyptTeamsData.howPenMissed || [];
    
    // Get all GKs by match for penalty calculation
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const team = (record.TEAM || '').trim().toLowerCase();
        if (team === 'egypt' && goalkeeperMatchIds.has(matchId)) {
            const key = `${matchId}_${team}`;
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        }
    });
    
    egyptTeamsData.filteredRecords.forEach(match => {
        const matchId = match['MATCH_ID'];
        if (!goalkeeperMatchIds.has(matchId)) return;
        
        const opponentTeam = match['OPPONENT TEAM'] || 'Unknown';
        
        // Get goalkeeper details for goals conceded
        const gkRecord = gkDetails.find(gk => 
            (gk['PLAYER NAME'] || '').trim() === goalkeeperName && 
            (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim() === matchId &&
            (gk['TEAM'] || '').trim().toLowerCase() === 'egypt'
        );
        
        if (!teamStats.has(opponentTeam)) {
            teamStats.set(opponentTeam, {
                matches: 0,
                goalsConceded: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }
        
        const stats = teamStats.get(opponentTeam);
        stats.matches++;
        if (gkRecord) {
            stats.goalsConceded += parseInt(gkRecord['GOALS CONCEDED'] || 0);
            
            // Calculate penalties for this match
            const penalties = calculateGoalkeeperPenaltiesForMatch(goalkeeperName, matchId, allGKsByMatch, playerDetails, howPenMissed);
            stats.penaltiesConceded += penalties.penaltiesConceded;
            stats.penaltiesSaved += penalties.penaltiesSaved;
        }
    });
    
    // Convert to array and sort by matches (desc) then goals conceded (desc)
    const teamArray = Array.from(teamStats.entries()).map(([team, stats]) => ({
        team,
        ...stats
    })).sort((a, b) => {
        // First sort by matches (descending)
        if (b.matches !== a.matches) {
            return b.matches - a.matches;
        }
        // Then sort by goals conceded (descending)
        return b.goalsConceded - a.goalsConceded;
    });
    
    // Display teams
    teamArray.forEach(stats => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="font-weight: 600;">${stats.team}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.matches}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.goalsConceded === 0 ? '-' : stats.goalsConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesConceded === 0 ? '-' : stats.penaltiesConceded}</td>
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.penaltiesSaved === 0 ? '-' : stats.penaltiesSaved}</td>
        `;
    });
}

function switchGoalkeeperTab(tabName) {
    // Remove active class from goalkeeper tab buttons
    const goalkeeperTabButtons = document.querySelectorAll('#goalkeeper-info-container .tab-button');
    goalkeeperTabButtons.forEach(button => button.classList.remove('active'));
    
    // Hide all goalkeeper tab contents
    document.querySelectorAll('#goalkeeper-matches-tab, #goalkeeper-championships-tab, #goalkeeper-seasons-tab, #goalkeeper-vsteams-tab').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected tab
    if (tabName === 'goalkeeper-matches') {
        document.getElementById('goalkeeper-matches-tab').classList.add('active');
        goalkeeperTabButtons[0].classList.add('active');
    } else if (tabName === 'goalkeeper-championships') {
        document.getElementById('goalkeeper-championships-tab').classList.add('active');
        goalkeeperTabButtons[1].classList.add('active');
    } else if (tabName === 'goalkeeper-seasons') {
        document.getElementById('goalkeeper-seasons-tab').classList.add('active');
        goalkeeperTabButtons[2].classList.add('active');
    } else if (tabName === 'goalkeeper-vsteams') {
        document.getElementById('goalkeeper-vsteams-tab').classList.add('active');
        goalkeeperTabButtons[3].classList.add('active');
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Egypt Teams page loaded');
    loadEgyptTeamsData();
    // Setup search after a short delay to ensure DOM is ready
    setTimeout(() => {
        setupDynamicTableSearch();
        setupAllPlayersSearch();
    }, 500);
});

