 // Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald

#include "main.h"
// #include "time.h"
// #include "file_system.h"

uint8_t data = 0;

void setup() 
{


  DAEDALUS Chip0;

  SerialUSB.begin(2000000);  // Initialize debug/verbose serial port
  
  while (!SerialUSB)
  {
    // Wait for serial port to connect
  }
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

  bool die =0;


  SerialUSB.println("\nTeensy CPU Frequency: " + String(uint32_t(F_CPU/1E6)) + " MHz");
  Chip0.setup(DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
  // Chip0.General_setup_for_dummy(die);
  // Chip0.Multi_run();
  //batchRunLoop(String batchname, uint32_t problems, uint8_t runNum, bool uf20_or50, bool die)
  // uint16_t Ibiases[14] = {9,13,35,150,16,37,13,9,13,35,35,16,37,13};
  // Chip0.DAC_setup(0.395, 0.095, 0.5, 0.3, 0.245, 0.92, 0.9, 0.2, 0.9, 0.5, 0.4, 0.55, 0.245);
  // Chip0.IBIAS_setup(Ibiases);
  // Chip0.batchRunLoop("uf20-91", 101, 1,1,0);
  // Chip0.batchRunLoop("uf50-218", 101, 1,0,0);
  // Chip0.batchRunLoop("uf20-91", "", 100, 1,1,0);
  // Chip0.batchRunLoop("uf50-218", "", 100, 1,0,0);
  SerialUSB.println("Start the Calibration");
  Chip0.Calibration(die,DIE_SPI_CS_DIE1_PIN, DAEDALUS_EXT_CLK, DAEDALUS_FREQ, DAEDALUS_FREQ_DIV);
  

  //Chip1



  // u_long timeStart = millis();  // Start execution timer

  // // Calculate execution time
  // u_long time = (millis() - timeStart) / 1000;
  // u_long seconds = time % 60;
  // u_long minutes = ((time - seconds) / 60) % 60;
  // u_long hours = ((((time - seconds) / 60) - minutes) / 60) % 24;
  // u_long days = (((((time - seconds) / 60) - minutes) / 60) - hours) / 24;

  // // Print execution time
  // SerialUSB.println("\nDays: " + String(days) + "   Hours: " + String(hours) + "   Minutes: " + String(minutes) + "   Seconds: " + String(seconds));
  // // Print completion message
  // SerialUSB.println("Safe to remove SD card.");

  // End serial port
  SerialUSB.end();

  

  
}

void loop() 
{
  // bool now_state=0;
  // digitalWriteFast(SCAN_CLK_IN, HIGH);
  // delayNanoseconds(1000);
  // digitalWriteFast(SCAN_CLK_IN, LOW);
  // digitalWriteFast(SCAN_IN2, data);

  // digitalReadFast(SCAN_CLK_OUT);
  // if (now_state != digitalReadFast(SCAN_CLK_IN) && digitalReadFast(SCAN_CLK_IN) ==0)
  // {
  //   data = data;
  // }
  // data = !data;
  // now_state = digitalReadFast(SCAN_CLK_OUT);
  // delayNanoseconds(1000);
}