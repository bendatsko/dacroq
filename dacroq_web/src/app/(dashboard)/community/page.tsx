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
  RiCloseLine,
  RiChat3Line,
  RiQuestionLine,
  RiThumbUpLine,
  RiPinDistanceLine,
  RiTimeLine,
  RiUserLine,
  RiAddLine,
  RiFilterLine,
  RiNotificationLine
} from "@remixicon/react";

// Sample community data
const sampleQuestions = [
  {
    id: 1,
    title: "How to optimize large problem decomposition for the 3-SAT solver?",
    author: "researcher42",
    tag: "3-SAT",
    timestamp: "2025-03-28T14:23:00",
    replies: 4,
    views: 56,
    isPinned: true,
    isAnswered: true
  },
  {
    id: 2,
    title: "Error when uploading large CNF files - timeouts after 30 seconds",
    author: "alice_chen",
    tag: "Bug Report",
    timestamp: "2025-03-29T09:47:00",
    replies: 2,
    views: 23,
    isPinned: false,
    isAnswered: true
  },
  {
    id: 3,
    title: "Best practices for problem formulation to maximize hardware utilization",
    author: "quantum_dave",
    tag: "Best Practices",
    timestamp: "2025-03-30T11:15:00",
    replies: 7,
    views: 42,
    isPinned: true,
    isAnswered: false
  },
  {
    id: 4,
    title: "What's the roadmap for LDPC solver release?",
    author: "maria_j",
    tag: "LDPC",
    timestamp: "2025-03-30T16:38:00",
    replies: 1,
    views: 19,
    isPinned: false,
    isAnswered: true
  },
  {
    id: 5,
    title: "Unexpected fluctuations in success rate when running at scale",
    author: "circuitpro",
    tag: "Performance",
    timestamp: "2025-03-31T08:12:00",
    replies: 0,
    views: 7,
    isPinned: false,
    isAnswered: false
  },
  {
    id: 6,
    title: "Using API with Python client - authentication issues",
    author: "pythonista",
    tag: "API",
    timestamp: "2025-03-27T13:41:00",
    replies: 3,
    views: 28,
    isPinned: false,
    isAnswered: true
  }
];

// Popular tags for filtering
const popularTags = [
  { name: "All", count: sampleQuestions.length },
  { name: "3-SAT", count: 12 },
  { name: "K-SAT", count: 5 },
  { name: "LDPC", count: 4 },
  { name: "API", count: 8 },
  { name: "Bug Report", count: 6 },
  { name: "Performance", count: 9 },
  { name: "Best Practices", count: 7 }
];

// Format date/time in a human-readable way
const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const now = new Date();

  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
};

