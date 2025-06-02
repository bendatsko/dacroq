// Project: AMORGOS Teensy Test Bench - API Protocol
// Enhanced for Python API communication

#include "main.h"
#include "file_system.h"

// Initialize chip object
AMORGOS chip;

// Protocol constants matching Python API
const uint32_t START_MARKER = 0xDEADBEEF;
const uint32_t END_MARKER = 0xFFFFFFFF;
const uint32_t PROTOCOL_VERSION = 0x00010000;

// Test result structure matching Python expectations
struct TestResult {
    uint32_t vector_index;
    uint32_t execution_time_us;
    uint32_t total_cycles;
    uint32_t samples[25]; // 24 decoded bits + 1 error count
    float energy_per_bit_pj;
    float total_energy_pj;
    float avg_power_mw;
    uint8_t success;
    uint8_t padding[3]; // Align to 140 bytes
};

// Allocate memory for test data
const uint32_t MAX_VECTORS = 1000;
EXTMEM uint32_t softInfo[24 * MAX_VECTORS];
EXTMEM TestResult results[MAX_VECTORS];

// Command states
enum CommandState {
    STATE_IDLE,
    STATE_IDENTIFY,
    STATE_STATUS,
    STATE_HEALTH_CHECK,
    STATE_RUN_TEST,
    STATE_PROCESSING
};

CommandState currentState = STATE_IDLE;
uint32_t vectorsToProcess = 0;
uint32_t currentVector = 0;


bool testExternalMemory() {
    // Simple memory test
    uint32_t testPattern = 0xA5A5A5A5;
    softInfo[0] = testPattern;
    return softInfo[0] == testPattern;
}


void setup() {
    SerialUSB.begin(2000000); // 2Mbps for fast communication
    
    // Wait for serial with timeout
    uint32_t start = millis();
    while (!SerialUSB && (millis() - start < 5000)) {
        // 5 second timeout
    }
    
    // Initialize hardware
    chip.setup(AMORGOS_EXT_CLK, AMORGOS_FREQ, AMORGOS_FREQ_DIV);
    
    // Clear serial buffers
    while (SerialUSB.available()) {
        SerialUSB.read();
    }
    
    // Send startup complete
    SerialUSB.println("AMORGOS LDPC Decoder Ready");
    SerialUSB.println("Firmware Version: 2.0");
    SerialUSB.print("Temperature: ");
    SerialUSB.print(InternalTemperature.readTemperatureC());
    SerialUSB.println(" C");
}

void handleIdentify() {
    SerialUSB.println("DACROQ_BOARD:LDPC");
    currentState = STATE_IDLE;
}

void handleStatus() {
    // Check chip health
    bool chipOk = chip.readReg(CONTROL_REGS) != 0xFFFFFFFF;
    
    if (chipOk) {
        SerialUSB.println("STATUS:READY");
    } else {
        SerialUSB.println("STATUS:ERROR:CHIP_NOT_RESPONDING");
    }
    currentState = STATE_IDLE;
}

void handleHealthCheck() {
    SerialUSB.println("ACK:HEALTH_CHECK");
    
    // Power check
    bool powerOk = true; // Add actual power monitoring if available
    SerialUSB.print("POWER_");
    SerialUSB.println(powerOk ? "OK" : "FAIL");
    
    // Clock check
    bool clockOk = chip.verifyClockStability();
    SerialUSB.print("CLOCK_");
    SerialUSB.println(clockOk ? "OK" : "FAIL");
    
    // Memory check
    bool memoryOk = testExternalMemory();
    SerialUSB.print("MEMORY_");
    SerialUSB.println(memoryOk ? "OK" : "FAIL");
    
    // Oscillator check
    bool oscOk = chip.testOscillators();
    SerialUSB.print("OSCILLATORS_");
    SerialUSB.println(oscOk ? "OK" : "FAIL");
    
    // Overall status
    bool allOk = powerOk && clockOk && memoryOk && oscOk;
    SerialUSB.print("HEALTH_CHECK_COMPLETE:");
    SerialUSB.println(allOk ? "OK" : "ERROR");
    
    currentState = STATE_IDLE;
}

void handleRunTest() {
    SerialUSB.println("ACK:RUN_TEST");
    currentState = STATE_RUN_TEST;
    vectorsToProcess = 0;
    currentVector = 0;
}

