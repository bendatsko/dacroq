#!/usr/bin/env python3

import requests
import json

def test_satlib_benchmark():
    """Test SATLIB benchmark integration with the SAT solver API"""
    
    # Test with a SATLIB benchmark
    test_data = {
        "name": "test_uf20_91_satlib",
        "dimacs": """c SATLIB Uniform Random 3-SAT (20 vars, 91 clauses, SAT)
c Clause-to-variable ratio: 4.55
c Expected: SAT
p cnf 20 91
1 -2 3 0
-1 4 5 0
2 -4 6 0
-3 -5 -6 0
7 8 9 0
-7 10 11 0
-8 -10 12 0
-9 -11 -12 0
13 14 15 0
-13 16 17 0
-14 -16 18 0
-15 -17 -18 0
19 20 1 0
-19 -20 2 0
3 4 7 0
-3 8 13 0
5 9 14 0
6 10 15 0
11 12 16 0
17 18 19 0
-1 -2 -7 0
-4 -8 -13 0
-5 -9 -14 0
-6 -10 -15 0
-11 -16 -19 0
-12 -17 -20 0
1 2 7 0
4 8 13 0
5 9 14 0
6 10 15 0
11 16 19 0
12 17 20 0
-1 3 -4 0
-2 -3 5 0
7 -8 6 0
-7 9 -6 0
13 -14 10 0
-13 15 -10 0
19 -20 11 0
-19 20 -11 0
1 -5 12 0
2 6 -12 0
3 -9 16 0
4 10 -16 0
7 -15 17 0
8 11 -17 0
13 -19 18 0
14 20 -18 0
-1 -6 -11 0
-2 5 12 0
-3 9 -16 0
-4 -10 16 0
-7 15 -17 0
-8 -11 17 0
-13 19 -18 0
-14 -20 18 0
1 6 11 0
2 -5 -12 0
3 -9 16 0
4 10 -16 0
7 -15 17 0
8 11 -17 0
13 -19 18 0
14 20 -18 0
1 2 3 0
4 5 6 0
7 8 9 0
10 11 12 0
13 14 15 0
16 17 18 0
19 20 1 0
-1 -2 -3 0
-4 -5 -6 0
-7 -8 -9 0
-10 -11 -12 0
-13 -14 -15 0
-16 -17 -18 0
-19 -20 -1 0
1 4 7 0
2 5 8 0
3 6 9 0
10 13 16 0
11 14 17 0
12 15 18 0
19 20 1 0
-1 -4 -7 0
-2 -5 -8 0
-3 -6 -9 0
-10 -13 -16 0
-11 -14 -17 0
-12 -15 -18 0
-19 -20 -1 0""",
        "solver_type": "minisat",
        "input_mode": "satlib", 
        "enable_minisat": True,
        "enable_walksat": True,
        "enable_daedalus": False,
        "iterations": 5,
        "num_variables": 20,
        "num_clauses": 91
    }

    print("🧪 Testing SATLIB benchmark UF20-91...")
    print(f"📊 Problem: {test_data['num_variables']} variables, {test_data['num_clauses']} clauses")
    print(f"🔧 Solvers: MiniSAT + WalkSAT, {test_data['iterations']} iterations")

    try:
        # Send request to SAT solver API
        response = requests.post(
            "http://localhost:8000/sat/solve",  # Direct to API (correct port)
            json=test_data,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"📡 Response status: {response.status_code}")
        
        if response.status_code == 201:
            result = response.json()
            print("✅ SATLIB test completed successfully!")
            print(f"🆔 Test ID: {result.get('test_id', 'N/A')}")
            print(f"📋 Status: {result.get('status', 'N/A')}")
            print(f"📝 Message: {result.get('message', 'N/A')}")
            
            if 'summary' in result:
                summary = result['summary']
                print("\n📊 Summary:")
                print(f"   Problem size: {summary.get('problem_size', 'N/A')}")
                print(f"   Iterations: {summary.get('iterations', 'N/A')}")
                
                if 'solver_comparison' in summary:
                    print("   Solver results:")
                    for solver, stats in summary['solver_comparison'].items():
                        print(f"     {solver}:")
                        print(f"       Avg time: {stats.get('avg_solve_time_ms', 0):.2f} ms")
                        print(f"       Success rate: {stats.get('success_rate', 0):.2%}")
                        print(f"       Total runs: {stats.get('total_runs', 0)}")
            
            return True
        else:
            error_data = response.json()
            print(f"❌ Test failed: {error_data.get('error', 'Unknown error')}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection failed - is the API server running on port 5000?")
        return False
    except requests.exceptions.Timeout:
        print("❌ Request timed out - solver may be taking too long")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return False

def test_api_health():
    """Test if the API is healthy"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ API Health: {health_data.get('status', 'unknown')}")
            return True
        else:
            print(f"⚠️ API Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check failed: {e}")
        return False

if __name__ == "__main__":
    print("🔬 SATLIB Integration Test")
    print("=" * 50)
    
    # Check API health first
    if test_api_health():
        print()
        # Run SATLIB test
        success = test_satlib_benchmark()
        
        if success:
            print("\n🎉 All tests passed! SATLIB integration is working.")
        else:
            print("\n💥 Test failed! Check the API logs for details.")
    else:
        print("\n💥 API not available. Start the API server first:")
        print("   cd api && python main.py") 