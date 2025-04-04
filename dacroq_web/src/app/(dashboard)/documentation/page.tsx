"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import { Button } from "@/components/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  RiFileTextLine,
  RiBookOpenLine,
  RiDownloadLine,
  RiLightbulbLine,
  RiCodeLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiSearchLine,
  RiExternalLinkLine,
  RiCpuLine,
  RiEditLine,
  RiSaveLine,
  RiCloseLine
} from "@remixicon/react";

// Documentation content sections
const DocsContent = {
  introduction: {
    title: "Introduction",
    content: `
    ## What is Dacroq?
    Dacroq stands for Digitally Assisted CMOS Relaxation Oscillator-based Quantum-inspired computing. Specifically, the Dacroq Test Framework system integrates a Next.js web interface with a Go-based API server, enabling hardware-accelerated optimization problem-solving. 
    
    ## Current Capabilities
    - 3-SAT solving using our primary hardware accelerator (Daedalus)
    - Support for multiple input formats, including DIMACS CNF and batch processing via ZIP files
    - Comprehensive performance benchmarking and metrics analysis
    - Specialized problem libraries and preset loading for test cases
    
    ## Platform Architecture
    The Dacroq platform comprises:
    - A Next.js web frontend for user interaction
    - A Go-based API server for backend processing
    - Custom hardware solvers for 3-SAT, K-SAT, and LDPC problems
    `
  },

  "quick-start": {
    title: "Quick Start Guide",
    content: `# Getting Started with Dacroq

Follow these steps to run your first test on the Dacroq platform:

## Running Your First 3-SAT Test
1. **Prepare Your Input**
   - Single .cnf file in DIMACS format
   - .zip archive with multiple .cnf files
   - Select a pre-loaded problem from our presets (available in /api/presets)
   - Direct plaintext input with CNF formatting

2. **Configure and Submit**
   - Navigate to the solver interface
   - Upload or select your problem input
   - Configure any optional solver parameters
   - Click "Run" to start processing

3. **Monitor and Review**
   - Watch real-time updates in the dashboard
   - Wait for the test status to update from "Processing" to "Completed"
   - Click on a completed test to view detailed results and performance metrics

## Test Management
- All test runs are displayed in the dashboard for collaborative review
- Downloadable results and benchmarks for offline analysis
- Options to delete tests that are no longer needed`
  },

  installation: {
    title: "Installation & Setup",
    content: `# Accessing and Setting Up the Dacroq Platform

## User Access
1. **Request Access**
   - Email help@dacroq.eecs.umich.edu with your institutional and research details.
2. **Account Setup**
   - Receive login credentials via email.
   - Sign in at [dacroq.eecs.umich.edu](https://dacroq.eecs.umich.edu).
   - Update your password and complete your user profile on first login.

## Developer Setup
For local development and API integration:
1. **Clone the Repository**
   \`\`\`bash
   git clone https://github.com/username/dacroq.git
   cd dacroq
   \`\`\`
2. **Web Client Setup**
   \`\`\`bash
   cd dacroq_web
   npm install
   npm run dev
   \`\`\`
3. **API Server Setup**
   \`\`\`bash
   cd api
   go build -o dacroq
   ./dacroq
   \`\`\`
4. **Docker Deployment**
   \`\`\`bash
   docker-compose up -d
   \`\`\`

## System Requirements
- Modern web browser (Chrome, Firefox, Safari)
- Node.js 14+ for the web client
- Go 1.16+ for the API server
- Docker for containerized deployments`
  },

  "hardware-architecture": {
    title: "Hardware Architecture",
    content: `# Dacroq Hardware Architecture

## Overview
The Dacroq platform leverages custom hardware accelerators to solve complex Boolean satisfiability problems efficiently. Our system includes three specialized hardware modules:

- **Daedalus (3-SAT Solver):** Equipped with 50 relaxation oscillators, an analog crossbar network, and SPI-based configuration.
- **Amorgos (LDPC Decoder):** Designed for high-performance error correction.
- **Medusa (K-SAT Solver):** Under development for handling variable clause lengths.

## Hardware Components
### Daedalus (3-SAT Solver)
- 50 relaxation oscillators for mapping Boolean variables
- Analog crossbar network for clause evaluation
- SPI-controlled scan chains for rapid configuration
- Real-time error monitoring and automatic problem decomposition

### Communication & Control
- Teensy 4.1 microcontroller bridges for hardware interfacing
- High-speed serial communication (2M baud) with error-correcting protocols
- Integration with the Go-based API server for hardware management

## Problem Decomposition
For problems exceeding hardware capacity:
- Spectral partitioning and variable clustering techniques
- Generation of optimized subproblems
- Hierarchical solution recombination for accurate results`
  },

  "software-architecture": {
    title: "Software Architecture",
    content: `# Dacroq Software Architecture

## Web Interface
Built with Next.js, our frontend offers:
- Server-side rendering and dynamic client-side updates
- Intuitive problem submission and monitoring interfaces
- Real-time visualization of solver performance metrics
- Integration with custom React components and Tailwind CSS styling

## Backend API
Our Go-based API server is responsible for:
- Validating and preprocessing submitted problems
- Managing communication with hardware solvers
- Capturing and analyzing performance metrics
- Handling solution verification and result formatting

## Data Flow & Deployment
1. **Problem Submission:** Users submit problems via the web interface, which are sent to the API server.
2. **Solver Execution:** The API server processes and routes problems to the appropriate hardware accelerator.
3. **Result Delivery:** Solutions and performance data are collected, verified, and relayed back to the frontend.
4. **Deployment Options:** 
   - Full-stack deployment using Docker Compose
   - Independent deployment of the web client and API server for scalability`
  },

  "3-sat-solver": {
    title: "3-SAT Solver",
    content: `# 3-SAT Solver

## Overview
The 3-SAT solver is the flagship component of Dacroq, engineered to solve Boolean satisfiability problems where each clause contains exactly three literals.

## Technical Details
- Utilizes hardware acceleration with relaxation oscillators
- Supports problems up to 50 variables and 228 clauses in hardware
- Employs problem decomposition for larger instances
- Optional WalkSAT refinement for challenging cases
- Provides real-time convergence monitoring and performance analysis

## Usage Instructions
1. Format your problem in DIMACS CNF format.
2. Submit your problem via the web interface.
3. Monitor the test status and review detailed results upon completion

## Performance Metrics
- Success rate
- Total runtime and phase-specific timings
- Iteration count and convergence data
- Energy efficiency and resource utilization`
  },

  "k-sat-solver": {
    title: "K-SAT Solver",
    content: `# K-SAT Solver

## Overview
The K-SAT solver extends our 3-SAT capabilities to handle problems with clauses of variable lengths. It is designed to provide enhanced flexibility and performance for more complex satisfiability problems.

## Current Status
🚧 **Under Development**

Core functionalities are being implemented in the /api/medusa directory.

## Planned Features
- Support for clauses of varying lengths within the same problem
- Advanced problem decomposition tailored for K-SAT challenges
- Optimized hardware mapping and resource allocation
- Comparative performance analysis against the 3-SAT solver

## Roadmap
- **Alpha Testing:** Q3 2023
- **Beta Release:** Q4 2023
- **General Availability:** Q1 2024

We welcome early feedback and collaboration from interested partners.`
  },

  "ldpc-solver": {
    title: "LDPC Solver",
    content: `# LDPC Solver

## Overview
The LDPC (Low-Density Parity-Check) solver is engineered for error-correcting applications, leveraging our hardware accelerators to deliver high-performance decoding.

## Current Status
🚧 **Under Development**

Development is actively underway in the /api/amorgos directory.

## Technical Foundations
- Maps LDPC decoding tasks to custom hardware accelerators
- Implements iterative decoding algorithms (min-sum, sum-product)
- Optimizes for various LDPC matrix formats and structures
- Designed for high-throughput and low-latency operation

## Planned Capabilities
- Support for multiple LDPC matrix representations
- Comparative benchmarking against traditional software decoders
- Enhanced performance visualization and analysis tools
- Batch processing for decoding multiple code words simultaneously

## Application Areas
- Wireless communications (5G, WiFi)
- Data storage systems
- Deep space and optical communications
- Quantum error correction`
  }
};


