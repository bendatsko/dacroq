#!/usr/bin/env python3
"""
Debug LDPC Results Data Flow
============================

This script helps verify that results are flowing correctly from:
Backend Database → API → Frontend

Usage: python3 debug_results.py
"""

import json
import sqlite3
import requests
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "data" / "database" / "dacroq.db"
API_BASE = "http://localhost:8000"

def check_database_results():
    """Check what's actually stored in the database"""
    print("🔍 Checking Database Results...")
    print("=" * 50)
    
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    try:
        # Get latest LDPC jobs
        cursor = conn.execute("""
            SELECT id, name, status, created, results, metadata
            FROM ldpc_jobs 
            ORDER BY created DESC 
            LIMIT 3
        """)
        
        for row in cursor:
            print(f"\n📋 Job: {row['name']} ({row['status']})")
            print(f"   ID: {row['id']}")
            print(f"   Created: {row['created']}")
            
            if row['results']:
                try:
                    results = json.loads(row['results'])
                    print(f"   Results structure:")
                    
                    for key, value in results.items():
                        if isinstance(value, dict):
                            if 'error' in value:
                                print(f"     ❌ {key}: ERROR - {value['error']}")
                            elif 'results' in value:
                                print(f"     ✅ {key}: {len(value['results'])} test vectors")
                            elif 'successful_decodes' in value:
                                success_rate = value['successful_decodes'] / value['total_vectors'] * 100
                                print(f"     ✅ {key}: {success_rate:.1f}% success rate")
                            else:
                                print(f"     ⚠️  {key}: Unknown structure")
                        else:
                            print(f"     📊 {key}: {value}")
                            
                except json.JSONDecodeError as e:
                    print(f"   ❌ Results JSON parse error: {e}")
            else:
                print(f"   ⚠️  No results data")
                
            if row['metadata']:
                try:
                    metadata = json.loads(row['metadata'])
                    print(f"   Metadata keys: {list(metadata.keys())}")
                except:
                    print(f"   ⚠️  Metadata parse error")
                    
    finally:
        conn.close()
    
def check_api_endpoint():
    """Check what the API returns"""
    print("\n\n🌐 Checking API Endpoint...")
    print("=" * 50)
    
    try:
        # Get jobs list
        response = requests.get(f"{API_BASE}/ldpc/jobs", timeout=5)
        
        if response.status_code == 200:
            jobs = response.json().get('jobs', [])
            print(f"✅ API returned {len(jobs)} jobs")
            
            if jobs:
                latest_job = jobs[0]
                print(f"\n📋 Latest job: {latest_job['name']}")
                print(f"   Status: {latest_job['status']}")
                
                # Get detailed job data
                job_response = requests.get(f"{API_BASE}/ldpc/jobs/{latest_job['id']}", timeout=5)
                
                if job_response.status_code == 200:
                    job_data = job_response.json()
                    print(f"   Detailed results structure:")
                    
                    if 'results' in job_data:
                        results = job_data['results']
                        if isinstance(results, dict):
                            for key, value in results.items():
                                if isinstance(value, dict) and 'error' in value:
                                    print(f"     ❌ {key}: {value['error']}")
                                else:
                                    print(f"     📊 {key}: {type(value).__name__}")
                        else:
                            print(f"     📊 Results type: {type(results).__name__}")
                    else:
                        print(f"     ⚠️  No results field")
                        
                else:
                    print(f"   ❌ Failed to get job details: {job_response.status_code}")
            else:
                print("   ⚠️  No jobs found")
                
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(f"   Response: {response.text[:200]}...")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ API connection failed: {e}")
        print("   Make sure the backend is running on http://localhost:8000")

def check_frontend_data_parsing():
    """Simulate frontend data parsing"""
    print("\n\n🎨 Testing Frontend Data Parsing...")
    print("=" * 50)
    
    # Simulate the data structure from API
    sample_job_data = {
        "id": "test-123",
        "name": "Sample LDPC Test",
        "status": "completed",
        "results": {
            "5dB": {
                "error": "No ACK received for RUN_TEST command"
            },
            "6dB": {
                "error": "Teensy error: ERROR:INVALID_START_MARKER"
            }
        }
    }
    
    # Test the parsing logic (simplified version)
    def test_get_success_rate(test_results):
        if isinstance(test_results, dict):
            snr_keys = [k for k in test_results.keys() if k.endswith('dB')]
            
            if snr_keys:
                error_count = sum(1 for k in snr_keys if test_results[k].get('error'))
                total_vectors = 0
                
                for snr_key in snr_keys:
                    snr_data = test_results[snr_key]
                    if not snr_data.get('error'):
                        # Would count actual results here
                        pass
                
                if error_count == len(snr_keys):
                    return f"❌ Error: {error_count} SNR points failed"
                elif error_count > 0:
                    return f"⚠️  Partial error: {error_count}/{len(snr_keys)} SNR points failed"
                else:
                    return "✅ Success rate calculated"
        
        return "⚠️  Unknown structure"
    
    result = test_get_success_rate(sample_job_data["results"])
    print(f"Frontend parsing result: {result}")
    
    print("\n📋 Expected frontend behavior:")
    print("  - Dashboard should show 'Error' instead of 'Pending'")
    print("  - Modal should show hardware failure information")
    print("  - No performance charts (since no valid data)")

def main():
    print("🚀 LDPC Results Debug Tool")
    print("=" * 60)
    
    check_database_results()
    check_api_endpoint() 
    check_frontend_data_parsing()
    
    print("\n\n🔧 Troubleshooting Summary:")
    print("=" * 50)
    print("1. If database shows errors → Hardware communication issue")
    print("2. If API differs from database → Backend parsing problem") 
    print("3. If frontend shows 'Pending' → Frontend parsing issue")
    print("\n✅ After fixes, you should see:")
    print("  - Dashboard: 'Error' status with error count")
    print("  - Modal: Hardware failure information")
    print("  - No 'Pending' results anywhere")

if __name__ == "__main__":
    main() 