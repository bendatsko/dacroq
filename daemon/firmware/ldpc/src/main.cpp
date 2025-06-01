/*
 * LDPC Analog-Assisted Decoder Firmware
 * Teensy 4.1 + AMORGOS Chip
 * 
 * LED Status Patterns:
 * - LED:IDLE -> Solid blue (ready for tests)
 * - LED:RECEIVED -> Slow yellow blink (test received)
 * - LED:RUNNING -> Fast green blink (test in progress)
 * - LED:COMPLETED -> Purple pulse (test finished)
 * - LED:ERROR -> Red flash (communication error)
 * - LED:OFF -> Turn off LED
 */

#include <Arduino.h>
#include "main.h"
#include "file_system.h"

// LED states
enum LEDState {
  LED_OFF,
  LED_IDLE,
  LED_RECEIVED,
  LED_RUNNING,
  LED_COMPLETED,
  LED_ERROR
};

// Function prototypes
void handleCommand(String command);
void setLEDState(LEDState state);
void updateLED();
void runAmorgosTest();

// Initialize chip object
AMORGOS chip;

// Allocate memory for soft info
const uint32_t length = 76800; 
const size_t softInfoSize = 24 * length;
EXTMEM uint32_t softInfo[softInfoSize];

// Allocate memory for output data
const size_t dataOutSize = 25*length;
EXTMEM uint32_t dataOut[dataOutSize];

// LED Pin (built-in LED on Teensy 4.1)
const int ledPin = 13;

LEDState currentLEDState = LED_IDLE;
unsigned long ledTimer = 0;
bool ledOn = false;
bool simpleBlinkMode = false;

void setup() {
  Serial.begin(2000000);
  
  // Initialize built-in LED pin (same as working example)
  pinMode(ledPin, OUTPUT);
  
  // Start with LED ON (IDLE state)
  digitalWrite(ledPin, HIGH);
  currentLEDState = LED_IDLE;
  
  Serial.println("DACROQ_BOARD:LDPC");
  Serial.println("LDPC Decoder Ready");
  Serial.println("Setup complete - ready for commands");
  Serial.println("Available commands:");
  Serial.println("  LED:ON, LED:OFF, LED:BLINK");
  Serial.println("  SIMPLE_BLINK (toggle simple blink mode)");
  Serial.println("  I (identify)");
  
  // Don't initialize AMORGOS yet - keep it simple for LED testing
  Serial.println("LED should be ON now - if not, there's a hardware issue");
}

void loop() {
  // Handle serial commands
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    handleCommand(command);
  }
  
  // Simple blink mode (like the working example)
  if (simpleBlinkMode) {
    digitalWrite(ledPin, HIGH);   // set the LED on
    delay(1000);                  // wait for a second
    digitalWrite(ledPin, LOW);    // set the LED off
    delay(1000);                  // wait for a second
  }
}

void handleCommand(String command) {
  Serial.print("Received: ");
  Serial.println(command);
  
  if (command == "LED:ON") {
    Serial.println("Turning LED ON");
    digitalWrite(ledPin, HIGH);
    simpleBlinkMode = false;
    Serial.println("LED_ACK:ON");
  }
  else if (command == "LED:OFF") {
    Serial.println("Turning LED OFF");
    digitalWrite(ledPin, LOW);
    simpleBlinkMode = false;
    Serial.println("LED_ACK:OFF");
  }
  else if (command == "LED:BLINK") {
    Serial.println("Starting LED blink");
    simpleBlinkMode = false;
    // Manual blink sequence
    for(int i = 0; i < 10; i++) {
      digitalWrite(ledPin, HIGH);
      delay(200);
      digitalWrite(ledPin, LOW);
      delay(200);
    }
    digitalWrite(ledPin, HIGH); // Leave it on
    Serial.println("LED_ACK:BLINK");
  }
  else if (command == "I") {
    // Identification command
    Serial.println("DACROQ_BOARD:LDPC");
  }
  else if (command == "LED_TEST") {
    // Simple LED test sequence
    Serial.println("Starting LED test sequence...");
    simpleBlinkMode = false;
    
    Serial.println("LED OFF for 2 seconds");
    digitalWrite(ledPin, LOW);
    delay(2000);
    
    Serial.println("LED ON for 2 seconds");
    digitalWrite(ledPin, HIGH);
    delay(2000);
    
    Serial.println("Fast blink 5 times");
    for(int i = 0; i < 5; i++) {
      digitalWrite(ledPin, LOW);
      delay(200);
      digitalWrite(ledPin, HIGH);
      delay(200);
    }
    
    Serial.println("LED test complete - LED should be ON");
  }
  else if (command == "RUN_TEST") {
    // Run the original AMORGOS test
    Serial.println("Starting AMORGOS test...");
    runAmorgosTest();
  }
  else if (command == "SIMPLE_BLINK") {
    simpleBlinkMode = !simpleBlinkMode;
    if (simpleBlinkMode) {
      Serial.println("Simple blink mode ON - LED will blink every second");
    } else {
      Serial.println("Simple blink mode OFF");
      digitalWrite(ledPin, HIGH); // Leave LED on
    }
  }
  else {
    Serial.print("Unknown command: ");
    Serial.println(command);
  }
}

