// ============================================================================
// AFCON EGYPT TEAMS MODULE - JAVASCRIPT
// ============================================================================

// Global data storage
let afconEgyptTeamsData = {
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
    goalkeepersData: [],
    goalkeepersSearchTerm: '',
    goalkeepersTeamFilter: 'all',
    trophySeasons: [], // Store trophy-winning seasons
    playersByRoundData: [],
    playersByRoundFiltered: [],
    playersByRoundTeamFilter: 'all',
    playersByRoundSearchTerm: ''
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

async function loadAfconEgyptTeamsData(forceRefresh = false, skipLoadingState = false) {
    // Disable Sync Button during initial load only if not force refresh (which handles its own state) or if explicitly requested
    const refreshBtn = document.querySelector('.finals-refresh-btn');

    if (!skipLoadingState && refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.6';
        refreshBtn.style.cursor = 'not-allowed';

        // Update to Syncing state
        refreshBtn.innerHTML = refreshBtn.innerHTML.replace('Sync Data', 'Syncing...');
        const currentIcon = refreshBtn.querySelector('svg');
        if (currentIcon) {
            currentIcon.classList.add('spinning');
        }
    }

    try {
        if (!skipLoadingState) {
            showLoading();
        }

        const url = forceRefresh ? '/api/afcon-egypt-teams/matches?refresh=true' : '/api/afcon-egypt-teams/matches';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Store data
        afconEgyptTeamsData.allRecords = data.matches || [];
        afconEgyptTeamsData.filteredRecords = [...afconEgyptTeamsData.allRecords];

        // Load trophy seasons
        await loadTrophySeasons(forceRefresh);

        // Populate filter options
        populateFilterOptions();

        // Calculate statistics
        calculateStatistics();

        // Update UI
        updateOverviewStats();
        displayMatches();
        setupDynamicTableSearch();

        // If force refresh and players data is loaded, refresh player details too
        if (forceRefresh && afconEgyptTeamsData.playersLoaded) {
            console.log('🔄 Force refreshing player details...');
            afconEgyptTeamsData.playersLoaded = false;
            afconEgyptTeamsData.playerDetailsLoaded = false;
            await loadPlayersData(true);
        }

        // If force refresh and player details loaded (for referees), refresh it
        if (forceRefresh && afconEgyptTeamsData.playerDetailsLoaded && !afconEgyptTeamsData.playersLoaded) {
            console.log('🔄 Force refreshing player details only...');
            afconEgyptTeamsData.playerDetailsLoaded = false;
            await loadPlayerDetailsOnly(true);
        }

        if (!skipLoadingState) {
            hideLoading();
        }

        console.log('✅ Afcon Egypt Teams data refreshed successfully');

    } catch (error) {
        console.error('Error loading Afcon Egypt Teams data:', error);
        if (!skipLoadingState) {
            hideLoading();
        }
        showError('No Data Available');
    } finally {
        // Re-enable Sync Button after load ONLY if we are controlling the state locally (not skipped)
        if (!skipLoadingState && refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
            refreshBtn.style.cursor = 'pointer';

            // Restore text and remove spinning class
            refreshBtn.innerHTML = refreshBtn.innerHTML.replace('Syncing...', 'Sync Data');
            const icon = refreshBtn.querySelector('svg');
            if (icon) icon.classList.remove('spinning');
        }
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
    const records = afconEgyptTeamsData.filteredRecords;

    afconEgyptTeamsData.totalMatches = records.length;
    afconEgyptTeamsData.wins = records.filter(r => r['W-D-L'] === 'W').length;
    afconEgyptTeamsData.draws = records.filter(r => ['D', 'D WITH G', 'D.'].includes(r['W-D-L'])).length;
    afconEgyptTeamsData.losses = records.filter(r => r['W-D-L'] === 'L').length;
    afconEgyptTeamsData.totalGoalsFor = records.reduce((sum, r) => sum + (parseInt(r['GF'] || 0)), 0);
    afconEgyptTeamsData.totalGoalsAgainst = records.reduce((sum, r) => sum + (parseInt(r['GA'] || 0)), 0);

    // Clean Sheet For: matches where GA = 0 (no goals conceded)
    afconEgyptTeamsData.cleanSheetFor = records.filter(r => parseInt(r['GA'] || 0) === 0).length;

    // Clean Sheet Against: matches where GF = 0 (no goals scored)
    afconEgyptTeamsData.cleanSheetAgainst = records.filter(r => parseInt(r['GF'] || 0) === 0).length;

    // Calculate longest streaks
    afconEgyptTeamsData.longestWinStreak = calculateLongestStreak(records, ['W']);
    afconEgyptTeamsData.longestDrawStreak = calculateLongestStreak(records, ['D', 'D WITH G', 'D.']);
    afconEgyptTeamsData.longestLossStreak = calculateLongestStreak(records, ['L']);
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

function updateOverviewStats() {
    document.getElementById('total-matches').textContent = afconEgyptTeamsData.totalMatches;
    document.getElementById('total-wins').textContent = afconEgyptTeamsData.wins;
    document.getElementById('total-draws').textContent = afconEgyptTeamsData.draws;
    document.getElementById('total-losses').textContent = afconEgyptTeamsData.losses;
    document.getElementById('total-goals-for').textContent = afconEgyptTeamsData.totalGoalsFor;
    document.getElementById('total-goals-against').textContent = afconEgyptTeamsData.totalGoalsAgainst;
    document.getElementById('clean-sheet-for').textContent = afconEgyptTeamsData.cleanSheetFor;
    document.getElementById('clean-sheet-against').textContent = afconEgyptTeamsData.cleanSheetAgainst;
    document.getElementById('longest-win-streak').textContent = afconEgyptTeamsData.longestWinStreak;
    document.getElementById('longest-draw-streak').textContent = afconEgyptTeamsData.longestDrawStreak;
    document.getElementById('longest-loss-streak').textContent = afconEgyptTeamsData.longestLossStreak;
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

    const matches = afconEgyptTeamsData.filteredRecords.slice().reverse(); // Show latest first

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
        const currentMatches = afconEgyptTeamsData.filteredRecords.slice().reverse();

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
    const uniqueValues = [...new Set(afconEgyptTeamsData.allRecords
        .map(r => r[fieldName])
        .filter(val => val && val.trim() !== ''))]
        .sort();

    // Store the values on the input element
    input.dataset.options = JSON.stringify(uniqueValues);
    input.dataset.allOptions = JSON.stringify(uniqueValues);

    // Handle input focus - show all options
    input.addEventListener('focus', function () {
        showDropdownOptions(this, uniqueValues);
    });

    // Handle input - filter options
    input.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const filteredOptions = uniqueValues.filter(opt =>
            opt.toLowerCase().includes(searchTerm)
        );
        showDropdownOptions(this, filteredOptions);
    });

    // Handle clicking outside to close dropdown
    document.addEventListener('click', function (e) {
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
    allOption.addEventListener('click', function () {
        input.value = '';
        dropdown.style.display = 'none';
    });
    dropdown.appendChild(allOption);

    // Add filtered options
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

function populateFilterOptions() {
    const records = afconEgyptTeamsData.allRecords;

    // Extract unique values for each filter
    const filterFields = {
        'filter-match-id': 'MATCH_ID',
        'filter-system-kind': 'SYSTEM KIND',
        'filter-age': 'AGE',
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
        'filter-wl-qf': 'W-L Q & F',
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

// Load trophy seasons from API
async function loadTrophySeasons(forceRefresh = false) {
    if (afconEgyptTeamsData.trophySeasons.length > 0 && !forceRefresh) {
        return;
    }
    try {
        const url = forceRefresh ? '/api/afcon-egypt-teams/trophy-seasons?refresh=true' : '/api/afcon-egypt-teams/trophy-seasons';
        const response = await fetch(url);
        if (!response.ok) {
            console.warn('⚠️ Could not load trophy seasons');
            afconEgyptTeamsData.trophySeasons = [];
            return;
        }

        const data = await response.json();
        if (data.error) {
            console.warn('⚠️ Error loading trophy seasons:', data.error);
            afconEgyptTeamsData.trophySeasons = [];
            return;
        }

        afconEgyptTeamsData.trophySeasons = data.seasons || [];
        console.log(`✅ Loaded ${afconEgyptTeamsData.trophySeasons.length} trophy-winning seasons`);
    } catch (error) {
        console.error('Error loading trophy seasons:', error);
        afconEgyptTeamsData.trophySeasons = [];
    }
}

function applyFilters() {
    const filters = {
        trophy: document.getElementById('filter-trophy').value,
        matchId: document.getElementById('filter-match-id').value.trim(),
        systemKind: document.getElementById('filter-system-kind').value,
        age: document.getElementById('filter-age').value,
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
        wlQf: document.getElementById('filter-wl-qf').value,
        et: document.getElementById('filter-et').value,
        pen: document.getElementById('filter-pen').value,
        note: document.getElementById('filter-note').value.trim(),
        gf: document.getElementById('filter-gf').value,
        ga: document.getElementById('filter-ga').value
    };

    // Filter records
    afconEgyptTeamsData.filteredRecords = afconEgyptTeamsData.allRecords.filter(record => {
        // Trophy filter - only show matches from trophy-winning seasons
        if (filters.trophy === 'only-trophy') {
            const season = record['SEASON'] || '';
            if (!afconEgyptTeamsData.trophySeasons.includes(season)) {
                return false;
            }
        }

        // Match ID filter
        if (filters.matchId && record['MATCH_ID'] !== filters.matchId) return false;

        // Dropdown filters
        if (filters.systemKind && record['SYSTEM KIND'] !== filters.systemKind) return false;
        if (filters.age && record['AGE'] !== filters.age) return false;
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
        if (filters.wlQf && record['W-L Q & F'] !== filters.wlQf) return false;
        if (filters.et && record['ET'] !== filters.et) return false;
        if (filters.pen && record['PEN'] !== filters.pen) return false;
        if (filters.note && !record['NOTE']?.toLowerCase().includes(filters.note.toLowerCase())) return false;

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
    if (afconEgyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
    }

    // Recalculate selected player stats if a player is selected
    if (afconEgyptTeamsData.selectedPlayer) {
        calculatePlayerIndividualStats(afconEgyptTeamsData.selectedPlayer);
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
        const allClubsBySeasonTab = document.getElementById('elnady-all-clubs-by-season-tab');
        if (allClubsTab && allClubsTab.classList.contains('active')) {
            loadAllClubsStats();
        } else if (allClubsBySeasonTab && allClubsBySeasonTab.classList.contains('active')) {
            loadAllClubsBySeason();
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
    if (goalkeepersTab && goalkeepersTab.classList.contains('active') && afconEgyptTeamsData.playersLoaded) {
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

    console.log(`Filtered ${afconEgyptTeamsData.filteredRecords.length} of ${afconEgyptTeamsData.allRecords.length} matches`);

    // Update All Players By Round data
    if (afconEgyptTeamsData.playersLoaded) {
        calculatePlayersByRoundStats();
    }

    const playersByRoundTab = document.getElementById('players-by-round-tab');
    if (playersByRoundTab && playersByRoundTab.classList.contains('active')) {
        loadPlayersByRound();
    }
}

function clearFilters() {
    document.getElementById('filter-trophy').value = '';
    document.getElementById('filter-match-id').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-gf').value = '';
    document.getElementById('filter-ga').value = '';
    document.getElementById('filter-note').value = '';

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
    afconEgyptTeamsData.filteredRecords = [...afconEgyptTeamsData.allRecords];

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
    if (afconEgyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
    }

    // Recalculate selected player stats if a player is selected
    if (afconEgyptTeamsData.selectedPlayer) {
        calculatePlayerIndividualStats(afconEgyptTeamsData.selectedPlayer);
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
        const allClubsBySeasonTab = document.getElementById('elnady-all-clubs-by-season-tab');
        if (allClubsTab && allClubsTab.classList.contains('active')) {
            loadAllClubsStats();
        } else if (allClubsBySeasonTab && allClubsBySeasonTab.classList.contains('active')) {
            loadAllClubsBySeason();
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
    if (goalkeepersTab && goalkeepersTab.classList.contains('active') && afconEgyptTeamsData.playersLoaded) {
        loadGoalkeepersStats();
    }

    console.log('Filters cleared');

    if (afconEgyptTeamsData.playersLoaded) {
        calculatePlayersByRoundStats();
    }

    const playersByRoundTab = document.getElementById('players-by-round-tab');
    if (playersByRoundTab && playersByRoundTab.classList.contains('active')) {
        loadPlayersByRound();
    }
}

// ============================================================================
// PLAYERS DATA FUNCTIONS
// ============================================================================

async function loadPlayerDetailsOnly(forceRefresh = false) {
    try {
        const url = forceRefresh ? '/api/afcon-egypt-teams/player-details?refresh=true' : '/api/afcon-egypt-teams/player-details';
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        afconEgyptTeamsData.playerDetails = data.playerDetails || [];
        afconEgyptTeamsData.gkDetails = data.gkDetails || [];
        afconEgyptTeamsData.howPenMissed = data.howPenMissed || [];
        afconEgyptTeamsData.playerDetailsLoaded = true;

        console.log('✅ Player details loaded for referees stats');

    } catch (error) {
        console.error('Error loading player details:', error);
    }
}

async function loadPlayersData(forceRefresh = false) {
    try {
        showPlayersLoading();

        const url = forceRefresh ? '/api/afcon-egypt-teams/player-details?refresh=true' : '/api/afcon-egypt-teams/player-details';
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

        afconEgyptTeamsData.playerDatabase = data.playerDatabase || [];
        afconEgyptTeamsData.playerDetails = data.playerDetails || [];
        afconEgyptTeamsData.lineupDetails = data.lineupDetails || [];
        afconEgyptTeamsData.gkDetails = data.gkDetails || [];
        afconEgyptTeamsData.howPenMissed = data.howPenMissed || [];
        afconEgyptTeamsData.playersLoaded = true;
        afconEgyptTeamsData.playerDetailsLoaded = true;

        // Calculate player statistics from filtered matches
        calculatePlayerStatistics();

        displayPlayers();

        calculatePlayersByRoundStats();

        hidePlayersLoading();

    } catch (error) {
        console.error('Error loading players data:', error);
        hidePlayersLoading();
        showPlayersError('No Data Available');
    }
}

function calculatePlayerStatistics() {
    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Separate official and friendly match IDs
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
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

    afconEgyptTeamsData.playerDetails.forEach(detail => {
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
    afconEgyptTeamsData.playerDetails.forEach(detail => {
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

    afconEgyptTeamsData.playerDatabase.forEach((player, index) => {
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
    afconEgyptTeamsData.allPlayers = Array.from(playersMap.values());

    // Set players to all players by default
    afconEgyptTeamsData.players = [...afconEgyptTeamsData.allPlayers];

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
        afconEgyptTeamsData.players = [...afconEgyptTeamsData.allPlayers];
        return;
    }

    const filterValue = filterSelect.value;

    if (filterValue === 'all') {
        afconEgyptTeamsData.players = [...afconEgyptTeamsData.allPlayers];
    } else if (filterValue === 'egypt') {
        // Filter players where team contains "Egypt" or "مصر" (case insensitive)
        afconEgyptTeamsData.players = afconEgyptTeamsData.allPlayers.filter(player => {
            const team = (player.team || '').toLowerCase();
            return team.includes('egypt') || team.includes('مصر');
        });
    } else if (filterValue === 'opponent') {
        // Filter players where team does NOT contain "Egypt" or "مصر"
        afconEgyptTeamsData.players = afconEgyptTeamsData.allPlayers.filter(player => {
            const team = (player.team || '').toLowerCase();
            return !team.includes('egypt') && !team.includes('مصر');
        });
    }

    displayPlayers();
    console.log(`Filtered players: ${afconEgyptTeamsData.players.length} of ${afconEgyptTeamsData.allPlayers.length}`);
}

async function loadPlayersByRound() {
    try {
        if (!afconEgyptTeamsData.playersLoaded) {
            await loadPlayersData();
        }
        calculatePlayersByRoundStats();
        setupPlayersByRoundSearch();
    } catch (error) {
        console.error('Error loading players by round:', error);
        const tbody = document.getElementById('players-by-round-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: #999;">Unable to load data</td></tr>';
        }
    }
}

function setupPlayersByRoundSearch() {
    const searchInput = document.getElementById('players-by-round-search');
    if (!searchInput) return;

    // Remove existing event listeners by cloning the element
    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('input', function () {
        const searchTerm = this.value.trim();
        afconEgyptTeamsData.playersByRoundSearchTerm = searchTerm;
        filterAndDisplayPlayersByRound();
    });
}

function calculatePlayersByRoundStats() {
    if (!afconEgyptTeamsData.playersLoaded) return;

    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    if (filteredMatchIds.size === 0) {
        displayPlayersByRoundTable([], []);
        return;
    }

    const matchIdToRound = new Map();
    afconEgyptTeamsData.filteredRecords.forEach(match => {
        const matchId = match['MATCH_ID'] || '';
        const round = (match['ROUND'] || '').trim() || 'Unknown';
        if (matchId) {
            matchIdToRound.set(matchId, round);
        }
    });

    const playerStats = new Map();
    const roundsFound = new Set();
    const playerTeams = new Map(); // Map to store player teams

    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        if (!playerName) return;

        const gaValue = (detail['GA'] || '').trim();
        const isGoal = gaValue === 'GOAL';
        const isAssist = gaValue === 'ASSIST';

        // Only process GOAL or ASSIST
        if (!isGoal && !isAssist) return;

        const matchId = (detail['MATCH_ID'] || '').trim();
        if (!filteredMatchIds.has(matchId)) return;

        const gatotal = parseInt(detail['GATOTAL']) || 0;
        if (!gatotal) return;

        const round = matchIdToRound.get(matchId) || 'Unknown';
        roundsFound.add(round);

        // Store player team
        const team = (detail['TEAM'] || '').trim();
        if (team && !playerTeams.has(playerName)) {
            playerTeams.set(playerName, team);
        }

        if (!playerStats.has(playerName)) {
            playerStats.set(playerName, {
                playerName,
                totalGoals: 0,
                totalAssists: 0,
                totalGA: 0,
                roundGoals: {},
                roundAssists: {},
                roundGA: {},
                team: team || ''
            });
        }

        const stats = playerStats.get(playerName);

        // Update team if not set
        if (!stats.team && team) {
            stats.team = team;
        }

        if (isGoal) {
            stats.totalGoals += gatotal;
            stats.roundGoals[round] = (stats.roundGoals[round] || 0) + gatotal;
        } else if (isAssist) {
            stats.totalAssists += gatotal;
            stats.roundAssists[round] = (stats.roundAssists[round] || 0) + gatotal;
        }

        // Combined G+A
        stats.totalGA += gatotal;
        stats.roundGA[round] = (stats.roundGA[round] || 0) + gatotal;
    });

    const finalRoundOrder = getRoundDisplayOrder(roundsFound);

    // Initial sort by goals (legacy behavior, will be re-sorted in display function)
    const playersArray = Array.from(playerStats.values())
        .filter(player => player.totalGA > 0)
        .sort((a, b) => {
            if (b.totalGoals !== a.totalGoals) {
                return b.totalGoals - a.totalGoals;
            }
            return a.playerName.localeCompare(b.playerName);
        });

    afconEgyptTeamsData.playersByRoundData = playersArray;
    afconEgyptTeamsData.playersByRoundOrder = finalRoundOrder;
    afconEgyptTeamsData.playersByRoundFiltered = [...playersArray];
    filterAndDisplayPlayersByRound();
}

function getRoundDisplayOrder(roundsFoundSet) {
    // Fixed order for rounds
    const fixedOrder = ['G.S', '16', '8', '4', 'Bronze Medal', 'Final', 'Playoff.GS'];

    const roundsFound = Array.from(roundsFoundSet || []);

    // Create a map for quick lookup of order index
    const orderMap = new Map();
    fixedOrder.forEach((round, index) => {
        orderMap.set(round, index);
    });

    // Separate rounds into: those in fixed order and those not
    const orderedRounds = [];
    const unorderedRounds = [];

    roundsFound.forEach(round => {
        if (orderMap.has(round)) {
            orderedRounds.push({ round, order: orderMap.get(round) });
        } else {
            unorderedRounds.push(round);
        }
    });

    // Sort ordered rounds by their order index
    orderedRounds.sort((a, b) => a.order - b.order);

    // Sort unordered rounds alphabetically
    unorderedRounds.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

    // Combine: ordered rounds first (in fixed order), then unordered rounds
    const finalOrder = [
        ...orderedRounds.map(item => item.round),
        ...unorderedRounds
    ];

    return finalOrder;
}

function filterPlayersByRoundByTeam() {
    const filterSelect = document.getElementById('players-by-round-team-filter');
    if (!filterSelect) {
        afconEgyptTeamsData.playersByRoundFiltered = [...afconEgyptTeamsData.playersByRoundData];
        filterAndDisplayPlayersByRound();
        return;
    }

    const filterValue = filterSelect.value;
    afconEgyptTeamsData.playersByRoundTeamFilter = filterValue;

    filterAndDisplayPlayersByRound();
}

function filterAndDisplayPlayersByRound() {
    let playersToDisplay = [...afconEgyptTeamsData.playersByRoundData];

    // Get selected metric
    const metricElement = document.querySelector('input[name="players-round-metric"]:checked');
    const metric = metricElement ? metricElement.value : 'goals'; // 'goals', 'assists', 'ga'

    // Apply team filter
    const teamFilter = afconEgyptTeamsData.playersByRoundTeamFilter || 'all';
    if (teamFilter === 'egypt') {
        playersToDisplay = playersToDisplay.filter(player => {
            const team = (player.team || '').toLowerCase();
            return team.includes('egypt') || team.includes('مصر');
        });
    } else if (teamFilter === 'opponent') {
        playersToDisplay = playersToDisplay.filter(player => {
            const team = (player.team || '').toLowerCase();
            return !team.includes('egypt') && !team.includes('مصر');
        });
    }

    // Filter by metric > 0
    if (metric === 'goals') {
        playersToDisplay = playersToDisplay.filter(p => p.totalGoals > 0);
    } else if (metric === 'assists') {
        playersToDisplay = playersToDisplay.filter(p => p.totalAssists > 0);
    } else { // ga
        playersToDisplay = playersToDisplay.filter(p => p.totalGA > 0);
    }

    // Sort by metric
    playersToDisplay.sort((a, b) => {
        let valA = 0, valB = 0;
        if (metric === 'goals') { valA = a.totalGoals; valB = b.totalGoals; }
        else if (metric === 'assists') { valA = a.totalAssists; valB = b.totalAssists; }
        else { valA = a.totalGA; valB = b.totalGA; }

        if (valB !== valA) return valB - valA;
        return a.playerName.localeCompare(b.playerName);
    });

    // Apply search filter
    const searchTerm = afconEgyptTeamsData.playersByRoundSearchTerm || '';
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        playersToDisplay = playersToDisplay.filter(player => {
            const playerName = String(player.playerName || '').toLowerCase();
            const totalGoals = String(player.totalGoals || '').toLowerCase();
            const totalAssists = String(player.totalAssists || '').toLowerCase();
            const totalGA = String(player.totalGA || '').toLowerCase();
            return playerName.includes(lowerSearchTerm) ||
                totalGoals.includes(lowerSearchTerm) ||
                totalAssists.includes(lowerSearchTerm) ||
                totalGA.includes(lowerSearchTerm);
        });
    }

    // Display filtered players
    const roundOrder = afconEgyptTeamsData.playersByRoundOrder || [];
    displayPlayersByRoundTable(playersToDisplay, roundOrder, metric);
}

function displayPlayersByRoundTable(playersArray, roundOrder = [], metric = 'goals') {
    const thead = document.getElementById('players-by-round-thead');
    const tbody = document.getElementById('players-by-round-tbody');
    if (!thead || !tbody) return;

    let headerTitle = 'Total Goals';
    let headerColor = '#1d4ed8'; // Blue for goals

    if (metric === 'assists') {
        headerTitle = 'Total Assists';
        headerColor = '#f59e0b'; // Amber for assists
    } else if (metric === 'ga') {
        headerTitle = 'Total G+A';
        headerColor = '#667eea'; // Purple for G+A
    }

    const headerCells = ['#', 'Player Name', headerTitle, ...roundOrder];
    thead.innerHTML = `
        <tr>
            ${headerCells.map(title => `<th>${escapeHtml(title)}</th>`).join('')}
        </tr>
    `;

    if (!playersArray || playersArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${headerCells.length}" style="text-align: center; padding: 2rem; color: #999;">No data available</td></tr>`;
        return;
    }

    let rank = 1;
    const rowsHtml = playersArray.map(player => {
        let totalValue = player.totalGoals;
        if (metric === 'assists') totalValue = player.totalAssists;
        else if (metric === 'ga') totalValue = player.totalGA;

        const roundCells = roundOrder.map(round => {
            let value = 0;
            if (metric === 'goals') value = player.roundGoals[round] || 0;
            else if (metric === 'assists') value = player.roundAssists[round] || 0;
            else if (metric === 'ga') value = player.roundGA[round] || 0;

            const displayValue = value > 0 ? value : '-';
            // Use different filtering colors for cell values > 0
            const cellColor = value > 0 ? '#1f2937' : 'inherit';
            return `<td style="text-align: center; font-weight: ${value > 0 ? '600' : 'normal'}; font-size: ${value > 0 ? '1.1rem' : '1rem'}; color: ${cellColor};">${displayValue}</td>`;
        }).join('');

        return `
            <tr>
                <td style="text-align: center;">${rank++}</td>
                <td style="font-weight: 600;">${escapeHtml(player.playerName)}</td>
                <td style="text-align: center; font-weight: 700; color: ${headerColor}; font-size: 1.1rem;">${totalValue}</td>
                ${roundCells}
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

function sortPlayersBy(column) {
    // Toggle sort direction if clicking the same column
    if (afconEgyptTeamsData.currentSortColumn === column) {
        afconEgyptTeamsData.currentSortDirection = afconEgyptTeamsData.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Default to descending for new column (except for playerName)
        afconEgyptTeamsData.currentSortColumn = column;
        afconEgyptTeamsData.currentSortDirection = column === 'playerName' ? 'asc' : 'desc';
    }

    // Update header classes
    const headers = document.querySelectorAll('.sortable-header');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });

    // Add class to current sorted column
    const currentHeader = document.querySelector(`[onclick="sortPlayersBy('${column}')"]`);
    if (currentHeader) {
        currentHeader.classList.add(`sorted-${afconEgyptTeamsData.currentSortDirection}`);
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
    let playersToDisplay = afconEgyptTeamsData.players;

    // If there's a search term, filter the players
    if (searchTerm) {
        playersToDisplay = afconEgyptTeamsData.players.filter((player) => {
            const playerName = String(player.playerName || '').toLowerCase();
            const matches = String(player.matches || '').toLowerCase();
            const minutes = String(player.minutes || '').toLowerCase();
            const totalGA = String(player.totalGA || '').toLowerCase();
            const officialGoals = String(player.officialGoals || '').toLowerCase();
            const officialAssists = String(player.officialAssists || '').toLowerCase();

            const rowText = `${playerName} ${matches} ${minutes} ${totalGA} ${officialGoals} ${officialAssists}`;
            return rowText.includes(searchTerm);
        });
    }

    if (playersToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No players found</td></tr>';
        return;
    }

    // Sort players based on current sort column and direction
    const sortedPlayers = [...playersToDisplay].sort((a, b) => {
        const column = afconEgyptTeamsData.currentSortColumn;
        const direction = afconEgyptTeamsData.currentSortDirection;

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
            <td style="text-align: center;"><span style="color: #ff6b35; font-weight: bold; font-size: 1.1rem;">${player.officialAssists}</span></td>
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
    document.addEventListener('click', function (e) {
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
    const uniquePlayers = [...new Set(afconEgyptTeamsData.playerDatabase
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
    afconEgyptTeamsData.selectedPlayer = playerName;

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
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Separate official and friendly match IDs
    const officialMatchIds = new Set();
    const friendlyMatchIds = new Set();

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
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

    afconEgyptTeamsData.playerDetails.forEach(detail => {
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

    // Load player M By G+A stats
    loadPlayerMatchesByGAStats(playerName);
}

function loadPlayerMatches(playerName, playerMatchIds) {
    const tbody = document.getElementById('player-matches-tbody');
    tbody.innerHTML = '';

    if (playerMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
        return;
    }

    // Get match details for player matches
    const playerMatches = afconEgyptTeamsData.filteredRecords.filter(match =>
        playerMatchIds.has(match['MATCH_ID'])
    ).reverse(); // Latest first

    playerMatches.forEach(match => {
        const matchId = match['MATCH_ID'];

        // Get minutes from lineup
        const lineupRecord = afconEgyptTeamsData.lineupDetails.find(l =>
            (l['PLAYER NAME'] || '').trim() === playerName &&
            (l['MATCH_ID'] || '').trim() === matchId
        );
        const minutes = lineupRecord ? (parseInt(lineupRecord['MINTOTAL']) || 0) : 0;

        // Get goals, assists, and penalty goals
        let goals = 0, assists = 0, penaltyGoals = 0;
        afconEgyptTeamsData.playerDetails.forEach(detail => {
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
        const goalsDisplay = goals > 0 ? goals : '-';
        const penaltyGoalsDisplay = penaltyGoals > 0 ? penaltyGoals : '-';
        const assistsDisplay = assists > 0 ? assists : '-';

        row.innerHTML = `
            <td>${match['DATE'] || ''}</td>
            <td>${match['SEASON'] || ''}</td>
            <td>${match['MANAGER EGY'] || ''}</td>
            <td>${match['OPPONENT TEAM'] || ''}</td>
            <td style="text-align: center;"><strong style="font-size: 1.1rem;">${minutes}'</strong></td>
            <td style="text-align: center;"><strong style="color: #667eea; font-size: 2.2rem;">${goalsDisplay}</strong></td>
            <td style="text-align: center;"><strong style="color: #10b981; font-size: 2.2rem;">${penaltyGoalsDisplay}</strong></td>
            <td style="text-align: center;"><strong style="color: #ff6b35; font-size: 2.2rem;">${assistsDisplay}</strong></td>
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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const championship = (match['CHAMPION'] || 'Unknown').trim();

        matchIdToChampionship.set(matchId, championship);

        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });

    // Get all match IDs where player has goals/assists (from PLAYERDETAILS) - even if not in lineup
    const playerMatchIdsFromDetails = new Set();

    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        const detailMatchId = (detail['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToChampionship.has(detailMatchId)) {
            playerMatchIdsFromDetails.add(detailMatchId);
        }
    });

    // Get match IDs where player played (from LINEUPEGYPT) - for matches and minutes
    const playerPlayedMatchIds = new Set();

    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToChampionship.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });

    if (playerMatchIdsFromDetails.size === 0 && playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No championships found</td></tr>';
        return;
    }

    // Get all championships where player has goals/assists OR played
    const championshipsWithStats = new Set();
    playerMatchIdsFromDetails.forEach(matchId => {
        const championship = matchIdToChampionship.get(matchId) || 'Unknown';
        championshipsWithStats.add(championship);
    });
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
        afconEgyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupChampionship = matchIdToChampionship.get(lineupMatchId);

            if (name === playerName && lineupChampionship === championship) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });

        // Get goals and assists for ALL matches where player has goals/assists (from PLAYERDETAILS)
        playerMatchIdsFromDetails.forEach(matchId => {
            if (matchIdToChampionship.get(matchId) !== championship) return;

            afconEgyptTeamsData.playerDetails.forEach(detail => {
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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const season = (match['SEASON'] || 'Unknown').trim();

        matchIdToSeason.set(matchId, season);

        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });

    // Get all match IDs where player has goals/assists (from PLAYERDETAILS) - even if not in lineup
    const playerMatchIdsFromDetails = new Set();

    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        const detailMatchId = (detail['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToSeason.has(detailMatchId)) {
            playerMatchIdsFromDetails.add(detailMatchId);
        }
    });

    // Get match IDs where player played (from LINEUPEGYPT) - for matches and minutes
    const playerPlayedMatchIds = new Set();

    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToSeason.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });

    if (playerMatchIdsFromDetails.size === 0 && playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No seasons found</td></tr>';
        return;
    }

    // Get all seasons where player has goals/assists OR played
    const seasonsWithStats = new Set();
    playerMatchIdsFromDetails.forEach(matchId => {
        const season = matchIdToSeason.get(matchId) || 'Unknown';
        seasonsWithStats.add(season);
    });
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
        afconEgyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupSeason = matchIdToSeason.get(lineupMatchId);

            if (name === playerName && lineupSeason === season) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });

        // Get goals and assists for ALL matches where player has goals/assists (from PLAYERDETAILS)
        playerMatchIdsFromDetails.forEach(matchId => {
            if (matchIdToSeason.get(matchId) !== season) return;

            afconEgyptTeamsData.playerDetails.forEach(detail => {
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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
        const matchId = (match['MATCH_ID'] || '').trim();
        const championSystem = (match['CHAMPION SYSTEM'] || '').trim();
        const opponent = (match['OPPONENT TEAM'] || 'Unknown').trim();

        matchIdToOpponent.set(matchId, opponent);

        if (championSystem === 'OFI') officialMatchIds.add(matchId);
        if (championSystem === 'FRI') friendlyMatchIds.add(matchId);
    });

    // Get all match IDs where player has goals/assists (from PLAYERDETAILS) - even if not in lineup
    const playerMatchIdsFromDetails = new Set();

    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        const detailMatchId = (detail['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToOpponent.has(detailMatchId)) {
            playerMatchIdsFromDetails.add(detailMatchId);
        }
    });

    // Get match IDs where player played (from LINEUPEGYPT) - for matches and minutes
    const playerPlayedMatchIds = new Set();

    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        const lineupMatchId = (lineup['MATCH_ID'] || '').trim();

        if (name === playerName && matchIdToOpponent.has(lineupMatchId)) {
            playerPlayedMatchIds.add(lineupMatchId);
        }
    });

    if (playerMatchIdsFromDetails.size === 0 && playerPlayedMatchIds.size === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #999;">No opponent teams found</td></tr>';
        return;
    }

    // Get all opponent teams where player has goals/assists OR played
    const opponentsWithStats = new Set();
    playerMatchIdsFromDetails.forEach(matchId => {
        const opponent = matchIdToOpponent.get(matchId) || 'Unknown';
        opponentsWithStats.add(opponent);
    });
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
        afconEgyptTeamsData.lineupDetails.forEach(lineup => {
            const name = (lineup['PLAYER NAME'] || '').trim();
            const lineupMatchId = (lineup['MATCH_ID'] || '').trim();
            const lineupOpponent = matchIdToOpponent.get(lineupMatchId);

            if (name === playerName && lineupOpponent === opponent) {
                stats.matchesInLineup.add(lineupMatchId);
                stats.minutes += parseInt(lineup['MINTOTAL']) || 0;
            }
        });

        // Get goals and assists for ALL matches where player has goals/assists (from PLAYERDETAILS)
        playerMatchIdsFromDetails.forEach(matchId => {
            if (matchIdToOpponent.get(matchId) !== opponent) return;

            afconEgyptTeamsData.playerDetails.forEach(detail => {
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
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }

    // Check if playerDetails is available
    if (!afconEgyptTeamsData.playerDetails || afconEgyptTeamsData.playerDetails.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #999; grid-column: 1 / -1;">No data available</div>';
        return;
    }

    container.innerHTML = '';

    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Group goals by ELNADY (club)
    const clubGoals = {};

    // Get all clubs from LINEUPEGYPT where player played (only from filtered matches)
    afconEgyptTeamsData.lineupDetails.forEach(lineup => {
        const name = (lineup['PLAYER NAME'] || '').trim();
        if (name !== playerName) return;

        const matchId = (lineup['MATCH_ID'] || '').trim();
        // Only include matches that pass the current filters
        if (!filteredMatchIds.has(matchId)) return;

        const elnady = (lineup['ELNADY'] || '').trim();
        if (elnady && !clubGoals[elnady]) {
            clubGoals[elnady] = 0;
        }
    });

    // Count goals for each club (only from filtered matches)
    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const name = (detail['PLAYER NAME'] || '').trim();
        if (name !== playerName) return;

        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        const elnady = (detail['ELNADY'] || '').trim();

        // Only count goals from matches that pass the current filters
        if (!filteredMatchIds.has(matchId)) return;

        // Count goals for this player
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
// M BY G+A FUNCTIONS
// ============================================================================

// Get player matches with goals or assists from AFCON EGYPT TEAM data
function getPlayerMatchesByGAFromAfconData(playerName) {
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Only matches where player has GOAL or ASSIST in PLAYERDETAILS
    const playerGARecords = afconEgyptTeamsData.playerDetails.filter(r => {
        const p = (r['PLAYER NAME'] || '').trim();
        if (p !== playerName) return false;

        const gaValue = (r['GA'] || '').trim();
        const isGoal = gaValue === 'GOAL';
        const isAssist = gaValue === 'ASSIST';
        if (!(isGoal || isAssist)) return false;

        const matchId = (r['MATCH_ID'] || '').trim();
        if (!filteredMatchIds.has(matchId)) return false;
        return true;
    });

    console.log('[MByGA] GA records found:', playerGARecords.length);

    // Aggregate per match
    const aggByMatch = new Map();
    playerGARecords.forEach(r => {
        const matchId = (r['MATCH_ID'] || '').trim();
        if (!matchId) return;
        const gaValue = (r['GA'] || '').trim();
        const gatotal = parseInt(r['GATOTAL']) || 0;

        if (!aggByMatch.has(matchId)) {
            aggByMatch.set(matchId, { goals: 0, assists: 0 });
        }
        const agg = aggByMatch.get(matchId);
        if (gaValue === 'GOAL') {
            agg.goals += gatotal;
        } else if (gaValue === 'ASSIST') {
            agg.assists += gatotal;
        }
    });

    // Join with MATCHDETAILS and minutes from LINEUPDETAILS
    const rows = [];
    aggByMatch.forEach((ga, mid) => {
        const m = afconEgyptTeamsData.filteredRecords.find(x => (x['MATCH_ID'] || '').trim() === mid);
        if (!m) return;

        const lineupRow = afconEgyptTeamsData.lineupDetails.find(l =>
            (l['MATCH_ID'] || '').trim() === mid &&
            (l['PLAYER NAME'] || '').trim() === playerName
        );
        const minutes = lineupRow ? (parseInt(lineupRow['MINTOTAL']) || null) : null;

        // Format date
        let formattedDate = m.DATE || '';
        if (formattedDate) {
            try {
                const numericDate = parseFloat(formattedDate);
                if (!isNaN(numericDate) && numericDate > 25000) {
                    const date = new Date((numericDate - 25569) * 86400 * 1000);
                    formattedDate = date.toLocaleDateString('en-GB');
                } else if (!isNaN(numericDate) && numericDate > 1000 && numericDate < 25000) {
                    const date = new Date((numericDate - 25569) * 86400 * 1000);
                    formattedDate = date.toLocaleDateString('en-GB');
                } else {
                    const date = new Date(formattedDate);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('en-GB');
                    }
                }
            } catch (e) {
                console.log('Error formatting date:', formattedDate, e);
            }
        }

        rows.push({
            date: formattedDate,
            dateRaw: m.DATE || '',
            season: m.SEASON || '',
            manager: m['MANAGER EGY'] || '',
            opponent: m['OPPONENT TEAM'] || '',
            minutes,
            goals: ga.goals,
            assists: ga.assists
        });
    });

    // Sort by date descending (newest to oldest)
    function parseDateStr(s) {
        const str = String(s || '').trim();
        const d = Date.parse(str);
        if (!isNaN(d)) return d;
        const num = Number(str);
        if (!isNaN(num) && str !== '') return new Date((num - 25569) * 86400 * 1000).getTime();
        return 0;
    }
    rows.sort((a, b) => parseDateStr(b.dateRaw) - parseDateStr(a.dateRaw));
    return rows;
}

// Render player matches by G+A table
function renderPlayerMatchesByGATable(items) {
    const table = document.getElementById('player-m-by-ga-table');
    if (!table) {
        console.warn('[MByGA] Table not found');
        return;
    }
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#666;">No matches found</td></tr>';
        return;
    }
    items.forEach(it => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.date || ''}</td>
            <td>${it.season || ''}</td>
            <td>${it.manager || ''}</td>
            <td>${it.opponent || ''}</td>
            <td>${(it.minutes === null || it.minutes === undefined) ? '-' : it.minutes}</td>
            <td>${it.goals || 0}</td>
            <td>${it.assists || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Load player matches by G+A stats
async function loadPlayerMatchesByGAStats(playerNameParam = null) {
    const table = document.getElementById('player-m-by-ga-table');
    if (!table) {
        console.warn('[MByGA] Table not found when loading stats');
        return;
    }
    let tbody = table.querySelector('tbody');
    if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
    }
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#666;">Loading...</td></tr>';

    // Get player name - use parameter if provided, otherwise try to get from selectedPlayer
    let playerName = playerNameParam;
    if (!playerName) {
        if (afconEgyptTeamsData.selectedPlayer) {
            if (typeof afconEgyptTeamsData.selectedPlayer === 'string') {
                playerName = afconEgyptTeamsData.selectedPlayer;
            } else if (afconEgyptTeamsData.selectedPlayer.name) {
                playerName = afconEgyptTeamsData.selectedPlayer.name;
            }
        }
    }

    if (!playerName) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#666;">No player selected</td></tr>';
        return;
    }

    // Load player details if not already loaded
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }

    const items = getPlayerMatchesByGAFromAfconData(playerName);
    renderPlayerMatchesByGATable(items);
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
        if (!afconEgyptTeamsData.playersLoaded) {
            loadPlayersData();
        }

        // Restore last searched match when returning to search tab
        if (window.__lastAfconMatchId) {
            const matches = afconEgyptTeamsData.allRecords || [];
            const match = matches.find(m => {
                const mid = m.MATCH_ID || m['MATCH ID'] || '';
                return String(mid).toLowerCase() === String(window.__lastAfconMatchId).toLowerCase();
            });
            if (match) {
                console.log('🔄 Restoring last searched match:', window.__lastAfconMatchId);
                const matchId = String(match.MATCH_ID || match['MATCH ID'] || '');
                displayEgyptMatchDetails(match);
                displayEgyptMatchLineup(matchId);
                displayEgyptMatchGoals(matchId);
                displayEgyptMatchGoalkeepers(matchId);
                document.getElementById('egypt-match-details-container').style.display = 'block';
                document.getElementById('egypt-no-match-found').style.display = 'none';

                // Reset to first sub-tab (lineup)
                document.querySelectorAll('#egypt-match-details-container .tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('#egypt-match-lineup-content, #egypt-match-goals-content, #egypt-match-goalkeepers-content').forEach(content => content.classList.remove('active'));
                const firstTabBtn = document.querySelector('#egypt-match-details-container .tab-button');
                const firstTabContent = document.getElementById('egypt-match-lineup-content');
                if (firstTabBtn) firstTabBtn.classList.add('active');
                if (firstTabContent) firstTabContent.classList.add('active');
            }
        }
    } else if (tabName === 'h2h') {
        loadH2HStats();
    } else if (tabName === 'managers') {
        loadManagersStats();
    } else if (tabName === 'referees') {
        // Load only PLAYERDETAILS if not already loaded (needed for penalty counting)
        if (!afconEgyptTeamsData.playerDetailsLoaded) {
            loadPlayerDetailsOnly().then(() => {
                loadRefereesStats();
            });
        } else {
            loadRefereesStats();
        }
    } else if (tabName === 'players') {
        // Load players data if not already loaded
        if (!afconEgyptTeamsData.playersLoaded) {
            loadPlayersData();
        }
    } else if (tabName === 'players-by-round') {
        loadPlayersByRound();
    } else if (tabName === 'byplayer') {
        // Setup player search if not already setup
        setupPlayerSearch();
    } else if (tabName === 'goalkeepers') {
        // Load goalkeepers data if not already loaded
        if (!afconEgyptTeamsData.playersLoaded) {
            loadPlayersData().then(() => {
                loadGoalkeepersStats();
            });
        } else {
            loadGoalkeepersStats();
        }
    } else if (tabName === 'bygoalkeepers') {
        // Load player details if not already loaded (needed for gkDetails)
        if (!afconEgyptTeamsData.playerDetailsLoaded) {
            loadPlayerDetailsOnly().then(() => {
                setupGoalkeeperSearch();
            });
        } else {
            setupGoalkeeperSearch();
        }
    } else if (tabName === 'elnady') {
        // Load all clubs stats by default
        loadAllClubsStats();
        // Make sure all-clubs tab is active by default
        const allClubsTab = document.getElementById('elnady-all-clubs-tab');
        if (allClubsTab) {
            allClubsTab.classList.add('active');
        }
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
    document.querySelectorAll('#player-overview-tab, #player-matches-tab, #player-m-by-ga-tab, #player-championships-tab, #player-seasons-tab, #player-vsteams-tab, #player-elnady-tab').forEach(content => {
        content.classList.remove('active');
    });

    // Show selected tab
    if (tabName === 'player-overview') {
        document.getElementById('player-overview-tab').classList.add('active');
        playerTabButtons[0].classList.add('active');
    } else if (tabName === 'player-matches') {
        document.getElementById('player-matches-tab').classList.add('active');
        playerTabButtons[1].classList.add('active');
    } else if (tabName === 'player-m-by-ga') {
        document.getElementById('player-m-by-ga-tab').classList.add('active');
        playerTabButtons[2].classList.add('active');
        // Load M By G+A data when tab is opened
        loadPlayerMatchesByGAStats().catch(err => {
            console.error('Error loading M By G+A stats:', err);
        });
    } else if (tabName === 'player-championships') {
        document.getElementById('player-championships-tab').classList.add('active');
        playerTabButtons[3].classList.add('active');
    } else if (tabName === 'player-seasons') {
        document.getElementById('player-seasons-tab').classList.add('active');
        playerTabButtons[4].classList.add('active');
    } else if (tabName === 'player-vsteams') {
        document.getElementById('player-vsteams-tab').classList.add('active');
        playerTabButtons[5].classList.add('active');
    } else if (tabName === 'player-elnady') {
        document.getElementById('player-elnady-tab').classList.add('active');
        playerTabButtons[6].classList.add('active');
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

    if (!afconEgyptTeamsData.filteredRecords || afconEgyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    // Group stats by opponent team
    const h2hStats = new Map();

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    if (!afconEgyptTeamsData.filteredRecords || afconEgyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    // Group stats by Egypt manager
    const managersStats = new Map();

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    if (!afconEgyptTeamsData.filteredRecords || afconEgyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    // Group stats by opponent manager
    const managersStats = new Map();

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    if (!afconEgyptTeamsData.filteredRecords || afconEgyptTeamsData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    // Group stats by referee
    const refereesStats = new Map();

    // Create a set of filtered match IDs for quick lookup
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(m => m['MATCH_ID']));

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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
    if (afconEgyptTeamsData.playerDetails && afconEgyptTeamsData.playerDetails.length > 0) {
        afconEgyptTeamsData.playerDetails.forEach(detail => {
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
    document.getElementById('elnady-all-clubs-by-season-tab').classList.remove('active');
    document.getElementById('elnady-by-club-tab').classList.remove('active');

    if (tabName === 'all-clubs') {
        document.getElementById('elnady-all-clubs-tab').classList.add('active');
        loadAllClubsStats();
    } else if (tabName === 'all-clubs-by-season') {
        document.getElementById('elnady-all-clubs-by-season-tab').classList.add('active');
        loadAllClubsBySeason();
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
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }

    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Calculate goals and unique players per club (only from filtered matches)
    const clubGoals = {};
    const clubPlayers = {};

    afconEgyptTeamsData.playerDetails.forEach(detail => {
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

    searchInput.addEventListener('input', function () {
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
            <td style="text-align: center; font-weight: 600; font-size: 1.2rem;">${club.players}</td>
            <td style="text-align: center; font-weight: 600; font-size: 1.2rem;">${club.goals}</td>
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
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.3rem;">${totalPlayers}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.3rem;">${totalGoals}</td>
    `;
    tbody.appendChild(totalRow);
}

async function loadAllClubsBySeason() {
    // Load player details if not already loaded
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }

    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Create a map to get season from match ID
    const matchIdToSeason = new Map();
    afconEgyptTeamsData.filteredRecords.forEach(match => {
        const matchId = match['MATCH_ID'] || '';
        const season = match['SEASON'] || '';
        if (matchId && season) {
            matchIdToSeason.set(matchId, season);
        }
    });

    // Group by season and club: season -> club -> { goals, players }
    const seasonClubStats = new Map();

    afconEgyptTeamsData.playerDetails.forEach(detail => {
        const elnady = (detail['ELNADY'] || '').trim();
        const playerName = (detail['PLAYER NAME'] || '').trim();
        const gaValue = (detail['GA'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL']) || 0;

        if (!elnady || !filteredMatchIds.has(matchId)) return;

        // Get season for this match
        const season = matchIdToSeason.get(matchId) || 'Unknown';

        // Initialize season map if needed
        if (!seasonClubStats.has(season)) {
            seasonClubStats.set(season, new Map());
        }

        const clubMap = seasonClubStats.get(season);

        // Initialize club stats if needed
        if (!clubMap.has(elnady)) {
            clubMap.set(elnady, {
                goals: 0,
                players: new Set()
            });
        }

        const clubStats = clubMap.get(elnady);

        // Count goals
        if (gaValue === 'GOAL') {
            clubStats.goals += gatotal;
        }

        // Track unique players
        if (playerName) {
            clubStats.players.add(playerName);
        }
    });

    // Convert to array format: [{ season, club, players, goals }]
    const allData = [];
    seasonClubStats.forEach((clubMap, season) => {
        clubMap.forEach((stats, club) => {
            allData.push({
                season: season,
                club: club,
                players: stats.players.size,
                goals: stats.goals
            });
        });
    });

    // Sort: first by season (newest to oldest), then by goals (descending)
    allData.sort((a, b) => {
        // First sort by season (newest to oldest)
        // Try to extract year from season string for better sorting
        const getSeasonYear = (seasonStr) => {
            if (!seasonStr || seasonStr === 'Unknown') return 0;
            // Try to extract year (e.g., "2024-25" -> 2024, "2024" -> 2024)
            const yearMatch = seasonStr.match(/\d{4}/);
            return yearMatch ? parseInt(yearMatch[0]) : 0;
        };

        const yearA = getSeasonYear(a.season);
        const yearB = getSeasonYear(b.season);

        if (yearB !== yearA) {
            return yearB - yearA; // Newest first
        }

        // If same year or can't extract year, sort alphabetically (descending)
        if (a.season !== b.season) {
            return b.season.localeCompare(a.season);
        }

        // Second sort by goals (descending)
        return b.goals - a.goals;
    });

    // Store full data for search functionality
    if (!window.allClubsBySeasonFullData) {
        window.allClubsBySeasonFullData = [];
    }
    window.allClubsBySeasonFullData = allData;

    // Setup search if not already setup
    if (!window.allClubsBySeasonSearchSetup) {
        setupAllClubsBySeasonSearch();
        window.allClubsBySeasonSearchSetup = true;
    }

    // Display the data
    displayAllClubsBySeason(allData);
}

function setupAllClubsBySeasonSearch() {
    const searchInput = document.getElementById('all-clubs-by-season-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase().trim();

        if (!searchTerm) {
            // Show all data if search is empty
            displayAllClubsBySeason(window.allClubsBySeasonFullData || []);
            return;
        }

        // Filter data by search term (search in season and club name)
        const filtered = (window.allClubsBySeasonFullData || []).filter(item => {
            const season = String(item.season || '').toLowerCase();
            const club = String(item.club || '').toLowerCase();
            return season.includes(searchTerm) || club.includes(searchTerm);
        });

        displayAllClubsBySeason(filtered);
    });
}

function displayAllClubsBySeason(dataArray) {
    const tbody = document.getElementById('all-clubs-by-season-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (dataArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }

    dataArray.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${escapeHtml(item.season)}</td>
            <td><strong>${escapeHtml(item.club)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.2rem;">${item.players}</td>
            <td style="text-align: center; font-weight: 600; font-size: 1.2rem;">${item.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

let elnadySearchSetup = false;
let currentElnadyOptions = [];

async function setupElnadySearch() {
    // Load player details if not already loaded
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        await loadPlayerDetailsOnly();
    }

    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Extract unique ELNADY values (only from filtered matches)
    const elnadyValues = new Set();
    afconEgyptTeamsData.playerDetails.forEach(detail => {
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
        input.addEventListener('focus', function () {
            showElnadyDropdownOptions(input, currentElnadyOptions);
        });

        input.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const filtered = currentElnadyOptions.filter(opt => opt.toLowerCase().includes(searchTerm));
            showElnadyDropdownOptions(input, filtered);
        });

        // Handle clicking outside to close dropdown
        document.addEventListener('click', function (e) {
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
    allOption.addEventListener('click', function () {
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
        optionDiv.addEventListener('click', function () {
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
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Filter player details for this club AND filtered matches
    const clubDetails = afconEgyptTeamsData.playerDetails.filter(detail => {
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
            const match = afconEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
            const match = afconEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
            const match = afconEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
async function refreshAfconEgyptTeamsData() {
    const refreshBtn = event.target.closest('button');
    const refreshIcon = refreshBtn?.querySelector('svg');
    const originalText = refreshBtn.innerHTML;

    // Show loading state on button only
    refreshBtn.disabled = true;
    if (refreshIcon) {
        refreshIcon.classList.add('spinning');
    }
    refreshBtn.innerHTML = '<svg class="filter-btn-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Syncing...';

    try {
        await loadAfconEgyptTeamsData(true, true); // true = force refresh, true = skip loading state

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
            <button class="refresh-btn" onclick="loadAfconEgyptTeamsData(true)" style="margin-top: 1rem;">
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
        const gkDetails = afconEgyptTeamsData.gkDetails || [];

        // Get filtered match IDs
        const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

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
        const playerDetails = afconEgyptTeamsData.playerDetails || [];
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
        const howPenMissed = afconEgyptTeamsData.howPenMissed || [];
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
            const isEgyptTeam = team === 'egypt';
            const gkGoalMinutes = (record['GOAL MINUTE'] || '').toString().trim();

            if (!gkName) return;

            if (!gkStats[gkName]) {
                gkStats[gkName] = {
                    name: gkName,
                    matches: 0,
                    totalGoalsConceded: 0,
                    cleanSheets: 0,
                    penaltiesConceded: 0,
                    penaltiesSaved: penaltySavesByGK.get(gkName) || 0,
                    teamType: isEgyptTeam ? 'egypt' : 'opponent'
                };
            }

            if (isEgyptTeam) {
                gkStats[gkName].teamType = 'egypt';
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
        afconEgyptTeamsData.goalkeepersData = Object.values(gkStats);

        // Sort and display
        sortAndDisplayGoalkeepers();
        setupGoalkeepersTeamFilter();
        setupGoalkeepersSearch();

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
    if (afconEgyptTeamsData.currentGKSortColumn === column) {
        afconEgyptTeamsData.currentGKSortDirection = afconEgyptTeamsData.currentGKSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        afconEgyptTeamsData.currentGKSortColumn = column;
        afconEgyptTeamsData.currentGKSortDirection = column === 'name' ? 'asc' : 'desc';
    }

    sortAndDisplayGoalkeepers();
}

// Sort and display goalkeepers
function sortAndDisplayGoalkeepers() {
    const tbody = document.getElementById('goalkeepers-tbody');
    const gkArray = [...afconEgyptTeamsData.goalkeepersData];

    if (gkArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">No goalkeeper data available</td></tr>';
        return;
    }

    // Sort the array
    gkArray.sort((a, b) => {
        let aVal, bVal;

        switch (afconEgyptTeamsData.currentGKSortColumn) {
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

        if (afconEgyptTeamsData.currentGKSortDirection === 'asc') {
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

    const headerIndex = headerMap[afconEgyptTeamsData.currentGKSortColumn];
    if (headerIndex !== undefined) {
        const headers = document.querySelectorAll('#goalkeepers-table-container .sortable-header');
        if (headers[headerIndex]) {
            headers[headerIndex].classList.add(
                afconEgyptTeamsData.currentGKSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc'
            );
        }
    }

    const teamFilter = afconEgyptTeamsData.goalkeepersTeamFilter || 'all';
    let filteredArray = gkArray.filter(gk => {
        if (teamFilter === 'egypt') {
            return gk.teamType === 'egypt';
        }
        if (teamFilter === 'opponent') {
            return gk.teamType !== 'egypt';
        }
        return true;
    });

    const searchTerm = (afconEgyptTeamsData.goalkeepersSearchTerm || '').toLowerCase().trim();
    if (searchTerm) {
        filteredArray = filteredArray.filter(gk => {
            const rowText = [
                gk.name,
                gk.matches,
                gk.totalGoalsConceded,
                gk.cleanSheets,
                gk.penaltiesConceded,
                gk.penaltiesSaved
            ].join(' ').toLowerCase();
            return rowText.includes(searchTerm);
        });
    }

    if (filteredArray.length === 0) {
        let message = 'No goalkeeper data available';
        if (teamFilter !== 'all' && !searchTerm) {
            message = 'No goalkeepers for selected team';
        } else if (searchTerm) {
            message = 'No goalkeepers match your search';
        }
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">${message}</td></tr>`;
        return;
    }

    // Display goalkeepers
    tbody.innerHTML = '';
    filteredArray.forEach((gk, index) => {
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

function setupGoalkeepersTeamFilter() {
    const filterSelect = document.getElementById('goalkeepers-team-filter');
    if (!filterSelect) return;

    const newFilterSelect = filterSelect.cloneNode(true);
    filterSelect.parentNode.replaceChild(newFilterSelect, filterSelect);

    const currentValue = afconEgyptTeamsData.goalkeepersTeamFilter || 'all';
    newFilterSelect.value = currentValue;

    newFilterSelect.addEventListener('change', () => {
        afconEgyptTeamsData.goalkeepersTeamFilter = newFilterSelect.value;
        sortAndDisplayGoalkeepers();
    });
}

function setupGoalkeepersSearch() {
    const searchInput = document.getElementById('goalkeepers-search-input');
    if (!searchInput) return;

    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    const currentValue = afconEgyptTeamsData.goalkeepersSearchTerm || '';
    newSearchInput.value = currentValue;

    newSearchInput.addEventListener('input', () => {
        afconEgyptTeamsData.goalkeepersSearchTerm = newSearchInput.value;
        sortAndDisplayGoalkeepers();
    });
}

// ============================================================================
// SEARCH MATCH FUNCTIONS
// ============================================================================

// Normalize date to DD/MM/YYYY format for comparison
function normalizeAfconToDMY(value) {
    const pad2 = n => String(n).padStart(2, '0');
    if (value === null || value === undefined) return '';
    const raw = String(value).trim();
    if (!raw) return '';

    // Excel serial number
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 100) {
        const adjusted = num > 60 ? num - 1 : num;
        const excelEpoch = new Date(1899, 11, 30);
        const dt = new Date(excelEpoch.getTime() + adjusted * 86400 * 1000);
        if (!isNaN(dt.getTime())) {
            return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
        }
    }

    // D/M/Y or D-M-Y format
    const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) {
        const d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
        if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900) {
            return `${pad2(d)}/${pad2(mo)}/${y}`;
        }
    }

    // Try parsing as regular date string
    const dt = new Date(raw);
    if (!isNaN(dt.getTime())) {
        return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    }

    return '';
}

// Search for match by ID or Date
async function searchEgyptMatchById() {
    const searchInput = document.getElementById('egypt-match-search-input');
    const searchValue = searchInput.value.trim();

    if (!searchValue) {
        return false;
    }

    console.log('🔍 Searching for match ID or Date:', searchValue);
    console.log('🔍 Player details loaded before search:', afconEgyptTeamsData.playerDetailsLoaded);

    // Make sure player data is loaded
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
        console.log('🔄 Loading player data...');
        try {
            await loadPlayersData();
            console.log('✅ Player data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading player data:', error);
            showError('No Data Available');
            return false;
        }
    }

    const matches = afconEgyptTeamsData.allRecords;
    let match = matches.find(m => {
        const mid = m.MATCH_ID || m['MATCH ID'] || '';
        return mid.toString().toLowerCase() === searchValue.toLowerCase();
    });

    // If not found by ID, try by Date (accepts DD/MM/YYYY or Excel serials)
    if (!match) {
        const looksLikeDate = /[\/\-]/.test(searchValue) || /^\d{6,}$/.test(searchValue);
        if (looksLikeDate) {
            const targetDMY = normalizeAfconToDMY(searchValue);
            if (targetDMY) {
                match = matches.find(m => normalizeAfconToDMY(m.DATE) === targetDMY);
            }
        }
    }

    console.log('🔍 Match found:', !!match);
    if (match) {
        console.log('🔍 Match details:', match);
    }

    const detailsContainer = document.getElementById('egypt-match-details-container');
    const noMatchFound = document.getElementById('egypt-no-match-found');

    if (match) {
        const matchId = String(match.MATCH_ID || match['MATCH ID'] || '');

        // Display match details
        displayEgyptMatchDetails(match);
        displayEgyptMatchLineup(matchId);
        displayEgyptMatchGoals(matchId);
        displayEgyptMatchGoalkeepers(matchId);

        detailsContainer.style.display = 'block';
        noMatchFound.style.display = 'none';

        // Cache last match ID for future use
        try { window.__lastAfconMatchId = matchId; } catch (e) { }
        return true;
    } else {
        detailsContainer.style.display = 'none';
        noMatchFound.style.display = 'block';
        return false;
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
    const lineupDetails = afconEgyptTeamsData.lineupDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];

    console.log('🔍 Match ID:', matchId);
    console.log('🔍 Total lineup details available:', lineupDetails.length);
    console.log('🔍 Total player details available:', playerDetails.length);
    console.log('🔍 Player details loaded:', afconEgyptTeamsData.playerDetailsLoaded);
    console.log('🔍 Players loaded:', afconEgyptTeamsData.playersLoaded);

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
    if (!afconEgyptTeamsData.playerDetailsLoaded) {
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
    const playerDetails = afconEgyptTeamsData.playerDetails || [];

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

    // Separate Egypt and opponent records (both goals and assists)
    const egyptRecords = matchGoals.filter(g => {
        const team = (g.TEAM || '').toLowerCase();
        const isEgypt = team.includes('egypt') || team.includes('مصر');
        return isEgypt;
    });

    const opponentRecords = matchGoals.filter(g => {
        const team = (g.TEAM || '').toLowerCase();
        const isEgypt = team.includes('egypt') || team.includes('مصر');
        return !isEgypt;
    });

    // Sort by minute to maintain order from sheet
    const sortByMinute = (a, b) => {
        const minA = parseInt(a.MINUTE || a.MIN || 0);
        const minB = parseInt(b.MINUTE || b.MIN || 0);
        if (minA !== minB) return minA - minB;
        // If same minute, goals come before assists
        const gaA = (a.GA || '').toUpperCase();
        const gaB = (b.GA || '').toUpperCase();
        if (gaA === 'GOAL' && gaB === 'ASSIST') return -1;
        if (gaA === 'ASSIST' && gaB === 'GOAL') return 1;
        return 0;
    };

    egyptRecords.sort(sortByMinute);
    opponentRecords.sort(sortByMinute);

    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';

    // Egypt Goals and Assists
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

    egyptRecords.forEach(record => {
        const ga = (record.GA || '').toUpperCase();
        const player = record['PLAYER NAME'] || 'Unknown';
        const gatotal = record.GATOTAL || 1;
        const type = ga === 'ASSIST' ? 'Assist' : (record.TYPE || 'Regular');
        const elnady = record.ELNADY || '-';

        html += `
            <tr>
                <td>
                    <strong>${player}</strong> <span style="color: ${ga === 'GOAL' ? '#dc2626' : '#3b82f6'}; font-weight: 600;">(${gatotal})</span>
                </td>
                <td>${elnady}</td>
                <td>${type}</td>
            </tr>
        `;
    });

    if (egyptRecords.length === 0) {
        html += '<tr><td colspan="3" style="text-align: center; color: #999;">No goals</td></tr>';
    }

    html += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Opponent Goals and Assists
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

    opponentRecords.forEach(record => {
        const ga = (record.GA || '').toUpperCase();
        const player = record['PLAYER NAME'] || 'Unknown';
        const gatotal = record.GATOTAL || 1;
        const type = ga === 'ASSIST' ? 'Assist' : (record.TYPE || 'Regular');
        const elnady = record.ELNADY || '-';

        html += `
            <tr>
                <td>
                    <strong>${player}</strong> <span style="color: ${ga === 'GOAL' ? '#3b82f6' : '#dc2626'}; font-weight: 600;">(${gatotal})</span>
                </td>
                <td>${elnady}</td>
                <td>${type}</td>
            </tr>
        `;
    });

    if (opponentRecords.length === 0) {
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
    const gkDetails = afconEgyptTeamsData.gkDetails || [];

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
    const parentContainer = event.target ? event.target.closest('#egypt-match-details-container') : null;
    const tabButtons = parentContainer ? parentContainer.querySelectorAll('.tab-button') : document.querySelectorAll('#egypt-match-details-container .tab-button');
    tabButtons.forEach(tab => tab.classList.remove('active'));

    // Remove active class from all match sub-tab contents
    document.querySelectorAll('#egypt-match-lineup-content, #egypt-match-goals-content, #egypt-match-goalkeepers-content').forEach(content => {
        content.classList.remove('active');
    });

    // Add active class to selected tab button and content
    if (event && event.target) {
        event.target.classList.add('active');
    }

    if (tabName === 'lineup') {
        document.getElementById('egypt-match-lineup-content').classList.add('active');
    } else if (tabName === 'goals') {
        document.getElementById('egypt-match-goals-content').classList.add('active');
    } else if (tabName === 'goalkeepers') {
        document.getElementById('egypt-match-goalkeepers-content').classList.add('active');
    }

    // Reload data if needed - use cached match ID if available
    const matchId = window.__lastAfconMatchId || (document.getElementById('egypt-match-search-input') ? document.getElementById('egypt-match-search-input').value.trim() : '');
    if (matchId) {
        const matches = afconEgyptTeamsData.allRecords || [];
        const match = matches.find(m => {
            const mid = m.MATCH_ID || m['MATCH ID'] || '';
            return String(mid).toLowerCase() === String(matchId).toLowerCase();
        });
        if (match) {
            const actualMatchId = String(match.MATCH_ID || match['MATCH ID'] || '');
            // Reload the specific tab data
            if (tabName === 'lineup') {
                displayEgyptMatchLineup(actualMatchId);
            } else if (tabName === 'goals') {
                displayEgyptMatchGoals(actualMatchId);
            } else if (tabName === 'goalkeepers') {
                displayEgyptMatchGoalkeepers(actualMatchId);
            }
        }
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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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
    document.addEventListener('click', function (e) {
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
    const gkDetails = afconEgyptTeamsData.gkDetails || [];
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
    const filteredMatchIds = new Set(afconEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));

    // Get goalkeeper matches from gkDetails
    const gkDetails = afconEgyptTeamsData.gkDetails || [];
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
    loadGoalkeeperOverview(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperMatches(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperChampionships(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperSeasons(goalkeeperName, goalkeeperMatches);
    loadGoalkeeperVsTeams(goalkeeperName, goalkeeperMatches);
}

function loadGoalkeeperOverview(goalkeeperName, goalkeeperMatchIds) {
    const container = document.getElementById('goalkeeper-overview-container');
    if (!container) return;

    container.innerHTML = '';

    if (goalkeeperMatchIds.size === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #999;">No matches found</div>';
        return;
    }

    const gkDetails = afconEgyptTeamsData.gkDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];
    const howPenMissed = afconEgyptTeamsData.howPenMissed || [];

    // Get match details for goalkeeper matches
    const goalkeeperMatchesList = afconEgyptTeamsData.filteredRecords.filter(match =>
        goalkeeperMatchIds.has(match['MATCH_ID'])
    );

    // Get all GKs by match for penalty and clean sheet calculation
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID || record['MATCH ID'] || '';
        const team = (record['TEAM'] || '').trim().toLowerCase();
        if (team === 'egypt' && goalkeeperMatchIds.has(matchId)) {
            const key = `${matchId}_${team}`;
            if (!allGKsByMatch.has(key)) {
                allGKsByMatch.set(key, []);
            }
            allGKsByMatch.get(key).push(record);
        }
    });

    // Calculate statistics
    let totalMatches = goalkeeperMatchIds.size;
    let totalGoalsConceded = 0;
    let cleanSheets = 0;
    let totalPenaltiesConceded = 0;
    let totalPenaltiesSaved = 0;

    goalkeeperMatchesList.forEach(match => {
        const matchId = match['MATCH_ID'];

        // Get goalkeeper details for goals conceded
        const gkRecord = gkDetails.find(gk =>
            (gk['PLAYER NAME'] || '').trim() === goalkeeperName &&
            (gk['MATCH_ID'] || gk['MATCH ID'] || '').trim() === matchId &&
            (gk['TEAM'] || '').trim().toLowerCase() === 'egypt'
        );

        const goalsConceded = gkRecord ? (parseInt(gkRecord['GOALS CONCEDED'] || 0)) : 0;
        totalGoalsConceded += goalsConceded;

        // Check for clean sheet (only if goalkeeper was THE ONLY ONE from his team in this match)
        const team = 'egypt';
        const key = `${matchId}_${team}`;
        const allGKsInMatch = allGKsByMatch.get(key) || [];
        const onlyOneGK = allGKsInMatch.length === 1;

        if (goalsConceded === 0 && onlyOneGK) {
            cleanSheets += 1;
        }

        const penalties = calculateGoalkeeperPenaltiesForMatch(
            goalkeeperName,
            matchId,
            allGKsByMatch,
            playerDetails,
            howPenMissed
        );

        totalPenaltiesConceded += penalties.penaltiesConceded;
        totalPenaltiesSaved += penalties.penaltiesSaved;
    });

    // Create cards
    const cards = [
        {
            title: 'Matches',
            value: totalMatches,
            icon: '⚽',
            color: '#3b82f6'
        },
        {
            title: 'Goals Conceded',
            value: totalGoalsConceded,
            icon: '🥅',
            color: '#ef4444'
        },
        {
            title: 'Clean Sheets',
            value: cleanSheets,
            icon: '🛡️',
            color: '#10b981'
        },
        {
            title: 'Penalties Conceded',
            value: totalPenaltiesConceded,
            icon: '🚫',
            color: '#f97316'
        },
        {
            title: 'Penalties Saved',
            value: totalPenaltiesSaved,
            icon: '🧤',
            color: '#6366f1'
        }
    ];

    cards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.style.cssText = `
            background: linear-gradient(135deg, ${card.color}15 0%, ${card.color}05 100%);
            border: 2px solid ${card.color}30;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
        `;
        cardElement.onmouseenter = function () {
            this.style.transform = 'translateY(-4px)';
            this.style.boxShadow = `0 8px 16px ${card.color}20`;
        };
        cardElement.onmouseleave = function () {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = 'none';
        };

        cardElement.innerHTML = `
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${card.icon}</div>
            <div style="font-size: 2rem; font-weight: bold; color: ${card.color}; margin-bottom: 0.5rem;">${card.value}</div>
            <div style="font-size: 0.9rem; color: #666; font-weight: 600;">${card.title}</div>
        `;

        container.appendChild(cardElement);
    });
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
    const goalkeeperMatchesList = afconEgyptTeamsData.filteredRecords.filter(match =>
        goalkeeperMatchIds.has(match['MATCH_ID'])
    ).reverse(); // Latest first

    const gkDetails = afconEgyptTeamsData.gkDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];
    const howPenMissed = afconEgyptTeamsData.howPenMissed || [];

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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No championships found</td></tr>';
        return;
    }

    // Group stats by championship
    const championshipStats = new Map();
    const gkDetails = afconEgyptTeamsData.gkDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];
    const howPenMissed = afconEgyptTeamsData.howPenMissed || [];

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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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
                cleanSheets: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }

        const stats = championshipStats.get(championship);
        stats.matches++;
        if (gkRecord) {
            const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
            stats.goalsConceded += goalsConceded;

            const key = `${matchId}_egypt`;
            const allGKsInMatch = allGKsByMatch.get(key) || [];
            const onlyOneGK = allGKsInMatch.length === 1;
            if (goalsConceded === 0 && onlyOneGK) {
                stats.cleanSheets += 1;
            }

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
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.cleanSheets === 0 ? '-' : stats.cleanSheets}</td>
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No seasons found</td></tr>';
        return;
    }

    // Group stats by season
    const seasonStats = new Map();
    const gkDetails = afconEgyptTeamsData.gkDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];
    const howPenMissed = afconEgyptTeamsData.howPenMissed || [];

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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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
                cleanSheets: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }

        const stats = seasonStats.get(season);
        stats.matches++;
        if (gkRecord) {
            const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
            stats.goalsConceded += goalsConceded;

            const key = `${matchId}_egypt`;
            const allGKsInMatch = allGKsByMatch.get(key) || [];
            const onlyOneGK = allGKsInMatch.length === 1;
            if (goalsConceded === 0 && onlyOneGK) {
                stats.cleanSheets += 1;
            }

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
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.cleanSheets === 0 ? '-' : stats.cleanSheets}</td>
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No teams found</td></tr>';
        return;
    }

    // Group stats by opponent team
    const teamStats = new Map();
    const gkDetails = afconEgyptTeamsData.gkDetails || [];
    const playerDetails = afconEgyptTeamsData.playerDetails || [];
    const howPenMissed = afconEgyptTeamsData.howPenMissed || [];

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

    afconEgyptTeamsData.filteredRecords.forEach(match => {
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
                cleanSheets: 0,
                penaltiesConceded: 0,
                penaltiesSaved: 0
            });
        }

        const stats = teamStats.get(opponentTeam);
        stats.matches++;
        if (gkRecord) {
            const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
            stats.goalsConceded += goalsConceded;

            const key = `${matchId}_egypt`;
            const allGKsInMatch = allGKsByMatch.get(key) || [];
            const onlyOneGK = allGKsInMatch.length === 1;
            if (goalsConceded === 0 && onlyOneGK) {
                stats.cleanSheets += 1;
            }

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
            <td style="text-align: center; font-size: 1.4rem; font-weight: bold;">${stats.cleanSheets === 0 ? '-' : stats.cleanSheets}</td>
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
    document.querySelectorAll('#goalkeeper-overview-tab, #goalkeeper-matches-tab, #goalkeeper-championships-tab, #goalkeeper-seasons-tab, #goalkeeper-vsteams-tab').forEach(content => {
        content.classList.remove('active');
    });

    // Show selected tab
    if (tabName === 'goalkeeper-overview') {
        document.getElementById('goalkeeper-overview-tab').classList.add('active');
        goalkeeperTabButtons[0].classList.add('active');
    } else if (tabName === 'goalkeeper-matches') {
        document.getElementById('goalkeeper-matches-tab').classList.add('active');
        goalkeeperTabButtons[1].classList.add('active');
    } else if (tabName === 'goalkeeper-championships') {
        document.getElementById('goalkeeper-championships-tab').classList.add('active');
        goalkeeperTabButtons[2].classList.add('active');
    } else if (tabName === 'goalkeeper-seasons') {
        document.getElementById('goalkeeper-seasons-tab').classList.add('active');
        goalkeeperTabButtons[3].classList.add('active');
    } else if (tabName === 'goalkeeper-vsteams') {
        document.getElementById('goalkeeper-vsteams-tab').classList.add('active');
        goalkeeperTabButtons[4].classList.add('active');
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', function () {
    console.log('Afcon Egypt Teams page loaded');
    loadAfconEgyptTeamsData();
    // Setup search after a short delay to ensure DOM is ready
    setTimeout(() => {
        setupDynamicTableSearch();
        setupAllPlayersSearch();
    }, 500);
});

