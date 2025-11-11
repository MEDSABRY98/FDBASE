// ============================================================================
// WW EGYPT TEAMS MODULE - JAVASCRIPT
// ============================================================================

// Global data storage
let wwEgyptTeamsData = {
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
    playerDetails: [],
    players: [],
    allPlayers: [],
    playersLoaded: false,
    currentSortColumn: 'totalGA',
    currentSortDirection: 'desc',
    currentPlayersTeamFilter: 'all'
};

function isEgyptTeamName(teamName) {
    if (!teamName) return false;
    const normalized = teamName.toLowerCase();
    return normalized.includes('egypt') || normalized.includes('مصر') || normalized.includes('egy');
}

// Virtual Scrolling state
let virtualScrollState = {
    allData: [],
    currentViewData: [],
    startIndex: 0,
    endIndex: 25,
    bufferSize: 25,
    rowHeight: 50,
    tableContainer: null,
    scrollHandler: null
};

// ============================================================================
// MAIN DATA LOADING FUNCTION
// ============================================================================

async function loadWWEgyptTeamsData(forceRefresh = false) {
    try {
        // If force refresh, show button loading state
        if (forceRefresh) {
            setRefreshButtonLoading(true);
        } else {
            showLoading();
        }
        
        const url = forceRefresh ? '/api/ww-egypt-teams/matches?refresh=true' : '/api/ww-egypt-teams/matches';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Store data
        wwEgyptTeamsData.allRecords = data.matches || [];
        wwEgyptTeamsData.filteredRecords = [...wwEgyptTeamsData.allRecords];
        
        // Populate filter options
        populateFilterOptions();
        
        // Calculate statistics
        calculateStatistics();
        
        // Update UI
        updateOverviewStats();
        displayMatches();
        setupDynamicTableSearch();
        
        // If players are loaded, recalculate player statistics
        if (wwEgyptTeamsData.playersLoaded) {
            calculatePlayerStatistics();
            displayPlayers();
        }
        
        if (forceRefresh) {
            setRefreshButtonLoading(false);
            showSuccess('✅ Data synced successfully!');
        } else {
            hideLoading();
        }
        
        console.log('✅ WW Egypt Teams data loaded successfully');
        
    } catch (error) {
        console.error('Error loading WW Egypt Teams data:', error);
        
        if (forceRefresh) {
            setRefreshButtonLoading(false);
            showError('Failed to sync data. Please try again.');
        } else {
            hideLoading();
            showError('No Data Available');
        }
    }
}

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

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
    const records = wwEgyptTeamsData.filteredRecords;
    
    wwEgyptTeamsData.totalMatches = records.length;
    wwEgyptTeamsData.wins = records.filter(r => r['W-D-L'] === 'W').length;
    wwEgyptTeamsData.draws = records.filter(r => ['D', 'D WITH G', 'D.'].includes(r['W-D-L'])).length;
    wwEgyptTeamsData.losses = records.filter(r => r['W-D-L'] === 'L').length;
    wwEgyptTeamsData.totalGoalsFor = records.reduce((sum, r) => sum + (parseInt(r['GF'] || 0)), 0);
    wwEgyptTeamsData.totalGoalsAgainst = records.reduce((sum, r) => sum + (parseInt(r['GA'] || 0)), 0);
    
    wwEgyptTeamsData.cleanSheetFor = records.filter(r => parseInt(r['GA'] || 0) === 0).length;
    wwEgyptTeamsData.cleanSheetAgainst = records.filter(r => parseInt(r['GF'] || 0) === 0).length;
    
    wwEgyptTeamsData.longestWinStreak = calculateLongestStreak(records, ['W']);
    wwEgyptTeamsData.longestDrawStreak = calculateLongestStreak(records, ['D', 'D WITH G', 'D.']);
    wwEgyptTeamsData.longestLossStreak = calculateLongestStreak(records, ['L']);
}

