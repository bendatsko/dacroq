// Project: DAC80504 Library
// Authors: Luke Wormald

#include "DAC80504.h"

/*
    Constructor Function
*/
DAC80504::DAC80504()  // Initialize DAC object
{
    
}


// Setup function
void DAC80504::setup()
{
    // Setup CS and LDAC pins
    pinMode(SPI_CS_DAC_PIN, OUTPUT);
    pinMode(LDAC_PIN, OUTPUT);
    digitalWriteFast(SPI_CS_DAC_PIN, HIGH);
    digitalWriteFast(LDAC_PIN, HIGH);

    SPI.begin();    // Initialize SPI bus
}

/*
    Communication Functions
*/
void DAC80504::writeDAC80504(uint8_t addr, uint16_t data)   // Write data to DAC register
{
    SPI.beginTransaction(DAC80504_SPI_Settings);    // Configure the SPI controller for transmission

    digitalWriteFast(SPI_CS_DAC_PIN, LOW);  // Set the chip select low
    SPI.transfer(addr);                     // Transmit the address register
    SPI.transfer16(data);                   // Transmit the data
    delayMicroseconds(10); 
    digitalWriteFast(SPI_CS_DAC_PIN, HIGH);
    

    SPI.endTransaction();
}

uint16_t DAC80504::readDAC80504(uint8_t addr)   // Read data from DAC register
{
    SPI.beginTransaction(DAC80504_SPI_Settings);    // Configure the SPI controller for transmission
    
    // Transmit data read back request
    digitalWriteFast(SPI_CS_DAC_PIN, LOW);  // Set the chip select low
    SPI.transfer((1 << 7) | addr);         // Transmit the address register
    SPI.transfer16(0);                      // Transmit the data
    digitalWriteFast(SPI_CS_DAC_PIN, HIGH);

    delayMicroseconds(5);

    // Echo read back request and receive data
    digitalWriteFast(SPI_CS_DAC_PIN, LOW);  // Set the chip select low
    SPI.transfer((1 << 7) | addr);         // Transmit the address register
    uint16_t data = SPI.transfer16(0);      // Transmit the data
    digitalWriteFast(SPI_CS_DAC_PIN, HIGH); // Set the chip select high

    SPI.endTransaction();               // Release the SPI Controller

    return data;                        // Return read back data
}

void DAC80504::setLDAC(bool state)  // Set the LDAC pin HIGH or LOW
{
    digitalWriteFast(LDAC_PIN, state);  // Set or reset LDAC pin
}


/*
    Write Operation Functions
*/
void DAC80504::NOP()    // Write NOP to DAC
{
    writeDAC80504(NOP_ADDR, 0x0000);
}

void DAC80504::setSync()    // Write contents of SYNC register
{
    uint16_t data = (syncEnDAC0 | (syncEnDAC1 << 1) | (syncEnDAC2 << 2) | (syncEnDAC3 << 3) | (broadcastEnDAC0 << 8) | (broadcastEnDAC1 << 9) | (broadcastEnDAC2 << 10) | (broadcastEnDAC3 << 11));

    writeDAC80504(SYNC_ADDR, data);
}

void DAC80504::setConfig()  // Write contents of CONFIG register
{
    uint16_t data = (pwrdnDAC0 | (pwrdnDAC1 << 1) | (pwrdnDAC2 << 2) | (pwrdnDAC3 << 3) | (pwrdnRef << 8) | (DSDO << 9) | (FSDO << 10) | (CRCEn << 11) | (alarmEn << 12) | (alarmSel << 13));

    writeDAC80504(CONFIG_ADDR, data);
}

void DAC80504::setGain()    // Write contents of GAIN register
{
    uint16_t data = (buff0Gain | (buff1Gain << 1) | (buff2Gain << 2) | (buff3Gain << 3) | (refDivEn << 8));

    writeDAC80504(GAIN_ADDR, data);
}

