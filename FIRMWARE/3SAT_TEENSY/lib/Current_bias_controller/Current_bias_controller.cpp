// Project: Current bias controller Library (Controller for Expander & Digital potentiometer)
// Authors: Ying-Tuan Hsu
#include "Current_bias_controller.h"
/*
    Constructor Function
*/
Current_bias_controller::Current_bias_controller()  // Initialize Digital potentiometer object
{
    
}
void Current_bias_controller::setup()
{
    expander.setup();
    // SPI_digital_potentiometer.setup(expander);
}
bool Current_bias_controller::check_expander()
{
    expander.Hard_reset();
    expander.soft_reset();
    
    expander.writePCA9671_1(0xff, 0xff);
    expander.writePCA9671_1(0xff, 0xff);
    expander.writePCA9671_1(0xff, 0xff);
    uint8_t data1=0, data2=0;
    expander.readPCA9671_0(data1, data2);
    if (data1!=0xff && data2!=0xff)
    {
        SerialUSB.println("Expander 0 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    expander.readPCA9671_1(data1, data2);
    if (data1!=0xff && data2!=0x0)
    {
        SerialUSB.println("Expander 1 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    expander.readPCA9671_2(data1, data2);
    if (data1!=0xfe && data2!=0x03)
    {
        SerialUSB.println("Expander 2 is incorrect.(Probably some outputs are shorted to ground.)");
        return false;
    }
    SerialUSB.println("All Expanders operates correctly.");
    return true;
}
bool Current_bias_controller::set_current_bias(uint8_t die_number, uint8_t component, uint16_t current_value)
{
    /*
    arguement settings
    die_number: 1 or 2
    component: only use the defined values in the header file
    current_value: 0~1023
    */
   //checking the arguments
    if (die_number!=1 && die_number!=2)
    {
        SerialUSB.println("Invalid die number.");
        return false;
    }
    if (current_value>1023)
    {
        SerialUSB.println("Invalid current value.");
        return false;
    }
    //setting the CS pin for the componet
    if(set_CS(die_number, component)==false)
    {
        return false;
    }
    //setting the current value
    if(set_current_value(die_number, component, current_value)==false)
    {
        return false;
    }
    //Reset the CS pin
    if(set_all_CS_to_high()==false)
    {
        return false;
    }
    return true;
}
bool Current_bias_controller::reset_current_bias(uint8_t die_number, uint8_t component)
{
    /*
    arguement settings
    die_number: 1 or 2
    component: only use the defined values in the header file
    current_value: 0~1023
    */
   //checking the arguments
    if (die_number!=1 && die_number!=2)
    {
        SerialUSB.println("Invalid die number.");
        return false;
    }
    //setting the CS pin for the componet
    if(set_CS(die_number, component)==false)
    {
        return false;
    }
    //Reset to the defalut value of that is stoed in the last 50-TP memory
    if(reset_current_value(die_number, component)==false)
    {
        return false;
    }
    //Reset the CS pin
    if(set_all_CS_to_high()==false)
    {
        return false;
    }
    return true;
}
//Sub functions
bool Current_bias_controller::set_CS(uint8_t die_number, uint8_t component)
{
    if (die_number==1)
    {
        //setting the CS pin for the componet
        uint8_t data1=0, data2=0;
        expander.readPCA9671_0(data1, data2);       // preserving the first 8 bits of the register
        expander.writePCA9671_0(data1, component);
        // expander.readPCA9671_0(data1, data2);
        // if (data2!=component)
        // {
        //     SerialUSB.println("CS pin in DIE1 ("+String(component)+") setting failed.");
        //     return false;
        // }
        return true;
    }
    if (die_number ==2)
    {
        //setting the CS pin for the componet
        uint8_t data1=0, data2=0;
        expander.writePCA9671_1(component, 0x00);
        // expander.readPCA9671_1(data1, data2);
        // if (data1!=component)
        // {
        //     SerialUSB.println("CS pin in DIE2 ("+String(component)+") setting failed.");
        //     return false;
        // }
        return true;
    }
    return false;
}
bool Current_bias_controller::set_current_value(uint8_t die_number,uint8_t component, uint16_t current_value)
{
    if (die_number==1)
    {
        //setting the current value
        SPI_digital_potentiometer.writeRDAC(die_number, component, current_value);
        uint16_t RDAC_data = SPI_digital_potentiometer.readRDAC(die_number,component);
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
        SPI_digital_potentiometer.writeRDAC(die_number,component,current_value);
        uint16_t RDAC_data = SPI_digital_potentiometer.readRDAC(die_number,component);
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
bool Current_bias_controller::set_all_CS_to_high()
{
    uint8_t data1=0, data2=0;
    expander.readPCA9671_0(data1, data2);       // preserving the first 8 bits of the register
    expander.writePCA9671_0(data1, byte(0xff));
    // expander.readPCA9671_0(data1, data2);
    // if (data2!=byte(0xff))
    // {
    //     SerialUSB.println("DIE1 CS pin reset to 1 failed.");
    //     return false;
    // }
    expander.writePCA9671_1(byte(0xff), byte(0x00));
    // expander.readPCA9671_1(data1, data2);
    // if (data1!=byte(0xff))
    // {
    //     SerialUSB.println("DIE2 CS pin reset to 1 failed.");
    //     return false;
    // }
    return true;
}
bool Current_bias_controller::reset_current_value(uint8_t die_number, uint8_t component)
{
    if (die_number==1)
    {
        //setting the current value
        SPI_digital_potentiometer.reset_RDAC_to_last_50_TP(die_number, component);
        SerialUSB.println("Digital potentiometer reset in DIE1 ("+String(component)+") finished.");
        return true;
    }
    if (die_number ==2)
    {
        //setting the current value
        SPI_digital_potentiometer.reset_RDAC_to_last_50_TP(die_number, component);
        SerialUSB.println("Digital potentiometer reset in DIE2 ("+String(component)+") finished.");
        return true;
    }
    return false;
}