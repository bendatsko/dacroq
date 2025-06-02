#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#define MAX_VARIABLES 50
#define MAX_CLAUSES 224

void parse_cnf_file(const char *filename, int *num_vars, int *num_clauses, int clauses[MAX_CLAUSES][3]) {
    FILE *file = fopen(filename, "r");
    if (file == NULL) {
        perror("Failed to open file");
        exit(EXIT_FAILURE);
    }

    char line[256];
    while (fgets(line, sizeof(line), file)) {
        if (line[0] == 'c') {
            continue; // Skip comment lines
        } else if (line[0] == 'p') {
            sscanf(line, "p cnf %d %d", num_vars, num_clauses);
        } else {
            static int clause_index = 0;
            int var1, var2, var3;
            sscanf(line, "%d %d %d", &var1, &var2, &var3);
            clauses[clause_index][0] = var1;
            clauses[clause_index][1] = var2;
            clauses[clause_index][2] = var3;
            clause_index++;
        }
    }

    fclose(file);
}

void generate_bitstream(int num_vars, int num_clauses, int clauses[MAX_CLAUSES][3], const char *output_filename) {
    FILE *output_file = fopen(output_filename, "w");
    if (output_file == NULL) {
        perror("Failed to open output file");
        exit(EXIT_FAILURE);
    }

    for (int c = 0; c < MAX_CLAUSES; c++) {
        for (int i = 0; i < 3; i++) {
            if (c < num_clauses) {
                int literal = clauses[c][i];
                int var_index = abs(literal) - 1;

                // Clause activation bit
                char activation_bit = (i == 0) ? '1' : '0';
                fprintf(output_file, "%c", activation_bit);

                // Clause literal bit
                char literal_bit = (literal > 0) ? '1' : '0';
                fprintf(output_file, "%c", literal_bit);

                // 50 bits for choosing 1 spin as input
                for (int v = 0; v < MAX_VARIABLES; v++) {
                    char bit = (v == var_index) ? '1' : '0';
                    fprintf(output_file, "%c", bit);
                }
                fprintf(output_file, "\n");
            } else {
                // Clause deactivation bit
                char deactivation_bit = '0';
                fprintf(output_file, "%c", deactivation_bit);

                // Clause literal bit
                char literal_bit = '0';
                fprintf(output_file, "%c", literal_bit);

                for (int v = 0; v < MAX_VARIABLES; v++) {
                    char bit = '0';
                    fprintf(output_file, "%c", bit);
                }
                fprintf(output_file, "\n");
            }
        }
    }

    fflush(output_file);
    fclose(output_file);
}

