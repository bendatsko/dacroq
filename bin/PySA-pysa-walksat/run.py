#!/usr/bin/env python3
import os
import subprocess
import csv
import re
import glob
from datetime import datetime
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import math

# Configuration
WALKSAT_PATH = "./build-release/src/walk-sat.x"
PROBLEMS_DIR = "./problems"
RESULTS_CSV = "walksat_results_with_energy.csv"
MAX_STEPS = 1000000
WALK_PROB = 0.5
TIMEOUT = 30  # Timeout in seconds for each CNF file

# Energy estimation model parameters
BASE_POWER_W = 15.0
POWER_PER_STEP_MW = 0.05
COMPLEXITY_SCALING = 0.001

# Regular expression patterns to extract information from output
time_pattern = re.compile(r"C Computation time \(ms\) = ([\d\.]+)")
solution_count_pattern = re.compile(r"C Solution count = (\d+)")
restarts_pattern = re.compile(r"C Number of restarts = (\d+)")
steps_pattern = re.compile(r"C Total inner steps = (\d+)")
avg_steps_pattern = re.compile(r"C Avg steps to solution = ([\d\.]+)")
# New pattern to capture a binary SAT assignment (e.g., 100100100011111100101001001)
assignment_pattern = re.compile(r'\b[01]{20,}\b')

def estimate_energy(computation_time_ms, total_steps):
    computation_time_s = computation_time_ms / 1000.0
    power_mw = BASE_POWER_W * 1000 + (total_steps * POWER_PER_STEP_MW)
    energy_microjoules = power_mw * computation_time_s * 1000
    return energy_microjoules, power_mw

