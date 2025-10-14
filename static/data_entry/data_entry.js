// ============================================================================
// DATA ENTRY MODULE - JAVASCRIPT FUNCTIONS
// ============================================================================

// ============================================================================
// DATA ENTRY SPECIFIC FUNCTIONS
// ============================================================================

// Tab switching functionality for data entry
function switchDataEntryTab(element, tabId) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.subtab').forEach(tab => tab.classList.remove('active'));
    
    // Add active class to clicked tab
    element.classList.add('active');
    
    // Redirect to the appropriate tab
    const tabUrls = {
        'ahly-match': '/ahly-match',
        'ahly-lineup': '/ahly-lineup',
        'ahly-pks': '/ahly-pks',
        'egypt-match': '/egypt-match',
        'egypt-lineup': '/egypt-lineup'
    };
    
    if (tabUrls[tabId]) {
        window.location.href = tabUrls[tabId];
    }
}

// Data entry specific form handling
function handleDataEntryForm(formType) {
    const form = document.querySelector('form');
    if (!form) {
        // No form found
        return;
    }
    
    switch(formType) {
        case 'ahly_match':
            handleAhlyMatchForm();
            break;
        case 'ahly_lineup':
            handleAhlyLineupForm();
            break;
        case 'ahly_pks':
            handleAhlyPKSForm();
            break;
        case 'egypt_match':
            handleEgyptMatchForm();
            break;
        case 'egypt_lineup':
            handleEgyptLineupForm();
            break;
        default:
            handleGenericForm();
    }
}

// Ahly Match specific form handling
function handleAhlyMatchForm() {
    // Validate required fields
    const requiredFields = ['match_id', 'date', 'champion', 'season'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value.trim()) {
            missingFields.push(field);
        }
    });
    
    if (missingFields.length > 0) {
        // Please fill in required fields
        return;
    }
    
    // Submit form
    const form = document.querySelector('form');
    form.submit();
}

// Ahly Lineup specific form handling
function handleAhlyLineupForm() {
    // Validate at least one player is entered
    const playerRows = document.querySelectorAll('#players-container .player-row');
    let hasPlayers = false;
    
    playerRows.forEach(row => {
        const playerName = row.querySelector('input[name*="_name"]');
        if (playerName && playerName.value.trim()) {
            hasPlayers = true;
        }
    });
    
    if (!hasPlayers) {
        showFlashMessage('Please enter at least one player', 'error');
        return;
    }
    
    // Submit form
    const form = document.querySelector('form');
    form.submit();
}

// Ahly PKS specific form handling
function handleAhlyPKSForm() {
    // Validate PKS form
    const requiredFields = ['match_id', 'champion', 'season'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value.trim()) {
            missingFields.push(field);
        }
    });
    
    if (missingFields.length > 0) {
        // Please fill in required fields
        return;
    }
    
    // Use API call for PKS
    savePKSData();
}

// Egypt Match specific form handling
function handleEgyptMatchForm() {
    // Validate required fields
    const requiredFields = ['date', 'champion', 'season'];
    const missingFields = [];
    
    requiredFields.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value.trim()) {
            missingFields.push(field);
        }
    });
    
    if (missingFields.length > 0) {
        // Please fill in required fields
        return;
    }
    
    // Submit form
    const form = document.querySelector('form');
    form.submit();
}

// Egypt Lineup specific form handling
function handleEgyptLineupForm() {
    // Validate at least one player is entered
    const playerRows = document.querySelectorAll('#egypt-players-container .player-row');
    let hasPlayers = false;
    
    playerRows.forEach(row => {
        const playerName = row.querySelector('input[name*="_name"]');
        if (playerName && playerName.value.trim()) {
            hasPlayers = true;
        }
    });
    
    if (!hasPlayers) {
        showFlashMessage('Please enter at least one player', 'error');
        return;
    }
    
    // Submit form
    const form = document.querySelector('form');
    form.submit();
}

// Generic form handling
function handleGenericForm() {
    const form = document.querySelector('form');
    if (form) {
        form.submit();
    }
}

// Data entry specific export functions
function exportDataEntryData(dataType) {
    switch(dataType) {
        case 'ahly_match':
            exportAhlyMatchData();
            break;
        case 'ahly_lineup':
            exportAhlyLineupData();
            break;
        case 'ahly_pks':
            exportAhlyPKSData();
            break;
        case 'egypt_match':
            exportEgyptMatchData();
            break;
        case 'egypt_lineup':
            exportEgyptLineupData();
            break;
        default:
            exportCurrentData();
    }
}

// Export Ahly Match data
function exportAhlyMatchData() {
    const form = document.querySelector('form');
    if (form) {
        form.action = '/export_form/ahly_match';
        form.method = 'POST';
        form.submit();
    }
}

// Export Ahly Lineup data
function exportAhlyLineupData() {
    exportLineupData('ahly_lineup');
}

