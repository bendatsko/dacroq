// Project: MEDUSA Teensy Test Bench
// Authors: Luke Wormald

#include "MEDUSA.h"

// Adruino file system functions
#ifdef ARDUINO_PLATFORM
    // Setup SD card
    void setupFileSystem()
    {
        SerialUSB.print("\nInitializing SD card...");

        // see if the card is present and can be initialized:
        if (!SD.begin(BUILTIN_SDCARD)) 
        {
            SerialUSB.println("Card failed, or not present");
            while (1) 
            {
                // No SD card, so don't do anything more - stay stuck here
            }
        }
        SerialUSB.println(" card initialized.");
    }

    // SD card read/write functions
    void readCNF(String filename, int16_t (&data)[CNF_MAX_CLS][CNF_MAX_K+1], uint8_t &numVar, uint16_t &numCls)  // Read uint32 binary file
    {
        uint8_t strLen = filename.length() + 1;
        char filenameChar[strLen];
        filename.toCharArray(filenameChar, strLen);

        File bin = SD.open(filenameChar, FILE_READ); 
        
        if (bin)
        {
            // Read data length
            uint32_t dataLen = bin.size() / 2;    

            // Initialize array indexing variables
            uint16_t clsIdx = 0;    // Clause index
            uint8_t varIdx = 0;     // Variable index

            // Read all data from file
            for (uint32_t i = 0; i < dataLen; i++)
            {
                // Union to read 2 bytes as uint16_t
                union 
                {
                    int16_t value;
                    byte bytes[2];
                } fmt; 

                // Read 2 bytes from file
                bin.read(fmt.bytes, 2);

                if (i == 0) // Check if first value
                {
                    numVar = fmt.value; // Read number of variables
                }
                else if (i == 1)    // Check if second value
                {
                    numCls = fmt.value; // Read number of clauses
                }
                else if (fmt.value == 0) // Check if end of clause (0 termination)
                {
                    clsIdx++;   // Increment clause index
                    varIdx = 0; // Reset variable index
                }
                else
                {
                    // Write data to array
                    data[clsIdx][varIdx] = fmt.value;
                    varIdx++; // Increment variable index
                }
            }
        }
        else
        {
            // Print error message
            SerialUSB.println("Error: File " + String(filename) + " not found.");
        }

        bin.close();
    }

    void writeResults(String filename, uint32_t *data, uint32_t datalen)    // Write uint32 binary file
    {
        uint8_t strLen = filename.length() + 1;
        char filenameChar[strLen];
        filename.toCharArray(filenameChar, strLen);

        File bin = SD.open(filenameChar, FILE_WRITE); 

        uint8_t cnt = 0;
        while (!bin)
        {
            bin.close();
            bin = SD.open(filenameChar, FILE_WRITE);
            delay(50);

            if (cnt == 255)
            {
                // Print error message
                SerialUSB.println("Error creating " + String(filenameChar));

                break;
            }
            cnt++;
        }

        for (uint32_t i = 0; i < datalen; i++)
        {
            union 
            {
                uint32_t word;
                byte bytes[4];
            } fmt; 

            fmt.word = data[i];

            bin.write(fmt.bytes, 4);
        }

        bin.close();
    }

    // Misc file system functions
    void deleteFile(String filename)    // Delete file from SD card
    {
        uint8_t strLen = filename.length() + 1;
        char filenameChar[strLen];
        filename.toCharArray(filenameChar, strLen);

        if (SD.exists(filenameChar))
        {
            SD.remove(filenameChar);
        } 
    }
#endif



MEDUSA::MEDUSA() 
    : DAC(DAC_CS),
      digipot0(DP0_CS),
      digipot1(DP1_CS),
      digipot2(DP2_CS)
{
    // Constructor
}

void MEDUSA::setup() 
{
    // Initialization peripherals
    DAC.setup();  // Initialize DAC
    
    digipot0.setup();  // Initialize digital potentiometer 1
    digipot1.setup();  // Initialize digital potentiometer 2
    digipot2.setup();  // Initialize digital potentiometer 3

    setVDD(VDD);    // Set VDD
    setVCM(VCM);    // Set VCM
    setVREF(VREF);  // Set VREF
    setVESD(VESD);  // Set VESD

    setI_TIA(I_TIA);        // Set I_TIA
    setI_BLD_N(I_BLD_N);    // Set I_BLD_N
    setI_BREAK(I_BREAK);    // Set I_BREAK
    setI_MAKE(I_MAKE);      // Set I_MAKE
    setI_BLD_P(I_BLD_P);    // Set I_BLD_P
    setI_CMP(I_CMP);        // Set I_CMP

    // Initialization when using Teensy
    #ifdef ARDUINO_PLATFORM
        // Initialize Configuration Pins
        pinModeExt(RSTN, OUTPUT, 5);            // Set reset pin to output
        pinMode(FETCH_DONE, INPUT);             // Set fetch done pin to input
        pinMode(FETCH_EN, OUTPUT);              // Set fetch enable pin to output
        pinMode(CLK_GEN_OSC0, OUTPUT);          // Set clock generator oscillator 0 pin to output
        pinMode(CLK_GEN_OSC1, OUTPUT);          // Set clock generator oscillator 1 pin to output
        pinMode(CLK_GEN_OSC2, OUTPUT);          // Set clock generator oscillator 2 pin to output
        pinMode(CLK_GEN_DIV0, OUTPUT);          // Set clock generator divider 0 pin to output
        pinMode(CLK_GEN_DIV1, OUTPUT);          // Set clock generator divider 1 pin to output
        pinMode(CLK_GEN_BYPASS, OUTPUT);        // Set clock generator bypass pin to output
        pinModeExt(CLK_GEN_RSTN, OUTPUT, 5);    // Set clock generator reset pin to output

        digitalWriteFast(RSTN, LOW);            // Set reset pin to low
        digitalWriteFast(FETCH_EN, LOW);        // Set fetch enable pin to low
        digitalWriteFast(CLK_GEN_RSTN, LOW);    // Set clock generator reset pin to low
        digitalWriteFast(CLK_GEN_BYPASS, LOW);  // Set clock generator bypass pin to low
        digitalWriteFast(CLK_GEN_OSC0, LOW);    // Set clock generator oscillator 0 pin to low
        digitalWriteFast(CLK_GEN_OSC1, LOW);    // Set clock generator oscillator 1 pin to low
        digitalWriteFast(CLK_GEN_OSC2, LOW);    // Set clock generator oscillator 2 pin to low
        digitalWriteFast(CLK_GEN_DIV0, LOW);    // Set clock generator divider 0 pin to low
        digitalWriteFast(CLK_GEN_DIV1, LOW);    // Set clock generator divider 1 pin to low

        // Setup chip clock
        setClock(); // Set clock from defined values

        // Initialize SPI bus and chip SPI controller
        MEDUSA_SPI_BUS.begin();         // Initialize SPI bus
        pinModeExt(csPin, OUTPUT, 5);   // Set chip select pin to output
        digitalWriteFast(csPin, HIGH);  // Set chip select pin to high
        writeConfigReg(W_REG1, 31);     // Setup dummy cycle between write and read
        writeConfigReg(W_REG0, 0x00);   // Set to single SPI mode   

        setupFileSystem();  // Setup file system
    #endif
    
}

// Initialization functions when using Teensy
#ifdef ARDUINO_PLATFORM

    void MEDUSA::setClock() 
    {
        digitalWriteFast(RSTN, LOW);            // Set reset pin to low
        digitalWriteFast(FETCH_EN, LOW);        // Set fetch enable pin to low
        digitalWriteFast(CLK_GEN_RSTN, LOW);    // Set clock generator reset pin to low

        delay(1);   // Wait for 1 ms

        digitalWriteFast(CLK_GEN_BYPASS, MEDUSA_EXT_CLK);       // Set clock generator bypass pin
        digitalWriteFast(CLK_GEN_OSC0, MEDUSA_FREQ & 0b001);    // Set clock generator oscillator 0 pin
        digitalWriteFast(CLK_GEN_OSC1, MEDUSA_FREQ & 0b010);    // Set clock generator oscillator 1 pin
        digitalWriteFast(CLK_GEN_OSC2, MEDUSA_FREQ & 0b100);    // Set clock generator oscillator 2 pin
        digitalWriteFast(CLK_GEN_DIV0, MEDUSA_FREQ_DIV & 0b01); // Set clock generator divider 0 pin
        digitalWriteFast(CLK_GEN_DIV1, MEDUSA_FREQ_DIV & 0b10); // Set clock generator divider 1 pin 

        delay(1);   // Wait for 1 ms

        digitalWriteFast(CLK_GEN_RSTN, HIGH);   // Set clock generator reset pin to high
        digitalWriteFast(RSTN, HIGH);           // Set reset pin to high
    }

    void MEDUSA::reset() 
    {
        // Reset MEDUSA
        digitalWriteFast(RSTN, LOW);  // Set reset pin to low
        delay(1);                     // Wait for 1 ms
        digitalWriteFast(RSTN, HIGH); // Set reset pin to high
    }

    void MEDUSA::writeConfigReg(uint8_t cmd, uint8_t data) // Write data to SPI configuration register
    {
        // Configure the SPI controller for transmission
        SPI.beginTransaction(MEDUSA_SPI_Settings); 
        
        digitalWriteFast(csPin, LOW);   // Set the chip select low
        SPI.transfer(cmd);              // Transmit the command register
        SPI.transfer(data);             // Transmit the data
        digitalWriteFast(csPin, HIGH);  // Set the chip select high
        SPI.endTransaction();           // Release the SPI Controller
    }

#endif

// HAL memory functions
void MEDUSA::writeReg(uint32_t address, uint32_t data) // Write to register
{
    // Begin SPI transaction with appropriate settings
    MEDUSA_SPI_BUS.beginTransaction(MEDUSA_SPI_Settings);   

    digitalWriteFast(csPin, LOW);       // Set chip select pin to low
    SPI.transfer(WRITE);                // Transmit the command register
    MEDUSA_SPI_BUS.transfer32(address); // Transmit register address
    MEDUSA_SPI_BUS.transfer32(data);    // Transmit data
    digitalWriteFast(csPin, HIGH);      // Set chip select pin to high
    MEDUSA_SPI_BUS.endTransaction();    // End SPI transaction
}

