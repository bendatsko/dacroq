/* pulpino.ld */
ENTRY(main)

SECTIONS {
  /* Place code at the very start of instr‐RAM */
  . = 0x00000000;
  .text : { *(.text*) }
  .rodata : { *(.rodata*) }
  .data : { *(.data*) }
  .bss :   { *(.bss*) }
}
