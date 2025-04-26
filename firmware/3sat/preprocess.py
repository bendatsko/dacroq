p#!/usr/bin/env python3
import os
import json
import time
import sys
import shutil
from collections import defaultdict


# Add these imports at the top of preprocess.py
import numpy as np
from scipy import sparse
from scipy.sparse.linalg import eigsh
import time


USE_SPECTRAL_PARTITIONING = True


# Add this function in preprocess.py
def split_problem_spectral(cnf_content, max_vars=50, max_clauses=228, timeout=300):
    """Split a large CNF into sub-problems using spectral partitioning with timeout protection"""
    start_time = time.time()
    
    # Parse original problem
    clauses = []
    max_var = 0
    
    # Parse CNF content
    lines = cnf_content.split('\n')
    for line in lines:
        if line.startswith('p cnf'):
            parts = line.strip().split()
            if len(parts) >= 4:
                max_var = int(parts[2])
        elif not line.startswith('c') and line.strip():
            literals = [int(x) for x in line.split()[:-1]]
            if literals:  # Make sure it's not an empty line
                clauses.append(literals)
                # Update max_var if needed
                for lit in literals:
                    max_var = max(max_var, abs(lit))
    
    # Check if the problem already fits within hardware constraints
    if max_var <= max_vars and len(clauses) <= max_clauses:
        print(f"Problem already fits within hardware constraints: {max_var} variables, {len(clauses)} clauses")
        # Return a single "sub-problem" which is just the original problem
        var_map = {i: i for i in range(1, max_var + 1)}
        return [{
            'cnf': cnf_content,
            'index': 0,
            'var_mapping': var_map,
            'component': clauses
        }]
    
    # Build dependency matrix (adjacency matrix)
    A = np.zeros((max_var, max_var), dtype=float)
    
    # Track which variables appear in which clauses
    var_to_clauses = {i: [] for i in range(1, max_var + 1)}
    
    # For each clause, variables that appear together have an edge
    for i, clause in enumerate(clauses):
        clause_vars = [abs(lit) for lit in clause]
        # Add clause index to each variable's list
        for var in clause_vars:
            var_to_clauses[var].append(i)
        
        # Add edges between all pairs of variables in this clause
        for var1 in clause_vars:
            for var2 in clause_vars:
                if var1 != var2:
                    A[var1-1, var2-1] += 1  # Add weight for co-occurrence
    
    # Make the adjacency matrix symmetric
    A = (A + A.T) / 2
    
    # Check for timeout
    if time.time() - start_time > timeout:
        print(f"Timeout during dependency matrix creation after {timeout} seconds")
        # Return a simplified partitioning - just divide clauses evenly
        return simple_timeout_partitioning(clauses, max_var, max_vars, max_clauses)
    
    print(f"Built dependency matrix for {max_var} variables")
    
    # Apply spectral partitioning
    all_vars = list(range(1, max_var + 1))
    
    # Call the recursive spectral partitioning function
    try:
        partitions = spectral_partition_recursive(A, all_vars, max_vars, timeout, start_time)
        print(f"Spectral partitioning completed: {len(partitions)} partitions")
    except Exception as e:
        print(f"Error during spectral partitioning: {str(e)}")
        # Fall back to a simple partitioning
        return simple_timeout_partitioning(clauses, max_var, max_vars, max_clauses)
    
    # Group clauses by partition
    sub_problems = []
    for i, partition_vars in enumerate(partitions):
        if time.time() - start_time > timeout:
            print(f"Timeout during sub-problem creation after {timeout} seconds")
            break
            
        # Find clauses that only use variables from this partition
        partition_clauses = []
        for clause in clauses:
            clause_vars = set(abs(lit) for lit in clause)
            if clause_vars.issubset(set(partition_vars)):
                partition_clauses.append(clause)
        
        # Create variable mapping from original to new variables
        var_map = {old_var: i+1 for i, old_var in enumerate(sorted(partition_vars))}
        
        # Create sub-problem CNF
        sub_cnf = f"c Sub-problem {i} (spectral)\n"
        sub_cnf += f"p cnf {len(var_map)} {len(partition_clauses)}\n"
        
        for clause in partition_clauses:
            mapped_clause = [var_map[abs(lit)] * (1 if lit > 0 else -1) for lit in clause]
            sub_cnf += " ".join(map(str, mapped_clause)) + " 0\n"
        
        # Store sub-problem with its mapping
        sub_problems.append({
            'cnf': sub_cnf,
            'index': i,
            'var_mapping': var_map,
            'component': partition_clauses
        })
    
    # Handle clauses that span multiple partitions
    remaining_clauses = []
    for clause in clauses:
        clause_vars = set(abs(lit) for lit in clause)
        if not any(clause_vars.issubset(set(partition)) for partition in partitions):
            remaining_clauses.append(clause)
    
    if remaining_clauses:
        print(f"Handling {len(remaining_clauses)} clauses that span multiple partitions")
        # Create additional partitions for these clauses
        # Group by shared variables to minimize partitions
        while remaining_clauses and time.time() - start_time <= timeout:
            # Start with a clause
            current_partition = [remaining_clauses[0]]
            current_vars = set(abs(lit) for lit in remaining_clauses[0])
            remaining_clauses.pop(0)
            
            # Try to add more clauses that share variables
            i = 0
            while i < len(remaining_clauses):
                clause = remaining_clauses[i]
                clause_vars = set(abs(lit) for lit in clause)
                new_vars = clause_vars - current_vars
                
                if len(current_vars) + len(new_vars) <= max_vars and len(current_partition) < max_clauses:
                    current_partition.append(clause)
                    current_vars.update(new_vars)
                    remaining_clauses.pop(i)
                else:
                    i += 1
            
            # Create variable mapping
            var_map = {old_var: i+1 for i, old_var in enumerate(sorted(current_vars))}
            
            # Create sub-problem CNF
            sub_cnf = f"c Sub-problem {len(sub_problems)} (cross-partition)\n"
            sub_cnf += f"p cnf {len(var_map)} {len(current_partition)}\n"
            
            for clause in current_partition:
                mapped_clause = [var_map[abs(lit)] * (1 if lit > 0 else -1) for lit in clause]
                sub_cnf += " ".join(map(str, mapped_clause)) + " 0\n"
            
            # Store sub-problem
            sub_problems.append({
                'cnf': sub_cnf,
                'index': len(sub_problems),
                'var_mapping': var_map,
                'component': current_partition
            })
    
    print(f"Created {len(sub_problems)} sub-problems from spectral partitioning")
    return sub_problems

