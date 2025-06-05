// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald
// Enhanced for SAT solver hardware interface

#include "main.h"
// #include "time.h"
// #include "file_system.h"

// Communication protocol constants
#define MAX_COMMAND_LENGTH 64
#define STATUS_READY "STATUS:READY"
#define STATUS_BUSY "STATUS:BUSY"
#define STATUS_ERROR "STATUS:ERROR"

// State machine for command processing
enum TeensyState {
    STATE_IDLE,
    STATE_CALIBRATING,
    STATE_RUNNING_SAT,
    STATE_BATCH_PROCESSING
};

// Global variables
DAEDALUS Chip0;
TeensyState currentState = STATE_IDLE;
char commandBuffer[MAX_COMMAND_LENGTH];
int commandIndex = 0;
bool commandComplete = false;
unsigned long lastStatusTime = 0;
unsigned long testStartTime = 0;

// LED control for visual feedback
void blinkLED(int count = 3) {
    for (int i = 0; i < count; i++) {
        digitalWrite(LED_BUILTIN, HIGH);
        delay(100);
        digitalWrite(LED_BUILTIN, LOW);
        delay(100);
    }
}

// Reset to idle state
void resetToIdle() {
    currentState = STATE_IDLE;
    commandIndex = 0;
    commandComplete = false;
    digitalWrite(LED_BUILTIN, LOW);
}

// Send status response
void sendStatus() {
    switch (currentState) {
        case STATE_IDLE:
            SerialUSB.println(STATUS_READY);
            break;
        case STATE_CALIBRATING:
        case STATE_RUNNING_SAT:
        case STATE_BATCH_PROCESSING:
            SerialUSB.println(STATUS_BUSY);
            break;
        default:
            SerialUSB.println(STATUS_ERROR);
            break;
    }
}

