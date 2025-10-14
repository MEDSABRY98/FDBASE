# -*- coding: utf-8 -*-
"""
Background Scheduler Service
============================
Handles scheduled tasks like auto-syncing Google Sheets
"""

import threading
import time
from datetime import datetime, timedelta
from google_sheets_sync import get_sync_service

class SchedulerService:
    """Background scheduler for recurring tasks"""
    
    def __init__(self, sync_interval_hours=6):
        """
        Initialize scheduler
        
        Args:
            sync_interval_hours: How often to sync (in hours)
        """
        self.sync_interval_hours = sync_interval_hours
        self.sync_interval_seconds = sync_interval_hours * 3600
        self.running = False
        self.thread = None
        self.next_sync_time = None
        
        print(f"📅 Scheduler initialized (sync every {sync_interval_hours} hours)")
    
    def _scheduler_loop(self):
        """Main scheduler loop (runs in background thread)"""
        print("🚀 Scheduler thread started")
        
        # Do initial sync on startup
        print("🔄 Performing initial sync on startup...")
        sync_service = get_sync_service()
        sync_service.sync_to_cache()
        
        # Calculate next sync time
        self.next_sync_time = datetime.now() + timedelta(hours=self.sync_interval_hours)
        print(f"⏰ Next sync scheduled for: {self.next_sync_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        while self.running:
            try:
                # Check if it's time to sync
                if datetime.now() >= self.next_sync_time:
                    print("\n" + "="*60)
                    print("⏰ Scheduled sync triggered")
                    print("="*60)
                    
                    # Perform sync
                    sync_service.sync_to_cache()
                    
                    # Schedule next sync
                    self.next_sync_time = datetime.now() + timedelta(hours=self.sync_interval_hours)
                    print(f"⏰ Next sync scheduled for: {self.next_sync_time.strftime('%Y-%m-%d %H:%M:%S')}")
                
                # Sleep for 1 minute before checking again
                time.sleep(60)
                
            except Exception as e:
                print(f"❌ Error in scheduler loop: {e}")
                time.sleep(60)  # Wait before retrying
        
        print("🛑 Scheduler thread stopped")
    
    def start(self):
        """Start the background scheduler"""
        if self.running:
            print("⚠️ Scheduler already running")
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.thread.start()
        
        print("✅ Scheduler started successfully")
    
    def stop(self):
        """Stop the background scheduler"""
        if not self.running:
            print("⚠️ Scheduler not running")
            return
        
        print("🛑 Stopping scheduler...")
        self.running = False
        
        if self.thread:
            self.thread.join(timeout=5)
        
        print("✅ Scheduler stopped")
    
    def get_status(self):
        """Get scheduler status"""
        if not self.running:
            return {
                'running': False,
                'sync_interval_hours': self.sync_interval_hours,
                'next_sync': None
            }
        
        return {
            'running': True,
            'sync_interval_hours': self.sync_interval_hours,
            'next_sync': self.next_sync_time.isoformat() if self.next_sync_time else None,
            'minutes_until_next_sync': int((self.next_sync_time - datetime.now()).total_seconds() / 60) if self.next_sync_time else None
        }


# Global scheduler instance
_scheduler = None

def get_scheduler(sync_interval_hours=6):
    """Get or create global scheduler instance"""
    global _scheduler
    if _scheduler is None:
        _scheduler = SchedulerService(sync_interval_hours)
    return _scheduler

def start_scheduler(sync_interval_hours=6):
    """Start the global scheduler"""
    scheduler = get_scheduler(sync_interval_hours)
    scheduler.start()
    return scheduler

def stop_scheduler():
    """Stop the global scheduler"""
    global _scheduler
    if _scheduler:
        _scheduler.stop()

def get_scheduler_status():
    """Get scheduler status"""
    if _scheduler:
        return _scheduler.get_status()
    return {'running': False}


if __name__ == '__main__':
    # Test the scheduler
    print("Testing Scheduler Service...")
    print("-" * 60)
    
    # Start scheduler with 1-minute interval for testing
    scheduler = SchedulerService(sync_interval_hours=0.016667)  # ~1 minute
    scheduler.start()
    
    # Let it run for a few minutes
    try:
        print("\nScheduler is running. Press Ctrl+C to stop...\n")
        while True:
            status = scheduler.get_status()
            print(f"Status: {status}")
            time.sleep(30)
    except KeyboardInterrupt:
        print("\n\nStopping scheduler...")
        scheduler.stop()
        print("✅ Test completed")

