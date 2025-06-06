// Project: AMORGOS Teensy Test Bench
// Authors: Luke Wormald

#include "AMORGOS.h"

/*
    Constructor function
*/
AMORGOS::AMORGOS()
{
    
}


// Add missing chip methods if not in AMORGOS class
bool AMORGOS::verifyClockStability() {
    // Implement clock stability check
    uint32_t reg = readReg(CONTROL_REGS);
    return reg != 0xFFFFFFFF;
}

bool AMORGOS::testOscillators() {
    // Test oscillator functionality
    // This would involve checking oscillator status registers
    return true; // Placeholder
}


/*
    Setup functions
*/
void AMORGOS::setup(bool clkExt, uint8_t clkIntFrq, uint8_t clkDiv)
{
    setupFilesystem();  // Setup SD card file system
    
    // Configure pin modes of digital control pins
    pinMode(SPI_CS_CHIP_PIN, OUTPUT);   // SPI CS pin
    pinMode(CLKGEN_BYPASS_PIN, OUTPUT); // Control use of external clock (1 use external, 0 use internal)
    pinMode(CLKGEN_DIV0_PIN, OUTPUT);   // Configure internal clock divider (0-3) DIV = (2*DIV1 + DIV0)
    pinMode(CLKGEN_DIV1_PIN, OUTPUT);   // ^
    pinMode(CLKGEN_OSC0_PIN, OUTPUT);   // Configure internal clock frequency (NONLINEAR: 1/(4*OSC2 + 2*OSC1 + OSC0))
    pinMode(CLKGEN_OSC1_PIN, OUTPUT);   // ^
    pinMode(CLKGEN_OSC2_PIN, OUTPUT);   // ^
    pinMode(CLKGEN_RST_PIN, OUTPUT);    // Reset internal clock generator (active low)
    pinMode(RST_PIN, OUTPUT);           // Reset digital system (active low)
    pinMode(DONE_PIN, INPUT);  // DONE flag signaling tile computation and sampling have finished

    digitalWriteFast(SPI_CS_CHIP_PIN, HIGH); // Set chip select high

    SPI.begin();    // Initialize SPI bus

    /*
        Startup Sequence
    */
    digitalWriteFast(RST_PIN, LOW);         // Hold system reset low
    delay(500);                             // Delay to let reset propagate
    digitalWriteFast(CLKGEN_RST_PIN, LOW);  // Hold clock generator reset low

    // Setup digital clock
    if (clkExt) // If using external clock (100MHz max)
    {
        digitalWriteFast(CLKGEN_BYPASS_PIN, HIGH);  // Select external clock

        // Minimize internal clock frequency to reduce power
        digitalWriteFast(CLKGEN_OSC2_PIN, HIGH);
        digitalWriteFast(CLKGEN_OSC1_PIN, HIGH);
        digitalWriteFast(CLKGEN_OSC0_PIN, HIGH);
    }
    else    // If using internal ring oscillator
    {
        digitalWriteFast(CLKGEN_BYPASS_PIN, LOW);  // Select internal clock

        // Set internal clk frequency
        digitalWriteFast(CLKGEN_OSC2_PIN, clkIntFrq & 0b100);
        digitalWriteFast(CLKGEN_OSC1_PIN, clkIntFrq & 0b010);
        digitalWriteFast(CLKGEN_OSC0_PIN, clkIntFrq & 0b001);
    }
    
    // Set clock divider
    digitalWriteFast(CLKGEN_DIV0_PIN, clkDiv & 0b01);
    digitalWriteFast(CLKGEN_DIV1_PIN, clkDiv & 0b10);

    digitalWriteFast(CLKGEN_RST_PIN, HIGH); // Release clock generator reset

    delay(100); // Wait for clock to stabilize

    digitalWriteFast(RST_PIN, HIGH);    // Release system reset pin

    delay(100); // Wait for clock to stabilize

    /*
        SPI Setup
    */
    writeConfigReg(W_REG1, 30);   // Setup dummy cycle between write and read
    writeConfigReg(W_REG0, 0x00);   // Set to single SPI mode    

    DAC.setup();    // Initialize DAC

    // Set reference voltages
    DAC.setDAC0(DAC.voltageToCode(VREF[0], DAC0_ADDR));
    DAC.setDAC1(DAC.voltageToCode(VREF[1], DAC1_ADDR));
    DAC.setDAC2(DAC.voltageToCode(VREF[2], DAC2_ADDR));
    DAC.setDAC3(DAC.voltageToCode(VREF[3], DAC3_ADDR));
}

