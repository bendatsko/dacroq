import os
import sys
import time
import json
import glob
import shutil
import signal
import random
import string
import array
import csv
import warnings
import logging
from pathlib import Path
from threading import Thread
from datetime import datetime

import numpy as np
import pandas as pd
import requests
import serial
import zipfile
import subprocess

from flask import Flask, render_template, request, jsonify, redirect, url_for, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.gridspec import GridSpec

warnings.filterwarnings("ignore", category=RuntimeWarning)
log = logging.getLogger("werkzeug")
log.setLevel(logging.ERROR)

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 1000 * 1024 * 1024
app.config["UPLOAD_TIMEOUT"] = 300
BATCH_FOLDER = "batches"
CURRENT_TEST_ID = None

FIREBASE_API_KEY = "AIzaSyA87FjzN1o4s2zTkALbVQAzBbRX5juerAE"
FIREBASE_PROJECT_ID = "dacroq"


# ---------------------------------------------------------------------------
# SAT Algorithms
# ---------------------------------------------------------------------------
def count_clauses(cnf_path):
    count = 0
    try:
        with open(cnf_path, "r") as f:
            for line in f:
                if line.startswith("c") or line.startswith("p") or not line.strip():
                    continue
                literals = line.split()[:-1]
                if literals:
                    count += 1
        return count
    except Exception as e:
        print(f"Error counting clauses: {e}")
        return 0


def compute_unsat_count(solution, cnf_path):
    try:
        true_vars = {abs(v) for v in solution if v > 0}
        false_vars = {abs(v) for v in solution if v < 0}
        unsat_count = 0
        with open(cnf_path, "r") as f:
            for line in f:
                if line.startswith("c") or line.startswith("p") or not line.strip():
                    continue
                literals = [int(x) for x in line.split()[:-1]]
                if not literals:
                    continue
                clause_satisfied = False
                for lit in literals:
                    var = abs(lit)
                    if (lit > 0 and var in true_vars) or (
                        lit < 0 and var in false_vars
                    ):
                        clause_satisfied = True
                        break
                if not clause_satisfied:
                    unsat_count += 1
        return unsat_count

    except Exception as e:
        print(f"Error computing unsat count: {e}")
        return float("inf")


def map_solution_to_original(solution, mapping_info):
    if not mapping_info or "variable_mapping" not in mapping_info:
        return solution

    original_solution = []
    var_mapping = mapping_info["variable_mapping"]
    aux_vars = set(int(k) for k in var_mapping.keys())
    for v in solution:
        if abs(v) not in aux_vars:  # Original variable; copy as is
            original_solution.append(v)
    return original_solution


def reconstruct_split_solutions(solutions, problem_mappings, cnfs_folder="cnfs"):
    problem_groups = {}
    for prob_info in problem_mappings:
        if prob_info.get("is_split"):
            group = prob_info["split_group"]
            original_file = prob_info["original_file"]
            if group not in problem_groups:
                problem_groups[group] = {
                    "components": [],
                    "original_file": original_file,
                }
            problem_groups[group]["components"].append(prob_info)

    reconstructed = {}
    solution_stats = {}
    best_effort_solutions = {}
    print(f"Reconstructing solutions for {len(problem_groups)} problem groups")

    # First pass – find best partial solutions for each sub-problem
    for group, info in problem_groups.items():
        print(f"Processing group: {group}")
        best_component_solutions = []
        for comp in info["components"]:
            sub_path = comp["sub_problem_file"]
            sub_file = os.path.basename(sub_path)
            print(f"  Finding solutions for component: {sub_file}")
            best_partial = find_best_partial_solutions(sub_file, cnfs_folder)
            if best_partial:
                mapped_sols = []
                for sol, unsat_count in best_partial:
                    mapped_sol = map_solution_to_original(sol, comp)
                    mapped_sols.append((mapped_sol, unsat_count))
                if mapped_sols:
                    best_component_solutions.append(mapped_sols)
                    print(f"    Found {len(mapped_sols)} mapped solutions")
        if best_component_solutions:
            best_effort_solutions[group] = best_component_solutions

    # Second pass – combine and refine partial solutions with WalkSAT
    for group, component_solutions in best_effort_solutions.items():
        valid_solutions = set()
        all_var_assignments = []
        for comp_sols in component_solutions:
            for sol, _ in comp_sols:
                var_dict = {abs(v): v > 0 for v in sol}
                all_var_assignments.append(var_dict)
        if all_var_assignments:
            combined_assignment = {}
            all_vars = set()
            for asgn in all_var_assignments:
                all_vars.update(asgn.keys())
            for var in all_vars:
                pos_count = sum(
                    1 for asgn in all_var_assignments if var in asgn and asgn[var]
                )
                neg_count = sum(
                    1 for asgn in all_var_assignments if var in asgn and not asgn[var]
                )
                combined_assignment[var] = True if pos_count >= neg_count else False
            combined_sol = [
                var if val else -var for var, val in combined_assignment.items()
            ]

            original_file = problem_groups[group]["original_file"]
            if os.path.exists(original_file):
                print(f"Validating and refining solution for: {original_file}")
                initial_unsat = compute_unsat_count(combined_sol, original_file)
                print(
                    f"Initial combined solution has {initial_unsat} unsatisfied clauses"
                )
                total_clauses = count_clauses(original_file)
                initial_sat_pct = (
                    ((total_clauses - initial_unsat) / total_clauses) * 100
                    if total_clauses > 0
                    else 0
                )
                print(
                    f"Initial satisfaction: {initial_sat_pct:.2f}% ({total_clauses-initial_unsat}/{total_clauses})"
                )
                best_refined_sol = combined_sol
                best_unsat = initial_unsat
                for attempt in range(5):
                    print(f"  Refinement attempt {attempt+1}/5 using WalkSAT...")
                    refined_sol = refine_solution(
                        combined_sol,
                        original_file,
                        max_flips=100000,
                        random_seed=attempt,
                    )
                    if refined_sol:
                        refined_unsat = compute_unsat_count(refined_sol, original_file)
                        if refined_unsat < best_unsat:
                            best_unsat = refined_unsat
                            best_refined_sol = refined_sol
                            print(
                                f"    New best solution: {refined_unsat} unsatisfied clauses"
                            )
                            if refined_unsat == 0:
                                print("    Found perfect solution!")
                                break
                final_sat_pct = (
                    ((total_clauses - best_unsat) / total_clauses) * 100
                    if total_clauses > 0
                    else 0
                )
                print(
                    f"Final solution: {best_unsat} unsatisfied clauses ({final_sat_pct:.2f}% satisfied)"
                )
                solution_stats[group] = {
                    "initial_unsat": initial_unsat,
                    "final_unsat": best_unsat,
                    "total_clauses": total_clauses,
                    "initial_sat_pct": initial_sat_pct,
                    "final_sat_pct": final_sat_pct,
                    "is_sat": best_unsat == 0,
                }
                valid_solutions.add(tuple(sorted(best_refined_sol)))
            else:
                print(f"Original file not found, skipping refinement: {original_file}")
                valid_solutions.add(tuple(sorted(combined_sol)))
        reconstructed[group] = valid_solutions

    solution_stats_path = os.path.join("running", "solution_stats.json")
    try:
        with open(solution_stats_path, "w") as f:
            json.dump(solution_stats, f, indent=2)
    except Exception as e:
        print(f"Error saving solution stats: {e}")
    return reconstructed


def find_best_partial_solutions(sub_file, cnfs_folder, data_out_folder="data_out"):

    best_solutions = []
    try:
        base_name = os.path.splitext(sub_file)[0]
        csv_path = os.path.join(data_out_folder, f"data_out_{base_name}.csv")
        if not os.path.exists(csv_path):
            print(f"Warning: No results file found for {sub_file}")
            return best_solutions

        cnf_path = os.path.join(cnfs_folder, sub_file)
        if not os.path.exists(cnf_path):
            print(f"Warning: CNF file not found: {cnf_path}")
            return best_solutions

        num_vars = 0
        with open(cnf_path, "r") as f:
            for line in f:
                if line.startswith("p"):
                    parts = line.strip().split()
                    num_vars = int(parts[2])
                    break

        df = pd.read_csv(csv_path, header=None)
        runs_attempted = int(df.iloc[0, 0])
        csv_offset = 15
        all_solutions = []

        for run in range(runs_attempted):
            start_idx = run * csv_offset + 1
            end_idx = (run + 1) * csv_offset + 1
            if end_idx > len(df):
                break

            run_data = df.iloc[start_idx:end_idx, 0].values
            binary_data = [format(int(x), "032b") for x in run_data[:14]]
            bin_array = []
            for b in binary_data:
                bin_array.extend([b[24:32], b[16:24], b[8:16], b[0:8]])
            bin_array_2d = np.array(
                [[int(bit) for bit in group] for group in bin_array]
            )
            if num_vars + 4 <= bin_array_2d.shape[0]:
                chip_sol = bin_array_2d[4 : num_vars + 4, 0]
            else:
                chip_sol = bin_array_2d[4:, 0]
            var_assigns = []
            for var_idx, value in enumerate(chip_sol):
                var_num = var_idx + 1
                var_assigns.append(var_num if value == 1 else -var_num)
            all_solutions.append(var_assigns)

        all_unsat_counts = []
        for sol in all_solutions:
            unsat_count = compute_unsat_count(sol, cnf_path)
            all_unsat_counts.append(unsat_count)

        if all_solutions:
            min_unsat = min(all_unsat_counts)
            for sol, unsat in zip(all_solutions, all_unsat_counts):
                if unsat <= min_unsat + 2:
                    best_solutions.append((sol, unsat))
            print(
                f"Found {len(best_solutions)} best solutions for {sub_file} (min unsat: {min_unsat})"
            )

        return best_solutions

    except Exception as e:
        print(f"Error finding partial solutions for {sub_file}: {e}")
        return best_solutions