void rearrange_data(const char *input_filename, const char *cnf_filename) {
    FILE *input_file = fopen(input_filename, "r");
    if (input_file == NULL) {
        perror("Failed to open input file");
        exit(EXIT_FAILURE);
    }

    // Create output filenames by removing the .cnf extension
    char cnf_basename[256];
    strncpy(cnf_basename, cnf_filename, sizeof(cnf_basename));
    char *dot = strrchr(cnf_basename, '.');
    if (dot) {
        *dot = '\0'; // Remove the .cnf extension
    }

    char output_filename1[256], output_filename2[256], output_filename3[256];
    char output_filename1_txt[256], output_filename2_txt[256], output_filename3_txt[256];
    snprintf(output_filename1, sizeof(output_filename1), "input1_%s.bin", cnf_basename);
    snprintf(output_filename2, sizeof(output_filename2), "input2_%s.bin", cnf_basename);
    snprintf(output_filename3, sizeof(output_filename3), "input3_%s.bin", cnf_basename);
    snprintf(output_filename1_txt, sizeof(output_filename1), "input1_%s.c", cnf_basename);
    snprintf(output_filename2_txt, sizeof(output_filename2), "input2_%s.c", cnf_basename);
    snprintf(output_filename3_txt, sizeof(output_filename3), "input3_%s.c", cnf_basename);

    // Open three binary output files for each input of the scan chain
    FILE *output_file1 = fopen(output_filename1, "wb");
    FILE *output_file2 = fopen(output_filename2, "wb");
    FILE *output_file3 = fopen(output_filename3, "wb");
    FILE *output_file1_txt = fopen(output_filename1_txt, "wb");
    FILE *output_file2_txt = fopen(output_filename2_txt, "wb");
    FILE *output_file3_txt = fopen(output_filename3_txt, "wb");

    if (output_file1 == NULL || output_file2 == NULL || output_file3 == NULL) {
        perror("Failed to open output files");
        exit(EXIT_FAILURE);
    }

    char lines[MAX_CLAUSES * 3][54]; // 54 = 1 activation bit + 1 literal bit + 50 spin bits + 1 newline character + 1 null terminator
    int line_count = 0;

    while (fgets(lines[line_count], sizeof(lines[line_count]), input_file)) {
        lines[line_count][strcspn(lines[line_count], "\n")] = 0; // Remove the newline character
        printf("Read line %d: %s\n", line_count + 1, lines[line_count]); // Debugging output
        line_count++;
    }

    // Ensure all lines were read
    printf("Total lines read: %d\n", line_count);

    fprintf(output_file1_txt, "#include <stdint.h>\n");
    fprintf(output_file1_txt, "uint8_t binary_dat1[] = {");
    fprintf(output_file2_txt, "#include <stdint.h>\n");
    fprintf(output_file2_txt, "uint8_t binary_dat2[] = {");
    fprintf(output_file3_txt, "#include <stdint.h>\n");
    fprintf(output_file3_txt, "uint8_t binary_dat3[] = {");

    for (int i = line_count - 1; i >= 0; i--) {
        FILE *current_output_file;
        FILE *current_output_file_txt;
        if (i % 3 == 0) {
            current_output_file = output_file1;
            current_output_file_txt = output_file1_txt;
        } else if (i % 3 == 1) {
            current_output_file = output_file2;
            current_output_file_txt = output_file2_txt;
        } else {
            current_output_file = output_file3;
            current_output_file_txt = output_file3_txt;
        }

        uint32_t buffer = 0;
        int bit_count = 0;

        if ((line_count - 1 - i) % 2 == 0) {
            // Write MSB first
            for (int j = 0; j < strlen(lines[i]); j++) {
                buffer = (buffer << 1) | (lines[i][j] - '0');
                bit_count++;
                // write txt FILE
                fwrite(&lines[i][j], sizeof(char), 1, current_output_file_txt);
                fwrite(", ", sizeof(char), 2, current_output_file_txt);
                if (bit_count == 32) {
                    fwrite(&buffer, sizeof(buffer), 1, current_output_file);
                    buffer = 0;
                    bit_count = 0;
                }
            }
        } else {
            // Write LSB first, reversing the line
            for (int j = strlen(lines[i]) - 1; j >= 0; j--) {
                buffer = (buffer << 1) | (lines[i][j] - '0');
                bit_count++;
                // write txt FILE
                fwrite(&lines[i][j], sizeof(char), 1, current_output_file_txt);
                if ((j>0) | (i>0)) {
                    fwrite(", ", sizeof(char), 2, current_output_file_txt);
                }
                if (bit_count == 32) {
                    fwrite(&buffer, sizeof(buffer), 1, current_output_file);
                    buffer = 0;
                    bit_count = 0;
                }
            }
        }

        // Write remaining bits if any
        if (bit_count > 0) {
            buffer <<= (32 - bit_count); // Pad the remaining bits with zeros
            fwrite(&buffer, sizeof(buffer), 1, current_output_file);
        }
    }
    fprintf(output_file1_txt, "};");
    fprintf(output_file2_txt, "};");
    fprintf(output_file3_txt, "};");

    // Ensure the files are written and closed
    fflush(output_file1);
    fclose(output_file1);
    fflush(output_file2);
    fclose(output_file2);
    fflush(output_file3);
    fclose(output_file3);

    fclose(input_file);
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <cnf-file>\n", argv[0]);
        return EXIT_FAILURE;
    }

    const char *cnf_filename = argv[1];
    int num_vars = 0;
    int num_clauses = 0;
    int clauses[MAX_CLAUSES][3] = {0};

    parse_cnf_file(cnf_filename, &num_vars, &num_clauses, clauses);

    // Create output filename based on the CNF filename
    char cnf_basename[256];
    strncpy(cnf_basename, cnf_filename, sizeof(cnf_basename));
    char *dot = strrchr(cnf_basename, '.');
    if (dot) {
        *dot = '\0'; // Remove the .cnf extension
    }

    char output_filename[256];
    snprintf(output_filename, sizeof(output_filename), "%s.txt", cnf_basename);

    generate_bitstream(num_vars, num_clauses, clauses, output_filename);

    // Ensure the file is completely written before rearranging
    fflush(stdout);
    rearrange_data(output_filename, cnf_basename);

    return 0;
}
