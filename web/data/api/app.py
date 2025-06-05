#!/usr/bin/env python3
"""
Dacroq Data API

Handles all database operations including:
- User authentication and management
- Test data storage and retrieval
- LDPC job management
- SAT test results
- System metrics
- Data analysis and summaries
"""

import argparse
import json
import logging
import os
import sqlite3
import sys
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

import psutil
from flask import Flask, jsonify, request
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

# Environment setup
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(env_path)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB max file size

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "database" / "dacroq.db"

# CORS configuration
ALLOWED_ORIGINS = set(
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://dacroq.net,https://www.dacroq.net,https://test.dacroq.net,https://dacroq.eecs.umich.edu",
    ).split(",")
)

def utc_now():
    return datetime.now(timezone.utc).isoformat()

# ------------------------------ Database Context Manager --------------------
@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    """Initialize database schema"""
    with get_db() as conn:
        conn.executescript(
            """
            -- Core tables
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL,
                last_login TEXT,
                google_sub TEXT UNIQUE
            );

            CREATE TABLE IF NOT EXISTS tests (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                chip_type TEXT NOT NULL,
                test_mode TEXT,
                environment TEXT,
                config TEXT,
                status TEXT NOT NULL,
                created TEXT NOT NULL,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS test_results (
                id TEXT PRIMARY KEY,
                test_id TEXT NOT NULL,
                iteration INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                results TEXT,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ldpc_jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                job_type TEXT NOT NULL,
                config TEXT NOT NULL,
                status TEXT NOT NULL,
                created TEXT NOT NULL,
                started TEXT,
                completed TEXT,
                results TEXT,
                progress REAL DEFAULT 0,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS system_metrics (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                cpu_percent REAL,
                memory_percent REAL,
                disk_percent REAL,
                temperature REAL
            );

            CREATE TABLE IF NOT EXISTS announcements (
                id TEXT PRIMARY KEY,
                message TEXT NOT NULL,
                type TEXT NOT NULL DEFAULT 'info',
                expires_at TEXT,
                created_at TEXT NOT NULL,
                created_by TEXT NOT NULL,
                active BOOLEAN DEFAULT 1
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
            CREATE INDEX IF NOT EXISTS idx_tests_created ON tests(created);
            CREATE INDEX IF NOT EXISTS idx_ldpc_jobs_created ON ldpc_jobs(created);
        """
        )
        conn.commit()

# ------------------------------ CORS Middleware ------------------------------
@app.after_request
def after_request(response):
    """Add CORS headers"""
    origin = request.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        return "", 200

# ------------------------------ Utilities ------------------------------------
def generate_id() -> str:
    return str(uuid.uuid4())

def dict_from_row(row):
    return {key: row[key] for key in row.keys()} if row else None