uint32_t MEDUSA::readReg(uint32_t address)  // Read from register
{
    // Initialize transmission buffer
    uint8_t buffer[13] = {0};
    buffer[0] = READ;

    // Initialize return buffer
    uint8_t bufferOut[13] = {0};

    // Load address into the transmission buffer
    buffer[1] = (address & 0xFF000000) >> 24;
    buffer[2] = (address & 0x00FF0000) >> 16;
    buffer[3] = (address & 0x0000FF00) >> 8;
    buffer[4] = (address & 0x000000FF);

    // Begin SPI transaction with appropriate settings
    SPI.beginTransaction(MEDUSA_SPI_Settings);

    digitalWriteFast(csPin, LOW);           // Set the chip select low
    SPI.transfer(&buffer, &bufferOut, 13);  // Transmit the buffer and pass the return buffer
    digitalWriteFast(csPin, HIGH);          // Set the chip select high
    SPI.endTransaction();                   // Release the SPI controller

    delayMicroseconds(1000);    // Delay for SPI transaction to finish

    uint32_t data = (bufferOut[9] << 24) | (bufferOut[10] << 16) | (bufferOut[11] << 8) | bufferOut[12];    // Read data out of the return buffer
    return data;
}

// Analog core functions
void MEDUSA::resetClsMem(bool tile) 
{
    // Initialize address variables
    uint32_t WL_ADDR;
    uint32_t BL_ADDR;

    // Select appropriate tile address
    if(tile)
    {
        WL_ADDR = WL_LEFT_ADDR;
        BL_ADDR = BL_LEFT_ADDR;
    }
    else
    {
        WL_ADDR = WL_RIGHT_ADDR;
        BL_ADDR = BL_RIGHT_ADDR;
    }

    // Write all WLs
    for(uint8_t i = 0; i < WL_WORDS; i++)
    {
        // Disable all WLs and assert reset signals
        writeReg((WL_ADDR + (i << 2)), 0x00000000);  
    }

    // Write all BLs
    for(uint8_t i = 0; i < BL_WORDS; i++)
    {
        writeReg((BL_ADDR + (i << 2)), 0x00000000);  // Disable all BLs
    }

    // Write relevant WLs
    writeReg(WL_ADDR, 0x00000001);                          // Deassert top reset signal
    writeReg(WL_ADDR + ((WL_WORDS - 1) << 2), 0x80000000);  // Deassert bottom reset signal
}

void MEDUSA::setupClsBias(bool tile, uint8_t numVar, uint16_t numCls)
{
    // Initialize address variables
    uint32_t WL_ADDR;
    uint32_t BL_ADDR;

    // Select appropriate tile address
    if(tile)
    {
        WL_ADDR = WL_LEFT_ADDR;
        BL_ADDR = BL_LEFT_ADDR;
    }
    else
    {
        WL_ADDR = WL_RIGHT_ADDR;
        BL_ADDR = BL_RIGHT_ADDR;
    }

    if (numCls > (HALF_CLS + SECT_CLS))
    {
        globalReg = globalReg & ~(((1 << CLS_SW_ENb_TOP) << (tile * 16)) | ((1 << CLS_SW_ENb_BOT) << (tile * 16)));
        writeReg(GLBL_CTRL_ADDR, globalReg);
    }
    else if (numCls > SECT_CLS)
    {
        globalReg = globalReg & ~((1 << CLS_SW_ENb_TOP) << (tile * 16));
        writeReg(GLBL_CTRL_ADDR, globalReg);
    }

    // Write all BLs
    for (uint8_t i = 0; i < BL_WORDS; i++)
    {
        writeReg((BL_ADDR + (i << 2)), 0xFFFFFFFF);  // Enable all BLs
    }

    // Assert WLs
    writeReg(WL_ADDR + ((WL_WORDS - 1) << 2), 0xC0000000);  // Assert top clause bias WL
    if(numCls > HALF_CLS)                                   // If number of clauses requires bottom half clauses
    {
        writeReg(WL_ADDR, 0x00000003);  // Assert bottom clause bias WL
    }
    
    // Deassert WLs
    writeReg(WL_ADDR + ((WL_WORDS - 1) << 2), 0x80000000);  // Deassert top clause bias WL    
    if(numCls > HALF_CLS)                                   // If number of clauses requires bottom half clauses
    {
        writeReg(WL_ADDR, 0x00000001);  // Deassert bottom clause bias WL
    }

    // Write all BLs
    for (uint8_t i = 0; i < BL_WORDS; i++)
    {
        writeReg((BL_ADDR + (i << 2)), 0x00000000);  // Disable all BLs
    }
}

void MEDUSA::disableCls(bool tile) 
{
    // Initialize address variables
    uint32_t WL_ADDR;
    uint32_t BL_ADDR;

    // Select appropriate tile address
    if(tile)
    {
        WL_ADDR = WL_LEFT_ADDR;
        BL_ADDR = BL_LEFT_ADDR;
    }
    else
    {
        WL_ADDR = WL_RIGHT_ADDR;
        BL_ADDR = BL_RIGHT_ADDR;
    }

    // Write BL to diasble all clause by forcing output to satisfied
    writeReg(BL_ADDR + ((BL_WORDS-1) << 2), 0x00010000);  

    // Write all WLs
    for(uint8_t i = 0; i < WL_WORDS; i++)
    {
        if (i == 0)
        {
            writeReg(WL_ADDR, 0xFFFFFFFD);
        }
        else if (i == (WL_WORDS - 1))
        {
            writeReg(WL_ADDR + (i << 2), 0xBFFFFFFF);
        }
        else if (i != 8)
        {
            writeReg(WL_ADDR + (i << 2), 0xFFFFFFFF);
        }
    }

    // Disable all WLs
    for(uint8_t i = 0; i < WL_WORDS; i++)
    {
        if (i == 0)
        {
            writeReg(WL_ADDR, 0x00000001);
        }
        else if (i == (WL_WORDS - 1))
        {
            writeReg(WL_ADDR + (i << 2), 0x80000000);
        }
        else if (i != 8)
        {
            writeReg(WL_ADDR + (i << 2), 0x00000000);
        }
    }

    // Write BL to diasble all clause by forcing output to satisfied
    writeReg(BL_ADDR + ((BL_WORDS-1) << 2), 0x00000000);  
}

void MEDUSA::setupRXOs(uint8_t tile, uint8_t numVar, uint16_t numCls)
{
    // Initialize variables
    uint8_t numWholeWord = numVar / 16;             // Final word in which all oscillators are used
    uint8_t partWord = numVar % 16;                 // Number of oscillators used in final word
    uint8_t numWords = numWholeWord + bool(partWord);  // Number of words required to store all oscillators

    uint8_t lastRXO = partWord % 4;  // Last oscilltor row in final word
    uint8_t numByte = (partWord / 4) + bool(lastRXO); // Number of bytes required to store all oscillators

    uint8_t rxoReg = 0x0C;  // RXO biasing register value (all but bot TIA on)
    uint8_t biasReg = 0xF0; // RXO biasing register value (all on)

    // If using both top and bottom clauses
    if (numCls > HALF_CLS)
    {
        rxoReg = 0x3C;  // RXO biasing register value (all on)
    }

    uint32_t rxoFullWord = rxoReg | (rxoReg << 8) | (rxoReg << 16) | (rxoReg << 24);        // Full word of RXO biasing
    uint32_t biasFullWord = biasReg | (biasReg << 8) | (biasReg << 16) | (biasReg << 24);   // Full word of RXO biasing

    uint32_t rxoPartWord = rxoFullWord;  // Partial word of RXO biasing
    uint32_t biasPartWord = rxoFullWord; // Partial word of RXO biasing

    // Determine number of bytes to use for partial word
    switch (numByte)
    {
        case 1:
            rxoPartWord = rxoReg;
            biasPartWord = biasReg;
            break;
    
        case 2:
            rxoPartWord = rxoReg | (rxoReg << 8);
            biasPartWord = biasReg | (biasReg << 8);
            break;

        case 3:
            rxoPartWord = rxoReg | (rxoReg << 8) | (rxoReg << 16);
            biasPartWord = biasReg | (biasReg << 8) | (biasReg << 16);
            break;

    default:
        break;
    }

    switch (tile)
    {
        case TILE_RIGHT:
            // Reset relaxation oscillators
            globalReg =  globalReg | (1 << RXO_RST);    // Assert RXO reset bit
            writeReg(GLBL_CTRL_ADDR, globalReg);        // Set global control register
            globalReg =  globalReg & ~(1 << RXO_RST);   // Deassert RXO reset bit
            writeReg(GLBL_CTRL_ADDR, globalReg);        // Write global control register
            
            // Enable RXO biasing
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_RIGHT_ADDR + (i << 2)), biasFullWord);   // Enable all BLs
            }
            writeReg((BL_RIGHT_ADDR + ((numWords-1) << 2)), biasPartWord);   // Enable all BLs
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000004);         // Assert RXOs WL
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000000);         // Deassert RXOs WL

            // Enable RXOs
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_RIGHT_ADDR + (i << 2)), rxoFullWord);   // Enable all BLs
            }
            writeReg((BL_RIGHT_ADDR + ((numWords-1) << 2)), rxoPartWord);   // Enable all BLs
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x0000001B);         // Assert RXOs WL
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000000);         // Deassert RXOs WL
            break;

        case TILE_LEFT:
            // Reset relaxation oscillators
            globalReg =  globalReg | ((1 << RXO_RST) << 16);   // Assert RXO reset bit
            writeReg(GLBL_CTRL_ADDR, globalReg);               // Set global control register
            globalReg =  globalReg & ~((1 << RXO_RST) << 16);  // Deassert RXO reset bit
            writeReg(GLBL_CTRL_ADDR, globalReg);               // Write global control register

            // Enable RXO biasing
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_LEFT_ADDR + (i << 2)), biasFullWord);    // Enable all BLs
            }
            writeReg((BL_LEFT_ADDR + ((numWords-1) << 2)), biasPartWord);    // Enable all BLs
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000004);          // Assert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000000);          // Deassert RXOs WL

            // Enable RXOs
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_LEFT_ADDR + (i << 2)), rxoFullWord);    // Enable all BLs
            }
            writeReg((BL_LEFT_ADDR + ((numWords-1) << 2)), rxoPartWord);    // Enable all BLs
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x0000001B);          // Assert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000000);          // Deassert RXOs WL
            break;

        case TILE_BOTH:
            // Reset relaxation oscillators
            globalReg =  globalReg | (1 << RXO_RST) | ((1 << RXO_RST) << 16);   // Assert RXO reset bits
            writeReg(GLBL_CTRL_ADDR, globalReg);                                // Set global control register

            // Complete reset and enable relaxation oscillator coupling
            globalReg =  (globalReg & ~(1 << RXO_RST) & ~((1 << RXO_RST) << 16)) | ((1 << RXO_MODE) | ((1 << RXO_MODE) << 16));   // Deassert RXO reset bits and assert coupling bits
            writeReg(GLBL_CTRL_ADDR, globalReg);                                                                                // Write global control register
            
            // Enable RXO biasing
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_RIGHT_ADDR + (i << 2)), biasFullWord);   // Enable all BLs
                writeReg((BL_LEFT_ADDR + (i << 2)), biasFullWord);    // Enable all BLs
            }
            writeReg((BL_RIGHT_ADDR + ((numWords-1) << 2)), biasPartWord);   // Enable all BLs
            writeReg((BL_LEFT_ADDR + ((numWords-1) << 2)), biasPartWord);    // Enable all BLs
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000004);         // Assert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000004);          // Assert RXOs WL
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000000);         // Deassert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000000);          // Deassert RXOs WL
            

            // Enable RXOs
            for (uint8_t i = 0; i < numWords-1; i++)
            {
                writeReg((BL_RIGHT_ADDR + (i << 2)), rxoFullWord);   // Enable all BLs
                writeReg((BL_LEFT_ADDR + (i << 2)), rxoFullWord);    // Enable all BLs
            }
            writeReg((BL_RIGHT_ADDR + ((numWords-1) << 2)), rxoPartWord);   // Enable all BLs
            writeReg((BL_LEFT_ADDR + ((numWords-1) << 2)), rxoPartWord);    // Enable all BLs
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x0000001B);         // Assert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x0000001B);          // Assert RXOs WL
            writeReg(WL_RIGHT_ADDR + (8 << 2), 0x00000000);         // Deassert RXOs WL
            writeReg(WL_LEFT_ADDR + (8 << 2), 0x00000000);          // Deassert RXOs WL
            break;

        default:
            SerialUSB.println("Error: Invalid tile selection");
            break;
    }
}

