// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald

#ifndef FILE_SYSTEM_H
    #define FILE_SYSTEM_H

    // Include necessary Arduino libraries
    #include <Arduino.h>
    #include <SD.h>
    #include <SPI.h>
    #include <CSV_Parser.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"  // Include pin definitions for system
    #include "../SPI/SPI.h"                     // Include local SPI library with low frequency modification 

    void setupFilesystem();
    void writeBin(char filename[], uint32_t *data, uint32_t datalen);
    void appendBin(char filename[], uint32_t *data, uint32_t datalen);
    void readBin(char filename[], uint32_t *data, uint32_t datalen);
    void writeCSV(char filename[], uint32_t *data, uint32_t datalen);
    void appendCSV(char filename[], uint32_t *data, uint32_t datalen);
    void readCSV(char filename[], uint32_t *data, uint32_t datalen);
    void readCSV_64(char filename[], uint32_t *data, uint32_t datalen);
    void writeCSV_64(char filename[], uint64_t *data, uint32_t datalen);

#endif