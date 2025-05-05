// Project: Teensy Extensions
// Authors: Luke Wormald

#ifndef TEENSY_EXTENSIONS_H
    #define TEENSY_EXTENSIONS_H

    #include <Arduino.h>    // Include Arduino core library

    // Pin mode initialization with programmable drive strength
    void pinModeExt(uint8_t pin, uint8_t mode, uint8_t strength);

#endif