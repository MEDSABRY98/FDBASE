// ============================================================================
// YOUTH EGYPT TEAMS MODULE - JAVASCRIPT
// ============================================================================

// Global data storage
let youthEgyptData = {
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
    youthPlayers: [], // Youth players data from YouthPLAYERDETAILS
    lineupDetails: [],
    gkDetails: [],
    howPenMissed: [],
    playersLoaded: false,
    playerDetailsLoaded: false,
    youthPlayersLoaded: false,
    currentSortColumn: 'totalGA',
    currentSortDirection: 'desc',
    selectedPlayer: null,
    currentGKSortColumn: 'matches',
    currentGKSortDirection: 'desc',
    goalkeepersData: []
};

// ============================================================================
// MAIN DATA LOADING FUNCTION
// ============================================================================

async function loadYouthEgyptData(forceRefresh = false) {
    try {
        showLoading();
        
        const url = forceRefresh ? '/api/youth-egypt/matches?refresh=true' : '/api/youth-egypt/matches';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.records) {
            youthEgyptData.allRecords = data.records;
            youthEgyptData.filteredRecords = [...data.records];
            
            console.log('✅ Youth Egypt data loaded successfully');
            console.log('📊 Total records:', youthEgyptData.allRecords.length);
            
            // Generate filter options
            generateFilterOptions();
            
            // Load overview stats
            loadOverviewStats();
            
            // Render matches table
            renderMatchesTable();
            
            // Add filter event listeners
            addFilterListeners();
            
            // Load youth players data
            loadYouthPlayersData();
            
            // Show content, hide loading
            hideLoading();
            
        } else {
            throw new Error(data.error || 'No Data Available');
        }
    } catch (error) {
        console.error('❌ Error loading Youth Egypt data:', error);
        showError('No Data Available');
        hideLoading();
    }
}

// ============================================================================
// YOUTH PLAYERS DATA LOADING
// ============================================================================

async function loadYouthPlayersData() {
    try {
        console.log('👥 Loading Youth Players data...');
        
        const response = await fetch('/api/youth-egypt/players');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.records) {
            youthEgyptData.youthPlayers = data.records;
            youthEgyptData.youthPlayersLoaded = true;
            
            console.log('✅ Youth Players data loaded successfully');
            console.log('👥 Total youth players records:', youthEgyptData.youthPlayers.length);
            
        } else {
            throw new Error(data.error || 'No Data Available');
        }
    } catch (error) {
        console.error('❌ Error loading Youth Players data:', error);
        // Don't show error to user, just log it
    }
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function generateFilterOptions() {
    const columns = [
        'CHAMPION SYSTEM', 'SYSTEM KIND', 'AGE', 'MATCH_ID', 'MANAGER EGY', 'CHAMPION', 
        'SEASON', 'ROUND', 'PLACE', 'H-A-N', 'Egypt TEAM', 'W-D-L', 
        'CLEAN SHEET', 'W-L Q & F', 'OPPONENT TEAM'
    ];
    
    columns.forEach(column => {
        const values = [...new Set(youthEgyptData.allRecords.map(record => record[column]).filter(val => val && val.toString().trim()))];
        youthEgyptData.filterOptions[column] = values.sort();
    });
    
    populateFilters();
}

function populateFilters() {
    const filterMappings = {
        'filter-champion-system': 'CHAMPION SYSTEM',
        'filter-system-kind': 'SYSTEM KIND',
        'filter-age': 'AGE',
        'filter-match-id': 'MATCH_ID',
        'filter-manager-egy': 'MANAGER EGY',
        'filter-champion': 'CHAMPION',
        'filter-season': 'SEASON',
        'filter-round': 'ROUND',
        'filter-place': 'PLACE',
        'filter-han': 'H-A-N',
        'filter-egypt-team': 'Egypt TEAM',
        'filter-result': 'W-D-L',
        'filter-cs': 'CLEAN SHEET',
        'filter-wl-qf': 'W-L Q & F',
        'filter-opponent-team': 'OPPONENT TEAM'
    };
    
    Object.entries(filterMappings).forEach(([filterId, column]) => {
        const container = document.querySelector(`#${filterId}`).parentElement;
        const dropdown = container.querySelector('.dropdown-options');
        const input = document.getElementById(filterId);
        
        if (dropdown && youthEgyptData.filterOptions[column]) {
            dropdown.innerHTML = '';
            youthEgyptData.filterOptions[column].forEach(value => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.textContent = value;
                option.onclick = () => {
                    input.value = value;
                    dropdown.style.display = 'none';
                    // Don't apply filters automatically - wait for Apply Filters button
                };
                dropdown.appendChild(option);
            });
        }
    });
}