def spectral_partition_recursive(A, variables, max_size, timeout, start_time):
    """Recursively partition the variables using spectral analysis"""
    # Base case
    if len(variables) <= max_size:
        return [variables]
    
    # Check for timeout
    if time.time() - start_time > timeout:
        raise TimeoutError(f"Timeout during spectral partitioning after {timeout} seconds")
    
    # Extract the submatrix for these variables
    indices = [v-1 for v in variables]  # Convert to 0-based indexing
    submatrix = A[np.ix_(indices, indices)]
    
    # Compute degree matrix and normalized Laplacian
    degrees = np.sum(submatrix, axis=1)
    D_sqrt_inv = np.diag(1.0 / np.sqrt(np.maximum(degrees, 1e-10)))  # Avoid division by zero
    L_normalized = D_sqrt_inv @ submatrix @ D_sqrt_inv
    
    try:
        # Use sparse eigenvalue solver for efficiency
        sparse_L = sparse.csr_matrix(L_normalized)
        _, eigenvectors = eigsh(sparse_L, k=2, which='LM')
        fiedler_vector = eigenvectors[:, 1]  # Second eigenvector
    except Exception as e:
        print(f"Sparse eigendecomposition failed: {str(e)}. Trying dense method.")
        # Fall back to dense eigendecomposition
        eigenvalues, eigenvectors = np.linalg.eigh(L_normalized)
        sorted_indices = np.argsort(eigenvalues)[::-1]  # Sort in descending order
        fiedler_vector = eigenvectors[:, sorted_indices[1]]  # Second largest eigenvector
    
    # Split variables based on the sign of Fiedler vector entries
    positive_indices = [i for i, val in enumerate(fiedler_vector) if val > 0]
    negative_indices = [i for i, val in enumerate(fiedler_vector) if val <= 0]
    
    # Handle edge case: ensure both partitions are non-empty
    if not positive_indices or not negative_indices:
        # Simple split in half if spectral method fails
        mid = len(variables) // 2
        positive_indices = list(range(mid))
        negative_indices = list(range(mid, len(variables)))
    
    # Map indices back to original variables
    positive_vars = [variables[i] for i in positive_indices]
    negative_vars = [variables[i] for i in negative_indices]
    
    # Recursively partition each part
    positive_partitions = spectral_partition_recursive(A, positive_vars, max_size, timeout, start_time)
    negative_partitions = spectral_partition_recursive(A, negative_vars, max_size, timeout, start_time)
    
    # Combine results
    return positive_partitions + negative_partitions

