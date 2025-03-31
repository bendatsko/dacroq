// Documentation content sections
export const DocsContent = {
  introduction: {
    title: "Introduction",
    content: `Dacroq is a powerful web interface for solving complex mathematical problems through our API. Our platform currently supports 3-SAT solving, with K-SAT and LDPC solvers coming soon.

## What is Dacroq?
The website dacroq.eecs.umich.edu acts as a web interface for an API. This API is used to control a SAT solver, a K-SAT solver, and an LDPC solver. Currently, only the SAT solver is operational.

## Platform Overview
Dacroq provides:
- Real-time solving capabilities for SAT problems
- User-friendly web interface
- Comprehensive API access
- Detailed performance metrics and benchmarking
- Support for multiple input formats`
  },

  "quick-start": {
    title: "Quick Start Guide",
    content: `## Running the 3-SAT Solver

Follow these steps to get started with your first test:

1. Prepare your input using one of these formats:
   - .cnf file
   - .zip file containing multiple .cnf files
   - Pre-loaded problems (configurable range)
   - Single problem in plaintext

2. Use the user interface to enter this configuration and press run
3. Wait for your test status to update to "Completed"
4. View results and analyze performance

## Test Management
The recent tests table shows all tests run by all users. Key features:
- All users can see all tests
- Tests can be deleted by any user
- Real-time status updates
- Comprehensive result viewing

## Input Types
Dacroq supports multiple input formats:
- Single CNF files
- Batch processing via ZIP files
- Pre-configured problem sets
- Direct plaintext input
  
## Quick Tips
- Monitor test status in real-time
- Download benchmark data for detailed analysis
- Use the reset function if needed
- Check success rates and performance metrics`
  },

  installation: {
    title: "Installation",
    content: `## Getting Access
1. Request access to Dacroq by contacting help@dacroq.eecs.umich.edu
2. Once approved, you'll receive login credentials
3. Access the platform at dacroq.eecs.umich.edu

## API Setup
For API access:
1. Log in to your account
2. Navigate to the API Documentation section
3. Follow the authentication setup guide
4. Test your connection using provided examples

## System Requirements
- Modern web browser (Chrome, Firefox, Safari)
- Internet connection
- Valid university credentials`
  },

  "3-sat-solver": {
    title: "3-SAT Solver",
    content: `The 3-SAT solver is our primary solver, designed for Boolean satisfiability problems where each clause contains exactly three literals.

## Overview
Our 3-SAT solver is built specifically for efficient handling of Boolean satisfiability problems. It utilizes advanced algorithms and hardware acceleration to solve complex SAT problems with high reliability and performance.

## Features
- Real-time solving capabilities
- Multiple input formats supported
- Detailed performance metrics
- Benchmark data export
- Batch processing support

## Performance Metrics
The solver provides comprehensive metrics:
- Success rate
- Average runtime
- Solution iterations
- Memory usage
- Hardware utilization

## Using the Solver
1. Access through web interface
2. Select input method
   - Upload CNF file
   - Use pre-loaded problems
   - Enter plaintext
3. Configure parameters
4. Run test
5. Monitor progress
6. View results

## Test Management
- View all tests in the dashboard
- Download benchmark data
- Analyze performance metrics
- Delete or re-run tests as needed
  
## Input Formats
### CNF File Format
- Standard DIMACS format
- Three literals per clause
- Comment lines start with 'c'
- Problem line format: 'p cnf variables clauses'

### Batch Processing
- ZIP files containing multiple CNF files
- Automatic processing queue
- Aggregate results reporting

### Pre-loaded Problems
- Curated test sets
- Configurable range
- Verified problem instances`
  },

  "k-sat-solver": {
    title: "K-SAT Solver",
    content: `## Overview
The K-SAT solver is an extension of our 3-SAT solver, designed to handle Boolean satisfiability problems with varying clause lengths.

## Status
🚧 Currently under development. The K-SAT solver will support:
- Variable clause lengths
- Enhanced performance metrics
- Advanced optimization techniques
- Extended benchmark capabilities

## Coming Features
- Flexible clause length support
- Advanced heuristics
- Performance optimization
- Extended benchmarking

Stay tuned for updates on the K-SAT solver release.`
  },

  "ldpc-solver": {
    title: "LDPC Solver",
    content: `## Overview
The LDPC (Low-Density Parity-Check) solver is designed for error-correcting codes and related applications.

## Status
🚧 In development. The LDPC solver will feature:
- Specialized algorithms for LDPC codes
- Performance optimization
- Integration with existing infrastructure
- Comprehensive benchmarking

## Planned Features
- Matrix representation support
- Advanced decoding algorithms
- Performance analysis tools
- Batch processing capabilities

Development updates will be posted here when available.`
  }
};