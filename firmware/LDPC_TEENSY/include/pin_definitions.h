// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#ifndef PIN_DEFINITIONS_H
    #define PIN_DEFINITIONS_H

    // Define AMORGOS CLKGEN pins
    #define CLKGEN_OSC0_PIN     3
    #define CLKGEN_OSC1_PIN     18
    #define CLKGEN_OSC2_PIN     5

    #define CLKGEN_DIV0_PIN     24
    #define CLKGEN_DIV1_PIN     4

    #define CLKGEN_BYPASS_PIN   7

    #define CLKGEN_RST_PIN      17


    // Define AMORGOS control pins
    #define RST_PIN             16
    #define DONE_PIN            6   // Requires PCB modification 


    // Define SPI pins
    #define SPI_MODE0_PIN       9
    #define SPI_MODE1_PIN       8

    #define SPI_MISO_PIN        12
    #define SPI_MOSI_PIN        11
    #define SPI_CLK_PIN         13

    #define SPI_CS_CHIP_PIN     10
    #define SPI_CS_DAC_PIN      25


    // Define DAC pins
    #define LDAC_PIN            26

#endif