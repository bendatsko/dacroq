// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald

#ifndef DAEDALUS_H
    #define DAEDALUS_H

    #include <Arduino.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"  // Include pin definitions for system
    #include "../SPI/SPI.h"                     // Include local SPI library with low frequency modifications
    #include "../file_system/file_system.h"     // Include file system library
    #include "../PCA9671/PCA9671.h"             // Include GPIO expander library
    #include "scanchain.h"                      // Include scan chain library
    #include "AD5270BRMZ.h"                     // Include digital potentiometer library
    #include "DAC80508.h"                       // Include DAC library
    #include "file_system.h"
    // #include "../../src/main.h"
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
    #define SAMPLE_REGS         0x10000000  // 32x32
    #define HARD_INFO_REGS      0x20000000  // 24x32
    #define CONTROL_REGS        0x30000000  // 12x32

    // Tile parameters
    #define NUM_OSC 50

    // OP Codes
    #define DEFAULT     0b000   // Default control operation, 10b address is don't care
    #define JUMP        0b001   // Jump to specified address
    #define HOLD        0b010   // Hold current instructions for 10b holding cycle
    #define PAUSE       0b011   // Hold until continue instruction is received from SPI
    #define WAIT        0b100   // Wait for done signal
    #define TERMINATE   0b101   // End state machine
    #define LOAD        0b110   // Set new hard info init, instruction[19] determines if PRNG is used

    // Control signal bit start positions
    #define RUN         0   // Start tile oscillation (active high)
    #define IB          1   // Connect current source (active low)
    #define HVT_EN      2   // Enable HVT for TIA
    #define PHI         3   // 
    #define EN_DUTY     4   // Keep low
    #define ALTER_EN    5   // Enables alternating Q/Qb RXO out
    #define IDAC_ENB    6   // 
    #define RSTB        7   // 
    #define CGB_SI      8   // if =1, SI registers receive clock, if =0 they don't
    #define RSTB_SMPL   10  // Reset sampling controller (active low)
    #define RSTB_REG    11  // Reset regs for sampling control
    #define SMPL_EN     12  // Sampling start trigger (alternative to error feedback)
    #define SYNC_CTRL0  14  // MUX SYNC source select
    #define SYNC_CTRL1  1
    
    // Sample register masks
    #define SAMPLE_MASK_0 0x000000FF
    #define SAMPLE_MASK_1 0x0000FF00
    #define SAMPLE_MASK_2 0x00FF0000
    #define SAMPLE_MASK_3 0xFF000000

    // Sample register bit start positions
    #define SAMPLE_START_0 0
    #define SAMPLE_START_1 8
    #define SAMPLE_START_2 16
    #define SAMPLE_START_3 24

    // Configuration byte offsets
    #define CTRL_EN                 0x0000  // Enable digital controller instruction execution (enable 1, reset 0)
    #define PC_CONTINUE             0x0001  // Resume program counter following a HOLD instruction (enable 1, reset 0)
    #define INSTR_SRC_SEL           0x0002  // Select instruction source (0 CSR register, 1 instruction memory)
    #define ANA_CTRLS_CSR           0x0003  // Instruction to be executed if selected via register
    #define DIG_TRIG_CYC            0x0004  // dig_trig_cycle
    #define RXO_TIMEOUT_CYC         0x0005  // rxo_timeout_cycle
    #define MAX_RERSTART            0x0006  // max_restart_cnt
    #define DUM_RXO_CONF            0x0010  // Configure the dummy relaxation oscillator
    #define SMPL_CONF               0x0020  // smpl_conf
    #define DLL_CONF                0x0021  // dll_conf
    #define IMF_CONF                0x0030  // IMF config
    #define HARD_INFO_CONF          0x0040  // hard_info_conf 
    #define STATUS_TOTAL_CYC        0x1000  // total_cycle
    #define STATUS_CUR_PC           0x1001  // cur_pc
    #define STATUS_CUR_INSTR        0x1002  // cur_instr
    #define STATUS_SYS_INFO         0x1003  // sys_info
    #define STATUS_RESTRT_CNT       0x1004  // restart_cnt

    // Hard info address
    #define Hard_info_init_0        0x0000  // hard_info_init
    #define Hard_info_init_1        0x0001  // hard_info_init
    #define Hard_info_en_0          0x0002  // hard_info_en
    #define Hard_info_en_1          0x0003  // hard_info_en
    // DUM_RXO_CONF bit start positions
    #define DUM_LFC     0   // dmlfc_IN, local feedback connetion?
    #define DUM_IB      12  // Turn on current reference for RXO (active low)
    #define DUM_RUN     13  // Enable oscillator to run
    #define DUM_RSTB    14  // Reset dummy oscillator (active low)
    #define DUM_2_CN    15  // dmrxo2_CN
    #define DUM_1_CN    18  // dmrxo2_CN
    

    // SMPL_CONF bit start positions
    #define SMPL_AN_CNT     0   // 3-bit counter for error feedback pulses triggering sample
    #define SMPL_CLK_MASK   6   // SMPL_CLK_MASK
    #define SMPL_SEL        7   // Select digital or analog feedback sample trigger
    
    // AMORGOS parameters
    #define DAEDALUS_EXT_CLK     false   // Configure use of external clock
    #define DAEDALUS_FREQ        0b000   // Configure ring oscillator frequency (inversely proportional)
    #define DAEDALUS_FREQ_DIV    0b01    // Configure clock divisor (used for both internal and external clock)

    #define SERIALUSB_BAUD 2000000

    class DAEDALUS
    {
        public:
            // Constructor functions
            DAEDALUS(); // Constructor for DAEDALUS object
            
            // Setup functions
            void setup(uint8_t CS, bool clkExt, uint8_t clkIntFrq, uint8_t clkDiv); // Setup chip and DAC
            void setup_iteration(uint8_t CS, bool clkExt, uint8_t clkIntFrq, uint8_t clkDiv);
            // void setupDumOsc();                                         // Setup dummy oscillator
            void startup();                                             // Startup tile via instruction memory
            void DAC_setup(float VREF_FL2, float VREF_FL0, float VREF_DUM, float VREF_INJ2, float VREF_FL1, float VDD_A, float VDD_AIO, float VREF_INJ3, float VCM_IMF, float VREF_INJ0, float VREF_INJ1, float VCM_TIA, float VCM_FL);                                           // Setup DAC
            void IBIAS_setup();                                         // Setup IBIAS
            void IBIAS_setup(uint16_t *value_sets);
            // // void setVref(float vrefs[4]);                               // Set reference voltage for DAC

            // // Communication functions
            void writeConfigReg(uint8_t cmd, uint8_t data); // Write data to SPI configuration register
            void writeReg(uint32_t addr, uint32_t data);    // Write data to DAC register
            uint32_t readReg(uint32_t addr);                // Read data from DAC register
            void reset();                                   // Reset digital core

            // // Program functions
            // void batchRunStartup();
            // void batchRunLoop(String batchname, uint32_t length, uint8_t runNum);
            // void batchRunLoop(String batchname, uint32_t *softInfo, uint32_t *dataOut, uint32_t length, uint8_t runNum);
            void General_setup_for_dummy(bool die,uint8_t analog_counter, uint32_t timeout_value, bool mode);
            void Multi_run();
            void Scan_chain_data_program(bool die,uint64_t *data0,uint64_t *data1,uint64_t *data2,bool Read_enable);
            void Read_data();
            void batchRunLoop(String batchname, String Output_batchname,uint32_t problems, uint16_t runNum, bool uf20_or50, bool die, uint32_t timeout_value);
            void batchRunLoop_power_measurement(String batchname, String Output_batchname,uint32_t problems, uint16_t runNum, bool uf20_or50, bool die, uint32_t timeout_value);
            void Calibration(bool die,uint8_t CS, bool clkExt, uint8_t clkIntFrq, uint8_t clkDiv);
            // // Control functions

            // // Data functions
            void loadSoftInfo(uint32_t *data);    
            void retrieveSamples(uint32_t *data);
            void Read_sample_registers(uint32_t *data);
            void Change_data_format(uint32_t *oscillator_data0, uint32_t *formatted_data);        

        private:
            // GPIO expander
            PCA9671 EXPIO;
            // Digital potentiometer
            AD5270BRMZ Digi_pot;
            // DAC
            DAC80508 DAC;
            // SPI Settings
            uint32_t DAEDALUS_SPI_CLK = 5000000;    // SPI base clock
            uint8_t DAEDALUS_SPI_DIV =0;           // SPI clock divider (2^DIV division)
            uint8_t SPI_CS_CHIP_PIN;                // Chip select pin for SPI

            SPISettings DAEDALUS_SPI_Settings = SPISettings(DAEDALUS_SPI_CLK, MSBFIRST, SPI_MODE0, DAEDALUS_SPI_DIV); // SPI setting object used when transfer begins

    };

#endif
