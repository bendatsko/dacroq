#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <filesystem>
#include <iomanip>

using namespace std;
namespace fs = std::filesystem;

// Structure to hold chip information
struct ChipInfo {
    string name;
    string port;
    bool buildSuccess = false;
    bool uploadSuccess = false;
    string actualPort = "";
};

// Function to parse the portmap.json file
vector<ChipInfo> parsePortmapJson(const string& filename) {
    vector<ChipInfo> chips;
    ifstream file(filename);
    
    if (!file.is_open()) {
        cerr << "Error: Unable to open " << filename << endl;
        return chips;
    }
    
    string line;
    ChipInfo currentChip;
    bool inSolvers = false;
    bool inChip = false;
    
    while (getline(file, line)) {
        // Check if we're in the solvers array
        if (line.find("\"solvers\": [") != string::npos) {
            inSolvers = true;
            continue;
        }
        
        if (!inSolvers) continue;
        
        // Start of a new chip object
        if (line.find("{") != string::npos && !inChip) {
            inChip = true;
            currentChip = ChipInfo();
            continue;
        }
        
        // End of a chip object
        if (line.find("}") != string::npos && inChip) {
            inChip = false;
            if (!currentChip.name.empty() && !currentChip.port.empty()) {
                chips.push_back(currentChip);
            }
            continue;
        }
        
        if (!inChip) continue;
        
        // Extract name
        size_t namePos = line.find("\"name\":");
        if (namePos != string::npos) {
            size_t startQuote = line.find("\"", namePos + 7);
            size_t endQuote = line.find("\"", startQuote + 1);
            if (startQuote != string::npos && endQuote != string::npos) {
                currentChip.name = line.substr(startQuote + 1, endQuote - startQuote - 1);
            }
            continue;
        }
        
        // Extract port
        size_t portPos = line.find("\"port\":");
        if (portPos != string::npos) {
            size_t startQuote = line.find("\"", portPos + 7);
            size_t endQuote = line.find("\"", startQuote + 1);
            if (startQuote != string::npos && endQuote != string::npos) {
                currentChip.port = line.substr(startQuote + 1, endQuote - startQuote - 1);
                currentChip.actualPort = currentChip.port; // Initialize with expected port
            }
            continue;
        }
    }
    
    return chips;
}

// Function to detect actual port for a device (simplified for example)
string detectActualPort(const string& chipName) {
    // In a real implementation, you would scan available ports
    // and determine which one corresponds to the chip
    // For now, we'll just return the expected port
    
    // You could implement actual port detection using system commands like:
    // system("ls /dev/cu.usb* > ports.txt");
    // and then read ports.txt to find matching ports
    
    // This is just a placeholder
    return "";
}

// Function to update platformio.ini with the correct port
bool updatePlatformioIni(const string& filename, const string& port) {
    ifstream inFile(filename);
    if (!inFile.is_open()) {
        cerr << "Error: Unable to open " << filename << " for reading" << endl;
        return false;
    }
    
    string content;
    string line;
    bool uploadPortFound = false;
    
    while (getline(inFile, line)) {
        // Check if the line already has upload_port
        if (line.find("upload_port") != string::npos) {
            content += "upload_port = " + port + "\n";
            uploadPortFound = true;
        } else {
            // Check if we're at the end of the [env:teensy41] section
            if (!uploadPortFound && line.find("lib_deps") != string::npos) {
                // Insert upload_port before lib_deps
                content += "upload_port = " + port + "\n";
                content += line + "\n";
                uploadPortFound = true;
            } else {
                content += line + "\n";
            }
        }
    }
    
    inFile.close();
    
    // If we didn't find a place to add the upload_port, add it at the end
    if (!uploadPortFound) {
        content += "upload_port = " + port + "\n";
    }
    
    // Write the updated content back to the file
    ofstream outFile(filename);
    if (!outFile.is_open()) {
        cerr << "Error: Unable to open " << filename << " for writing" << endl;
        return false;
    }
    
    outFile << content;
    outFile.close();
    
    cout << "Updated " << filename << " with upload_port = " << port << endl;
    return true;
}