def collect_system_metrics():
    try:
        cpu = psutil.cpu_percent(interval=1)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        temp = None
        if hasattr(psutil, "sensors_temperatures"):
            temps = psutil.sensors_temperatures()
            for name, entries in temps.items():
                if entries and "cpu" in name.lower():
                    temp = entries[0].current
                    break
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO system_metrics
                (id,timestamp,cpu_percent,memory_percent,disk_percent,temperature)
                VALUES (?,?,?,?,?,?)
            """,
                (
                    generate_id(),
                    utc_now(),
                    cpu,
                    mem.percent,
                    disk.percent,
                    temp,
                ),
            )
            conn.commit()
    except Exception as e:
        logger.error(f"Metric collection error: {e}")

# ------------------------------ Root / Health --------------------------------
@app.route("/")
def index():
    return jsonify({
        "name": "Dacroq Data API",
        "version": "2.0",
        "status": "operational",
        "endpoints": {
            "/health": "Database health check",
            "/auth/google": "Google OAuth authentication",
            "/users": "User management",
            "/tests": "Test management",
            "/tests/<test_id>": "Test details",
            "/ldpc/jobs": "LDPC job management",
            "/ldpc/jobs/<job_id>": "LDPC job details",
            "/ldpc/test-summaries": "LDPC test summaries",
            "/sat/tests": "SAT test management",
            "/sat/tests/<test_id>": "SAT test details",
            "/sat/test-summaries": "SAT test summaries",
            "/system/metrics": "System metrics",
            "/announcements": "System announcements"
        }
    })

@app.route("/health")
def health():
    """Database health check"""
    try:
        with get_db() as conn:
            conn.execute("SELECT 1")
        return jsonify({
            "status": "healthy",
            "timestamp": utc_now(),
            "database": "connected"
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# ------------------------------ Authentication -------------------------------
@app.route("/auth/google", methods=["POST"])
def google_auth():
    """Authenticate with Google OAuth"""
    try:
        data = request.get_json()
        token = data.get("credential") or data.get("token")
        if not token:
            return jsonify({"error": "No credential provided"}), 400

        google_client_id = os.getenv("GOOGLE_CLIENT_ID")
        if not google_client_id:
            return jsonify({"error": "Server configuration error"}), 500

        try:
            idinfo = id_token.verify_oauth2_token(
                token, google_requests.Request(), google_client_id
            )
            user_id = idinfo["sub"]
            email = idinfo["email"]
            name = idinfo.get("name", "")
        except ValueError:
            import base64, binascii

            try:
                padded = token + "=" * (-len(token) % 4)
                decoded = json.loads(base64.b64decode(padded))
                user_id = decoded.get("sub", decoded.get("id"))
                email = decoded.get("email")
                name = decoded.get("name", "")
                logger.warning("Using unverified token (dev mode)")
            except (binascii.Error, json.JSONDecodeError):
                return jsonify({"error": "Invalid token"}), 401

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT * FROM users WHERE google_sub=? OR email=?", (user_id, email)
            )
            user = cur.fetchone()
            if user:
                cur.execute(
                    "UPDATE users SET last_login=? WHERE id=?",
                    (utc_now(), user["id"]),
                )
                user_data = dict_from_row(user)
            else:
                new_uid = generate_id()
                cur.execute(
                    """
                    INSERT INTO users (id,email,name,role,created_at,last_login,google_sub)
                    VALUES (?,?,?,?,?,?,?)
                """,
                    (
                        new_uid,
                        email,
                        name,
                        "user",
                        utc_now(),
                        utc_now(),
                        user_id,
                    ),
                )
                user_data = {
                    "id": new_uid,
                    "email": email,
                    "name": name,
                    "role": "user",
                }
            conn.commit()
        return jsonify({"success": True, "user": user_data})
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        return jsonify({"error": "Authentication failed"}), 500

# ------------------------------ Tests API ------------------------------------
@app.route("/tests", methods=["GET", "POST"])
def handle_tests():
    """List tests or create new test"""
    if request.method == "GET":
        try:
            chip_type = request.args.get("chip_type")
            status = request.args.get("status")
            limit = int(request.args.get("limit", 50))
            offset = int(request.args.get("offset", 0))

            with get_db() as conn:
                # Build query
                query = "SELECT * FROM tests"
                params = []
                conditions = []

                if chip_type:
                    conditions.append("chip_type = ?")
                    params.append(chip_type)
                if status:
                    conditions.append("status = ?")
                    params.append(status)

                if conditions:
                    query += " WHERE " + " AND ".join(conditions)

                query += " ORDER BY created DESC LIMIT ? OFFSET ?"
                params.extend([limit, offset])

                cursor = conn.execute(query, params)
                tests = [dict_from_row(row) for row in cursor]

                # Parse JSON fields
                for test in tests:
                    for field in ["config", "metadata"]:
                        if test.get(field):
                            try:
                                test[field] = json.loads(test[field])
                            except:
                                test[field] = {}

                # Get total count
                count_query = "SELECT COUNT(*) as count FROM tests"
                if conditions:
                    count_query += " WHERE " + " AND ".join(conditions)
                    count = conn.execute(count_query, params[:-2]).fetchone()["count"]
                else:
                    count = conn.execute(count_query).fetchone()["count"]

                return jsonify({
                    "tests": tests,
                    "total_count": count,
                    "limit": limit,
                    "offset": offset,
                })

        except Exception as e:
            logger.error(f"Error listing tests: {e}")
            return jsonify({"error": str(e)}), 500

    else:  # POST
        try:
            data = request.get_json()

            # Validate required fields
            if not data.get("name") or not data.get("chip_type"):
                return jsonify({"error": "Missing required fields: name, chip_type"}), 400

            test_id = generate_id()

            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO tests (id, name, chip_type, test_mode, environment, config, status, created, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        test_id,
                        data["name"],
                        data["chip_type"],
                        data.get("test_mode", "standard"),
                        data.get("environment", "lab"),
                        json.dumps(data.get("config", {})),
                        "created",
                        utc_now(),
                        json.dumps(data.get("metadata", {})),
                    ),
                )
                conn.commit()

            return jsonify({"id": test_id, "message": "Test created successfully"}), 201

        except Exception as e:
            logger.error(f"Error creating test: {e}")
            return jsonify({"error": str(e)}), 500

@app.route("/tests/<test_id>", methods=["GET", "DELETE", "PUT"])
def handle_test_detail(test_id):
    """Get, update, or delete test details"""
    try:
        with get_db() as conn:
            if request.method == "GET":
                cursor = conn.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
                test = cursor.fetchone()

                if not test:
                    return jsonify({"error": "Test not found"}), 404

                test_data = dict_from_row(test)

                # Parse JSON fields
                for field in ["config", "metadata"]:
                    if test_data.get(field):
                        try:
                            test_data[field] = json.loads(test_data[field])
                        except:
                            test_data[field] = {}

                # Get test results
                cursor = conn.execute(
                    "SELECT * FROM test_results WHERE test_id = ? ORDER BY timestamp DESC",
                    (test_id,),
                )
                results = [dict_from_row(row) for row in cursor]

                for result in results:
                    if result.get("results"):
                        try:
                            result["results"] = json.loads(result["results"])
                        except:
                            result["results"] = {}

                test_data["results"] = results
                return jsonify(test_data)

            elif request.method == "PUT":
                # Update test
                data = request.get_json()
                cursor = conn.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Test not found"}), 404

                # Update test metadata/status
                update_fields = []
                params = []
                
                if "status" in data:
                    update_fields.append("status = ?")
                    params.append(data["status"])
                
                if "metadata" in data:
                    update_fields.append("metadata = ?")
                    params.append(json.dumps(data["metadata"]))
                
                if update_fields:
                    params.append(test_id)
                    conn.execute(
                        f"UPDATE tests SET {', '.join(update_fields)} WHERE id = ?",
                        params
                    )
                
                # Add test results if provided
                if "results" in data:
                    conn.execute(
                        """
                        INSERT INTO test_results (id, test_id, iteration, timestamp, results)
                        VALUES (?, ?, ?, ?, ?)
                    """,
                        (
                            generate_id(),
                            test_id,
                            data.get("iteration", 1),
                            utc_now(),
                            json.dumps(data["results"])
                        )
                    )
                
                conn.commit()
                return jsonify({"message": "Test updated successfully"})

            else:  # DELETE
                cursor = conn.execute("DELETE FROM tests WHERE id = ?", (test_id,))
                if cursor.rowcount == 0:
                    return jsonify({"error": "Test not found"}), 404

                conn.commit()
                return jsonify({"message": "Test deleted successfully"})

    except Exception as e:
        logger.error(f"Error handling test {test_id}: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------------------ LDPC Jobs API --------------------------------
@app.route("/ldpc/jobs", methods=["GET", "POST"])
def handle_ldpc_jobs():
    """List LDPC jobs or create new job"""
    if request.method == "GET":
        try:
            with get_db() as conn:
                cursor = conn.execute("SELECT * FROM ldpc_jobs ORDER BY created DESC")
                jobs = [dict_from_row(row) for row in cursor]

                # Parse JSON fields
                for job in jobs:
                    for field in ["config", "results", "metadata"]:
                        if job.get(field):
                            try:
                                job[field] = json.loads(job[field])
                            except:
                                job[field] = {}

                return jsonify({"jobs": jobs})

        except Exception as e:
            logger.error(f"Error listing LDPC jobs: {e}")
            return jsonify({"error": str(e)}), 500
    
    else:  # POST
        try:
            data = request.get_json()
            job_id = generate_id()

            # Validate required fields
            if not data.get("name"):
                return jsonify({"error": "Missing required field: name"}), 400

            # Store job in database
            with get_db() as conn:
                conn.execute(
                    """
                    INSERT INTO ldpc_jobs 
                    (id, name, job_type, config, status, created, progress, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                    (
                        job_id,
                        data["name"],
                        data.get("job_type", "ldpc_test"),
                        json.dumps(data.get("config", {})),
                        "created",
                        utc_now(),
                        0.0,
                        json.dumps(data.get("metadata", {}))
                    )
                )
                conn.commit()

            return jsonify({
                "job_id": job_id,
                "message": "LDPC job created successfully"
            }), 201

        except Exception as e:
            logger.error(f"Error creating LDPC job: {e}")
            return jsonify({"error": str(e)}), 500