def generate_performance_plots(csv_path="walksat_results_with_energy.csv", output_dir="plots"):
    os.makedirs(output_dir, exist_ok=True)
    if not os.path.exists(csv_path):
        print(f"Error: CSV file '{csv_path}' not found!")
        return None

    print(f"Loading data from {csv_path}...")
    df = pd.read_csv(csv_path)
    df_solved = df[df['SolutionFound'] == True].copy()

    def extract_number(problem_name):
        match = re.search(r'(\d+)', problem_name)
        if match:
            return int(match.group(1))
        return 0

    df_solved['ProblemNumber'] = df_solved['Problem'].apply(extract_number)
    df_solved = df_solved.sort_values(['Batch', 'ProblemNumber'])
    df_solved['ContinuousIndex'] = range(len(df_solved))

    batches = df_solved['Batch'].unique()
    colors = plt.cm.tab10(np.linspace(0, 1, len(batches)))
    batch_color_map = dict(zip(batches, colors))

    # Plot 1: Time to Solution
    plt.figure(figsize=(12, 8))
    for batch in batches:
        batch_data = df_solved[df_solved['Batch'] == batch]
        plt.scatter(
            batch_data['ContinuousIndex'],
            batch_data['ComputationTime_ms'] * 1000,
            label=batch,
            color=batch_color_map[batch],
            alpha=0.7
        )
    plt.yscale('log')
    plt.xlabel('Problem Index', fontsize=12)
    plt.ylabel('Time to Solution (μs)', fontsize=12)
    plt.title('WalkSAT - Time to Solution per Problem', fontsize=14)
    plt.legend(title='Batch')
    plt.grid(True, alpha=0.3)
    avg_time = (df_solved['ComputationTime_ms'] * 1000).mean()
    plt.axhline(y=avg_time, color='r', linestyle='--', alpha=0.5)
    plt.text(0, avg_time*1.1, f'Average: {avg_time:.2f} μs', color='r')
    plt.tight_layout()
    time_plot_path = os.path.join(output_dir, 'time_to_solution.png')
    plt.savefig(time_plot_path, dpi=300)
    print(f"Time to Solution plot saved to {time_plot_path}")

    # Plot 2: Energy to Solution
    plt.figure(figsize=(12, 8))
    df_energy = df_solved.dropna(subset=['EstimatedEnergy_microjoules']).copy()
    for batch in batches:
        batch_data = df_energy[df_energy['Batch'] == batch]
        if len(batch_data) > 0:
            plt.scatter(
                batch_data['ContinuousIndex'],
                batch_data['EnergyPerSolution_microjoules'],
                label=batch,
                color=batch_color_map[batch],
                alpha=0.7
            )
    plt.yscale('log')
    plt.xlabel('Problem Index', fontsize=12)
    plt.ylabel('Energy to Solution (μJ)', fontsize=12)
    plt.title('WalkSAT - Energy to Solution per Problem', fontsize=14)
    plt.legend(title='Batch')
    plt.grid(True, alpha=0.3)
    avg_energy = df_energy['EnergyPerSolution_microjoules'].mean()
    plt.axhline(y=avg_energy, color='r', linestyle='--', alpha=0.5)
    plt.text(0, avg_energy*1.1, f'Average: {avg_energy:.2f} μJ', color='r')
    plt.tight_layout()
    energy_plot_path = os.path.join(output_dir, 'energy_to_solution.png')
    plt.savefig(energy_plot_path, dpi=300)
    print(f"Energy to Solution plot saved to {energy_plot_path}")

    # Plot 3: Energy vs. Time
    plt.figure(figsize=(12, 8))
    df_combined = df_energy.copy()
    plt.scatter(
        df_combined['ComputationTime_ms'] * 1000,
        df_combined['EnergyPerSolution_microjoules'],
        c=df_combined['Batch'].map(lambda x: colors[list(batches).index(x)]),
        alpha=0.7
    )
    plt.xscale('log')
    plt.yscale('log')
    plt.xlabel('Time to Solution (μs)', fontsize=12)
    plt.ylabel('Energy to Solution (μJ)', fontsize=12)
    plt.title('WalkSAT - Energy vs. Time to Solution', fontsize=14)
    legend_elements = [plt.Line2D([0], [0], marker='o', color='w',
                                  label=batch, markerfacecolor=batch_color_map[batch], markersize=10)
                       for batch in batches]
    plt.legend(handles=legend_elements, title='Batch')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    combined_plot_path = os.path.join(output_dir, 'energy_vs_time.png')
    plt.savefig(combined_plot_path, dpi=300)
    print(f"Energy vs. Time plot saved to {combined_plot_path}")

    # Plot 4: Energy Efficiency vs. Problem Complexity
    plt.figure(figsize=(12, 8))
    plt.scatter(
        df_combined['TotalSteps'],
        df_combined['EnergyPerSolution_microjoules'] / (df_combined['ComputationTime_ms'] * 1000),
        c=df_combined['Batch'].map(lambda x: colors[list(batches).index(x)]),
        alpha=0.7
    )
    plt.xscale('log')
    plt.yscale('log')
    plt.xlabel('Problem Complexity (Steps)', fontsize=12)
    plt.ylabel('Energy Efficiency (μJ/μs)', fontsize=12)
    plt.title('WalkSAT - Energy Efficiency vs. Problem Complexity', fontsize=14)
    plt.legend(handles=legend_elements, title='Batch')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    efficiency_plot_path = os.path.join(output_dir, 'energy_efficiency.png')
    plt.savefig(efficiency_plot_path, dpi=300)
    print(f"Energy Efficiency plot saved to {efficiency_plot_path}")

    print("All plots generated successfully!")
    return {
        "time_plot": time_plot_path,
        "energy_plot": energy_plot_path,
        "combined_plot": combined_plot_path,
        "efficiency_plot": efficiency_plot_path
    }

