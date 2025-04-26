# Makefile for PULPino RISC-V blink program

# Path to RISC-V toolchain
RISCV_PATH = /opt/homebrew/Cellar/riscv-gnu-toolchain/main/bin

# Toolchain prefix with full path
PREFIX = $(RISCV_PATH)/riscv64-unknown-elf

# Define tools with full paths
CC = $(PREFIX)-gcc
OBJCOPY = $(PREFIX)-objcopy
OBJDUMP = $(PREFIX)-objdump
SIZE = $(PREFIX)-size

# Compiler flags
CFLAGS = -march=rv32imc -mabi=ilp32 -O2 -nostartfiles -nostdlib
CFLAGS += -T pulpino_link.ld

# Source files
SRCS = blink.c
TARGET = blink

# Target definitions
.PHONY: all clean qemu flash hex deploy

all: $(TARGET).bin $(TARGET).dump

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET).elf: $(SRCS:.c=.o)
	$(CC) $(CFLAGS) $^ -o $@

$(TARGET).bin: $(TARGET).elf
	$(OBJCOPY) -O binary $< $@
	$(SIZE) $<

$(TARGET).hex: $(TARGET).elf
	$(OBJCOPY) -O ihex $< $@

$(TARGET).dump: $(TARGET).elf
	$(OBJDUMP) -d $< > $@

qemu: $(TARGET).bin
	qemu-system-riscv32 -machine sifive_e -nographic -kernel $<

flash: $(TARGET).bin
	@echo "Copy $(TARGET).bin to the SD card in the /BIN_Files/firmware/ directory"
	@echo "Connect to the MEDUSA terminal and type 'flash /BIN_Files/firmware/$(TARGET).bin'"

# Copy the binary to SD card if mounted
copy-to-sd: $(TARGET).bin
	@if [ -d "/Volumes/PLATFORMIO" ]; then \
		mkdir -p "/Volumes/PLATFORMIO/BIN_Files/firmware"; \
		cp $(TARGET).bin "/Volumes/PLATFORMIO/BIN_Files/firmware/"; \
		echo "Copied $(TARGET).bin to SD card"; \
	else \
		echo "SD card not mounted at /Volumes/PLATFORMIO"; \
	fi

# Compile and upload Teensy firmware, then monitor
teensy-deploy:
	@echo "Building and uploading Teensy firmware..."
	platformio run --target upload --target monitor --environment teensy41

# Full deployment: compile RISC-V, build Teensy, and set up for flashing
deploy: $(TARGET).bin
	@echo "=========== RISC-V Binary Built ==========="
	@echo "Binary size: `wc -c < $(TARGET).bin` bytes"
	@echo "=========== Deploying to Teensy ==========="
	@echo "NOTE: After Teensy boots, type 'flash' in the terminal"
	@echo "to flash the PULPino with the compiled binary"
	@echo "============================================"
	platformio run --target upload --target monitor --environment teensy41

# Run tests instead of normal code
test: $(TARGET).bin
	@echo "=========== RISC-V Binary Built ==========="
	@echo "Binary size: `wc -c < $(TARGET).bin` bytes"
	@echo "=========== Running PULPino Tests ==========="
	@echo "Running test code from test/main.cpp"
	@echo "============================================"
	platformio run -e test --target upload --target monitor
	
clean:
	rm -f *.o *.elf *.bin *.dump *.hex
