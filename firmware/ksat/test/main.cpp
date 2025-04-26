// PULPino Communication Test Suite
// For debugging the Teensy-PULPino communication interface

#include "../src/main.h"
#include <Arduino.h>

MEDUSA Medusa;

// Test results tracking
uint32_t testsPassed = 0;
uint32_t testsFailed = 0;

// Print test header
void startTest(const char* testName) {
  SerialUSB.println("\n-----------------------------------------");
  SerialUSB.print("TEST: ");
  SerialUSB.println(testName);
  SerialUSB.println("-----------------------------------------");
}

// Mark test as passed
void passTest(const char* message) {
  SerialUSB.print(" PASS: ");
  SerialUSB.println(message);
  testsPassed++;
}

// Mark test as failed
void failTest(const char* message) {
  SerialUSB.print(" FAIL: ");
  SerialUSB.println(message);
  testsFailed++;
}

// Test low-level SPI communication
void testSPICommunication() {
  startTest("Low-Level SPI Communication");
  
  // Initialize SPI pins
  Medusa.pulpinoSpiBegin();
  
  // Test CS Toggle
  SerialUSB.println("Testing CS toggle...");
  for (int i = 0; i < 5; i++) {
    Medusa.pulpinoSpiEnd();   // CS high
    delay(100);
    Medusa.pulpinoSpiBegin(); 
    digitalWriteFast(DP2_CS, LOW); // CS low
    delay(100);
  }
  passTest("CS toggle (visual inspection required)");
  
  // Test MOSI Data Transfer
  SerialUSB.println("Testing MOSI data transfer...");
  uint8_t testPattern[] = {0xAA, 0x55, 0xFF, 0x00, 0x12, 0x34, 0x56, 0x78};
  for (unsigned int i = 0; i < sizeof(testPattern); i++) {
    SerialUSB.print("Sending 0x");
    SerialUSB.print(testPattern[i], HEX);
    SerialUSB.print(" - Bit pattern: ");
    for (int bit = 7; bit >= 0; bit--) {
      SerialUSB.print((testPattern[i] >> bit) & 0x01);
    }
    SerialUSB.println();
    
    Medusa.pulpinoSpiSendByte(testPattern[i]);
    delay(10);
  }
  passTest("MOSI data transfer (visual inspection required)");
  
  // End test
  Medusa.pulpinoSpiEnd();
}

// Test PULPino Reset Sequence
void testPULPinoReset() {
  startTest("PULPino Reset Sequence");
  
  SerialUSB.println("Resetting PULPino...");
  // Reset PULPino
  digitalWriteFast(RSTN, LOW);
  delay(10);
  digitalWriteFast(RSTN, HIGH);
  delay(100);
  passTest("Reset sequence completed");
  
  // Test FETCH_EN
  SerialUSB.println("Testing FETCH_EN signal...");
  digitalWriteFast(FETCH_EN, HIGH);
  delay(10);
  digitalWriteFast(FETCH_EN, LOW);
  passTest("FETCH_EN toggled");
}

// Test Memory Access
void testMemoryAccess() {
  startTest("Memory Access");
  
  uint32_t testAddresses[] = {
    0x00080000,  // Boot ROM
    0x00080100,  // Communication buffer address
    0x1A110000   // Peripheral region
  };
  
  uint32_t testValues[] = {
    0x12345678,
    0xAABBCCDD,
    0xFFFFFFFF
  };
  
  for (int i = 0; i < 3; i++) {
    uint32_t addr = testAddresses[i];
    uint32_t value = testValues[i];
    uint32_t readValue = 0;
    
    // Attempt write
    SerialUSB.print("Writing 0x");
    SerialUSB.print(value, HEX);
    SerialUSB.print(" to address 0x");
    SerialUSB.println(addr, HEX);
    
    bool writeResult = Medusa.writePulpinoMemory(addr, value);
    
    if (writeResult) {
      SerialUSB.println("Write successful");
    } else {
      SerialUSB.println("Write failed");
    }
    
    // Attempt read
    SerialUSB.print("Reading from address 0x");
    SerialUSB.println(addr, HEX);
    
    bool readResult = Medusa.readPulpinoMemory(addr, &readValue);
    
    if (readResult) {
      SerialUSB.print("Read value: 0x");
      SerialUSB.println(readValue, HEX);
      
      // Check if read matches write
      if (readValue == value) {
        passTest("Memory read/write match");
      } else {
        failTest("Memory read doesn't match written value");
        SerialUSB.print("Expected: 0x");
        SerialUSB.print(value, HEX);
        SerialUSB.print(" Got: 0x");
        SerialUSB.println(readValue, HEX);
      }
    } else {
      failTest("Memory read failed");
    }
    
    delay(500);
  }
}