def refine_solution(initial_solution, problem_file, max_flips=100000, random_seed=None):
    if random_seed is not None:
        random.seed(random_seed)
    start_time = time.time()

    MAX_TIME_SECONDS = 10
    MAX_STALL_FLIPS = 10000
    WALK_PROBABILITY = 0.5

    clauses = []
    num_vars = 0
    with open(problem_file, "r") as f:
        lines = f.readlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith("c"):
                continue
            if line.startswith("p cnf"):
                parts = line.split()
                num_vars = int(parts[2])
                continue
            # Fast split and conversion
            literals = [int(x) for x in line.split() if x != "0"]
            if literals:
                clauses.append(literals)

    if not clauses:
        print(f"Warning: No clauses found in {problem_file}")
        return initial_solution

    clause_is_sat = np.zeros(len(clauses), dtype=np.bool_)
    unsat_clause_indices = list(range(len(clauses)))

    var_to_clauses = [[] for _ in range(num_vars + 1)]
    for clause_idx, clause in enumerate(clauses):
        for lit in clause:
            var = abs(lit)
            if var <= num_vars:
                var_to_clauses[var].append((clause_idx, lit > 0))

    solution = np.zeros(num_vars + 1, dtype=np.bool_)
    for var in initial_solution:
        if abs(var) <= num_vars:
            solution[abs(var)] = var > 0

    for clause_idx, clause in enumerate(clauses):
        for lit in clause:
            var = abs(lit)
            if var <= num_vars and ((lit > 0) == solution[var]):
                clause_is_sat[clause_idx] = True
                break

    unsat_clause_indices = np.where(~clause_is_sat)[0].tolist()
    current_unsat_count = len(unsat_clause_indices)

    if current_unsat_count == 0:
        elapsed = time.time() - start_time
        print(f"Initial solution is already satisfying ({elapsed:.3f}s)")
        return initial_solution

    best_solution = solution.copy()
    best_unsat_count = current_unsat_count
    stalled_flips = 0

    makes_breaks = np.empty(num_vars + 1, dtype=np.int32)

    for attempt in range(5):
        if attempt > 0:
            solution = best_solution.copy()

            flip_percentage = 0.05 * attempt  # 5%, 10%, 15%, 20%
            vars_to_flip = random.sample(
                range(1, num_vars + 1), k=min(int(num_vars * flip_percentage), num_vars)
            )

            for var in vars_to_flip:
                solution[var] = not solution[var]

                for clause_idx, is_positive in var_to_clauses[var]:
                    old_sat = clause_is_sat[clause_idx]

                    satisfies_clause = is_positive == solution[var]

                    if satisfies_clause:
                        if not old_sat:
                            clause_is_sat[clause_idx] = True
                            unsat_clause_indices.remove(clause_idx)
                    elif old_sat:
                        clause_satisfied = False
                        for lit in clauses[clause_idx]:
                            var_check = abs(lit)
                            if var_check != var and ((lit > 0) == solution[var_check]):
                                clause_satisfied = True
                                break

                        if not clause_satisfied:
                            clause_is_sat[clause_idx] = False
                            unsat_clause_indices.append(clause_idx)

            current_unsat_count = len(unsat_clause_indices)
            if current_unsat_count < best_unsat_count:
                best_solution = solution.copy()
                best_unsat_count = current_unsat_count
                stalled_flips = 0

                if current_unsat_count == 0:
                    break

        flips_per_attempt = max_flips // 5
        for flip in range(flips_per_attempt):
            if current_unsat_count == 0:
                elapsed = time.time() - start_time
                print(
                    f"Found satisfying solution after {flip + attempt*flips_per_attempt} flips ({elapsed:.3f}s)"
                )
                return [i if solution[i] else -i for i in range(1, num_vars + 1)]

            if time.time() - start_time > MAX_TIME_SECONDS:
                print(
                    f"Time limit reached after {flip + attempt*flips_per_attempt} flips"
                )
                break

            if stalled_flips > MAX_STALL_FLIPS:
                print(f"Search stalled after {stalled_flips} flips without improvement")
                break

            if current_unsat_count < best_unsat_count:
                best_unsat_count = current_unsat_count
                best_solution = solution.copy()
                stalled_flips = 0
                print(f"New best solution with {best_unsat_count} unsatisfied clauses")
            else:
                stalled_flips += 1

            if not unsat_clause_indices:
                break  # This shouldn't happen, but just in case

            clause_idx = random.choice(unsat_clause_indices)
            clause = clauses[clause_idx]

            # Random walk with probability p
            if random.random() < WALK_PROBABILITY:
                # Random walk:  pick a random variable from the clause
                lit = random.choice(clause)
                var = abs(lit)
            else:
                # Greedy selection: pick the variable that minimizes breaks - makes
                makes_breaks.fill(0)

                # Calculate makes and breaks for each variable in the clause
                for lit in clause:
                    var = abs(lit)
                    makes = 0
                    breaks = 0

                    # Current value and proposed new value after flip
                    current_val = solution[var]
                    new_val = not current_val

                    # Check the effect on all clauses containing this variable
                    for ci, is_positive in var_to_clauses[var]:
                        # Skip already satisfied clauses where this var isn't critical
                        if clause_is_sat[ci]:
                            # Check if this variable is critical for satisfaction
                            is_critical = True
                            for other_lit in clauses[ci]:
                                other_var = abs(other_lit)
                                if other_var != var and (
                                    (other_lit > 0) == solution[other_var]
                                ):
                                    is_critical = False
                                    break

                            # If this var is critical, flipping will break the clause
                            if is_critical and ((is_positive == current_val)):
                                breaks += 1
                        else:
                            # Unsatisfied clause - check if flipping would satisfy it
                            if is_positive == new_val:
                                makes += 1

                    # Store the net score (makes - breaks) for this variable
                    makes_breaks[var] = makes - breaks

                # Find the best variable to flip
                best_vars = []
                best_score = float("-inf")

                for lit in clause:
                    var = abs(lit)
                    score = makes_breaks[var]

                    if score > best_score:
                        best_score = score
                        best_vars = [var]
                    elif score == best_score:
                        best_vars.append(var)

                # Choose a random variable among those with the highest score
                var = (
                    random.choice(best_vars)
                    if best_vars
                    else abs(random.choice(clause))
                )

            # Flip the chosen variable
            solution[var] = not solution[var]

            # Update clause satisfaction
            for clause_idx, is_positive in var_to_clauses[var]:
                current_sat = clause_is_sat[clause_idx]
                satisfies = is_positive == solution[var]

                if satisfies and not current_sat:
                    # This variable now satisfies a previously unsatisfied clause
                    clause_is_sat[clause_idx] = True
                    unsat_clause_indices.remove(clause_idx)
                    current_unsat_count -= 1
                elif not satisfies and current_sat:
                    # Check if any other literal in the clause is satisfied
                    still_satisfied = False
                    for lit in clauses[clause_idx]:
                        check_var = abs(lit)
                        if check_var != var and ((lit > 0) == solution[check_var]):
                            still_satisfied = True
                            break

                    if not still_satisfied:
                        clause_is_sat[clause_idx] = False
                        unsat_clause_indices.append(clause_idx)
                        current_unsat_count += 1

    # If we get here, we did not find a satisfying assignment
    elapsed = time.time() - start_time
    print(f"Best solution has {best_unsat_count} unsatisfied clauses ({elapsed:.3f}s)")

    return [i if best_solution[i] else -i for i in range(1, num_vars + 1)]


