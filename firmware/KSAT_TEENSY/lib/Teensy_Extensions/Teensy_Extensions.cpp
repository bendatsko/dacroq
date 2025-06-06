// Project: Teensy Extensions
// Authors: Luke Wormald

#include "Teensy_Extensions.h"

// Pin mode initialization with programmable drive strength
void pinModeExt(uint8_t pin, uint8_t mode, uint8_t strength)
    {
        const struct digital_pin_bitband_and_config_table_struct *p;

        if (pin >= CORE_NUM_DIGITAL) return;
        p = digital_pin_to_info_PGM + pin;

        if(mode == OUTPUT || mode == OUTPUT_OPENDRAIN)
            {
            *(p->reg + 1) |= p->mask; // TODO: atomic
            if (mode == OUTPUT) // Default
            {
            switch(strength)
                {
                case 1:
                *(p->pad) = IOMUXC_PAD_DSE(1);
                break;
                case 2:
                *(p->pad) = IOMUXC_PAD_DSE(2);
                break;
                case 3:
                *(p->pad) = IOMUXC_PAD_DSE(3);
                break;
                case 4:
                *(p->pad) = IOMUXC_PAD_DSE(4);
                break;
                case 5:
                *(p->pad) = IOMUXC_PAD_DSE(5);
                break;
                case 6:
                *(p->pad) = IOMUXC_PAD_DSE(6);
                break;
                case 7:
                *(p->pad) = IOMUXC_PAD_DSE(7);
                break;
                default:
                *(p->pad) = IOMUXC_PAD_DSE(7);
                break;
                }
            }
            else
            { // OUTPUT_OPENDRAIN
            *(p->pad) = IOMUXC_PAD_DSE(7) | IOMUXC_PAD_ODE;
            }
            }
        else
            {
            *(p->reg + 1) &= ~(p->mask); // TODO: atomic
            if (mode == INPUT)
            {
            *(p->pad) = IOMUXC_PAD_DSE(7);
            }
            else if (mode == INPUT_PULLUP)
            {
            *(p->pad) = IOMUXC_PAD_DSE(7) | IOMUXC_PAD_PKE | IOMUXC_PAD_PUE | IOMUXC_PAD_PUS(3) | IOMUXC_PAD_HYS;
            }
            else if (mode == INPUT_PULLDOWN)
            {
            *(p->pad) = IOMUXC_PAD_DSE(7) | IOMUXC_PAD_PKE | IOMUXC_PAD_PUE | IOMUXC_PAD_PUS(0) | IOMUXC_PAD_HYS;
            }
            else
            { // INPUT_DISABLE
            *(p->pad) = IOMUXC_PAD_DSE(7) | IOMUXC_PAD_HYS;
            }
            }
        *(p->mux) = 5 | 0x10;
    }