// Minimal test for memory access
void testMinimalMemoryAccess() {
  startTest("Minimal Memory Access");
  
  uint32_t testAddress = 0x00080100;
  uint32_t testValue = 0x12345678;
  uint32_t readValue = 0;
  
  // Reset PULPino before testing
  SerialUSB.println("Resetting PULPino before memory test...");
  Medusa.resetPulpino();
  delay(100);
  
  // Try different SPI modes
  for (int mode = 0; mode < 4; mode++) {
    SerialUSB.print("\nTrying SPI Mode ");
    SerialUSB.println(mode);
    
    // Update SPI mode
    Medusa.updateSpiModeTo(mode);
    delay(50);
    
    // Attempt write
    SerialUSB.print("Writing 0x");
    SerialUSB.print(testValue, HEX);
    SerialUSB.print(" to address 0x");
    SerialUSB.println(testAddress, HEX);
    
    bool writeResult = Medusa.writePulpinoMemory(testAddress, testValue);
    
    if (writeResult) {
      SerialUSB.println("Write successful");
    } else {
      SerialUSB.println("Write failed");
    }
    
    // Attempt read with enhanced debugging
    SerialUSB.print("Reading from address 0x");
    SerialUSB.println(testAddress, HEX);
    
    bool readResult = Medusa.debugReadPulpinoMemory(testAddress, &readValue);
    
    if (readResult) {
      SerialUSB.print("Read value: 0x");
      SerialUSB.println(readValue, HEX);
      
      // Check if read matches write
      if (readValue == testValue) {
        SerialUSB.print("Mode ");
        SerialUSB.print(mode);
        SerialUSB.println(": Memory read/write match - SUCCESS!");
        passTest("Memory read/write match");
        break; // Found a working mode, no need to try others
      } else {
        SerialUSB.print("Mode ");
        SerialUSB.print(mode);
        SerialUSB.println(": Memory read doesn't match written value");
        SerialUSB.print("Expected: 0x");
        SerialUSB.print(testValue, HEX);
        SerialUSB.print(" Got: 0x");
        SerialUSB.println(readValue, HEX);
        
        // Only fail the test after trying all modes
        if (mode == 3) {
          failTest("All SPI modes failed - memory read doesn't match written value");
        }
      }
    } else {
      SerialUSB.print("Mode ");
      SerialUSB.print(mode);
      SerialUSB.println(": Memory read failed");
      
      // Only fail the test after trying all modes
      if (mode == 3) {
        failTest("All SPI modes failed - memory read operation failed");
      }
    }
    
    delay(250); // Pause between mode tests
  }
  
  // Try with different address as a fallback
  uint32_t fallbackAddress = 0x1A110000; // Peripheral region
  SerialUSB.println("\nTrying alternative address as fallback");
  SerialUSB.print("Writing to peripheral address 0x");
  SerialUSB.println(fallbackAddress, HEX);
  
  if (Medusa.writePulpinoMemory(fallbackAddress, testValue)) {
    SerialUSB.println("Fallback write successful");
    
    if (Medusa.debugReadPulpinoMemory(fallbackAddress, &readValue)) {
      if (readValue == testValue) {
        passTest("Fallback memory location works");
      } else {
        SerialUSB.println("Fallback read returned incorrect value");
      }
    }
  }
}

