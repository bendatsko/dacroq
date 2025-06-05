// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#ifndef MAIN_H
    #define MAIN_H

    // Include necessary Arduino libraries
    #include <Arduino.h>

    // Include local libraries and headers
    #include <InternalTemperature.h>
    #include "pin_definitions.h"
    #include "AMORGOS.h"
    #include "DAC80504.h"
    #include "data_functions.h"

    // AMORGOS parameters
    #define AMORGOS_EXT_CLK     false   // Configure use of external clock
    #define AMORGOS_FREQ        0b111   // Configure ring oscillator frequency (inversely proportional)
    #define AMORGOS_FREQ_DIV    0b01    // Configure clock divisor (used for both internal and external clock)

    #define SERIALUSB_BAUD 2000000
    
#endif