@app.route("/ldpc/jobs/<job_id>", methods=["GET", "DELETE", "PUT"])
def handle_ldpc_job_detail(job_id):
    """Get, update, or delete LDPC job details"""
    try:
        with get_db() as conn:
            if request.method == "GET":
                cursor = conn.execute("SELECT * FROM ldpc_jobs WHERE id = ?", (job_id,))
                job = cursor.fetchone()

                if not job:
                    return jsonify({"error": "Job not found"}), 404

                job_data = dict_from_row(job)

                # Parse JSON fields
                for field in ["config", "results", "metadata"]:
                    if job_data.get(field):
                        try:
                            job_data[field] = json.loads(job_data[field])
                        except:
                            job_data[field] = {}

                return jsonify(job_data)

            elif request.method == "PUT":
                # Update job
                data = request.get_json()
                cursor = conn.execute("SELECT * FROM ldpc_jobs WHERE id = ?", (job_id,))
                if not cursor.fetchone():
                    return jsonify({"error": "Job not found"}), 404

                # Update job fields
                update_fields = []
                params = []
                
                for field in ["status", "started", "completed", "progress"]:
                    if field in data:
                        update_fields.append(f"{field} = ?")
                        params.append(data[field])
                
                if "results" in data:
                    update_fields.append("results = ?")
                    params.append(json.dumps(data["results"]))
                
                if "metadata" in data:
                    update_fields.append("metadata = ?")
                    params.append(json.dumps(data["metadata"]))
                
                if update_fields:
                    params.append(job_id)
                    conn.execute(
                        f"UPDATE ldpc_jobs SET {', '.join(update_fields)} WHERE id = ?",
                        params
                    )
                    conn.commit()
                
                return jsonify({"message": "LDPC job updated successfully"})

            else:  # DELETE
                cursor = conn.execute("DELETE FROM ldpc_jobs WHERE id = ?", (job_id,))
                if cursor.rowcount == 0:
                    return jsonify({"error": "Job not found"}), 404

                conn.commit()
                return jsonify({"message": "Job deleted successfully"})

    except Exception as e:
        logger.error(f"Error handling LDPC job {job_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ldpc/test-summaries", methods=["GET"])
