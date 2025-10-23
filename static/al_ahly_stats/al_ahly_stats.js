// ============================================================================
// AL AHLY STATISTICS MODULE - JAVASCRIPT FUNCTIONS
// ============================================================================
// Excel-only mode: no cacheServices

// ============================================================================
// STATISTICS DATA MANAGEMENT
// ============================================================================

// EMERGENCY: Request throttling to prevent excessive API calls
let requestThrottle = {
    lastRequest: 0,
    minInterval: 2000, // Minimum 2 seconds between requests
    isThrottled: false
};

function canMakeRequest() {
    const now = Date.now();
    if (now - requestThrottle.lastRequest < requestThrottle.minInterval) {
        console.warn('🚫 Request throttled - too soon since last request');
        return false;
    }
    requestThrottle.lastRequest = now;
    return true;
}

// Global variables for statistics data
let alAhlyStatsData = {
    matches: [],
    players: [],
    goalkeepers: [],
    competitions: [],
    seasons: [],
    filterOptions: {},
    allRecords: [],
    originalRecords: [] // Store original unfiltered data
};

// Excel-driven mode flag and workbook cache
window.__ahlySheetsJson = {};

// Data is now loaded from Google Sheets via backend sync

// Rebuild main filter selects from a records array
function rebuildMainFilterOptionsFrom(records) {
    if (!Array.isArray(records) || records.length === 0) return;
    console.log('🔧 Rebuilding filters from', records.length, 'records');
    
    const columnsForFilters = [
        'CHAMPION SYSTEM','CHAMPION','SEASON','AHLY MANAGER','OPPONENT MANAGER','REFREE','ROUND','H-A-N','STAD','AHLY TEAM','OPPONENT TEAM','W-D-L','CLEAN SHEET','ET','PEN'
    ];
    const idMap = {
        'CHAMPION SYSTEM': 'champion-system-filter',
        'CHAMPION': 'champion-filter',
        'SEASON': 'season-filter',
        'AHLY MANAGER': 'ahly-manager-filter',
        'OPPONENT MANAGER': 'opponent-manager-filter',
        'REFREE': 'referee-filter',
        'ROUND': 'round-filter',
        'H-A-N': 'h-a-n-filter',
        'STAD': 'stadium-filter',
        'AHLY TEAM': 'ahly-team-filter',
        'OPPONENT TEAM': 'opponent-team-filter',
        'W-D-L': 'result-filter',
        'CLEAN SHEET': 'clean-sheet-filter',
        'ET': 'extra-time-filter',
        'PEN': 'penalties-filter'
    };
    
    columnsForFilters.forEach(col => {
        const uniqueValues = [...new Set(records.map(r => r[col]).filter(v => v && String(v).trim()))].sort();
        const selectId = idMap[col] || col.toLowerCase().replace(/\s+/g, '-') + '-filter';
        const select = document.getElementById(selectId);
        if (select) {
            console.log(`  ✅ Filter ${col}: ${uniqueValues.length} options`);
            const prev = select.value || '';
            select.innerHTML = '<option value="">All</option>' + uniqueValues.map(v => `<option value="${v}">${v}</option>`).join('');
            select.value = prev;
            
            // Trigger change event to update searchable wrappers if they exist
            const ev = new Event('change', { bubbles: true });
            select.dispatchEvent(ev);
        }
    });
    
    // Reinitialize searchable filters after updating options
    console.log('🔄 Reinitializing searchable filters...');
    setTimeout(() => {
        initializeSearchableFilters();
    }, 100);
}

// Helper: get rows from workbook by candidate sheet names (case-insensitive)
function getSheetRowsByCandidates(candidates) {
    console.log('Getting sheet rows for candidates:', candidates);
    
    // Always use session data (which is loaded from cache on page load)
    if (window.__ahlySheetsJson) {
    const names = Object.keys(window.__ahlySheetsJson);
        console.log('Available sheet names from session:', names);
        
    // Try exact case-insensitive
    for (const cand of candidates) {
        const found = names.find(n => n.toUpperCase() === cand.toUpperCase());
            if (found) {
                const rows = window.__ahlySheetsJson[found] || [];
                console.log(`Found sheet ${found} with ${rows.length} rows`);
                return rows;
    }
        }
        
    // Try contains match
    for (const cand of candidates) {
        const found = names.find(n => n.toUpperCase().includes(cand.toUpperCase()));
            if (found) {
                const rows = window.__ahlySheetsJson[found] || [];
                console.log(`Found sheet ${found} (contains match) with ${rows.length} rows`);
                return rows;
            }
        }
    }
    
    console.warn(`⚠️ No sheet found for candidates: ${candidates.join(', ')}. Please upload Excel file first.`);
    return [];
}

// ---------- Excel loaders for Player tabs ----------
function normalizeStr(v) {
    return (v == null ? '' : String(v)).trim();
}

function safeInt(v, d = 0) {
    const n = parseInt(v, 10);
    return isNaN(n) ? d : n;
}

// Normalize team names across languages and variants (e.g., الأهلي / Al Ahly / Ahly)
function normalizeTeamKey(value) {
    const s = normalizeStr(value).toLowerCase();
    if (!s) return '';
    // Common Ahly variants
    if (
        s.includes('ahly') || s.includes('الأهلي') || s.includes('الاهلي') || s.includes('اهلي')
    ) {
        return 'ahly';
    }
    return s;
}

// Accept single team or array of teams
function teamMatchesFilter(rowTeamValue, selectedTeamFilter) {
    const rowRaw = normalizeStr(rowTeamValue).toLowerCase();
    const rowKey = normalizeTeamKey(rowTeamValue);
    const filters = Array.isArray(selectedTeamFilter) ? selectedTeamFilter : [selectedTeamFilter];
    const normalized = filters.map(f => ({ raw: normalizeStr(f).toLowerCase(), key: normalizeTeamKey(f) }))
                              .filter(f => f.raw || f.key);
    if (normalized.length === 0) return true;
    return normalized.some(f => {
        if (f.key && rowKey && f.key === rowKey) return true;
        if (f.raw && rowRaw && (rowRaw.includes(f.raw) || f.raw.includes(rowRaw))) return true;
        return false;
    });
}

function getPlayerMatchesFromSheets(playerName, teamFilter, appliedFilters = {}) {
    // This function returns ALL matches where the player participated (from LINEUPDETAILS)
    // with their goals/assists data (from PLAYERDETAILS) - shows 0 if no goals/assists
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const lineup = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const nameLower = playerName.toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    // Apply main filters to matches first
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = match[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(match['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(match['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(match['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(match['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                const cleanSheetValue = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                const extraTimeValue = normalizeStr(match['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                const penaltiesValue = normalizeStr(match['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else {
                        return recordValue === filterValue;
                    }
                }
                // Default string matching
                return normalizeStr(recordValue).toLowerCase().includes(normalizeStr(filterValue).toLowerCase());
            }
        });
    });

    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID)));

    // Filter PLAYERDETAILS by player, team, and filtered matches
    const playerRows = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!filteredMatchIds.has(matchId)) return false;
        return true;
    });

    // Group by MATCH_ID and count goals/assists
    const byMatchId = new Map();
    playerRows.forEach(r => {
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!matchId) return;
        const gaVal = normalizeStr(r.GA || r.TYPE || r.ga).toUpperCase();
        const typeNorm = normalizeStr(r.TYPE).toUpperCase().replace(/[^A-Z]/g, '');
        if (!byMatchId.has(matchId)) byMatchId.set(matchId, { goals: 0, assists: 0 });
        const agg = byMatchId.get(matchId);
        if (gaVal === 'GOAL' || typeNorm === 'PENGOAL') agg.goals += 1;
        if (gaVal === 'ASSIST' || typeNorm === 'PENASSISTGOAL') agg.assists += 1;
    });

    // Build rows by joining filtered MATCHDETAILS and LINEUPDETAILS
    // Include ALL matches where player participated (from LINEUPDETAILS), not just those with goals/assists
    const result = [];
    
    // Get all matches where player participated from LINEUPDETAILS
    const playerLineupMatches = lineup.filter(l => {
        const p = normalizeStr(l.PLAYER || l['PLAYER NAME']).toLowerCase();
        if (p !== nameLower) return false;
        // LINEUPDETAILS is Ahly-only; apply team filter accordingly
        if (teamLower) {
            if (normalizeTeamKey(teamFilter) !== 'ahly') return false;
        }
        const matchId = normalizeStr(l.MATCH_ID);
        return filteredMatchIds.has(matchId);
    });
    
    console.log(`Found ${playerLineupMatches.length} matches for player ${playerName} in LINEUPDETAILS`);
    
    // Create result for each match where player participated (regardless of goals/assists)
    playerLineupMatches.forEach(l => {
        const matchId = normalizeStr(l.MATCH_ID);
        const m = filteredMatches.find(x => normalizeStr(x.MATCH_ID) === matchId) || {};
        const agg = byMatchId.get(matchId) || { goals: 0, assists: 0 };
        
        // Include ALL matches where player participated
        result.push({
            date: normalizeStr(m.DATE),
            season: normalizeStr(m.SEASON),
            manager: normalizeStr(m['AHLY MANAGER']),
            opponent: normalizeStr(m['OPPONENT TEAM']),
            goals: agg.goals,
            assists: agg.assists,
            minutes: safeInt(l.MINTOTAL || l['MIN TOTAL'] || l.MINUTES)
        });
    });
    
    console.log(`Returning ${result.length} matches for player ${playerName} (all matches where player participated)`);
    return result;
}

function getPlayerChampionshipsFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const lineup = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const nameLower = playerName.toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    // Apply main filters to matches first, but exclude champion filter for championships tab
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Skip champion filter for championships tab - we want to show all championships player played in
            if (key === 'champion') return true;
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = match[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(match['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(match['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(match['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(match['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                const cleanSheetValue = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                const extraTimeValue = normalizeStr(match['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                const penaltiesValue = normalizeStr(match['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else {
                        return recordValue === filterValue;
                    }
                }
                // Default string matching
                return normalizeStr(recordValue).toLowerCase().includes(normalizeStr(filterValue).toLowerCase());
            }
        });
    });

    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID)));

    // Goals/assists per match - filter by applied filters
    const playerRows = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!filteredMatchIds.has(matchId)) return false;
        return true;
    });
    const gaPerMatch = new Map();
    playerRows.forEach(r => {
        const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!mid) return;
        const gaVal = normalizeStr(r.GA || r.TYPE || r.ga).toUpperCase();
        if (!gaPerMatch.has(mid)) gaPerMatch.set(mid, { goals: 0, assists: 0 });
        const agg = gaPerMatch.get(mid);
        if (gaVal === 'GOAL') agg.goals += 1;
        if (gaVal === 'ASSIST') agg.assists += 1;
    });

    // Matches/minutes from LINEUPDETAILS grouped by championship via MATCHDETAILS (STRICT lineup-based)
    const perChampion = new Map(); // champ -> { matchIds:Set, matchMinutes:Map<mid,minutes>, goals, assists }
    const processedMidChamp = new Set();
    lineup.forEach(l => {
        const p = normalizeStr(l.PLAYER || l['PLAYER NAME']).toLowerCase();
        if (p !== nameLower) return;
        // LINEUPDETAILS is Ahly-only; if team filter is set and not Ahly, skip
        if (teamLower) {
            if (normalizeTeamKey(teamFilter) !== 'ahly') return;
        }
        const mid = normalizeStr(l.MATCH_ID || l['MATCH ID'] || l.match_id);
        if (!mid) return;
        processedMidChamp.add(mid);
        const m = matches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const champ = normalizeStr(m.CHAMPION);
        if (!perChampion.has(champ)) perChampion.set(champ, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const agg = perChampion.get(champ);
        agg.matchIds.add(mid);
        const mins = safeInt(l.MINTOTAL || l['MIN TOTAL'] || l.MINUTES);
        const prev = agg.matchMinutes.get(mid) || 0;
        if (mins > prev) agg.matchMinutes.set(mid, mins);
    });

    // Add GA for lineup matches only
    perChampion.forEach((agg) => {
        agg.goals = 0; agg.assists = 0;
        agg.matchIds.forEach(mid => {
            const ga = gaPerMatch.get(mid) || { goals: 0, assists: 0 };
            agg.goals += ga.goals;
            agg.assists += ga.assists;
        });
    });

    // Ensure championships with GA-only events (no lineup) are included (matches/minutes remain 0)
    gaPerMatch.forEach((ga, mid) => {
        if (processedMidChamp.has(mid)) return;
        const m = matches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const champ = normalizeStr(m.CHAMPION);
        if (!perChampion.has(champ)) perChampion.set(champ, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const agg = perChampion.get(champ);
        // do not add matchIds or minutes; just add GA so that row appears with 0 matches/minutes
        agg.goals += ga.goals || 0;
        agg.assists += ga.assists || 0;
    });

    return Array.from(perChampion.entries()).map(([CHAMPION, v]) => {
        let minutesSum = 0;
        v.matchMinutes.forEach(min => minutesSum += (min || 0));
        return {
            CHAMPION,
            matches: v.matchIds.size,
            minutes: minutesSum,
            goals: v.goals,
            assists: v.assists,
            ga_sum: v.goals + v.assists
        };
    });
}

function getPlayerSeasonsFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const lineup = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const nameLower = playerName.toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    // Apply main filters to matches first (same logic as other functions)
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = match[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(match['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(match['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(match['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(match['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                const cleanSheetValue = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                const extraTimeValue = normalizeStr(match['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                const penaltiesValue = normalizeStr(match['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else if (key === 'season') {
                // For seasons tab, if season filter is applied, only show that season
                return normalizeStr(recordValue).toLowerCase() === normalizeStr(filterValue).toLowerCase();
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else {
                        return recordValue === filterValue;
                    }
                }
                // Default string matching
                return normalizeStr(recordValue).toLowerCase().includes(normalizeStr(filterValue).toLowerCase());
            }
        });
    });

    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID)));

    // Goals/assists per match - filter by applied filters
    const playerRows = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!matchId || !filteredMatchIds.has(matchId)) return false;
        return true;
    });
    const gaPerMatch = new Map();
    playerRows.forEach(r => {
        const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!mid) return;
        const gaVal = normalizeStr(r.GA || r.TYPE || r.ga).toUpperCase();
        if (!gaPerMatch.has(mid)) gaPerMatch.set(mid, { goals: 0, assists: 0 });
        const agg = gaPerMatch.get(mid);
        if (gaVal === 'GOAL') agg.goals += 1;
        if (gaVal === 'ASSIST') agg.assists += 1;
    });

    // Matches/minutes grouped by SEASON strictly from LINEUPDETAILS (MATCH_ID-based, unique per match) - filter by applied filters
    const perSeason = new Map(); // season -> { matchIds:Set, matchMinutes:Map<mid,minutes>, goals, assists }
    lineup.forEach(l => {
        const p = normalizeStr(l.PLAYER || l['PLAYER NAME']).toLowerCase();
        if (p !== nameLower) return;
        // LINEUPDETAILS is Ahly-only; if team filter is set and not Ahly, skip
        if (teamLower) {
            if (normalizeTeamKey(teamFilter) !== 'ahly') return;
        }
        const mid = normalizeStr(l.MATCH_ID || l['MATCH ID'] || l.match_id);
        if (!mid || !filteredMatchIds.has(mid)) return;
        const m = filteredMatches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const season = normalizeStr(m.SEASON);
        if (!perSeason.has(season)) perSeason.set(season, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const agg = perSeason.get(season);
        agg.matchIds.add(mid);
        const mins = safeInt(l.MINTOTAL || l['MIN TOTAL'] || l.MINUTES);
        const prev = agg.matchMinutes.get(mid) || 0;
        if (mins > prev) agg.matchMinutes.set(mid, mins);
    });

    // Add goals/assists using GA per match, but do NOT add matches/minutes from GA-only
    perSeason.forEach((agg) => {
        agg.goals = 0; agg.assists = 0;
        agg.matchIds.forEach(mid => {
            const ga = gaPerMatch.get(mid) || { goals: 0, assists: 0 };
            agg.goals += ga.goals;
            agg.assists += ga.assists;
        });
    });

    // Also include seasons where player only had GA events (no lineup): do not add matches/minutes, only GA so row appears
    gaPerMatch.forEach((ga, mid) => {
        const m = matches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const season = normalizeStr(m.SEASON);
        if (!perSeason.has(season)) perSeason.set(season, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const agg = perSeason.get(season);
        if (!agg.matchIds.has(mid)) {
            agg.goals += ga.goals || 0;
            agg.assists += ga.assists || 0;
        }
    });

    return Array.from(perSeason.entries()).map(([SEASON, v]) => {
        let minutesSum = 0;
        v.matchMinutes.forEach(min => minutesSum += (min || 0));
        return {
            SEASON,
            matches: v.matchIds.size,
            minutes: minutesSum,
            goals: v.goals,
            assists: v.assists,
            ga_sum: v.goals + v.assists
        };
    });
}

function getPlayerVsTeamsFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const lineup = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const nameLower = playerName.toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    // Apply main filters to matches first (same logic as other functions)
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = match[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(match['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(match['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(match['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(match['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                const cleanSheetValue = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                const extraTimeValue = normalizeStr(match['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                const penaltiesValue = normalizeStr(match['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else {
                        return recordValue === filterValue;
                    }
                }
                // Default string matching
                return normalizeStr(recordValue).toLowerCase().includes(normalizeStr(filterValue).toLowerCase());
            }
        });
    });

    // Get match IDs from filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID)));

    // Aggregate per match - filter by applied filters
    const perMatch = new Map();
    details.forEach(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return;
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return;
        }
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!matchId || !filteredMatchIds.has(matchId)) return;
        const gaVal = normalizeStr(r.GA || r.TYPE || r.ga).toUpperCase();
        if (!perMatch.has(matchId)) perMatch.set(matchId, { goals: 0, assists: 0 });
        const agg = perMatch.get(matchId);
        if (gaVal === 'GOAL') agg.goals += 1;
        if (gaVal === 'ASSIST') agg.assists += 1;
    });

    // Group by opponent team with unique matches and summed minutes - filter by applied filters
    const perOpponent = new Map(); // opp -> { matchIds:Set, matchMinutes:Map<mid,minutes>, goals, assists }
    lineup.forEach(l => {
        const p = normalizeStr(l.PLAYER || l['PLAYER NAME']).toLowerCase();
        if (p !== nameLower) return;
        // LINEUPDETAILS is Ahly-only; if team filter is set and not Ahly, skip
        if (teamLower) {
            if (normalizeTeamKey(teamFilter) !== 'ahly') return;
        }
        const mid = normalizeStr(l.MATCH_ID || l['MATCH ID'] || l.match_id);
        if (!mid || !filteredMatchIds.has(mid)) return;
        const m = filteredMatches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const opp = normalizeStr(m['OPPONENT TEAM']);
        if (!perOpponent.has(opp)) perOpponent.set(opp, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const aggOpp = perOpponent.get(opp);
        aggOpp.matchIds.add(mid);
        const mins = safeInt(l.MINTOTAL || l['MIN TOTAL'] || l.MINUTES);
        const prev = aggOpp.matchMinutes.get(mid) || 0;
        if (mins > prev) aggOpp.matchMinutes.set(mid, mins);
    });

    // Add GA per opponent using unique matchIds
    perOpponent.forEach((aggOpp, opp) => {
        aggOpp.goals = 0; aggOpp.assists = 0;
        aggOpp.matchIds.forEach(mid => {
            const ga = perMatch.get(mid) || { goals: 0, assists: 0 };
            aggOpp.goals += ga.goals;
            aggOpp.assists += ga.assists;
        });
    });

    // Ensure teams with GA-only matches (no lineup) are included with 0 matches/minutes
    const lineupMids = new Set();
    perOpponent.forEach(oppAgg => oppAgg.matchIds.forEach(mid => lineupMids.add(mid)));
    perMatch.forEach((ga, mid) => {
        if (lineupMids.has(mid)) return; // already represented by lineup
        const m = matches.find(x => normalizeStr(x.MATCH_ID || x['MATCH ID'] || x.match_id) === mid) || {};
        const opp = normalizeStr(m['OPPONENT TEAM']);
        if (!perOpponent.has(opp)) perOpponent.set(opp, { matchIds: new Set(), matchMinutes: new Map(), goals: 0, assists: 0 });
        const aggOpp = perOpponent.get(opp);
        // do not add matchIds/minutes; just add GA so the team appears
        aggOpp.goals += ga.goals || 0;
        aggOpp.assists += ga.assists || 0;
    });

    return Array.from(perOpponent.entries()).map(([OPPONENT_TEAM, v]) => {
        let minutesSum = 0;
        v.matchMinutes.forEach(min => minutesSum += (min || 0));
        return {
            OPPONENT_TEAM,
            matches: v.matchIds.size,
            minutes: minutesSum,
            goals: v.goals,
            assists: v.assists,
            ga_sum: v.goals + v.assists
        };
    });
}
function getPlayerVsGKsFromSheets(playerName, teamFilter, appliedFilters = {}) {
    // Sheets needed
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const gkRows = getSheetRowsByCandidates(['GKDETAILS']);
    const nameLower = (playerName || '').toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    if (!details.length || !gkRows.length) return [];

    // Apply main filters to matches first
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = match[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(match['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(match['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(match['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(match['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                const cleanSheetValue = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                const extraTimeValue = normalizeStr(match['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                const penaltiesValue = normalizeStr(match['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else {
                        return recordValue === filterValue;
                    }
                }
                // Default string matching
                return normalizeStr(recordValue).toLowerCase().includes(normalizeStr(filterValue).toLowerCase());
            }
        });
    });

    // Build quick map for match_id -> opponent team from filtered matches
    const matchIdToOpponent = new Map();
    filteredMatches.forEach(m => {
        const mid = normalizeStr(m.MATCH_ID || m['MATCH ID'] || m.match_id);
        const opp = normalizeStr(m['OPPONENT TEAM'] || m.OPPONENT || m['OPPONENT']);
        if (mid) matchIdToOpponent.set(mid, opp);
    });

    // Get filtered match IDs
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID)));

    // Aggregate player's goals per match with minutes - filter by applied filters
    const perMatch = new Map();
    details.forEach(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return;
        
        // Get player's team in this match
        const playerTeamInMatch = normalizeStr(r.TEAM || '');
        if (!playerTeamInMatch) return; // Skip if no team data
        
        if (teamLower) {
            if (!teamMatchesFilter(playerTeamInMatch, teamFilter)) return;
        }
        const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!mid || !filteredMatchIds.has(mid)) return;
        const ga = normalizeStr(r.GA).toUpperCase();
        const typeNorm = normalizeStr(r.TYPE).toUpperCase().replace(/[^A-Z]/g, '');
        const minute = parseInt(r.MINUTE || 0) || 0;
        
        if (!perMatch.has(mid)) perMatch.set(mid, { 
            goals: [], 
            pen_goals: [], 
            playerTeam: playerTeamInMatch 
        });
        const agg = perMatch.get(mid);
        if (ga === 'GOAL') agg.goals.push({ minute: minute, type: 'GOAL' });
        // Penalty goal can be encoded in TYPE or GA; count once
        if (typeNorm === 'PENGOAL' || ga.replace(/[^A-Z]/g,'') === 'PENGOAL') {
            agg.pen_goals.push({ minute: minute, type: 'PENGOAL' });
        }
    });

    if (perMatch.size === 0) return [];

    // For each match, identify the opponent GKs from GKDETAILS with their substitution info
    const gkPerMatch = new Map(); // mid -> goalkeeper info
    gkRows.forEach(g => {
        const mid = normalizeStr(g.MATCH_ID || g['MATCH ID'] || g.match_id);
        if (!mid) return;
        const gkName = normalizeStr(g['PLAYER NAME'] || g.PLAYER || g.player);
        const gkTeam = normalizeStr(g.TEAM || '');  // TEAM column only in GKDETAILS
        const elevenBackup = normalizeStr(g['11/BAKEUP'] || g.eleven_backup || '').toUpperCase();
        const submin = parseInt(g.SUBMIN || 0) || 0;
        
        // Skip goalkeepers with no team data
        if (!gkTeam) return;
        
        if (!gkPerMatch.has(mid)) gkPerMatch.set(mid, []);
        gkPerMatch.get(mid).push({ 
            name: gkName, 
            team: gkTeam, 
            eleven_backup: elevenBackup,
            submin: submin
        });
    });

    const totalsByGK = new Map();
    perMatch.forEach((agg, mid) => {
        const opponentGKs = gkPerMatch.get(mid) || [];
        
        // Filter to only opponent goalkeepers
        const oppTeam = matchIdToOpponent.get(mid) || '';
        const opponentTeamGKs = opponentGKs.filter(gk => 
            normalizeStr(gk.team).toLowerCase() !== normalizeStr(agg.playerTeam).toLowerCase() ||
            normalizeStr(gk.team).toLowerCase() === oppTeam.toLowerCase()
        );
        
        if (opponentTeamGKs.length === 0) return;
        
        // Process each goal
        [...agg.goals, ...agg.pen_goals].forEach(goal => {
            const goalMinute = goal.minute;
            let responsibleGK = null;
            
            if (opponentTeamGKs.length === 1) {
                // Only one goalkeeper - assign goal to them
                responsibleGK = opponentTeamGKs[0];
            } else {
                // Multiple GKs - new logic
                // Step 1: Check which GKs conceded goals
                const gksWithGoals = opponentTeamGKs.filter(gk => {
                    const goalsConceded = parseInt(gk.goals_conceded || 0);
                    return goalsConceded > 0;
                });
                
                if (gksWithGoals.length === 1) {
                    // Only one GK conceded goals - assign all goals to them
                    responsibleGK = gksWithGoals[0];
                } else if (gksWithGoals.length > 1) {
                    // Both GKs conceded goals - match by minute
                    const goalMinuteStr = goalMinute.toString().trim();
                    
                    for (const gk of opponentTeamGKs) {
                        const goalMinuteField = (gk.goal_minute || '').toString().trim();
                        if (!goalMinuteField) continue;
                        
                        // Split by # to get all goal minutes for this GK
                        const goalMinutes = goalMinuteField.split('#').map(m => m.trim());
                        
                        // Check if goal minute matches any of the GK's goal minutes
                        if (goalMinutes.includes(goalMinuteStr)) {
                            responsibleGK = gk;
                            break;
                        }
                    }
                    
                    // If no match found, don't assign to anyone (wait for GOAL MINUTE to be filled)
                    // responsibleGK stays null
                } else {
                    // No GK conceded goals (shouldn't happen if there's a goal)
                    // Fallback to first GK
                    responsibleGK = opponentTeamGKs[0];
                }
            }
            
            if (responsibleGK) {
                const key = responsibleGK.name;
                if (!totalsByGK.has(key)) totalsByGK.set(key, { GOALKEEPER_NAME: key, goals: 0, pen_goals: 0 });
                const t = totalsByGK.get(key);
                if (goal.type === 'GOAL') t.goals += 1;
                if (goal.type === 'PENGOAL') t.pen_goals += 1;
            }
        });
    });

    // Filter to only show goalkeepers who conceded goals from this player (goals > 0)
    return Array.from(totalsByGK.values())
        .filter(gk => gk.goals > 0)
        .sort((a, b) => b.goals - a.goals);
}

// Global variables for players data
let playersData = {
    players: [],
    selectedPlayer: null
};

// Global variables for goalkeepers data
let goalkeepersData = {
    goalkeepers: [],
    selectedGoalkeeper: null
};

// Global variables for all goalkeepers data
let allGoalkeepersData = {
    goalkeepers: []
};

// Statistics filters
let currentFilters = {
    season: '',
    competition: '',
    dateRange: {
        start: '',
        end: ''
    }
};

// Function to get current filter values
function getCurrentFilters() {
    const filters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        ahlyManager: document.getElementById('ahly-manager-filter')?.value || '',
        opponentManager: document.getElementById('opponent-manager-filter')?.value || '',
        referee: document.getElementById('referee-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        hAN: document.getElementById('h-a-n-filter')?.value || '',
        stadium: document.getElementById('stadium-filter')?.value || '',
        ahlyTeam: document.getElementById('ahly-team-filter')?.value || '',
        opponentTeam: document.getElementById('opponent-team-filter')?.value || '',
        goalsFor: document.getElementById('goals-for-filter')?.value || '',
        goalsAgainst: document.getElementById('goals-against-filter')?.value || '',
        result: document.getElementById('result-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        extraTime: document.getElementById('extra-time-filter')?.value || '',
        penalties: document.getElementById('penalties-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || ''
    };
    
    // Only return non-empty filters
    const activeFilters = {};
    Object.keys(filters).forEach(key => {
        if (filters[key] && filters[key] !== '') {
            activeFilters[key] = filters[key];
        }
    });
    
    console.log('Active filters:', activeFilters);
    return activeFilters;
}

// Store player data to prevent data loss when switching tabs
// Direct API calls without caching

// ============================================================================
// DIRECT API CALLS (NO CACHING)
// ============================================================================

// Generic function to make direct API calls
async function makeDirectRequest(url, options = {}) {
    // Disabled: this page operates purely from uploaded Excel
    console.warn('Direct requests are disabled in Excel-only mode:', url);
    return null;
}

// Debouncing function to prevent excessive API calls during typing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Direct API calls without caching

// ============================================================================
// GOOGLE SHEETS AUTO-SYNC FUNCTIONS
// ============================================================================

async function loadFromGoogleSheetsSync(forceRefresh = false) {
    /**
     * Load data from Google Sheets Auto-Sync API with Browser Cache
     * Cache Duration: 24 hours
     * Force refresh on manual sync
     */
    try {
        // Use browser cache with 24h TTL
        const fetchFunction = async () => {
            console.log('📡 Fetching data from Google Sheets Auto-Sync API...');
            
            const response = await fetch('/api/ahly-stats/sheets-data');
            
            if (!response.ok) {
                console.warn('⚠️ Google Sheets Auto-Sync not available');
                return null;
            }
            
            const result = await response.json();
            
            if (result.success && result.data) {
                console.log('✅ Received data from Google Sheets Auto-Sync');
                console.log('   Available sheets:', result.sheets);
                return result.data;
            } else {
                console.warn('⚠️ No data returned from Google Sheets Auto-Sync');
                return null;
            }
        };
        
        // Fetch with browser cache (24h TTL)
        const data = await fetchWithBrowserCache('al_ahly_stats', fetchFunction, forceRefresh);
        
        if (data) {
            // Store in global cache (same format as Excel upload)
            window.__ahlySheetsJson = data;
            window.__ahlyExcelMode = true;
            
            console.log('💾 Data ready');
            return true;
        } else {
            console.warn('⚠️ No data available');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error loading from Google Sheets Auto-Sync:', error);
        return false;
    }
}

async function manualSyncNow() {
    /**
     * Manually trigger sync from Google Sheets
     * Clears browser cache and forces fresh data fetch
     */
    const syncBtn = document.getElementById('sync-data-btn');
    const syncIcon = document.getElementById('sync-icon');
    const syncBtnText = document.getElementById('sync-btn-text');
    
    try {
        console.log('🔄 Triggering manual sync (clearing cache)...');
        
        // Show loading indicator on button
        if (syncBtn) {
            syncBtn.disabled = true;
            syncIcon.classList.add('spinning');
            syncBtnText.textContent = 'Syncing...';
        }
        
        // Show loading indicator
        showLoadingState(true);
        
        // Clear browser cache for this page
        const browserCache = new BrowserCache('al_ahly_stats');
        browserCache.clear();
        
        // Clear global cache
        window.__ahlySheetsJson = null;
        
        // Reload data with force refresh
        const success = await loadFromGoogleSheetsSync(true);
        
        if (success) {
            console.log('✅ Manual sync completed successfully');
            
            // Reload the page display
            await loadAlAhlyStatsData();
            
            return true;
        } else {
            throw new Error('Sync failed');
        }
        
    } catch (error) {
        console.error('❌ Manual sync failed:', error);
        alert('❌ Failed to sync data: ' + error.message);
        return false;
    } finally {
        // Hide loading indicator on button
        if (syncBtn) {
            syncBtn.disabled = false;
            syncIcon.classList.remove('spinning');
            syncBtnText.textContent = 'Sync Data';
        }
        
        showLoadingState(false);
    }
}

async function getSyncStatus() {
    /**
     * Get current sync status
     */
    try {
        const response = await fetch('/api/ahly-stats/sync-status');
        
        if (!response.ok) {
            return null;
        }
        
        const result = await response.json();
        
        if (result.success) {
            return {
                sync: result.sync,
                scheduler: result.scheduler,
                timestamp: result.timestamp
            };
        }
        
        return null;
        
    } catch (error) {
        console.error('Error getting sync status:', error);
        return null;
    }
}

async function updateSyncStatusDisplay() {
    /**
     * Update the sync status display in the UI
     */
    const status = await getSyncStatus();
    
    if (!status) {
        return;
    }
    
    const statusEl = document.getElementById('sync-status-info');
    if (!statusEl) {
        return;
    }
    
    const { sync, scheduler } = status;
    
    let statusHtml = '<div style="font-size: 0.85em; color: #666;">';
    
    if (sync.is_cached) {
        const ageMinutes = sync.age_minutes;
        const nextSyncHours = sync.next_sync_in_hours;
        
        statusHtml += `📊 Data cached ${ageMinutes} minutes ago<br>`;
        
        if (scheduler.running && nextSyncHours !== null) {
            statusHtml += `🔄 Next auto-sync in ${nextSyncHours} hours`;
        }
    } else {
        statusHtml += '⚠️ No cached data';
    }
    
    statusHtml += '</div>';
    
    statusEl.innerHTML = statusHtml;
}

// ============================================================================
// DATA LOADING FUNCTIONS
// ============================================================================

async function loadAlAhlyStatsData() {
    try {
        showLoadingState(true);
        
        // Load from Google Sheets Auto-Sync
        if (!window.__ahlySheetsJson || Object.keys(window.__ahlySheetsJson).length === 0) {
            console.log('🔄 Attempting to load from Google Sheets Auto-Sync...');
            const loaded = await loadFromGoogleSheetsSync();
            if (loaded) {
                console.log('✅ Data loaded from Google Sheets Auto-Sync!');
                // Continue with the loaded data
            }
        }
        
        // Check if we have cached data from Google Sheets
        console.log('Checking for cached Google Sheets data...');
        console.log('window.__ahlySheetsJson exists:', !!window.__ahlySheetsJson);
        console.log('window.__ahlySheetsJson keys:', window.__ahlySheetsJson ? Object.keys(window.__ahlySheetsJson) : 'none');
        
        if (window.__ahlySheetsJson && Object.keys(window.__ahlySheetsJson).length > 0) {
            console.log('Loading data from cached Google Sheets...');
            
            // Load data from cached Google Sheets
            await loadMatchDataFromSheets();
            await loadPlayerStatsFromSheets();
            await loadGoalkeeperStatsFromSheets();
            
            console.log('All Google Sheets data loaded, now updating displays...');
            console.log('Final alAhlyStatsData:', {
                totalMatches: alAhlyStatsData.totalMatches,
                wins: alAhlyStatsData.wins,
                draws: alAhlyStatsData.draws,
                losses: alAhlyStatsData.losses
            });
            
            // Update all displays
            updateOverviewStats();
            updateCharts();
            updateTables();
            calculateHowWinStats();
            
            // Load players data for search functionality
            await loadPlayersData();
            
            // Load goalkeepers data for search functionality
            await loadGoalkeepersData();
            
            // Force immediate update of overview cards
            setTimeout(() => {
                console.log('🔄 Force immediate update of overview cards...');
                const stats = {
                    totalMatches: alAhlyStatsData.totalMatches,
                    totalWins: alAhlyStatsData.wins,
                    totalDraws: alAhlyStatsData.draws,
                    totalLosses: alAhlyStatsData.losses,
                    totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                    totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
                    winRate: alAhlyStatsData.totalMatches > 0 ? ((alAhlyStatsData.wins / alAhlyStatsData.totalMatches) * 100) : 0,
                    cleanSheets: alAhlyStatsData.cleanSheets || 0,
                    cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst || 0
                };
                
                const elements = {
                    'total-matches': stats.totalMatches,
                    'total-wins': stats.totalWins,
                    'draws-with-goals': alAhlyStatsData.drawsWithGoals || 0,
                    'draws-no-goals': alAhlyStatsData.drawsNoGoals || 0,
                    'total-losses': stats.totalLosses,
                    'total-goals-for': stats.totalGoalsFor,
                    'total-goals-against': stats.totalGoalsAgainst,
                    'win-rate': parseFloat(stats.winRate.toFixed(1)) + '%',
                    'clean-sheets': stats.cleanSheets,
                    'clean-sheets-against': stats.cleanSheetsAgainst
                };
                
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                        console.log(`🚀 Immediate update ${id}: ${value}`);
                    }
                });
            }, 50);
            
        } else {
            console.log('No cached data from Google Sheets...');
        
        // Load match data
        await loadMatchData();
        
        // Load player statistics
        await loadPlayerStats();
        
        // Load goalkeeper statistics
        await loadGoalkeeperStats();
        
        // Update all displays
        updateOverviewStats();
        updateCharts();
        updateTables();
        calculateHowWinStats();
        
        // Load players data for search functionality
        await loadPlayersData();
        
        // Load goalkeepers data for search functionality
        await loadGoalkeepersData();
        }
        
    } catch (error) {
        console.error('Error loading statistics data:', error);
    } finally {
        showLoadingState(false);
    }
}

// Load data from cached Excel sheets
async function loadMatchDataFromSheets() {
    try {
        console.log('Loading match data from Excel...');
        
        // Get MATCHDETAILS from cached sheets
        const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
        
        if (matchDetails && matchDetails.length > 0) {
            alAhlyStatsData.allRecords = matchDetails;
            alAhlyStatsData.originalRecords = matchDetails; // Store original unfiltered data
            alAhlyStatsData.matches = matchDetails;
            
            console.log(`Loaded ${matchDetails.length} matches from Excel`);
            
            // Update match statistics
            alAhlyStatsData.totalMatches = matchDetails.length;
            alAhlyStatsData.wins = matchDetails.filter(m => normalizeStr(m['W-D-L']) === 'W').length;
            alAhlyStatsData.draws = matchDetails.filter(m => normalizeStr(m['W-D-L']).includes('D')).length;
            alAhlyStatsData.losses = matchDetails.filter(m => normalizeStr(m['W-D-L']) === 'L').length;
            alAhlyStatsData.totalGoalsFor = matchDetails.reduce((sum, m) => sum + (parseInt(m.GF) || 0), 0);
            alAhlyStatsData.totalGoalsAgainst = matchDetails.reduce((sum, m) => sum + (parseInt(m.GA) || 0), 0);
            alAhlyStatsData.cleanSheets = matchDetails.filter(m => parseInt(m.GA || 0) === 0).length;
            alAhlyStatsData.cleanSheetsAgainst = matchDetails.filter(m => parseInt(m.GF || 0) === 0).length;
            
            // Calculate draws with goals and draws without goals
            alAhlyStatsData.drawsWithGoals = matchDetails.filter(m => {
                const wdl = normalizeStr(m['W-D-L'] || '');
                return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG';
            }).length;
            alAhlyStatsData.drawsNoGoals = matchDetails.filter(m => {
                const wdl = normalizeStr(m['W-D-L'] || '');
                return wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
            }).length;
            
            // Rebuild filter options from Google Sheets data
            console.log('🔧 Rebuilding filter options from match records...');
            rebuildMainFilterOptionsFrom(matchDetails);
            
            console.log('Match statistics calculated:', {
                totalMatches: alAhlyStatsData.totalMatches,
                wins: alAhlyStatsData.wins,
                draws: alAhlyStatsData.draws,
                drawsWithGoals: alAhlyStatsData.drawsWithGoals,
                drawsNoGoals: alAhlyStatsData.drawsNoGoals,
                losses: alAhlyStatsData.losses,
                totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
                cleanSheets: alAhlyStatsData.cleanSheets,
                cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst
            });
        }
        
    } catch (error) {
        console.error('Error loading match data from Excel:', error);
    }
}

async function loadPlayerStatsFromSheets() {
    try {
        console.log('Loading player stats from Excel...');
        
        // Get PLAYERDETAILS from cached sheets
        const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
        
        if (playerDetails && playerDetails.length > 0) {
            // Calculate player statistics
            const playerStats = new Map();
            
            playerDetails.forEach(record => {
                const playerName = normalizeStr(record['PLAYER NAME']);
                const gaType = normalizeStr(record.GA).toUpperCase();
                
                if (!playerStats.has(playerName)) {
                    playerStats.set(playerName, {
                        name: playerName,
                        goals: 0,
                        assists: 0,
                        matches: new Set()
                    });
                }
                
                const stats = playerStats.get(playerName);
                stats.matches.add(normalizeStr(record.MATCH_ID));
                
                if (gaType === 'GOAL') {
                    stats.goals += 1;
                } else if (gaType === 'ASSIST') {
                    stats.assists += 1;
                }
            });
            
            // Convert to array and sort by goals
            alAhlyStatsData.topScorers = Array.from(playerStats.values())
                .map(p => ({
                    name: p.name,
                    goals: p.goals,
                    assists: p.assists,
                    matches: p.matches.size
                }))
                .sort((a, b) => b.goals - a.goals)
                .slice(0, 10);
            
            console.log(`Loaded ${alAhlyStatsData.topScorers.length} player stats from Excel`);
        }
        
    } catch (error) {
        console.error('Error loading player stats from Excel:', error);
    }
}

async function loadGoalkeeperStatsFromSheets() {
    try {
        console.log('Loading goalkeeper stats from Excel...');
        
        // Get GKDETAILS from cached sheets
        const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
        
        if (gkDetails && gkDetails.length > 0) {
            // Calculate goalkeeper statistics
            const gkStats = new Map();
            
            gkDetails.forEach(record => {
                const gkName = normalizeStr(record['PLAYER NAME']);
                const matchId = normalizeStr(record.MATCH_ID);
                
                if (!gkStats.has(gkName)) {
                    gkStats.set(gkName, {
                        name: gkName,
                        matches: new Set(),
                        cleanSheets: alAhlyStatsData.cleanSheets || 0,
                    cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst || 0
                    });
                }
                
                const stats = gkStats.get(gkName);
                stats.matches.add(matchId);
            });
            
            // Convert to array and sort by matches played
            alAhlyStatsData.topGoalkeepers = Array.from(gkStats.values())
                .map(gk => ({
                    name: gk.name,
                    matches: gk.matches.size,
                    cleanSheets: gk.cleanSheets
                }))
                .sort((a, b) => b.matches - a.matches)
                .slice(0, 5);
            
            console.log(`Loaded ${alAhlyStatsData.topGoalkeepers.length} goalkeeper stats from Excel`);
        }
        
    } catch (error) {
        console.error('Error loading goalkeeper stats from Excel:', error);
    }
}

async function loadMatchData() {
    try {
        // This would be an API call to get match data
        alAhlyStatsData.matches = [];
    } catch (error) {
        console.error('Error loading match data:', error);
        throw error;
    }
}

async function loadPlayerStats() {
    try {
        // This would be an API call to get player statistics
        alAhlyStatsData.players = [];
    } catch (error) {
        console.error('Error loading player statistics:', error);
        throw error;
    }
}

async function loadGoalkeeperStats() {
    try {
        // This would be an API call to get goalkeeper statistics
        alAhlyStatsData.goalkeepers = [];
    } catch (error) {
        console.error('Error loading goalkeeper statistics:', error);
        throw error;
    }
}

function loadAllPlayersFromSheets() {
    console.log('Loading all players from sheets...');
    
    const playerTeams = new Map(); // Player Name -> Set of Teams

    // Process LINEUPDETAILS first (Ahly-only)
    const lineupDetails = getSheetRowsByCandidates(['LINEUPDETAILS']);
    if (lineupDetails) {
        lineupDetails.forEach(row => {
            const playerName = normalizeStr(row['PLAYER NAME'] || row.PLAYER);
            if (playerName) {
                if (!playerTeams.has(playerName)) {
                    playerTeams.set(playerName, new Set());
                }
                playerTeams.get(playerName).add('الأهلي'); // As per user, LINEUPDETAILS implies "الأهلي"
            }
        });
    }

    // Process PLAYERDETAILS to add other teams from the specific 'TEAM' column
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    if (playerDetails) {
        playerDetails.forEach(row => {
            const playerName = normalizeStr(row['PLAYER NAME'] || row.PLAYER);
            if (playerName) {
                if (!playerTeams.has(playerName)) {
                    playerTeams.set(playerName, new Set());
                }
                // User specified the column is exactly 'TEAM'
                const teamName = normalizeStr(row.TEAM);
                if (teamName) {
                    playerTeams.get(playerName).add(teamName);
                }
            }
        });
    }

    const playersWithTeams = [];
    playerTeams.forEach((teams, name) => {
        playersWithTeams.push({ name: name, teams: Array.from(teams) });
    });
    
    playersWithTeams.sort((a, b) => a.name.localeCompare(b.name));
    
    playersData.players = playersWithTeams;
    
    console.log(`Loaded ${playersData.players.length} players with their teams from sheets.`);
    const playersWithTeamsSample = playersWithTeams.slice(0, 5);
    console.log('Sample players with teams:', JSON.stringify(playersWithTeamsSample, null, 2));
}

// ============================================================================
// BY PLAYER TAB FUNCTIONS
// ============================================================================

// This function will be called when a player is selected from the search dropdown
function setupPlayerSearch() {
    const playerSearchInput = document.getElementById('player-search-input');
    const playerSearchDropdown = document.getElementById('player-search-dropdown');
    const playerSearchResults = document.getElementById('player-search-results');

    // Load all players from sheets
    loadAllPlayersFromSheets();

    // Event listener for input changes
    playerSearchInput.addEventListener('input', debounce(handlePlayerSearchInput, 300));

    // Event listener for dropdown item click
    playerSearchDropdown.addEventListener('click', handlePlayerDropdownClick);

    // Event listener for document click to close dropdown
    document.addEventListener('click', handleDocumentClick);

    // Function to handle player search input
    function handlePlayerSearchInput(event) {
        const searchTerm = event.target.value.trim().toLowerCase();
        if (searchTerm.length < 3) {
            // Hide dropdown if search term is too short
            playerSearchDropdown.style.display = 'none';
            return;
        }

        // Filter players based on search term
        const filteredPlayers = playersData.players.filter(player =>
            player.name.toLowerCase().includes(searchTerm)
        );

        // Update dropdown with filtered players
        updatePlayerSearchDropdown(filteredPlayers);
    }

    // Function to update player search dropdown
    function updatePlayerSearchDropdown(players) {
        playerSearchResults.innerHTML = '';

        if (players.length === 0) {
            playerSearchDropdown.style.display = 'none';
            return;
        }

        players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.classList.add('dropdown-item');
            playerItem.textContent = player.name;
            playerItem.dataset.playerName = player.name;
            playerSearchResults.appendChild(playerItem);
        });

        playerSearchDropdown.style.display = 'block';
    }

    // Function to handle player dropdown click
    function handlePlayerDropdownClick(event) {
        const target = event.target;
        if (target.classList.contains('dropdown-item')) {
            const playerName = target.dataset.playerName;
            playerSearchInput.value = playerName;
            playerSearchDropdown.style.display = 'none';
            selectPlayer(playerName);
        }
    }

    // Function to handle document click to close dropdown
    function handleDocumentClick(event) {
        if (!playerSearchInput.contains(event.target) && !playerSearchDropdown.contains(event.target)) {
            playerSearchDropdown.style.display = 'none';
        }
    }

    // Function to select a player
    function selectPlayer(playerName) {
        playersData.selectedPlayer = playerName;
        updatePlayerTab();
    }

    // Function to update player tab
    function updatePlayerTab() {
        const playerTab = document.getElementById('player-tab');
        const playerNameElement = document.getElementById('player-name');
        const playerStatsElement = document.getElementById('player-stats');

        if (playersData.selectedPlayer) {
            playerTab.style.display = 'block';
            playerNameElement.textContent = playersData.selectedPlayer;
            playerStatsElement.innerHTML = '';

            // Get player stats
            const playerStats = getPlayerStats(playersData.selectedPlayer);
            if (playerStats) {
                const statsList = document.createElement('ul');
                statsList.innerHTML = `
                    <li>Goals: ${playerStats.goals}</li>
                    <li>Assists: ${playerStats.assists}</li>
                    <li>Matches: ${playerStats.matches}</li>
                `;
                playerStatsElement.appendChild(statsList);
            } else {
                playerStatsElement.textContent = 'No stats available';
            }
        } else {
            playerTab.style.display = 'none';
        }
    }

    // Function to get player stats
    function getPlayerStats(playerName) {
        // Implement this function to retrieve player stats from your data source
        // For now, returning dummy data
        return {
            goals: 10,
            assists: 5,
            matches: 20
        };
    }
}

// ============================================================================
// STATISTICS CALCULATION FUNCTIONS
// ============================================================================

function calculateOverviewStats() {
    // Prefer using raw records to avoid shape mismatches in normal mode
    const records = (alAhlyStatsData.filteredRecords && alAhlyStatsData.filteredRecords.length)
        ? alAhlyStatsData.filteredRecords
        : (alAhlyStatsData.allRecords || []);
    
    if (!Array.isArray(records) || records.length === 0) {
        // Fallback to the parsed matches path if available
        const matches = getFilteredMatches();
        const totalMatches = matches.length;
        const totalWins = matches.filter(m => m.result === 'W').length;
        const totalDraws = matches.filter(m => m.result === 'D').length;
        const totalLosses = matches.filter(m => m.result === 'L').length;
        const totalGoalsFor = matches.reduce((sum, m) => sum + (m.goalsFor || 0), 0);
        const totalGoalsAgainst = matches.reduce((sum, m) => sum + (m.goalsAgainst || 0), 0);
        const cleanSheets = matches.filter(m => (m.goalsAgainst || 0) === 0).length;
        const cleanSheetsAgainst = matches.filter(m => (m.goalsFor || 0) === 0).length;
        const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
        return {
            totalMatches,
            totalWins,
            totalDraws,
            drawsWithGoals: 0,
            drawsNoGoals: 0,
            totalLosses,
            totalGoalsFor,
            totalGoalsAgainst,
            cleanSheets,
            cleanSheetsAgainst,
            winRate
        };
    }
    
    const normalized = records.map(r => ({
        wdl: normalizeStr(r['W-D-L'] || ''),
        gf: parseInt(r['GF'] || 0) || 0,
        ga: parseInt(r['GA'] || 0) || 0
    }));
    
    const totalMatches = normalized.length;
    const totalWins = normalized.filter(r => r.wdl === 'W').length;
    const totalLosses = normalized.filter(r => r.wdl === 'L').length;
    const totalDraws = normalized.filter(r => r.wdl && r.wdl.startsWith('D')).length;
    const totalGoalsFor = normalized.reduce((s, r) => s + r.gf, 0);
    const totalGoalsAgainst = normalized.reduce((s, r) => s + r.ga, 0);
    const cleanSheets = normalized.filter(r => r.ga === 0).length; // for Ahly
    const cleanSheetsAgainst = normalized.filter(r => r.gf === 0).length; // against Ahly
    const drawsWithGoals = normalized.filter(r => r.wdl === 'D' || r.wdl === 'D WITH G' || r.wdl === 'DWITHG').length;
    const drawsNoGoals = normalized.filter(r => r.wdl === 'D.' || r.wdl === 'D WITHOUT G' || r.wdl === 'DWITHOUTG').length;
    const winRate = totalMatches > 0 ? Math.round((totalWins / totalMatches) * 100) : 0;
    
    return {
        totalMatches,
        totalWins,
        totalDraws,
        drawsWithGoals,
        drawsNoGoals,
        totalLosses,
        totalGoalsFor,
        totalGoalsAgainst,
        cleanSheets,
        cleanSheetsAgainst,
        winRate
    };
}

function getFilteredMatches() {
    let matches = [...alAhlyStatsData.matches];
    
    // Apply season filter
    if (currentFilters.season) {
        matches = matches.filter(m => m.season === currentFilters.season);
    }
    
    // Apply competition filter
    if (currentFilters.competition) {
        matches = matches.filter(m => m.competition === currentFilters.competition);
    }
    
    // Apply date range filter
    if (currentFilters.dateRange.start) {
        matches = matches.filter(m => m.date >= currentFilters.dateRange.start);
    }
    
    if (currentFilters.dateRange.end) {
        matches = matches.filter(m => m.date <= currentFilters.dateRange.end);
    }
    
    return matches;
}

// ============================================================================
// DISPLAY UPDATE FUNCTIONS
// ============================================================================

function updateOverviewStats(providedStats = null) {
    console.log('Updating overview stats...');
    
    // Use provided stats if available, otherwise use data from alAhlyStatsData or calculate
    const stats = providedStats || (alAhlyStatsData.totalMatches ? {
        totalMatches: alAhlyStatsData.totalMatches,
        totalWins: alAhlyStatsData.wins,
        totalDraws: alAhlyStatsData.draws,
        drawsWithGoals: alAhlyStatsData.drawsWithGoals || 0,
        drawsNoGoals: alAhlyStatsData.drawsNoGoals || 0,
        totalLosses: alAhlyStatsData.losses,
        totalGoalsFor: alAhlyStatsData.totalGoalsFor,
        totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
        winRate: alAhlyStatsData.totalMatches > 0 ? ((alAhlyStatsData.wins / alAhlyStatsData.totalMatches) * 100) : 0,
        cleanSheets: alAhlyStatsData.cleanSheets || 0,
        cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst || 0
    } : calculateOverviewStats());
    
    console.log('Overview stats:', stats);
    
    // Safely update stats elements (using correct HTML IDs)
    const elements = {
        'total-matches': stats.totalMatches,
        'total-wins': stats.totalWins,
        'draws-with-goals': stats.drawsWithGoals || 0,
        'draws-no-goals': stats.drawsNoGoals || 0,
        'total-losses': stats.totalLosses,
        'total-goals-for': stats.totalGoalsFor,
        'total-goals-against': stats.totalGoalsAgainst,
        'win-rate': parseFloat(stats.winRate.toFixed(1)) + '%',
        'clean-sheets': stats.cleanSheets,
        'clean-sheets-against': stats.cleanSheetsAgainst
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            console.log(`✅ Updated ${id}: ${value}`);
        } else {
            console.warn(`❌ Element with id '${id}' not found`);
        }
    });
    
    // Force update all overview cards
    console.log('Force updating overview cards...');
    setTimeout(() => {
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                console.log(`🔄 Force updated ${id}: ${value}`);
            }
        });
    }, 100);
}

function updateCharts() {
    const stats = calculateOverviewStats();
    
    // Update results chart
    if (window.resultsChart) {
        window.resultsChart.data.datasets[0].data = [stats.totalWins, stats.totalDraws, stats.totalLosses];
        window.resultsChart.update();
    }
    
    // Update goals chart
    if (window.goalsChart) {
        window.goalsChart.data.datasets[0].data = [stats.totalGoalsFor, stats.totalGoalsAgainst];
        window.goalsChart.update();
    }
    
    // Update competition chart
    updateCompetitionChart();
    
    // Update monthly chart
    updateMonthlyChart();
}

function updateCompetitionChart() {
    const matches = getFilteredMatches();
    const competitionStats = {};
    
    matches.forEach(match => {
        if (!competitionStats[match.competition]) {
            competitionStats[match.competition] = { wins: 0, total: 0 };
        }
        competitionStats[match.competition].total++;
        if (match.result === 'W') {
            competitionStats[match.competition].wins++;
        }
    });
    
    const labels = Object.keys(competitionStats);
    const data = labels.map(comp => competitionStats[comp].wins);
    
    if (window.competitionChart) {
        window.competitionChart.data.labels = labels;
        window.competitionChart.data.datasets[0].data = data;
        window.competitionChart.update();
    }
}

function updateMonthlyChart() {
    const matches = getFilteredMatches();
    const monthlyStats = {};
    
    matches.forEach(match => {
        const month = new Date(match.date).toLocaleDateString('en-US', { month: 'short' });
        if (!monthlyStats[month]) {
            monthlyStats[month] = { wins: 0, goals: 0 };
        }
        if (match.result === 'W') {
            monthlyStats[month].wins++;
        }
        monthlyStats[month].goals += match.goalsFor;
    });
    
    const labels = Object.keys(monthlyStats);
    const winsData = labels.map(month => monthlyStats[month].wins);
    const goalsData = labels.map(month => monthlyStats[month].goals);
    
    if (window.monthlyChart) {
        window.monthlyChart.data.labels = labels;
        window.monthlyChart.data.datasets[0].data = winsData;
        window.monthlyChart.data.datasets[1].data = goalsData;
        window.monthlyChart.update();
    }
}

function updateTables() {
    console.log('Updating tables...');
    updateRecentMatchesTable();
    updateTopScorersTable();
    updateGoalkeeperStatsTable();
    
    // Update all matches table if we have data
    if (alAhlyStatsData.allRecords && alAhlyStatsData.allRecords.length > 0) {
        console.log('Updating all matches table with', alAhlyStatsData.allRecords.length, 'matches');
        loadAllMatches(alAhlyStatsData.allRecords);
    }
}

function updateRecentMatchesTable() {
    const matches = getFilteredMatches()
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10);
    
    const tbody = document.querySelector('#recent-matches-table tbody');
    if (!tbody) {
        console.warn('recent-matches-table tbody not found, skipping table update');
        return;
    }
    tbody.innerHTML = '';
    
    matches.forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${match.date}</td>
            <td>${match.competition}</td>
            <td>${match.opponent}</td>
            <td>${match.venue}</td>
            <td>${match.result}</td>
            <td>${match.score}</td>
            <td><span class="badge badge-${match.result === 'W' ? 'success' : match.result === 'D' ? 'warning' : 'danger'}">${match.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

function updateTopScorersTable() {
    const players = alAhlyStatsData.players
        .sort((a, b) => b.goals - a.goals)
        .slice(0, 10);
    
    const tbody = document.querySelector('#top-scorers-table tbody');
    if (!tbody) {
        console.warn('top-scorers-table tbody not found, skipping table update');
        return;
    }
    tbody.innerHTML = '';
    
    players.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.name}</td>
            <td>${player.goals}</td>
            <td>${player.assists}</td>
            <td>${player.matches}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateGoalkeeperStatsTable() {
    const goalkeepers = alAhlyStatsData.goalkeepers
        .sort((a, b) => b.matches - a.matches);
    
    const tbody = document.querySelector('#goalkeeper-stats-table tbody');
    if (!tbody) {
        console.warn('goalkeeper-stats-table tbody not found, skipping table update');
        return;
    }
    tbody.innerHTML = '';
    
    goalkeepers.forEach(gk => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${gk.name}</td>
            <td>${gk.matches}</td>
            <td>${gk.cleanSheets}</td>
            <td>${gk.goalsConceded}</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// FILTER FUNCTIONS
// ============================================================================

function applyFilters() {
    // Get filter values
    currentFilters.season = document.getElementById('season-filter').value;
    currentFilters.competition = document.getElementById('competition-filter').value;
    
    // Update all displays with filtered data
    updateOverviewStats();
    updateCharts();
    updateTables();
    calculateHowWinStats();
}

function clearFilters() {
    // Reset filter values
    currentFilters.season = '';
    currentFilters.competition = '';
    currentFilters.dateRange = { start: '', end: '' };
    
    // Reset filter controls
    document.getElementById('season-filter').value = '';
    document.getElementById('competition-filter').value = '';
    
    // Update displays with all data
    updateOverviewStats();
    updateCharts();
    updateTables();
}


// ============================================================================
// CHART INITIALIZATION
// ============================================================================

function initializeCharts() {
    // Results Chart
    const resultsChartElement = document.getElementById('resultsChart');
    if (!resultsChartElement) {
        console.warn('resultsChart element not found, skipping chart initialization');
        return;
    }
    const resultsCtx = resultsChartElement.getContext('2d');
    window.resultsChart = new Chart(resultsCtx, {
        type: 'doughnut',
        data: {
            labels: ['Wins', 'Draws', 'Losses'],
            datasets: [{
                data: [32, 8, 5],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Goals Chart
    const goalsCtx = document.getElementById('goalsChart').getContext('2d');
    window.goalsChart = new Chart(goalsCtx, {
        type: 'bar',
        data: {
            labels: ['Goals For', 'Goals Against'],
            datasets: [{
                label: 'Goals',
                data: [89, 34],
                backgroundColor: ['#667eea', '#dc3545'],
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    // Competition Chart
    const competitionCtx = document.getElementById('competitionChart').getContext('2d');
    window.competitionChart = new Chart(competitionCtx, {
        type: 'polarArea',
        data: {
            labels: ['Premier League', 'Champions League', 'Egypt Cup', 'Super Cup'],
            datasets: [{
                data: [15, 8, 4, 2],
                backgroundColor: ['#667eea', '#28a745', '#ffc107', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    // Monthly Chart
    const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
    window.monthlyChart = new Chart(monthlyCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Wins',
                data: [5, 4, 6, 5, 7, 3],
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4
            }, {
                label: 'Goals For',
                data: [12, 8, 15, 11, 18, 9],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function showLoadingState(show) {
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        if (show) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                <span>Loading...</span>
            `;
        } else {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
                </svg>
                <span>Sync Data</span>
            `;
        }
    }
}

// Calculate HOW WIN statistics for Al Ahly
function calculateHowWinStats() {
    // Initialize counters
    const stats = {
        leadWon: 0,
        leadDrew: 0,
        leadLost: 0,
        comebackWon: 0,
        comebackDrew: 0,
        behindLost: 0
    };
    
    // Get filtered matches
    const filteredMatches = alAhlyStatsData.filteredRecords || alAhlyStatsData.allRecords || [];
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID || m['MATCH ID']));
    
    // Get player details
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    if (!playerDetails || playerDetails.length === 0) {
        updateHowWinUI(stats, 0);
        return;
    }
    
    // First pass: Check which matches have ANY unknown minutes
    const matchesWithUnknownMinutes = new Set();
    
    playerDetails.forEach(detail => {
        const matchId = detail['MATCH_ID'] || detail['MATCH ID'];
        const minute = detail['MINUTE'];
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) {
            return;
        }
        
        // Mark match if it has unknown minute
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
    
    playerDetails.forEach(detail => {
        const matchId = detail['MATCH_ID'] || detail['MATCH ID'];
        const minute = detail['MINUTE'];
        const ga = normalizeStr(detail.GA || '').toUpperCase();
        const playerTeam = normalizeStr(detail.TEAM || detail['AHLY TEAM'] || '');
        
        // Skip if not a goal
        if (ga !== 'GOAL') return;
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) return;
        
        // Skip ENTIRE match if it has ANY unknown minutes
        if (matchesWithUnknownMinutes.has(matchId)) return;
        
        // Skip if minute contains "?" or "؟"
        const minuteStr = String(minute || '');
        if (!minute || minuteStr.includes('?') || minuteStr.includes('؟')) return;
        
        if (!matchGoals[matchId]) {
            matchGoals[matchId] = [];
        }
        
        // Parse minute (handle 90+5 format)
        let minuteValue = 0;
        if (String(minute).includes('+')) {
            const parts = String(minute).split('+');
            minuteValue = parseInt(parts[0]) + parseInt(parts[1]) / 100; // 90+5 = 90.05
        } else {
            minuteValue = parseInt(minute);
        }
        
        // Determine if it's Ahly or opponent
        const isAhly = playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly' || playerTeam.toLowerCase().includes('ahly');
        
        matchGoals[matchId].push({
            minute: minuteValue,
            isAhly: isAhly,
            matchId: matchId
        });
    });
    
    // Process each match
    Object.keys(matchGoals).forEach(matchId => {
        const goals = matchGoals[matchId];
        
        // Sort goals by minute
        goals.sort((a, b) => a.minute - b.minute);
        
        if (goals.length === 0) return;
        
        // First goal determines who scored first
        const firstGoal = goals[0];
        const ahlyScoredFirst = firstGoal.isAhly;
        
        // Get match result
        const match = filteredMatches.find(m => (m.MATCH_ID || m['MATCH ID']) === matchId);
        if (!match) return;
        
        const result = normalizeStr(match['W-D-L'] || '');
        
        // Determine stats based on first scorer and result
        if (ahlyScoredFirst) {
            // Ahly scored first
            if (result === 'W') {
                stats.leadWon++;
            } else if (result === 'D' || result === 'D.') {
                stats.leadDrew++;
            } else if (result === 'L') {
                stats.leadLost++;
            }
        } else {
            // Opponent scored first (Ahly was behind)
            if (result === 'W') {
                stats.comebackWon++;
            } else if (result === 'D' || result === 'D.') {
                stats.comebackDrew++;
            } else if (result === 'L') {
                stats.behindLost++;
            }
        }
    });
    
    // Update UI
    updateHowWinUI(stats, matchesWithUnknownMinutes.size);
    
    // Calculate and update opponents stats
    calculateOpponentsHowWinStats();
}

// Update HOW WIN UI for Al Ahly
function updateHowWinUI(stats, excludedCount) {
    const elements = {
        'lead-won': stats.leadWon,
        'lead-drew': stats.leadDrew,
        'lead-lost': stats.leadLost,
        'comeback-won': stats.comebackWon,
        'comeback-drew': stats.comebackDrew,
        'behind-lost': stats.behindLost
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || 0;
        }
    });
    
    const excludedElement = document.getElementById('how-win-excluded-count');
    if (excludedElement) {
        excludedElement.textContent = excludedCount || 0;
    }
}
// Calculate HOW WIN statistics for Opponents
function calculateOpponentsHowWinStats() {
    // Initialize counters
    const stats = {
        leadWon: 0,
        leadDrew: 0,
        leadLost: 0,
        comebackWon: 0,
        comebackDrew: 0,
        behindLost: 0
    };
    
    // Get filtered matches
    const filteredMatches = alAhlyStatsData.filteredRecords || alAhlyStatsData.allRecords || [];
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID || m['MATCH ID']));
    
    // Get player details
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    if (!playerDetails || playerDetails.length === 0) {
        updateOpponentsHowWinUI(stats, 0);
        return;
    }
    
    // First pass: Check which matches have ANY unknown minutes
    const matchesWithUnknownMinutes = new Set();
    
    playerDetails.forEach(detail => {
        const matchId = detail['MATCH_ID'] || detail['MATCH ID'];
        const minute = detail['MINUTE'];
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) {
            return;
        }
        
        // Mark match if it has unknown minute
        const minuteStr = String(minute || '').trim();
        const isUnknown = !minute || 
                          minute === '' || 
                          minuteStr === '?' || 
                          minuteStr === '؟' ||
                          minuteStr.includes('?') || 
                          minuteStr.includes('؟') ||
                          minuteStr.toLowerCase() === 'unknown';
        
        if (isUnknown) {
            matchesWithUnknownMinutes.add(matchId);
        }
    });
    
    // Second pass: Group goals by match ID (ONLY for matches with ALL known minutes)
    const matchGoals = {};
    
    playerDetails.forEach(detail => {
        const matchId = detail['MATCH_ID'] || detail['MATCH ID'];
        const minute = detail['MINUTE'];
        const ga = normalizeStr(detail.GA || '').toUpperCase();
        const playerTeam = normalizeStr(detail.TEAM || detail['AHLY TEAM'] || '');
        
        // Skip if not a goal
        if (ga !== 'GOAL') return;
        
        // Skip if match is not in filtered matches
        if (!filteredMatchIds.has(matchId)) return;
        
        // Skip ENTIRE match if it has ANY unknown minutes
        if (matchesWithUnknownMinutes.has(matchId)) return;
        
        // Skip if minute contains "?" or "؟"
        const minuteStr = String(minute || '');
        if (!minute || minuteStr.includes('?') || minuteStr.includes('؟')) return;
        
        if (!matchGoals[matchId]) {
            matchGoals[matchId] = [];
        }
        
        // Parse minute (handle 90+5 format)
        let minuteValue = 0;
        if (String(minute).includes('+')) {
            const parts = String(minute).split('+');
            minuteValue = parseInt(parts[0]) + parseInt(parts[1]) / 100;
        } else {
            minuteValue = parseInt(minute);
        }
        
        // Determine if it's Ahly or opponent
        const isAhly = playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly' || playerTeam.toLowerCase().includes('ahly');
        
        matchGoals[matchId].push({
            minute: minuteValue,
            isAhly: isAhly,
            matchId: matchId
        });
    });
    
    // Process each match (from opponent perspective)
    Object.keys(matchGoals).forEach(matchId => {
        const goals = matchGoals[matchId];
        
        // Sort goals by minute
        goals.sort((a, b) => a.minute - b.minute);
        
        if (goals.length === 0) return;
        
        // First goal determines who scored first
        const firstGoal = goals[0];
        const opponentScoredFirst = !firstGoal.isAhly; // Opponent scored first if Ahly didn't
        
        // Get match result
        const match = filteredMatches.find(m => (m.MATCH_ID || m['MATCH ID']) === matchId);
        if (!match) return;
        
        const result = normalizeStr(match['W-D-L'] || '');
        
        // Convert Al Ahly result to opponent result
        let opponentResult = result;
        if (result === 'W') opponentResult = 'L'; // Ahly won = Opponent lost
        else if (result === 'L') opponentResult = 'W'; // Ahly lost = Opponent won
        // Draw stays as 'D'
        
        // Determine stats based on first scorer and result (from opponent perspective)
        if (opponentScoredFirst) {
            // Opponent scored first
            if (opponentResult === 'W') {
                stats.leadWon++;
            } else if (opponentResult === 'D' || opponentResult === 'D.') {
                stats.leadDrew++;
            } else if (opponentResult === 'L') {
                stats.leadLost++;
            }
        } else {
            // Ahly scored first (opponent was behind)
            if (opponentResult === 'W') {
                stats.comebackWon++;
            } else if (opponentResult === 'D' || opponentResult === 'D.') {
                stats.comebackDrew++;
            } else if (opponentResult === 'L') {
                stats.behindLost++;
            }
        }
    });
    
    // Update UI
    updateOpponentsHowWinUI(stats, matchesWithUnknownMinutes.size);
}
// Update HOW WIN UI for Opponents
function updateOpponentsHowWinUI(stats, excludedCount) {
    const elements = {
        'opp-lead-won': stats.leadWon,
        'opp-lead-drew': stats.leadDrew,
        'opp-lead-lost': stats.leadLost,
        'opp-comeback-won': stats.comebackWon,
        'opp-comeback-drew': stats.comebackDrew,
        'opp-behind-lost': stats.behindLost
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || 0;
        }
    });
    
    const excludedElement = document.getElementById('opponents-how-win-excluded-count');
    if (excludedElement) {
        excludedElement.textContent = excludedCount || 0;
    }
}

// Show HOW WIN sub-tab
function showHowWinSubTab(event, subtabName) {
    // Hide all sub-tab contents
    const subtabContents = document.querySelectorAll('#how-win-tab .stats-subtab-content');
    subtabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all sub-tab buttons
    const subtabButtons = document.querySelectorAll('#how-win-tab .stats-subtab');
    subtabButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected sub-tab content
    const selectedContent = document.getElementById(subtabName);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Add active class to clicked button
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
}

function initializeAlAhlyStats() {
    console.log('Al Ahly Statistics Module Initialized');
    
    // Load initial data
    loadAlAhlyStatsData();
    
    // Initialize charts
    initializeCharts();
    
    // Add event listeners
    const filterBtn = document.querySelector('.filter-btn');
    if (filterBtn) {
        filterBtn.addEventListener('click', applyFilters);
    }
    
    const refreshBtn = document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshStats);
    }
    
    // Add auto-filter event listeners to all filter inputs
    addAutoFilterListeners();
    
    // Setup All Players team filter
    setupAllPlayersFilter();
    
    // Setup Variety Goals team filter
    setupVarietyGoalsFilter();
    
    // Setup Penalty Details team filter
    setupPenaltyDetailsFilter();
    
    // Setup Coaches team filter
        setupCoachesFilter();
        setupAllGoalkeepersFilter();
}

function addAutoFilterListeners() {
    // Auto-filtering disabled - filters only apply when "Apply Filters" button is clicked
    // Initialize custom searchable dropdowns like Data Entry app
    if (typeof initializeSearchableFilters === 'function') {
        initializeSearchableFilters();
    }
}

// Excel: build players list from PLAYERDATABASE (name + teams)
function getPlayersListFromSheets() {
    console.log('Getting players list from Excel (PLAYERDATABASE)...');
    const rows = getSheetRowsByCandidates(['PLAYERDATABASE']);
    console.log(`Found ${rows.length} player database rows`);
    
    const playersMap = new Map();
    rows.forEach(r => {
        const name = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player);
        if (!name) return;
        const team = normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team);
        if (!playersMap.has(name)) playersMap.set(name, new Set());
        if (team) playersMap.get(name).add(team);
    });
    
    const playersList = Array.from(playersMap.entries()).map(([name, teamSet]) => ({
        name,
        teams: Array.from(teamSet).sort()
    })).sort((a,b) => a.name.localeCompare(b.name));
    
    console.log(`Built players list with ${playersList.length} unique players`);
    return playersList;
}

async function loadPlayersData() {
    console.log('🔄 Loading players from Excel (PLAYERDATABASE)...');
    playersData.players = getPlayersListFromSheets();
    initializePlayerSearch();
    initializeTeamFilter();
}

// Initialize player search functionality
function initializePlayerSearch() {
    const searchInput = document.getElementById('player-search');
    const searchOptions = document.getElementById('player-search-options');
    
    if (!searchInput || !searchOptions) return;
    
    let isOpen = false;
    
    // Input event for search
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        if (query.length === 0) {
            searchOptions.style.display = 'none';
            isOpen = false;
            return;
        }
        
        // Filter players based on query
        const filteredPlayers = playersData.players.filter(player => 
            player.name.toLowerCase().includes(query)
        );
        
        if (filteredPlayers.length === 0) {
            searchOptions.innerHTML = '<div class="option-item no-results">No players found</div>';
        } else {
            searchOptions.innerHTML = filteredPlayers.map((player, index) => {
                // Find original index in playersData.players
                const originalIndex = playersData.players.findIndex(p => p.name === player.name);
                return `<div class="option-item" data-player-index="${originalIndex}">${player.name}</div>`;
            }).join('');
        }
        
        searchOptions.style.display = 'block';
        isOpen = true;
    });
    
    // Click on options
    searchOptions.addEventListener('click', function(e) {
        if (e.target.classList.contains('option-item') && !e.target.classList.contains('no-results')) {
            try {
                const playerIndex = parseInt(e.target.getAttribute('data-player-index'));
                if (!isNaN(playerIndex) && playersData.players[playerIndex]) {
                    const playerData = playersData.players[playerIndex];
                    
                    // Update UI first before loading data
                    searchInput.value = playerData.name;
                    searchOptions.style.display = 'none';
                    isOpen = false;
                    
                    // Then load player data
                    selectPlayer(playerData);
                }
            } catch (error) {
                console.error('❌ Error selecting player:', error);
                searchOptions.style.display = 'none';
                isOpen = false;
            }
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchOptions.contains(e.target)) {
            searchOptions.style.display = 'none';
            isOpen = false;
        }
    });
    
    // Focus event
    searchInput.addEventListener('focus', function() {
        if (this.value.length > 0) {
            searchOptions.style.display = 'block';
            isOpen = true;
        }
    });
}

// Function to select a player and populate teams dropdown
function selectPlayer(player) {
    console.log('🎯 Player selected:', player);
    console.log('📝 Player name:', player.name);
    console.log('🏟️ Player teams:', player.teams);
    
    // Load data directly from API
    playersData.selectedPlayer = player;
    
    // Update teams checkboxes (replaces old dropdown)
    const teamContainer = document.getElementById('player-team-filter');
    if (teamContainer) {
        console.log('🔄 Updating team filter checkboxes...');
        teamContainer.innerHTML = '';
        if (player.teams && player.teams.length > 0) {
            const sortedTeams = [...player.teams].sort();
            sortedTeams.forEach(team => {
                const id = `team-cb-${team.replace(/\s+/g,'-')}`;
                const label = document.createElement('label');
                label.innerHTML = `<input type="checkbox" class="team-filter-checkbox" id="${id}" value="${team}"> <span>${team}</span>`;
                teamContainer.appendChild(label);
            });
            
            // Add event listeners to the new checkboxes
            teamContainer.querySelectorAll('input.team-filter-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', applyPlayerTeamFilter);
            });
            teamContainer.removeAttribute('disabled');
        } else {
            console.log('⚠️ Player has no teams');
            teamContainer.innerHTML = '<div style="text-align: center; color: #9ca3af; font-style: italic;">No teams available</div>';
            teamContainer.setAttribute('disabled', '');
        }
    }
    
    console.log(`✅ Selected player: ${player.name}, Teams: ${player.teams ? player.teams.join(', ') : 'No teams'}`);
    
    // Load player overview statistics first
    console.log('🔄 Loading player overview stats...');
    loadPlayerOverviewStats(player.name);
    
    // Load player trophies
    loadPlayerTrophies(player.name, '');
    
    // Apply team filter (will show all teams initially)
    applyPlayerTeamFilter();
}

// Function to load ALL player data in one API call
async function loadAllPlayerData(playerName) {
    console.log(`Loading ALL data for player: ${playerName}`);
    
    try {
        const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
        const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';
        
        const data = null; // API removed; using Excel instead
        
        if (data.error) {
            console.error('Error loading all player data:', data.error);
            // Error loading player data
            return;
        }
        
        
        // Update all tabs with the data
        updateAllPlayerTabs(data);
        console.log('ALL player data loaded successfully');
        
    } catch (error) {
        console.error('Error fetching all player data:', error);
        // Error loading player data
    }
}

// Function to update all player tabs with data
function updateAllPlayerTabs(data) {
    // Update overview stats
    if (data.overview_stats && !data.overview_stats.error) {
        updatePlayerOverviewCards(data.overview_stats);
    }
    
    // Update matches
    if (data.matches && data.matches.length > 0) {
        // Store matches data
        renderPlayerMatchesTable(data.matches);
    }
    
    // Update championships
    if (data.championships && data.championships.length > 0) {
        // Store championships data
        renderPlayerChampionshipsTable(data.championships);
    }
    
    // Update seasons
    if (data.seasons && data.seasons.length > 0) {
        // Store seasons data
        renderPlayerSeasonsTable(data.seasons);
    }
    
    // Update vs teams
    if (data.vs_teams && data.vs_teams.length > 0) {
        // Store vs teams data
        renderPlayerVsTeamsTable(data.vs_teams);
    }
    
    // Update vs goalkeepers
    if (data.vs_goalkeepers && data.vs_goalkeepers.length > 0) {
        // Store vs goalkeepers data
        renderPlayerVsGKsTable(data.vs_goalkeepers);
    }
}

// Initialize team filter functionality
function initializeTeamFilter() {
    const container = document.getElementById('player-team-filter');
    if (!container) return;
    if (container.tagName && container.tagName.toUpperCase() === 'SELECT') {
        container.addEventListener('change', function() { applyPlayerTeamFilter(); });
        return;
    }
    container.addEventListener('change', function(e) {
        if (e.target && e.target.classList && e.target.classList.contains('team-filter-checkbox')) {
            applyPlayerTeamFilter();
        }
    });
}

// Apply player team filter
function getSelectedPlayerTeams() {
    const container = document.getElementById('player-team-filter');
    if (!container) return [];
    if (container.tagName && container.tagName.toUpperCase() === 'SELECT') {
        const v = container.value || '';
        return v ? [v] : [];
    }
    const checked = Array.from(container.querySelectorAll('input.team-filter-checkbox:checked'));
    return checked.map(cb => cb.value);
}

function applyPlayerTeamFilter() {
    const selectedTeams = getSelectedPlayerTeams();
    
    // Load data directly from API when team filter changes
    
    // Update all player statistics based on selected team
    updatePlayerStatisticsForTeam(selectedTeams);
    // Reload the overview cards with team filter applied
    if (playersData.selectedPlayer && playersData.selectedPlayer.name) {
        loadPlayerOverviewWithFilter(selectedTeams);
        // Reload trophies with team filter
        loadPlayerTrophies(playersData.selectedPlayer.name, selectedTeams);
        
        // Reload current active sub-tab with team filter
        const currentSubTab = getCurrentPlayerSubTab();
        if (currentSubTab) {
            console.log(`🔄 Reloading sub-tab: ${currentSubTab} with team filter`);
            loadPlayerSubTabData(currentSubTab, selectedTeams);
        }
    }
    
    console.log(`Filtering player statistics for teams: ${selectedTeams.join(', ') || 'All Teams'}`);
}

// Update player statistics based on selected team
function updatePlayerStatisticsForTeam(selectedTeams) {
    if (!playersData.selectedPlayer) {
        // If no player selected, load default data
        loadPlayerOverview();
        return;
    }
    
    // Here you would filter the actual data based on selectedTeam
    // For now, we'll just reload the current tab with filtered data
    const currentSubTab = getCurrentPlayerSubTab();
    if (currentSubTab) {
        loadPlayerSubTabData(currentSubTab, selectedTeams);
    }
}

// Get current active player sub-tab
function getCurrentPlayerSubTab() {
    const activeTab = document.querySelector('.player-sub-tab-content.active');
    if (activeTab) {
        return activeTab.id.replace('player-', '').replace('-sub', '');
    }
    return 'overview';
}

// Load player sub-tab data with team filtering
function loadPlayerSubTabData(subTabName, selectedTeams = null) {
    // This function will be called when team filter changes
    // It will reload the current sub-tab data with team filtering applied
    
    switch(subTabName) {
        case 'overview':
            loadPlayerOverviewWithFilter(selectedTeams);
            break;
        case 'matches':
            loadPlayerMatchesWithFilter(selectedTeams);
            break;
        case 'championships':
            loadPlayerChampionshipsWithFilter(selectedTeams);
            break;
        case 'seasons':
            loadPlayerSeasonsWithFilter(selectedTeams);
            break;
        case 'vs-teams':
            loadPlayerVsTeamsWithFilter(selectedTeams);
            break;
        case 'vs-gks':
            loadPlayerVsGKsWithFilter(selectedTeams);
            break;
        case 'goal-details':
            loadPlayerGoalDetailsWithFilter(selectedTeams);
            break;
        case 'assist-details':
            loadPlayerAssistDetailsWithFilter(selectedTeams);
            break;
        case 'with-coaches':
            loadPlayerWithCoachesWithFilter(selectedTeams);
            break;
        case 'trophies':
            if (playersData.selectedPlayer && playersData.selectedPlayer.name) {
                // For trophies, ignore team filter - always show Al Ahly trophies only
                loadPlayerTrophies(playersData.selectedPlayer.name, '');
            }
            break;
    }
}

// New function to load data from API and update filters
function loadAlAhlyStats() {
    // If Excel mode is active, do not call server; use uploaded data
    if (window.__ahlyExcelMode && Array.isArray(alAhlyStatsData.allRecords) && alAhlyStatsData.allRecords.length >= 0) {
        console.log('📄 Using uploaded Excel data for Al Ahly stats');
        // Rebuild filter options and refresh UI from current in-memory data
        updateFilterOptions();
        // Derive overview from existing records
        const records = alAhlyStatsData.allRecords || [];
        const totalMatches = records.length;
        const totalWins = records.filter(r => normalizeStr(r['W-D-L'] || '') === 'W').length;
        const totalDraws = records.filter(r => {
            const wdl = normalizeStr(r['W-D-L'] || '');
            return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG' || wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
        }).length;
        const totalLosses = records.filter(r => normalizeStr(r['W-D-L'] || '') === 'L').length;
        const totalGoalsFor = records.reduce((s, r) => s + (parseInt(r['GF'] || 0)), 0);
        const totalGoalsAgainst = records.reduce((s, r) => s + (parseInt(r['GA'] || 0)), 0);
        const cleanSheets = records.filter(r => parseInt(r['GA'] || 0) === 0).length;
        const cleanSheetsAgainst = records.filter(r => parseInt(r['GF'] || 0) === 0).length;
        const drawsWithGoals = records.filter(r => {
            const wdl = normalizeStr(r['W-D-L'] || '');
            return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG';
        }).length;
        const drawsNoGoals = records.filter(r => {
            const wdl = normalizeStr(r['W-D-L'] || '');
            return wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
        }).length;
        const winRate = totalMatches > 0 ? parseFloat(((totalWins / totalMatches) * 100).toFixed(1)) : 0;

        // Store in alAhlyStatsData for later use
        alAhlyStatsData.drawsWithGoals = drawsWithGoals;
        alAhlyStatsData.drawsNoGoals = drawsNoGoals;
        alAhlyStatsData.totalMatches = totalMatches;
        alAhlyStatsData.wins = totalWins;
        alAhlyStatsData.draws = totalDraws;
        alAhlyStatsData.losses = totalLosses;
        alAhlyStatsData.totalGoalsFor = totalGoalsFor;
        alAhlyStatsData.totalGoalsAgainst = totalGoalsAgainst;
        alAhlyStatsData.cleanSheets = cleanSheets;
        alAhlyStatsData.cleanSheetsAgainst = cleanSheetsAgainst;

        updateOverviewStats({
            totalMatches,
            totalWins,
            totalDraws,
            drawsWithGoals,
            drawsNoGoals,
            totalLosses,
            totalGoalsFor,
            totalGoalsAgainst,
            cleanSheets,
            cleanSheetsAgainst,
            winRate
        });
        loadAllMatches(records);
        if (typeof loadPlayerOverview === 'function') loadPlayerOverview();
        if (typeof loadTopPerformers === 'function') loadTopPerformers();
        if (typeof loadGoalkeeperStats === 'function') loadGoalkeeperStats();
        loadH2HTeamsData();
        loadCoachesData();
        loadRefereesData();
        loadAllRefereesData();
        loadAllGoalkeepersData();
        loadAllPlayersData();
        if (typeof addAutoFilterListeners === 'function') setTimeout(() => addAutoFilterListeners(), 100);
        return;
    }
    // EMERGENCY: Check if we can make this request
    if (!canMakeRequest()) {
        console.warn('🚫 Skipping loadAlAhlyStats - request throttled');
        return;
    }
    
    console.log('🔄 Loading Al Ahly stats...');
    if (window.__ahlyExcelMode) {
        const data = {
            filter_options: alAhlyStatsData.filterOptions,
            all_records: alAhlyStatsData.allRecords,
            recent_matches: (alAhlyStatsData.allRecords || []).slice(-10),
            total_matches: (alAhlyStatsData.allRecords || []).length,
            total_wins: (alAhlyStatsData.allRecords || []).filter(r => r['W-D-L'] === 'W').length,
            total_draws: (alAhlyStatsData.allRecords || []).filter(r => ['D','D WITH G','D.'].includes(r['W-D-L'])).length,
            total_losses: (alAhlyStatsData.allRecords || []).filter(r => r['W-D-L'] === 'L').length,
            total_goals_for: (alAhlyStatsData.allRecords || []).reduce((s,r)=> s + (parseInt(r['GF']||0)), 0),
            total_goals_against: (alAhlyStatsData.allRecords || []).reduce((s,r)=> s + (parseInt(r['GA']||0)), 0),
            clean_sheets: (alAhlyStatsData.allRecords || []).filter(r => parseInt(r['GA']||0) === 0).length
        };
        
        // Store data globally
        alAhlyStatsData.filterOptions = data.filter_options || {};
        alAhlyStatsData.allRecords = data.all_records || [];
        alAhlyStatsData.matches = data.recent_matches || [];
        
        // Rebuild filter options from Google Sheets data
        console.log('🔧 Rebuilding filter options from records...');
        rebuildMainFilterOptionsFrom(data.all_records);
        
        // Update filter dropdowns
        updateFilterOptions();
        
        const drawsWithGoals = data.all_records.filter(r => {
            const wdl = normalizeStr(r['W-D-L'] || '');
            return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG';
        }).length;
        const drawsNoGoals = data.all_records.filter(r => {
            const wdl = normalizeStr(r['W-D-L'] || '');
            return wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
        }).length;
        const winRate = data.total_matches > 0 ? parseFloat((data.total_wins / data.total_matches * 100).toFixed(1)) : 0;
        
        updateOverviewStats({
            totalMatches: data.total_matches,
            totalWins: data.total_wins,
            totalDraws: data.total_draws,
            drawsWithGoals: drawsWithGoals,
            drawsNoGoals: drawsNoGoals,
            totalLosses: data.total_losses,
            totalGoalsFor: data.total_goals_for,
            totalGoalsAgainst: data.total_goals_against,
            cleanSheets: data.clean_sheets,
            cleanSheetsAgainst: (data.all_records || []).filter(r => parseInt(r['GF']||0) === 0).length,
            winRate: winRate
        });
        
        loadAllMatches(data.all_records);
        loadPlayerOverview();
        loadTopPerformers();
        loadGoalkeeperStats();
        setTimeout(() => { addAutoFilterListeners(); }, 100);
        
        return;
    }
    
    // Not in Excel mode: do not fetch
    console.warn('Excel not loaded; skipping server fetch.');
    return;
        
    // In Excel mode we avoid network calls for lists; keep as-is otherwise
    // In this page, players/gks lists must come from Excel-only mode; do nothing otherwise
}

// EMERGENCY: Throttle filter updates to prevent excessive calls
let filterUpdateThrottle = {
    lastUpdate: 0,
    minInterval: 1000, // Minimum 1 second between filter updates
    pendingUpdate: false
};

function updateFilterOptions() {
    const now = Date.now();
    
    // If an update is already pending or too soon, skip
    if (filterUpdateThrottle.pendingUpdate || now - filterUpdateThrottle.lastUpdate < filterUpdateThrottle.minInterval) {
        console.log('🚫 Skipping filter update - throttled');
        return;
    }
    
    filterUpdateThrottle.pendingUpdate = true;
    filterUpdateThrottle.lastUpdate = now;
    
    console.log('🔄 Updating filter options...');
    
    const options = alAhlyStatsData.filterOptions;
    
    // Update Champion System dropdown
    updateSelectOptions('champion-system-filter', options.champion_systems || []);
    
    // Update Champion dropdown
    updateSelectOptions('champion-filter', options.champions || []);
    
    // Update Season dropdown
    updateSelectOptions('season-filter', options.seasons || []);
    
    filterUpdateThrottle.pendingUpdate = false;
    
    // Update Ahly Manager dropdown
    updateSelectOptions('ahly-manager-filter', options.ahly_managers || []);
    
    // Update Opponent Manager dropdown
    updateSelectOptions('opponent-manager-filter', options.opponent_managers || []);
    
    // Update Referee dropdown
    updateSelectOptions('referee-filter', options.referees || []);
    
    // Update Round dropdown
    updateSelectOptions('round-filter', options.rounds || []);
    
    // Update H-A-N dropdown
    updateSelectOptions('h-a-n-filter', options.h_a_n_options || []);
    
    // Update Stadium dropdown
    updateSelectOptions('stadium-filter', options.stadiums || []);
    
    // Update Ahly Team dropdown
    updateSelectOptions('ahly-team-filter', options.ahly_teams || []);
    
    // Update Opponent Team dropdown
    updateSelectOptions('opponent-team-filter', options.opponent_teams || []);
    
    // Update Result dropdown
    updateSelectOptions('result-filter', options.results || []);
    
    // Update Clean Sheet dropdown
    updateSelectOptions('clean-sheet-filter', options.clean_sheets || []);
    
    // Update Extra Time dropdown
    updateSelectOptions('extra-time-filter', options.extra_time || []);
    
    // Update Penalties dropdown
    updateSelectOptions('penalties-filter', options.penalties || []);
    
    // Initialize custom searchable inputs on all dropdowns
    initializeSearchableFilters();
}

function updateSelectOptions(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    
    // Keep the first option (All/Empty)
    const firstOption = select.options[0];
    
    // Clear all options except the first
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    // Add new options
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}
// Build custom searchable selects similar to AHLY MATCH UX
function initializeSearchableFilters() {
    const selects = document.querySelectorAll('.filter-field select');
    selects.forEach(select => {
        makeSelectSearchable(select);
    });
}
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
            if (idx === 0) return; // skip placeholder
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
                    // Trigger change for filter logic
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

function refreshSearchableForSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const container = select.closest('.searchable-select-container');
    if (container) {
        const input = container.querySelector('input');
        if (input) {
            // Update input to show current selection
            const selectedOption = select.options[select.selectedIndex];
            input.value = selectedOption && selectedOption.value ? selectedOption.text : '';
        }
    } else {
        makeSelectSearchable(select);
    }
}

function updateAllSearchableInputs() {
    const selects = document.querySelectorAll('.filter-field select[data-searchable="true"]');
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
function updateFilterOptionsFromFilteredData(filteredRecords) {
    // Extract unique values for filters from filtered data
    function getUniqueValuesFromFiltered(columnName) {
        const values = new Set();
        filteredRecords.forEach(record => {
            const value = record[columnName];
            if (value && String(value).trim()) {
                values.add(String(value).trim());
            }
        });
        return Array.from(values).sort();
    }
    
    // Update each filter dropdown based on filtered data
    const filteredOptions = {
        'champion-system-filter': getUniqueValuesFromFiltered('CHAMPION SYSTEM'),
        'champion-filter': getUniqueValuesFromFiltered('CHAMPION'),
        'season-filter': getUniqueValuesFromFiltered('SEASON'),
        'ahly-manager-filter': getUniqueValuesFromFiltered('AHLY MANAGER'),
        'opponent-manager-filter': getUniqueValuesFromFiltered('OPPONENT MANAGER'),
        'referee-filter': getUniqueValuesFromFiltered('REFREE'),
        'round-filter': getUniqueValuesFromFiltered('ROUND'),
        'h-a-n-filter': getUniqueValuesFromFiltered('H-A-N'),
        'stadium-filter': getUniqueValuesFromFiltered('STAD'),
        'ahly-team-filter': getUniqueValuesFromFiltered('AHLY TEAM'),
        'opponent-team-filter': getUniqueValuesFromFiltered('OPPONENT TEAM'),
        'result-filter': getUniqueValuesFromFiltered('W-D-L')
    };
    
    // Update each dropdown while preserving current selections
    Object.keys(filteredOptions).forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        const options = filteredOptions[selectId];
        
        // Only update if there are new options and current selection is still valid
        if (currentValue && options.includes(currentValue)) {
            // Current selection is still valid, no need to update this dropdown
            return;
        }
        
        // Keep the first option (All/Empty)
        const firstOption = select.options[0];
        
        // Clear all options except the first
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
        
        // Restore previous selection if it still exists
        if (currentValue && options.includes(currentValue)) {
            select.value = currentValue;
        } else if (currentValue && currentValue !== '') {
            // Keep the current selection even if not in filtered options
            // This prevents clearing user selections
            const optionElement = document.createElement('option');
            optionElement.value = currentValue;
            optionElement.textContent = currentValue;
            optionElement.selected = true;
            select.appendChild(optionElement);
        }
        
        // Refresh custom searchable wrapper
        refreshSearchableForSelect(select.id);
    });
}

function updateFilterOptionsWithPreservedSelections(filteredRecords, preservedFilters) {
    // Extract unique values for filters from filtered data
    function getUniqueValuesFromFiltered(columnName) {
        const values = new Set();
        filteredRecords.forEach(record => {
            const value = record[columnName];
            if (value && String(value).trim()) {
                values.add(String(value).trim());
            }
        });
        return Array.from(values).sort();
    }
    
    // Update each filter dropdown based on filtered data
    const filteredOptions = {
        'champion-system-filter': getUniqueValuesFromFiltered('CHAMPION SYSTEM'),
        'champion-filter': getUniqueValuesFromFiltered('CHAMPION'),
        'season-filter': getUniqueValuesFromFiltered('SEASON'),
        'ahly-manager-filter': getUniqueValuesFromFiltered('AHLY MANAGER'),
        'opponent-manager-filter': getUniqueValuesFromFiltered('OPPONENT MANAGER'),
        'referee-filter': getUniqueValuesFromFiltered('REFREE'),
        'round-filter': getUniqueValuesFromFiltered('ROUND'),
        'h-a-n-filter': getUniqueValuesFromFiltered('H-A-N'),
        'stadium-filter': getUniqueValuesFromFiltered('STAD'),
        'ahly-team-filter': getUniqueValuesFromFiltered('AHLY TEAM'),
        'opponent-team-filter': getUniqueValuesFromFiltered('OPPONENT TEAM'),
        'result-filter': getUniqueValuesFromFiltered('W-D-L')
    };
    
    // Update each dropdown while preserving user selections
    Object.keys(filteredOptions).forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const preservedValue = preservedFilters[selectId];
        const options = filteredOptions[selectId];
        
        // Keep the first option (All/Empty)
        const firstOption = select.options[0];
        
        // Clear all options except the first
        select.innerHTML = '';
        select.appendChild(firstOption);
        
        // Add new options
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            select.appendChild(optionElement);
        });
        
        // Always restore the preserved selection
        if (preservedValue && preservedValue !== '') {
            // Check if the preserved value exists in current options
            if (options.includes(preservedValue)) {
                select.value = preservedValue;
            } else {
                // Add the preserved value as an option and select it
                const optionElement = document.createElement('option');
                optionElement.value = preservedValue;
                optionElement.textContent = preservedValue;
                optionElement.selected = true;
                select.appendChild(optionElement);
            }
        }
        
        // Refresh custom searchable wrapper
        refreshSearchableForSelect(select.id);
    });
}

// Debounced version of applyFilters to prevent excessive calls
const debouncedApplyFilters = debounce(function() {
    // Get all filter values
    const filters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        ahlyManager: document.getElementById('ahly-manager-filter')?.value || '',
        opponentManager: document.getElementById('opponent-manager-filter')?.value || '',
        referee: document.getElementById('referee-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        hAN: document.getElementById('h-a-n-filter')?.value || '',
        stadium: document.getElementById('stadium-filter')?.value || '',
        ahlyTeam: document.getElementById('ahly-team-filter')?.value || '',
        goalsFor: document.getElementById('goals-for-filter')?.value || '',
        goalsAgainst: document.getElementById('goals-against-filter')?.value || '',
        opponentTeam: document.getElementById('opponent-team-filter')?.value || '',
        result: document.getElementById('result-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        extraTime: document.getElementById('extra-time-filter')?.value || '',
        penalties: document.getElementById('penalties-filter')?.value || ''
    };
    
    // Load data directly from API when filters change
    
    applyFiltersWithData(filters);
    
    // Update H2H T Details if it's currently active
    const currentActiveTab = document.querySelector('.stats-tab.active');
    if (currentActiveTab && currentActiveTab.getAttribute('onclick') && currentActiveTab.getAttribute('onclick').includes('h2h-t-details')) {
        console.log('🔄 H2H T Details tab is active, updating with new filters');
        const currentFilteredRecords = getCurrentFilteredRecords();
        if (currentFilteredRecords && currentFilteredRecords.length > 0) {
            loadH2HTDetailsTeamsWithFilteredData(currentFilteredRecords);
            // Update currently selected team stats if any
            updateCurrentH2HTDetailsWithFilters(currentFilteredRecords);
        } else {
            loadH2HTDetailsTeams();
        }
    }
}, 300); // Wait 300ms after user stops changing filters

function getCurrentFilteredRecords() {
    // Get all current filter values
    const filters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        ahlyManager: document.getElementById('ahly-manager-filter')?.value || '',
        opponentManager: document.getElementById('opponent-manager-filter')?.value || '',
        referee: document.getElementById('referee-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        hAN: document.getElementById('h-a-n-filter')?.value || '',
        stadium: document.getElementById('stadium-filter')?.value || '',
        ahlyTeam: document.getElementById('ahly-team-filter')?.value || '',
        opponentTeam: document.getElementById('opponent-team-filter')?.value || '',
        result: document.getElementById('result-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        extraTime: document.getElementById('extra-time-filter')?.value || '',
        penalties: document.getElementById('penalties-filter')?.value || ''
    };
    
    // Check if any filters are active
    const hasActiveFilters = Object.values(filters).some(value => value !== '');
    
    // If no filters active, return null (use all records)
    if (!hasActiveFilters) {
        return null;
    }
    
    // Filter records based on current filter values
    const filteredRecords = alAhlyStatsData.allRecords.filter(record => {
        return Object.keys(filters).every(key => {
            const filterValue = filters[key];
            if (!filterValue) return true;
            
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET',
                'penalties': 'PEN'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true;
            
            const recordValue = record[recordKey] || '';
            
            if (key === 'dateFrom') {
                return new Date(record['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(record['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'result') {
                if (filterValue === 'D WITH G') {
                    return recordValue === 'D WITH G';
                } else if (filterValue === 'D.') {
                    return recordValue === 'D.';
                } else if (filterValue === 'D') {
                    return recordValue === 'D' || recordValue === 'D WITH G' || recordValue === 'D.';
                } else {
                    return recordValue.toString().toLowerCase().includes(filterValue.toLowerCase());
                }
            } else {
                return recordValue.toString().toLowerCase().includes(filterValue.toLowerCase());
            }
        });
    });
    
    return filteredRecords;
}

function applyFilters() {
    // EMERGENCY: Check if we can make this request
    if (!canMakeRequest()) {
        console.warn('🚫 Skipping applyFilters - request throttled');
        return;
    }
    
    console.log('🔄 Applying filters...');
    debouncedApplyFilters();
    
    // Update H2H T Details if it's currently active
    const currentActiveTab = document.querySelector('.stats-tab.active');
    if (currentActiveTab && currentActiveTab.getAttribute('onclick') && currentActiveTab.getAttribute('onclick').includes('h2h-t-details')) {
        console.log('🔄 H2H T Details tab is active, updating with new filters');
        const currentFilteredRecords = getCurrentFilteredRecords();
        if (currentFilteredRecords && currentFilteredRecords.length > 0) {
            loadH2HTDetailsTeamsWithFilteredData(currentFilteredRecords);
        } else {
            loadH2HTDetailsTeams();
        }
    }
}

function applyFiltersWithPreservedSelections(preservedFilters) {
    // Get all filter values
    const filters = {
        matchId: document.getElementById('match-id-filter')?.value || '',
        championSystem: document.getElementById('champion-system-filter')?.value || '',
        dateFrom: document.getElementById('date-from-filter')?.value || '',
        dateTo: document.getElementById('date-to-filter')?.value || '',
        champion: document.getElementById('champion-filter')?.value || '',
        season: document.getElementById('season-filter')?.value || '',
        ahlyManager: document.getElementById('ahly-manager-filter')?.value || '',
        opponentManager: document.getElementById('opponent-manager-filter')?.value || '',
        referee: document.getElementById('referee-filter')?.value || '',
        round: document.getElementById('round-filter')?.value || '',
        hAN: document.getElementById('h-a-n-filter')?.value || '',
        stadium: document.getElementById('stadium-filter')?.value || '',
        ahlyTeam: document.getElementById('ahly-team-filter')?.value || '',
        goalsFor: document.getElementById('goals-for-filter')?.value || '',
        goalsAgainst: document.getElementById('goals-against-filter')?.value || '',
        opponentTeam: document.getElementById('opponent-team-filter')?.value || '',
        result: document.getElementById('result-filter')?.value || '',
        cleanSheet: document.getElementById('clean-sheet-filter')?.value || '',
        extraTime: document.getElementById('extra-time-filter')?.value || '',
        penalties: document.getElementById('penalties-filter')?.value || ''
    };
    
    applyFiltersWithData(filters, preservedFilters);
}

function applyFiltersWithData(filters, preservedFilters = null) {
    // Filter records based on applied filters
    const filteredRecords = alAhlyStatsData.allRecords.filter(record => {
        return Object.keys(filters).every(key => {
            const filterValue = filters[key];
            if (!filterValue) return true; // Skip empty filters
            
            // Map filter keys to record keys
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET',
                'penalties': 'PEN'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true; // Skip unmapped filters
            
            const recordValue = record[recordKey] || '';
            
            // Special handling for different filter types
            if (key === 'goalsFor') {
                return parseInt(record['GF'] || 0) >= parseInt(filterValue);
            } else if (key === 'goalsAgainst') {
                return parseInt(record['GA'] || 0) <= parseInt(filterValue);
            } else if (key === 'dateFrom') {
                return new Date(record['DATE'] || '') >= new Date(filterValue);
            } else if (key === 'dateTo') {
                return new Date(record['DATE'] || '') <= new Date(filterValue);
            } else if (key === 'cleanSheet') {
                // Use actual CLEAN SHEET column from Excel
                const cleanSheetValue = normalizeStr(record['CLEAN SHEET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return cleanSheetValue === filterNormalized || cleanSheetValue.includes(filterNormalized);
            } else if (key === 'extraTime') {
                // Use actual ET column from Excel
                const extraTimeValue = normalizeStr(record['ET'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return extraTimeValue === filterNormalized || extraTimeValue.includes(filterNormalized);
            } else if (key === 'penalties') {
                // Use actual PEN column from Excel
                const penaltiesValue = normalizeStr(record['PEN'] || '').toUpperCase();
                const filterNormalized = normalizeStr(filterValue).toUpperCase();
                return penaltiesValue === filterNormalized || penaltiesValue.includes(filterNormalized);
            } else {
                // Handle special cases for result filter
                if (key === 'result') {
                    if (filterValue === 'D WITH G') {
                        return recordValue === 'D WITH G';
                    } else if (filterValue === 'D.') {
                        return recordValue === 'D.';
                    } else if (filterValue === 'D') {
                        // Show all draws (including D WITH G and D.)
                        return recordValue === 'D' || recordValue === 'D WITH G' || recordValue === 'D.';
                    } else {
                        return recordValue.toString().toLowerCase().includes(filterValue.toLowerCase());
                    }
                } else {
                    return recordValue.toString().toLowerCase().includes(filterValue.toLowerCase());
                }
            }
        });
    });
    
    // Store filtered records for HOW WIN and other features
    alAhlyStatsData.filteredRecords = filteredRecords;
    
    // Update displays with filtered data
    updateFilteredStats(filteredRecords);
    loadRecentMatches(filteredRecords.slice(-10)); // Show last 10 filtered matches
    
    // Update filter options based on filtered data (but preserve user selections)
    if (preservedFilters) {
        updateFilterOptionsWithPreservedSelections(filteredRecords, preservedFilters);
    } else {
        updateFilterOptionsFromFilteredData(filteredRecords);
    }
    
    // Update player and goalkeeper stats based on filtered data
    updatePlayerStatsFromFilteredData(filteredRecords);
    
    // Update player statistics with current filters
    if (playersData.selectedPlayer && playersData.selectedPlayer.name) {
        loadPlayerMatches();
        loadPlayerSeasonsStats();
        loadPlayerChampionshipsStats();
        loadPlayerVsTeamsStats();
        loadPlayerVsGKsStats();
    }
    
    // Update goalkeeper statistics with current filters
    if (goalkeepersData.selectedGoalkeeper && goalkeepersData.selectedGoalkeeper.name) {
        const teamFilter = document.getElementById('gk-team-filter') ? document.getElementById('gk-team-filter').value : '';
        loadGKOverviewStats(goalkeepersData.selectedGoalkeeper.name, teamFilter);
        loadGKMatches(teamFilter);
        loadGKChampionships(teamFilter);
        loadGKSeasons(teamFilter);
        loadGKVsTeams(teamFilter);
        loadGKVsPlayers(teamFilter);
    }
    
    // Update H2H Teams data with current filters
    loadH2HTeamsData(filteredRecords);
    
    // Update Coaches data with current filters
        loadCoachesData(filteredRecords);
    
    // Update All Referees data with current filters
    loadAllRefereesData(filteredRecords);
    
    // Update All Goalkeepers data with current filters
    loadAllGoalkeepersData(filteredRecords);
    
    // Update All Players data with current filters
    loadAllPlayersData(filteredRecords);
    
    // Update Variety Goals data if the tab is active
    const varietyGoalsSubtab = document.getElementById('variety-goals-subtab');
    if (varietyGoalsSubtab && varietyGoalsSubtab.classList.contains('active')) {
        loadVarietyGoalsData(filteredRecords);
    }
    
    // Update Penalty Details data if the tab is active
    const penaltyDetailsSubtab = document.getElementById('penalty-details-subtab');
    if (penaltyDetailsSubtab && penaltyDetailsSubtab.classList.contains('active')) {
        loadPenaltyDetailsData(filteredRecords);
    }
    
    // Update tab content to show filtered results
    updateAllTabsWithFilteredData(filteredRecords);
    
    // Update all searchable inputs to show current selections
    updateAllSearchableInputs();
    
    // Update HOW WIN stats
    calculateHowWinStats();
    
    showSuccess(`Filtered ${filteredRecords.length} matches`);
}

function updateFilteredStats(filteredRecords) {
    // Recalculate statistics based on filtered records
    const totalMatches = filteredRecords.length;
    const totalWins = filteredRecords.filter(r => normalizeStr(r['W-D-L'] || '') === 'W').length;
    const totalDraws = filteredRecords.filter(r => {
        const wdl = normalizeStr(r['W-D-L'] || '');
        return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG' || wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
    }).length;
    
    // Calculate draws with goals and draws without goals - exact count from W-D-L column
    const drawsWithGoals = filteredRecords.filter(r => {
        const wdl = normalizeStr(r['W-D-L'] || '');
        return wdl === 'D' || wdl === 'D WITH G' || wdl === 'DWITHG';
    }).length;
    const drawsNoGoals = filteredRecords.filter(r => {
        const wdl = normalizeStr(r['W-D-L'] || '');
        return wdl === 'D.' || wdl === 'D WITHOUT G' || wdl === 'DWITHOUTG';
    }).length;
    
    const totalLosses = filteredRecords.filter(r => normalizeStr(r['W-D-L'] || '') === 'L').length;
    
    const totalGoalsFor = filteredRecords.reduce((sum, r) => sum + (parseInt(r['GF'] || 0)), 0);
    const totalGoalsAgainst = filteredRecords.reduce((sum, r) => sum + (parseInt(r['GA'] || 0)), 0);
    
    const cleanSheets = filteredRecords.filter(r => parseInt(r['GA'] || 0) === 0).length;
    const cleanSheetsAgainst = filteredRecords.filter(r => parseInt(r['GF'] || 0) === 0).length;
    const winRate = totalMatches > 0 ? parseFloat((totalWins / totalMatches * 100).toFixed(1)) : 0;
    
    updateOverviewStats({
        totalMatches,
        totalWins,
        totalDraws,
        drawsWithGoals,
        drawsNoGoals,
        totalLosses,
        totalGoalsFor,
        totalGoalsAgainst,
        cleanSheets,
        cleanSheetsAgainst,
        winRate
    });
}

function updatePlayerStatsFromFilteredData(filteredRecords) {
    // This function would analyze filtered matches to calculate player statistics
    // For now, we'll use the sample data but in a real implementation,
    // you would analyze the filtered matches to get actual player stats
    
    console.log(`Updating player stats for ${filteredRecords.length} filtered matches`);
    
    // Example: Calculate top scorers from filtered matches
    // This is a simplified example - in reality you'd need player data from another sheet
    const filteredTopScorers = [
        ['Player A', Math.floor(Math.random() * 10) + 1, Math.floor(Math.random() * 8) + 1, filteredRecords.length],
        ['Player B', Math.floor(Math.random() * 8) + 1, Math.floor(Math.random() * 6) + 1, filteredRecords.length - 2],
        ['Player C', Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 4) + 1, filteredRecords.length - 5]
    ];

    const tbody = document.querySelector('#top-scorers-table tbody');
    if (tbody) {
        tbody.innerHTML = '';
        filteredTopScorers.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${player[0]}</td>
                <td>${player[1]}</td>
                <td>${player[2]}</td>
                <td>${player[3]}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    // Update goalkeeper stats similarly
    const filteredGKStats = [
        ['GK A', filteredRecords.length, Math.floor(Math.random() * 5), Math.floor(Math.random() * 3)],
        ['GK B', Math.floor(filteredRecords.length * 0.7), Math.floor(Math.random() * 3), Math.floor(Math.random() * 2)]
    ];

    const gkTbody = document.querySelector('#goalkeeper-stats-table tbody');
    if (gkTbody) {
        gkTbody.innerHTML = '';
        filteredGKStats.forEach(gk => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${gk[0]}</td>
                <td>${gk[1]}</td>
                <td>${gk[2]}</td>
                <td>${gk[3]}</td>
            `;
            gkTbody.appendChild(row);
        });
    }
}

function updateAllTabsWithFilteredData(filteredRecords) {
    // Update tab headers to show filtered count
    const overviewTab = document.querySelector('[onclick*="overview"]');
    const matchHistoryTab = document.querySelector('[onclick*="matches"]');
    const playerStatsTab = document.querySelector('[onclick*="players"]');
    const gkStatsTab = document.querySelector('[onclick*="gk"]');
    
    // Don't update tab names with counts - keep original tab names
    
    // Update Match History table with filtered data
    loadAllMatches(filteredRecords);
    
    // Update any other tab-specific content based on filtered data
    console.log(`Updated all tabs with ${filteredRecords.length} filtered matches`);
}
function clearFilters() {
    console.log('Clearing all filters...');
    
    // Clear all filter inputs
    const filterInputs = document.querySelectorAll('.filter-field input, .filter-field select');
    filterInputs.forEach(input => {
        input.value = '';
    });
    
    // Also clear specific filter elements by ID
    const specificFilters = [
        'match-id-filter', 'champion-system-filter', 'champion-filter', 'season-filter',
        'ahly-manager-filter', 'opponent-manager-filter', 'referee-filter', 'round-filter',
        'h-a-n-filter', 'stadium-filter', 'ahly-team-filter', 'opponent-team-filter',
        'goals-for-filter', 'goals-against-filter', 'result-filter', 'clean-sheet-filter',
        'extra-time-filter', 'penalties-filter', 'date-from-filter', 'date-to-filter'
    ];
    
    specificFilters.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            element.value = '';
            console.log(`✅ Cleared filter: ${filterId}`);
        }
    });
    
    // Reset current filters object
    currentFilters = {
        season: '',
        competition: '',
        dateRange: {
            start: '',
            end: ''
        }
    };
    
    console.log('Filters cleared, reloading data...');
    
    // Reload original data without filters
    loadAlAhlyStats();
    
    // Force reload all data from cache to show unfiltered results
    if (window.__ahlySheetsJson && Object.keys(window.__ahlySheetsJson).length > 0) {
        console.log('Reloading unfiltered data from cache...');
        
        // Use original unfiltered data if available, otherwise get fresh from cache
        const matchDetails = alAhlyStatsData.originalRecords.length > 0 ? 
            alAhlyStatsData.originalRecords : 
            getSheetRowsByCandidates(['MATCHDETAILS']);
        
        if (matchDetails && matchDetails.length > 0) {
            console.log(`Restoring ${matchDetails.length} original unfiltered matches`);
            
            // Update alAhlyStatsData with original unfiltered data
            alAhlyStatsData.allRecords = matchDetails;
            alAhlyStatsData.matches = matchDetails;
            
            // Recalculate statistics with fresh data
            alAhlyStatsData.totalMatches = matchDetails.length;
            alAhlyStatsData.wins = matchDetails.filter(m => normalizeStr(m['W-D-L']) === 'W').length;
            alAhlyStatsData.draws = matchDetails.filter(m => normalizeStr(m['W-D-L']).includes('D')).length;
            alAhlyStatsData.losses = matchDetails.filter(m => normalizeStr(m['W-D-L']) === 'L').length;
            alAhlyStatsData.totalGoalsFor = matchDetails.reduce((sum, m) => sum + (parseInt(m.GF) || 0), 0);
            alAhlyStatsData.totalGoalsAgainst = matchDetails.reduce((sum, m) => sum + (parseInt(m.GA) || 0), 0);
            alAhlyStatsData.cleanSheets = matchDetails.filter(m => parseInt(m.GA || 0) === 0).length;
            alAhlyStatsData.cleanSheetsAgainst = matchDetails.filter(m => parseInt(m.GF || 0) === 0).length;
            
            console.log('Fresh unfiltered statistics:', {
                totalMatches: alAhlyStatsData.totalMatches,
                wins: alAhlyStatsData.wins,
                draws: alAhlyStatsData.draws,
                losses: alAhlyStatsData.losses,
                totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
                cleanSheets: alAhlyStatsData.cleanSheets,
                cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst
            });
            
            // Force immediate update of overview cards with fresh unfiltered data
            setTimeout(() => {
                console.log('🔄 Force updating overview cards with fresh unfiltered data...');
                const stats = {
                    totalMatches: alAhlyStatsData.totalMatches,
                    totalWins: alAhlyStatsData.wins,
                    totalDraws: alAhlyStatsData.draws,
                    totalLosses: alAhlyStatsData.losses,
                    totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                    totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
                    winRate: alAhlyStatsData.totalMatches > 0 ? ((alAhlyStatsData.wins / alAhlyStatsData.totalMatches) * 100) : 0,
                    cleanSheets: alAhlyStatsData.cleanSheets || 0,
                    cleanSheetsAgainst: alAhlyStatsData.cleanSheetsAgainst || 0
                };
                
                // Update H2H T Details if it's currently active
                const currentActiveTab = document.querySelector('.stats-tab.active');
                if (currentActiveTab && currentActiveTab.getAttribute('onclick') && currentActiveTab.getAttribute('onclick').includes('h2h-t-details')) {
                    console.log('🔄 H2H T Details tab is active, updating with cleared filters');
                    // Reload teams with all data (no filters)
                    loadH2HTDetailsTeams();
                    // Update currently selected team stats if any
                    const searchInput = document.getElementById('h2h-t-details-team-search');
                    if (searchInput && searchInput.value.trim()) {
                        const selectedTeam = searchInput.value.trim();
                        console.log(`Updating H2H stats for ${selectedTeam} with cleared filters`);
                        loadH2HTDetailsData(selectedTeam);
                    }
                }
                
                const elements = {
                    'total-matches': stats.totalMatches,
                    'total-wins': stats.totalWins,
                    'draws-with-goals': alAhlyStatsData.drawsWithGoals || 0,
                    'draws-no-goals': alAhlyStatsData.drawsNoGoals || 0,
                    'total-losses': stats.totalLosses,
                    'total-goals-for': stats.totalGoalsFor,
                    'total-goals-against': stats.totalGoalsAgainst,
                    'win-rate': parseFloat(stats.winRate.toFixed(1)) + '%',
                    'clean-sheets': stats.cleanSheets,
                    'clean-sheets-against': stats.cleanSheetsAgainst
                };
                
                Object.entries(elements).forEach(([id, value]) => {
                    const element = document.getElementById(id);
                    if (element) {
                        element.textContent = value;
                        console.log(`🚀 Fresh update ${id}: ${value}`);
                    } else {
                        console.warn(`❌ Element ${id} not found`);
                    }
                });
            }, 50);
            
            // Update all displays with fresh unfiltered data
            updateOverviewStats();
            updateCharts();
            updateTables();
            
            // Rebuild main filter options from unfiltered data
            rebuildMainFilterOptionsFrom(matchDetails);

            // Update match count badge
            const matchCountBadge = document.getElementById('match-count-badge');
            if (matchCountBadge && alAhlyStatsData.totalMatches) {
                matchCountBadge.textContent = `${alAhlyStatsData.totalMatches} matches`;
            }
            
            // Update all matches table with fresh unfiltered data
            loadAllMatches(matchDetails);
        }
    }
    
    // Reload players data from cached sheets
    console.log('Reloading players data from cached sheets...');
    loadPlayersData();
    
    // Reload goalkeepers data from cached sheets
    console.log('Reloading goalkeepers data from cached sheets...');
    loadGoalkeepersData();
    
    // Update goalkeeper statistics with cleared filters
    if (goalkeepersData.selectedGoalkeeper && goalkeepersData.selectedGoalkeeper.name) {
        console.log('Updating goalkeeper stats with cleared filters...');
        loadGKOverviewStats(goalkeepersData.selectedGoalkeeper.name);
        loadGKChampionships();
    }
    
    // Update player statistics with cleared filters
    if (playersData.selectedPlayer && playersData.selectedPlayer.name) {
        console.log('Updating player stats with cleared filters...');
        loadPlayerMatches();
        loadPlayerSeasonsStats();
        loadPlayerChampionshipsStats();
        loadPlayerVsTeamsStats();
        loadPlayerVsGKsStats();
    }
    
    // Update H2H Teams data with unfiltered data
    loadH2HTeamsData();
    
    // Update Coaches data with unfiltered data
    loadCoachesData();
    
    // Update All Goalkeepers data with unfiltered data
    loadAllGoalkeepersData();
    
    // Update All Players data with unfiltered data
    loadAllPlayersData();
    
    // Final force update after everything is cleared
    setTimeout(() => {
        console.log('🔄 Final force update of all displays...');
        
        // Force update overview stats one more time
        if (alAhlyStatsData.totalMatches > 0) {
            const stats = {
                totalMatches: alAhlyStatsData.totalMatches,
                totalWins: alAhlyStatsData.wins,
                totalDraws: alAhlyStatsData.draws,
                totalLosses: alAhlyStatsData.losses,
                totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst,
                winRate: alAhlyStatsData.totalMatches > 0 ? ((alAhlyStatsData.wins / alAhlyStatsData.totalMatches) * 100) : 0,
                cleanSheets: (alAhlyStatsData.allRecords || []).filter(r => parseInt(r['GA'] || 0) === 0).length
            };
            
            const elements = {
                'total-matches': stats.totalMatches,
                'total-wins': stats.totalWins,
                'draws-with-goals': alAhlyStatsData.drawsWithGoals || 0,
                'draws-no-goals': alAhlyStatsData.drawsNoGoals || 0,
                'total-losses': stats.totalLosses,
                'total-goals-for': stats.totalGoalsFor,
                'total-goals-against': stats.totalGoalsAgainst,
                'win-rate': parseFloat(stats.winRate.toFixed(1)) + '%',
                'clean-sheets': stats.cleanSheets
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                    console.log(`🎯 Final update ${id}: ${value}`);
                }
            });
        }
    }, 200);
    
    console.log('All filters cleared and data reloaded');
}
// loadAllData removed per product decision; intentionally no-op if referenced

function refreshStats() {
    // Load data directly from API when refreshing
    
    // Get the refresh button
    const refreshButton = document.querySelector('.refresh-btn');
    if (!refreshButton) return;
    
    // Disable button and show loading state
    refreshButton.disabled = true;
    const originalText = refreshButton.innerHTML;
    refreshButton.innerHTML = `
        <svg class="icon loading" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
        </svg>
        Refreshing...
    `;
    
    // Add spinning animation
    refreshButton.style.opacity = '0.7';
    refreshButton.style.cursor = 'not-allowed';
    
    if (window.__ahlyExcelMode) {
        loadAlAhlyStats();
        refreshButton.disabled = false;
        refreshButton.innerHTML = originalText;
        refreshButton.style.opacity = '1';
        refreshButton.style.cursor = 'pointer';
        return;
    }
    
    // In non-Excel mode do nothing
    refreshButton.disabled = false;
    refreshButton.innerHTML = originalText;
    refreshButton.style.opacity = '1';
    refreshButton.style.cursor = 'pointer';
}

// Check data status on page load - removed as endpoint doesn't exist
function checkDataStatus() {
    // Data status check removed - not needed for direct Google Sheets integration
}

function loadRecentMatches(matches = []) {
    const tbody = document.querySelector('#recent-matches-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (!matches || matches.length === 0) {
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 7;
        td.textContent = 'No matches available';
        td.style.textAlign = 'center';
        td.style.color = '#666';
        row.appendChild(td);
        tbody.appendChild(row);
        return;
    }

    matches.forEach(match => {
        const row = document.createElement('tr');

        // Format the data based on the actual Google Sheets structure
        const date = match.DATE || match.Date || match.date || 'N/A';
        const competition = match.CHAMPION || match.Competition || match.competition || 'N/A';
        const opponent = match['OPPONENT TEAM'] || match.Opponent || match.opponent || 'N/A';
        const venue = match['H-A-N'] || match.Venue || match.venue || 'N/A';
        const result = match['W-D-L'] || match.result || 'N/A';
        const score = `${match.GF || match.goals_for || 0}-${match.GA || match.goals_against || 0}`;
        const status = match.Status || match.status || 'Completed';

        // Format date if it's a string
        let formattedDate = date;
        if (date && date !== 'N/A') {
            try {
                const dateObj = new Date(date);
                if (!isNaN(dateObj.getTime())) {
                    formattedDate = dateObj.toLocaleDateString();
                }
            } catch (e) {
                // Keep original date if formatting fails
            }
        }

        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${competition}</td>
            <td>${opponent}</td>
            <td>${venue}</td>
            <td>${result}</td>
            <td>${score}</td>
            <td><span class="badge badge-${result === 'W' ? 'success' : result === 'D' ? 'warning' : 'danger'}">${status}</span></td>
        `;

        tbody.appendChild(row);
    });
}

function loadAllMatches(allRecords) {
    const tableBody = document.querySelector('#all-matches-table tbody');
    const matchCountBadge = document.getElementById('match-count-badge');
    if (!tableBody || !allRecords) return;

    tableBody.innerHTML = '';

    // Sort matches by date (newest first) with robust Excel/date parsing
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseAnyDate(val) {
        const s = String(val || '').trim();
        const d1 = Date.parse(s);
        if (!isNaN(d1)) return d1;
        const m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) return new Date(yr, mon, day).getTime();
        }
        const num = Number(s);
        if (!isNaN(num) && s !== '') return new Date((num - 25569) * 86400 * 1000).getTime();
        return 0;
    }

    const sortedMatches = [...allRecords].sort((a, b) => parseAnyDate(b.DATE) - parseAnyDate(a.DATE));

    sortedMatches.forEach(match => {
        const row = document.createElement('tr');
        
        // Format date for display (keep sheet string or format Excel serial)
        let formattedDate = String(match.DATE || '').trim();
        if (/^\d+(\.\d+)?$/.test(formattedDate)) {
            const t = new Date((Number(formattedDate) - 25569) * 86400 * 1000);
            const dd = String(t.getDate()).padStart(2, '0');
            const MMM = Object.keys(monthMap)[t.getMonth()];
            const yyyy = t.getFullYear();
            formattedDate = `${dd}-${MMM}-${yyyy}`;
        } else if (!formattedDate) {
            formattedDate = 'N/A';
        }
        
        row.innerHTML = `
            <td><strong>${match.MATCH_ID || 'N/A'}</strong></td>
            <td>${formattedDate}</td>
            <td>${match.SEASON || 'N/A'}</td>
            <td>${match['AHLY MANAGER'] || 'N/A'}</td>
            <td>${match['OPPONENT MANAGER'] || 'N/A'}</td>
            <td>${match.REFREE || 'N/A'}</td>
            <td>${match.ROUND || 'N/A'}</td>
            <td>${match['H-A-N'] || 'N/A'}</td>
            <td>${match.GF || 0}</td>
            <td>${match.GA || 0}</td>
            <td>${match['OPPONENT TEAM'] || 'N/A'}</td>
        `;
        
        tableBody.appendChild(row);
    });

    // Update match count badge
    if (matchCountBadge) {
        matchCountBadge.textContent = `${sortedMatches.length} matches`;
    }
}

function loadTopPerformers() {
    // This would load real player data from the backend
    const sampleScorers = [
        ['Mohamed Salah', 15, 8, 20],
        ['Ahmed Hassan', 12, 5, 18],
        ['Mahmoud Trezeguet', 10, 12, 22],
        ['Amr Warda', 8, 15, 19],
        ['Kahraba', 7, 6, 16]
    ];

    const tbody = document.querySelector('#top-scorers-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    sampleScorers.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player[0]}</td>
            <td>${player[1]}</td>
            <td>${player[2]}</td>
            <td>${player[3]}</td>
        `;
        tbody.appendChild(row);
    });
}

// Player Sub-tab Functions with Team Filtering
// Load player overview statistics from Excel workbook (PLAYERDETAILS + LINEUPDETAILS)
async function loadPlayerOverviewStats(playerName) {
    console.log(`🔄 Loading stats for player (Excel): ${playerName}`);
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log(`🔄 Loading Overview stats for player: ${playerName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const nameLower = (playerName || '').toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();

    // Filter rows for player (+team if provided + main filters)
    const playerRows = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        
        // Apply main filters to match data
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || '');
        const matchDetail = matchDetails.find(match => 
            normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
        );
        
        const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
        
        return filtersMatch;
    });

    // Aggregate per match
    const perMatch = new Map();
    let penGoal = 0, penAstGoal = 0, penMissed = 0, penAstMiss = 0, penMakeG = 0, penMakeM = 0, ownGoal = 0;
    playerRows.forEach(r => {
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!matchId) return;
        const gaVal = normalizeStr(r.GA).toUpperCase();
        // Normalize TYPE by stripping non-letters to tolerate spaces/dashes (e.g., "PEN GOAL", "PEN-MAKE GOAL")
        const typeVal = normalizeStr(r.TYPE).toUpperCase().replace(/[^A-Z]/g, '');
        if (!perMatch.has(matchId)) perMatch.set(matchId, { goals: 0, assists: 0 });
        const agg = perMatch.get(matchId);
        if (gaVal === 'GOAL') agg.goals += 1;
        if (gaVal === 'ASSIST') agg.assists += 1;

        // OWN GOAL counter - exact match on TYPE column
        if (typeVal === 'OG') ownGoal += 1;

        // Penalty counters by TYPE
        if (typeVal === 'PENGOAL') penGoal += 1;
        if (typeVal === 'PENASSISTGOAL') penAstGoal += 1;
        if (typeVal === 'PENMISSED') penMissed += 1;
        if (typeVal === 'PENASSISTMISSED') penAstMiss += 1;
        if (typeVal === 'PENMAKEGOAL') penMakeG += 1;
        if (typeVal === 'PENMAKEMISSED') penMakeM += 1;
        // Some sheets may encode these in GA instead; handle fallback
        const gaNorm = gaVal.replace(/[^A-Z]/g, '');
        if (gaNorm === 'PENGOAL') penGoal += 1;
        if (gaNorm === 'PENASSISTGOAL') penAstGoal += 1;
        if (gaNorm === 'PENMISSED') penMissed += 1;
        if (gaNorm === 'PENASSISTMISSED') penAstMiss += 1;
        if (gaNorm === 'PENMAKEGOAL') penMakeG += 1;
        if (gaNorm === 'PENMAKEMISSED') penMakeM += 1;
    });

    // Matches and minutes are derived from LINEUPDETAILS per request
    const lineupRowsAll = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const lineupRows = lineupRowsAll.filter(l => {
        const p = normalizeStr(l.PLAYER || l['PLAYER NAME']).toLowerCase();
        if (p !== nameLower) return false;
        // LINEUPDETAILS is Ahly-only; if a team filter is set and it's not Ahly, exclude
        if (teamLower) {
            if (normalizeTeamKey(teamFilter) !== 'ahly') return false;
        }
        
        // Apply main filters to match data
        const matchId = normalizeStr(l.MATCH_ID || l['MATCH ID'] || '');
        const matchDetail = matchDetails.find(match => 
            normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
        );
        
        const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
        
        return filtersMatch;
    });
    const totalMatches = lineupRows.length;
    let totalMinutes = 0;
    lineupRows.forEach(l => {
        totalMinutes += safeInt(l.MINTOTAL || l['MIN TOTAL'] || l.MINUTES || 0);
    });

    // Totals from per-match
    let totalGoals = 0, totalAssists = 0;
    let braceGoals = 0, hatTrickGoals = 0, threePlusGoals = 0;
    let braceAssists = 0, hatTrickAssists = 0, threePlusAssists = 0;
    perMatch.forEach(({ goals, assists }) => {
        totalGoals += goals;
        totalAssists += assists;
        if (goals >= 2) braceGoals += 1;
        if (goals >= 3) hatTrickGoals += 1;
        if (goals >= 4) threePlusGoals += 1; // 4+ goals only
        if (assists >= 2) braceAssists += 1;
        if (assists >= 3) hatTrickAssists += 1;
        if (assists >= 4) threePlusAssists += 1; // 4+ assists only
    });

    // Count matches with/without goals by comparing LINEUPDETAILS with perMatch
    let matchesWithGoals = 0, matchesWithoutGoals = 0;
    lineupRows.forEach(l => {
        const matchId = normalizeStr(l.MATCH_ID || l['MATCH ID'] || l.match_id);
        if (!matchId) return;
        
        const matchStats = perMatch.get(matchId);
        if (matchStats && matchStats.goals > 0) {
            matchesWithGoals += 1;
        } else {
            matchesWithoutGoals += 1;
        }
    });

    // Calculate consecutive streaks - need to get match dates and sort chronologically
    // matchDetails already defined above
    const lineupWithDates = lineupRows.map(l => {
        const matchId = normalizeStr(l.MATCH_ID || l['MATCH ID'] || l.match_id);
        const match = matchDetails.find(m => normalizeStr(m.MATCH_ID || m['MATCH ID'] || m.match_id) === matchId);
        const matchStats = perMatch.get(matchId);
        const goals = (matchStats && matchStats.goals) || 0;
        const assists = (matchStats && matchStats.assists) || 0;
        
        return {
            matchId: matchId,
            date: match ? (match.DATE || 0) : 0,
            goals: goals,
            assists: assists
        };
    }).filter(m => m.matchId); // Remove any without matchId

    // Sort by date (oldest first for streak calculation)
    lineupWithDates.sort((a, b) => {
        const dateA = parseFloat(a.date) || 0;
        const dateB = parseFloat(b.date) || 0;
        return dateA - dateB;
    });

    // Calculate longest consecutive streaks using the same logic as popup functions
    const gaStreak = (typeof findLongestConsecutiveGAStreak === 'function') ? findLongestConsecutiveGAStreak(lineupWithDates) : [];
    const noGAStreak = (typeof findLongestConsecutiveNoGAStreak === 'function') ? findLongestConsecutiveNoGAStreak(lineupWithDates) : [];
    const goalStreak = (typeof findLongestConsecutiveScoringStreak === 'function') ? findLongestConsecutiveScoringStreak(lineupWithDates) : [];
    const noGoalStreak = (typeof findLongestConsecutiveNoGoalStreak === 'function') ? findLongestConsecutiveNoGoalStreak(lineupWithDates) : [];
    const assistStreak = (typeof findLongestConsecutiveAssistStreak === 'function') ? findLongestConsecutiveAssistStreak(lineupWithDates) : [];
    const noAssistStreak = (typeof findLongestConsecutiveNoAssistStreak === 'function') ? findLongestConsecutiveNoAssistStreak(lineupWithDates) : [];
    
    const maxGAStreak = gaStreak.length;
    const maxNoGAStreak = noGAStreak.length;
    const maxGoalStreak = goalStreak.length;
    const maxNoGoalStreak = noGoalStreak.length;
    const maxAssistStreak = assistStreak.length;
    const maxNoAssistStreak = noAssistStreak.length;
    
    // Get date ranges from the actual streak matches
    const maxGAStreakStart = gaStreak.length > 0 ? gaStreak[0].date : null;
    const maxGAStreakEnd = gaStreak.length > 0 ? gaStreak[gaStreak.length - 1].date : null;
    const maxNoGAStreakStart = noGAStreak.length > 0 ? noGAStreak[0].date : null;
    const maxNoGAStreakEnd = noGAStreak.length > 0 ? noGAStreak[noGAStreak.length - 1].date : null;
    const maxGoalStreakStart = goalStreak.length > 0 ? goalStreak[0].date : null;
    const maxGoalStreakEnd = goalStreak.length > 0 ? goalStreak[goalStreak.length - 1].date : null;
    const maxNoGoalStreakStart = noGoalStreak.length > 0 ? noGoalStreak[0].date : null;
    const maxNoGoalStreakEnd = noGoalStreak.length > 0 ? noGoalStreak[noGoalStreak.length - 1].date : null;
    const maxAssistStreakStart = assistStreak.length > 0 ? assistStreak[0].date : null;
    const maxAssistStreakEnd = assistStreak.length > 0 ? assistStreak[assistStreak.length - 1].date : null;
    const maxNoAssistStreakStart = noAssistStreak.length > 0 ? noAssistStreak[0].date : null;
    const maxNoAssistStreakEnd = noAssistStreak.length > 0 ? noAssistStreak[noAssistStreak.length - 1].date : null;

    // Format dates for display
    function formatDateForDisplay(dateVal) {
        if (!dateVal) return '';
        const monthMap = { 0:'Jan', 1:'Feb', 2:'Mar', 3:'Apr', 4:'May', 5:'Jun', 6:'Jul', 7:'Aug', 8:'Sep', 9:'Oct', 10:'Nov', 11:'Dec' };
        
        const str = String(dateVal).trim();
        
        // If already in dd-MMM-yyyy format, return as is
        if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(str)) {
            return str;
        }
        
        // Try to parse Excel serial number (should be > 25569 for dates after 1970)
        const num = parseFloat(str);
        if (!isNaN(num) && num > 100) { // Excel serial numbers for real dates are usually > 100
            // Excel date: days since 1899-12-30 (with leap year bug)
            // Adjust for Excel's 1900 leap year bug
            const adjustedNum = num > 60 ? num - 1 : num;
            const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
            const t = new Date(excelEpoch.getTime() + (adjustedNum * 86400 * 1000));
            
            if (!isNaN(t.getTime()) && t.getFullYear() > 1900) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = monthMap[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        
        // Try to parse as regular date string
        const d = new Date(dateVal);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1900) {
            const dd = String(d.getDate()).padStart(2, '0');
            const MMM = monthMap[d.getMonth()];
            const yyyy = d.getFullYear();
            return `${dd}-${MMM}-${yyyy}`;
        }
        
        return str;
    }

    const gaStreakPeriod = (maxGAStreakStart && maxGAStreakEnd) 
        ? `${formatDateForDisplay(maxGAStreakStart)} to ${formatDateForDisplay(maxGAStreakEnd)}`
        : '';
    
    const noGAStreakPeriod = (maxNoGAStreakStart && maxNoGAStreakEnd)
        ? `${formatDateForDisplay(maxNoGAStreakStart)} to ${formatDateForDisplay(maxNoGAStreakEnd)}`
        : '';
    
    const goalStreakPeriod = (maxGoalStreakStart && maxGoalStreakEnd) 
        ? `${formatDateForDisplay(maxGoalStreakStart)} to ${formatDateForDisplay(maxGoalStreakEnd)}`
        : '';
    
    const noGoalStreakPeriod = (maxNoGoalStreakStart && maxNoGoalStreakEnd)
        ? `${formatDateForDisplay(maxNoGoalStreakStart)} to ${formatDateForDisplay(maxNoGoalStreakEnd)}`
        : '';
    
    const assistStreakPeriod = (maxAssistStreakStart && maxAssistStreakEnd) 
        ? `${formatDateForDisplay(maxAssistStreakStart)} to ${formatDateForDisplay(maxAssistStreakEnd)}`
        : '';
    
    const noAssistStreakPeriod = (maxNoAssistStreakStart && maxNoAssistStreakEnd)
        ? `${formatDateForDisplay(maxNoAssistStreakStart)} to ${formatDateForDisplay(maxNoAssistStreakEnd)}`
        : '';

    updatePlayerOverviewCards({
        total_matches: totalMatches,
        total_minutes: totalMinutes,
        matches_with_goals: matchesWithGoals,
        matches_without_goals: matchesWithoutGoals,
        consecutive_ga: maxGAStreak,
        consecutive_ga_period: gaStreakPeriod,
        consecutive_no_ga: maxNoGAStreak,
        consecutive_no_ga_period: noGAStreakPeriod,
        consecutive_goals: maxGoalStreak,
        consecutive_goals_period: goalStreakPeriod,
        consecutive_no_goals: maxNoGoalStreak,
        consecutive_no_goals_period: noGoalStreakPeriod,
        consecutive_assists: maxAssistStreak,
        consecutive_assists_period: assistStreakPeriod,
        consecutive_no_assists: maxNoAssistStreak,
        consecutive_no_assists_period: noAssistStreakPeriod,
        total_goals: totalGoals,
        total_assists: totalAssists,
        brace_goals: braceGoals,
        brace_assists: braceAssists,
        hat_trick_goals: hatTrickGoals,
        hat_trick_assists: hatTrickAssists,
        three_plus_goals: threePlusGoals,
        three_plus_assists: threePlusAssists,
        pen_goal: penGoal,
        pen_ast_goal: penAstGoal,
        pen_missed: penMissed,
        pen_ast_miss: penAstMiss,
        pen_make_g: penMakeG,
        pen_make_m: penMakeM,
        own_goal: ownGoal
    });
}

// Function to update player overview cards
function updatePlayerOverviewCards(stats) {
    console.log('Updating cards with stats:', stats);
    
    // Update each card with the corresponding stat
    const elements = [
        'player-total-matches', 'player-total-minutes', 'player-matches-with-goals', 'player-matches-without-goals',
        'player-consecutive-ga', 'player-consecutive-no-ga', 'player-consecutive-goals', 'player-consecutive-no-goals', 'player-consecutive-assists', 'player-consecutive-no-assists',
        'player-total-goals', 'player-total-assists',
        'player-brace-goals', 'player-brace-assists', 'player-hat-trick-goals', 'player-hat-trick-assists',
        'player-three-plus-goals', 'player-three-plus-assists',
        // Penalty related
        'player-pen-goal', 'player-pen-assist-goal', 'player-pen-missed',
        'player-pen-assist-missed', 'player-pen-make-goal', 'player-pen-make-missed',
        // Own Goal
        'player-own-goal'
    ];
    
    const values = [
        stats.total_matches, stats.total_minutes, stats.matches_with_goals, stats.matches_without_goals,
        stats.consecutive_ga, stats.consecutive_no_ga, stats.consecutive_goals, stats.consecutive_no_goals, stats.consecutive_assists, stats.consecutive_no_assists,
        stats.total_goals, stats.total_assists,
        stats.brace_goals, stats.brace_assists, stats.hat_trick_goals, stats.hat_trick_assists,
        stats.three_plus_goals, stats.three_plus_assists,
        // Penalty related
        stats.pen_goal, stats.pen_ast_goal, stats.pen_missed,
        stats.pen_ast_miss, stats.pen_make_g, stats.pen_make_m,
        // Own Goal
        stats.own_goal
    ];
    
    for (let i = 0; i < elements.length; i++) {
        const element = document.getElementById(elements[i]);
        if (element) {
            element.textContent = values[i] || 0;
            console.log(`Updated ${elements[i]}: ${values[i] || 0}`);
        } else {
            console.error(`Element not found: ${elements[i]}`);
        }
    }
    
    // Update period details for consecutive streaks
    const consecutiveGAPeriod = document.getElementById('player-consecutive-ga-period');
    if (consecutiveGAPeriod) {
        consecutiveGAPeriod.textContent = stats.consecutive_ga_period || '';
        consecutiveGAPeriod.style.display = stats.consecutive_ga_period ? 'block' : 'none';
    }
    
    const consecutiveNoGAPeriod = document.getElementById('player-consecutive-no-ga-period');
    if (consecutiveNoGAPeriod) {
        consecutiveNoGAPeriod.textContent = stats.consecutive_no_ga_period || '';
        consecutiveNoGAPeriod.style.display = stats.consecutive_no_ga_period ? 'block' : 'none';
    }
    
    const consecutiveGoalsPeriod = document.getElementById('player-consecutive-goals-period');
    if (consecutiveGoalsPeriod) {
        consecutiveGoalsPeriod.textContent = stats.consecutive_goals_period || '';
        consecutiveGoalsPeriod.style.display = stats.consecutive_goals_period ? 'block' : 'none';
    }
    
    const consecutiveNoGoalsPeriod = document.getElementById('player-consecutive-no-goals-period');
    if (consecutiveNoGoalsPeriod) {
        consecutiveNoGoalsPeriod.textContent = stats.consecutive_no_goals_period || '';
        consecutiveNoGoalsPeriod.style.display = stats.consecutive_no_goals_period ? 'block' : 'none';
    }
    
    const consecutiveAssistsPeriod = document.getElementById('player-consecutive-assists-period');
    if (consecutiveAssistsPeriod) {
        consecutiveAssistsPeriod.textContent = stats.consecutive_assists_period || '';
        consecutiveAssistsPeriod.style.display = stats.consecutive_assists_period ? 'block' : 'none';
    }
    
    const consecutiveNoAssistsPeriod = document.getElementById('player-consecutive-no-assists-period');
    if (consecutiveNoAssistsPeriod) {
        consecutiveNoAssistsPeriod.textContent = stats.consecutive_no_assists_period || '';
        consecutiveNoAssistsPeriod.style.display = stats.consecutive_no_assists_period ? 'block' : 'none';
    }
}

function loadPlayerOverviewWithFilter(selectedTeams) {
    console.log('Loading overview with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        loadPlayerOverview();
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    
    // Temporarily set the team filter in the DOM element for loadPlayerOverviewStats to use
    const teamFilterElement = document.getElementById('player-team-filter');
    const originalValue = teamFilterElement ? teamFilterElement.value : '';
    if (teamFilterElement) {
        teamFilterElement.value = teamFilter;
    }
    
    // Load the overview stats with the team filter
    loadPlayerOverviewStats(playerName);
    
    // Restore original value
    if (teamFilterElement) {
        teamFilterElement.value = originalValue;
    }
}
function loadPlayerOverview() {
    // Reset all cards to 0 when no player is selected
    updatePlayerOverviewCards({
        total_matches: 0,
        total_minutes: 0,
        matches_with_goals: 0,
        matches_without_goals: 0,
        consecutive_ga: 0,
        consecutive_ga_period: '',
        consecutive_no_ga: 0,
        consecutive_no_ga_period: '',
        consecutive_goals: 0,
        consecutive_goals_period: '',
        consecutive_no_goals: 0,
        consecutive_no_goals_period: '',
        consecutive_assists: 0,
        consecutive_assists_period: '',
        consecutive_no_assists: 0,
        consecutive_no_assists_period: '',
        total_goals: 0,
        total_assists: 0,
        brace_goals: 0,
        brace_assists: 0,
        hat_trick_goals: 0,
        hat_trick_assists: 0,
        three_plus_goals: 0,
        three_plus_assists: 0,
        // Penalty related
        pen_goal: 0,
        pen_ast_goal: 0,
        pen_missed: 0,
        pen_ast_miss: 0,
        pen_make_g: 0,
        pen_make_m: 0,
        // Own Goal
        own_goal: 0
    });
}

function loadPlayerMatchesWithFilter(selectedTeams) {
    console.log('Loading player matches with team filter:', Array.isArray(selectedTeams) ? selectedTeams.join(', ') : selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        loadPlayerMatches();
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for player matches:', appliedFilters);
    
    const rows = getPlayerMatchesFromSheets(playerName, selectedTeams, appliedFilters);
    console.log('Player matches rows:', rows.length);
    console.log('Player matches data:', rows);
    renderPlayerMatchesTable(rows);
}

function loadPlayerMatches() {
    console.log('Loading player matches');
    console.log('Selected player:', playersData.selectedPlayer);
    console.log('Excel data available:', !!window.__ahlySheetsJson);
    
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-matches-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7">No player selected</td></tr>';
        }
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Loading player matches with filters:', appliedFilters);
    
    // Try Excel first, fallback to API
    let rows = [];
    if (window.__ahlySheetsJson) {
        rows = getPlayerMatchesFromSheets(playerName, teamFilter, appliedFilters);
        console.log('Excel data - player matches rows:', rows.length);
    } else {
        console.log('No Excel data, using API fallback');
        // Fallback to API call if Excel data not available
        fetch(`/api/player-matches/${encodeURIComponent(playerName)}${teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : ''}`)
            .then(response => response.json())
            .then(data => {
                if (data.matches) {
                    renderPlayerMatchesTable(data.matches);
                } else {
                    renderPlayerMatchesTable([]);
                }
            })
            .catch(error => {
                console.error('Error loading player matches:', error);
                renderPlayerMatchesTable([]);
            });
        return;
    }
    
    renderPlayerMatchesTable(rows);
}

function renderPlayerMatchesTable(matches) {
    const tbody = document.querySelector('#player-matches-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No matches data available</td></tr>';
        return;
    }
    // Sort by date (newest first) while displaying the sheet value (string) or a formatted Excel serial
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        // Try native parse first
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        // Try dd-MMM-yyyy (e.g., 29-May-1976)
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        // Excel serial number (days since 1899-12-31 with leap bug). Use 25569 offset to Unix epoch.
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0; // fallback to beginning
    }

    function formatSheetDateDisplay(s) {
        if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
            const t = new Date((Number(s) - 25569) * 86400 * 1000);
            if (!isNaN(t.getTime())) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = Object.keys(monthMap)[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        // Otherwise keep the original string from sheet
        return String(s || '').trim() || 'N/A';
    }

    // Show all matches where the player participated (from LINEUPDETAILS)
    const sorted = [...(matches || [])].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));

    sorted.forEach(m => {
        const date = formatSheetDateDisplay(m.date);
        const season = m.season || 'N/A';
        const manager = m.manager || 'N/A';
        const opponent = m.opponent || 'N/A';
        const goals = typeof m.goals === 'number' ? m.goals : (m.ga === 'GOAL' ? 1 : 0);
        const assists = typeof m.assists === 'number' ? m.assists : (m.ga === 'ASSIST' ? 1 : 0);
        // minutes column removed
        
        // Add highlighting for values > 0
        const goalsClass = goals > 0 ? 'highlight-value' : '';
        const assistsClass = assists > 0 ? 'highlight-value' : '';
        
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${season}</td>
            <td>${manager}</td>
            <td>${opponent}</td>
            <td>${m.minutes || 0}</td>
            <td class="${goalsClass}">${goals}</td>
            <td class="${assistsClass}">${assists}</td>
        `;
        tbody.appendChild(tr);
    });
}

function loadPlayerChampionships() {
    const tbody = document.querySelector('#player-championships-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        return;
    }

    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    
    const items = getPlayerChampionshipsFromSheets(playerName, teamFilter, appliedFilters);
    renderPlayerChampionshipsTable(items);
}
function renderPlayerChampionshipsTable(items) {
    const tbody = document.querySelector('#player-championships-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No championships data available</td></tr>';
        return;
    }

    // Calculate totals
    let totalMatches = 0;
    let totalMinutes = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalGA = 0;

    // Sort by G+A descending
    const sorted = [...items].sort((a, b) => ((b.ga_sum || ((b.goals||0)+(b.assists||0))) - (a.ga_sum || ((a.goals||0)+(a.assists||0)))));
    sorted.forEach(it => {
        const gaSum = it.ga_sum || ((it.goals || 0) + (it.assists || 0));
        totalMatches += it.matches || 0;
        totalMinutes += it.minutes || 0;
        totalGoals += it.goals || 0;
        totalAssists += it.assists || 0;
        totalGA += gaSum;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.CHAMPION || ''}</td>
            <td>${it.matches || 0}</td>
            <td>${it.minutes || 0}</td>
            <td>${gaSum}</td>
            <td>${it.goals || 0}</td>
            <td>${it.assists || 0}</td>
        `;
        tbody.appendChild(tr);
    });

    // Add totals row
    const totalsRow = document.createElement('tr');
    totalsRow.style.fontWeight = 'bold';
    totalsRow.style.backgroundColor = '#f8f9fa';
    totalsRow.style.borderTop = '2px solid #dee2e6';
    totalsRow.innerHTML = `
        <td>TOTAL</td>
        <td>${totalMatches}</td>
        <td>${totalMinutes}</td>
        <td>${totalGA}</td>
        <td>${totalGoals}</td>
        <td>${totalAssists}</td>
    `;
    tbody.appendChild(totalsRow);
}

function loadPlayerSeasons() {
    const tbody = document.querySelector('#player-seasons-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        return;
    }

    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    const items = getPlayerSeasonsFromSheets(playerName, teamFilter);
    renderPlayerSeasonsTable(items);
}

function renderPlayerSeasonsTable(items) {
    const tbody = document.querySelector('#player-seasons-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No seasons data available</td></tr>';
        return;
    }

    // Sort seasons: first by season name (alphabetical), then by numeric year descending (e.g., 2024-25 before 2023-24)
    function parseSeasonYears(s) {
        const m = String(s || '').match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
        if (!m) return { start: -Infinity, end: -Infinity };
        const start = parseInt(m[1], 10);
        const end = m[2].length === 2 ? (Math.floor(start / 100) * 100 + parseInt(m[2], 10)) : parseInt(m[2], 10);
        return { start, end };
    }

    const sorted = [...items].sort((a, b) => {
        const nameA = String(a.SEASON || '').toLowerCase();
        const nameB = String(b.SEASON || '').toLowerCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        const ya = parseSeasonYears(a.SEASON);
        const yb = parseSeasonYears(b.SEASON);
        // Newest first by start, then end
        if (yb.start !== ya.start) return yb.start - ya.start;
        return yb.end - ya.end;
    });

    // Calculate totals
    let totalMatches = 0;
    let totalMinutes = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalGA = 0;

    sorted.forEach(it => {
        const gaSum = it.ga_sum || ((it.goals || 0) + (it.assists || 0));
        totalMatches += it.matches || 0;
        totalMinutes += it.minutes || 0;
        totalGoals += it.goals || 0;
        totalAssists += it.assists || 0;
        totalGA += gaSum;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.SEASON || ''}</td>
            <td>${it.matches || 0}</td>
            <td>${it.minutes || 0}</td>
            <td>${gaSum}</td>
            <td>${it.goals || 0}</td>
            <td>${it.assists || 0}</td>
        `;
        tbody.appendChild(tr);
    });

    // Add totals row
    const totalsRow = document.createElement('tr');
    totalsRow.style.fontWeight = 'bold';
    totalsRow.style.backgroundColor = '#f8f9fa';
    totalsRow.style.borderTop = '2px solid #dee2e6';
    totalsRow.innerHTML = `
        <td>TOTAL</td>
        <td>${totalMatches}</td>
        <td>${totalMinutes}</td>
        <td>${totalGA}</td>
        <td>${totalGoals}</td>
        <td>${totalAssists}</td>
    `;
    tbody.appendChild(totalsRow);
}

function loadPlayerVsTeams() {
    const tbody = document.querySelector('#player-vs-teams-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        return;
    }

    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    
    const items = getPlayerVsTeamsFromSheets(playerName, teamFilter, appliedFilters);
    renderPlayerVsTeamsTable(items);
}

function renderPlayerVsTeamsTable(items) {
    const tbody = document.querySelector('#player-vs-teams-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No vs teams data available</td></tr>';
        return;
    }

    // Calculate totals
    let totalMatches = 0;
    let totalMinutes = 0;
    let totalGoals = 0;
    let totalAssists = 0;
    let totalGA = 0;

    // Sort by G+A descending
    const sorted = [...items].sort((a, b) => ((b.ga_sum || ((b.goals||0)+(b.assists||0))) - (a.ga_sum || ((a.goals||0)+(a.assists||0)))));
    sorted.forEach(it => {
        const gaSum = it.ga_sum || ((it.goals || 0) + (it.assists || 0));
        totalMatches += it.matches || 0;
        totalMinutes += it.minutes || 0;
        totalGoals += it.goals || 0;
        totalAssists += it.assists || 0;
        totalGA += gaSum;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.OPPONENT_TEAM || ''}</td>
            <td>${it.matches || 0}</td>
            <td>${it.minutes || 0}</td>
            <td>${gaSum}</td>
            <td>${it.goals || 0}</td>
            <td>${it.assists || 0}</td>
        `;
        tbody.appendChild(tr);
    });

    // Add totals row
    const totalsRow = document.createElement('tr');
    totalsRow.style.fontWeight = 'bold';
    totalsRow.style.backgroundColor = '#f8f9fa';
    totalsRow.style.borderTop = '2px solid #dee2e6';
    totalsRow.innerHTML = `
        <td>TOTAL</td>
        <td>${totalMatches}</td>
        <td>${totalMinutes}</td>
        <td>${totalGA}</td>
        <td>${totalGoals}</td>
        <td>${totalAssists}</td>
    `;
    tbody.appendChild(totalsRow);
}

function loadPlayerVsGKs() {
    const tbody = document.querySelector('#player-vs-gks-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        tbody.innerHTML = '<tr><td colspan="3">No player selected</td></tr>';
        return;
    }

    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    
    const items = getPlayerVsGKsFromSheets(playerName, teamFilter, appliedFilters);
    renderPlayerVsGKsTable(items);
}

function renderPlayerVsGKsTable(items) {
    const tbody = document.querySelector('#player-vs-gks-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No goalkeepers who conceded goals from this player found</td></tr>';
        return;
    }

    // Calculate totals
    let totalGoals = 0;
    let totalPenGoals = 0;

    items.forEach(it => {
        totalGoals += it.goals || 0; // Goals scored by the player against this goalkeeper
        totalPenGoals += it.pen_goals || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${it.GOALKEEPER_NAME || ''}</td>
            <td>${it.goals || 0}</td>
            <td>${it.pen_goals || 0}</td>
        `;
        tbody.appendChild(tr);
    });

    // Add totals row
    const totalsRow = document.createElement('tr');
    totalsRow.style.fontWeight = 'bold';
    totalsRow.style.backgroundColor = '#f8f9fa';
    totalsRow.style.borderTop = '2px solid #dee2e6';
    totalsRow.innerHTML = `
        <td>TOTAL</td>
        <td>${totalGoals}</td>
        <td>${totalPenGoals}</td>
    `;
    tbody.appendChild(totalsRow);
}

function loadGoalkeeperStats() {
    // Load default goalkeeper statistics (all goalkeepers)
    const sampleGKs = [
        {
            name: 'Mohamed El-Shenawy',
            matches: 25,
            cleanSheets: 12,
            goalsConceded: 18,
            saves: 45,
            team: 'Al Ahly'
        },
        {
            name: 'Ali Lotfi',
            matches: 15,
            cleanSheets: 6,
            goalsConceded: 12,
            saves: 28,
            team: 'Al Ahly'
        },
        {
            name: 'Mostafa Shobeir',
            matches: 5,
            cleanSheets: 0,
            goalsConceded: 4,
            saves: 8,
            team: 'Al Ahly'
        }
    ];

    updateGoalkeeperStatsTable(sampleGKs);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success';
    successDiv.style.cssText = `
        background: #d1e7dd;
        color: #0f5132;
        padding: 1rem;
        border: 1px solid #badbcc;
        border-radius: 0.375rem;
        margin: 1rem 0;
        text-align: center;
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        min-width: 300px;
    `;
    successDiv.textContent = message;

    document.body.appendChild(successDiv);
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 3000);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.style.cssText = `
        background: #f8d7da;
        color: #721c24;
        padding: 1rem;
        border: 1px solid #f5c6cb;
        border-radius: 0.375rem;
        margin: 1rem 0;
        text-align: center;
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        min-width: 300px;
    `;
    errorDiv.textContent = message;

    document.body.appendChild(errorDiv);
    setTimeout(() => {
        if (errorDiv.parentNode) {
            errorDiv.parentNode.removeChild(errorDiv);
        }
    }, 5000);
}

// ============================================================================
// TABLE SEARCH FUNCTION
// ============================================================================

/**
 * Search and filter table rows dynamically
 * @param {string} tableId - The ID of the table to search
 * @param {string} searchValue - The search term
 */
function searchTable(tableId, searchValue) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.warn(`Table with ID '${tableId}' not found`);
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const searchTerm = searchValue.toLowerCase().trim();
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    let visibleCount = 0;
    let totalRow = null;
    let visibleRows = [];
    
    rows.forEach(row => {
        // Check if this is the total row
        if (row.style.fontWeight === 'bold' && row.style.backgroundColor === 'rgb(240, 240, 240)') {
            totalRow = row;
            return;
        }
        
        // Get all cell text content
        const rowText = Array.from(row.cells)
            .map(cell => cell.textContent.toLowerCase())
            .join(' ');
        
        // Show/hide row based on search term
        if (searchTerm === '' || rowText.includes(searchTerm)) {
            row.style.display = '';
            visibleCount++;
            visibleRows.push(row);
        } else {
            row.style.display = 'none';
        }
    });
    
    // Update total row if it exists
    if (totalRow) {
        if (visibleRows.length > 0) {
            updateTotalRow(totalRow, visibleRows);
        } else if (searchTerm === '') {
            // If search is cleared, we need to restore original totals
            // This will be handled by re-rendering the table with original data
            // For now, just show the total row
            totalRow.style.display = '';
        } else {
            // Hide total row if no visible rows and search is active
            totalRow.style.display = 'none';
        }
    }
    
    // Log search results
    if (searchTerm !== '') {
        console.log(`Search in ${tableId}: "${searchValue}" - ${visibleCount} results found`);
    }
}

// Helper function to update total row based on visible rows
function updateTotalRow(totalRow, visibleRows) {
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheetsFor: 0,
        cleanSheetsAgainst: 0
    };
    
    visibleRows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 9) {
            totals.matches += parseInt(cells[1].textContent) || 0;
            totals.wins += parseInt(cells[2].textContent) || 0;
            totals.draws += parseInt(cells[3].textContent) || 0;
            totals.losses += parseInt(cells[4].textContent) || 0;
            totals.goalsFor += parseInt(cells[5].textContent) || 0;
            totals.goalsAgainst += parseInt(cells[6].textContent) || 0;
            totals.cleanSheetsFor += parseInt(cells[7].textContent) || 0;
            totals.cleanSheetsAgainst += parseInt(cells[8].textContent) || 0;
        }
    });
    
    // Update total row cells
    const totalCells = totalRow.cells;
    if (totalCells.length >= 9) {
        totalCells[1].textContent = totals.matches;
        totalCells[2].textContent = totals.wins;
        totalCells[3].textContent = totals.draws;
        totalCells[4].textContent = totals.losses;
        totalCells[5].textContent = totals.goalsFor;
        totalCells[6].textContent = totals.goalsAgainst;
        totalCells[7].textContent = totals.cleanSheetsFor;
        totalCells[8].textContent = totals.cleanSheetsAgainst;
    }
}

// Export functions for global access
window.searchTable = searchTable;
window.updateTotalRow = updateTotalRow;
window.loadAlAhlyStatsData = loadAlAhlyStatsData;
window.loadAlAhlyStats = loadAlAhlyStats;
window.showStreakDetails = showStreakDetails;
window.closeStreakModal = closeStreakModal;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.refreshStats = refreshStats;
window.calculateHowWinStats = calculateHowWinStats;
window.showHowWinSubTab = showHowWinSubTab;
window.initializeAlAhlyStats = initializeAlAhlyStats;
window.loadPlayerChampionshipsStats = loadPlayerChampionshipsStats;
window.loadPlayerSeasonsStats = loadPlayerSeasonsStats;
window.loadPlayerVsTeamsStats = loadPlayerVsTeamsStats;
window.loadPlayerVsGKsStats = loadPlayerVsGKsStats;
window.showAllPlayersSubTab = showAllPlayersSubTab;
window.sortVarietyGoalsTable = sortVarietyGoalsTable;
window.sortAllPlayersTable = sortAllPlayersTable;
window.sortPenaltyDetailsTable = sortPenaltyDetailsTable;
window.sortTrophyScorersTable = sortTrophyScorersTable;
window.loadTrophyScorersData = loadTrophyScorersData;

// Player Statistics Functions
function loadPlayerSeasonsStats() {
    console.log('Loading player seasons stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-seasons-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        }
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for seasons:', appliedFilters);
    
    const items = getPlayerSeasonsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Seasons items:', items.length);
    renderPlayerSeasonsTable(items);
}

function loadPlayerChampionshipsStats() {
    console.log('Loading player championships stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-championships-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        }
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for championships:', appliedFilters);
    
    const items = getPlayerChampionshipsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Championships items:', items.length);
    renderPlayerChampionshipsTable(items);
}

function loadPlayerVsTeamsStats() {
    console.log('Loading player vs teams stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-vs-teams-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4">No player selected</td></tr>';
        }
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for vs teams:', appliedFilters);
    
    const items = getPlayerVsTeamsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Vs teams items:', items.length);
    renderPlayerVsTeamsTable(items);
}

function loadPlayerVsGKsStats() {
    console.log('Loading player vs goalkeepers stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-vs-gks-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3">No player selected</td></tr>';
        }
        return;
    }
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    const query = teamFilter ? `?team=${encodeURIComponent(teamFilter)}` : '';

    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for vs goalkeepers:', appliedFilters);
    
    const items = getPlayerVsGKsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Vs goalkeepers items:', items.length);
    renderPlayerVsGKsTable(items);
}

// Additional filtered functions for other sub-tabs
function loadPlayerChampionshipsWithFilter(selectedTeams) {
    console.log('Loading championships with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-championships-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for championships:', appliedFilters);
    
    const items = getPlayerChampionshipsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Championships items with filter:', items.length);
    renderPlayerChampionshipsTable(items);
}

function loadPlayerSeasonsWithFilter(selectedTeams) {
    console.log('Loading seasons with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-seasons-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6">No player selected</td></tr>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for seasons:', appliedFilters);
    
    const items = getPlayerSeasonsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Seasons items with filter:', items.length);
    renderPlayerSeasonsTable(items);
}
function loadPlayerVsTeamsWithFilter(selectedTeams) {
    console.log('Loading vs teams with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-vs-teams-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="4">No player selected</td></tr>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for vs teams:', appliedFilters);
    
    const items = getPlayerVsTeamsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Vs teams items with filter:', items.length);
    renderPlayerVsTeamsTable(items);
}

function loadPlayerVsGKsWithFilter(selectedTeams) {
    console.log('Loading vs GKs with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const tbody = document.querySelector('#player-vs-gks-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="3">No player selected</td></tr>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for vs goalkeepers:', appliedFilters);
    
    const items = getPlayerVsGKsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Vs goalkeepers items with filter:', items.length);
    renderPlayerVsGKsTable(items);
}

// Additional filtered functions for other sub-tabs
function loadPlayerGoalDetailsWithFilter(selectedTeams) {
    console.log('Loading goal details with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        return;
    }
    
    // Temporarily set the team filter in the DOM element for loadPlayerGoalDetailsStats to use
    const teamFilterElement = document.getElementById('player-team-filter');
    const originalValue = teamFilterElement ? teamFilterElement.value : '';
    if (teamFilterElement) {
        teamFilterElement.value = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    }
    
    // Load the goal details stats with the team filter
    loadPlayerGoalDetailsStats();
    
    // Restore original value
    if (teamFilterElement) {
        teamFilterElement.value = originalValue;
    }
}

function loadPlayerAssistDetailsWithFilter(selectedTeams) {
    console.log('Loading assist details with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        return;
    }
    
    // Temporarily set the team filter in the DOM element for loadPlayerAssistDetails to use
    const teamFilterElement = document.getElementById('player-team-filter');
    const originalValue = teamFilterElement ? teamFilterElement.value : '';
    if (teamFilterElement) {
        teamFilterElement.value = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    }
    
    // Load the assist details stats with the team filter
    loadPlayerAssistDetails();
    
    // Restore original value
    if (teamFilterElement) {
        teamFilterElement.value = originalValue;
    }
}

function loadPlayerWithCoachesWithFilter(selectedTeams) {
    console.log('Loading with coaches with team filter:', selectedTeams);
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        return;
    }
    
    // Temporarily set the team filter in the DOM element for loadPlayerWithCoachesStats to use
    const teamFilterElement = document.getElementById('player-team-filter');
    const originalValue = teamFilterElement ? teamFilterElement.value : '';
    if (teamFilterElement) {
        teamFilterElement.value = Array.isArray(selectedTeams) ? selectedTeams.join(',') : (selectedTeams || '');
    }
    
    // Load the with coaches stats with the team filter
    loadPlayerWithCoachesStats();
    
    // Restore original value
    if (teamFilterElement) {
        teamFilterElement.value = originalValue;
    }
}

// Load goal minute statistics for player
function loadPlayerGoalMinuteStats() {
    console.log('Loading player goal minute stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const container = document.getElementById('goal-minute-cards-container');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No player selected</p>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for goal minutes:', appliedFilters);
    
    const goalMinutes = getPlayerGoalMinutesFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Goal minutes data:', goalMinutes);
    renderGoalMinuteCards(goalMinutes);
}

// Get goal minutes from Excel data
function getPlayerGoalMinutesFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const nameLower = (playerName || '').toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();
    
    if (!details.length) return {};
    
    // Filter PLAYERDETAILS by player, team, and goals only (GA = 'GOAL')
    const goalRecords = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        
        // Apply main filters to match data
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || '');
        const matchDetail = matchDetails.find(match => 
            normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
        );
        
        const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
        if (!filtersMatch) return false;
        
        // Only get goals where GA = 'GOAL'
        const gaVal = normalizeStr(r.GA || '').toUpperCase();
        return gaVal === 'GOAL';
    });
    
    console.log('Goal records found:', goalRecords.length);
    
    // Count goals per minute
    const minuteCounts = {};
    goalRecords.forEach(r => {
        let minute = normalizeStr(r.MINUTE || r.minute || '');
        if (!minute) return;
        
        console.log('Found goal at minute:', minute);
        
        // Keep the original format for display
        minuteCounts[minute] = (minuteCounts[minute] || 0) + 1;
    });
    
    return minuteCounts;
}

// Helper function to parse minute for sorting (handles 45+5, 90+3 etc)
function parseMinuteForSort(minuteStr) {
    const str = String(minuteStr).trim();
    
    // Handle formats like "45+5" or "90+3"
    if (str.includes('+')) {
        const parts = str.split('+');
        const base = parseInt(parts[0]) || 0;
        const extra = parseInt(parts[1]) || 0;
        // Return a fractional value: 45+5 becomes 45.5, so it sorts between 45 and 46
        return base + (extra / 100);
    }
    
    // Regular minute
    return parseInt(str) || 0;
}

// Render goal minute cards
function renderGoalMinuteCards(minuteCounts) {
    const container = document.getElementById('goal-minute-cards-container');
    const timelineContainer = document.getElementById('goal-timeline-container');
    
    if (!container) return;
    
    const minutes = Object.keys(minuteCounts);
    
    if (minutes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No goals found for this player</p>';
        if (timelineContainer) timelineContainer.innerHTML = '';
        return;
    }
    
    // Calculate timeline distribution
    const timeline = {
        '1-15': 0,
        '16-30': 0,
        '31-45': 0,
        '46-60': 0,
        '61-75': 0,
        '76-89': 0,
        '90+': 0
    };
    
    minutes.forEach(minute => {
        const count = minuteCounts[minute];
        const minuteNum = parseMinuteForSort(minute);
        
        if (minuteNum >= 1 && minuteNum < 16) {
            timeline['1-15'] += count;
        } else if (minuteNum >= 16 && minuteNum < 31) {
            timeline['16-30'] += count;
        } else if (minuteNum >= 31 && minuteNum < 46) {
            timeline['31-45'] += count;
        } else if (minuteNum >= 46 && minuteNum < 61) {
            timeline['46-60'] += count;
        } else if (minuteNum >= 61 && minuteNum < 76) {
            timeline['61-75'] += count;
        } else if (minuteNum >= 76 && minuteNum < 90) {
            timeline['76-89'] += count;
        } else if (minuteNum >= 90) {
            timeline['90+'] += count;
        }
    });
    
    // Render timeline cards
    if (timelineContainer) {
        let timelineHtml = '';
        Object.keys(timeline).forEach(period => {
            const count = timeline[period];
            const plural = count === 1 ? 'Goal' : 'Goals';
            
            timelineHtml += `
                <div class="timeline-card">
                    <h4>${period}'</h4>
                    <div class="timeline-value">${count}</div>
                    <p class="timeline-label">${plural}</p>
                </div>
            `;
        });
        timelineContainer.innerHTML = timelineHtml;
    }
    
    // Sort minutes chronologically (handles 45+5 < 46)
    minutes.sort((a, b) => parseMinuteForSort(a) - parseMinuteForSort(b));
    
    // Build individual minute cards HTML
    let html = '';
    minutes.forEach(minute => {
        const count = minuteCounts[minute];
        const plural = count === 1 ? 'Goal' : 'Goals';
        
        html += `
            <div class="player-stat-card">
                <div class="stat-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12,6 12,12 16,14"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <h3>Minute ${minute}'</h3>
                    <p class="stat-value">${count}</p>
                    <p class="stat-label">${plural}</p>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load goal by round statistics for player
function loadPlayerGoalByRoundStats() {
    console.log('Loading player goal by round stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const container = document.getElementById('goal-round-cards-container');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No player selected</p>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for goal rounds:', appliedFilters);
    
    const goalRounds = getPlayerGoalRoundsFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Goal rounds data:', goalRounds);
    renderGoalRoundCards(goalRounds);
}
// Get goal rounds from Excel data (grouped by champion)
function getPlayerGoalRoundsFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const nameLower = (playerName || '').toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();
    
    if (!details.length || !matches.length) return {};
    
    // Apply main filters to matches first
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true;
            
            const recordKeyMap = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'AHLY MANAGER',
                'opponentManager': 'OPPONENT MANAGER',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STAD',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L'
            };
            
            const recordKey = recordKeyMap[key];
            if (!recordKey) return true;
            
            const recordValue = match[recordKey] || '';
            return normalizeStr(recordValue).toLowerCase() === normalizeStr(filterValue).toLowerCase();
        });
    });
    
    const filteredMatchIds = new Set(filteredMatches.map(m => normalizeStr(m.MATCH_ID || m['MATCH ID'] || m.match_id)));
    
    // Get all player goals AND assists
    const allRecords = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!filteredMatchIds.has(matchId)) return false;
        
        const gaVal = normalizeStr(r.GA || '').toUpperCase();
        return gaVal === 'GOAL' || gaVal === 'ASSIST';
    });
    
    // Group goals and assists by champion and then by round
    const championData = {};
    allRecords.forEach(r => {
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        const match = filteredMatches.find(m => normalizeStr(m.MATCH_ID || m['MATCH ID'] || m.match_id) === matchId);
        
        if (match) {
            // Don't normalize champion and round to preserve exact text
            const champion = String(match.CHAMPION || match.champion || 'Unknown').trim();
            const round = String(match.ROUND || match.round || 'Unknown').trim();
            const gaVal = normalizeStr(r.GA || '').toUpperCase();
            
            if (!championData[champion]) {
                championData[champion] = {
                    totalGoals: 0,
                    totalAssists: 0,
                    rounds: {}
                };
            }
            
            if (!championData[champion].rounds[round]) {
                championData[champion].rounds[round] = {
                    goals: 0,
                    assists: 0
                };
            }
            
            if (gaVal === 'GOAL') {
                championData[champion].totalGoals += 1;
                championData[champion].rounds[round].goals += 1;
            } else if (gaVal === 'ASSIST') {
                championData[champion].totalAssists += 1;
                championData[champion].rounds[round].assists += 1;
            }
        }
    });
    
    return championData;
}

// Render goal round cards (grouped by champion)
function renderGoalRoundCards(championData) {
    const container = document.getElementById('goal-round-cards-container');
    
    if (!container) return;
    
    const champions = Object.keys(championData);
    
    if (champions.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No goals found for this player</p>';
        return;
    }
    
    // Sort champions alphabetically
    champions.sort((a, b) => a.localeCompare(b));
    
    // Color palette for champions
    const colors = [
        { bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: 'rgba(255, 255, 255, 0.2)' },
        { bg: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', icon: 'rgba(255, 255, 255, 0.2)' }
    ];
    
    // Build champion cards HTML
    let html = '';
    champions.forEach((champion, index) => {
        const data = championData[champion];
        const totalGoals = data.totalGoals || 0;
        const totalAssists = data.totalAssists || 0;
        const totalContributions = totalGoals + totalAssists;
        const color = colors[index % colors.length];
        // Use index to create unique IDs instead of relying on champion name
        const championId = `champion-round-${index}`;
        
        html += `
            <div style="width: 100%;">
                <div class="player-stat-card goal-effect-clickable" style="background: ${color.bg}; color: white; cursor: pointer;" onclick="toggleGoalRoundTable('${championId}')">
                    <div class="stat-icon" style="background: ${color.icon};">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                            <path d="M4 22h16"/>
                            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                        </svg>
                    </div>
                    <div class="stat-content">
                        <h3 style="color: white;">${champion}</h3>
                        <p class="stat-value" style="color: white;">${totalGoals} G + ${totalAssists} A</p>
                        <p class="stat-label" style="color: white;">${totalContributions} Goal Contributions</p>
                    </div>
                    <div style="margin-left: auto;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 24px; height: 24px;">
                            <polyline points="6 9 12 15 18 9"/>
                        </svg>
                    </div>
                </div>
                <div id="${championId}-table" class="goal-effect-table" style="display: none; margin-top: 1rem;">
                    <div class="stats-table-container">
                        <table class="stats-table">
                            <thead>
                                <tr>
                                    <th>Round</th>
                                    <th>Goals</th>
                                    <th>Assists</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody id="${championId}-tbody">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Render tables data for each champion
    champions.forEach((champion, index) => {
        const championId = `champion-round-${index}`;
        renderGoalRoundTable(championId, championData[champion].rounds, champion);
    });
}

// Toggle goal round table visibility
function toggleGoalRoundTable(championId) {
    const tableId = `${championId}-table`;
    const table = document.getElementById(tableId);
    if (table) {
        table.style.display = table.style.display === 'none' ? 'block' : 'none';
    }
}

// Get round sort order for tournament rounds
function getRoundSortOrder(roundName) {
    const roundLower = String(roundName).toLowerCase().trim();
    
    // Define the logical order of tournament rounds
    const roundOrder = {
        'التمهيدي': 1,
        'تمهيدي': 1,
        'preliminary': 1,
        'qualifying': 1,
        '64': 2,
        'الأول': 3,
        '32': 3,
        'round of 32': 3,
        '16': 4,
        'round of 16': 4,
        'دور الـ 16': 4,
        '16 - م': 5,
        '16 - إعادة': 5,
        '8': 6,
        'ربع النهائي': 6,
        'quarter finals': 6,
        'quarter-finals': 6,
        'quarters': 6,
        'دور الـ 8': 6,
        '8 - م': 7,
        '8 - إعادة': 7,
        '4': 8,
        'نصف النهائي': 8,
        'semi finals': 8,
        'semi-finals': 8,
        'semis': 8,
        'دور الـ 4': 8,
        '3/4': 9,
        'المركز الثالث': 9,
        '3rd place': 9,
        'third place': 9,
        'النهائي': 10,
        'final': 10,
        'finals': 10
    };
    
    // Check if exact match exists
    if (roundOrder[roundLower] !== undefined) {
        return roundOrder[roundLower];
    }
    
    // Check for partial matches
    for (const [key, value] of Object.entries(roundOrder)) {
        if (roundLower.includes(key) || key.includes(roundLower)) {
            return value;
        }
    }
    
    // Try to parse as number for league rounds
    const num = parseInt(roundName);
    if (!isNaN(num)) {
        return 1000 + num; // Put numbered rounds at the end
    }
    
    // Default: alphabetical order (use large number + alphabetical)
    return 2000;
}

// Render goal round table for a specific champion
function renderGoalRoundTable(championId, roundsData, championName = '') {
    const tbodyId = `${championId}-tbody`;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const rounds = Object.keys(roundsData);
    
    if (rounds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center;">No rounds found</td></tr>';
        return;
    }
    
    // Check if this is Egyptian League (use numeric sorting)
    const isEgyptianLeague = championName && (
        championName.includes('الدوري المصري') || 
        championName.toLowerCase().includes('egyptian league') ||
        championName.toLowerCase().includes('egyptian premier league')
    );
    
    // Sort rounds based on tournament logic or numeric for league
    rounds.sort((a, b) => {
        if (isEgyptianLeague) {
            // For Egyptian League, sort numerically
            const numA = parseInt(a);
            const numB = parseInt(b);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            
            return a.localeCompare(b);
        } else {
            // For tournaments, use logical round order
            const orderA = getRoundSortOrder(a);
            const orderB = getRoundSortOrder(b);
            
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            
            // If same order, sort alphabetically
            return a.localeCompare(b);
        }
    });
    
    let html = '';
    rounds.forEach(round => {
        const data = roundsData[round];
        const goals = data.goals || 0;
        const assists = data.assists || 0;
        const total = goals + assists;
        
        html += `
            <tr>
                <td><strong>${round}</strong></td>
                <td>${goals}</td>
                <td>${assists}</td>
                <td><strong>${total}</strong></td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// ============================================================================
// GOALKEEPER SEARCH AND FILTERING FUNCTIONS
// ============================================================================

// Excel: build goalkeepers list from GKDETAILS
function getGoalkeepersListFromSheets() {
    console.log('Getting goalkeepers list from Excel (GKDETAILS)...');
    const rows = getSheetRowsByCandidates(['GKDETAILS']);
    console.log(`Found ${rows.length} goalkeeper detail rows`);
    
    const goalkeepersMap = new Map();
    rows.forEach(r => {
        const name = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player);
        if (!name) return;
        const team = normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team);
        if (!goalkeepersMap.has(name)) goalkeepersMap.set(name, new Set());
        if (team) goalkeepersMap.get(name).add(team);
    });
    
    const goalkeepersList = Array.from(goalkeepersMap.entries()).map(([name, teamSet]) => ({
        name,
        teams: Array.from(teamSet).sort()
    })).sort((a,b) => a.name.localeCompare(b.name));
    
    console.log(`Built goalkeepers list with ${goalkeepersList.length} unique goalkeepers`);
    return goalkeepersList;
}

// Function to load goalkeepers data
async function loadGoalkeepersData() {
    try {
        console.log('🔄 Loading goalkeepers from Excel (GKDETAILS)...');
        goalkeepersData.goalkeepers = getGoalkeepersListFromSheets();
        
        console.log(`✅ Loaded ${goalkeepersData.goalkeepers.length} goalkeepers`);
        
        if (goalkeepersData.goalkeepers.length > 0) {
            console.log('📋 Sample goalkeepers:');
            goalkeepersData.goalkeepers.slice(0, 5).forEach((gk, index) => {
                console.log(`  ${index + 1}. ${gk.name} - Teams: ${gk.teams ? gk.teams.join(', ') : 'No teams'}`);
            });
        }
        
        // Initialize goalkeeper search
        initializeGoalkeeperSearch();
        
        // Initialize goalkeeper team filter
        initializeGoalkeeperTeamFilter();
        
        // Load goalkeeper stats from Excel
        loadGoalkeeperStatsFromSheets();
        
    } catch (error) {
        console.error('Error loading goalkeepers data:', error);
    }
}

// Initialize goalkeeper search functionality
function initializeGoalkeeperSearch() {
    const searchInput = document.getElementById('gk-search');
    const searchOptions = document.getElementById('gk-search-options');
    
    if (!searchInput || !searchOptions) return;
    
    let isOpen = false;
    
    // Input event for search
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        if (query.length === 0) {
            searchOptions.style.display = 'none';
            isOpen = false;
            return;
        }
        
        // Filter goalkeepers based on query
        const filteredGoalkeepers = goalkeepersData.goalkeepers.filter(gk => 
            gk.name.toLowerCase().includes(query)
        );
        
        if (filteredGoalkeepers.length === 0) {
            searchOptions.innerHTML = '<div class="option-item no-results">No goalkeepers found</div>';
        } else {
            searchOptions.innerHTML = filteredGoalkeepers.map((gk, index) => {
                // Find original index in goalkeepersData.goalkeepers
                const originalIndex = goalkeepersData.goalkeepers.findIndex(g => g.name === gk.name);
                return `<div class="option-item" data-gk-index="${originalIndex}">${gk.name}</div>`;
            }).join('');
        }
        
        searchOptions.style.display = 'block';
        isOpen = true;
    });
    
    // Click on options
    searchOptions.addEventListener('click', function(e) {
        if (e.target.classList.contains('option-item') && !e.target.classList.contains('no-results')) {
            try {
                const gkIndex = parseInt(e.target.getAttribute('data-gk-index'));
                if (!isNaN(gkIndex) && goalkeepersData.goalkeepers[gkIndex]) {
                    const goalkeeperData = goalkeepersData.goalkeepers[gkIndex];
                    
                    // Update UI first before loading data
                    searchInput.value = goalkeeperData.name;
                    searchOptions.style.display = 'none';
                    isOpen = false;
                    
                    // Then load goalkeeper data
                    selectGoalkeeper(goalkeeperData);
                }
            } catch (error) {
                console.error('❌ Error selecting goalkeeper:', error);
                searchOptions.style.display = 'none';
                isOpen = false;
            }
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !searchOptions.contains(e.target)) {
            searchOptions.style.display = 'none';
            isOpen = false;
        }
    });
    
    // Focus event
    searchInput.addEventListener('focus', function() {
        if (this.value.length > 0) {
            searchOptions.style.display = 'block';
            isOpen = true;
        }
    });
}

// Function to select a goalkeeper and populate teams dropdown
function selectGoalkeeper(goalkeeper) {
    goalkeepersData.selectedGoalkeeper = goalkeeper;
    
    // Update teams dropdown
    const teamFilter = document.getElementById('gk-team-filter');
    if (teamFilter) {
        // Clear existing options except "All Teams"
        teamFilter.innerHTML = '<option value="">All Teams</option>';
        
        if (goalkeeper.teams && goalkeeper.teams.length > 0) {
            // Sort teams alphabetically
            const sortedTeams = [...goalkeeper.teams].sort();
            
            // Add team options
            sortedTeams.forEach(team => {
                const option = document.createElement('option');
                option.value = team;
                option.textContent = team;
                teamFilter.appendChild(option);
            });
            
            // Enable the dropdown
            teamFilter.disabled = false;
        } else {
            // Disable the dropdown if no teams
            teamFilter.disabled = true;
        }
        
        // Reset to "All Teams"
        teamFilter.value = '';
    }
    
    console.log(`Selected goalkeeper: ${goalkeeper.name}, Teams: ${goalkeeper.teams ? goalkeeper.teams.join(', ') : 'No teams'}`);
    
    // Load goalkeeper statistics and overview (without team filter - show all teams)
    loadGoalkeeperStatistics(goalkeeper.name, '');
    
    // Load overview statistics
    loadGKOverviewStats(goalkeeper.name, '');
    
    // Load goalkeeper matches
    loadGKMatches('');
    
    // Load goalkeeper championships
    loadGKChampionships('');
    
    // Load goalkeeper seasons
    loadGKSeasons('');
    
    // Load goalkeeper vs teams
    loadGKVsTeams('');
    
    // Load goalkeeper vs players
    loadGKVsPlayers('');
}

// Initialize goalkeeper team filter functionality
function initializeGoalkeeperTeamFilter() {
    const teamFilter = document.getElementById('gk-team-filter');
    if (!teamFilter) return;
    
    // Add event listener for team filter changes
    teamFilter.addEventListener('change', function() {
        applyGoalkeeperTeamFilter();
    });
}

// Apply goalkeeper team filter
function applyGoalkeeperTeamFilter() {
    const teamFilter = document.getElementById('gk-team-filter');
    const selectedTeam = teamFilter ? teamFilter.value : '';
    
    // Update goalkeeper statistics based on selected team
    updateGoalkeeperStatisticsForTeam(selectedTeam);
    
    console.log(`Filtering goalkeeper statistics for team: ${selectedTeam || 'All Teams'}`);
}

// Update goalkeeper statistics based on selected team
function updateGoalkeeperStatisticsForTeam(selectedTeam) {
    if (!goalkeepersData.selectedGoalkeeper) {
        // If no goalkeeper selected, load default data
        loadGoalkeeperStats();
        return;
    }
    
    // Load goalkeeper statistics with team filter
    loadGoalkeeperStatistics(goalkeepersData.selectedGoalkeeper.name, selectedTeam);
    
    // Load overview statistics with team filter
    loadGKOverviewStats(goalkeepersData.selectedGoalkeeper.name, selectedTeam);
    
    // Load goalkeeper matches with team filter
    loadGKMatches(selectedTeam);
    
    // Load goalkeeper championships with team filter
    loadGKChampionships(selectedTeam);
    
    // Load goalkeeper seasons with team filter
    loadGKSeasons(selectedTeam);
    
    // Load goalkeeper vs teams with team filter
    loadGKVsTeams(selectedTeam);
    
    // Load goalkeeper vs players with team filter
    loadGKVsPlayers(selectedTeam);
}
// Load goalkeeper statistics
async function loadGoalkeeperStatistics(goalkeeperName, selectedTeam = '') {
    console.log(`Loading statistics for goalkeeper: ${goalkeeperName}, Team: ${selectedTeam}`);
    
    try {
        // Use cached data for goalkeeper statistics
        const data = null; // API removed; using Excel instead
        
        if (data.error) {
            console.error('Error loading goalkeeper statistics:', data.error);
            // Show empty table on error
            updateGoalkeeperStatsTable([]);
            updateGKOverviewCards({
                total_matches: 0,
                clean_sheets: 0,
                goals_conceded: 0,
                clean_sheet_percentage: 0,
                avg_goals_conceded: 0,
                penalty_goals: 0,
                penalty_saves: 0,
                penalties_missed: 0
            });
            return;
        }
        
        // Update the table with real data
        updateGoalkeeperStatsTable(data.goalkeepers || []);
        
    } catch (error) {
        console.error('Error loading goalkeeper statistics:', error);
        // Show empty table on error
        updateGoalkeeperStatsTable([]);
        updateGKOverviewCards({
            total_matches: 0,
            clean_sheets: 0,
            goals_conceded: 0,
            clean_sheet_percentage: 0,
            avg_goals_conceded: 0,
            penalty_goals: 0,
            penalty_saves: 0,
            penalties_missed: 0
        });
    }
}

// Update goalkeeper stats table
function updateGoalkeeperStatsTable(goalkeepers) {
    const tbody = document.querySelector('#goalkeeper-stats-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    goalkeepers.forEach(gk => {
        const row = document.createElement('tr');
        const savePercentage = gk.matches > 0 ? ((gk.saves / (gk.saves + gk.goalsConceded)) * 100).toFixed(1) : 0;
        row.innerHTML = `
            <td>${gk.name}</td>
            <td>${gk.matches}</td>
            <td>${gk.cleanSheets}</td>
            <td>${gk.goalsConceded}</td>
            <td>${savePercentage}%</td>
        `;
        tbody.appendChild(row);
    });
}

// ============================================================================
// GOALKEEPER SUB-TAB FUNCTIONS
// ============================================================================

// Load GK Matches
function loadGKMatches(teamFilter = '') {
    console.log('=== LOADING GK MATCHES ===');
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        console.log('No goalkeeper selected for matches');
        renderGKMatchesTable([]);
        return;
    }
    
    console.log(`Loading matches for goalkeeper: ${goalkeepersData.selectedGoalkeeper.name}, Team filter: ${teamFilter}`);
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK matches:', appliedFilters);
    
    const matches = getGKMatchesFromSheets(goalkeepersData.selectedGoalkeeper.name, teamFilter, appliedFilters);
    console.log(`Found ${matches.length} matches, rendering table...`);
    renderGKMatchesTable(matches);
}
// Excel: get goalkeeper matches from GKDETAILS and MATCHDETAILS
function getGKMatchesFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    console.log(`Getting matches for goalkeeper: ${goalkeeperName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);
    
    if (!gkDetails.length || !matchDetails.length) {
        console.log('No goalkeeper or match details found');
        return [];
    }
    
    // Apply main filters to matches first
    const filteredMatches = matchDetails.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            
            const fieldMapping = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'champion': 'CHAMPION',
                'season': 'SEASON',
                'ahlyManager': 'MANAGER AHLY',
                'opponentManager': 'MANAGER OPPONENT',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STADIUM',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET',
                'penalties': 'PEN'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            
            const matchValue = normalizeStr(match[field] || '');
            const normalizedFilter = normalizeStr(filterValue);
            
            // Handle date filters
            if (key === 'dateFrom') {
                const matchDate = new Date(match.DATE);
                const filterDate = new Date(filterValue);
                return matchDate >= filterDate;
            }
            if (key === 'dateTo') {
                const matchDate = new Date(match.DATE);
                const filterDate = new Date(filterValue);
                return matchDate <= filterDate;
            }
            
            // Handle numeric filters
            if (key === 'goalsFor') {
                return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            }
            if (key === 'goalsAgainst') {
                return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            }
            
            return matchValue === normalizedFilter;
        });
    });
    
    // Get match IDs for filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));
    
    // Filter goalkeeper records for the selected goalkeeper
    let gkRecords = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(goalkeeperName));
    
    // Apply team filter if specified (filter by exact team name)
    if (teamFilter) {
        gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === normalizeStr(teamFilter));
    }
    
    // Filter by matches that passed the main filters
    gkRecords = gkRecords.filter(r => filteredMatchIds.has(r.MATCH_ID));
    
    if (gkRecords.length === 0) {
        console.log(`No records found for goalkeeper: ${goalkeeperName}`);
        return [];
    }
    
    // Get match IDs for this goalkeeper
    const matchIds = new Set(gkRecords.map(r => r.MATCH_ID).filter(id => id));
    
    // Get match details for these matches from filtered matches
    const matches = filteredMatches.filter(m => matchIds.has(m.MATCH_ID));
    
    // Build matches data
    const matchesData = [];
    
    matches.forEach(match => {
        const gkRecord = gkRecords.find(r => r.MATCH_ID === match.MATCH_ID);
        if (!gkRecord) return;
        
        const elevenBackup = normalizeStr(gkRecord['11/BAKEUP'] || '').toUpperCase();
        const submin = gkRecord.SUBMIN || '';
        
        // Include ALL matches where goalkeeper played (starting or substitute)
        const isStarting = elevenBackup === '11' || elevenBackup === '' || submin === '';
        
        const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
        const cleanSheet = goalsConceded === 0 ? 'Yes' : 'No';
        
        // Count penalty goals from PLAYERDETAILS
        let penaltyGoals = 0;
        const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
        playerDetails.forEach(playerRecord => {
            if (normalizeStr(playerRecord.MATCH_ID) === normalizeStr(match.MATCH_ID)) {
                const typeNorm = normalizeStr(playerRecord.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
                const gaNorm = normalizeStr(playerRecord.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
                
                if (typeNorm === 'PENGOAL' || gaNorm === 'PENGOAL') {
                    const gkTeam = normalizeStr(gkRecord.TEAM || '');
                    const playerTeam = normalizeStr(playerRecord.TEAM || '');
                    
                    if (gkTeam !== playerTeam) {
                        penaltyGoals++;
                    }
                }
            }
        });
        
        // Count penalty saves from HOWPENMISSED for this match
        let penaltySaves = 0;
        howPenMissed.forEach(penRecord => {
            if (normalizeStr(penRecord['PLAYER NAME']) === normalizeStr(goalkeeperName)) {
                // Check if this penalty save was in this match (if MATCH_ID exists in HOWPENMISSED)
                if (!penRecord.MATCH_ID || normalizeStr(penRecord.MATCH_ID) === normalizeStr(match.MATCH_ID)) {
                    penaltySaves++;
                }
            }
        });
        
        // Format date properly
        let formattedDate = match.DATE || '';
        console.log('Raw date value:', formattedDate, 'Type:', typeof formattedDate);
        
        if (formattedDate) {
            try {
                // Check if it's an Excel serial number
                const numericDate = parseFloat(formattedDate);
                console.log('Numeric date:', numericDate);
                
                if (!isNaN(numericDate) && numericDate > 25000) {
                    // Convert Excel date serial number to readable date
                    console.log('Converting Excel serial number:', numericDate);
                    const date = new Date((numericDate - 25569) * 86400 * 1000);
                    formattedDate = date.toLocaleDateString('en-GB'); // DD/MM/YYYY format
                    console.log('Converted date:', formattedDate);
                } else if (!isNaN(numericDate) && numericDate > 1000 && numericDate < 25000) {
                    // Try different Excel epoch (1900-01-01)
                    console.log('Converting with 1900 epoch:', numericDate);
                    const date = new Date((numericDate - 25569) * 86400 * 1000);
                    formattedDate = date.toLocaleDateString('en-GB');
                    console.log('Converted date:', formattedDate);
                } else if (!isNaN(numericDate) && numericDate > 40000) {
                    // Try OLE Automation date format
                    console.log('Converting OLE Automation date:', numericDate);
                    const date = new Date((numericDate - 25569) * 86400 * 1000);
                    formattedDate = date.toLocaleDateString('en-GB');
                    console.log('Converted date:', formattedDate);
                } else {
                    // Try to parse as regular date string
                    console.log('Trying to parse as date string');
                    const date = new Date(formattedDate);
                    if (!isNaN(date.getTime())) {
                        formattedDate = date.toLocaleDateString('en-GB');
                        console.log('Parsed date:', formattedDate);
                    } else {
                        console.log('Could not parse date, keeping original:', formattedDate);
                    }
                }
            } catch (e) {
                console.log('Error formatting date:', formattedDate, e);
            }
        }
        
        matchesData.push({
            date: formattedDate,
            dateRaw: match.DATE || '', // Keep original for sorting
            season: match.SEASON || '',
            opponentTeam: match['OPPONENT TEAM'] || '',
            goalsConceded: goalsConceded,
            penaltyGoals: penaltyGoals,
            penaltySaves: penaltySaves,
            cleanSheet: cleanSheet,
            matchId: match.MATCH_ID
        });
    });
    
    // Sort by date (newest first) - using raw date values for better accuracy
    matchesData.sort((a, b) => {
        const dateA = parseInt(a.dateRaw) || 0;
        const dateB = parseInt(b.dateRaw) || 0;
        return dateB - dateA; // Newest first (higher Excel serial number = newer date)
    });
    
    console.log(`Found ${matchesData.length} matches for goalkeeper ${goalkeeperName}`);
    return matchesData;
}

// Render goalkeeper matches table
function renderGKMatchesTable(matches) {
    console.log('=== RENDERING GK MATCHES TABLE ===');
    console.log(`Matches to render: ${matches.length}`);
    
    const tbody = document.querySelector('#gk-matches-table tbody');
    if (!tbody) {
        console.error('GK matches table tbody not found');
        return;
    }
    
    console.log('Found tbody element, clearing content...');
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        console.log('No matches found, showing empty message');
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align: center; color: #666;">No matches found</td>';
        tbody.appendChild(row);
        return;
    }
    
    console.log(`Rendering ${matches.length} matches...`);
    matches.forEach((match, index) => {
        console.log(`Rendering match ${index + 1}:`, match);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${match.date}</td>
            <td>${match.season}</td>
            <td>${match.opponentTeam}</td>
            <td>${match.goalsConceded}</td>
            <td>${match.penaltyGoals}</td>
            <td>${match.penaltySaves}</td>
            <td>${match.cleanSheet}</td>
        `;
        tbody.appendChild(row);
    });
    
    console.log('GK matches table rendered successfully');
}

// Load GK Championships
function loadGKChampionships(teamFilter = '') {
    console.log('=== LOADING GK CHAMPIONSHIPS ===');
    console.log('goalkeepersData:', goalkeepersData);
    console.log('selectedGoalkeeper:', goalkeepersData.selectedGoalkeeper);
    
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        console.log('No goalkeeper selected for championships');
        renderGKChampionshipsTable([]);
        return;
    }
    
    console.log(`Loading championships for goalkeeper: ${goalkeepersData.selectedGoalkeeper.name}, Team filter: ${teamFilter}`);
    
    // Check if we have Excel data
    const hasExcelData = window.cachedExcelData && Object.keys(window.cachedExcelData).length > 0;
    console.log('Has Excel data:', hasExcelData);
    console.log('Cached Excel data keys:', hasExcelData ? Object.keys(window.cachedExcelData) : 'No data');
    
    // Debug: Check what goalkeepers are available
    debugAvailableGoalkeepers(goalkeepersData.selectedGoalkeeper.name);
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK championships:', appliedFilters);
    
    const championships = getGKChampionshipsFromSheets(goalkeepersData.selectedGoalkeeper.name, teamFilter, appliedFilters);
    console.log(`Found ${championships.length} championships:`, championships);
    console.log('Rendering table...');
    renderGKChampionshipsTable(championships);
}

// Debug function to check available goalkeepers
function debugAvailableGoalkeepers(selectedGoalkeeperName) {
    console.log('=== DEBUGGING AVAILABLE GOALKEEPERS ===');
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    console.log(`Total GKDETAILS records: ${gkDetails.length}`);
    
    if (gkDetails.length > 0) {
        console.log('First 10 goalkeeper names in GKDETAILS:');
        gkDetails.slice(0, 10).forEach((record, index) => {
            console.log(`  ${index + 1}. "${record['PLAYER NAME']}"`);
        });
        
        console.log(`Looking for: "${selectedGoalkeeperName}"`);
        const exactMatch = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(selectedGoalkeeperName));
        console.log(`Exact matches: ${exactMatch.length}`);
        
        const caseInsensitiveMatch = gkDetails.filter(r => 
            normalizeStr(r['PLAYER NAME']).toLowerCase() === normalizeStr(selectedGoalkeeperName).toLowerCase()
        );
        console.log(`Case-insensitive matches: ${caseInsensitiveMatch.length}`);
        
        if (caseInsensitiveMatch.length > 0) {
            console.log('Sample matching record:', caseInsensitiveMatch[0]);
        }
    } else {
        console.log('No GKDETAILS records found!');
    }
}

// Excel: get goalkeeper championships from GKDETAILS and MATCHDETAILS
function getGKChampionshipsFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    console.log(`Getting championships for goalkeeper: ${goalkeeperName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    console.log('Data found:');
    console.log('- GKDETAILS records:', gkDetails.length);
    console.log('- MATCHDETAILS records:', matchDetails.length);
    console.log('- HOWPENMISSED records:', howPenMissed.length);
    console.log('- PLAYERDETAILS records:', playerDetails.length);
    
    if (!gkDetails.length || !matchDetails.length) {
        console.log('No goalkeeper or match details found');
        return [];
    }
    
    // Apply main filters to matches first (but exclude champion filter for championships tab)
    const filteredMatches = matchDetails.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true; // Skip empty filters
            if (key === 'champion') return true; // Don't filter by champion in championships tab
            
            const fieldMapping = {
                'matchId': 'MATCH_ID',
                'championSystem': 'CHAMPION SYSTEM',
                'season': 'SEASON',
                'ahlyManager': 'MANAGER AHLY',
                'opponentManager': 'MANAGER OPPONENT',
                'referee': 'REFREE',
                'round': 'ROUND',
                'hAN': 'H-A-N',
                'stadium': 'STADIUM',
                'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM',
                'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET',
                'penalties': 'PEN'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            
            const matchValue = normalizeStr(match[field] || '');
            const normalizedFilter = normalizeStr(filterValue);
            
            // Handle date filters
            if (key === 'dateFrom') {
                const matchDate = new Date(match.DATE);
                const filterDate = new Date(filterValue);
                return matchDate >= filterDate;
            }
            if (key === 'dateTo') {
                const matchDate = new Date(match.DATE);
                const filterDate = new Date(filterValue);
                return matchDate <= filterDate;
            }
            
            // Handle numeric filters
            if (key === 'goalsFor') {
                return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            }
            if (key === 'goalsAgainst') {
                return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            }
            
            return matchValue === normalizedFilter;
        });
    });
    
    // Get match IDs for filtered matches
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));
    
    // Filter goalkeeper records for the selected goalkeeper and optional team
    let gkRecords = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(goalkeeperName));
    if (teamFilter) {
        gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === normalizeStr(teamFilter));
    }
    
    // Filter by matches that passed the main filters
    gkRecords = gkRecords.filter(r => filteredMatchIds.has(r.MATCH_ID));
    
    if (gkRecords.length === 0) {
        console.log(`No records found for goalkeeper: ${goalkeeperName}`);
        return [];
    }
    
    // Get match IDs for this goalkeeper
    const matchIds = new Set(gkRecords.map(r => r.MATCH_ID).filter(id => id));
    
    // Get match details for these matches from filtered matches
    const matches = filteredMatches.filter(m => matchIds.has(m.MATCH_ID));
    
    // Group ALL goalkeepers by match and team to check if there were multiple GKs
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID;
        const gkTeam = normalizeStr(record.TEAM || '');
        const key = `${matchId}_${gkTeam}`;
        
        if (!allGKsByMatch.has(key)) {
            allGKsByMatch.set(key, []);
        }
        allGKsByMatch.get(key).push(record);
    });
    
    // Group by championship only
    const championshipStats = new Map();
    
    matches.forEach(match => {
        const gkRecord = gkRecords.find(r => r.MATCH_ID === match.MATCH_ID);
        if (!gkRecord) return;
        
        const elevenBackup = normalizeStr(gkRecord['11/BAKEUP'] || '');
        const matchId = gkRecord.MATCH_ID;
        const gkTeam = normalizeStr(gkRecord.TEAM || '');
        
        // Count ALL matches where goalkeeper played (starting or substitute)
        // const isStarting = elevenBackup === 'اساسي' || elevenBackup === '11';
        // if (!isStarting) return;
        
        const championship = match.CHAMPION || 'Unknown';
        const key = `${championship}`;
        
        if (!championshipStats.has(key)) {
            championshipStats.set(key, {
                championship: championship,
                matches: 0,
                goalsConceded: 0,
                cleanSheets: 0,
                penaltyGoals: 0,
                penaltySaves: 0,
                matchIds: new Set()
            });
        }
        
        const stats = championshipStats.get(key);
        stats.matches++;
        stats.matchIds.add(match.MATCH_ID);
        
        const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
        stats.goalsConceded += goalsConceded;
        
        // Clean sheet only if goalkeeper was THE ONLY ONE from his team in this match
        const matchKey = `${matchId}_${gkTeam}`;
        const allGKsInMatch = allGKsByMatch.get(matchKey) || [];
        const onlyOneGK = allGKsInMatch.length === 1;
        
        if (goalsConceded === 0 && onlyOneGK) {
            stats.cleanSheets++;
        }
        
        // Count penalty goals from PLAYERDETAILS for this match
        playerDetails.forEach(playerRecord => {
            if (normalizeStr(playerRecord.MATCH_ID) === normalizeStr(match.MATCH_ID)) {
                const typeNorm = normalizeStr(playerRecord.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
                const gaNorm = normalizeStr(playerRecord.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
                
                if (typeNorm === 'PENGOAL' || gaNorm === 'PENGOAL') {
                    const gkTeam = normalizeStr(gkRecord.TEAM || '');
                    const playerTeam = normalizeStr(playerRecord.TEAM || '');
                    
                    if (gkTeam !== playerTeam) {
                        stats.penaltyGoals++;
                    }
                }
            }
        });
    });
    
    // Count penalty saves from HOWPENMISSED for this goalkeeper
    const goalkeeperNameNorm = normalizeStr(goalkeeperName);
    howPenMissed.forEach(record => {
        const playerName = normalizeStr(record['PLAYER NAME'] || '');
        if (playerName === goalkeeperNameNorm) {
            // Check if this penalty save was in one of the goalkeeper's matches
            const matchId = record.MATCH_ID;
            if (matchId) {
                championshipStats.forEach(stats => {
                    if (stats.matchIds.has(matchId)) {
                        stats.penaltySaves++;
                    }
                });
            } else {
                // If no match ID, distribute evenly across all championships
                championshipStats.forEach(stats => {
                    stats.penaltySaves++;
                });
            }
        }
    });
    
    // Convert to array and sort by matches descending
    const championshipsData = Array.from(championshipStats.values())
        .sort((a, b) => (b.matches || 0) - (a.matches || 0));
    
    console.log(`Found ${championshipsData.length} championships for goalkeeper ${goalkeeperName}`);
    return championshipsData;
}

// Render goalkeeper championships table
function renderGKChampionshipsTable(championships) {
    console.log('=== RENDERING GK CHAMPIONSHIPS TABLE ===');
    console.log(`Championships to render: ${championships.length}`);
    
    const tbody = document.querySelector('#gk-championships-table tbody');
    if (!tbody) {
        console.error('GK championships table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (championships.length === 0) {
        console.log('No championships found, showing empty message');
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; color: #666;">No championships found</td>';
        tbody.appendChild(row);
        return;
    }
    
    championships.forEach((championship, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${championship.championship}</td>
            <td>${championship.matches}</td>
            <td>${championship.goalsConceded}</td>
            <td>${championship.cleanSheets}</td>
            <td>${championship.penaltyGoals}</td>
            <td>${championship.penaltySaves}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Add totals row
    const totals = championships.reduce((acc, item) => {
        acc.matches += parseInt(item.matches || 0);
        acc.goalsConceded += parseInt(item.goalsConceded || 0);
        acc.cleanSheets += parseInt(item.cleanSheets || 0);
        acc.penaltyGoals += parseInt(item.penaltyGoals || 0);
        acc.penaltySaves += parseInt(item.penaltySaves || 0);
        return acc;
    }, { matches: 0, goalsConceded: 0, cleanSheets: 0, penaltyGoals: 0, penaltySaves: 0 });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `
        <td>Total</td>
        <td>${totals.matches}</td>
        <td>${totals.goalsConceded}</td>
        <td>${totals.cleanSheets}</td>
        <td>${totals.penaltyGoals}</td>
        <td>${totals.penaltySaves}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log('GK championships table rendered successfully');
}

// Load GK Seasons
function loadGKSeasons(teamFilter = '') {
    console.log('=== LOADING GK SEASONS ===');
    console.log('goalkeepersData:', goalkeepersData);
    console.log('selectedGoalkeeper:', goalkeepersData.selectedGoalkeeper);
    
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        console.log('No goalkeeper selected for seasons');
        renderGKSeasonsTable([]);
        return;
    }
    
    console.log(`Loading seasons for goalkeeper: ${goalkeepersData.selectedGoalkeeper.name}, Team filter: ${teamFilter}`);
    
    // Check if we have Excel data
    const hasExcelData = window.cachedExcelData && Object.keys(window.cachedExcelData).length > 0;
    console.log('Has Excel data:', hasExcelData);
    console.log('Cached Excel data keys:', hasExcelData ? Object.keys(window.cachedExcelData) : 'No data');
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK seasons:', appliedFilters);
    
    const seasons = getGKSeasonsFromSheets(goalkeepersData.selectedGoalkeeper.name, teamFilter, appliedFilters);
    console.log(`Found ${seasons.length} seasons:`, seasons);
    console.log('Rendering table...');
    renderGKSeasonsTable(seasons);
}
// Excel: get goalkeeper seasons from GKDETAILS and MATCHDETAILS
function getGKSeasonsFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    console.log(`Getting seasons for goalkeeper: ${goalkeeperName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    console.log('Data found:');
    console.log('- GKDETAILS records:', gkDetails.length);
    console.log('- MATCHDETAILS records:', matchDetails.length);
    console.log('- HOWPENMISSED records:', howPenMissed.length);
    console.log('- PLAYERDETAILS records:', playerDetails.length);
    
    if (!gkDetails.length || !matchDetails.length) {
        console.log('No goalkeeper or match details found');
        return [];
    }
    
    // Apply main filters to matches first (but exclude season filter for seasons tab)
    const filteredMatches = matchDetails.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true;
            if (key === 'season') return true; // Don't filter by season in seasons tab
            
            const fieldMapping = {
                'matchId': 'MATCH_ID', 'championSystem': 'CHAMPION SYSTEM', 'champion': 'CHAMPION',
                'ahlyManager': 'MANAGER AHLY', 'opponentManager': 'MANAGER OPPONENT', 'referee': 'REFREE',
                'round': 'ROUND', 'hAN': 'H-A-N', 'stadium': 'STADIUM', 'ahlyTeam': 'AHLY TEAM',
                'opponentTeam': 'OPPONENT TEAM', 'result': 'W-D-L', 'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET', 'penalties': 'PEN'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            
            if (key === 'dateFrom') return new Date(match.DATE) >= new Date(filterValue);
            if (key === 'dateTo') return new Date(match.DATE) <= new Date(filterValue);
            if (key === 'goalsFor') return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            if (key === 'goalsAgainst') return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            
            return normalizeStr(match[field] || '') === normalizeStr(filterValue);
        });
    });
    
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));
    
    // Filter goalkeeper records for the selected goalkeeper and optional team
    let gkRecords = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(goalkeeperName));
    if (teamFilter) {
        gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === normalizeStr(teamFilter));
    }
    gkRecords = gkRecords.filter(r => filteredMatchIds.has(r.MATCH_ID));
    
    if (gkRecords.length === 0) {
        console.log(`No records found for goalkeeper: ${goalkeeperName}`);
        return [];
    }
    
    // Get match IDs for this goalkeeper
    const matchIds = new Set(gkRecords.map(r => r.MATCH_ID).filter(id => id));
    
    // Get match details for these matches from filtered matches
    const matches = filteredMatches.filter(m => matchIds.has(m.MATCH_ID));
    
    // Group ALL goalkeepers by match and team to check if there were multiple GKs
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID;
        const gkTeam = normalizeStr(record.TEAM || '');
        const key = `${matchId}_${gkTeam}`;
        
        if (!allGKsByMatch.has(key)) {
            allGKsByMatch.set(key, []);
        }
        allGKsByMatch.get(key).push(record);
    });
    
    // Group by season only
    const seasonStats = new Map();
    
    matches.forEach(match => {
        const gkRecord = gkRecords.find(r => r.MATCH_ID === match.MATCH_ID);
        if (!gkRecord) return;
        
        const elevenBackup = normalizeStr(gkRecord['11/BAKEUP'] || '');
        const matchId = gkRecord.MATCH_ID;
        const gkTeam = normalizeStr(gkRecord.TEAM || '');
        
        // Count ALL matches where goalkeeper played (starting or substitute)
        // const isStarting = elevenBackup === 'اساسي' || elevenBackup === '11';
        // if (!isStarting) return;
        
        const season = match.SEASON || 'Unknown';
        const key = `${season}`;
        
        if (!seasonStats.has(key)) {
            seasonStats.set(key, {
                season: season,
                matches: 0,
                goalsConceded: 0,
                cleanSheets: 0,
                penaltyGoals: 0,
                penaltySaves: 0,
                matchIds: new Set()
            });
        }
        
        const stats = seasonStats.get(key);
        stats.matches++;
        stats.matchIds.add(match.MATCH_ID);
        
        const goalsConceded = parseInt(gkRecord['GOALS CONCEDED'] || 0);
        stats.goalsConceded += goalsConceded;
        
        // Clean sheet only if goalkeeper was THE ONLY ONE from his team in this match
        const matchKey = `${matchId}_${gkTeam}`;
        const allGKsInMatch = allGKsByMatch.get(matchKey) || [];
        const onlyOneGK = allGKsInMatch.length === 1;
        
        if (goalsConceded === 0 && onlyOneGK) {
            stats.cleanSheets++;
        }
        
        // Count penalty goals from PLAYERDETAILS for this match
        playerDetails.forEach(playerRecord => {
            if (normalizeStr(playerRecord.MATCH_ID) === normalizeStr(match.MATCH_ID)) {
                const typeNorm = normalizeStr(playerRecord.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
                const gaNorm = normalizeStr(playerRecord.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
                
                if (typeNorm === 'PENGOAL' || gaNorm === 'PENGOAL') {
                    const gkTeam = normalizeStr(gkRecord.TEAM || '');
                    const playerTeam = normalizeStr(playerRecord.TEAM || '');
                    
                    if (gkTeam !== playerTeam) {
                        stats.penaltyGoals++;
                    }
                }
            }
        });
    });
    
    // Count penalty saves from HOWPENMISSED for this goalkeeper
    const goalkeeperNameNorm = normalizeStr(goalkeeperName);
    howPenMissed.forEach(record => {
        const playerName = normalizeStr(record['PLAYER NAME'] || '');
        if (playerName === goalkeeperNameNorm) {
            // Check if this penalty save was in one of the goalkeeper's matches
            const matchId = record.MATCH_ID;
            if (matchId) {
                seasonStats.forEach(stats => {
                    if (stats.matchIds.has(matchId)) {
                        stats.penaltySaves++;
                    }
                });
            } else {
                // If no match ID, distribute evenly across all seasons
                seasonStats.forEach(stats => {
                    stats.penaltySaves++;
                });
            }
        }
    });
    
    // Convert to array and sort by season (same logic as player seasons)
    const seasonsData = Array.from(seasonStats.values())
        .sort((a, b) => {
            // Parse season years for proper sorting (same as player seasons)
            function parseSeasonYears(s) {
                const m = String(s || '').match(/(\d{4})\s*[-/]\s*(\d{2,4})/);
                if (!m) return { start: -Infinity, end: -Infinity };
                const start = parseInt(m[1], 10);
                const end = m[2].length === 2 ? (Math.floor(start / 100) * 100 + parseInt(m[2], 10)) : parseInt(m[2], 10);
                return { start, end };
            }
            
            const nameA = String(a.season || '').toLowerCase();
            const nameB = String(b.season || '').toLowerCase();
            if (nameA !== nameB) return nameA.localeCompare(nameB);
            const ya = parseSeasonYears(a.season);
            const yb = parseSeasonYears(b.season);
            // Newest first by start, then end
            if (yb.start !== ya.start) return yb.start - ya.start;
            return yb.end - ya.end;
        });
    
    console.log(`Found ${seasonsData.length} seasons for goalkeeper ${goalkeeperName}`);
    return seasonsData;
}
// Render goalkeeper seasons table
function renderGKSeasonsTable(seasons) {
    console.log('=== RENDERING GK SEASONS TABLE ===');
    console.log(`Seasons to render: ${seasons.length}`);
    
    const tbody = document.querySelector('#gk-seasons-table tbody');
    if (!tbody) {
        console.error('GK seasons table tbody not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (seasons.length === 0) {
        console.log('No seasons found, showing empty message');
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align: center; color: #666;">No seasons found</td>';
        tbody.appendChild(row);
        return;
    }
    
    seasons.forEach((season, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${season.season}</td>
            <td>${season.matches}</td>
            <td>${season.goalsConceded}</td>
            <td>${season.cleanSheets}</td>
            <td>${season.penaltyGoals}</td>
            <td>${season.penaltySaves}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Add totals row
    const totals = seasons.reduce((acc, item) => {
        acc.matches += parseInt(item.matches || 0);
        acc.goalsConceded += parseInt(item.goalsConceded || 0);
        acc.cleanSheets += parseInt(item.cleanSheets || 0);
        acc.penaltyGoals += parseInt(item.penaltyGoals || 0);
        acc.penaltySaves += parseInt(item.penaltySaves || 0);
        return acc;
    }, { matches: 0, goalsConceded: 0, cleanSheets: 0, penaltyGoals: 0, penaltySaves: 0 });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `
        <td>Total</td>
        <td>${totals.matches}</td>
        <td>${totals.goalsConceded}</td>
        <td>${totals.cleanSheets}</td>
        <td>${totals.penaltyGoals}</td>
        <td>${totals.penaltySaves}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log('GK seasons table rendered successfully');
}

// Load GK VS Teams
function loadGKVsTeams(teamFilter = '') {
    console.log('=== LOADING GK VS TEAMS ===');
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        renderGKVsTeamsTable([]);
        return;
    }
    
    console.log(`Loading vs teams for goalkeeper: ${goalkeepersData.selectedGoalkeeper.name}, Team filter: ${teamFilter}`);
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK vs teams:', appliedFilters);
    
    const items = getGKVsTeamsFromSheets(goalkeepersData.selectedGoalkeeper.name, teamFilter, appliedFilters);
    renderGKVsTeamsTable(items);
}

// Excel: aggregate goalkeeper vs teams
function getGKVsTeamsFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    console.log(`Getting vs teams for goalkeeper: ${goalkeeperName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);

    if (!gkDetails.length || !matchDetails.length) return [];

    // Apply main filters to matches (but exclude opponent team filter for vs teams tab)
    const filteredMatches = matchDetails.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true;
            if (key === 'opponentTeam') return true; // Don't filter by opponent team in vs teams tab
            
            const fieldMapping = {
                'matchId': 'MATCH_ID', 'championSystem': 'CHAMPION SYSTEM', 'champion': 'CHAMPION',
                'season': 'SEASON', 'ahlyManager': 'MANAGER AHLY', 'opponentManager': 'MANAGER OPPONENT',
                'referee': 'REFREE', 'round': 'ROUND', 'hAN': 'H-A-N', 'stadium': 'STADIUM',
                'ahlyTeam': 'AHLY TEAM', 'result': 'W-D-L', 'cleanSheet': 'CLEAN SHEET',
                'extraTime': 'ET', 'penalties': 'PEN'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            if (key === 'dateFrom') return new Date(match.DATE) >= new Date(filterValue);
            if (key === 'dateTo') return new Date(match.DATE) <= new Date(filterValue);
            if (key === 'goalsFor') return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            if (key === 'goalsAgainst') return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            return normalizeStr(match[field] || '') === normalizeStr(filterValue);
        });
    });
    
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));

    let gkRecords = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(goalkeeperName));
    if (teamFilter) {
        gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === normalizeStr(teamFilter));
    }
    gkRecords = gkRecords.filter(r => filteredMatchIds.has(r.MATCH_ID));
    if (gkRecords.length === 0) return [];

    // Map matchId -> opponent team (only for filtered matches)
    const matchIdToOpponent = new Map();
    filteredMatches.forEach(m => {
        const mid = m.MATCH_ID;
        if (mid) matchIdToOpponent.set(mid, normalizeStr(m['OPPONENT TEAM'] || m.OPPONENT || m['OPPONENT']));
    });

    // Group ALL goalkeepers by match and team to check if there were multiple GKs
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID;
        const gkTeam = normalizeStr(record.TEAM || '');
        const key = `${matchId}_${gkTeam}`;
        
        if (!allGKsByMatch.has(key)) {
            allGKsByMatch.set(key, []);
        }
        allGKsByMatch.get(key).push(record);
    });

    const perTeam = new Map(); // team -> stats

    gkRecords.forEach(gk => {
        const mid = gk.MATCH_ID;
        if (!mid) return;
        const opponentTeam = matchIdToOpponent.get(mid) || 'Unknown';

        const elevenBackup = normalizeStr(gk['11/BAKEUP'] || '');
        const gkTeam = normalizeStr(gk.TEAM || '');
        
        // Count ALL matches where goalkeeper played (starting or substitute)
        // const isStarting = elevenBackup === 'اساسي' || elevenBackup === '11';
        // if (!isStarting) return;

        if (!perTeam.has(opponentTeam)) {
            perTeam.set(opponentTeam, {
                team: opponentTeam,
                matches: 0,
                goalsConceded: 0,
                cleanSheets: 0,
                penaltyGoals: 0,
                penaltySaves: 0
            });
        }
        const stats = perTeam.get(opponentTeam);
        stats.matches++;

        const goalsConceded = parseInt(gk['GOALS CONCEDED'] || 0);
        stats.goalsConceded += goalsConceded;
        
        // Clean sheet only if goalkeeper was THE ONLY ONE from his team in this match
        const matchKey = `${mid}_${gkTeam}`;
        const allGKsInMatch = allGKsByMatch.get(matchKey) || [];
        const onlyOneGK = allGKsInMatch.length === 1;
        
        if (goalsConceded === 0 && onlyOneGK) {
            stats.cleanSheets++;
        }

        // Penalty goals against GK from PLAYERDETAILS for that match
        playerDetails.forEach(p => {
            if (normalizeStr(p.MATCH_ID) === normalizeStr(mid)) {
                const typeNorm = normalizeStr(p.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
                const gaNorm = normalizeStr(p.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
                if (typeNorm === 'PENGOAL' || gaNorm === 'PENGOAL') {
                    const gkTeam = normalizeStr(gk.TEAM || '');
                    const playerTeam = normalizeStr(p.TEAM || '');
                    if (gkTeam !== playerTeam) {
                        stats.penaltyGoals++;
                    }
                }
            }
        });
    });

    // Penalty saves from HOWPENMISSED, attributed to team if match known
    const gkNameNorm = normalizeStr(goalkeeperName);
    howPenMissed.forEach(rec => {
        if (normalizeStr(rec['PLAYER NAME']) === gkNameNorm) {
            const mid = rec.MATCH_ID;
            if (mid) {
                const team = matchIdToOpponent.get(mid) || 'Unknown';
                const stats = perTeam.get(team);
                if (stats) stats.penaltySaves++;
            } else {
                // No match id: distribute (increment all)
                perTeam.forEach(s => { s.penaltySaves++; });
            }
        }
    });

    return Array.from(perTeam.values()).sort((a, b) => (b.matches || 0) - (a.matches || 0));
}

// Render GK vs Teams table
function renderGKVsTeamsTable(items) {
    const tbody = document.querySelector('#gk-vs-teams-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!items || items.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align:center;color:#666;">No vs teams data</td>';
        tbody.appendChild(row);
        return;
    }

    let totals = { matches: 0, goalsConceded: 0, cleanSheets: 0, penaltyGoals: 0, penaltySaves: 0 };

    items.forEach(it => {
        totals.matches += it.matches || 0;
        totals.goalsConceded += it.goalsConceded || 0;
        totals.cleanSheets += it.cleanSheets || 0;
        totals.penaltyGoals += it.penaltyGoals || 0;
        totals.penaltySaves += it.penaltySaves || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${it.team}</td>
            <td>${it.matches}</td>
            <td>${it.goalsConceded}</td>
            <td>${it.cleanSheets}</td>
            <td>${it.penaltyGoals}</td>
            <td>${it.penaltySaves}</td>
        `;
        tbody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `
        <td>Total</td>
        <td>${totals.matches}</td>
        <td>${totals.goalsConceded}</td>
        <td>${totals.cleanSheets}</td>
        <td>${totals.penaltyGoals}</td>
        <td>${totals.penaltySaves}</td>
    `;
    tbody.appendChild(totalRow);
}

// Load GK VS Players
function loadGKVsPlayers(teamFilter = '') {
    console.log('=== LOADING GK VS PLAYERS ===');
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        renderGKVsPlayersTable([]);
        return;
    }
    
    console.log(`Loading vs players for goalkeeper: ${goalkeepersData.selectedGoalkeeper.name}, Team filter: ${teamFilter}`);
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK vs players:', appliedFilters);
    
    const items = getGKVsPlayersFromSheets(goalkeepersData.selectedGoalkeeper.name, teamFilter, appliedFilters);
    renderGKVsPlayersTable(items);
}

// Excel: aggregate which players scored vs this GK, with pen goals and pen saves
function getGKVsPlayersFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    console.log(`Getting vs players for goalkeeper: ${goalkeeperName}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const gkRows = getSheetRowsByCandidates(['GKDETAILS']);
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);

    if (!details.length || !gkRows.length) return [];

    // Apply main filters to matches
    const filteredMatches = matches.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true;
            
            const fieldMapping = {
                'matchId': 'MATCH_ID', 'championSystem': 'CHAMPION SYSTEM', 'champion': 'CHAMPION',
                'season': 'SEASON', 'ahlyManager': 'MANAGER AHLY', 'opponentManager': 'MANAGER OPPONENT',
                'referee': 'REFREE', 'round': 'ROUND', 'hAN': 'H-A-N', 'stadium': 'STADIUM',
                'ahlyTeam': 'AHLY TEAM', 'opponentTeam': 'OPPONENT TEAM', 'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET', 'extraTime': 'EXTRA TIME', 'penalties': 'PKS'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            if (key === 'dateFrom') return new Date(match.DATE) >= new Date(filterValue);
            if (key === 'dateTo') return new Date(match.DATE) <= new Date(filterValue);
            if (key === 'goalsFor') return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            if (key === 'goalsAgainst') return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            return normalizeStr(match[field] || '') === normalizeStr(filterValue);
        });
    });
    
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));

    const targetGKNorm = normalizeStr(goalkeeperName);
    
    // Filter gkRows by team if teamFilter is provided - but keep ALL GKs for proper substitution logic
    let filteredGKRows = gkRows.filter(r => {
        const gkName = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player);
        if (gkName !== targetGKNorm) return false;
        if (teamFilter && normalizeStr(r.TEAM || r['TEAM'] || r.team) !== normalizeStr(teamFilter)) return false;
        return filteredMatchIds.has(r.MATCH_ID);
    });

    // Get all GK rows for proper substitution tracking (not filtered by goalkeeper name)
    let allGKRows = gkRows.filter(r => {
        return filteredMatchIds.has(r.MATCH_ID);
    });

    // For each player goal, check if it was against this GK in the same match
    const perPlayer = new Map(); // player -> { goals, pen_goals, pen_saved }

    details.forEach(r => {
        const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!mid) return;
        const goalsType = normalizeStr(r.GA).toUpperCase();
        const typeNorm = normalizeStr(r.TYPE).toUpperCase().replace(/[^A-Z]/g, '');
        const minute = parseInt(r.MINUTE || 0) || 0;
        const playerName = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player);
        const playerTeam = normalizeStr(r.TEAM || r['AHLYTEAM'] || r.team);

        // Get all GKs for this match (use ALL GK rows for proper substitution logic)
        const matchGKs = allGKRows.filter(g => {
            const gkMid = normalizeStr(g.MATCH_ID || g['MATCH ID'] || g.match_id);
            return gkMid === mid;
        });

        if (matchGKs.length === 0) return;

        // Find target GK in this match
        const targetGKInMatch = matchGKs.find(g => normalizeStr(g['PLAYER NAME'] || g.PLAYER || g.player) === targetGKNorm);
        if (!targetGKInMatch) return;

        // Check if this match is in the filtered GK rows (respects team filter)
        const isInFilteredMatches = filteredGKRows.some(fgk => fgk.MATCH_ID === mid);
        if (!isInFilteredMatches) return;

        // Get target GK's team
        const gkTeam = normalizeStr(targetGKInMatch.TEAM || targetGKInMatch['AHLYTEAM'] || targetGKInMatch.team);
        
        // Skip goals by same team as the target GK
        if (gkTeam === playerTeam) return;

        // Get all GKs from the same team as target GK in this match
        const sameTeamGKs = matchGKs.filter(g => {
            const gTeam = normalizeStr(g.TEAM || g['AHLY TEAM'] || g.team);
            return gTeam === gkTeam;
        });

        // Determine responsible GK based on new logic
        let responsibleGK = null;

        if (sameTeamGKs.length === 1) {
            // Only one GK from this team - they take all goals
            responsibleGK = sameTeamGKs[0];
        } else {
            // Multiple GKs from same team - new logic
            // Step 1: Check which GKs conceded goals
            const gksWithGoals = sameTeamGKs.filter(g => {
                const goalsConceded = parseInt(g['GOALS CONCEDED'] || 0);
                return goalsConceded > 0;
            });
            
            if (gksWithGoals.length === 1) {
                // Only one GK conceded goals - assign all goals to them
                responsibleGK = gksWithGoals[0];
            } else if (gksWithGoals.length > 1) {
                // Both GKs conceded goals - match by minute
                // Compare MINUTE from PLAYERDETAILS with GOAL MINUTE from GKDETAILS
                // Note: GOAL MINUTE can have multiple minutes separated by #
                
                const goalMinuteStr = minute.toString().trim();
                
                for (const gk of sameTeamGKs) {
                    const goalMinuteField = (gk['GOAL MINUTE'] || '').toString().trim();
                    if (!goalMinuteField) continue;
                    
                    // Split by # to get all goal minutes for this GK
                    const goalMinutes = goalMinuteField.split('#').map(m => m.trim());
                    
                    // Check if goal minute matches any of the GK's goal minutes
                    if (goalMinutes.includes(goalMinuteStr)) {
                        responsibleGK = gk;
                        break;
                    }
                }
                
                // If no match found, don't assign to anyone (wait for GOAL MINUTE to be filled)
                // responsibleGK stays null
            } else {
                // No GK conceded goals (shouldn't happen if there's a goal)
                // Fallback to first GK
                responsibleGK = sameTeamGKs[0];
            }
        }

        // Only count if responsible GK is our target GK
        if (!responsibleGK || normalizeStr(responsibleGK['PLAYER NAME'] || responsibleGK.PLAYER || responsibleGK.player) !== targetGKNorm) return;

        // Count the goal
        if (goalsType === 'GOAL' || typeNorm === 'PENGOAL' || goalsType.replace(/[^A-Z]/g,'') === 'PENGOAL') {
            if (!perPlayer.has(playerName)) perPlayer.set(playerName, { player: playerName, goals: 0, pen_goals: 0, pen_saved: 0 });
            const agg = perPlayer.get(playerName);
            if (typeNorm === 'PENGOAL' || goalsType.replace(/[^A-Z]/g,'') === 'PENGOAL') {
                agg.pen_goals += 1;
                agg.goals += 1;
            } else if (goalsType === 'GOAL') {
                agg.goals += 1;
            }
        }
    });

    // Count penalty saves for this GK from PLAYERDETAILS where GA = PENMISSED
    details.forEach(r => {
        const gaType = normalizeStr(r.GA || '').toUpperCase();
        if (gaType !== 'PENMISSED') return;

        const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!mid) return;

        const penMinute = parseInt(r.MINUTE || 0) || 0;
        const shooterName = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player);
        const shooterTeam = normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team);

        // Check if target GK was in this match (use filtered GK rows)
        const targetGKInMatch = filteredGKRows.find(g => {
            const gkMid = normalizeStr(g.MATCH_ID || g['MATCH ID'] || g.match_id);
            const gkName = normalizeStr(g['PLAYER NAME'] || g.PLAYER || g.player);
            return gkMid === mid && gkName === targetGKNorm;
        });

        if (!targetGKInMatch) return;

        // Check if this penalty save matches with HOWPENMISSED by minute
        const matchingPenMissed = howPenMissed.find(hpm => {
            const hpmMid = normalizeStr(hpm.MATCH_ID || hpm['MATCH ID'] || hpm.match_id);
            const hpmMinute = parseInt(hpm.MINUTE || 0) || 0;
            const hpmGK = normalizeStr(hpm['PLAYER NAME'] || hpm.GK || hpm.goalkeeper);
            return hpmMid === mid && hpmMinute === penMinute && hpmGK === targetGKNorm;
        });

        if (!matchingPenMissed) return;

        // Get GK team to verify shooter is from opponent
        const gkTeam = normalizeStr(targetGKInMatch.TEAM || targetGKInMatch['AHLY TEAM'] || targetGKInMatch.team);
        if (gkTeam === shooterTeam) return;

        // Add penalty save to this shooter
        if (!perPlayer.has(shooterName)) perPlayer.set(shooterName, { player: shooterName, goals: 0, pen_goals: 0, pen_saved: 0 });
        perPlayer.get(shooterName).pen_saved += 1;
    });

    // Sort by total goals desc, then pen goals desc
    return Array.from(perPlayer.values()).sort((a,b) => (b.goals - a.goals) || (b.pen_goals - a.pen_goals));
}

function renderGKVsPlayersTable(items) {
    const tbody = document.querySelector('#gk-vs-players-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#666;">No players found</td></tr>';
        return;
    }

    let totals = { goals: 0, pen_goals: 0, pen_saved: 0 };
    items.forEach(it => {
        totals.goals += it.goals || 0;
        totals.pen_goals += it.pen_goals || 0;
        totals.pen_saved += it.pen_saved || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${it.player}</td>
            <td>${it.goals}</td>
            <td>${it.pen_goals}</td>
            <td>${it.pen_saved}</td>
        `;
        tbody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.innerHTML = `
        <td>Total</td>
        <td>${totals.goals}</td>
        <td>${totals.pen_goals}</td>
        <td>${totals.pen_saved}</td>
    `;
    tbody.appendChild(totalRow);
}
// GK Sub-tab switching functionality
function showGKSubTab(evt, subTabName) {
    console.log('=== SHOWING GK SUB TAB ===');
    console.log('Sub-tab name:', subTabName);
    console.log('Event:', evt);
    
    // Hide all GK sub-tab contents
    const subTabContents = document.querySelectorAll('#gk-tab .player-sub-tab-content');
    console.log('Found sub-tab contents:', subTabContents.length);
    subTabContents.forEach(content => {
        console.log('Hiding:', content.id);
        content.classList.remove('active');
    });
    
    // Remove active class from all GK sub-tabs within GK section
    const subTabs = document.querySelectorAll('#gk-tab .stats-sub-tab');
    console.log('Found sub-tabs:', subTabs.length);
    subTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected GK sub-tab content
    const targetElement = document.getElementById('gk-' + subTabName + '-sub');
    console.log('Looking for element with ID: gk-' + subTabName + '-sub');
    console.log('Target element found:', targetElement);
    console.log('Target element classes before:', targetElement ? targetElement.className : 'N/A');
    
    if (targetElement) {
        targetElement.classList.add('active');
        console.log('Added active class to:', targetElement.id);
        console.log('Target element classes after:', targetElement.className);
        console.log('Target element style.display:', targetElement.style.display);
    } else {
        console.error('Target element not found: gk-' + subTabName + '-sub');
        console.log('Available GK sub-tab elements:');
        const allGKSubTabs = document.querySelectorAll('#gk-tab [id$="-sub"]');
        allGKSubTabs.forEach(el => console.log('- ' + el.id));
    }
    
    // Add active class to clicked GK sub-tab
    if (evt && evt.target) {
        evt.target.classList.add('active');
        console.log('Added active class to clicked tab');
    }
    
    // Load data for the selected sub-tab
    console.log('Checking if loadGKSubTabData function exists:', typeof loadGKSubTabData);
    if (typeof loadGKSubTabData === 'function') {
        console.log('Calling loadGKSubTabData...');
        loadGKSubTabData(subTabName);
    } else {
        console.error('loadGKSubTabData function not found!');
    }
}

// Load GK sub-tab data based on current selection
function loadGKSubTabData(subTabName) {
    console.log(`Loading GK sub-tab data for: ${subTabName}`);
    const selectedGoalkeeper = goalkeepersData.selectedGoalkeeper;
    if (!selectedGoalkeeper || !selectedGoalkeeper.name) {
        console.log('No goalkeeper selected for sub-tab data');
        return;
    }
    
    // Get team filter from dropdown
    const teamFilter = document.getElementById('gk-team-filter') ? document.getElementById('gk-team-filter').value : '';
    console.log(`Team filter for sub-tab: ${teamFilter}`);
    
    switch(subTabName) {
        case 'overview':
            console.log('Loading GK overview stats...');
            loadGKOverviewStats(selectedGoalkeeper.name, teamFilter);
            break;
        case 'matches':
            console.log('Loading GK matches...');
            loadGKMatches(teamFilter);
            break;
        case 'championships':
            console.log('Loading GK championships...');
            loadGKChampionships(teamFilter);
            break;
        case 'vs-teams':
            console.log('Loading GK vs teams...');
            loadGKVsTeams(teamFilter);
            break;
        case 'vs-players':
            console.log('Loading GK vs players...');
            loadGKVsPlayers(teamFilter);
            break;
        case 'seasons':
            console.log('Loading GK seasons...');
            loadGKSeasons(teamFilter);
            break;
        default:
            console.log(`Unknown GK sub-tab: ${subTabName}`);
    }
}
// Load GK Overview statistics
function loadGKOverview() {
    if (!goalkeepersData.selectedGoalkeeper || !goalkeepersData.selectedGoalkeeper.name) {
        // Reset all cards to 0 when no goalkeeper is selected
        updateGKOverviewCards({
            total_matches: 0,
            clean_sheets: 0,
            goals_conceded: 0,
            clean_sheet_percentage: 0,
            avg_goals_conceded: 0,
            penalty_goals: 0,
            penalty_saves: 0,
            penalties_missed: 0
        });
        return;
    }
    
    // Load goalkeeper overview statistics
    loadGKOverviewStats(goalkeepersData.selectedGoalkeeper.name);
}

// Function to load goalkeeper overview statistics
async function loadGKOverviewStats(goalkeeperName, teamFilter = '') {
    console.log(`Loading overview stats for goalkeeper: ${goalkeeperName}, Team filter: ${teamFilter}`);
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for GK overview:', appliedFilters);
    
    // Get goalkeeper stats from Excel
    const stats = getGoalkeeperStatsFromSheets(goalkeeperName, teamFilter, appliedFilters);
    
    updateGKOverviewCards({
        total_matches: stats.totalMatches,
        clean_sheets: stats.cleanSheets,
        goals_conceded: stats.goalsConceded,
        clean_sheet_percentage: stats.cleanSheetPercentage,
        avg_goals_conceded: stats.avgGoalsConceded,
        penalty_goals: stats.penaltyGoals,
        penalty_saves: stats.penaltySaves,
        penalties_missed: stats.penaltiesMissed,
        longest_conceding_streak: stats.longestConcedingStreak,
        longest_clean_sheet_streak: stats.longestCleanSheetStreak
    });
}
// Calculate goalkeeper streaks (consecutive matches)
function calculateGKStreaks(gkRecords, filteredMatches, goalkeeperName) {
    if (!gkRecords || gkRecords.length === 0) {
        return {
            longestConcedingStreak: 0,
            longestCleanSheetStreak: 0,
            concedingStreakMatches: [],
            cleanSheetStreakMatches: []
        };
    }
    
    // Sort matches by date
    const matchesMap = new Map();
    filteredMatches.forEach(match => {
        matchesMap.set(match.MATCH_ID, match);
    });
    
    // Sort GK records by match date
    const sortedRecords = [...gkRecords]
        .map(record => ({
            ...record,
            matchDate: matchesMap.get(record.MATCH_ID)?.DATE || '',
            matchInfo: matchesMap.get(record.MATCH_ID)
        }))
        .filter(record => record.matchDate)
        .sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    
    let longestConcedingStreak = 0;
    let currentConcedingStreak = 0;
    let currentConcedingMatches = [];
    let longestConcedingMatches = [];
    
    let longestCleanSheetStreak = 0;
    let currentCleanSheetStreak = 0;
    let currentCleanSheetMatches = [];
    let longestCleanSheetMatches = [];
    
    // Get LINEUPDETAILS to fetch accurate MINTOTAL
    const lineupDetails = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const lineupMap = new Map();
    
    // Build map of match_id + player_name -> minutes from LINEUPDETAILS
    const goalkeeperNameNorm = normalizeStr(goalkeeperName);
    lineupDetails.forEach(lineup => {
        const matchId = lineup.MATCH_ID;
        const playerName = normalizeStr(lineup['PLAYER NAME'] || lineup.PLAYER || '');
        const minutes = parseInt(lineup.MINTOTAL || 0);
        const key = `${matchId}_${playerName}`;
        lineupMap.set(key, minutes);
    });
    
    sortedRecords.forEach(record => {
        const goalsConceded = parseInt(record['GOALS CONCEDED'] || 0);
        
        // Get minutes from LINEUPDETAILS using match ID and goalkeeper name
        const matchId = record.MATCH_ID;
        const key = `${matchId}_${goalkeeperNameNorm}`;
        const minutesPlayed = lineupMap.get(key) || 0;
        
        if (goalsConceded > 0) {
            // Conceding streak
            currentConcedingStreak++;
            currentConcedingMatches.push({
                date: record.matchDate,
                season: record.matchInfo?.SEASON || '',
                opponent: record.matchInfo?.['OPPONENT TEAM'] || '',
                minutesPlayed: minutesPlayed,
                goalsConceded: goalsConceded
            });
            
            if (currentConcedingStreak > longestConcedingStreak) {
                longestConcedingStreak = currentConcedingStreak;
                longestConcedingMatches = [...currentConcedingMatches];
            }
            
            // Reset clean sheet streak
            currentCleanSheetStreak = 0;
            currentCleanSheetMatches = [];
        } else {
            // Clean sheet streak
            currentCleanSheetStreak++;
            currentCleanSheetMatches.push({
                date: record.matchDate,
                season: record.matchInfo?.SEASON || '',
                opponent: record.matchInfo?.['OPPONENT TEAM'] || '',
                minutesPlayed: minutesPlayed,
                goalsConceded: goalsConceded
            });
            
            if (currentCleanSheetStreak > longestCleanSheetStreak) {
                longestCleanSheetStreak = currentCleanSheetStreak;
                longestCleanSheetMatches = [...currentCleanSheetMatches];
            }
            
            // Reset conceding streak
            currentConcedingStreak = 0;
            currentConcedingMatches = [];
        }
    });
    
    return {
        longestConcedingStreak,
        longestCleanSheetStreak,
        concedingStreakMatches: longestConcedingMatches,
        cleanSheetStreakMatches: longestCleanSheetMatches
    };
}

// Excel: calculate goalkeeper statistics from GKDETAILS and MATCHDETAILS
function getGoalkeeperStatsFromSheets(goalkeeperName, teamFilter = '', appliedFilters = {}) {
    
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
    
    if (!gkDetails.length || !matchDetails.length) {
        return {
            totalMatches: 0,
            cleanSheets: 0,
            goalsConceded: 0,
            cleanSheetPercentage: 0,
            penaltyGoals: 0,
            penaltySaves: 0,
            penaltiesMissed: 0
        };
    }
    
    // Apply main filters to matches
    const filteredMatches = matchDetails.filter(match => {
        return Object.keys(appliedFilters).every(key => {
            const filterValue = appliedFilters[key];
            if (!filterValue) return true;
            
            const fieldMapping = {
                'matchId': 'MATCH_ID', 'championSystem': 'CHAMPION SYSTEM', 'champion': 'CHAMPION',
                'season': 'SEASON', 'ahlyManager': 'MANAGER AHLY', 'opponentManager': 'MANAGER OPPONENT',
                'referee': 'REFREE', 'round': 'ROUND', 'hAN': 'H-A-N', 'stadium': 'STADIUM',
                'ahlyTeam': 'AHLY TEAM', 'opponentTeam': 'OPPONENT TEAM', 'result': 'W-D-L',
                'cleanSheet': 'CLEAN SHEET', 'extraTime': 'EXTRA TIME', 'penalties': 'PKS'
            };
            
            const field = fieldMapping[key];
            if (!field) return true;
            if (key === 'dateFrom') return new Date(match.DATE) >= new Date(filterValue);
            if (key === 'dateTo') return new Date(match.DATE) <= new Date(filterValue);
            if (key === 'goalsFor') return parseInt(match['GOALS FOR'] || 0) >= parseInt(filterValue);
            if (key === 'goalsAgainst') return parseInt(match['GOALS AGAINST'] || 0) <= parseInt(filterValue);
            return normalizeStr(match[field] || '') === normalizeStr(filterValue);
        });
    });
    
    const filteredMatchIds = new Set(filteredMatches.map(m => m.MATCH_ID));
    
    // Filter goalkeeper records for the selected goalkeeper
    let gkRecords = gkDetails.filter(r => normalizeStr(r['PLAYER NAME']) === normalizeStr(goalkeeperName));
    
    // Apply team filter if specified
    if (teamFilter) {
        if (teamFilter === 'WITH_AHLY') {
            // Filter to only Al Ahly team (exact match)
            gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === 'الأهلي');
        } else if (teamFilter === 'AGAINST_AHLY') {
            // Filter to exclude Al Ahly team
            gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) !== 'الأهلي');
        } else {
            // Filter by exact team name (for individual GK Statistics page)
            gkRecords = gkRecords.filter(r => normalizeStr(r.TEAM || r['AHLY TEAM'] || r.team) === normalizeStr(teamFilter));
        }
    }
    
    // Filter by matches that passed the main filters
    gkRecords = gkRecords.filter(r => filteredMatchIds.has(r.MATCH_ID));
    
    if (gkRecords.length === 0) {
        return {
            totalMatches: 0,
            cleanSheets: 0,
            goalsConceded: 0,
            cleanSheetPercentage: 0,
            penaltyGoals: 0,
            penaltySaves: 0,
            penaltiesMissed: 0
        };
    }
    
    // Calculate statistics
    let totalMatches = 0;
    let goalsConceded = 0;
    let cleanSheets = 0;
    let penaltyGoals = 0;
    let penaltySaves = 0;
    let penaltiesMissed = 0;
    
    // Group ALL goalkeepers by match and team to check if there were multiple GKs
    const allGKsByMatch = new Map();
    gkDetails.forEach(record => {
        const matchId = record.MATCH_ID;
        const gkTeam = normalizeStr(record.TEAM || '');
        const key = `${matchId}_${gkTeam}`;
        
        if (!allGKsByMatch.has(key)) {
            allGKsByMatch.set(key, []);
        }
        allGKsByMatch.get(key).push(record);
    });
    
    // Calculate statistics directly from GKDETAILS
    gkRecords.forEach(record => {
        const goalsConcededValue = parseInt(record['GOALS CONCEDED'] || 0);
        const elevenBackup = normalizeStr(record['11/BAKEUP'] || '');
        const matchId = record.MATCH_ID;
        const gkTeam = normalizeStr(record.TEAM || '');
        const key = `${matchId}_${gkTeam}`;
        
        // Count ALL matches where goalkeeper played (starting or substitute)
        // const isStarting = elevenBackup === 'اساسي' || elevenBackup === '11';
        
        // if (isStarting) {
            totalMatches++;
            goalsConceded += goalsConcededValue;
            
            // Clean sheet only if goalkeeper was THE ONLY ONE from his team in this match
            const allGKsInMatch = allGKsByMatch.get(key) || [];
            const onlyOneGK = allGKsInMatch.length === 1;
            
            if (goalsConcededValue === 0 && onlyOneGK) {
                cleanSheets++;
            }
        // }
    });
    
    // Calculate penalty goals from PLAYERDETAILS for this goalkeeper's matches
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const gkMatchIds = new Set(gkRecords.map(r => r.MATCH_ID).filter(id => id));
    
    playerDetails.forEach(playerRecord => {
        const matchId = normalizeStr(playerRecord.MATCH_ID);
        const typeNorm = normalizeStr(playerRecord.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
        const gaNorm = normalizeStr(playerRecord.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
        
        // Check if this is a penalty goal in a match where our goalkeeper played
        if (gkMatchIds.has(matchId) && (typeNorm === 'PENGOAL' || gaNorm === 'PENGOAL')) {
            // Check if this penalty goal was scored against our goalkeeper
            const gkRecord = gkRecords.find(r => r.MATCH_ID === matchId);
            if (gkRecord) {
                const gkTeam = normalizeStr(gkRecord.TEAM || '');
                const playerTeam = normalizeStr(playerRecord.TEAM || '');
                
                // Penalty goal is against our goalkeeper if teams are different
                if (gkTeam !== playerTeam) {
                    penaltyGoals++;
                }
            }
        }
    });
    
    // Calculate penalty saves from HOWPENMISSED sheet
    const howPenMissed = getSheetRowsByCandidates(['HOWPENMISSED']);
    const goalkeeperNameNorm = normalizeStr(goalkeeperName);
    
    howPenMissed.forEach(record => {
        const playerName = normalizeStr(record['PLAYER NAME'] || '');
        if (playerName === goalkeeperNameNorm) {
            // Check if this penalty save was in one of the filtered matches
            const matchId = record.MATCH_ID;
            if (matchId && filteredMatchIds.has(matchId)) {
                penaltySaves++;
            } else if (!matchId) {
                // If no match ID, count it (legacy data)
                penaltySaves++;
            }
        }
    });
    
    // Calculate penalties missed in goalkeeper's presence (from PLAYERDETAILS)
    playerDetails.forEach(playerRecord => {
        const matchId = normalizeStr(playerRecord.MATCH_ID);
        const typeNorm = normalizeStr(playerRecord.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
        const gaNorm = normalizeStr(playerRecord.GA || '').toUpperCase().replace(/[^A-Z]/g, '');
        
        // Check if this is a missed penalty in a match where our goalkeeper played
        if (gkMatchIds.has(matchId) && (typeNorm === 'PENMISSED' || gaNorm === 'PENMISSED')) {
            // Check if this missed penalty was against our goalkeeper's team
            const gkRecord = gkRecords.find(r => r.MATCH_ID === matchId);
            if (gkRecord) {
                const gkTeam = normalizeStr(gkRecord.TEAM || '');
                const playerTeam = normalizeStr(playerRecord.TEAM || '');
                
                // Penalty missed against our goalkeeper if teams are different
                if (gkTeam !== playerTeam) {
                    penaltiesMissed++;
                }
            }
        }
    });
    
    // Calculate clean sheet percentage
    const cleanSheetPercentage = totalMatches > 0 ? Math.round((cleanSheets / totalMatches) * 100) : 0;
    
    // Calculate average goals conceded per match
    const avgGoalsConceded = totalMatches > 0 ? (goalsConceded / totalMatches).toFixed(2) : 0;
    
    // Calculate longest streaks
    const streaks = calculateGKStreaks(gkRecords, filteredMatches, goalkeeperName);
    
    // Store streak details globally for modal display
    window.currentGKStreaks = {
        concedingMatches: streaks.concedingStreakMatches,
        cleanSheetMatches: streaks.cleanSheetStreakMatches
    };
    
    const stats = {
        totalMatches,
        cleanSheets,
        goalsConceded,
        cleanSheetPercentage,
        avgGoalsConceded,
        penaltyGoals,
        penaltySaves,
        penaltiesMissed,
        longestConcedingStreak: streaks.longestConcedingStreak,
        longestCleanSheetStreak: streaks.longestCleanSheetStreak
    };
    
    return stats;
}

// Load all goalkeepers data
function loadAllGoalkeepersData(filteredRecords = null) {
    
    if (!alAhlyStatsData || !alAhlyStatsData.allRecords) {
        renderAllGoalkeepersTable([]);
        return;
    }

    const teamFilterElement = document.getElementById('all-gk-team-filter');
    const teamFilter = teamFilterElement ? teamFilterElement.value : '';
    
    // Get unique goalkeepers from GKDETAILS
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    if (!gkDetails.length) {
        renderAllGoalkeepersTable([]);
        return;
    }

    // Apply main filters to matches
    const currentFilteredRecords = getCurrentFilteredRecords();
    let gkRecords = gkDetails;
    
    if (currentFilteredRecords && currentFilteredRecords.length > 0) {
        const filteredMatchIds = new Set(currentFilteredRecords.map(m => m.MATCH_ID));
        // Filter GK records by matches that passed the main filters
        gkRecords = gkDetails.filter(r => filteredMatchIds.has(r.MATCH_ID));
    }
    
    // Get unique goalkeepers
    const goalkeeperMap = new Map();
    
    gkRecords.forEach(record => {
        const goalkeeperName = normalizeStr(record['PLAYER NAME'] || record.GK_NAME || record.PLAYER);
        if (!goalkeeperName || goalkeeperName === '-' || goalkeeperName === '?' || goalkeeperName === 'unknown') {
            return;
        }

        // Determine team filter with exact match
        const teamName = normalizeStr(record.TEAM);
        const isAhlyTeam = teamName === 'الأهلي';
        
        // Apply team filter - skip if doesn't match
        if (teamFilter === 'WITH_AHLY' && !isAhlyTeam) {
            return; // Skip goalkeepers not with Al Ahly
        } else if (teamFilter === 'AGAINST_AHLY' && isAhlyTeam) {
            return; // Skip Al Ahly goalkeepers
        }
        // If teamFilter is empty, show all goalkeepers

        if (!goalkeeperMap.has(goalkeeperName)) {
            goalkeeperMap.set(goalkeeperName, {
                name: goalkeeperName,
                matches: 0,
                goalsConceded: 0,
                cleanSheets: 0,
                penaltyGoals: 0,
                penaltySaves: 0,
                penaltiesMissed: 0
            });
        }
    });

    // Calculate statistics for each goalkeeper using the same logic as GK Statistics
    const appliedFilters = getCurrentFilters();
    
    goalkeeperMap.forEach((goalkeeper, goalkeeperName) => {
        // Use the same calculation logic as GK Statistics page
        const stats = getGoalkeeperStatsFromSheets(goalkeeperName, teamFilter, appliedFilters);
        
        // Update goalkeeper object with calculated stats
        goalkeeper.matches = stats.totalMatches;
        goalkeeper.goalsConceded = stats.goalsConceded;
        goalkeeper.cleanSheets = stats.cleanSheets;
        goalkeeper.penaltyGoals = stats.penaltyGoals;
        goalkeeper.penaltySaves = stats.penaltySaves;
        goalkeeper.penaltiesMissed = stats.penaltiesMissed;
    });

    // Convert to array and sort by matches (descending)
    const goalkeepersArray = Array.from(goalkeeperMap.values())
        .sort((a, b) => b.matches - a.matches);

    allGoalkeepersData.goalkeepers = goalkeepersArray;
    
    renderAllGoalkeepersTable(goalkeepersArray);
}

// Render all goalkeepers table
function renderAllGoalkeepersTable(goalkeepersData) {
    const tbody = document.querySelector('#all-goalkeepers-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (goalkeepersData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="7" style="text-align: center; padding: 2rem; color: #666;">No goalkeepers found</td>';
        tbody.appendChild(row);
        return;
    }

    goalkeepersData.forEach(goalkeeper => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align: center;">${goalkeeper.name}</td>
            <td>${goalkeeper.matches}</td>
            <td>${goalkeeper.goalsConceded}</td>
            <td>${goalkeeper.cleanSheets}</td>
            <td>${goalkeeper.penaltyGoals}</td>
            <td>${goalkeeper.penaltySaves}</td>
            <td>${goalkeeper.penaltiesMissed}</td>
        `;
        tbody.appendChild(row);
    });

    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    
    const totalMatches = goalkeepersData.reduce((sum, gk) => sum + gk.matches, 0);
    const totalGoalsConceded = goalkeepersData.reduce((sum, gk) => sum + gk.goalsConceded, 0);
    const totalCleanSheets = goalkeepersData.reduce((sum, gk) => sum + gk.cleanSheets, 0);
    const totalPenaltyGoals = goalkeepersData.reduce((sum, gk) => sum + gk.penaltyGoals, 0);
    const totalPenaltySaves = goalkeepersData.reduce((sum, gk) => sum + gk.penaltySaves, 0);
    const totalPenaltiesMissed = goalkeepersData.reduce((sum, gk) => sum + gk.penaltiesMissed, 0);
    
    totalRow.innerHTML = `
        <td style="text-align: center;">TOTAL</td>
        <td>${totalMatches}</td>
        <td>${totalGoalsConceded}</td>
        <td>${totalCleanSheets}</td>
        <td>${totalPenaltyGoals}</td>
        <td>${totalPenaltySaves}</td>
        <td>${totalPenaltiesMissed}</td>
    `;
    tbody.appendChild(totalRow);
}

// Setup all goalkeepers filter
function setupAllGoalkeepersFilter() {
    const filterSelect = document.getElementById('all-gk-team-filter');
    if (filterSelect) {
        filterSelect.addEventListener('change', function() {
            console.log('All goalkeepers filter changed:', this.value);
            loadAllGoalkeepersData();
        });
    }
}

// Show streak details popup
async function showStreakDetails(streakType) {
    console.log('Showing streak details for:', streakType);
    
    // Recompute streaks using current filters and selected GK context before showing
    try {
        const selectedGKName = (goalkeepersData && goalkeepersData.selectedGoalkeeper && goalkeepersData.selectedGoalkeeper.name) ? goalkeepersData.selectedGoalkeeper.name : '';
        if (selectedGKName) {
            const teamFilterEl = document.getElementById('gk-team-filter');
            const teamFilter = teamFilterEl ? teamFilterEl.value : '';
            await loadGKOverviewStats(selectedGKName, teamFilter);
        }
    } catch (e) {
        console.warn('Could not recompute GK streaks before showing modal:', e);
    }
    
    if (!window.currentGKStreaks) {
        console.error('No streak data available');
        alert('No streak data available');
        return;
    }
    
    // Get the appropriate matches based on streak type
    const matches = streakType === 'conceding' 
        ? window.currentGKStreaks.concedingMatches 
        : window.currentGKStreaks.cleanSheetMatches;
    
    if (!matches || matches.length === 0) {
        alert('No streak data available');
        return;
    }
    
    const title = streakType === 'conceding' 
        ? `Longest Conceding Streak (${matches.length} Matches)`
        : `Longest Clean Sheet Streak (${matches.length} Matches)`;
    
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'gk-streak-popup-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 2rem;
        max-width: 90%;
        max-height: 90%;
        width: 1000px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        position: relative;
        overflow: auto;
    `;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 20px;
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: #666;
        line-height: 1;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    // Create title
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    titleEl.style.cssText = `
        text-align: center;
        margin-bottom: 1.5rem;
        color: #333;
        font-size: 1.5rem;
    `;
    
    // Create table
    const tableContainer = document.createElement('div');
    tableContainer.className = 'stats-table-container';
    
    const table = document.createElement('table');
    table.className = 'stats-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Match #</th>
                <th>Date</th>
                <th>Season</th>
                <th>Opponent</th>
                <th>Minutes Played</th>
                <th>Goals Conceded</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    
    const tbody = table.querySelector('tbody');
    matches.forEach((match, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${match.date || 'N/A'}</td>
            <td>${match.season || 'N/A'}</td>
            <td>${match.opponent || 'N/A'}</td>
            <td>${match.minutesPlayed || 0}</td>
            <td>${match.goalsConceded}</td>
        `;
        tbody.appendChild(row);
    });
    
    tableContainer.appendChild(table);
    popup.appendChild(closeBtn);
    popup.appendChild(titleEl);
    popup.appendChild(tableContainer);
    overlay.appendChild(popup);
    
    // Add to document
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    });
}

// Close streak details modal (for backward compatibility)
function closeStreakModal() {
    const overlay = document.getElementById('gk-streak-popup-overlay');
    if (overlay && overlay.parentNode) {
        document.body.removeChild(overlay);
    }
}

// Function to update goalkeeper overview cards
function updateGKOverviewCards(stats) {
    console.log('Updating GK cards with stats:', stats);
    console.log('Stats received:', {
        total_matches: stats.total_matches,
        clean_sheets: stats.clean_sheets,
        goals_conceded: stats.goals_conceded,
        clean_sheet_percentage: stats.clean_sheet_percentage,
        avg_goals_conceded: stats.avg_goals_conceded,
        penalty_goals: stats.penalty_goals,
        penalty_saves: stats.penalty_saves,
        penalties_missed: stats.penalties_missed
    });
    
    // Update each card with the corresponding stat
    const elements = [
        'gk-total-matches', 'gk-clean-sheets', 'gk-goals-conceded', 'gk-avg-goals-conceded',
        'gk-clean-sheet-percentage', 'gk-longest-conceding-streak', 'gk-longest-clean-sheet-streak',
        'gk-penalty-goals', 'gk-penalty-saves', 'gk-penalties-missed'
    ];
    
    const values = [
        stats.total_matches, stats.clean_sheets, stats.goals_conceded, stats.avg_goals_conceded,
        stats.clean_sheet_percentage + '%', stats.longest_conceding_streak || 0, stats.longest_clean_sheet_streak || 0,
        stats.penalty_goals, stats.penalty_saves, stats.penalties_missed
    ];
    
    for (let i = 0; i < elements.length; i++) {
        const element = document.getElementById(elements[i]);
        if (element) {
            element.textContent = values[i] || 0;
            console.log(`Updated ${elements[i]}: ${values[i] || 0}`);
        } else {
            console.error(`Element not found: ${elements[i]}`);
        }
    }
}
// Main tabs switching (compatible with showStatsTab(event, 'name') and showStatsTab('name'))
function showStatsTab(arg1, arg2) {
    const isEvent = arg1 && typeof arg1 === 'object' && typeof arg1.preventDefault === 'function';
    const evt = isEvent ? arg1 : null;
    if (evt) {
        try { evt.preventDefault(); } catch (e) {}
    }
    const tabName = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : 'overview');

    // Hide all tab contents
    document.querySelectorAll('.stats-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.stats-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab content (fallback to overview if missing)
    const selectedTab = document.getElementById(`${tabName}-tab`) || document.getElementById('overview-tab');
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked tab (support clicks on nested SVG)
    const clickedBtn = evt && evt.target && evt.target.closest ? evt.target.closest('button.stats-tab') : null;
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    } else {
        const btn = document.querySelector(`.stats-tab[onclick*="'${tabName}'"]`) || document.querySelector(`.stats-tab[onclick*="'overview'"]`);
        if (btn) btn.classList.add('active');
    }
    
    // Load H2H data when H2H tab is selected (with current filters applied)
    if (tabName === 'h2h') {
        // Get current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadH2HTeamsData(currentFilteredRecords);
        
        // Also load countries data if countries tab is visible
        const countriesTab = document.getElementById('h2h-countries-subtab');
        if (countriesTab && countriesTab.style.display !== 'none') {
            loadH2HCountriesData();
        }
    }
    
    // Load H2H T Details data when H2H T Details tab is selected
    if (tabName === 'h2h-t-details') {
        console.log('🎯 H2H T Details tab selected, loading teams...');
        loadH2HTDetailsTeams();
        
        // Apply current filters to H2H T Details
        const currentFilteredRecords = getCurrentFilteredRecords();
        if (currentFilteredRecords && currentFilteredRecords.length > 0) {
            console.log(`🔄 Applying filters to H2H T Details: ${currentFilteredRecords.length} filtered records`);
            // Reload teams with filtered data
            loadH2HTDetailsTeamsWithFilteredData(currentFilteredRecords);
        }
    }
    
    // Load Coaches data when Coaches tab is selected (with current filters applied)
    if (tabName === 'coaches') {
        // Get current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadCoachesData(currentFilteredRecords);
    }
    
    // Load Main Stats data when Main Stats tab is selected
    if (tabName === 'main-stats') {
        loadChampionshipsStats();
    }
    
    // Load Referees data when Referees tab is selected
    if (tabName === 'referees') {
        loadRefereesData();
    }
    
    // Load All Goalkeepers data when All Goalkeepers tab is selected
    if (tabName === 'all-goalkeepers') {
        // Load data immediately when tab is opened
        loadAllGoalkeepersData();
    }
    
    // Load All Players data when All Players tab is selected (with current filters applied)
    if (tabName === 'all-players') {
        // Get current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadAllPlayersData(currentFilteredRecords);
    }
}

// Player sub-tabs switching (compatible with showPlayerSubTab(event, 'name') and showPlayerSubTab('name'))
function showPlayerSubTab(arg1, arg2) {
    const isEvent = arg1 && typeof arg1 === 'object' && typeof arg1.preventDefault === 'function';
    const evt = isEvent ? arg1 : null;
    const subTabName = typeof arg1 === 'string' ? arg1 : (typeof arg2 === 'string' ? arg2 : 'overview');

    // Hide all player sub-tab contents
    document.querySelectorAll('.player-sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all player sub-tabs
    document.querySelectorAll('.stats-sub-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected sub-tab content (fallback)
    const selectedSubTab = document.getElementById(`player-${subTabName}-sub`) || document.getElementById('player-overview-sub');
    if (selectedSubTab) {
        selectedSubTab.classList.add('active');
    }
    
    // Add active class to clicked sub-tab
    const clickedBtn = evt && evt.target && evt.target.closest ? evt.target.closest('button.stats-sub-tab') : null;
    if (clickedBtn) {
        clickedBtn.classList.add('active');
    } else {
        const btn = document.querySelector(`.stats-sub-tab[onclick*="'${subTabName}'"]`) || document.querySelector(`.stats-sub-tab[onclick*="'overview'"]`);
        if (btn) btn.classList.add('active');
    }
    
    // Load data for the selected sub-tab if player is selected
    const searchEl = document.getElementById('player-search');
    const selectedPlayer = searchEl ? searchEl.value.trim() : '';
    if (selectedPlayer) {
        // Get current selected teams from checkboxes
        const selectedTeams = getSelectedPlayerTeams();
        loadPlayerSubTabData(subTabName, selectedTeams);
    }
}

// Load player sub-tab data based on current selection (Excel-only)
function loadPlayerSubTabData(subTabName, selectedTeams = null) {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = selectedTeams ? (Array.isArray(selectedTeams) ? selectedTeams.join(',') : selectedTeams) : (document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '');
    if (!selectedPlayer) return;
    switch (subTabName) {
        case 'overview':
            if (typeof loadPlayerOverviewWithFilter === 'function') loadPlayerOverviewWithFilter(selectedTeams || teamFilter);
            break;
        case 'matches':
            loadPlayerMatchesWithFilter(selectedTeams || teamFilter);
            break;
        case 'championships':
            loadPlayerChampionshipsWithFilter(selectedTeams || teamFilter);
            break;
        case 'seasons':
            loadPlayerSeasonsWithFilter(selectedTeams || teamFilter);
            break;
        case 'vs-teams':
            loadPlayerVsTeamsWithFilter(selectedTeams || teamFilter);
            break;
        case 'vs-gks':
            loadPlayerVsGKsWithFilter(selectedTeams || teamFilter);
            break;
        case 'goal-details':
            loadPlayerGoalDetailsWithFilter(selectedTeams || teamFilter);
            break;
        case 'assist-details':
            loadPlayerAssistDetailsWithFilter(selectedTeams || teamFilter);
            break;
        case 'with-coaches':
            loadPlayerWithCoachesWithFilter(selectedTeams || teamFilter);
            break;
        case 'trophies':
            // For trophies, ignore team filter - always show Al Ahly trophies only
            loadPlayerTrophies(selectedPlayer, '');
            break;
    }
}

// Switch between Goal Details sub-tabs (Goal Minute / Goal Effect)
function showGoalDetailsTab(event, tabName) {
    // Remove active class from all goal details tabs
    document.querySelectorAll('.goal-details-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all goal details contents
    document.querySelectorAll('.goal-details-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // Show selected content
    const selectedContent = document.getElementById(`goal-${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Load data for the selected tab
    if (tabName === 'minute') {
        loadPlayerGoalMinuteStats();
    } else if (tabName === 'effect') {
        loadPlayerGoalEffectStats();
    } else if (tabName === 'round') {
        loadPlayerGoalByRoundStats();
    }
}

// Load Goal Details stats (load both tabs)
function loadPlayerGoalDetailsStats() {
    // Check which sub-tab is active
    const goalMinuteContent = document.getElementById('goal-minute-content');
    const goalEffectContent = document.getElementById('goal-effect-content');
    const goalRoundContent = document.getElementById('goal-round-content');
    
    if (goalEffectContent && goalEffectContent.classList.contains('active')) {
        // If Goal Effect is active, load it
        loadPlayerGoalEffectStats();
    } else if (goalRoundContent && goalRoundContent.classList.contains('active')) {
        // If Goal By Round is active, load it
        loadPlayerGoalByRoundStats();
    } else {
        // Default to Goal Minute
        loadPlayerGoalMinuteStats();
    }
}

// Load Goal Effect statistics
function loadPlayerGoalEffectStats() {
    console.log('Loading player goal effect stats');
    if (!playersData.selectedPlayer || !playersData.selectedPlayer.name) {
        const container = document.getElementById('goal-effect-cards-container');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No player selected</p>';
        }
        return;
    }
    
    const playerName = playersData.selectedPlayer.name;
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    // Get applied filters from the main filter section
    const appliedFilters = getCurrentFilters();
    console.log('Applied filters for goal effect:', appliedFilters);
    
    const goalEffect = getPlayerGoalEffectFromSheets(playerName, teamFilter, appliedFilters);
    console.log('Goal effect data:', goalEffect);
    renderGoalEffectCards(goalEffect);
}

// Calculate winning and equalizing matches
function getPlayerGoalEffectFromSheets(playerName, teamFilter, appliedFilters = {}) {
    const details = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const nameLower = (playerName || '').toLowerCase();
    const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();
    
    if (!details.length || !matches.length) {
        return { 
            winningMatchesCount: 0, 
            equalizingMatchesCount: 0,
            winningMatchesData: [],
            equalizingMatchesData: []
        };
    }
    
    // Get all player goals
    const playerGoals = details.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        
        if (teamLower) {
            const teamVal = r.TEAM || r['AHLY TEAM'] || r.team;
            if (!teamMatchesFilter(teamVal, teamFilter)) return false;
        }
        
        // Apply main filters to match data
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || '');
        const matchDetail = matches.find(match => 
            normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
        );
        
        const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
        if (!filtersMatch) return false;
        
        // Only goals (GA = 'GOAL')
        const gaVal = normalizeStr(r.GA || '').toUpperCase();
        return gaVal === 'GOAL';
    });
    
    console.log('Player goals found:', playerGoals.length);
    
    // Group goals by match
    const matchGoalsMap = new Map();
    playerGoals.forEach(goal => {
        const matchId = normalizeStr(goal.MATCH_ID || goal['MATCH ID'] || goal.match_id);
        if (!matchId) return;
        
        if (!matchGoalsMap.has(matchId)) {
            matchGoalsMap.set(matchId, []);
        }
        matchGoalsMap.get(matchId).push(goal);
    });
    
    console.log('Matches with player goals:', matchGoalsMap.size);
    
    const winningMatchesData = [];
    const equalizingMatchesData = [];
    
    // For each match, check if player scored the last Al Ahly goal
    matchGoalsMap.forEach((playerGoalsInMatch, matchId) => {
        // Find the match details
        const matchDetail = matches.find(m => normalizeStr(m.MATCH_ID || m['MATCH ID']) === matchId);
        if (!matchDetail) return;
        
        const gf = parseInt(matchDetail.GF || 0);
        const ga = parseInt(matchDetail.GA || 0);
        
        // Get all goals in this match (Al Ahly + opponent)
        const allGoalsInMatch = details.filter(r => {
            const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
            if (mid !== matchId) return false;
            
            const gaVal = normalizeStr(r.GA || '').toUpperCase();
            return gaVal === 'GOAL';
        });
        
        // Sort goals by minute
        allGoalsInMatch.sort((a, b) => {
            const minA = parseMinuteForSort(normalizeStr(a.MINUTE || a.minute || '0'));
            const minB = parseMinuteForSort(normalizeStr(b.MINUTE || b.minute || '0'));
            return minA - minB;
        });
        
        // Find last Al Ahly goal and its number
        let lastAhlyGoal = null;
        let goalNumber = 0;
        let ahlyGoalCount = 0;
        
        for (let i = 0; i < allGoalsInMatch.length; i++) {
            const goal = allGoalsInMatch[i];
            const team = normalizeStr(goal.TEAM || goal['AHLY TEAM'] || '').toLowerCase();
            // Check if it's an Al Ahly goal (not opponent)
            if (team.includes('ahly') || team.includes('الاهلي') || team.includes('الأهلي')) {
                ahlyGoalCount++;
                lastAhlyGoal = goal;
                goalNumber = ahlyGoalCount;
            }
        }
        
        if (!lastAhlyGoal) return;
        
        // Check if this player scored the last Al Ahly goal
        const lastGoalPlayer = normalizeStr(lastAhlyGoal['PLAYER NAME'] || lastAhlyGoal.PLAYER || '').toLowerCase();
        if (lastGoalPlayer !== nameLower) return;
        
        console.log(`Match ${matchId}: Player scored last Al Ahly goal. Result: ${gf}-${ga}`);
        
        // Count player goals in this match
        const playerGoalCount = playerGoalsInMatch.length;
        
        // Prepare match data
        const matchData = {
            date: matchDetail.DATE || '',
            dateFormatted: formatExcelDate(matchDetail.DATE),
            season: normalizeStr(matchDetail.SEASON || ''),
            opponent: normalizeStr(matchDetail['OPPONENT TEAM'] || matchDetail.OPPONENT || ''),
            score: `${gf}-${ga}`,
            playerGoals: playerGoalCount,
            goalNumber: goalNumber
        };
        
        // Check if it's a winning goal (won by 1 goal)
        if (gf > ga && (gf - ga) === 1) {
            winningMatchesData.push(matchData);
            console.log(`  -> Winning goal! (${gf}-${ga})`);
        }
        // Check if it's an equalizing goal (draw)
        else if (gf === ga) {
            equalizingMatchesData.push(matchData);
            console.log(`  -> Equalizing goal! (${gf}-${ga})`);
        }
    });
    
    // Sort by date (most recent first)
    winningMatchesData.sort((a, b) => {
        const dateA = parseExcelDate(a.date);
        const dateB = parseExcelDate(b.date);
        return dateB - dateA; // Descending order (newest first)
    });
    
    equalizingMatchesData.sort((a, b) => {
        const dateA = parseExcelDate(a.date);
        const dateB = parseExcelDate(b.date);
        return dateB - dateA; // Descending order (newest first)
    });
    
    return { 
        winningMatchesCount: winningMatchesData.length,
        equalizingMatchesCount: equalizingMatchesData.length,
        winningMatchesData,
        equalizingMatchesData
    };
}
// Helper function to parse Excel date serial number
function parseExcelDate(excelDate) {
    if (!excelDate) return new Date(0);
    
    // If it's already a valid date string, parse it
    if (typeof excelDate === 'string' && excelDate.includes('-')) {
        return new Date(excelDate);
    }
    
    // If it's an Excel serial number
    const serial = parseFloat(excelDate);
    if (!isNaN(serial)) {
        // Excel dates start from January 1, 1900 (with day 1 = Jan 1, 1900)
        const excelEpoch = new Date(1900, 0, 1);
        const daysOffset = serial - 2; // Excel has a bug where it counts 1900 as a leap year
        return new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    }
    
    return new Date(0);
}

// Helper function to format Excel date for display
function formatExcelDate(excelDate) {
    if (!excelDate) return '';
    
    const date = parseExcelDate(excelDate);
    
    // Format as DD/MM/YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

// Render goal effect cards
function renderGoalEffectCards(goalEffect) {
    const container = document.getElementById('goal-effect-cards-container');
    if (!container) return;
    
    const { winningMatchesCount, equalizingMatchesCount, winningMatchesData, equalizingMatchesData } = goalEffect;
    
    const html = `
        <div style="width: 100%;">
            <div class="player-stat-card goal-effect-clickable" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; cursor: pointer;" onclick="toggleGoalEffectTable('winning')">
                <div class="stat-icon" style="background: rgba(255, 255, 255, 0.2);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <h3 style="color: white;">Winning Matches</h3>
                    <p class="stat-value" style="color: white;">${winningMatchesCount}</p>
                    <p class="stat-label" style="color: white;">Goals That Won Games</p>
                </div>
                <div style="margin-left: auto;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 24px; height: 24px;">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
            </div>
            <div id="winning-matches-table" class="goal-effect-table" style="display: none; margin-top: 1rem;">
                <div class="stats-table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Season</th>
                                <th>Score</th>
                                <th>Opponent</th>
                                <th>Player Goals</th>
                                <th>Goal Number</th>
                            </tr>
                        </thead>
                        <tbody id="winning-matches-tbody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div style="width: 100%;">
            <div class="player-stat-card goal-effect-clickable" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; cursor: pointer;" onclick="toggleGoalEffectTable('equalizing')">
                <div class="stat-icon" style="background: rgba(255, 255, 255, 0.2);">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                        <path d="M12 2v20M2 12h20"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <h3 style="color: white;">Equalizing Matches</h3>
                    <p class="stat-value" style="color: white;">${equalizingMatchesCount}</p>
                    <p class="stat-label" style="color: white;">Goals That Saved Draws</p>
                </div>
                <div style="margin-left: auto;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 24px; height: 24px;">
                        <polyline points="6 9 12 15 18 9"/>
                    </svg>
                </div>
            </div>
            <div id="equalizing-matches-table" class="goal-effect-table" style="display: none; margin-top: 1rem;">
                <div class="stats-table-container">
                    <table class="stats-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Season</th>
                                <th>Score</th>
                                <th>Opponent</th>
                                <th>Player Goals</th>
                                <th>Goal Number</th>
                            </tr>
                        </thead>
                        <tbody id="equalizing-matches-tbody">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Render tables data
    renderGoalEffectTable('winning', winningMatchesData);
    renderGoalEffectTable('equalizing', equalizingMatchesData);
}

// Toggle goal effect table visibility
function toggleGoalEffectTable(type) {
    const tableId = `${type}-matches-table`;
    const table = document.getElementById(tableId);
    if (table) {
        table.style.display = table.style.display === 'none' ? 'block' : 'none';
    }
}

// Render goal effect table
function renderGoalEffectTable(type, matchesData) {
    const tbodyId = `${type}-matches-tbody`;
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    if (!matchesData || matchesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No matches found</td></tr>';
        return;
    }
    
    let html = '';
    matchesData.forEach(match => {
        html += `
            <tr>
                <td>${match.dateFormatted}</td>
                <td>${match.season}</td>
                <td>${match.score}</td>
                <td>${match.opponent}</td>
                <td>${match.playerGoals}</td>
                <td>${match.goalNumber}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Auto-load cached Excel data on page load
async function autoLoadCachedExcelData() {
    console.log('=== AUTO-LOADING CACHED EXCEL DATA ===');
    const cachedData = await loadSheetsDataFromCache();
    if (cachedData) {
        console.log('Auto-loading cached Excel data...');
        window.__ahlySheetsJson = cachedData;
        
        // Load MATCHDETAILS data
        const matchDetailsSheetName = Object.keys(cachedData).find(n => n.toUpperCase() === 'MATCHDETAILS') || 'MATCHDETAILS';
        const allRecords = cachedData[matchDetailsSheetName] || [];
        alAhlyStatsData.allRecords = allRecords;
        
        // Calculate and store stats immediately from cached data
        const totalMatches = allRecords.length;
        const totalWins = allRecords.filter(r => r['W-D-L'] === 'W').length;
        const totalDraws = allRecords.filter(r => ['D','D WITH G','D.'].includes(r['W-D-L'])).length;
        const drawsWithGoals = allRecords.filter(r => r['W-D-L'] === 'D').length;
        const drawsNoGoals = allRecords.filter(r => r['W-D-L'] === 'D.').length;
        const totalLosses = allRecords.filter(r => r['W-D-L'] === 'L').length;
        const totalGoalsFor = allRecords.reduce((s, r) => s + (parseInt(r['GF'] || 0)), 0);
        const totalGoalsAgainst = allRecords.reduce((s, r) => s + (parseInt(r['GA'] || 0)), 0);
        const cleanSheets = allRecords.filter(r => parseInt(r['GA'] || 0) === 0).length;
        const cleanSheetsAgainst = allRecords.filter(r => parseInt(r['GF'] || 0) === 0).length;
        
        // Store in alAhlyStatsData for later use
        alAhlyStatsData.drawsWithGoals = drawsWithGoals;
        alAhlyStatsData.drawsNoGoals = drawsNoGoals;
        alAhlyStatsData.totalMatches = totalMatches;
        alAhlyStatsData.wins = totalWins;
        alAhlyStatsData.draws = totalDraws;
        alAhlyStatsData.losses = totalLosses;
        alAhlyStatsData.totalGoalsFor = totalGoalsFor;
        alAhlyStatsData.totalGoalsAgainst = totalGoalsAgainst;
        alAhlyStatsData.cleanSheets = cleanSheets;
        alAhlyStatsData.cleanSheetsAgainst = cleanSheetsAgainst;
        
        // Build filter options from cached data
        const columnsForFilters = [
            'CHAMPION SYSTEM','CHAMPION','SEASON','AHLY MANAGER','OPPONENT MANAGER','REFREE','ROUND','H-A-N','STAD','AHLY TEAM','OPPONENT TEAM','W-D-L','CLEAN SHEET','ET','PEN'
        ];
        
        const idMap = {
            'ET': 'extra-time-filter',
            'PEN': 'penalties-filter'
        };
        
        columnsForFilters.forEach(col => {
            const uniqueValues = [...new Set(allRecords.map(r => r[col]).filter(v => v && String(v).trim()))].sort();
            if (uniqueValues.length > 0) {
                const selectId = idMap[col] || col.toLowerCase().replace(/\s+/g, '-') + '-filter';
                const select = document.getElementById(selectId);
                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">All</option>' + uniqueValues.map(v => `<option value="${v}">${v}</option>`).join('');
                    if (currentValue) select.value = currentValue;
                }
            }
        });
        
        // Load stats with cached data
        loadAlAhlyStats();
        
        // Force refresh all tabs with cached data
        setTimeout(() => {
            console.log('Forcing refresh of all tabs with cached data...');
            loadAlAhlyStatsData();
            
            // Update player stats if player is selected
            if (playersData.selectedPlayer && playersData.selectedPlayer.name) {
                console.log('Refreshing player stats with cached data...');
                loadPlayerMatches();
                loadPlayerSeasonsStats();
                loadPlayerChampionshipsStats();
                loadPlayerVsTeamsStats();
                loadPlayerVsGKsStats();
            }
            
            // Force update all displays after data is loaded
            setTimeout(() => {
                console.log('Force updating all displays...');
                console.log('alAhlyStatsData before update:', {
                    totalMatches: alAhlyStatsData.totalMatches,
                    wins: alAhlyStatsData.wins,
                    draws: alAhlyStatsData.draws,
                    losses: alAhlyStatsData.losses,
                    totalGoalsFor: alAhlyStatsData.totalGoalsFor,
                    totalGoalsAgainst: alAhlyStatsData.totalGoalsAgainst
                });
                
                // Force update overview stats
                updateOverviewStats();
                
                // Update charts and tables
                updateCharts();
                updateTables();
                
                // Update match count badge
                const matchCountBadge = document.getElementById('match-count-badge');
                if (matchCountBadge && alAhlyStatsData.totalMatches) {
                    matchCountBadge.textContent = `${alAhlyStatsData.totalMatches} matches`;
                    console.log('Updated match count badge:', matchCountBadge.textContent);
                }
            }, 500); // Increased timeout to ensure data is loaded
        }, 100);
        
        // Load players data from cached sheets
        console.log('Loading players data from cached sheets...');
        loadPlayersData();
        
        // Load goalkeepers data from cached sheets
        console.log('Loading goalkeepers data from cached sheets...');
        loadGoalkeepersData();
        
        // Load H2H Teams data from cached sheets
        console.log('Loading H2H Teams data from cached sheets...');
        loadH2HTeamsData();
        
        // Load Coaches data from cached sheets
        console.log('Loading Coaches data from cached sheets...');
        loadCoachesData();
        
        // Load Referees data from cached sheets
        console.log('Loading Referees data from cached sheets...');
        loadRefereesData();
        
        // Load All Players data from cached sheets
        console.log('Loading All Players data from cached sheets...');
        loadAllPlayersData();
        
        // Update cache status
        updateCacheStatus();
        
        console.log('Cached Excel data loaded successfully');
        return true;
    } else {
        console.log('No cached data found, returning false');
    }
    return false;
}

// Update cache status display
function updateCacheStatus() {
    const timestamp = getCacheTimestamp();
    if (timestamp) {
        const date = new Date(timestamp);
        const statusEl = document.querySelector('#excel-status');
        if (statusEl) {
            statusEl.textContent = `Excel loaded from cache (${date.toLocaleString()})`;
            statusEl.style.color = '#28a745';
        }
    }
}

// Clear cache and reload
function clearCacheAndReload() {
    if (confirm('Are you sure you want to clear cached data?')) {
        clearExcelCache();
        window.__ahlySheetsJson = {};
        alAhlyStatsData.allRecords = [];
        
        // Clear all filter selects
        const filterSelects = document.querySelectorAll('select[id$="-filter"]');
        filterSelects.forEach(select => {
            select.innerHTML = '<option value="">All</option>';
        });
        
        // Clear stats
        const tbodyElements = document.querySelectorAll('tbody');
        tbodyElements.forEach(tbody => {
            tbody.innerHTML = '<tr><td colspan="10">No data available</td></tr>';
        });
        
        // Update status
        const statusEl = document.querySelector('#excel-status');
        if (statusEl) {
            statusEl.textContent = 'Cache cleared.';
            statusEl.style.color = '#6c757d';
        }
        
        console.log('Cache cleared and page reset');
    }
}
// Load and display All Players data
function loadAllPlayersData(filteredRecords = null) {
    console.log('Loading All Players data...');
    
    const lineupDetails = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = filteredRecords || alAhlyStatsData.allRecords || [];
    
    if (!lineupDetails.length || !playerDetails.length || !matchDetails.length) {
        console.log('No data available for All Players');
        renderAllPlayersTable([]);
        return;
    }
    
    console.log(`Processing data from ${matchDetails.length} matches`);
    
    // Get filtered match IDs
    const filteredMatchIds = new Set(matchDetails.map(m => m.MATCH_ID));
    
    // Get team filter value
    const teamFilter = document.getElementById('all-players-team-filter')?.value || '';
    
    // Calculate stats for each player from LINEUPDETAILS
    const playersStats = {};
    
    // LINEUPDETAILS contains ONLY Al Ahly players
    // So we only use it if teamFilter is not 'AGAINST_AHLY'
    if (teamFilter !== 'AGAINST_AHLY') {
        lineupDetails.forEach(record => {
            // Skip if match not in filtered matches
            if (!filteredMatchIds.has(record.MATCH_ID)) return;
            
            const playerName = record['PLAYER NAME'] || record.PLAYER || '';
            const minutes = parseInt(record.MINTOTAL || 0);
            
            if (!playerName) return;
            
            if (!playersStats[playerName]) {
                playersStats[playerName] = {
                    name: playerName,
                    matches: new Set(),
                    minutes: 0,
                    goals: 0,
                    assists: 0,
                    winningMatches: new Set(),
                    equalizingMatches: new Set()
                };
            }
            
            playersStats[playerName].matches.add(record.MATCH_ID);
            playersStats[playerName].minutes += minutes;
        });
    }
    
    // Add goals and assists from PLAYERDETAILS
    playerDetails.forEach(record => {
        // Skip if match not in filtered matches
        if (!filteredMatchIds.has(record.MATCH_ID)) return;
        
        const playerName = record['PLAYER NAME'] || record.PLAYER || '';
        const playerTeam = normalizeStr(record.TEAM || record['AHLY TEAM'] || '');
        const ga = normalizeStr(record.GA || '').toUpperCase();
        
        if (!playerName) return;
        
        // Apply team filter
        if (teamFilter === 'WITH_AHLY') {
            if (playerTeam.trim() !== 'الأهلي' && playerTeam.trim().toLowerCase() !== 'ahly') return;
        } else if (teamFilter === 'AGAINST_AHLY') {
            if (playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly') return;
        }
        
        // Initialize player if not exists (for players who scored but weren't in lineup)
        if (!playersStats[playerName]) {
            playersStats[playerName] = {
                name: playerName,
                matches: new Set(),
                minutes: 0,
                goals: 0,
                assists: 0,
                winningMatches: new Set(),
                equalizingMatches: new Set()
            };
        }
        
        // Count goals - exact match with 'GOAL'
        if (ga === 'GOAL') {
            playersStats[playerName].goals++;
        }
        // Count assists - exact match with 'ASSIST'
        else if (ga === 'ASSIST') {
            playersStats[playerName].assists++;
        }
    });
    
    // Calculate winning and equalizing matches for each player
    Object.keys(playersStats).forEach(playerName => {
        const playerGoalEffect = calculatePlayerGoalEffect(playerName, playerDetails, matchDetails, filteredMatchIds, teamFilter);
        playersStats[playerName].winningMatches = new Set(playerGoalEffect.winningMatches);
        playersStats[playerName].equalizingMatches = new Set(playerGoalEffect.equalizingMatches);
    });
    
    // Convert to array and calculate G+A
    const playersArray = Object.values(playersStats).map(player => ({
        name: player.name,
        matches: player.matches.size,
        minutes: player.minutes,
        goalsAssists: player.goals + player.assists,
        goals: player.goals,
        assists: player.assists,
        winningMatches: player.winningMatches.size,
        equalizingMatches: player.equalizingMatches.size
    }));
    
    // Sort by G+A descending (highest first) - default sort
    playersArray.sort((a, b) => b.goalsAssists - a.goalsAssists);
    
    // Reset sort state to default
    allPlayersSortState = {
        column: 'goalsAssists',
        direction: 'desc'
    };
    
    // Render table
    renderAllPlayersTable(playersArray);
    
    // Update header styling for default sort
    setTimeout(() => {
        document.querySelectorAll('#all-players-table th.sortable').forEach(th => {
            th.classList.remove('active');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.textContent = '⇅';
        });
        const headers = document.querySelectorAll('#all-players-table th.sortable');
        if (headers[3]) { // G+A column
            headers[3].classList.add('active');
            const icon = headers[3].querySelector('.sort-icon');
            if (icon) icon.textContent = '↓';
        }
    }, 0);
}

// Calculate goal effect for a player in All Players context
function calculatePlayerGoalEffect(playerName, playerDetails, matchDetails, filteredMatchIds, teamFilter = '') {
    const nameLower = (playerName || '').toLowerCase();
    const winningMatches = [];
    const equalizingMatches = [];
    
    // Get all goals for this player
    const playerGoals = playerDetails.filter(r => {
        const p = normalizeStr(r['PLAYER NAME'] || r.PLAYER || r.player).toLowerCase();
        if (p !== nameLower) return false;
        
        const matchId = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
        if (!filteredMatchIds.has(matchId)) return false;
        
        // Apply team filter
        const playerTeam = normalizeStr(r.TEAM || r['AHLY TEAM'] || '');
        if (teamFilter === 'WITH_AHLY') {
            if (playerTeam.trim() !== 'الأهلي' && playerTeam.trim().toLowerCase() !== 'ahly') return false;
        } else if (teamFilter === 'AGAINST_AHLY') {
            if (playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly') return false;
        }
        
        const gaVal = normalizeStr(r.GA || '').toUpperCase();
        return gaVal === 'GOAL';
    });
    
    if (playerGoals.length === 0) {
        return { winningMatches, equalizingMatches };
    }
    
    // Group goals by match
    const matchGoalsMap = new Map();
    playerGoals.forEach(goal => {
        const matchId = normalizeStr(goal.MATCH_ID || goal['MATCH ID'] || goal.match_id);
        if (!matchId) return;
        
        if (!matchGoalsMap.has(matchId)) {
            matchGoalsMap.set(matchId, []);
        }
        matchGoalsMap.get(matchId).push(goal);
    });
    
    // For each match, check if player scored the last Al Ahly goal
    matchGoalsMap.forEach((playerGoalsInMatch, matchId) => {
        // Find the match details
        const matchDetail = matchDetails.find(m => normalizeStr(m.MATCH_ID || m['MATCH ID']) === matchId);
        if (!matchDetail) return;
        
        const gf = parseInt(matchDetail.GF || 0);
        const ga = parseInt(matchDetail.GA || 0);
        
        // Get all goals in this match (Al Ahly + opponent)
        const allGoalsInMatch = playerDetails.filter(r => {
            const mid = normalizeStr(r.MATCH_ID || r['MATCH ID'] || r.match_id);
            if (mid !== matchId) return false;
            
            const gaVal = normalizeStr(r.GA || '').toUpperCase();
            return gaVal === 'GOAL';
        });
        
        // Sort goals by minute
        allGoalsInMatch.sort((a, b) => {
            const minA = parseMinuteForSort(normalizeStr(a.MINUTE || a.minute || '0'));
            const minB = parseMinuteForSort(normalizeStr(b.MINUTE || b.minute || '0'));
            return minA - minB;
        });
        
        // Find last Al Ahly goal
        let lastAhlyGoal = null;
        for (let i = allGoalsInMatch.length - 1; i >= 0; i--) {
            const goal = allGoalsInMatch[i];
            const team = normalizeStr(goal.TEAM || goal['AHLY TEAM'] || '').toLowerCase();
            // Check if it's an Al Ahly goal (not opponent)
            if (team.includes('ahly') || team.includes('الاهلي') || team.includes('الأهلي')) {
                lastAhlyGoal = goal;
                break;
            }
        }
        
        if (!lastAhlyGoal) return;
        
        // Check if this player scored the last Al Ahly goal
        const lastGoalPlayer = normalizeStr(lastAhlyGoal['PLAYER NAME'] || lastAhlyGoal.PLAYER || '').toLowerCase();
        if (lastGoalPlayer !== nameLower) return;
        
        // Check if it's a winning goal (won by 1 goal)
        if (gf > ga && (gf - ga) === 1) {
            winningMatches.push(matchId);
        }
        // Check if it's an equalizing goal (draw)
        else if (gf === ga) {
            equalizingMatches.push(matchId);
        }
    });
    
    return { winningMatches, equalizingMatches };
}

// Render All Players table
function renderAllPlayersTable(playersData) {
    const tbody = document.querySelector('#all-players-table tbody');
    if (!tbody) return;
    
    // Store current data for sorting
    allPlayersCurrentData = playersData;
    
    tbody.innerHTML = '';
    
    if (playersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Calculate totals
    const totals = {
        matches: 0,
        minutes: 0,
        goalsAssists: 0,
        goals: 0,
        assists: 0,
        winningMatches: 0,
        equalizingMatches: 0
    };
    
    playersData.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${player.name}</strong></td>
            <td>${player.matches}</td>
            <td>${player.minutes}</td>
            <td><strong>${player.goalsAssists}</strong></td>
            <td>${player.goals}</td>
            <td>${player.assists}</td>
            <td>${player.winningMatches || 0}</td>
            <td>${player.equalizingMatches || 0}</td>
        `;
        tbody.appendChild(row);
        
        // Note: matches count per player, so we don't sum them
        totals.minutes += player.minutes;
        totals.goalsAssists += player.goalsAssists;
        totals.goals += player.goals;
        totals.assists += player.assists;
        totals.winningMatches += (player.winningMatches || 0);
        totals.equalizingMatches += (player.equalizingMatches || 0);
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td>${playersData.length} Players</td>
        <td>${totals.minutes}</td>
        <td><strong>${totals.goalsAssists}</strong></td>
        <td>${totals.goals}</td>
        <td>${totals.assists}</td>
        <td>${totals.winningMatches}</td>
        <td>${totals.equalizingMatches}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`All Players table rendered with ${playersData.length} players`);
}

// Global variable to store current All Players data and sort state
let allPlayersCurrentData = [];
let allPlayersSortState = {
    column: 'goalsAssists',
    direction: 'desc'
};

// Sort All Players table
function sortAllPlayersTable(column) {
    console.log('Sorting All Players table by:', column);
    
    // Update sort direction
    if (allPlayersSortState.column === column) {
        allPlayersSortState.direction = allPlayersSortState.direction === 'desc' ? 'asc' : 'desc';
    } else {
        allPlayersSortState.column = column;
        allPlayersSortState.direction = 'desc';
    }
    
    // Sort the data
    const sortedData = [...allPlayersCurrentData].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        // Handle string comparison for player name
        if (column === 'name') {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (allPlayersSortState.direction === 'desc') {
                return valB.localeCompare(valA);
            } else {
                return valA.localeCompare(valB);
            }
        }
        
        // Handle numeric comparison
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        
        if (allPlayersSortState.direction === 'desc') {
            return valB - valA;
        } else {
            return valA - valB;
        }
    });
    
    // Update active header styling
    document.querySelectorAll('#all-players-table th.sortable').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.textContent = '⇅';
        }
    });
    
    // Find and mark active header
    const headers = document.querySelectorAll('#all-players-table th.sortable');
    const columnMap = {
        'name': 0,
        'matches': 1,
        'minutes': 2,
        'goalsAssists': 3,
        'goals': 4,
        'assists': 5,
        'winningMatches': 6,
        'equalizingMatches': 7
    };
    
    const headerIndex = columnMap[column];
    if (headerIndex !== undefined && headers[headerIndex]) {
        headers[headerIndex].classList.add('active');
        const icon = headers[headerIndex].querySelector('.sort-icon');
        if (icon) {
            icon.textContent = allPlayersSortState.direction === 'desc' ? '↓' : '↑';
        }
    }
    
    // Re-render table
    renderAllPlayersTable(sortedData);
}

// Setup All Players team filter
function setupAllPlayersFilter() {
    const teamFilter = document.getElementById('all-players-team-filter');
    if (!teamFilter) return;
    
    teamFilter.addEventListener('change', function() {
        console.log('All Players team filter changed:', this.value);
        // Use current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadAllPlayersData(currentFilteredRecords);
    });
}

// ============================================================================
// TROPHY SCORERS FUNCTIONS
// ============================================================================

// Global variable to store current Trophy Scorers data and sort state
let trophyScorersCurrentData = [];
let trophyScorersSortState = {
    column: 'goalsAssists',
    direction: 'desc'
};

// Get trophy-winning seasons from TROPHY sheet
function getTrophySeasons() {
    const trophyData = getSheetRowsByCandidates(['TROPHY']);
    const seasons = new Set();
    
    trophyData.forEach(record => {
        const season = record.SEASON || record.season;
        if (season) {
            seasons.add(season);
        }
    });
    
    console.log(`Found ${seasons.size} trophy-winning seasons:`, Array.from(seasons));
    return seasons;
}

// Load and display Trophy Scorers data
function loadTrophyScorersData(filteredRecords = null) {
    console.log('Loading Trophy Scorers data...');
    
    const lineupDetails = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = filteredRecords || alAhlyStatsData.allRecords || [];
    
    if (!lineupDetails.length || !playerDetails.length || !matchDetails.length) {
        console.log('No data available for Trophy Scorers');
        renderTrophyScorersTable([]);
        return;
    }
    
    // Get trophy-winning seasons
    const trophySeasons = getTrophySeasons();
    if (trophySeasons.size === 0) {
        console.log('No trophy seasons found');
        renderTrophyScorersTable([]);
        return;
    }
    
    // Filter matches to only trophy-winning seasons
    const trophyMatches = matchDetails.filter(match => {
        const season = match.SEASON || match.season;
        return trophySeasons.has(season);
    });
    
    console.log(`Processing data from ${trophyMatches.length} matches in trophy-winning seasons`);
    
    // Get filtered match IDs
    const filteredMatchIds = new Set(trophyMatches.map(m => m.MATCH_ID));
    
    // Get team filter value
    const teamFilter = document.getElementById('trophy-scorers-team-filter')?.value || '';
    
    // Calculate stats for each player from LINEUPDETAILS
    const playersStats = {};
    
    // LINEUPDETAILS contains ONLY Al Ahly players
    // So we only use it if teamFilter is not 'AGAINST_AHLY'
    if (teamFilter !== 'AGAINST_AHLY') {
        lineupDetails.forEach(record => {
            // Skip if match not in filtered matches
            if (!filteredMatchIds.has(record.MATCH_ID)) return;
            
            const playerName = record['PLAYER NAME'] || record.PLAYER || '';
            const minutes = parseInt(record.MINTOTAL || 0);
            
            if (!playerName) return;
            
            if (!playersStats[playerName]) {
                playersStats[playerName] = {
                    name: playerName,
                    matches: new Set(),
                    minutes: 0,
                    goals: 0,
                    assists: 0,
                    winningMatches: new Set(),
                    equalizingMatches: new Set()
                };
            }
            
            playersStats[playerName].matches.add(record.MATCH_ID);
            playersStats[playerName].minutes += minutes;
        });
    }
    
    // Add goals and assists from PLAYERDETAILS
    playerDetails.forEach(record => {
        // Skip if match not in filtered matches
        if (!filteredMatchIds.has(record.MATCH_ID)) return;
        
        const playerName = record['PLAYER NAME'] || record.PLAYER || '';
        const playerTeam = normalizeStr(record.TEAM || record['AHLY TEAM'] || '');
        const ga = normalizeStr(record.GA || '').toUpperCase();
        
        if (!playerName) return;
        
        // Apply team filter
        if (teamFilter === 'WITH_AHLY') {
            if (playerTeam.trim() !== 'الأهلي' && playerTeam.trim().toLowerCase() !== 'ahly') return;
        } else if (teamFilter === 'AGAINST_AHLY') {
            if (playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly') return;
        }
        
        // Initialize player if not exists (for players who scored but weren't in lineup)
        if (!playersStats[playerName]) {
            playersStats[playerName] = {
                name: playerName,
                matches: new Set(),
                minutes: 0,
                goals: 0,
                assists: 0,
                winningMatches: new Set(),
                equalizingMatches: new Set()
            };
        }
        
        // Count goals - exact match with 'GOAL'
        if (ga === 'GOAL') {
            playersStats[playerName].goals++;
        }
        // Count assists - exact match with 'ASSIST'
        else if (ga === 'ASSIST') {
            playersStats[playerName].assists++;
        }
    });
    
    // Calculate winning and equalizing matches for each player
    Object.keys(playersStats).forEach(playerName => {
        const playerGoalEffect = calculatePlayerGoalEffect(playerName, playerDetails, trophyMatches, filteredMatchIds, teamFilter);
        playersStats[playerName].winningMatches = new Set(playerGoalEffect.winningMatches);
        playersStats[playerName].equalizingMatches = new Set(playerGoalEffect.equalizingMatches);
    });
    
    // Convert to array and calculate G+A
    const playersArray = Object.values(playersStats).map(player => ({
        name: player.name,
        matches: player.matches.size,
        minutes: player.minutes,
        goalsAssists: player.goals + player.assists,
        goals: player.goals,
        assists: player.assists,
        winningMatches: player.winningMatches.size,
        equalizingMatches: player.equalizingMatches.size
    }));
    
    // Sort by G+A descending (highest first) - default sort
    playersArray.sort((a, b) => b.goalsAssists - a.goalsAssists);
    
    // Reset sort state to default
    trophyScorersSortState = {
        column: 'goalsAssists',
        direction: 'desc'
    };
    
    // Render table
    renderTrophyScorersTable(playersArray);
    
    // Update header styling for default sort
    setTimeout(() => {
        document.querySelectorAll('#trophy-scorers-table th.sortable').forEach(th => {
            th.classList.remove('active');
            const icon = th.querySelector('.sort-icon');
            if (icon) icon.textContent = '⇅';
        });
        const headers = document.querySelectorAll('#trophy-scorers-table th.sortable');
        if (headers[3]) { // G+A column
            headers[3].classList.add('active');
            const icon = headers[3].querySelector('.sort-icon');
            if (icon) icon.textContent = '↓';
        }
    }, 0);
}

// Render Trophy Scorers table
function renderTrophyScorersTable(playersData) {
    const tbody = document.querySelector('#trophy-scorers-table tbody');
    if (!tbody) return;
    
    // Store current data for sorting
    trophyScorersCurrentData = playersData;
    
    tbody.innerHTML = '';
    
    if (playersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Calculate totals
    const totals = {
        matches: 0,
        minutes: 0,
        goalsAssists: 0,
        goals: 0,
        assists: 0,
        winningMatches: 0,
        equalizingMatches: 0
    };
    
    playersData.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${player.name}</strong></td>
            <td>${player.matches}</td>
            <td>${player.minutes}</td>
            <td><strong>${player.goalsAssists}</strong></td>
            <td>${player.goals}</td>
            <td>${player.assists}</td>
            <td>${player.winningMatches || 0}</td>
            <td>${player.equalizingMatches || 0}</td>
        `;
        tbody.appendChild(row);
        
        // Note: matches count per player, so we don't sum them
        totals.minutes += player.minutes;
        totals.goalsAssists += player.goalsAssists;
        totals.goals += player.goals;
        totals.assists += player.assists;
        totals.winningMatches += (player.winningMatches || 0);
        totals.equalizingMatches += (player.equalizingMatches || 0);
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td>${playersData.length} Players</td>
        <td>${totals.minutes}</td>
        <td><strong>${totals.goalsAssists}</strong></td>
        <td>${totals.goals}</td>
        <td>${totals.assists}</td>
        <td>${totals.winningMatches}</td>
        <td>${totals.equalizingMatches}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Trophy Scorers table rendered with ${playersData.length} players`);
}

// Sort Trophy Scorers table
function sortTrophyScorersTable(column) {
    console.log('Sorting Trophy Scorers table by:', column);
    
    // Update sort direction
    if (trophyScorersSortState.column === column) {
        trophyScorersSortState.direction = trophyScorersSortState.direction === 'desc' ? 'asc' : 'desc';
    } else {
        trophyScorersSortState.column = column;
        trophyScorersSortState.direction = 'desc';
    }
    
    // Sort the data
    const sortedData = [...trophyScorersCurrentData].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        // Handle string comparison for player name
        if (column === 'name') {
            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (trophyScorersSortState.direction === 'desc') {
                return valB.localeCompare(valA);
            } else {
                return valA.localeCompare(valB);
            }
        }
        
        // Handle numeric comparison
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        
        if (trophyScorersSortState.direction === 'desc') {
            return valB - valA;
        } else {
            return valA - valB;
        }
    });
    
    // Update active header styling
    document.querySelectorAll('#trophy-scorers-table th.sortable').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) {
            icon.textContent = '⇅';
        }
    });
    
    // Find and mark active header
    const headers = document.querySelectorAll('#trophy-scorers-table th.sortable');
    const columnMap = {
        'name': 0,
        'matches': 1,
        'minutes': 2,
        'goalsAssists': 3,
        'goals': 4,
        'assists': 5,
        'winningMatches': 6,
        'equalizingMatches': 7
    };
    
    const headerIndex = columnMap[column];
    if (headerIndex !== undefined && headers[headerIndex]) {
        headers[headerIndex].classList.add('active');
        const icon = headers[headerIndex].querySelector('.sort-icon');
        if (icon) {
            icon.textContent = trophyScorersSortState.direction === 'desc' ? '↓' : '↑';
        }
    }
    
    // Re-render table
    renderTrophyScorersTable(sortedData);
}

// Setup Trophy Scorers team filter
function setupTrophyScorersFilter() {
    const teamFilter = document.getElementById('trophy-scorers-team-filter');
    if (!teamFilter) return;
    
    teamFilter.addEventListener('change', function() {
        console.log('Trophy Scorers team filter changed:', this.value);
        // Use current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadTrophyScorersData(currentFilteredRecords);
    });
}

// ============================================================================
// ALL PLAYERS SUB-TABS FUNCTIONS
// ============================================================================

// Show All Players Sub-tab
function showAllPlayersSubTab(event, subtabName) {
    // Remove active class from all sub-tabs
    const subtabs = event.target.closest('.stats-sub-tabs').querySelectorAll('.stats-sub-tab');
    subtabs.forEach(tab => tab.classList.remove('active'));
    
    // Add active class to clicked sub-tab
    event.target.closest('.stats-sub-tab').classList.add('active');
    
    // Hide all subtab contents
    document.querySelectorAll('#all-players-tab .stats-subtab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Show selected subtab content
    const targetSubtab = document.getElementById(subtabName + '-subtab');
    if (targetSubtab) {
        targetSubtab.classList.add('active');
        
        // Load data based on which subtab is opened
        const currentFilteredRecords = getCurrentFilteredRecords();
        
        if (subtabName === 'trophy-scorers') {
            loadTrophyScorersData(currentFilteredRecords);
            setupTrophyScorersFilter();
        } else if (subtabName === 'variety-goals') {
            loadVarietyGoalsData(currentFilteredRecords);
        } else if (subtabName === 'penalty-details') {
            loadPenaltyDetailsData(currentFilteredRecords);
        }
    }
}
// Load Variety Goals data
function loadVarietyGoalsData(filteredRecords = null) {
    console.log('Loading Variety Goals data...');
    
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = filteredRecords || alAhlyStatsData.allRecords || [];
    
    if (!playerDetails.length || !matchDetails.length) {
        console.log('No data available for Variety Goals');
        renderVarietyGoalsTable([]);
        return;
    }
    
    console.log(`Processing data from ${matchDetails.length} matches`);
    
    // Get filtered match IDs
    const filteredMatchIds = new Set(matchDetails.map(m => m.MATCH_ID));
    
    // Get team filter value
    const teamFilter = document.getElementById('variety-goals-team-filter')?.value || '';
    
    // Calculate variety stats for each player
    const playersVarietyStats = {};
    
    playerDetails.forEach(record => {
        // Skip if match not in filtered matches
        if (!filteredMatchIds.has(record.MATCH_ID)) return;
        
        const playerName = record['PLAYER NAME'] || record.PLAYER || '';
        const playerTeam = normalizeStr(record.TEAM || record['AHLY TEAM'] || '');
        const ga = normalizeStr(record.GA || '').toUpperCase();
        const matchId = record.MATCH_ID;
        
        if (!playerName) return;
        
        // Apply team filter
        if (teamFilter === 'WITH_AHLY') {
            if (playerTeam.trim() !== 'الأهلي' && playerTeam.trim().toLowerCase() !== 'ahly') return;
        } else if (teamFilter === 'AGAINST_AHLY') {
            if (playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly') return;
        }
        
        // Initialize player if not exists
        if (!playersVarietyStats[playerName]) {
            playersVarietyStats[playerName] = {
                name: playerName,
                matchGoals: {}, // matchId: goalCount
                matchAssists: {}, // matchId: assistCount
                ownGoals: 0 // Total OG count
            };
        }
        
        // Count OWN GOALS from TYPE column (exact match)
        const typeVal = normalizeStr(record.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
        if (typeVal === 'OG') {
            playersVarietyStats[playerName].ownGoals++;
        }
        
        // Count goals per match
        if (ga === 'GOAL') {
            if (!playersVarietyStats[playerName].matchGoals[matchId]) {
                playersVarietyStats[playerName].matchGoals[matchId] = 0;
            }
            playersVarietyStats[playerName].matchGoals[matchId]++;
        }
        // Count assists per match
        else if (ga === 'ASSIST') {
            if (!playersVarietyStats[playerName].matchAssists[matchId]) {
                playersVarietyStats[playerName].matchAssists[matchId] = 0;
            }
            playersVarietyStats[playerName].matchAssists[matchId]++;
        }
    });
    
    // Calculate braces, hat-tricks, and 4+ for each player
    const playersArray = Object.values(playersVarietyStats).map(player => {
        const goalCounts = Object.values(player.matchGoals);
        const assistCounts = Object.values(player.matchAssists);
        
        return {
            name: player.name,
            goalBraces: goalCounts.filter(count => count === 2).length,
            goalHattricks: goalCounts.filter(count => count === 3).length,
            goal4Plus: goalCounts.filter(count => count >= 4).length,
            assistBraces: assistCounts.filter(count => count === 2).length,
            assistHattricks: assistCounts.filter(count => count === 3).length,
            assist4Plus: assistCounts.filter(count => count >= 4).length,
            ownGoals: player.ownGoals
        };
    }).filter(player => {
        // Only include players with at least one variety achievement or own goals
        return player.goalBraces > 0 || player.goalHattricks > 0 || player.goal4Plus > 0 ||
               player.assistBraces > 0 || player.assistHattricks > 0 || player.assist4Plus > 0 ||
               player.ownGoals > 0;
    });
    
    // Sort by total variety achievements descending
    playersArray.sort((a, b) => {
        const totalA = a.goalBraces + a.goalHattricks + a.goal4Plus + a.assistBraces + a.assistHattricks + a.assist4Plus;
        const totalB = b.goalBraces + b.goalHattricks + b.goal4Plus + b.assistBraces + b.assistHattricks + b.assist4Plus;
        return totalB - totalA;
    });
    
    // Reset sort state
    varietyGoalsSortState = {
        column: 'total',
        direction: 'desc'
    };
    
    // Render table
    renderVarietyGoalsTable(playersArray);
}

// Render Variety Goals table
function renderVarietyGoalsTable(playersData) {
    const tbody = document.querySelector('#variety-goals-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (playersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    varietyGoalsCurrentData = playersData;
    
    const totals = {
        goalBraces: 0,
        goalHattricks: 0,
        goal4Plus: 0,
        assistBraces: 0,
        assistHattricks: 0,
        assist4Plus: 0,
        ownGoals: 0
    };
    
    playersData.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.name}</td>
            <td>${player.goalBraces}</td>
            <td>${player.goalHattricks}</td>
            <td>${player.goal4Plus}</td>
            <td>${player.assistBraces}</td>
            <td>${player.assistHattricks}</td>
            <td>${player.assist4Plus}</td>
            <td>${player.ownGoals}</td>
        `;
        tbody.appendChild(row);
        
        totals.goalBraces += player.goalBraces;
        totals.goalHattricks += player.goalHattricks;
        totals.goal4Plus += player.goal4Plus;
        totals.assistBraces += player.assistBraces;
        totals.assistHattricks += player.assistHattricks;
        totals.assist4Plus += player.assist4Plus;
        totals.ownGoals += player.ownGoals;
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td>${totals.goalBraces}</td>
        <td>${totals.goalHattricks}</td>
        <td>${totals.goal4Plus}</td>
        <td>${totals.assistBraces}</td>
        <td>${totals.assistHattricks}</td>
        <td>${totals.assist4Plus}</td>
        <td>${totals.ownGoals}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Variety Goals table rendered with ${playersData.length} players`);
}

// Global variables for Variety Goals sorting
let varietyGoalsCurrentData = [];
let varietyGoalsSortState = {
    column: 'total',
    direction: 'desc'
};

// Sort Variety Goals table
function sortVarietyGoalsTable(column) {
    console.log('Sorting Variety Goals table by:', column);
    
    // Update sort direction
    if (varietyGoalsSortState.column === column) {
        varietyGoalsSortState.direction = varietyGoalsSortState.direction === 'desc' ? 'asc' : 'desc';
    } else {
        varietyGoalsSortState.column = column;
        varietyGoalsSortState.direction = 'desc';
    }
    
    // Sort data
    const sortedData = [...varietyGoalsCurrentData];
    sortedData.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                return varietyGoalsSortState.direction === 'desc' 
                    ? bVal.localeCompare(aVal) 
                    : aVal.localeCompare(bVal);
            case 'goalBraces':
                aVal = a.goalBraces;
                bVal = b.goalBraces;
                break;
            case 'goalHattricks':
                aVal = a.goalHattricks;
                bVal = b.goalHattricks;
                break;
            case 'goal4Plus':
                aVal = a.goal4Plus;
                bVal = b.goal4Plus;
                break;
            case 'assistBraces':
                aVal = a.assistBraces;
                bVal = b.assistBraces;
                break;
            case 'assistHattricks':
                aVal = a.assistHattricks;
                bVal = b.assistHattricks;
                break;
            case 'assist4Plus':
                aVal = a.assist4Plus;
                bVal = b.assist4Plus;
                break;
            case 'ownGoals':
                aVal = a.ownGoals;
                bVal = b.ownGoals;
                break;
            default:
                return 0;
        }
        
        return varietyGoalsSortState.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    // Update sort icons
    document.querySelectorAll('#variety-goals-table th.sortable').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    
    const headers = document.querySelectorAll('#variety-goals-table th.sortable');
    const columnMap = {
        'name': 0,
        'goalBraces': 1,
        'goalHattricks': 2,
        'goal4Plus': 3,
        'assistBraces': 4,
        'assistHattricks': 5,
        'assist4Plus': 6
    };
    
    const headerIndex = columnMap[column];
    if (headerIndex !== undefined && headers[headerIndex]) {
        headers[headerIndex].classList.add('active');
        const icon = headers[headerIndex].querySelector('.sort-icon');
        if (icon) {
            icon.textContent = varietyGoalsSortState.direction === 'desc' ? '↓' : '↑';
        }
    }
    
    // Re-render table
    renderVarietyGoalsTable(sortedData);
}

// Setup Variety Goals team filter
function setupVarietyGoalsFilter() {
    const teamFilter = document.getElementById('variety-goals-team-filter');
    if (!teamFilter) return;
    
    teamFilter.addEventListener('change', function() {
        console.log('Variety Goals team filter changed:', this.value);
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadVarietyGoalsData(currentFilteredRecords);
    });
}

// ============================================================================
// PENALTY DETAILS FUNCTIONS
// ============================================================================

// Load Penalty Details data
function loadPenaltyDetailsData(filteredRecords = null) {
    console.log('Loading Penalty Details data...');
    
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    const matchDetails = filteredRecords || alAhlyStatsData.allRecords || [];
    
    if (!playerDetails.length || !matchDetails.length) {
        console.log('No data available for Penalty Details');
        renderPenaltyDetailsTable([]);
        return;
    }
    
    console.log(`Processing data from ${matchDetails.length} matches`);
    
    // Get filtered match IDs
    const filteredMatchIds = new Set(matchDetails.map(m => m.MATCH_ID));
    
    // Get team filter value
    const teamFilter = document.getElementById('penalty-details-team-filter')?.value || '';
    
    // Calculate penalty stats for each player
    const playersPenaltyStats = {};
    
    playerDetails.forEach(record => {
        // Skip if match not in filtered matches
        if (!filteredMatchIds.has(record.MATCH_ID)) return;
        
        const playerName = record['PLAYER NAME'] || record.PLAYER || '';
        const playerTeam = normalizeStr(record.TEAM || record['AHLY TEAM'] || '');
        const gaVal = normalizeStr(record.GA || '').toUpperCase();
        const typeVal = normalizeStr(record.TYPE || '').toUpperCase().replace(/[^A-Z]/g, '');
        
        if (!playerName) return;
        
        // Apply team filter
        if (teamFilter === 'WITH_AHLY') {
            if (playerTeam.trim() !== 'الأهلي' && playerTeam.trim().toLowerCase() !== 'ahly') return;
        } else if (teamFilter === 'AGAINST_AHLY') {
            if (playerTeam.trim() === 'الأهلي' || playerTeam.trim().toLowerCase() === 'ahly') return;
        }
        
        // Initialize player if not exists
        if (!playersPenaltyStats[playerName]) {
            playersPenaltyStats[playerName] = {
                name: playerName,
                penaltyGoals: 0,
                penaltyMissed: 0,
                assistGoals: 0,
                assistMissed: 0,
                makeGoal: 0,
                makeMissed: 0
            };
        }
        
        // Count penalty-related actions from TYPE (same logic as Player Overview)
        if (typeVal === 'PENGOAL') {
            playersPenaltyStats[playerName].penaltyGoals++;
        }
        if (typeVal === 'PENMISSED') {
            playersPenaltyStats[playerName].penaltyMissed++;
        }
        if (typeVal === 'PENASSISTGOAL') {
            playersPenaltyStats[playerName].assistGoals++;
        }
        if (typeVal === 'PENASSISTMISSED') {
            playersPenaltyStats[playerName].assistMissed++;
        }
        if (typeVal === 'PENMAKEGOAL') {
            playersPenaltyStats[playerName].makeGoal++;
        }
        if (typeVal === 'PENMAKEMISSED') {
            playersPenaltyStats[playerName].makeMissed++;
        }
        
        // Also check GA as fallback (same as Player Overview)
        const gaNorm = gaVal.replace(/[^A-Z]/g, '');
        if (gaNorm === 'PENGOAL') {
            playersPenaltyStats[playerName].penaltyGoals++;
        }
        if (gaNorm === 'PENMISSED') {
            playersPenaltyStats[playerName].penaltyMissed++;
        }
        if (gaNorm === 'PENASSISTGOAL') {
            playersPenaltyStats[playerName].assistGoals++;
        }
        if (gaNorm === 'PENASSISTMISSED') {
            playersPenaltyStats[playerName].assistMissed++;
        }
        if (gaNorm === 'PENMAKEGOAL') {
            playersPenaltyStats[playerName].makeGoal++;
        }
        if (gaNorm === 'PENMAKEMISSED') {
            playersPenaltyStats[playerName].makeMissed++;
        }
    });
    
    // Convert to array and filter out players with no penalty actions
    const playersArray = Object.values(playersPenaltyStats).filter(player => {
        return player.penaltyGoals > 0 || player.penaltyMissed > 0 || 
               player.assistGoals > 0 || player.assistMissed > 0 ||
               player.makeGoal > 0 || player.makeMissed > 0;
    });
    
    // Calculate totals for each player
    playersArray.forEach(player => {
        player.totalPenalty = player.penaltyGoals + player.penaltyMissed;
        player.totalAssist = player.assistGoals + player.assistMissed;
        player.totalMake = player.makeGoal + player.makeMissed;
    });
    
    // Sort by total penalty descending
    playersArray.sort((a, b) => b.totalPenalty - a.totalPenalty);
    
    // Reset sort state
    penaltyDetailsSortState = {
        column: 'totalPenalty',
        direction: 'desc'
    };
    
    // Render table
    renderPenaltyDetailsTable(playersArray);
}

// Render Penalty Details table
function renderPenaltyDetailsTable(playersData) {
    const tbody = document.querySelector('#penalty-details-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (playersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 2rem;">No data available</td></tr>';
        return;
    }
    
    penaltyDetailsCurrentData = playersData;
    
    const totals = {
        totalPenalty: 0,
        penaltyGoals: 0,
        penaltyMissed: 0,
        totalAssist: 0,
        assistGoals: 0,
        assistMissed: 0,
        totalMake: 0,
        makeGoal: 0,
        makeMissed: 0
    };
    
    playersData.forEach(player => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${player.name}</td>
            <td>${player.totalPenalty}</td>
            <td>${player.penaltyGoals}</td>
            <td>${player.penaltyMissed}</td>
            <td>${player.totalAssist}</td>
            <td>${player.assistGoals}</td>
            <td>${player.assistMissed}</td>
            <td>${player.totalMake}</td>
            <td>${player.makeGoal}</td>
            <td>${player.makeMissed}</td>
        `;
        tbody.appendChild(row);
        
        totals.totalPenalty += player.totalPenalty;
        totals.penaltyGoals += player.penaltyGoals;
        totals.penaltyMissed += player.penaltyMissed;
        totals.totalAssist += player.totalAssist;
        totals.assistGoals += player.assistGoals;
        totals.assistMissed += player.assistMissed;
        totals.totalMake += player.totalMake;
        totals.makeGoal += player.makeGoal;
        totals.makeMissed += player.makeMissed;
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td>${totals.totalPenalty}</td>
        <td>${totals.penaltyGoals}</td>
        <td>${totals.penaltyMissed}</td>
        <td>${totals.totalAssist}</td>
        <td>${totals.assistGoals}</td>
        <td>${totals.assistMissed}</td>
        <td>${totals.totalMake}</td>
        <td>${totals.makeGoal}</td>
        <td>${totals.makeMissed}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Penalty Details table rendered with ${playersData.length} players`);
}

// Global variables for Penalty Details sorting
let penaltyDetailsCurrentData = [];
let penaltyDetailsSortState = {
    column: 'totalPenalty',
    direction: 'desc'
};

// Sort Penalty Details table
function sortPenaltyDetailsTable(column) {
    console.log('Sorting Penalty Details table by:', column);
    
    // Update sort direction
    if (penaltyDetailsSortState.column === column) {
        penaltyDetailsSortState.direction = penaltyDetailsSortState.direction === 'desc' ? 'asc' : 'desc';
    } else {
        penaltyDetailsSortState.column = column;
        penaltyDetailsSortState.direction = 'desc';
    }
    
    // Sort data
    const sortedData = [...penaltyDetailsCurrentData];
    sortedData.sort((a, b) => {
        let aVal, bVal;
        
        switch (column) {
            case 'name':
                aVal = a.name.toLowerCase();
                bVal = b.name.toLowerCase();
                return penaltyDetailsSortState.direction === 'desc' 
                    ? bVal.localeCompare(aVal) 
                    : aVal.localeCompare(bVal);
            case 'totalPenalty':
                aVal = a.totalPenalty;
                bVal = b.totalPenalty;
                break;
            case 'penaltyGoals':
                aVal = a.penaltyGoals;
                bVal = b.penaltyGoals;
                break;
            case 'penaltyMissed':
                aVal = a.penaltyMissed;
                bVal = b.penaltyMissed;
                break;
            case 'totalAssist':
                aVal = a.totalAssist;
                bVal = b.totalAssist;
                break;
            case 'assistGoals':
                aVal = a.assistGoals;
                bVal = b.assistGoals;
                break;
            case 'assistMissed':
                aVal = a.assistMissed;
                bVal = b.assistMissed;
                break;
            case 'totalMake':
                aVal = a.totalMake;
                bVal = b.totalMake;
                break;
            case 'makeGoal':
                aVal = a.makeGoal;
                bVal = b.makeGoal;
                break;
            case 'makeMissed':
                aVal = a.makeMissed;
                bVal = b.makeMissed;
                break;
            default:
                return 0;
        }
        
        return penaltyDetailsSortState.direction === 'desc' ? bVal - aVal : aVal - bVal;
    });
    
    // Update sort icons
    document.querySelectorAll('#penalty-details-table th.sortable').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = '⇅';
    });
    
    const headers = document.querySelectorAll('#penalty-details-table th.sortable');
    const columnMap = {
        'name': 0,
        'penaltyGoals': 1,
        'penaltyMissed': 2,
        'assistGoals': 3,
        'assistMissed': 4,
        'makeGoal': 5,
        'makeMissed': 6
    };
    
    const headerIndex = columnMap[column];
    if (headerIndex !== undefined && headers[headerIndex]) {
        headers[headerIndex].classList.add('active');
        const icon = headers[headerIndex].querySelector('.sort-icon');
        if (icon) {
            icon.textContent = penaltyDetailsSortState.direction === 'desc' ? '↓' : '↑';
        }
    }
    
    // Re-render table
    renderPenaltyDetailsTable(sortedData);
}

// Setup Penalty Details team filter
function setupPenaltyDetailsFilter() {
    const teamFilter = document.getElementById('penalty-details-team-filter');
    if (!teamFilter) return;
    
    teamFilter.addEventListener('change', function() {
        console.log('Penalty Details team filter changed:', this.value);
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadPenaltyDetailsData(currentFilteredRecords);
    });
}

// ============================================================================
// H2H TEAMS FUNCTIONS
// ============================================================================

// Load and display H2H Teams data
function loadH2HTeamsData(filteredRecords = null) {
    console.log('Loading H2H Teams data...');
    
    // Use filtered records if provided, otherwise use all records
    const records = filteredRecords || alAhlyStatsData.allRecords || [];
    if (records.length === 0) {
        console.log('No records available for H2H');
        renderH2HTeamsTable([]);
        return;
    }
    
    console.log(`Processing ${records.length} records for H2H Teams`);
    
    // Calculate stats for each opponent team
    const teamsStats = {};
    
    records.forEach(match => {
        const opponentTeam = match['OPPONENT TEAM'] || match['OPPONENT'] || 'Unknown';
        
        if (!teamsStats[opponentTeam]) {
            teamsStats[opponentTeam] = {
                team: opponentTeam,
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
        
        const stats = teamsStats[opponentTeam];
        stats.matches++;
        
        // Count results (D WITH G and D. both count as draws)
        const result = match['W-D-L'] || '';
        if (result === 'W') {
            stats.wins++;
        } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
            stats.draws++;
        } else if (result === 'L') {
            stats.losses++;
        }
        
        // Goals
        const goalsFor = parseInt(match['GOALS FOR'] || match['GF'] || 0);
        const goalsAgainst = parseInt(match['GOALS AGAINST'] || match['GA'] || 0);
        stats.goalsFor += goalsFor;
        stats.goalsAgainst += goalsAgainst;
        
        // Clean sheets
        if (goalsAgainst === 0) stats.cleanSheetsFor++;
        if (goalsFor === 0) stats.cleanSheetsAgainst++;
    });
    
    // Convert to array and sort by matches (descending)
    const teamsArray = Object.values(teamsStats).sort((a, b) => b.matches - a.matches);
    
    // Render table
    renderH2HTeamsTable(teamsArray);
    
    // Setup search functionality
    setupH2HSearch(teamsArray);
    
    // Update Countries tab if it's currently visible
    const countriesTab = document.getElementById('h2h-countries-subtab');
    if (countriesTab && countriesTab.style.display !== 'none') {
        loadH2HCountriesData();
    }
}

// Render H2H Teams table
function renderH2HTeamsTable(teamsData) {
    const tbody = document.querySelector('#h2h-teams-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (teamsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheetsFor: 0,
        cleanSheetsAgainst: 0
    };
    
    teamsData.forEach(team => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${team.team}</strong></td>
            <td>${team.matches}</td>
            <td>${team.wins}</td>
            <td>${team.draws}</td>
            <td>${team.losses}</td>
            <td>${team.goalsFor}</td>
            <td>${team.goalsAgainst}</td>
            <td>${team.cleanSheetsFor}</td>
            <td>${team.cleanSheetsAgainst}</td>
        `;
        tbody.appendChild(row);
        
        // Sum up totals
        totals.matches += team.matches;
        totals.wins += team.wins;
        totals.draws += team.draws;
        totals.losses += team.losses;
        totals.goalsFor += team.goalsFor;
        totals.goalsAgainst += team.goalsAgainst;
        totals.cleanSheetsFor += team.cleanSheetsFor;
        totals.cleanSheetsAgainst += team.cleanSheetsAgainst;
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f0f0f0';
    totalRow.style.borderTop = '2px solid #333';
    totalRow.innerHTML = `
        <td><strong>TOTAL</strong></td>
        <td>${totals.matches}</td>
        <td>${totals.wins}</td>
        <td>${totals.draws}</td>
        <td>${totals.losses}</td>
        <td>${totals.goalsFor}</td>
        <td>${totals.goalsAgainst}</td>
        <td>${totals.cleanSheetsFor}</td>
        <td>${totals.cleanSheetsAgainst}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`H2H Teams table rendered with ${teamsData.length} teams`);
}

// Setup H2H search functionality
function setupH2HSearch(teamsData) {
    const searchInput = document.getElementById('h2h-teams-search');
    if (!searchInput) return;
    
    // Store teams data for search
    searchInput._teamsData = teamsData;
    
    // Remove existing listener if any
    const newSearchInput = searchInput.cloneNode(true);
    newSearchInput._teamsData = teamsData;
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Add input event listener for real-time search
    newSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const currentTeamsData = this._teamsData || teamsData;
        
        if (searchTerm === '') {
            // Show all teams (filtered by main filters)
            renderH2HTeamsTable(currentTeamsData);
        } else {
            // Filter teams by search term
            const filteredTeams = currentTeamsData.filter(team => 
                team.team.toLowerCase().includes(searchTerm)
            );
            renderH2HTeamsTable(filteredTeams);
        }
    });
    
    console.log('H2H search functionality initialized');
}
// Show H2H Teams sub-tab
function showH2HTeamsSubTab(evt, tabName) {
    // Hide all sub-tab contents by removing active class
    const subTabContents = document.querySelectorAll('#h2h-tab .stats-subtab-content');
    subTabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all sub-tab buttons
    const subTabButtons = document.querySelectorAll('#h2h-tab .stats-subtab');
    subTabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show the selected sub-tab content by adding active class
    const selectedContent = document.getElementById(tabName);
    if (selectedContent) {
        selectedContent.classList.add('active');
        console.log('Showing tab:', tabName);
        console.log('Tab element:', selectedContent);
        console.log('Tab has active class:', selectedContent.classList.contains('active'));
        console.log('Tab computed display:', window.getComputedStyle(selectedContent).display);
        console.log('Tab computed visibility:', window.getComputedStyle(selectedContent).visibility);
        console.log('Tab innerHTML length:', selectedContent.innerHTML.length);
    } else {
        console.error('Could not find tab element:', tabName);
    }
    
    // Add active class to the clicked button
    evt.currentTarget.classList.add('active');
    
    // Load countries data if Countries tab is selected
    if (tabName === 'h2h-countries-subtab') {
        // Wait a bit for the tab to be visible, then load data
        setTimeout(() => {
            console.log('Loading countries data for tab:', tabName);
            loadH2HCountriesData();
        }, 100);
    }
}

// Load H2H Countries data
function loadH2HCountriesData() {
    try {
        console.log('Loading H2H Countries data...');
        
        // Check if data is available
        if (!alAhlyStatsData || !alAhlyStatsData.allRecords) {
            console.error('No data available for H2H Countries');
            // Show loading message
            const tbody = document.querySelector('#h2h-countries-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #6c757d;">Loading data...</td></tr>';
            }
            
            // Try to load data if not available
            if (typeof loadAlAhlyStatsData === 'function') {
                console.log('Attempting to load data...');
                loadAlAhlyStatsData().then(() => {
                    loadH2HCountriesData();
                });
            }
            return;
        }
        
        console.log(`Processing ${alAhlyStatsData.allRecords.length} records for H2H Countries`);
        
        // Get current filtered records
        const currentFilteredRecords = getCurrentFilteredRecords();
        const recordsToUse = currentFilteredRecords || alAhlyStatsData.allRecords;
        
        console.log(`Using ${recordsToUse.length} records for country calculations`);
        
        // Calculate country statistics
        const countryStats = calculateCountryStats(recordsToUse);
        
        console.log(`Calculated stats for ${countryStats.length} countries`);
        
        // Render the countries table
        renderH2HCountriesTable(countryStats);
        
    } catch (error) {
        console.error('Error loading H2H Countries data:', error);
        // Show error message
        const tbody = document.querySelector('#h2h-countries-table tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #dc3545;">Error loading data</td></tr>';
        }
    }
}

// Calculate country statistics from match records
function calculateCountryStats(records) {
    const countryMap = new Map();
    
    records.forEach(match => {
        const opponentTeam = (match['OPPONENT TEAM'] || '').toString().trim();
        if (!opponentTeam) return;
        
        // Extract country name (after the last " - ")
        const parts = opponentTeam.split(' - ');
        if (parts.length < 2) return;
        
        const country = parts[parts.length - 1].trim();
        if (!country) return;
        
        // Initialize country stats if not exists
        if (!countryMap.has(country)) {
            countryMap.set(country, {
                country: country,
                teams: new Set(),
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goals_for: 0,
                goals_against: 0,
                clean_sheets_for: 0,
                clean_sheets_against: 0
            });
        }
        
        const countryStats = countryMap.get(country);
        
        // Add team to country's teams set
        countryStats.teams.add(opponentTeam);
        
        // Parse match result
        const result = (match['W-D-L'] || '').toString().trim();
        const gf = parseInt(match['GF'] || 0) || 0;
        const ga = parseInt(match['GA'] || 0) || 0;
        
        // Update statistics
        countryStats.matches += 1;
        countryStats.goals_for += gf;
        countryStats.goals_against += ga;
        
        // Clean sheets
        if (ga === 0) countryStats.clean_sheets_for += 1;
        if (gf === 0) countryStats.clean_sheets_against += 1;
        
        // W-D-L
        if (result === 'W') {
            countryStats.wins += 1;
        } else if (result.includes('D')) {
            countryStats.draws += 1;
        } else if (result === 'L') {
            countryStats.losses += 1;
        }
    });
    
    // Convert to array and sort by matches (descending)
    const countries = Array.from(countryMap.values()).map(country => ({
        ...country,
        teams_count: country.teams.size
    })).sort((a, b) => b.matches - a.matches);
    
    return countries;
}

// Render H2H Countries table
function renderH2HCountriesTable(countries) {
    console.log('Rendering H2H Countries table with', countries.length, 'countries');
    
    const tbody = document.querySelector('#h2h-countries-table tbody');
    if (!tbody) {
        console.error('Could not find #h2h-countries-table tbody element');
        return;
    }
    
    if (countries.length === 0) {
        console.log('No countries data to display');
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #6c757d;">No country data available</td></tr>';
        return;
    }
    
    let tableHTML = '';
    
    countries.forEach((country, index) => {
        console.log(`Country ${index + 1}:`, country.country, '- Teams:', country.teams_count, '- Matches:', country.matches);
        
        tableHTML += `
            <tr>
                <td style="color: #007bff; font-weight: 600;">${country.teams_count}</td>
                <td style="font-weight: 600;">${country.country}</td>
                <td style="font-weight: 600;">${country.matches}</td>
                <td style="color: #28a745; font-weight: 600;">${country.wins}</td>
                <td style="color: #ffc107; font-weight: 600;">${country.draws}</td>
                <td style="color: #dc3545; font-weight: 600;">${country.losses}</td>
                <td style="color: #007bff; font-weight: 600;">${country.goals_for}</td>
                <td style="color: #6c757d; font-weight: 600;">${country.goals_against}</td>
                <td style="color: #17a2b8; font-weight: 600;">${country.clean_sheets_for}</td>
                <td style="color: #fd7e14; font-weight: 600;">${country.clean_sheets_against}</td>
            </tr>
        `;
    });
    
    console.log('Setting table HTML with', countries.length, 'rows');
    tbody.innerHTML = tableHTML;
    console.log('Table HTML set successfully');
    
    // Debug: Check if table is visible
    const table = document.getElementById('h2h-countries-table');
    const subtab = document.getElementById('h2h-countries-subtab');
    console.log('Countries table element:', table);
    console.log('Countries subtab element:', subtab);
    console.log('Subtab display:', subtab ? window.getComputedStyle(subtab).display : 'N/A');
    console.log('Subtab classes:', subtab ? subtab.className : 'N/A');
    console.log('Table display:', table ? window.getComputedStyle(table).display : 'N/A');
    console.log('Table visibility:', table ? window.getComputedStyle(table).visibility : 'N/A');
}

// H2H T DETAILS FUNCTIONS
// ============================================================================

// Load opponent teams for H2H T Details search
async function loadH2HTDetailsTeams() {
    try {
        console.log('Loading opponent teams for H2H T Details...');
        const response = await fetch('/api/opponent-teams');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.teams && data.teams.length > 0) {
            console.log(`✅ Loaded ${data.teams.length} teams from API`);
            setupH2HTDetailsSearch(data.teams);
        } else {
            console.warn('⚠️ No teams data from API, trying fallback...');
            loadH2HTDetailsTeamsFallback();
        }
    } catch (error) {
        console.error('❌ Error loading opponent teams for H2H T Details:', error);
        console.log('🔄 Trying fallback method...');
        loadH2HTDetailsTeamsFallback();
    }
}

// Fallback method to load teams from existing data
function loadH2HTDetailsTeamsFallback() {
    try {
        console.log('🔄 Loading teams from existing data as fallback...');
        
        // Check if we have alAhlyStatsData available
        if (alAhlyStatsData && alAhlyStatsData.allRecords) {
            console.log(`📊 Using ${alAhlyStatsData.allRecords.length} records for fallback`);
            
            // Extract unique opponent teams from existing data
            const opponentTeams = new Set();
            alAhlyStatsData.allRecords.forEach(match => {
                const opponentTeam = match['OPPONENT TEAM'] || match['OPPONENT'] || '';
                if (opponentTeam.trim()) {
                    opponentTeams.add(opponentTeam.trim());
                }
            });
            
            const teamsList = Array.from(opponentTeams).sort();
            console.log(`✅ Fallback loaded ${teamsList.length} teams: ${teamsList.slice(0, 5).join(', ')}...`);
            
            setupH2HTDetailsSearch(teamsList);
        } else {
            console.error('❌ No fallback data available - alAhlyStatsData not loaded');
            // Show error message in search input
            const searchInput = document.getElementById('h2h-t-details-team-search');
            if (searchInput) {
                searchInput.placeholder = 'Error loading teams - please refresh page';
                searchInput.disabled = true;
            }
        }
    } catch (error) {
        console.error('❌ Fallback method also failed:', error);
    }
}

// Load opponent teams with filtered data
function loadH2HTDetailsTeamsWithFilteredData(filteredRecords) {
    try {
        console.log('Loading opponent teams from filtered data...');
        
        // Extract unique opponent teams from filtered records
        const opponentTeams = new Set();
        filteredRecords.forEach(match => {
            const opponentTeam = match['OPPONENT TEAM'] || match['OPPONENT'] || '';
            if (opponentTeam.trim()) {
                opponentTeams.add(opponentTeam.trim());
            }
        });
        
        const teamsList = Array.from(opponentTeams).sort();
        console.log(`Found ${teamsList.length} unique teams in filtered data`);
        
        setupH2HTDetailsSearch(teamsList);
        
        // Update currently selected team stats with filtered data
        updateCurrentH2HTDetailsWithFilters(filteredRecords);
    } catch (error) {
        console.error('Error loading opponent teams from filtered data:', error);
    }
}

// Search H2H T Details teams function
function searchH2HTDetailsTeams(searchTerm) {
    const searchInput = document.getElementById('h2h-t-details-team-search');
    const dropdown = document.getElementById('h2h-t-details-team-dropdown');
    
    if (!searchInput || !dropdown) return;
    
    const teams = searchInput._teamsData || [];
    const term = searchTerm.toLowerCase().trim();
    
    if (term === '') {
        dropdown.style.display = 'none';
        return;
    }
    
    // Filter teams
    const filteredTeams = teams.filter(team => 
        team.toLowerCase().includes(term)
    );
    
    // Show dropdown with filtered teams
    if (filteredTeams.length > 0) {
        dropdown.innerHTML = '';
        filteredTeams.forEach(team => {
            const teamItem = document.createElement('div');
            teamItem.className = 'team-item';
            teamItem.style.cssText = 'padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; transition: background-color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;';
            teamItem.textContent = team;
            
            teamItem.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f8f9fa';
            });
            
            teamItem.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'white';
            });
            
            teamItem.addEventListener('click', function() {
                searchInput.value = team;
                dropdown.style.display = 'none';
                loadH2HTDetailsData(team);
            });
            
            dropdown.appendChild(teamItem);
        });
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

// Setup H2H T Details search functionality
function setupH2HTDetailsSearch(teams) {
    const searchInput = document.getElementById('h2h-t-details-team-search');
    const dropdown = document.getElementById('h2h-t-details-team-dropdown');
    
    if (searchInput && dropdown) {
        // Store teams data
        searchInput._teamsData = teams;
        
        // Clear existing event listeners
        searchInput.removeEventListener('input', searchInput._inputHandler);
        
        // Add event listener for search input
        searchInput._inputHandler = function() {
            const searchTerm = this.value.toLowerCase().trim();
            const teams = this._teamsData || [];
            
            if (searchTerm === '') {
                dropdown.style.display = 'none';
                return;
            }
            
            // Filter teams
            const filteredTeams = teams.filter(team => 
                team.toLowerCase().includes(searchTerm)
            );
            
            // Show dropdown with filtered teams
            if (filteredTeams.length > 0) {
                dropdown.innerHTML = '';
                filteredTeams.forEach(team => {
                    const teamItem = document.createElement('div');
                    teamItem.className = 'team-item';
                    teamItem.style.cssText = 'padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #eee; transition: background-color 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;';
                    teamItem.textContent = team;
                    
                    teamItem.addEventListener('mouseenter', function() {
                        this.style.backgroundColor = '#f8f9fa';
                    });
                    
                    teamItem.addEventListener('mouseleave', function() {
                        this.style.backgroundColor = 'white';
                    });
                    
                    teamItem.addEventListener('click', function() {
                        searchInput.value = team;
                        dropdown.style.display = 'none';
                        loadH2HTDetailsData(team);
                    });
                    
                    dropdown.appendChild(teamItem);
                });
                dropdown.style.display = 'block';
            } else {
                dropdown.style.display = 'none';
            }
        };
        
        searchInput.addEventListener('input', searchInput._inputHandler);
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
        
        console.log(`Setup H2H T Details search with ${teams.length} teams`);
    }
}

// Update currently selected H2H T Details with new filters
function updateCurrentH2HTDetailsWithFilters(filteredRecords) {
    const searchInput = document.getElementById('h2h-t-details-team-search');
    if (searchInput && searchInput.value.trim()) {
        const selectedTeam = searchInput.value.trim();
        console.log(`Updating H2H stats for currently selected team: ${selectedTeam}`);
        
        // Recalculate stats for the selected team with new filters
        const h2hStats = calculateH2HTDetailsFromFilteredData(selectedTeam, filteredRecords);
        if (h2hStats) {
            renderH2HTDetailsOverview(h2hStats.overview, selectedTeam);
            renderH2HTDetailsChampionships(h2hStats.championships, selectedTeam);
            renderH2HTDetailsSeasons(h2hStats.seasons, selectedTeam);
        } else {
            // Clear the display if no matches found with current filters
            const content = document.getElementById('h2h-t-overview-content');
            if (content) {
                content.innerHTML = `
                    <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">H2H T Details - Overview</h3>
                    <p style="text-align: center; color: #6c757d; font-size: 0.9rem; margin-bottom: 1rem;">
                        <em>لا توجد مباريات ضد ${selectedTeam} مع الفلاتر المطبقة حالياً</em>
                    </p>
                `;
            }
            
            const championshipsContent = document.getElementById('h2h-t-championships-content');
            if (championshipsContent) {
                championshipsContent.innerHTML = `
                    <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Championships Statistics</h3>
                    <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                        لا توجد مباريات ضد ${selectedTeam} مع الفلاتر المطبقة حالياً
                    </p>
                `;
            }
            
            const seasonsContent = document.getElementById('h2h-t-seasons-content');
            if (seasonsContent) {
                seasonsContent.innerHTML = `
                    <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Seasons Statistics</h3>
                    <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                        لا توجد مباريات ضد ${selectedTeam} مع الفلاتر المطبقة حالياً
                    </p>
                `;
            }
        }
    }
}

// Load H2H T Details data for selected team
async function loadH2HTDetailsData(teamName) {
    try {
        console.log(`🎯 Loading H2H T Details for team: ${teamName}`);
        
        // Show loading state
        const overviewContent = document.getElementById('h2h-t-overview-content');
        const championshipsContent = document.getElementById('h2h-t-championships-content');
        const seasonsContent = document.getElementById('h2h-t-seasons-content');
        
        if (overviewContent) {
            overviewContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6c757d;">Loading data...</div>';
        }
        if (championshipsContent) {
            championshipsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6c757d;">Loading data...</div>';
        }
        if (seasonsContent) {
            seasonsContent.innerHTML = '<div style="text-align: center; padding: 2rem; color: #6c757d;">Loading data...</div>';
        }
        
        // Get current filtered records to apply filters to H2H data
        const currentFilteredRecords = getCurrentFilteredRecords();
        
        if (currentFilteredRecords && currentFilteredRecords.length > 0) {
            console.log(`🔄 Applying filters to H2H T Details: ${currentFilteredRecords.length} filtered records`);
            // Calculate H2H stats from filtered data
            const h2hStats = calculateH2HTDetailsFromFilteredData(teamName, currentFilteredRecords);
            if (h2hStats) {
                console.log('✅ Successfully calculated H2H stats from filtered data');
                renderH2HTDetailsOverview(h2hStats.overview, teamName);
                renderH2HTDetailsChampionships(h2hStats.championships, teamName);
                renderH2HTDetailsSeasons(h2hStats.seasons, teamName);
                return;
            } else {
                console.warn('⚠️ Failed to calculate H2H stats from filtered data, trying API...');
            }
        }
        
        // Fallback to API call if no filtered data or calculation fails
        console.log(`🌐 Making API call to /api/h2h-t-details/${encodeURIComponent(teamName)}`);
        
        try {
            const response = await fetch(`/api/h2h-t-details/${encodeURIComponent(teamName)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 API response received:', data);
            
            if (data.overview && data.championships) {
                console.log('✅ Valid data received, rendering...');
                renderH2HTDetailsOverview(data.overview, teamName);
                renderH2HTDetailsChampionships(data.championships, teamName);
                if (data.seasons) {
                    renderH2HTDetailsSeasons(data.seasons, teamName);
                }
            } else {
                console.error('❌ Invalid data received for H2H T Details:', data);
                throw new Error('Invalid API response');
            }
        } catch (apiError) {
            console.warn('⚠️ API call failed, trying fallback calculation:', apiError);
            
            // Fallback: Calculate from existing data
            if (alAhlyStatsData && alAhlyStatsData.allRecords) {
                console.log('🔄 Using fallback calculation from existing data...');
                const fallbackStats = calculateH2HTDetailsFromFilteredData(teamName, alAhlyStatsData.allRecords);
                if (fallbackStats) {
                    console.log('✅ Fallback calculation successful');
                    renderH2HTDetailsOverview(fallbackStats.overview, teamName);
                    renderH2HTDetailsChampionships(fallbackStats.championships, teamName);
                    renderH2HTDetailsSeasons(fallbackStats.seasons, teamName);
                } else {
                    throw new Error('Fallback calculation also failed');
                }
            } else {
                throw new Error('No data available for fallback');
            }
        }
    } catch (error) {
        console.error(`❌ Error loading H2H T Details for ${teamName}:`, error);
        // Show error message
        const overviewContent = document.getElementById('h2h-t-overview-content');
        if (overviewContent) {
            overviewContent.innerHTML = `<div style="text-align: center; padding: 2rem; color: #dc3545;">Error: ${error.message}</div>`;
        }
    }
}

// Calculate H2H T Details from filtered data
function calculateH2HTDetailsFromFilteredData(teamName, filteredRecords) {
    try {
        console.log(`Calculating H2H stats for ${teamName} from ${filteredRecords.length} filtered records`);
        
        // Filter records for the specific team
        const teamMatches = filteredRecords.filter(record => {
            const opponentTeam = record['OPPONENT TEAM'] || record['OPPONENT'] || '';
            return opponentTeam.trim().toLowerCase() === teamName.trim().toLowerCase();
        });
        
        console.log(`Found ${teamMatches.length} matches against ${teamName}`);
        
        if (teamMatches.length === 0) {
            return null;
        }
        
        // Calculate overview stats
        const overview = {
            total_matches: teamMatches.length,
            wins: 0,
            draws: 0,
            losses: 0,
            goals_for: 0,
            goals_against: 0,
            clean_sheets_for: 0,
            clean_sheets_against: 0
        };
        
        // Aggregate championship and season stats in maps first
        const championshipNameToStats = new Map();
        const seasonNameToStats = new Map();
        
        teamMatches.forEach(match => {
            const gf = parseInt(match['GF'] || 0);
            const ga = parseInt(match['GA'] || 0);
            const result = (match['W-D-L'] || '').toString().toUpperCase();
            const champion = (match['CHAMPION'] || 'Unknown').toString();
            const cleanSheetFor = String(match['CLEAN SHEET'] || '').toUpperCase() === 'YES' || ga === 0 ? 1 : 0;
            const cleanSheetAgainst = gf === 0 ? 1 : 0;
            
            // Update overview stats
            overview.goals_for += gf;
            overview.goals_against += ga;
            overview.clean_sheets_for += cleanSheetFor;
            overview.clean_sheets_against += cleanSheetAgainst;
            
            // Count wins/draws/losses
            if (result === 'W') {
                overview.wins++;
            } else if (result === 'D') {
                overview.draws++;
            } else if (result === 'L') {
                overview.losses++;
            }
            
            // Update championship stats
            if (!championshipNameToStats.has(champion)) {
                championshipNameToStats.set(champion, {
                    championship: champion,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goals_for: 0,
                    goals_against: 0,
                    clean_sheets_for: 0,
                    clean_sheets_against: 0
                });
            }
            const champStats = championshipNameToStats.get(champion);
            champStats.matches += 1;
            champStats.goals_for += gf;
            champStats.goals_against += ga;
            champStats.clean_sheets_for += cleanSheetFor;
            champStats.clean_sheets_against += cleanSheetAgainst;
            if (result === 'W') {
                champStats.wins += 1;
            } else if (result.includes('D')) {
                champStats.draws += 1;
            } else if (result === 'L') {
                champStats.losses += 1;
            }
            
            // Update season stats
            const season = (match['SEASON'] || 'Unknown').toString();
            if (!seasonNameToStats.has(season)) {
                seasonNameToStats.set(season, {
                    season: season,
                    matches: 0,
                    wins: 0,
                    draws: 0,
                    losses: 0,
                    goals_for: 0,
                    goals_against: 0,
                    clean_sheets_for: 0,
                    clean_sheets_against: 0
                });
            }
            const seasonStats = seasonNameToStats.get(season);
            seasonStats.matches += 1;
            seasonStats.goals_for += gf;
            seasonStats.goals_against += ga;
            seasonStats.clean_sheets_for += cleanSheetFor;
            seasonStats.clean_sheets_against += cleanSheetAgainst;
            if (result === 'W') {
                seasonStats.wins += 1;
            } else if (result.includes('D')) {
                seasonStats.draws += 1;
            } else if (result === 'L') {
                seasonStats.losses += 1;
            }
        });
        
        // Convert championships map to the array structure expected by renderer
        const championships = Array.from(championshipNameToStats.values());
        
        // Convert seasons map to array and sort alphabetically and numerically
        const seasons = Array.from(seasonNameToStats.values()).sort((a, b) => {
            // Extract year numbers for sorting (e.g., "الدوري المصري 2025-26" -> [2025, 26])
            const getYears = (seasonName) => {
                const years = seasonName.match(/\d+/g);
                if (years && years.length >= 2) {
                    return [parseInt(years[0]), parseInt(years[1])];
                } else if (years && years.length === 1) {
                    return [parseInt(years[0]), 0];
                }
                return [0, 0];
            };
            
            const yearsA = getYears(a.season);
            const yearsB = getYears(b.season);
            
            // Sort by first year (descending), then by second year (descending)
            if (yearsA[0] !== yearsB[0]) {
                return yearsB[0] - yearsA[0];
            }
            return yearsB[1] - yearsA[1];
        });
        
        return { overview, championships, seasons };
    } catch (error) {
        console.error('Error calculating H2H stats from filtered data:', error);
        return null;
    }
}
// Calculate streak statistics for H2H T Details
function calculateH2HStreaks(teamName, records) {
    try {
        console.log(`Calculating streaks for ${teamName} from ${records.length} records`);
        
        // Filter records for the specific team and sort by date
        const teamMatches = records.filter(record => {
            const opponentTeam = (record['OPPONENT TEAM'] || '').toString().trim();
            return opponentTeam === teamName;
        }).sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
        
        if (teamMatches.length === 0) {
            return {
                ahlyWinningStreak: 0,
                opponentWinningStreak: 0,
                ahlyLosingStreak: 0,
                opponentLosingStreak: 0,
                ahlyDrawStreak: 0,
                opponentDrawStreak: 0,
                ahlyWinlessStreak: 0,
                opponentWinlessStreak: 0,
                ahlyUnbeatenStreak: 0,
                opponentUnbeatenStreak: 0
            };
        }
        
        // Calculate streaks
        const streaks = {
            ahlyWinningStreak: 0,
            opponentWinningStreak: 0,
            ahlyLosingStreak: 0,
            opponentLosingStreak: 0,
            ahlyDrawStreak: 0,
            opponentDrawStreak: 0,
            ahlyWinlessStreak: 0,
            opponentWinlessStreak: 0,
            ahlyUnbeatenStreak: 0,
            opponentUnbeatenStreak: 0
        };
        
        // Current streak counters
        let currentAhlyWin = 0, maxAhlyWin = 0;
        let currentOpponentWin = 0, maxOpponentWin = 0;
        let currentAhlyLoss = 0, maxAhlyLoss = 0;
        let currentOpponentLoss = 0, maxOpponentLoss = 0;
        let currentAhlyDraw = 0, maxAhlyDraw = 0;
        let currentOpponentDraw = 0, maxOpponentDraw = 0;
        let currentAhlyWinless = 0, maxAhlyWinless = 0;
        let currentOpponentWinless = 0, maxOpponentWinless = 0;
        let currentAhlyUnbeaten = 0, maxAhlyUnbeaten = 0;
        let currentOpponentUnbeaten = 0, maxOpponentUnbeaten = 0;
        
        teamMatches.forEach(match => {
            const result = (match['W-D-L'] || '').toString().trim();
            const gf = parseInt(match['GF'] || 0) || 0;
            const ga = parseInt(match['GA'] || 0) || 0;
            
            // Determine match result for Al Ahly
            let ahlyResult = '';
            let opponentResult = '';
            
            if (result === 'W') {
                ahlyResult = 'W';
                opponentResult = 'L';
            } else if (result === 'L') {
                ahlyResult = 'L';
                opponentResult = 'W';
            } else if (result === 'D') {
                ahlyResult = 'D';
                opponentResult = 'D';
            }
            
            // Al Ahly streaks
            if (ahlyResult === 'W') {
                currentAhlyWin++;
                currentAhlyLoss = 0;
                currentAhlyDraw = 0;
                currentAhlyWinless = 0;
                currentAhlyUnbeaten++;
                maxAhlyWin = Math.max(maxAhlyWin, currentAhlyWin);
                maxAhlyUnbeaten = Math.max(maxAhlyUnbeaten, currentAhlyUnbeaten);
            } else if (ahlyResult === 'L') {
                currentAhlyWin = 0;
                currentAhlyLoss++;
                currentAhlyDraw = 0;
                currentAhlyWinless++;
                currentAhlyUnbeaten = 0;
                maxAhlyLoss = Math.max(maxAhlyLoss, currentAhlyLoss);
                maxAhlyWinless = Math.max(maxAhlyWinless, currentAhlyWinless);
            } else if (ahlyResult === 'D') {
                currentAhlyWin = 0;
                currentAhlyLoss = 0;
                currentAhlyDraw++;
                currentAhlyWinless++;
                currentAhlyUnbeaten++;
                maxAhlyDraw = Math.max(maxAhlyDraw, currentAhlyDraw);
                maxAhlyWinless = Math.max(maxAhlyWinless, currentAhlyWinless);
                maxAhlyUnbeaten = Math.max(maxAhlyUnbeaten, currentAhlyUnbeaten);
            }
            
            // Opponent streaks
            if (opponentResult === 'W') {
                currentOpponentWin++;
                currentOpponentLoss = 0;
                currentOpponentDraw = 0;
                currentOpponentWinless = 0;
                currentOpponentUnbeaten++;
                maxOpponentWin = Math.max(maxOpponentWin, currentOpponentWin);
                maxOpponentUnbeaten = Math.max(maxOpponentUnbeaten, currentOpponentUnbeaten);
            } else if (opponentResult === 'L') {
                currentOpponentWin = 0;
                currentOpponentLoss++;
                currentOpponentDraw = 0;
                currentOpponentWinless++;
                currentOpponentUnbeaten = 0;
                maxOpponentLoss = Math.max(maxOpponentLoss, currentOpponentLoss);
                maxOpponentWinless = Math.max(maxOpponentWinless, currentOpponentWinless);
            } else if (opponentResult === 'D') {
                currentOpponentWin = 0;
                currentOpponentLoss = 0;
                currentOpponentDraw++;
                currentOpponentWinless++;
                currentOpponentUnbeaten++;
                maxOpponentDraw = Math.max(maxOpponentDraw, currentOpponentDraw);
                maxOpponentWinless = Math.max(maxOpponentWinless, currentOpponentWinless);
                maxOpponentUnbeaten = Math.max(maxOpponentUnbeaten, currentOpponentUnbeaten);
            }
        });
        
        return {
            ahlyWinningStreak: maxAhlyWin,
            opponentWinningStreak: maxOpponentWin,
            ahlyLosingStreak: maxAhlyLoss,
            opponentLosingStreak: maxOpponentLoss,
            ahlyDrawStreak: maxAhlyDraw,
            opponentDrawStreak: maxOpponentDraw,
            ahlyWinlessStreak: maxAhlyWinless,
            opponentWinlessStreak: maxOpponentWinless,
            ahlyUnbeatenStreak: maxAhlyUnbeaten,
            opponentUnbeatenStreak: maxOpponentUnbeaten
        };
        
    } catch (error) {
        console.error('Error calculating H2H streaks:', error);
        return {
            ahlyWinningStreak: 0,
            opponentWinningStreak: 0,
            ahlyLosingStreak: 0,
            opponentLosingStreak: 0,
            ahlyDrawStreak: 0,
            opponentDrawStreak: 0,
            ahlyWinlessStreak: 0,
            opponentWinlessStreak: 0,
            ahlyUnbeatenStreak: 0,
            opponentUnbeatenStreak: 0
        };
    }
}

// Render H2H T Details Overview (similar to HOW WIN design)
function renderH2HTDetailsOverview(overview, teamName) {
    const content = document.getElementById('h2h-t-overview-content');
    if (!content) return;
    
    const winRate = overview.total_matches > 0 ? ((overview.wins / overview.total_matches) * 100).toFixed(1) : 0;
    const drawRate = overview.total_matches > 0 ? ((overview.draws / overview.total_matches) * 100).toFixed(1) : 0;
    const lossRate = overview.total_matches > 0 ? ((overview.losses / overview.total_matches) * 100).toFixed(1) : 0;
    
    // Calculate streaks
    const currentFilteredRecords = getCurrentFilteredRecords();
    const recordsToUse = currentFilteredRecords || (alAhlyStatsData ? alAhlyStatsData.allRecords : []);
    const streaks = calculateH2HStreaks(teamName, recordsToUse);
    
    content.innerHTML = `
        <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">H2H T Details vs ${teamName} - Overview</h3>
        
        <!-- Basic Stats -->
        <div class="stats-overview">
            <div class="stat-card">
                <h3>Matches</h3>
                <p class="stat-value" style="color: #6c757d;">${overview.total_matches}</p>
                <p class="stat-label">Total Matches</p>
            </div>
            <div class="stat-card">
                <h3>Wins</h3>
                <p class="stat-value" style="color: #28a745;">${overview.wins}</p>
                <p class="stat-label">${winRate}%</p>
            </div>
            <div class="stat-card">
                <h3>Draws</h3>
                <p class="stat-value" style="color: #ffc107;">${overview.draws}</p>
                <p class="stat-label">${drawRate}%</p>
            </div>
            <div class="stat-card">
                <h3>Losses</h3>
                <p class="stat-value" style="color: #dc3545;">${overview.losses}</p>
                <p class="stat-label">${lossRate}%</p>
            </div>
            <div class="stat-card">
                <h3>Goals For</h3>
                <p class="stat-value" style="color: #007bff;">${overview.goals_for}</p>
                <p class="stat-label">Al Ahly Goals</p>
            </div>
            <div class="stat-card">
                <h3>Goals Against</h3>
                <p class="stat-value" style="color: #6c757d;">${overview.goals_against}</p>
                <p class="stat-label">${teamName} Goals</p>
            </div>
            <div class="stat-card">
                <h3>Clean Sheets For</h3>
                <p class="stat-value" style="color: #17a2b8;">${overview.clean_sheets_for}</p>
                <p class="stat-label">Al Ahly Clean Sheets</p>
            </div>
            <div class="stat-card">
                <h3>Clean Sheets Against</h3>
                <p class="stat-value" style="color: #fd7e14;">${overview.clean_sheets_against}</p>
                <p class="stat-label">${teamName} Clean Sheets</p>
            </div>
        </div>
        
        <!-- Streak Stats -->
        <h4 class="section-title" style="font-size: 1.2rem; margin-top: 2rem; margin-bottom: 1rem; color: #495057;">Streak Statistics</h4>
        <div class="stats-overview">
            <!-- Winning Streak -->
            <div class="stat-card streak-card">
                <h3 style="color: #28a745;">🏆 Winning Streak</h3>
                <div class="streak-comparison">
                    <div class="streak-item">
                        <div class="team-label">Al Ahly</div>
                        <p class="stat-value" style="color: #28a745; font-size: 1.8rem; font-weight: bold;">${streaks.ahlyWinningStreak}</p>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="streak-item">
                        <div class="team-label">${teamName}</div>
                        <p class="stat-value" style="color: #28a745; font-size: 1.8rem; font-weight: bold;">${streaks.opponentWinningStreak}</p>
                    </div>
                </div>
            </div>
            
            <!-- Losing Streak -->
            <div class="stat-card streak-card">
                <h3 style="color: #dc3545;">💔 Losing Streak</h3>
                <div class="streak-comparison">
                    <div class="streak-item">
                        <div class="team-label">Al Ahly</div>
                        <p class="stat-value" style="color: #dc3545; font-size: 1.8rem; font-weight: bold;">${streaks.ahlyLosingStreak}</p>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="streak-item">
                        <div class="team-label">${teamName}</div>
                        <p class="stat-value" style="color: #dc3545; font-size: 1.8rem; font-weight: bold;">${streaks.opponentLosingStreak}</p>
                    </div>
                </div>
            </div>
            
            <!-- Draw Streak -->
            <div class="stat-card streak-card">
                <h3 style="color: #ffc107;">🤝 Draw Streak</h3>
                <div class="streak-comparison">
                    <div class="streak-item">
                        <div class="team-label">Al Ahly</div>
                        <p class="stat-value" style="color: #ffc107; font-size: 1.8rem; font-weight: bold;">${streaks.ahlyDrawStreak}</p>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="streak-item">
                        <div class="team-label">${teamName}</div>
                        <p class="stat-value" style="color: #ffc107; font-size: 1.8rem; font-weight: bold;">${streaks.opponentDrawStreak}</p>
                    </div>
                </div>
            </div>
            
            <!-- Winless Streak -->
            <div class="stat-card streak-card">
                <h3 style="color: #6f42c1;">😔 Winless Streak</h3>
                <div class="streak-comparison">
                    <div class="streak-item">
                        <div class="team-label">Al Ahly</div>
                        <p class="stat-value" style="color: #6f42c1; font-size: 1.8rem; font-weight: bold;">${streaks.ahlyWinlessStreak}</p>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="streak-item">
                        <div class="team-label">${teamName}</div>
                        <p class="stat-value" style="color: #6f42c1; font-size: 1.8rem; font-weight: bold;">${streaks.opponentWinlessStreak}</p>
                    </div>
                </div>
            </div>
            
            <!-- Unbeaten Streak -->
            <div class="stat-card streak-card">
                <h3 style="color: #20c997;">🛡️ Unbeaten Streak</h3>
                <div class="streak-comparison">
                    <div class="streak-item">
                        <div class="team-label">Al Ahly</div>
                        <p class="stat-value" style="color: #20c997; font-size: 1.8rem; font-weight: bold;">${streaks.ahlyUnbeatenStreak}</p>
                    </div>
                    <div class="vs-divider">VS</div>
                    <div class="streak-item">
                        <div class="team-label">${teamName}</div>
                        <p class="stat-value" style="color: #20c997; font-size: 1.8rem; font-weight: bold;">${streaks.opponentUnbeatenStreak}</p>
                    </div>
                </div>
            </div>
        </div>
        
        <style>
            .streak-card {
                min-height: 120px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            
            .streak-comparison {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-top: 1rem;
            }
            
            .streak-item {
                text-align: center;
                flex: 1;
            }
            
            .team-label {
                font-size: 0.8rem;
                color: #6c757d;
                margin-bottom: 0.5rem;
                font-weight: 600;
            }
            
            .vs-divider {
                font-size: 0.9rem;
                color: #6c757d;
                font-weight: bold;
                margin: 0 1rem;
            }
        </style>
    `;
}

// Render H2H T Details Championships table
function renderH2HTDetailsChampionships(championships, teamName) {
    const content = document.getElementById('h2h-t-championships-content');
    if (!content) return;
    
    if (championships.length === 0) {
        content.innerHTML = `
            <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Championships Statistics vs ${teamName}</h3>
            <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                No championship data available for this team.
            </p>
        `;
        return;
    }
    
    let tableHTML = `
        <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Championships Statistics vs ${teamName}</h3>
        <div class="stats-table-container">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Championship</th>
                        <th>Matches</th>
                        <th>Wins</th>
                        <th>Draws</th>
                        <th>Losses</th>
                        <th>Goals For</th>
                        <th>Goals Against</th>
                        <th>Clean Sheets For</th>
                        <th>Clean Sheets Against</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Sort championships by matches (descending)
    championships.sort((a, b) => b.matches - a.matches);
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        clean_sheets_for: 0,
        clean_sheets_against: 0
    };
    
    championships.forEach(champ => {
        totals.matches += champ.matches;
        totals.wins += champ.wins;
        totals.draws += champ.draws;
        totals.losses += champ.losses;
        totals.goals_for += champ.goals_for;
        totals.goals_against += champ.goals_against;
        totals.clean_sheets_for += champ.clean_sheets_for;
        totals.clean_sheets_against += champ.clean_sheets_against;
    });
    
    championships.forEach(champ => {
        const winRate = champ.matches > 0 ? ((champ.wins / champ.matches) * 100).toFixed(1) : 0;
        tableHTML += `
            <tr>
                <td>${champ.championship}</td>
                <td>${champ.matches}</td>
                <td style="color: #28a745; font-weight: 600;">${champ.wins}</td>
                <td style="color: #ffc107; font-weight: 600;">${champ.draws}</td>
                <td style="color: #dc3545; font-weight: 600;">${champ.losses}</td>
                <td style="color: #007bff; font-weight: 600;">${champ.goals_for}</td>
                <td style="color: #6c757d; font-weight: 600;">${champ.goals_against}</td>
                <td style="color: #17a2b8; font-weight: 600;">${champ.clean_sheets_for}</td>
                <td style="color: #fd7e14; font-weight: 600;">${champ.clean_sheets_against}</td>
            </tr>
        `;
    });
    
    // Add totals row
    const totalWinRate = totals.matches > 0 ? ((totals.wins / totals.matches) * 100).toFixed(1) : 0;
    tableHTML += `
        <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #dee2e6;">
            <td><strong>Total</strong></td>
            <td><strong>${totals.matches}</strong></td>
            <td style="color: #28a745; font-weight: 700;"><strong>${totals.wins}</strong></td>
            <td style="color: #ffc107; font-weight: 700;"><strong>${totals.draws}</strong></td>
            <td style="color: #dc3545; font-weight: 700;"><strong>${totals.losses}</strong></td>
            <td style="color: #007bff; font-weight: 700;"><strong>${totals.goals_for}</strong></td>
            <td style="color: #6c757d; font-weight: 700;"><strong>${totals.goals_against}</strong></td>
            <td style="color: #17a2b8; font-weight: 700;"><strong>${totals.clean_sheets_for}</strong></td>
            <td style="color: #fd7e14; font-weight: 700;"><strong>${totals.clean_sheets_against}</strong></td>
        </tr>
    `;
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = tableHTML;
}

// Render H2H T Details Seasons table
function renderH2HTDetailsSeasons(seasons, teamName) {
    const content = document.getElementById('h2h-t-seasons-content');
    if (!content) return;
    
    if (seasons.length === 0) {
        content.innerHTML = `
            <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Seasons Statistics vs ${teamName}</h3>
            <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                No season data available for this team.
            </p>
        `;
        return;
    }
    
    let tableHTML = `
        <h3 class="section-title" style="font-size: 1.4rem; margin-top: 1.5rem;">Seasons Statistics vs ${teamName}</h3>
        <div class="stats-table-container">
            <table class="stats-table">
                <thead>
                    <tr>
                        <th>Season</th>
                        <th>Matches</th>
                        <th>Wins</th>
                        <th>Draws</th>
                        <th>Losses</th>
                        <th>Goals For</th>
                        <th>Goals Against</th>
                        <th>Clean Sheets For</th>
                        <th>Clean Sheets Against</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
        clean_sheets_for: 0,
        clean_sheets_against: 0
    };
    
    seasons.forEach(season => {
        totals.matches += season.matches;
        totals.wins += season.wins;
        totals.draws += season.draws;
        totals.losses += season.losses;
        totals.goals_for += season.goals_for;
        totals.goals_against += season.goals_against;
        totals.clean_sheets_for += season.clean_sheets_for;
        totals.clean_sheets_against += season.clean_sheets_against;
    });
    
    seasons.forEach(season => {
        const winRate = season.matches > 0 ? ((season.wins / season.matches) * 100).toFixed(1) : 0;
        tableHTML += `
            <tr>
                <td>${season.season}</td>
                <td>${season.matches}</td>
                <td style="color: #28a745; font-weight: 600;">${season.wins}</td>
                <td style="color: #ffc107; font-weight: 600;">${season.draws}</td>
                <td style="color: #dc3545; font-weight: 600;">${season.losses}</td>
                <td style="color: #007bff; font-weight: 600;">${season.goals_for}</td>
                <td style="color: #6c757d; font-weight: 600;">${season.goals_against}</td>
                <td style="color: #17a2b8; font-weight: 600;">${season.clean_sheets_for}</td>
                <td style="color: #fd7e14; font-weight: 600;">${season.clean_sheets_against}</td>
            </tr>
        `;
    });
    
    // Add totals row
    const totalWinRate = totals.matches > 0 ? ((totals.wins / totals.matches) * 100).toFixed(1) : 0;
    tableHTML += `
        <tr style="background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #dee2e6;">
            <td><strong>Total</strong></td>
            <td><strong>${totals.matches}</strong></td>
            <td style="color: #28a745; font-weight: 700;"><strong>${totals.wins}</strong></td>
            <td style="color: #ffc107; font-weight: 700;"><strong>${totals.draws}</strong></td>
            <td style="color: #dc3545; font-weight: 700;"><strong>${totals.losses}</strong></td>
            <td style="color: #007bff; font-weight: 700;"><strong>${totals.goals_for}</strong></td>
            <td style="color: #6c757d; font-weight: 700;"><strong>${totals.goals_against}</strong></td>
            <td style="color: #17a2b8; font-weight: 700;"><strong>${totals.clean_sheets_for}</strong></td>
            <td style="color: #fd7e14; font-weight: 700;"><strong>${totals.clean_sheets_against}</strong></td>
        </tr>
    `;
    
    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    
    content.innerHTML = tableHTML;
}

// Clear H2H T Details content
function clearH2HTDetailsContent() {
    const overviewContent = document.getElementById('h2h-t-overview-content');
    const championshipsContent = document.getElementById('h2h-t-championships-content');
    const seasonsContent = document.getElementById('h2h-t-seasons-content');
    
    if (overviewContent) {
        overviewContent.innerHTML = `
            <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                Please select a team to view H2H T Details
            </p>
        `;
    }
    
    if (championshipsContent) {
        championshipsContent.innerHTML = `
            <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                Please select a team to view championship statistics
            </p>
        `;
    }
    
    if (seasonsContent) {
        seasonsContent.innerHTML = `
            <p style="text-align: center; color: #6c757d; font-size: 1rem; margin: 2rem 0;">
                Please select a team to view season statistics
            </p>
        `;
    }
}

// Switch H2H T Details sub-tabs
function showH2HTDetailsSubTab(event, subTabName) {
    // Remove active class from all sub-tabs
    document.querySelectorAll('#h2h-t-details-tab .stats-subtab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all sub-tab contents
    document.querySelectorAll('#h2h-t-details-tab .stats-subtab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to clicked tab
    event.target.classList.add('active');
    
    // Show selected sub-tab content
    const targetContent = document.getElementById(subTabName);
    if (targetContent) {
        targetContent.classList.add('active');
    }
}

// ============================================================================
// COACHES FUNCTIONS
// ============================================================================

// Load and display Coaches data
function loadCoachesData(filteredRecords = null) {
    console.log('Loading Coaches data...');
    
    // Use filtered records if provided, otherwise use all records
    const records = filteredRecords || alAhlyStatsData.allRecords || [];
    if (records.length === 0) {
        console.log('No records available for Coaches');
        renderCoachesTable([]);
        return;
    }
    
    console.log(`Processing ${records.length} records for Coaches`);
    
    // Get team filter value
    const teamFilter = document.getElementById('coaches-team-filter')?.value || '';
    
    // Calculate stats for each coach
    const coachesStats = {};
    
    records.forEach(match => {
        const ahlyManager = match['AHLY MANAGER'] || '';
        const opponentManager = match['OPPONENT MANAGER'] || '';
        const result = match['W-D-L'] || '';
        const goalsFor = parseInt(match['GF'] || 0);
        const goalsAgainst = parseInt(match['GA'] || 0);
        const cleanSheet = match['CLEAN SHEET'] || '';
        
        // Process Ahly Manager (if not filtered out)
        // Skip empty, -, ?, and Unknown names
        if (teamFilter !== 'AGAINST_AHLY' && ahlyManager && ahlyManager.trim() !== '' && ahlyManager !== '-' && ahlyManager !== '?' && ahlyManager !== 'Unknown') {
            if (!coachesStats[ahlyManager]) {
                coachesStats[ahlyManager] = {
                    name: ahlyManager,
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
            
            coachesStats[ahlyManager].matches++;
            coachesStats[ahlyManager].goalsFor += goalsFor;
            coachesStats[ahlyManager].goalsAgainst += goalsAgainst;
            
            // Count results
            if (result === 'W') {
                coachesStats[ahlyManager].wins++;
            } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
                coachesStats[ahlyManager].draws++;
            } else if (result === 'L') {
                coachesStats[ahlyManager].losses++;
            }
            
            // Clean sheets
            if (cleanSheet === 'Yes' || cleanSheet === 'YES' || goalsAgainst === 0) {
                coachesStats[ahlyManager].cleanSheetsFor++;
            }
            if (goalsFor === 0) {
                coachesStats[ahlyManager].cleanSheetsAgainst++;
            }
        }
        
        // Process Opponent Manager (if not filtered out)
        // Skip empty, -, ?, and Unknown names
        if (teamFilter !== 'WITH_AHLY' && opponentManager && opponentManager.trim() !== '' && opponentManager !== '-' && opponentManager !== '?' && opponentManager !== 'Unknown') {
            if (!coachesStats[opponentManager]) {
                coachesStats[opponentManager] = {
                    name: opponentManager,
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
            
            coachesStats[opponentManager].matches++;
            // For opponent: goals are reversed
            coachesStats[opponentManager].goalsFor += goalsAgainst;
            coachesStats[opponentManager].goalsAgainst += goalsFor;
            
            // Count results (reversed for opponent)
            if (result === 'L') {
                coachesStats[opponentManager].wins++;
            } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
                coachesStats[opponentManager].draws++;
            } else if (result === 'W') {
                coachesStats[opponentManager].losses++;
            }
            
            // Clean sheets (reversed for opponent)
            if (goalsFor === 0) {
                coachesStats[opponentManager].cleanSheetsFor++;
            }
            if (cleanSheet === 'Yes' || cleanSheet === 'YES' || goalsAgainst === 0) {
                coachesStats[opponentManager].cleanSheetsAgainst++;
            }
        }
    });
    
    // Convert to array and sort by matches descending
    const coachesArray = Object.values(coachesStats).sort((a, b) => b.matches - a.matches);
    
    // Render table
    renderCoachesTable(coachesArray);
    
    // Setup search functionality
    setupCoachesSearch(coachesArray);
    
    console.log(`Loaded ${coachesArray.length} coaches`);
}

// Render Coaches table
function renderCoachesTable(coachesData) {
    const tbody = document.querySelector('#coaches-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (coachesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        cleanSheetsFor: 0,
        cleanSheetsAgainst: 0
    };
    
    coachesData.forEach(coach => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align: center; font-weight: 500;">${coach.name}</td>
            <td>${coach.matches}</td>
            <td style="color: #10b981; font-weight: 600;">${coach.wins}</td>
            <td style="color: #f59e0b; font-weight: 600;">${coach.draws}</td>
            <td style="color: #ef4444; font-weight: 600;">${coach.losses}</td>
            <td>${coach.goalsFor}</td>
            <td>${coach.goalsAgainst}</td>
            <td>${coach.cleanSheetsFor}</td>
            <td>${coach.cleanSheetsAgainst}</td>
        `;
        tbody.appendChild(row);
        
        // Add to totals
        totals.matches += coach.matches;
        totals.wins += coach.wins;
        totals.draws += coach.draws;
        totals.losses += coach.losses;
        totals.goalsFor += coach.goalsFor;
        totals.goalsAgainst += coach.goalsAgainst;
        totals.cleanSheetsFor += coach.cleanSheetsFor;
        totals.cleanSheetsAgainst += coach.cleanSheetsAgainst;
    });
    
    // Add totals row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    totalRow.innerHTML = `
        <td style="text-align: center;">TOTAL</td>
        <td>${totals.matches}</td>
        <td style="color: #10b981;">${totals.wins}</td>
        <td style="color: #f59e0b;">${totals.draws}</td>
        <td style="color: #ef4444;">${totals.losses}</td>
        <td>${totals.goalsFor}</td>
        <td>${totals.goalsAgainst}</td>
        <td>${totals.cleanSheetsFor}</td>
        <td>${totals.cleanSheetsAgainst}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Coaches table rendered with ${coachesData.length} coaches`);
}
// Setup Coaches team filter
function setupCoachesFilter() {
    const teamFilter = document.getElementById('coaches-team-filter');
    if (!teamFilter) return;
    
    teamFilter.addEventListener('change', function() {
        console.log('Coaches team filter changed:', this.value);
        // Use current filtered records if filters are applied
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadCoachesData(currentFilteredRecords);
    });
}

// Setup Coaches search functionality
function setupCoachesSearch(coachesData) {
    const searchInput = document.getElementById('coaches-search');
    if (!searchInput) return;
    
    // Store coaches data for search
    searchInput._coachesData = coachesData;
    
    // Remove existing listener if any
    const newSearchInput = searchInput.cloneNode(true);
    newSearchInput._coachesData = coachesData;
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Add input event listener for real-time search
    newSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const currentCoachesData = this._coachesData || coachesData;
        
        if (searchTerm === '') {
            // Show all coaches (filtered by main filters)
            renderCoachesTable(currentCoachesData);
        } else {
            // Filter coaches by search term
            const filteredCoaches = currentCoachesData.filter(coach => 
                coach.name.toLowerCase().includes(searchTerm)
            );
            renderCoachesTable(filteredCoaches);
        }
    });
    
    console.log('Coaches search functionality initialized');
}

// ============================================================================
// REFEREES FUNCTIONS
// ============================================================================

// Global variable to store referees data
let refereesData = {
    referees: [],
    selectedReferee: null
};

// Global variable to store all referees statistics
let allRefereesData = {
    referees: []
};

// Helper function to count penalties for/against Ahly in a specific match
function countMatchPenalties(matchId, forAhly = true) {
    if (!matchId) return 0;
    
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    if (!playerDetails || playerDetails.length === 0) return 0;
    
    let count = 0;
    
    playerDetails.forEach(record => {
        if (record.MATCH_ID !== matchId) return;
        
        const playerTeam = (record.TEAM || '').trim().toLowerCase();
        const isAhlyPlayer = playerTeam.includes('أهلي') || playerTeam.includes('ahly') || playerTeam.includes('الأهلي');
        
        // Check if we should count this penalty based on forAhly flag
        if (forAhly && !isAhlyPlayer) return;
        if (!forAhly && isAhlyPlayer) return;
        
        // Normalize TYPE and GA fields
        const typeVal = (record.TYPE || '').replace(/[^A-Z]/gi, '').toUpperCase();
        const gaVal = (record.GA || record['G+A'] || '').replace(/[^A-Z]/gi, '').toUpperCase();
        
        // Count PENGOAL (scored) and PENMISSED (missed) in either TYPE or GA
        if (typeVal === 'PENGOAL' || gaVal === 'PENGOAL') {
            count++;
        }
        if (typeVal === 'PENMISSED' || gaVal === 'PENMISSED') {
            count++;
        }
    });
    
    return count;
}

// Load referees list from match data
function loadRefereesData() {
    console.log('Loading referees list...');
    
    const records = alAhlyStatsData.allRecords || [];
    if (records.length === 0) {
        console.log('No records available for referees');
        return;
    }
    
    // Get unique referees
    const refereesSet = new Set();
    records.forEach(match => {
        const referee = match['REFREE'] || match['REFEREE'] || '';
        if (referee && referee.trim() !== '' && referee !== '-' && referee !== '?' && referee !== 'Unknown') {
            refereesSet.add(referee.trim());
        }
    });
    
    // Convert to array and sort
    refereesData.referees = Array.from(refereesSet).sort();
    
    console.log(`Loaded ${refereesData.referees.length} referees`);
    
    // Populate search dropdown
    populateRefereeSearch();
}

// Populate referee search dropdown
function populateRefereeSearch() {
    const searchInput = document.getElementById('referee-search');
    const optionsDiv = document.getElementById('referee-search-options');
    
    if (!searchInput || !optionsDiv) return;
    
    // Setup search functionality
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        if (searchTerm === '') {
            optionsDiv.style.display = 'none';
            return;
        }
        
        // Filter referees
        const filteredReferees = refereesData.referees.filter(ref => 
            ref.toLowerCase().includes(searchTerm)
        );
        
        // Display options
        if (filteredReferees.length > 0) {
            optionsDiv.innerHTML = filteredReferees
                .map(ref => `<div class="option-item" data-value="${ref}">${ref}</div>`)
                .join('');
            optionsDiv.style.display = 'block';
            
            // Add click handlers
            optionsDiv.querySelectorAll('.option-item').forEach(item => {
                item.addEventListener('click', function() {
                    const selectedRef = this.getAttribute('data-value');
                    searchInput.value = selectedRef;
                    optionsDiv.style.display = 'none';
                    
                    // Load referee data
                    refereesData.selectedReferee = selectedRef;
                    loadRefereeStats(selectedRef);
                });
            });
        } else {
            optionsDiv.innerHTML = '<div class="option-item no-results">No referees found</div>';
            optionsDiv.style.display = 'block';
        }
    });
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !optionsDiv.contains(e.target)) {
            optionsDiv.style.display = 'none';
        }
    });
}

// Show Referee Main Sub-tab (All Referees or By Referee)
function showRefereeMainSubTab(event, tabName) {
    // Remove active class from all main sub-tabs
    const mainSubTabs = event.target.closest('.stats-sub-tabs').querySelectorAll('.stats-sub-tab');
    mainSubTabs.forEach(tab => tab.classList.remove('active'));
    
    // Add active class to clicked tab
    event.target.closest('.stats-sub-tab').classList.add('active');
    
    // Hide all main sub-content
    const allMainContent = document.querySelectorAll('.referee-main-sub-content');
    allMainContent.forEach(content => content.classList.remove('active'));
    
    // Show selected main sub-content
    const selectedContent = document.getElementById(tabName + '-sub');
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Load data if switching to All Referees
    if (tabName === 'all-referees') {
        const currentFilteredRecords = getCurrentFilteredRecords();
        loadAllRefereesData(currentFilteredRecords);
    }
}
// Load and display All Referees data
function loadAllRefereesData(filteredRecords = null) {
    console.log('Loading All Referees data...');
    
    // Use filtered records if provided, otherwise use all records
    const records = filteredRecords || alAhlyStatsData.allRecords || [];
    if (records.length === 0) {
        console.log('No records available for All Referees');
        renderAllRefereesTable([]);
        return;
    }
    
    console.log(`Processing ${records.length} records for All Referees`);
    
    // Calculate stats for each referee
    const refereesStats = {};
    
    records.forEach(match => {
        const referee = match['REFREE'] || match['REFEREE'] || '';
        
        // Skip empty, -, ?, and Unknown names
        if (!referee || referee.trim() === '' || referee === '-' || referee === '?' || referee === 'Unknown') {
            return;
        }
        
        if (!refereesStats[referee]) {
            refereesStats[referee] = {
                name: referee,
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                penaltiesFor: 0,
                penaltiesAgainst: 0
            };
        }
        
        const result = match['W-D-L'] || '';
        const goalsFor = parseInt(match['GF'] || 0);
        const goalsAgainst = parseInt(match['GA'] || 0);
        
        refereesStats[referee].matches++;
        refereesStats[referee].goalsFor += goalsFor;
        refereesStats[referee].goalsAgainst += goalsAgainst;
        
        // Count results
        if (result === 'W') {
            refereesStats[referee].wins++;
        } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
            refereesStats[referee].draws++;
        } else if (result === 'L') {
            refereesStats[referee].losses++;
        }
        
        // Count penalties for/against
        const matchId = match['MATCH_ID'] || match['MATCH ID'] || '';
        if (matchId) {
            refereesStats[referee].penaltiesFor += countMatchPenalties(matchId, true);
            refereesStats[referee].penaltiesAgainst += countMatchPenalties(matchId, false);
        }
    });
    
    // Convert to array and sort by matches descending
    const refereesArray = Object.values(refereesStats).sort((a, b) => b.matches - a.matches);
    
    // Store and render
    allRefereesData.referees = refereesArray;
    renderAllRefereesTable(refereesArray);
    
    // Setup search functionality
    setupAllRefereesSearch(refereesArray);
    
    console.log(`Loaded ${refereesArray.length} referees`);
}

// Render All Referees table
function renderAllRefereesTable(refereesData) {
    const tbody = document.querySelector('#all-referees-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (refereesData.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="9" style="text-align: center; padding: 2rem; color: #666;">No referees found</td>';
        tbody.appendChild(row);
        return;
    }
    
    refereesData.forEach(referee => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${referee.name}</td>
            <td>${referee.matches}</td>
            <td style="color: #10b981; font-weight: 600;">${referee.wins}</td>
            <td style="color: #f59e0b; font-weight: 600;">${referee.draws}</td>
            <td style="color: #ef4444; font-weight: 600;">${referee.losses}</td>
            <td>${referee.goalsFor}</td>
            <td>${referee.goalsAgainst}</td>
            <td>${referee.penaltiesFor}</td>
            <td>${referee.penaltiesAgainst}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Add total row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    
    const totals = {
        matches: refereesData.reduce((sum, ref) => sum + ref.matches, 0),
        wins: refereesData.reduce((sum, ref) => sum + ref.wins, 0),
        draws: refereesData.reduce((sum, ref) => sum + ref.draws, 0),
        losses: refereesData.reduce((sum, ref) => sum + ref.losses, 0),
        goalsFor: refereesData.reduce((sum, ref) => sum + ref.goalsFor, 0),
        goalsAgainst: refereesData.reduce((sum, ref) => sum + ref.goalsAgainst, 0),
        penaltiesFor: refereesData.reduce((sum, ref) => sum + ref.penaltiesFor, 0),
        penaltiesAgainst: refereesData.reduce((sum, ref) => sum + ref.penaltiesAgainst, 0)
    };
    
    totalRow.innerHTML = `
        <td>TOTAL</td>
        <td>${totals.matches}</td>
        <td style="color: #10b981;">${totals.wins}</td>
        <td style="color: #f59e0b;">${totals.draws}</td>
        <td style="color: #ef4444;">${totals.losses}</td>
        <td>${totals.goalsFor}</td>
        <td>${totals.goalsAgainst}</td>
        <td>${totals.penaltiesFor}</td>
        <td>${totals.penaltiesAgainst}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`All Referees table rendered with ${refereesData.length} referees`);
}

// Setup All Referees search functionality
function setupAllRefereesSearch(refereesData) {
    const searchInput = document.getElementById('all-referees-search');
    if (!searchInput) return;
    
    // Store referees data for search
    searchInput._refereesData = refereesData;
    
    // Remove existing listener if any
    const newSearchInput = searchInput.cloneNode(true);
    newSearchInput._refereesData = refereesData;
    searchInput.parentNode.replaceChild(newSearchInput, searchInput);
    
    // Add input event listener for real-time search
    newSearchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const currentRefereesData = this._refereesData || refereesData;
        
        if (searchTerm === '') {
            // Show all referees (filtered by main filters)
            renderAllRefereesTable(currentRefereesData);
        } else {
            // Filter referees by search term
            const filteredReferees = currentRefereesData.filter(referee => 
                referee.name.toLowerCase().includes(searchTerm)
            );
            renderAllRefereesTable(filteredReferees);
        }
    });
    
    console.log('All Referees search functionality initialized');
}

// Load all stats for a selected referee
function loadRefereeStats(refereeName) {
    console.log('Loading stats for referee:', refereeName);
    
    const records = alAhlyStatsData.allRecords || [];
    
    // Filter matches by referee
    const refereeMatches = records.filter(match => {
        const referee = match['REFREE'] || match['REFEREE'] || '';
        return referee === refereeName;
    });
    
    console.log(`Found ${refereeMatches.length} matches for referee ${refereeName}`);
    
    // Load sub-tabs data
    loadRefereeMatches(refereeMatches);
    loadRefereeChampionships(refereeMatches);
    loadRefereeSeasons(refereeMatches);
}

// Load referee matches (sorted from newest to oldest)
function loadRefereeMatches(matches) {
    const tbody = document.querySelector('#referee-matches-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No matches found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const sortedMatches = [...matches].sort((a, b) => {
        let dateA = a.DATE || a.date || 0;
        let dateB = b.DATE || b.date || 0;
        
        // Convert Excel serial dates if needed
        if (dateA && !isNaN(dateA) && typeof dateA === 'number') {
            dateA = new Date((dateA - 25569) * 86400 * 1000);
        } else {
            dateA = new Date(dateA);
        }
        
        if (dateB && !isNaN(dateB) && typeof dateB === 'number') {
            dateB = new Date((dateB - 25569) * 86400 * 1000);
        } else {
            dateB = new Date(dateB);
        }
        
        return dateB - dateA;
    });
    
    sortedMatches.forEach(match => {
        const row = document.createElement('tr');
        const result = match['W-D-L'] || '';
        let resultBadge = '';
        
        if (result === 'W') {
            resultBadge = '<span class="badge badge-success">W</span>';
        } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
            resultBadge = '<span class="badge badge-warning">D</span>';
        } else if (result === 'L') {
            resultBadge = '<span class="badge badge-danger">L</span>';
        }
        
        // Format date properly
        let dateStr = match.DATE || match.date || '';
        if (dateStr && typeof dateStr === 'number' && !isNaN(dateStr)) {
            // Convert Excel serial date to JavaScript date
            const excelDate = new Date((dateStr - 25569) * 86400 * 1000);
            dateStr = excelDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric' 
            });
        } else if (dateStr && typeof dateStr === 'string') {
            // Try to parse string date
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate)) {
                dateStr = parsedDate.toLocaleDateString('en-GB', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                });
            }
        }
        
        // Count penalties for this match
        const penaltiesFor = countMatchPenalties(match.MATCH_ID, true);
        const penaltiesAgainst = countMatchPenalties(match.MATCH_ID, false);
        
        row.innerHTML = `
            <td>${dateStr}</td>
            <td>${match.SEASON || match.season || ''}</td>
            <td>${match['OPPONENT TEAM'] || match.opponent_team || ''}</td>
            <td style="font-weight: 600;">${match.GF || 0}</td>
            <td style="font-weight: 600;">${match.GA || 0}</td>
            <td>${resultBadge}</td>
            <td>${penaltiesFor}</td>
            <td>${penaltiesAgainst}</td>
        `;
        tbody.appendChild(row);
    });
    
    console.log(`Rendered ${sortedMatches.length} referee matches`);
}

// Load referee championships statistics
function loadRefereeChampionships(matches) {
    const tbody = document.querySelector('#referee-championships-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Group by championship
    const champStats = {};
    
    matches.forEach(match => {
        const champ = match.CHAMPION || match.champion || 'Unknown';
        const result = match['W-D-L'] || '';
        
        if (!champStats[champ]) {
            champStats[champ] = {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                penaltiesFor: 0,
                penaltiesAgainst: 0
            };
        }
        
        champStats[champ].matches++;
        
        // Count results
        if (result === 'W') {
            champStats[champ].wins++;
        } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
            champStats[champ].draws++;
        } else if (result === 'L') {
            champStats[champ].losses++;
        }
        
        // Count penalties from PLAYERDETAILS
        champStats[champ].penaltiesFor += countMatchPenalties(match.MATCH_ID, true);
        champStats[champ].penaltiesAgainst += countMatchPenalties(match.MATCH_ID, false);
    });
    
    // Convert to array and sort by matches
    const champArray = Object.entries(champStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.matches - a.matches);
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        penaltiesFor: 0,
        penaltiesAgainst: 0
    };
    
    champArray.forEach(champ => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align: center; font-weight: 500;">${champ.name}</td>
            <td>${champ.matches}</td>
            <td style="color: #10b981; font-weight: 600;">${champ.wins}</td>
            <td style="color: #f59e0b; font-weight: 600;">${champ.draws}</td>
            <td style="color: #ef4444; font-weight: 600;">${champ.losses}</td>
            <td>${champ.penaltiesFor}</td>
            <td>${champ.penaltiesAgainst}</td>
        `;
        tbody.appendChild(row);
        
        // Add to totals
        totals.matches += champ.matches;
        totals.wins += champ.wins;
        totals.draws += champ.draws;
        totals.losses += champ.losses;
        totals.penaltiesFor += champ.penaltiesFor;
        totals.penaltiesAgainst += champ.penaltiesAgainst;
    });
    
    // Add totals row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    totalRow.innerHTML = `
        <td style="text-align: center;">TOTAL</td>
        <td>${totals.matches}</td>
        <td style="color: #10b981;">${totals.wins}</td>
        <td style="color: #f59e0b;">${totals.draws}</td>
        <td style="color: #ef4444;">${totals.losses}</td>
        <td>${totals.penaltiesFor}</td>
        <td>${totals.penaltiesAgainst}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Rendered ${champArray.length} championships for referee`);
}

// Load referee seasons statistics
function loadRefereeSeasons(matches) {
    const tbody = document.querySelector('#referee-seasons-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No data available</td></tr>';
        return;
    }
    
    // Group by season
    const seasonStats = {};
    
    matches.forEach(match => {
        const season = match.SEASON || match.season || 'Unknown';
        const result = match['W-D-L'] || '';
        
        if (!seasonStats[season]) {
            seasonStats[season] = {
                matches: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                penaltiesFor: 0,
                penaltiesAgainst: 0
            };
        }
        
        seasonStats[season].matches++;
        
        // Count results
        if (result === 'W') {
            seasonStats[season].wins++;
        } else if (result === 'D' || result === 'D WITH G' || result === 'D.') {
            seasonStats[season].draws++;
        } else if (result === 'L') {
            seasonStats[season].losses++;
        }
        
        // Count penalties from PLAYERDETAILS
        seasonStats[season].penaltiesFor += countMatchPenalties(match.MATCH_ID, true);
        seasonStats[season].penaltiesAgainst += countMatchPenalties(match.MATCH_ID, false);
    });
    
    // Convert to array and sort by season (descending)
    const seasonArray = Object.entries(seasonStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.name.localeCompare(a.name));
    
    // Calculate totals
    const totals = {
        matches: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        penaltiesFor: 0,
        penaltiesAgainst: 0
    };
    
    seasonArray.forEach(season => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="text-align: center; font-weight: 500;">${season.name}</td>
            <td>${season.matches}</td>
            <td style="color: #10b981; font-weight: 600;">${season.wins}</td>
            <td style="color: #f59e0b; font-weight: 600;">${season.draws}</td>
            <td style="color: #ef4444; font-weight: 600;">${season.losses}</td>
            <td>${season.penaltiesFor}</td>
            <td>${season.penaltiesAgainst}</td>
        `;
        tbody.appendChild(row);
        
        // Add to totals
        totals.matches += season.matches;
        totals.wins += season.wins;
        totals.draws += season.draws;
        totals.losses += season.losses;
        totals.penaltiesFor += season.penaltiesFor;
        totals.penaltiesAgainst += season.penaltiesAgainst;
    });
    
    // Add totals row
    const totalRow = document.createElement('tr');
    totalRow.style.fontWeight = 'bold';
    totalRow.style.backgroundColor = '#f8f9fa';
    totalRow.innerHTML = `
        <td style="text-align: center;">TOTAL</td>
        <td>${totals.matches}</td>
        <td style="color: #10b981;">${totals.wins}</td>
        <td style="color: #f59e0b;">${totals.draws}</td>
        <td style="color: #ef4444;">${totals.losses}</td>
        <td>${totals.penaltiesFor}</td>
        <td>${totals.penaltiesAgainst}</td>
    `;
    tbody.appendChild(totalRow);
    
    console.log(`Rendered ${seasonArray.length} seasons for referee`);
}

// Referee sub-tabs switching
function showRefereeSubTab(evt, subTabName) {
    // Hide all referee sub-tab contents
    document.querySelectorAll('#referees-tab .player-sub-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all referee sub-tabs
    document.querySelectorAll('#referees-tab .stats-sub-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected sub-tab content
    const targetContent = document.getElementById('referee-' + subTabName + '-sub');
    if (targetContent) {
        targetContent.classList.add('active');
    }
    
    // Add active class to clicked sub-tab
    if (evt && evt.target) {
        const btn = evt.target.closest('button.stats-sub-tab');
        if (btn) {
            btn.classList.add('active');
        }
    }
}

// Setup Main Stats filters
function setupMainStatsFilters() {
    const teamFilter = document.getElementById('team-filter');
    const seasonFilter = document.getElementById('season-filter');
    const championFilter = document.getElementById('champion-filter');
    
    // Remove existing listeners to prevent duplicates
    if (teamFilter && teamFilter.mainStatsListener) {
        teamFilter.removeEventListener('change', teamFilter.mainStatsListener);
    }
    if (seasonFilter && seasonFilter.mainStatsListener) {
        seasonFilter.removeEventListener('change', seasonFilter.mainStatsListener);
    }
    if (championFilter && championFilter.mainStatsListener) {
        championFilter.removeEventListener('change', championFilter.mainStatsListener);
    }
    
    if (teamFilter) {
        teamFilter.mainStatsListener = function() {
            console.log('Team filter changed for Main Stats:', this.value);
            // Reload current active Main Stats sub-tab
            const activeSubTab = document.querySelector('#main-stats-tab .stats-subtab.active');
            if (activeSubTab) {
                const subTabName = activeSubTab.onclick.toString().match(/switchMainStatsSubTab\([^,]+,\s*'([^']+)'/);
                if (subTabName && subTabName[1]) {
                    if (subTabName[1] === 'championships') {
                        loadChampionshipsStats();
                    } else if (subTabName[1] === 'seasons') {
                        loadSeasonsStats();
                    }
                }
            }
        };
        teamFilter.addEventListener('change', teamFilter.mainStatsListener);
    }
    
    if (seasonFilter) {
        seasonFilter.mainStatsListener = function() {
            console.log('Season filter changed for Main Stats:', this.value);
            // Reload current active Main Stats sub-tab
            const activeSubTab = document.querySelector('#main-stats-tab .stats-subtab.active');
            if (activeSubTab) {
                const subTabName = activeSubTab.onclick.toString().match(/switchMainStatsSubTab\([^,]+,\s*'([^']+)'/);
                if (subTabName && subTabName[1]) {
                    if (subTabName[1] === 'championships') {
                        loadChampionshipsStats();
                    } else if (subTabName[1] === 'seasons') {
                        loadSeasonsStats();
                    }
                }
            }
        };
        seasonFilter.addEventListener('change', seasonFilter.mainStatsListener);
    }
    
    if (championFilter) {
        championFilter.mainStatsListener = function() {
            console.log('Champion filter changed for Main Stats:', this.value);
            // Reload current active Main Stats sub-tab
            const activeSubTab = document.querySelector('#main-stats-tab .stats-subtab.active');
            if (activeSubTab) {
                const subTabName = activeSubTab.onclick.toString().match(/switchMainStatsSubTab\([^,]+,\s*'([^']+)'/);
                if (subTabName && subTabName[1]) {
                    if (subTabName[1] === 'championships') {
                        loadChampionshipsStats();
                    } else if (subTabName[1] === 'seasons') {
                        loadSeasonsStats();
                    }
                }
            }
        };
        championFilter.addEventListener('change', championFilter.mainStatsListener);
    }
}
// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== DOM LOADED, INITIALIZING AL AHLY STATS PAGE ===');
    
    // Try to auto-load cached data first
    console.log('Attempting to load cached data...');
    await autoLoadCachedExcelData();
    console.log('Cache loading complete');
    
    // Initialize the page
    console.log('Initializing Al Ahly Stats...');
    initializeAlAhlyStats();
    
    // Setup Main Stats filters
    setupMainStatsFilters();
    
    // Setup main filters for all tabs
    setupMainFiltersForAllTabs();
});

// Setup main filters for all tabs
function setupMainFiltersForAllTabs() {
    console.log('🔧 Setting up main filters for all tabs...');
    
    // Get all main filter elements
    const filterElements = [
        'match-id-filter',
        'champion-system-filter', 
        'champion-filter',
        'season-filter',
        'ahly-manager-filter',
        'opponent-manager-filter',
        'referee-filter',
        'round-filter',
        'h-a-n-filter',
        'stadium-filter',
        'ahly-team-filter',
        'opponent-team-filter',
        'goals-for-filter',
        'goals-against-filter',
        'result-filter',
        'clean-sheet-filter',
        'extra-time-filter',
        'penalties-filter',
        'date-from-filter',
        'date-to-filter'
    ];
    
    filterElements.forEach(filterId => {
        const element = document.getElementById(filterId);
        if (element) {
            console.log(`✅ Setting up filter: ${filterId}`);
            // Remove existing listener to prevent duplicates
            if (element.mainFilterListener) {
                element.removeEventListener('change', element.mainFilterListener);
                element.removeEventListener('input', element.mainFilterListener);
            }
            
            // Add new listener
            element.mainFilterListener = function() {
                console.log(`🔍 Main filter changed: ${filterId} = ${this.value}`);
                console.log('🔄 Calling reloadCurrentActiveTab()...');
                // Reload current active tab data
                reloadCurrentActiveTab();
            };
            
            // Add event listener (use 'input' for text inputs, 'change' for selects)
            if (filterId.includes('filter') && !filterId.includes('date')) {
                element.addEventListener('change', element.mainFilterListener);
                console.log(`📝 Added 'change' listener to ${filterId}`);
            } else {
                element.addEventListener('input', element.mainFilterListener);
                console.log(`📝 Added 'input' listener to ${filterId}`);
            }
        } else {
            console.log(`❌ Filter element not found: ${filterId}`);
        }
    });
    
    console.log('✅ Main filters setup complete');
}
// Reload current active tab data
function reloadCurrentActiveTab() {
    console.log('🔄 reloadCurrentActiveTab() called');
    
    // Check if we're in the BY Player tab
    const playersTab = document.getElementById('players-tab');
    console.log('📊 BY Player tab active:', playersTab && playersTab.classList.contains('active'));
    
    if (playersTab && playersTab.classList.contains('active')) {
        // Check if With Coaches sub-tab is active
        const withCoachesSubTab = document.getElementById('player-with-coaches-sub');
        const overviewSubTab = document.getElementById('player-overview-sub');
        const goalMinuteContent = document.getElementById('goal-minute-content');
        const goalEffectContent = document.getElementById('goal-effect-content');
        
        console.log('👨‍💼 With Coaches sub-tab active:', withCoachesSubTab && withCoachesSubTab.classList.contains('active'));
        console.log('📊 Overview sub-tab active:', overviewSubTab && overviewSubTab.classList.contains('active'));
        console.log('⏰ Goal Minute sub-tab active:', goalMinuteContent && goalMinuteContent.classList.contains('active'));
        console.log('🎯 Goal Effect sub-tab active:', goalEffectContent && goalEffectContent.classList.contains('active'));
        
        if (withCoachesSubTab && withCoachesSubTab.classList.contains('active')) {
            console.log('🔄 Reloading With Coaches tab due to main filter change');
            loadPlayerWithCoachesStats();
        } 
        // Check if Overview sub-tab is active
        else if (overviewSubTab && overviewSubTab.classList.contains('active')) {
            console.log('🔄 Reloading Overview tab due to main filter change');
            const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
            if (selectedPlayer) {
                loadPlayerOverviewStats(selectedPlayer);
            }
        }
        // Check if Goal Minute sub-tab is active
        else if (goalMinuteContent && goalMinuteContent.classList.contains('active')) {
            console.log('🔄 Reloading Goal Minute tab due to main filter change');
            loadPlayerGoalMinuteStats();
        }
        // Check if Goal Effect sub-tab is active
        else if (goalEffectContent && goalEffectContent.classList.contains('active')) {
            console.log('🔄 Reloading Goal Effect tab due to main filter change');
            loadPlayerGoalEffectStats();
        } else {
            // Reload other player sub-tabs
            const currentSubTab = getCurrentPlayerSubTab();
            console.log('🔄 Reloading other player sub-tab:', currentSubTab);
            if (currentSubTab) {
                loadPlayerSubTabData(currentSubTab);
            }
        }
    }
    
    // Also reload other tabs that use main filters
    const activeTab = document.querySelector('.stats-tab.active');
    if (activeTab) {
        const tabId = activeTab.getAttribute('onclick');
        if (tabId) {
            const tabName = tabId.match(/showStatsTab\([^,]+,\s*'([^']+)'/);
            if (tabName && tabName[1]) {
                const tabNameValue = tabName[1];
                console.log(`🔄 Reloading ${tabNameValue} tab due to main filter change`);
                
                // Reload specific tabs that use main filters
                if (tabNameValue === 'all-players') {
                    const currentFilteredRecords = getCurrentFilteredRecords();
                    loadAllPlayersData(currentFilteredRecords);
                } else if (tabNameValue === 'coaches') {
                    const currentFilteredRecords = getCurrentFilteredRecords();
                    loadCoachesData(currentFilteredRecords);
                } else if (tabNameValue === 'h2h') {
                    const currentFilteredRecords = getCurrentFilteredRecords();
                    loadH2HTeamsData(currentFilteredRecords);
                } else if (tabNameValue === 'h2h-t-details') {
                    console.log('🔄 Updating H2H T Details with filtered data');
                    if (filteredRecords && filteredRecords.length > 0) {
                        loadH2HTDetailsTeamsWithFilteredData(filteredRecords);
                    } else {
                        loadH2HTDetailsTeams();
                    }
                } else if (tabNameValue === 'referees') {
                    const currentFilteredRecords = getCurrentFilteredRecords();
                    loadAllRefereesData(currentFilteredRecords);
                } else if (tabNameValue === 'all-goalkeepers') {
                    loadAllGoalkeepersData();
                }
            }
        }
    }
    
    // Update H2H T Details if it's currently active
    const h2hTDetailsTab = document.getElementById('h2h-t-details-tab');
    if (h2hTDetailsTab && h2hTDetailsTab.style.display !== 'none') {
        console.log('🔄 Updating H2H T Details due to filter change');
        console.log(`📊 Filtered records count: ${filteredRecords.length}`);
        if (filteredRecords && filteredRecords.length > 0) {
            loadH2HTDetailsTeamsWithFilteredData(filteredRecords);
        } else {
            loadH2HTDetailsTeams();
        }
    }
    
    // Also check if H2H T Details tab is active by checking if it's visible
    if (activeTab && activeTab.getAttribute('onclick') && activeTab.getAttribute('onclick').includes('h2h-t-details')) {
        console.log('🔄 H2H T Details tab is active, updating with filtered data');
        if (filteredRecords && filteredRecords.length > 0) {
            loadH2HTDetailsTeamsWithFilteredData(filteredRecords);
        } else {
            loadH2HTDetailsTeams();
        }
    }
}

// ============================================================================
// TROPHY STATISTICS
// ============================================================================

/**
 * Load and display player trophy statistics
 */
function loadPlayerTrophies(playerName, teamFilter = '') {
    try {
        console.log(`🏆 Loading trophies for player: ${playerName}, team filter: ${teamFilter}`);
        
        const container = document.getElementById('trophy-cards-container');
        if (!container) {
            return;
        }
        
        // Get trophy data from TROPHY sheet
        const trophySheet = getSheetRowsByCandidates(['TROPHY']);
        if (!trophySheet || trophySheet.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">No trophy data available</p>';
            return;
        }
        
        // Get all sheets that contain player data
        const lineupSheet = getSheetRowsByCandidates(['LINEUPDETAILS']) || [];
        const playerDetailsSheet = getSheetRowsByCandidates(['PLAYERDETAILS']) || [];
        const gkDetailsSheet = getSheetRowsByCandidates(['GKDETAILS']) || [];
        
        // Get main sheet to get MATCH_ID for filtering
        const mainSheet = getSheetRowsByCandidates(['MATCHDETAILS']) || [];
        
        // Calculate trophies for the player
        // For trophies, we ignore team filter and only show Al Ahly trophies
        const playerTrophies = calculatePlayerTrophies(
            playerName,
            '', // Empty team filter - trophies are always Al Ahly only
            trophySheet,
            lineupSheet,
            playerDetailsSheet,
            gkDetailsSheet,
            mainSheet
        );
        
        // Render trophy cards
        renderTrophyCards(playerTrophies);
    } catch (error) {
        console.error('❌ Error in loadPlayerTrophies:', error);
        const container = document.getElementById('trophy-cards-container');
        if (container) {
            container.innerHTML = '<p style="text-align: center; color: #ff0000;">Error loading trophy data</p>';
        }
    }
}

/**
 * Calculate trophies for a player
 */
function calculatePlayerTrophies(playerName, teamFilter, trophySheet, lineupSheet, playerDetailsSheet, gkDetailsSheet, mainSheet) {
    try {
        const trophyMap = {};
        
        // Process each trophy season
        trophySheet.forEach(trophyRow => {
            const season = trophyRow['SEASON'];
            if (!season) return;
            
            // Get all matches in this season from main sheet
            // For trophies, we only care about Al Ahly matches regardless of team filter
            const seasonMatches = mainSheet.filter(m => {
                const matchSeason = m['SEASON'];
                return matchSeason === season;
            });
            
            if (seasonMatches.length === 0) return;
            
            // Get trophy name from CHAMPION column in MATCHDETAILS (first match)
            const trophyName = seasonMatches[0]['CHAMPION'] || 'Unknown Trophy';
            
            const seasonMatchIds = seasonMatches.map(m => m['MATCH_ID']);
            
            // Check if player appeared in any match in this season
            let playerFound = false;
            
            for (const matchId of seasonMatchIds) {
                // Check in LINEUPDETAILS
                const inLineup = lineupSheet.some(row => {
                    return String(row['MATCH_ID']) === String(matchId) && 
                           row['PLAYER NAME'] === playerName;
                });
                
                // Check in PLAYERDETAILS
                const inPlayerDetails = playerDetailsSheet.some(row => {
                    return String(row['MATCH_ID']) === String(matchId) && 
                           row['PLAYER NAME'] === playerName;
                });
                
                // Check in GKDETAILS
                const inGKDetails = gkDetailsSheet.some(row => {
                    return String(row['MATCH_ID']) === String(matchId) && 
                           row['PLAYER NAME'] === playerName;
                });
                
                if (inLineup || inPlayerDetails || inGKDetails) {
                    playerFound = true;
                    break;
                }
            }
            
            if (playerFound) {
                if (!trophyMap[trophyName]) {
                    trophyMap[trophyName] = {
                        count: 0,
                        seasons: []
                    };
                }
                trophyMap[trophyName].count++;
                trophyMap[trophyName].seasons.push(season);
            }
        });
    
        // Convert to array and sort by count (descending)
        const trophiesArray = Object.entries(trophyMap).map(([name, data]) => ({
            name,
            count: data.count,
            seasons: data.seasons.map(season => {
                // Extract only numbers/years from season string
                // Examples: "الكونفدرالية الأفريقية 2014" -> "2014"
                //           "الدوري المصري 2024-25" -> "2024-25"
                const yearMatch = season.match(/\d{4}(-\d{2,4}|\/\d{2,4})?/);
                return yearMatch ? yearMatch[0] : season;
            }).sort((a, b) => {
                // Sort seasons from newest to oldest
                const yearA = parseInt(a.split('-')[0] || a.split('/')[0] || a);
                const yearB = parseInt(b.split('-')[0] || b.split('/')[0] || b);
                return yearB - yearA;
            })
        })).sort((a, b) => b.count - a.count);
        
        console.log(`🏆 Total trophies calculated: ${trophiesArray.length}`, trophiesArray);
        
        return trophiesArray;
    } catch (error) {
        console.error('❌ Error in calculatePlayerTrophies:', error);
        return [];
    }
}

/**
 * Render trophy cards
 */
function renderTrophyCards(trophies) {
    const container = document.getElementById('trophy-cards-container');
    
    if (!container) return;
    
    if (!trophies || trophies.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; font-size: 1.2rem;">No trophies found for this player</p>';
        return;
    }
    
    container.innerHTML = trophies.map((trophy, index) => `
        <div class="trophy-card" onclick="toggleTrophySeasons(${index})">
            <span class="trophy-card-icon">🏆</span>
            <div class="trophy-card-title">${trophy.name}</div>
            <div class="trophy-card-count">${trophy.count}</div>
            <div class="trophy-card-label">${trophy.count === 1 ? 'Trophy' : 'Trophies'}</div>
            <div class="trophy-seasons" id="trophy-seasons-${index}" style="display: none;">
                <div class="trophy-seasons-title">Seasons:</div>
                <div class="trophy-seasons-list">
                    ${trophy.seasons.map(season => `<span class="trophy-season-badge">${season}</span>`).join(' <span class="trophy-season-separator">#</span> ')}
                </div>
            </div>
        </div>
    `).join('');
    
    // Store trophies data for toggle function
    window.currentTrophiesData = trophies;
}

/**
 * Toggle trophy seasons display
 */
function toggleTrophySeasons(index) {
    const seasonsDiv = document.getElementById(`trophy-seasons-${index}`);
    if (!seasonsDiv) return;
    
    // Close all other open seasons
    document.querySelectorAll('.trophy-seasons').forEach((div, i) => {
        if (i !== index) {
            div.style.display = 'none';
        }
    });
    
    // Toggle current seasons
    if (seasonsDiv.style.display === 'none') {
        seasonsDiv.style.display = 'block';
    } else {
        seasonsDiv.style.display = 'none';
    }
}

// Expose to window for onclick handler
window.toggleTrophySeasons = toggleTrophySeasons;

/**
 * Load and display player assist details (Make Assist & Take Assist)
 */
function loadPlayerAssistDetails() {
    try {
        const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
        const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
        
        if (!selectedPlayer) {
            console.log('⚠️ No player selected for Assist Details');
            return;
        }
        
        console.log(`🎯 Loading Assist Details for player: ${selectedPlayer}, team filter: ${teamFilter}`);
        
        // Get PLAYERDETAILS sheet
        const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
        
        if (!playerDetails || playerDetails.length === 0) {
            console.log('⚠️ No PLAYERDETAILS data found');
            document.getElementById('assist-details-table').querySelector('tbody').innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No data available</td></tr>';
            return;
        }
        
        // Filter player details by team filter
        const playerNameLower = normalizeStr(selectedPlayer).toLowerCase();
        const teamLower = (teamFilter ? String(teamFilter) : '').toLowerCase();
        
        // Get all player records for filtering
        const filteredDetails = playerDetails.filter(r => {
            if (teamLower) {
                const teamVal = r.TEAM || r['AHLY TEAM'] || '';
                return teamMatchesFilter(teamVal, teamFilter);
            }
            return true;
        });
        
        // Maps to store assist relationships
        const makeAssistMap = {}; // Player made assists TO which players
        const takeAssistMap = {}; // Player received assists FROM which players
        
        // Group by Match ID and Minute to find assist-goal pairs
        const matchMinuteMap = {};
        
        filteredDetails.forEach(record => {
            const matchId = normalizeStr(record.MATCH_ID || record['MATCH ID'] || '');
            const minute = String(record.MINUTE || '').trim();
            const ga = normalizeStr(record.GA || '').toUpperCase();
            const playerName = normalizeStr(record['PLAYER NAME'] || '');
            const team = normalizeStr(record.TEAM || record['AHLY TEAM'] || '');
            
            // Only process if minute exists and it's Ahly player
            if (!minute || !matchId || !playerName || team !== 'الأهلي') return;
            
            // Create key for match + minute
            const key = `${matchId}_${minute}`;
            
            if (!matchMinuteMap[key]) {
                matchMinuteMap[key] = {
                    matchId: matchId,
                    minute: minute,
                    goals: [],
                    assists: []
                };
            }
            
            // Categorize as GOAL or ASSIST
            if (ga === 'GOAL') {
                matchMinuteMap[key].goals.push(playerName);
            } else if (ga === 'ASSIST') {
                matchMinuteMap[key].assists.push(playerName);
            }
        });
        
        // Now find assist-goal pairs
        Object.values(matchMinuteMap).forEach(minuteData => {
            // For each ASSIST player and GOAL player in the same minute
            minuteData.assists.forEach(assistPlayer => {
                minuteData.goals.forEach(goalPlayer => {
                    // Check if selected player is the one making the assist
                    if (normalizeStr(assistPlayer).toLowerCase() === playerNameLower) {
                        // Selected player made assist to goalPlayer
                        if (!makeAssistMap[goalPlayer]) {
                            makeAssistMap[goalPlayer] = 0;
                        }
                        makeAssistMap[goalPlayer]++;
                    }
                    
                    // Check if selected player is the one receiving the assist
                    if (normalizeStr(goalPlayer).toLowerCase() === playerNameLower) {
                        // Selected player received assist from assistPlayer
                        if (!takeAssistMap[assistPlayer]) {
                            takeAssistMap[assistPlayer] = 0;
                        }
                        takeAssistMap[assistPlayer]++;
                    }
                });
            });
        });
        
        // Combine both maps to create unified player list
        const allPlayers = new Set([...Object.keys(makeAssistMap), ...Object.keys(takeAssistMap)]);
        
        const assistData = Array.from(allPlayers).map(player => ({
            player: player,
            makeAssist: makeAssistMap[player] || 0,
            takeAssist: takeAssistMap[player] || 0,
            total: (makeAssistMap[player] || 0) + (takeAssistMap[player] || 0)
        })).sort((a, b) => b.total - a.total);
        
        // Render unified table
        const tableBody = document.getElementById('assist-details-table').querySelector('tbody');
        
        if (assistData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666; padding: 3rem;">No assist relationships found</td></tr>';
        } else {
            tableBody.innerHTML = assistData.map(data => `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #2c3e50;">${data.player}</td>
                    <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.2rem;">${data.makeAssist || '-'}</td>
                    <td style="text-align: center; font-weight: 700; color: #10b981; font-size: 1.2rem;">${data.takeAssist || '-'}</td>
                </tr>
            `).join('');
        }
        
        console.log(`✅ Assist Details loaded - ${assistData.length} players with assist relationships`);
        
        // Calculate and display totals
        const totalMakeAssist = assistData.reduce((sum, d) => sum + d.makeAssist, 0);
        const totalTakeAssist = assistData.reduce((sum, d) => sum + d.takeAssist, 0);
        
        const totalMakeEl = document.getElementById('assist-details-total-make');
        const totalTakeEl = document.getElementById('assist-details-total-take');
        
        if (totalMakeEl) totalMakeEl.textContent = totalMakeAssist;
        if (totalTakeEl) totalTakeEl.textContent = totalTakeAssist;
        
        // Store data for sorting
        window.currentAssistDetailsData = assistData;
        
    } catch (error) {
        console.error('❌ Error in loadPlayerAssistDetails:', error);
        const tableBody = document.getElementById('assist-details-table')?.querySelector('tbody');
        
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #ff0000;">Error loading assist data</td></tr>';
        }
    }
}

/**
 * Sort Assist Details Table
 */
let assistDetailsSortState = {
    column: null,
    direction: 'desc'
};

function sortAssistDetailsTable(column) {
    if (!window.currentAssistDetailsData || window.currentAssistDetailsData.length === 0) {
        console.log('⚠️ No data to sort');
        return;
    }
    
    // Toggle sort direction if same column, otherwise default to desc
    if (assistDetailsSortState.column === column) {
        assistDetailsSortState.direction = assistDetailsSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        assistDetailsSortState.column = column;
        assistDetailsSortState.direction = 'desc';
    }
    
    const data = [...window.currentAssistDetailsData];
    
    // Sort data
    data.sort((a, b) => {
        let valA, valB;
        
        if (column === 'player') {
            valA = a.player.toLowerCase();
            valB = b.player.toLowerCase();
            return assistDetailsSortState.direction === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else if (column === 'makeAssist') {
            valA = a.makeAssist;
            valB = b.makeAssist;
        } else if (column === 'takeAssist') {
            valA = a.takeAssist;
            valB = b.takeAssist;
        }
        
        if (assistDetailsSortState.direction === 'asc') {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });
    
    // Render sorted data
    const tableBody = document.getElementById('assist-details-table').querySelector('tbody');
    tableBody.innerHTML = data.map(d => `
        <tr>
            <td style="text-align: center; font-weight: 600; color: #2c3e50;">${d.player}</td>
            <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.2rem;">${d.makeAssist || '-'}</td>
            <td style="text-align: center; font-weight: 700; color: #10b981; font-size: 1.2rem;">${d.takeAssist || '-'}</td>
        </tr>
    `).join('');
    
    // Update sort indicators
    document.querySelectorAll('#assist-details-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const currentHeader = document.querySelector(`#assist-details-table th.sortable[onclick*="${column}"]`);
    if (currentHeader) {
        currentHeader.classList.add(assistDetailsSortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    
    console.log(`✅ Table sorted by ${column} (${assistDetailsSortState.direction})`);
}

// Helper function to apply main filters to match data
function applyMainFiltersToMatch(matchDetail, filters) {
    if (!matchDetail) return false;
    
    // Match ID filter
    if (filters.matchId && !normalizeStr(matchDetail.MATCH_ID || matchDetail['MATCH ID'] || '').toLowerCase().includes(filters.matchId.toLowerCase())) {
        return false;
    }
    
    // Champion System filter
    if (filters.championSystem && normalizeStr(matchDetail['CHAMPION SYSTEM'] || '') !== filters.championSystem) {
        return false;
    }
    
    // Champion filter
    if (filters.champion && normalizeStr(matchDetail.CHAMPION || '') !== filters.champion) {
        return false;
    }
    
    // Season filter
    if (filters.season && normalizeStr(matchDetail.SEASON || '') !== filters.season) {
        return false;
    }
    
    // Ahly Manager filter
    if (filters.ahlyManager && normalizeStr(matchDetail['AHLY MANAGER'] || '') !== filters.ahlyManager) {
        return false;
    }
    
    // Opponent Manager filter
    if (filters.opponentManager && normalizeStr(matchDetail['OPPONENT MANAGER'] || '') !== filters.opponentManager) {
        return false;
    }
    
    // Referee filter (sheet uses REFREE)
    if (filters.referee && normalizeStr(matchDetail.REFREE || matchDetail.REFEREE || '') !== filters.referee) {
        return false;
    }
    
    // Round filter
    if (filters.round && normalizeStr(matchDetail.ROUND || '') !== filters.round) {
        return false;
    }
    
    // H-A-N filter (sheet uses H-A-N)
    if (filters.hAN && normalizeStr(matchDetail['H-A-N'] || '') !== filters.hAN) {
        return false;
    }
    
    // Stadium filter (sheet uses STAD)
    if (filters.stadium && normalizeStr(matchDetail.STAD || '') !== filters.stadium) {
        return false;
    }
    
    // Ahly Team filter
    if (filters.ahlyTeam && normalizeStr(matchDetail['AHLY TEAM'] || '') !== filters.ahlyTeam) {
        return false;
    }
    
    // Opponent Team filter
    if (filters.opponentTeam && normalizeStr(matchDetail['OPPONENT TEAM'] || '') !== filters.opponentTeam) {
        return false;
    }
    
    // Goals For filter (sheet uses GF)
    if (filters.goalsFor && safeInt(matchDetail['GF'] || 0) !== safeInt(filters.goalsFor)) {
        return false;
    }
    
    // Goals Against filter (sheet uses GA)
    if (filters.goalsAgainst && safeInt(matchDetail['GA'] || 0) !== safeInt(filters.goalsAgainst)) {
        return false;
    }
    
    // Result filter (sheet uses W-D-L with variants)
    if (filters.result) {
        const recordValue = normalizeStr(matchDetail['W-D-L'] || '');
        const filterValue = normalizeStr(filters.result);
        if (filterValue === 'D WITH G') {
            if (recordValue !== 'D WITH G') return false;
        } else if (filterValue === 'D.') {
            if (recordValue !== 'D.') return false;
        } else {
            if (recordValue !== filterValue) return false;
        }
    }
    
    // Clean Sheet filter
    if (filters.cleanSheet && normalizeStr(matchDetail['CLEAN SHEET'] || '') !== filters.cleanSheet) {
        return false;
    }
    
    // Extra Time filter (sheet uses ET)
    if (filters.extraTime && normalizeStr(matchDetail['ET'] || '') !== filters.extraTime) {
        return false;
    }
    
    // Penalties filter (sheet uses PEN)
    if (filters.penalties && normalizeStr(matchDetail['PEN'] || '') !== filters.penalties) {
        return false;
    }
    
    // Date From filter
    if (filters.dateFrom) {
        const matchDate = normalizeStr(matchDetail.DATE || matchDetail['MATCH DATE'] || '');
        if (matchDate && matchDate < filters.dateFrom) {
            return false;
        }
    }
    
    // Date To filter
    if (filters.dateTo) {
        const matchDate = normalizeStr(matchDetail.DATE || matchDetail['MATCH DATE'] || '');
        if (matchDate && matchDate > filters.dateTo) {
            return false;
        }
    }
    
    return true;
}
// Load Player With Coaches Statistics
function loadPlayerWithCoachesStats() {
    try {
        const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
        const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
        
        if (!selectedPlayer) {
            console.log('⚠️ No player selected for With Coaches stats');
            return;
        }
        
        // Get applied filters from the main filter section
        const appliedFilters = getCurrentFilters();
        console.log(`👨‍💼 Loading With Coaches stats for player: ${selectedPlayer}, team filter: ${teamFilter}, applied filters:`, appliedFilters);
        
        // Get data from sheets
        const lineupDetails = getSheetRowsByCandidates(['LINEUPDETAILS']);
        const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
        const matchDetails = getSheetRowsByCandidates(['MATCHDETAILS']);
        
        // Get all player matches from LINEUPDETAILS for minutes calculation
        const playerLineupData = lineupDetails.filter(row => {
            const playerName = normalizeStr(row['PLAYER NAME'] || row.PLAYER || '');
            const nameMatch = playerName.toLowerCase() === selectedPlayer.toLowerCase();
            // LINEUPDETAILS is Ahly-only; if a specific team is selected and it's not Ahly, exclude
            const teamMatch = !teamFilter || normalizeTeamKey(teamFilter) === 'ahly';
            
            // Apply main filters to match data
            const matchId = normalizeStr(row.MATCH_ID || row['MATCH ID'] || '');
            const matchDetail = matchDetails.find(match => 
                normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
            );
            
            const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
            
            return nameMatch && teamMatch && filtersMatch;
        });
        
        // Get all player goals and assists from PLAYERDETAILS (regardless of LINEUPDETAILS)
        const playerGoalsAssists = playerDetails.filter(pd => {
            const pdPlayerName = normalizeStr(pd['PLAYER NAME'] || pd.PLAYER || '');
            const pdTeam = normalizeStr(pd.TEAM || pd['AHLY TEAM'] || '');
            
            const nameMatch = pdPlayerName.toLowerCase() === selectedPlayer.toLowerCase();
            const teamMatch = !teamFilter || pdTeam.toLowerCase().includes(String(teamFilter || '').toLowerCase());
            
            // Apply main filters to match data
            const matchId = normalizeStr(pd.MATCH_ID || pd['MATCH ID'] || '');
            const matchDetail = matchDetails.find(match => 
                normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
            );
            
            const filtersMatch = applyMainFiltersToMatch(matchDetail, appliedFilters);
            
            return nameMatch && teamMatch && filtersMatch;
        });
        
        // Group by coach and calculate stats
        const coachStats = new Map();
        
        // First, add all matches from LINEUPDETAILS (for minutes and match count)
        playerLineupData.forEach(row => {
            const matchId = normalizeStr(row.MATCH_ID || row['MATCH ID'] || '');
            const minutes = safeInt(row.MINTOTAL || row.MINUTES || row.MINUTE || 0);
            
            // Get coach name from MATCHDETAILS using match ID
            const matchDetail = matchDetails.find(match => 
                normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
            );
            
            // If player is in LINEUPDETAILS, they are Al Ahly player
            // So their coach is AHLY MANAGER
            let coach = 'Unknown Coach';
            if (matchDetail) {
                coach = normalizeStr(matchDetail['AHLY MANAGER'] || 'Unknown Coach');
            }
            
            // Initialize coach stats if not exists
            if (!coachStats.has(coach)) {
                coachStats.set(coach, {
                    coach: coach,
                    matches: 0,
                    minutes: 0,
                    goals: 0,
                    assists: 0
                });
            }
            
            const stats = coachStats.get(coach);
            stats.matches++;
            stats.minutes += minutes;
        });
        
        // Then, add all goals and assists from PLAYERDETAILS
        playerGoalsAssists.forEach(pd => {
            const matchId = normalizeStr(pd.MATCH_ID || pd['MATCH ID'] || '');
            const ga = normalizeStr(pd.GA || '').toUpperCase();
            
            // Get coach name from MATCHDETAILS using match ID
            const matchDetail = matchDetails.find(match => 
                normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
            );
            
            // Determine coach based on player's team from PLAYERDETAILS
            const playerTeam = normalizeStr(pd.TEAM || pd['AHLY TEAM'] || '').toLowerCase();
            const isAhlyPlayer = playerTeam === 'الأهلي' || playerTeam === 'al ahly' || playerTeam === 'ahly';
            
            let coach = 'Unknown Coach';
            if (matchDetail) {
                if (isAhlyPlayer) {
                    coach = normalizeStr(matchDetail['AHLY MANAGER'] || 'Unknown Coach');
                } else {
                    coach = normalizeStr(matchDetail['OPPONENT MANAGER'] || 'Unknown Coach');
                }
            }
            
            // Don't add matches from PLAYERDETAILS - only from LINEUPDETAILS
            // This ensures matches are only counted when player was actually in lineup
            
            // Initialize coach stats if not exists
            if (!coachStats.has(coach)) {
                coachStats.set(coach, {
                    coach: coach,
                    matches: 0,
                    minutes: 0,
                    goals: 0,
                    assists: 0
                });
            }
            
            const stats = coachStats.get(coach);
            if (ga === 'GOAL') stats.goals++;
            if (ga === 'ASSIST') stats.assists++;
        });
        
        // Convert to array and filter by team filter
        let coachStatsArray = Array.from(coachStats.values());
        
        // Apply team filter to coaches
        if (teamFilter) {
            coachStatsArray = coachStatsArray.filter(stat => {
                // For LINEUPDETAILS (Ahly-only): only include lineup matches when filter is Ahly
                const hasMatchingMatches = playerLineupData.some(row => {
                    const matchId = normalizeStr(row.MATCH_ID || row['MATCH ID'] || '');
                    const matchDetail = matchDetails.find(match => 
                        normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
                    );
                    if (!matchDetail) return false;
                    const coach = normalizeStr(matchDetail['AHLY MANAGER'] || 'Unknown Coach');
                    if (coach !== stat.coach) return false;
                    // lineup contributes only if selected team is Ahly
                    return normalizeTeamKey(teamFilter) === 'ahly';
                });
                
                // Also check PLAYERDETAILS for goals/assists
                const hasMatchingPlayerDetails = playerGoalsAssists.some(pd => {
                    const matchId = normalizeStr(pd.MATCH_ID || pd['MATCH ID'] || '');
                    const matchDetail = matchDetails.find(match => 
                        normalizeStr(match.MATCH_ID || match['MATCH ID'] || '') === matchId
                    );
                    
                    if (!matchDetail) return false;
                    
                    const playerTeam = normalizeStr(pd.TEAM || pd['AHLY TEAM'] || '').toLowerCase();
                    const isAhlyPlayer = playerTeam === 'الأهلي' || playerTeam === 'al ahly' || playerTeam === 'ahly';
                    
                    let coach = 'Unknown Coach';
                    if (isAhlyPlayer) {
                        coach = normalizeStr(matchDetail['AHLY MANAGER'] || 'Unknown Coach');
                    } else {
                        coach = normalizeStr(matchDetail['OPPONENT MANAGER'] || 'Unknown Coach');
                    }
                    
                    if (coach === stat.coach) {
                        const team = normalizeStr(pd.TEAM || pd['AHLY TEAM'] || '');
                        return team.toLowerCase().includes(String(teamFilter || '').toLowerCase());
                    }
                    return false;
                });
                
                return hasMatchingMatches || hasMatchingPlayerDetails;
            });
        }
        
        // Filter out coaches with no stats at all
        coachStatsArray = coachStatsArray.filter(stat => 
            stat.matches > 0 || stat.minutes > 0 || stat.goals > 0 || stat.assists > 0
        );
        
        // Sort by matches (descending)
        coachStatsArray = coachStatsArray.sort((a, b) => b.matches - a.matches);
        
        // Store data globally for sorting
        window.currentWithCoachesData = coachStatsArray;
        
        // Render table
        const tableBody = document.getElementById('with-coaches-table').querySelector('tbody');
        if (coachStatsArray.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999; padding: 2rem;">No data available for this player</td></tr>';
        } else {
            tableBody.innerHTML = coachStatsArray.map(coach => `
                <tr>
                    <td style="text-align: center; font-weight: 600; color: #2c3e50;">${coach.coach}</td>
                    <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.2rem;">${coach.matches}</td>
                    <td style="text-align: center; font-weight: 700; color: #10b981; font-size: 1.2rem;">${coach.minutes}</td>
                    <td style="text-align: center; font-weight: 700; color: #ef4444; font-size: 1.2rem;">${coach.goals}</td>
                    <td style="text-align: center; font-weight: 700; color: #f59e0b; font-size: 1.2rem;">${coach.assists}</td>
                </tr>
            `).join('');
        }
        
        // Update totals
        const totals = coachStatsArray.reduce((acc, coach) => ({
            matches: acc.matches + coach.matches,
            minutes: acc.minutes + coach.minutes,
            goals: acc.goals + coach.goals,
            assists: acc.assists + coach.assists
        }), { matches: 0, minutes: 0, goals: 0, assists: 0 });
        
        document.getElementById('with-coaches-total-matches').textContent = totals.matches;
        document.getElementById('with-coaches-total-minutes').textContent = totals.minutes;
        document.getElementById('with-coaches-total-goals').textContent = totals.goals;
        document.getElementById('with-coaches-total-assists').textContent = totals.assists;
        
        console.log(`✅ Loaded With Coaches stats: ${coachStatsArray.length} coaches found`);
        
    } catch (error) {
        console.error('❌ Error loading With Coaches stats:', error);
        const tableBody = document.getElementById('with-coaches-table').querySelector('tbody');
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444; padding: 2rem;">Error loading data</td></tr>';
    }
}

// Sort With Coaches Table
let withCoachesSortState = { column: null, direction: 'asc' };

function sortWithCoachesTable(column) {
    if (!window.currentWithCoachesData || window.currentWithCoachesData.length === 0) {
        return;
    }
    
    // Toggle sort direction if same column
    if (withCoachesSortState.column === column) {
        withCoachesSortState.direction = withCoachesSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        withCoachesSortState.column = column;
        withCoachesSortState.direction = 'asc';
    }
    
    const data = [...window.currentWithCoachesData];
    
    // Sort data
    data.sort((a, b) => {
        let valA, valB;
        
        if (column === 'coach') {
            valA = a.coach.toLowerCase();
            valB = b.coach.toLowerCase();
            return withCoachesSortState.direction === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else if (column === 'matches') {
            valA = a.matches;
            valB = b.matches;
        } else if (column === 'minutes') {
            valA = a.minutes;
            valB = b.minutes;
        } else if (column === 'goals') {
            valA = a.goals;
            valB = b.goals;
        } else if (column === 'assists') {
            valA = a.assists;
            valB = b.assists;
        }
        
        if (withCoachesSortState.direction === 'asc') {
            return valA - valB;
        } else {
            return valB - valA;
        }
    });
    
    // Render sorted data
    const tableBody = document.getElementById('with-coaches-table').querySelector('tbody');
    tableBody.innerHTML = data.map(coach => `
        <tr>
            <td style="text-align: center; font-weight: 600; color: #2c3e50;">${coach.coach}</td>
            <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.2rem;">${coach.matches}</td>
            <td style="text-align: center; font-weight: 700; color: #10b981; font-size: 1.2rem;">${coach.minutes}</td>
            <td style="text-align: center; font-weight: 700; color: #ef4444; font-size: 1.2rem;">${coach.goals}</td>
            <td style="text-align: center; font-weight: 700; color: #f59e0b; font-size: 1.2rem;">${coach.assists}</td>
        </tr>
    `).join('');
    
    // Update sort indicators
    document.querySelectorAll('#with-coaches-table th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const currentHeader = document.querySelector(`#with-coaches-table th.sortable[onclick*="${column}"]`);
    if (currentHeader) {
        currentHeader.classList.add(withCoachesSortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    
    console.log(`✅ With Coaches table sorted by ${column} (${withCoachesSortState.direction})`);
}

/**
 * Search Assist Details Table
 */
function searchAssistDetailsTable(searchTerm) {
    if (!window.currentAssistDetailsData || window.currentAssistDetailsData.length === 0) {
        return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    
    // Filter data based on search term
    const filteredData = term === '' 
        ? window.currentAssistDetailsData 
        : window.currentAssistDetailsData.filter(d => 
            d.player.toLowerCase().includes(term)
        );
    
    // Render filtered data
    const tableBody = document.getElementById('assist-details-table').querySelector('tbody');
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999; padding: 2rem;">No players found</td></tr>';
    } else {
        tableBody.innerHTML = filteredData.map(d => `
            <tr>
                <td style="text-align: center; font-weight: 600; color: #2c3e50;">${d.player}</td>
                <td style="text-align: center; font-weight: 700; color: #3b82f6; font-size: 1.2rem;">${d.makeAssist || '-'}</td>
                <td style="text-align: center; font-weight: 700; color: #10b981; font-size: 1.2rem;">${d.takeAssist || '-'}</td>
            </tr>
        `).join('');
    }
    
    console.log(`🔍 Search results: ${filteredData.length} of ${window.currentAssistDetailsData.length} players`);
}

// ============================================================================
// MAIN STATS TAB FUNCTIONS
// ============================================================================

/**
 * Switch between Main Stats sub-tabs
 */
function switchMainStatsSubTab(event, subTabName) {
    // Remove active class from all sub-tabs
    document.querySelectorAll('#main-stats-tab .stats-subtab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all sub-tab contents
    document.querySelectorAll('#main-stats-tab .stats-subtab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to clicked tab
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // Show selected content
    const selectedContent = document.getElementById(`main-stats-${subTabName}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Setup filters for Main Stats (ensure they're always connected)
    setupMainStatsFilters();
    
    // Load data for the selected sub-tab
    if (subTabName === 'championships') {
        loadChampionshipsStats();
    } else if (subTabName === 'seasons') {
        loadSeasonsStats();
    }
}

/**
 * Load Championships Statistics
 */
function loadChampionshipsStats() {
    try {
        console.log('📊 Loading Championships Statistics...');
        
        // Get filter values
        const selectedTeam = document.getElementById('team-filter')?.value || '';
        const selectedSeason = document.getElementById('season-filter')?.value || '';
        const selectedChampion = document.getElementById('champion-filter')?.value || '';
        
        console.log('🔍 Championships Filters:', { selectedTeam, selectedSeason, selectedChampion });
        
        const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
        
        if (!matches || matches.length === 0) {
            document.getElementById('main-stats-championships-table').querySelector('tbody').innerHTML = 
                '<tr><td colspan="10" style="text-align: center; color: #666;">No data available</td></tr>';
            return;
        }
        
        // Apply filters
        let filteredMatches = matches.filter(match => {
            const teamMatch = !selectedTeam || normalizeStr(match.TEAM || '').includes(normalizeStr(selectedTeam));
            const seasonMatch = !selectedSeason || normalizeStr(match.SEASON || '') === normalizeStr(selectedSeason);
            const championMatch = !selectedChampion || normalizeStr(match.CHAMPION || '') === normalizeStr(selectedChampion);
            
            return teamMatch && seasonMatch && championMatch;
        });
        
        console.log(`📊 Filtered matches for championships: ${filteredMatches.length} out of ${matches.length}`);
        
        // Group by Championship
        const championshipStats = {};
        
        filteredMatches.forEach(match => {
            const champion = match.CHAMPION || 'Unknown';
            const result = normalizeStr(match['W-D-L'] || '').toUpperCase();
            const gf = parseInt(match.GF) || 0;
            const ga = parseInt(match.GA) || 0;
            const cs = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
            
            if (!championshipStats[champion]) {
                championshipStats[champion] = {
                    name: champion,
                    P: 0,
                    W: 0,
                    D: 0,
                    L: 0,
                    GF: 0,
                    GA: 0,
                    CSF: 0,
                    CSA: 0
                };
            }
            
            const stats = championshipStats[champion];
            stats.P++;
            stats.GF += gf;
            stats.GA += ga;
            
            // Count results (D includes both D and D.)
            if (result === 'W') {
                stats.W++;
            } else if (result === 'D' || result === 'D.') {
                stats.D++;
            } else if (result === 'L') {
                stats.L++;
            }
            
            // Count clean sheets
            if (cs === 'CSF') {
                stats.CSF++;
            } else if (cs === 'CSA') {
                stats.CSA++;
            }
        });
        
        // Convert to array and sort alphabetically
        const championshipsArray = Object.values(championshipStats).map(stat => ({
            ...stat,
            GD: stat.GF - stat.GA
        })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        
        // Render table
        renderMainStatsTable('championships', championshipsArray);
        
        console.log(`✅ Championships loaded: ${championshipsArray.length} championships`);
        
    } catch (error) {
        console.error('❌ Error in loadChampionshipsStats:', error);
        document.getElementById('main-stats-championships-table').querySelector('tbody').innerHTML = 
            '<tr><td colspan="10" style="text-align: center; color: #ff0000;">Error loading data</td></tr>';
    }
}

/**
 * Load Seasons Statistics
 */
function loadSeasonsStats() {
    try {
        console.log('📅 Loading Seasons Statistics...');
        
        // Get filter values
        const selectedTeam = document.getElementById('team-filter')?.value || '';
        const selectedSeason = document.getElementById('season-filter')?.value || '';
        const selectedChampion = document.getElementById('champion-filter')?.value || '';
        
        console.log('🔍 Seasons Filters:', { selectedTeam, selectedSeason, selectedChampion });
        
        const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
        
        if (!matches || matches.length === 0) {
            document.getElementById('main-stats-seasons-table').querySelector('tbody').innerHTML = 
                '<tr><td colspan="10" style="text-align: center; color: #666;">No data available</td></tr>';
            return;
        }
        
        // Apply filters
        let filteredMatches = matches.filter(match => {
            const teamMatch = !selectedTeam || normalizeStr(match.TEAM || '').includes(normalizeStr(selectedTeam));
            const seasonMatch = !selectedSeason || normalizeStr(match.SEASON || '') === normalizeStr(selectedSeason);
            const championMatch = !selectedChampion || normalizeStr(match.CHAMPION || '') === normalizeStr(selectedChampion);
            
            return teamMatch && seasonMatch && championMatch;
        });
        
        console.log(`📊 Filtered matches for seasons: ${filteredMatches.length} out of ${matches.length}`);
        
        // Group by Season
        const seasonStats = {};
        
        filteredMatches.forEach(match => {
            const season = match.SEASON || 'Unknown';
            const result = normalizeStr(match['W-D-L'] || '').toUpperCase();
            const gf = parseInt(match.GF) || 0;
            const ga = parseInt(match.GA) || 0;
            const cs = normalizeStr(match['CLEAN SHEET'] || '').toUpperCase();
            
            if (!seasonStats[season]) {
                seasonStats[season] = {
                    name: season,
                    P: 0,
                    W: 0,
                    D: 0,
                    L: 0,
                    GF: 0,
                    GA: 0,
                    CSF: 0,
                    CSA: 0
                };
            }
            
            const stats = seasonStats[season];
            stats.P++;
            stats.GF += gf;
            stats.GA += ga;
            
            // Count results (D includes both D and D.)
            if (result === 'W') {
                stats.W++;
            } else if (result === 'D' || result === 'D.') {
                stats.D++;
            } else if (result === 'L') {
                stats.L++;
            }
            
            // Count clean sheets
            if (cs === 'CSF') {
                stats.CSF++;
            } else if (cs === 'CSA') {
                stats.CSA++;
            }
        });
        
        // Convert to array and sort alphabetically first, then by year
        const seasonsArray = Object.values(seasonStats).map(stat => {
            const yearMatch = stat.name.match(/(\d{4})/);
            const year = yearMatch ? parseInt(yearMatch[1]) : 0;
            // Extract season name without year for grouping
            const nameWithoutYear = stat.name.replace(/\d{4}(-\d{2,4})?/g, '').trim();
            
            return {
                ...stat,
                GD: stat.GF - stat.GA,
                year: year,
                nameWithoutYear: nameWithoutYear
            };
        }).sort((a, b) => {
            // First: Sort alphabetically by name (without year)
            const nameCompare = a.nameWithoutYear.localeCompare(b.nameWithoutYear, 'ar');
            if (nameCompare !== 0) {
                return nameCompare;
            }
            // Second: Sort by year (newest to oldest)
            return b.year - a.year;
        });
        
        // Render table
        renderMainStatsTable('seasons', seasonsArray);
        
        console.log(`✅ Seasons loaded: ${seasonsArray.length} seasons`);
        
    } catch (error) {
        console.error('❌ Error in loadSeasonsStats:', error);
        document.getElementById('main-stats-seasons-table').querySelector('tbody').innerHTML = 
            '<tr><td colspan="10" style="text-align: center; color: #ff0000;">Error loading data</td></tr>';
    }
}

/**
 * Extract year from season string for sorting
 */
function extractYearFromSeason(season) {
    const match = season.match(/(\d{4})/);
    return match ? parseInt(match[1]) : 0;
}

/**
 * Render Main Stats Table (Championships or Seasons)
 */
function renderMainStatsTable(type, data) {
    const tableId = type === 'championships' ? 'main-stats-championships-table' : 'main-stats-seasons-table';
    const tableBody = document.getElementById(tableId).querySelector('tbody');
    
    if (!tableBody) return;
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #666;">No data available</td></tr>';
        return;
    }
    
    // Render rows
    tableBody.innerHTML = data.map(stat => `
        <tr>
            <td style="text-align: center; font-weight: 600;">${stat.name}</td>
            <td style="text-align: center;">${stat.P}</td>
            <td style="text-align: center;">${stat.W}</td>
            <td style="text-align: center;">${stat.D}</td>
            <td style="text-align: center;">${stat.L}</td>
            <td style="text-align: center;">${stat.GF}</td>
            <td style="text-align: center;">${stat.GA}</td>
            <td style="text-align: center; ${stat.GD >= 0 ? 'color: #10b981;' : 'color: #ef4444;'} font-weight: 600;">${stat.GD >= 0 ? '+' : ''}${stat.GD}</td>
            <td style="text-align: center;">${stat.CSF}</td>
            <td style="text-align: center;">${stat.CSA}</td>
        </tr>
    `).join('');
    
    // Calculate totals
    const totals = {
        P: data.reduce((sum, s) => sum + s.P, 0),
        W: data.reduce((sum, s) => sum + s.W, 0),
        D: data.reduce((sum, s) => sum + s.D, 0),
        L: data.reduce((sum, s) => sum + s.L, 0),
        GF: data.reduce((sum, s) => sum + s.GF, 0),
        GA: data.reduce((sum, s) => sum + s.GA, 0),
        CSF: data.reduce((sum, s) => sum + s.CSF, 0),
        CSA: data.reduce((sum, s) => sum + s.CSA, 0)
    };
    totals.GD = totals.GF - totals.GA;
    
    // Update footer
    const prefix = type === 'championships' ? 'champ' : 'season';
    document.getElementById(`${prefix}-total-p`).textContent = totals.P;
    document.getElementById(`${prefix}-total-w`).textContent = totals.W;
    document.getElementById(`${prefix}-total-d`).textContent = totals.D;
    document.getElementById(`${prefix}-total-l`).textContent = totals.L;
    document.getElementById(`${prefix}-total-gf`).textContent = totals.GF;
    document.getElementById(`${prefix}-total-ga`).textContent = totals.GA;
    
    const gdEl = document.getElementById(`${prefix}-total-gd`);
    gdEl.textContent = (totals.GD >= 0 ? '+' : '') + totals.GD;
    gdEl.style.color = totals.GD >= 0 ? '#10b981' : '#ef4444';
    
    document.getElementById(`${prefix}-total-csf`).textContent = totals.CSF;
    document.getElementById(`${prefix}-total-csa`).textContent = totals.CSA;
    
    // Store data for sorting
    if (type === 'championships') {
        window.currentChampionshipsData = data;
    } else {
        window.currentSeasonsData = data;
    }
}

/**
 * Sort Main Stats Table
 */
let mainStatsSortState = {
    championships: { column: null, direction: 'desc' },
    seasons: { column: null, direction: 'desc' }
};

function sortMainStatsTable(type, column) {
    const data = type === 'championships' ? window.currentChampionshipsData : window.currentSeasonsData;
    
    if (!data || data.length === 0) {
        console.log('⚠️ No data to sort');
        return;
    }
    
    const state = mainStatsSortState[type];
    
    // Toggle sort direction
    if (state.column === column) {
        state.direction = state.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.column = column;
        state.direction = 'desc';
    }
    
    const sortedData = [...data];
    
    // Sort
    sortedData.sort((a, b) => {
        let valA, valB;
        
        if (column === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            return state.direction === 'asc' 
                ? valA.localeCompare(valB, 'ar') 
                : valB.localeCompare(valA, 'ar');
        } else {
            valA = a[column];
            valB = b[column];
            return state.direction === 'asc' ? valA - valB : valB - valA;
        }
    });
    
    // Re-render with sorted data
    const tableId = type === 'championships' ? 'main-stats-championships-table' : 'main-stats-seasons-table';
    const tableBody = document.getElementById(tableId).querySelector('tbody');
    
    tableBody.innerHTML = sortedData.map(stat => `
        <tr>
            <td style="text-align: center; font-weight: 600;">${stat.name}</td>
            <td style="text-align: center;">${stat.P}</td>
            <td style="text-align: center;">${stat.W}</td>
            <td style="text-align: center;">${stat.D}</td>
            <td style="text-align: center;">${stat.L}</td>
            <td style="text-align: center;">${stat.GF}</td>
            <td style="text-align: center;">${stat.GA}</td>
            <td style="text-align: center; ${stat.GD >= 0 ? 'color: #10b981;' : 'color: #ef4444;'} font-weight: 600;">${stat.GD >= 0 ? '+' : ''}${stat.GD}</td>
            <td style="text-align: center;">${stat.CSF}</td>
            <td style="text-align: center;">${stat.CSA}</td>
        </tr>
    `).join('');
    
    // Update sort indicators
    document.querySelectorAll(`#${tableId} th.sortable`).forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });
    
    const currentHeader = document.querySelector(`#${tableId} th.sortable[onclick*="'${column}'"]`);
    if (currentHeader) {
        currentHeader.classList.add(state.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }
    
    console.log(`✅ ${type} table sorted by ${column} (${state.direction})`);
}

// Re-initialize when page is shown (back/forward cache)
window.addEventListener('pageshow', async function(event) {
    // If the page was restored from bfcache, reload the data
    if (event.persisted) {
        console.log('🔄 Page restored from cache, reloading data...');
        // Try to auto-load cached data again
        await autoLoadCachedExcelData();
    }
});
// ============================================================================
// SEARCH MATCH FUNCTIONALITY
// ============================================================================
// Search for a match by ID
function searchMatchById() {
    const searchInput = document.getElementById('match-id-search');
    const matchId = searchInput.value.trim();
    
    if (!matchId) {
        return;
    }
    
    console.log('Searching for match:', matchId);
    
    // Get match details from MATCHDETAILS sheet
    const matches = getSheetRowsByCandidates(['MATCHDETAILS']);
    const match = matches.find(m => normalizeStr(m.MATCH_ID || m['MATCH ID']).toLowerCase() === matchId.toLowerCase());
    
    const detailsContainer = document.getElementById('match-details-container');
    const noMatchFound = document.getElementById('no-match-found');
    
    if (match) {
        // Display match details
        displayMatchDetails(match);
        displayMatchLineup(matchId);
        displayMatchGoals(matchId);
        displayMatchGoalkeepers(matchId);
        displayMatchPKS(matchId);
        
        detailsContainer.style.display = 'block';
        noMatchFound.style.display = 'none';
        
        // Activate only the first sub-tab content (lineup) and remove active from others
        document.querySelectorAll('#match-details-container .goal-details-tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById('match-lineup-content').classList.add('active');
        
        // Also activate the first tab button
        document.querySelectorAll('#match-details-container .goal-details-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const firstTab = document.querySelector('#match-details-container .goal-details-tab');
        if (firstTab) {
            firstTab.classList.add('active');
        }
    } else {
        detailsContainer.style.display = 'none';
        noMatchFound.style.display = 'block';
    }
}

// Display match header details
function displayMatchDetails(match) {
    const headerContainer = document.getElementById('match-header');
    
    // Format date
    const monthMap = { 0:'Jan', 1:'Feb', 2:'Mar', 3:'Apr', 4:'May', 5:'Jun', 6:'Jul', 7:'Aug', 8:'Sep', 9:'Oct', 10:'Nov', 11:'Dec' };
    let formattedDate = String(match.DATE || '').trim();
    
    if (/^\d+(\.\d+)?$/.test(formattedDate)) {
        const t = new Date((Number(formattedDate) - 25569) * 86400 * 1000);
        if (!isNaN(t.getTime())) {
            const dd = String(t.getDate()).padStart(2, '0');
            const MMM = monthMap[t.getMonth()];
            const yyyy = t.getFullYear();
            formattedDate = `${dd}-${MMM}-${yyyy}`;
        }
    }
    
    const ahlyTeam = match['AHLY TEAM'] || 'Al Ahly';
    const opponentTeam = match['OPPONENT TEAM'] || 'Unknown';
    const ahlyManager = match['AHLY MANAGER'] || match['MANAGER AHLY'] || '';
    const opponentManager = match['OPPONENT MANAGER'] || match['MANAGER OPPONENT'] || '';
    const gf = match.GF || 0;
    const ga = match.GA || 0;
    const penaltyResult = match.PEN || '';
    const season = match.SEASON || '';
    const stadium = match.STAD || '';
    const round = match.ROUND || '';
    const champion = match.CHAMPION || '';
    const han = match['H-A-N'] || '';
    const referee = match.REFREE || match.REFEREE || '';
    
    headerContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 3rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #dc2626; margin: 0;">${ahlyTeam}</h2>
                ${ahlyManager ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${ahlyManager}</p>` : ''}
            </div>
            <div style="text-align: center;">
                <div style="font-size: 3rem; font-weight: 700; color: #333;">
                    ${gf} - ${ga}
                </div>
                ${penaltyResult ? `<div style="font-size: 1.2rem; font-weight: 600; color: #666; margin-top: 0.5rem;">Penalties: ${penaltyResult}</div>` : ''}
            </div>
            <div style="text-align: center; flex: 1;">
                <h2 style="font-size: 2rem; font-weight: 700; color: #3b82f6; margin: 0;">${opponentTeam}</h2>
                ${opponentManager ? `<p style="color: #999; font-size: 0.95rem; margin-top: 0.25rem;">Manager: ${opponentManager}</p>` : ''}
            </div>
        </div>
        <div style="border-top: 2px solid #e5e7eb; padding-top: 1rem; display: flex; flex-wrap: wrap; gap: 1.5rem; justify-content: center; font-size: 0.95rem; color: #666;">
            ${formattedDate ? `<span><strong>Date:</strong> ${formattedDate}</span>` : ''}
            ${season ? `<span><strong>Season:</strong> ${season}</span>` : ''}
            ${stadium ? `<span><strong>Stadium:</strong> ${stadium}</span>` : ''}
            ${han ? `<span><strong>Venue:</strong> ${han}</span>` : ''}
            ${round ? `<span><strong>Round:</strong> ${round}</span>` : ''}
            ${referee ? `<span><strong>Referee:</strong> ${referee}</span>` : ''}
        </div>
    `;
}

// Display match lineup
function displayMatchLineup(matchId) {
    const container = document.getElementById('match-lineup-container');
    const lineupRows = getSheetRowsByCandidates(['LINEUPDETAILS']);
    const playerDetailsRows = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    const matchLineup = lineupRows.filter(l => {
        const mid = normalizeStr(l.MATCH_ID || l['MATCH ID']);
        return mid.toLowerCase() === matchId.toLowerCase();
    });
    
    // Get goals and assists data for this match
    const matchPlayerDetails = playerDetailsRows.filter(p => {
        const mid = normalizeStr(p.MATCH_ID || p['MATCH ID']);
        return mid.toLowerCase() === matchId.toLowerCase();
    });
    
    // Separate Al Ahly goals and assists
    const ahlyGoals = matchPlayerDetails.filter(g => {
        const ga = (g.GA || '').toUpperCase();
        const team = (g.TEAM || '').toLowerCase();
        const isAhly = team.includes('ahly') || team.includes('الأهلي');
        const isGoalOrAssist = ga === 'GOAL' || ga === 'ASSIST';
        return isAhly && isGoalOrAssist;
    });
    
    if (matchLineup.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No lineup data available for this match</p>';
        return;
    }
    
    // Keep original order from sheet (don't sort)
    
    let html = `
        <div class="stats-table-container">
            <table class="stats-table">
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
    
    matchLineup.forEach((player, index) => {
        const playerName = player.PLAYER || player['PLAYER NAME'] || 'Unknown';
        const minutes = player.MINTOTAL || player['MIN TOTAL'] || player.MINUTES || 0;
        const playerOut = player['PLAYER NAME OUT'] || player.PLAYEROUT || '';
        const minOut = player.MINOUT || player['MIN OUT'] || '';
        
        let status = '';
        if (index < 11) {
            // First 11 players are starters
            status = '<span class="badge badge-success">Starting XI</span>';
        } else {
            // Substitutes
            status = `<span class="badge badge-warning">Substitute</span>`;
            if (playerOut) {
                status += `<br><small style="color: #666;">(Replaced ${playerOut} at ${minOut}')</small>`;
            }
        }
        
        // Calculate goals and assists for this player in this match
        const playerGoalRecords = ahlyGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'GOAL');
        const playerAssistRecords = ahlyGoals.filter(goal => goal['PLAYER NAME'] === playerName && goal.GA === 'ASSIST');
        
        // Sum up GATOTAL for multiple goals/assists
        const playerGoals = playerGoalRecords.reduce((total, goal) => total + (goal.GATOTAL || 1), 0);
        const playerAssists = playerAssistRecords.reduce((total, assist) => total + (assist.GATOTAL || 1), 0);
        
        // Create goals display with icon (only show icon if player scored)
        const goalsDisplay = playerGoals > 0 ? 
            `<span style="color: #28a745; font-weight: bold;">${parseInt(playerGoals)} ⚽</span>` : 
            '<span style="color: #999;">-</span>';
        
        // Create assists display with icon (only show icon if player assisted)
        const assistsDisplay = playerAssists > 0 ? 
            `<span style="color: #007bff; font-weight: bold;">${parseInt(playerAssists)} 🏈</span>` : 
            '<span style="color: #999;">-</span>';
        
        // Add substitution arrows and GK indicator
        let playerNameWithArrows = `<strong>${playerName}</strong>`;
        
        // Check if this player is a goalkeeper (first player in lineup is usually GK)
        const isGoalkeeper = index === 0;
        if (isGoalkeeper) {
            playerNameWithArrows += ` <span style="color: #6c757d; font-weight: bold; font-size: 0.9em;" title="Goalkeeper">GK 🧤</span>`;
        }
        
        // Check if this player was substituted out (red arrow down)
        const wasSubstitutedOut = matchLineup.some(p => p['PLAYER NAME OUT'] === playerName);
        if (wasSubstitutedOut) {
            playerNameWithArrows += ` <span style="color: #dc3545; font-size: 1.5em;" title="Substituted Out">↓</span>`;
        }
        
        // Check if this player was substituted in (green arrow up)
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
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// Display match goals
function displayMatchGoals(matchId) {
    const container = document.getElementById('match-goals-container');
    const playerDetails = getSheetRowsByCandidates(['PLAYERDETAILS']);
    
    const matchGoals = playerDetails.filter(p => {
        const mid = normalizeStr(p.MATCH_ID || p['MATCH ID']);
        const ga = normalizeStr(p.GA || '').toUpperCase();
        return mid.toLowerCase() === matchId.toLowerCase() && ga === 'GOAL';
    });
    
    const matchAssists = playerDetails.filter(p => {
        const mid = normalizeStr(p.MATCH_ID || p['MATCH ID']);
        const ga = normalizeStr(p.GA || '').toUpperCase();
        return mid.toLowerCase() === matchId.toLowerCase() && ga === 'ASSIST';
    });
    
    if (matchGoals.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No goals data available for this match</p>';
        return;
    }
    
    // Sort by minute
    matchGoals.sort((a, b) => {
        const minA = parseMinuteForSort(a.MINUTE || '0');
        const minB = parseMinuteForSort(b.MINUTE || '0');
        return minA - minB;
    });
    
    // Group by team (Al Ahly vs Opponent)
    const ahlyGoals = matchGoals.filter(g => {
        const team = normalizeStr(g.TEAM || g['AHLY TEAM'] || '').toLowerCase();
        return team === 'الأهلي' || team === 'al ahly' || team === 'ahly';
    });
    
    const opponentGoals = matchGoals.filter(g => {
        const team = normalizeStr(g.TEAM || g['AHLY TEAM'] || '').toLowerCase();
        return team !== 'الأهلي' && team !== 'al ahly' && team !== 'ahly';
    });
    
    // Helper function to find assist for a goal
    function findAssist(goal) {
        const goalMinute = goal.MINUTE || '';
        const goalPlayer = normalizeStr(goal['PLAYER NAME'] || goal.PLAYER || '').toLowerCase();
        
        // Try to find assist with same minute
        const assist = matchAssists.find(a => {
            const assistMinute = a.MINUTE || '';
            return assistMinute === goalMinute;
        });
        
        return assist ? (assist['PLAYER NAME'] || assist.PLAYER || '') : null;
    }
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Al Ahly Goals
    html += `
        <div>
            <h3 style="color: #dc2626; margin-bottom: 1rem;">Al Ahly Goals (${ahlyGoals.length})</h3>
            <div class="stats-table-container">
                <table class="stats-table">
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
        const minute = goal.MINUTE || '-';
        const player = goal['PLAYER NAME'] || goal.PLAYER || 'Unknown';
        const type = goal.TYPE || 'Regular';
        const assist = findAssist(goal);
        
        html += `
            <tr>
                <td><strong>${minute}'</strong></td>
                <td>
                    <strong>${player}</strong>
                    ${assist ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assist}</div>` : ''}
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
    
    // Opponent Goals
    html += `
        <div>
            <h3 style="color: #3b82f6; margin-bottom: 1rem;">Opponent Goals (${opponentGoals.length})</h3>
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Minute</th>
                            <th>Player</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    opponentGoals.forEach(goal => {
        const minute = goal.MINUTE || '-';
        const player = goal['PLAYER NAME'] || goal.PLAYER || 'Unknown';
        const type = goal.TYPE || 'Regular';
        const assist = findAssist(goal);
        
        html += `
            <tr>
                <td><strong>${minute}'</strong></td>
                <td>
                    <strong>${player}</strong>
                    ${assist ? `<div style="color: #999; font-size: 0.85rem; margin-top: 0.25rem;">↳ Assist: ${assist}</div>` : ''}
                </td>
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
function displayMatchGoalkeepers(matchId) {
    const container = document.getElementById('match-goalkeepers-container');
    const gkDetails = getSheetRowsByCandidates(['GKDETAILS']);
    
    const matchGKs = gkDetails.filter(gk => {
        const mid = normalizeStr(gk.MATCH_ID || gk['MATCH ID']);
        return mid.toLowerCase() === matchId.toLowerCase();
    });
    
    if (matchGKs.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 2rem;">No goalkeeper data available for this match</p>';
        return;
    }
    
    // Group by team (Al Ahly vs Opponent)
    const ahlyGKs = matchGKs.filter(gk => {
        const team = normalizeStr(gk.TEAM || gk['AHLY TEAM'] || '').toLowerCase();
        return team === 'الأهلي' || team === 'al ahly' || team === 'ahly';
    });
    
    const opponentGKs = matchGKs.filter(gk => {
        const team = normalizeStr(gk.TEAM || gk['AHLY TEAM'] || '').toLowerCase();
        return team !== 'الأهلي' && team !== 'al ahly' && team !== 'ahly';
    });
    
    let html = '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">';
    
    // Al Ahly Goalkeepers
    html += `
        <div>
            <h3 style="color: #dc2626; margin-bottom: 1rem;">Al Ahly Goalkeeper</h3>
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Goalkeeper</th>
                            <th>Goals Conceded</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    ahlyGKs.forEach(gk => {
        const gkName = gk['PLAYER NAME'] || gk.PLAYER || 'Unknown';
        const goalsConceded = gk['GOALS CONCEDED'] || 0;
        
        html += `
            <tr>
                <td><strong>${gkName}</strong></td>
                <td>${goalsConceded}</td>
            </tr>
        `;
    });
    
    if (ahlyGKs.length === 0) {
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
            <div class="stats-table-container">
                <table class="stats-table">
                    <thead>
                        <tr>
                            <th>Goalkeeper</th>
                            <th>Goals Conceded</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    opponentGKs.forEach(gk => {
        const gkName = gk['PLAYER NAME'] || gk.PLAYER || 'Unknown';
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

// Display PKS data in the container
function displayPKSData(matchId, pksData) {
    console.log('Displaying PKS data for match:', matchId, 'Data:', pksData);
    const container = document.getElementById('match-pks-container');
    
    if (!container) {
        console.error('PKS container not found');
        return;
    }
    
    if (!pksData || pksData.length === 0) {
        console.log('No PKS data to display');
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; background: #f8f9fa; border-radius: 12px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #6c757d;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h3 style="color: #495057; margin-bottom: 0.5rem;">No PKS Data Found</h3>
                <p style="color: #6c757d;">No penalty shootout data found for match ID: ${matchId}</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="background: #f8f9fa; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
            <h3 style="color: #495057; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M8 12h8"/>
                    <path d="M12 8v8"/>
                </svg>
                Penalty Shootout Data
            </h3>
            <div style="display: grid; gap: 1rem;">
    `;
    
    // Collect goalkeeper statistics
    const goalkeeperStats = {};
    
    pksData.forEach((pks, index) => {
        const ahlyStatus = pks['AHLY STATUS'] || 'Unknown';
        const ahlyPlayer = pks['AHLY PLAYER'] || 'Unknown';
        const ahlyGk = pks['AHLY GK'] || 'Unknown';
        const ahlyHowMiss = pks['HOWMISS AHLY'] || '';
        const opponentStatus = pks['OPPONENT STATUS'] || 'Unknown';
        const opponentPlayer = pks['OPPONENT PLAYER'] || 'Unknown';
        const opponentGk = pks['OPPONENT GK'] || 'Unknown';
        const opponentHowMiss = pks['HOWMISS OPPONENT'] || '';
        const round = pks['ROUND'] || (index + 1);
        
        // Initialize goalkeeper stats
        if (!goalkeeperStats[ahlyGk]) {
            goalkeeperStats[ahlyGk] = { shots: 0, saves: 0 };
        }
        if (!goalkeeperStats[opponentGk]) {
            goalkeeperStats[opponentGk] = { shots: 0, saves: 0 };
        }
        
        // Count shots and saves
        goalkeeperStats[opponentGk].shots++; // Ahly player shoots at opponent GK
        if (ahlyStatus === 'MISS' && ahlyHowMiss.includes('الحارس')) {
            goalkeeperStats[opponentGk].saves++;
        }
        
        goalkeeperStats[ahlyGk].shots++; // Opponent player shoots at Ahly GK
        if (opponentStatus === 'MISS' && opponentHowMiss.includes('الحارس')) {
            goalkeeperStats[ahlyGk].saves++;
        }
        
        const ahlyStatusColor = ahlyStatus === 'GOAL' ? '#28a745' : '#dc3545';
        const opponentStatusColor = opponentStatus === 'GOAL' ? '#28a745' : '#dc3545';
        
        html += `
            <div style="background: white; border-radius: 8px; padding: 1rem; border: 1px solid #dee2e6;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h4 style="color: #495057; margin: 0;">Round ${round}</h4>
                </div>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                    <div style="text-align: right;">
                        <div style="font-weight: 600; color: #495057;">${ahlyPlayer}</div>
                        ${ahlyStatus === 'MISS' && ahlyHowMiss ? `<div style="font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem;">${ahlyHowMiss}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="background: ${ahlyStatusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                            ${ahlyStatus}
                        </span>
                        <span style="color: #6c757d; font-weight: 600;">VS</span>
                        <span style="background: ${opponentStatusColor}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                            ${opponentStatus}
                        </span>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-weight: 600; color: #495057;">${opponentPlayer}</div>
                        ${opponentStatus === 'MISS' && opponentHowMiss ? `<div style="font-size: 0.8rem; color: #dc3545; margin-top: 0.25rem;">${opponentHowMiss}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    // Add goalkeeper statistics section
    html += `
        </div>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem;">
            <h3 style="color: #495057; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
                إحصائيات الحارسين
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
    `;
    
    Object.entries(goalkeeperStats).forEach(([gkName, stats]) => {
        const savePercentage = stats.shots > 0 ? ((stats.saves / stats.shots) * 100).toFixed(1) : '0.0';
        html += `
            <div style="background: white; border-radius: 8px; padding: 1rem; border: 1px solid #dee2e6;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; text-align: center;">
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #007bff;">${stats.shots}</div>
                        <div style="font-size: 0.8rem; color: #6c757d;">الكور</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #28a745;">${stats.saves}</div>
                        <div style="font-size: 0.8rem; color: #6c757d;">التصديات</div>
                    </div>
                    <div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #ffc107;">${savePercentage}%</div>
                        <div style="font-size: 0.8rem; color: #6c757d;">النسبة</div>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e9ecef;">
                    <span style="font-weight: 600; color: #495057; font-size: 0.9rem;">${gkName}</span>
                </div>
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// Display match PKS data
async function displayMatchPKS(matchId) {
    console.log('Displaying PKS for match:', matchId);
    const container = document.getElementById('match-pks-container');
    
    if (!container) {
        console.error('PKS container not found');
        return;
    }
    
    try {
        console.log('Fetching PKS data from API...');
        // Fetch PKS data from API
        const response = await fetch(`/api/ahly-stats/pks-data?match_id=${encodeURIComponent(matchId)}`);
        const pksData = await response.json();
        
        console.log('PKS API response:', response.status, pksData);
        
        if (response.ok && pksData && pksData.length > 0) {
            displayPKSData(matchId, pksData);
        } else {
            console.log('No PKS data found for match:', matchId);
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; background: #f8f9fa; border-radius: 12px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #6c757d;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3 style="color: #495057; margin-bottom: 0.5rem;">No PKS Data Found</h3>
                    <p style="color: #6c757d;">No penalty shootout data found for match ID: ${matchId}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading PKS data for match:', matchId, error);
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; background: #f8f9fa; border-radius: 12px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 64px; height: 64px; margin: 0 auto 1rem; color: #dc3545;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <h3 style="color: #dc3545; margin-bottom: 0.5rem;">Error Loading PKS Data</h3>
                <p style="color: #6c757d;">Failed to load penalty shootout data for match ID: ${matchId}</p>
                <p style="color: #6c757d; font-size: 0.9rem; margin-top: 0.5rem;">Error: ${error.message}</p>
            </div>
        `;
    }
}

// Show match sub-tab
function showMatchSubTab(event, tabName) {
    // Remove active class from all match sub-tabs
    document.querySelectorAll('#match-details-container .goal-details-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all match sub-tab contents
    document.querySelectorAll('#match-details-container .goal-details-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Add active class to selected tab
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // Show selected content
    const selectedContent = document.getElementById(`match-${tabName}-content`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Load data based on selected tab
    const matchIdInput = document.getElementById('match-id-search');
    if (matchIdInput && matchIdInput.value.trim()) {
        const matchId = matchIdInput.value.trim();
        console.log('Loading data for match ID:', matchId, 'in tab:', tabName);
        
        // Check if data is available
        if (!window.__ahlySheetsJson || Object.keys(window.__ahlySheetsJson).length === 0) {
            console.warn('No data available for tab loading');
            return;
        }
        
        if (tabName === 'lineup') {
            console.log('Loading lineup data...');
            displayMatchLineup(matchId);
        } else if (tabName === 'goals') {
            console.log('Loading goals data...');
            displayMatchGoals(matchId);
        } else if (tabName === 'goalkeepers') {
            console.log('Loading goalkeepers data...');
            displayMatchGoalkeepers(matchId);
        } else if (tabName === 'pks') {
            console.log('Loading PKS data...');
            displayMatchPKS(matchId);
        }
    } else {
        console.warn('No match ID found for tab loading');
    }
}


// Show consecutive G+A streak
function showConsecutiveGAStreak() {
    console.log('Showing consecutive G+A streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive G+A streak in popup
    loadConsecutiveGAStreak();
    showStreakPopup('Consecutive G+A Streak', 'consecutive-ga-streak-data');
}

// Show consecutive no G+A streak
function showConsecutiveNoGAStreak() {
    console.log('Showing consecutive no G+A streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive no G+A streak in popup
    loadConsecutiveNoGAStreak();
    showStreakPopup('Consecutive No G+A Streak', 'consecutive-no-ga-streak-data');
}

// Show consecutive scoring streak
function showConsecutiveScoringStreak() {
    console.log('Showing consecutive scoring streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive scoring streak in popup
    loadConsecutiveScoringStreak();
    showStreakPopup('Consecutive Scoring Streak', 'consecutive-scoring-streak-data');
}
// Show consecutive no-goal streak
function showConsecutiveNoGoalStreak() {
    console.log('Showing consecutive no-goal streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive no-goal streak in popup
    loadConsecutiveNoGoalStreak();
    showStreakPopup('Consecutive No-Goal Streak', 'consecutive-no-goal-streak-data');
}

// Load consecutive G+A streak
function loadConsecutiveGAStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive G+A streak
    const streak = findLongestConsecutiveGAStreak(allMatches);
    
    console.log(`Found consecutive G+A streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveGAStreakTable(streak);
}

// Load consecutive no G+A streak
function loadConsecutiveNoGAStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive no G+A streak
    const streak = findLongestConsecutiveNoGAStreak(allMatches);
    
    console.log(`Found consecutive no G+A streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveNoGAStreakTable(streak);
}

// Load consecutive scoring streak
function loadConsecutiveScoringStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive scoring streak
    const streak = findLongestConsecutiveScoringStreak(allMatches);
    
    console.log(`Found consecutive scoring streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveScoringStreakTable(streak);
}

// Load consecutive no-goal streak
function loadConsecutiveNoGoalStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive no-goal streak
    const streak = findLongestConsecutiveNoGoalStreak(allMatches);
    
    console.log(`Found consecutive no-goal streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveNoGoalStreakTable(streak);
}

// Find longest consecutive G+A streak
function findLongestConsecutiveGAStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.goals > 0 || match.assists > 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest G+A streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Find longest consecutive no G+A streak
function findLongestConsecutiveNoGAStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.goals === 0 && match.assists === 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest no G+A streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Find longest consecutive scoring streak
function findLongestConsecutiveScoringStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.goals > 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest scoring streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Find longest consecutive no-goal streak
function findLongestConsecutiveNoGoalStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.goals === 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest no-goal streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Find longest consecutive assist streak
function findLongestConsecutiveAssistStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.assists > 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest assist streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Find longest consecutive no-assist streak
function findLongestConsecutiveNoAssistStreak(matches) {
    if (!matches || matches.length === 0) return [];
    
    // Sort matches by date (oldest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }
    
    const sortedMatches = [...matches].sort((a, b) => parseSheetDate(a.date) - parseSheetDate(b.date));
    
    let longestStreak = [];
    let currentStreak = [];
    
    for (const match of sortedMatches) {
        if (match.assists === 0) {
            currentStreak.push(match);
        } else {
            if (currentStreak.length > longestStreak.length) {
                longestStreak = [...currentStreak];
            }
            currentStreak = [];
        }
    }
    
    // Check if the last streak is the longest
    if (currentStreak.length > longestStreak.length) {
        longestStreak = [...currentStreak];
    }
    
    console.log(`Longest no-assist streak: ${longestStreak.length} matches`);
    console.log('Streak matches:', longestStreak.map(m => ({ date: m.date, opponent: m.opponent, goals: m.goals, assists: m.assists })));
    
    return longestStreak;
}

// Show consecutive assist streak
function showConsecutiveAssistStreak() {
    console.log('Showing consecutive assist streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive assist streak in popup
    loadConsecutiveAssistStreak();
    showStreakPopup('Consecutive Assist Streak', 'consecutive-assist-streak-data');
}

// Show consecutive no-assist streak
function showConsecutiveNoAssistStreak() {
    console.log('Showing consecutive no-assist streak');
    
    // Check if player is selected
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    if (!selectedPlayer) {
        alert('Please select a player first');
        return;
    }
    
    // Load and display consecutive no-assist streak in popup
    loadConsecutiveNoAssistStreak();
    showStreakPopup('Consecutive No-Assist Streak', 'consecutive-no-assist-streak-data');
}

// Load consecutive assist streak
function loadConsecutiveAssistStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive assist streak
    const streak = findLongestConsecutiveAssistStreak(allMatches);
    
    console.log(`Found consecutive assist streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveAssistStreakTable(streak);
}

// Load consecutive no-assist streak
function loadConsecutiveNoAssistStreak() {
    const selectedPlayer = document.getElementById('player-search') ? document.getElementById('player-search').value.trim() : '';
    const teamFilter = document.getElementById('player-team-filter') ? document.getElementById('player-team-filter').value : '';
    
    if (!selectedPlayer) {
        console.log('No player selected');
        return;
    }
    
    // Get applied filters
    const appliedFilters = getCurrentFilters();
    
    // Get all player matches
    const allMatches = getPlayerMatchesFromSheets(selectedPlayer, teamFilter, appliedFilters);
    
    // Find the longest consecutive no-assist streak
    const streak = findLongestConsecutiveNoAssistStreak(allMatches);
    
    console.log(`Found consecutive no-assist streak of ${streak.length} matches for ${selectedPlayer}`);
    console.log('Streak matches:', streak);
    
    // Store streak data globally for popup
    window.currentStreakData = streak;
    
    // Render the table
    renderConsecutiveNoAssistStreakTable(streak);
}

// Render consecutive assist streak table
function renderConsecutiveAssistStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-assist-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No consecutive assist streak found</td></tr>';
        return;
    }
    
    matches.forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${match.DATE || ''}</td>
            <td>${match.OPPONENT || ''}</td>
            <td>${match.ASSISTS || 0}</td>
            <td>${match.GOALS || 0}</td>
            <td>${match.MINUTES || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Render consecutive no-assist streak table
function renderConsecutiveNoAssistStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-no-assist-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No consecutive no-assist streak found</td></tr>';
        return;
    }
    
    matches.forEach(match => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${match.DATE || ''}</td>
            <td>${match.OPPONENT || ''}</td>
            <td>${match.ASSISTS || 0}</td>
            <td>${match.GOALS || 0}</td>
            <td>${match.MINUTES || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Render consecutive G+A streak table
function renderConsecutiveGAStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-ga-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No consecutive G+A streak found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }

    function formatSheetDateDisplay(s) {
        if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
            const t = new Date((Number(s) - 25569) * 86400 * 1000);
            if (!isNaN(t.getTime())) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = Object.keys(monthMap)[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        return String(s || '').trim() || 'N/A';
    }
    
    const sorted = [...matches].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
    
    sorted.forEach(m => {
        const date = formatSheetDateDisplay(m.date);
        const season = m.season || 'N/A';
        const opponent = m.opponent || 'N/A';
        const minutes = m.minutes || 0;
        const goals = m.goals || 0;
        const assists = m.assists || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${season}</td>
            <td>${opponent}</td>
            <td>${minutes}</td>
            <td class="${goals > 0 ? 'highlight-value' : ''}">${goals}</td>
            <td class="${assists > 0 ? 'highlight-value' : ''}">${assists}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render consecutive no G+A streak table
function renderConsecutiveNoGAStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-no-ga-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No consecutive no G+A streak found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }

    function formatSheetDateDisplay(s) {
        if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
            const t = new Date((Number(s) - 25569) * 86400 * 1000);
            if (!isNaN(t.getTime())) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = Object.keys(monthMap)[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        return String(s || '').trim() || 'N/A';
    }
    
    const sorted = [...matches].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
    
    sorted.forEach(m => {
        const date = formatSheetDateDisplay(m.date);
        const season = m.season || 'N/A';
        const opponent = m.opponent || 'N/A';
        const minutes = m.minutes || 0;
        const goals = m.goals || 0;
        const assists = m.assists || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${season}</td>
            <td>${opponent}</td>
            <td>${minutes}</td>
            <td class="${goals > 0 ? 'highlight-value' : ''}">${goals}</td>
            <td class="${assists > 0 ? 'highlight-value' : ''}">${assists}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Render consecutive scoring streak table
function renderConsecutiveScoringStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-scoring-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">No consecutive scoring streak found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }

    function formatSheetDateDisplay(s) {
        if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
            const t = new Date((Number(s) - 25569) * 86400 * 1000);
            if (!isNaN(t.getTime())) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = Object.keys(monthMap)[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        return String(s || '').trim() || 'N/A';
    }
    
    const sorted = [...matches].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
    
    sorted.forEach(m => {
        const date = formatSheetDateDisplay(m.date);
        const season = m.season || 'N/A';
        const opponent = m.opponent || 'N/A';
        const minutes = m.minutes || 0;
        const goals = m.goals || 0;
        const assists = m.assists || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${season}</td>
            <td>${opponent}</td>
            <td>${minutes}</td>
            <td class="${goals > 0 ? 'highlight-value' : ''}">${goals}</td>
            <td class="${assists > 0 ? 'highlight-value' : ''}">${assists}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Show streak popup with table
function showStreakPopup(title, tableId) {
    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.id = 'streak-popup-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    `;
    
    // Create popup content
    const popup = document.createElement('div');
    popup.style.cssText = `
        background: white;
        border-radius: 15px;
        padding: 2rem;
        max-width: 90%;
        max-height: 90%;
        width: 1000px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        position: relative;
        overflow: auto;
    `;
    
    // Create close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        position: absolute;
        top: 15px;
        right: 20px;
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: #666;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.3s ease;
    `;
    
    closeBtn.onmouseover = () => {
        closeBtn.style.background = '#f0f0f0';
        closeBtn.style.color = '#333';
    };
    
    closeBtn.onmouseout = () => {
        closeBtn.style.background = 'none';
        closeBtn.style.color = '#666';
    };
    
    closeBtn.onclick = () => {
        document.body.removeChild(overlay);
    };
    
    // Create title with streak count
    const streakData = window.currentStreakData || [];
    const titleElement = document.createElement('h2');
    titleElement.innerHTML = `${title} <span style="color: #667eea; font-size: 1.2rem;">(${streakData.length} matches)</span>`;
    titleElement.style.cssText = `
        margin: 0 0 1.5rem 0;
        color: #333;
        font-size: 1.8rem;
        font-weight: 600;
        text-align: center;
        padding-right: 50px;
    `;
    
    // Create table dynamically with streak data
    const table = document.createElement('table');
    table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        margin: 0;
    `;
    
    // Determine column headers based on table type
    let lastColumnHeader = 'GOALS';
    if (tableId.includes('assist')) {
        lastColumnHeader = 'ASSISTS';
    } else if (tableId.includes('ga')) {
        lastColumnHeader = 'GOALS & ASSISTS';
    }
    
    // Create table header
    const thead = document.createElement('thead');
    if (tableId.includes('ga')) {
        // For G+A tables, show both GOALS and ASSISTS columns
        thead.innerHTML = `
            <tr>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">DATE</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">SEASON</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">OPPONENT TEAM</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">MINUTES</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">GOALS</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">ASSISTS</th>
            </tr>
        `;
    } else {
        // For single column tables (goals or assists)
        thead.innerHTML = `
            <tr>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">DATE</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">SEASON</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">OPPONENT TEAM</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">MINUTES</th>
                <th style="background: #f8f9fa; padding: 1rem; text-align: center; border-bottom: 2px solid #dee2e6; font-weight: 600; color: #333;">${lastColumnHeader}</th>
            </tr>
        `;
    }
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    if (streakData.length === 0) {
        const colspan = tableId.includes('ga') ? '6' : '5';
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="padding: 2rem; text-align: center; color: #999;">No streak data found</td></tr>`;
    } else {
        // Sort by date (newest first)
        const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
        function parseSheetDate(s) {
            const str = String(s || '').trim();
            const d1 = Date.parse(str);
            if (!isNaN(d1)) return d1;
            const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
            if (m) {
                const day = parseInt(m[1], 10);
                const mon = monthMap[m[2].slice(0,3)];
                const yr = parseInt(m[3], 10);
                if (mon != null) {
                    return new Date(yr, mon, day).getTime();
                }
            }
            const num = Number(str);
            if (!isNaN(num) && str !== '') {
                return new Date((num - 25569) * 86400 * 1000).getTime();
            }
            return 0;
        }

        function formatSheetDateDisplay(s) {
            if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
                const t = new Date((Number(s) - 25569) * 86400 * 1000);
                if (!isNaN(t.getTime())) {
                    const dd = String(t.getDate()).padStart(2, '0');
                    const MMM = Object.keys(monthMap)[t.getMonth()];
                    const yyyy = t.getFullYear();
                    return `${dd}-${MMM}-${yyyy}`;
                }
            }
            return String(s || '').trim() || 'N/A';
        }
        
        const sorted = [...streakData].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
        
        sorted.forEach(m => {
            const date = formatSheetDateDisplay(m.date);
            const season = m.season || 'N/A';
            const opponent = m.opponent || 'N/A';
            const minutes = m.minutes || 0;
            const goals = m.goals || 0;
            const assists = m.assists || 0;
            
            const row = document.createElement('tr');
            
            if (tableId.includes('ga')) {
                // For G+A tables, show both goals and assists
                row.innerHTML = `
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${date}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${season}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${opponent}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${minutes}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee; ${goals > 0 ? 'color: #dc2626; font-weight: 700; font-size: 1.2em;' : ''}">${goals}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee; ${assists > 0 ? 'color: #dc2626; font-weight: 700; font-size: 1.2em;' : ''}">${assists}</td>
                `;
            } else if (tableId.includes('assist')) {
                // For assist tables, show assists only
                row.innerHTML = `
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${date}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${season}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${opponent}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${minutes}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee; ${assists > 0 ? 'color: #dc2626; font-weight: 700; font-size: 1.2em;' : ''}">${assists}</td>
                `;
            } else {
                // For goal tables, show goals only
                row.innerHTML = `
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${date}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${season}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${opponent}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee;">${minutes}</td>
                    <td style="padding: 0.75rem; text-align: center; border-bottom: 1px solid #eee; ${goals > 0 ? 'color: #dc2626; font-weight: 700; font-size: 1.2em;' : ''}">${goals}</td>
                `;
            }
            
            // Add hover effect
            row.onmouseover = () => {
                row.style.background = '#f8f9fa';
            };
            row.onmouseout = () => {
                row.style.background = 'white';
            };
            
            tbody.appendChild(row);
        });
    }
    
    table.appendChild(thead);
    table.appendChild(tbody);
    
    // Assemble popup
    popup.appendChild(closeBtn);
    popup.appendChild(titleElement);
    popup.appendChild(table);
    overlay.appendChild(popup);
    
    // Add to page
    document.body.appendChild(overlay);
    
    // Close on overlay click
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            document.body.removeChild(overlay);
        }
    };
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Render consecutive no-goal streak table
function renderConsecutiveNoGoalStreakTable(matches) {
    const tbody = document.querySelector('#consecutive-no-goal-streak-data tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!matches || matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">No consecutive no-goal streak found</td></tr>';
        return;
    }
    
    // Sort by date (newest first)
    const monthMap = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
    function parseSheetDate(s) {
        const str = String(s || '').trim();
        const d1 = Date.parse(str);
        if (!isNaN(d1)) return d1;
        const m = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
        if (m) {
            const day = parseInt(m[1], 10);
            const mon = monthMap[m[2].slice(0,3)];
            const yr = parseInt(m[3], 10);
            if (mon != null) {
                return new Date(yr, mon, day).getTime();
            }
        }
        const num = Number(str);
        if (!isNaN(num) && str !== '') {
            return new Date((num - 25569) * 86400 * 1000).getTime();
        }
        return 0;
    }

    function formatSheetDateDisplay(s) {
        if (typeof s === 'number' || (/^\d+(\.\d+)?$/.test(String(s).trim()))) {
            const t = new Date((Number(s) - 25569) * 86400 * 1000);
            if (!isNaN(t.getTime())) {
                const dd = String(t.getDate()).padStart(2, '0');
                const MMM = Object.keys(monthMap)[t.getMonth()];
                const yyyy = t.getFullYear();
                return `${dd}-${MMM}-${yyyy}`;
            }
        }
        return String(s || '').trim() || 'N/A';
    }
    
    const sorted = [...matches].sort((a, b) => parseSheetDate(b.date) - parseSheetDate(a.date));
    
    sorted.forEach(m => {
        const date = formatSheetDateDisplay(m.date);
        const season = m.season || 'N/A';
        const opponent = m.opponent || 'N/A';
        const minutes = m.minutes || 0;
        const goals = m.goals || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${season}</td>
            <td>${opponent}</td>
            <td>${minutes}</td>
            <td>${goals}</td>
        `;
        tbody.appendChild(tr);
    });
}