#!/usr/bin/env python3
from pathlib import Path
import os
import sys
import uuid
import logging
import json
import sqlite3
import time
import threading
from datetime import datetime, timedelta
import pytz
import psutil
from flask import Flask, jsonify, request, send_file
from werkzeug.utils import secure_filename
import subprocess
import serial
import re
import random
import signal

# --- App Initialization ---
app = Flask(__name__)

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# --- CORS Configuration ---
ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "https://dacroq.eecs.umich.edu",
    "https://dacroq-api.bendatsko.com",
    "https://release.bendatsko.com"
}

@app.after_request
def add_cors(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# --- Database Setup ---
DB_PATH = Path.home() / "ksat-api" / "database" / "ksat.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

def init_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # existing tables...
    cursor.execute('''
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
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        path TEXT NOT NULL,
        created TEXT NOT NULL,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS large_data (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data_type TEXT NOT NULL,
        storage_type TEXT NOT NULL,
        content BLOB,
        filepath TEXT,
        created TEXT NOT NULL,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS test_results (
        id TEXT PRIMARY KEY,
        test_id TEXT NOT NULL,
        iteration INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        frequency REAL,
        voltage REAL,
        temperature REAL,
        power_consumption REAL,
        execution_time REAL,
        success BOOLEAN NOT NULL,
        error_rate REAL,
        raw_data TEXT,
        FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        email TEXT,
        timestamp TEXT NOT NULL,
        status TEXT DEFAULT 'new',
        response TEXT
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS documentation (
        id TEXT PRIMARY KEY,
        section_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        created TEXT NOT NULL,
        updated TEXT NOT NULL,
        created_by TEXT,
        updated_by TEXT
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created TEXT NOT NULL,
        last_login TEXT
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS api_metrics (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        response_time REAL NOT NULL,
        timestamp TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        data_size INTEGER
    )''')
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS hardware_status (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        device_type TEXT NOT NULL,
        status TEXT NOT NULL,
        temperature REAL,
        voltage REAL,
        last_seen TEXT NOT NULL,
        metadata TEXT
    )''')

    # New table: system metrics (CPU & memory)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS system_metrics (
        timestamp TEXT PRIMARY KEY,
        cpu_percent REAL NOT NULL,
        mem_total INTEGER NOT NULL,
        mem_available INTEGER NOT NULL,
        mem_used INTEGER NOT NULL
    )''')

    # New table: system announcements
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        message TEXT NOT NULL,
        admin_user TEXT,
        created TEXT NOT NULL,
        expires TEXT,
        is_active BOOLEAN DEFAULT 1
    )''')

    conn.commit()
    conn.close()

# Initialize database at startup
init_db()

# --- Background System Metrics Collector ---
def collect_system_metrics():
    tz = pytz.timezone('America/Detroit')
    while True:
        now = datetime.now(tz).isoformat()
        vm = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR IGNORE INTO system_metrics (
                timestamp, cpu_percent, mem_total, mem_available, mem_used
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            now,
            cpu,
            vm.total,
            vm.available,
            vm.used
        ))
        conn.commit()
        conn.close()
        time.sleep(5)

threading.Thread(target=collect_system_metrics, daemon=True).start()

# --- Database Helper Functions ---
def get_db_connection():
    """Get a connection to the SQLite database with improved concurrency handling"""
    conn = sqlite3.connect(str(DB_PATH), timeout=10)  # Add timeout for busy handling
    
    # Enable WAL mode for better concurrency
    conn.execute("PRAGMA journal_mode=WAL")
    
    # Set busy timeout to wait instead of failing immediately (5 second timeout)
    conn.execute("PRAGMA busy_timeout=5000")
    
    # Turn on foreign key support
    conn.execute("PRAGMA foreign_keys=ON")
    
    # Return dictionary-like rows
    conn.row_factory = sqlite3.Row
    
    return conn

def dict_from_row(row):
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}

# --- Hardware and Device Communication ---
# Global serial connection cache
SERIAL_CONNECTIONS = {}

# --- Servo Control Configuration ---
SERVO_PINS = (12, 13, 18)          # hardware‑PWM GPIOs
SERVO_MIN_US = 0.5 / 1000          # 0.0005 s
SERVO_MAX_US = 2.4 / 1000          # 0.0024 s

# --- Servo Control Implementation ---
try:
    from gpiozero import AngularServo
    
    def _create_servos(pins):
        out = [
            AngularServo(
                pin,
                min_angle=0,
                max_angle=180,
                min_pulse_width=SERVO_MIN_US,
                max_pulse_width=SERVO_MAX_US,
            )
            for pin in pins
        ]
        for s in out:
            s.angle = None
        return out
    
    servos = _create_servos(SERVO_PINS)
    
    def move_servo(index, angle):
        if not 0 <= index < len(servos):
            raise IndexError(f"Servo {index} out of range (0‑{len(servos)-1})")
        servos[index].angle = angle
    
    def release_servos():
        for s in servos:
            s.angle = None
    
    def press_button_servo0():
        move_servo(0, 120); time.sleep(0.5)
        move_servo(0, 85);  time.sleep(0.1)
        move_servo(0, 120); time.sleep(0.5)
        move_servo(0, None)
    
    def press_button_servo1():
        move_servo(1, 50); time.sleep(0.5)
        move_servo(1, 28); time.sleep(0.1)
        move_servo(1, 50); time.sleep(0.5)
        move_servo(1, None)
    
    def press_button_servo2():
        move_servo(2, 90); time.sleep(0.5)
        move_servo(2, 40); time.sleep(0.3)
        move_servo(2, 90); time.sleep(0.5)
        move_servo(2, None)
    
    def reset_all():
        """Equivalent to running press0, press1, press2 in sequence."""
        press_button_servo0()
        press_button_servo1()
        press_button_servo2()
        
    SERVO_AVAILABLE = True
    
except ImportError:
    # If gpiozero is not available, provide mock functions for non-GPIO environments
    def move_servo(index, angle):
        logger.info(f"MOCK: Move servo {index} to angle {angle}")
    
    def release_servos():
        logger.info("MOCK: Release all servos")
    
    def press_button_servo0():
        logger.info("MOCK: Press button with servo 0")
    
    def press_button_servo1():
        logger.info("MOCK: Press button with servo 1")
    
    def press_button_servo2():
        logger.info("MOCK: Press button with servo 2")
    
    def reset_all():
        logger.info("MOCK: Reset all servos")
    
    SERVO_AVAILABLE = False


# --- File Storage Config & Other Helpers ---
UPLOAD_FOLDER = Path.home() / "ksat-api" / "uploads"
LARGE_DATA_FOLDER = Path.home() / "ksat-api" / "large_data"
ALLOWED_EXTENSIONS = {'cnf', 'zip', 'txt', 'json'}
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)
LARGE_DATA_FOLDER.mkdir(parents=True, exist_ok=True)
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
def generate_id():
    ts = int(datetime.now(pytz.timezone('America/Detroit')).timestamp())
    return f"{ts}-{uuid.uuid4().hex[:8]}"

@app.route('/api/system/serial-ports', methods=['GET'])
def get_serial_ports():
    """Get a list of available serial ports"""
    try:
        import serial.tools.list_ports
        ports = serial.tools.list_ports.comports()
        
        # First look for actual USB devices (ttyACM/ttyUSB)
        port_list = []
        usb_ports = []
        
        for port in ports:
            port_info = {
                'path': port.device,
                'description': port.description,
                'hardware_id': port.hwid if hasattr(port, 'hwid') else None,
                'is_usb': 'USB' in port.description or 'ttyACM' in port.device or 'ttyUSB' in port.device
            }
            
            if port_info['is_usb']:
                usb_ports.append(port_info)
            port_list.append(port_info)
            
        # If we found USB devices, associate them with platform names
        mapped_ports = []
        if usb_ports:
            # Sort by device name to get consistent ordering
            usb_ports.sort(key=lambda p: p['path'])
            platform_names = ['LDPC', '3SAT', 'KSAT']
            
            for i, port in enumerate(usb_ports):
                if i < len(platform_names):
                    port['suggested_platform'] = platform_names[i]
                    mapped_ports.append(port)
        
        # Add all other ports after the USB ports
        for port in port_list:
            if port not in mapped_ports:
                mapped_ports.append(port)
            
        return jsonify({
            'success': True,
            'serial_ports': mapped_ports
        })
    except Exception as e:
        logger.error(f"Error listing serial ports: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/serial-data/<port>', methods=['GET'])
def get_serial_data(port):
    """Read data from a serial port"""
    try:
        # Add /dev/ prefix if not present
        if not port.startswith('/dev/'):
            port_path = f"/dev/{port}"
        else:
            port_path = port
            
        # Create or reuse serial connection
        if port not in SERIAL_CONNECTIONS or not SERIAL_CONNECTIONS[port].is_open:
            # Try common baud rates
            baud_rates = [115200, 9600, 57600, 38400]
            
            for baud_rate in baud_rates:
                try:
                    ser = serial.Serial(port_path, baud_rate, timeout=0.1)
                    SERIAL_CONNECTIONS[port] = ser
                    logger.info(f"Connected to {port_path} at {baud_rate} baud")
                    break
                except Exception as e:
                    logger.error(f"Failed to connect to {port_path} at {baud_rate} baud: {e}")
                    continue
            else:
                raise Exception(f"Could not connect to {port_path} at any baud rate")
        
        # Read data with timeout
        ser = SERIAL_CONNECTIONS[port]
        data = ""
        
        start_time = time.time()
        while time.time() - start_time < 0.5:  # 500ms timeout
            if ser.in_waiting > 0:
                new_data = ser.read(ser.in_waiting).decode('utf-8', errors='replace')
                data += new_data
            time.sleep(0.05)
                
        return jsonify({
            'success': True,
            'port': port,
            'data': data
        })
    except Exception as e:
        logger.error(f"Error reading from serial port {port}: {e}")
        return jsonify({'error': str(e)}), 500

# --- API Metrics Middleware ---
@app.before_request
def start_timer():
    request.start_time = time.time()

@app.after_request
def log_request(response):
    if request.path.startswith('/api/'):
        # Skip OPTIONS requests and health checks to reduce log noise
        if request.method != 'OPTIONS' and not request.path.endswith('/health'):
            try:
                # Calculate response time
                response_time = time.time() - getattr(request, 'start_time', time.time())
                
                # Get response size
                response_size = len(response.get_data())
                
                # Log to API metrics table
                conn = get_db_connection()
                cursor = conn.cursor()
                
                cursor.execute('''
                INSERT INTO api_metrics (
                    id, endpoint, method, status_code, response_time, 
                    timestamp, ip_address, user_agent, data_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    generate_id(),
                    request.path,
                    request.method,
                    response.status_code,
                    response_time,
                    datetime.now(pytz.timezone('America/Detroit')).isoformat(),
                    request.remote_addr,
                    request.user_agent.string if request.user_agent else None,
                    response_size
                ))
                
                conn.commit()
                conn.close()
                
                # Log slow responses
                if response_time > 0.5:  # Log requests taking more than 500ms
                    logger.warning(f"Slow response: {request.method} {request.path} ({response_time:.2f}s)")
                
            except Exception as e:
                logger.error(f"Error logging API metrics: {e}")
                
    return response

