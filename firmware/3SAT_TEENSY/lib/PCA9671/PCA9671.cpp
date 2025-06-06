// Project: PCA9671 Library (Digital potentiometer)
// Authors: Ying-Tuan Hsu
#include "PCA9671.h"
/*
    Constructor Function
*/
PCA9671::PCA9671()  // Initialize Digital potentiometer object
{
    
}


// Setup function
void PCA9671::setup()
{
    // Set PCA9671 reset pin
    pinMode(PCA9671_reset_PIN, OUTPUT);
    
    // Set the floating pin for correcting the wrong wired PCB
    pinMode(18, INPUT_PULLUP);
    pinMode(19, INPUT_PULLUP);
    // pinMode(LDAC_PIN, OUTPUT);
    digitalWriteFast(PCA9671_reset_PIN, HIGH);
    // Setup I2C SDA and SCL pins
    Wire2.setClock(PCA9671_CLK); // Set the clock frequency of the I2C bus

    Wire2.begin();    // Initialize SPI bus
    check_expander();
    write_mux_enb(HIGH);
    write_mux_enb(LOW);
    write_mux_enb(HIGH);
    write_mux_sel(LOW);
    uint8_t data1=0, data2=0;
    readPCA9671(Register_address_2, data1, data2);
    SerialUSB.println("Expander 2 output is "+String(data1, HEX)+"  "+String(data2, HEX));
}
bool PCA9671::check_expander()
{
    Hard_reset();
    soft_reset();
    
    writePCA9671_0(0xff, 0xff);
    writePCA9671_1(0xff, 0xff);
    writePCA9671_2(0xff, 0xff);
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    if (data1!=0xff && data2!=0xff)
    {
        SerialUSB.println("Expander 0 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    readPCA9671_1(data1, data2);
    if (data1!=0xff && data2!=0x0)
    {
        SerialUSB.println("Expander 1 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    readPCA9671_2(data1, data2);
    if (data1!=0xfe && data2!=0x03)
    {
        SerialUSB.println("Expander 2 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    SerialUSB.println("All Expanders operates correctly.");
    return true;
}
// General register functions
bool PCA9671::writePCA9671(uint8_t address, uint8_t data1, uint8_t data2)
{
    Wire2.beginTransmission(address); // Begin transmission to the device with the address
    Wire2.write(data1);                // Write data to the device
    Wire2.write(data2);                // Write data to the device
    int error = Wire2.endTransmission();          // End transmission
    if (error != 0)
    {
        return false;
    }
    else 
    {
        return true;
    }
}
void PCA9671::readPCA9671(uint8_t address, uint8_t &data1, uint8_t &data2)
{
    Wire2.requestFrom(address,2); // Begin transmission to the device with the address
    data1 = Wire2.read();                     // Read data from the device
    data2 = Wire2.read();                     // Read data from the device
}

// Preset register functions
bool PCA9671::writePCA9671_0(uint8_t data1, uint8_t data2)
{
    Wire2.beginTransmission(Register_address_0); // Begin transmission to the device with the address
    Wire2.write(data1);                // Write data to the device
    Wire2.write(data2);                // Write data to the device
    int error = Wire2.endTransmission();          // End transmission
    if (error != 0)
    {
        return false;
    }
    else 
    {
        return true;
    }
}
void PCA9671::readPCA9671_0(uint8_t &data1, uint8_t &data2 )
{
    Wire2.requestFrom(Register_address_0,2); // Begin transmission to the device with the address
    data1 = Wire2.read();                     // Read data from the device
    data2 = Wire2.read();                     // Read data from the device
}

bool PCA9671::writePCA9671_1(uint8_t data1, uint8_t data2)
{
    Wire2.beginTransmission(Register_address_1); // Begin transmission to the device with the address
    Wire2.write(data1);                // Write data to the device
    Wire2.write(data2);                // Write data to the device
    int error = Wire2.endTransmission();          // End transmission
    if (error != 0)
    {
        return false;
    }
    else 
    {
        return true;
    }
}
void PCA9671::readPCA9671_1(uint8_t &data1, uint8_t &data2 )
{
    Wire2.requestFrom(Register_address_1,2); // Begin transmission to the device with the address
    data1 = Wire2.read();                     // Read data from the device
    data2 = Wire2.read();                     // Read data from the device
}

bool PCA9671::writePCA9671_2(uint8_t data1, uint8_t data2)
{
    Wire2.beginTransmission(Register_address_2); // Begin transmission to the device with the address
    Wire2.write(data1);                // Write data to the device
    Wire2.write(data2);                // Write data to the device
    int error = Wire2.endTransmission();          // End transmission
    if (error != 0)
    {
        return false;
    }
    else 
    {
        return true;
    }
}
void PCA9671::readPCA9671_2(uint8_t &data1, uint8_t &data2 )
{
    Wire2.requestFrom(Register_address_2,2); // Begin transmission to the device with the address
    data1 = Wire2.read();                     // Read data from the device
    data2 = Wire2.read();                     // Read data from the device

}

bool PCA9671::soft_reset()
{
    Wire2.beginTransmission(Reset_address); // Begin transmission to the device with the address
    Wire2.write(Reset_data);                // Write data to the device
    int error = Wire2.endTransmission();          // End transmission
    if (error != 0)
    {
        return false;
    }
    else 
    {
        return true;
    }
}
void PCA9671::Hard_reset()
{
    digitalWriteFast(PCA9671_reset_PIN, LOW);
    delayMicroseconds(delay_time);
    digitalWriteFast(PCA9671_reset_PIN, HIGH);
}

bool PCA9671::write_clkgen_osc(uint8_t OSC)
{
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    uint8_t temp_data= (data1 & 0xf8)+(OSC & 0b111);
    return writePCA9671_0(temp_data, data2);
}
bool PCA9671::write_clkgen_div(uint8_t DIV)
{
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    uint8_t temp_data= (data1 & 0x9f)+((DIV & 0b11)<<5);
    return writePCA9671_0(temp_data, data2);
}
bool PCA9671::write_bypass(bool High_or_Low)
{
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    uint8_t temp_data= 0;
    if (High_or_Low)
    {
        temp_data= (data1 & 0xf7)+0x08;
        return writePCA9671_0(temp_data, data2);
    }
    else
    {
        temp_data= (data1 & 0xf7);
        return writePCA9671_0(temp_data, data2);
    }
}
bool PCA9671::write_clkgen_reset(bool High_or_Low)
{
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    uint8_t temp_data= 0;
    if (High_or_Low)
    {
        temp_data= (data1 & 0x7f)+0x80;
        return writePCA9671_0(temp_data, data2);
    }
    else
    {
        temp_data= (data1 & 0x7f);
        return writePCA9671_0(temp_data, data2);
    }
}
bool PCA9671::write_chip_reset(bool High_or_Low)
{
    uint8_t data1=0, data2=0;
    readPCA9671_0(data1, data2);
    uint8_t temp_data= 0;
    if (High_or_Low)
    {
        temp_data= (data1 & 0xef)+0x10;
        return writePCA9671_0(temp_data, data2);
    }
    else
    {
        temp_data= (data1 & 0xef);
        return writePCA9671_0(temp_data, data2);
    }
}
 bool PCA9671::write_mux_enb(bool High_or_Low)
 {
    uint8_t data1=0, data2=0;
    readPCA9671(Register_address_2, data1, data2);
    uint8_t temp_data= 0;
    if (High_or_Low)
    {
        return writePCA9671(Register_address_2, data1, 0x02);
    }
    else
    {
        return writePCA9671(Register_address_2, data1, 0x00);
    }
    return false;
 }
bool PCA9671::write_mux_sel(bool One_or_Zero)
{
    uint8_t data1=0, data2=0;
    readPCA9671(Register_address_2, data1, data2);
    uint8_t temp_data= 0;
    if (One_or_Zero)
    {
        temp_data= (data1 & 0xdf)+0x20;
        return writePCA9671(Register_address_2, temp_data, data2);
    }
    else
    {
        temp_data= (data1 & 0xdf);
        return writePCA9671(Register_address_2, temp_data, data2);
    }
    return false;
}
// End of PCA9671 Library