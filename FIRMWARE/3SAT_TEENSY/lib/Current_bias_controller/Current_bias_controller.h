// Project: Current bias controller Library (Controller for Expander & Digital potentiometer)
// Authors: Ying-Tuan Hsu

#ifndef Current_bias_controller_H
    #define Current_bias_controller_H

    // Include necessary Arduino libraries
    #include <Arduino.h>
    
    // Include local libraries and headers
    



    #include "i2c_driver_wire.h"
    #include "../../include/pin_definitions.h"
    #include "PCA9671.h"
    #include "AD5270BRMZ.h"

    // Other operation constant
    // At expander0 address 0x20
    //15-->f, 14-->e, 13-->d, 12-->c, 11-->b, 10-->a, 9-->9, 8-->8, 7-->7, 6-->6, 5-->5, 4-->4, 3-->3, 2-->2, 1-->1, 0-->0
    // 1-->e, 2-->d, 4-->b, 8-->7
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
    
    // #define Register_address_0 0x20
    // #define Register_address_1 0x21
    // #define Register_address_2 0x24
    

    // #define delay_time 10
    // Initialize DAC class
    class Current_bias_controller
    {
        public:
            // Constructor function
            Current_bias_controller();

            // Setup function
            void setup();                   // Setup the current_bias_controller initial states 
            bool check_expander();          // Check if the expander is correctly connected (no output shorted to ground)

            // Communication functions
           
            // Main functions
            bool set_current_bias(uint8_t die_number, uint8_t component, uint16_t current_value);            // Set the current bias of the channel
            bool reset_current_bias(uint8_t die_number, uint8_t component);                                   // Reset the current bias of the channel
            // sub functions
            bool set_CS(uint8_t die_number, uint8_t component);                                         // Set the CS pin of the channel
            bool set_current_value(uint8_t die_number, uint8_t component, uint16_t current_value);      // Set the current value of the channel
            bool set_all_CS_to_high();                                                                  // Reset the CS pins of all channels
            bool reset_current_value(uint8_t die_number, uint8_t component);
        private:           
            PCA9671 expander;
            AD5270BRMZ SPI_digital_potentiometer;

            // SPI Settings
           
            // SPISettings AD5270BRMZ_SPI_Settings = SPISettings(AD5270BRMZ_CLK, MSBFIRST, SPI_MODE1); 
    };

#endif