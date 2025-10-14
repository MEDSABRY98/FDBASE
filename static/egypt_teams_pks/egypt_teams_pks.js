// Global data object
const pksEgyptData = {
    allRecords: [],
    filteredRecords: [],
    filterOptions: {},
    currentTab: 'overview'
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadPKSData();
    setupSearchableSelects();
});

// Load PKS data from API
async function loadPKSData(forceRefresh = false) {
    try {
        const url = forceRefresh ? '/api/egypt-teams-pks?force_refresh=true' : '/api/egypt-teams-pks';
        const response = await fetch(url);
        const data = await response.json();
        
        pksEgyptData.allRecords = data.records || [];
        
        // Build filter options
        buildFilterOptions();
        
        // Apply filters (will show all initially)
        applyPKSFilters();
        
        // Hide loading, show content
        document.getElementById('pks-loading').style.display = 'none';
        document.getElementById('pks-main-content').style.display = 'block';
    } catch (error) {
        console.error('Error loading PKS data:', error);
        document.getElementById('pks-loading').innerHTML = '<p style="color: red;">Error loading data. Please try again.</p>';
    }
}

// Refresh PKS data
async function refreshPKSData() {
    const refreshBtn = event.target.closest('button');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<svg class="btn-icon" style="animation: spin 1s linear infinite;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>Refreshing...';
    
    try {
        await loadPKSData(true);
        
        // Show success message
        refreshBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>Refreshed!';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    } catch (error) {
        refreshBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>Error!';
        
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    }
}

// Build filter options from data
function buildFilterOptions() {
    const options = {
        'filter-pks-system': new Set(),
        'filter-champion-system': new Set(),
        'filter-egypt-team': new Set(),
        'filter-egypt-player': new Set(),
        'filter-egypt-status': new Set(),
        'filter-opponent-team': new Set(),
        'filter-opponent-player': new Set(),
        'filter-opponent-status': new Set(),
        'filter-egypt-gk': new Set(),
        'filter-opponent-gk': new Set(),
        'filter-result': new Set()
    };
    
    pksEgyptData.allRecords.forEach(record => {
        if (record['PKS System']) options['filter-pks-system'].add(record['PKS System']);
        if (record['CHAMPION System']) options['filter-champion-system'].add(record['CHAMPION System']);
        if (record['Egypt TEAM']) options['filter-egypt-team'].add(record['Egypt TEAM']);
        if (record['Egypt PLAYER']) options['filter-egypt-player'].add(record['Egypt PLAYER']);
        if (record['Egypt STATUS']) options['filter-egypt-status'].add(record['Egypt STATUS']);
        if (record['OPPONENT TEAM']) options['filter-opponent-team'].add(record['OPPONENT TEAM']);
        if (record['OPPONENT PLAYER']) options['filter-opponent-player'].add(record['OPPONENT PLAYER']);
        if (record['OPPONENT STATUS']) options['filter-opponent-status'].add(record['OPPONENT STATUS']);
        if (record['EGYPT GK']) options['filter-egypt-gk'].add(record['EGYPT GK']);
        if (record['OPPONENT GK']) options['filter-opponent-gk'].add(record['OPPONENT GK']);
        if (record['W-D-L PKS']) options['filter-result'].add(record['W-D-L PKS']);
    });
    
    pksEgyptData.filterOptions = options;
}

// Setup searchable select dropdowns
function setupSearchableSelects() {
    const filterInputs = document.querySelectorAll('.searchable-select-container input');
    
    filterInputs.forEach(input => {
        input.addEventListener('focus', function() {
            showDropdown(this);
        });
        
        input.addEventListener('input', function() {
            filterDropdown(this);
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.searchable-select-container')) {
                document.querySelectorAll('.dropdown-options').forEach(dropdown => {
                    dropdown.style.display = 'none';
                });
            }
        });
    });
}