// ============================================================================
// UI UPDATE FUNCTIONS
// ============================================================================

function updateOverviewStats() {
    document.getElementById('total-matches').textContent = wwEgyptTeamsData.totalMatches;
    document.getElementById('total-wins').textContent = wwEgyptTeamsData.wins;
    document.getElementById('total-draws').textContent = wwEgyptTeamsData.draws;
    document.getElementById('total-losses').textContent = wwEgyptTeamsData.losses;
    document.getElementById('total-goals-for').textContent = wwEgyptTeamsData.totalGoalsFor;
    document.getElementById('total-goals-against').textContent = wwEgyptTeamsData.totalGoalsAgainst;
    document.getElementById('clean-sheet-for').textContent = wwEgyptTeamsData.cleanSheetFor;
    document.getElementById('clean-sheet-against').textContent = wwEgyptTeamsData.cleanSheetAgainst;
    document.getElementById('longest-win-streak').textContent = wwEgyptTeamsData.longestWinStreak;
    document.getElementById('longest-draw-streak').textContent = wwEgyptTeamsData.longestDrawStreak;
    document.getElementById('longest-loss-streak').textContent = wwEgyptTeamsData.longestLossStreak;
}

function renderMatchRow(match) {
    const date = match['DATE'] || '';
    const managerEgy = match['MANAGER EGY'] || '';
    const season = match['SEASON'] || '';
    const round = match['ROUND'] || '';
    const han = match['H-A-N'] || '';
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
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(managerEgy)}</td>
            <td>${escapeHtml(season)}</td>
            <td>${escapeHtml(round)}</td>
            <td>${escapeHtml(han)}</td>
            <td>${escapeHtml(egyptTeam)}</td>
            <td><strong>${gf}</strong></td>
            <td><strong>${ga}</strong></td>
            <td>${escapeHtml(opponent)}</td>
            <td>${resultBadge}</td>
        </tr>
    `;
}

function renderVisibleMatchRows() {
    const tbody = document.getElementById('matches-tbody');
    if (!tbody) return;
    
    const { allData, startIndex, endIndex } = virtualScrollState;
    const visibleData = allData.slice(startIndex, endIndex);
    
    const topSpacer = `<tr style="height: ${startIndex * virtualScrollState.rowHeight}px;"><td colspan="10"></td></tr>`;
    const rowsHtml = visibleData.map(renderMatchRow).join('');
    const bottomSpacer = `<tr style="height: ${Math.max(0, allData.length - endIndex) * virtualScrollState.rowHeight}px;"><td colspan="10"></td></tr>`;
    
    tbody.innerHTML = topSpacer + rowsHtml + bottomSpacer;
}

function displayMatches() {
    const tbody = document.getElementById('matches-tbody');
    if (!tbody) return;
    
    const matches = wwEgyptTeamsData.filteredRecords.slice().reverse();
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    if (matches.length <= 1000) {
        const rowsHtml = matches.map(renderMatchRow).join('');
        tbody.innerHTML = rowsHtml;
        if (virtualScrollState.scrollHandler) {
            const container = document.querySelector('.matches-table-container');
            if (container) {
                container.removeEventListener('scroll', virtualScrollState.scrollHandler);
                virtualScrollState.scrollHandler = null;
            }
        }
        return;
    }
    
    virtualScrollState.allData = matches;
    virtualScrollState.currentViewData = matches;
    virtualScrollState.startIndex = 0;
    virtualScrollState.endIndex = Math.min(25, matches.length);
    
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.scrollTop = 0;
    }
    
    renderVisibleMatchRows();
    setupVirtualScrolling();
}

function setupVirtualScrolling() {
    if (virtualScrollState.scrollHandler) {
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.removeEventListener('scroll', virtualScrollState.scrollHandler);
        }
    }
    
    virtualScrollState.scrollHandler = function handleScroll(e) {
        const container = e.target;
        if (!container) return;
        
        const scrollTop = container.scrollTop || 0;
        const containerHeight = container.clientHeight || 0;
        const { allData, rowHeight, bufferSize } = virtualScrollState;
        
        const visibleStart = Math.floor(scrollTop / rowHeight);
        const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);
        
        const bufferStart = Math.max(0, visibleStart - bufferSize);
        const bufferEnd = Math.min(allData.length, visibleEnd + bufferSize);
        
        if (Math.abs(bufferStart - virtualScrollState.startIndex) > 5 || 
            Math.abs(bufferEnd - virtualScrollState.endIndex) > 5) {
            virtualScrollState.startIndex = bufferStart;
            virtualScrollState.endIndex = bufferEnd;
            renderVisibleMatchRows();
        }
    };
    
    const container = document.querySelector('.matches-table-container');
    if (container) {
        container.addEventListener('scroll', virtualScrollState.scrollHandler);
    }
}

function setupDynamicTableSearch() {
    const searchInput = document.getElementById('matches-search-input');
    if (!searchInput) return;

    const newSearchInput = searchInput.cloneNode(true);
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);

    newSearchInput.addEventListener('keyup', () => {
        const searchTerm = newSearchInput.value.toLowerCase().trim();
        const currentMatches = wwEgyptTeamsData.filteredRecords.slice().reverse();
        
        if (currentMatches.length <= 1000) {
            if (!searchTerm) {
                displayMatches();
                return;
            } else {
                const tbody = document.getElementById('matches-tbody');
                if (!tbody) return;
                
                const filtered = currentMatches.filter((match) => {
                    const cols = ['DATE', 'MANAGER EGY', 'SEASON', 'ROUND', 'H-A-N', 'Egypt TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-D-L'];
                    const rowText = cols.map(c => String(match[c] || '')).join(' ').toLowerCase();
                    return rowText.includes(searchTerm);
                });
                
                if (filtered.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No matches found</td></tr>';
                } else {
                    const rowsHtml = filtered.map(renderMatchRow).join('');
                    tbody.innerHTML = rowsHtml;
                }
                return;
            }
        }
        
        if (!searchTerm) {
            virtualScrollState.allData = currentMatches;
            virtualScrollState.currentViewData = currentMatches;
        } else {
            const filtered = currentMatches.filter((match) => {
                const cols = ['DATE', 'MANAGER EGY', 'SEASON', 'ROUND', 'H-A-N', 'Egypt TEAM', 'GF', 'GA', 'OPPONENT TEAM', 'W-D-L'];
                const rowText = cols.map(c => String(match[c] || '')).join(' ').toLowerCase();
                return rowText.includes(searchTerm);
            });
            virtualScrollState.allData = filtered;
            virtualScrollState.currentViewData = currentMatches;
        }
        
        const container = document.querySelector('.matches-table-container');
        if (container) {
            container.scrollTop = 0;
        }
        
        virtualScrollState.startIndex = 0;
        virtualScrollState.endIndex = Math.min(25, virtualScrollState.allData.length);
        renderVisibleMatchRows();
    });
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function setupSearchableSelect(inputId, fieldName) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const container = input.closest('.searchable-select-container');
    if (!container) return;

    const dropdown = container.querySelector('.dropdown-options');
    if (!dropdown) return;

    const uniqueValues = [...new Set(wwEgyptTeamsData.allRecords
        .map(r => r[fieldName])
        .filter(val => val && val.trim() !== ''))]
        .sort();

    input.dataset.options = JSON.stringify(uniqueValues);
    input.dataset.allOptions = JSON.stringify(uniqueValues);

    input.addEventListener('focus', function() {
        showDropdownOptions(this, uniqueValues);
    });

    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const filteredOptions = uniqueValues.filter(opt => 
            opt.toLowerCase().includes(searchTerm)
        );
        showDropdownOptions(this, filteredOptions);
    });

    document.addEventListener('click', function(e) {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function showDropdownOptions(input, options) {
    const container = input.closest('.searchable-select-container');
    const dropdown = container.querySelector('.dropdown-options');
    
    dropdown.innerHTML = '';
    
    const allOption = document.createElement('div');
    allOption.className = 'dropdown-option';
    allOption.textContent = 'All';
    allOption.addEventListener('click', function() {
        input.value = '';
        dropdown.style.display = 'none';
    });
    dropdown.appendChild(allOption);

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
    const filterFields = {
        'filter-champion-system': 'CHAMPION SYSTEM',
        'filter-system-kind': 'SYSTEM KIND',
        'filter-age': 'AGE',
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
        'filter-pen': 'PEN',
        'filter-wlqf': 'W-L Q & F'
    };
    
    Object.entries(filterFields).forEach(([filterId, fieldName]) => {
        setupSearchableSelect(filterId, fieldName);
    });
    
    document.getElementById('filters-section').style.display = 'block';
}

function applyFilters() {
    const filters = {
        matchId: document.getElementById('filter-match-id').value.trim(),
        championSystem: document.getElementById('filter-champion-system').value,
        systemKind: document.getElementById('filter-system-kind').value,
        age: document.getElementById('filter-age').value,
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
        pen: document.getElementById('filter-pen').value,
        wlqf: document.getElementById('filter-wlqf').value,
        gf: document.getElementById('filter-gf').value,
        ga: document.getElementById('filter-ga').value
    };
    
    wwEgyptTeamsData.filteredRecords = wwEgyptTeamsData.allRecords.filter(record => {
        if (filters.matchId && !record['MATCH_ID']?.includes(filters.matchId)) return false;
        if (filters.championSystem && record['CHAMPION SYSTEM'] !== filters.championSystem) return false;
        if (filters.systemKind && record['SYSTEM KIND'] !== filters.systemKind) return false;
        if (filters.age && record['AGE'] !== filters.age) return false;
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
        if (filters.pen && record['PEN'] !== filters.pen) return false;
        if (filters.wlqf && record['W-L Q & F'] !== filters.wlqf) return false;
        
        if (filters.dateFrom && record['DATE'] && new Date(record['DATE']) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo && record['DATE'] && new Date(record['DATE']) > new Date(filters.dateTo)) return false;
        
        if (filters.gf && parseInt(record['GF'] || 0) !== parseInt(filters.gf)) return false;
        if (filters.ga && parseInt(record['GA'] || 0) !== parseInt(filters.ga)) return false;
        
        return true;
    });
    
    calculateStatistics();
    updateOverviewStats();
    displayMatches();
    
    // Recalculate player statistics if players are loaded
    if (wwEgyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
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
    
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) searchInput.value = '';
    
    console.log(`Filtered ${wwEgyptTeamsData.filteredRecords.length} of ${wwEgyptTeamsData.allRecords.length} matches`);
}

function clearFilters() {
    document.getElementById('filter-match-id').value = '';
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-gf').value = '';
    document.getElementById('filter-ga').value = '';
    
    const searchableInputs = document.querySelectorAll('.searchable-select-container input');
    searchableInputs.forEach(input => {
        input.value = '';
    });
    
    const dropdowns = document.querySelectorAll('.dropdown-options');
    dropdowns.forEach(dropdown => {
        dropdown.style.display = 'none';
    });
    
    wwEgyptTeamsData.filteredRecords = [...wwEgyptTeamsData.allRecords];
    populateFilterOptions();
    calculateStatistics();
    updateOverviewStats();
    displayMatches();
    
    // Recalculate player statistics if players are loaded
    if (wwEgyptTeamsData.playersLoaded) {
        calculatePlayerStatistics();
        displayPlayers();
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
    
    const searchInput = document.getElementById('matches-search-input');
    if (searchInput) searchInput.value = '';
    
    console.log('Filters cleared');
}

// ============================================================================
// UI HELPER FUNCTIONS
// ============================================================================

function showLoading() {
    const loading = document.getElementById('loading-container');
    if (loading) loading.style.display = 'flex';
}

function hideLoading() {
    const loading = document.getElementById('loading-container');
    if (loading) loading.style.display = 'none';
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    errorDiv.innerHTML = `<p style="color: #dc143c; font-size: 1.2rem; margin: 0;">${message}</p>`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #28a745; color: white; padding: 1rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 12px rgba(40, 167, 69, 0.4); z-index: 10000; text-align: center; animation: slideIn 0.3s ease;';
    successDiv.innerHTML = `<p style="margin: 0; font-size: 1rem; font-weight: 500;">${message}</p>`;
    document.body.appendChild(successDiv);
    setTimeout(() => {
        successDiv.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => successDiv.remove(), 300);
    }, 2000);
}

// Add CSS animations for success message
if (!document.getElementById('ww-egypt-teams-animations')) {
    const style = document.createElement('style');
    style.id = 'ww-egypt-teams-animations';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function setRefreshButtonLoading(isLoading) {
    const refreshBtn = document.querySelector('.finals-refresh-btn');
    if (!refreshBtn) return;
    
    if (isLoading) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = '0.7';
        refreshBtn.style.cursor = 'not-allowed';
        
        // Change icon to spinner
        const icon = refreshBtn.querySelector('svg');
        if (icon) {
            icon.style.animation = 'spin 1s linear infinite';
        }
        
        // Change text
        const textSpan = refreshBtn.childNodes[refreshBtn.childNodes.length - 1];
        if (textSpan && textSpan.nodeType === Node.TEXT_NODE) {
            refreshBtn.setAttribute('data-original-text', textSpan.textContent.trim());
            textSpan.textContent = ' Syncing...';
        } else {
            // If text is not a direct child, find it differently
            const btnText = refreshBtn.textContent.trim();
            refreshBtn.setAttribute('data-original-text', btnText);
            refreshBtn.innerHTML = `
                <svg class="filter-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Syncing...
            `;
        }
    } else {
        refreshBtn.disabled = false;
        refreshBtn.style.opacity = '1';
        refreshBtn.style.cursor = 'pointer';
        
        // Get original text
        const originalText = refreshBtn.getAttribute('data-original-text') || 'Sync Data';
        
        // Show success message first
        refreshBtn.innerHTML = `
            <svg class="filter-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            Synced!
        `;
        
        // Return to original text after 2 seconds
        setTimeout(() => {
            if (refreshBtn) {
                const icon = refreshBtn.querySelector('svg');
                if (icon) {
                    icon.style.animation = '';
                }
                refreshBtn.innerHTML = `
                    <svg class="filter-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    ${originalText}
                `;
            }
        }, 2000);
    }
}

// ============================================================================
// PLAYERS DATA FUNCTIONS
// ============================================================================

async function loadWWEgyptTeamsPlayers(forceRefresh = false) {
    try {
        showPlayersLoading();
        
        const url = forceRefresh ? '/api/ww-egypt-teams/players?refresh=true' : '/api/ww-egypt-teams/players';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Store data
        wwEgyptTeamsData.playerDetails = data.playerDetails || [];
        wwEgyptTeamsData.playersLoaded = true;
        
        // Calculate player statistics from filtered matches
        calculatePlayerStatistics();
        displayPlayers();
        hidePlayersLoading();
        
        console.log('✅ WW Egypt Teams players data loaded successfully');
        
    } catch (error) {
        console.error('Error loading WW Egypt Teams players data:', error);
        hidePlayersLoading();
        showPlayersError('No Players Data Available');
    }
}

function calculatePlayerStatistics() {
    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(wwEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Calculate goals and assists for each player
    const playersMatches = {};
    const playersGoals = {};
    const playersAssists = {};
    const playersClubGoals = {}; // Track goals per club for each player
    
    wwEgyptTeamsData.playerDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        const matchId = (detail['MATCH_ID'] || '').trim();
        const gaValue = (detail['GA'] || '').trim();
        const gatotal = parseInt(detail['GATOTAL'] || 0) || 0;
        const elnady = (detail['ELNADY'] || '').trim();
        
        if (!playerName || !matchId) return;
        
        // Only count if match is in filtered matches
        if (!filteredMatchIds.has(matchId)) return;
        
        // Track unique matches for each player
        if (!playersMatches[playerName]) {
            playersMatches[playerName] = new Set();
        }
        playersMatches[playerName].add(matchId);
        
        // Count goals
        if (gaValue === 'GOAL') {
            playersGoals[playerName] = (playersGoals[playerName] || 0) + gatotal;
            
            // Track goals per club
            if (elnady) {
                if (!playersClubGoals[playerName]) {
                    playersClubGoals[playerName] = {};
                }
                playersClubGoals[playerName][elnady] = (playersClubGoals[playerName][elnady] || 0) + gatotal;
            }
        }
        // Count assists
        else if (gaValue === 'ASSIST') {
            playersAssists[playerName] = (playersAssists[playerName] || 0) + gatotal;
        }
    });
    
    // Build players list
    const playersMap = new Map();
    
    // Get all unique players from playerDetails
    wwEgyptTeamsData.playerDetails.forEach(detail => {
        const playerName = (detail['PLAYER NAME'] || '').trim();
        if (!playerName) return;
        
        const matchId = (detail['MATCH_ID'] || '').trim();
        if (!filteredMatchIds.has(matchId)) return;
        
        if (!playersMap.has(playerName)) {
            const matches = playersMatches[playerName] ? playersMatches[playerName].size : 0;
            const goals = playersGoals[playerName] || 0;
            const assists = playersAssists[playerName] || 0;
            const totalGA = goals + assists;
            
            // Get team from first occurrence
            const team = (detail['TEAM'] || '').trim();
            
            // Get top club (club with most goals)
            let topClub = '';
            let topClubGoals = 0;
            if (playersClubGoals[playerName]) {
                const clubEntries = Object.entries(playersClubGoals[playerName]);
                if (clubEntries.length > 0) {
                    // Sort by goals descending
                    clubEntries.sort((a, b) => b[1] - a[1]);
                    topClub = clubEntries[0][0];
                    topClubGoals = clubEntries[0][1];
                }
            }
            
            // Get all clubs with goals (for display)
            const clubsData = playersClubGoals[playerName] ? Object.entries(playersClubGoals[playerName])
                .map(([club, goals]) => ({ club, goals }))
                .sort((a, b) => b.goals - a.goals) : [];
            
            playersMap.set(playerName, {
                playerName,
                team,
                matches,
                goals,
                assists,
                totalGA,
                topClub,
                topClubGoals,
                clubsData
            });
        }
    });
    
    // Convert to array and sort by G+A (descending), then by goals (descending)
    wwEgyptTeamsData.allPlayers = Array.from(playersMap.values()).sort((a, b) => {
        if (b.totalGA !== a.totalGA) return b.totalGA - a.totalGA;
        return b.goals - a.goals;
    });
    
    // Set players to all players by default
    wwEgyptTeamsData.players = [...wwEgyptTeamsData.allPlayers];
}

function sortPlayersBy(column) {
    // Toggle sort direction if clicking the same column
    if (wwEgyptTeamsData.currentSortColumn === column) {
        wwEgyptTeamsData.currentSortDirection = wwEgyptTeamsData.currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Default to descending for new column (except for playerName)
        wwEgyptTeamsData.currentSortColumn = column;
        wwEgyptTeamsData.currentSortDirection = column === 'playerName' ? 'asc' : 'desc';
    }
    
    // Update header classes
    const headers = document.querySelectorAll('.sortable-header');
    headers.forEach(header => {
        header.classList.remove('sorted-asc', 'sorted-desc');
    });
    
    // Add class to current sorted column
    const currentHeader = document.querySelector(`[onclick="sortPlayersBy('${column}')"]`);
    if (currentHeader) {
        currentHeader.classList.add(`sorted-${wwEgyptTeamsData.currentSortDirection}`);
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
    let playersToDisplay = wwEgyptTeamsData.players;
    
    // Apply team filter
    const teamFilter = wwEgyptTeamsData.currentPlayersTeamFilter || 'all';
    if (teamFilter !== 'all') {
        playersToDisplay = playersToDisplay.filter(player => {
            const teamName = (player.team || '').toLowerCase();
            const isEgypt = isEgyptTeamName(teamName);
            
            if (teamFilter === 'egypt') {
                return isEgypt;
            }
            if (teamFilter === 'opponent') {
                return teamName ? !isEgypt : false;
            }
            return true;
        });
    }
    
    // If there's a search term, filter the players
    if (searchTerm) {
        playersToDisplay = playersToDisplay.filter((player) => {
            const playerName = String(player.playerName || '').toLowerCase();
            const goals = String(player.goals || '').toLowerCase();
            const assists = String(player.assists || '').toLowerCase();
            const totalGA = String(player.totalGA || '').toLowerCase();
            const clubs = player.clubsData ? player.clubsData.map(c => c.club.toLowerCase()).join(' ') : '';
            
            const rowText = `${playerName} ${goals} ${assists} ${totalGA} ${clubs}`;
            return rowText.includes(searchTerm);
        });
    }
    
    if (playersToDisplay.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No players found</td></tr>';
        return;
    }
    
    // Keep filter select in sync with state
    const teamFilterSelect = document.getElementById('all-players-team-filter');
    if (teamFilterSelect && teamFilterSelect.value !== teamFilter) {
        teamFilterSelect.value = teamFilter;
    }
    
    // Sort players based on current sort column and direction
    const sortedPlayers = [...playersToDisplay].sort((a, b) => {
        const column = wwEgyptTeamsData.currentSortColumn;
        const direction = wwEgyptTeamsData.currentSortDirection;
        
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
        
        // Format clubs data for display
        let clubsDisplay = '';
        if (player.clubsData && player.clubsData.length > 0) {
            clubsDisplay = player.clubsData.map(club => `${escapeHtml(club.club)} (${club.goals})`).join(', ');
        } else {
            clubsDisplay = '-';
        }
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td><strong style="font-size: 1.1rem;">${escapeHtml(player.playerName)}</strong></td>
            <td style="text-align: center; background-color: #f0f3ff;"><span style="color: #667eea; font-weight: bold; font-size: 1.2rem;">${player.totalGA}</span></td>
            <td style="text-align: center;"><span style="font-weight: bold; font-size: 1.2rem;">${player.goals}</span></td>
            <td style="text-align: center;"><span style="font-weight: bold; font-size: 1.2rem;">${player.assists}</span></td>
            <td style="font-size: 1rem; color: #555;">${clubsDisplay}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add total row
    const totalGoals = sortedPlayers.reduce((sum, player) => sum + (player.goals || 0), 0);
    const totalAssists = sortedPlayers.reduce((sum, player) => sum + (player.assists || 0), 0);
    const totalGA = totalGoals + totalAssists;
    
    const totalRow = document.createElement('tr');
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.fontWeight = 'bold';
    totalRow.style.borderTop = '3px solid #667eea';
    totalRow.innerHTML = `
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">TOTAL</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${sortedPlayers.length} Players</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${totalGA}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${totalGoals}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${totalAssists}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">-</td>
    `;
    tbody.appendChild(totalRow);
}

function setupPlayersSearch() {
    const searchInput = document.getElementById('all-players-search');
    if (!searchInput) return;
    
    if (searchInput.dataset.searchSetup === 'true') return;
    searchInput.dataset.searchSetup = 'true';
    
    searchInput.addEventListener('input', () => {
        displayPlayers();
    });
}

function setupPlayersTeamFilter() {
    const filterSelect = document.getElementById('all-players-team-filter');
    if (!filterSelect) return;
    
    if (filterSelect.dataset.teamFilterSetup === 'true') {
        filterSelect.value = wwEgyptTeamsData.currentPlayersTeamFilter || 'all';
        return;
    }
    
    filterSelect.dataset.teamFilterSetup = 'true';
    filterSelect.value = wwEgyptTeamsData.currentPlayersTeamFilter || 'all';
    
    filterSelect.addEventListener('change', () => {
        wwEgyptTeamsData.currentPlayersTeamFilter = filterSelect.value || 'all';
        displayPlayers();
    });
}

function showPlayersLoading() {
    const loading = document.getElementById('players-loading');
    if (loading) loading.style.display = 'flex';
}

function hidePlayersLoading() {
    const loading = document.getElementById('players-loading');
    if (loading) loading.style.display = 'none';
}

function showPlayersError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #fff; padding: 2rem; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10000; text-align: center;';
    errorDiv.innerHTML = `<p style="color: #dc143c; font-size: 1.2rem; margin: 0;">${message}</p>`;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
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
    // Load players if not already loaded
    if (!wwEgyptTeamsData.playersLoaded) {
        await loadWWEgyptTeamsPlayers();
    }
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(wwEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Calculate goals and unique players per club (only from filtered matches)
    const clubGoals = {};
    const clubPlayers = {};
    
    wwEgyptTeamsData.playerDetails.forEach(detail => {
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
    if (!tbody) return;
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
            <td><strong style="font-size: 1.1rem;">${escapeHtml(club.club)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${club.players}</td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${club.goals}</td>
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
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">TOTAL</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${totalPlayers}</td>
        <td style="text-align: center; font-weight: 700; color: #667eea; font-size: 1.2rem;">${totalGoals}</td>
    `;
    tbody.appendChild(totalRow);
}

