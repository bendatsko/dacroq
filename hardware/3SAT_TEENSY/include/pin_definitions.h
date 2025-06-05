// Project: DAEDALUS Teensy Test Bench
// Authors: Luke Wormald, Ying-Tuan, and Vangelis

#ifndef PIN_DEFINITIONS_H
    #define PIN_DEFINITIONS_H
    // High impedance
    #define HIGH_IMPEDANCE1    18
    #define HIGH_IMPEDANCE2    19
    // System
    #define SYS_PAUSE_DIE1      31
    #define SYS_PAUSE_DIE2      30
    #define SYS_TERM_DIE2       29
    #define SYS_TERM_DIE1       28
    // Temperature
    #define TEMP_PIN            A17
    #define TEMP_TX_PIN         8   
    #define TEMP_RX_PIN         7
    //　Scan chain (OUT--> out of the chip, read for teensy)
    #define SCAN_CLK_IN   6
    #define SCAN_CLK_OUT  34
    #define SCAN_IN0      10
    #define SCAN_IN1      9
    #define SCAN_IN2      32

    #define SCAN_OUT0     35
    #define SCAN_OUT1     36
    #define SCAN_OUT2     37

    #define SCAN_WRITE_EN_DIE1   16
    #define SCAN_WRITE_EN_DIE2   17
    // TIA
    #define TIA_OUT_D1_PIN         A6
    #define TIA_OUT_D2_PIN         A7

    // Define SPI pins
    #define DIE_SPI_MODE0_DIE1_PIN  39
    #define DIE_SPI_MODE1_DIE1_PIN  38     

    #define DIE_SPI_MODE0_DIE2_PIN  14
    #define DIE_SPI_MODE1_DIE2_PIN  15     

    #define DIE_SPI_CLK_PIN       13  
    #define DIE_SPI_SDO           12
    #define DIE_SPI_SDI           11
    
    #define MOSI_PIN              26
    #define MISO_PIN              1
    #define SCK_PIN               27

    #define DIE_SPI_CS_DIE1_PIN   4
    #define DIE_SPI_CS_DIE2_PIN   33  
      
    // Define I2C pins
    #define I2C_SDA_PIN           25
    #define I2C_SCL_PIN           24
    #define PCA9671_reset_PIN     3


#endif