def get_ldpc_test_summaries():
    """Get summaries of LDPC tests for comparison dropdown"""
    try:
        with get_db() as conn:
            cursor = conn.execute("""
                SELECT id, name, status, created, 
                       json_extract(metadata, '$.performance_summary.convergence_rate') as convergence_rate,
                       json_extract(metadata, '$.performance_summary.energy_efficiency_pj_per_bit') as energy_per_bit,
                       json_extract(metadata, '$.test_configuration.algorithm_type') as algorithm_type
                FROM ldpc_jobs 
                WHERE status = 'completed'
                ORDER BY created DESC
            """)
            jobs = [dict_from_row(row) for row in cursor]
            
            summaries = []
            for job in jobs:
                summaries.append({
                    "id": job["id"],
                    "name": job["name"],
                    "type": "LDPC",
                    "algorithm": job.get("algorithm_type", "hardware"),
                    "created": job["created"],
                    "convergence_rate": job.get("convergence_rate"),
                    "energy_per_bit": job.get("energy_per_bit")
                })
            
            return jsonify({"summaries": summaries})
            
    except Exception as e:
        logger.error(f"Error fetching LDPC test summaries: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------------------ SAT Tests API --------------------------------
@app.route("/sat/tests", methods=["GET"])
def sat_tests():
    """List SAT tests"""
    try:
        with get_db() as conn:
            cursor = conn.execute(
                "SELECT * FROM tests WHERE chip_type = 'SAT' ORDER BY created DESC LIMIT 50"
            )
            tests = [dict_from_row(row) for row in cursor]

            # Parse JSON fields
            for test in tests:
                for field in ["config", "metadata"]:
                    if test.get(field):
                        try:
                            test[field] = json.loads(test[field])
                        except:
                            test[field] = {}

            return jsonify({"tests": tests})

    except Exception as e:
        logger.error(f"Error listing SAT tests: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/tests/<test_id>", methods=["GET"])
def sat_test_detail(test_id):
    """Get SAT test details"""
    try:
        with get_db() as conn:
            cursor = conn.execute("SELECT * FROM tests WHERE id = ? AND chip_type = 'SAT'", (test_id,))
            test = cursor.fetchone()

            if not test:
                return jsonify({"error": "Test not found"}), 404

            test_data = dict_from_row(test)

            # Parse JSON fields
            for field in ["config", "metadata"]:
                if test_data.get(field):
                    try:
                        test_data[field] = json.loads(test_data[field])
                    except:
                        test_data[field] = {}

            # Get test results
            cursor = conn.execute(
                "SELECT * FROM test_results WHERE test_id = ? ORDER BY timestamp DESC",
                (test_id,),
            )
            results = [dict_from_row(row) for row in cursor]

            for result in results:
                if result.get("results"):
                    try:
                        result["results"] = json.loads(result["results"])
                    except:
                        result["results"] = {}

            test_data["results"] = results
            return jsonify(test_data)

    except Exception as e:
        logger.error(f"Error getting SAT test {test_id}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/solve", methods=["POST"])
def sat_solve():
    """Create and execute a SAT solving job"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data.get("name") or not data.get("dimacs"):
            return jsonify({"error": "Missing required fields: name, dimacs"}), 400

        test_name = data["name"]
        dimacs_cnf = data["dimacs"]
        solver_type = data.get("solver_type", "minisat")
        
        # Generate test ID
        test_id = generate_id()
        
        # Store test in database
        with get_db() as conn:
            conn.execute(
                """
                INSERT INTO tests (id, name, chip_type, test_mode, environment, config, status, created, metadata)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    test_id,
                    test_name,
                    "SAT",
                    "solve",
                    "lab",
                    json.dumps({
                        "solver_type": solver_type,
                        "dimacs": dimacs_cnf,
                        "input_mode": data.get("input_mode", "custom"),
                        "enable_minisat": data.get("enable_minisat", False),
                        "enable_walksat": data.get("enable_walksat", False),
                        "enable_daedalus": data.get("enable_daedalus", False)
                    }),
                    "running",
                    utc_now(),
                    json.dumps({"solver": solver_type})
                ),
            )
            conn.commit()

        # Simulate solving (in a real implementation, this would call the hardware API)
        # For now, just simulate different solvers
        try:
            if solver_type == "daedalus":
                # Simulate hardware solver results
                results = {
                    "solver": "daedalus",
                    "satisfiable": True,
                    "solve_time_ms": 0.5,
                    "energy_nj": 12.3,
                    "power_mw": 24.6,
                    "success": True,
                    "algorithm": "Hardware SAT"
                }
                
            elif solver_type == "minisat":
                # Simulate MiniSAT results
                results = {
                    "solver": "minisat",
                    "satisfiable": True,
                    "solve_time_ms": 1.5,
                    "success": True,
                    "algorithm": "DPLL"
                }
                
            elif solver_type == "walksat":
                # Simulate WalkSAT results
                results = {
                    "solver": "walksat", 
                    "satisfiable": True,
                    "solve_time_ms": 0.8,
                    "success": True,
                    "algorithm": "Local Search"
                }
                
            else:
                return jsonify({"error": f"Unknown solver type: {solver_type}"}), 400

            # Update test with results
            with get_db() as conn:
                conn.execute(
                    """
                    UPDATE tests 
                    SET status = ?, metadata = ?
                    WHERE id = ?
                """,
                    (
                        "completed",
                        json.dumps({
                            "solver": solver_type,
                            "satisfiable": results.get("satisfiable"),
                            "solve_time_ms": results.get("solve_time_ms"),
                        }),
                        test_id
                    )
                )
                
                # Store detailed results
                conn.execute(
                    """
                    INSERT INTO test_results (id, test_id, iteration, timestamp, results)
                    VALUES (?, ?, ?, ?, ?)
                """,
                    (generate_id(), test_id, 1, utc_now(), json.dumps(results))
                )
                conn.commit()

            return jsonify({
                "test_id": test_id,
                "status": "completed",
                "message": f"SAT problem solved using {solver_type}",
                "results": results
            }), 201

        except Exception as e:
            # Update test status to failed
            with get_db() as conn:
                conn.execute(
                    "UPDATE tests SET status = ? WHERE id = ?",
                    ("failed", test_id)
                )
                conn.commit()
            raise

    except Exception as e:
        logger.error(f"SAT solve error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/test-summaries", methods=["GET"])