// Show dropdown options
function showDropdown(input) {
    const container = input.closest('.searchable-select-container');
    const dropdown = container.querySelector('.dropdown-options');
    const filterId = input.id;
    
    // Get options for this filter
    const options = pksEgyptData.filterOptions[filterId];
    if (!options) return;
    
    // Clear and populate dropdown
    dropdown.innerHTML = '';
    const sortedOptions = Array.from(options).sort();
    
    sortedOptions.forEach(option => {
        const div = document.createElement('div');
        div.className = 'dropdown-option';
        div.textContent = option;
        div.addEventListener('click', function() {
            input.value = option;
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(div);
    });
    
    dropdown.style.display = 'block';
}

// Filter dropdown based on input
function filterDropdown(input) {
    const container = input.closest('.searchable-select-container');
    const dropdown = container.querySelector('.dropdown-options');
    const filter = input.value.toLowerCase();
    
    const options = dropdown.querySelectorAll('.dropdown-option');
    options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(filter) ? 'block' : 'none';
    });
}

// Switch between main tabs
function switchPKSTab(tabName) {
    // Update tab buttons
    const tabButtons = document.querySelectorAll('.main-tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'overview') {
        document.getElementById('overview-tab').classList.add('active');
    } else if (tabName === 'players') {
        document.getElementById('players-tab').classList.add('active');
        displayEgyptPlayers();
    } else if (tabName === 'h2h') {
        document.getElementById('h2h-tab').classList.add('active');
        displayH2HTeams();
    } else if (tabName === 'matches') {
        document.getElementById('matches-tab').classList.add('active');
    } else if (tabName === 'goalkeepers') {
        document.getElementById('goalkeepers-tab').classList.add('active');
        displayEgyptGoalkeepers();
    }
    
    pksEgyptData.currentTab = tabName;
}

// Switch between players sub tabs
function switchPlayersSubTab(tabName) {
    // Update sub tab buttons
    const subTabButtons = document.querySelectorAll('.sub-tab-btn');
    subTabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update sub tab content
    document.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'egypt') {
        document.getElementById('egypt-players-subtab').classList.add('active');
        displayEgyptPlayers();
    } else if (tabName === 'opponent') {
        document.getElementById('opponent-players-subtab').classList.add('active');
        displayOpponentPlayers();
    }
}

// Switch between goalkeepers sub tabs
function switchGKSubTab(tabName) {
    // Update sub tab buttons
    const subTabButtons = document.querySelectorAll('.sub-tab-btn');
    subTabButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update sub tab content
    document.querySelectorAll('.sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tabName === 'egypt') {
        document.getElementById('egypt-gk-subtab').classList.add('active');
        displayEgyptGoalkeepers();
    } else if (tabName === 'opponent') {
        document.getElementById('opponent-gk-subtab').classList.add('active');
        displayOpponentGoalkeepers();
    }
}

