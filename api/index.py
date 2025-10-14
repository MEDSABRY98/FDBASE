# -*- coding: utf-8 -*-
"""
Vercel Serverless Function Entry Point
=======================================
This file is specifically for Vercel deployment.
"""
import sys
import os

# Add parent directory to path so we can import app
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import Flask app
from app import app as application

# Vercel will use 'application' or 'app' as the WSGI handler
app = application

