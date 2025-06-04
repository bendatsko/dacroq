// Project: MEDUSA Teensy Test Bench
// Authors: Luke Wormald

#ifndef MEDUSA_H
    #define MEDUSA_H

    // Include local libraries and headers
    #include "../../include/Pin_Definitions.h"  // Include pin definitions for system
    #include "DAC80508.h"     // Include DAC80508 library
    #include "MAX5497.h"      // Include MAX5497 library

    #ifdef ARDUINO_PLATFORM    
        // Include necessary Arduino libraries
        #include <Arduino.h>    // Include Arduino core library
        #include <SD.h>         // Include SD card library

        // Include custom libraries
        #include "../SPI/SPI.h"         // Include local SPI library
        #include "Teensy_Extensions.h"  // Include Teensy extensions library

    // MEDUSA clock parameters when using Teensy
        #define MEDUSA_EXT_CLK     false   // Configure use of external clock
        #define MEDUSA_FREQ        0b111   // Configure ring oscillator frequency (inversely proportional)
        #define MEDUSA_FREQ_DIV    0b01    // Configure clock divisor (used for both internal and external clock)

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
    #endif
    
    // Current source parameters
    #define TEMP            25      // Set temperature in degrees C
    #define TIA_OFFSET_R    657     // Set TIA offset resistance in Ohms
    #define BLD_N_OFFSET_R  3279    // Set BLD_N offset resistance in Ohms
    #define BREAK_OFFSET_R  657     // Set BREAK offset resistance in Ohms
    #define MAKE_OFFSET_R   166     // Set MAKE offset resistance in Ohms
    #define BLD_P_OFFSET_R  3279    // Set BLD_P offset resistance in Ohms
    #define CMP_OFFSET_R    657     // Set CMP offset resistance in Ohms

    // MEDUSA register addresses
    #define  IMEM_ADDR              (0x00000000+(0x00<<2))
    #define  DMEM_ADDR              (0x00100000+(0x00<<2))
    #define  BL_LEFT_ADDR           (0x20000000+(0x00<<2))
    #define  WL_LEFT_ADDR           (0x20000000+(0x0D<<2))
    #define  BL_RIGHT_ADDR          (0x20000000+(0x1E<<2))
    #define  WL_RIGHT_ADDR          (0x20000000+(0x2B<<2))
    #define  SMPL_DOUT_LEFT_ADDR    (0x20000000+(0x3C<<2))
    #define  HOLD_TIME_LEFT_ADDR    (0x20000000+(0x43<<2))
    #define  SMPL_DONE_LEFT_ADDR    (0x20000000+(0x44<<2))
    #define  SMPL_DOUT_RIGHT_ADDR   (0x20000000+(0x45<<2))
    #define  HOLD_TIME_RIGHT_ADDR   (0x20000000+(0x4C<<2))
    #define  SMPL_DONE_RIGHT_ADDR   (0x20000000+(0x4D<<2))
    #define  SMPL_TIME_LEFT_ADDR    (0x20000000+(0x4E<<2))
    #define  SMPL_TIME_RIGHT_ADDR   (0x20000000+(0x4F<<2))
    #define  GLBL_CTRL_ADDR         (0x20000000+(0x50<<2))
    #define  SMPL_CTRL_ADDR         (0x20000000+(0x51<<2))

    // MEDUSA register sizes
    #define BL_WORDS            13
    #define WL_WORDS            17
    #define SMPL_DOUT_WORDS     7
    #define HOLD_TIME_WORDS     1
    #define SMPL_DONE_WORDS     1
    #define SMPL_TIME_WORDS     1
    #define GLBL_CTRL_WORDS     1
    #define SMPL_CTRL_WORDS     1

    // MEDUSA word line indices
    #define BOT_CLS_MEM_RST     0
    #define BOT_CLS_BIAS_WL     1
    #define BOT_CLS_START_WL    255
    #define RXO_0_WL            256
    #define RXO_1_WL            257
    #define RXO_BIAS_WL         258
    #define RXO_2_WL            259
    #define RXO_3_WL            260
    #define TOP_CLS_START_WL    288
    #define TOP_CLS_BIAS_WL     542
    #define TOP_CLS_MEM_RST     543

    // MEDUSA bit line positions
    #define CLS_START_BL    0
    #define CLS_DISABLE_BL  400

    // MEDUSA tile definitions
    #define TILE_RIGHT  0 
    #define TILE_LEFT   1
    #define TILE_BOTH   2

    // MEDUSA tile dimensions
    #define TOTAL_VAR   200 // Total number of variables per tile
    #define TOTAL_CLS   508 // Total number of clauses per tile
    #define HALF_CLS    254 // Total number of clauses per half tile (top or bottom)
    #define SECT_CLS    127 // Total number of clauses per section (withing ISUM switch)

    // MEDUSA global control bit positions 
    #define RXO_RST           0 // Bit shift for RXO reset bit (active high)
    #define RXO_MODE          1 // Bit shift for RXO coupling bit (0 independent, 1 coupled)
    #define RUN               2 // Bit shift for run bit (active high)
    #define CLS_SW_ENb_BOT    3 // Bit shift for clause switch enable bottom (active low)
    #define CLS_SW_ENb_TOP    4 // Bit shift for clause switch enable top (active low)

    // MEDUSA sample control bit positions (per tile)
    #define CLK_DIV0    0   // Bit shift for clock divider bit 0 (divide by 1 (0b00), 2 (0b01), 4 (0b10), 8 (0b11) (default)
    #define CLK_DIV1    1   // Bit shift for clock divider bit 1 (divide by 1 (0b00), 2 (0b01), 4 (0b10), 8 (0b11) (default)
    #define DIG_TRIG    2   // Bit shift for digital trigger bit (used to overside samplying system for early data retrieval)
    #define ERRB_MODE   3   // Bit shift for error mode bit (0 synchonous (default), 1 asynchronous)
    #define SMPL_MODE   4   // Bit shift for sampling system mode bit (0 before hold time (default), 1 after hold time)
    #define SMPL_RSTB   5   // Bit shift for sampling system rest bit (active low)

    // MEDUSA RXO memory bit positions (per oscillator)
    #define RXO_INIT    0   // Initialize relaxation oscillator to 1 or 0
    #define CPL_INIT    1   // Enable oscillator coupling
    #define TIA_UP_P_EN 2   // Enable top positive input TIA
    #define TIA_UP_N_EN 3   // Enable top negative input TIA
    #define TIA_DN_P_EN 4   // Enable bottom positive input TIA
    #define TIA_DN_N_EN 5   // Enable bottom negative input TIA

    // MEDUSA RXO bias memory bit positions (per oscillaotor column)
    #define CMP_EN      4   // Enable comparator biasing 
    #define BLP_P_EN    5   // Enable positive TIA bleed current biasing
    #define BLP_N_EN    6
    #define TIA_EN      7

    // MUEDUSA clause memory bit positions (per clause node)
    #define CLS_INV 0
    #define CLS_EN  1

    // MEDUSA CNF memory parameters
    #define CNF_MAX_K   7
    #define CNF_MAX_CLS 1016

    // Memory masks
    #define MASK_16B 0x0000FFFF // Mask for 16 bit data

    // Adruino file system functions
    #ifdef ARDUINO_PLATFORM
        // Setup SD card
        void setupFileSystem();

        // SD card read/write functions
        void readCNF(String filename, int16_t (&data)[CNF_MAX_CLS][CNF_MAX_K+1], uint8_t &numVar, uint16_t &numCls);     
        void writeResults(char filename[], uint32_t *data, uint32_t datalen);
    #endif

    // MEDUSA class initialization
    class MEDUSA
    {
        public:
            // Constructor    
            MEDUSA();

            // Setup functions
            void setup();       // Initialize MEDUSA

            // Initialization functions when using Teensy
            #ifdef ARDUINO_PLATFORM
                void setClock();    // Set clock
                void reset();       // Reset MEDUSA

                void writeConfigReg(uint8_t address, uint8_t data); // Write configuration register
                uint32_t readConfigReg(uint8_t address);            // Read configuration register
            #endif

            // HAL memory functions
            void writeReg(uint32_t address, uint32_t data);    // Write to register
            uint32_t readReg(uint32_t address);                // Read from register

            // Analog core functions
            void resetClsMem(bool tile);                                                // Reset clause memory
            void setupClsBias(bool tile, uint8_t numVar, uint16_t numCls);              // Setup clause biasing for specified problem
            void disableCls(bool tile);                                                 // Disable all clauses by setting all to satisfied
            void setupRXOs(uint8_t tile, uint8_t numVar, uint16_t numCls);              // Setup relaxation oscillators for specified problem
            void writeCnf(bool tile, uint8_t numVar, uint16_t numCls, int16_t cnf[CNF_MAX_CLS][CNF_MAX_K+1]);    // Write cnf data to clause memory
            void setupSampling(uint8_t tile, uint8_t clkDiv, uint8_t mode, float delay);   // Setup sampling system for specified parameters

            // Analog accessory functions
            void writeWL(bool tile, uint16_t wl, bool data);        // Write to word line
            float calculateDelay(uint8_t numVar, uint16_t numCls);  // Calculate loop delay based on problem size

            // Solver functions
            void runSolverSingle(bool tile, String filepath, uint32_t numRuns); // Run solver on single tile (508 clauses or less)
            void runSolverCoupled(String filepath, uint32_t numRuns);           // Run solver on both tiles (1016 clauses or less)

            // Peripheral functions
            void setVDD(float voltage);    // Set VDD
            void setVCM(float voltage);    // Set VCM
            void setVREF(float voltage);   // Set VREF
            void setVESD(float voltage);   // Set VESD

            void setI_TIA(float current);      // Set I_TIA
            void setI_BLD_N(float current);    // Set I_BLD_N
            void setI_BREAK(float current);    // Set I_BREAK
            void setI_MAKE(float current);     // Set I_MAKE
            void setI_BLD_P(float current);    // Set I_BLD_P
            void setI_CMP(float current);      // Set I_CMP

            uint16_t current2Code(float current, uint32_t offset);    // Convert current to digital potentiometer code

        private:
            // Configuration register values
            uint32_t globalReg = 0x00190019;    // Global control register initialized to power on values
            uint32_t sampleReg = 0x00030003;    // Sample control register
        
            // Data interfaces
            #define MEDUSA_SPI_BUS SPI     // Set SPI bus to SPI
            uint8_t csPin = MEDUSA_CS;
            uint32_t MEDUSA_SPI_CLK = 10000000;
            uint8_t MEDUSA_SPI_DIV = 0;
            SPISettings MEDUSA_SPI_Settings = SPISettings(MEDUSA_SPI_CLK, MSBFIRST, SPI_MODE0, MEDUSA_SPI_DIV); 

            // Peripheral objects
            DAC80508 DAC = DAC80508(DAC_CS);    // Initialize DAC80508

            MAX5497 digPot0 = MAX5497(DP0_CS);  // Initialize digital potentiometer 1
            MAX5497 digPot1 = MAX5497(DP1_CS);  // Initialize digital potentiometer 2
            MAX5497 digPot2 = MAX5497(DP2_CS);  // Initialize digital potentiometer 3

            // Default system parameters
            float VDD = 0.9;   // Set VDD
            float VCM = 0.55;   // Set VCM
            float VREF = 0.5;  // Set VREF
            float VESD = 0.90;  // Set VESD

            // Independant parameters top only
            // float I_TIA = 60E-6;   // Set I_TIA
            // float I_BLD_N = 8E-6;  // Set I_BLD_N
            // float I_BREAK = 15E-6; // Set I_BREAK
            // float I_MAKE = 130E-6; // Set I_MAKE
            // float I_BLD_P = 5E-6;  // Set I_BLD_P
            // float I_CMP = 25E-6;   // Set I_CMP

            // Independant parameters top and bottom
            // float I_TIA = 60E-6;   // Set I_TIA
            // float I_BLD_N = 7E-6;  // Set I_BLD_N
            // float I_BREAK = 15E-6; // Set I_BREAK
            // float I_MAKE = 130E-6; // Set I_MAKE
            // float I_BLD_P = 5E-6;  // Set I_BLD_P
            // float I_CMP = 25E-6;   // Set I_CMP

            // Coupling parameters
            float I_TIA = 65E-6;   // Set I_TIA
            float I_BLD_N = 2.4E-6;  // Set I_BLD_N
            float I_BREAK = 10E-6; // Set I_BREAK
            float I_MAKE = 45E-6; // Set I_MAKE
            float I_BLD_P = 1.4E-6;  // Set I_BLD_P
            float I_CMP = 25E-6;   // Set I_CMP
    };
    
#endif