// Flash and Verify PULPino Firmware
void testFirmwareFlashing() {
  startTest("Firmware Flashing");
  
  const char* firmwareFile = "/BIN_Files/firmware/blink.bin";
  
  SerialUSB.print("Flashing PULPino with: ");
  SerialUSB.println(firmwareFile);
  
  Medusa.flashPulpino(firmwareFile);
  delay(1000);  // Give it time to boot
  
  // Verify by reading first few bytes
  uint32_t bootAddress = 0x00080000;
  uint32_t readValue = 0;
  
  bool readResult = Medusa.readPulpinoMemory(bootAddress, &readValue);
  
  if (readResult) {
    SerialUSB.print("First word at boot address: 0x");
    SerialUSB.println(readValue, HEX);
    passTest("Read from boot address successful");
  } else {
    failTest("Could not read from boot address");
  }
  
  // Try to verify communication buffer status
  uint32_t commStatus = 0;
  if (Medusa.readPulpinoMemory(0x00080100, &commStatus)) {
    SerialUSB.print("Communication status: 0x");
    SerialUSB.println(commStatus, HEX);
    if (commStatus == 0xAA) {
      passTest("PULPino reports READY status");
    } else {
      failTest("PULPino not reporting READY status");
    }
  } else {
    failTest("Could not read communication status");
  }
}

// Run a basic communication test
void testCommandExecution() {
  startTest("Command Execution");
  
  // Test echo command
  uint32_t testValue = 0x12345678;
  uint32_t result = 0;
  
  SerialUSB.println("Testing echo command (1)...");
  if (Medusa.sendPulpinoCommand(1, testValue, &result)) {
    if (result == testValue) {
      passTest("Echo command successful");
    } else {
      failTest("Echo command returned incorrect value");
      SerialUSB.print("Expected: 0x");
      SerialUSB.print(testValue, HEX);
      SerialUSB.print(" Got: 0x");
      SerialUSB.println(result, HEX);
    }
  } else {
    failTest("Echo command failed to execute");
  }
  
  // Test add one command
  testValue = 41;
  SerialUSB.println("Testing add one command (2)...");
  if (Medusa.sendPulpinoCommand(2, testValue, &result)) {
    if (result == testValue + 1) {
      passTest("Add one command successful");
    } else {
      failTest("Add one command returned incorrect value");
      SerialUSB.print("Expected: ");
      SerialUSB.print(testValue + 1);
      SerialUSB.print(" Got: ");
      SerialUSB.println(result);
    }
  } else {
    failTest("Add one command failed to execute");
  }
  
  // Test square command
  testValue = 7;
  SerialUSB.println("Testing square command (3)...");
  if (Medusa.sendPulpinoCommand(3, testValue, &result)) {
    if (result == testValue * testValue) {
      passTest("Square command successful");
    } else {
      failTest("Square command returned incorrect value");
      SerialUSB.print("Expected: ");
      SerialUSB.print(testValue * testValue);
      SerialUSB.print(" Got: ");
      SerialUSB.println(result);
    }
  } else {
    failTest("Square command failed to execute");
  }
}

// Test SPI diagnostic functions
void testSpiDiagnostics() {
  startTest("SPI Diagnostics");
  
  // First run a loopback test to verify hardware
  SerialUSB.println("Running SPI loopback test to verify hardware functionality");
  SerialUSB.println("This requires connecting MOSI and MISO pins with a jumper wire");
  
  if (Medusa.testSpiLoopback()) {
    passTest("SPI loopback test passed - hardware is functioning correctly");
  } else {
    failTest("SPI loopback test failed - check hardware connections");
  }
  
  // Test all 4 SPI modes to see which one works with PULPino
  SerialUSB.println("Testing all SPI modes to find the correct one for PULPino");
  
  if (Medusa.testPulpinoSpiModes()) {
    passTest("Found a working SPI mode for PULPino");
  } else {
    failTest("No working SPI mode found - possible hardware/connection issue");
  }
}

