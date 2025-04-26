#include "scanchain.h"

ScanChain* ScanChain::instance = nullptr;

ScanChain::ScanChain(int chainLength, int clockPin, int dataIn1, int dataOut1,
                     int enable1, int dataIn2, int dataOut2, int enable2,
                     int dataIn3, int dataOut3, int enable3)
    : chainLength(chainLength),
      clockPin(clockPin), dataPins{
          {dataIn1, dataOut1},
          {dataIn2, dataOut2},
          {dataIn3, dataOut3}
      },
      enablePins{enable1, enable2, enable3}, scanComplete(false),
      running(false), dataPointer(nullptr), remainingDataSize(0),
      bufferIndex(0), bufferEmpty(true), transferCallback(nullptr)
{
    instance = this;
}

void ScanChain::begin(unsigned long clockSpeed)
{
    pinMode(clockPin, OUTPUT);
    for (int i = 0; i < 3; i++)
    {
        pinMode(dataPins[i][0], INPUT);
        pinMode(dataPins[i][1], OUTPUT);
        pinMode(enablePins[i], OUTPUT);
        digitalWrite(enablePins[i], HIGH);  // Set enable pins to HIGH
    }

    // Calculate clock period and set up timer interrupt
    clockPeriodUs = 1000000 / clockSpeed;
    timer.begin(timerISR, clockPeriodUs);
    timer.priority(255); // Highest priority
}

void ScanChain::run()
{
    noInterrupts();
    running = true;
    scanComplete = false;
    interrupts();
}

void ScanChain::stop()
{
    noInterrupts();
    running = false;
    interrupts();
}

void ScanChain::clear()
{
    noInterrupts();
    for (int i = 0; i < 3; i++)
    {
        shiftRegisters[i] = 0;
    }
    scanComplete = false;
    dataPointer = nullptr;
    remainingDataSize = 0;
    bufferIndex = 0;
    bufferEmpty = true;
    interrupts();
}

void ScanChain::loadData(uint32_t data1, uint32_t data2, uint32_t data3)
{
    noInterrupts();
    shiftRegisters[0] = data1;
    shiftRegisters[1] = data2;
    shiftRegisters[2] = data3;
    scanComplete = false;
    interrupts();
}

void ScanChain::loadDataFromMemory(const uint8_t* data, size_t dataSize)
{
    noInterrupts();
    dataPointer = data;
    remainingDataSize = dataSize;
    bufferIndex = 0;
    bufferEmpty = true;
    loadNextChunk();
    interrupts();
}

void ScanChain::loadNextChunk()
{
    size_t bytesToCopy = min(remainingDataSize, BUFFER_SIZE);
    memcpy(buffer, dataPointer, bytesToCopy);
    dataPointer += bytesToCopy;
    remainingDataSize -= bytesToCopy;
    bufferIndex = 0;
    bufferEmpty = false;
}

bool ScanChain::isComplete() const
{
    return scanComplete && remainingDataSize == 0 && bufferEmpty;
}

void ScanChain::getOutput(uint32_t& out1, uint32_t& out2, uint32_t& out3) const
{
    noInterrupts();
    out1 = shiftRegisters[0];
    out2 = shiftRegisters[1];
    out3 = shiftRegisters[2];
    interrupts();
}

void ScanChain::setDataTransferCallback(DataTransferCallback callback)
{
    transferCallback = callback;
}



void ScanChain::timerISR()
{
    static bool clockState = false;
    static int bitCount = 0;

    if (instance && instance->running)
    {
        if (clockState)
        {
            // Clock high: Shift in data
            digitalWriteFast(instance->clockPin, HIGH);
            delayMicroseconds(1);  // Small delay for signal stability
            for (int i = 0; i < 3; i++)
            {
                // Shift in new bit from data input pin
                instance->shiftRegisters[i] =
                    (instance->shiftRegisters[i] << 1) |
                    digitalReadFast(instance->dataPins[i][0]);
            }
            bitCount++;
        }
        else
        {
            // Clock low: Output data
            digitalWriteFast(instance->clockPin, LOW);
            delayMicroseconds(1);  // Small delay for signal stability
            for (int i = 0; i < 3; i++)
            {
                // Output most significant bit to data output pin
                digitalWriteFast(
                    instance->dataPins[i][1],
                    (instance->shiftRegisters[i] >> (instance->chainLength - 1)) & 1);
            }
        }

        clockState = !clockState;

        // Check if we've shifted all bits in the chain
        if (bitCount == instance->chainLength)
        {
            bitCount = 0;
            instance->scanComplete = true;

            // Load next data from buffer if available
            if (!instance->bufferEmpty)
            {
                for (int i = 0; i < 3; i++)
                {
                    if (instance->bufferIndex < instance->BUFFER_SIZE)
                    {
                        instance->shiftRegisters[i] =
                            instance->buffer[instance->bufferIndex++];
                    }
                }

                // Check if we've used all data in the buffer
                if (instance->bufferIndex >= instance->BUFFER_SIZE)
                {
                    instance->bufferEmpty = true;
                    if (instance->remainingDataSize > 0)
                    {
                        instance->loadNextChunk();
                    }
                    if (instance->transferCallback)
                    {
                        instance->transferCallback();
                    }
                }
            }
        }
    }
}
