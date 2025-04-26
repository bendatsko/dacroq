#ifndef SCANCHAIN_H
#define SCANCHAIN_H

#include <Arduino.h>

class ScanChain
{
public:
    // Define the size of the internal buffer for data transfer
    static const size_t BUFFER_SIZE = 1024; // Buffer size in bytes

    // Constructor: initializes the scan chain with specified parameters
    ScanChain(int chainLength, int clockPin, int dataIn1, int dataOut1,
              int enable1, int dataIn2, int dataOut2, int enable2, int dataIn3,
              int dataOut3, int enable3);

    // Initialize the scan chain with the specified clock speed
    void begin(unsigned long clockSpeed);
    // Start the scan chain operation
    void run();
    // Stop the scan chain operation
    void stop();
    // Clear all data and reset the scan chain
    void clear();
    // Load 32-bit data into each of the three channels
    void loadData(uint32_t data1, uint32_t data2, uint32_t data3);
    // Load large data from memory for transfer
    void loadDataFromMemory(const uint8_t* data, size_t dataSize);
    // Check if the data transfer is complete
    bool isComplete() const;
    // Get the current output of the scan chain
    void getOutput(uint32_t& out1, uint32_t& out2, uint32_t& out3) const;

    // Define the callback function type
    typedef void (*DataTransferCallback)(void);
    // Set the callback function for chunk transfers
    void setDataTransferCallback(DataTransferCallback callback);

private:
    // Timer Interrupt Service Routine
    static void timerISR();
    // Pointer to the current instance (used in ISR)
    static ScanChain* instance;

    // Length of each shift register in the scan chain
    const int chainLength;
    // Pin number for the clock signal
    const int clockPin;
    // Pin numbers for data in/out for each channel
    const int dataPins[3][2]; // [channel][in/out]
    // Pin numbers for enable signals for each channel
    const int enablePins[3];

    // Shift registers for each channel
    volatile uint32_t shiftRegisters[3];
    // Flag to indicate if a scan operation is complete
    volatile bool scanComplete;
    // Flag to indicate if the scan chain is currently running
    volatile bool running;

    // Clock period in microseconds
    unsigned long clockPeriodUs;
    // Timer object for generating clock signals
    IntervalTimer timer;

    // Pointer to the data being transferred
    const uint8_t* dataPointer;
    // Remaining size of data to be transferred
    size_t remainingDataSize;
    // Internal buffer for data transfer
    uint8_t buffer[BUFFER_SIZE];
    // Current index in the buffer
    volatile size_t bufferIndex;
    // Flag to indicate if the buffer is empty
    volatile bool bufferEmpty;
    // Callback function for chunk transfers
    DataTransferCallback transferCallback;

    // Load the next chunk of data into the buffer
    void loadNextChunk();
};

#endif // SCANCHAIN_H