## Data analysis
def run_postprocessing(
    cnfs_folder="cnfs",
    data_out_folder="data_out",
    preprocessing_csv="pre_runtime_benchmark.csv",
    set_name=None,
):

    try:
        print("\n" + "=" * 80)
        print(" " * 30 + "PROCESSING RESULTS")
        print("=" * 80)

        # Constants
        output_json_file = "benchmark_results.json"
        solver_name = "DAEDALUS_Solver_IC"
        solver_parameters = {"walk_probability": 0.5, "max_flips": 100000}
        hardware = ["MacBookAirM1", "CPU:Apple_M1:1"]
        CPU_TDP = 10
        EFFECTIVE_CORE_TDP = 2.5
        dig_freq = 238e6
        dig_period_seconds = 1.0 / dig_freq

        if set_name is None:
            folder_parts = os.path.normpath(cnfs_folder).split(os.sep)
            for part in folder_parts:
                if "batch" in part.lower():
                    set_name = part
                    break
            if set_name is None:
                set_name = "Batch-1"

        cutoff_type = "time_seconds"
        cutoff = "{:.10f}".format(0.004 * 4)

        mapping_file = os.path.join("running", "originalmap.json")
        problem_mappings = {}
        if os.path.exists(mapping_file):
            try:
                with open(mapping_file, "r") as f:
                    problem_mappings = json.load(f)
                print(f"Loaded problem mappings from {mapping_file}")
            except Exception as e:
                print(f"Warning: Failed to load problem mappings: {e}")

        needs_walksat_refinement = set()
        sub_problem_numbers = set()
        original_to_subproblems = {}

        for prob_name, prob_info in problem_mappings.items():
            if prob_info.get("is_split", False):
                needs_walksat_refinement.add(prob_name)
                original_file = prob_info.get("original_file", "")
                original_base = os.path.splitext(original_file)[0]
                if ".original" in original_base:
                    original_base = original_base.split(".original")[0]

                if original_base not in original_to_subproblems:
                    original_to_subproblems[original_base] = []

                for sub_prob in prob_info.get("subproblems", []):
                    sub_prob_num = str(sub_prob["problem_number"]).zfill(3)
                    needs_walksat_refinement.add(sub_prob_num)

                    if sub_prob_num != prob_name:
                        sub_problem_numbers.add(sub_prob_num)
                    original_to_subproblems[original_base].append(sub_prob_num)

        print(
            f"Identified {len(sub_problem_numbers)} sub-problems that will be excluded from individual results"
        )
        print(
            f"Tracking {len(original_to_subproblems)} original problems with subproblems"
        )
        print(
            f"WalkSAT refinement will only be applied to {len(needs_walksat_refinement)} decomposed problems"
        )

        preprocessing_times = {}
        if os.path.exists(preprocessing_csv):
            try:
                df = pd.read_csv(preprocessing_csv)
                for _, row in df.iterrows():
                    preprocessing_times[row["problem_name"]] = float(
                        row["encoding_time_seconds"]
                    )
            except Exception as e:
                print(f"Note: Error reading preprocessing times CSV: {e}")

        metrics_file = os.path.join("running", "preprocessing_metrics.json")
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, "r") as f:
                    prep_metrics = json.load(f)
                    for filename, metrics in prep_metrics.items():
                        preprocessing_times[filename] = metrics.get(
                            "preprocessing_time_seconds", 0.0
                        )
                print(f"Loaded {len(preprocessing_times)} preprocessing metrics")
            except Exception as e:
                print(f"Error loading preprocessing metrics: {str(e)}")

        print("\n▶ Processing hardware results from teensySAT chip...")

        benchmarks_data = []
        all_solutions = {}
        all_run_data = {}

        cnf_files = sorted(
            [
                f
                for f in os.listdir(cnfs_folder)
                if f.endswith(".cnf") and not ".original" in f
            ]
        )

        for instance_idx, cnf_file in enumerate(cnf_files):
            base_name = os.path.splitext(cnf_file)[0]
            cnf_path = os.path.join(cnfs_folder, cnf_file)
            csv_file = f"data_out_{base_name}.csv"
            csv_path = os.path.join(data_out_folder, csv_file)

            num_vars = 0
            num_clauses = 0
            with open(cnf_path, "r") as f:
                for line in f:
                    if line.startswith("p"):
                        parts = line.strip().split()
                        num_vars, num_clauses = int(parts[2]), int(parts[3])
                        break

            dat_cnf = []
            with open(cnf_path, "r") as f:
                for line in f:
                    if line.startswith("c") or line.startswith("p"):
                        continue
                    literals = [int(x) for x in line.strip().split()[:-1]]
                    if literals:
                        dat_cnf.append(literals)

            try:
                df = pd.read_csv(csv_path, header=None)
            except Exception as e:
                print(f"Error reading {csv_path}: {e}")
                continue

            runs_attempted = int(df.iloc[0, 0])
            hardware_time_seconds_list = []
            unsat_clauses_list = []
            configurations = []
            runs_solved = 0
            csv_offset = 15

            found_sat = False
            best_unsat = float("inf")
            best_solution = None

            total_walksat_time = 0
            walksat_times = []

            is_decomposed = base_name in needs_walksat_refinement
            if is_decomposed:
                print(
                    f"Problem {base_name} identified as decomposed - will use WalkSAT refinement when needed"
                )
            else:
                print(
                    f"Problem {base_name} is standard - will use hardware solution only"
                )

            for run in range(runs_attempted):
                start_idx = run * csv_offset + 1
                end_idx = (run + 1) * csv_offset + 1
                if end_idx > len(df):
                    break
                run_data = df.iloc[start_idx:end_idx, 0].values

                binary_data = []
                for x in run_data[:14]:
                    try:
                        binary_data.append(format(int(x), "032b"))
                    except ValueError:
                        print(f"Warning: Skipping invalid data: {x}")
                        binary_data.append("0" * 32)
                bin_array = []
                for b in binary_data:
                    bin_array.extend([b[24:32], b[16:24], b[8:16], b[0:8]])
                bin_array_2d = np.array(
                    [[int(bit) for bit in group] for group in bin_array]
                )
                if num_vars + 4 <= bin_array_2d.shape[0]:
                    chip_sol = bin_array_2d[4 : num_vars + 4, 0]
                else:
                    chip_sol = bin_array_2d[4:, 0]

                config_str = "".join(str(bit) for bit in chip_sol)
                configurations.append([int(bit) for bit in config_str])
                total_cycles = int(run_data[14])
                runtime_sec = total_cycles * dig_period_seconds
                hardware_time_seconds_list.append(runtime_sec)

                unsat_count = 0
                for clause in dat_cnf:
                    clause_satisfied = False
                    for lit in clause:
                        var_idx = abs(lit) - 1
                        if var_idx < len(chip_sol):
                            if (lit > 0 and chip_sol[var_idx] == 1) or (
                                lit < 0 and chip_sol[var_idx] == 0
                            ):
                                clause_satisfied = True
                                break
                    if not clause_satisfied:
                        unsat_count += 1

                if unsat_count < best_unsat:
                    best_unsat = unsat_count
                    best_solution = chip_sol

                var_assigns = []
                for var_idx, value in enumerate(chip_sol):
                    var_num = var_idx + 1
                    var_assigns.append(var_num if value == 1 else -var_num)

                refined_sol = var_assigns
                refined_unsat_count = unsat_count
                refined_binary = [int(bit) for bit in config_str]
                walksat_time = 0

                if is_decomposed and unsat_count > 0:
                    walksat_start = time.time()
                    refined_sol = refine_solution(
                        var_assigns, cnf_path, max_flips=10000
                    )
                    walksat_end = time.time()
                    walksat_time = walksat_end - walksat_start
                    total_walksat_time += walksat_time

                    refined_binary = [(1 if v > 0 else 0) for v in refined_sol]

                    refined_unsat_count = 0
                    for clause in dat_cnf:
                        clause_satisfied = False
                        for lit in clause:
                            var_idx = abs(lit) - 1
                            if var_idx < len(refined_binary):
                                if (lit > 0 and refined_binary[var_idx] == 1) or (
                                    lit < 0 and refined_binary[var_idx] == 0
                                ):
                                    clause_satisfied = True
                                    break
                        if not clause_satisfied:
                            refined_unsat_count += 1

                walksat_times.append(walksat_time)

                if is_decomposed and refined_unsat_count == 0:
                    runs_solved += 1
                    found_sat = True
                    unsat_clauses_list.append(0)
                    configurations[-1] = refined_binary  # Store the refined solution
                    all_solutions[base_name] = refined_sol
                elif unsat_count == 0:
                    runs_solved += 1
                    found_sat = True
                    unsat_clauses_list.append(0)
                    all_solutions[base_name] = var_assigns
                else:
                    unsat_clauses_list.append(unsat_count)

            if is_decomposed and not found_sat and best_solution is not None:
                var_assigns = []
                for var_idx, value in enumerate(best_solution):
                    var_num = var_idx + 1
                    var_assigns.append(var_num if value == 1 else -var_num)

                walksat_start = time.time()
                refined_sol = refine_solution(var_assigns, cnf_path, max_flips=100000)
                walksat_end = time.time()
                walksat_time = walksat_end - walksat_start
                total_walksat_time += walksat_time

                if refined_sol:
                    refined_binary = [(1 if v > 0 else 0) for v in refined_sol]
                    unsat_count = 0
                    for clause in dat_cnf:
                        clause_satisfied = False
                        for lit in clause:
                            var_idx = abs(lit) - 1
                            if var_idx < len(refined_binary):
                                if (lit > 0 and refined_binary[var_idx] == 1) or (
                                    lit < 0 and refined_binary[var_idx] == 0
                                ):
                                    clause_satisfied = True
                                    break
                        if not clause_satisfied:
                            unsat_count += 1
                    if unsat_count == 0:
                        runs_solved += 1
                        unsat_clauses_list[-1] = 0
                        configurations[-1] = refined_binary
                        all_solutions[base_name] = refined_sol

            avg_walksat_time = total_walksat_time / max(1, runs_attempted)

            hardware_time_seconds_formatted = [
                "{:.10f}".format(x) for x in hardware_time_seconds_list
            ]

            all_run_data[base_name] = {
                "runs_attempted": runs_attempted,
                "runs_solved": runs_solved,
                "hardware_time_seconds": hardware_time_seconds_list.copy(),
                "n_unsat_clauses": unsat_clauses_list.copy(),
                "configurations": configurations.copy(),
                "walksat_times": walksat_times,
                "avg_walksat_time": avg_walksat_time,
                "is_decomposed": is_decomposed,
            }

            if base_name not in sub_problem_numbers:
                print(f"Adding benchmark data for problem: {base_name}")
                pre_cpu_time = preprocessing_times.get(cnf_file, 0.0)
                pre_cpu_time_seconds = "{:.10f}".format(pre_cpu_time)

                cpu_time_seconds = ["{:.10f}".format(time) for time in walksat_times]
                if len(cpu_time_seconds) < runs_attempted:
                    cpu_time_seconds.extend(
                        ["{:.10f}".format(avg_walksat_time)]
                        * (runs_attempted - len(cpu_time_seconds))
                    )

                runtimes = np.array([float(x) for x in hardware_time_seconds_list])
                success_flags = np.array([unsat == 0 for unsat in unsat_clauses_list])
                successful_runtimes = (
                    runtimes[success_flags] if any(success_flags) else np.array([])
                )

                if len(successful_runtimes) == 0:
                    tts = float("inf")
                    tts_ci_lower = float("inf")
                    tts_ci_upper = float("inf")
                else:
                    tts = np.percentile(successful_runtimes, 95)
                    n_bootstrap = 100
                    bootstrap_tts = []
                    n_samples = len(runtimes)
                    for _ in range(n_bootstrap):
                        indices = np.random.randint(0, n_samples, n_samples)
                        bootstrap_runtimes = runtimes[indices]
                        bootstrap_successes = success_flags[indices]
                        successful_bootstrap = bootstrap_runtimes[bootstrap_successes]
                        if len(successful_bootstrap) > 0:
                            bootstrap_tts.append(
                                np.percentile(successful_bootstrap, 95)
                            )
                    tts_ci_lower = (
                        np.percentile(bootstrap_tts, 2.5)
                        if bootstrap_tts
                        else float("inf")
                    )
                    tts_ci_upper = (
                        np.percentile(bootstrap_tts, 97.5)
                        if bootstrap_tts
                        else float("inf")
                    )

                tts = "{:.10f}".format(tts)
                tts_ci_lower = "{:.10f}".format(tts_ci_lower)
                tts_ci_upper = "{:.10f}".format(tts_ci_upper)

                tts_array = np.array([float(tts)])
                if tts_array[0] != float("inf"):
                    log10_tts = np.log10(tts_array)
                    instance_stats = {
                        "mean_log10_tts": "{:.10f}".format(np.mean(log10_tts)),
                        "std_log10_tts": "{:.10f}".format(np.std(log10_tts)),
                        "median_tts": "{:.10f}".format(np.median(tts_array)),
                        f"q90_tts": "{:.10f}".format(np.percentile(tts_array, 90)),
                        "cdf": {
                            "tts_values": [
                                "{:.10f}".format(x) for x in np.sort(tts_array)
                            ],
                            "probabilities": [
                                "{:.10f}".format(x)
                                for x in np.linspace(0, 1, len(tts_array))
                            ],
                        },
                    }
                else:
                    instance_stats = {}

                cpu_energy_joules = [0.0] * len(cpu_time_seconds)

                hardware_energy_coefficient = 8.49e-03  # Energy per time unit
                hardware_energy_joules = [
                    "{:.10f}".format(float(t) * hardware_energy_coefficient)
                    for t in hardware_time_seconds_list
                ]

                benchmark_data = {
                    "set": set_name,
                    "instance_idx": instance_idx,
                    "runs_attempted": runs_attempted,
                    "runs_solved": runs_solved,
                    "n_unsat_clauses": unsat_clauses_list,
                    "configurations": configurations,
                    "pre_runtime_seconds": 0,
                    "pre_cpu_time_seconds": pre_cpu_time_seconds,
                    "pre_cpu_energy_joules": (
                        float(pre_cpu_time_seconds) * CPU_TDP
                        if float(pre_cpu_time_seconds) > 0
                        else 0
                    ),
                    "pre_energy_joules": 0,
                    "hardware_time_seconds": hardware_time_seconds_formatted,
                    "cpu_time_seconds": cpu_time_seconds,
                    "cpu_energy_joules": cpu_energy_joules,
                    "hardware_energy_joules": hardware_energy_joules,
                    "hardware_calls": [1] * runs_attempted,
                    "solver_iterations": [1] * runs_attempted,
                    "batch_statistics": instance_stats,
                    "is_decomposed": is_decomposed,
                }
                benchmarks_data.append(benchmark_data)
            else:
                print(
                    f"Skipping individual benchmark data for sub-problem: {base_name}"
                )

        print("\n▶ Updating benchmarks with correct TTS/ETS for split problems...")
        for orig_prob, sub_probs in original_to_subproblems.items():
            print(
                f"Processing original problem {orig_prob} with {len(sub_probs)} subproblems"
            )

            if not all(sp in all_run_data for sp in sub_probs):
                print(f"  Missing data for some subproblems, skipping")
                continue

            orig_benchmark_idx = None
            for i, benchmark in enumerate(benchmarks_data):
                if str(benchmark.get("instance_idx")).zfill(3) == orig_prob:
                    orig_benchmark_idx = i
                    break

            if orig_benchmark_idx is None:
                print(
                    f"  Could not find benchmark entry for original problem {orig_prob}, skipping"
                )
                continue

            sub_data = [all_run_data[sp] for sp in sub_probs if sp in all_run_data]
            if not sub_data:
                continue

            runs_attempted = min(sd["runs_attempted"] for sd in sub_data)
            benchmarks_data[orig_benchmark_idx]["runs_attempted"] = runs_attempted

            sequential_times = []
            sequential_times_formatted = []
            walksat_times = []
            walksat_times_formatted = []
            total_energies = []
            total_energies_formatted = []
            unsat_clauses = []
            runs_solved = 0
            configurations = []

            for run_idx in range(runs_attempted):
                total_time = sum(
                    float(sd["hardware_time_seconds"][run_idx]) for sd in sub_data
                )
                sequential_times.append(total_time)
                sequential_times_formatted.append("{:.10f}".format(total_time))

                total_walksat_time = sum(
                    (
                        sd.get("walksat_times", [0])[run_idx]
                        if run_idx < len(sd.get("walksat_times", []))
                        else sd.get("avg_walksat_time", 0)
                    )
                    for sd in sub_data
                )
                walksat_times.append(total_walksat_time)
                walksat_times_formatted.append("{:.10f}".format(total_walksat_time))

                energy_coefficient = 8.49e-03  # Energy coefficient from original code
                total_energy = sum(
                    float(sd["hardware_time_seconds"][run_idx]) * energy_coefficient
                    for sd in sub_data
                )
                total_energies.append(total_energy)
                total_energies_formatted.append("{:.10f}".format(total_energy))

                all_solved = all(sd["n_unsat_clauses"][run_idx] == 0 for sd in sub_data)
                unsat_clauses.append(
                    0 if all_solved else 1
                )  # 0 if all solved, 1 if any unsolved

                combined_config = []
                for sd in sub_data:
                    if run_idx < len(sd["configurations"]):
                        combined_config.extend(sd["configurations"][run_idx])
                configurations.append(combined_config)

                if all_solved:
                    runs_solved += 1

            cpu_energy_joules = [float(t) * EFFECTIVE_CORE_TDP for t in walksat_times]

            benchmarks_data[orig_benchmark_idx]["runs_solved"] = runs_solved
            benchmarks_data[orig_benchmark_idx][
                "hardware_time_seconds"
            ] = sequential_times_formatted
            benchmarks_data[orig_benchmark_idx][
                "cpu_time_seconds"
            ] = walksat_times_formatted
            benchmarks_data[orig_benchmark_idx]["cpu_energy_joules"] = cpu_energy_joules
            benchmarks_data[orig_benchmark_idx][
                "hardware_energy_joules"
            ] = total_energies_formatted
            benchmarks_data[orig_benchmark_idx]["n_unsat_clauses"] = unsat_clauses
            benchmarks_data[orig_benchmark_idx]["configurations"] = configurations
            benchmarks_data[orig_benchmark_idx][
                "is_decomposed"
            ] = True  # Mark as decomposed

            runtimes = np.array(sequential_times)
            success_flags = np.array([unsat == 0 for unsat in unsat_clauses])
            successful_runtimes = (
                runtimes[success_flags] if any(success_flags) else np.array([])
            )

            if len(successful_runtimes) == 0:
                tts = float("inf")
                tts_ci_lower = float("inf")
                tts_ci_upper = float("inf")
            else:
                tts = np.percentile(successful_runtimes, 95)
                n_bootstrap = 100
                bootstrap_tts = []
                n_samples = len(runtimes)
                for _ in range(n_bootstrap):
                    indices = np.random.randint(0, n_samples, n_samples)
                    bootstrap_runtimes = runtimes[indices]
                    bootstrap_successes = success_flags[indices]
                    successful_bootstrap = bootstrap_runtimes[bootstrap_successes]
                    if len(successful_bootstrap) > 0:
                        bootstrap_tts.append(np.percentile(successful_bootstrap, 95))
                tts_ci_lower = (
                    np.percentile(bootstrap_tts, 2.5) if bootstrap_tts else float("inf")
                )
                tts_ci_upper = (
                    np.percentile(bootstrap_tts, 97.5)
                    if bootstrap_tts
                    else float("inf")
                )

            tts = "{:.10f}".format(tts)
            tts_ci_lower = "{:.10f}".format(tts_ci_lower)
            tts_ci_upper = "{:.10f}".format(tts_ci_upper)

            tts_array = np.array([float(tts)])
            if tts_array[0] != float("inf"):
                log10_tts = np.log10(tts_array)

                benchmarks_data[orig_benchmark_idx]["batch_statistics"] = {
                    "mean_log10_tts": "{:.10f}".format(np.mean(log10_tts)),
                    "std_log10_tts": "{:.10f}".format(np.std(log10_tts)),
                    "median_tts": "{:.10f}".format(np.median(tts_array)),
                    f"q90_tts": "{:.10f}".format(np.percentile(tts_array, 90)),
                    "cdf": {
                        "tts_values": ["{:.10f}".format(x) for x in np.sort(tts_array)],
                        "probabilities": [
                            "{:.10f}".format(x)
                            for x in np.linspace(0, 1, len(tts_array))
                        ],
                    },
                }

            print(
                f"  Updated benchmark for problem {orig_prob} with sequential metrics:"
            )
            print(f"  - runs_solved: {runs_solved}/{runs_attempted}")
            print(f"  - TTS: {tts} seconds")

        if problem_mappings:
            print("\n▶ Reconstructing solutions for split problems...")
            formatted_mappings = []
            for prob_name, prob_info in problem_mappings.items():
                if prob_info.get("is_split", False):
                    original_file = prob_info["original_file"]
                    original_path = os.path.join(cnfs_folder, original_file)

                    for sub_prob in prob_info.get("subproblems", []):
                        sub_prob_num = str(sub_prob["problem_number"]).zfill(3)
                        sub_prob_file = f"{sub_prob_num}.cnf"
                        sub_prob_path = os.path.join(cnfs_folder, sub_prob_file)

                        formatted_mappings.append(
                            {
                                "is_split": True,
                                "split_group": prob_name,
                                "original_file": original_path,
                                "sub_problem_file": sub_prob_path,
                                "variable_mapping": sub_prob["var_mapping"],
                            }
                        )

            if formatted_mappings and all_solutions:
                reconstructed_solutions = reconstruct_split_solutions(
                    all_solutions, formatted_mappings, cnfs_folder
                )

                reconstruction_path = os.path.join(
                    "running", "reconstructed_solutions.json"
                )
                try:
                    with open(reconstruction_path, "w") as f:
                        serializable_solutions = {}
                        for group, solutions in reconstructed_solutions.items():
                            serializable_solutions[group] = [
                                list(sol) for sol in solutions
                            ]
                        json.dump(serializable_solutions, f, indent=2)
                    print(f"Saved reconstructed solutions to {reconstruction_path}")
                except Exception as e:
                    print(f"Error saving reconstructed solutions: {e}")

        print(f"\n▶ Final benchmark summary: {len(benchmarks_data)} problems")

        print("Generating final benchmark JSON...")
        if os.path.exists("benchmark_results.json"):
            os.remove("benchmark_results.json")
            print("Removed existing benchmark file")

        success = generate_benchmark_json(benchmarks_data, output_json_file)
        if not success:
            print("Failed to generate benchmark JSON file")
            return False
        else:
            if os.path.exists("benchmark_results.json"):
                print(
                    f"Benchmark file exists: {os.path.getsize('benchmark_results.json')} bytes"
                )
            else:
                print("ERROR: Benchmark file was not created!")

        if benchmarks_data:
            results = []
            batch_results = {
                "avg_tts": np.mean(
                    [
                        float(b["hardware_time_seconds"][0]) * 1e6
                        for b in benchmarks_data
                    ]
                ),
                "median_tts": np.median(
                    [
                        float(b["hardware_time_seconds"][0]) * 1e6
                        for b in benchmarks_data
                    ]
                ),
                "std_tts": np.std(
                    [
                        float(b["hardware_time_seconds"][0]) * 1e6
                        for b in benchmarks_data
                    ]
                ),
                "min_tts": np.min(
                    [
                        float(b["hardware_time_seconds"][0]) * 1e6
                        for b in benchmarks_data
                    ]
                ),
                "max_tts": np.max(
                    [
                        float(b["hardware_time_seconds"][0]) * 1e6
                        for b in benchmarks_data
                    ]
                ),
                "completion_rate": np.mean(
                    [
                        b["runs_solved"] / b["runs_attempted"] * 100
                        for b in benchmarks_data
                    ]
                ),
                "problems_solved": sum(
                    1 for b in benchmarks_data if b["runs_solved"] > 0
                ),
                "total_problems": len(benchmarks_data),
                "avg_unsat_clauses": np.mean(
                    [np.mean(b["n_unsat_clauses"]) for b in benchmarks_data]
                ),
                "solution_percentage": np.mean(
                    [
                        b["runs_solved"] / b["runs_attempted"] * 100
                        for b in benchmarks_data
                    ]
                ),
                "decomposed_problems": sum(
                    1 for b in benchmarks_data if b.get("is_decomposed", False)
                ),
            }
            results.append(
                {
                    "Problem Set": set_name,
                    "Avg TTS (μs)": batch_results["avg_tts"],
                    "Median TTS (μs)": batch_results["median_tts"],
                    "Std Dev TTS (μs)": batch_results["std_tts"],
                    "Completion Rate": batch_results["completion_rate"],
                    "Problems Solved": batch_results["problems_solved"],
                    "Total Problems": batch_results["total_problems"],
                    "Decomposed Problems": batch_results["decomposed_problems"],
                    "Min TTS (μs)": batch_results["min_tts"],
                    "Max TTS (μs)": batch_results["max_tts"],
                    "Avg Unsat Clauses": batch_results["avg_unsat_clauses"],
                    "Solution Percentage": batch_results["solution_percentage"],
                }
            )

            with open("daedalus_sat_solver_summary.csv", "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=results[0].keys())
                writer.writeheader()
                writer.writerows(results)

        print("▶ Generating performance visualizations...")
        benchmarks = []
        with open(output_json_file, "r") as f:
            benchmarks = json.load(f)
        metrics = generate_performance_visualizations(benchmarks)

        summary_lines = []
        summary_lines.append("\nHardware Performance Statistics:")
        summary_lines.append("-" * 80)
        header = f"{'Instance':^10} {'Success Rate':^15} {'Mean Runtime (μs)':^20} {'Mean Energy (nJ)':^20} {'Decomposed':^10}"
        summary_lines.append(header)
        summary_lines.append("-" * 80)

        for m in metrics:
            idx = m["idx"]
            is_decomposed = False
            for b in benchmarks_data:
                if b.get("instance_idx") == idx:
                    is_decomposed = b.get("is_decomposed", False)
                    break

            mean_runtime_us = np.mean(m["runtimes"]) * 1_000_000
            mean_energy_nj = np.mean(m["energy"]) * 1_000_000_000

            decomp_mark = "Yes" if is_decomposed else "No"
            line = f"{m['idx']:^10} {m['success_rate']:^15.2f} {mean_runtime_us:^20.2f} {mean_energy_nj:^20.2f} {decomp_mark:^10}"
            summary_lines.append(line)

        summary_text = "\n".join(summary_lines)
        with open(os.path.join("running", "summary_statistics.txt"), "w") as f:
            f.write(summary_text)

        walksat_summary = [
            "\n\nWalkSAT Refinement Summary:",
            "-" * 80,
            f"Total decomposed problems: {len(needs_walksat_refinement)}",
            f"Total standard problems: {len(benchmarks_data) - sum(1 for b in benchmarks_data if b.get('is_decomposed', False))}",
            "-" * 80,
            "Note: WalkSAT refinement was only applied to decomposed problems.",
            f"Energy model: M1 single-core active power estimated at {EFFECTIVE_CORE_TDP}W for WalkSAT",
        ]

        with open(os.path.join("running", "walksat_usage.txt"), "w") as f:
            f.write("\n".join(walksat_summary))

        return True

    except Exception as e:
        import traceback

        print(f"Error in postprocessing: {str(e)}")
        print(traceback.format_exc())
        return False


def generate_performance_visualizations(
    benchmarks, output_file="performance_overview.png"
):
    metrics = []
    for instance in benchmarks:
        try:
            # Use hardware_time_second instead of hardware_time_seconds
            runtimes = [float(x) for x in instance.get("hardware_time_seconds", [])]
            energy = [float(x) for x in instance.get("hardware_energy_joules", [])]
            metrics.append(
                {
                    "idx": instance.get("instance_idx", 0),
                    "runs_attempted": instance.get("runs_attempted", 0),
                    "runs_solved": instance.get("runs_solved", 0),
                    "success_rate": instance.get("runs_solved", 0)
                    / max(1, instance.get("runs_attempted", 1))
                    * 100,
                    "runtimes": np.array(runtimes),
                    "energy": np.array(energy),
                    "cutoff": float(instance.get("cutoff", 0)),
                    "n_unsat": np.array(instance.get("n_unsat_clauses", [])),
                }
            )
        except Exception as e:
            print(
                f"Warning: Error processing metrics for instance {instance.get('instance_idx', '?')}: {e}"
            )

    return metrics


def generate_benchmark_json(benchmarks_data, output_json_file="benchmark_results.json"):
    try:
        print(
            f"\n=== DEBUG: Generating benchmark JSON with {len(benchmarks_data)} entries ==="
        )

        benchmarks = []

        solver_name = "DAEDALUS_Solver_IC"
        solver_parameters = {"walk_probability": 0.5, "max_flips": 100000}
        hardware = ["M1_Macbook_Air", "CPU:Apple_M1:1"]
        cutoff_type = "time_seconds"
        cutoff = "{:.10f}".format(0.004 * 4)

        for i, benchmark_data in enumerate(benchmarks_data):
            print(f"Processing benchmark entry {i}")

            benchmark = {
                "solver": solver_name,
                "solver_parameters": solver_parameters,
                "hardware": hardware,
                "set": benchmark_data.get("set", "Batch-1"),
                "instance_idx": benchmark_data.get("instance_idx", 0),
                "cutoff_type": cutoff_type,
                "cutoff": cutoff,
                "runs_attempted": benchmark_data.get("runs_attempted", 0),
                "runs_solved": benchmark_data.get("runs_solved", 0),
                "n_unsat_clauses": benchmark_data.get("n_unsat_clauses", []),
                "configurations": benchmark_data.get("configurations", []),
                "pre_runtime_seconds": benchmark_data.get(
                    "pre_runtime_seconds", 0
                ),  # Must be "pre_runtime_seconds"
                "pre_cpu_time_seconds": benchmark_data.get(
                    "pre_cpu_time_seconds", "0.0000000000"
                ),
                "pre_cpu_energy_joules": benchmark_data.get(
                    "pre_cpu_energy_joules", 0.0
                ),
                "pre_energy_joules": benchmark_data.get("pre_energy_joules", 0),
                "hardware_time_seconds": benchmark_data.get(
                    "hardware_time_seconds", []
                ),  # Must be singular, not plural
                "cpu_time_seconds": benchmark_data.get("cpu_time_seconds", []),
                "cpu_energy_joules": benchmark_data.get("cpu_energy_joules", []),
                "hardware_energy_joules": benchmark_data.get(
                    "hardware_energy_joules", []
                ),
                "hardware_calls": benchmark_data.get("hardware_calls", []),
                "solver_iterations": benchmark_data.get("solver_iterations", []),
                "batch_statistics": benchmark_data.get("batch_statistics", {}),
            }

            runs_attempted = benchmark["runs_attempted"]
            for key in [
                "hardware_time_seconds",
                "cpu_time_seconds",
                "cpu_energy_joules",
                "hardware_energy_joules",
                "hardware_calls",
                "solver_iterations",
            ]:
                if not benchmark[key] or len(benchmark[key]) < runs_attempted:
                    if key in [
                        "hardware_time_seconds",
                        "cpu_time_seconds",
                        "hardware_energy_joules",
                    ]:
                        benchmark[key] = ["{:.10f}".format(0.0)] * runs_attempted
                    else:
                        benchmark[key] = [0] * runs_attempted

            benchmarks.append(benchmark)

        # Save to JSON file
        print(f"Writing {len(benchmarks)} entries to {output_json_file}")
        with open(output_json_file, "w") as jf:
            json.dump(benchmarks, jf, indent=4, ensure_ascii=False)

        with open(output_json_file, "r") as jf:
            verification = json.load(jf)
            print(f"Verification: JSON file contains {len(verification)} entries")
            if len(verification) > 0:
                first_entry = verification[0]
                required_fields = [
                    "solver",
                    "solver_parameters",
                    "hardware",
                    "pre_runtime_seconds",
                    "hardware_time_seconds",
                    "cpu_time_seconds",
                ]
                missing = [f for f in required_fields if f not in first_entry]
                if missing:
                    print(f"WARNING: JSON is missing fields: {missing}")
                else:
                    print("All required fields present in the JSON")

        print(f"Successfully generated benchmark JSON with {len(benchmarks)} entries")
        return True

    except Exception as e:
        import traceback

        print(f"Error generating benchmark JSON: {str(e)}")
        print(traceback.format_exc())
        return False


# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
#   Feature: Test Management API
# ---------------------------------------------------------------------------


## Functional Implementations
def update_test_status(test_id, status, additional_data=None):
    if not test_id:
        print("No test ID provided, skipping status update")
        return False

    try:
        url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/tests/{test_id}"

        update_data = {
            "fields": {
                "status": {"stringValue": status},
                "updated": {"timestampValue": datetime.utcnow().isoformat() + "Z"},
            }
        }

        if status == "completed" or status == "failed" or status == "error":
            update_data["fields"]["completed"] = {
                "timestampValue": datetime.utcnow().isoformat() + "Z"
            }

        if additional_data:
            for key, value in additional_data.items():
                if isinstance(value, dict):
                    update_data["fields"][key] = {"mapValue": {"fields": {}}}

                    for sub_key, sub_value in value.items():
                        if isinstance(sub_value, list):
                            array_values = []
                            for item in sub_value:
                                if isinstance(item, dict):
                                    item_fields = {}
                                    for item_key, item_value in item.items():
                                        if isinstance(item_value, str):
                                            item_fields[item_key] = {
                                                "stringValue": item_value
                                            }
                                        elif isinstance(item_value, int):
                                            item_fields[item_key] = {
                                                "integerValue": item_value
                                            }
                                        elif isinstance(item_value, float):
                                            item_fields[item_key] = {
                                                "doubleValue": item_value
                                            }
                                        elif isinstance(item_value, bool):
                                            item_fields[item_key] = {
                                                "booleanValue": item_value
                                            }
                                        elif isinstance(item_value, list):
                                            nested_array_values = []
                                            for nested_item in item_value:
                                                if isinstance(nested_item, str):
                                                    nested_array_values.append(
                                                        {"stringValue": nested_item}
                                                    )
                                                elif isinstance(nested_item, int):
                                                    nested_array_values.append(
                                                        {"integerValue": nested_item}
                                                    )
                                                elif isinstance(nested_item, float):
                                                    nested_array_values.append(
                                                        {"doubleValue": nested_item}
                                                    )
                                                elif isinstance(nested_item, bool):
                                                    nested_array_values.append(
                                                        {"booleanValue": nested_item}
                                                    )
                                            item_fields[item_key] = {
                                                "arrayValue": {
                                                    "values": nested_array_values
                                                }
                                            }
                                    array_values.append(
                                        {"mapValue": {"fields": item_fields}}
                                    )
                                elif isinstance(item, str):
                                    array_values.append({"stringValue": item})
                                elif isinstance(item, int):
                                    array_values.append({"integerValue": item})
                                elif isinstance(item, float):
                                    array_values.append({"doubleValue": item})
                                elif isinstance(item, bool):
                                    array_values.append({"booleanValue": item})

                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"arrayValue": {"values": array_values}}
                        elif isinstance(sub_value, str):
                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"stringValue": sub_value}
                        elif isinstance(sub_value, int):
                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"integerValue": sub_value}
                        elif isinstance(sub_value, float):
                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"doubleValue": sub_value}
                        elif isinstance(sub_value, bool):
                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"booleanValue": sub_value}
                        elif isinstance(sub_value, dict):
                            nested_fields = {}
                            for nested_key, nested_value in sub_value.items():
                                if isinstance(nested_value, str):
                                    nested_fields[nested_key] = {
                                        "stringValue": nested_value
                                    }
                                elif isinstance(nested_value, int):
                                    nested_fields[nested_key] = {
                                        "integerValue": nested_value
                                    }
                                elif isinstance(nested_value, float):
                                    nested_fields[nested_key] = {
                                        "doubleValue": nested_value
                                    }
                                elif isinstance(nested_value, bool):
                                    nested_fields[nested_key] = {
                                        "booleanValue": nested_value
                                    }
                            update_data["fields"][key]["mapValue"]["fields"][
                                sub_key
                            ] = {"mapValue": {"fields": nested_fields}}
                elif isinstance(value, str):
                    update_data["fields"][key] = {"stringValue": value}
                elif isinstance(value, int):
                    update_data["fields"][key] = {"integerValue": value}
                elif isinstance(value, float):
                    update_data["fields"][key] = {"doubleValue": value}
                elif isinstance(value, bool):
                    update_data["fields"][key] = {"booleanValue": value}
                elif isinstance(value, list):
                    # Handle top-level arrays
                    array_values = []
                    for item in value:
                        if isinstance(item, str):
                            array_values.append({"stringValue": item})
                        elif isinstance(item, int):
                            array_values.append({"integerValue": item})
                        elif isinstance(item, float):
                            array_values.append({"doubleValue": item})
                        elif isinstance(item, bool):
                            array_values.append({"booleanValue": item})
                    update_data["fields"][key] = {
                        "arrayValue": {"values": array_values}
                    }

        headers = {"Content-Type": "application/json"}

        fields_to_update = list(update_data["fields"].keys())
        mask_params = "&".join(
            [f"updateMask.fieldPaths={field}" for field in fields_to_update]
        )
        patch_url = f"{url}?{mask_params}"

        response = requests.patch(
            patch_url, headers=headers, data=json.dumps(update_data)
        )

        if response.status_code == 200:
            print(f"Successfully updated test {test_id} status to {status}")
            return True
        else:
            print(f"Failed to update test status. Status code: {response.status_code}")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"Error updating test status: {str(e)}")
        import traceback

        traceback.print_exc()
        return False


