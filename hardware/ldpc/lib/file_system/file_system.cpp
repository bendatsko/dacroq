// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#include "file_system.h"

void setupFilesystem()
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

void readCSV(char filename[], uint32_t *data, uint32_t datalen)
{
    CSV_Parser cp(/*format*/ "uL", /*has_header*/ false, /*delimiter*/ ',');

    if (cp.readSDfile(filename)) 
    {
        uint32_t *column_1 = (uint32_t*)cp[0];

        for(uint32_t row = 0; row < datalen; row++) 
        {   
            data[row] = column_1[row];
        }
    }
    else
    {
        SerialUSB.println("Error: readCSV file " + String(filename) + " not found.");
        while(1);   // Stuck due to missing file
    }
}

void writeCSV(char filename[], uint32_t *data, uint32_t datalen)
{
    if (SD.exists(filename))
    {
        SD.remove(filename);
    } 

    File csv = SD.open(filename, FILE_WRITE);

    uint8_t cnt = 0;
    while (!csv)
    {
        csv.close();
        csv = SD.open(filename, FILE_WRITE);
        delay(10);

        if (cnt == 255)
        {
            SerialUSB.println("Error creating " + String(filename));
            break;
        }
        cnt++;
    }

    for (uint32_t i = 0; i < datalen; i++)
    {
        csv.print(String(data[i]) + ",\n");
    }

    csv.close();
}

void readBin(char filename[], uint32_t *data, uint32_t datalen)
{
    File bin = SD.open(filename, FILE_READ); 
    
    if (bin)
    {
        for (uint32_t i = 0; i < datalen; i++)
        {
            union 
            {
                uint32_t word;
                byte bytes[4];
            } fmt; 

            bin.read(fmt.bytes, 4);

            data[i] = fmt.word;
        }
    }
    else
    {
        SerialUSB.println("Error: File " + String(filename) + " not found.");
    }

    bin.close();
}

void writeBin(char filename[], uint32_t *data, uint32_t datalen)
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