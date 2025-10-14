# -*- coding: utf-8 -*-
"""
Google Sheets Auto-Sync Service for Al Ahly Stats
==================================================
Automatically syncs data from Google Sheets to local cache
"""

import os
import sys
import time
import json
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
from cache_manager import get_cache_manager

# Helper function to get resource path (works with PyInstaller)
def get_resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# Fix Unicode printing on Windows
def safe_print(msg):
    """Safe print that handles Unicode errors on Windows"""
    try:
        print(msg)
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Remove emojis and print ASCII only
        cleaned = msg.encode('ascii', 'ignore').decode('ascii')
        print(cleaned)

# Google Sheets Configuration
AHLY_STATS_SHEET_ID = os.environ.get('AHLY_MATCH_SHEET_ID', '1zeSlEN7VS2S6KPZH7_uvQeeY3Iu5INUyi12V0_Wi9G4')
CREDENTIALS_FILE = get_resource_path('credentials/ahlymatch.json')

# Cache configuration
CACHE_KEY_PREFIX = 'ahly_stats_'
CACHE_TTL_HOURS = 6  # Cache validity: 6 hours

class GoogleSheetsSync:
    """Handles automatic synchronization with Google Sheets"""
    
    def __init__(self, credentials_file=CREDENTIALS_FILE, sheet_id=AHLY_STATS_SHEET_ID):
        """
        Initialize Google Sheets sync service
        
        Args:
            credentials_file: Path to service account JSON credentials
            sheet_id: Google Sheets ID to sync from
        """
        self.sheet_id = sheet_id
        self.credentials_file = credentials_file
        self.client = None
        self.cache_manager = get_cache_manager()
        self.last_sync_time = None
        
        safe_print(f"[INIT] Initializing Google Sheets Sync Service")
        safe_print(f"   Sheet ID: {sheet_id}")
        safe_print(f"   Credentials: {credentials_file}")
    
    def authenticate(self):
        """Authenticate with Google Sheets API"""
        try:
            # Define the required scopes
            scopes = [
                'https://www.googleapis.com/auth/spreadsheets.readonly',
                'https://www.googleapis.com/auth/drive.readonly'
            ]
            
            # Try to get credentials from environment variable first (for Render/Production)
            # Try the specific AHLY_MATCH credentials first, then fallback to generic
            credentials_json = os.environ.get('GOOGLE_CREDENTIALS_JSON_AHLY_MATCH') or os.environ.get('GOOGLE_CREDENTIALS_JSON')
            
            if credentials_json:
                # Load credentials from environment variable
                safe_print("[INFO] Using credentials from environment variable")
                credentials_info = json.loads(credentials_json)
                credentials = Credentials.from_service_account_info(
                    credentials_info,
                    scopes=scopes
                )
            else:
                # Fallback to file (for local development)
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Credentials file not found: {self.credentials_file}\n"
                        "Please set GOOGLE_CREDENTIALS_JSON environment variable or provide credentials file."
                    )
                
                safe_print(f"[INFO] Using credentials from file: {self.credentials_file}")
                credentials = Credentials.from_service_account_file(
                    self.credentials_file,
                    scopes=scopes
                )
            
            # Create gspread client
            self.client = gspread.authorize(credentials)
            
            safe_print("[OK] Successfully authenticated with Google Sheets")
            return True
            
        except Exception as e:
            safe_print(f"[ERROR] Failed to authenticate: {e}")
            return False
    
    def fetch_sheet_data(self, sheet_name):
        """
        Fetch data from a specific sheet/tab
        
        Args:
            sheet_name: Name of the sheet/tab to fetch
            
        Returns:
            List of dictionaries representing rows
        """
        try:
            if not self.client:
                if not self.authenticate():
                    return None
            
            # Open the spreadsheet
            spreadsheet = self.client.open_by_key(self.sheet_id)
            
            # Get the specific worksheet
            worksheet = spreadsheet.worksheet(sheet_name)
            
            # Get all records as list of dictionaries
            records = worksheet.get_all_records()
            
            safe_print(f"[OK] Fetched {len(records)} records from sheet: {sheet_name}")
            return records
            
        except gspread.exceptions.WorksheetNotFound:
            safe_print(f"[WARN] Sheet not found: {sheet_name}")
            return None
        except Exception as e:
            safe_print(f"[ERROR] Error fetching sheet data from {sheet_name}: {e}")
            return None
    
    def fetch_all_sheets(self):
        """
        Fetch data from all sheets in the spreadsheet
        
        Returns:
            Dictionary with sheet names as keys and data as values
        """
        try:
            if not self.client:
                if not self.authenticate():
                    return None
            
            # Open the spreadsheet
            spreadsheet = self.client.open_by_key(self.sheet_id)
            
            # Get all worksheets
            worksheets = spreadsheet.worksheets()
            
            all_data = {}
            
            for worksheet in worksheets:
                sheet_name = worksheet.title
                safe_print(f"[FETCH] Fetching sheet: {sheet_name}")
                
                try:
                    records = worksheet.get_all_records()
                    all_data[sheet_name] = records
                    safe_print(f"   [OK] {len(records)} records")
                except Exception as e:
                    safe_print(f"   [WARN] Error: {e}")
                    all_data[sheet_name] = []
            
            return all_data
            
        except Exception as e:
            safe_print(f"[ERROR] Error fetching all sheets: {e}")
            return None
    
    def sync_to_cache(self):
        """
        Main sync function: Fetch data from Google Sheets and save to cache
        
        Returns:
            dict with fetched data if successful, None otherwise
        """
        safe_print("\n" + "="*60)
        safe_print("[SYNC] Starting Google Sheets Auto-Sync")
        safe_print("="*60)
        
        start_time = time.time()
        
        try:
            # Fetch all sheets
            all_sheets_data = self.fetch_all_sheets()
            
            if not all_sheets_data:
                safe_print("[ERROR] No data fetched from Google Sheets")
                return None
            
            # Save to cache
            cache_key = f"{CACHE_KEY_PREFIX}all_sheets"
            
            metadata = {
                'sheet_id': self.sheet_id,
                'sheets_count': len(all_sheets_data),
                'sheet_names': list(all_sheets_data.keys()),
                'sync_timestamp': datetime.now().isoformat(),
                'records_count': {
                    sheet_name: len(data) 
                    for sheet_name, data in all_sheets_data.items()
                }
            }
            
            # Save to cache (will be skipped in no-cache mode)
            self.cache_manager.set(cache_key, all_sheets_data, metadata)
            
            # Update last sync time
            self.last_sync_time = datetime.now()
            
            elapsed = time.time() - start_time
            
            safe_print("\n" + "="*60)
            safe_print(f"[OK] Sync completed successfully in {elapsed:.2f}s")
            safe_print(f"   Total sheets: {len(all_sheets_data)}")
            safe_print(f"   Sheet names: {', '.join(all_sheets_data.keys())}")
            safe_print(f"   Last sync: {self.last_sync_time.strftime('%Y-%m-%d %H:%M:%S')}")
            safe_print("="*60 + "\n")
            
            # Return the data directly (important for no-cache mode)
            return all_sheets_data
            
        except Exception as e:
            safe_print(f"[ERROR] Sync failed: {e}")
            return None
    
    def get_cached_data(self):
        """
        Get cached data from the cache manager
        
        Returns:
            Cached sheets data or None
        """
        cache_key = f"{CACHE_KEY_PREFIX}all_sheets"
        cached = self.cache_manager.get(cache_key, ttl_hours=CACHE_TTL_HOURS)
        
        if cached:
            safe_print("[OK] Retrieved data from cache")
        else:
            safe_print("[WARN] No cached data available")
        
        return cached
    
    def get_or_sync(self):
        """
        Get data from cache, or sync if cache is empty/expired
        
        Returns:
            Sheets data (from cache or fresh sync)
        """
        # Try to get from cache first
        cached_data = self.get_cached_data()
        
        if cached_data:
            safe_print("[CACHE] Using cached data")
            return cached_data
        
        # Cache miss or expired - sync now
        safe_print("[SYNC] Cache miss - syncing from Google Sheets")
        synced_data = self.sync_to_cache()
        
        # Return synced data directly (important for no-cache mode)
        # In no-cache mode, sync_to_cache returns data but doesn't cache it
        # In cache mode, sync_to_cache caches data and we can also return it directly
        return synced_data
    
    def get_sync_status(self):
        """
        Get current sync status
        
        Returns:
            Dictionary with sync status information
        """
        cache_key = f"{CACHE_KEY_PREFIX}all_sheets"
        cache_info = self.cache_manager.get_cache_info()
        
        # Find our cache entry
        cache_entry = None
        if cache_info.get('cache_type') == 'Redis':
            for item in cache_info.get('items', []):
                if item.get('key') == cache_key:
                    cache_entry = item
                    break
        else:  # File cache
            for item in cache_info.get('files', []):
                if item.get('key') == cache_key:
                    cache_entry = item
                    break
        
        status = {
            'cache_type': cache_info.get('cache_type'),
            'is_cached': cache_entry is not None,
            'last_sync': None,
            'age_minutes': None,
            'next_sync_in_hours': None
        }
        
        if cache_entry:
            status['last_sync'] = cache_entry.get('cached_at')
            status['age_minutes'] = cache_entry.get('age_minutes')
            
            # Calculate when next sync is due
            age_hours = status['age_minutes'] / 60
            next_sync_hours = max(0, CACHE_TTL_HOURS - age_hours)
            status['next_sync_in_hours'] = round(next_sync_hours, 1)
        
        return status