void DAC80504::setTrigger(bool reset) // Write contents of TRIGGER register
{
    uint16_t data = (LDAC_DIG << 4);

    if (reset)
    {
        data = (0b1010 | data);
    }

    writeDAC80504(TRIGGER_ADDR, data);    
}

void DAC80504::setBroadcast(uint16_t data)   // Write DAC code BRDCAST register
{
    writeDAC80504(BRDCAST_ADDR, data);
}

void DAC80504::setDAC0(uint16_t data)   // Write DAC code to DAC0
{
    writeDAC80504(DAC0_ADDR, data);
}

void DAC80504::setDAC1(uint16_t data)   // Write DAC code to DAC1
{
    writeDAC80504(DAC1_ADDR, data);
}

void DAC80504::setDAC2(uint16_t data)   // Write DAC code to DAC2
{
    writeDAC80504(DAC2_ADDR, data);
}

void DAC80504::setDAC3(uint16_t data)   // Write DAC code to DAC3
{
    writeDAC80504(DAC3_ADDR, data);
}


/*
    Read Operation Functions
*/
uint16_t DAC80504::getID()// Read contents of DEVICE_ID register
{
    return readDAC80504(DEVICE_ID_ADDR);
}

uint16_t DAC80504::getSync()// Read contents of SYNC register
{
    return readDAC80504(SYNC_ADDR);
}

uint16_t DAC80504::getConfig()// Read contents of CONFIG register
{
    return readDAC80504(CONFIG_ADDR);
}

uint16_t DAC80504::getGain()// Read contents of GAIN register
{
    return readDAC80504(GAIN_ADDR);
}

uint16_t DAC80504::getBroadcast()// Read contents of BRDCAST register
{
    return readDAC80504(BRDCAST_ADDR);
}

bool DAC80504::getStatus()  // Read contents of STATUS register
{
    return readDAC80504(STATUS_ADDR);
}

uint16_t DAC80504::getDAC0()    // Read contents of DAC0 register
{
    return readDAC80504(DAC0_ADDR);
}

uint16_t DAC80504::getDAC1()    // Read contents of DAC1 register
{
    return readDAC80504(DAC1_ADDR);
}

uint16_t DAC80504::getDAC2()    // Read contents of DAC2 register
{
    return readDAC80504(DAC2_ADDR);
}

uint16_t DAC80504::getDAC3()    // Read contents of DAC3 register
{
    return readDAC80504(DAC3_ADDR);
}


/*
    Utility Functions
*/
uint16_t DAC80504::voltageToCode(float voltage, uint8_t DAC)    // Convert decimal voltage to binary DAC code
{
    uint8_t gain = 0;

    // Get gain of given DAC output buffer
    switch (DAC)
    {
        case DAC0_ADDR:
            gain = buff0Gain;
            break;

        case DAC1_ADDR:
            gain = buff1Gain;
            break;

        case DAC2_ADDR:
            gain = buff2Gain;
            break;

        case DAC3_ADDR:
            gain = buff3Gain;
            break;
        
        default:
            break;
    }

    uint16_t code = voltage / (Vref / (refDivEn + 1) * (gain + 1) / pow(2, numBits));

    return code;
}

float DAC80504::codeToVoltage(uint16_t code, uint8_t DAC) // Convert binary dac code to decimal voltage
{
    uint8_t gain = 0;

    // Get gain of given DAC output buffer
    switch (DAC)
    {
        case DAC0_ADDR:
            gain = buff0Gain;
            break;

        case DAC1_ADDR:
            gain = buff1Gain;
            break;

        case DAC2_ADDR:
            gain = buff2Gain;
            break;

        case DAC3_ADDR:
            gain = buff3Gain;
            break;
        
        default:
            break;
    }

    float voltage = (code / pow(2, numBits)) * (Vref * (refDivEn + 1)) * (gain + 1);

    return voltage;
}

// uint8_t DAC80504::CRC() // Calculate CRC parity code
// {

// }