def get_test_id():
    try:
        test_id_path = os.path.join("running", "test_id.txt")
        if os.path.exists(test_id_path):
            with open(test_id_path, "r") as f:
                test_id = f.read().strip()
                if test_id:
                    return test_id
    except Exception as e:
        print(f"Error reading test ID: {str(e)}")
    return None


def upload_file_to_firebase(file_path, test_id):
    try:
        if not os.path.exists(file_path):
            print(f"File {file_path} not found")
            return None

        file_name = os.path.basename(file_path)
        timestamp = int(time.time())
        storage_path = f"test_results/{test_id}/{timestamp}_{file_name}"

        temp_dir = os.path.join("static", "temp", test_id)
        os.makedirs(temp_dir, exist_ok=True)

        dest_path = os.path.join(temp_dir, file_name)
        shutil.copy(file_path, dest_path)

        public_url = f"/static/temp/{test_id}/{file_name}"
        print(f"File {file_name} copied to {dest_path}, accessible at {public_url}")
        return public_url

    except Exception as e:
        print(f"Error uploading file: {str(e)}")
        return None


def update_test_results(test_id, success_rate=0, solution_count=0, avg_iterations=0):
    if not test_id:
        print("No test ID provided, skipping results update")
        return False

    try:
        print(f"\n=== DEBUG: update_test_results for test_id: {test_id} ===")

        benchmark_path = "benchmark_results.json"
        if os.path.exists(benchmark_path):
            file_size = os.path.getsize(benchmark_path)
            print(
                f"DEBUG: Found benchmark file at {benchmark_path} with size {file_size} bytes"
            )
        else:
            print(f"DEBUG: Benchmark file not found at {benchmark_path}")

        results_data = {
            "status": "completed",
            "downloadUrl": "/download_benchmark",  # Direct URL to download
        }

        print("DEBUG: Sending simple status update to Firebase...")
        update_test_status(test_id, "completed", results_data)
        print("DEBUG: Firebase update completed.")
        return True

    except Exception as e:
        print(f"ERROR in update_test_results: {str(e)}")
        traceback.print_exc()
        return False


