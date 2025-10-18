import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'
    
    # Google Sheets Configuration
    GOOGLE_CREDENTIALS_FILE = os.environ.get('GOOGLE_CREDENTIALS_FILE', 'credentials/ahlymatch.json')
    GOOGLE_CREDENTIALS_JSON = os.environ.get('GOOGLE_CREDENTIALS_JSON')
    
    # Separate credentials for different data types
    GOOGLE_CREDENTIALS_JSON_AHLY_MATCH = os.environ.get('GOOGLE_CREDENTIALS_JSON_AHLY_MATCH')
    GOOGLE_CREDENTIALS_JSON_AHLY_FINALS = os.environ.get('GOOGLE_CREDENTIALS_JSON_AHLY_FINALS')
    GOOGLE_CREDENTIALS_JSON_AHLY_PKS = os.environ.get('GOOGLE_CREDENTIALS_JSON_AHLY_PKS')
    GOOGLE_CREDENTIALS_JSON_EGYPT_TEAMS = os.environ.get('GOOGLE_CREDENTIALS_JSON_EGYPT_TEAMS')
    
    # Google Apps Script URL for AHLY LINEUP
    GOOGLE_APPS_SCRIPT_URL = os.environ.get('GOOGLE_APPS_SCRIPT_URL', 'https://script.google.com/macros/s/AKfycbyfzKiAiltr3iCm5CclY4XFsZ2LG8_g_3aTy6gB2pERopyQ8wgOLZgmOLhSaNcqhxRQ/exec')
    
    # Google Apps Script URL for AHLY PKs
    GOOGLE_APPS_SCRIPT_PKS_URL = os.environ.get('GOOGLE_APPS_SCRIPT_PKS_URL', 'https://script.google.com/macros/s/AKfycbwZSSm87FRLr4Pez8-CiSZ_cN1Q5JQKBkw-oNOEQeNGvedNM77z19CFspt_xJMADXU/exec')
    
    # Sheet IDs for different match types
    SHEET_IDS = {
        'ahly_match': os.environ.get('AHLY_MATCH_SHEET_ID', '1zeSlEN7VS2S6KPZH7_uvQeeY3Iu5INUyi12V0_Wi9G4'),
        'ahly_lineup': os.environ.get('AHLY_LINEUP_SHEET_ID', '1xNBqgK5q5GRAfMn-teH64WFLvGNVtBXppxLgzWi8GeY'),
        'ahly_goals_assists': os.environ.get('AHLY_GOALS_ASSISTS_SHEET_ID', '1zeSlEN7VS2S6KPZH7_uvQeeY3Iu5INUyi12V0_Wi9G4'),
        'ahly_gks': os.environ.get('AHLY_GKS_SHEET_ID', '1zeSlEN7VS2S6KPZH7_uvQeeY3Iu5INUyi12V0_Wi9G4'),
        'ahly_howpenmissed': os.environ.get('AHLY_HOWPENMISSED_SHEET_ID', '1zeSlEN7VS2S6KPZH7_uvQeeY3Iu5INUyi12V0_Wi9G4'),
        'egypt_match': os.environ.get('EGYPT_MATCH_SHEET_ID', '10PbAfoH9eqr4F82EBtO281RO42DgRzUzRv-dtELRDn8'),
        'egypt_lineup': os.environ.get('EGYPT_LINEUP_SHEET_ID', '10PbAfoH9eqr4F82EBtO281RO42DgRzUzRv-dtELRDn8'),
        # Youth Egypt Teams (same sheet as Egypt Teams but different worksheets)
        'youth_egypt': os.environ.get('EGYPT_MATCH_SHEET_ID', '10PbAfoH9eqr4F82EBtO281RO42DgRzUzRv-dtELRDn8'),
        # Egyptian Clubs (accessed via Apps Script, not direct API)
        'egyptian_clubs': '10UA-7awu0E_WBbxehNznng83MIUMVLCmpspvvkS1hTU'
    }
    
    # Worksheet names for different data types
    WORKSHEET_NAMES = {
        'ahly_match': 'MATCHDETAILS',
        'ahly_lineup': 'Ahly Lineups',
        'ahly_goals_assists': 'PLAYERDETAILS',
        'ahly_gks': 'GKDETAILS',
        'ahly_howpenmissed': 'HOWPENMISSED',
        'egypt_match': 'MATCHDETAILS',
        'egypt_lineup': 'LINEUPDETAILS',
        'youth_egypt': 'YouthMATCHDETAILS'
    }