// Apply filters
function applyPKSFilters() {
    const filters = {
        matchId: document.getElementById('filter-match-id').value.trim().toLowerCase(),
        pksSystem: document.getElementById('filter-pks-system').value.trim(),
        championSystem: document.getElementById('filter-champion-system').value.trim(),
        egyptTeam: document.getElementById('filter-egypt-team').value.trim(),
        egyptPlayer: document.getElementById('filter-egypt-player').value.trim(),
        egyptStatus: document.getElementById('filter-egypt-status').value.trim(),
        opponentTeam: document.getElementById('filter-opponent-team').value.trim(),
        opponentPlayer: document.getElementById('filter-opponent-player').value.trim(),
        opponentStatus: document.getElementById('filter-opponent-status').value.trim(),
        egyptGK: document.getElementById('filter-egypt-gk').value.trim(),
        opponentGK: document.getElementById('filter-opponent-gk').value.trim(),
        result: document.getElementById('filter-result').value.trim()
    };
    
    // Filter records
    pksEgyptData.filteredRecords = pksEgyptData.allRecords.filter(record => {
        const matchIdStr = String(record['MATCH_ID'] || '').toLowerCase();
        return (!filters.matchId || matchIdStr.includes(filters.matchId)) &&
               (!filters.pksSystem || record['PKS System'] === filters.pksSystem) &&
               (!filters.championSystem || record['CHAMPION System'] === filters.championSystem) &&
               (!filters.egyptTeam || record['Egypt TEAM'] === filters.egyptTeam) &&
               (!filters.egyptPlayer || record['Egypt PLAYER'] === filters.egyptPlayer) &&
               (!filters.egyptStatus || record['Egypt STATUS'] === filters.egyptStatus) &&
               (!filters.opponentTeam || record['OPPONENT TEAM'] === filters.opponentTeam) &&
               (!filters.opponentPlayer || record['OPPONENT PLAYER'] === filters.opponentPlayer) &&
               (!filters.opponentStatus || record['OPPONENT STATUS'] === filters.opponentStatus) &&
               (!filters.egyptGK || record['EGYPT GK'] === filters.egyptGK) &&
               (!filters.opponentGK || record['OPPONENT GK'] === filters.opponentGK) &&
               (!filters.result || record['W-D-L PKS'] === filters.result);
    });
    
    // Calculate and display statistics
    calculatePKSStatistics();
    
    // Display filtered data in table
    displayPKSData();
    
    // Update Players Stats if that tab is active
    if (pksEgyptData.currentTab === 'players') {
        const activeSubTab = document.querySelector('.sub-tab-btn.active');
        if (activeSubTab && activeSubTab.textContent.includes('Egypt')) {
            displayEgyptPlayers();
        } else {
            displayOpponentPlayers();
        }
    }
    
    // Update H2H Teams if that tab is active
    if (pksEgyptData.currentTab === 'h2h') {
        displayH2HTeams();
    }
    
    // Update GKS Stats if that tab is active
    if (pksEgyptData.currentTab === 'goalkeepers') {
        const activeSubTab = document.querySelector('.sub-tab-btn.active');
        if (activeSubTab && activeSubTab.textContent.includes('Egypt')) {
            displayEgyptGoalkeepers();
        } else {
            displayOpponentGoalkeepers();
        }
    }
}

// Calculate statistics
function calculatePKSStatistics() {
    const records = pksEgyptData.filteredRecords;
    
    // Total Matches (unique MATCH_ID)
    const uniqueMatches = new Set();
    records.forEach(record => {
        if (record['MATCH_ID']) {
            uniqueMatches.add(record['MATCH_ID']);
        }
    });
    const totalMatches = uniqueMatches.size;
    
    // Wins and Losses
    let wins = 0;
    let losses = 0;
    const processedMatches = new Set();
    
    records.forEach(record => {
        const matchId = record['MATCH_ID'];
        if (matchId && !processedMatches.has(matchId)) {
            processedMatches.add(matchId);
            const result = record['W-D-L PKS'];
            if (result && result.includes('W')) wins++;
            if (result && result.includes('L')) losses++;
        }
    });
    
    // Calculate Win Rate
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
    
    // Total Penalties, Goals, Misses
    const totalPenalties = records.filter(r => r['Egypt STATUS']).length;
    const goals = records.filter(r => r['Egypt STATUS'] === 'GOAL').length;
    const misses = records.filter(r => r['Egypt STATUS'] === 'MISS').length;
    
    // Calculate Success Rate
    const successRate = totalPenalties > 0 ? Math.round((goals / totalPenalties) * 100) : 0;
    
    // Update display
    displayOverviewCards({
        totalMatches,
        wins,
        winRate,
        losses,
        totalPenalties,
        goals,
        misses,
        successRate
    });
}

// Display overview cards
function displayOverviewCards(stats) {
    document.getElementById('stat-total-matches').textContent = stats.totalMatches || 0;
    document.getElementById('stat-wins').textContent = stats.wins || 0;
    document.getElementById('stat-win-rate').textContent = (stats.winRate || 0) + '%';
    document.getElementById('stat-losses').textContent = stats.losses || 0;
    document.getElementById('stat-total-penalties').textContent = stats.totalPenalties || 0;
    document.getElementById('stat-goals').textContent = stats.goals || 0;
    document.getElementById('stat-misses').textContent = stats.misses || 0;
    document.getElementById('stat-success-rate').textContent = (stats.successRate || 0) + '%';
}