## Endpoints
@app.route("/download_benchmark")
def download_benchmark():
    benchmark_path = "benchmark_results.json"
    if not os.path.exists(benchmark_path):
        return (
            jsonify({"status": "error", "message": "Benchmark results file not found"}),
            404,
        )

    try:
        return send_file(
            benchmark_path,
            mimetype="application/json",
            as_attachment=True,
            download_name="benchmark_results.json",
        )
    except Exception as e:
        return (
            jsonify(
                {"status": "error", "message": f"Error downloading file: {str(e)}"}
            ),
            500,
        )


@app.route("/download_benchmark/<test_id>")
def download_benchmark_with_id(test_id):
    benchmark_path = "benchmark_results.json"
    if not os.path.exists(benchmark_path):
        return (
            jsonify({"status": "error", "message": "Benchmark results file not found"}),
            404,
        )

    try:
        download_name = f"benchmark_results_{test_id}.json"
        return send_file(
            benchmark_path,
            mimetype="application/json",
            as_attachment=True,
            download_name=download_name,
        )
    except Exception as e:
        return (
            jsonify(
                {"status": "error", "message": f"Error downloading file: {str(e)}"}
            ),
            500,
        )


@app.route("/test_debug/<test_id>", methods=["GET"])
def debug_test(test_id):
    try:
        benchmark_exists = os.path.exists("benchmark_results.json")
        benchmark_size = 0
        if benchmark_exists:
            benchmark_size = os.path.getsize("benchmark_results.json")

        url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/tests/{test_id}"
        response = requests.get(url)

        result = {
            "test_id": test_id,
            "benchmark_file_exists": benchmark_exists,
            "benchmark_file_size": benchmark_size,
            "firebase_response_code": response.status_code,
        }

        if response.status_code == 200:
            data = response.json()

            fields = data.get("fields", {})
            result["status"] = fields.get("status", {}).get("stringValue", "unknown")

            results_field = (
                fields.get("results", {}).get("mapValue", {}).get("fields", {})
            )
            benchmark_data = results_field.get("benchmarkData", {})
            result["has_benchmark_data"] = bool(benchmark_data)

            if benchmark_data:
                if "arrayValue" in benchmark_data:
                    benchmark_array = benchmark_data.get("arrayValue", {}).get(
                        "values", []
                    )
                    result["benchmark_data_length"] = len(benchmark_array)
                else:
                    result["benchmark_data_structure"] = "Unexpected format"

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e), "test_id": test_id}), 500


