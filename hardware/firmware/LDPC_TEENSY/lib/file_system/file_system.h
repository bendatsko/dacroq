// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#ifndef FILE_SYSTEM_H
    #define FILE_SYSTEM_H

    // Include necessary Arduino libraries
    #include <Arduino.h>
    #include <SD.h>
    #include <SPI.h>
    #include <CSV_Parser.h>

    // Include local libraries and headers
    #include "../../include/pin_definitions.h"

    void setupFilesystem();
    void writeBin(char filename[], uint32_t *data, uint32_t datalen);
    void readBin(char filename[], uint32_t *data, uint32_t datalen);
    void writeCSV(char filename[], uint32_t *data, uint32_t datalen);
    void readCSV(char filename[], uint32_t *data, uint32_t datalen);

#endif