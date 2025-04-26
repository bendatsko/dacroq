// Project: AD5270BRMZ Library (Digital potentiometer)
// Authors: Ying-Tuan Hsu
#include "AD5270BRMZ.h"
/*
    Constructor Function
*/
AD5270BRMZ::AD5270BRMZ()  // Initialize Digital potentiometer object
{;
    
}


// Setup function
void AD5270BRMZ::setup(PCA9671 expander_input)
{
    // Setup CS pins
    // spi_cs_dp_pin = dp_pin;
    // pinMode(spi_cs_dp_pin, OUTPUT);
    // pinMode(LDAC_PIN, OUTPUT);
    // digitalWriteFast(spi_cs_dp_pin, HIGH);
    // digitalWriteFast(LDAC_PIN, HIGH);
    expander = expander_input;
    SPI1.setMISO(1);
    SPI1.setMOSI(26);
    // pinMode(1, INPUT_PULLUP);
    SPI1.setSCK(27);
    SPI1.begin();    // Initialize SPI1 bus
}
// Communication Functions
void AD5270BRMZ::writeAD5270BRMZ_high_impedance(uint8_t die_number, uint8_t component)   // Write data to DAC register
{
    SPI1.beginTransaction(AD5270BRMZ_SPI_Settings);      // Configure the SPI1 controller for transmission

    set_CS(die_number, component);
  
    SPI1.transfer16(0x8001);                 // Transmit the data

    set_all_CS_to_high();

    SPI1.endTransaction();

    SPI1.beginTransaction(AD5270BRMZ_SPI_Settings);      // Configure the SPI1 controller for transmission

    set_CS(die_number, component);
  
    SPI1.transfer16(0x0000);                 // Transmit the data

    set_all_CS_to_high();

    SPI1.endTransaction();
    // SerialUSB.println("write AD5270BRMZ succeeds.");
}
void AD5270BRMZ::writeAD5270BRMZ_data(uint8_t die_number, uint8_t component, uint16_t data)   // Write data to DAC register
{
    SPI1.beginTransaction(AD5270BRMZ_SPI_Settings);      // Configure the SPI1 controller for transmission

    set_CS(die_number, component);
  
    SPI1.transfer16(data);                 // Transmit the data

    set_all_CS_to_high();

    SPI1.endTransaction();

    // SerialUSB.println("write AD5270BRMZ succeeds.");
}
void AD5270BRMZ::writeAD5270BRMZ(uint8_t die_number, uint8_t component, uint8_t command, uint16_t data)   // Write data to DAC register
{
    // SerialUSB.println("Start AD5270BRMZ succeeds.");
    // expander.readPCA9671_0(data1, data2);
    // SerialUSB.println("\nData1: " + String(data1) + "   Data2: " + String(data2));
    SPI1.beginTransaction(AD5270BRMZ_SPI_Settings);      // Configure the SPI1 controller for transmission

    // digitalWriteFast(spi_cs_dp_pin, LOW);              // Set the chip select low
    // set_CS(die_number, component);
    set_CS(die_number, component);
    // set_CS_all(die_number, component);
     delayMicroseconds(10);
    // expander.readPCA9671_0(data1, data2);
    // SerialUSB.println("\nData1: " + String(data1) + "   Data2: " + String(data2));
    SPI1.transfer16((command<<10)|data);                 // Transmit the data

    set_all_CS_to_high();
    // delayMicroseconds(10); 
    // expander.readPCA9671_0(data1, data2);
    // SerialUSB.println("\nData1: " + String(data1) + "   Data2: " + String(data2));
    // digitalWriteFast(spi_cs_dp_pin, HIGH);
    

    SPI1.endTransaction();
    // SerialUSB.println("write AD5270BRMZ succeeds.");
}

