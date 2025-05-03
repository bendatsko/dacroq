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

// API base URL
const API_BASE = "https://dacroq-api.bendatsko.com";

// Type for API health status
type ApiStatus = 'checking' | 'online' | 'degraded' | 'offline' | 'error';

// Type for documentation section
interface DocSection {
  id: string;
  section_id: string;
  title: string;
  content: string;
  created: string;
  updated: string;
  created_by?: string;
  updated_by?: string;
}

// Helper function to render markdown content
const renderMarkdown = (content) => {
  const lines = content.split('\n');
  const elements = [];
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
        <h2 key={`h2-${key++}`} className="text-xl font-semibold mt-5 mb-2 text-gray-900 dark:text-gray-50">
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
    else if (trimmedLine.startsWith('# ')) {
      finishList();
      elements.push(
        <h1 key={`h1-${key++}`} className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-50">
          {trimmedLine.substring(2)}
        </h1>
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

const initialDocsStructure = [];

export default function Documentation() {
  // State for documentation content
  const [docSections, setDocSections] = useState<DocSection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Add the docs structure state inside the component
  const [docsStructure, setDocsStructure] = useState([]);
  
  const [activeSection, setActiveSection] = useState("introduction");
  const [expandedSections, setExpandedSections] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  

  useEffect(() => {
    if (docsStructure.length > 0) {
      setExpandedSections(docsStructure.map(section => section.id));
    }
  }, [docsStructure]);


  // New states for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [activeTab, setActiveTab] = useState("preview");
  const [isAdmin, setIsAdmin] = useState(false);

  // State for API health
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');
  const [apiStatusDetails, setApiStatusDetails] = useState<string | null>(null);

  // Fetch all documentation sections
  useEffect(() => {
    const fetchDocs = async () => {
      try {
        setLoading(true);
        
        // Fetch from the API
        const response = await fetch(`${API_BASE}/api/docs`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch documentation: ${response.status}`);
        }
        
        const data = await response.json();
        setDocSections(data);
        
        // Build structure from section IDs
        const structureMap = {};
        
        // Organize docs into sections based on naming patterns
        data.forEach(doc => {
          // Check if section_id follows a pattern like "category-name"
          const parts = doc.section_id.split('-');
          
          if (parts.length > 1) {
            // This is a subsection
            const categoryId = parts[0];
            
            // Create category if it doesn't exist
            if (!structureMap[categoryId]) {
              // Assign icon based on category
              let icon = <RiFileTextLine className="size-4" />;
              let title = categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
              
              if (categoryId === 'getting' || categoryId === 'quickstart') {
                icon = <RiBookOpenLine className="size-4" />;
                title = 'Getting Started';
              } else if (categoryId === 'architecture' || categoryId === 'system') {
                icon = <RiCpuLine className="size-4" />;
                title = 'System Architecture';
              }
              
              structureMap[categoryId] = {
                id: categoryId,
                title: title,
                icon: icon,
                items: []
              };
            }
            
            // Add to category
            structureMap[categoryId].items.push({
              id: doc.section_id,
              title: doc.title
            });
          } else {
            // This is a standalone document, not in any category
            // Create a general section if it doesn't exist
            if (!structureMap['general']) {
              structureMap['general'] = {
                id: 'general',
                title: 'General',
                icon: <RiFileTextLine className="size-4" />,
                items: []
              };
            }
            
            structureMap['general'].items.push({
              id: doc.section_id,
              title: doc.title
            });
          }
        });
        
        // Convert to array and sort
        const structure = Object.values(structureMap);
        setDocsStructure(structure);
        
        // Set expanded sections when structure is loaded
        if (structure.length > 0) {
          setExpandedSections(structure.map(section => section.id));
        }
        
        // If no active section is set yet, use the first doc
        if (!activeSection && data.length > 0) {
          setActiveSection(data[0].section_id);
        }
      } catch (err) {
        console.error('Error fetching documentation:', err);
        setError('Failed to load documentation. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocs();
  }, []);

  // Fetch API health status
  useEffect(() => {
    const fetchApiHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        const data = await response.json();

        if (!response.ok) {
           // Use status from response body if available, otherwise generic error
          setApiStatus(data.api_status === 'degraded' ? 'degraded' : 'offline');
          setApiStatusDetails(data.cloudflare_tunnel_status_details || data.weather_data_error_details || `API returned status ${response.status}`);
        } else {
          // Check detailed status from the health endpoint
          if (data.api_status === 'ok') {
             setApiStatus('online');
             setApiStatusDetails('API operational.');
          } else if (data.api_status === 'degraded') {
              setApiStatus('degraded');
              setApiStatusDetails(data.cloudflare_tunnel_status_details || data.weather_data_error_details || 'API is degraded.');
          } else {
             setApiStatus('offline'); // Or some other state based on data
             setApiStatusDetails('API reported an unexpected status.');
          }
        }
      } catch (error) {
        console.error('Error fetching API health:', error);
        setApiStatus('error');
        setApiStatusDetails('Could not connect to the API health endpoint.');
      }
    };

    fetchApiHealth();
    // Optional: Set an interval to periodically check health
    // const intervalId = setInterval(fetchApiHealth, 60000); // Check every minute
    // return () => clearInterval(intervalId);
  }, []);

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // For now, we'll just set all users as admin for testing purposes
        // In production, you'd want to fetch this from your auth system
        setIsAdmin(true);
        
        // Uncomment this code when you have user authentication set up
        /*
        const userEmail = "current_user@example.com"; // Replace with actual user email from auth
        const response = await fetch(`${API_BASE}/api/users/check-admin?email=${encodeURIComponent(userEmail)}`);
        
        if (!response.ok) {
          throw new Error(`Failed to check admin status: ${response.status}`);
        }
        
        const data = await response.json();
        setIsAdmin(data.isAdmin);
        */
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, []);

  // Fetch content for the active section
  useEffect(() => {
    const fetchDocSection = async () => {
      if (!activeSection) return;
      
      try {
        setLoading(true);
        
        // First check if we already have this section in our state
        const existingSection = docSections.find(doc => doc.section_id === activeSection);
        
        if (existingSection) {
          setEditTitle(existingSection.title);
          setEditContent(existingSection.content);
          setLoading(false);
          return;
        }
        
        // If not, fetch it from the API
        const response = await fetch(`${API_BASE}/api/docs/${activeSection}`);
        
        if (response.status === 404) {
          // If the section doesn't exist yet, create an empty one for editing
          const categoryItem = docsStructure
            .flatMap(category => category.items)
            .find(item => item.id === activeSection);
            
          if (categoryItem) {
            setEditTitle(categoryItem.title);
            setEditContent('');
          } else {
            setEditTitle('New Section');
            setEditContent('');
          }
        } else if (!response.ok) {
          throw new Error(`Failed to fetch section: ${response.status}`);
        } else {
          const data = await response.json();
          setEditTitle(data.title);
          setEditContent(data.content);
        }
      } catch (err) {
        console.error(`Error fetching section ${activeSection}:`, err);
        setError(`Failed to load section "${activeSection}". Please try again later.`);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDocSection();
  }, [activeSection, docSections]);

  // Reset editing state when section changes
  useEffect(() => {
    setIsEditing(false);
    setActiveTab("preview");
  }, [activeSection]);

  const handleStartEditing = () => {
    setIsEditing(true);
    setActiveTab("edit");
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE}/api/docs/${activeSection}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          updated_by: 'current_user' // Replace with actual user info when auth is set up
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save content: ${response.status}`);
      }
      
      // Update our local state with the saved document
      const savedDoc = await response.json();
      
      setDocSections(prev => {
        const existing = prev.findIndex(doc => doc.section_id === activeSection);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = savedDoc;
          return updated;
        } else {
          return [...prev, savedDoc];
        }
      });
      
      setIsEditing(false);
      setActiveTab("preview");
    } catch (err) {
      console.error('Error saving content:', err);
      setError('Failed to save content. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    
    // Reset to the original content from our state
    const section = docSections.find(doc => doc.section_id === activeSection);
    if (section) {
      setEditTitle(section.title);
      setEditContent(section.content);
    }
    
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

  // Helper to get status indicator color
  const getStatusColor = (status: ApiStatus) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      case 'error': return 'bg-red-500';
      case 'checking':
      default: return 'bg-gray-400';
    }
  };

  return (
    <main className="container max-w-5xl mx-auto px-4 py-6">
      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Mobile Header */}
        <div className="block lg:hidden">
          <div className="flex flex-col gap-4 mb-4">
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
            <div className="mt-2 bg-white dark:bg-gray-900 border rounded-lg shadow-lg p-4 mb-4">
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
                    {/* Add status indicator for System Architecture */}
                    {section.id === 'architecture' && (
                      <span 
                        title={`API Status: ${apiStatus}${apiStatusDetails ? ' - ' + apiStatusDetails : ''}`}
                        className={`ml-2 h-2.5 w-2.5 rounded-full ${getStatusColor(apiStatus)}`}
                      />
                    )}
                    <RiArrowDownSLine
                      className={`ml-auto transition-transform ${expandedSections.includes(section.id) ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expandedSections.includes(section.id) && (
                    <ul className="pl-6 space-y-2 mt-2">
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
          <div className="sticky top-0 pt-4">
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

            <nav className="space-y-5">
              {docsStructure.map((section) => (
                <div key={section.id} className="space-y-2">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center w-full text-left font-medium text-gray-800 dark:text-gray-200"
                  >
                    <span className="mr-2">{section.icon}</span>
                    <span>{section.title}</span>
                    {/* Add status indicator for System Architecture */}
                    {section.id === 'architecture' && (
                       <span 
                        title={`API Status: ${apiStatus}${apiStatusDetails ? ' - ' + apiStatusDetails : ''}`}
                        className={`ml-2 h-2.5 w-2.5 rounded-full ${getStatusColor(apiStatus)}`}
                      />
                    )}
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

            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
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
          {/* Documentation Header */}
          <div className="flex items-center justify-between mb-4">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-semibold w-full bg-transparent border-b border-gray-200 dark:border-gray-800 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-50"
              />
            ) : (
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
                {editTitle}
              </h2>
            )}

            {isAdmin && !isEditing && (
              <Button
                variant="secondary"
                onClick={handleStartEditing}
                className="flex items-center gap-2"
              >
                <RiEditLine className="size-4" />
                Edit
              </Button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <Card className="p-6 shadow-sm bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
              <div className="flex items-start">
                <div className="flex-shrink-0 text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 00-2 0v4a1 1 0 002 0V6zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Documentation</h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
                  <div className="mt-4">
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-200"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Documentation Content */}
          {!loading && !error && (
            <>
              {isEditing ? (
                <Card className="p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <div className="flex items-center justify-between mb-4">
                      <TabsList className="bg-gray-100 dark:bg-gray-800">
                        <TabsTrigger value="edit" className="text-sm">Edit</TabsTrigger>
                        <TabsTrigger value="preview" className="text-sm">Preview</TabsTrigger>
                      </TabsList>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={handleCancel}
                          className="flex items-center gap-2"
                          size="sm"
                        >
                          <RiCloseLine className="size-4" />
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSave}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                          size="sm"
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
                        className="min-h-[500px] font-mono text-sm p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md"
                        placeholder="Enter markdown content..."
                      />
                    </TabsContent>

                    <TabsContent value="preview">
                      <div className="documentation-content border border-gray-200 dark:border-gray-700 rounded-md p-6 bg-white dark:bg-gray-900 min-h-[500px]">
                        {renderMarkdown(editContent)}
                      </div>
                    </TabsContent>
                  </Tabs>
                </Card>
              ) : (
                <Card className="p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="documentation-content">
                    {renderMarkdown(editContent)}
                  </div>
                </Card>
              )}

              {/* Navigation buttons */}
              <div className="mt-6 flex flex-wrap justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  {prev && (
                    <button
                      onClick={() => setActiveSection(prev.id)}
                      className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <RiArrowRightSLine className="mr-1 size-4 rotate-180" />
                      <span className="text-sm mr-2">Previous:</span>
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
                      <span className="text-sm mr-2">Next:</span>
                      <span className="text-sm font-medium">{next.title}</span>
                      <RiArrowRightSLine className="ml-1 size-4" />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}