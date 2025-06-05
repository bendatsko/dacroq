// Project: DAC80508 Library
// Authors: Luke Wormald

#include "DAC80508.h"

/*
    Constructor Function
*/
DAC80508::DAC80508(uint8_t csPin)  // Initialize DAC object
{
    this -> csPin = csPin;    // Set chip select pin
}


// Setup function
void DAC80508::setup()
{
    pinMode(csPin, OUTPUT);         // Set chip select pin to output
    digitalWriteFast(csPin, HIGH);  // Set chip select pin to high
    DAC80508_SPI_BUS.begin();                // Initialize DAC80508_SPI_BUS bus

    setConfig();    // Set DAC configuration
    setGain();      // Set DAC gain
    setSync();      // Set DAC sync
}

/*
    Communication Functions
*/
void DAC80508::writeDAC80508(uint8_t addr, uint16_t data)   // Write data to DAC register
{
    DAC80508_SPI_BUS.beginTransaction(DAC80508_SPI_Settings);    // Configure the DAC80508_SPI_BUS controller for transmission
    digitalWriteFast(csPin, LOW);
    DAC80508_SPI_BUS.transfer(addr);                     // Transmit the address register
    DAC80508_SPI_BUS.transfer16(data);                   // Transmit the data
    digitalWriteFast(csPin, HIGH);
    DAC80508_SPI_BUS.endTransaction();
}

uint16_t DAC80508::readDAC80508(uint8_t addr)   // Read data from DAC register
{
    DAC80508_SPI_BUS.beginTransaction(DAC80508_SPI_Settings);    // Configure the DAC80508_SPI_BUS controller for transmission
    
    // Transmit data read back request
    digitalWriteFast(csPin, LOW);
    DAC80508_SPI_BUS.transfer((1 << 7) | addr);         // Transmit the address register
    DAC80508_SPI_BUS.transfer16(0);                     // Transmit the data
    digitalWriteFast(csPin, HIGH);

    // Echo read back request and receive data
    digitalWriteFast(csPin, LOW);
    DAC80508_SPI_BUS.transfer((1 << 7) | addr);         // Transmit the address register
    uint16_t data = DAC80508_SPI_BUS.transfer16(0);      // Transmit the data
    digitalWriteFast(csPin, HIGH);

    DAC80508_SPI_BUS.endTransaction();   // Release the DAC80508_SPI_BUS Controller
    return data;                // Return read back data
}


/*
    Write Operation Functions
*/
void DAC80508::NOP()    // Write NOP to DAC
{
    writeDAC80508(NOP_ADDR, 0x0000);
}

void DAC80508::setSync()    // Write contents of SYNC register
{
    // uint16_t data = (syncEnDAC0 | (syncEnDAC1 << 1) | (syncEnDAC2 << 2) | (syncEnDAC3 << 3) | (syncEnDAC4 << 4) | (syncEnDAC5 << 5) | (syncEnDAC6 << 6) | (syncEnDAC7 << 7) | (broadcastEnDAC0 << 8) | (broadcastEnDAC1 << 9) | (broadcastEnDAC2 << 10) | (broadcastEnDAC3 << 11) | (broadcastEnDAC4 << 12) | (broadcastEnDAC5 << 13) | (broadcastEnDAC6 << 14) | (broadcastEnDAC7 << 15));
    uint16_t data = 0xff00;
    writeDAC80508(SYNC_ADDR, data);
}

void DAC80508::setConfig()  // Write contents of CONFIG register
{
    // uint16_t data = (pwrdnDAC0 | (pwrdnDAC1 << 1) | (pwrdnDAC2 << 2) | (pwrdnDAC3 << 3) | (pwrdnDAC4 << 4) | (pwrdnDAC5 << 5) | (pwrdnDAC6 << 6) | (pwrdnDAC7 << 7) | (pwrdnRef << 8) | (DSDO << 9) | (FSDO << 10) | (CRCEn << 11) | (alarmEn << 12) | (alarmSel << 13));
    uint16_t data = 0x0000;
    writeDAC80508(CONFIG_ADDR, data);
}

void DAC80508::setGain()    // Write contents of GAIN register
{
    // uint16_t data = (buff0Gain | (buff1Gain << 1) | (buff2Gain << 2) | (buff3Gain << 3) | (buff4Gain << 4) | (buff5Gain << 5) | (buff6Gain << 6) | (buff7Gain << 7) | (refDivEn << 8));
    uint16_t data = 0x0000;
    writeDAC80508(GAIN_ADDR, data);
}

