// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald

#include "data_functions.h"

void cacheSoftInfo(String batchname, uint32_t *softInfo, uint32_t length)   // Load all soft info into memory
{
    String softInfoStr = batchname + "/info.bin";   // Concatenate file path as String
    uint8_t strLen = softInfoStr.length() + 1;      // Calculate length of String
    char softInfoChar[strLen];                      // Initialize char array
    softInfoStr.toCharArray(softInfoChar, strLen);  // Copy file path to char array

    readBin(softInfoChar, softInfo, length);    // Read soft info file into memory
}