uint16_t AD5270BRMZ::readAD5270BRMZ(uint8_t die_number, uint8_t component, uint8_t command, uint16_t data)   // Read data from DAC register
{
    // SerialUSB.println("Start read AD5270BRMZ succeeds.");
    SPI1.beginTransaction(AD5270BRMZ_SPI_Settings);    // Configure the SPI1 controller for transmission
    
    // Transmit data read back request
    // digitalWriteFast(spi_cs_dp_pin, LOW);            // Set the chip select low
    // set_CS(die_number, component);
    set_CS(die_number, component);
     delayMicroseconds(10);
    SPI1.transfer16((command<<10)|data);               // Transmit the data
    // SerialUSB.println("\ncommand<<10: " + String((command<<10)|data));
    
    set_all_CS_to_high();
    // digitalWriteFast(spi_cs_dp_pin, HIGH);
    
     delayMicroseconds(10);

    // Echo read back request and receive data
    // digitalWriteFast(spi_cs_dp_pin, LOW);  // Set the chip select low
    // set_CS(die_number, component);
    set_CS(die_number, component);
    // delayMicroseconds(10);
    uint16_t data_received = SPI1.transfer16(0x0000);      // Transmit the data
    set_all_CS_to_high();
    // delayMicroseconds(10);
    // digitalWriteFast(spi_cs_dp_pin, HIGH); // Set the chip select high

    SPI1.endTransaction();               // Release the SPI1 Controller
    // SerialUSB.println("Read AD5270BRMZ succeeds.");
    return data_received;                        // Return read back data
}

// control register functions

void AD5270BRMZ::write_control_register(uint8_t die_number,uint8_t component, uint16_t data)   // Write to control register
{
    writeAD5270BRMZ(die_number, component, command7, data);
}
uint16_t AD5270BRMZ::read_control_register(uint8_t die_number,uint8_t component)               // Read control register
{
    uint16_t data = readAD5270BRMZ(die_number, component,command8, command8_data);
    return data;
}
// RDAC operation functions
void AD5270BRMZ::writeRDAC(uint8_t die_number,uint8_t component,uint16_t data)    // Write data to DAC register
{   
    /*argument requirements:
    data: 0~1023
    */

    // SerialUSB.println("Start write RDAC succeeds.");
    
    
    write_control_register(die_number, component, (control_bits|Constant_RDAC_write));

    control_bits = (control_bits|Constant_RDAC_write);
    writeAD5270BRMZ(die_number,component, command1, data);
    // SerialUSB.println("write RDAC succeeds.");
}
uint16_t AD5270BRMZ::readRDAC(uint8_t die_number,uint8_t component)                            // Read data from DAC register
{
    // SerialUSB.println("Start READ RDAC succeeds.");
    uint16_t data = readAD5270BRMZ(die_number, component, command2, command2_data);
    // SerialUSB.println("READ RDAC succeeds.");
    return data;
}
// 50-TP operation functions
void AD5270BRMZ::push_to_50_TP(uint8_t die_number,uint8_t component)                           // Push RDAC to 50-TP memory
{
    write_control_register(die_number,component, (control_bits|Constant_50TP_program));
    control_bits = (control_bits|Constant_50TP_program);
    writeAD5270BRMZ(die_number,component, command3, command3_data);
    uint16_t delay = 500;   // Wait for approximate 350ms for 50-TP memory to be written ==> I let it have 20ms more for safety
    wait(delay);   // Wait for approximate 350ms for 50-TP memory to be written ==> I let it have 20ms more for safety
    wait(delay);
    wait(delay);
    wait(delay);
    wait(delay);
    wait(delay);
}
uint16_t AD5270BRMZ::read_50_TP_last_position(uint8_t die_number,uint8_t component)                // Read last position of 50-TP memory
{
    uint16_t data = readAD5270BRMZ(die_number, component, command6, command6_data);
    return data;
}   
uint16_t AD5270BRMZ::read_50_TP_value(uint8_t die_number,uint8_t component, uint16_t addr)           // Read value of 50-TP memory
{
    uint16_t data = readAD5270BRMZ(die_number, component, command5, addr);
    return data;
}
void AD5270BRMZ::reset_RDAC_to_last_50_TP(uint8_t die_number,uint8_t component)                // Reset RDAC to last 50-TP memory
{
    writeAD5270BRMZ(die_number, component, command4, command4_data);
}
// Other functions
void AD5270BRMZ::wait(uint16_t time)                     // Wait for a number of cycles 
{
    delayMicroseconds(time);
}
void AD5270BRMZ::NOP(uint8_t die_number,uint8_t component)                                     // NOP
{
    writeAD5270BRMZ(die_number,component,command0, command0_data);              // Write 0 to the DAC register
}
void AD5270BRMZ::shut_down_enable(uint8_t die_number,uint8_t component)                        // Shut down enable
{
    writeAD5270BRMZ(die_number,component, command9, command9_enable);
}
void AD5270BRMZ::shut_down_disable(uint8_t die_number,uint8_t component)                       // Shut down disable
{
    writeAD5270BRMZ(die_number, component,command9, command9_disable);
}