void AMORGOS::setupDumOsc()  // Setup dummy oscillator
{
    uint32_t data = ((0b000 << DUM_VREF) | (1 << DUM_RSTB) | (1 << DUM_RUN) | (0 <<  DUM_IB) | (0 << DUM_CLK));
    writeReg(CONTROL_REGS | (DUM_RXO_CONF * 4), data);
}

void AMORGOS::setVref(float vrefs[4])    // Set reference voltage for DAC
{
    VREF[0] = vrefs[0];
    VREF[1] = vrefs[1];
    VREF[2] = vrefs[2];
    VREF[3] = vrefs[3];

    // Set reference voltages
    DAC.setDAC0(DAC.voltageToCode(VREF[0], DAC0_ADDR));
    DAC.setDAC1(DAC.voltageToCode(VREF[1], DAC1_ADDR));
    DAC.setDAC2(DAC.voltageToCode(VREF[2], DAC2_ADDR));
    DAC.setDAC3(DAC.voltageToCode(VREF[3], DAC3_ADDR));
}


void AMORGOS::startup()
{
    setupDumOsc();  // Initialize dummy oscillator

    // Configure sampling and DLL control registers
    writeReg(CONTROL_REGS | (SMPL_CONF * 4), (0 << SMPL_SEL) | (0b000 << SMPL_AN_CNT)); // Configure sampling controller 
    writeReg(CONTROL_REGS | (DLL_CONF_CLK_SEL), 0b01);  // Configure DLL clock input

    // Load instruction memory
    writeReg(INSTRUCTION_REGS | 0*4, (HOLD << 29) | (2 << 19) | (1 << CGB_SI) | (1 << IB));
    writeReg(INSTRUCTION_REGS | 1*4, (PAUSE << 29) | (2 << 19) | (1 << CGB_SI) | (1 << IB));
    writeReg(INSTRUCTION_REGS | 2*4, (HOLD << 29) | (2 << 19) | (1 << CGB_SI) | (1 << IB));
    writeReg(INSTRUCTION_REGS | 3*4, (PAUSE << 29) | (2 << 19) | (1 << CGB_SI) | (1 << IB));
    writeReg(INSTRUCTION_REGS | 4*4, (TERMINATE << 29) | (2 << 19) | (1 << CGB_SI) | (1 << IB));

    // Configure instruction control registers
    writeReg(CONTROL_REGS | (CTRL_CONF_INSTR_SRC_SEL * 4), 1);  // Select to load from instruction memory
    writeReg(CONTROL_REGS | (CTRL_CONF_CTRL_EN * 4), 1);        // Start executing instructions

    delay(1);   // Let the DLL startup 
}

/*
    Communication functions
*/
void AMORGOS::writeConfigReg(uint8_t cmd, uint8_t data) // Write data to SPI configuration register
{
    SPI.beginTransaction(AMORGOS_SPI_Settings); // Configure the SPI controller for transmission
    
    digitalWriteFast(SPI_CS_CHIP_PIN, LOW);     // Set the chip select low
    SPI.transfer(cmd);                          // Transmit the command register
    SPI.transfer(data);                         // Transmit the data
    digitalWriteFast(SPI_CS_CHIP_PIN, HIGH);    // Set the chip select high

    SPI.endTransaction();                       // Release the SPI Controller
}

void AMORGOS::writeReg(uint32_t addr, uint32_t data)    // Write data to DAC register
{
    SPI.beginTransaction(AMORGOS_SPI_Settings); // Configure the SPI controller for transmission

    digitalWriteFast(SPI_CS_CHIP_PIN, LOW);     // Set the chip select low
    SPI.transfer(WRITE);                        // Transmit the command register
    SPI.transfer32(addr);                       // Transmit the address register
    SPI.transfer32(data);                       // Transmit the data
    digitalWriteFast(SPI_CS_CHIP_PIN, HIGH);    // Set the chip select high

    SPI.endTransaction();                       // Release the SPI Controller    
}

uint32_t AMORGOS::readReg(uint32_t addr)    // Read data from DAC register
{
    // Initialize transmission buffer
    uint8_t buffer[13] = {0};
    buffer[0] = 0x0B;

    // Load address into the transmission buffer
    buffer[1] = (addr & 0xFF000000) >> 24;
    buffer[2] = (addr & 0x00FF0000) >> 16;
    buffer[3] = (addr & 0x0000FF00) >> 8;
    buffer[4] = (addr & 0x000000FF);

    // Initialize return buffer
    uint8_t bufferOut[13] = {0};

    SPI.beginTransaction(AMORGOS_SPI_Settings);

    digitalWriteFast(SPI_CS_CHIP_PIN, LOW);              // Set the chip select low
    SPI.transfer(&buffer, &bufferOut, 13);  // Transmit the buffer and pass the return buffer
    digitalWriteFast(SPI_CS_CHIP_PIN, HIGH);             // Set the chip select high
    SPI.endTransaction();                   // Release the SPI controller

    delayMicroseconds(1000);

    uint32_t data = (bufferOut[9] << 24) | (bufferOut[10] << 16) | (bufferOut[11] << 8) | bufferOut[12];    // Read data out of the return buffer
    return data;
}