void DAC80508::setTrigger(bool reset) // Write contents of TRIGGER register
{
    uint16_t data = (LDAC_DIG << 4);

    if (reset)
    {
        data = (0b1010 | data);
    }

    writeDAC80508(TRIGGER_ADDR, data);    
}

void DAC80508::setBroadcast(uint16_t data)   // Write DAC code BRDCAST register
{
    writeDAC80508(BRDCAST_ADDR, data);
}

void DAC80508::setDAC0(uint16_t data)   // Write DAC code to DAC0
{
    writeDAC80508(DAC0_ADDR, data);
}

void DAC80508::setDAC1(uint16_t data)   // Write DAC code to DAC1
{
    writeDAC80508(DAC1_ADDR, data);
}

void DAC80508::setDAC2(uint16_t data)   // Write DAC code to DAC2
{
    writeDAC80508(DAC2_ADDR, data);
}

void DAC80508::setDAC3(uint16_t data)   // Write DAC code to DAC3
{
    writeDAC80508(DAC3_ADDR, data);
}

void DAC80508::setDAC4(uint16_t data)   // Write DAC code to DAC4
{
    writeDAC80508(DAC4_ADDR, data);
}

void DAC80508::setDAC5(uint16_t data)   // Write DAC code to DAC5
{
    writeDAC80508(DAC5_ADDR, data);
}

void DAC80508::setDAC6(uint16_t data)   // Write DAC code to DAC6
{
    writeDAC80508(DAC6_ADDR, data);
}

void DAC80508::setDAC7(uint16_t data)   // Write DAC code to DAC7
{
    writeDAC80508(DAC7_ADDR, data);
}


/*
    Read Operation Functions
*/
uint16_t DAC80508::getID()// Read contents of DEVICE_ID register
{
    return readDAC80508(DEVICE_ID_ADDR);
}

uint16_t DAC80508::getSync()// Read contents of SYNC register
{
    return readDAC80508(SYNC_ADDR);
}

uint16_t DAC80508::getConfig()// Read contents of CONFIG register
{
    return readDAC80508(CONFIG_ADDR);
}

uint16_t DAC80508::getGain()// Read contents of GAIN register
{
    return readDAC80508(GAIN_ADDR);
}

uint16_t DAC80508::getBroadcast()// Read contents of BRDCAST register
{
    return readDAC80508(BRDCAST_ADDR);
}

bool DAC80508::getStatus()  // Read contents of STATUS register
{
    return readDAC80508(STATUS_ADDR);
}

uint16_t DAC80508::getDAC0()    // Read contents of DAC0 register
{
    return readDAC80508(DAC0_ADDR);
}

uint16_t DAC80508::getDAC1()    // Read contents of DAC1 register
{
    return readDAC80508(DAC1_ADDR);
}

uint16_t DAC80508::getDAC2()    // Read contents of DAC2 register
{
    return readDAC80508(DAC2_ADDR);
}

uint16_t DAC80508::getDAC3()    // Read contents of DAC3 register
{
    return readDAC80508(DAC3_ADDR);
}

uint16_t DAC80508::getDAC4()    // Read contents of DAC4 register
{
    return readDAC80508(DAC4_ADDR);
}

uint16_t DAC80508::getDAC5()    // Read contents of DAC5 register
{
    return readDAC80508(DAC5_ADDR);
}

uint16_t DAC80508::getDAC6()    // Read contents of DAC6 register
{
    return readDAC80508(DAC6_ADDR);
}

uint16_t DAC80508::getDAC7()    // Read contents of DAC7 register
{
    return readDAC80508(DAC7_ADDR);
}


/*
    Utility Functions
*/
uint16_t DAC80508::voltageToCode(float voltage, uint8_t DAC)    // Convert decimal voltage to binary DAC code
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
        case DAC4_ADDR:
            gain = buff3Gain;
            break;
        case DAC5_ADDR:
            gain = buff3Gain;
            break;
        case DAC6_ADDR:
            gain = buff3Gain;
            break;
        case DAC7_ADDR:
            gain = buff3Gain;
            break;
        
        default:
            break;
    }

    uint16_t code = voltage / (Vref / (refDivEn + 1) * (gain + 1) / pow(2, numBits));

    return code;
}

float DAC80508::codeToVoltage(uint16_t code, uint8_t DAC) // Convert binary dac code to decimal voltage
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

// uint8_t DAC80508::CRC() // Calculate CRC parity code
// {

// }