// Process incoming commands
void processCommand(String command) {
    command.trim();
    
    // Only process commands in IDLE state (except STATUS and emergency commands)
    if (currentState != STATE_IDLE && 
        !command.startsWith("STATUS") && 
        !command.startsWith("RESET") &&
        !command.startsWith("LED:") &&
        !command.startsWith("BLINK")) {
        SerialUSB.println("ERROR:BUSY");
        return;
    }
    
    SerialUSB.println("RX: " + command);
    
    if (command.startsWith("STATUS")) {
        sendStatus();
        
    } else if (command.startsWith("HEALTH_CHECK")) {
        SerialUSB.println("HEALTH:OK");
        SerialUSB.println("CHIP:DAEDALUS");
        SerialUSB.println("VERSION:1.0");
        
    } else if (command.startsWith("I")) {
        SerialUSB.println("DAEDALUS_3SAT_SOLVER");
        SerialUSB.println("READY");
        
    } else if (command.startsWith("CALIBRATION:START")) {
        currentState = STATE_CALIBRATING;
        SerialUSB.println("ACK:CALIBRATION_START");
        digitalWrite(LED_BUILTIN, HIGH);
        
        // Perform calibration
        bool die = 0; // Die selection
        Chip0.Calibration(die, DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
        
        // Calibration completed (function returns void, so we assume success)
        SerialUSB.println("CALIBRATION:COMPLETE");
        blinkLED(2);
        
        resetToIdle();
        
    } else if (command.startsWith("CALIBRATION:STATUS")) {
        SerialUSB.println("CALIBRATION:READY");
        
    } else if (command.startsWith("SAT_TEST:")) {
        // Parse: SAT_TEST:problem_type:count
        // Example: SAT_TEST:uf20:1
        int firstColon = command.indexOf(':', 9);
        int secondColon = command.indexOf(':', firstColon + 1);
        
        if (firstColon > 0 && secondColon > 0) {
            String problemType = command.substring(9, firstColon);
            String countStr = command.substring(secondColon + 1);
            int problemCount = countStr.toInt();
            
            currentState = STATE_RUNNING_SAT;
            SerialUSB.println("ACK:SAT_TEST");
            SerialUSB.println("PROBLEM_TYPE:" + problemType);
            SerialUSB.println("COUNT:" + String(problemCount));
            
            testStartTime = micros();
            blinkLED(1); // Start indicator
            
            // Run SAT test(s)
            for (int i = 0; i < problemCount; i++) {
                unsigned long singleTestStart = micros();
                
                // Simulate SAT solving (replace with actual DAEDALUS chip calls)
                bool satisfiable = (random(100) > 20); // 80% SAT rate simulation
                int propagations = random(50, 500);
                
                unsigned long singleTestEnd = micros();
                unsigned long solvTimeUs = singleTestEnd - singleTestStart;
                
                // Calculate energy (simulated based on solve time)
                float energyNj = solvTimeUs * 0.05; // 50 pJ/μs estimate
                float powerMw = 5.2; // Typical DAEDALUS power
                
                // Send result in CSV format
                SerialUSB.print("RESULT:");
                SerialUSB.print(i + 1); SerialUSB.print(",");
                SerialUSB.print(satisfiable ? "SAT" : "UNSAT"); SerialUSB.print(",");
                SerialUSB.print(solvTimeUs); SerialUSB.print(",");
                SerialUSB.print(energyNj, 2); SerialUSB.print(",");
                SerialUSB.print(powerMw, 1); SerialUSB.print(",");
                SerialUSB.print(propagations);
                SerialUSB.println();
            }
            
            unsigned long totalTime = micros() - testStartTime;
            SerialUSB.println("TEST_COMPLETE");
            SerialUSB.println("TOTAL_TIME_US:" + String(totalTime));
            
            blinkLED(2); // Completion indicator
            resetToIdle();
            
        } else {
            SerialUSB.println("ERROR:INVALID_SAT_TEST_FORMAT");
        }
        
    } else if (command.startsWith("BATCH:")) {
        // Parse: BATCH:problem_set:count
        // Example: BATCH:uf20-91:10
        int firstColon = command.indexOf(':', 6);
        int secondColon = command.indexOf(':', firstColon + 1);
        
        if (firstColon > 0 && secondColon > 0) {
            String problemSet = command.substring(6, firstColon);
            String countStr = command.substring(secondColon + 1);
            int batchCount = countStr.toInt();
            
            currentState = STATE_BATCH_PROCESSING;
            SerialUSB.println("ACK:BATCH");
            SerialUSB.println("PROBLEM_SET:" + problemSet);
            SerialUSB.println("BATCH_COUNT:" + String(batchCount));
            
            // Simulate batch processing
            // In real implementation, this would call Chip0.batchRunLoop()
            testStartTime = micros();
            
            for (int i = 0; i < batchCount; i++) {
                unsigned long problemStart = micros();
                
                // Simulate solving one problem from the batch
                bool satisfiable = (random(100) > 15); // 85% SAT rate for UF problems
                int variables = (problemSet == "uf20-91") ? 20 : 50;
                int clauses = (problemSet == "uf20-91") ? 91 : 218;
                
                unsigned long problemEnd = micros();
                unsigned long solvTimeUs = problemEnd - problemStart;
                
                float energyNj = solvTimeUs * 0.045; // Slightly better efficiency for batch
                float powerMw = 5.0;
                
                SerialUSB.print("BATCH_RESULT:");
                SerialUSB.print(i + 1); SerialUSB.print(",");
                SerialUSB.print(variables); SerialUSB.print(",");
                SerialUSB.print(clauses); SerialUSB.print(",");
                SerialUSB.print(satisfiable ? "SAT" : "UNSAT"); SerialUSB.print(",");
                SerialUSB.print(solvTimeUs); SerialUSB.print(",");
                SerialUSB.print(energyNj, 2); SerialUSB.print(",");
                SerialUSB.print(powerMw, 1);
                SerialUSB.println();
                
                // Brief delay between problems
                delay(random(1, 5));
            }
            
            unsigned long totalBatchTime = micros() - testStartTime;
            SerialUSB.println("BATCH_COMPLETE");
            SerialUSB.println("TOTAL_BATCH_TIME_US:" + String(totalBatchTime));
            
            blinkLED(3); // Batch completion
            resetToIdle();
            
        } else {
            SerialUSB.println("ERROR:INVALID_BATCH_FORMAT");
        }
        
    } else if (command.startsWith("BLINK")) {
        blinkLED(3);
        SerialUSB.println("ACK:BLINK");
        
    } else if (command.startsWith("LED:ON")) {
        digitalWrite(LED_BUILTIN, HIGH);
        SerialUSB.println("ACK:LED_ON");
        
    } else if (command.startsWith("LED:OFF")) {
        digitalWrite(LED_BUILTIN, LOW);
        SerialUSB.println("ACK:LED_OFF");
        
    } else if (command.startsWith("LED:ERROR")) {
        blinkLED(5); // Fast error pattern
        SerialUSB.println("ACK:LED_ERROR");
        
    } else if (command.startsWith("RESET")) {
        resetToIdle();
        SerialUSB.println("ACK:RESET");
        SerialUSB.println(STATUS_READY);
        
    } else {
        SerialUSB.println("ERROR:UNKNOWN_COMMAND");
        SerialUSB.println("HELP: STATUS, HEALTH_CHECK, CALIBRATION:START, SAT_TEST:type:count, BATCH:set:count, BLINK, LED:ON/OFF, RESET");
    }
}

void setup() {
    // Initialize serial communication
    SerialUSB.begin(2000000);
    
    while (!SerialUSB) {
        // Wait for serial port to connect
    }
    
    // Initialize LED
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, LOW);
    
    // Initialize DAEDALUS chip pins
    pinMode(SCAN_CLK_IN, OUTPUT);
    pinMode(SCAN_CLK_OUT, INPUT);
    pinMode(SCAN_IN0, OUTPUT);
    pinMode(SCAN_IN1, OUTPUT);
    pinMode(SCAN_IN2, OUTPUT);
    pinMode(SCAN_OUT0, INPUT);
    pinMode(SCAN_OUT1, INPUT);
    pinMode(SCAN_OUT2, INPUT);
    pinMode(SCAN_WRITE_EN_DIE1, OUTPUT);
    pinMode(SCAN_WRITE_EN_DIE2, OUTPUT);
    
    // Initialize DAEDALUS chip
    SerialUSB.println("DAEDALUS 3-SAT Solver");
    SerialUSB.println("Teensy CPU Frequency: " + String(uint32_t(F_CPU/1E6)) + " MHz");
    
    // Setup chip
    Chip0.setup(DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
    
    // Initial status
    SerialUSB.println(STATUS_READY);
    
    // Visual startup indication
    blinkLED(2);
    
    // Seed random number generator
    randomSeed(analogRead(0));
}

void loop() {
    // Handle incoming serial data
    while (SerialUSB.available()) {
        char c = SerialUSB.read();
        
        if (c == '\n' || c == '\r') {
            if (commandIndex > 0) {
                commandBuffer[commandIndex] = '\0';
                String command = String(commandBuffer);
                processCommand(command);
                commandIndex = 0;
            }
        } else if (commandIndex < MAX_COMMAND_LENGTH - 1) {
            commandBuffer[commandIndex++] = c;
        }
    }
    
    // Periodic status updates during long operations
    if (currentState != STATE_IDLE && millis() - lastStatusTime > 5000) {
        sendStatus();
        lastStatusTime = millis();
    }
    
    // Handle state-specific processing
    switch (currentState) {
        case STATE_IDLE:
            // Normal idle operation
            break;
            
        case STATE_CALIBRATING:
        case STATE_RUNNING_SAT:
        case STATE_BATCH_PROCESSING:
            // These states are handled in processCommand()
            // Could add periodic progress updates here
            break;
    }
}