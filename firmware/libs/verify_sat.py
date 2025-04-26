#!/usr/bin/env python3
import os
import json
import argparse
import statistics

def parse_cnf(filepath):
    """
    Parse a CNF file.
    Returns: num_vars, num_clauses, and a list of clauses (each clause is a list of integers).
    """
    clauses = []
    num_vars = None
    num_clauses = None
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            # Ignore comments and empty lines
            if not line or line.startswith('c'):
                continue
            if line.startswith('p'):
                # Expect a header of the form: p cnf <num_vars> <num_clauses>
                parts = line.split()
                if len(parts) >= 4:
                    num_vars = int(parts[2])
                    num_clauses = int(parts[3])
            else:
                # Parse clause line (literals terminated by 0)
                parts = line.split()
                # Remove the trailing 0 (if present) and convert to ints
                literals = [int(x) for x in parts if x != '0']
                if literals:
                    clauses.append(literals)
    return num_vars, num_clauses, clauses

def parse_assignment(config, expected_length):
    """
    Parse an assignment from a list of numbers.
    Raises a ValueError if the length does not match the expected number of variables.
    Returns a boolean list (1 is True, anything else is False).
    """
    if not isinstance(config, list):
        raise ValueError(f"Configuration is not a list: {config}")
    if len(config) != expected_length:
        raise ValueError(f"Assignment length {len(config)} does not match expected {expected_length}")
    return [True if int(x) == 1 else False for x in config]

def check_solution(assignment, clauses):
    """
    Given a boolean assignment (list where index 0 corresponds to variable 1)
    and a list of clauses, verify that each clause is satisfied.
    A clause is satisfied if at least one literal is True:
      - For a positive literal i, the i-th variable must be True.
      - For a negative literal -i, the i-th variable must be False.
    Returns True if all clauses are satisfied.
    """
    for clause in clauses:
        clause_satisfied = False
        for lit in clause:
            var_index = abs(lit) - 1  # convert 1-indexed to 0-indexed
            value = assignment[var_index]
            if (lit > 0 and value) or (lit < 0 and not value):
                clause_satisfied = True
                break
        if not clause_satisfied:
            return False
    return True

def main(json_file, cnf_dir):
    # Load benchmark results from the JSON file
    with open(json_file, 'r') as f:
        records = json.load(f)
    
    total_instances = 0
    total_valid_solutions = 0
    total_configurations = 0
    instance_results = []

    # Process each benchmark record
    for rec in records:
        instance_idx = rec.get("instance_idx")
        # Construct CNF filename; for instance_idx 0 we expect "000.cnf"
        cnf_filename = os.path.join(cnf_dir, f"{instance_idx:03d}.cnf")
        if not os.path.exists(cnf_filename):
            print(f"CNF file {cnf_filename} not found for instance {instance_idx}")
            continue

        num_vars, num_clauses, clauses = parse_cnf(cnf_filename)
        valid_count = 0
        # Now we expect "configurations" to be a list of lists of numbers
        configurations = rec.get("configurations", [])
        
        for config in configurations:
            try:
                assignment = parse_assignment(config, num_vars)
            except ValueError as e:
                print(f"Error parsing assignment for instance {instance_idx}: {e}")
                continue
            if check_solution(assignment, clauses):
                valid_count += 1
        
        total_instances += 1
        total_valid_solutions += valid_count
        total_configurations += len(configurations)
        instance_results.append((instance_idx, len(configurations), valid_count))
        print(f"Instance {instance_idx}: {valid_count}/{len(configurations)} valid solutions")
    
    overall_valid_ratio = (total_valid_solutions / total_configurations) if total_configurations > 0 else 0

    print("\nBatch Statistics:")
    print(f"Total instances processed: {total_instances}")
    print(f"Total configurations checked: {total_configurations}")
    print(f"Total valid solutions: {total_valid_solutions}")
    print(f"Overall valid ratio: {overall_valid_ratio:.2%}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify SAT solutions and generate batch statistics")
    parser.add_argument("--json", required=True, help="Path to benchmark results JSON file")
    parser.add_argument("--cnf_dir", required=True, help="Path to directory containing CNF files")
    args = parser.parse_args()
    main(args.json, args.cnf_dir)
