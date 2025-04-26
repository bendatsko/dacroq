// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald

#ifndef DATA_FUNCTIONS_H
    #define DATA_FUNCTIONS_H

    // Include necessary Arduino libraries
    #include <Arduino.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"  // Include pin definitions for system
    #include "../SPI/SPI.h"                     // Include local SPI library with low frequency modification 
    #include "../DAC80508/DAC80508.h"           // Include library for reference DAC
    #include "../file_system/file_system.h"     // Include file system library

    // Data management functions
    void cacheSoftInfo(String batchname, uint32_t *softInfo, uint32_t length);  // Load all soft info into memory

#endif