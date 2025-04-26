// Project: PCA9671 Library (Digital potentiometer)
// Authors: Ying-Tuan Hsu, Luke Wormald

#ifndef PCA9671_H
    #define PCA9671_H

    // Include necessary Arduino libraries
    #include <Arduino.h>
    
    // Include local libraries and headers
    #include "i2c_driver_wire.h"
    #include "../../include/pin_definitions.h"
    
    // Other operation constant
    #define Reset_address      0x00
    #define Reset_data         0x06

    #define Register_address_0 0x20
    #define Register_address_1 0x21
    #define Register_address_2 0x24
    
    // Reset delay time (It only needs 4ns in therory.)
    #define delay_time 10

    // Initialize GPIO Expander class
    class PCA9671
    {
        public:
            // Constructor function
            PCA9671();

            // Setup function
            void setup();   // Setup APCA9671 initial states 
            bool check_expander();
            // Communication functions (data2=17:10, data1=7:0)
            bool writePCA9671(uint8_t address, uint8_t data1, uint8_t data2);       // Write data to any Expander register
            void readPCA9671(uint8_t address, uint8_t &data1, uint8_t &data2);      // Read data from any Expander register

            // Preset register functions (data2=17:10, data1=7:0)
            bool writePCA9671_0(uint8_t data1, uint8_t data2);     // Write data to Expander_0 register
            void readPCA9671_0(uint8_t &data1, uint8_t &data2);    // Read data from Expander_0 register
            bool writePCA9671_1(uint8_t data1, uint8_t data2);     // Write data to Expander_1 register
            void readPCA9671_1(uint8_t &data1, uint8_t &data2);    // Read data from Expander_1 register
            bool writePCA9671_2(uint8_t data1, uint8_t data2);     // Write data to Expander_2 register
            void readPCA9671_2(uint8_t &data1, uint8_t &data2);    // Read data from Expander_2 register
            // soft reset
            bool soft_reset();                              // Reset RDAC to the value of that is stoed in the last 50-TP memory
            void Hard_reset();

            //system code for writing the control signals to digital system
            bool write_clkgen_osc(uint8_t data);
            bool write_clkgen_div(uint8_t data);
            bool write_bypass(bool High_or_Low);
            bool write_clkgen_reset(bool High_or_Low);
            bool write_chip_reset(bool High_or_Low);
            // Mux selection function
            bool write_mux_enb(bool High_or_Low);
            bool write_mux_sel(bool One_or_Zero);
        private:           
            // I2C Settings
            uint32_t PCA9671_CLK = 400000;
    };

#endif