void MEDUSA::writeCnf(bool tile, uint8_t numVar, uint16_t numCls, int16_t cnf[CNF_MAX_CLS][CNF_MAX_K+1]) 
{
    // Initialize address variables
    uint32_t BL_ADDR;

    // Select appropriate tile address
    if(tile)
    {
        BL_ADDR = BL_LEFT_ADDR;
    }
    else
    {
        BL_ADDR = BL_RIGHT_ADDR;
    }

    disableCls(tile);  // Disable clauses by setting all to satisfied

    // Write all clauses
    for(uint16_t i = 0; i < numCls; i++)
    {
        // Initialize bit line usage and memory variables
        bool blUsed[BL_WORDS] = {0};        // If word has data to be written
        blUsed[BL_WORDS-1] = true;          // Set last word as used to enable clause
        uint32_t blData[BL_WORDS] = {0};    // Data to be written to word


        // Determine word line address
        uint16_t wl;
        if (i < HALF_CLS)
        {
            wl = TOP_CLS_START_WL + i;
        }
        else
        {
            wl = BOT_CLS_START_WL - (i - HALF_CLS);
        }

        uint8_t j = 0;              // Variable index for reading cnf
        int16_t data = cnf[i][j];   // Read first variable of clause

        while (data != 0)
        {
            uint16_t wrd = (abs(data)-1) / 16;          // Calculate word index
            uint8_t bit = 2 * ((abs(data)-1) % 16);     // Calculate bit index
            bool neg = data < 0;                        // Calculate if variable is negative

            blUsed[wrd] = true;                             // Set word as used
            blData[wrd] |= (1 << (bit+1)) | (neg << bit);   // Set bit as used

            j = j + 1;          // Increment index
            data = cnf[i][j];   // Read next variable of clause
        }

        // Write all BLs
        for(uint8_t i = 0; i < BL_WORDS; i++)
        {
            if (blUsed[i])
            {
                writeReg((BL_ADDR + (i << 2)), blData[i]);  // Write data to BL
            }
        }

        // Write word line
        writeWL(tile, wl, 1);  // Assert word line
        writeWL(tile, wl, 0);  // Deassert word line

        // Reset all BLs
        for(uint8_t i = 0; i < BL_WORDS; i++)
        {
            if (blUsed[i])
            {
                writeReg((BL_ADDR + (i << 2)), 0x00000000);  // Write data to BL
            }
        }
    }
}

void MEDUSA::setupSampling(uint8_t tile, uint8_t clkDiv, uint8_t mode, float delay) 
{    
    // Initialize variables
    uint32_t configuration;     // Configuration bits variable for sampling system
    uint32_t holdTime = 100;   // Hold time variable for sampling system

    // Check for valid clock divider and mode values
    if (clkDiv > 3)
    {
        SerialUSB.println("Warning: Invalid clock divider value, setting to maximum value (0b11)");
        clkDiv = 0b11;  // Set clock divider to maximum value
    }
    if (mode > 3)
    {
        SerialUSB.println("Warning: Invalid mode value, setting to default value (0b00)");
        mode = 0b00;    // Set mode to maximum value
    }

    // Extract clock divider and mode bits from integer inputs
    bool clkDiv0 = clkDiv & 0b01;  // Calculate clock divider 0
    bool clkDiv1 = clkDiv & 0b10;  // Calculate clock divider 1
    bool errbMode = mode & 0b01;   // Calculate error bit mode
    bool smplMode = mode & 0b10;   // Calculate sampling mode

    // Set configuration bits
    configuration = (1 << SMPL_RSTB) | (smplMode << SMPL_MODE) | (errbMode << ERRB_MODE) | (clkDiv1 << CLK_DIV1) | (clkDiv0 << CLK_DIV0); 
    
    switch (tile)
    {
        case TILE_RIGHT:
            // Reset sampling system
            sampleReg = sampleReg & ~(1 << SMPL_RSTB);  // Set reset bit low in data
            writeReg(SMPL_CTRL_ADDR, sampleReg);        // Write data to sampling control register
            // Setup sampling system
            sampleReg = (sampleReg & (MASK_16B << 16)) | configuration; // Write configuration bits to data memory
            writeReg(SMPL_CTRL_ADDR, sampleReg);        // Write to sampling control register
            writeReg(HOLD_TIME_RIGHT_ADDR, holdTime);   // Set hold time
            break;
        
        case TILE_LEFT:
            // Reset sampling system
            sampleReg = sampleReg & ~((1 << SMPL_RSTB) << 16);  // Set reset bit low in data
            writeReg(SMPL_CTRL_ADDR, sampleReg);                // Write data to sampling control register
            // Setup sampling system
            sampleReg = (sampleReg & MASK_16B) | (configuration << 16); // Write configuration bits to data memory
            writeReg(SMPL_CTRL_ADDR, sampleReg);        // Write to sampling control register
            writeReg(HOLD_TIME_LEFT_ADDR, holdTime);    // Set hold time
            break;
        
        case TILE_BOTH:
            // Reset sampling system
            sampleReg = sampleReg & ~((1 << SMPL_RSTB) | ((1 << SMPL_RSTB) << 16)); // Set reset bit low in data
            writeReg(SMPL_CTRL_ADDR, sampleReg);                                    // Write data to sampling control register
            // Setup sampling system
            sampleReg = (configuration <<  16) | (configuration);   // Write configuration bits to data memory
            writeReg(SMPL_CTRL_ADDR, sampleReg);        // Write to sampling control register
            writeReg(HOLD_TIME_RIGHT_ADDR, holdTime);   // Set hold time
            writeReg(HOLD_TIME_LEFT_ADDR, holdTime);    // Set hold time
            break;

        default:
            SerialUSB.println("Error: Invalid tile selection");
            break;
    }
}

// Analog accessory functions
void MEDUSA::writeWL(bool tile, uint16_t wl, bool data) 
{
    // Initialize address variables
    uint32_t WL_ADDR;

    // Select appropriate tile address
    if(tile)
    {
        WL_ADDR = WL_LEFT_ADDR;
    }
    else
    {
        WL_ADDR = WL_RIGHT_ADDR;
    }

    // Calculate word line word and bit position
    uint16_t wlWrd = wl / 32;   // Calculate word index
    uint8_t wlBit = wl % 32;    // Calculate bit index

    // Write to word line
    if (wlWrd == 0)
    {
        writeReg(WL_ADDR, (data << wlBit) | 0x00000001);  // Write data to word line
    }
    else if (wlWrd == (WL_WORDS - 1))
    {
        writeReg(WL_ADDR + (wlWrd << 2), (data << wlBit) | 0x80000000);  // Write data to word line
    }
    else
    {
        writeReg(WL_ADDR + (wlWrd << 2), data << wlBit);  // Write data to word line
    }
}