void setup() {
  // Initialize debug serial
  SerialUSB.begin(SERIALUSB_BAUD);
  while (!SerialUSB) {}

  // Announce start of tests
  SerialUSB.println("\n\n===========================================");
  SerialUSB.println("PULPino Communication Test Suite - Focused Tests");
  SerialUSB.println("===========================================");

  // Configure built-in LED
  pinMode(LED_BUILTIN, OUTPUT);

  // Initialize MEDUSA platform
  Medusa.setup();
  SerialUSB.println("MEDUSA platform initialized");
  delay(500);

  // Run only the most fundamental tests to debug PULPino communication
  testSpiDiagnostics();      // Test SPI hardware loopback first
  testSPICommunication();    // Test basic SPI signals
  testPULPinoReset();        // Test reset sequence
  testMinimalMemoryAccess(); // Focused test on basic memory access
  
  // Print test summary
  SerialUSB.println("\n===========================================");
  SerialUSB.println("Test Summary");
  SerialUSB.println("===========================================");
  SerialUSB.print("Passed: ");
  SerialUSB.println(testsPassed);
  SerialUSB.print("Failed: ");
  SerialUSB.println(testsFailed);
  SerialUSB.println("\nTests completed. Enter commands to continue testing.");
  SerialUSB.println("Type 'help' for available commands.");
}

void loop() {
  // Blink LED at 2 Hz to indicate test program is running
  static uint32_t lastToggle = 0;
  static bool ledOn = false;
  uint32_t now = millis();
  if (now - lastToggle >= 250) {
    lastToggle = now;
    ledOn = !ledOn;
    digitalWrite(LED_BUILTIN, ledOn);
  }

  // Handle serial commands (similar to main program)
  if (SerialUSB.available()) {
    String cmd = SerialUSB.readStringUntil('\n');
    cmd.trim();
    
    if (cmd.equalsIgnoreCase("help")) {
      SerialUSB.println("Available commands:");
      SerialUSB.println("  diagnostics - Run SPI diagnostics tests");
      SerialUSB.println("  spi         - Test SPI communication");
      SerialUSB.println("  reset       - Test PULPino reset sequence");
      SerialUSB.println("  memory      - Test memory access");
      SerialUSB.println("  flash       - Test firmware flashing");
      SerialUSB.println("  commands    - Test command execution");
      SerialUSB.println("  all         - Run all tests");
      SerialUSB.println("  mode0       - Set SPI to Mode 0 (CPOL=0, CPHA=0)");
      SerialUSB.println("  mode1       - Set SPI to Mode 1 (CPOL=0, CPHA=1)");
      SerialUSB.println("  mode2       - Set SPI to Mode 2 (CPOL=1, CPHA=0)");
      SerialUSB.println("  mode3       - Set SPI to Mode 3 (CPOL=1, CPHA=1)");
    } else if (cmd.equalsIgnoreCase("diagnostics")) {
      testSpiDiagnostics();
    } else if (cmd.equalsIgnoreCase("spi")) {
      testSPICommunication();
    } else if (cmd.equalsIgnoreCase("reset")) {
      testPULPinoReset();
    } else if (cmd.equalsIgnoreCase("memory")) {
      testMemoryAccess();
    } else if (cmd.equalsIgnoreCase("flash")) {
      testFirmwareFlashing();
    } else if (cmd.equalsIgnoreCase("commands")) {
      testCommandExecution();
    } else if (cmd.equalsIgnoreCase("all")) {
      testSPICommunication();
      testPULPinoReset();
      testMemoryAccess();
      testFirmwareFlashing();
      testCommandExecution();
    } else if (cmd.equalsIgnoreCase("mode0")) {
      Medusa.updateSpiModeTo(0);
      SerialUSB.println("SPI set to Mode 0");
    } else if (cmd.equalsIgnoreCase("mode1")) {
      Medusa.updateSpiModeTo(1);
      SerialUSB.println("SPI set to Mode 1");
    } else if (cmd.equalsIgnoreCase("mode2")) {
      Medusa.updateSpiModeTo(2);
      SerialUSB.println("SPI set to Mode 2");
    } else if (cmd.equalsIgnoreCase("mode3")) {
      Medusa.updateSpiModeTo(3);
      SerialUSB.println("SPI set to Mode 3");
    } else {
      SerialUSB.print("Unknown command: ");
      SerialUSB.println(cmd);
      SerialUSB.println("Type 'help' for available commands.");
    }
  }
}