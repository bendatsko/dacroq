#include "MAX5497.h"

// Constructor
MAX5497::MAX5497(uint8_t csPin)
{
    this -> csPin = csPin;
}

// Initialize the MAX5497
void MAX5497::setup() 
{
    // Set up the SPI bus
    pinMode(csPin, OUTPUT);         // Set chip select pin to output
    digitalWriteFast(csPin, HIGH);  // Set chip select pin to high
    MAX5497_SPI_BUS.begin();                // Initialize MAX5497_SPI_BUS bus
}

// Write a value to the MAX5497
void MAX5497::write(uint8_t command, uint16_t value) 
{

    // Check if the value is within the valid range
    if (value > 1023)
    {
        // Print error message
        SerialUSB.println("MAX5497: Value out of range (0-1023)");
    }
    else
    {
        MAX5497_SPI_BUS.beginTransaction(MAX5497_SPI_Settings);    // Configure the MAX5497_SPI_BUS controller for transmission
        digitalWriteFast(csPin, LOW);   // Begin transmission
        MAX5497_SPI_BUS.transfer(command);      // Send command byte
        MAX5497_SPI_BUS.transfer16(value << 6); // Shift value to align with the 10-bit wiper position
        digitalWriteFast(csPin, HIGH);  // End transmission
        MAX5497_SPI_BUS.endTransaction();       // Release the MAX5497_SPI_BUS Controller
    }
}

// Copy data within the MAX5497
void MAX5497::copy(uint8_t command) 
{
    MAX5497_SPI_BUS.beginTransaction(MAX5497_SPI_Settings);    // Configure the MAX5497_SPI_BUS controller for transmission
    digitalWriteFast(csPin, LOW);   // Begin transmission
    MAX5497_SPI_BUS.transfer(command);      // Send command byte
    MAX5497_SPI_BUS.transfer16(0x0000);     // Dummy data for copy commands
    digitalWriteFast(csPin, HIGH);  // End transmission
    MAX5497_SPI_BUS.endTransaction();       // Release the MAX5497_SPI_BUS Controller
}