// Solver functions
void MEDUSA::runSolverSingle(bool tile, String filepath, uint32_t numRuns)
{
    // Initialize address variables
    uint32_t SMPL_DONE_ADDR;
    uint32_t SMPL_TIME_ADDR;
    uint32_t SMPL_DOUT_ADDR;
    uint32_t timeout = 10000; // Timeout value for solver run in microseconds

    // Initialize cnf data variables
    uint8_t numVar = 0;   // Initialize number of variables
    uint16_t numCls = 0;  // Initialize number of clauses
    int16_t cnf[CNF_MAX_CLS][CNF_MAX_K+1] = {0};  // Initialize cnf array

    // Configure global control register and addresses for specified tile
    if (tile)
    {
        // Set addresses for left tile
        SMPL_DONE_ADDR = SMPL_DONE_LEFT_ADDR;
        SMPL_TIME_ADDR = SMPL_TIME_LEFT_ADDR;
        SMPL_DOUT_ADDR = SMPL_DOUT_LEFT_ADDR;
    }
    else
    {
        // Set addresses for right tile
        SMPL_DONE_ADDR = SMPL_DONE_RIGHT_ADDR;
        SMPL_TIME_ADDR = SMPL_TIME_RIGHT_ADDR;
        SMPL_DOUT_ADDR = SMPL_DOUT_RIGHT_ADDR;
    }

    // Read cnf file
    readCNF(filepath, cnf, numVar, numCls);  // Read cnf file

    // Setup solver for specified problem
    resetClsMem(tile);                      // Reset clause memory
    setupClsBias(tile, numVar, numCls);     // Set clause biasing
    writeCnf(tile, numVar, numCls, cnf);    // Write cnf to clause memory

    deleteFile(filepath + ".results");  // Delete old results file

    for (uint32_t i = 0; i < numRuns; i++)
    {
        uint32_t numAttempts = 0;  // Initialize number of attempts variable
        uint32_t status = 0;  // Initialize status variable
        bool solved = false;  // Initialize solved variable
        uint32_t data[SMPL_DOUT_WORDS+2] = {0};       // Initialize data array

        setupRXOs(tile, numVar, numCls);        // Setup right tile relaxation oscillators for specified problem
        setupSampling(tile, 3, 0, 100E-9);      // Setup sampling system for specified parameters

        // Start solver run
        globalReg = globalReg | ((1 << RUN) << (tile * 16));    // Enable tile "Run" bit
        writeReg(GLBL_CTRL_ADDR, globalReg);                    // Write to global control register

        // while (status == 0)
        // {
        //     status = readReg(SMPL_DONE_ADDR);  // Read status register
        //     delayMicroseconds(1);              // Wait for 1 us
        // }

        while (!solved)
        {
            // Read status register
            delayMicroseconds(timeout);
            status = readReg(SMPL_DONE_ADDR);  

            if (status)
            {
                float time = readReg(SMPL_TIME_ADDR) / (895E3 * 1024 / 8) / (1E-6);  // Read sampling time

                if (time > float(timeout))
                {
                    numAttempts = numAttempts + 1;  // Increment number of attempts
                    
                    setupRXOs(tile, numVar, numCls);        // Setup relaxation oscillators for specified problem
                    setupSampling(tile, 3, 0, 100E-9);      // Setup sampling system for specified parameters

                    // Start solver run
                    globalReg = globalReg | ((1 << RUN) << (tile * 16));    // Enable tile "Run" bit
                    writeReg(GLBL_CTRL_ADDR, globalReg);                    // Write to global control register
                }
                else
                {
                    solved = true;  // Set solved to true
                }
            }
            else
            {
                numAttempts = numAttempts + 1;  // Increment number of attempts
                    
                setupRXOs(tile, numVar, numCls);        // Setup relaxation oscillators for specified problem
                setupSampling(tile, 3, 0, 100E-9);      // Setup sampling system for specified parameters

                // Start solver run
                globalReg = globalReg | ((1 << RUN) << (tile * 16));    // Enable tile "Run" bit
                writeReg(GLBL_CTRL_ADDR, globalReg);                    // Write to global control register
            }
        }

        // SerialUSB.print(String(numAttempts) + ", ");

        data[SMPL_DOUT_WORDS] = readReg(SMPL_TIME_ADDR);  // Read sampling time
        data[SMPL_DOUT_WORDS+1] = numAttempts;            // Read number of attempts
        // Read output data
        for (uint8_t j = 0; j < SMPL_DOUT_WORDS; j++)
        {
            data[j] = readReg(SMPL_DOUT_ADDR + (j << 2));  // Read data from output register
        }

        // Write results to file
        writeResults(filepath + ".results", data, SMPL_DOUT_WORDS+2);  // Write results to file

        // Stop solver run
        globalReg = globalReg & ~((1 << RUN) << (tile * 16));   // Disable tile "Run" bit
        writeReg(GLBL_CTRL_ADDR, globalReg);                    // Write to global control register
    }
}

void MEDUSA::runSolverCoupled(String filepath, uint32_t numRuns)
{
    // Initialize cnf data variables
    uint8_t numVar = 0;   // Initialize number of variables
    uint16_t numCls = 0;  // Initialize number of clauses
    int16_t cnf[CNF_MAX_CLS][CNF_MAX_K+1] = {0};  // Initialize cnf array
    uint32_t timeout = 10000; // Timeout value for solver run in microseconds

    // Read cnf file
    readCNF(filepath, cnf, numVar, numCls);  // Read cnf file

    // Calculate number of clauses for each tile
    uint16_t numClsR = numCls / 2;          // Calculate number of clauses for right tile
    uint16_t numClsL = numCls - numClsR;    // Calculate number of clauses for left tile

    // Create cnf arrays for each tile
    int16_t cnfR[numClsR][CNF_MAX_K+1] = {0};  // Initialize cnf array for right tile
    int16_t cnfL[numClsL][CNF_MAX_K+1] = {0};  // Initialize cnf array for left tile

    // Copy data to tile arrays
    for (uint16_t i = 0; i < numClsR; i++)
    {
        for (uint8_t j = 0; j < CNF_MAX_K+1; j++)
        {
            cnfR[i][j] = cnf[i][j];  // Copy data to right tile array
        }
    }
    for (uint16_t i = 0; i < numClsL; i++)
    {
        for (uint8_t j = 0; j < CNF_MAX_K+1; j++)
        {
            cnfL[i][j] = cnf[i+numClsR][j];  // Copy data to left tile array
        }
    }

    // Setup solver for specified problem
    resetClsMem(TILE_RIGHT);                        // Reset clause memory
    resetClsMem(TILE_LEFT);                         // Reset clause memory
    setupClsBias(TILE_RIGHT, numVar, numClsR);      // Set clause biasing
    setupClsBias(TILE_LEFT, numVar, numClsL);       // Set clause biasing
    writeCnf(TILE_RIGHT, numVar, numClsR, cnfR);    // Write cnf to clause memory
    writeCnf(TILE_LEFT, numVar, numClsL, cnfL);     // Write cnf to clause memory

    deleteFile(filepath + ".results");  // Delete old results file

    for (uint32_t i = 0; i < numRuns; i++)
    {
        setupRXOs(TILE_BOTH, numVar, numCls);     // Setup right tile relaxation oscillators for specified problem
        setupSampling(TILE_BOTH, 3, 2, 100E-9);    // Setup sampling system for specified parameters

        uint32_t status = 0;  // Initialize status variable
        bool solved = false;  // Initialize solved variable
        uint32_t numAttempts = 0;  // Initialize number of attempts variable
        uint32_t data[SMPL_DOUT_WORDS+2] = {0};       // Initialize data array

        // Start solver run
        globalReg = globalReg | (((1 << RUN) << 16) | (1 << RUN));  // Enable "Run" bit for both tiles
        writeReg(GLBL_CTRL_ADDR, globalReg);                        // Write to global control register

        // while (status == 0)
        // {
        //     status = readReg(SMPL_DONE_RIGHT_ADDR) * readReg(SMPL_DONE_LEFT_ADDR);  // Read status registers
        //     delayMicroseconds(1);   // Wait for 1 us
        // }

        while (status == 0)
        {
            // Read status register
            delayMicroseconds(timeout);
            status = readReg(SMPL_DONE_RIGHT_ADDR) & readReg(SMPL_DONE_LEFT_ADDR);  

            if (status)
            {
                float time = 0;  // Initialize time variable

                float runningTimeLeft = readReg(SMPL_TIME_LEFT_ADDR);  // Initialize running time variable
                float runningTimeRight = readReg(SMPL_TIME_RIGHT_ADDR);  // Initialize running time variable
                if (runningTimeLeft > runningTimeRight)
                {
                    time = runningTimeLeft / (895E3 * 1024 / 8) / (1E-6);  // Read sampling time
                }
                else
                {
                    time = runningTimeRight / (895E3 * 1024 / 8) / (1E-6);  // Read sampling time
                }
                
                if (time > float(timeout))
                {
                    numAttempts = numAttempts + 1;  // Increment number of attempts
                    
                    setupRXOs(TILE_BOTH, numVar, numCls);        // Setup relaxation oscillators for specified problem
                    setupSampling(TILE_BOTH, 3, 0, 100E-9);      // Setup sampling system for specified parameters

                    // Start solver run
                    globalReg = globalReg | (((1 << RUN) << 16) | (1 << RUN));  // Enable "Run" bit for both tiles
                    writeReg(GLBL_CTRL_ADDR, globalReg);                        // Write to global control register
                }
                else
                {
                    solved = true;  // Set solved to true
                }
            }
            else
            {
                numAttempts = numAttempts + 1;  // Increment number of attempts
                    
                setupRXOs(TILE_BOTH, numVar, numCls);        // Setup relaxation oscillators for specified problem
                setupSampling(TILE_BOTH, 3, 0, 100E-9);      // Setup sampling system for specified parameters

                // Start solver run
                globalReg = globalReg | (((1 << RUN) << 16) | (1 << RUN));  // Enable "Run" bit for both tiles
                writeReg(GLBL_CTRL_ADDR, globalReg);                        // Write to global control register
            }
        }

        uint32_t timeRight = readReg(SMPL_TIME_RIGHT_ADDR);
        uint32_t timeLeft = readReg(SMPL_TIME_LEFT_ADDR);

        data[SMPL_DOUT_WORDS + 1] = numAttempts;  // Read number of attempts

        if (timeRight > timeLeft)
        {
            // Read right tile data
            data[SMPL_DOUT_WORDS] = timeRight;  // Read sampling time
            for (uint8_t j = 0; j < SMPL_DOUT_WORDS; j++)
            {
                data[j] = readReg(SMPL_DOUT_RIGHT_ADDR + (j << 2)); // Read data from output register
            }
            writeResults(filepath + ".results", data, SMPL_DOUT_WORDS+2);  // Write results to file
        }
        else
        {
            // Read right tile data
            data[SMPL_DOUT_WORDS] = timeLeft;   // Read sampling time
            for (uint8_t j = 0; j < SMPL_DOUT_WORDS; j++)
            {
                data[j] = readReg(SMPL_DOUT_LEFT_ADDR + (j << 2));  // Read data from output register
            }
            writeResults(filepath + ".results", data, SMPL_DOUT_WORDS+2);  // Write results to file
        }

        // Stop solver run
        globalReg = globalReg & ~(((1 << RUN) << 16) | (1 << RUN)); // Disable "Run" bit for both tiles
        writeReg(GLBL_CTRL_ADDR, globalReg);                        // Write to global control register
    }
}

// Monitor PULPino execution
bool MEDUSA::verifyPulpino(const char* originalFilename, uint32_t address, uint32_t length)
{
    #ifdef ARDUINO_PLATFORM
        // Open the original binary file
        File origFile = SD.open(originalFilename, FILE_READ);
        if (!origFile) 
        {
            SerialUSB.println("Error opening original binary file");
            return false;
        }

        // Get file size
        uint32_t fileSize = origFile.size();
        SerialUSB.print("Original binary file size: ");
        SerialUSB.print(fileSize);
        SerialUSB.println(" bytes");

        // Read the original file into a buffer
        uint8_t* origBuffer = new uint8_t[fileSize];
        origFile.read(origBuffer, fileSize);
        origFile.close();

        // Read the PULPino memory into a buffer
        uint8_t* pulpinoBuffer = new uint8_t[length];
        for (uint32_t i = 0; i < length; i += 4) 
        {
            uint32_t value;
            if (!readPulpinoRegister(address + i, &value)) 
            {
                SerialUSB.println("Error reading PULPino memory");
                delete[] origBuffer;
                delete[] pulpinoBuffer;
                return false;
            }
            pulpinoBuffer[i] = (value >> 24) & 0xFF;
            pulpinoBuffer[i + 1] = (value >> 16) & 0xFF;
            pulpinoBuffer[i + 2] = (value >> 8) & 0xFF;
            pulpinoBuffer[i + 3] = value & 0xFF;
        }

        // Compare the buffers
        bool verificationSuccessful = true;
        for (uint32_t i = 0; i < length; i++) 
        {
            if (origBuffer[i] != pulpinoBuffer[i]) 
            {
                SerialUSB.print("Verification failed at address 0x");
                SerialUSB.print(address + i, HEX);
                SerialUSB.print(": Expected 0x");
                SerialUSB.print(origBuffer[i], HEX);
                SerialUSB.print(", but got 0x");
                SerialUSB.println(pulpinoBuffer[i], HEX);
                verificationSuccessful = false;
                break;
            }
        }

        delete[] origBuffer;
        delete[] pulpinoBuffer;

        return verificationSuccessful;
    #else
        return false;
    #endif
}

