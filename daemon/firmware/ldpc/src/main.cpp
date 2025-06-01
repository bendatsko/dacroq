 // Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#include "main.h"
#include "file_system.h"

// Initialize chip object
AMORGOS chip;

// Allocate memory for soft info
const uint32_t length = 76800; 
const size_t softInfoSize = 24 * length;
EXTMEM uint32_t softInfo[softInfoSize];

// Allocate memory for output data
const size_t dataOutSize = 25*length;
EXTMEM uint32_t dataOut[dataOutSize];

void setup() 
{
  SerialUSB.begin(SERIALUSB_BAUD);  // Initialize debug/verbose serial port

  while (!SerialUSB)
  {
    // Wait for serial port to connect
  }
  
  SerialUSB.println("\nTeensy CPU Frequency: " + String(uint32_t(F_CPU/1E6)) + " MHz");
  SerialUSB.println("ARM Internal Temperature: " + String(InternalTemperature.readTemperatureC()) + " C");

  chip.setup(AMORGOS_EXT_CLK, AMORGOS_FREQ, AMORGOS_FREQ_DIV);  // Initialize AMORGOS chip

  String INFO = "/SOFT_INFO";  // Soft or hard info identifier

  String SNRs[10] = {"1dB", "2dB", "3dB", "4dB", "5dB", "6dB", "7dB", "8dB", "9dB", "10dB"}; 
                        // 1db  2dB  3dB  4dB  5dB  6dB  7dB  8dB  9dB  10dB
  uint8_t totalRuns[10] = {0,  0,  0,   0,   0,   60,   0,   0,   0,   1};

  // Initialize timing variables
  u_long timeStart = millis();  // Record start time
  u_long timeLast = 0;          // Used to store time before an operation

  for (uint8_t SNR = 10; SNR < 11; SNR++)
  {
    if (totalRuns[SNR] > 0)
    {
      SerialUSB.println("\nInput: " + SNRs[SNR] + " SNR");
      SerialUSB.print("Caching soft info... ");
      
      timeLast = millis();
      cacheSoftInfo(SNRs[SNR] + INFO, softInfo, softInfoSize);
      
      SerialUSB.println("Complete. Time: " + String((millis() - timeLast)) + "ms");
    }
    for (uint8_t i = 0; i < totalRuns[SNR]; i++)
    {
      SerialUSB.print("Run " + String(i) + ": ");

      timeLast = millis();
      chip.batchRunStartup();
      chip.batchRunLoop(SNRs[SNR] + INFO, softInfo, dataOut, length, i);
      // chip.batchPowerMeas(SNRs[SNR] + INFO, softInfo, dataOut, length, i);
      SerialUSB.println("complete. Time: " + String((millis() - timeLast) / 1000) + "s");
    }
  }
  
  // Calculate execution time
  u_long time = (millis() - timeStart) / 1000;
  u_long seconds = time % 60;
  u_long minutes = ((time - seconds) / 60) % 60;
  u_long hours = ((((time - seconds) / 60) - minutes) / 60) % 24;
  u_long days = (((((time - seconds) / 60) - minutes) / 60) - hours) / 24;

  // Print execution time
  SerialUSB.println("\nDays: " + String(days) + "   Hours: " + String(hours) + "   Minutes: " + String(minutes) + "   Seconds: " + String(seconds));
  // Print completion message
  SerialUSB.println("Safe to remove SD card.");
  // End serial port
  SerialUSB.end();
}

void loop() 
{
  
}