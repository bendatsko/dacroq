#!/usr/bin/env python3
import serial
import struct
import sys
from pathlib import Path
import time


def sync_to_teensy(ser, directory):
    for file_path in Path(directory).rglob("*"):
        if not file_path.is_file():
            continue

        rel_path = file_path.relative_to(directory)
        name = str(rel_path)
        size = file_path.stat().st_size

        print(f"Sending {name} ({size} bytes)...")

        ser.write(b"T")
        ser.write(bytes([len(name)]))
        ser.write(name.encode())
        ser.write(struct.pack("<I", size))
        ser.flush()

        with open(file_path, "rb") as f:
            while data := f.read(512):
                ser.write(data)
                ser.flush()

        if ser.read(1) != b"A":
            print(f"Failed to transfer {name}")
            return


def sync_from_teensy(ser, directory):
    ser.write(b"F")
    ser.flush()

    out_dir = Path(directory)
    out_dir.mkdir(parents=True, exist_ok=True)

    while True:
        cmd = ser.read(1)
        if not cmd:
            print("Timeout waiting for response")
            return

        if cmd == b"E":  # End marker
            break

        if cmd == b"X":  # Error
            print("Teensy reported error")
            return

        if cmd != b"S":  # Start file marker
            print(f"Unexpected command: {cmd}")
            continue

        # Read filename length and name
        name_len = ser.read(1)[0]
        name = ser.read(name_len).decode()

        # Read file size
        size_bytes = ser.read(4)
        if len(size_bytes) != 4:
            print("Failed to read size")
            return
        size = struct.unpack("<I", size_bytes)[0]

        # print(f"Receiving {name} ({size} bytes)...")

        file_path = out_dir / name
        # Create any necessary parent directories
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, "wb") as f:
            remaining = size
            while remaining > 0:
                chunk_size = min(512, remaining)
                chunk = ser.read(chunk_size)
                if not chunk:
                    print("Failed reading file data")
                    return
                f.write(chunk)
                remaining -= len(chunk)

        ser.write(b"A")  # Send acknowledgment
        ser.flush()

        print(f"Received {name}")

    print("Transfer complete")


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ["-t", "-f"]:
        print(f"Usage: {sys.argv[0]} -t/-f PORT DIR")
        print("  -t: sync local DIR to Teensy")
        print("  -f: sync from Teensy to local DIR")
        sys.exit(1)

    ser = serial.Serial(sys.argv[2], 2000000, timeout=1)
    time.sleep(2)

    while ser.in_waiting:
        print(ser.readline().decode().strip())

    if sys.argv[1] == "-t":
        sync_to_teensy(ser, sys.argv[3])
    else:
        sync_from_teensy(ser, sys.argv[3])


if __name__ == "__main__":
    main()