void setLEDState(LEDState state) {
  currentLEDState = state;
  ledTimer = millis();
  ledOn = false;
  
  // Debug output
  Serial.print("LED state changed to: ");
  switch(state) {
    case LED_OFF: Serial.println("OFF"); break;
    case LED_IDLE: Serial.println("IDLE"); break;
    case LED_RECEIVED: Serial.println("RECEIVED"); break;
    case LED_RUNNING: Serial.println("RUNNING"); break;
    case LED_COMPLETED: Serial.println("COMPLETED"); break;
    case LED_ERROR: Serial.println("ERROR"); break;
  }
}

void updateLED() {
  unsigned long currentTime = millis();
  
  switch (currentLEDState) {
    case LED_OFF:
      digitalWrite(ledPin, LOW);
      break;
      
    case LED_IDLE:
      digitalWrite(ledPin, HIGH);
      break;
      
    case LED_RECEIVED:
      // Slow yellow blink (1 second on/off)
      if (currentTime - ledTimer >= 1000) {
        ledOn = !ledOn;
        ledTimer = currentTime;
      }
      if (ledOn) {
        digitalWrite(ledPin, HIGH);
      } else {
        digitalWrite(ledPin, LOW);
      }
      break;
      
    case LED_RUNNING:
      // Fast green blink (200ms on/off)
      if (currentTime - ledTimer >= 200) {
        ledOn = !ledOn;
        ledTimer = currentTime;
      }
      if (ledOn) {
        digitalWrite(ledPin, HIGH);
      } else {
        digitalWrite(ledPin, LOW);
      }
      break;
      
    case LED_COMPLETED:
      // Purple pulse (sine wave brightness)
      {
        float brightness = (sin((currentTime - ledTimer) * 0.01) + 1.0) * 0.5;
        int purple = (int)(255 * brightness);
        analogWrite(ledPin, (int)(255 * brightness));
      }
      break;
      
    case LED_ERROR:
      // Red flash (100ms on, 900ms off)
      if (currentTime - ledTimer >= 1000) {
        ledTimer = currentTime;
        ledOn = true;
      }
      if (ledOn && currentTime - ledTimer >= 100) {
        ledOn = false;
      }
      
      if (ledOn) {
        digitalWrite(ledPin, HIGH);
      } else {
        digitalWrite(ledPin, LOW);
      }
      break;
  }
}

void runAmorgosTest() {
  String INFO = "/SOFT_INFO";  // Soft or hard info identifier

  String SNRs[10] = {"1dB", "2dB", "3dB", "4dB", "5dB", "6dB", "7dB", "8dB", "9dB", "10dB"}; 
                        // 1db  2dB  3dB  4dB  5dB  6dB  7dB  8dB  9dB  10dB
  uint8_t totalRuns[10] = {10,  10,  15,   0,   0,   60,   0,   0,   0,   0};

  // Initialize timing variables
  u_long timeStart = millis();  // Record start time
  u_long timeLast = 0;          // Used to store time before an operation

  for (uint8_t SNR = 0; SNR < 10; SNR++)
  {
    if (totalRuns[SNR] > 0)
    {
      SerialUSB.println("\nInput: " + SNRs[SNR] + " SNR");
      SerialUSB.print("Caching soft info... ");
      
      timeLast = millis();
      cacheSoftInfo(SNRs[SNR] + INFO, softInfo, softInfoSize);
      
      SerialUSB.println("Complete. Time: " + String((millis() - timeLast)) + "ms");
    }
    for (uint8_t i = 0; i < totalRuns[SNR]; i++)
    {
      SerialUSB.print("Run " + String(i) + ": ");

      timeLast = millis();
      chip.batchRunStartup();
      chip.batchRunLoop(SNRs[SNR] + INFO, softInfo, dataOut, length, i);
      // chip.batchPowerMeas(SNRs[SNR] + INFO, softInfo, dataOut, length, i);
      SerialUSB.println("complete. Time: " + String((millis() - timeLast) / 1000) + "s");
    }
  }
  
  // Calculate execution time
  u_long time = (millis() - timeStart) / 1000;
  u_long seconds = time % 60;
  u_long minutes = ((time - seconds) / 60) % 60;
  u_long hours = ((((time - seconds) / 60) - minutes) / 60) % 24;
  u_long days = (((((time - seconds) / 60) - minutes) / 60) - hours) / 24;

  // Print execution time
  SerialUSB.println("\nDays: " + String(days) + "   Hours: " + String(hours) + "   Minutes: " + String(minutes) + "   Seconds: " + String(seconds));
  // Print completion message
  SerialUSB.println("Safe to remove SD card.");
}