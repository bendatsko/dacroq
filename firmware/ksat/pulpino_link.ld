/* pulpino_link.ld - Linker script for PULPino RISC-V processor */

ENTRY(_start)

MEMORY
{
  /* PULPino has 32KB of RAM starting at 0x00000000 */
  RAM (rwx) : ORIGIN = 0x00000000, LENGTH = 32K
  
  /* Boot ROM maps to 0x00080000 */
  ROM (rx)  : ORIGIN = 0x00080000, LENGTH = 8K
}

SECTIONS
{
  /* Code section goes to ROM */
  .text : {
    . = ALIGN(4);
    KEEP(*(.vectors)) /* Vector table */
    *(.text.startup)  /* Startup code */
    *(.text.init)     /* Initialization code */
    *(.text)          /* Regular code */
    *(.text.*)        /* Other code sections */
    . = ALIGN(4);
  } > ROM

  /* Read-only data sections */
  .rodata : {
    . = ALIGN(4);
    *(.rodata)
    *(.rodata.*)
    . = ALIGN(4);
  } > ROM

  /* Initialized data - stored in ROM, copied to RAM at startup */
  .data : {
    . = ALIGN(4);
    _data = .;
    *(.data)
    *(.data.*)
    . = ALIGN(4);
    _edata = .;
  } > RAM AT > ROM

  /* BSS section - zero-initialized data */
  .bss : {
    . = ALIGN(4);
    _bss = .;
    *(.bss)
    *(.bss.*)
    *(COMMON)
    . = ALIGN(4);
    _ebss = .;
  } > RAM
}

/* Define stack pointer and heap symbols */
_stack_size = 1024;
_heap_size = 2048;
_end = ALIGN(8);