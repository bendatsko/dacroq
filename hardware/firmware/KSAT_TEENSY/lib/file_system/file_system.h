// Project: MEDUSA Teensy Test Bench
// Authors: Luke Wormald

#ifndef FILE_SYSTEM_H
    #define FILE_SYSTEM_H

    // MEDUSA CNF memory parameters
    #define CNF_MAX_K   7
    #define CNF_MAX_CLS 1016

    // Include necessary Arduino libraries
    #include <Arduino.h>
    #include <SD.h>

    // Include local libraries and headers
    #include "../../include/Pin_Definitions.h"  // Include pin definitions for system
    #include "../SPI/SPI.h"                     // Include local SPI library with low frequency modification 
    // #include "MEDUSA.h"                         // Include MEDUSA library

    // Setup SD card
    void setupFileSystem();

    // SD card read/write functions
    void readCNF(String filename, int16_t (&data)[CNF_MAX_CLS][CNF_MAX_K+1], uint8_t &numVar, uint16_t &numCls);     
    void writeResults(char filename[], uint32_t *data, uint32_t datalen);

#endif