function addFilterListeners() {
    // Searchable select listeners
    document.querySelectorAll('.searchable-select-container input').forEach(input => {
        input.addEventListener('focus', function() {
            const dropdown = this.parentElement.querySelector('.dropdown-options');
            if (dropdown) {
                dropdown.style.display = 'block';
            }
        });
        
        input.addEventListener('input', function() {
            const dropdown = this.parentElement.querySelector('.dropdown-options');
            if (dropdown) {
                const options = dropdown.querySelectorAll('.dropdown-option');
                const searchTerm = this.value.toLowerCase();
                
                options.forEach(option => {
                    if (option.textContent.toLowerCase().includes(searchTerm)) {
                        option.style.display = 'block';
                    } else {
                        option.style.display = 'none';
                    }
                });
            }
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.searchable-select-container')) {
            document.querySelectorAll('.dropdown-options').forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    });
}

function applyFilters() {
    const filters = {
        championSystem: document.getElementById('filter-champion-system').value,
        systemKind: document.getElementById('filter-system-kind').value,
        age: document.getElementById('filter-age').value,
        matchId: document.getElementById('filter-match-id').value,
        dateFrom: document.getElementById('filter-date-from').value,
        dateTo: document.getElementById('filter-date-to').value,
        managerEgy: document.getElementById('filter-manager-egy').value,
        champion: document.getElementById('filter-champion').value,
        season: document.getElementById('filter-season').value,
        round: document.getElementById('filter-round').value,
        place: document.getElementById('filter-place').value,
        han: document.getElementById('filter-han').value,
        egyptTeam: document.getElementById('filter-egypt-team').value,
        gf: document.getElementById('filter-gf').value,
        ga: document.getElementById('filter-ga').value,
        result: document.getElementById('filter-result').value,
        cs: document.getElementById('filter-cs').value,
        wlQf: document.getElementById('filter-wl-qf').value,
        opponentTeam: document.getElementById('filter-opponent-team').value
    };
    
    youthEgyptData.filteredRecords = youthEgyptData.allRecords.filter(record => {
        return (
            (!filters.championSystem || record['CHAMPION SYSTEM'] === filters.championSystem) &&
            (!filters.systemKind || record['SYSTEM KIND'] === filters.systemKind) &&
            (!filters.age || record['AGE'] === filters.age) &&
            (!filters.matchId || record['MATCH_ID'] === filters.matchId) &&
            (!filters.dateFrom || new Date(record['DATE']) >= new Date(filters.dateFrom)) &&
            (!filters.dateTo || new Date(record['DATE']) <= new Date(filters.dateTo)) &&
            (!filters.managerEgy || record['MANAGER EGY'] === filters.managerEgy) &&
            (!filters.champion || record['CHAMPION'] === filters.champion) &&
            (!filters.season || record['SEASON'] === filters.season) &&
            (!filters.round || record['ROUND'] === filters.round) &&
            (!filters.place || record['PLACE'] === filters.place) &&
            (!filters.han || record['H-A-N'] === filters.han) &&
            (!filters.egyptTeam || record['Egypt TEAM'] === filters.egyptTeam) &&
            (!filters.gf || parseInt(record['GF']) === parseInt(filters.gf)) &&
            (!filters.ga || parseInt(record['GA']) === parseInt(filters.ga)) &&
            (!filters.result || record['W-D-L'] === filters.result) &&
            (!filters.cs || record['CLEAN SHEET'] === filters.cs) &&
            (!filters.wlQf || record['W-L Q & F'] === filters.wlQf) &&
            (!filters.opponentTeam || record['OPPONENT TEAM'] === filters.opponentTeam)
        );
    });
    
    // Update overview stats and matches table
    loadOverviewStats();
    renderMatchesTable();
    
    // Update players stats if we're in players tab
    const playersTab = document.getElementById('players-tab');
    if (playersTab && playersTab.classList.contains('active')) {
        const byPlayerTab = document.getElementById('by-player-tab');
        const byElnadyTab = document.getElementById('by-elnady-tab');
        
        if (byPlayerTab && byPlayerTab.classList.contains('active')) {
            loadYouthPlayersStats();
        } else if (byElnadyTab && byElnadyTab.classList.contains('active')) {
            loadYouthElnadyStats();
        }
    }
}

function clearFilters() {
    document.querySelectorAll('.filter-control').forEach(input => {
        input.value = '';
    });
    
    youthEgyptData.filteredRecords = [...youthEgyptData.allRecords];
    
    // Update overview stats and matches table
    loadOverviewStats();
    renderMatchesTable();
    
    // Update players stats if we're in players tab
    const playersTab = document.getElementById('players-tab');
    if (playersTab && playersTab.classList.contains('active')) {
        const byPlayerTab = document.getElementById('by-player-tab');
        const byElnadyTab = document.getElementById('by-elnady-tab');
        
        if (byPlayerTab && byPlayerTab.classList.contains('active')) {
            loadYouthPlayersStats();
        } else if (byElnadyTab && byElnadyTab.classList.contains('active')) {
            loadYouthElnadyStats();
        }
    }
}

// ============================================================================
// OVERVIEW STATISTICS
// ============================================================================

function loadOverviewStats() {
    const records = youthEgyptData.filteredRecords;
    
    youthEgyptData.totalMatches = records.length;
    youthEgyptData.wins = records.filter(r => r['W-D-L'] === 'W').length;
    youthEgyptData.draws = records.filter(r => r['W-D-L'] === 'D' || r['W-D-L'] === 'D.').length;
    youthEgyptData.losses = records.filter(r => r['W-D-L'] === 'L').length;
    
    youthEgyptData.totalGoalsFor = records.reduce((sum, r) => sum + (parseInt(r['GF']) || 0), 0);
    youthEgyptData.totalGoalsAgainst = records.reduce((sum, r) => sum + (parseInt(r['GA']) || 0), 0);
    
    // Clean Sheet For: عندما مصر ما تسجل عليها أهداف (GA = 0)
    youthEgyptData.cleanSheetFor = records.filter(r => parseInt(r['GA'] || 0) === 0).length;
    // Clean Sheet Against: عندما مصر ما تسجل أهداف (GF = 0)  
    youthEgyptData.cleanSheetAgainst = records.filter(r => parseInt(r['GF'] || 0) === 0).length;
    
    // Calculate streaks
    calculateStreaks(records);
    
    // Update UI
    updateOverviewUI();
}

function calculateStreaks(records) {
    // Sort by date
    const sortedRecords = [...records].sort((a, b) => new Date(a['DATE']) - new Date(b['DATE']));
    
    let currentWinStreak = 0;
    let currentDrawStreak = 0;
    let currentLossStreak = 0;
    
    let maxWinStreak = 0;
    let maxDrawStreak = 0;
    let maxLossStreak = 0;
    
    for (const record of sortedRecords) {
        if (record['W-D-L'] === 'W') {
            currentWinStreak++;
            currentDrawStreak = 0;
            currentLossStreak = 0;
            maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
        } else if (record['W-D-L'] === 'D' || record['W-D-L'] === 'D.') {
            currentDrawStreak++;
            currentWinStreak = 0;
            currentLossStreak = 0;
            maxDrawStreak = Math.max(maxDrawStreak, currentDrawStreak);
        } else if (record['W-D-L'] === 'L') {
            currentLossStreak++;
            currentWinStreak = 0;
            currentDrawStreak = 0;
            maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
        }
    }
    
    youthEgyptData.longestWinStreak = maxWinStreak;
    youthEgyptData.longestDrawStreak = maxDrawStreak;
    youthEgyptData.longestLossStreak = maxLossStreak;
}

function updateOverviewUI() {
    document.getElementById('total-matches').textContent = youthEgyptData.totalMatches;
    document.getElementById('total-wins').textContent = youthEgyptData.wins;
    document.getElementById('total-draws').textContent = youthEgyptData.draws;
    document.getElementById('total-losses').textContent = youthEgyptData.losses;
    document.getElementById('total-goals-for').textContent = youthEgyptData.totalGoalsFor;
    document.getElementById('total-goals-against').textContent = youthEgyptData.totalGoalsAgainst;
    document.getElementById('clean-sheet-for').textContent = youthEgyptData.cleanSheetFor;
    document.getElementById('clean-sheet-against').textContent = youthEgyptData.cleanSheetAgainst;
}

// ============================================================================
// MATCHES TABLE
// ============================================================================

function renderMatchesTable() {
    const tbody = document.getElementById('matches-tbody');
    tbody.innerHTML = '';
    
    youthEgyptData.filteredRecords.forEach((record, index) => {
        const row = document.createElement('tr');
        
        // Extract numeric values with proper defaults
        const round = record['ROUND'] || 0;
        const gf = record['GF'] || 0;
        const ga = record['GA'] || 0;
        
        row.innerHTML = `
            <td>${record['DATE'] || ''}</td>
            <td>${record['AGE'] || ''}</td>
            <td>${record['MANAGER EGY'] || ''}</td>
            <td>${record['SEASON'] || ''}</td>
            <td>${round}</td>
            <td>EGY</td>
            <td>${gf}</td>
            <td>${ga}</td>
            <td>${record['OPPONENT TEAM'] || ''}</td>
            <td><span class="badge ${getResultBadgeClass(record['W-D-L'])}">${record['W-D-L'] || ''}</span></td>
            <td><span class="badge ${record['CLEAN SHEET'] === 'YES' ? 'badge-success' : 'badge-warning'}">${record['CLEAN SHEET'] || ''}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

function getResultBadgeClass(result) {
    switch(result) {
        case 'W': return 'badge-success';
        case 'D': return 'badge-warning';
        case 'L': return 'badge-danger';
        default: return 'badge-warning';
    }
}

// ============================================================================
// TAB SWITCHING
// ============================================================================

function switchTab(tabName) {
    // Remove active class from all modern tab buttons
    const modernTabButtons = document.querySelectorAll('.modern-tab-button');
    modernTabButtons.forEach(button => button.classList.remove('active'));
    
    // Remove active class from all legacy tab buttons (for other sections)
    const legacyTabButtons = document.querySelectorAll('.tabs-header > .tab-button');
    legacyTabButtons.forEach(button => button.classList.remove('active'));
    
    // Hide all tab contents
    const tabContents = document.querySelectorAll('#content-tabs > .tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Show selected tab
    if (tabName === 'overview') {
        document.getElementById('overview-tab').classList.add('active');
        const overviewButton = document.querySelector('.modern-tab-button[onclick="switchTab(\'overview\')"]');
        if (overviewButton) overviewButton.classList.add('active');
    } else if (tabName === 'matches') {
        document.getElementById('matches-tab').classList.add('active');
        const matchesButton = document.querySelector('.modern-tab-button[onclick="switchTab(\'matches\')"]');
        if (matchesButton) matchesButton.classList.add('active');
    } else if (tabName === 'h2h') {
        document.getElementById('h2h-tab').classList.add('active');
        const h2hButton = document.querySelector('.modern-tab-button[onclick="switchTab(\'h2h\')"]');
        if (h2hButton) h2hButton.classList.add('active');
        loadH2HStats();
    } else if (tabName === 'managers') {
        document.getElementById('managers-tab').classList.add('active');
        const managersButton = document.querySelector('.modern-tab-button[onclick="switchTab(\'managers\')"]');
        if (managersButton) managersButton.classList.add('active');
        loadManagersStats();
    } else if (tabName === 'players') {
        document.getElementById('players-tab').classList.add('active');
        const playersButton = document.querySelector('.modern-tab-button[onclick="switchTab(\'players\')"]');
        if (playersButton) playersButton.classList.add('active');
        
        // Load players data first, then show stats
        loadYouthPlayersData().then(() => {
            // Check which sub-tab is active
            const byPlayerTab = document.getElementById('by-player-tab');
            const byElnadyTab = document.getElementById('by-elnady-tab');
            
            if (byPlayerTab && byPlayerTab.classList.contains('active')) {
                loadYouthPlayersStats();
            } else if (byElnadyTab && byElnadyTab.classList.contains('active')) {
                loadYouthElnadyStats();
            } else {
                // Default to by-player tab
                loadYouthPlayersStats();
            }
        });
    }
}

// ============================================================================
// H2H STATISTICS
// ============================================================================

function loadH2HStats() {
    const opponentStats = {};
    
    youthEgyptData.filteredRecords.forEach(record => {
        const opponent = record['OPPONENT TEAM'];
        if (!opponent) return;
        
        if (!opponentStats[opponent]) {
            opponentStats[opponent] = {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheetsFor: 0,
                cleanSheetsAgainst: 0
            };
        }
        
        const stats = opponentStats[opponent];
        stats.matches++;
        
        if (record['W-D-L'] === 'W') stats.wins++;
        else if (record['W-D-L'] === 'D' || record['W-D-L'] === 'D.') stats.draws++;
        else if (record['W-D-L'] === 'L') stats.losses++;
        
        stats.goalsFor += parseInt(record['GF']) || 0;
        stats.goalsAgainst += parseInt(record['GA']) || 0;
        
        // Clean Sheet For: عندما مصر ما تسجل عليها أهداف (GA = 0)
        if (parseInt(record['GA'] || 0) === 0) stats.cleanSheetsFor++;
        // Clean Sheet Against: عندما مصر ما تسجل أهداف (GF = 0)
        if (parseInt(record['GF'] || 0) === 0) stats.cleanSheetsAgainst++;
    });
    
    renderH2HTable(opponentStats);
}

function renderH2HTable(opponentStats) {
    const tbody = document.getElementById('h2h-tbody');
    tbody.innerHTML = '';
    
    const sortedOpponents = Object.entries(opponentStats)
        .sort((a, b) => b[1].matches - a[1].matches);
    
    sortedOpponents.forEach(([opponent, stats]) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><a href="#" class="opponent-link" onclick="showOpponentAgeStats('${opponent}')">${opponent}</a></td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.draws}</td>
            <td>${stats.losses}</td>
            <td>${stats.goalsFor}</td>
            <td>${stats.goalsAgainst}</td>
            <td>${stats.goalsFor - stats.goalsAgainst}</td>
            <td>${stats.cleanSheetsFor}</td>
            <td>${stats.cleanSheetsAgainst}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// ============================================================================
// MANAGERS STATISTICS
// ============================================================================

function loadManagersStats() {
    loadEgyptManagersStats();
}

function loadEgyptManagersStats() {
    const managerStats = {};
    
    youthEgyptData.filteredRecords.forEach(record => {
        const manager = record['MANAGER EGY'];
        if (!manager) return;
        
        if (!managerStats[manager]) {
            managerStats[manager] = {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                cleanSheetsFor: 0,
                cleanSheetsAgainst: 0
            };
        }
        
        const stats = managerStats[manager];
        stats.matches++;
        
        if (record['W-D-L'] === 'W') stats.wins++;
        else if (record['W-D-L'] === 'D' || record['W-D-L'] === 'D.') stats.draws++;
        else if (record['W-D-L'] === 'L') stats.losses++;
        
        stats.goalsFor += parseInt(record['GF']) || 0;
        stats.goalsAgainst += parseInt(record['GA']) || 0;
        
        // Clean Sheet For: عدد المباريات اللي مصر ما تسجل عليها أهداف (GA = 0)
        if (parseInt(record['GA'] || 0) === 0) {
            stats.cleanSheetsFor++;
        }
        
        // Clean Sheet Against: عدد المباريات اللي مصر ما تسجل فيها أهداف (GF = 0)  
        if (parseInt(record['GF'] || 0) === 0) {
            stats.cleanSheetsAgainst++;
        }
    });
    
    renderManagersTable('egypt-managers-tbody', managerStats);
}

function loadOpponentManagersStats() {
    // For now, we'll use a placeholder since we don't have opponent manager data
    const tbody = document.getElementById('opponent-managers-tbody');
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">No opponent manager data available</td></tr>';
}

function renderManagersTable(tbodyId, managerStats) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    
    const sortedManagers = Object.entries(managerStats)
        .sort((a, b) => b[1].matches - a[1].matches);
    
    sortedManagers.forEach(([manager, stats]) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><a href="#" class="manager-link" onclick="showCoachSeasonStats('${manager}')">${manager}</a></td>
            <td>${stats.matches}</td>
            <td>${stats.wins}</td>
            <td>${stats.draws}</td>
            <td>${stats.losses}</td>
            <td>${stats.goalsFor}</td>
            <td>${stats.goalsAgainst}</td>
            <td>${stats.goalsFor - stats.goalsAgainst}</td>
            <td>${stats.cleanSheetsFor}</td>
            <td>${stats.cleanSheetsAgainst}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// ============================================================================
// YOUTH PLAYERS STATISTICS
// ============================================================================

function loadYouthPlayersStats() {
    if (!youthEgyptData.youthPlayersLoaded) {
        setTimeout(loadYouthPlayersStats, 500);
        return;
    }
    
    const playerStats = {};
    
    // Get filtered match IDs from the current filters
    const filteredMatchIds = new Set();
    
    
    youthEgyptData.filteredRecords.forEach(record => {
        // Try different possible column names for MATCH_ID
        const matchId = record['MATCH_ID'] || record['Match ID'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Process youth players data - only for filtered matches
    youthEgyptData.youthPlayers.forEach(record => {
        const playerName = record['PLAYER NAME'];
        const matchId = record['MATCH_ID'];
        const gaTotal = parseInt(record['GATOTAL']) || 0;
        const elnadyName = record['ELNADY'];
        
        // Only include players from filtered matches
        if (!playerName || !filteredMatchIds.has(matchId)) return;
        
        if (!playerStats[playerName]) {
            playerStats[playerName] = {
                gaTotal: 0,
                elnadyGoals: {} // Store goals per elnady
            };
        }
        
        const stats = playerStats[playerName];
        stats.gaTotal += gaTotal;
        
        // Track goals per elnady
        if (elnadyName && gaTotal > 0) {
            if (!stats.elnadyGoals[elnadyName]) {
                stats.elnadyGoals[elnadyName] = 0;
            }
            stats.elnadyGoals[elnadyName] += gaTotal;
        }
    });
    
    renderYouthPlayersTable(playerStats);
}

function switchPlayersTab(tabType) {
    // Remove active class from all sub-tab buttons
    document.querySelectorAll('#players-tab .modern-tab-button').forEach(btn => btn.classList.remove('active'));
    
    // Hide all sub-tab contents
    document.querySelectorAll('#players-tab .tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabType === 'by-player') {
        document.getElementById('by-player-tab').classList.add('active');
        document.querySelector('#players-tab .modern-tab-button[onclick="switchPlayersTab(\'by-player\')"]').classList.add('active');
        
        // Make sure data is loaded first
        if (youthEgyptData.youthPlayersLoaded) {
            loadYouthPlayersStats();
        } else {
            loadYouthPlayersData().then(() => {
                loadYouthPlayersStats();
            });
        }
    } else if (tabType === 'by-elnady') {
        document.getElementById('by-elnady-tab').classList.add('active');
        document.querySelector('#players-tab .modern-tab-button[onclick="switchPlayersTab(\'by-elnady\')"]').classList.add('active');
        
        // Make sure data is loaded first
        if (youthEgyptData.youthPlayersLoaded) {
            loadYouthElnadyStats();
        } else {
            loadYouthPlayersData().then(() => {
                loadYouthElnadyStats();
            });
        }
    }
}

function renderYouthPlayersTable(playerStats) {
    const tbody = document.getElementById('players-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const sortedPlayers = Object.entries(playerStats)
        .sort((a, b) => b[1].gaTotal - a[1].gaTotal);
    
    sortedPlayers.forEach(([playerName, stats]) => {
        const row = document.createElement('tr');
        
        // Create elnady display with goals in parentheses
        let elnadyDisplay = '';
        if (stats.elnadyGoals && Object.keys(stats.elnadyGoals).length > 0) {
            const elnadyEntries = Object.entries(stats.elnadyGoals)
                .sort((a, b) => b[1] - a[1]) // Sort by goals descending
                .map(([elnady, goals]) => `${elnady} (${goals})`)
                .join(', ');
            elnadyDisplay = elnadyEntries;
        } else {
            elnadyDisplay = '-';
        }
        
        row.innerHTML = `
            <td><a href="#" class="player-link" onclick="showPlayerChampionStats('${playerName}')">${playerName}</a></td>
            <td>${elnadyDisplay}</td>
            <td>${stats.gaTotal}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function loadYouthElnadyStats() {
    if (!youthEgyptData.youthPlayersLoaded) {
        setTimeout(loadYouthElnadyStats, 500);
        return;
    }
    
    const elnadyStats = {};
    
    // Get filtered match IDs from the current filters
    const filteredMatchIds = new Set();
    
    youthEgyptData.filteredRecords.forEach(record => {
        // Try different possible column names for MATCH_ID
        const matchId = record['MATCH_ID'] || record['Match ID'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Process youth players data - only for filtered matches
    youthEgyptData.youthPlayers.forEach(record => {
        const elnadyName = record['ELNADY'];
        const matchId = record['MATCH_ID'];
        const gaTotal = parseInt(record['GATOTAL']) || 0;
        
        // Only include elnady from filtered matches
        if (!elnadyName || !filteredMatchIds.has(matchId)) return;
        
        if (!elnadyStats[elnadyName]) {
            elnadyStats[elnadyName] = {
                goals: 0
            };
        }
        
        const stats = elnadyStats[elnadyName];
        stats.goals += gaTotal;
    });
    
    renderYouthElnadyTable(elnadyStats);
}

function renderYouthElnadyTable(elnadyStats) {
    const tbody = document.getElementById('elnady-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const sortedElnady = Object.entries(elnadyStats)
        .sort((a, b) => b[1].goals - a[1].goals);
    
    sortedElnady.forEach(([elnadyName, stats]) => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><a href="#" class="elnady-link" onclick="showElnadyPlayers('${elnadyName}')">${elnadyName}</a></td>
            <td>${stats.goals}</td>
        `;
        
        tbody.appendChild(row);
    });
}

function showElnadyPlayers(elnadyName) {
    if (!youthEgyptData.youthPlayersLoaded) {
        alert('البيانات لم يتم تحميلها بعد، يرجى المحاولة مرة أخرى');
        return;
    }
    
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set();
    youthEgyptData.filteredRecords.forEach(record => {
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Get players from this elnady
    const elnadyPlayers = {};
    youthEgyptData.youthPlayers.forEach(record => {
        const playerName = record['PLAYER NAME'];
        const matchId = record['MATCH_ID'];
        const gaTotal = parseInt(record['GATOTAL']) || 0;
        const recordElnady = record['ELNADY'];
        
        // Only include if it's the selected elnady and from filtered matches
        if (recordElnady === elnadyName && filteredMatchIds.has(matchId) && playerName && gaTotal > 0) {
            if (!elnadyPlayers[playerName]) {
                elnadyPlayers[playerName] = 0;
            }
            elnadyPlayers[playerName] += gaTotal;
        }
    });
    
    // Sort players by goals
    const sortedPlayers = Object.entries(elnadyPlayers)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedPlayers.length === 0) {
        alert(`لا يوجد لاعبين سجلوا أهداف تحت نادي ${elnadyName}`);
        return;
    }
    
    // Create modal content
    let modalContent = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>🏟️ اللاعبين في نادي ${elnadyName}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>اسم اللاعب</th>
                                <th>عدد الأهداف</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    sortedPlayers.forEach(([playerName, goals]) => {
        modalContent += `
            <tr>
                <td>${playerName}</td>
                <td>${goals}</td>
            </tr>
        `;
    });
    
    modalContent += `
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function showOpponentAgeStats(opponentName) {
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set();
    youthEgyptData.filteredRecords.forEach(record => {
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Get matches against this opponent grouped by AGE
    const ageStats = {};
    youthEgyptData.filteredRecords.forEach(record => {
        const opponent = record['OPPONENT TEAM'];
        const age = record['AGE'];
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        
        if (opponent === opponentName && filteredMatchIds.has(matchId)) {
            if (!ageStats[age]) {
                ageStats[age] = {
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    cleanSheetsFor: 0,
                    cleanSheetsAgainst: 0
                };
            }
            
            const stats = ageStats[age];
            stats.matches++;
            stats.goalsFor += parseInt(record['GF']) || 0;
            stats.goalsAgainst += parseInt(record['GA']) || 0;
            
            // Count wins, draws, losses
            const result = record['W-D-L'];
            if (result === 'W') stats.wins++;
            else if (result === 'D' || result === 'D.') stats.draws++;
            else if (result === 'L') stats.losses++;
            
            // Clean Sheet For: عندما مصر ما تسجل عليها أهداف (GA = 0)
            if (parseInt(record['GA'] || 0) === 0) stats.cleanSheetsFor++;
            // Clean Sheet Against: عندما مصر ما تسجل أهداف (GF = 0)
            if (parseInt(record['GF'] || 0) === 0) stats.cleanSheetsAgainst++;
        }
    });
    
    if (Object.keys(ageStats).length === 0) {
        alert(`لا يوجد إحصائيات متاحة لفريق ${opponentName}`);
        return;
    }
    
    // Sort ages
    const sortedAges = Object.entries(ageStats)
        .sort((a, b) => {
            // Sort by age order: U23, U21, U20, U19, U18, etc.
            const ageA = a[0];
            const ageB = b[0];
            const numA = parseInt(ageA.replace('U', '')) || 0;
            const numB = parseInt(ageB.replace('U', '')) || 0;
            return numA - numB;
        });
    
    // Create modal content
    let modalContent = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>⚽ إحصائيات ضد ${opponentName} حسب الفئة العمرية</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>الفئة العمرية</th>
                                <th>المباريات</th>
                                <th>فوز</th>
                                <th>تعادل</th>
                                <th>خسارة</th>
                                <th>أهداف لصالح</th>
                                <th>أهداف ضد</th>
                                <th>الفرق</th>
                                <th>كلين شيت لصالح</th>
                                <th>كلين شيت ضد</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    // Calculate totals
    let totalMatches = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0, totalCleanSheetsFor = 0, totalCleanSheetsAgainst = 0;
    
    sortedAges.forEach(([age, stats]) => {
        totalMatches += stats.matches;
        totalWins += stats.wins;
        totalDraws += stats.draws;
        totalLosses += stats.losses;
        totalGoalsFor += stats.goalsFor;
        totalGoalsAgainst += stats.goalsAgainst;
        totalCleanSheetsFor += stats.cleanSheetsFor;
        totalCleanSheetsAgainst += stats.cleanSheetsAgainst;
        
        modalContent += `
            <tr>
                <td><strong>${age}</strong></td>
                <td>${stats.matches}</td>
                <td>${stats.wins}</td>
                <td>${stats.draws}</td>
                <td>${stats.losses}</td>
                <td>${stats.goalsFor}</td>
                <td>${stats.goalsAgainst}</td>
                <td>${stats.goalsFor - stats.goalsAgainst}</td>
                <td>${stats.cleanSheetsFor}</td>
                <td>${stats.cleanSheetsAgainst}</td>
            </tr>
        `;
    });
    
    // Add total row
    modalContent += `
        <tr class="total-row">
            <td><strong>المجموع</strong></td>
            <td><strong>${totalMatches}</strong></td>
            <td><strong>${totalWins}</strong></td>
            <td><strong>${totalDraws}</strong></td>
            <td><strong>${totalLosses}</strong></td>
            <td><strong>${totalGoalsFor}</strong></td>
            <td><strong>${totalGoalsAgainst}</strong></td>
            <td><strong>${totalGoalsFor - totalGoalsAgainst}</strong></td>
            <td><strong>${totalCleanSheetsFor}</strong></td>
            <td><strong>${totalCleanSheetsAgainst}</strong></td>
        </tr>
    `;
    
    modalContent += `
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function showPlayerChampionStats(playerName) {
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set();
    youthEgyptData.filteredRecords.forEach(record => {
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Get player goals grouped by SEASON and ELNADY
    const seasonStats = {};
    
    if (!youthEgyptData.youthPlayers || youthEgyptData.youthPlayers.length === 0) {
        alert(`لا يوجد بيانات متاحة للاعب ${playerName}`);
        return;
    }
    
    youthEgyptData.youthPlayers.forEach(player => {
        const name = player['PLAYER NAME'];
        const matchId = player['MATCH_ID'] || player['Match Id'] || player['match_id'] || player['ID'];
        const gaTotal = parseInt(player['GATOTAL']) || 0;
        const elnadyName = player['ELNADY'];
        
        if (name === playerName && filteredMatchIds.has(matchId) && gaTotal > 0) {
            // Find the match record to get SEASON
            const matchRecord = youthEgyptData.filteredRecords.find(record => {
                const recordMatchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
                return recordMatchId === matchId;
            });
            
            if (matchRecord) {
                const season = matchRecord['SEASON'] || 'غير محدد';
                
                if (!seasonStats[season]) {
                    seasonStats[season] = {
                        goals: 0,
                        elnadyGoals: {}
                    };
                }
                
                seasonStats[season].goals += gaTotal;
                
                // Track goals per elnady for this season
                if (elnadyName) {
                    if (!seasonStats[season].elnadyGoals[elnadyName]) {
                        seasonStats[season].elnadyGoals[elnadyName] = 0;
                    }
                    seasonStats[season].elnadyGoals[elnadyName] += gaTotal;
                }
            }
        }
    });
    
    if (Object.keys(seasonStats).length === 0) {
        alert(`لا يوجد إحصائيات متاحة للاعب ${playerName}`);
        return;
    }
    
    // Sort by season (most recent first)
    const sortedSeasons = Object.entries(seasonStats)
        .sort((a, b) => {
            // Sort seasons in descending order (2024 before 2023)
            return b[0].localeCompare(a[0]);
        });
    
    // Calculate total goals
    let totalGoals = 0;
    sortedSeasons.forEach(([season, stats]) => {
        totalGoals += stats.goals;
    });
    
    // Create modal content
    let modalContent = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>⚽ أهداف ${playerName} حسب الموسم</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>الموسم</th>
                                <th>النادي</th>
                                <th>الأهداف</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    sortedSeasons.forEach(([season, stats]) => {
        // Create elnady display with goals in parentheses
        let elnadyDisplay = '';
        if (stats.elnadyGoals && Object.keys(stats.elnadyGoals).length > 0) {
            const elnadyEntries = Object.entries(stats.elnadyGoals)
                .sort((a, b) => b[1] - a[1]) // Sort by goals descending
                .map(([elnady, goals]) => `${elnady} (${goals})`)
                .join(', ');
            elnadyDisplay = elnadyEntries;
        } else {
            elnadyDisplay = '-';
        }
        
        modalContent += `
            <tr>
                <td><strong>${season}</strong></td>
                <td>${elnadyDisplay}</td>
                <td>${stats.goals}</td>
            </tr>
        `;
    });
    
    // Add total row
    modalContent += `
        <tr class="total-row">
            <td><strong>المجموع</strong></td>
            <td><strong>-</strong></td>
            <td><strong>${totalGoals}</strong></td>
        </tr>
    `;
    
    modalContent += `
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function showCoachSeasonStats(coachName) {
    // Get filtered match IDs from current filters
    const filteredMatchIds = new Set();
    youthEgyptData.filteredRecords.forEach(record => {
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        if (matchId) {
            filteredMatchIds.add(matchId);
        }
    });
    
    // Get coach stats grouped by SEASON
    const seasonStats = {};
    
    youthEgyptData.filteredRecords.forEach(record => {
        const manager = record['MANAGER EGY'];
        const season = record['SEASON'] || 'غير محدد';
        const matchId = record['MATCH_ID'] || record['Match Id'] || record['match_id'] || record['ID'];
        
        if (manager === coachName && filteredMatchIds.has(matchId)) {
            if (!seasonStats[season]) {
                seasonStats[season] = {
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goalsFor: 0,
                    goalsAgainst: 0,
                    cleanSheetsFor: 0,
                    cleanSheetsAgainst: 0
                };
            }
            
            const stats = seasonStats[season];
            stats.matches++;
            
            if (record['W-D-L'] === 'W') stats.wins++;
            else if (record['W-D-L'] === 'D' || record['W-D-L'] === 'D.') stats.draws++;
            else if (record['W-D-L'] === 'L') stats.losses++;
            
            stats.goalsFor += parseInt(record['GF']) || 0;
            stats.goalsAgainst += parseInt(record['GA']) || 0;
            
            // Clean Sheet For: عندما مصر ما تسجل عليها أهداف (GA = 0)
            if (parseInt(record['GA'] || 0) === 0) stats.cleanSheetsFor++;
            // Clean Sheet Against: عندما مصر ما تسجل أهداف (GF = 0)
            if (parseInt(record['GF'] || 0) === 0) stats.cleanSheetsAgainst++;
        }
    });
    
    if (Object.keys(seasonStats).length === 0) {
        alert(`لا يوجد إحصائيات متاحة للمدرب ${coachName}`);
        return;
    }
    
    // Sort by season (most recent first)
    const sortedSeasons = Object.entries(seasonStats)
        .sort((a, b) => {
            // Sort seasons in descending order (2024 before 2023)
            return b[0].localeCompare(a[0]);
        });
    
    // Calculate totals
    let totalMatches = 0, totalWins = 0, totalDraws = 0, totalLosses = 0;
    let totalGoalsFor = 0, totalGoalsAgainst = 0, totalCleanSheetsFor = 0, totalCleanSheetsAgainst = 0;
    
    sortedSeasons.forEach(([season, stats]) => {
        totalMatches += stats.matches;
        totalWins += stats.wins;
        totalDraws += stats.draws;
        totalLosses += stats.losses;
        totalGoalsFor += stats.goalsFor;
        totalGoalsAgainst += stats.goalsAgainst;
        totalCleanSheetsFor += stats.cleanSheetsFor;
        totalCleanSheetsAgainst += stats.cleanSheetsAgainst;
    });
    
    // Create modal content
    let modalContent = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>📊 إحصائيات المدرب ${coachName} حسب الموسم</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <table class="modal-table">
                        <thead>
                            <tr>
                                <th>الموسم</th>
                                <th>المباريات</th>
                                <th>فوز</th>
                                <th>تعادل</th>
                                <th>خسارة</th>
                                <th>أهداف لصالح</th>
                                <th>أهداف ضد</th>
                                <th>الفرق</th>
                                <th>كلين شيت لصالح</th>
                                <th>كلين شيت ضد</th>
                            </tr>
                        </thead>
                        <tbody>
    `;
    
    sortedSeasons.forEach(([season, stats]) => {
        modalContent += `
            <tr>
                <td><strong>${season}</strong></td>
                <td>${stats.matches}</td>
                <td>${stats.wins}</td>
                <td>${stats.draws}</td>
                <td>${stats.losses}</td>
                <td>${stats.goalsFor}</td>
                <td>${stats.goalsAgainst}</td>
                <td>${stats.goalsFor - stats.goalsAgainst}</td>
                <td>${stats.cleanSheetsFor}</td>
                <td>${stats.cleanSheetsAgainst}</td>
            </tr>
        `;
    });
    
    // Add total row
    modalContent += `
        <tr class="total-row">
            <td><strong>المجموع</strong></td>
            <td><strong>${totalMatches}</strong></td>
            <td><strong>${totalWins}</strong></td>
            <td><strong>${totalDraws}</strong></td>
            <td><strong>${totalLosses}</strong></td>
            <td><strong>${totalGoalsFor}</strong></td>
            <td><strong>${totalGoalsAgainst}</strong></td>
            <td><strong>${totalGoalsFor - totalGoalsAgainst}</strong></td>
            <td><strong>${totalCleanSheetsFor}</strong></td>
            <td><strong>${totalCleanSheetsAgainst}</strong></td>
        </tr>
    `;
    
    modalContent += `
                        </tbody>
                    </table>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">إغلاق</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalContent);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
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

function showError(message) {
    console.error('Error:', message);
    // You can add a proper error display here
}


// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Youth Egypt Teams page loaded');
    loadYouthEgyptData();
});
