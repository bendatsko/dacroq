#!/usr/bin/env python3
"""
servosweep.py – minimal helper module + optional CLI for three SG90 servos.

Import elsewhere to call:
    • move_servo(index, angle)
    • press_button_servo0/1/2()
    • reset_all()            # NEW
    • release_servos()

Run directly for an interactive prompt.
"""

from time import sleep
from typing import List, Optional, Sequence

from gpiozero import AngularServo

__all__ = [
    "PINS",
    "servos",
    "move_servo",
    "press_button_servo0",
    "press_button_servo1",
    "press_button_servo2",
    "reset_all",
    "release_servos",
]

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PINS: Sequence[int] = (12, 13, 18)          # hardware‑PWM GPIOs
MIN_US: float = 0.5 / 1000                  # 0.0005 s
MAX_US: float = 2.4 / 1000                  # 0.0024 s

# ---------------------------------------------------------------------------
# Servo initialisation
# ---------------------------------------------------------------------------

def _create_servos(pins: Sequence[int]) -> List[AngularServo]:
    out = [
        AngularServo(
            pin,
            min_angle=0,
            max_angle=180,
            min_pulse_width=MIN_US,
            max_pulse_width=MAX_US,
        )
        for pin in pins
    ]
    for s in out:
        s.angle = None
    return out


servos: List[AngularServo] = _create_servos(PINS)

# ---------------------------------------------------------------------------
# Library helpers
# ---------------------------------------------------------------------------

def move_servo(index: int, angle: Optional[float]) -> None:
    if not 0 <= index < len(servos):
        raise IndexError(f"Servo {index} out of range (0‑{len(servos)-1})")
    servos[index].angle = angle


def release_servos() -> None:
    for s in servos:
        s.angle = None

# ---------------------------------------------------------------------------
# Pre‑defined “button press” motions
# ---------------------------------------------------------------------------

def press_button_servo0() -> None:
    move_servo(0, 120); sleep(0.5)
    move_servo(0, 85);  sleep(0.1)
    move_servo(0, 120); sleep(0.5)
    move_servo(0, None)


def press_button_servo1() -> None:
    move_servo(1, 50); sleep(0.5)
    move_servo(1, 28); sleep(0.1)
    move_servo(1, 50); sleep(0.5)
    move_servo(1, None)


def press_button_servo2() -> None:
    move_servo(2, 90); sleep(0.5)
    move_servo(2, 40); sleep(0.3)
    move_servo(2, 90); sleep(0.5)
    move_servo(2, None)


def reset_all() -> None:
    """Equivalent to running press0, press1, press2 in sequence."""
    press_button_servo0()
    press_button_servo1()
    press_button_servo2()

# ---------------------------------------------------------------------------
# Interactive CLI
# ---------------------------------------------------------------------------

def _cli() -> None:
    print("Servo Control Ready")
    print("Commands: servo<N> <angle>, press0/1/2, reset, quit/exit")
    try:
        while True:
            parts = input("> ").strip().lower().split()
            if not parts:
                continue

            cmd = parts[0]

            if cmd in {"quit", "exit"}:
                break
            if cmd == "reset":
                reset_all(); continue
            if cmd == "press0":
                press_button_servo0(); continue
            if cmd == "press1":
                press_button_servo1(); continue
            if cmd == "press2":
                press_button_servo2(); continue

            if cmd.startswith("servo") and len(parts) == 2:
                try:
                    idx = int(cmd[5:])
                    ang = float(parts[1])
                    move_servo(idx, ang)
                    print(f"Moving servo {idx} to {ang}°")
                except (ValueError, IndexError) as err:
                    print(err)
                continue

            print("Unknown command")
    except KeyboardInterrupt:
        pass
    finally:
        release_servos()
        print("Servos released.")


if __name__ == "__main__":
    _cli()