// Read a 32-bit register from PULPino via SPI
bool MEDUSA::readPulpinoRegister(uint32_t address, uint32_t* value)
{
    #ifdef ARDUINO_PLATFORM
        // Initialize SPI
        pulpinoSpiBegin();
        digitalWriteFast(DP2_CS, LOW);  // CS active
        
        // Send read command (0x0B from PULPino SPI slave protocol)
        pulpinoSpiSendByte(0x0B);  // Read command
        
        // Send address
        pulpinoSpiSendByte((address >> 24) & 0xFF);
        pulpinoSpiSendByte((address >> 16) & 0xFF);
        pulpinoSpiSendByte((address >> 8) & 0xFF);
        pulpinoSpiSendByte(address & 0xFF);
        
        // Send length (4 bytes for one 32-bit word)
        pulpinoSpiSendByte(0x00);  // 4 bytes
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x04);
        
        // Dummy byte required before data starts coming in
        pulpinoSpiSendByte(0x00);
        
        // Read 4 bytes (32-bit register)
        uint32_t result = 0;
        result |= ((uint32_t)pulpinoSpiReceiveByte() << 24);
        result |= ((uint32_t)pulpinoSpiReceiveByte() << 16);
        result |= ((uint32_t)pulpinoSpiReceiveByte() << 8);
        result |= pulpinoSpiReceiveByte();
        
        // End SPI transaction
        pulpinoSpiEnd();
        
        *value = result;
        return true;
    #else
        return false;
    #endif
}

// Write a 32-bit register to PULPino via SPI
bool MEDUSA::writePulpinoRegister(uint32_t address, uint32_t value)
{
    #ifdef ARDUINO_PLATFORM
        // Initialize SPI
        pulpinoSpiBegin();
        digitalWriteFast(DP2_CS, LOW);  // CS active
        
        // Send write command (0x02 from PULPino SPI slave protocol)
        pulpinoSpiSendByte(0x02);  // Write command
        
        // Send address
        pulpinoSpiSendByte((address >> 24) & 0xFF);
        pulpinoSpiSendByte((address >> 16) & 0xFF);
        pulpinoSpiSendByte((address >> 8) & 0xFF);
        pulpinoSpiSendByte(address & 0xFF);
        
        // Send length (4 bytes for one 32-bit word)
        pulpinoSpiSendByte(0x00);  // 4 bytes
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x04);
        
        // Send the data (32-bit register value)
        pulpinoSpiSendByte((value >> 24) & 0xFF);
        pulpinoSpiSendByte((value >> 16) & 0xFF);
        pulpinoSpiSendByte((value >> 8) & 0xFF);
        pulpinoSpiSendByte(value & 0xFF);
        
        // End SPI transaction
        pulpinoSpiEnd();
        
        return true;
    #else
        return false;
    #endif
}

// Write to PULPino memory location
bool MEDUSA::writePulpinoMemory(uint32_t address, uint32_t value) 
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.print("Writing 0x");
        SerialUSB.print(value, HEX);
        SerialUSB.print(" to address 0x");
        SerialUSB.println(address, HEX);
    
        // Initialize SPI
        pulpinoSpiBegin();
        
        // Make sure CS is high before starting transaction
        digitalWriteFast(DP2_CS, HIGH);
        delayMicroseconds(50);  // Ensure proper timing before CS assertion
        
        // Assert chip select
        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(50);  // Wait for CS to stabilize
        
        // Send write command - 0x01 is the correct command for PULPino write
        pulpinoSpiSendByte(0x01);
        
        // Send address
        pulpinoSpiSendByte((address >> 24) & 0xFF);
        pulpinoSpiSendByte((address >> 16) & 0xFF);
        pulpinoSpiSendByte((address >> 8) & 0xFF);
        pulpinoSpiSendByte(address & 0xFF);
        
        // Send data
        pulpinoSpiSendByte((value >> 24) & 0xFF);
        pulpinoSpiSendByte((value >> 16) & 0xFF);
        pulpinoSpiSendByte((value >> 8) & 0xFF);
        pulpinoSpiSendByte(value & 0xFF);
        
        // Deassert chip select with enough delay
        delayMicroseconds(50);
        digitalWriteFast(DP2_CS, HIGH);
        delayMicroseconds(50);  // Wait after CS deasserted
        
        // End SPI
        pulpinoSpiEnd();
        
        #ifdef PULPINO_DEBUG
            SerialUSB.println("Write successful");
        #endif
        
        return true;
    #else
        return false;
    #endif
}

// Read from PULPino memory location
bool MEDUSA::readPulpinoMemory(uint32_t address, uint32_t* value)
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.print("Reading from address 0x");
        SerialUSB.println(address, HEX);
    
        // Initialize SPI
        pulpinoSpiBegin();
        
        // Make sure CS is high before starting transaction
        digitalWriteFast(DP2_CS, HIGH);
        delayMicroseconds(50);  // Ensure proper timing before CS assertion
        
        // Assert chip select
        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(50);  // Wait for CS to stabilize

        // Send read command - 0x0B is correct for PULPino read
        pulpinoSpiSendByte(0x0B);
        
        // Send address
        pulpinoSpiSendByte((address >> 24) & 0xFF);
        pulpinoSpiSendByte((address >> 16) & 0xFF);
        pulpinoSpiSendByte((address >> 8) & 0xFF);
        pulpinoSpiSendByte(address & 0xFF);
        
        // Send dummy byte (required by PULPino SPI protocol)
        pulpinoSpiSendByte(0x00);
        
        // Read data
        uint32_t readValue = 0;
        
        #ifdef PULPINO_DEBUG_VERBOSE
            SerialUSB.print("MISO pin state before reading: ");
            SerialUSB.println(digitalReadFast(DAC_CS));
        #endif
        
        readValue |= ((uint32_t)pulpinoSpiReceiveByte() << 24);
        readValue |= ((uint32_t)pulpinoSpiReceiveByte() << 16);
        readValue |= ((uint32_t)pulpinoSpiReceiveByte() << 8);
        readValue |= pulpinoSpiReceiveByte();
        
        // Deassert chip select with enough delay
        delayMicroseconds(50);
        digitalWriteFast(DP2_CS, HIGH);
        delayMicroseconds(50);  // Wait after CS deasserted
        
        // End SPI
        pulpinoSpiEnd();
        
        // Update value
        *value = readValue;
        
        #ifdef PULPINO_DEBUG
            SerialUSB.print("Read value 0x");
            SerialUSB.print(readValue, HEX);
            SerialUSB.print(" from address 0x");
            SerialUSB.println(address, HEX);
        #endif
        
        return true;
    #else
        return false;
    #endif
}

// Enhanced memory read with better debugging for PULPino diagnosis
bool MEDUSA::debugReadPulpinoMemory(uint32_t addr, uint32_t* value)
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.println("DEBUG: Begin enhanced memory read operation");
        SerialUSB.print("DEBUG: Reading from address 0x");
        SerialUSB.println(addr, HEX);
        
        // Configure pins with explicit pulldown on MISO
        pinMode(DP2_CS, OUTPUT);   // Chip select
        pinMode(DP1_CS, OUTPUT);   // Clock
        pinMode(DP0_CS, OUTPUT);   // MOSI
        #ifdef INPUT_PULLDOWN
            SerialUSB.println("DEBUG: Setting MISO with internal pull-down");
            pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
        #else
            SerialUSB.println("DEBUG: Setting MISO as INPUT (no internal pull-down)");
            pinMode(DAC_CS, INPUT);    // MISO
        #endif
        
        // Check initial MISO state
        SerialUSB.print("DEBUG: Initial MISO pin state: ");
        SerialUSB.println(digitalReadFast(DAC_CS));
        
        // Initialize default states
        digitalWriteFast(DP2_CS, HIGH);  // CS inactive
        digitalWriteFast(DP1_CS, LOW);   // Clock low
        digitalWriteFast(DP0_CS, LOW);   // MOSI low
        
        // Settle time
        delay(10);
        
        // Check MISO again after initialization
        SerialUSB.print("DEBUG: MISO pin state after init: ");
        SerialUSB.println(digitalReadFast(DAC_CS));
        
        // Assert CS
        SerialUSB.println("DEBUG: Assert CS");
        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(20);
        
        // Check MISO after CS assertion
        SerialUSB.print("DEBUG: MISO pin state after CS assertion: ");
        SerialUSB.println(digitalReadFast(DAC_CS));
        
        // Send read command (0x0B)
        SerialUSB.println("DEBUG: Sending read command (0x0B)");
        pulpinoSpiSendByte(0x0B);
        
        // Send address (4 bytes)
        SerialUSB.print("DEBUG: Sending address: 0x");
        SerialUSB.println(addr, HEX);
        pulpinoSpiSendByte((addr >> 24) & 0xFF);
        pulpinoSpiSendByte((addr >> 16) & 0xFF);
        pulpinoSpiSendByte((addr >> 8) & 0xFF);
        pulpinoSpiSendByte(addr & 0xFF);
        
        // Send length (4 bytes)
        SerialUSB.println("DEBUG: Sending length (4 bytes)");
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x04);
        
        // Multiple dummy bytes for timing
        SerialUSB.println("DEBUG: Sending dummy bytes");
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        
        // Check MISO before reading data
        SerialUSB.print("DEBUG: MISO pin state before reading data: ");
        SerialUSB.println(digitalReadFast(DAC_CS));
        
        // Try wiggling the clock to see if we get any response
        SerialUSB.println("DEBUG: Wiggling clock to check for MISO activity");
        for (int i = 0; i < 8; i++) {
            digitalWriteFast(DP1_CS, HIGH);
            delayMicroseconds(20);
            SerialUSB.print(digitalReadFast(DAC_CS));
            digitalWriteFast(DP1_CS, LOW);
            delayMicroseconds(20);
        }
        SerialUSB.println();
        
        // Read data (4 bytes)
        SerialUSB.println("DEBUG: Reading data bytes");
        uint32_t result = 0;
        for (int i = 0; i < 4; i++) {
            uint8_t b = pulpinoSpiReceiveByte();
            SerialUSB.print("DEBUG: Byte ");
            SerialUSB.print(i);
            SerialUSB.print(" = 0x");
            SerialUSB.print(b, HEX);
            SerialUSB.print(" [");
            for (int bit = 7; bit >= 0; bit--) {
                SerialUSB.print((b >> bit) & 0x01);
            }
            SerialUSB.println("]");
            
            result = (result << 8) | b;
        }
        
        // Deassert CS
        SerialUSB.println("DEBUG: Deassert CS");
        digitalWriteFast(DP2_CS, HIGH);
        
        *value = result;
        
        SerialUSB.print("DEBUG: Read value: 0x");
        SerialUSB.println(result, HEX);
        
        return true;
    #else
        *value = 0;
        return false;
    #endif
}