bool AD5270BRMZ::set_CS(uint8_t die_number, uint8_t component)
{
    if (die_number==1)
    {
        //setting the CS pin for the componet
        uint8_t data1=0, data2=0;
        expander.readPCA9671_0(data1, data2);       // preserving the first 8 bits of the register
        expander.writePCA9671_0(data1, component);
        expander.readPCA9671_0(data1, data2);
        if (data2!=component)
        {
            SerialUSB.println("CS pin in DIE1 ("+String(component)+") setting failed.");
            return false;
        }
        return true;
    }
    if (die_number ==2)
    {
        //setting the CS pin for the componet
        uint8_t data1=0, data2=0;
        expander.writePCA9671_1(component, 0x00);
        expander.readPCA9671_1(data1, data2);
        if (data1!=component)
        {
            SerialUSB.println("CS pin in DIE2 ("+String(component)+") setting failed.");
            return false;
        }
        return true;
    }
    return false;
}
bool AD5270BRMZ::set_CS_all(uint8_t die_number, uint8_t component)
{
    expander.writePCA9671_0(0x00, 0x00);
    expander.writePCA9671_1(0x00, 0x00);
    expander.writePCA9671_2(0x00, 0x00);
   
    return true;
}
bool AD5270BRMZ::set_all_CS_to_high()
{
    uint8_t data1=0, data2=0;
    expander.readPCA9671_0(data1, data2);       // preserving the first 8 bits of the register
    expander.writePCA9671_0(data1, byte(0xff));
    expander.readPCA9671_0(data1, data2);
    if (data2!=byte(0xff))
    {
        SerialUSB.println("DIE1 CS pin reset to 1 failed.");
        return false;
    }
    expander.writePCA9671_1(byte(0xff), byte(0x00));
    expander.readPCA9671_1(data1, data2);
    if (data1!=byte(0xff))
    {
        SerialUSB.println("DIE2 CS pin reset to 1 failed.");
        return false;
    }
    return true;
}
bool AD5270BRMZ::set_current_value(uint8_t die_number,uint8_t component, uint16_t current_value)
{
    if (die_number==1)
    {
        //setting the current value
        writeRDAC(die_number,component,current_value);
        uint16_t RDAC_data = readRDAC(die_number, component);
        if (RDAC_data!=current_value)
        {
            SerialUSB.println("Digital potentiometer in DIE1 ("+String(component)+") setting failed.");
            SerialUSB.println("The code it should be : "+String(current_value)+"");
            SerialUSB.println("The recieved code: "+String(component)+"");
            return false;
        }
        SerialUSB.println("Digital potentiometer in DIE1 ("+String(component)+") setting succeeds.");
        return true;
    }
    if (die_number ==2)
    {
        //setting the current value
        writeRDAC(die_number,component,current_value);
        uint16_t RDAC_data = readRDAC( die_number, component);
        if (RDAC_data!=current_value)
        {
            SerialUSB.println("Digital potentiometer in DIE2 ("+String(component)+") setting failed.");
            return false;
        }
        SerialUSB.println("Digital potentiometer in DIE2 ("+String(component)+") setting succeeds.");
        return true;
    }
    return false;
}

// aa=analogRead(19);