void AMORGOS::reset()   // Reset digital core
{
    digitalWriteFast(RST_PIN, LOW);
    delayMicroseconds(500);
    digitalWriteFast(RST_PIN, HIGH);
}


/*
    Program functions
*/

void AMORGOS::batchRunStartup()
{
    setupDumOsc();  // Initialize dummy oscillator

    // Configure sampling and DLL control registers
    writeReg(CONTROL_REGS | (SMPL_CONF * 4), (0 << SMPL_SEL) | (0b010 << SMPL_AN_CNT)); // Configure sampling controller 
    writeReg(CONTROL_REGS | (DLL_CONF_CLK_SEL*4), 0b01);  // Configure DLL clock input
    writeReg(CONTROL_REGS | (CTRL_CONF_INSTR_SRC_SEL * 4), 1);  // Select to load from instruction memory

    // Load instruction memory
    writeReg((INSTRUCTION_REGS | 4*0), 1075839234);   // Reset
    writeReg((INSTRUCTION_REGS | 4*1), 1075842818);   // Enable DLL
    writeReg((INSTRUCTION_REGS | 4*2), 1612713730);   // Pause for DLL startup
    writeReg((INSTRUCTION_REGS | 4*3), 1077936898);   // Reset sub-circuits excluding DLL 
    writeReg((INSTRUCTION_REGS | 4*4), 1077936898);   // Reset sub-circuits excluding DLL (for JUMP robustness) 
    writeReg((INSTRUCTION_REGS | 4*5), 1075842850);   // RSTB_PUD, RSTB_MEM, RSTB_SMPL enable
    writeReg((INSTRUCTION_REGS | 4*6), 1075842978);   // RSTB enable
    writeReg((INSTRUCTION_REGS | 4*7), 1075842982);   // PHI_PUD enable
    writeReg((INSTRUCTION_REGS | 4*8), 1075842990);   // PHI enable
    writeReg((INSTRUCTION_REGS | 4*9), 1075842982);   // PHI disable
    writeReg((INSTRUCTION_REGS | 4*10), 1075847074);   // PHI_PUD disable and SAMPLE enable
    writeReg((INSTRUCTION_REGS | 4*11), 1075847073);   // IB and RUN enable
    writeReg((INSTRUCTION_REGS | 4*12), 1075847073);   // Wait for done
    writeReg((INSTRUCTION_REGS | 4*13), 2147491745);   // PAUSE
    writeReg((INSTRUCTION_REGS | 4*14), 1612717985);   // Jump to startup
    writeReg((INSTRUCTION_REGS | 4*15), 538444546);   // Terminate  
    writeReg((INSTRUCTION_REGS | 4*16), 2684362657); 

    // Configure instruction control registers
    writeReg(CONTROL_REGS | (CTRL_CONF_CTRL_EN * 4), 1);        // Start executing instructions

    delay(1);   // Let the DLL startup 
}

void AMORGOS::batchRunLoop(String batchname, uint32_t length, uint8_t runNum)
{
    uint32_t softInfo[24] = {0};    // Preallocate array for soft info
    uint32_t samples[25] = {0};     // Preallocate array for output data

    String dataFolderStr = batchname + "/data_out_VDD_800mV_25C" + String(runNum); 
    uint8_t strLen = dataFolderStr.length() + 1;
    char dataFolderChar[strLen];
    dataFolderStr.toCharArray(dataFolderChar, strLen);
    SD.mkdir(dataFolderChar);
    
    for (uint32_t i = 0; i < length; i++)
    {
        String softInfoStr = batchname + "/soft_info/info" + String(i+1) + ".csv";  // Concatenate file path as String
        strLen = softInfoStr.length() + 1;                                          // Calculate length of String
        char softInfoChar[strLen];                                                  // Initialize char array
        softInfoStr.toCharArray(softInfoChar, strLen);                              // Copy file path to char array

        readCSV(softInfoChar, softInfo, 24);    // Read soft info from SD card
        loadSoftInfo(softInfo);                 // Load soft info onto chip

        writeReg(CONTROL_REGS | CTRL_CONF_PC_CONTINUE*4, 1);    // Resume from pause instruction

        String samplesStr = dataFolderStr + "/data" + String(i+1) + ".csv";         // Concatenate file path as String
        strLen = samplesStr.length() + 1;                                           // Calculate length of String
        char samplesChar[strLen];                                                   // Initialize char array
        samplesStr.toCharArray(samplesChar, strLen);                                // Copy file path to char array

        while (!digitalReadFast(DONE_PIN))
        {
            // Wait for done signal
        }

        retrieveSamples(samples);                               // Retrieve sampled data
        samples[24] = readReg(CONTROL_REGS | TOTAL_CYCLE*4);    // Retrieve total execution cycles
        writeBin(samplesChar, samples, 25);                     // Write to SD card

        if (i%1000 == 0)
        {
            SerialUSB.println("Dataset " + String(i+1) + ": Complete");
        }
    }
}