def display_statistics(csv_path="walksat_results_with_energy.csv"):
    if not os.path.exists(csv_path):
        print(f"Error: CSV file '{csv_path}' not found!")
        return
    df = pd.read_csv(csv_path)
    total_problems = len(df)
    solved_problems = len(df[df['SolutionFound'] == True])
    solve_rate = solved_problems / total_problems * 100
    print("\n===== WalkSAT Performance Statistics =====")
    print(f"Total problems: {total_problems}")
    print(f"Solved problems: {solved_problems} ({solve_rate:.2f}%)")
    if solved_problems > 0:
        solved_df = df[df['SolutionFound'] == True]
        avg_time_ms = solved_df['ComputationTime_ms'].mean()
        median_time_ms = solved_df['ComputationTime_ms'].median()
        max_time_ms = solved_df['ComputationTime_ms'].max()
        min_time_ms = solved_df['ComputationTime_ms'].min()
        print("\n----- Time to Solution (ms) -----")
        print(f"Average: {avg_time_ms:.3f} ms")
        print(f"Median: {median_time_ms:.3f} ms")
        print(f"Min: {min_time_ms:.3f} ms")
        print(f"Max: {max_time_ms:.3f} ms")
        if 'EstimatedEnergy_microjoules' in solved_df.columns:
            energy_df = solved_df.dropna(subset=['EstimatedEnergy_microjoules'])
            if len(energy_df) > 0:
                avg_energy = energy_df['EnergyPerSolution_microjoules'].mean()
                median_energy = energy_df['EnergyPerSolution_microjoules'].median()
                max_energy = energy_df['EnergyPerSolution_microjoules'].max()
                min_energy = energy_df['EnergyPerSolution_microjoules'].min()
                print("\n----- Energy to Solution (μJ) -----")
                print(f"Average: {avg_energy:.3f} μJ")
                print(f"Median: {median_energy:.3f} μJ")
                print(f"Min: {min_energy:.3f} μJ")
                print(f"Max: {max_energy:.3f} μJ")

