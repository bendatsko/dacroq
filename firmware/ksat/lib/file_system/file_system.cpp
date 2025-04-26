// Project: MEDUSA Teensy Test Bench
// Authors: Luke Wormald

#include "File_System.h"

// Setup SD card
void setupFileSystem()
{
    SerialUSB.print("\nInitializing SD card...");

    // see if the card is present and can be initialized:
    if (!SD.begin(BUILTIN_SDCARD)) 
    {
        SerialUSB.println("Card failed, or not present");
        while (1) 
        {
            // No SD card, so don't do anything more - stay stuck here
        }
    }
    SerialUSB.println(" card initialized.");
}

// SD card read/write functions
void readCNF(String filename, int16_t (&data)[CNF_MAX_CLS][CNF_MAX_K+1], uint8_t &numVar, uint16_t &numCls)  // Read uint32 binary file
{
    uint8_t strLen = filename.length() + 1;
    char filenameChar[strLen];
    filename.toCharArray(filenameChar, strLen);

    File bin = SD.open(filenameChar, FILE_READ); 
    
    if (bin)
    {
        // Read data length
        uint32_t dataLen = bin.size() / 2;    

        SerialUSB.println("Data length: " + String(dataLen));

        // Initialize array indexing variables
        uint16_t clsIdx = 0;    // Clause index
        uint8_t varIdx = 0;     // Variable index

        // Read all data from file
        for (uint32_t i = 0; i < dataLen; i++)
        {
            // Union to read 2 bytes as uint16_t
            union 
            {
                int16_t value;
                byte bytes[2];
            } fmt; 

            // Read 2 bytes from file
            bin.read(fmt.bytes, 2);

            if (i == 0) // Check if first value
            {
                SerialUSB.println("First value: " + String(fmt.value));
                numVar = fmt.value; // Read number of variables
            }
            else if (i == 1)    // Check if second value
            {
                numCls = fmt.value; // Read number of clauses
            }
            else if (fmt.value == 0) // Check if end of clause (0 termination)
            {
                clsIdx++;   // Increment clause index
                varIdx = 0; // Reset variable index
            }
            else
            {
                // Write data to array
                data[clsIdx][varIdx] = fmt.value;

                varIdx++; // Increment variable index
            }
        }
    }
    else
    {
        // Print error message
        SerialUSB.println("Error: File " + String(filename) + " not found.");
    }

    bin.close();
}

void writeResults(char filename[], uint32_t *data, uint32_t datalen)    // Write uint32 binary file
{
    if (SD.exists(filename))
    {
        SD.remove(filename);
    } 


    File bin = SD.open(filename, FILE_WRITE); 

    uint8_t cnt = 0;
    while (!bin)
    {
        bin.close();
        bin = SD.open(filename, FILE_WRITE);
        delay(10);

        if (cnt == 255)
        {
            // Print error message
            SerialUSB.println("Error creating " + String(filename));

            break;
        }
        cnt++;
    }

    for (uint32_t i = 0; i < datalen; i++)
    {
        union 
        {
            uint32_t word;
            byte bytes[4];
        } fmt; 

        fmt.word = data[i];

        bin.write(fmt.bytes, 4);
    }

    bin.close();
}