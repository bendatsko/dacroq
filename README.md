# Dacroq: Analog Computing Research Platform

**A comprehensive benchmarking platform for analog computing chips specializing in SAT solving and LDPC decoding.**

## 🎯 Project Overview

Dacroq enables researchers to evaluate and compare analog computing solutions against traditional digital implementations. The platform provides:

- **Hardware Integration**: Direct interfaces to custom analog chips (DAEDALUS, MEDUSA, AMORGOS)
- **Automated Benchmarking**: Standardized test protocols for fair comparisons
- **Web Interface**: User-friendly dashboard for test management and result visualization
- **Research-Grade Data**: Detailed performance metrics for academic publications

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │  Hardware API   │    │ Teensy Firmware │
│   (Next.js)     │◄──►│   (Flask)       │◄──►│ (C++ / Arduino) │
│                 │    │                 │    │                 │
│ • Authentication│    │ • Test Management│    │ • Chip Interface│
│ • Test Dashboard│    │ • Data Collection│    │ • Real-time Ctrl│
│ • Visualization │    │ • Device Control │    │ • Result Buffer │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                         ┌─────────────────┐    ┌─────────────────┐
                         │    Database     │    │ Analog Chips    │
                         │   (SQLite)      │    │ • DAEDALUS (SAT)│
                         │                 │    │ • MEDUSA (SAT)  │
                         │ • User Data     │    │ • AMORGOS (LDPC)│
                         │ • Test Results  │    │                 │
                         │ • System Metrics│    │                 │
                         └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Hardware**: Raspberry Pi 4+ or equivalent Linux machine
- **Software**: Python 3.9+, Node.js 18+, Git
- **Optional**: Teensy 4.1 boards with analog computing chips

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-username/dacroq.git
cd dacroq

# Run development setup
chmod +x scripts/deploy-dev.sh
./scripts/deploy-dev.sh

# Start development environment
./start-dev.sh
```

This will:
- Set up Python virtual environment
- Install all dependencies
- Initialize the database
- Start both API and frontend servers
- Open http://localhost:3000 in your browser

### Production Deployment (Raspberry Pi)

```bash
# Clone and deploy
git clone https://github.com/your-username/dacroq.git
cd dacroq

# Run production deployment
chmod +x scripts/deploy-prod.sh
sudo ./scripts/deploy-prod.sh
```

## 📁 Project Structure

```
dacroq/
├── 📱 web/                     # Next.js frontend application
│   ├── src/app/               # App router pages and components
│   ├── src/components/        # Reusable UI components
│   └── src/lib/              # Utility functions and auth
├── 🔧 api/           # Flask API for hardware control
│   ├── app.py                # Main API server
│   ├── requirements.txt      # Python dependencies
│   └── .venv/               # Virtual environment
├── 💾 firmware/              # Teensy 4.1 firmware projects
│   ├── LDPC_TEENSY/          # AMORGOS LDPC decoder
│   ├── 3SAT_TEENSY/          # DAEDALUS SAT solver
│   └── KSAT_TEENSY/          # MEDUSA SAT solver
├── 🗄️ data/                  # Database and test data storage
│   ├── database/             # SQLite database files
│   └── ldpc/                # LDPC test vectors by SNR
└── 📜 scripts/               # Deployment and utility scripts
    ├── deploy-prod.sh        # Production deployment
    └── deploy-dev.sh         # Development setup
```

## 🧪 Supported Test Types

### SAT Solving
- **Input**: DIMACS CNF format
- **Algorithms**: MiniSAT (digital), DAEDALUS/MEDUSA (analog)
- **Metrics**: Solve time, energy consumption, success rate
- **Problem Sizes**: 3-SAT up to 20 variables, k-SAT up to 1016 clauses

### LDPC Decoding
- **Input**: Soft/hard information vectors
- **Algorithms**: Belief propagation (digital), AMORGOS (analog) 
- **Metrics**: Frame error rate, bit error rate, convergence time
- **Code Parameters**: (96,48) LDPC code at various SNR points

## 🌐 Web Interface Features

### Authentication
- Google OAuth integration
- Role-based access control
- Secure session management

### Test Management
- Create and configure test runs
- Real-time progress monitoring
- Historical test browsing

### Data Visualization
- Performance comparison charts
- Energy efficiency plots
- Error rate analysis
- Export capabilities for publications

### Hardware Monitoring
- Real-time chip health status
- Temperature and power monitoring
- Connection diagnostics

## 🔌 Hardware API

### Endpoints

#### Core API
- `GET /` - API information and available endpoints
- `GET /health` - System health check
- `POST /auth/google` - Google OAuth authentication

#### Test Management
- `GET /tests` - List all tests with filtering
- `POST /tests` - Create new test
- `GET /tests/{id}` - Get test details and results
- `DELETE /tests/{id}` - Delete test

#### LDPC Operations
- `POST /ldpc/jobs` - Create LDPC test job
- `GET /ldpc/jobs` - List LDPC jobs
- `POST /ldpc/process` - Process LDPC test vectors
- `POST /ldpc/generate` - Generate test data
- `POST /ldpc/deploy` - Deploy batch to Teensy
- `POST /ldpc/command` - Send raw command to hardware

#### SAT Solving
- `POST /sat/solve` - Solve SAT problem with performance metrics

#### Administration
- `GET /users` - List users (admin only)
- `PUT /users/{id}` - Update user role
- `DELETE /users/{id}` - Delete user

### Hardware Protocol

The API communicates with Teensy microcontrollers using a standardized protocol:

```python
# Command structure
command = "COMMAND\n"