export default function Community() {
  const [activeTab, setActiveTab] = useState("latest");
  const [activeTag, setActiveTag] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [questions, setQuestions] = useState(sampleQuestions);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTag, setNewPostTag] = useState("3-SAT");

  // Filter and sort questions based on active filters
  useEffect(() => {
    // Start with the original questions
    let filtered = [...sampleQuestions];

    // Apply tag filter
    if (activeTag !== "All") {
      filtered = filtered.filter(q => q.tag === activeTag);
    }

    // Apply search filter if present
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(q =>
          q.title.toLowerCase().includes(query) ||
          q.author.toLowerCase().includes(query)
      );
    }

    // Apply sorting based on the active tab
    switch(activeTab) {
      case "latest":
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
      case "popular":
        filtered.sort((a, b) => b.views - a.views);
        break;
      case "unanswered":
        filtered = filtered.filter(q => !q.isAnswered);
        filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        break;
    }

    // Always put pinned items at the top
    filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    setQuestions(filtered);
  }, [activeTab, activeTag, searchQuery]);

  // Handle post submission
  const handleSubmitPost = () => {
    // This would normally send data to a server
    console.log("Submitting new post:", {
      title: newPostTitle,
      content: newPostContent,
      tag: newPostTag
    });

    // Reset the form and close the modal
    setNewPostTitle("");
    setNewPostContent("");
    setNewPostTag("3-SAT");
    setIsPostModalOpen(false);

    // Optionally, add the new post to the list (in a real app, would come from server)
    const newPost = {
      id: questions.length + 1,
      title: newPostTitle,
      author: "current_user", // Would be the logged-in user
      tag: newPostTag,
      timestamp: new Date().toISOString(),
      replies: 0,
      views: 0,
      isPinned: false,
      isAnswered: false
    };

    setQuestions([newPost, ...questions]);
  };

  return (
      <main className="flex flex-col">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Community
            </h1>
            <p className="text-gray-500 sm:text-sm/6 dark:text-gray-500">
              Ask questions, share knowledge, and connect with other researchers
            </p>
          </div>
          <Button
              onClick={() => setIsPostModalOpen(true)}
              className="flex items-center gap-2"
          >
            <RiAddLine className="size-4" />
            New Post
          </Button>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar filters */}
          <div className="w-full lg:w-64 flex-shrink-0 order-2 lg:order-1">
            <Card className="p-4 shadow-sm">
              <div className="mb-4">
                <div className="relative">
                  <RiSearchLine className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <input
                      type="text"
                      placeholder="Search community..."
                      className="pl-8 w-full bg-gray-100 dark:bg-gray-800 border-none rounded-md py-2 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center">
                  <RiFilterLine className="mr-2 size-4" />
                  Tags
                </h3>
                <div className="space-y-2">
                  {popularTags.map((tag) => (
                      <button
                          key={tag.name}
                          onClick={() => setActiveTag(tag.name)}
                          className={`flex items-center justify-between w-full px-3 py-1.5 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                              activeTag === tag.name
                                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                  : 'text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        <span>{tag.name}</span>
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs px-2 py-0.5 rounded-full">
                      {tag.count}
                    </span>
                      </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Resources
                </h3>
                <ul className="space-y-2">
                  <li>
                    <a
                        href="#"
                        className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
                    >
                      <RiBookOpenLine className="mr-2 size-4" />
                      Community Guidelines
                    </a>
                  </li>
                  <li>
                    <a
                        href="#"
                        className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
                    >
                      <RiQuestionLine className="mr-2 size-4" />
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a
                        href="#"
                        className="flex items-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 text-sm"
                    >
                      <RiChat3Line className="mr-2 size-4" />
                      Contact Support
                    </a>
                  </li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Questions list */}
          <div className="flex-1 order-1 lg:order-2">
            <Card className="shadow-sm">
              {/* Tabs for sorting */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-3 w-full sm:w-auto sm:flex">
                    <TabsTrigger value="latest" className="flex items-center gap-1.5">
                      <RiTimeLine className="size-4" />
                      <span className="hidden sm:inline">Latest</span>
                    </TabsTrigger>
                    <TabsTrigger value="popular" className="flex items-center gap-1.5">
                      <RiThumbUpLine className="size-4" />
                      <span className="hidden sm:inline">Popular</span>
                    </TabsTrigger>
                    <TabsTrigger value="unanswered" className="flex items-center gap-1.5">
                      <RiQuestionLine className="size-4" />
                      <span className="hidden sm:inline">Unanswered</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Questions list */}
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {questions.length > 0 ? (
                    questions.map((question) => (
                        <div
                            key={question.id}
                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                                question.isPinned ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Question details */}
                            <div className="flex-1">
                              <div className="flex flex-wrap gap-2 items-center mb-1">
                                {question.isPinned && (
                                    <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                              <RiPinDistanceLine className="mr-1 size-3.5" />
                              Pinned
                            </span>
                                )}
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${
                                    {
                                      '3-SAT': 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
                                      'K-SAT': 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400',
                                      'LDPC': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
                                      'API': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
                                      'Bug Report': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
                                      'Performance': 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
                                      'Best Practices': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                    }[question.tag] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                }`}>
                            {question.tag}
                          </span>
                              </div>

                              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400">
                                  {question.title}
                                </a>
                              </h3>

                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <RiUserLine className="mr-1 size-3.5" />
                            {question.author}
                          </span>
                                <span className="flex items-center">
                            <RiTimeLine className="mr-1 size-3.5" />
                                  {formatTimestamp(question.timestamp)}
                          </span>
                                <span className="flex items-center">
                            <RiChat3Line className="mr-1 size-3.5" />
                                  {question.replies} {question.replies === 1 ? 'reply' : 'replies'}
                          </span>
                                <span className="flex items-center">
                            <RiSearchLine className="mr-1 size-3.5" />
                                  {question.views} {question.views === 1 ? 'view' : 'views'}
                          </span>
                              </div>
                            </div>

                            {/* Status indicator */}
                            <div className="flex-shrink-0">
                              {question.isAnswered ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                            <RiCheckLine className="size-4" />
                          </span>
                              ) : (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            <RiQuestionLine className="size-4" />
                          </span>
                              )}
                            </div>
                          </div>
                        </div>
                    ))
                ) : (
                    <div className="p-8 text-center">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        No questions found
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {searchQuery ? 'Try a different search term' : 'Be the first to ask a question!'}
                      </p>
                      <Button
                          onClick={() => setIsPostModalOpen(true)}
                          className="flex items-center gap-2 mx-auto"
                      >
                        <RiAddLine className="size-4" />
                        Create New Post
                      </Button>
                    </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* New Post Modal */}
        {isPostModalOpen && (
            <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
              <Card className="w-full max-w-2xl p-0 shadow-lg">
                <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                    Create New Post
                  </h2>
                </div>

                <div className="p-4 sm:p-6 space-y-4">
                  <div>
                    <label htmlFor="post-title" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title
                    </label>
                    <input
                        id="post-title"
                        type="text"
                        value={newPostTitle}
                        onChange={(e) => setNewPostTitle(e.target.value)}
                        placeholder="What's your question or topic?"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="post-content" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Content
                    </label>
                    <Textarea
                        id="post-content"
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Provide details about your question or topic..."
                        className="min-h-[200px] w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                    />
                  </div>

                  <div>
                    <label htmlFor="post-tag" className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      Tag
                    </label>
                    <select
                        id="post-tag"
                        value={newPostTag}
                        onChange={(e) => setNewPostTag(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
                    >
                      <option value="3-SAT">3-SAT</option>
                      <option value="K-SAT">K-SAT</option>
                      <option value="LDPC">LDPC</option>
                      <option value="API">API</option>
                      <option value="Bug Report">Bug Report</option>
                      <option value="Performance">Performance</option>
                      <option value="Best Practices">Best Practices</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                  <Button
                      variant="outline"
                      onClick={() => setIsPostModalOpen(false)}
                      className="flex items-center gap-2"
                  >
                    <RiCloseLine className="size-4" />
                    Cancel
                  </Button>
                  <Button
                      onClick={handleSubmitPost}
                      disabled={!newPostTitle.trim() || !newPostContent.trim()}
                      className="flex items-center gap-2"
                  >
                    <RiAddLine className="size-4" />
                    Create Post
                  </Button>
                </div>
              </Card>
            </div>
        )}
      </main>
  );
}

// This is a mock component for the missing RiCheckLine icon
const RiCheckLine = ({ className }) => {
  return (
      <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          className={className}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
  );
};