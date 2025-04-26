"use client"

import { useEffect, useState } from "react"
import { 
  RiFolderLine, 
  RiFileLine, 
  RiArrowRightSLine, 
  RiArrowDownSLine,
  RiRefreshLine
} from "@remixicon/react"
import { Button } from "@/components/ui/button"

// Define the structure for our sitemap tree
interface SitemapNode {
  id: string
  name: string
  type: 'page' | 'folder'
  path?: string
  children?: SitemapNode[]
  expanded?: boolean
}

export default function SitemapPage() {
  const [sitemapData, setSitemapData] = useState<SitemapNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Function to generate sitemap data
  const generateSitemap = () => {
    setIsLoading(true)
    
    // In a real implementation, this would fetch from an API or scan the site
    // For now, we'll use mock data that represents your site structure
    setTimeout(() => {
      const mockSitemap: SitemapNode[] = [
        {
          id: "dashboard",
          name: "Dashboard",
          type: "page",
          path: "/",
          expanded: true,
        },
        {
          id: "docs",
          name: "Documentation",
          type: "folder",
          path: "/docs",
          expanded: true,
          children: [
            {
              id: "getting-started",
              name: "Getting Started",
              type: "page",
              path: "/docs/getting-started",
            },
            {
              id: "api-reference",
              name: "API Reference",
              type: "folder",
              path: "/docs/api",
              children: [
                {
                  id: "endpoints",
                  name: "Endpoints",
                  type: "page",
                  path: "/docs/api/endpoints",
                },
                {
                  id: "authentication",
                  name: "Authentication",
                  type: "page",
                  path: "/docs/api/authentication",
                }
              ]
            },
            {
              id: "examples",
              name: "Examples",
              type: "page",
              path: "/docs/examples",
            }
          ]
        },
        {
          id: "monitor",
          name: "Monitor",
          type: "page",
          path: "/monitor",
        },
        {
          id: "analyze",
          name: "Analyze",
          type: "folder",
          path: "/analyze",
          children: [
            {
              id: "performance",
              name: "Performance",
              type: "page",
              path: "/analyze/performance",
            },
            {
              id: "usage",
              name: "Usage Statistics",
              type: "page",
              path: "/analyze/usage",
            }
          ]
        },
        {
          id: "tools",
          name: "Tools",
          type: "folder",
          path: "/tools",
          children: [
            {
              id: "converter",
              name: "Data Converter",
              type: "page",
              path: "/tools/converter",
            },
            {
              id: "validator",
              name: "Schema Validator",
              type: "page",
              path: "/tools/validator",
            }
          ]
        },
        {
          id: "feedback",
          name: "Feedback",
          type: "page",
          path: "/feedback",
        }
      ]
      
      setSitemapData(mockSitemap)
      setLastUpdated(new Date())
      setIsLoading(false)
    }, 800) // Simulate API delay
  }

  // Toggle node expansion
  const toggleNode = (nodeId: string) => {
    setSitemapData(prev => {
      const findAndToggle = (nodes: SitemapNode[]): SitemapNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            return { ...node, expanded: !node.expanded }
          }
          if (node.children) {
            return { ...node, children: findAndToggle(node.children) }
          }
          return node
        })
      }
      
      return findAndToggle(prev)
    })
  }

  // Load sitemap on initial render
  useEffect(() => {
    generateSitemap()
  }, [])

  // Recursive component to render the tree
  const renderTree = (nodes: SitemapNode[], level = 0) => {
    return nodes.map(node => (
      <div key={node.id} className="mb-1">
        <div 
          className={`flex items-center py-1.5 px-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 ${level > 0 ? 'ml-' + (level * 4) : ''}`}
        >
          {node.type === 'folder' && node.children && (
            <button 
              onClick={() => toggleNode(node.id)}
              className="mr-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              aria-label={node.expanded ? "Collapse" : "Expand"}
            >
              {node.expanded ? 
                <RiArrowDownSLine className="h-4 w-4" /> : 
                <RiArrowRightSLine className="h-4 w-4" />
              }
            </button>
          )}
          
          {node.type === 'folder' ? (
            <RiFolderLine className="h-4 w-4 mr-2 text-blue-500" />
          ) : (
            <RiFileLine className="h-4 w-4 mr-2 text-gray-500" />
          )}
          
          <a 
            href={node.path} 
            className="text-sm hover:text-blue-600 dark:hover:text-blue-400 text-gray-900 dark:text-gray-200"
          >
            {node.name}
          </a>
        </div>
        
        {node.type === 'folder' && node.children && node.expanded && (
          <div className="mt-1">
            {renderTree(node.children, level + 1)}
          </div>
        )}
      </div>
    ))
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Sitemap</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Complete overview of the site structure and navigation
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
          onClick={generateSitemap}
          disabled={isLoading}
        >
          <RiRefreshLine className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Sitemap
        </Button>
      </div>

      {/* Sitemap Container */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex items-center space-x-2 text-blue-600">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962
                  7.962 0 014 12H0c0 3.042 1.135 5.824 3
                  7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm font-medium">Generating sitemap...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {lastUpdated && (
                    <span>Last updated: {lastUpdated.toLocaleString()}</span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {sitemapData.length} root items
                </div>
              </div>
            </div>
            
            <div className="sitemap-tree">
              {renderTree(sitemapData)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}