# Binary data transfer
[START_MARKER: 4 bytes] [LENGTH: 4 bytes] [DATA: variable] [END_MARKER: 4 bytes]

# Common commands
"I"              # Identify device
"STATUS"         # Get device status  
"HEALTH_CHECK"   # Run diagnostics
"RUN_TEST"       # Start test execution
```

## 📊 Performance Benchmarks

### AMORGOS LDPC Decoder
- **Technology**: 28nm CMOS analog computing
- **Convergence Time**: 89ns mean time-to-solution
- **Energy Efficiency**: 5.47 pJ/bit
- **Success Rate**: >99% at 7dB SNR
- **Throughput**: ~10 Mvectors/second

### DAEDALUS SAT Solver  
- **Technology**: 28nm CMOS oscillator network
- **Problem Size**: Up to 20 variables, 91 clauses
- **Solve Time**: <1µs typical
- **Energy**: ~100x more efficient than digital
- **Success Rate**: >95% for satisfiable instances

## 🔧 Development Workflow

### 1. Frontend Development
```bash
cd web
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run test suite
```

### 2. API Development
```bash
cd api
source .venv/bin/activate
python app.py        # Start development server
pytest              # Run tests
```

### 3. Firmware Development
```bash
cd firmware/LDPC_TEENSY
pio run              # Compile firmware
pio run --target upload    # Flash to Teensy
pio device monitor   # Monitor serial output
```

### 4. Testing Hardware Integration
```bash
./test-hardware.sh   # Test Teensy connection
./reset-db.sh        # Reset development database
```

## 🚀 Deployment

### Development
```bash
./start-dev.sh       # Start both API and frontend
```

### Production (Raspberry Pi)
```bash
sudo ./scripts/deploy-prod.sh
```

### Frontend Only (Vercel)
```bash
cd web
vercel deploy --prod
```

## 📝 Environment Configuration

Create `.env` file in project root:

```bash
# Flask Configuration
FLASK_ENV=production
PORT=8000

# Authentication
GOOGLE_CLIENT_ID=your-google-oauth-client-id
ALLOWED_ORIGINS=https://dacroq.net,https://www.dacroq.net

# Optional: Database URL for external DB
# DATABASE_URL=postgresql://user:pass@host/dbname
```

## 🐛 Troubleshooting

### Common Issues

1. **Hardware Not Detected**
   ```bash
   # Check USB connection
   ls /dev/tty.usbmodem*
   
   # Test connection
   ./test-hardware.sh
   ```

2. **API Server Won't Start**
   ```bash
   # Check logs
   sudo journalctl -u dacroq-api -f
   
   # Restart service
   sudo systemctl restart dacroq-api
   ```

3. **Frontend Build Errors**
   ```bash
   # Clear cache and reinstall
   cd web
   rm -rf node_modules .next
   npm install
   ```

4. **Database Issues**
   ```bash
   # Reset database
   ./reset-db.sh
   ```

### Hardware Debugging

- **Serial Monitor**: `pio device monitor --baud 2000000`
- **SPI Analysis**: Use logic analyzer on CLK/MOSI/MISO pins
- **Power Measurement**: Monitor supply rails with multimeter
- **Clock Verification**: Check external clock with oscilloscope

## 📚 Research Applications

This platform has been used for:

- **IEEE Publications**: Benchmarking analog vs digital computing
- **Conference Demos**: Real-time SAT solving demonstrations
- **Academic Collaboration**: Providing standardized test protocols
- **Student Projects**: Teaching analog computing concepts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with detailed description

### Code Style
- **Python**: Follow PEP 8, use Black formatter
- **TypeScript/React**: Use Prettier and ESLint
- **C++**: Follow Google C++ style guide

## 📄 License

This project is intended for research and educational use. See LICENSE file for details.

## 🙏 Acknowledgments

- **Chip Designers**: Teams behind DAEDALUS, MEDUSA, and AMORGOS chips
- **Research Groups**: Academic collaborators and students
- **Open Source**: Built on Flask, Next.js, and Arduino ecosystems

## 📧 Contact

For questions about the platform or research collaboration:
- **Project Lead**: [Your Name] - your.email@university.edu
- **Issues**: Please use GitHub Issues for bug reports
- **Research Inquiries**: Contact via institutional email

---

**🚀 Ready to benchmark analog computing? Start with `./scripts/deploy-dev.sh`** 