let elnadySearchSetup = false;
let currentElnadyOptions = [];

async function setupElnadySearch() {
    // Load players if not already loaded
    if (!wwEgyptTeamsData.playersLoaded) {
        await loadWWEgyptTeamsPlayers();
    }
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set(wwEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Extract unique ELNADY values (only from filtered matches)
    const elnadyValues = new Set();
    wwEgyptTeamsData.playerDetails.forEach(detail => {
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
        if (!input) return;
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
    const filteredMatchIds = new Set(wwEgyptTeamsData.filteredRecords.map(match => match['MATCH_ID']));
    
    // Filter player details for this club AND filtered matches
    const clubDetails = wwEgyptTeamsData.playerDetails.filter(detail => {
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
            const match = wwEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
            const match = wwEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
            const match = wwEgyptTeamsData.allRecords.find(m => m['MATCH_ID'] === matchId);
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
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (playersArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    playersArray.forEach((player, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="font-size: 1.1rem;">${escapeHtml(player.player)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${player.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubChampionships(championshipsArray) {
    const tbody = document.getElementById('club-championships-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (championshipsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    championshipsArray.forEach((championship, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="font-size: 1.1rem;">${escapeHtml(championship.championship)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${championship.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubSeasons(seasonsArray) {
    const tbody = document.getElementById('club-seasons-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (seasonsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    seasonsArray.forEach((season, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="font-size: 1.1rem;">${escapeHtml(season.season)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${season.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

function displayClubOpponents(opponentsArray) {
    const tbody = document.getElementById('club-opponents-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (opponentsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    opponentsArray.forEach((opponent, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong style="font-size: 1.1rem;">${escapeHtml(opponent.opponent)}</strong></td>
            <td style="text-align: center; font-weight: 600; font-size: 1.1rem;">${opponent.goals}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    loadWWEgyptTeamsData();
});