// Send a command to PULPino and wait for result
bool MEDUSA::sendPulpinoCommand(uint32_t command, uint32_t data, uint32_t* result, uint32_t timeoutMs) 
{
    #ifdef ARDUINO_PLATFORM
        const uint32_t COMM_BUFFER_ADDR = 0x00080100;
        const uint32_t COMM_STATUS_ADDR = COMM_BUFFER_ADDR;
        const uint32_t COMM_COMMAND_ADDR = COMM_BUFFER_ADDR + 4;
        const uint32_t COMM_DATA_ADDR = COMM_BUFFER_ADDR + 8;
        const uint32_t COMM_RESULT_ADDR = COMM_BUFFER_ADDR + 12;
        
        const uint32_t COMM_READY = 0xAA;
        const uint32_t COMM_ACK = 0x55;
        // const uint32_t COMM_BUSY = 0xBB;  // Commented out unused constant
        const uint32_t COMM_ERROR = 0xEE;
        
        uint32_t status;
        
        // Check if PULPino is ready to accept commands
        if (!readPulpinoMemory(COMM_STATUS_ADDR, &status)) {
            SerialUSB.println("Error reading PULPino status");
            return false;
        }
        
        if (status != COMM_READY) {
            SerialUSB.print("PULPino not ready. Status: 0x");
            SerialUSB.println(status, HEX);
            return false;
        }
        
        // Send data first
        if (!writePulpinoMemory(COMM_DATA_ADDR, data)) {
            SerialUSB.println("Error writing data to PULPino");
            return false;
        }
        
        // Send command (this triggers processing)
        if (!writePulpinoMemory(COMM_COMMAND_ADDR, command)) {
            SerialUSB.println("Error writing command to PULPino");
            return false;
        }
        
        // Wait for command to complete (status = 2)
        bool commandCompleted = false;
        uint32_t startTime = millis();
        while ((millis() - startTime) < timeoutMs) {
            uint32_t status = 0;
            if (readPulpinoMemory(COMM_STATUS_ADDR, &status)) {
                if (status == 2) {
                    commandCompleted = true;
                    break;
                }
            }
            
            // Small delay to avoid hammering the SPI bus
            delay(10);
        }
        
        if (!commandCompleted) {
            SerialUSB.println("Timeout waiting for command to complete");
            return false;
        }
        
        // Read the result
        if (!readPulpinoMemory(COMM_RESULT_ADDR, result)) {
            SerialUSB.println("Error reading result from PULPino");
            return false;
        }
        
        SerialUSB.print("Command completed. Result: 0x");
        SerialUSB.println(*result, HEX);
        
        return true;
    #else
        return false;
    #endif
}

// Monitor PULPino execution by checking a status address
void MEDUSA::monitorPulpinoExecution(uint32_t timeout_ms)
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.println("Monitoring PULPino execution...");
        
        // Define the address of the status register or memory location to monitor
        // This should be an address that's updated by the PULPino program to indicate progress
        const uint32_t statusAddress = 0x1A11000C;  // Example: Debug Port Status Register
        
        uint32_t startTime = millis();
        uint32_t lastValue = 0;
        uint32_t currentValue = 0;
        bool firstRead = true;
        
        while ((millis() - startTime) < timeout_ms) {
            // Try to read the status
            uint32_t status = 0;
            if (readPulpinoMemory(statusAddress, &status)) {
                // Print the status value
                SerialUSB.print("Status: 0x");
                SerialUSB.println(status, HEX);
                
                // Check if status indicates completion
                if (status == 0xAA) {  // Example: 0xAA could indicate successful completion
                    SerialUSB.println("Program execution completed successfully!");
                    return;
                }
            }
            
            delay(500); // Check every 500ms
        }
        
        if ((millis() - startTime) >= timeout_ms) {
            SerialUSB.println("Monitoring timed out");
        }
    #endif
}

// Helper functions for bit-banged SPI communication
void MEDUSA::pulpinoSpiBegin() 
{
    // Use the digital potentiometer/DAC pins for PULPino SPI
    pinMode(DP2_CS, OUTPUT);   // Chip select
    pinMode(DP1_CS, OUTPUT);   // Clock
    pinMode(DP0_CS, OUTPUT);   // MOSI
    #ifdef INPUT_PULLDOWN
        pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
    #else
        pinMode(DAC_CS, INPUT);    // MISO
    #endif

    // Initialize state
    digitalWriteFast(DP2_CS, HIGH);  // CS inactive
    digitalWriteFast(DP1_CS, LOW);   // Clock low
    digitalWriteFast(DP0_CS, LOW);   // MOSI low
}

void MEDUSA::pulpinoSpiEnd() 
{
    digitalWriteFast(DP2_CS, HIGH);  // CS inactive
}

void MEDUSA::pulpinoSpiSendByte(uint8_t data) 
{
    for (int i = 7; i >= 0; i--) 
    {
        // Set data bit
        digitalWriteFast(DP0_CS, (data >> i) & 0x01);
        
        // Toggle clock
        digitalWriteFast(DP1_CS, HIGH);
        delayMicroseconds(20);  // Increased from 1 to 20
        digitalWriteFast(DP1_CS, LOW);
        delayMicroseconds(20);  // Increased from 1 to 20
    }
}

uint8_t MEDUSA::pulpinoSpiReceiveByte() 
{
    uint8_t data = 0;
    
    for (int i = 7; i >= 0; i--) 
    {
        // Toggle clock
        digitalWriteFast(DP1_CS, HIGH);
        delayMicroseconds(20);  // Increased from 1 to 20
        
        // Read data bit
        if (digitalReadFast(DAC_CS)) {
            data |= (1 << i);
        }
        
        digitalWriteFast(DP1_CS, LOW);
        delayMicroseconds(20);  // Increased from 1 to 20
    }
    
    #ifdef PULPINO_DEBUG_VERBOSE
    SerialUSB.print("RX: 0x");
    SerialUSB.print(data, HEX);
    SerialUSB.print(" [");
    for (int b = 7; b >= 0; b--) {
        SerialUSB.print((data >> b) & 0x01);
    }
    SerialUSB.println("]");
    #endif
    
    return data;
}

// Test SPI communication modes with PULPino
// This function tries different clock polarities and phases
bool MEDUSA::testPulpinoSpiModes() 
{
    SerialUSB.println("\n-----------------------------------------");
    SerialUSB.println("Testing PULPino SPI communication modes");
    SerialUSB.println("-----------------------------------------");
    
    // We'll try different combinations of clock polarity and phase
    // Mode 0: CPOL=0, CPHA=0 (clock idles low, data sampled on rising edge)
    // Mode 1: CPOL=0, CPHA=1 (clock idles low, data sampled on falling edge)
    // Mode 2: CPOL=1, CPHA=0 (clock idles high, data sampled on falling edge)
    // Mode 3: CPOL=1, CPHA=1 (clock idles high, data sampled on rising edge)
    
    // Test patterns to send
    uint32_t testAddress = 0x00080000;  // Boot ROM address
    uint32_t testValue = 0x12345678;
    
    // Array to store results for each mode
    bool modeResults[4] = {false, false, false, false};
    
    for (int mode = 0; mode < 4; mode++) {
        bool clockPolarity = (mode & 0x2) > 0;  // CPOL: mode 2,3
        bool clockPhase = (mode & 0x1) > 0;     // CPHA: mode 1,3
        
        SerialUSB.print("\nTesting SPI Mode ");
        SerialUSB.print(mode);
        SerialUSB.print(" (CPOL=");
        SerialUSB.print(clockPolarity ? "1" : "0");
        SerialUSB.print(", CPHA=");
        SerialUSB.print(clockPhase ? "1" : "0");
        SerialUSB.println(")");
        
        // Configure pins
        pinMode(DP2_CS, OUTPUT);   // Chip select
        pinMode(DP1_CS, OUTPUT);   // Clock
        pinMode(DP0_CS, OUTPUT);   // MOSI
        #ifdef INPUT_PULLDOWN
            pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
        #else
            pinMode(DAC_CS, INPUT);    // MISO
        #endif
        
        // Initialize clock to idle state based on CPOL
        digitalWriteFast(DP2_CS, HIGH);  // CS inactive (HIGH)
        digitalWriteFast(DP1_CS, clockPolarity ? LOW : HIGH);  // Set clock line to idle state based on CPOL
        digitalWriteFast(DP0_CS, LOW);   // MOSI starts low
        
        delay(10);  // Settle time
        
        // Perform a write followed by read test
        
        // 1. Write test value to memory
        SerialUSB.print("  Writing test value 0x");
        SerialUSB.print(testValue, HEX);
        SerialUSB.print(" to address 0x");
        SerialUSB.println(testAddress, HEX);
        
        // Assert CS
        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(10);
        
        // Send write command (0x02)
        spiTransferByte(0x02, clockPolarity, clockPhase);
        
        // Send address (4 bytes)
        spiTransferByte((testAddress >> 24) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testAddress >> 16) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testAddress >> 8) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte(testAddress & 0xFF, clockPolarity, clockPhase);
        
        // Send length (4 bytes)
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x04, clockPolarity, clockPhase);
        
        // Send the data (32-bit register value)
        spiTransferByte((testValue >> 24) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testValue >> 16) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testValue >> 8) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte(testValue & 0xFF, clockPolarity, clockPhase);
        
        // Deassert CS
        delayMicroseconds(10);
        digitalWriteFast(DP2_CS, HIGH);
        
        delay(50);  // Give PULPino time to process
        
        // 2. Read back the value
        SerialUSB.println("  Reading back value...");
        
        // Assert CS
        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(10);
        
        // Send read command (0x0B)
        spiTransferByte(0x0B, clockPolarity, clockPhase);
        
        // Send address
        spiTransferByte((testAddress >> 24) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testAddress >> 16) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte((testAddress >> 8) & 0xFF, clockPolarity, clockPhase);
        spiTransferByte(testAddress & 0xFF, clockPolarity, clockPhase);
        
        // Send length
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x04, clockPolarity, clockPhase);
        
        // Multiple dummy bytes for timing
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        spiTransferByte(0x00, clockPolarity, clockPhase);
        
        // Read data (4 bytes)
        uint32_t result = 0;
        result |= ((uint32_t)spiReceiveByte(clockPolarity, clockPhase) << 24);
        result |= ((uint32_t)spiReceiveByte(clockPolarity, clockPhase) << 16);
        result |= ((uint32_t)spiReceiveByte(clockPolarity, clockPhase) << 8);
        result |= spiReceiveByte(clockPolarity, clockPhase);
        
        // Deassert CS
        delayMicroseconds(10);
        digitalWriteFast(DP2_CS, HIGH);
        
        // Check if we got a non-zero value
        SerialUSB.print("  Read value: 0x");
        SerialUSB.print(result, HEX);
        SerialUSB.print(" [");
        for (int b = 31; b >= 0; b--) {
            SerialUSB.print((result >> b) & 0x01);
        }
        SerialUSB.println("]");
        
        if (result != 0) {
            SerialUSB.println("  SUCCESS: Received non-zero data!");
            modeResults[mode] = true;
            
            // If the data matches what we wrote, that's even better
            if (result == testValue) {
                SerialUSB.println("  PERFECT MATCH: Data read matches what was written!");
            }
        } else {
            SerialUSB.println("  FAIL: Still reading zeros.");
        }
        
        delay(100);  // Pause between tests
    }
    
    // Summary of results
    SerialUSB.println("\nSPI Mode Test Results:");
    for (int mode = 0; mode < 4; mode++) {
        SerialUSB.print("Mode ");
        SerialUSB.print(mode);
        SerialUSB.print(": ");
        SerialUSB.println(modeResults[mode] ? "SUCCESS" : "FAIL");
    }
    
    return (modeResults[0] || modeResults[1] || modeResults[2] || modeResults[3]);
}