def simple_timeout_partitioning(clauses, max_var, max_vars, max_clauses):
    """Simple partitioning as a fallback when timeout occurs"""
    print("Using simple partitioning as fallback due to timeout")
    sub_problems = []
    
    # Group variables by their occurrence in clauses
    var_groups = []
    remaining_vars = set(range(1, max_var + 1))
    
    while remaining_vars:
        # Start a new group
        current_group = set()
        var_queue = [next(iter(remaining_vars))]
        
        while var_queue and len(current_group) < max_vars:
            var = var_queue.pop(0)
            if var in remaining_vars:
                current_group.add(var)
                remaining_vars.remove(var)
                
                # Find related variables
                related_vars = set()
                for clause in clauses:
                    clause_vars = set(abs(lit) for lit in clause)
                    if var in clause_vars:
                        related_vars.update(clause_vars)
                
                # Add related variables to the queue
                for related_var in related_vars:
                    if related_var in remaining_vars and related_var not in var_queue:
                        var_queue.append(related_var)
        
        var_groups.append(sorted(current_group))
    
    # Create sub-problems from variable groups
    for i, var_group in enumerate(var_groups):
        # Find clauses that only use variables from this group
        group_clauses = []
        for clause in clauses:
            clause_vars = set(abs(lit) for lit in clause)
            if clause_vars.issubset(set(var_group)):
                group_clauses.append(clause)
        
        # Skip if no clauses in this group
        if not group_clauses:
            continue
            
        # Create variable mapping from original to new variables
        var_map = {old_var: i+1 for i, old_var in enumerate(sorted(var_group))}
        
        # Create sub-problem CNF
        sub_cnf = f"c Sub-problem {i} (simple)\n"
        sub_cnf += f"p cnf {len(var_map)} {len(group_clauses)}\n"
        
        for clause in group_clauses:
            mapped_clause = [var_map[abs(lit)] * (1 if lit > 0 else -1) for lit in clause]
            sub_cnf += " ".join(map(str, mapped_clause)) + " 0\n"
        
        # Store sub-problem with its mapping
        sub_problems.append({
            'cnf': sub_cnf,
            'index': i,
            'var_mapping': var_map,
            'component': group_clauses
        })
    
    return sub_problems



