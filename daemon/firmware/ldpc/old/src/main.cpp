/*
 * LDPC Analog-Assisted Decoder Firmware
 * Teensy 4.1 + AMORGOS Chip
 * Minimal API Version for Testing
 */

#include <Arduino.h>
#include "main.h"

// Global state
AMORGOS chip;
bool chipInitialized = false;

void setup() {
  // Initialize serial
  Serial.begin(2000000);
  
  // Wait briefly for serial
  delay(1000);
  
  // Try to initialize AMORGOS
  Serial.println("Initializing AMORGOS chip...");
  
  // Use the same parameters as the original working code
  chip.setup(AMORGOS_EXT_CLK, AMORGOS_FREQ, AMORGOS_FREQ_DIV);
  
  // Test basic communication
  chip.reset();
  delay(100);
  
  // Simple test - write and read back
  uint32_t testPattern = 0xA5A5A5A5;
  chip.writeReg(CONTROL_REGS | CTRL_CONF_CTRL_EN, testPattern);
  delayMicroseconds(100);
  uint32_t readback = chip.readReg(CONTROL_REGS | CTRL_CONF_CTRL_EN);
  
  if (readback == testPattern) {
    chipInitialized = true;
    Serial.println("AMORGOS initialization successful");
  } else {
    Serial.print("AMORGOS initialization failed. Expected: 0x");
    Serial.print(testPattern, HEX);
    Serial.print(" Got: 0x");
    Serial.println(readback, HEX);
  }
}

void loop() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    
    if (command == "I") {
      Serial.println("DACROQ_BOARD:LDPC");
    }
    else if (command == "STATUS") {
      Serial.print("STATUS:");
      Serial.println(chipInitialized ? "READY" : "ERROR");
    }
    else if (command == "TEST") {
      if (!chipInitialized) {
        Serial.println("ERROR:Chip not initialized");
        return;
      }
      
      // Run a simple test
      Serial.println("Running test...");
      
      // Initialize the batch run
      chip.batchRunStartup();
      
      // Create dummy soft info (matching the paper's format)
      uint32_t softInfo[24] = {0};
      for (int i = 0; i < 24; i++) {
        softInfo[i] = i; // Simple test pattern
      }
      
      // Load soft info
      chip.loadSoftInfo(softInfo);
      
      // Start processing
      chip.writeReg(CONTROL_REGS | CTRL_CONF_PC_CONTINUE*4, 1);
      
      // Wait for DONE with timeout
      unsigned long timeout = millis() + 100;
      bool done = false;
      
      while (millis() < timeout) {
        if (digitalRead(DONE_PIN)) {
          done = true;
          break;
        }
      }
      
      if (done) {
        uint32_t cycles = chip.readReg(CONTROL_REGS | TOTAL_CYCLE);
        Serial.print("TEST:SUCCESS:Cycles=");
        Serial.println(cycles);
      } else {
        Serial.println("TEST:TIMEOUT");
      }
    }
    else if (command == "READREG") {
      // Debug command to read any register
      Serial.println("Enter address in hex:");
      while (!Serial.available()) {}
      String addrStr = Serial.readStringUntil('\n');
      uint32_t addr = strtoul(addrStr.c_str(), NULL, 16);
      uint32_t value = chip.readReg(addr);
      Serial.print("Reg[0x");
      Serial.print(addr, HEX);
      Serial.print("] = 0x");
      Serial.println(value, HEX);
    }
  }
}