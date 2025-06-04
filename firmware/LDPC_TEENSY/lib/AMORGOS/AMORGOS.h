// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#ifndef AMORGOS_H
    #define AMORGOS_H

    #include <Arduino.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"  // Include pin definitions for system
    #include "../SPI/SPI.h"                     // Include local SPI library with low frequency modification 
    #include "../DAC80504/DAC80504.h"           // Include library for reference DAC
    #include "../file_system/file_system.h"     // Include file system library

    // Clock states
    #define INT_CLK 0   // Use internal clock
    #define EXT_CLK 1   // Use external clock

    // SPI commands
    #define W_REG0  0x01    // Write SPI configuration register 0
    #define WRITE   0x02    // Write chip memory and memory mapped peripherals
    #define R_REG0  0x05    // Read SPI configuration register 0
    #define R_REG1  0x07    // Read SPI configuration register 1
    #define READ    0x0B    // Read chip memory and memory mapped peripherals
    #define W_REG1  0x11    // Write SPI configuration register 1
    #define W_REG2  0x20    // Write SPI configuration register 2
    #define R_REG2  0x21    // Read SPI configuration register 2
    #define W_REG3  0x30    // Write SPI configuration register 3
    #define R_REG3  0x31    // Read SPI configuration register 3

    /*
    SPI REG0 controls QSPI vs SPI y setting bit 0 to 1 for QSPI or 0 for SPI, resets to 0
    SPI REG1 controls the number of dummy cycles between MOSI and MISO resets to 32 (typically set to 1)
    SPI REG2 controls SPI wrap length for the lower 8 bits, resets to 0
    SPI REG3 controls SPI wrap length for the upper 8 bits, resets to 0
    */

    // Register section starts
    #define INSTRUCTION_REGS    0x00000000  // 256x32
    #define SAMPLE_REGS         0x10000000  // 24x32
    #define SOFT_INFO_REGS      0x20000000  // 24x32
    #define CONTROL_REGS        0x30000000  // 12x32

    // Tile parameters
    #define NUM_OSC 96

    // OP Codes
    #define DEFAULT     0b000   // Default control operation, 10b address is don't care
    #define JUMP        0b001   // Jump to specified address
    #define HOLD        0b010   // Hold current instructions for 10b holding cycle
    #define PAUSE       0b011   // Hold until continue instruction is received from SPI
    #define WAIT        0b100   // Wait for done signal
    #define TERMINATE   0b101   // End state machine

    // Control signal bit start positions
    #define RUN         0   // Start tile oscillation (active high)
    #define IB          1   // Connect current source (active low)
    #define PHI_PUD     2   // 
    #define PHI         3   // 
    #define RSTB_PUD    5   //
    #define RSTB        7   // 
    #define CGB_SI      8   //
    #define RSTB_DLL    9   // Reset DLL (active low)
    #define RSTB_SMPL   10  // Reset sampling controller (active low)
    #define RSTB_REG    11  // Reset sampling register (active low)
    #define EN_SMPL     12  // 
    #define DIG_TRIG    13  // Digital trigger signal to be used for sampling when configured by EN_SMPL

    // Sample register masks
    #define SAMPLE_MASK_0 0x0000003F
    #define SAMPLE_MASK_1 0x00003F00
    #define SAMPLE_MASK_2 0x003F0000
    #define SAMPLE_MASK_3 0x3F000000

    // Sample register bit start positions
    #define SAMPLE_START_0 0
    #define SAMPLE_START_1 8
    #define SAMPLE_START_2 16
    #define SAMPLE_START_3 24

    // Soft info masks
    #define SOFT_INFO_MASK_0 0x0000000F
    #define SOFT_INFO_MASK_1 0x00000F00
    #define SOFT_INFO_MASK_2 0x000F0000
    #define SOFT_INFO_MASK_3 0x0F000000

    // Soft info bit start positions
    #define SOFT_INFO_START_0 0
    #define SOFT_INFO_START_1 8
    #define SOFT_INFO_START_2 16
    #define SOFT_INFO_START_3 24

    // Configuration byte offsets
    #define CTRL_CONF_CTRL_EN       0x0000  // Enable digital controller instruction execution (enable 1, reset 0)
    #define CTRL_CONF_PC_CONTINUE   0x0001  // Resume program counter following a HOLD instruction (enable 1, reset 0)
    #define CTRL_CONF_INSTR_SRC_SEL 0x0002  // Select instruction source (0 CSR register, 1 instruction memory)
    #define CTRL_CONF_INSTR_CSR     0x0003  // Instruction to be executed if selected via register
    #define DUM_RXO_CONF            0x0005  // Configure the dummy relaxation oscillator
    #define SMPL_CONF               0x0006  // Configure sampling controller
    #define DLL_CONF_CLK_SEL        0x0007  // Select clock input for DLL
    #define TOTAL_CYCLE             0x1000  // Total number of cycles from RUN to comp_done
    #define CUR_PC                  0x1001  // Current program count
    #define CUR_ISTR                0x1002  // Current instruction

    // DUM_RXO_CONF bit start positions
    #define DUM_CLK     0   // Appears to do nothing
    #define DUM_IB      1   // Turn on current reference for RXO (active low)
    #define DUM_RUN     2   // Enable oscillator to run
    #define DUM_RSTB    3   // Reset dummy oscillator (active low)
    #define DUM_VREF    4   // Configure Vref (only actually 3 bits)

    // SMPL_CONF bit start positions
    #define SMPL_AN_CNT 0   // 3-bit counter for error feedback pulses triggering sample
    #define SMPL_SEL    3   // Select digital or analog feedback sample trigger

    class AMORGOS
    {
        public:
            // Constructor functions
            AMORGOS();

            bool verifyClockStability();

            bool testOscillators();

            // Setup functions
            void setup(bool clkExt, uint8_t clkIntFrq, uint8_t clkDiv); // Setup chip and DAC
            void setupDumOsc();                                         // Setup dummy oscillator
            void startup();                                             // Startup tile via instruction memory
            void setVref(float vrefs[4]);                               // Set reference voltage for DAC

            // Communication functions
            void writeConfigReg(uint8_t cmd, uint8_t data); // Write data to SPI configuration register
            void writeReg(uint32_t addr, uint32_t data);    // Write data to DAC register
            uint32_t readReg(uint32_t addr);                // Read data from DAC register
            void reset();                                   // Reset digital core

            // Program functions
            void batchRunStartup();
            void batchRunLoop(String batchname, uint32_t length, uint8_t runNum);
            void batchRunLoop(String batchname, uint32_t *softInfo, uint32_t *dataOut, uint32_t length, uint8_t runNum);
            void batchPowerMeas(String batchname, uint32_t *softInfo, uint32_t *dataOut, uint32_t length, uint8_t runNum);
            
            // Control functions

            // Data functions
            void loadSoftInfo(uint32_t *data);    
            void retrieveSamples(uint32_t *data);

            // Reference DAC
            DAC80504 DAC;            

        private:
            // DAC voltages
            float VREF[4] = {.10, 0.25, 0.35, 0.50};

            // SPI Settings
            uint32_t AMORGOS_SPI_CLK = 20000000;    // SPI base clock
            uint8_t AMORGOS_SPI_DIV = 0;            // SPI clock divider (2^DIV division)

            SPISettings AMORGOS_SPI_Settings = SPISettings(AMORGOS_SPI_CLK, MSBFIRST, SPI_MODE0, AMORGOS_SPI_DIV); // SPI setting object used when transfer begins
    };

#endif
