# -*- coding: utf-8 -*-
"""
Desktop Version of Football Database Application
================================================
This version runs as a standalone desktop application using PyWebView
"""
import sys
import os

# Set environment variables before importing anything
os.environ['FLASK_ENV'] = 'production'
os.environ['WERKZEUG_RUN_MAIN'] = 'true'

import webview
from threading import Thread, Event
import time
import logging

# Configure logging (to file in noconsole mode)
log_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.log')

# Create handlers with proper encoding
file_handler = logging.FileHandler(log_file, encoding='utf-8', errors='replace')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))

# Create console handler only if stdout is available
handlers = [file_handler]
if sys.stdout:
    try:
        # Try to reconfigure stdout for UTF-8
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        handlers.append(console_handler)
    except:
        pass

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=handlers
)
logger = logging.getLogger(__name__)

# Import Flask app
from app import app

# Flask ready event
flask_ready = Event()

def start_flask():
    """Start Flask server in a separate thread"""
    try:
        logger.info("Starting Flask server...")
        
        # Signal that Flask is ready
        flask_ready.set()
        
        # Run Flask without auto-reloader and in production mode
        # Use waitress in production to avoid werkzeug issues
        try:
            from waitress import serve
            logger.info("Using Waitress server...")
            serve(app, host='127.0.0.1', port=5000, threads=4)
        except ImportError:
            # Fallback to Flask development server
            logger.info("Using Flask development server...")
            app.run(
                host='127.0.0.1', 
                port=5000, 
                debug=False, 
                use_reloader=False, 
                threaded=True
            )
    except Exception as e:
        logger.error(f"Error starting Flask: {e}")
        import traceback
        traceback.print_exc()

def wait_for_flask():
    """Wait for Flask to be ready"""
    logger.info("Waiting for Flask to start...")
    max_attempts = 30
    attempt = 0
    
    while attempt < max_attempts:
        try:
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            result = sock.connect_ex(('127.0.0.1', 5000))
            sock.close()
            
            if result == 0:
                logger.info("Flask is ready!")
                return True
        except:
            pass
        
        time.sleep(0.5)
        attempt += 1
    
    logger.error("Flask failed to start!")
    return False

def on_loaded():
    """Called when the webview window is loaded"""
    logger.info("Window loaded successfully!")

def main():
    """Main entry point for desktop application"""
    logger.info("=" * 70)
    logger.info("  FOOTBALL DATABASE MANAGER - DESKTOP VERSION")
    logger.info("=" * 70)
    
    # Start Flask in background thread FIRST
    logger.info("Starting Flask server...")
    flask_thread = Thread(target=start_flask, daemon=True)
    flask_thread.start()
    
    # Wait for Flask to be ready BEFORE creating window
    logger.info("Waiting for Flask to start...")
    if not wait_for_flask():
        logger.error("Failed to start Flask server. Exiting...")
        import ctypes
        ctypes.windll.user32.MessageBoxW(0, "Failed to start Flask server. Please check if port 5000 is available.", "Error", 0x10)
        sys.exit(1)
    
    logger.info("Creating desktop window...")
    
    # Create desktop window with loading screen
    window = webview.create_window(
        title='Football Database Manager',
        url='http://127.0.0.1:5000',
        width=1400,
        height=900,
        resizable=True,
        fullscreen=False,
        min_size=(1200, 700),
        background_color='#FFFFFF',
        text_select=True,
        on_top=False,
        confirm_close=False
    )
    
    logger.info("Starting PyWebView...")
    
    # Start the GUI (this is blocking) - window will appear immediately after Flask is ready
    webview.start(debug=False, http_server=False)
    
    logger.info("Application closed")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nShutting down...")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

