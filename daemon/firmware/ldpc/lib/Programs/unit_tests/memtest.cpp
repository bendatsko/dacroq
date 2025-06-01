uint32_t x = chip.readReg(0x00000000);
  delay(1);
  chip.writeReg(addr, 0xFFFFFFFF);
  delay(1);
  x = chip.readReg(addr);
  SerialUSB.println(x);
  delay(1);
  chip.writeReg(addr, 0x00000000);
  delay(1);
  x = chip.readReg(addr);
  SerialUSB.println(x);
  SerialUSB.println();

  delay(2000); 