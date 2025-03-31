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

  "hardware-architecture": {
    title: "Hardware Architecture",
    content: `## System Overview
Our platform combines specialized hardware accelerators with custom software to solve complex optimization problems. The system consists of three main accelerators:

- **Daedalus**: 3-SAT solver featuring 50 relaxation oscillators
- **Amorgos**: LDPC decoder for error correction
- **Medusa**: Advanced k-SAT solver implementation

Each accelerator operates on dedicated testbeds controlled by Teensy 4.1 microcontrollers, using 2M baud serial connections for rapid data exchange.

## Hardware Components
### 3-SAT Solver (Daedalus)
- 50 relaxation oscillators for direct variable mapping
- Analog crossbar network handling up to 50 variables and 228 clauses
- SPI-based scan chains for configuration
- Real-time error signal monitoring
- Automatic problem decomposition for larger instances

### Physical Interface
- Teensy 4.1 microcontroller bridge
- Error-correcting protocols with hash verification
- Local SD card storage for configurations and solutions
- Direct mapping of DIMACS CNF files to hardware states

## Problem Decomposition
For problems exceeding hardware capacity:
- Spectral partitioning algorithm for problem division
- Graph-based variable clustering
- Optimized subproblem generation
- Hierarchical solution reconstruction`
  },

  "software-architecture": {
    title: "Software Architecture",
    content: `## Web Interface
Our Next.js frontend provides intuitive access to the system's capabilities:
- Direct CNF entry and file uploads
- Real-time monitoring displays
- Cloud integration for status updates
- Performance metrics visualization

## Backend System
The Flask-based backend serves as the system kernel:
- Problem validation and encoding
- Automatic decomposition
- Performance metrics computation
- Solution verification
- Hardware resource management

## API Integration
Our API provides seamless integration between web users and hardware accelerators:
- Problem translation to hardware-compatible formats
- Metadata tracking and management
- Decomposition handling for large problems
- Solution reconstruction and verification

## Problem Processing
1. **Problem Intake**
   - Sequential problem numbering
   - JSON metadata generation
   - Format validation
   - Preprocessing optimization

2. **Hardware Acceleration**
   - Direct problem mapping
   - Physical convergence monitoring
   - Solution state capture
   - Performance tracking

3. **Solution Processing**
   - Subproblem recombination
   - WalkSAT refinement when needed
   - Solution verification
   - Results reporting`
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