def run_problems_and_create_energy_csv():
    # Initialize CSV file with headers (added 'SATAssignment')
    with open(RESULTS_CSV, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        headers = [
            'Batch',
            'Problem',
            'FilePath',
            'SATAssignment',
            'SolutionFound',
            'SolutionCount',
            'ComputationTime_ms',
            'Restarts',
            'TotalSteps',
            'AvgStepsToSolution',
            'EstimatedEnergy_microjoules',
            'EstimatedPower_mW',
            'EnergyPerSolution_microjoules',
            'RunTimestamp'
        ]
        writer.writerow(headers)

    # Load existing results if available
    if os.path.exists("walksat_results.csv"):
        print("Loading existing results from walksat_results.csv")
        try:
            existing_df = pd.read_csv("walksat_results.csv")
            print(f"Loaded {len(existing_df)} results")
            for i, row in existing_df.iterrows():
                batch = row['Batch']
                problem = row['Problem']
                file_path = row['FilePath']
                # Use the existing SATAssignment if available; otherwise, default to an empty string
                sat_assignment = row['SATAssignment'] if 'SATAssignment' in row and not pd.isna(row['SATAssignment']) else ""
                solution_found = row['SolutionFound']
                solution_count = row['SolutionCount']
                computation_time = row['ComputationTime_ms']
                restarts = row['Restarts']
                total_steps = row['TotalSteps']
                avg_steps = row['AvgStepsToSolution']
                
                if pd.isna(computation_time) or pd.isna(total_steps):
                    continue
                    
                energy_microjoules, avg_power_mw = estimate_energy(computation_time, total_steps)
                energy_per_solution = energy_microjoules / solution_count if energy_microjoules is not None and solution_count > 0 else None

                with open(RESULTS_CSV, 'a', newline='') as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow([
                        batch,
                        problem,
                        file_path,
                        sat_assignment,
                        solution_found,
                        solution_count,
                        computation_time,
                        restarts,
                        total_steps,
                        avg_steps,
                        energy_microjoules,
                        avg_power_mw,
                        energy_per_solution,
                        datetime.now().isoformat()
                    ])
            
            print(f"Processed {len(existing_df)} results with energy estimates")
            print(f"Results saved to {RESULTS_CSV}")
            return True
        except Exception as e:
            print(f"Error processing existing results: {e}")
            print("Will run all problem files instead")
    else:
        print("No existing results found, will run all problem files")

    # Find all CNF and DIMACS files in the problems directory
    problem_files = []
    for batch_dir in sorted(glob.glob(os.path.join(PROBLEMS_DIR, "t_batch_*"))):
        batch_name = os.path.basename(batch_dir)
        cnf_files = sorted(glob.glob(os.path.join(batch_dir, "*.cnf")))
        dimacs_files = sorted(glob.glob(os.path.join(batch_dir, "*.dimacs")))
        for file_path in cnf_files + dimacs_files:
            problem_files.append((batch_name, os.path.basename(file_path), file_path))

    print(f"Found {len(problem_files)} problem files in {len(glob.glob(os.path.join(PROBLEMS_DIR, 't_batch_*')))} batches")

    for i, (batch, problem, file_path) in enumerate(problem_files):
        print(f"\nProcessing {i+1}/{len(problem_files)}: {file_path}")
        cmd = [WALKSAT_PATH, file_path, str(MAX_STEPS), str(WALK_PROB)]
        try:
            print(f"Running command: {' '.join(cmd)}")
            result = subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=TIMEOUT
            )
            output = result.stdout

            # Extract the SAT assignment from the output using the new regex
            assignment_match = assignment_pattern.search(output)
            sat_assignment = assignment_match.group(0) if assignment_match else ""

            solution_found = ("Solution count" in output and 
                              int(solution_count_pattern.search(output).group(1)) > 0) if solution_count_pattern.search(output) else False
            solution_count = int(solution_count_pattern.search(output).group(1)) if solution_count_pattern.search(output) else 0
            computation_time = float(time_pattern.search(output).group(1)) if time_pattern.search(output) else None
            restarts = int(restarts_pattern.search(output).group(1)) if restarts_pattern.search(output) else None
            total_steps = int(steps_pattern.search(output).group(1)) if steps_pattern.search(output) else None
            avg_steps = float(avg_steps_pattern.search(output).group(1)) if avg_steps_pattern.search(output) else None

            energy_microjoules, avg_power_mw = (estimate_energy(computation_time, total_steps)
                                                if computation_time is not None and total_steps is not None
                                                else (None, None))
            energy_per_solution = energy_microjoules / solution_count if energy_microjoules is not None and solution_count > 0 else None

            print(f"Solution found: {solution_found}")
            print(f"SAT Assignment: {sat_assignment}")
            print(f"Solution count: {solution_count}")
            print(f"Computation time: {computation_time} ms")
            if energy_microjoules is not None:
                print(f"Estimated energy: {energy_microjoules:.2f} µJ")
                print(f"Estimated power: {avg_power_mw:.2f} mW")
                if energy_per_solution is not None:
                    print(f"Energy per solution: {energy_per_solution:.2f} µJ")

            with open(RESULTS_CSV, 'a', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([
                    batch,
                    problem,
                    file_path,
                    sat_assignment,
                    solution_found,
                    solution_count,
                    computation_time,
                    restarts,
                    total_steps,
                    avg_steps,
                    energy_microjoules,
                    avg_power_mw,
                    energy_per_solution,
                    datetime.now().isoformat()
                ])

        except subprocess.TimeoutExpired:
            print(f"Timeout ({TIMEOUT}s) expired for {file_path}")
            with open(RESULTS_CSV, 'a', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([
                    batch,
                    problem,
                    file_path,
                    "",  # No SAT assignment recorded
                    False,
                    0,
                    TIMEOUT * 1000,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    datetime.now().isoformat()
                ])
        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            with open(RESULTS_CSV, 'a', newline='') as csvfile:
                writer = csv.writer(csvfile)
                writer.writerow([
                    batch,
                    problem,
                    file_path,
                    "",  # No SAT assignment recorded
                    False,
                    0,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    None,
                    datetime.now().isoformat()
                ])

    print(f"\nAll done! Results saved to {RESULTS_CSV}")
    return True

if __name__ == "__main__":
    run_problems_and_create_energy_csv()
    try:
        if os.path.exists(RESULTS_CSV):
            print("\nGenerating performance plots...")
            plot_paths = generate_performance_plots(RESULTS_CSV)
            display_statistics(RESULTS_CSV)
            print("\nOpen the generated plots to visualize the results!")
        else:
            print(f"Error: Could not find results file {RESULTS_CSV}")
    except Exception as e:
        print(f"Error generating plots: {e}")