// Export Ahly PKS data
function exportAhlyPKSData() {
    createPKSExcelFromData();
}

// Export Egypt Match data
function exportEgyptMatchData() {
    const form = document.querySelector('form');
    if (form) {
        form.action = '/export_form/egypt_match';
        form.method = 'POST';
        form.submit();
    }
}

// Export Egypt Lineup data
function exportEgyptLineupData() {
    exportLineupData('egypt_lineup');
}

// Data entry validation helpers
function validateDataEntryForm(formType) {
    const validationRules = {
        'ahly_match': {
            required: ['match_id', 'date', 'champion', 'season'],
            custom: validateAhlyMatchData
        },
        'ahly_lineup': {
            required: ['match_date', 'match_id'],
            custom: validateLineupData
        },
        'ahly_pks': {
            required: ['match_id', 'champion', 'season'],
            custom: validatePKSData
        },
        'egypt_match': {
            required: ['date', 'champion', 'season'],
            custom: validateEgyptMatchData
        },
        'egypt_lineup': {
            required: ['match_date', 'match_id'],
            custom: validateLineupData
        }
    };
    
    const rules = validationRules[formType];
    if (!rules) return true;
    
    // Check required fields
    const missingFields = [];
    rules.required.forEach(field => {
        const input = document.querySelector(`[name="${field}"]`);
        if (!input || !input.value.trim()) {
            missingFields.push(field);
        }
    });
    
    if (missingFields.length > 0) {
        // Please fill in required fields
        return false;
    }
    
    // Run custom validation
    if (rules.custom && !rules.custom()) {
        return false;
    }
    
    return true;
}

// Custom validation functions
function validateAhlyMatchData() {
    // Validate goals are numeric
    const gf = document.querySelector('[name="gf"]');
    const ga = document.querySelector('[name="ga"]');
    
    if (gf && gf.value && isNaN(gf.value)) {
        // Goals For must be a number
        return false;
    }
    
    if (ga && ga.value && isNaN(ga.value)) {
        // Goals Against must be a number
        return false;
    }
    
    return true;
}

function validateLineupData() {
    // Validate at least one player is entered
    const playerRows = document.querySelectorAll('.player-row');
    let hasPlayers = false;
    
    playerRows.forEach(row => {
        const playerName = row.querySelector('input[name*="_name"]');
        if (playerName && playerName.value.trim()) {
            hasPlayers = true;
        }
    });
    
    if (!hasPlayers) {
        // Please enter at least one player
        return false;
    }
    
    return true;
}

function validatePKSData() {
    // Validate at least one player for each team
    const ahlyPlayers = document.querySelectorAll('#ahly-players-container .pks-player-row');
    const opponentPlayers = document.querySelectorAll('#opponent-players-container .pks-player-row');
    
    let hasAhlyPlayers = false;
    let hasOpponentPlayers = false;
    
    ahlyPlayers.forEach(row => {
        const playerName = row.querySelector('input[name*="_player_name"]');
        if (playerName && playerName.value.trim()) {
            hasAhlyPlayers = true;
        }
    });
    
    opponentPlayers.forEach(row => {
        const playerName = row.querySelector('input[name*="_player_name"]');
        if (playerName && playerName.value.trim()) {
            hasOpponentPlayers = true;
        }
    });
    
    if (!hasAhlyPlayers) {
        // Please enter at least one Ahly player
        return false;
    }
    
    if (!hasOpponentPlayers) {
        // Please enter at least one opponent player
        return false;
    }
    
    return true;
}

function validateEgyptMatchData() {
    // Validate scores are numeric
    const gf = document.querySelector('[name="gf"]');
    const ga = document.querySelector('[name="ga"]');
    
    if (gf && gf.value && isNaN(gf.value)) {
        // Goals For must be a number
        return false;
    }
    
    if (ga && ga.value && isNaN(ga.value)) {
        // Goals Against must be a number
        return false;
    }
    
    return true;
}

// Data entry initialization
function initializeDataEntry() {
    console.log('Data Entry Module Initialized');
    
    // Add event listeners for data entry specific functionality
    const dataEntryTabs = document.querySelectorAll('.subtab');
    dataEntryTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            const tabId = this.getAttribute('href').replace('#', '');
            switchDataEntryTab(this, tabId);
        });
    });
    
    // Initialize form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const dataType = form.querySelector('input[name="data_type"]')?.value;
            if (dataType && !validateDataEntryForm(dataType)) {
                e.preventDefault();
                return false;
            }
        });
    });
}

// Export functions for global access
window.switchDataEntryTab = switchDataEntryTab;
window.handleDataEntryForm = handleDataEntryForm;
window.exportDataEntryData = exportDataEntryData;
window.validateDataEntryForm = validateDataEntryForm;
window.initializeDataEntry = initializeDataEntry;