# --- API Endpoints ---
@app.route('/api/admin/command', methods=['POST'])
def execute_command():
    """Execute a command on the server and return the output"""
    try:
        data = request.json
        if not data or 'command' not in data:
            return jsonify({'error': 'Missing command'}), 400
            
        command = data['command']
        
        # For security, limit the commands that can be executed
        allowed_prefixes = [
            'systemctl status ksat-api',
            'systemctl restart ksat-api',
            'systemctl start ksat-api', 
            'systemctl stop ksat-api',
            'ls', 'ps', 'df', 'free', 'cat /proc/cpuinfo', 
            'python3 -m', 'cat /var/log/',
            'cat /home/medusa/ksat-api/logs/',
            'journalctl -u ksat-api',
            'cat /dev/tty',  # Allow reading from serial ports
            'ls -l /dev/tty',  # Allow listing serial ports
            'stty -F /dev/tty',  # Allow configuring serial ports
            'lsusb',  # List USB devices
            'dmesg | grep tty'  # Show kernel messages about TTY devices
        ]
        
        # Validate command is allowed
        is_allowed = False
        for prefix in allowed_prefixes:
            if command.startswith(prefix):
                is_allowed = True
                break
                
        if not is_allowed:
            return jsonify({
                'error': 'Command not allowed',
                'output': f"For security reasons, this command is not allowed.\nAllowed commands start with: {', '.join(allowed_prefixes)}"
            }), 403
        
        # Execute command
        process = subprocess.Popen(
            command,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=15)  # 15 second timeout
        
        return jsonify({
            'success': process.returncode == 0,
            'output': stdout,
            'error': stderr,
            'command': command
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({
            'error': 'Command timed out',
            'output': 'The command took too long to execute (>15s)'
        }), 500
    except Exception as e:
        logger.error(f"Error executing command: {e}")
        return jsonify({
            'error': 'Failed to execute command',
            'message': str(e)
        }), 500

@app.route('/api/tests', methods=['GET', 'POST'])
def handle_tests():
    if request.method == 'GET':
        env = request.args.get('environment', 'production').lower()
        ms = int(request.args.get('timeRange', 43200000))
        now = datetime.now(pytz.timezone('America/Detroit'))
        cutoff = now - timedelta(milliseconds=ms)
        cutoff_str = cutoff.isoformat()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if test_mode column exists in the table
        try:
            cursor.execute("SELECT * FROM tests WHERE created > ? ORDER BY created DESC", (cutoff_str,))
            rows = cursor.fetchall()
            conn.close()
            
            tests = [dict_from_row(row) for row in rows]
            formatted = []
            for t in tests:
                meta = json.loads(t.get('metadata') or '{}')
                test_mode = t.get('test_mode', t.get('environment'))
                formatted.append({
                    'id': t['id'],
                    'name': t['name'],
                    'chipType': t['chip_type'],
                    'testMode': test_mode,
                    'created': t['created'],
                    'status': t['status'],
                    'metadata': meta
                })
            return jsonify(formatted)
            
        except Exception as e:
            logger.error(f"Error fetching tests: {e}")
            conn.close()
            return jsonify([]), 500

    # POST
    data = request.json or {}
    for field in ('name', 'chipType', 'testMode'):
        if field not in data:
            return jsonify({'error': f"Missing '{field}'"}), 400

    test_id = generate_id()
    now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
    
    # Extract metadata (any fields not in our standard schema)
    standard_fields = {'name', 'chipType', 'testMode'}
    metadata = {k: v for k, v in data.items() if k not in standard_fields}
    metadata_json = json.dumps(metadata) if metadata else None
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if test_mode column exists or use environment column
    cursor.execute("PRAGMA table_info(tests)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'test_mode' in columns:
        cursor.execute(
            "INSERT INTO tests (id, name, chip_type, test_mode, created, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (test_id, data['name'], data['chipType'], data['testMode'], now, 'queued', metadata_json)
        )
    else:
        # Use environment column instead of test_mode
        cursor.execute(
            "INSERT INTO tests (id, name, chip_type, environment, created, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (test_id, data['name'], data['chipType'], data['testMode'], now, 'queued', metadata_json)
        )
    
    conn.commit()
    
    cursor.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
    trow = dict_from_row(cursor.fetchone())
    conn.close()
    
    meta = json.loads(trow.get('metadata') or '{}')
    
    # Handle mapping correctly in the response
    test_mode = trow.get('test_mode', trow.get('environment'))
    
    return jsonify({
        'id': trow['id'],
        'name': trow['name'],
        'chipType': trow['chip_type'],
        'testMode': test_mode,
        'created': trow['created'],
        'status': trow['status'],
        'metadata': meta
    }), 201

@app.route('/api/tests/<test_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_test(test_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
    trow = dict_from_row(cursor.fetchone())
    
    if not trow:
        conn.close()
        return jsonify({'error': 'Not found'}), 404

    # GET single test
    if request.method == 'GET':
        # files
        cursor.execute("SELECT * FROM files WHERE test_id = ?", (test_id,))
        files = [dict_from_row(row) for row in cursor.fetchall()]
        # large_data
        cursor.execute(
            "SELECT id, name, data_type, storage_type, created FROM large_data WHERE test_id = ?",
            (test_id,)
        )
        large_data = [dict_from_row(row) for row in cursor.fetchall()]
        conn.close()

        meta = json.loads(trow.get('metadata') or '{}')
        test_mode = trow.get('test_mode', trow.get('environment'))
        formatted = {
            'id': trow['id'],
            'name': trow['name'],
            'chipType': trow['chip_type'],
            'testMode': test_mode,
            'created': trow['created'],
            'status': trow['status'],
            'files': files,
            'large_data': large_data,
            'metadata': meta
        }
        return jsonify(formatted)

    # PUT update
    if request.method == 'PUT':
        updates = request.json or {}
        standard_fields = {'name', 'chipType', 'testMode', 'status'}
        update_fields = {}
        meta_updates = {}
        for k, v in updates.items():
            if k in standard_fields:
                field_name = 'chip_type' if k == 'chipType' else k
                update_fields[field_name] = v
            else:
                meta_updates[k] = v

        if meta_updates:
            curr_meta = json.loads(trow.get('metadata') or '{}')
            curr_meta.update(meta_updates)
            update_fields['metadata'] = json.dumps(curr_meta)

        if update_fields:
            clause = ", ".join(f"{f}=?" for f in update_fields)
            vals = list(update_fields.values()) + [test_id]
            cursor.execute(f"UPDATE tests SET {clause} WHERE id = ?", vals)
            conn.commit()

        cursor.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
        updated = dict_from_row(cursor.fetchone())
        conn.close()

        meta = json.loads(updated.get('metadata') or '{}')
        test_mode = updated.get('test_mode', updated.get('environment'))
        return jsonify({
            'id': updated['id'],
            'name': updated['name'],
            'chipType': updated['chip_type'],
            'testMode': test_mode,
            'created': updated['created'],
            'status': updated['status'],
            'metadata': meta
        })

    # DELETE
    # delete files from disk
    cursor.execute("SELECT filepath FROM files WHERE test_id = ?", (test_id,))
    paths = [row[0] for row in cursor.fetchall()]
    for p in paths:
        fp = Path(p)
        if fp.exists():
            try:
                fp.unlink()
            except Exception as e:
                logger.error(f"Error deleting file {p}: {e}")

    # delete large_data files
    cursor.execute(
        "SELECT filepath FROM large_data WHERE test_id = ? AND storage_type = 'file'",
        (test_id,)
    )
    dpaths = [row[0] for row in cursor.fetchall()]
    for p in dpaths:
        dp = Path(p)
        if dp.exists():
            try:
                dp.unlink()
            except Exception as e:
                logger.error(f"Error deleting data file {p}: {e}")

    # delete DB entries
    cursor.execute("DELETE FROM files WHERE test_id = ?", (test_id,))
    cursor.execute("DELETE FROM large_data WHERE test_id = ?", (test_id,))
    cursor.execute("DELETE FROM tests WHERE id = ?", (test_id,))
    conn.commit()
    conn.close()
    return '', 204

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'files' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    test_id = request.form.get('test_id')
    if test_id:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tests WHERE id = ?", (test_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Test ID {test_id} not found'}), 404
        conn.close()

    files = request.files.getlist('files')
    results, errors = [], []
    now = datetime.now(pytz.timezone('America/Detroit')).isoformat()

    conn = get_db_connection()
    cursor = conn.cursor()

    for f in files:
        if f and allowed_file(f.filename):
            fname = secure_filename(f.filename)
            fid = generate_id()
            dest = UPLOAD_FOLDER / f"{fid}_{fname}"
            try:
                f.save(dest)
                size = dest.stat().st_size
                mime = f.content_type if hasattr(f, 'content_type') else None
                cursor.execute(
                    "INSERT INTO files (id, test_id, filename, file_size, path, created, mime_type) VALUES (?,?,?,?,?,?,?)",
                    (fid, test_id, fname, size, str(dest), now, mime)
                )
                results.append({
                    'id': fid,
                    'filename': fname,
                    'path': str(dest),
                    'size': size,
                    'upload_date': now,
                    'test_id': test_id
                })
            except Exception as e:
                logger.error(f"Upload error: {e}")
                errors.append(fname)
        else:
            errors.append(f.filename)

    conn.commit()
    conn.close()
    status = 201 if results else 400
    return jsonify({'files': results, 'errors': errors}), status

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Get API usage metrics"""
    try:
        # Get the time range
        time_range_ms = int(request.args.get('timeRange', '86400000'))  # Default to 24 hours
        now = datetime.now(pytz.timezone('America/Detroit'))
        cutoff = now - timedelta(milliseconds=time_range_ms)
        cutoff_str = cutoff.isoformat()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get API request metrics
        cursor.execute("""
            SELECT COUNT(*) as request_count, 
                  AVG(response_time) as avg_response_time,
                  SUM(data_size) as total_data_size
            FROM api_metrics
            WHERE timestamp > ?
        """, (cutoff_str,))
        metrics_row = cursor.fetchone()
        
        # Get status code distribution
        cursor.execute("""
            SELECT status_code, COUNT(*) as count
            FROM api_metrics
            WHERE timestamp > ?
            GROUP BY status_code
        """, (cutoff_str,))
        status_codes = [dict_from_row(row) for row in cursor.fetchall()]
        
        # Get endpoint distribution
        cursor.execute("""
            SELECT endpoint, COUNT(*) as count
            FROM api_metrics
            WHERE timestamp > ?
            GROUP BY endpoint
            ORDER BY count DESC
            LIMIT 10
        """, (cutoff_str,))
        endpoints = [dict_from_row(row) for row in cursor.fetchall()]
        
        # Get test status distribution
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM tests
            WHERE created > ?
            GROUP BY status
        """, (cutoff_str,))
        test_status = [dict_from_row(row) for row in cursor.fetchall()]
        
        # Get hardware status
        cursor.execute("""
            SELECT device_type, status, COUNT(*) as count
            FROM hardware_status
            GROUP BY device_type, status
        """)
        hardware_status = [dict_from_row(row) for row in cursor.fetchall()]
        
        conn.close()
        
        # Calculate error rate
        error_count = sum(item['count'] for item in status_codes if item['status_code'] >= 400)
        total_requests = metrics_row['request_count'] if metrics_row['request_count'] else 0
        error_rate = (error_count / total_requests * 100) if total_requests > 0 else 0
        
        # Format data size from bytes to MB
        data_size_mb = round(metrics_row['total_data_size'] / (1024 * 1024), 2) if metrics_row['total_data_size'] else 0
        
        return jsonify({
            'api_requests': metrics_row['request_count'] if metrics_row['request_count'] else 0,
            'average_response_time': round(metrics_row['avg_response_time'] * 1000, 2) if metrics_row['avg_response_time'] else 0,  # Convert to ms
            'data_transferred': data_size_mb,
            'error_rate': round(error_rate, 2),
            'status_codes': status_codes,
            'endpoints': endpoints,
            'test_status': test_status,
            'hardware_status': hardware_status,
            'time_range': time_range_ms
        })
        
    except Exception as e:
        logger.error(f"Error fetching metrics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/metrics/time-series', methods=['GET'])
def get_metrics_time_series():
    """Get time-series metrics data for charts"""
    try:
        # Get the time range and interval
        time_range_ms = int(request.args.get('timeRange', '86400000'))  # Default to 24 hours
        interval_minutes = int(request.args.get('interval', '15'))  # Default to 15-minute intervals
        
        metric_type = request.args.get('type', 'requests')  # Default to request count
        
        now = datetime.now(pytz.timezone('America/Detroit'))
        cutoff = now - timedelta(milliseconds=time_range_ms)
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Different SQL based on metric type
        if metric_type == 'requests':
            # Get request count over time
            query = """
                SELECT 
                    strftime('%Y-%m-%dT%H:%M', datetime(timestamp)) || ':00Z' as time_bucket,
                    COUNT(*) as count
                FROM api_metrics
                WHERE timestamp > ?
                GROUP BY time_bucket
                ORDER BY time_bucket
            """
        elif metric_type == 'response_time':
            # Get average response time over time
            query = """
                SELECT 
                    strftime('%Y-%m-%dT%H:%M', datetime(timestamp)) || ':00Z' as time_bucket,
                    AVG(response_time) * 1000 as value
                FROM api_metrics
                WHERE timestamp > ?
                GROUP BY time_bucket
                ORDER BY time_bucket
            """
        elif metric_type == 'data_transfer':
            # Get data transfer over time
            query = """
                SELECT 
                    strftime('%Y-%m-%dT%H:%M', datetime(timestamp)) || ':00Z' as time_bucket,
                    SUM(data_size) / (1024 * 1024) as value
                FROM api_metrics
                WHERE timestamp > ?
                GROUP BY time_bucket
                ORDER BY time_bucket
            """
        else:
            # Default to request count
            query = """
                SELECT 
                    strftime('%Y-%m-%dT%H:%M', datetime(timestamp)) || ':00Z' as time_bucket,
                    COUNT(*) as count
                FROM api_metrics
                WHERE timestamp > ?
                GROUP BY time_bucket
                ORDER BY time_bucket
            """
        
        cursor.execute(query, (cutoff.isoformat(),))
        time_series = [dict_from_row(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return jsonify({
            'type': metric_type,
            'time_range': time_range_ms,
            'interval': interval_minutes,
            'data': time_series
        })
        
    except Exception as e:
        logger.error(f"Error fetching time series metrics: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hardware', methods=['GET'])
def get_hardware_status():
    """Get the current status of connected hardware devices"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get the latest status for each device
        cursor.execute("""
            SELECT h1.*
            FROM hardware_status h1
            JOIN (
                SELECT device_id, MAX(last_seen) as max_last_seen
                FROM hardware_status
                GROUP BY device_id
            ) h2 ON h1.device_id = h2.device_id AND h1.last_seen = h2.max_last_seen
        """)
        
        hardware_devices = [dict_from_row(row) for row in cursor.fetchall()]
        
        # If no devices found, return a default set of devices
        if not hardware_devices:
            hardware_devices = [
                {
                    'id': generate_id(),
                    'device_id': 'teensy_4.1_bridge',
                    'device_type': 'bridge',
                    'status': 'online',
                    'temperature': 42.3,
                    'voltage': 3.3,
                    'last_seen': datetime.now(pytz.timezone('America/Detroit')).isoformat(),
                    'metadata': json.dumps({
                        'baud_rate': 2000000,
                        'connected_since': (datetime.now(pytz.timezone('America/Detroit')) - timedelta(hours=3)).isoformat(),
                        'firmware_version': '1.2.1'
                    })
                },
                {
                    'id': generate_id(),
                    'device_id': 'daedalus_solver',
                    'device_type': 'solver',
                    'status': 'online',
                    'temperature': 45.7,
                    'voltage': 5.0,
                    'last_seen': datetime.now(pytz.timezone('America/Detroit')).isoformat(),
                    'metadata': json.dumps({
                        'oscillator_count': 50,
                        'active_oscillators': 48,
                        'current_draw': 120, # mA
                        'model': 'Daedalus K-SAT v2.1'
                    })
                },
                {
                    'id': generate_id(),
                    'device_id': 'embedded_control',
                    'device_type': 'controller',
                    'status': 'online',
                    'temperature': 36.9,
                    'voltage': 3.3,
                    'last_seen': datetime.now(pytz.timezone('America/Detroit')).isoformat(),
                    'metadata': json.dumps({
                        'free_memory': 218400, # bytes
                        'uptime': 267840, # seconds
                        'processor': 'ARM Cortex-M7'
                    })
                }
            ]
        
        return jsonify(hardware_devices)
        
    except Exception as e:
        logger.error(f"Error fetching hardware status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hardware/<device_id>', methods=['GET'])
def get_single_hardware_device(device_id):
    """Get status of a specific hardware device"""
    try:
        # Validate device ID format
        if not re.match(r'^machine-[1-3]$', device_id):
            return jsonify({'error': 'Invalid device ID format'}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Try to fetch from hardware_status table
        cursor.execute(
            "SELECT * FROM hardware_status WHERE device_id = ? ORDER BY last_seen DESC LIMIT 1",
            (device_id,)
        )
        
        row = cursor.fetchone()
        
        # If no existing record, create a mock status based on device ID
        if not row:
            # For demo purposes, generate realistic looking mock data
            device_type = "Processor" if device_id == "machine-1" else "Memory Controller" if device_id == "machine-2" else "I/O Controller"
            status = random.choice(["online", "online", "online", "degraded"]) # Mostly online
            temperature = round(random.uniform(30, 65), 1)  # Normal temp range
            voltage = round(random.uniform(0.9, 1.3), 2)    # Normal voltage range
            last_seen = datetime.now(pytz.timezone('America/Detroit')).isoformat()
            
            # Create a mock status
            status_data = {
                'id': generate_id(),
                'device_id': device_id,
                'device_type': device_type,
                'status': status,
                'temperature': temperature,
                'voltage': voltage,
                'last_seen': last_seen,
                'metadata': json.dumps({
                    'baud_rate': 2000000,
                    'connected_since': (datetime.now(pytz.timezone('America/Detroit')) - timedelta(hours=3)).isoformat(),
                    'firmware_version': '1.2.1'
                })
            }
            
            # Insert status into database for future requests
            try:
                cursor.execute('''
                INSERT INTO hardware_status (
                    id, device_id, device_type, status, temperature, voltage, last_seen, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', 
                (
                    status_data['id'], status_data['device_id'], status_data['device_type'],
                    status_data['status'], status_data['temperature'], status_data['voltage'],
                    status_data['last_seen'], status_data['metadata']
                ))
                conn.commit()
            except sqlite3.Error as e:
                logger.error(f"Error inserting hardware status: {e}")
                # Continue even if insert fails
                
            conn.close()
            
            # Include metadata as parsed JSON
            status_data['metadata'] = json.loads(status_data['metadata'])
            return jsonify(status_data)
            
        # Format the existing record
        status_data = dict_from_row(row)
        
        # Parse metadata JSON if it exists
        if status_data.get('metadata'):
            try:
                status_data['metadata'] = json.loads(status_data['metadata'])
            except json.JSONDecodeError:
                status_data['metadata'] = {}
        
        conn.close()
        return jsonify(status_data)
        
    except Exception as e:
        logger.error(f"Error fetching hardware status: {e}")
        return jsonify({'error': 'Failed to retrieve hardware status'}), 500

@app.route('/api/hardware/<device_id>', methods=['POST'])
def update_hardware_status(device_id):
    """Update the status of a hardware device (called by hardware bridges)"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        required_fields = ['device_type', 'status']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f"Missing required field '{field}'"}), 400
        
        # Extract hardware metadata
        standard_fields = {'device_type', 'status', 'temperature', 'voltage'}
        metadata = {k: v for k, v in data.items() if k not in standard_fields}
        metadata_json = json.dumps(metadata) if metadata else None
        
        # Create a new status entry
        status_id = generate_id()
        now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO hardware_status (
                id, device_id, device_type, status, temperature, voltage, 
                last_seen, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            status_id,
            device_id,
            data['device_type'],
            data['status'],
            data.get('temperature'),
            data.get('voltage'),
            now,
            metadata_json
        ))
        
        conn.commit()
        
        # Get the inserted record
        cursor.execute("SELECT * FROM hardware_status WHERE id = ?", (status_id,))
        status = dict_from_row(cursor.fetchone())
        conn.close()
        
        return jsonify(status), 201
        
    except Exception as e:
        logger.error(f"Error updating hardware status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/large-data', methods=['POST'])
def store_large_data():
    """Store large JSON or text data"""
    data = request.json or {}
    required_fields = ['name', 'data_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f"Missing required field '{field}'"}), 400

    name = data['name']
    dtype = data['data_type'].lower()
    test_id = data.get('test_id')
    content = data.get('content')
    if not content:
        return jsonify({'error': "Missing 'content' field"}), 400

    if test_id:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM tests WHERE id = ?", (test_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': f'Test ID {test_id} not found'}), 404
        conn.close()

    data_id = generate_id()
    now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
    content_str = json.dumps(content) if dtype == 'json' else content
    size = len(content_str.encode('utf-8'))

    conn = get_db_connection()
    cursor = conn.cursor()
    if size > 1024 * 1024:
        storage_type = 'file'
        ext = 'json' if dtype == 'json' else 'txt'
        filepath = str(LARGE_DATA_FOLDER / f"{data_id}.{ext}")
        with open(filepath, 'w', encoding='utf-8') as f:
            if dtype == 'json':
                json.dump(content, f)
            else:
                f.write(content)
        cursor.execute(
            "INSERT INTO large_data (id, test_id, name, data_type, storage_type, filepath, created) VALUES (?,?,?,?,?,?,?)",
            (data_id, test_id, name, dtype, storage_type, filepath, now)
        )
    else:
        storage_type = 'blob'
        cursor.execute(
            "INSERT INTO large_data (id, test_id, name, data_type, storage_type, content, created) VALUES (?,?,?,?,?,?,?)",
            (data_id, test_id, name, dtype, storage_type, content_str, now)
        )

    conn.commit()
    conn.close()
    return jsonify({
        'id': data_id,
        'name': name,
        'data_type': dtype,
        'storage_type': storage_type,
        'created': now,
        'test_id': test_id
    }), 201

@app.route('/api/large-data/<data_id>', methods=['GET'])
def get_large_data(data_id):
    """Retrieve large JSON or text data by ID"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM large_data WHERE id = ?", (data_id,))
    record = dict_from_row(cursor.fetchone())
    conn.close()
    if not record:
        return jsonify({'error': 'Data not found'}), 404

    download = request.args.get('download', 'false').lower() == 'true'
    if record['storage_type'] == 'file':
        filepath = record['filepath']
        if download:
            filename = f"{record['name']}.{record['data_type']}"
            return send_file(filepath, as_attachment=True, download_name=filename)
        else:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = json.load(f) if record['data_type'] == 'json' else f.read()
            return jsonify({
                'id': record['id'],
                'name': record['name'],
                'data_type': record['data_type'],
                'content': content,
                'created': record['created'],
                'test_id': record['test_id']
            })
    else:
        content_str = record['content']
        content = json.loads(content_str) if record['data_type'] == 'json' else content_str
        if download:
            ext = 'json' if record['data_type'] == 'json' else 'txt'
            temp_file = UPLOAD_FOLDER / f"temp_{data_id}.{ext}"
            with open(temp_file, 'w', encoding='utf-8') as f:
                if record['data_type'] == 'json':
                    json.dump(content, f)
                else:
                    f.write(content)
            filename = f"{record['name']}.{ext}"
            return send_file(str(temp_file), as_attachment=True, download_name=filename)
        else:
            return jsonify({
                'id': record['id'],
                'name': record['name'],
                'data_type': record['data_type'],
                'content': content,
                'created': record['created'],
                'test_id': record['test_id']
            })

@app.route('/api/solve', methods=['POST'])
def solve():
    data = request.json or {}
    fname = data.get('filename')
    if not fname:
        return jsonify({'error': "Missing 'filename'"}), 400

    result = {
        'id': generate_id(),
        'status': 'completed',
        'result': {'satisfiable': True},
        'completed': datetime.now(pytz.timezone('America/Detroit')).isoformat()
    }
    return jsonify(result)

@app.route('/api/health', methods=['GET'])
def health_check():
    now = datetime.now(pytz.timezone('America/Detroit'))
    db_status = 'online'
    
    try:
        conn = get_db_connection()
        conn.execute('SELECT 1')
        conn.close()
    except Exception as e:
        db_status = f'error: {e}'
        logger.error(f"Database health check failed: {e}")
    
    # Check if hardware connection is configured
    hardware_status = 'ok'
    hardware_details = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if we have any hardware status records at all
        cursor.execute("SELECT COUNT(*) as count FROM hardware_status")
        total_hardware_count = cursor.fetchone()['count']
        
        if total_hardware_count > 0:
            # Check if any hardware is marked as offline
            cursor.execute("""
                SELECT h1.device_id, h1.device_type 
                FROM hardware_status h1
                JOIN (
                    SELECT device_id, MAX(last_seen) as max_last_seen
                    FROM hardware_status
                    GROUP BY device_id
                ) h2 ON h1.device_id = h2.device_id AND h1.last_seen = h2.max_last_seen
                WHERE h1.status = 'offline'
                LIMIT 5
            """)
            
            offline_devices = cursor.fetchall()
            if offline_devices:
                hardware_status = 'degraded'
                offline_names = [f"{row['device_type']} ({row['device_id']})" for row in offline_devices]
                hardware_details = f"Offline devices: {', '.join(offline_names)}"
        else:
            # No hardware records, but this might be normal if hardware monitoring is not set up
            hardware_status = 'ok'
            hardware_details = 'No hardware devices configured'
            
        conn.close()
    except Exception as e:
        hardware_status = 'error'
        hardware_details = str(e)
        logger.error(f"Hardware health check failed: {e}")
    
    # Check overall API status - only report degraded if hardware is explicitly offline
    if db_status == 'online' and hardware_status == 'ok':
        api_status = 'ok'
    elif db_status.startswith('error'):
        api_status = 'offline'
    else:
        api_status = 'degraded'
    
    return jsonify({
        'api_status': api_status,
        'db_status': db_status,
        'hardware_status': hardware_status,
        'hardware_details': hardware_details,
        'timestamp': now.isoformat(),
    }), 200

@app.route('/api/tests/<test_id>/results', methods=['POST'])
def add_test_results(test_id):
    """Add results for a hardware-in-the-loop test"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify test exists
        cursor.execute("SELECT id FROM tests WHERE id = ?", (test_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Test not found'}), 404

        # Insert test results
        result_id = str(uuid.uuid4())
        cursor.execute("""
        INSERT INTO test_results (
            id, test_id, iteration, timestamp,
            frequency, voltage, temperature,
            power_consumption, execution_time,
            success, error_rate, raw_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            result_id,
            test_id,
            data.get('iteration'),
            datetime.now().isoformat(),
            data.get('hardware', {}).get('frequency'),
            data.get('hardware', {}).get('voltage'),
            data.get('hardware', {}).get('temperature'),
            data.get('power_consumption'),
            data.get('execution_time'),
            data.get('success', False),
            data.get('error_rate'),
            json.dumps(data.get('raw_data', {}))
        ))

        conn.commit()

        # Update test status if needed
        if data.get('final_iteration', False):
            cursor.execute("""
            UPDATE tests
            SET status = 'completed'
            WHERE id = ?
            """, (test_id,))
            conn.commit()

        # Get the inserted result
        cursor.execute("""
        SELECT * FROM test_results
        WHERE id = ?
        """, (result_id,))
        result = cursor.fetchone()
        conn.close()

        return jsonify({
            'id': result[0],
            'test_id': result[1],
            'iteration': result[2],
            'timestamp': result[3],
            'hardware': {
                'frequency': result[4],
                'voltage': result[5],
                'temperature': result[6]
            },
            'power_consumption': result[7],
            'execution_time': result[8],
            'success': bool(result[9]),
            'error_rate': result[10],
            'raw_data': json.loads(result[11]) if result[11] else None
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tests/<test_id>/results', methods=['GET'])
def get_test_results(test_id):
    """Get all results for a specific test"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Verify test exists
        cursor.execute("SELECT id FROM tests WHERE id = ?", (test_id,))
        if not cursor.fetchone():
            return jsonify({'error': 'Test not found'}), 404

        # Get all results for the test
        cursor.execute("""
        SELECT * FROM test_results
        WHERE test_id = ?
        ORDER BY iteration ASC
        """, (test_id,))
        
        results = []
        for row in cursor.fetchall():
            results.append({
                'id': row[0],
                'test_id': row[1],
                'iteration': row[2],
                'timestamp': row[3],
                'hardware': {
                    'frequency': row[4],
                    'voltage': row[5],
                    'temperature': row[6]
                },
                'power_consumption': row[7],
                'execution_time': row[8],
                'success': bool(row[9]),
                'error_rate': row[10],
                'raw_data': json.loads(row[11]) if row[11] else None
            })

        conn.close()
        return jsonify(results), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/', methods=['GET'])
def home():
    now = datetime.now(pytz.timezone('America/Detroit'))
    return jsonify({
        'name': 'Dacroq K-SAT API',
        'version': '1.0',
        'timestamp': now.isoformat(),
    })

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    """Store user feedback"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Validate required fields
        if 'description' not in data or not data['description'].strip():
            return jsonify({'error': 'Description is required'}), 400
            
        if 'type' not in data or not data['type'].strip():
            return jsonify({'error': 'Feedback type is required'}), 400
        
        # Generate ID and timestamp    
        feedback_id = generate_id()
        timestamp = data.get('timestamp') or datetime.now().isoformat()
        
        # Insert feedback into database
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
        INSERT INTO feedback (id, type, description, email, timestamp, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            feedback_id,
            data['type'],
            data['description'],
            data.get('email'),
            timestamp,
            'new'
        ))
        
        conn.commit()
        
        # Log the feedback submission
        logger.info(f"Feedback submitted: ID {feedback_id}, Type: {data['type']}")
        
        # Get the inserted feedback
        cursor.execute("SELECT * FROM feedback WHERE id = ?", (feedback_id,))
        feedback = dict_from_row(cursor.fetchone())
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully',
            'id': feedback_id,
            'feedback': feedback
        }), 201
        
    except Exception as e:
        logger.error(f"Error submitting feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/tests/<test_id>/rerun', methods=['POST'])
def rerun_test(test_id):
    """Rerun an existing test"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Verify test exists
        cursor.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
        test = dict_from_row(cursor.fetchone())
        
        if not test:
            conn.close()
            return jsonify({'error': 'Test not found'}), 404
        
        # Create a new test with the same parameters
        new_test_id = generate_id()
        now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
        
        # Copy test data but set status to queued
        cursor.execute("""
            INSERT INTO tests (id, name, chip_type, test_mode, environment, config, status, created, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_test_id,
            f"{test['name']} (Rerun)",
            test['chip_type'],
            test.get('test_mode'),
            test.get('environment'),
            test.get('config'),
            'queued',
            now,
            test.get('metadata')
        ))
        
        # Copy associated files if needed
        cursor.execute("SELECT * FROM files WHERE test_id = ?", (test_id,))
        files = [dict_from_row(row) for row in cursor.fetchall()]
        
        for file in files:
            file_id = generate_id()
            cursor.execute("""
                INSERT INTO files (id, test_id, filename, file_size, path, created, mime_type)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                file_id,
                new_test_id,
                file['filename'],
                file['file_size'],
                file['path'],
                now,
                file.get('mime_type')
            ))
        
        conn.commit()
        
        # Get the newly created test
        cursor.execute("SELECT * FROM tests WHERE id = ?", (new_test_id,))
        new_test = dict_from_row(cursor.fetchone())
        conn.close()
        
        meta = json.loads(new_test.get('metadata') or '{}')
        test_mode = new_test.get('test_mode', new_test.get('environment'))
        
        return jsonify({
            'id': new_test['id'],
            'name': new_test['name'],
            'chipType': new_test['chip_type'],
            'testMode': test_mode,
            'created': new_test['created'],
            'status': new_test['status'],
            'metadata': meta
        }), 201
        
    except Exception as e:
        logger.error(f"Error rerunning test: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/docs', methods=['GET'])
def get_all_docs():
    """Retrieve all documentation sections"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM documentation ORDER BY title')
        docs = [dict_from_row(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify(docs), 200
    except Exception as e:
        logger.error(f"Error fetching documentation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/docs/<section_id>', methods=['GET'])
def get_doc_section(section_id):
    """Retrieve a specific documentation section"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM documentation WHERE section_id = ?', (section_id,))
        doc = dict_from_row(cursor.fetchone())
        conn.close()
        
        if not doc:
            return jsonify({'error': 'Documentation section not found'}), 404
            
        return jsonify(doc), 200
    except Exception as e:
        logger.error(f"Error fetching documentation section: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/docs/<section_id>', methods=['PUT'])
def update_doc_section(section_id):
    """Update a documentation section"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Validate required fields
        if 'title' not in data or not data['title'].strip():
            return jsonify({'error': 'Title is required'}), 400
            
        if 'content' not in data or not data['content'].strip():
            return jsonify({'error': 'Content is required'}), 400
        
        now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if section exists
        cursor.execute('SELECT id FROM documentation WHERE section_id = ?', (section_id,))
        existing = cursor.fetchone()
        
        if existing:
            # Update existing section
            cursor.execute('''
            UPDATE documentation 
            SET title = ?, content = ?, updated = ?, updated_by = ?
            WHERE section_id = ?
            ''', (
                data['title'],
                data['content'],
                now,
                data.get('updated_by'),
                section_id
            ))
        else:
            # Create new section
            doc_id = generate_id()
            cursor.execute('''
            INSERT INTO documentation (id, section_id, title, content, created, updated, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                doc_id,
                section_id,
                data['title'],
                data['content'],
                now,
                now,
                data.get('created_by'),
                data.get('updated_by')
            ))
        
        conn.commit()
        
        # Get the updated document
        cursor.execute('SELECT * FROM documentation WHERE section_id = ?', (section_id,))
        doc = dict_from_row(cursor.fetchone())
        conn.close()
        
        return jsonify(doc), 200
        
    except Exception as e:
        logger.error(f"Error updating documentation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/docs/<section_id>', methods=['DELETE'])
def delete_doc_section(section_id):
    """Delete a documentation section"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if section exists
        cursor.execute('SELECT id FROM documentation WHERE section_id = ?', (section_id,))
        existing = cursor.fetchone()
        
        if not existing:
            conn.close()
            return jsonify({'error': 'Documentation section not found'}), 404
            
        # Delete the section
        cursor.execute('DELETE FROM documentation WHERE section_id = ?', (section_id,))
        conn.commit()
        conn.close()
        
        return '', 204
    except Exception as e:
        logger.error(f"Error deleting documentation section: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/check-admin', methods=['GET'])
def check_admin():
    """Check if a user has admin privileges"""
    try:
        email = request.args.get('email')
        
        if not email:
            return jsonify({'error': 'Email parameter is required'}), 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT role FROM users WHERE email = ?', (email,))
        user = cursor.fetchone()
        conn.close()
        
        if not user:
            return jsonify({'isAdmin': False}), 200
            
        is_admin = user['role'] == 'admin'
        
        return jsonify({'isAdmin': is_admin}), 200
    except Exception as e:
        logger.error(f"Error checking admin status: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system-metrics/time-series', methods=['GET'])
def get_system_time_series():
    """
    Returns CPU % and memory usage over time for the last timeRange ms.
    """
    try:
        time_range_ms = int(request.args.get('timeRange', '300000'))
        tz = pytz.timezone('America/Detroit')
        now = datetime.now(tz)
        cutoff = now - timedelta(milliseconds=time_range_ms)
        cutoff_str = cutoff.isoformat()

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, cpu_percent, mem_used, mem_available
            FROM system_metrics
            WHERE timestamp > ?
            ORDER BY timestamp
        ''', (cutoff_str,))
        rows = [dict_from_row(row) for row in cursor.fetchall()]
        conn.close()

        return jsonify({ 'data': rows }), 200
    except Exception as e:
        logger.error(f"Error fetching system metrics: {e}")
        return jsonify({ 'error': str(e) }), 500

@app.route('/api/announcements', methods=['GET', 'POST'])
def handle_announcements():
    """Get or create system announcements"""
    if request.method == 'GET':
        try:
            # Get active announcements that haven't expired
            conn = get_db_connection()
            cursor = conn.cursor()
            
            now = datetime.now(pytz.timezone('America/Detroit')).isoformat()
            
            cursor.execute('''
                SELECT * FROM announcements
                WHERE is_active = 1 AND (expires IS NULL OR expires > ?)
                ORDER BY created DESC
                LIMIT 5
            ''', (now,))
            
            announcements = [dict_from_row(row) for row in cursor.fetchall()]
            conn.close()
            
            return jsonify(announcements), 200
            
        except Exception as e:
            logger.error(f"Error fetching announcements: {e}")
            return jsonify({'error': str(e)}), 500
    
    # POST - Create a new announcement
    elif request.method == 'POST':
        try:
            data = request.json
            
            if not data or 'message' not in data:
                return jsonify({'error': 'Missing message'}), 400
                
            # Create announcement
            announcement_id = generate_id()
            now = datetime.now(pytz.timezone('America/Detroit'))
            
            # Set expiration (default 24 hours from now if not specified)
            expires = None
            if data.get('expires_in_seconds'):
                try:
                    expires = (now + timedelta(seconds=int(data['expires_in_seconds']))).isoformat()
                except (ValueError, TypeError):
                    expires = (now + timedelta(hours=24)).isoformat()
            elif data.get('expires_in_hours'):
                try:
                    expires = (now + timedelta(hours=int(data['expires_in_hours']))).isoformat()
                except (ValueError, TypeError):
                    expires = (now + timedelta(hours=24)).isoformat()
            
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO announcements (id, message, admin_user, created, expires, is_active)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                announcement_id,
                data['message'],
                data.get('admin_user', 'admin'),
                now.isoformat(),
                expires,
                1
            ))
            
            conn.commit()
            
            # Get the created announcement
            cursor.execute('SELECT * FROM announcements WHERE id = ?', (announcement_id,))
            announcement = dict_from_row(cursor.fetchone())
            conn.close()
            
            return jsonify(announcement), 201
            
        except Exception as e:
            logger.error(f"Error creating announcement: {e}")
            return jsonify({'error': str(e)}), 500

@app.route('/api/announcements/<announcement_id>', methods=['DELETE'])
def delete_announcement(announcement_id):
    """Delete or deactivate an announcement"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if announcement exists
        cursor.execute('SELECT id FROM announcements WHERE id = ?', (announcement_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({'error': 'Announcement not found'}), 404
            
        # Deactivate the announcement (soft delete)
        cursor.execute('''
            UPDATE announcements
            SET is_active = 0
            WHERE id = ?
        ''', (announcement_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Announcement deactivated'}), 200
        
    except Exception as e:
        logger.error(f"Error deactivating announcement: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/platformio/<hardware_type>', methods=['POST'])
def platformio_operation():
    """Handle PlatformIO operations (upload, monitor) for different hardware types"""
    try:
        data = request.json
        if not data or 'operation' not in data:
            return jsonify({'error': 'Missing operation parameter'}), 400
            
        operation = data['operation'].lower()
        hardware_type = data['hardware_type'].lower()
        
        # Map hardware types to their project directories
        hardware_dirs = {
            'armorgos': '/home/kite/dacroq/firmware/Armorgos25w17a',
            'daedalus': '/home/kite/dacroq/firmware/Daedalus25w10a',
            'ksat': '/home/kite/dacroq/firmware/Ksat25w11a'
        }
        
        if hardware_type not in hardware_dirs:
            return jsonify({'error': f'Unknown hardware type: {hardware_type}'}), 400
            
        project_dir = hardware_dirs[hardware_type]
        
        if operation == 'upload':
            # Try uploading firmware with retries
            max_retries = 3
            retry_count = 0
            success = False
            
            while retry_count < max_retries and not success:
                try:
                    process = subprocess.Popen(
                        ['platformio', 'run', '--target', 'upload'],
                        cwd=project_dir,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True
                    )
                    stdout, stderr = process.communicate(timeout=60)
                    
                    if process.returncode == 0:
                        success = True
                        break
                        
                except subprocess.TimeoutExpired:
                    process.kill()
                    stdout, stderr = process.communicate()
                    
                retry_count += 1
                if not success and retry_count < max_retries:
                    time.sleep(2)  # Wait before retrying
                    
            if not success:
                return jsonify({
                    'error': 'Failed to upload firmware',
                    'stdout': stdout,
                    'stderr': stderr
                }), 500
                
            return jsonify({
                'success': True,
                'message': 'Firmware uploaded successfully',
                'stdout': stdout
            })
            
        elif operation == 'monitor':
            # Get the serial port from request data
            port = data.get('port')
            if not port:
                return jsonify({'error': 'Missing serial port parameter'}), 400
                
            # Verify port exists
            if not os.path.exists(port):
                return jsonify({'error': f'Serial port {port} not found'}), 404
                
            # Start monitoring in background
            monitor_process = subprocess.Popen(
                ['platformio', 'device', 'monitor', '--port', port, '--baud', '2000000'],
                cwd=project_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Store process info for later cleanup
            if not hasattr(app, 'monitor_processes'):
                app.monitor_processes = {}
            app.monitor_processes[hardware_type] = monitor_process
            
            return jsonify({
                'success': True,
                'message': f'Started monitoring {hardware_type} on {port}',
                'port': port
            })
            
        elif operation == 'stop-monitor':
            # Stop monitoring if active
            if hasattr(app, 'monitor_processes') and hardware_type in app.monitor_processes:
                process = app.monitor_processes[hardware_type]
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                del app.monitor_processes[hardware_type]
                
            return jsonify({
                'success': True,
                'message': f'Stopped monitoring {hardware_type}'
            })
            
        else:
            return jsonify({'error': f'Unknown operation: {operation}'}), 400
            
    except Exception as e:
        logger.error(f"Error in PlatformIO operation: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/system/platformio/<hardware_type>/status', methods=['GET'])
def platformio_status(hardware_type):
    """Get the status of PlatformIO operations for a hardware type"""
    try:
        hardware_type = hardware_type.lower()
        
        # Check if monitoring is active
        is_monitoring = False
        if hasattr(app, 'monitor_processes') and hardware_type in app.monitor_processes:
            process = app.monitor_processes[hardware_type]
            is_monitoring = process.poll() is None
            
        # Get connected serial ports
        process = subprocess.Popen(
            'ls -l /dev/tty*',
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate(timeout=10)
        
        serial_ports = []
        if process.returncode == 0:
            for line in stdout.split('\n'):
                if '/dev/tty' in line:
                    parts = line.strip().split()
                    if len(parts) > 8:
                        port_path = parts[-1]
                        if 'USB' in line or 'ACM' in port_path:
                            serial_ports.append({
                                'path': port_path,
                                'type': 'usb-serial'
                            })
        
        return jsonify({
            'hardware_type': hardware_type,
            'is_monitoring': is_monitoring,
            'available_ports': serial_ports
        })
        
    except Exception as e:
        logger.error(f"Error getting PlatformIO status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/servo/control', methods=['POST'])
def servo_control():
    """Control servo motors"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        action = data.get('action')
        if not action:
            return jsonify({'error': 'No action specified'}), 400
            
        # Handle different servo actions
        result = {'success': True, 'action': action}
        
        # Store active serial connections temporarily before any reset actions
        active_serial_connections = {}
        if action in ['press', 'reset_all']:
            # Backup active serial connections (except the one being reset)
            reset_servo_index = data.get('servo')
            for port, connection in SERIAL_CONNECTIONS.items():
                # Skip the connection being reset if we can identify it
                if reset_servo_index is not None:
                    # Map servo index to expected port patterns
                    patterns = {
                        0: ['ACM0', 'USB0'],  # LDPC
                        1: ['ACM1', 'USB1'],  # 3SAT
                        2: ['ACM2', 'USB2']   # KSAT
                    }
                    
                    # Skip if port matches the pattern for the servo being reset
                    should_skip = False
                    if reset_servo_index in patterns:
                        for pattern in patterns[reset_servo_index]:
                            if pattern in port:
                                should_skip = True
                                break
                                
                    if should_skip:
                        continue
                        
                # Save connection details for ports we want to preserve
                if connection.is_open:
                    try:
                        active_serial_connections[port] = {
                            'baudrate': connection.baudrate,
                            'timeout': connection.timeout
                        }
                        # Close temporarily to avoid issues during reset
                        connection.close()
                    except Exception as e:
                        logger.error(f"Error backing up serial connection {port}: {e}")
        
        if action == 'move':
            # Move a specific servo to a specific angle
            servo_index = data.get('servo')
            angle = data.get('angle')
            
            if servo_index is None:
                return jsonify({'error': 'No servo index specified'}), 400
            if angle is None:
                return jsonify({'error': 'No angle specified'}), 400
                
            try:
                move_servo(int(servo_index), float(angle) if angle is not None else None)
                result['details'] = f"Moved servo {servo_index} to {angle}°"
            except Exception as e:
                return jsonify({'error': f'Servo control error: {str(e)}'}), 400
                
        elif action == 'press':
            # Press a button using pre-defined servo motion
            servo_index = data.get('servo')
            
            if servo_index is None:
                return jsonify({'error': 'No servo index specified'}), 400
                
            if servo_index == 0:
                press_button_servo0()
                result['details'] = "Pressed button with servo 0"
            elif servo_index == 1:
                press_button_servo1()
                result['details'] = "Pressed button with servo 1"
            elif servo_index == 2:
                press_button_servo2()
                result['details'] = "Pressed button with servo 2"
            else:
                return jsonify({'error': f'Invalid servo index: {servo_index}'}), 400
                
        elif action == 'reset_all':
            # Reset all servos
            reset_all()
            result['details'] = "Reset all servos"
            
        elif action == 'release':
            # Release all servos
            release_servos()
            result['details'] = "Released all servos"
            
        else:
            return jsonify({'error': f'Unknown action: {action}'}), 400
        
        # Restore serial connections after reset
        if action in ['press', 'reset_all'] and active_serial_connections:
            # Wait a moment for USB devices to re-enumerate
            time.sleep(1.5)
            
            # Restore connections
            for port, settings in active_serial_connections.items():
                try:
                    # Skip if the port no longer exists
                    if not os.path.exists(port):
                        logger.warning(f"Port {port} no longer available after reset")
                        continue
                        
                    # Reopen the connection with saved settings
                    SERIAL_CONNECTIONS[port] = serial.Serial(
                        port, 
                        settings['baudrate'],
                        timeout=settings['timeout']
                    )
                    logger.info(f"Restored serial connection to {port}")
                except Exception as e:
                    logger.error(f"Error restoring serial connection to {port}: {e}")
            
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in servo control: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/servo/status', methods=['GET'])
def servo_status():
    """Get the current status of servo control capabilities"""
    try:
        status = {
            'available': SERVO_AVAILABLE,
            'pins': SERVO_PINS,
            'count': len(SERVO_PINS)
        }
        
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Error getting servo status: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/restart', methods=['POST'])
def restart_service():
    """
    Trigger a clean shutdown of this process.
    systemd will pick it up and restart automatically.
    """
    def shutdown():
        # slight delay so this request can finish
        time.sleep(0.5)
        os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=shutdown, daemon=True).start()
    return jsonify({"message": "Service restart initiated"}), 200

@app.route('/api/firmware/reflash', methods=['POST'])
def reflash_firmware():
    """
    Reflash **every** firmware sub‑project found under ./firmware
    (3sat, ldpc, ksat, …).  
    • Reads each project’s *platformio.ini* for upload_port
      and monitor_port.  
    • Runs platformio run --target upload inside the directory.  
    • Opens the monitor port with pyserial to confirm the MCU
      enumerates (5 s timeout).  
    • Builds a per‑project report and returns once all have finished.
    """
    try:
        base_dir   = Path(__file__).parent / "firmware"
        projects   = [p for p in base_dir.iterdir() if p.is_dir()]
        summary    = []

        def get_ports(ini: Path):
            up, mon = None, None
            for ln in ini.read_text().splitlines():
                ln = ln.strip()
                if ln.startswith("upload_port"):
                    up  = ln.split("=", 1)[1].strip()
                elif ln.startswith("monitor_port"):
                    mon = ln.split("=", 1)[1].strip()
            return up, mon

        for proj in projects:
            ini = proj / "platformio.ini"
            if not ini.exists():
                summary.append({
                    "project": proj.name,
                    "status":  "skip",
                    "reason":  "platformio.ini missing"
                })
                continue

            upload_port, monitor_port = get_ports(ini)
            if not upload_port or not monitor_port:
                summary.append({
                    "project": proj.name,
                    "status":  "error",
                    "reason":  "upload_port/monitor_port not found in ini"
                })
                continue

            # --- upload ---
            cmd = ["platformio", "run", "--target", "upload"]
            proc = subprocess.run(cmd, cwd=proj, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, timeout=90)

            if proc.returncode != 0:
                summary.append({
                    "project": proj.name,
                    "status":  "error",
                    "stage":   "upload",
                    "stdout":  proc.stdout,
                    "stderr":  proc.stderr
                })
                continue

            # --- monitor check ---
            online = False
            try:
                with serial.Serial(monitor_port, 2_000_000, timeout=5) as ser:
                    ser.flushInput()
                    time.sleep(0.2)              # give MCU a breath
                    ser.write(b'\n')              # poke
                    ser.readline()                # try to read one line
                    online = True
            except Exception as e:
                summary.append({
                    "project": proj.name,
                    "status":  "error",
                    "stage":   "monitor",
                    "reason":  str(e)
                })
                continue

            summary.append({
                "project": proj.name,
                "status":  "success" if online else "unknown",
                "upload_port":  upload_port,
                "monitor_port": monitor_port,
                "message": "yay 🎉" if online else "monitor silent"
            })

        return jsonify({"results": summary}), 200

    except subprocess.TimeoutExpired:
        return jsonify({
            "error": "Upload timed out (90 s)",
        }), 500
    except Exception as e:
        logger.error(f"reflash_firmware: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/hardware/test', methods=['POST'])
def test_hardware():
    """Run tests on a specific hardware platform"""
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        platform = data.get('platform')
        platform_id = data.get('platformId')
        
        if not platform or platform_id is None:
            return jsonify({'error': 'Missing platform information'}), 400
        
        # Dynamic port mapping to actual serial ports based on platform ID
        tty_devices = []
        try:
            # List all ttyACM* and ttyUSB* devices
            devices = []
            for pattern in ['/dev/ttyACM*', '/dev/ttyUSB*']:
                import glob
                devices.extend(glob.glob(pattern))
            tty_devices = sorted(devices)
            logger.info(f"Found serial devices: {tty_devices}")
        except Exception as e:
            logger.error(f"Error finding serial devices: {e}")
        
        # Map each platform ID to a port based on physical USB layout
        if len(tty_devices) >= 3:
            if platform_id == 0:
                port = tty_devices[0]  # LDPC - bottom left
            elif platform_id == 1:
                port = tty_devices[1]  # 3SAT - top left
            elif platform_id == 2:
                port = tty_devices[2]  # KSAT - top right
            else:
                return jsonify({'error': f'Unknown platform ID: {platform_id}'}), 400
        elif len(tty_devices) > 0:
            # If we don't have 3 devices, just use what we have in order
            if platform_id < len(tty_devices):
                port = tty_devices[platform_id]
            else:
                return jsonify({
                    'error': f'Not enough devices connected. Found {len(tty_devices)} devices, need device at position {platform_id}.',
                    'devices': tty_devices
                }), 404
        else:
            # No serial devices found
            return jsonify({
                'error': 'No serial devices found. Please make sure the devices are connected and programmed with serial functionality.',
                'help': 'Teensy devices need firmware with Serial.begin() to appear as serial ports.'
            }), 404
        
        # Simple test - try to open the port and read some data
        try:
            ser = serial.Serial(port, 115200, timeout=2)
            ser.write(b'TEST\n')
            response = ser.readline().decode('utf-8', errors='ignore').strip()
            ser.close()
            
            return jsonify({
                'success': True,
                'message': f'Hardware test successful for {platform} (ID: {platform_id})',
                'port': port,
                'response': response or 'No response received, but port is accessible'
            })
        except serial.SerialException as e:
            return jsonify({
                'error': f'Failed to communicate with {platform}',
                'port': port,
                'details': str(e)
            }), 500
            
    except Exception as e:
        logger.error(f"Error testing hardware: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/hardware/reset-all-connect', methods=['POST'])
def reset_all_and_connect():
    """
    Reset all test platforms in sequence and then establish serial connections to each.
    This ensures a clean state for all devices and proper enumeration.
    """
    try:
        # First close any existing serial connections
        for port, connection in list(SERIAL_CONNECTIONS.items()):
            try:
                if connection.is_open:
                    connection.close()
                    logger.info(f"Closed existing serial connection to {port}")
            except Exception as e:
                logger.error(f"Error closing serial connection to {port}: {e}")
        
        # Clear the connections dictionary
        SERIAL_CONNECTIONS.clear()
        
        # Reset all platforms in sequence via servo control
        logger.info("Resetting all test platforms...")
        
        # Reset LDPC (servo 0)
        press_button_servo0()
        time.sleep(1.0)  # Wait for device to reboot
        
        # Reset 3SAT (servo 1)
        press_button_servo1()
        time.sleep(1.0)  # Wait for device to reboot
        
        # Reset KSAT (servo 2)
        press_button_servo2()
        time.sleep(2.0)  # Extra wait after last device
        
        # Now scan for available USB devices and connect to them
        import serial.tools.list_ports
        import glob
        
        # Scan specifically for USB serial devices
        tty_devices = []
        for pattern in ['/dev/ttyACM*', '/dev/ttyUSB*']:
            tty_devices.extend(glob.glob(pattern))
        
        # Sort to get consistent ordering
        tty_devices.sort()
        
        # Common baud rates for Teensy
        baud_rates = [2000000, 115200, 9600]
        
        # Platform mapping
        platform_info = []
        
        # Find and connect to each platform by position
        for i, port_path in enumerate(tty_devices):
            if i >= 3:  # Only handle up to 3 platforms
                break
                
            platform_name = ["LDPC", "3SAT", "KSAT"][i]
            platform_desc = [
                "Hardware Accelerator",
                "Boolean Satisfiability Solver",
                "K-SAT Solver"
            ][i]
            
            # Try to connect
            connected = False
            connection_info = {"platform": platform_name, "port": port_path}
            
            for baud_rate in baud_rates:
                try:
                    # Create connection and store in global dictionary
                    ser = serial.Serial(port_path, baud_rate, timeout=0.5)
                    SERIAL_CONNECTIONS[port_path] = ser
                    
                    # Test with a newline to see if device responds
                    ser.write(b'\n')
                    response = ser.readline().decode('utf-8', errors='ignore').strip()
                    
                    connection_info.update({
                        "baud_rate": baud_rate,
                        "connected": True,
                        "description": platform_desc,
                        "response": response
                    })
                    
                    connected = True
                    logger.info(f"Connected to {platform_name} on {port_path} at {baud_rate} baud")
                    break
                    
                except Exception as e:
                    logger.error(f"Failed to connect to {port_path} at {baud_rate} baud: {e}")
            
            if not connected:
                connection_info.update({
                    "connected": False,
                    "error": f"Could not connect to {platform_name} on {port_path}"
                })
                
            platform_info.append(connection_info)
        
        # If we didn't find 3 devices, add placeholder info for missing ones
        while len(platform_info) < 3:
            i = len(platform_info)
            platform_name = ["LDPC", "3SAT", "KSAT"][i]
            platform_info.append({
                "platform": platform_name,
                "connected": False,
                "error": f"{platform_name} device not found"
            })
        
        return jsonify({
            "success": True,
            "message": "Reset all platforms and established connections",
            "platforms": platform_info
        })
        
    except Exception as e:
        logger.error(f"Error in reset-all-connect: {e}")
        return jsonify({"error": str(e)}), 500

# --- Entry Point ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting API on 0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)