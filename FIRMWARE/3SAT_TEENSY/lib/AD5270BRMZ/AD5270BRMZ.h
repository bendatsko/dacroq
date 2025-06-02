// Project: AD5270BRMZ Library (Digital potentiometer)
// Authors: Ying-Tuan Hsu

#ifndef AD5270BRMZ_H
    #define AD5270BRMZ_H

    // Include necessary Arduino libraries
    #include <Arduino.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"
    #include "SPI.h"
    #include "PCA9671.h"
    
    // Command constant
    #define command0  0x00
    #define command1  0x01
    #define command2  0x02
    #define command3  0x03
    #define command4  0x04
    #define command5  0x05
    #define command6  0x06
    #define command7  0x07
    #define command8  0x08
    #define command9  0x09
    // Constant data of command Variables
    #define command0_data     0x0000
    #define command2_data     0x0000
    #define command3_data     0x0000
    #define command4_data     0x0000
    #define command6_data     0x0000
    #define command8_data     0x0000
    #define command9_enable   0x0001
    #define command9_disable  0x0000
    
    // data constant
    #define NOP_command_data  0x0000
    // Control register constant
    #define Constant_50TP_program      0x0001
    #define Constant_RDAC_write        0x0002
    #define Constant_RDAC_calibration  0x0004

    // Current bias chip select data
    #define DAC0               0xfe
    #define DAC1               0xfd
    #define D1_Ibias0          0xfe     // At expander 1 (address 0x21)
    #define D1_Ibias1          0xf7
    #define D1_Ibias2          0xbf
    #define D1_Ibias3          0x7f
    #define D1_Ibias4          0xfb
    #define D1_Ibias5          0xdf
    #define D1_Ibias6          0xef
        // At expander1 address 0x21
    #define D2_Ibias0          0xdf
    #define D2_Ibias1          0xbf
    #define D2_Ibias2          0x7f
    #define D2_Ibias3          0xef
    #define D2_Ibias4          0xf7
    #define D2_Ibias5          0xfb
    #define D2_Ibias6          0xfd
    class AD5270BRMZ
    {
        public:
            // Constructor function
            AD5270BRMZ();

            // Setup function
            void setup(PCA9671 expander_input);   // Setup AD5270BRMZ initial states

            // Communication functions
            void writeAD5270BRMZ_high_impedance(uint8_t die_number, uint8_t component);
            void writeAD5270BRMZ_data(uint8_t die_number, uint8_t component, uint16_t data);
            void writeAD5270BRMZ(uint8_t die_number, uint8_t component, uint8_t command, uint16_t data);       // Write data to AD5270BRMZ
            uint16_t readAD5270BRMZ(uint8_t die_number, uint8_t component, uint8_t command, uint16_t data);    // Read data from AD5270BRMZ
            
            // control register functions
            void write_control_register(uint8_t die_number,uint8_t component,uint16_t data);     // Write to control register
            uint16_t read_control_register(uint8_t die_number,uint8_t component);               // Read the control register

            // RDAC operation functions
            void writeRDAC(uint8_t die_number, uint8_t component,uint16_t data);    // Write data to RDAC register
            uint16_t readRDAC(uint8_t die_number,uint8_t component);                            // Read data from RDAC register

            // 50-TP operation functions
            void push_to_50_TP(uint8_t die_number,uint8_t component);                           // Push RDAC value to 50-TP memory
            uint16_t read_50_TP_last_position(uint8_t die_number,uint8_t component);            // Read the lastest address of 50-TP memory
            uint16_t read_50_TP_value(uint8_t die_number,uint8_t component, uint16_t addr);       // Read value of 50-TP memory with address--> addr = 0~50
            void reset_RDAC_to_last_50_TP(uint8_t die_number,uint8_t component);                // Reset RDAC to the value of that is stoed in the last 50-TP memory

            // Other functions
            void wait(uint16_t time);                       // Wait for a time of microseconds 
            void NOP(uint8_t die_number,uint8_t component);                                     // non-operation
            void shut_down_enable(uint8_t die_number,uint8_t component);                        // Shut down enable for open the potentiometer
            void shut_down_disable(uint8_t die_number,uint8_t component);                       // Shut down disable for close the potentiometer

            // CS control
            bool set_CS(uint8_t die_number, uint8_t component);
            bool set_CS_all(uint8_t die_number, uint8_t component);
            bool set_all_CS_to_high();
            bool set_current_value(uint8_t die_number,uint8_t component, uint16_t current_value);

        private:           
            
            // DP CS pin
            PCA9671 expander;
            uint8_t spi_cs_dp_pin = 0;
            // Control register bits
            uint16_t control_bits  = 0x0000;
            
            // SPI Settings
            // uint32_t AD5270BRMZ_CLK = 25000000;
            uint32_t AD5270BRMZ_CLK = 1000000;
            SPISettings AD5270BRMZ_SPI_Settings = SPISettings(AD5270BRMZ_CLK, MSBFIRST, SPI_MODE1,2); 
    };

#endif