// Add a function to update SPI mode based on test results
bool MEDUSA::updateSpiModeTo(uint8_t mode) {
    bool clockPolarity = false;
    bool clockPhase = false;
    
    // Determine clock polarity and phase based on mode
    switch (mode) {
        case 0:  // Mode 0: CPOL=0, CPHA=0
            clockPolarity = false;
            clockPhase = false;
            break;
        case 1:  // Mode 1: CPOL=0, CPHA=1
            clockPolarity = false;
            clockPhase = true;
            break;
        case 2:  // Mode 2: CPOL=1, CPHA=0
            clockPolarity = true;
            clockPhase = false;
            break;
        case 3:  // Mode 3: CPOL=1, CPHA=1
            clockPolarity = true;
            clockPhase = true;
            break;
        default:
            SerialUSB.println("Invalid SPI mode - defaulting to Mode 0");
            clockPolarity = false;
            clockPhase = false;
    }
    
    // Initialize SPI with the selected mode
    pulpinoSpiBeginMode(clockPolarity, clockPhase);
    
    SerialUSB.print("SPI Mode updated to Mode ");
    SerialUSB.print(mode);
    SerialUSB.print(" (CPOL=");
    SerialUSB.print(clockPolarity ? "1" : "0");
    SerialUSB.print(", CPHA=");
    SerialUSB.print(clockPhase ? "1" : "0");
    SerialUSB.println(")");
    
    return true;
}

// Test hardware loopback
bool MEDUSA::testSpiLoopback() {
    SerialUSB.println("\n-----------------------------------------");
    SerialUSB.println("Testing SPI Hardware Loopback");
    SerialUSB.println("-----------------------------------------");
    
    // For this test, we need to connect MOSI (DP0_CS) to MISO (DAC_CS) with a jumper wire
    SerialUSB.println("IMPORTANT: Connect a jumper wire from MOSI (DP0_CS) to MISO (DAC_CS)");
    SerialUSB.println("Running loopback test automatically...");
    
    // Configure pins
    pinMode(DP2_CS, OUTPUT);   // Chip select
    pinMode(DP1_CS, OUTPUT);   // Clock
    pinMode(DP0_CS, OUTPUT);   // MOSI
    #ifdef INPUT_PULLDOWN
        pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
    #else
        pinMode(DAC_CS, INPUT);    // MISO
    #endif

    // Initialize default states
    digitalWriteFast(DP2_CS, HIGH);  // CS inactive
    digitalWriteFast(DP1_CS, LOW);   // Clock low
    digitalWriteFast(DP0_CS, LOW);   // MOSI low
    
    delay(10);  // Settle time
    
    // Test patterns to send
    uint8_t testPatterns[] = {0x55, 0xAA, 0xFF, 0x00, 0x01, 0x80, 0x33, 0xCC};
    bool testPassed = true;
    
    SerialUSB.println("Sending test patterns and checking loopback...");
    
    for (unsigned int i = 0; i < sizeof(testPatterns); i++) {
        uint8_t pattern = testPatterns[i];
        uint8_t received = 0;
        
        // Send and receive the pattern
        for (int bit = 7; bit >= 0; bit--) {
            // Set data bit
            digitalWriteFast(DP0_CS, (pattern >> bit) & 0x01);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Toggle clock
            digitalWriteFast(DP1_CS, HIGH);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Read bit from MISO
            if (digitalReadFast(DAC_CS)) {
                received |= (1 << bit);
            }
            
            digitalWriteFast(DP1_CS, LOW);
            delayMicroseconds(20);  // Increased from 5 to 20
        }
        
        // Check if received matches sent
        SerialUSB.print("Pattern 0x");
        SerialUSB.print(pattern, HEX);
        SerialUSB.print(" -> Received 0x");
        SerialUSB.print(received, HEX);
        
        if (pattern == received) {
            SerialUSB.println(" [MATCH]");
        } else {
            SerialUSB.println(" [MISMATCH]");
            testPassed = false;
        }
    }
    
    if (testPassed) {
        SerialUSB.println("Loopback test PASSED! SPI hardware is working correctly.");
    } else {
        SerialUSB.println("Loopback test FAILED! Check connections and pin configuration.");
    }
    
    return testPassed;
}

// Test PULPino reset sequence
void MEDUSA::testPULPinoReset() {
  SerialUSB.println("----------- PULPino Reset Sequence Test -----------");
  
  SerialUSB.println("Resetting PULPino...");
  
  // More aggressive reset sequence - try multiple pulses
  for (int i = 0; i < 3; i++) {
    // Toggle reset
    digitalWriteFast(RSTN, LOW);  // Assert reset
    delay(200);  // Hold longer
    digitalWriteFast(RSTN, HIGH); // Deassert reset
    delay(200);  // Wait longer
  }
  
  SerialUSB.println("Reset sequence completed");
  
  // Test FETCH_EN signal
  SerialUSB.println("Testing FETCH_EN signal...");
  for (int i = 0; i < 3; i++) {
    digitalWriteFast(FETCH_EN, HIGH);
    delay(50);
    digitalWriteFast(FETCH_EN, LOW);
    delay(50);
  }
  SerialUSB.println("FETCH_EN toggled");
  SerialUSB.println("----------- Test Complete -----------");
}

// Reset PULPino
void MEDUSA::resetPulpino()
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.println("Resetting PULPino...");
        
        // Configure reset pin as output
        pinMode(RSTN, OUTPUT);
        
        // Configure FETCH_EN pin as output
        pinMode(FETCH_EN, OUTPUT);
        
        // Perform multiple reset pulses for increased reliability
        for (int i = 0; i < 3; i++) {
            // Assert reset (active low)
            digitalWriteFast(RSTN, LOW);
            delay(100); // Hold reset longer (100ms)
            
            // Deassert reset
            digitalWriteFast(RSTN, HIGH);
            delay(100); // Wait longer after reset
        }
        
        // Toggle FETCH_EN
        digitalWriteFast(FETCH_EN, LOW);
        delay(10);
        digitalWriteFast(FETCH_EN, HIGH);
        delay(50);
        digitalWriteFast(FETCH_EN, LOW);
        
        SerialUSB.println("PULPino reset complete");
    #endif
}

// Initialize PULPino
bool MEDUSA::initPulpino()
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.println("Initializing PULPino...");
        
        // Configure pins
        pinMode(DP0_CS, OUTPUT);  // MOSI
        pinMode(DP1_CS, OUTPUT);  // SCK
        pinMode(DP2_CS, OUTPUT);  // CS
        pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
        
        // Reset and initialize PULPino
        resetPulpino();
        
        // Initialize SPI pins to idle state
        digitalWriteFast(DP0_CS, LOW);   // MOSI idle
        digitalWriteFast(DP1_CS, LOW);   // SCK idle (assuming Mode 0)
        digitalWriteFast(DP2_CS, HIGH);  // CS idle (deasserted)
        
        // Write a test pattern to a safe memory location to verify communication
        uint32_t testPattern = 0xA5A5A5A5;
        uint32_t readback = 0;
        uint32_t testAddress = 0x1A000000; // A safe memory location
        
        if (writePulpinoMemory(testAddress, testPattern)) {
            delay(10); // Short delay between write and read
            
            if (readPulpinoMemory(testAddress, &readback)) {
                if (readback == testPattern) {
                    SerialUSB.println("PULPino initialization successful!");
                    return true;
                } else {
                    SerialUSB.print("Communication test failed. Expected: 0x");
                    SerialUSB.print(testPattern, HEX);
                    SerialUSB.print(", Got: 0x");
                    SerialUSB.println(readback, HEX);
                }
            } else {
                SerialUSB.println("Failed to read from PULPino");
            }
        } else {
            SerialUSB.println("Failed to write to PULPino");
        }
        
        return false;
    #else
        return false;
    #endif
}