void AMORGOS::batchRunLoop(String batchname, uint32_t *softInfo, uint32_t *dataOut, uint32_t length, uint8_t runNum)
{
    uint32_t inputs[24] = {0};  // Preallocate array for soft info
    uint32_t samples[25] = {0}; // Preallocate array for output data

    // Prepare file path for data output
    String dataFolderStr = batchname + "/dout_VDD_800mV_25C" + String(runNum) + ".bin"; 
    uint8_t strLen = dataFolderStr.length() + 1;
    char dataFolderChar[strLen];
    dataFolderStr.toCharArray(dataFolderChar, strLen);
    
    
    for (uint32_t i = 0; i < length; i++)
    {
        // Retrieve soft info from memory
        for (uint8_t j = 0; j < 24; j++)
        {
            inputs[j] = softInfo[i*24 + j];
        }

        loadSoftInfo(inputs); // Load soft info onto chip

        writeReg(CONTROL_REGS | CTRL_CONF_PC_CONTINUE*4, 1);    // Resume from pause instruction

        while (!digitalReadFast(DONE_PIN))
        {
            // Wait for done signal
        }

        retrieveSamples(samples);                               // Retrieve sampled data
        samples[24] = readReg(CONTROL_REGS | TOTAL_CYCLE*4);    // Retrieve total execution cycles

        // Store data in output array
        for (uint8_t j = 0; j < 25; j++)
        {
            dataOut[i*25 + j] = samples[j];
        }
    }
    
    // Write to SD card
    writeBin(dataFolderChar, dataOut, length*25);   
}
void AMORGOS::batchPowerMeas(String batchname, uint32_t *softInfo, uint32_t *dataOut, uint32_t length, uint8_t runNum)
{
    uint32_t inputs[24] = {0};  // Preallocate array for soft info
    uint32_t samples[25] = {0}; // Preallocate array for output data

    // Prepare file path for data output
    String dataFolderStr = batchname + "/dout_power_test" + String(runNum) + ".bin"; 
    uint8_t strLen = dataFolderStr.length() + 1;
    char dataFolderChar[strLen];
    dataFolderStr.toCharArray(dataFolderChar, strLen);

    
    for (uint32_t i = 0; i < 1; i++)
    {
        // Retrieve soft info from memory
        for (uint8_t j = 0; j < 24; j++)
        {
            inputs[j] = softInfo[i*24 + j];
        }

        loadSoftInfo(inputs); // Load soft info onto chip

        writeReg(CONTROL_REGS | CTRL_CONF_PC_CONTINUE*4, 1);    // Resume from pause instruction

        while (!digitalReadFast(DONE_PIN))
        {
            // Wait for done signal
        }

        // retrieveSamples(samples);                               // Retrieve sampled data
        // samples[24] = readReg(CONTROL_REGS | TOTAL_CYCLE*4);    // Retrieve total execution cycles

        // // Store data in output array
        // for (uint8_t j = 0; j < 25; j++)
        // {
        //     dataOut[i*25 + j] = samples[j];
        // }
    }
    
    // Write to SD card
    // writeBin(dataFolderChar, dataOut, length*25);   
}

/*  
    Data functions
*/
void AMORGOS::loadSoftInfo(uint32_t *data)
{
    for (uint8_t i = 0; i < 24; i++)
    {
        writeReg((SOFT_INFO_REGS | i*4), data[i]);
    }
}

void AMORGOS::retrieveSamples(uint32_t *data)
{
    for (uint8_t i = 0; i < 24; i++)
    {
        data[i] = readReg((SAMPLE_REGS | i*4));
    }
}