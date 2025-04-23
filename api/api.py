#!/usr/bin/env python3
import os
import json
import requests
import subprocess
import signal
import threading
import time
import sys
import logging
from pathlib import Path
from flask import Flask, jsonify, Response, request
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
import pytz
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:3000",
            "https://dacroq.eecs.umich.edu",
            "https://medusa.bendatsko.com"
        ]
    }
})

# Setup logging
log_dir = Path.home() / "ksat-weather-api" / "logs"
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / "api.log"
cloudflare_log_file = log_dir / "cloudflare.log"

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("ksat-weather-api")

# Setup Cloudflare logger
cloudflare_logger = logging.getLogger("cloudflare-tunnel")
cloudflare_handler = logging.FileHandler(cloudflare_log_file)
cloudflare_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
cloudflare_logger.addHandler(cloudflare_handler)
cloudflare_logger.setLevel(logging.INFO)

# Weather data cache and status
weather_data = {
    'last_updated': None,
    'error': None,
    'location': 'Ann Arbor, Michigan',
}
last_successful_fetch = None

# Test data storage (in-memory for demo)
tests_data = []

# Cloudflare tunnel process and status
cloudflare_process = None
cloudflare_status = "stopped"  # Can be: starting, running, stopped, error

@app.route('/tests', methods=['GET', 'POST'])
def handle_tests():
    """Handle test data operations"""
    if request.method == 'GET':
        # Get query parameters
        environment = request.args.get('environment', 'production').lower()
        time_range = int(request.args.get('timeRange', 43200000))  # Default 12 hours in ms
        
        # Filter tests based on environment and time range
        now = datetime.now(pytz.timezone('America/Detroit'))
        time_threshold = now - timedelta(milliseconds=time_range)
        
        filtered_tests = [
            test for test in tests_data
            if (test.get('environment', 'production').lower() == environment and
                datetime.fromisoformat(test['created'].replace('Z', '+00:00')) > time_threshold)
        ]
        
        return jsonify(filtered_tests)
    
    elif request.method == 'POST':
        try:
            new_test = request.json
            required_fields = ['name', 'chipType', 'environment']
            
            # Validate required fields
            if not all(field in new_test for field in required_fields):
                return jsonify({
                    'error': 'Missing required fields',
                    'required': required_fields
                }), 400
            
            # Add metadata
            new_test['id'] = str(len(tests_data) + 1)  # Simple ID generation
            new_test['created'] = datetime.now(pytz.timezone('America/Detroit')).isoformat()
            new_test['status'] = 'queued'
            
            tests_data.append(new_test)
            
            return jsonify(new_test), 201
            
        except Exception as e:
            logger.error(f"Error creating test: {e}")
            return jsonify({'error': str(e)}), 500

@app.route('/tests/<test_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_test(test_id):
    """Handle operations on a specific test"""
    test = next((t for t in tests_data if t['id'] == test_id), None)
    
    if not test:
        return jsonify({'error': 'Test not found'}), 404
    
    if request.method == 'GET':
        return jsonify(test)
    
    elif request.method == 'PUT':
        try:
            updates = request.json
            test.update(updates)
            return jsonify(test)
        except Exception as e:
            logger.error(f"Error updating test {test_id}: {e}")
            return jsonify({'error': str(e)}), 500
    
    elif request.method == 'DELETE':
        tests_data.remove(test)
        return '', 204
