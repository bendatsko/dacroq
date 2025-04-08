# DacroQ

This module implements a hardware-accelerated Boolean satisfiability engine that combines WalkSAT software algorithms with custom CMOS relaxation oscillator hardware. The system accepts SAT problems in standard DIMACS CNF format and provides both API and web interface access.

## System Overview

DacroQ (Digitally Assisted CMOS Relaxation Oscillator-based Quantum-inspired computing) employs three core components:

1. **WalkSAT Software Solver**
   - Implements probabilistic local search with periodic restarts
   - Tracks unsatisfied clauses for maximum efficiency
   - Handles problems of arbitrary size through decomposition

2. **Hardware Accelerator (Daedalus)**
   - 50 relaxation oscillators with analog crossbar network
   - SPI-controlled scan chains for rapid configuration
   - Supports problems up to 50 variables and 228 clauses in hardware

3. **Hybrid Controller**
   - Manages problem decomposition and resource allocation
   - Implements spectral partitioning for large problems
   - Uses variable clustering for optimal hardware mapping

## Getting Started

The system requires Go 1.16+ and Node.js 14+ for operation.

1. **Install Dependencies**
   ```bash
   # Install pnpm
   curl -fsSL https://get.pnpm.io/install.sh | sh -
   
   # Install Go
   # Follow instructions at https://go.dev/doc/install
   ```

2. **Start Services**
   ```bash
   # Start web interface
   cd frontend/dacroq_web && pnpm install && pnpm build && pnpm start
   
   # Start API server
   cd backend && go run main.go
   ```

Services will be available at:
- Web Interface: `http://localhost:3000`
- API Server: `http://localhost:8080`

## API Usage

The system exposes RESTful endpoints for:

1. **Problem Management**
   - Upload DIMACS CNF files
   - Process batch problems via ZIP archives
   - Access preset problem libraries

2. **Solver Control**
   - Configure solver parameters
   - Monitor solution progress
   - Retrieve performance metrics

3. **Hardware Interface**
   - Monitor hardware status
   - Configure acceleration parameters
   - Track resource utilization

## Performance Specifications

- Hardware acceleration: 10-100x speedup for compatible problems
- Maximum hardware problem size: 50 variables, 228 clauses
- Supported formats: DIMACS CNF, batch ZIP processing
- Problem types: 3-SAT (primary), K-SAT and LDPC (development)

## Notices

Copyright © 2024, United States Government, as represented by the Department of Defense and the National Aeronautics and Space Administration. All rights reserved.

## Disclaimer

THE SUBJECT SOFTWARE IS PROVIDED "AS IS" WITHOUT ANY WARRANTY OF ANY KIND, EITHER EXPRESSED, IMPLIED, OR STATUTORY, INCLUDING, BUT NOT LIMITED TO, ANY WARRANTY THAT THE SUBJECT SOFTWARE WILL CONFORM TO SPECIFICATIONS, ANY IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR FREEDOM FROM INFRINGEMENT, ANY WARRANTY THAT THE SUBJECT SOFTWARE WILL BE ERROR FREE, OR ANY WARRANTY THAT DOCUMENTATION, IF PROVIDED, WILL CONFORM TO THE SUBJECT SOFTWARE. THIS AGREEMENT DOES NOT, IN ANY MANNER, CONSTITUTE AN ENDORSEMENT BY GOVERNMENT AGENCY OR ANY PRIOR RECIPIENT OF ANY RESULTS, RESULTING DESIGNS, HARDWARE, SOFTWARE PRODUCTS OR ANY OTHER APPLICATIONS RESULTING FROM USE OF THE SUBJECT SOFTWARE. FURTHER, GOVERNMENT AGENCY DISCLAIMS ALL WARRANTIES AND LIABILITIES REGARDING THIRD-PARTY SOFTWARE, IF PRESENT IN THE ORIGINAL SOFTWARE, AND DISTRIBUTES IT "AS IS."

## Waiver and Indemnity

RECIPIENT AGREES TO WAIVE ANY AND ALL CLAIMS AGAINST THE UNITED STATES GOVERNMENT, ITS CONTRACTORS AND SUBCONTRACTORS, AS WELL AS ANY PRIOR RECIPIENT. IF RECIPIENT'S USE OF THE SUBJECT SOFTWARE RESULTS IN ANY LIABILITIES, DEMANDS, DAMAGES, EXPENSES OR LOSSES ARISING FROM SUCH USE, INCLUDING ANY DAMAGES FROM PRODUCTS BASED ON, OR RESULTING FROM, RECIPIENT'S USE OF THE SUBJECT SOFTWARE, RECIPIENT SHALL INDEMNIFY AND HOLD HARMLESS THE UNITED STATES GOVERNMENT, ITS CONTRACTORS AND SUBCONTRACTORS, AS WELL AS ANY PRIOR RECIPIENT, TO THE EXTENT PERMITTED BY LAW. RECIPIENT'S SOLE REMEDY FOR ANY SUCH MATTER SHALL BE THE IMMEDIATE, UNILATERAL TERMINATION OF THIS AGREEMENT.
