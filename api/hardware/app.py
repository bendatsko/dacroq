#!/usr/bin/env python3
"""
Dacroq Hardware API

Handles all hardware interfacing including:
- Teensy LDPC and SAT hardware communication
- Firmware building, uploading, and flashing
- GPIO control for device resets
- Serial communication and monitoring
- Hardware discovery and management
"""

import argparse
import atexit
import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import psutil
import serial
import serial.tools.list_ports
from flask import Flask, jsonify, request

# GPIO control for hardware resets
try:
    import lgpio
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    print("Warning: lgpio not available - hardware reset disabled")

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

BASE_DIR = Path(__file__).parent.parent.parent
FIRMWARE_DIR = BASE_DIR / "firmware"

# Daemon management
PID_FILE = Path(__file__).parent / "dacroq_hardware.pid"
LOG_FILE = Path(__file__).parent / "dacroq_hardware.log"

# CORS configuration
ALLOWED_ORIGINS = set(
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://dacroq.net,https://www.dacroq.net,https://test.dacroq.net,https://dacroq.eecs.umich.edu",
    ).split(",")
)

def utc_now():
    return datetime.now().isoformat()

# Import hardware modules
from .device_manager import HardwareDeviceManager
from .teensy_interface import TeensyInterface, TeensyConnectionPool
from .sat_interface import SATHardwareInterface, SATConnectionPool

# Initialize global managers
hardware_manager = HardwareDeviceManager()
teensy_pool = TeensyConnectionPool()
sat_pool = SATConnectionPool()

# ------------------------------ CORS Middleware -------------------------------
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

# ------------------------------ Hardware Routes ------------------------------
@app.route("/")
def index():
    return jsonify({
        "name": "Dacroq Hardware API",
        "version": "2.0",
        "status": "operational",
        "endpoints": {
            "/health": "Hardware health check",
            "/discover": "Discover connected devices",
            "/devices": "Get device information",
            "/reset/<device_type>": "Reset specific device",
            "/reset/all": "Reset all devices",
            "/gpio/status": "GPIO status",
            "/firmware/build/<device_type>": "Build firmware",
            "/firmware/upload/<device_type>": "Upload firmware", 
            "/firmware/flash/<device_type>": "Build and upload firmware",
            "/ldpc/command": "Send LDPC commands",
            "/ldpc/serial-history": "Get LDPC serial history",
            "/sat/command": "Send SAT commands",
            "/sat/serial-history": "Get SAT serial history",
            "/session-break": "Add session separator"
        }
    })

@app.route("/health")
def health():
    """Hardware system health check"""
    try:
        hw_status = hardware_manager.get_status()
        
        # Check connection pools
        ldpc_connected = teensy_pool.connection and teensy_pool.connection.connected
        sat_connected = sat_pool.connection and sat_pool.connection.connected
        
        return jsonify({
            "status": "healthy",
            "timestamp": utc_now(),
            "hardware_manager": hw_status,
            "connections": {
                "ldpc": ldpc_connected,
                "sat": sat_connected
            },
            "gpio_available": GPIO_AVAILABLE and hardware_manager.gpio_initialized
        })
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

@app.route("/discover", methods=["POST"])
def discover_devices():
    """Discover and identify all connected hardware devices"""
    try:
        logger.info("Hardware discovery requested")
        discovered = hardware_manager.discover_all_devices()
        status = hardware_manager.get_status()
        
        return jsonify({
            "success": True,
            "discovered": discovered,
            "status": status
        })
    except Exception as e:
        logger.error(f"Hardware discovery failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/devices", methods=["GET"])
def get_devices():
    """Get detailed information about all hardware devices"""
    try:
        hw_status = hardware_manager.get_status()
        device_details = {}
        
        for device_type, config in hardware_manager.device_configs.items():
            discovered_port = hardware_manager.get_device_port(device_type)
            available_ports = hardware_manager.get_available_ports_for_device(device_type)
            
            device_details[device_type] = {
                "name": config.get("device_type", device_type.upper()),
                "description": f"{config.get('device_type', device_type.upper())} Hardware",
                "gpio_pin": config.get("reset_gpio_pin"),
                "discovered_port": discovered_port,
                "available_ports": available_ports,
                "preferred_ports": config.get("preferred_ports", []),
                "firmware_path": config.get("firmware_path"),
                "identification_keywords": config.get("identification_keywords", []),
                "connected": discovered_port is not None
            }
        
        return jsonify({
            "success": True,
            "devices": device_details,
            "hardware_status": hw_status
        })
    except Exception as e:
        logger.error(f"Get devices failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/reset/<device_type>", methods=["POST"])