@app.route("/static/temp/<test_id>/<file_name>")
def serve_test_file(test_id, file_name):
    file_path = os.path.join("static", "temp", test_id, file_name)
    if not os.path.exists(file_path):
        return "File not found", 404

    content_type = "application/octet-stream"
    if file_name.endswith(".json"):
        content_type = "application/json"
    elif file_name.endswith(".csv"):
        content_type = "text/csv"
    elif file_name.endswith(".png"):
        content_type = "image/png"
    elif file_name.endswith(".txt"):
        content_type = "text/plain"

    return send_file(file_path, mimetype=content_type)


# ---------------------------------------------------------------------------
#   Feature: TEXT-BASED DIMACS INPUT
# ---------------------------------------------------------------------------
@app.route("/upload_text", methods=["POST"])
def upload_text():
    data = request.get_json()
    if not data or "cnf_text" not in data:
        return jsonify({"status": "error", "message": "No CNF text provided"}), 400

    test_limit = data.get("test_limit", 1)
    cnfs_path = Path("cnfs")
    if cnfs_path.exists():
        shutil.rmtree(cnfs_path)
    cnfs_path.mkdir(parents=True)

    text = data["cnf_text"]
    problems = []
    current = []
    started = False

    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("p cnf"):
            started = True
            if current:
                problems.append("\n".join(current))
                current = []
        if started and stripped:
            current.append(stripped)

    if current:
        problems.append("\n".join(current))

    for i, problem_text in enumerate(problems):
        file_path = cnfs_path / f"{i:03d}.cnf"
        with open(file_path, "w") as f:
            f.write(problem_text)

    return jsonify(
        {
            "status": "success",
            "message": f"Saved {len(problems)} CNF problems",
            "file_count": len(problems),
            "test_limit": test_limit,
        }
    )


# ---------------------------------------------------------------------------
#   Feature: PRESETS
# ---------------------------------------------------------------------------


@app.route("/presets", methods=["GET"])
def list_presets():
    preset_path = Path("presets")
    if not preset_path.exists():
        return jsonify({"status": "error", "message": "Presets directory not found"})
    presets = []
    for d in preset_path.iterdir():
        if d.is_dir():
            cnf_files = list(d.glob("*.cnf"))
            if cnf_files:
                presets.append(d.name)
    return jsonify({"status": "success", "presets": presets})


@app.route("/presets/count", methods=["GET"])
def get_preset_count():
    preset_name = request.args.get("preset")
    if not preset_name:
        return jsonify({"status": "error", "message": "Preset name required"})
    preset_name = secure_filename(preset_name)
    preset_path = Path("presets") / preset_name
    if not preset_path.exists() or not preset_path.is_dir():
        return jsonify(
            {"status": "error", "message": f"Preset '{preset_name}' not found"}
        )
    cnf_files = list(preset_path.glob("*.cnf"))
    total = len(cnf_files)
    return jsonify({"status": "success", "preset": preset_name, "total": total})