// Flash PULPino RISC-V processor with a binary file
void MEDUSA::flashPulpino(const char* filename)
{
    #ifdef ARDUINO_PLATFORM
        SerialUSB.println("Flashing PULPino with file: " + String(filename));

        // Check if the file exists
        if (!SD.exists(filename)) 
        {
            SerialUSB.println("Error: File not found");
            return;
        }

        // Open the binary file
        File binFile = SD.open(filename, FILE_READ);
        if (!binFile) 
        {
            SerialUSB.println("Error opening binary file");
            return;
        }

        // Get file size
        uint32_t fileSize = binFile.size();
        SerialUSB.print("Binary file size: ");
        SerialUSB.print(fileSize);
        SerialUSB.println(" bytes");

        // Reset PULPino before flashing
        resetPulpino();
        
        // Initialize SPI for PULPino communication
        pulpinoSpiBegin();
        
        // Define instruction memory address for embedded PULPino
        // Address 1 is instruction memory (original was 0x00080000)
        uint32_t instructionMemAddr = 0x00000001; 
        
        SerialUSB.println("Writing to PULPino instruction memory: 0x" + String(instructionMemAddr, HEX));
        
        // PULPino SPI Slave Protocol for write (according to datasheet):
        // 1. Send Write Command (0x02)
        // 2. Send 32-bit address MSB first
        // 3. Send data bytes

        digitalWriteFast(DP2_CS, LOW);
        delayMicroseconds(20); // Added delay for more reliable communication
        
        // Send write command
        pulpinoSpiSendByte(0x02);
        
        // Send 32-bit address
        pulpinoSpiSendByte((instructionMemAddr >> 24) & 0xFF);
        pulpinoSpiSendByte((instructionMemAddr >> 16) & 0xFF);
        pulpinoSpiSendByte((instructionMemAddr >> 8) & 0xFF);
        pulpinoSpiSendByte(instructionMemAddr & 0xFF);
        
        // Send length (4 bytes for one 32-bit word)
        pulpinoSpiSendByte(0x00);  // 4 bytes
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x00);
        pulpinoSpiSendByte(0x04);
        
        // Transfer binary data in chunks
        const int bufferSize = 256;
        uint8_t buffer[bufferSize];
        int bytesRead;
        uint32_t totalSent = 0;

        SerialUSB.println("Transferring binary data...");
        
        while (totalSent < fileSize) {
            // Read chunk from file
            bytesRead = binFile.read(buffer, static_cast<int>(min(static_cast<uint32_t>(bufferSize), fileSize - totalSent)));
            
            // Send chunk over SPI
            for (int i = 0; i < bytesRead; i++) {
                pulpinoSpiSendByte(buffer[i]);
            }
            
            totalSent += bytesRead;
            
            // Show progress every 4KB
            if (totalSent % 4096 == 0) {
                SerialUSB.print(".");
            }
        }
        
        // End SPI transaction
        delayMicroseconds(20); // Added delay for more reliable communication
        digitalWriteFast(DP2_CS, HIGH);
        pulpinoSpiEnd();
        
        // Close file
        binFile.close();
        
        SerialUSB.println("\nFlashing complete!");
        SerialUSB.println("Starting program execution...");
        
        // Make sure RSTN is high (not in reset)
        digitalWriteFast(RSTN, HIGH);
        delay(50);
        
        // Set FETCH_EN high to start instruction fetch
        digitalWriteFast(FETCH_EN, HIGH);
        
        // Wait for FETCH_DONE signal if needed
        int timeout = 1000; // 1 second timeout
        while (digitalReadFast(FETCH_DONE) == LOW && timeout > 0) {
            delay(1);
            timeout--;
        }
        
        if (timeout <= 0) {
            SerialUSB.println("Warning: FETCH_DONE signal not received within timeout");
        } else {
            SerialUSB.println("FETCH_DONE signal received - PULPino ready");
        }
        
        SerialUSB.println("PULPino program started");
    #endif
}

// Set peripheral voltages
void MEDUSA::setVDD(float voltage) 
{
    uint16_t value = DAC.voltageToCode(voltage, 0);  // Convert voltage to DAC code
    DAC.setDAC5(value);  // Set VDD
    DAC.setDAC6(value);  // Set VDD
    DAC.setDAC7(value);  // Set VDD

    VDD = voltage;  // Record VDD
}

void MEDUSA::setVCM(float voltage) 
{
    uint16_t value = DAC.voltageToCode(voltage, 0);  // Convert voltage to DAC code
    DAC.setDAC0(value);  // Set VCM

    VCM = voltage;  // Record VCM
}

void MEDUSA::setVREF(float voltage) 
{
    uint16_t value = DAC.voltageToCode(voltage, 0);  // Convert voltage to DAC code
    DAC.setDAC1(value);  // Set VREF

    VREF = voltage;  // Record VREF
}

void MEDUSA::setVESD(float voltage) 
{
    uint16_t value = DAC.voltageToCode(voltage, 0);  // Convert voltage to DAC code

    DAC.setDAC2(value);  // Set VESD
    DAC.setDAC3(value);  // Set VESD
    DAC.setDAC4(value);  // Set VESD

    VESD = voltage;  // Record VESD
}

// Set peripheral currents
void MEDUSA::setI_TIA(float current) 
{
    uint16_t value = current2Code(current, TIA_OFFSET_R);  // Convert current to digital potentiometer code

    digipot0.write(MAX5497_WRITE_WIPER1, value);  // Set I_TIA

    I_TIA = current;  // Record I_TIA
}

void MEDUSA::setI_BLD_N(float current) 
{
    uint16_t value = current2Code(current, BLD_N_OFFSET_R);  // Convert current to digital potentiometer code

    digipot0.write(MAX5497_WRITE_WIPER2, value);  // Set I_BLD_N

    I_BLD_N = current;  // Record I_BLD_N
}

void MEDUSA::setI_BREAK(float current) 
{
    uint16_t value = current2Code(current, BREAK_OFFSET_R);  // Convert current to digital potentiometer code

    digipot1.write(MAX5497_WRITE_WIPER1, value);  // Set I_BREAK

    I_BREAK = current;  // Record I_BREAK
}

void MEDUSA::setI_MAKE(float current) 
{
    uint16_t value = current2Code(current, MAKE_OFFSET_R);  // Convert current to digital potentiometer code
    
    digipot1.write(MAX5497_WRITE_WIPER2, value);  // Set I_MAKE

    I_MAKE = current;  // Record I_MAKE
}

void MEDUSA::setI_BLD_P(float current) 
{
    uint16_t value = current2Code(current, BLD_P_OFFSET_R);  // Convert current to digital potentiometer code

    digipot2.write(MAX5497_WRITE_WIPER1, value);  // Set I_BLD_P

    I_BLD_P = current;  // Record I_BLD_P
}

void MEDUSA::setI_CMP(float current)
{
    uint16_t value = current2Code(current, CMP_OFFSET_R);  // Convert current to digital potentiometer code

    digipot2.write(MAX5497_WRITE_WIPER2, value);  // Set I_CMP

    I_CMP = current;  // Record I_CMP
}

// Convert current to digital potentiometer code
uint16_t MEDUSA::current2Code(float current, uint32_t offset) 
{
    // Calculate resistance of current source
    float resistance = (227E-6 * (TEMP + 273.15) / current) - offset;    
    // Convert resistance to code
    uint16_t code = (resistance / 50E3) * 1023;    

    return code;
}

// Helper function to transfer a byte with configurable clock polarity and phase
void MEDUSA::spiTransferByte(uint8_t data, bool clockPolarity, bool clockPhase) {
    #ifdef PULPINO_DEBUG_VERBOSE
    SerialUSB.print("TX: 0x");
    SerialUSB.print(data, HEX);
    SerialUSB.print(" [");
    for (int b = 7; b >= 0; b--) {
        SerialUSB.print((data >> b) & 0x01);
    }
    SerialUSB.println("]");
    #endif
    
    // For CPHA=0, the data is set up before the first clock edge
    // For CPHA=1, the data is set up after the first clock edge
    
    for (int i = 7; i >= 0; i--) {
        if (clockPhase == 0) {
            // Set data bit before first clock edge
            digitalWriteFast(DP0_CS, (data >> i) & 0x01);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // First clock edge (idle->active)
            digitalWriteFast(DP1_CS, clockPolarity ? LOW : HIGH);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Second clock edge (active->idle)
            digitalWriteFast(DP1_CS, clockPolarity ? HIGH : LOW);
            delayMicroseconds(20);  // Increased from 5 to 20
        } else {
            // First clock edge (idle->active)
            digitalWriteFast(DP1_CS, clockPolarity ? LOW : HIGH);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Set data bit after first clock edge
            digitalWriteFast(DP0_CS, (data >> i) & 0x01);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Second clock edge (active->idle)
            digitalWriteFast(DP1_CS, clockPolarity ? HIGH : LOW);
            delayMicroseconds(20);  // Increased from 5 to 20
        }
    }
}

// Helper function to receive a byte with configurable clock polarity and phase
uint8_t MEDUSA::spiReceiveByte(bool clockPolarity, bool clockPhase) {
    uint8_t data = 0;
    
    for (int i = 7; i >= 0; i--) {
        if (clockPhase == 0) {
            // First clock edge (idle->active)
            digitalWriteFast(DP1_CS, clockPolarity ? LOW : HIGH);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Sample data at first clock edge (for CPHA=0)
            if (digitalReadFast(DAC_CS)) {
                data |= (1 << i);
            }
            
            digitalWriteFast(DP1_CS, clockPolarity ? HIGH : LOW);
            delayMicroseconds(20);  // Increased from 5 to 20
        } else {
            // First clock edge (idle->active)
            digitalWriteFast(DP1_CS, clockPolarity ? LOW : HIGH);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Second clock edge (active->idle)
            digitalWriteFast(DP1_CS, clockPolarity ? HIGH : LOW);
            delayMicroseconds(20);  // Increased from 5 to 20
            
            // Sample data at second clock edge (for CPHA=1)
            if (digitalReadFast(DAC_CS)) {
                data |= (1 << i);
            }
        }
    }
    
    #ifdef PULPINO_DEBUG_VERBOSE
    SerialUSB.print("RX: 0x");
    SerialUSB.print(data, HEX);
    SerialUSB.print(" [");
    for (int b = 7; b >= 0; b--) {
        SerialUSB.print((data >> b) & 0x01);
    }
    SerialUSB.println("]");
    #endif
    
    return data;
}

// Initialize SPI with specific clock polarity and phase
void MEDUSA::pulpinoSpiBeginMode(bool clockPolarity, bool clockPhase) 
{
    SerialUSB.print("Initializing SPI with CPOL=");
    SerialUSB.print(clockPolarity ? "1" : "0");
    SerialUSB.print(", CPHA=");
    SerialUSB.print(clockPhase ? "1" : "0");
    SerialUSB.println(")");
    
    // Configure pins
    pinMode(DP2_CS, OUTPUT);   // Chip select
    pinMode(DP1_CS, OUTPUT);   // Clock
    pinMode(DP0_CS, OUTPUT);   // MOSI
    #ifdef INPUT_PULLDOWN
        pinMode(DAC_CS, INPUT_PULLDOWN);  // MISO with pull-down
    #else
        pinMode(DAC_CS, INPUT);    // MISO
    #endif
    
    // Initialize clock to idle state based on CPOL
    digitalWriteFast(DP2_CS, HIGH);  // CS inactive
    digitalWriteFast(DP1_CS, clockPolarity ? HIGH : LOW);  // Set clock line to idle state based on CPOL
    digitalWriteFast(DP0_CS, LOW);   // MOSI starts low
    
    delay(10);  // Settle time
}