// Display PKS data in table
function displayPKSData() {
    const tbody = document.getElementById('pks-tbody');
    tbody.innerHTML = '';
    
    if (pksEgyptData.filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    pksEgyptData.filteredRecords.forEach(record => {
        const row = document.createElement('tr');
        
        // Egypt Status badge
        let egyptStatusBadge = '';
        if (record['Egypt STATUS'] === 'GOAL') {
            egyptStatusBadge = '<span class="badge badge-scored">GOAL</span>';
        } else if (record['Egypt STATUS'] === 'MISS') {
            egyptStatusBadge = '<span class="badge badge-missed">MISS</span>';
        } else {
            egyptStatusBadge = record['Egypt STATUS'] || '';
        }
        
        // Opponent Status badge
        let opponentStatusBadge = '';
        if (record['OPPONENT STATUS'] === 'GOAL') {
            opponentStatusBadge = '<span class="badge badge-scored">GOAL</span>';
        } else if (record['OPPONENT STATUS'] === 'MISS') {
            opponentStatusBadge = '<span class="badge badge-missed">MISS</span>';
        } else {
            opponentStatusBadge = record['OPPONENT STATUS'] || '';
        }
        
        // Result badge
        let resultBadge = '';
        const result = record['W-D-L PKS'];
        if (result && result.includes('W')) {
            resultBadge = '<span class="badge badge-win">WIN</span>';
        } else if (result && result.includes('L')) {
            resultBadge = '<span class="badge badge-loss">LOSS</span>';
        } else {
            resultBadge = result || '';
        }
        
        row.innerHTML = `
            <td>${record['MATCH_ID'] || ''}</td>
            <td>${record['Egypt TEAM'] || ''}</td>
            <td>${record['Egypt PLAYER'] || ''}</td>
            <td>${egyptStatusBadge}</td>
            <td>${record['EGYPT HOW MISS'] || ''}</td>
            <td>${record['OPPONENT TEAM'] || ''}</td>
            <td>${record['OPPONENT PLAYER'] || ''}</td>
            <td>${opponentStatusBadge}</td>
            <td>${record['OPPONENT HOW MISS'] || ''}</td>
            <td>${record['EGYPT GK'] || ''}</td>
            <td>${record['OPPONENT GK'] || ''}</td>
            <td>${resultBadge}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// Clear all filters
function clearPKSFilters() {
    document.getElementById('filter-match-id').value = '';
    document.getElementById('filter-pks-system').value = '';
    document.getElementById('filter-champion-system').value = '';
    document.getElementById('filter-egypt-team').value = '';
    document.getElementById('filter-egypt-player').value = '';
    document.getElementById('filter-egypt-status').value = '';
    document.getElementById('filter-opponent-team').value = '';
    document.getElementById('filter-opponent-player').value = '';
    document.getElementById('filter-opponent-status').value = '';
    document.getElementById('filter-egypt-gk').value = '';
    document.getElementById('filter-opponent-gk').value = '';
    document.getElementById('filter-result').value = '';
    
    applyPKSFilters();
}

// Display Egypt Players Statistics
function displayEgyptPlayers() {
    const records = pksEgyptData.filteredRecords;
    const tbody = document.getElementById('egypt-players-tbody');
    tbody.innerHTML = '';
    
    // Group by Egypt player
    const playersData = {};
    
    records.forEach(record => {
        const player = record['Egypt PLAYER'];
        const status = record['Egypt STATUS'];
        
        if (!player) return;
        
        if (!playersData[player]) {
            playersData[player] = {
                totalPenalties: 0,
                goals: 0,
                misses: 0
            };
        }
        
        if (status) {
            playersData[player].totalPenalties++;
            
            if (status === 'GOAL') {
                playersData[player].goals++;
            } else if (status === 'MISS') {
                playersData[player].misses++;
            }
        }
    });
    
    // Convert to array and sort by total penalties
    const playersArray = Object.keys(playersData).map(player => {
        const data = playersData[player];
        const successRate = data.totalPenalties > 0 
            ? Math.round((data.goals / data.totalPenalties) * 100) 
            : 0;
        
        return {
            name: player,
            totalPenalties: data.totalPenalties,
            goals: data.goals,
            misses: data.misses,
            successRate: successRate
        };
    }).sort((a, b) => b.totalPenalties - a.totalPenalties);
    
    // Display in table
    if (playersArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    playersArray.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${player.name}</td>
            <td>${player.totalPenalties}</td>
            <td><span class="badge badge-scored">${player.goals}</span></td>
            <td><span class="badge badge-win">${player.successRate}%</span></td>
            <td><span class="badge badge-missed">${player.misses}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Display Opponent Players Statistics
function displayOpponentPlayers() {
    const records = pksEgyptData.filteredRecords;
    const tbody = document.getElementById('opponent-players-tbody');
    tbody.innerHTML = '';
    
    // Group by Opponent player
    const playersData = {};
    
    records.forEach(record => {
        const player = record['OPPONENT PLAYER'];
        const status = record['OPPONENT STATUS'];
        
        if (!player) return;
        
        if (!playersData[player]) {
            playersData[player] = {
                totalPenalties: 0,
                goals: 0,
                misses: 0
            };
        }
        
        if (status) {
            playersData[player].totalPenalties++;
            
            if (status === 'GOAL') {
                playersData[player].goals++;
            } else if (status === 'MISS') {
                playersData[player].misses++;
            }
        }
    });
    
    // Convert to array and sort by total penalties
    const playersArray = Object.keys(playersData).map(player => {
        const data = playersData[player];
        const successRate = data.totalPenalties > 0 
            ? Math.round((data.goals / data.totalPenalties) * 100) 
            : 0;
        
        return {
            name: player,
            totalPenalties: data.totalPenalties,
            goals: data.goals,
            misses: data.misses,
            successRate: successRate
        };
    }).sort((a, b) => b.totalPenalties - a.totalPenalties);
    
    // Display in table
    if (playersArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    playersArray.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${player.name}</td>
            <td>${player.totalPenalties}</td>
            <td><span class="badge badge-scored">${player.goals}</span></td>
            <td><span class="badge badge-win">${player.successRate}%</span></td>
            <td><span class="badge badge-missed">${player.misses}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Display Egypt Goalkeepers Statistics
function displayEgyptGoalkeepers() {
    const records = pksEgyptData.filteredRecords;
    const tbody = document.getElementById('egypt-gk-tbody');
    tbody.innerHTML = '';
    
    // Group by Egypt goalkeeper
    const gkData = {};
    
    records.forEach(record => {
        const gk = record['EGYPT GK'];
        const matchId = record['MATCH_ID'];
        const opponentStatus = record['OPPONENT STATUS'];
        const opponentHowMiss = record['OPPONENT HOW MISS'];
        
        if (!gk) return;
        
        if (!gkData[gk]) {
            gkData[gk] = {
                matches: new Set(),
                penaltiesFaced: 0,
                penaltiesSaved: 0,
                goalsConceded: 0
            };
        }
        
        // Add match
        if (matchId) {
            gkData[gk].matches.add(matchId);
        }
        
        // Count penalties faced and saved
        if (opponentStatus) {
            gkData[gk].penaltiesFaced++;
            
            // Check if goalkeeper saved
            if (opponentHowMiss && opponentHowMiss.toLowerCase().includes('الحارس')) {
                gkData[gk].penaltiesSaved++;
            }
            
            // Count goals conceded
            if (opponentStatus === 'GOAL') {
                gkData[gk].goalsConceded++;
            }
        }
    });
    
    // Convert to array and sort by matches
    const gkArray = Object.keys(gkData).map(gk => {
        const data = gkData[gk];
        const saveRate = data.penaltiesFaced > 0 
            ? Math.round((data.penaltiesSaved / data.penaltiesFaced) * 100) 
            : 0;
        
        return {
            name: gk,
            pksMatches: data.matches.size,
            penaltiesFaced: data.penaltiesFaced,
            penaltiesSaved: data.penaltiesSaved,
            saveRate: saveRate,
            goalsConceded: data.goalsConceded
        };
    }).sort((a, b) => b.pksMatches - a.pksMatches);
    
    // Display in table
    if (gkArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    gkArray.forEach(gk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${gk.name}</td>
            <td>${gk.pksMatches}</td>
            <td>${gk.penaltiesFaced}</td>
            <td><span class="badge badge-scored">${gk.penaltiesSaved}</span></td>
            <td><span class="badge badge-win">${gk.saveRate}%</span></td>
            <td><span class="badge badge-missed">${gk.goalsConceded}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Display Opponent Goalkeepers Statistics
function displayOpponentGoalkeepers() {
    const records = pksEgyptData.filteredRecords;
    const tbody = document.getElementById('opponent-gk-tbody');
    tbody.innerHTML = '';
    
    // Group by Opponent goalkeeper
    const gkData = {};
    
    records.forEach(record => {
        const gk = record['OPPONENT GK'];
        const matchId = record['MATCH_ID'];
        const egyptStatus = record['Egypt STATUS'];
        const egyptHowMiss = record['EGYPT HOW MISS'];
        
        if (!gk) return;
        
        if (!gkData[gk]) {
            gkData[gk] = {
                matches: new Set(),
                penaltiesFaced: 0,
                penaltiesSaved: 0,
                goalsConceded: 0
            };
        }
        
        // Add match
        if (matchId) {
            gkData[gk].matches.add(matchId);
        }
        
        // Count penalties faced and saved
        if (egyptStatus) {
            gkData[gk].penaltiesFaced++;
            
            // Check if goalkeeper saved
            if (egyptHowMiss && egyptHowMiss.toLowerCase().includes('الحارس')) {
                gkData[gk].penaltiesSaved++;
            }
            
            // Count goals conceded
            if (egyptStatus === 'GOAL') {
                gkData[gk].goalsConceded++;
            }
        }
    });
    
    // Convert to array and sort by matches
    const gkArray = Object.keys(gkData).map(gk => {
        const data = gkData[gk];
        const saveRate = data.penaltiesFaced > 0 
            ? Math.round((data.penaltiesSaved / data.penaltiesFaced) * 100) 
            : 0;
        
        return {
            name: gk,
            pksMatches: data.matches.size,
            penaltiesFaced: data.penaltiesFaced,
            penaltiesSaved: data.penaltiesSaved,
            saveRate: saveRate,
            goalsConceded: data.goalsConceded
        };
    }).sort((a, b) => b.pksMatches - a.pksMatches);
    
    // Display in table
    if (gkArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    gkArray.forEach(gk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${gk.name}</td>
            <td>${gk.pksMatches}</td>
            <td>${gk.penaltiesFaced}</td>
            <td><span class="badge badge-scored">${gk.penaltiesSaved}</span></td>
            <td><span class="badge badge-win">${gk.saveRate}%</span></td>
            <td><span class="badge badge-missed">${gk.goalsConceded}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Display H2H Teams Statistics
function displayH2HTeams() {
    const records = pksEgyptData.filteredRecords;
    const tbody = document.getElementById('h2h-tbody');
    tbody.innerHTML = '';
    
    // Group by opponent team
    const teamsData = {};
    
    records.forEach(record => {
        const team = record['OPPONENT TEAM'];
        const matchId = record['MATCH_ID'];
        const result = record['W-D-L PKS'];
        
        if (!team) return;
        
        if (!teamsData[team]) {
            teamsData[team] = {
                matches: new Set(),
                wins: new Set(),
                losses: new Set()
            };
        }
        
        // Add match ID to track unique matches
        if (matchId) {
            teamsData[team].matches.add(matchId);
            
            // Track wins and losses per match
            if (result) {
                if (result.includes('W')) {
                    teamsData[team].wins.add(matchId);
                } else if (result.includes('L')) {
                    teamsData[team].losses.add(matchId);
                }
            }
        }
    });
    
    // Convert to array and sort by matches count
    const teamsArray = Object.keys(teamsData).map(team => ({
        name: team,
        matches: teamsData[team].matches.size,
        wins: teamsData[team].wins.size,
        losses: teamsData[team].losses.size
    })).sort((a, b) => b.matches - a.matches);
    
    // Display in table
    if (teamsArray.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #666;">No records found</td></tr>';
        return;
    }
    
    teamsArray.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${team.name}</td>
            <td>${team.matches}</td>
            <td><span class="badge badge-win">${team.wins}</span></td>
            <td><span class="badge badge-loss">${team.losses}</span></td>
        `;
        tbody.appendChild(row);
    });
}
