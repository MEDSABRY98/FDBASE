# -*- coding: utf-8 -*-
"""
Hybrid Cache Manager
====================
Automatically uses Redis (on Render) or File-based cache (locally on Windows)
"""
import os
import sys
import json
import time
from datetime import datetime, timedelta
from pathlib import Path

# Try to import redis (optional)
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class CacheManager:
    """Manages caching for API responses - supports both Redis and File-based"""
    
    # Mapping of cache keys to page names (prefix for file names)
    PAGE_NAME_MAPPING = {
        # Al Ahly Stats
        'ahly_stats': 'Al_Ahly_Stats',
        # Al Ahly PKs
        'pks_stats': 'Al_Ahly_PKs',
        # Al Ahly Finals
        'finals_stats': 'Al_Ahly_Finals',
        'finals_players': 'Al_Ahly_Finals',
        'finals_lineup': 'Al_Ahly_Finals',
        'finals_playerdatabase': 'Al_Ahly_Finals',
        # Ahly vs Zamalek
        'ahly_vs_zamalek': 'Ahly_vs_Zamalek',
        # Egypt Teams
        'egypt_teams': 'Egypt_Teams',
        'youth_egypt': 'Egypt_Youth',
        # Database Lists
        'ahly_players_list': 'Al_Ahly_Stats',
        'egypt_players_list': 'Egypt_Teams',
        'teams_list': 'db_Teams_List',
        'stadiums_list': 'db_Stadiums_List',
        'champions_list': 'db_Champions_List',
        'managers_list': 'db_Managers_List',
        'referees_list': 'db_Referees_List',
    }
    
    def __init__(self, cache_dir=None):
        """
        Initialize cache manager
        
        Automatically detects:
        - Redis if REDIS_URL environment variable exists
        - No cache mode for Vercel (if VERCEL=1 and no Redis)
        - File-based cache otherwise (perfect for Windows)
        
        Args:
            cache_dir: Directory for file-based cache. 
                      If None, uses AppData/Local/FootballDataManager/cache
        """
        # Detect if running on Vercel
        self.is_vercel = os.environ.get('VERCEL') == '1'
        
        # Try Redis first (for production deployments)
        self.redis_client = None
        self.using_redis = False
        self.no_cache_mode = False
        
        redis_url = os.environ.get('REDIS_URL') or os.environ.get('KV_URL')
        if redis_url and REDIS_AVAILABLE:
            try:
                self.redis_client = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5
                )
                # Test connection
                self.redis_client.ping()
                self.using_redis = True
                try:
                    print(f"✅ Using Redis cache: {redis_url.split('@')[-1] if '@' in redis_url else 'connected'}")
                except UnicodeEncodeError:
                    print(f"Using Redis cache: {redis_url.split('@')[-1] if '@' in redis_url else 'connected'}")
            except Exception as e:
                try:
                    print(f"⚠️ Redis not available ({e})")
                except UnicodeEncodeError:
                    print(f"Redis not available ({e})")
                self.redis_client = None
        
        # If on Vercel without Redis, use no-cache mode
        if self.is_vercel and not self.using_redis:
            self.no_cache_mode = True
            try:
                print(f"⚡ Vercel detected: Running in NO-CACHE mode (direct Google Sheets access)")
            except UnicodeEncodeError:
                print(f"Vercel detected: Running in NO-CACHE mode")
            return
        
        # Setup file-based cache (fallback or primary on Windows)
        if not self.using_redis:
            if cache_dir is None:
                # Use Windows AppData\Local for cache storage (standard location)
                if os.name == 'nt':  # Windows
                    app_data_dir = os.environ.get('LOCALAPPDATA', os.path.expanduser('~'))
                    cache_dir = os.path.join(app_data_dir, 'FootballDataManager', 'cache')
                else:
                    # Fallback for other OS
                    if getattr(sys, 'frozen', False):
                        # Running as compiled executable
                        app_dir = os.path.dirname(sys.executable)
                    else:
                        # Running as script
                        app_dir = os.path.dirname(os.path.abspath(__file__))
                    
                    cache_dir = os.path.join(app_dir, 'cache')
            
            self.cache_dir = Path(cache_dir)
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            
            try:
                print(f"📁 Using file-based cache: {self.cache_dir}")
            except UnicodeEncodeError:
                print(f"Using file-based cache: {self.cache_dir}")
    
    def _get_cache_path(self, key):
        """Get file path for a cache key (file-based cache only)"""
        # Check if we can add a page name prefix
        page_prefix = None
        key_pattern_matched = None
        for key_pattern, page_name in self.PAGE_NAME_MAPPING.items():
            if key.startswith(key_pattern):
                page_prefix = page_name
                key_pattern_matched = key_pattern
                break
        
        # Create filename with page prefix if found
        if page_prefix and key_pattern_matched:
            # Remove the matched pattern from the key to avoid duplication
            # e.g., "ahly_vs_zamalek_matches" becomes "matches"
            remaining_key = key[len(key_pattern_matched):].lstrip('_')
            
            # If there's remaining text, use it as description
            if remaining_key:
                # Sanitize the remaining key
                safe_remaining = "".join(c if c.isalnum() or c in '_-' else '_' for c in remaining_key)
                filename = f"{page_prefix}_{safe_remaining}.json"
            else:
                # No remaining text, just use the page prefix
                filename = f"{page_prefix}.json"
        else:
            # No mapping found, use the original key
            safe_key = "".join(c if c.isalnum() or c in '_-' else '_' for c in key)
            filename = f"{safe_key}.json"
        
        return self.cache_dir / filename
    
    def get(self, key, ttl_hours=None):
        """
        Get cached data
        
        Args:
            key: Cache key
            ttl_hours: Time to live in hours. If None, cache never expires (permanent)
            
        Returns:
            Cached data if valid, None otherwise
        """
        # If in no-cache mode, always return None (fetch fresh data)
        if self.no_cache_mode:
            return None
            
        # Try Redis first
        if self.using_redis:
            return self._get_redis(key, ttl_hours)
        else:
            return self._get_file(key, ttl_hours)
    
    def _get_redis(self, key, ttl_hours=None):
        """Get from Redis cache"""
        try:
            cached_data = self.redis_client.get(key)
            if not cached_data:
                print(f"❌ Cache miss (Redis): {key}")
                return None
            
            cache_obj = json.loads(cached_data)
            
            # If ttl_hours is None, cache is permanent (no expiration check)
            if ttl_hours is None:
                print(f"✅ Cache hit (Redis, permanent): {key}")
                return cache_obj.get('data')
            
            # Check expiration
            cached_at = cache_obj.get('cached_at', 0)
            ttl_seconds = ttl_hours * 3600
            
            if time.time() - cached_at > ttl_seconds:
                print(f"⏰ Cache expired (Redis): {key}")
                self.redis_client.delete(key)
                return None
            
            age_minutes = int((time.time() - cached_at) / 60)
            print(f"✅ Cache hit (Redis): {key} (age: {age_minutes} minutes)")
            return cache_obj.get('data')
            
        except Exception as e:
            print(f"❌ Error reading Redis cache for {key}: {e}")
            return None
    
    def _get_file(self, key, ttl_hours=None):
        """Get from file-based cache"""
        cache_path = self._get_cache_path(key)
        
        if not cache_path.exists():
            print(f"❌ Cache miss (File): {key}")
            return None
        
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            
            # If ttl_hours is None, cache is permanent
            if ttl_hours is None:
                print(f"✅ Cache hit (File, permanent): {key}")
                return cache_data.get('data')
            
            # Check expiration
            cached_at = cache_data.get('cached_at', 0)
            ttl_seconds = ttl_hours * 3600
            
            if time.time() - cached_at > ttl_seconds:
                print(f"⏰ Cache expired (File): {key}")
                cache_path.unlink()  # Delete expired cache
                return None
            
            age_minutes = int((time.time() - cached_at) / 60)
            print(f"✅ Cache hit (File): {key} (age: {age_minutes} minutes)")
            return cache_data.get('data')
            
        except Exception as e:
            print(f"❌ Error reading file cache for {key}: {e}")
            # Delete corrupted cache
            try:
                cache_path.unlink()
            except:
                pass
            return None
    
    def set(self, key, data, metadata=None):
        """
        Set cached data
        
        Args:
            key: Cache key
            data: Data to cache
            metadata: Optional metadata to store with cache
        """
        # If in no-cache mode, don't cache anything
        if self.no_cache_mode:
            return
            
        # Use both Redis and File cache
        if self.using_redis:
            self._set_redis(key, data, metadata)
        else:
            self._set_file(key, data, metadata)
    
    def _set_redis(self, key, data, metadata=None):
        """Set to Redis cache"""
        try:
            cache_data = {
                'key': key,
                'cached_at': time.time(),
                'cached_at_readable': datetime.now().isoformat(),
                'data': data,
                'metadata': metadata or {}
            }
            
            # Store as JSON string in Redis
            self.redis_client.set(key, json.dumps(cache_data))
            
            # Estimate size
            data_size = len(json.dumps(cache_data)) / 1024  # KB
            print(f"💾 Cached (Redis): {key} (~{data_size:.1f} KB)")
            
        except Exception as e:
            print(f"❌ Error caching to Redis {key}: {e}")
    
    def _set_file(self, key, data, metadata=None):
        """Set to file-based cache"""
        cache_path = self._get_cache_path(key)
        
        cache_data = {
            'key': key,
            'cached_at': time.time(),
            'cached_at_readable': datetime.now().isoformat(),
            'data': data,
            'metadata': metadata or {}
        }
        
        try:
            with open(cache_path, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
            file_size = os.path.getsize(cache_path) / 1024  # KB
            print(f"💾 Cached (File): {key} ({file_size:.1f} KB)")
            
        except Exception as e:
            print(f"❌ Error caching to file {key}: {e}")
    
    def clear(self, pattern=None):
        """
        Clear cache
        
        Args:
            pattern: If provided, only clear cache keys matching this pattern
        """
        # If in no-cache mode, nothing to clear
        if self.no_cache_mode:
            print("⚡ No-cache mode: Nothing to clear")
            return
            
        if self.using_redis:
            self._clear_redis(pattern)
        else:
            self._clear_file(pattern)
    
    def _clear_redis(self, pattern=None):
        """Clear Redis cache"""
        try:
            if pattern is None:
                # Clear all keys (be careful!)
                count = 0
                for key in self.redis_client.scan_iter():
                    self.redis_client.delete(key)
                    count += 1
                print(f"🧹 Cleared all cache (Redis, {count} keys)")
            else:
                # Clear matching keys
                count = 0
                # Convert pattern to Redis pattern
                redis_pattern = f"*{pattern}*"
                for key in self.redis_client.scan_iter(match=redis_pattern):
                    self.redis_client.delete(key)
                    count += 1
                print(f"🧹 Cleared cache matching '{pattern}' (Redis, {count} keys)")
        except Exception as e:
            print(f"❌ Error clearing Redis cache: {e}")
    
    def _clear_file(self, pattern=None):
        """Clear file-based cache"""
        if pattern is None:
            # Clear all cache
            count = 0
            for cache_file in self.cache_dir.glob('*.json'):
                cache_file.unlink()
                count += 1
            print(f"🧹 Cleared all cache (File, {count} files)")
        else:
            # Clear matching cache
            count = 0
            safe_pattern = "".join(c if c.isalnum() or c in '_-*' else '_' for c in pattern)
            for cache_file in self.cache_dir.glob(f"{safe_pattern}.json"):
                cache_file.unlink()
                count += 1
            print(f"🧹 Cleared cache matching '{pattern}' (File, {count} files)")
    
    def get_cache_info(self):
        """Get information about cached data"""
        # If in no-cache mode, return empty info
        if self.no_cache_mode:
            return {
                'cache_type': 'No Cache (Direct Fetch)',
                'total_items': 0,
                'note': 'Running on Vercel without Redis - data fetched directly from Google Sheets'
            }
            
        if self.using_redis:
            return self._get_redis_info()
        else:
            return self._get_file_info()
    
    def _get_redis_info(self):
        """Get Redis cache info"""
        try:
            keys = list(self.redis_client.scan_iter())
            total_keys = len(keys)
            
            info = {
                'cache_type': 'Redis',
                'total_items': total_keys,
                'items': []
            }
            
            for key in keys[:100]:  # Limit to first 100 keys
                try:
                    cached_data = self.redis_client.get(key)
                    if cached_data:
                        cache_obj = json.loads(cached_data)
                        cached_at = cache_obj.get('cached_at', 0)
                        age_minutes = int((time.time() - cached_at) / 60)
                        
                        info['items'].append({
                            'key': key,
                            'age_minutes': age_minutes,
                            'cached_at': cache_obj.get('cached_at_readable', 'Unknown')
                        })
                except:
                    pass
            
            return info
        except Exception as e:
            return {'cache_type': 'Redis', 'error': str(e)}
    
    def _get_file_info(self):
        """Get file-based cache info"""
        cache_files = list(self.cache_dir.glob('*.json'))
        
        info = {
            'cache_type': 'File',
            'cache_dir': str(self.cache_dir),
            'total_files': len(cache_files),
            'total_size_kb': sum(f.stat().st_size for f in cache_files) / 1024,
            'files': []
        }
        
        for cache_file in cache_files:
            try:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cache_data = json.load(f)
                
                cached_at = cache_data.get('cached_at', 0)
                age_minutes = int((time.time() - cached_at) / 60)
                
                info['files'].append({
                    'key': cache_data.get('key', cache_file.stem),
                    'size_kb': cache_file.stat().st_size / 1024,
                    'age_minutes': age_minutes,
                    'cached_at': cache_data.get('cached_at_readable', 'Unknown')
                })
            except:
                pass
        
        return info


# Global cache manager instance
_cache_manager = None

def get_cache_manager():
    """Get or create global cache manager instance"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager
