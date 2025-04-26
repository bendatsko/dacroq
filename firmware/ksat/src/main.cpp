// Project: DAEDALUS Teensy Test Bench w/ blink & ping-pong
// Authors: Luke Wormald, Ying-Tuan, and Vangelis

#include "main.h"
#include <Arduino.h>

MEDUSA Medusa;

// Helper: run the existing solver batch
void runSolverBatch() {
  for (uint32_t i = 66; i <= 69; i++) {
    String number = String(i);
    String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_4/" + number + ".dimacs.bin";
    Medusa.runSolverCoupled(filepath, 100);
    SerialUSB.println("Finished run " + String(i));
  }
  SerialUSB.println("Finished running solver batch");
}

void setup() {
  // Initialize debug serial
  SerialUSB.begin(SERIALUSB_BAUD);
  while (!SerialUSB) {}

  // Announce
  SerialUSB.println("DAEDALUS Teensy Test Bench alive!");

  // Configure built‑in LED for blink
  pinMode(LED_BUILTIN, OUTPUT);

  // Initialize MEDUSA platform
  Medusa.setup();
  SerialUSB.println("MEDUSA platform initialized");

  SerialUSB.println("Send 'ping' to get 'pong', 'run' to start solver, 'flash' to flash firmware to asic" );
}