// Define category structure with nesting
const docsStructure = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <RiBookOpenLine className="size-4" />,
    items: [
      { id: "introduction", title: "Introduction" },
      { id: "quick-start", title: "Quick Start Guide" },
      { id: "installation", title: "Installation" }
    ]
  },
  {
    id: "architecture",
    title: "System Architecture",
    icon: <RiCpuLine className="size-4" />,
    items: [
      { id: "hardware-architecture", title: "Hardware Architecture" },
      { id: "software-architecture", title: "Software Architecture" }
    ]
  },
  {
    id: "solvers",
    title: "Solvers",
    icon: <RiLightbulbLine className="size-4" />,
    items: [
      { id: "3-sat-solver", title: "3-SAT Solver" },
      { id: "k-sat-solver", title: "K-SAT Solver" },
      { id: "ldpc-solver", title: "LDPC Solver" }
    ]
  }
];

// Helper function to render markdown content
const renderMarkdown = (content) => {
  const lines = content.split('\n');
  let elements = [];
  let listItems = [];
  let key = 0;

  const finishList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key++}`} className="ml-6 mt-2 mb-4 space-y-2">
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine === '') {
      finishList();
      elements.push(<div key={`space-${key++}`} className="my-2" />);
    }
    else if (trimmedLine.startsWith('## ')) {
      finishList();
      elements.push(
        <h2 key={`h2-${key++}`} className="text-xl font-semibold mt-6 mb-2 text-gray-900 dark:text-gray-50">
          {trimmedLine.substring(3)}
        </h2>
      );
    }
    else if (trimmedLine.startsWith('### ')) {
      finishList();
      elements.push(
        <h3 key={`h3-${key++}`} className="text-lg font-medium mt-4 mb-2 text-gray-900 dark:text-gray-50">
          {trimmedLine.substring(4)}
        </h3>
      );
    }
    else if (trimmedLine.startsWith('- ')) {
      listItems.push(
        <li key={`li-${key++}`} className="text-gray-700 dark:text-gray-300">
          {trimmedLine.substring(2)}
        </li>
      );
    }
    else if (/^\d+\./.test(trimmedLine)) {
      finishList();
      elements.push(
        <div key={`num-${key++}`} className="ml-6 my-1 text-gray-700 dark:text-gray-300">
          {trimmedLine}
        </div>
      );
    }
    else {
      finishList();
      elements.push(
        <p key={`p-${key++}`} className="my-2 text-gray-700 dark:text-gray-300">
          {trimmedLine}
        </p>
      );
    }
  });

  finishList();
  return elements;
};

export default function Documentation() {
  // Simulated admin status - replace with actual auth logic
  const isAdmin = true; // TODO: Replace with actual auth check

  const [activeSection, setActiveSection] = useState("introduction");
  const [expandedSections, setExpandedSections] = useState(docsStructure.map(section => section.id));
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // New states for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState("preview");

  // Update edit content when section changes
  useEffect(() => {
    if (DocsContent[activeSection]) {
      setEditContent(DocsContent[activeSection].content);
      setEditTitle(DocsContent[activeSection].title);
    }
  }, [activeSection]);

  // Reset editing state when section changes
  useEffect(() => {
    setIsEditing(false);
    setActiveTab("preview");
  }, [activeSection]);

  const handleStartEditing = () => {
    setIsEditing(true);
    setEditContent(DocsContent[activeSection].content);
    setEditTitle(DocsContent[activeSection].title);
    setActiveTab("edit");
  };

  const handleSave = async () => {
    try {
      // Here you would make an API call to save the content
      // For now we'll just simulate it
      console.log("Saving content for section:", activeSection);
      console.log("New title:", editTitle);
      console.log("New content:", editContent);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update local state
      DocsContent[activeSection] = {
        ...DocsContent[activeSection],
        title: editTitle,
        content: editContent
      };

      setIsEditing(false);
      setActiveTab("preview");
    } catch (error) {
      console.error("Error saving content:", error);
      // Show error message to user
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditContent(DocsContent[activeSection].content);
    setEditTitle(DocsContent[activeSection].title);
    setActiveTab("preview");
  };

  // Find parent section for navigation
  const findParentSection = (itemId) => {
    for (const section of docsStructure) {
      if (section.items.some(item => item.id === itemId)) {
        return section.id;
      }
    }
    return null;
  };

  // Toggle section expansion
  const toggleSection = (sectionId) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  // Handle section selection and ensure parent is expanded
  useEffect(() => {
    const parentId = findParentSection(activeSection);
    if (parentId && !expandedSections.includes(parentId)) {
      setExpandedSections(prev => [...prev, parentId]);
    }
  }, [activeSection]);

  // Find next and previous items for navigation
  const findAdjacentItems = () => {
    const allItems = docsStructure.flatMap(section => section.items);
    const currentIndex = allItems.findIndex(item => item.id === activeSection);

    return {
      prev: currentIndex > 0 ? allItems[currentIndex - 1] : null,
      next: currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : null
    };
  };

  const { prev, next } = findAdjacentItems();

  return (
    <main className="flex flex-col lg:flex-row gap-8">
      {/* Mobile Header */}
      <div className="block lg:hidden">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Documentation
            </h1>
            <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
              Comprehensive guides for using the Dacroq platform
            </p>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex items-center justify-between w-full px-4 py-2 bg-white dark:bg-gray-900 border rounded-lg shadow-sm"
          >
            <span>{editTitle}</span>
            <RiArrowDownSLine className={`transition-transform ${isMobileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="mt-2 bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-4">
            <div className="mb-4">
              <div className="relative">
                <RiSearchLine className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search docs..."
                  className="pl-8 w-full bg-gray-100 dark:bg-gray-800 border-none rounded-md py-2 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            {docsStructure.map((section) => (
              <div key={section.id} className="mb-4">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center w-full text-left font-medium"
                >
                  <span className="mr-2">{section.icon}</span>
                  <span>{section.title}</span>
                  <RiArrowDownSLine
                    className={`ml-auto transition-transform ${expandedSections.includes(section.id) ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.includes(section.id) && (
                  <ul className="pl-6 space-y-2">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => {
                            setActiveSection(item.id);
                            setIsMobileMenuOpen(false);
                          }}
                          className={`text-sm ${activeSection === item.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-0">
          <div className="mb-6">
            <div className="relative">
              <RiSearchLine className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search docs..."
                className="pl-8 w-full bg-gray-100 dark:bg-gray-800 border-none rounded-md py-2 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <nav className="space-y-6">
            {docsStructure.map((section) => (
              <div key={section.id} className="space-y-2">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center w-full text-left font-medium"
                >
                  <span className="mr-2">{section.icon}</span>
                  <span>{section.title}</span>
                  <RiArrowDownSLine
                    className={`ml-auto transition-transform ${expandedSections.includes(section.id) ? 'rotate-180' : ''}`}
                  />
                </button>
                {expandedSections.includes(section.id) && (
                  <ul className="pl-6 space-y-2">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => setActiveSection(item.id)}
                          className={`text-sm ${activeSection === item.id ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                        >
                          {item.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <h3 className="font-medium text-sm mb-2">Need more help?</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
              If you can't find what you're looking for in our documentation, reach out to our support team.
            </p>
            <a
              href="mailto:help@dacroq.eecs.umich.edu"
              className="text-blue-600 dark:text-blue-400 text-sm flex items-center"
            >
              Contact Support
              <RiExternalLinkLine className="ml-1 size-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <Divider className="block lg:hidden" />

        {/* Documentation Header */}
        <div className="flex items-center justify-between mb-6">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-2xl font-semibold w-full bg-transparent border-b border-gray-200 dark:border-gray-800 focus:outline-none focus:border-blue-500"
            />
          ) : (
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {editTitle}
            </h2>
          )}

          {isAdmin && !isEditing && (
            <Button
              variant="outline"
              onClick={handleStartEditing}
              className="flex items-center gap-2"
            >
              <RiEditLine className="size-4" />
              Edit
            </Button>
          )}
        </div>

        {/* Documentation Content */}
        {isEditing ? (
          <Card className="p-6 shadow-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex items-center justify-between mb-4">
                <TabsList>
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex items-center gap-2"
                  >
                    <RiCloseLine className="size-4" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    className="flex items-center gap-2"
                  >
                    <RiSaveLine className="size-4" />
                    Save
                  </Button>
                </div>
              </div>

              <TabsContent value="edit">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[500px] font-mono text-sm p-4 bg-gray-50 dark:bg-gray-900"
                  placeholder="Enter markdown content..."
                />
              </TabsContent>

              <TabsContent value="preview">
                <div className="documentation-content">
                  {renderMarkdown(editContent)}
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        ) : (
          <Card className="p-6 shadow-sm">
            <div className="documentation-content">
              {renderMarkdown(editContent)}
            </div>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex flex-wrap justify-between gap-4 pt-6 border-t">
          <div>
            {prev && (
              <button
                onClick={() => setActiveSection(prev.id)}
                className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <RiArrowRightSLine className="mr-1 size-4 rotate-180" />
                <span className="text-sm mr-2">Previous</span>
                <span className="text-sm font-medium">{prev.title}</span>
              </button>
            )}
          </div>
          <div>
            {next && (
              <button
                onClick={() => setActiveSection(next.id)}
                className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <span className="text-sm mr-2">Next</span>
                <span className="text-sm font-medium">{next.title}</span>
                <RiArrowRightSLine className="ml-1 size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}