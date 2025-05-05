// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#ifndef MAIN_H
    #define MAIN_H

    // Include necessary Arduino libraries
    #include <Arduino.h>
    

    // Include local libraries and headers
    #include "pin_definitions.h"
    #include "DAEDALUS.h"
    #include "i2c_driver_wire.h"
    #include "DAC80508.h"
    // #include "Current_bias_controller.h"
    #include "PCA9671.h"
    #include "file_system.h"

    // AMORGOS parameters
    // #define DAEDALUS_EXT_CLK     false   // Configure use of external clock
    // #define DAEDALUS_FREQ        0b111   // Configure ring oscillator frequency (inversely proportional)
    // #define DAEDALUS_FREQ_DIV    0b01    // Configure clock divisor (used for both internal and external clock)

    // #define SERIALUSB_BAUD 2000000
    
#endif