// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald, Ying-Tuan, and Vangelis

#ifndef PIN_DEFINITIONS_H
    #define PIN_DEFINITIONS_H

    // Hardware Abstraction Layer (HAL) initialization
    #define ARDUINO_PLATFORM    // Initialize HAL for Arduino
    //#define PULPINO_PLATFORM    // Initialize HAL for PULPino

    // Pin definitions when using Teensy
    #ifdef ARDUINO_PLATFORM

        // System
        #define CLK_GEN_OSC0    19
        #define CLK_GEN_OSC1    22
        #define CLK_GEN_OSC2    23
        #define CLK_GEN_DIV0    16
        #define CLK_GEN_DIV1    17
        #define CLK_GEN_BYPASS  15
        #define CLK_GEN_RSTN    18
        #define FETCH_EN        14
        #define FETCH_DONE      36
        #define RSTN            37

        // Perhipheral CS pins
        #define DAC_CS  32
        #define DP0_CS  31
        #define DP1_CS  30
        #define DP2_CS  29

        // MEDUSA SPI Pins
        #define MEDUSA_CS   10
        #define MODE0       3
        #define MODE1       21

        // MS Tile Error Feedback
        #define ERR_L   20
        #define ERR_R   2

    #endif

    #ifdef PULPINO_PLATFORM
        // Perhipheral CS pins
        #define DAC_CS  
        #define DP0_CS  
        #define DP1_CS  
        #define DP2_CS  
    #endif

#endif