// Function to build and upload a chip
bool buildAndUploadChip(ChipInfo& chip, const string& baseDir) {
    cout << "========================================" << endl;
    cout << "Processing " << chip.name << " chip" << endl;
    cout << "========================================" << endl;
    
    // Check if chip directory exists
    string chipDir = baseDir + "/" + chip.name;
    if (!fs::exists(chipDir)) {
        cerr << "Error: Directory " << chipDir << " does not exist." << endl;
        return false;
    }
    
    // Check if platformio.ini exists
    string platformioFile = chipDir + "/platformio.ini";
    if (!fs::exists(platformioFile)) {
        cerr << "Error: platformio.ini not found in " << chipDir << endl;
        return false;
    }
    
    // Detect actual port (in a real implementation, you would fill this in)
    string actualPort = detectActualPort(chip.name);
    if (!actualPort.empty()) {
        chip.actualPort = actualPort;
    }
    
    // Update platformio.ini with the correct port
    if (!updatePlatformioIni(platformioFile, chip.port)) {
        cerr << "Error: Failed to update platformio.ini" << endl;
        return false;
    }
    
    // Change to chip directory
    string currentDir = fs::current_path().string();
    fs::current_path(chipDir);
    cout << "Changed to directory: " << fs::current_path().string() << endl;
    
    // Build the project
    cout << "Building..." << endl;
    int buildResult = system("platformio run");
    if (buildResult != 0) {
        cerr << "Error: Build failed for " << chip.name << endl;
        fs::current_path(currentDir);
        return false;
    }
    
    chip.buildSuccess = true;
    cout << "Build successful, uploading..." << endl;
    
    // Upload to the specific port
    if (!chip.port.empty()) {
        cout << "Using port: " << chip.port << endl;
        string uploadCmd = "platformio run --target upload";
        
        int uploadResult = system(uploadCmd.c_str());
        if (uploadResult != 0) {
            cerr << "Error: Upload failed for " << chip.name << endl;
            fs::current_path(currentDir);
            return false;
        }
        
        chip.uploadSuccess = true;
        cout << "Upload successful!" << endl;
    } else {
        cerr << "Error: No port specified for " << chip.name << endl;
        fs::current_path(currentDir);
        return false;
    }
    
    // Return to original directory
    fs::current_path(currentDir);
    return true;
}

// Function to print port mappings and validation results
void printResults(const vector<ChipInfo>& chips) {
    cout << "\n========================================" << endl;
    cout << "CHIP PORT MAPPINGS" << endl;
    cout << "========================================" << endl;
    
    for (const auto& chip : chips) {
        cout << setw(10) << left << chip.name << " --> " << chip.port << endl;
    }
    
    cout << "\n========================================" << endl;
    cout << "BUILD AND UPLOAD RESULTS" << endl;
    cout << "========================================" << endl;
    
    int buildCount = 0;
    int uploadCount = 0;
    
    for (const auto& chip : chips) {
        string buildStatus = chip.buildSuccess ? "SUCCESS" : "FAILED";
        string uploadStatus = chip.uploadSuccess ? "SUCCESS" : "FAILED";
        
        cout << setw(10) << left << chip.name << " Build: " << setw(8) << buildStatus;
        cout << " Upload: " << setw(8) << uploadStatus;
        
        if (chip.port != chip.actualPort && !chip.actualPort.empty()) {
            cout << " PORT MISMATCH! Expected: " << chip.port << ", Actual: " << chip.actualPort;
        }
        
        cout << endl;
        
        if (chip.buildSuccess) buildCount++;
        if (chip.uploadSuccess) uploadCount++;
    }
    
    cout << "\n========================================" << endl;
    cout << "SUMMARY: " << buildCount << "/" << chips.size() << " builds successful, ";
    cout << uploadCount << "/" << chips.size() << " uploads successful" << endl;
    cout << "========================================" << endl;
}

int main() {
    // Get current directory
    string baseDir = fs::current_path().string();
    cout << "Starting from base directory: " << baseDir << endl;
    
    // Parse portmap.json
    string portmapFile = baseDir + "/portmap.json";
    vector<ChipInfo> chips = parsePortmapJson(portmapFile);
    
    if (chips.empty()) {
        cerr << "Error: No chips found in portmap.json" << endl;
        return 1;
    }
    
    cout << "Found " << chips.size() << " chips in portmap.json" << endl;
    cout << "\nExpected port mappings:" << endl;
    for (const auto& chip : chips) {
        cout << setw(10) << left << chip.name << " --> " << chip.port << endl;
    }
    cout << endl;
    
    // Build and upload each chip
    for (auto& chip : chips) {
        buildAndUploadChip(chip, baseDir);
    }
    
    // Print results
    printResults(chips);
    
    return 0;
}