# Global sync service instance
_sync_service = None

def get_sync_service():
    """Get or create global sync service instance"""
    global _sync_service
    if _sync_service is None:
        _sync_service = GoogleSheetsSync()
    return _sync_service


# Convenience functions
def sync_now():
    """Trigger immediate sync"""
    service = get_sync_service()
    return service.sync_to_cache()

def get_sheets_data():
    """Get sheets data (from cache or sync)"""
    service = get_sync_service()
    return service.get_or_sync()

def get_sync_status():
    """Get sync status"""
    service = get_sync_service()
    return service.get_sync_status()


if __name__ == '__main__':
    # Test the sync service
    safe_print("Testing Google Sheets Sync Service...")
    safe_print("-" * 60)
    
    service = GoogleSheetsSync()
    
    # Test sync
    if service.sync_to_cache():
        safe_print("\n[OK] Sync test successful!")
        
        # Test retrieval
        data = service.get_cached_data()
        if data:
            safe_print(f"\n[OK] Cache retrieval successful!")
            safe_print(f"   Available sheets: {list(data.keys())}")
        
        # Test status
        status = service.get_sync_status()
        safe_print(f"\n[STATUS] Sync Status:")
        safe_print(f"   Cache Type: {status['cache_type']}")
        safe_print(f"   Is Cached: {status['is_cached']}")
        safe_print(f"   Age: {status['age_minutes']} minutes")
    else:
        safe_print("\n[ERROR] Sync test failed")

