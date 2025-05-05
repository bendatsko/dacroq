// Project: DAC80508 Library
// Authors: Luke Wormald

#ifndef DAC80508_H
    #define DAC80508_H

    // Include necessary Arduino libraries
    #include <Arduino.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"
    #include "SPI.h"
    #include "AD5270BRMZ.h"                     // Include digital potentiometer library
    // Register Map
    #define NOP_ADDR         0x00
    #define DEVICE_ID_ADDR   0x01
    #define SYNC_ADDR        0x02
    #define CONFIG_ADDR      0x03
    #define GAIN_ADDR        0x04
    #define TRIGGER_ADDR     0x05
    #define BRDCAST_ADDR     0x06
    #define STATUS_ADDR      0x07
    #define DAC0_ADDR        0x08
    #define DAC1_ADDR        0x09
    #define DAC2_ADDR        0x0A
    #define DAC3_ADDR        0x0B
    #define DAC4_ADDR        0x0C
    #define DAC5_ADDR        0x0D
    #define DAC6_ADDR        0x0E
    #define DAC7_ADDR        0x0F

    // Initialize DAC class
    class DAC80508
    {
        public:
            // Constructor function
            DAC80508();

            // Setup function
            void setup(AD5270BRMZ Digital_potentiometer);   // Setup DAC initial states

            // Communication functions
            void writeDAC80508(uint8_t addr, uint16_t data,uint8_t component);    // Write data to DAC register
            uint16_t readDAC80508(uint8_t addr, uint8_t component);                // Read data from DAC register

            // Write operation functions
            void NOP(uint8_t component);                         // Write NOP to DAC
            void setSync(uint8_t component);                     // Write contents of SYNC register
            void setConfig(uint8_t component);                   // Write contents of CONFIG register
            void setGain(uint8_t component);                     // Write contents of GAIN register
            void setTrigger(bool reset,uint8_t component);        // Write contents of TRIGGER register
            void setBroadcast(uint16_t data, uint8_t component);   // Write DAC code BRDCAST register
            void setDAC0(uint16_t data, uint8_t component);        // Write DAC code to DAC0
            void setDAC2(uint16_t data, uint8_t component);        // Write DAC code to DAC2
            void setDAC1(uint16_t data, uint8_t component);        // Write DAC code to DAC1
            void setDAC3(uint16_t data, uint8_t component);        // Write DAC code to DAC3
            void setDAC4(uint16_t data, uint8_t component);        // Write DAC code to DAC4
            void setDAC5(uint16_t data, uint8_t component);        // Write DAC code to DAC5
            void setDAC6(uint16_t data, uint8_t component);        // Write DAC code to DAC6
            void setDAC7(uint16_t data, uint8_t component);        // Write DAC code to DAC7


            // Read operation functions
            uint16_t getID(uint8_t component);           // Read contents of DEVICE_ID register
            uint16_t getSync(uint8_t component);         // Read contents of SYNC register
            uint16_t getConfig(uint8_t component);       // Read contents of CONFIG register
            uint16_t getGain(uint8_t component);         // Read contents of GAIN register
            uint16_t getBroadcast(uint8_t component);    // Read contents of BRDCAST register
            bool getStatus(uint8_t component);           // Read contents of STATUS register
            uint16_t getDAC0(uint8_t component);         // Read contents of DAC0 register
            uint16_t getDAC1(uint8_t component);         // Read contents of DAC1 register
            uint16_t getDAC2(uint8_t component);         // Read contents of DAC2 register
            uint16_t getDAC3(uint8_t component);         // Read contents of DAC3 register
            uint16_t getDAC4(uint8_t component);         // Read contents of DAC4 register
            uint16_t getDAC5(uint8_t component);         // Read contents of DAC5 register
            uint16_t getDAC6(uint8_t component);         // Read contents of DAC6 register
            uint16_t getDAC7(uint8_t component);         // Read contents of DAC7 register


            // Utility functions
            uint16_t voltageToCode(float voltage, uint8_t DAC); // Convert decimal voltage to binary DAC code
            float codeToVoltage(uint16_t code, uint8_t DAC);    // Convert binary dac code to decimal voltage
            // uint8_t CRC();              // Calculate CRC parity code

            // Data Functions

        private:
            //Expander
            PCA9671 EXPIO;
            // Digital potentiometer
            AD5270BRMZ Digi_pot;
            // DAC Parameters
            float Vref = 2.5;
            uint8_t numBits = 16;

            // Sync Variables
            bool syncEnDAC0 = 0;
            bool syncEnDAC1 = 0;
            bool syncEnDAC2 = 0;
            bool syncEnDAC3 = 0;
            bool syncEnDAC4 = 0;
            bool syncEnDAC5 = 0;
            bool syncEnDAC6 = 0;
            bool syncEnDAC7 = 0;
            bool broadcastEnDAC0 = 0;
            bool broadcastEnDAC1 = 0;
            bool broadcastEnDAC2 = 0;
            bool broadcastEnDAC3 = 0;
            bool broadcastEnDAC4 = 0;
            bool broadcastEnDAC5 = 0;
            bool broadcastEnDAC6 = 0;
            bool broadcastEnDAC7 = 0;

            // Config Variables
            bool pwrdnDAC0 = 0;
            bool pwrdnDAC1 = 0;
            bool pwrdnDAC2 = 0;
            bool pwrdnDAC3 = 0;
            bool pwrdnDAC4 = 0;
            bool pwrdnDAC5 = 0;
            bool pwrdnDAC6 = 0;
            bool pwrdnDAC7 = 0;
            bool pwrdnRef = 0;
            bool DSDO = 0;
            bool FSDO = 0;
            bool CRCEn = 0;
            bool alarmEn = 0;
            bool alarmSel = 0;

            // Gain Variables
            bool buff0Gain = 0;
            bool buff1Gain = 0;
            bool buff2Gain = 0;
            bool buff3Gain = 0;
            bool buff4Gain = 0;
            bool buff5Gain = 0;
            bool buff6Gain = 0;
            bool buff7Gain = 0;
            bool refDivEn = 0;

            // Trigger Variables
            uint8_t softReset = 0b0000;
            bool LDAC_DIG = 0;

            // SPI Settings
            uint32_t DAC80508_CLK = 5000000;
            SPISettings DAC80508_SPI_Settings = SPISettings(DAC80508_CLK, MSBFIRST, SPI_MODE1); 
    };

#endif