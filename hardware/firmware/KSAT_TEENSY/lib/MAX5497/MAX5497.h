#ifndef MAX5497_H
    #define MAX5497_H

    // Include local libraries and headers
    #include "../../include/Pin_Definitions.h"  // Include pin definitions for system

    #ifdef ARDUINO_PLATFORM
        // Include necessary Arduino libraries
        #include <Arduino.h>    // Include Arduino core library
        #include "../SPI/SPI.h" // Include SPI library
    #endif

    // Define the MAX5497 commands
    #define MAX5497_WRITE_WIPER1        0b00000001
    #define MAX5497_WRITE_WIPER2        0b00000010
    #define MAX5497_WRITE_NVREG1        0b00010001
    #define MAX5497_WRITE_NVREG2        0b00010010
    #define MAX5497_COPY_WP1_2_NV1      0b00100001
    #define MAX5497_COPY_WP2_2_NV2      0b00100010
    #define MAX5497_COPY_WP_2_NV_ALL    0b00100011
    #define MAX5497_COPY_NV1_2_WP1      0b00110001
    #define MAX5497_COPY_NV2_2_WP2      0b00110010
    #define MAX5497_COPY_NV_2_WP_ALL    0b00110011

    // Define the MAX5497 class
    class MAX5497 
    {
        public:
            // Constructor
            MAX5497(uint8_t csPin);

            // Public methods
            void setup();
            void write(uint8_t command, uint16_t value);
            void copy(uint8_t command);
            
        private:
            // SPI Setting
            uint8_t csPin;

            #ifdef ARDUINO_PLATFORM
                #define MAX5497_SPI_BUS SPI1    // Set SPI bus to SPI1
                uint32_t MAX5497_SPI_CLK = 1000000;
                SPISettings MAX5497_SPI_Settings = SPISettings(MAX5497_SPI_CLK, MSBFIRST, SPI_MODE0); 
            #endif
    };

#endif