def encode_cnf_file(input_path, output_folder):
    """
    Reads a DIMACS CNF file and writes six CSV files that encode
    the clause–oscillator connections for up to 3SAT.
    """
    os.makedirs(output_folder, exist_ok=True)
    print(f"Created output folder: {output_folder}")

    # Create the 6 output CSV files.
    out_data01_path = os.path.join(output_folder, "data_info_01.csv")
    out_data02_path = os.path.join(output_folder, "data_info_02.csv")
    out_data11_path = os.path.join(output_folder, "data_info_11.csv")
    out_data12_path = os.path.join(output_folder, "data_info_12.csv")
    out_data21_path = os.path.join(output_folder, "data_info_21.csv")
    out_data22_path = os.path.join(output_folder, "data_info_22.csv")

    print("Opening input file and creating output files...")

    with open(input_path, "r") as inputfile_cnf, \
         open(out_data01_path, 'w') as out01, \
         open(out_data11_path, 'w') as out11, \
         open(out_data21_path, 'w') as out21, \
         open(out_data02_path, 'w') as out01_2, \
         open(out_data12_path, 'w') as out11_2, \
         open(out_data22_path, 'w') as out21_2:

        print(f"Processing file: {input_path}")
        counter = 0
        number_variables = 0 

        for line in inputfile_cnf:
            # Add a timeout check every 100 lines
            if counter % 100 == 0 and counter > 0:
                print(f"Processed {counter} clauses so far...")
                
            line_data = line.split()

            if not line_data or line_data[0] == "c":
                continue
            if line_data[0] == "%":
                break

            if counter == 0 and line_data[0] == "p":
                # Extract the actual number of variables from the problem line
                parts = line.strip().split()
                if len(parts) >= 4:
                    number_variables = 50  # Still using 50 as the fixed value for hardware
                    actual_num_clauses = int(parts[3])
                    print(f"Found problem line: {line.strip()}")
                    print(f"Using {number_variables} variables, actual clauses: {actual_num_clauses}")
                counter += 1
                continue

            # Process clause
            clause_terms = line_data[:-1]  # Remove trailing 0

            # Pad clause if needed
            if len(clause_terms) < 3:
                if len(clause_terms) == 1:
                    clause_terms = clause_terms * 3
                elif len(clause_terms) == 2:
                    clause_terms.append(clause_terms[0])

            # Convert first three literals to integers
            clause_terms = [int(x) for x in clause_terms[:3]]
            abs_line_data = [abs(x) for x in clause_terms]

            # Calculate values ensuring integer operations
            if clause_terms[0] < 0:
                val0 = int((2 ** (49 - (abs_line_data[0] - 1))) + (2 ** 51))
            else:
                val0 = int((2 ** (49 - (abs_line_data[0] - 1))) + (2 ** 50) + (2 ** 51))

            if clause_terms[1] < 0:
                val1 = int((2 ** (49 - (abs_line_data[1] - 1))) + (2 ** 51))
            else:
                val1 = int((2 ** (49 - (abs_line_data[1] - 1))) + (2 ** 50) + (2 ** 51))

            if clause_terms[2] < 0:
                val2 = int((2 ** (49 - (abs_line_data[2] - 1))) + (2 ** 51))
            else:
                val2 = int((2 ** (49 - (abs_line_data[2] - 1))) + (2 ** 50) + (2 ** 51))

            # Write values
            out01.write(f"{val0 & 0xffffffff},")
            out01_2.write(f"{(val0 >> 32) & 0xffffffff},")
            out11.write(f"{val1 & 0xffffffff},")
            out11_2.write(f"{(val1 >> 32) & 0xffffffff},")
            out21.write(f"{val2 & 0xffffffff},")
            out21_2.write(f"{(val2 >> 32) & 0xffffffff},")

            counter += 1

        print(f"Processed {counter} clauses")

        # Pad remaining rows with zeros
        padding_needed = 228 - counter
        if padding_needed > 0:
            print(f"Adding padding for {padding_needed} clauses")
            for _ in range(padding_needed):
                out01.write("0,")
                out01_2.write("0,")
                out11.write("0,")
                out11_2.write("0,")
                out21.write("0,")
                out21_2.write("0,")

        print(f"Finished processing {input_path}")