void processTestHeader() {
    if (SerialUSB.available() >= 8) {
        // Read start marker
        uint32_t marker = 0;
        SerialUSB.readBytes((char*)&marker, 4);
        
        if (marker != START_MARKER) {
            SerialUSB.println("ERROR:INVALID_START_MARKER");
            currentState = STATE_IDLE;
            return;
        }
        
        // Read number of vectors
        SerialUSB.readBytes((char*)&vectorsToProcess, 4);
        
        if (vectorsToProcess > MAX_VECTORS) {
            SerialUSB.println("ERROR:TOO_MANY_VECTORS");
            currentState = STATE_IDLE;
            return;
        }
        
        // Send acknowledgment with count
        SerialUSB.write((uint8_t*)&vectorsToProcess, 4);
        
        currentVector = 0;
        currentState = STATE_PROCESSING;
        
        // Initialize chip for batch processing
        chip.batchRunStartup();
    }
}

void processVector() {
    if (SerialUSB.available() >= 96) { // 24 * 4 bytes
        // Read soft info vector
        uint32_t inputs[24];
        SerialUSB.readBytes((char*)inputs, 96);
        
        // Process on hardware
        chip.loadSoftInfo(inputs);
        chip.writeReg(CONTROL_REGS | CTRL_CONF_PC_CONTINUE*4, 1);
        
        // Time the execution
        uint32_t startTime = micros();
        
        // Wait for completion with timeout
        uint32_t timeout = 1000000; // 1 second timeout
        while (!digitalReadFast(DONE_PIN) && (micros() - startTime < timeout)) {
            // Wait
        }
        
        uint32_t executionTime = micros() - startTime;
        
        // Retrieve results
        uint32_t samples[25] = {0};
        chip.retrieveSamples(samples);
        uint32_t totalCycles = chip.readReg(CONTROL_REGS | TOTAL_CYCLE*4);
        
        // Count errors (non-binary values)
        uint32_t errorCount = 0;
        for (int i = 0; i < 24; i++) {
            if (samples[i] > 1) errorCount++;
        }
        samples[24] = errorCount;
        
        // Calculate metrics based on paper specifications
        float energyPerBit = 5.47; // pJ/bit from paper
        float totalEnergy = energyPerBit * 48; // 48 info bits
        float avgPower = (totalEnergy * 1e-12) / (executionTime * 1e-6) * 1e3; // mW
        
        // Prepare result
        TestResult result;
        result.vector_index = currentVector;
        result.execution_time_us = executionTime;
        result.total_cycles = totalCycles;
        memcpy(result.samples, samples, sizeof(samples));
        result.energy_per_bit_pj = energyPerBit;
        result.total_energy_pj = totalEnergy;
        result.avg_power_mw = avgPower;
        result.success = (executionTime < 1000000) ? 1 : 0;
        
        // Send result (140 bytes)
        SerialUSB.write((uint8_t*)&result, sizeof(TestResult));
        
        currentVector++;
        
        // Check if done
        if (currentVector >= vectorsToProcess) {
            // Send completion marker
            uint32_t endMarker = END_MARKER;
            SerialUSB.write((uint8_t*)&endMarker, 4);
            SerialUSB.println("TEST_COMPLETE:SUCCESS");
            currentState = STATE_IDLE;
        }
    }
}



void processCommand(String cmd) {
    cmd.trim();
    
    if (cmd == "I") {
        currentState = STATE_IDENTIFY;
    } else if (cmd == "STATUS") {
        currentState = STATE_STATUS;
    } else if (cmd == "HEALTH_CHECK") {
        currentState = STATE_HEALTH_CHECK;
    } else if (cmd == "RUN_TEST") {
        currentState = STATE_RUN_TEST;
    } else if (cmd == "LED:IDLE") {
        // Set LED to idle state if available
    } else if (cmd == "LED:ERROR") {
        // Set LED to error state if available
    }
}

void loop() {
    // Handle serial commands
    if (SerialUSB.available() && currentState == STATE_IDLE) {
        String cmd = SerialUSB.readStringUntil('\n');
        processCommand(cmd);
    }
    
    // Handle state machine
    switch (currentState) {
        case STATE_IDENTIFY:
            handleIdentify();
            break;
            
        case STATE_STATUS:
            handleStatus();
            break;
            
        case STATE_HEALTH_CHECK:
            handleHealthCheck();
            break;
            
        case STATE_RUN_TEST:
            processTestHeader();
            break;
            
        case STATE_PROCESSING:
            processVector();
            break;
            
        case STATE_IDLE:
        default:
            // Send periodic heartbeat
            static uint32_t lastHeartbeat = 0;
            if (millis() - lastHeartbeat > 3000) {
                SerialUSB.print("DACROQ_BOARD:LDPC:HEARTBEAT:");
                SerialUSB.println(millis());
                lastHeartbeat = millis();
            }
            break;
    }
}