@app.route("/presets/load", methods=["POST"])
def load_preset():
    try:
        data = request.get_json()
        if not data or "preset" not in data:
            return jsonify({"status": "error", "message": "Preset name required"})
        preset_name = secure_filename(data["preset"])
        preset_path = Path("presets") / preset_name
        cnfs_path = Path("cnfs")
        start_index = data.get("start_index")
        end_index = data.get("end_index")
        if not preset_path.exists() or not preset_path.is_dir():
            return jsonify(
                {"status": "error", "message": f"Preset '{preset_name}' not found"}
            )
        if cnfs_path.exists():
            for item in cnfs_path.iterdir():
                if item.is_file():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)
        else:
            cnfs_path.mkdir(parents=True)
        cnf_files = list(preset_path.glob("*.cnf"))
        if not cnf_files:
            return jsonify(
                {
                    "status": "error",
                    "message": f"No CNF files found in preset '{preset_name}'",
                }
            )
        import re

        def extract_number(filepath):
            numbers = re.findall(r"\d+", filepath.name)
            if numbers:
                return int(numbers[-1])
            return float("inf")

        cnf_files.sort(key=extract_number)
        if start_index is not None:
            start_index = int(start_index)
            if start_index < 0:
                start_index = 0
        else:
            start_index = 0
        if end_index is not None:
            end_index = int(end_index)
            if end_index >= 0:
                end_index = min(end_index + 1, len(cnf_files))
            else:
                end_index = len(cnf_files)
        else:
            end_index = len(cnf_files)
        filtered_cnf_files = cnf_files[start_index:end_index]

        def standardize_filename(index):
            return f"{index:03d}.cnf"

        copied_files = []
        for index, cnf_file in enumerate(filtered_cnf_files):
            new_filename = standardize_filename(index)
            dest = cnfs_path / new_filename
            shutil.copy2(str(cnf_file), str(dest))
            copied_files.append({"original": cnf_file.name, "new": new_filename})
        actual_files = list(cnfs_path.glob("*.cnf"))
        if not actual_files:
            return jsonify(
                {"status": "error", "message": "Files were not copied successfully"}
            )
        return jsonify(
            {
                "status": "success",
                "message": f"Preset '{preset_name}' loaded successfully",
                "files": copied_files,
                "count": len(copied_files),
                "original_count": len(cnf_files),
                "range": {"start": start_index, "end": end_index - 1},
            }
        )
    except Exception as e:
        print(f"Error in load_preset: {str(e)}")
        return jsonify(
            {"status": "error", "message": f"Error loading preset: {str(e)}"}
        )


@app.route("/problem")
def get_problem():
    problem_path = os.path.join("running", "problem.cnf")
    if not os.path.exists(problem_path):
        return jsonify({"status": "error", "message": "No problem file found"})
    try:
        with open(problem_path, "r") as f:
            content = f.read()
        return jsonify({"status": "success", "content": content})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
#   Feature: SERVE RESULTS
# ---------------------------------------------------------------------------
@app.route("/summary_statistics")
def serve_summary_statistics():
    summary_path = os.path.join("running", "summary_statistics.txt")
    if not os.path.exists(summary_path):
        return "Summary statistics not available.", 404, {"Content-Type": "text/plain"}
    with open(summary_path, "r") as f:
        summary_text = f.read()
    return summary_text, 200, {"Content-Type": "text/plain"}


@app.route("/performance_overview.png")
def serve_performance():
    return send_file("performance_overview.png", mimetype="image/png")


@app.route("/runtime_analysis.png")
def serve_runtime():
    return send_file("runtime_analysis.png", mimetype="image/png")


@app.route("/sat_solver_summary.csv")
def serve_csv():
    return send_file("daedalus_sat_solver_summary.csv", mimetype="text/csv")


@app.route("/benchmark_data.json")
def serve_json():
    return send_file("benchmark_daedalus_Batch-1.json", mimetype="application/json")


@app.route("/benchmark_report")
def get_benchmark_report():
    report_file = os.path.join("running", "benchmark_report.html")
    if not os.path.exists(report_file):
        return "No benchmark report available yet."
    with open(report_file, "r") as f:
        return f.read()


@app.route("/benchmark_results")
def get_benchmark_results():
    json_files = glob.glob("benchmark_*.json")
    if not json_files:
        return jsonify({"status": "error", "message": "No benchmark results found"})
    latest_file = max(json_files, key=os.path.getmtime)
    try:
        with open(latest_file, "r") as f:
            content = json.load(f)
        return jsonify(
            {"status": "success", "filename": latest_file, "content": content}
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})


# ---------------------------------------------------------------------------
#   Feature: UPLOAD FILES
# ---------------------------------------------------------------------------
@app.route("/upload", methods=["POST"])
def upload_files():
    if "files[]" not in request.files:
        return jsonify({"status": "error", "message": "No files provided"})
    cnfs_path = Path("cnfs")
    if cnfs_path.exists():
        shutil.rmtree(cnfs_path)
    cnfs_path.mkdir(parents=True)
    import re

    def extract_number(filename):
        numbers = re.findall(r"\d+", filename)
        if numbers:
            return int(numbers[-1])
        return float("inf")

    def standardize_filename(index):
        return f"{index:03d}.cnf"

    files = request.files.getlist("files[]")
    processed_files = []
    temp_files = []
    for file in files:
        if not file or not file.filename:
            continue
        filename = secure_filename(file.filename)
        if filename.endswith(".cnf"):
            temp_files.append((filename, file))
        elif filename.endswith(".zip"):
            temp_path = cnfs_path / "temp.zip"
            file.save(temp_path)
            try:
                with zipfile.ZipFile(temp_path, "r") as zip_ref:
                    cnf_files = [
                        f
                        for f in zip_ref.namelist()
                        if f.endswith(".cnf") and not f.startswith("__MACOSX")
                    ]
                    for zip_file in cnf_files:
                        pure_filename = os.path.basename(zip_file)
                        if pure_filename:
                            zip_ref.extract(zip_file, cnfs_path / "temp")
                            extracted_path = cnfs_path / "temp" / zip_file
                            temp_files.append((pure_filename, extracted_path))
            finally:
                temp_path.unlink()
    temp_files.sort(key=lambda x: extract_number(x[0]))
    for index, (original_filename, file_obj) in enumerate(temp_files):
        new_filename = standardize_filename(index)
        target_path = cnfs_path / new_filename
        try:
            if isinstance(file_obj, Path):
                shutil.copy2(str(file_obj), str(target_path))
            else:
                file_obj.save(str(target_path))
            processed_files.append({"original": original_filename, "new": new_filename})
        except Exception as e:
            print(f"Error saving file {original_filename}: {str(e)}")
    temp_dir = cnfs_path / "temp"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    if not processed_files:
        return jsonify({"status": "error", "message": "No valid CNF files found"})
    return jsonify(
        {
            "status": "success",
            "message": f"Processed {len(processed_files)} files",
            "files": processed_files,
        }
    )


@app.route("/list_files", methods=["GET"])
def list_files():
    if not os.path.exists(BATCH_FOLDER):
        return jsonify([])
    batches = []
    for batch_name in os.listdir(BATCH_FOLDER):
        batch_path = os.path.join(BATCH_FOLDER, batch_name)
        if os.path.isdir(batch_path):
            files = sorted(f for f in os.listdir(batch_path) if f.endswith(".cnf"))
            try:
                timestamp = batch_name.split("_")[1]
            except IndexError:
                timestamp = "N/A"
            batches.append(
                {
                    "id": batch_name,
                    "timestamp": timestamp,
                    "files": files,
                    "file_count": len(files),
                }
            )

    def sort_key(item):
        try:
            return int(item["timestamp"])
        except ValueError:
            return 0

    batches.sort(key=sort_key, reverse=True)
    return jsonify(batches)


# ---------------------------------------------------------------------------
# Hardware Interface: 3-SAT Teensy
# ---------------------------------------------------------------------------
def get_teensy_port():
    return "/dev/cu.usbmodem138999501"


@app.route("/reset", methods=["POST", "OPTIONS"])
def reset_testbench():
    if request.method == "OPTIONS":
        response = jsonify({"status": "success"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST")
        return response

    try:
        print(f"Request method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        req_data = request.get_json()
        print(f"Reset request data: {req_data}")

        # Check which testbench to reset
        testbench_type = req_data.get("chipType", "3-SAT")

        # Currently only supporting 3-SAT testbench
        if testbench_type.upper() != "3-SAT":
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Unsupported testbench type: {testbench_type}. Currently only 3-SAT is supported.",
                    }
                ),
                400,
            )

        # Get teensy port
        port = get_teensy_port()

        # Reflash firmware (try up to 3 times)
        max_attempts = 3
        success = False

        for attempt in range(max_attempts):
            try:
                print(f"Reflashing 3-SAT firmware attempt {attempt+1}/{max_attempts}")
                os.chdir("fixed-sat-code")
                subprocess.run(["platformio", "run", "--target", "upload"], check=True)
                os.chdir("..")
                success = True
                break
            except Exception as e:
                os.chdir("..")
                print(f"Reflash attempt {attempt+1} failed: {str(e)}")
                time.sleep(0.5)

        if not success:
            print("Failed to upload firmware after all attempts")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Failed to reflash firmware after multiple attempts",
                    }
                ),
                500,
            )

        print("Waiting for Teensy to reconnect...")
        time.sleep(2)

        # Connect to Teensy (retry for up to 10 times) to verify reset was successful
        retries = 10
        connection_success = False

        for i in range(retries):
            try:
                with serial.Serial(port, 2000000, timeout=0.5) as ser:
                    print(f"Teensy port {port} is available")
                    connection_success = True
                    break
            except serial.SerialException:
                print(f"Waiting for Teensy... ({i + 1}/{retries})")
                time.sleep(1)

        if not connection_success:
            print("Failed to reconnect to Teensy")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Firmware was reflashed but failed to establish connection with the device",
                    }
                ),
                500,
            )

        # Reset successful
        global NumberOfRuns
        NumberOfRuns = 0  # Reset the counter since we've just reflashed

        response = jsonify(
            {
                "status": "success",
                "message": f"{testbench_type} testbench has been successfully reset",
                "chipType": testbench_type,
            }
        )
        response.headers.add("Access-Control-Allow-Origin", "*")
        print("Reset completed successfully")
        return response

    except Exception as e:
        import traceback

        error_msg = f"Error in reset_testbench: {str(e)}"
        print("==== ERROR ====")
        print(error_msg)
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": error_msg}), 500