def track_preprocessing_time(filename, start_time=None, end_time=None):
    """
    Track preprocessing time and energy for a CNF file.
    If start_time and end_time are provided, record elapsed time and energy.
    Otherwise, start the timer and return the start time.
    """
    import json
    import os
    from datetime import datetime
    
    # CPU constants for energy estimation
    CPU_TDP = 10  # CPU TDP in watts
    CPU_UTILIZATION = 0.5  # Estimated CPU utilization (50%)
    
    # Path to tracking file
    os.makedirs("running", exist_ok=True)
    metrics_file = os.path.join("running", "preprocessing_metrics.json")
    
    # Load existing metrics
    if os.path.exists(metrics_file):
        with open(metrics_file, 'r') as f:
            try:
                metrics = json.load(f)
            except:
                metrics = {}
    else:
        metrics = {}
    
    if start_time is None and end_time is None:
        # Start timing
        return time.time()
    
    elif start_time is not None and end_time is not None:
        # End timing and record
        elapsed_time = end_time - start_time
        
        # Calculate energy usage (CPU energy consumption)
        energy_joules = elapsed_time * CPU_TDP * CPU_UTILIZATION
        
        # Record metrics
        metrics[filename] = {
            "preprocessing_time_seconds": elapsed_time,
            "preprocessing_energy_joules": energy_joules,
            "timestamp": datetime.now().isoformat()
        }
        
        # Save metrics
        with open(metrics_file, 'w') as f:
            json.dump(metrics, f, indent=2)
        
        print(f"Preprocessing: {filename} took {elapsed_time:.2f} seconds, energy: {energy_joules:.2f} J")
        return elapsed_time, energy_joules
    

def split_problem(cnf_content, max_vars=50, max_clauses=228, timeout=300):
    """Split a large CNF into sub-problems with timeout protection"""
    start_time = time.time()
    clauses = []
    
    # Parse original problem
    lines = cnf_content.split('\n')
    for line in lines:
        if line.startswith('p cnf'):
            pass  # Skip the problem line
        elif not line.startswith('c') and line.strip():
            literals = [int(x) for x in line.split()[:-1]]
            if literals:  # Make sure it's not an empty line
                clauses.append(literals)
    
    # OPTIMIZATION: Use a more efficient grouping algorithm
    # Instead of complex connected components, use a simpler variable-based partitioning
    def partition_by_variables():
        print("Partitioning clauses by variables...")
        var_to_clauses = defaultdict(set)
        clause_vars = []
        
        # Track variables in each clause
        for i, clause in enumerate(clauses):
            vars_in_clause = set(abs(lit) for lit in clause)
            clause_vars.append(vars_in_clause)
            
            # Map variables to clauses
            for var in vars_in_clause:
                var_to_clauses[var].add(i)
        
        # Group clauses greedily by shared variables
        partitions = []
        unassigned = set(range(len(clauses)))
        
        while unassigned:
            # Check timeout periodically
            if len(partitions) % 10 == 0 and time.time() - start_time > timeout:
                print(f"Timeout after {timeout} seconds - returning partial results")
                break
                
            # Start a new partition with the first unassigned clause
            current = list(unassigned)[0]
            partition = [current]
            unassigned.remove(current)
            
            # Variables in this partition
            partition_vars = set(clause_vars[current])
            
            # Size tracking for constraints
            partition_size = 1
            partition_unique_vars = len(partition_vars)
            
            # Try to add clauses that share variables with this partition
            candidates = []
            for var in partition_vars:
                candidates.extend(var_to_clauses[var])
            
            candidates = [c for c in candidates if c in unassigned]
            candidates.sort(key=lambda c: len(clause_vars[c] & partition_vars), reverse=True)
            
            for candidate in candidates:
                # Skip if already assigned
                if candidate not in unassigned:
                    continue
                    
                # Check if adding would exceed limits
                new_vars = clause_vars[candidate] - partition_vars
                if (partition_size + 1 <= max_clauses and 
                    partition_unique_vars + len(new_vars) <= max_vars):
                    
                    # Add to partition
                    partition.append(candidate)
                    unassigned.remove(candidate)
                    partition_vars.update(new_vars)
                    partition_size += 1
                    partition_unique_vars = len(partition_vars)
            
            # Add completed partition
            partitions.append([clauses[i] for i in partition])
            print(f"Created partition with {len(partition)} clauses and {partition_unique_vars} variables")
        
        return partitions
    
    # Create partitions
    partitions = partition_by_variables()
    
    # Convert partitions to sub-problems
    sub_problems = []
    for i, partition in enumerate(partitions):
        # Check timeout
        if time.time() - start_time > timeout:
            print(f"Timeout after {timeout} seconds - returning {len(sub_problems)} problems")
            break
            
        # Get all variables in this partition
        all_vars = set()
        for clause in partition:
            all_vars.update(abs(lit) for lit in clause)
        
        # Create variable mapping (original -> new)
        var_map = {old_var: i+1 for i, old_var in enumerate(sorted(all_vars))}
        
        # Create CNF with remapped variables
        sub_cnf = f"c Sub-problem {i}\n"
        sub_cnf += f"p cnf {len(var_map)} {len(partition)}\n"
        
        for clause in partition:
            mapped_clause = [var_map[abs(lit)] * (1 if lit > 0 else -1) for lit in clause]
            sub_cnf += " ".join(map(str, mapped_clause)) + " 0\n"
        
        sub_problems.append({
            'cnf': sub_cnf,
            'index': i,
            'var_mapping': var_map,
            'component': partition
        })
    
    print(f"Split into {len(sub_problems)} sub-problems")
    return sub_problems


