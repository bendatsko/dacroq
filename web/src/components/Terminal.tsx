"use client";

import { useState, useEffect, useRef } from "react";
import { RiLoader4Line, RiEyeLine, RiStopLine, RiPlayLine, RiRefreshLine } from "@remixicon/react";

// API endpoint - using the same as in the main app
const API_BASE = "/api/proxy";

// Terminal interface types
interface TerminalHistoryItem {
  timestamp: string;
  content: string;
  isCommand?: boolean;
  isError?: boolean;
}

export const Terminal = () => {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<TerminalHistoryItem[]>([
    { timestamp: new Date().toLocaleTimeString(), content: "KSAT API Terminal v1.0.0", isCommand: false },
    { timestamp: new Date().toLocaleTimeString(), content: "Type 'help' for available commands", isCommand: false }
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [apiStatus, setApiStatus] = useState<string>("unknown");
  const [availableSerialPorts, setAvailableSerialPorts] = useState<string[]>([]);
  const [monitoringPort, setMonitoringPort] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(true);
  const terminalRef = useRef<HTMLDivElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Replace WebSocket with polling
  useEffect(() => {
    // Initial status check
    checkApiStatus();
    fetchSerialPorts();
    
    // Set up polling interval
    if (pollingActive) {
      pollingIntervalRef.current = setInterval(() => {
        // Only fetch logs if we're not in the middle of executing a command
        if (!isExecuting) {
          fetchLatestLogs();
        }
        
        // Refresh API status & serial ports every 10 seconds
        checkApiStatus();
        if (monitoringPort) {
          fetchSerialData(monitoringPort);
        }
      }, 5000);
    }
    
    // Cleanup function
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollingActive, monitoringPort, isExecuting]);
  
  // Fetch serial ports
  const fetchSerialPorts = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: 'ls -l /dev/tty*' }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Parse the output to extract serial ports
        const lines = result.output.split('\n');
        const serialPorts = lines
          .filter(line => line.includes('/dev/tty'))
          .map(line => {
            const parts = line.trim().split(' ');
            return parts[parts.length - 1];
          })
          .filter(port => port && port.startsWith('/dev/tty'));
        
        setAvailableSerialPorts(serialPorts);
      }
    } catch (error) {
      console.error('Error fetching serial ports:', error);
    }
  };
  
  // Fetch serial data from a specific port
  const fetchSerialData = async (port: string) => {
    try {
      const response = await fetch(`${API_BASE}/admin/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: `cat ${port} || echo "Cannot read from ${port}. Make sure it's not in use by another process."` 
        }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success && result.output) {
        addHistoryItem(`Data from ${port}: ${result.output}`, false);
      }
    } catch (error) {
      console.error(`Error reading from serial port ${port}:`, error);
    }
  };
  
  // Check API status
  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      setApiStatus(data.api_status || "unknown");
    } catch (error) {
      console.error('Error checking API status:', error);
      setApiStatus("error");
    }
  };
  
  // Fetch latest logs using the admin command endpoint
  const fetchLatestLogs = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: 'journalctl -u ksat-api -n 5 --no-pager' }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success && result.output) {
        // Process logs and add any new ones to history
        const logs = result.output.split('\n').filter(Boolean);
        
        // Only add the last 2 logs to avoid flooding the terminal
        const recentLogs = logs.slice(-2);
        for (const log of recentLogs) {
          // Check if this log is already in history (avoid duplicates)
          const isDuplicate = history.some(item => item.content.includes(log));
          if (!isDuplicate && log.trim()) {
            addHistoryItem(log, false);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };
  
  // Auto-scroll to bottom when history changes
  useEffect(() => {
    scrollToBottom();
  }, [history]);
  
  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };
  
  const addHistoryItem = (content: string, isCommand = false, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setHistory(prev => [...prev, { timestamp, content, isCommand, isError }]);
  };
  
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!command.trim()) return;
    
    // Add command to history
    addHistoryItem(command, true);
    
    // Process built-in commands
    if (command === 'clear') {
      setHistory([]);
      setCommand("");
      return;
    }
    
    if (command === 'help') {
      addHistoryItem(`Available commands:
- clear: Clear terminal history
- help: Show this help message
- status: Check KSAT API service status
- restart: Restart KSAT API service
- log: Show recent logs
- hardware: List connected hardware
- cpu: Show CPU info
- memory: Show memory usage
- serial: List all serial ports
- monitor <port>: Monitor a specific serial port (ex: monitor /dev/ttyACM0)
- freeze: Pause the KSAT API service
- unfreeze: Resume the KSAT API service
- toggle-polling: Turn on/off automatic log polling
- announce <message>: Send an announcement to all users`, false);
      setCommand("");
      return;
    }
    
    if (command === 'serial') {
      // Refresh the serial port list
      await fetchSerialPorts();
      addHistoryItem(`Available serial ports:
${availableSerialPorts.map(port => `- ${port}`).join('\n')}`, false);
      setCommand("");
      return;
    }
    
    if (command.startsWith('monitor ')) {
      const port = command.split(' ')[1];
      if (port && port.startsWith('/dev/tty')) {
        setMonitoringPort(port);
        addHistoryItem(`Now monitoring ${port}. Data will appear in this terminal.`, false);
        // Immediate fetch of data
        fetchSerialData(port);
      } else {
        addHistoryItem(`Invalid port. Use 'serial' command to see available ports.`, false, true);
      }
      setCommand("");
      return;
    }
    
    if (command.startsWith('announce ')) {
      // Extract the announcement message (everything after "announce ")
      const message = command.substring(9).trim();
      
      if (!message) {
        addHistoryItem('Error: Announcement cannot be empty', false, true);
        setCommand("");
        return;
      }
      
      setIsExecuting(true);

    
    if (command === 'toggle-polling') {
      setPollingActive(!pollingActive);
      addHistoryItem(`Automatic polling ${!pollingActive ? 'enabled' : 'disabled'}`, false);
      setCommand("");
      return;
    }
    
    if (command === 'freeze') {
      setIsExecuting(true);
      try {
        const response = await fetch(`${API_BASE}/admin/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'systemctl stop ksat-api' }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          addHistoryItem(`KSAT API has been frozen (stopped)`, false);
          setApiStatus("offline");
        } else {
          addHistoryItem(`Failed to freeze API: ${result.error || 'Unknown error'}`, false, true);
        }
      } catch (error) {
        console.error('Error freezing API:', error);
        addHistoryItem(`Failed to freeze API: ${error}`, false, true);
      } finally {
        setIsExecuting(false);
      }
      setCommand("");
      return;
    }
    
    if (command === 'unfreeze') {
      setIsExecuting(true);
      try {
        const response = await fetch(`${API_BASE}/admin/command`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ command: 'systemctl start ksat-api' }),
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          addHistoryItem(`KSAT API has been unfrozen (started)`, false);
          // Give it a moment to start up
          setTimeout(checkApiStatus, 2000);
        } else {
          addHistoryItem(`Failed to unfreeze API: ${result.error || 'Unknown error'}`, false, true);
        }
      } catch (error) {
        console.error('Error unfreezing API:', error);
        addHistoryItem(`Failed to unfreeze API: ${error}`, false, true);
      } finally {
        setIsExecuting(false);
      }
      setCommand("");
      return;
    }
    
    // Map friendly commands to actual commands
    let actualCommand = command;
    if (command === 'status') actualCommand = 'systemctl status ksat-api';
    if (command === 'restart') actualCommand = 'systemctl restart ksat-api';
    if (command === 'log') actualCommand = 'journalctl -u ksat-api -n 20 --no-pager';
    if (command === 'hardware') actualCommand = 'ls -l /dev/tty*';
    if (command === 'cpu') actualCommand = 'cat /proc/cpuinfo | grep -E "model name|processor"';
    if (command === 'memory') actualCommand = 'free -h';
    
    // Execute command
    setIsExecuting(true);
    try {
      const response = await fetch(`${API_BASE}/admin/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: actualCommand }),
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        // Add command output to history
        if (result.output) {
          addHistoryItem(result.output, false);
        }
        
        // If it was a restart, refresh the API status after a moment
        if (command === 'restart') {
          setTimeout(checkApiStatus, 2000);
        }
      } else {
        // Add error to history
        const errorMessage = result.error || result.message || 'Unknown error';
        addHistoryItem(errorMessage, false, true);
        
        if (result.output) {
          addHistoryItem(result.output, false);
        }
      }
    } catch (error) {
      console.error('Error executing command:', error);
      addHistoryItem(`Failed to execute command: ${error}`, false, true);
    } finally {
      setIsExecuting(false);
      setCommand("");
    }
  };
  
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
      <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center">
          <div className="flex space-x-2 mr-3">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </div>
          <h3 className="text-sm text-white font-medium">KSAT API Terminal</h3>
        </div>
        <div className="flex items-center space-x-3">
          {monitoringPort && (
            <span className="text-xs text-blue-400 flex items-center">
              <RiEyeLine className="h-3 w-3 mr-1" />
              Monitoring: {monitoringPort.split('/').pop()}
            </span>
          )}
          <span className={`h-2 w-2 rounded-full mr-2 ${
            apiStatus === "ok" ? 'bg-green-500' : 
            apiStatus === "degraded" ? 'bg-yellow-500' : 
            'bg-red-500'
          }`}></span>
          <span className="text-xs text-gray-400">
            API: {apiStatus === "ok" ? 'Online' : apiStatus === "degraded" ? 'Degraded' : 'Offline'}
          </span>
          <button 
            onClick={() => setPollingActive(!pollingActive)}
            className="text-xs flex items-center text-gray-400 hover:text-white"
            title={pollingActive ? "Pause auto-polling" : "Resume auto-polling"}
          >
            {pollingActive ? (
              <RiStopLine className="h-3 w-3 text-red-400" />
            ) : (
              <RiPlayLine className="h-3 w-3 text-green-400" />
            )}
          </button>
          <button 
            onClick={fetchSerialPorts}
            className="text-xs flex items-center text-gray-400 hover:text-white"
            title="Refresh serial ports"
          >
            <RiRefreshLine className="h-3 w-3" />
          </button>
        </div>
      </div>
      
      <div 
        ref={terminalRef}
        className="bg-black text-green-500 p-4 h-96 overflow-y-auto font-mono text-sm"
      >
        {history.map((item, index) => (
          <div key={index} className="py-1">
            <span className="text-gray-500">[{item.timestamp}]</span>
            {item.isCommand ? (
              <span className="ml-2 text-yellow-500">$ {item.content}</span>
            ) : (
              <span className={`ml-2 ${item.isError ? 'text-red-500' : 'text-green-400'}`}>
                {item.content}
              </span>
            )}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleCommandSubmit} className="flex border-t border-gray-700">
        <span className="pl-3 py-2 text-yellow-500 font-mono">$</span>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command..."
          className="flex-1 bg-black text-green-500 px-2 py-2 outline-none font-mono"
          disabled={isExecuting}
        />
        <button
          type="submit"
          className="bg-gray-800 text-white px-4 font-mono text-sm border-l border-gray-700"
          disabled={isExecuting}
        >
          {isExecuting ? (
            <RiLoader4Line className="h-4 w-4 animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </form>
    </div>
  );
};