def reset_device(device_type):
    """Reset specific device via GPIO"""
    try:
        logger.info(f"Hardware reset requested for {device_type}")
        result = hardware_manager.reset_device_hardware(device_type)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Hardware reset failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/reset/all", methods=["POST"])
def reset_all_devices():
    """Reset all devices simultaneously"""
    try:
        logger.info("Hardware reset requested for ALL devices")
        result = hardware_manager.reset_all_devices()
        
        return jsonify({
            "success": result["success"],
            "result": result
        })
    except Exception as e:
        logger.error(f"Hardware reset all failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/gpio/status", methods=["GET"])
def gpio_status():
    """Get GPIO reset control status"""
    try:
        gpio_status = hardware_manager.get_gpio_status()
        
        return jsonify({
            "success": True,
            "gpio": gpio_status
        })
    except Exception as e:
        logger.error(f"GPIO status check failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ Firmware Routes ------------------------------
@app.route("/firmware/build/<device_type>", methods=["POST"])
def build_firmware(device_type):
    """Build firmware for specified device type"""
    try:
        logger.info(f"Firmware build requested for {device_type}")
        result = hardware_manager.build_firmware(device_type)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware build failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/upload/<device_type>", methods=["POST"])
def upload_firmware(device_type):
    """Upload firmware to specified device"""
    try:
        data = request.get_json() or {}
        port = data.get("port")
        
        logger.info(f"Firmware upload requested for {device_type} at port {port}")
        result = hardware_manager.upload_firmware(device_type, port)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware upload failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/flash/<device_type>", methods=["POST"])
def flash_firmware(device_type):
    """Build and upload firmware in one operation"""
    try:
        data = request.get_json() or {}
        port = data.get("port")
        build_first = data.get("build", True)
        
        logger.info(f"Firmware flash requested for {device_type}")
        result = hardware_manager.flash_firmware(device_type, port, build_first)
        
        return jsonify({
            "success": result["success"],
            "device_type": device_type,
            "result": result
        })
    except Exception as e:
        logger.error(f"Firmware flash failed for {device_type}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/firmware/status", methods=["GET"])
def firmware_status():
    """Get firmware management status"""
    try:
        hardware_status = hardware_manager.get_status()
        
        # Check PlatformIO availability
        try:
            pio_result = subprocess.run(["pio", "--version"], capture_output=True, text=True, timeout=10)
            pio_available = pio_result.returncode == 0
            pio_version = pio_result.stdout.strip() if pio_available else "Not available"
        except:
            pio_available = False
            pio_version = "Not available"
        
        return jsonify({
            "success": True,
            "platformio": {
                "available": pio_available,
                "version": pio_version
            },
            "hardware": hardware_status,
            "supported_devices": list(hardware_manager.device_configs.keys())
        })
    except Exception as e:
        logger.error(f"Firmware status check failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ LDPC Routes ----------------------------------
@app.route("/ldpc/command", methods=["POST"])
def ldpc_command():
    """Send command to LDPC hardware"""
    try:
        cmd = request.get_json().get("command", "").strip()
        if not cmd:
            return jsonify({"error": "command cannot be empty"}), 400
        
        teensy = teensy_pool.get_connection()
        output = teensy.execute_command(cmd)
        return jsonify({"output": output})
    except Exception as e:
        logger.error(f"LDPC command error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/ldpc/serial-history", methods=["GET"])
def ldpc_serial_history():
    """Get LDPC serial communication history"""
    try:
        teensy = teensy_pool.get_connection()
        history = teensy.get_serial_history()
        return jsonify({
            "history": history,
            "connected": teensy.connected,
            "last_heartbeat": teensy.last_heartbeat
        })
    except Exception as e:
        logger.error(f"LDPC serial history error: {e}")
        return jsonify({
            "history": [],
            "connected": False,
            "error": str(e)
        }), 500

@app.route("/ldpc/test", methods=["POST"])
def ldpc_test():
    """Run LDPC hardware test"""
    try:
        data = request.get_json()
        snr_db = data.get("snr_db", 5)
        num_runs = data.get("num_runs", 1)
        
        teensy = teensy_pool.get_connection()
        results = teensy.run_snr_test(snr_db, num_runs)
        
        return jsonify({
            "success": True,
            "results": results
        })
    except Exception as e:
        logger.error(f"LDPC test error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ SAT Routes -----------------------------------
@app.route("/sat/command", methods=["POST"])
def sat_command():
    """Send command to SAT hardware"""
    try:
        cmd = request.get_json().get("command", "").strip()
        if not cmd:
            return jsonify({"error": "command cannot be empty"}), 400
            
        sat_hw = sat_pool.get_connection()
        output = sat_hw.execute_command(cmd)
        return jsonify({"output": output})
        
    except Exception as e:
        logger.error(f"SAT command error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/sat/serial-history", methods=["GET"])
def sat_serial_history():
    """Get SAT serial communication history"""
    try:
        sat_hw = sat_pool.get_connection()
        history = sat_hw.serial_history
        return jsonify({
            "history": [f"[{h['timestamp']}] {h['message']}" for h in history],
            "connected": sat_hw.connected,
            "last_heartbeat": sat_hw.last_heartbeat
        })
    except Exception as e:
        logger.error(f"SAT serial history error: {e}")
        return jsonify({
            "history": [],
            "connected": False,
            "error": str(e)
        }), 500

@app.route("/sat/solve", methods=["POST"])
def sat_solve():
    """Solve SAT problem using hardware"""
    try:
        data = request.get_json()
        dimacs_cnf = data.get("dimacs", "")
        problem_count = data.get("problem_count", 1)
        
        if not dimacs_cnf:
            return jsonify({"error": "DIMACS CNF required"}), 400
        
        sat_hw = sat_pool.get_connection()
        results = sat_hw.solve_sat_problem(dimacs_cnf, "daedalus", problem_count)
        
        return jsonify({
            "success": True,
            "results": results
        })
    except Exception as e:
        logger.error(f"SAT solve error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ Utility Routes -------------------------------
@app.route("/session-break", methods=["POST"])
def session_break():
    """Add session separators to all active connections"""
    try:
        data = request.get_json() or {}
        separator_text = data.get("text", "SESSION BREAK")
        
        results = {}
        
        # Add to LDPC connection
        try:
            if teensy_pool.connection and teensy_pool.connection.connected:
                teensy_pool.connection.add_session_separator(separator_text)
                results["ldpc"] = "Session separator added"
            else:
                results["ldpc"] = "No active connection"
        except Exception as e:
            results["ldpc"] = f"Error: {e}"
        
        # Add to SAT connection
        try:
            if sat_pool.connection and sat_pool.connection.connected:
                sat_pool.connection.add_session_separator(separator_text)
                results["sat"] = "Session separator added"
            else:
                results["sat"] = "No active connection"
        except Exception as e:
            results["sat"] = f"Error: {e}"
        
        return jsonify({
            "success": True,
            "results": results,
            "separator_text": separator_text
        })
    except Exception as e:
        logger.error(f"Session break failed: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------ Cleanup -----------------------------------
def cleanup_on_exit():
    """Cleanup function called on exit"""
    logger.info("🧹 Performing hardware API cleanup...")
    try:
        hardware_manager.cleanup_gpio()
        teensy_pool.close_all()
        sat_pool.close_all()
        logger.info("✅ Hardware cleanup completed")
    except Exception as e:
        logger.error(f"❌ Hardware cleanup error: {e}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Dacroq Hardware API")
    parser.add_argument("--port", type=int, default=8001, help="Port to run on")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--debug", action="store_true", help="Debug mode")
    
    args = parser.parse_args()
    
    # Register cleanup
    atexit.register(cleanup_on_exit)
    
    logger.info("🔧 Starting Dacroq Hardware API...")
    logger.info(f"📁 Base Directory: {BASE_DIR}")
    logger.info(f"⚙️ Firmware Directory: {FIRMWARE_DIR}")
    
    # Initial hardware discovery
    try:
        logger.info("🔍 Performing initial hardware discovery...")
        discovered = hardware_manager.discover_all_devices()
        logger.info(f"✅ Discovered devices: {list(discovered.keys())}")
    except Exception as e:
        logger.warning(f"⚠️ Initial discovery failed: {e}")
    
    try:
        print(f"🔧 Hardware API running on http://{args.host}:{args.port}")
        print("💡 Press Ctrl+C to stop")
        
        app.run(
            host=args.host,
            port=args.port,
            debug=args.debug
        )
    except KeyboardInterrupt:
        print("\n🛑 Hardware API stopped by user")
    finally:
        cleanup_on_exit()

if __name__ == "__main__":
    main() 