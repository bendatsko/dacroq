// PULPino Communication Program
// Sets up a memory-mapped region for bidirectional communication with Teensy

// Define memory-mapped registers for the PULPino GPIO peripheral
#define GPIO_REG_BASE     0x1A101000
#define GPIO_PADDIR       (*(volatile unsigned int*)(GPIO_REG_BASE + 0x00))  // Direction register
#define GPIO_PADIN        (*(volatile unsigned int*)(GPIO_REG_BASE + 0x04))  // Input values register
#define GPIO_PADOUT       (*(volatile unsigned int*)(GPIO_REG_BASE + 0x08))  // Output values register

// Communication protocol constants
#define COMM_READY        0xAA      // Ready for command
#define COMM_ACK          0x55      // Command acknowledged
#define COMM_BUSY         0xBB      // Processor busy
#define COMM_ERROR        0xEE      // Error occurred

// Memory region for SPI-based communication
#define COMM_BUFFER_ADDR  0x00080100
#define COMM_STATUS       (*(volatile unsigned int*)(COMM_BUFFER_ADDR + 0))  // Status register 
#define COMM_COMMAND      (*(volatile unsigned int*)(COMM_BUFFER_ADDR + 4))  // Command register
#define COMM_DATA         (*(volatile unsigned int*)(COMM_BUFFER_ADDR + 8))  // Data register
#define COMM_RESULT       (*(volatile unsigned int*)(COMM_BUFFER_ADDR + 12)) // Result register

// Entry point symbol for the linker
void _start(void) __attribute__((naked, section(".text.startup")));

// Simple delay function
void delay(volatile int cycles) {
    while (cycles--) {
        // This empty loop will not be optimized away due to volatile
    }
}

// Main function
int main() {
    // Initialize communication buffer
    COMM_STATUS = COMM_READY;  // Set status to "ready"
    COMM_COMMAND = 0;          // Clear command register
    COMM_DATA = 0;             // Clear data register
    COMM_RESULT = 0;           // Clear result register
    
    // Configure GPIO0-3 as outputs for debugging
    GPIO_PADDIR = 0x0000000F;  // Set direction for GPIO 0-3 as outputs
    GPIO_PADOUT = 0x00000001;  // Set GPIO0 high to indicate we're running
    
    // Main communication loop
    while (1) {
        // Check if there's a new command
        unsigned int cmd = COMM_COMMAND;
        
        if (cmd != 0) {
            GPIO_PADOUT = 0x00000002;  // Set GPIO1 high to indicate command processing
            COMM_STATUS = COMM_BUSY;   // Set status to busy
            
            // Process command
            switch (cmd) {
                case 1:  // Echo command - return the data as-is
                    COMM_RESULT = COMM_DATA;
                    break;
                    
                case 2:  // Add one to the data
                    COMM_RESULT = COMM_DATA + 1;
                    break;
                    
                case 3:  // Calculate data squared
                    COMM_RESULT = COMM_DATA * COMM_DATA;
                    break;
                    
                default:
                    // Unknown command
                    COMM_STATUS = COMM_ERROR;
                    COMM_RESULT = 0xFFFFFFFF;
                    break;
            }
            
            // If we reached here without error, acknowledge the command
            if (COMM_STATUS != COMM_ERROR) {
                COMM_STATUS = COMM_ACK;
            }
            
            // Clear command to indicate we're ready for the next one
            COMM_COMMAND = 0;
            GPIO_PADOUT = 0x00000001;  // Back to idle state (only GPIO0 high)
        }
        
        // Small delay to avoid hammering the registers
        delay(1000);
    }
    
    // Code will never reach here
    return 0;
}

// RISC-V startup code
void _start(void) {
    // Call main
    main();
    
    // Should never return, but just in case:
    while(1) {}
}