@app.route("/run", methods=["POST", "OPTIONS"])
def run_transfer():
    if request.method == "OPTIONS":
        response = jsonify({"status": "success"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type")
        response.headers.add("Access-Control-Allow-Methods", "POST")
        return response

    global CURRENT_TEST_ID
    try:
        print(f"Request method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        req_data = request.get_json()
        print(f"Request data: {req_data}")

        test_id = req_data.get("testId") if req_data and "testId" in req_data else None
        if not test_id:
            print("Warning: No test ID provided in request")
        else:
            update_test_status(test_id, "processing")
            CURRENT_TEST_ID = test_id

        user_email = (
            req_data.get("email", "").strip() if req_data.get("email") else None
        )

        cnfs_path = Path("cnfs")
        if not cnfs_path.exists() or not list(cnfs_path.glob("*.cnf")):
            error_msg = "Error: 'cnfs' directory does not exist or no CNF files found. Upload files or select a preset first."
            print(error_msg)
            if test_id and test_id == CURRENT_TEST_ID:
                update_test_status(test_id, "error", {"errorMessage": error_msg})
            return jsonify({"status": "error", "message": error_msg}), 400

        cnf_files = list(cnfs_path.glob("*.cnf"))
        print(f"Found {len(cnf_files)} CNF files in 'cnfs' directory")
        if test_id and test_id == CURRENT_TEST_ID:
            update_test_status(test_id, "running", {"fileCount": len(cnf_files)})

        if user_email:
            try:
                os.makedirs("running", exist_ok=True)
                email_file = os.path.join("running", "user_email.txt")
                with open(email_file, "w") as f:
                    f.write(user_email)
                print(f"Recorded user email: {user_email}")
            except Exception as email_err:
                print(f"Warning: Failed to record email: {str(email_err)}")
        else:
            print("No email address provided; email results will be skipped.")

        def process_test(test_id, user_email):
            try:
                cmd = ["python", "preprocess.py"]
                print("Starting preprocessing...")
                max_preprocess_time = 3600
                try:
                    proc = subprocess.run(
                        cmd,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE,
                        text=True,
                        timeout=max_preprocess_time,
                    )
                    if proc.returncode != 0:
                        print(
                            f"Preprocessing failed with return code {proc.returncode}"
                        )
                        if test_id == CURRENT_TEST_ID:
                            update_test_status(
                                test_id,
                                "error",
                                {"errorMessage": "Preprocessing failed"},
                            )
                        return
                    print("Completed preprocessing successfully")
                except subprocess.TimeoutExpired:
                    print(
                        f"Preprocessing timed out after {max_preprocess_time} seconds"
                    )
                    if test_id == CURRENT_TEST_ID:
                        update_test_status(
                            test_id,
                            "error",
                            {"errorMessage": "Preprocessing timed out"},
                        )
                    return

                encoded_dir = os.path.join("cnfs", "encoded")
                if not os.path.exists(encoded_dir):
                    print("Error: Preprocessing did not create the 'encoded' directory")
                    if test_id == CURRENT_TEST_ID:
                        update_test_status(
                            test_id,
                            "error",
                            {
                                "errorMessage": "Preprocessing did not create encoded files"
                            },
                        )
                    return

                encoded_dirs = [
                    d
                    for d in os.listdir(encoded_dir)
                    if os.path.isdir(os.path.join(encoded_dir, d))
                ]
                if not encoded_dirs:
                    print("Error: No encoded problem directories found")
                    if test_id == CURRENT_TEST_ID:
                        update_test_status(
                            test_id,
                            "error",
                            {"errorMessage": "No encoded problem directories found"},
                        )
                    return
                print(f"Found {len(encoded_dirs)} encoded problem directories")

                port = get_teensy_port()
                global NumberOfRuns
                if NumberOfRuns == 0 or NumberOfRuns >= 3:
                    max_attempts = 3
                    for attempt in range(max_attempts):
                        try:
                            os.chdir("fixed-sat-code")
                            subprocess.run(
                                ["platformio", "run", "--target", "upload"], check=True
                            )
                            os.chdir("..")
                            break
                        except Exception as e:
                            os.chdir("..")
                            time.sleep(0.1)
                    else:
                        print("Failed to upload firmware after all attempts")
                        if test_id == CURRENT_TEST_ID:
                            update_test_status(
                                test_id,
                                "error",
                                {"errorMessage": "Failed to upload firmware"},
                            )
                        return

                NumberOfRuns += 1
                print("Waiting for Teensy to reconnect...")
                time.sleep(2)

                retries = 10
                connected = False
                for i in range(retries):
                    try:
                        with serial.Serial(port, 2000000, timeout=0.5) as ser:
                            print(f"Teensy port {port} is available")
                            connected = True
                            break
                    except serial.SerialException as e:
                        print(f"Waiting for Teensy... ({i+1}/{retries})")
                        time.sleep(1)
                if not connected:
                    print("Failed to reconnect to Teensy")
                    if test_id == CURRENT_TEST_ID:
                        update_test_status(
                            test_id,
                            "error",
                            {"errorMessage": "Failed to connect to hardware"},
                        )
                    return

                sync_script = "teensy_sync.py"
                local_dir = os.path.abspath("cnfs/encoded")
                cmd = ["python", sync_script, "-t", port, local_dir]
                subprocess.run(cmd, capture_output=True, text=True)
                print("File upload OK.")

                download_dir = "./data_out"
                if os.path.exists(download_dir):
                    print(f"Cleaning up old data in {download_dir}")
                    shutil.rmtree(download_dir)
                os.makedirs(download_dir, exist_ok=True)

                baud = 2000000
                try:
                    with serial.Serial(port, baud, timeout=0.5) as ser:
                        print(f"Connected to {port}. Monitoring output...")
                        ser.write(b"R")
                        time.sleep(0.1)
                        while True:
                            line = ser.readline()
                            if line:
                                txt = line.decode(errors="replace").strip()
                                print(txt)
                                if "All the Iterations Complete" in txt:
                                    time.sleep(2)
                                    cmd = [
                                        "python",
                                        "teensy_sync.py",
                                        "-f",
                                        port,
                                        download_dir,
                                    ]
                                    result = subprocess.run(cmd)
                                    if result.returncode == 0:
                                        print("Download completed successfully.")
                                        print("Running post-processing...")
                                        import matplotlib

                                        matplotlib.use("Agg")
                                        if run_postprocessing():
                                            output_json_file = "benchmark_results.json"
                                            try:
                                                if os.path.exists(output_json_file):
                                                    with open(
                                                        output_json_file, "r"
                                                    ) as f:
                                                        full_data = json.load(f)
                                                    total_runs = sum(
                                                        item.get("runs_attempted", 0)
                                                        for item in full_data
                                                    )
                                                    total_solved = sum(
                                                        item.get("runs_solved", 0)
                                                        for item in full_data
                                                    )
                                                    if total_runs > 0:
                                                        success_rate = (
                                                            total_solved / total_runs
                                                        ) * 100
                                                    else:
                                                        success_rate = 0.0
                                                    all_runtimes = []
                                                    for item in full_data:
                                                        all_runtimes.extend(
                                                            [
                                                                float(x)
                                                                for x in item.get(
                                                                    "hardware_time_seconds",
                                                                    [],
                                                                )
                                                            ]
                                                        )
                                                    avg_runtime = (
                                                        sum(all_runtimes)
                                                        / len(all_runtimes)
                                                        if all_runtimes
                                                        else 0
                                                    )
                                                    if test_id == CURRENT_TEST_ID:
                                                        update_test_results(
                                                            test_id,
                                                            success_rate,
                                                            total_solved,
                                                            avg_runtime,
                                                        )
                                            except Exception as json_err:
                                                print(
                                                    f"Warning: Failed to process benchmark JSON: {str(json_err)}"
                                                )
                                                if test_id == CURRENT_TEST_ID:
                                                    update_test_status(
                                                        test_id,
                                                        "completed",
                                                        {
                                                            "errorMessage": f"Results may be incomplete - {str(json_err)}"
                                                        },
                                                    )
                                        else:
                                            print("Post-processing failed")
                                            if test_id == CURRENT_TEST_ID:
                                                update_test_status(
                                                    test_id,
                                                    "error",
                                                    {
                                                        "errorMessage": "Post-processing failed"
                                                    },
                                                )
                                    else:
                                        print("Error during file download")
                                        if test_id == CURRENT_TEST_ID:
                                            update_test_status(
                                                test_id,
                                                "error",
                                                {
                                                    "errorMessage": "Error downloading results from hardware"
                                                },
                                            )
                                    break
                            else:
                                time.sleep(0.05)
                except serial.SerialException as e:
                    print(f"Error: Could not open serial port {port}. {e}")
                    if test_id == CURRENT_TEST_ID:
                        update_test_status(
                            test_id,
                            "error",
                            {"errorMessage": f"Serial connection error: {str(e)}"},
                        )
                    return

                if user_email:
                    email_cmd = ["python", "email_results.py", "--email", user_email]
                    subprocess.run(email_cmd, capture_output=True, text=True)

            except Exception as e:
                print("Error in problem run:", e)
                import traceback

                traceback.print_exc()
                if test_id == CURRENT_TEST_ID:
                    update_test_status(
                        test_id, "error", {"errorMessage": f"Test error: {str(e)}"}
                    )

        thread = Thread(target=process_test, args=(test_id, user_email))
        thread.daemon = True
        thread.start()

        response = jsonify(
            {
                "status": "success",
                "message": "Test run initiated.",
                "file_count": len(cnf_files),
                "testId": test_id,
                "user_email": user_email,
            }
        )
        response.headers.add("Access-Control-Allow-Origin", "*")
        print("Returning success response")
        return response

    except Exception as e:
        import traceback

        error_msg = f"Error in run_transfer: {str(e)}"
        print("==== ERROR ====")
        print(error_msg)
        print(traceback.format_exc())
        if req_data and "testId" in req_data:
            test_id = req_data.get("testId")
            if test_id and test_id == CURRENT_TEST_ID:
                update_test_status(test_id, "error", {"errorMessage": error_msg})
        return (
            jsonify(
                {"status": "error", "message": error_msg, "user_email": user_email}
            ),
            500,
        )


# ---------------------------------------------------------------------------
# SIGNAL HANDLING
# ---------------------------------------------------------------------------
def signal_handler(signum, frame):
    print("\nShutting down gracefully...")
    sys.exit(0)


signal.signal(signal.SIGINT, signal_handler)

# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    global NumberOfRuns
    NumberOfRuns = 0

    def check_teensy_port_inner():
        port = get_teensy_port()
        try:
            with serial.Serial(port, 2000000, timeout=0.5) as ser:
                print(f"Teensy port {port} is available.")
                return True
        except serial.SerialException as e:
            print(f"Error: Teensy port {port} is not available. {str(e)}")
            return False

    if check_teensy_port_inner():
        try:
            app.run(debug=True, host="0.0.0.0", port=5000)
        except KeyboardInterrupt:
            print("\nShutting down...")
            sys.exit(0)
    else:
        print("Exiting due to Teensy port unavailability.")
        sys.exit(1)
