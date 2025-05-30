// Project: MEDUSA Test Bench
// Authors: Luke Wormald

#include "main.h"
// #include 

MEDUSA Medusa;

void setup() 
{
  // Initialize debug/verbose serial port
  SerialUSB.begin(SERIALUSB_BAUD); 

  // Initialize MEDUSA platform
  Medusa.setup();   

  // Wait for serial port to connect
  while (!SerialUSB) {} 

  for (uint32_t i = 66; i <= 69; i++)
  {
    // String filepath = "/BIN_Files/satlib/uf50-218/uf50-0" + String(i) + ".cnf.bin"; 
    String number = String(i);
    // if (i < 100)
    // {
    //   number = "0" + number;
    // }
    // if (i < 10)
    // {
    //   number = "0" + number;
    // }

    // String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_0/C3_formula_" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_1/C3_formula_" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_2/" + number + ".cnf.bin"; 
    // String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_3/" + number + ".cnf.bin"; 
    String filepath = "/BIN_Files/tentative_batches/hardware/t_batch_4/" + number + ".dimacs.bin"; 

    // String filepath = "/BIN_Files/tentative_batches/projected/t_batch_0/C0_formula_" + number + ".cnf.bin";
    // String filepath = "/BIN_Files/tentative_batches/projected/t_batch_1/C0_formula_" + number + ".cnf.bin";
    // String filepath = "/BIN_Files/tentative_batches/projected/t_batch_2/formula_" + number + ".cnf.bin";
    // String filepath = "/BIN_Files/tentative_batches/projected/t_batch_3/" + number + ".cnf.bin"; 


    // Medusa.runSolverSingle(TILE_RIGHT, filepath, 100);  // Run solver for specified problem
    Medusa.runSolverCoupled(filepath, 100);  // Run solver for specified problem
    SerialUSB.println("Finished run " + String(i));
  }

  SerialUSB.println("Finished running solver");

  // End serial port
  SerialUSB.end();
}

void loop() 
{
  if (SerialUSB.available())
  {
    char cmd = SerialUSB.read();
    
    if (cmd == 'I')
    {
      SerialUSB.println("DACROQ_BOARD:KSAT");
    }
  }
}