def get_next_problem_number(input_dir):
    """
    Get the next available problem number by checking what CNF files exist.
    This ensures we always have continuous numbering starting from 000.
    """
    # Get all existing CNF files and find the highest number
    existing_files = [f for f in os.listdir(input_dir) if f.endswith(".cnf") and not ".original" in f]
    
    # Extract numbers from filenames
    max_number = -1
    for filename in existing_files:
        base_name = os.path.splitext(filename)[0]
        try:
            # Skip files with non-numeric names (like those with .original)
            file_num = int(base_name)
            max_number = max(max_number, file_num)
        except ValueError:
            continue
    
    # The next number is one more than the highest existing number
    # If no files exist, start from 0
    return max_number + 1 if max_number >= 0 else 0


def save_next_problem_number(number):
    """Save the next problem number to use"""
    tracking_file = os.path.join("running", "next_problem_number.txt")
    os.makedirs(os.path.dirname(tracking_file), exist_ok=True)
    
    with open(tracking_file, "w") as f:
        f.write(str(number))


def batch_process(input_dir, output_dir, batch_size=10, timeout=300):
    """Process files in smaller batches with timeouts"""
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs("running", exist_ok=True)
    
    # Get list of CNF files, excluding .original files
    cnf_files = [f for f in os.listdir(input_dir) if f.endswith(".cnf") and not ".original" in f]
    
    # Sort files numerically to ensure proper ordering
    def get_file_number(filename):
        try:
            return int(os.path.splitext(filename)[0])
        except ValueError:
            return float('inf')  # Non-numeric names go last
    
    cnf_files.sort(key=get_file_number)
    
    total = len(cnf_files)
    print(f"Found {total} CNF files to process")
    
    # Initialize or load the mapping file
    mapping_file = os.path.join("running", "originalmap.json")
    if os.path.exists(mapping_file):
        with open(mapping_file, "r") as f:
            try:
                original_map = json.load(f)
            except json.JSONDecodeError:
                original_map = {}
    else:
        original_map = {}
    
    # Initialize or get the next problem number
    next_problem_number = get_next_problem_number(input_dir)
    print(f"Next problem number: {next_problem_number}")
    
    # Process in batches
    for batch_start in range(0, total, batch_size):
        batch_end = min(batch_start + batch_size, total)
        batch = cnf_files[batch_start:batch_end]
        
        print(f"\nProcessing batch {batch_start//batch_size + 1} ({batch_start+1}-{batch_end} of {total})")
        
        for idx, filename in enumerate(batch):
            overall_idx = batch_start + idx
            cnf_path = os.path.join(input_dir, filename)
            
            print(f"\nProcessing file {overall_idx+1}/{total}: {filename}")
            process_start = time.time()

            preprocess_start = track_preprocessing_time(filename)
            
            try:
                # Extract base name without extension
                base_name = os.path.splitext(filename)[0]
                
                # Skip files that end with .original
                if ".original" in base_name:
                    print(f"Skipping {filename}, it's an original file")
                    continue
                
                # Check if this is a non-numeric filename or contains .original
                try:
                    int(base_name)
                except ValueError:
                    print(f"Skipping {filename}, it's not a numerically named file")
                    continue
                
                # Read the CNF file
                with open(cnf_path, "r") as f:
                    content = f.read()
                
                # Check the number of variables and clauses
                num_vars = 0
                num_clauses = 0
                for line in content.split('\n'):
                    if line.startswith('p cnf'):
                        parts = line.strip().split()
                        if len(parts) >= 4:
                            num_vars = int(parts[2])
                            num_clauses = int(parts[3])
                        break
                
                print(f"Problem has {num_vars} variables and {num_clauses} clauses")
                
                # Check if the problem needs to be split
                if num_clauses > 228:
                    print(f"Problem exceeds 228 clauses limit, splitting...")
                    
                    # Keep the original filename for reference
                    original_filename = f"{base_name}.original.cnf"
                    original_path = os.path.join(input_dir, original_filename)
                    shutil.copy2(cnf_path, original_path)
                    
                    # Split the problem
                    if USE_SPECTRAL_PARTITIONING:
                        print("Using spectral partitioning method")
                        sub_problems = split_problem_spectral(content, max_vars=50, max_clauses=228, timeout=timeout)
                    else:
                        print("Using original greedy partitioning method")
                        sub_problems = split_problem(content, max_vars=50, max_clauses=228, timeout=timeout)
                    # sub_problems = split_problem(content, max_vars=50, max_clauses=228, timeout=timeout)
                    
                    if not sub_problems:
                        print("Failed to split problem - skipping")
                        continue
                    
                    # Map for this original problem
                    problem_map = {
                        "original_file": original_filename,
                        "is_split": True,
                        "subproblems": []
                    }
                    
                    # Keep track of if this is the first subproblem (which will replace the original file)
                    is_first_subproblem = True
                    
                    # Process each subproblem
                    for i, sub_prob in enumerate(sub_problems):
                        # For the first subproblem, keep the original problem number
                        if is_first_subproblem:
                            current_problem_number = int(base_name)
                            formatted_number = base_name  # Keep the original number (already formatted)
                            is_first_subproblem = False
                        else:
                            # For additional subproblems, get the next available number
                            current_problem_number = next_problem_number
                            next_problem_number += 1
                            formatted_number = f"{current_problem_number:03d}"
                        
                        # Create the subproblem file
                        sub_file_path = os.path.join(input_dir, f"{formatted_number}.cnf")
                        with open(sub_file_path, "w") as f:
                            f.write(sub_prob['cnf'])
                        
                        # Create the output folder for encoding
                        sub_folder = os.path.join(output_dir, formatted_number)
                        
                        # Encode the subproblem
                        encode_cnf_file(sub_file_path, sub_folder)
                        
                        # Add to the mapping
                        problem_map["subproblems"].append({
                            "index": i,
                            "problem_number": current_problem_number,
                            "var_mapping": sub_prob['var_mapping']
                        })
                        
                        print(f"Created and encoded subproblem {formatted_number} (part {i+1}/{len(sub_problems)})")
                    
                    # Save the mapping for this original problem
                    original_map[base_name] = problem_map
                    
                    print(f"Split {filename} into {len(sub_problems)} subproblems")
                else:
                    # Problem doesn't need splitting, just encode it directly
                    problem_folder = os.path.join(output_dir, base_name)
                    encode_cnf_file(cnf_path, problem_folder)
                    
                    # Add to the mapping as a non-split problem
                    original_map[base_name] = {
                        "original_file": filename,
                        "is_split": False,
                        "problem_number": int(base_name)
                    }
                    
                    print(f"Problem fits within hardware limits, encoded directly")
                
                # Update progress
                with open("running/encoding_progress.txt", "w") as f:
                    f.write(f"{overall_idx+1}/{total}")
                
                # Save the mapping after each file in case of interruption
                with open(mapping_file, "w") as f:
                    json.dump(original_map, f, indent=2)
                
                # Save the next problem number
                save_next_problem_number(next_problem_number)
                
                # Report processing time
                # Record preprocessing end time and track metrics
                preprocess_end = time.time()
                track_preprocessing_time(filename, preprocess_start, preprocess_end)
                
                # Report processing time
                process_time = time.time() - process_start
                print(f"Processed in {process_time:.2f} seconds")
                
            except Exception as e:
                # Record preprocessing end time even in case of error
                preprocess_end = time.time()
                track_preprocessing_time(filename, preprocess_start, preprocess_end)
                
                print(f"Error processing {filename}: {e}")
                import traceback
                traceback.print_exc()
                continue
    
    # Final save of the mapping
    with open(mapping_file, "w") as f:
        json.dump(original_map, f, indent=2)
    
    # Generate a summary of what was done
    split_count = sum(1 for info in original_map.values() if info.get("is_split", False))
    direct_count = sum(1 for info in original_map.values() if not info.get("is_split", False))
    
    # Initialize the summary dictionary
    summary = {
        "original_files": len(original_map),
        "split_problems": split_count,
        "direct_encoded": direct_count,
        "next_problem_number": next_problem_number
    }
    
    # Check for file number continuity
    final_cnf_files = [f for f in os.listdir(input_dir) if f.endswith(".cnf") and not ".original" in f]
    numbers = []
    for filename in final_cnf_files:
        try:
            numbers.append(int(os.path.splitext(filename)[0]))
        except ValueError:
            continue
    
    numbers.sort()
    
    # Check if the sequence is continuous from 0 to max
    is_continuous = all(i == num for i, num in enumerate(numbers))
    
    # List any missing numbers in the sequence
    missing = []
    if not is_continuous and numbers:
        expected_range = set(range(max(numbers) + 1))
        actual_numbers = set(numbers)
        missing = sorted(expected_range - actual_numbers)
    
    # Add continuity information to the summary
    summary["continuous_numbering"] = is_continuous
    if missing:
        summary["missing_numbers"] = missing
    
    summary = {
        "original_files": len(original_map),
        "split_problems": split_count,
        "direct_encoded": direct_count,
        "next_problem_number": next_problem_number
    }
    
    with open(os.path.join("running", "preprocessing_summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    
    # Write out a human-readable summary
    with open(os.path.join("running", "preprocessing_summary.txt"), "w") as f:
        f.write("Preprocessing Summary\n")
        f.write("====================\n\n")
        f.write(f"Total original problems: {len(original_map)}\n")
        f.write(f"Problems split: {split_count}\n")
        f.write(f"Problems encoded directly: {direct_count}\n")
        f.write(f"Next problem number: {next_problem_number}\n")
        
        if summary.get("continuous_numbering", True):
            f.write("\nProblem numbering is CONTINUOUS (✓)\n")
        else:
            f.write("\nWARNING: Problem numbering is NOT CONTINUOUS (❌)\n")
            if summary.get("missing_numbers"):
                f.write(f"Missing numbers: {summary['missing_numbers']}\n")
        
        f.write("\nFinal problem range: 000 - {:03d}\n\n".format(max(numbers) if numbers else 0))
        
        f.write("Split Problem Details\n")
        f.write("====================\n\n")
        
        for problem_num, info in sorted(original_map.items()):
            if info.get("is_split", False):
                subproblems = info.get("subproblems", [])
                sub_nums = [f"{sp['problem_number']:03d}" for sp in subproblems]
                f.write(f"Problem {problem_num} → {', '.join(sub_nums)}\n")
    
    print("\nEncoding process complete!")
    print(f"Original problems: {len(original_map)}")
    print(f"Problems split: {split_count}")
    print(f"Problems encoded directly: {direct_count}")
    print(f"Next problem number: {next_problem_number}")
    
    return True


def main():
    input_dir = "cnfs"           
    output_dir = "cnfs/encoded"  
    
    # Set timeouts and batch sizes
    timeout = 300  # 5 minutes per operation
    batch_size = 10  # Process 10 files at a time
    
    print(f"\nStarting CNF encoding process")
    print(f"Input directory: {input_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Timeout: {timeout} seconds per operation")
    print(f"Batch size: {batch_size} files")
    
    # Process in batches
    return batch_process(input_dir, output_dir, batch_size, timeout)


if __name__ == "__main__":
    main()