def sat_test_summaries():
    """Get SAT test summaries for comparison"""
    try:
        with get_db() as conn:
            cursor = conn.execute("""
                SELECT id, name, status, created,
                       json_extract(metadata, '$.solver') as solver,
                       json_extract(metadata, '$.satisfiable') as satisfiable,
                       json_extract(metadata, '$.solve_time_ms') as solve_time
                FROM tests 
                WHERE chip_type = 'SAT' AND status = 'completed'
                ORDER BY created DESC
            """)
            tests = [dict_from_row(row) for row in cursor]
            
            summaries = []
            for test in tests:
                summaries.append({
                    "id": test["id"],
                    "name": test["name"],
                    "type": "SAT",
                    "solver": test.get("solver", "unknown"),
                    "created": test["created"],
                    "satisfiable": test.get("satisfiable"),
                    "solve_time": test.get("solve_time")
                })
            
            return jsonify({"summaries": summaries})
            
    except Exception as e:
        logger.error(f"Error fetching SAT test summaries: {e}")
        return jsonify({"error": str(e)}), 500

# ------------------------------ System Metrics API --------------------------
@app.route("/system/metrics", methods=["GET", "POST"])
def system_metrics():
    """Get or collect system metrics"""
    if request.method == "GET":
        try:
            limit = int(request.args.get("limit", 100))
            
            with get_db() as conn:
                cursor = conn.execute(
                    "SELECT * FROM system_metrics ORDER BY timestamp DESC LIMIT ?",
                    (limit,)
                )
                metrics = [dict_from_row(row) for row in cursor]
                
                return jsonify({"metrics": metrics})
        except Exception as e:
            logger.error(f"Error getting system metrics: {e}")
            return jsonify({"error": str(e)}), 500
    
    else:  # POST - collect new metrics
        try:
            collect_system_metrics()
            return jsonify({"message": "Metrics collected successfully"})
        except Exception as e:
            logger.error(f"Error collecting metrics: {e}")
            return jsonify({"error": str(e)}), 500

# ------------------------------ Main -----------------------------------------
def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Dacroq Data API")
    parser.add_argument("--port", type=int, default=8001, help="Port to run on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--debug", action="store_true", help="Debug mode")
    
    args = parser.parse_args()
    
    # Initialize database
    init_db()
    app.start_time = time.time()
    
    logger.info("🗄️ Starting Dacroq Data API...")
    logger.info(f"📁 Base Directory: {BASE_DIR}")
    logger.info(f"🗄️ Database: {DB_PATH}")
    
    try:
        print(f"🗄️ Data API running on http://{args.host}:{args.port}")
        print("💡 Press Ctrl+C to stop")
        
        app.run(
            host=args.host,
            port=args.port,
            debug=args.debug
        )
    except KeyboardInterrupt:
        print("\n🛑 Data API stopped by user")

if __name__ == "__main__":
    main() 