void loop() {
  // 1) Blink LED at ~1 Hz
  static uint32_t lastToggle = 0;
  static bool ledOn = false;
  uint32_t now = millis();
  if (now - lastToggle >= 500) {
    lastToggle = now;
    ledOn = !ledOn;
    digitalWrite(LED_BUILTIN, ledOn);
  }

  // 2) Handle serial commands
  if (SerialUSB.available()) {
    String cmd = SerialUSB.readStringUntil('\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("ping")) {
      
      // Flash the PULPino with our blink.c program
      SerialUSB.println("Flashing PULPino with blink.bin...");
      
      // Make sure the blink.bin file exists on the SD card
      if (!SD.exists("/blink.bin")) {
        SerialUSB.println("Error: blink.bin file not found on SD card");
        SerialUSB.println("Please copy the blink.bin file to the root of the SD card");
      } else {
        // Flash the PULPino
        Medusa.flashPulpino("/blink.bin");
        SerialUSB.println("pong");
      }
    } else if (cmd.equalsIgnoreCase("run")) {
      runSolverBatch();
    } else if (cmd.startsWith("flash")) {
      // Default filename if none specified
      String filename = "/BIN_Files/firmware/blink.bin";
      
      // Extract filename if provided
      if (cmd.length() > 6) { // More than just "flash "
        filename = cmd.substring(6); // Skip "flash " prefix
        filename.trim();
      }
      
      SerialUSB.println("Flashing PULPino with file: " + filename);
      
      // Convert String to const char* for the flashPulpino method
      char filenameBuffer[64];
      filename.toCharArray(filenameBuffer, sizeof(filenameBuffer));
      
      // Flash the PULPino processor
      Medusa.flashPulpino(filenameBuffer);
    } else if (cmd.equalsIgnoreCase("pingpulp")) {
      // Echo test - send value 0x12345678 and expect to get it back
      uint32_t testValue = 0x12345678;
      uint32_t result;
      
      SerialUSB.println("Testing PULPino communication...");
      
      if (Medusa.sendPulpinoCommand(1, testValue, &result)) {
        if (result == testValue) {
          SerialUSB.println("Communication test PASSED!");
        } else {
          SerialUSB.print("Communication test FAILED! Expected: 0x");
          SerialUSB.print(testValue, HEX);
          SerialUSB.print(", Got: 0x");
          SerialUSB.println(result, HEX);
        }
      }
    } else if (cmd.startsWith("addone")) {
      // Request to add 1 to a value
      uint32_t value = 41; // Default value
      uint32_t result;
      
      // Check if there's a parameter
      int spaceIndex = cmd.indexOf(' ');
      if (spaceIndex > 0 && cmd.length() > spaceIndex + 1) {
        value = cmd.substring(spaceIndex + 1).toInt();
      }
      
      SerialUSB.print("Sending value ");
      SerialUSB.print(value);
      SerialUSB.println(" to PULPino to add 1...");
      
      if (Medusa.sendPulpinoCommand(2, value, &result)) {
        SerialUSB.print("Result: ");
        SerialUSB.println(result);
      }
    } else if (cmd.startsWith("square")) {
      // Request to square a value
      uint32_t value = 7; // Default value
      uint32_t result;
      
      // Check if there's a parameter
      int spaceIndex = cmd.indexOf(' ');
      if (spaceIndex > 0 && cmd.length() > spaceIndex + 1) {
        value = cmd.substring(spaceIndex + 1).toInt();
      }
      
      SerialUSB.print("Sending value ");
      SerialUSB.print(value);
      SerialUSB.println(" to PULPino to square...");
      
      if (Medusa.sendPulpinoCommand(3, value, &result)) {
        SerialUSB.print("Result: ");
        SerialUSB.println(result);
      }
    } else if (cmd.startsWith("read")) {
      // Read a memory location
      uint32_t address = 0x00080100; // Default address (status register)
      uint32_t value;
      
      // Check if there's a parameter
      int spaceIndex = cmd.indexOf(' ');
      if (spaceIndex > 0 && cmd.length() > spaceIndex + 1) {
        String addrStr = cmd.substring(spaceIndex + 1);
        addrStr.trim();
        
        // Handle hex format (0x prefix)
        if (addrStr.startsWith("0x") || addrStr.startsWith("0X")) {
          char* endPtr;
          address = strtoul(addrStr.c_str(), &endPtr, 16);
        } else {
          address = addrStr.toInt();
        }
      }
      
      SerialUSB.print("Reading from address 0x");
      SerialUSB.print(address, HEX);
      SerialUSB.println("...");
      
      if (Medusa.readPulpinoMemory(address, &value)) {
        SerialUSB.print("Value: 0x");
        SerialUSB.println(value, HEX);
      }
    } else if (cmd.startsWith("write")) {
      // Write to a memory location
      uint32_t address = 0;
      uint32_t value = 0;
      
      // Parse command format: write ADDR VAL
      int firstSpace = cmd.indexOf(' ');
      if (firstSpace > 0 && cmd.length() > firstSpace + 1) {
        String remaining = cmd.substring(firstSpace + 1);
        remaining.trim();
        
        int secondSpace = remaining.indexOf(' ');
        if (secondSpace > 0 && remaining.length() > secondSpace + 1) {
          String addrStr = remaining.substring(0, secondSpace);
          String valueStr = remaining.substring(secondSpace + 1);
          addrStr.trim();
          valueStr.trim();
          
          // Handle hex format for address
          if (addrStr.startsWith("0x") || addrStr.startsWith("0X")) {
            char* endPtr;
            address = strtoul(addrStr.c_str(), &endPtr, 16);
          } else {
            address = addrStr.toInt();
          }
          
          // Handle hex format for value
          if (valueStr.startsWith("0x") || valueStr.startsWith("0X")) {
            char* endPtr;
            value = strtoul(valueStr.c_str(), &endPtr, 16);
          } else {
            value = valueStr.toInt();
          }
          
          SerialUSB.print("Writing value 0x");
          SerialUSB.print(value, HEX);
          SerialUSB.print(" to address 0x");
          SerialUSB.print(address, HEX);
          SerialUSB.println("...");
          
          if (Medusa.writePulpinoMemory(address, value)) {
            SerialUSB.println("Write successful");
          }
        } else {
          SerialUSB.println("Error: Invalid write command format. Use 'write ADDRESS VALUE'");
        }
      } else {
        SerialUSB.println("Error: Invalid write command format. Use 'write ADDRESS VALUE'");
      }
    } else {
      SerialUSB.print("echo: ");
      SerialUSB.println(cmd);
    }
  }
}
