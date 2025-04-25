"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export default function MonitoringPage() {
  const [queryTimeRange, setQueryTimeRange] = useState("24 hours")
  const [visualizationType, setVisualizationType] = useState("Edge Requests")
  const [hasResults, setHasResults] = useState(false)
  
  const runQuery = () => {
    // In a real implementation, this would fetch data from an analytics service
    // For now, just toggle the UI state
    setHasResults(!hasResults)
  }

  return (
    <div className="w-full px-4 sm:px-6 py-5">
      {/* Page description - this will appear below the header in the Navigation component */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', () => {
              const descriptionEl = document.getElementById('page-description');
              if (descriptionEl) {
                descriptionEl.innerHTML = 'Query and visualize your Dacroq usage, traffic, and performance metrics.';
              }
            });
          `,
        }}
      />

      <div className="flex flex-col space-y-4 md:flex-row md:space-x-4 md:space-y-0 md:items-center md:justify-between mb-6">
        <Button 
          className="md:ml-auto"
          onClick={() => {}}
        >
          Create New Query
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 mb-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">
            Query Builder
          </h2>
        </div>

        <div className="p-6 flex flex-col space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:space-x-4">
            <div className="space-y-1 mb-4 md:mb-0">
              <label className="text-sm font-medium">Edit Query</label>
              <div className="flex items-center space-x-2">
                <select
                  className="rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                  value={queryTimeRange}
                  onChange={(e) => setQueryTimeRange(e.target.value)}
                >
                  <option>Last 1 hour</option>
                  <option>Last 6 hours</option>
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                  <option>Custom range</option>
                </select>
              </div>
            </div>

            <div className="space-y-1 mb-4 md:mb-0">
              <label className="text-sm font-medium">Visualization</label>
              <div className="flex items-center space-x-2">
                <select
                  className="rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
                  value={visualizationType}
                  onChange={(e) => setVisualizationType(e.target.value)}
                >
                  <option>Edge Requests</option>
                  <option>API Calls</option>
                  <option>Compute Usage</option>
                  <option>Response Time</option>
                </select>
              </div>
            </div>
            
            <Button
              className="mt-4 md:mt-0 md:ml-auto"
              onClick={runQuery}
            >
              Run Query
            </Button>
          </div>

          <div>
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-sm font-medium">WHERE:</label>
              <input
                type="text"
                placeholder="host = 'create.dev'"
                className="flex-1 rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800"
              />
            </div>
            
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-sm font-medium">PROJECT:</label>
              <div className="flex-1 rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                Choose Project (optional)
              </div>
            </div>
            
            <div className="flex items-center space-x-3 mb-4">
              <label className="text-sm font-medium">GROUP BY:</label>
              <div className="flex-1 rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                host
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium">LIMIT:</label>
              <select className="rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                <option>10</option>
                <option>25</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {!hasResults ? (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 p-8 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="text-xl font-semibold mb-2">Monitoring Dashboard</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Visualize bandwidth, errors, performance issues, and more across all projects.
            </p>
            <Button 
              variant="outline"
              className="mx-auto"
              onClick={() => {}}
            >
              Learn More
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Results</h3>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg h-64 flex items-center justify-center">
              <p className="text-gray-500">Visualization would appear here</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline">Export to CSV</Button>
              <Button variant="outline">Export to JSON</Button>
            </div>
          </div>
        </div>
      )}

      {/* Observability Dashboard Example */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 mt-6">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Observability Overview</h3>
            <div className="flex items-center space-x-2">
              <select className="rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                <option>Production</option>
                <option>Preview</option>
                <option>Development</option>
              </select>
              <select className="rounded-md border border-gray-300 py-1.5 px-3 text-sm dark:border-gray-600 dark:bg-gray-800">
                <option>Last 12 hours</option>
                <option>Last 24 hours</option>
                <option>Last 7 days</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Edge Requests */}
            <div className="bg-white dark:bg-gray-900/20 p-5 rounded-lg border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Edge Requests</h4>
                <a href="#" className="text-blue-600 dark:text-blue-400 text-sm">➔</a>
              </div>
              <div className="text-2xl font-semibold mb-3">200</div>
              <div className="h-32 w-full bg-gray-50 dark:bg-gray-800 rounded flex items-end justify-start space-x-1 p-2">
                {[3, 5, 2, 4, 6, 2, 3, 7, 4, 2, 3, 5, 6, 8, 20, 10, 4, 30].map((height, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-teal-500 rounded-t"
                    style={{ height: `${height}px` }}
                  ></div>
                ))}
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>12 hours ago</span>
                <span>Now</span>
              </div>
            </div>
            
            {/* Fast Data Transfer */}
            <div className="bg-white dark:bg-gray-900/20 p-5 rounded-lg border border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Fast Data Transfer</h4>
                <a href="#" className="text-blue-600 dark:text-blue-400 text-sm">➔</a>
              </div>
              <div className="text-2xl font-semibold mb-3">19 MB</div>
              <div className="h-32 w-full bg-gray-50 dark:bg-gray-800 rounded flex items-end justify-start space-x-1 p-2">
                {[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 32].map((height, i) => (
                  <div 
                    key={i} 
                    className="w-2 bg-teal-500 rounded-t"
                    style={{ height: `${height}px` }}
                  ></div>
                ))}
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>12 hours ago</span>
                <span>Now</span>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Project</h4>
              <h4 className="text-sm font-medium">Requests</h4>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-teal-500 mr-2"></div>
                  <span className="text-sm">dacroq</span>
                </div>
                <div className="flex items-center">
                  <div className="w-48 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mr-2">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '95%' }}></div>
                  </div>
                  <span className="text-sm">98</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                  <span className="text-sm">benweb</span>
                </div>
                <div className="flex items-center">
                  <div className="w-48 h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mr-2">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                  <span className="text-sm">102</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
