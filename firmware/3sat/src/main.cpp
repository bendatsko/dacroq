#include "main.h"

uint8_t data = 0;
bool filesTransferred = false;
bool calibrationReady = false;

void createDirectoryIfNeeded(const char *filename)
{
  char path[64] = {0};
  strncpy(path, filename, sizeof(path) - 1);
  char *lastSlash = strrchr(path, '/');
  if (lastSlash)
  {
    *lastSlash = 0;
    if (strlen(path) > 0)
    {
      SD.mkdir(path);
    }
  }
}

void runCalibration()
{
  DAEDALUS Chip0;
  SerialUSB.println("\nTeensy CPU Frequency: " + String(uint32_t(F_CPU / 1E6)) + " MHz");
  SerialUSB.println("Starting chip setup...");

  Chip0.setup(DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
  SerialUSB.println("Chip setup complete");

  bool die = 0;
  SerialUSB.println("Starting calibration sequence...");
  Chip0.Calibration(die, DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
  SerialUSB.println("Calibration complete");
}

void clearDirectory(const char *dirPath)
{
  File dir = SD.open(dirPath);
  if (!dir || !dir.isDirectory())
  {
    SerialUSB.println("Failed to open directory: " + String(dirPath));
    return;
  }

  while (true)
  {
    File entry = dir.openNextFile();
    if (!entry)
    {
      break;
    }

    // Get the full path by combining directory path and file name
    String fullPath;
    if (strcmp(dirPath, "/") == 0)
    {
      fullPath = String("/") + entry.name();
    }
    else
    {
      fullPath = String(dirPath) + "/" + entry.name();
    }

    if (entry.isDirectory())
    {
      entry.close();
      clearDirectory(fullPath.c_str());
      if (!SD.rmdir(fullPath.c_str()))
      {
        // SerialUSB.println("Failed to remove directory: " + fullPath); // Comment out or remove
      }
      else
      {
        // SerialUSB.println("Removed directory: " + fullPath); // Comment out or remove
      }
    }
    else
    {
      entry.close();
      if (!SD.remove(fullPath.c_str()))
      {
        // SerialUSB.println("Failed to remove file: " + fullPath); // Comment out or remove
      }
      else
      {
        // SerialUSB.println("Removed file: " + fullPath); // Comment out or remove
      }
    }
  }

  dir.close();
}

void clearSDCard()
{
  // SerialUSB.println("\n=== Starting complete SD card clear ==="); // Remove or comment this line

  if (!SD.begin(BUILTIN_SDCARD))
  {
    // We might want to keep this error since it's important
    SerialUSB.println("SD card initialization failed!");
    return;
  }

  clearDirectory("/");

  // SerialUSB.println("=== SD card clear complete ===\n"); // Remove or comment this line
}

void setup()
{
  SerialUSB.begin(2000000);
  while (!SerialUSB)
  {
    // Wait for serial port to connect
  }

  // Initialize SD card without verbose output
  if (!SD.begin(BUILTIN_SDCARD))
  {
    SerialUSB.write('E'); // Error indicator
    while (1)
      ;
  }

  // Remove the SD card clear from setup
  clearSDCard();

  pinMode(SCAN_CLK_IN, OUTPUT);
  pinMode(SCAN_CLK_OUT, INPUT);
  pinMode(SCAN_IN0, OUTPUT);
  pinMode(SCAN_IN1, OUTPUT);
  pinMode(SCAN_IN2, OUTPUT);
  pinMode(SCAN_OUT0, INPUT);
  pinMode(SCAN_OUT1, INPUT);
  pinMode(SCAN_OUT2, INPUT);
  pinMode(SCAN_WRITE_EN_DIE1, OUTPUT);
  pinMode(SCAN_WRITE_EN_DIE2, OUTPUT);
}

bool verifyRequiredFiles()
{
  const char *requiredFiles[] = {
      "data_info_01.csv",
      "data_info_02.csv",
      "data_info_11.csv",
      "data_info_12.csv",
      "data_info_21.csv",
      "data_info_22.csv"};

  for (const char *filename : requiredFiles)
  {
    if (!SD.exists(filename))
    {
      return false;
    }
  }
  return true;
}

void loop()
{
  if (SerialUSB.available())
  {
    char cmd = SerialUSB.read();
    SerialUSB.flush();

    if (cmd == 'T')
    { // Upload to SD
      while (!SerialUSB.available())
        delay(1);
      uint8_t nameLen = SerialUSB.read();

      char filename[64] = {0};
      SerialUSB.readBytes(filename, nameLen);

      uint32_t size = 0;
      SerialUSB.readBytes((char *)&size, 4);
      createDirectoryIfNeeded(filename);

      File file = SD.open(filename, FILE_WRITE);
      if (!file)
      {
        SerialUSB.write('X');
        return;
      }

      uint8_t buffer[512];
      while (size > 0)
      {
        uint16_t toRead = min(512UL, size);
        SerialUSB.readBytes((char *)buffer, toRead);
        file.write(buffer, toRead);
        size -= toRead;
      }

      file.close();
      SerialUSB.write('A');
      calibrationReady = true;
      filesTransferred = true;
    }
    else if (cmd == 'F')
    { // Download from SD
      File root = SD.open("/");
      while (File entry = root.openNextFile())
      {
        if (!entry.isDirectory())
        {
          SerialUSB.write('S');
          SerialUSB.flush();

          uint8_t nameLen = strlen(entry.name());
          SerialUSB.write(nameLen);
          SerialUSB.write(entry.name());
          SerialUSB.flush();

          uint32_t size = entry.size();
          SerialUSB.write((uint8_t *)&size, 4);
          SerialUSB.flush();

          uint8_t buffer[512];
          while (size > 0)
          {
            uint16_t toRead = min(512UL, size);
            entry.read(buffer, toRead);
            SerialUSB.write(buffer, toRead);
            SerialUSB.flush();
            size -= toRead;
          }
        }
        entry.close();
      }
      root.close();
      SerialUSB.write('E');
      SerialUSB.flush();
      clearSDCard();
      // Now that the files have been downloaded to the host, clear the SD card.
    }
    else if (cmd == 'R')
    {
      // SerialUSB.println("\nStarting calibration sequence");
      runCalibration();
      // SerialUSB.println("Calibration sequence complete");
    }
  }
}
