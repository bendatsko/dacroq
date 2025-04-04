"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import { Button } from "@/components/Button";
import { Textarea } from "@/components/ui/textarea";
import {
  RiTimeLine,
  RiQuestionLine,
  RiChat3Line,
  RiUserLine,
  RiAddLine,
  RiSearchLine,
  RiCloseLine,
  RiPinDistanceLine,
  RiEyeLine,
  RiArrowRightSLine,
  RiArrowLeftSLine
} from "@remixicon/react";

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// Helper function to format timestamps
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Just now";
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) {
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined 
    });
  }
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  return "Just now";
};

// A mock component for the missing RiCheckLine icon
const RiCheckLine = ({ className }) => (
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

export default function Community() {
  // Get current user from localStorage
  const currentUser = useMemo(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.error("Error parsing user:", e);
      return null;
    }
  }, []);

  // State for posts from Firestore
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 15;
  
  // States for new post/reply fields
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  
  // State for integrated thread view
  const [selectedPost, setSelectedPost] = useState(null);
  const [newReplyContent, setNewReplyContent] = useState("");
  const [replies, setReplies] = useState([]);
  const [repliesLoading, setRepliesLoading] = useState(false);

  // Subscribe to community posts from Firestore
  useEffect(() => {
    setLoading(true);
    const postsRef = collection(db, "communityPosts");
    const postsQuery = query(postsRef, orderBy("timestamp", "desc"));
    
    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to replies when a post is selected
  useEffect(() => {
    if (selectedPost) {
      setRepliesLoading(true);
      const repliesRef = collection(db, "communityPosts", selectedPost.id, "replies");
      const repliesQuery = query(repliesRef, orderBy("timestamp", "asc"));
      
      const unsubscribe = onSnapshot(repliesQuery, (snapshot) => {
        const repliesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date()
        }));
        setReplies(repliesData);
        setRepliesLoading(false);
        // Update view count
        incrementViewCount(selectedPost.id);
      });
      return () => unsubscribe();
    } else {
      setReplies([]);
    }
  }, [selectedPost]);

  // Filter posts by search query
  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const queryStr = searchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title?.toLowerCase().includes(queryStr) ||
        post.content?.toLowerCase().includes(queryStr) ||
        post.author?.toLowerCase().includes(queryStr)
    );
  }, [posts, searchQuery]);

  // Paginate posts
  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * postsPerPage;
    return filteredPosts.slice(startIndex, startIndex + postsPerPage);
  }, [filteredPosts, currentPage]);

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(filteredPosts.length / postsPerPage), [filteredPosts]);

  // Handle page changes
  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  // Increment view count
  const incrementViewCount = async (postId) => {
    try {
      const postRef = doc(db, "communityPosts", postId);
      await updateDoc(postRef, {
        views: (selectedPost.views || 0) + 1
      });
    } catch (error) {
      console.error("Error updating view count:", error);
    }
  };

  // Handle new post submission
  const handleSubmitPost = async () => {
    try {
      const postsRef = collection(db, "communityPosts");
      await addDoc(postsRef, {
        title: newPostTitle,
        content: newPostContent,
        author: currentUser?.displayName || "Anonymous",
        uid: currentUser?.uid || null,
        role: currentUser?.role || "user",
        timestamp: serverTimestamp(),
        replies: 0,
        views: 0,
        isPinned: false,
        isAnswered: false
      });
      setNewPostTitle("");
      setNewPostContent("");
      setIsPostModalOpen(false);
    } catch (error) {
      console.error("Error creating new post:", error);
    }
  };

  // Handle new reply submission with notification to post author
  const handleSubmitReply = async () => {
    if (!selectedPost || !newReplyContent.trim()) return;
    
    try {
      const repliesRef = collection(db, "communityPosts", selectedPost.id, "replies");
      await addDoc(repliesRef, {
        content: newReplyContent,
        author: currentUser?.displayName || "Anonymous",
        uid: currentUser?.uid || null,
        role: currentUser?.role || "user",
        timestamp: serverTimestamp()
      });
      // Update the replies count on the post
      const postRef = doc(db, "communityPosts", selectedPost.id);
      await updateDoc(postRef, {
        replies: (selectedPost.replies || 0) + 1
      });
      
      // Send notification to the original post's author if not replying to your own post
      if (currentUser?.uid && selectedPost.uid && currentUser.uid !== selectedPost.uid) {
        const notificationsRef = collection(db, "notifications");
        await addDoc(notificationsRef, {
          title: "New reply to your post",
          message: `${currentUser.displayName || "Someone"} replied to your post: "${selectedPost.title}"`,
          type: "reply",
          date: serverTimestamp(),
          global: false,
          forUsers: [selectedPost.uid],
          readBy: [],
          createdBy: currentUser.uid,
          createdByName: currentUser.displayName || "Anonymous",
          deleted: false,
        });
      }
      
      setNewReplyContent("");
    } catch (error) {
      console.error("Error submitting reply:", error);
    }
  };

  // Admin: delete a post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteDoc(doc(db, "communityPosts", postId));
      setSelectedPost(null);
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  // Admin: toggle pin status
  const handleTogglePin = async (postId, isPinned) => {
    try {
      const postRef = doc(db, "communityPosts", postId);
      await updateDoc(postRef, {
        isPinned: !isPinned
      });
    } catch (error) {
      console.error("Error toggling pin status:", error);
    }
  };

  // Admin: toggle answered status
  const handleToggleAnswered = async (postId, isAnswered) => {
    try {
      const postRef = doc(db, "communityPosts", postId);
      await updateDoc(postRef, {
        isAnswered: !isAnswered
      });
    } catch (error) {
      console.error("Error toggling answered status:", error);
    }
  };

  // Render the post detail view
  const renderPostDetail = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      {/* Post Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setSelectedPost(null)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <RiArrowLeftSLine className="size-5 mr-1" />
            Back
          </Button>
        </div>
        {/* Admin actions */}
        {currentUser?.role === "admin" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTogglePin(selectedPost.id, selectedPost.isPinned)}
              title={selectedPost.isPinned ? "Unpin post" : "Pin post"}
              className={`p-2 ${selectedPost.isPinned ? "text-blue-600" : "text-gray-500"}`}
            >
              <RiPinDistanceLine className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleAnswered(selectedPost.id, selectedPost.isAnswered)}
              title={selectedPost.isAnswered ? "Mark as unanswered" : "Mark as answered"}
              className={`p-2 ${selectedPost.isAnswered ? "text-green-600" : "text-gray-500"}`}
            >
              <RiCheckLine className="size-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleDeletePost(selectedPost.id)}
              className="text-red-600 dark:text-red-400 p-2"
              title="Delete post"
            >
              <RiCloseLine className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {/* Post Content */}
      <div className="p-5">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {selectedPost?.title}
        </h2>
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <span className="flex items-center">
            <RiUserLine className="mr-1 size-3.5" />
            {selectedPost?.author}
            {selectedPost?.role === "admin" && (
              <span className="ml-1 inline-block bg-blue-500 text-white text-xs px-1 rounded">Admin</span>
            )}
          </span>
          <span className="mx-2">•</span>
          <span>{formatTimestamp(selectedPost?.timestamp)}</span>
          <span className="mx-2">•</span>
          <span className="flex items-center">
            <RiEyeLine className="mr-1 size-3.5" />
            {selectedPost?.views || 0} views
          </span>
        </div>
        <div className="text-gray-800 dark:text-gray-200 my-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <p>{selectedPost?.content}</p>
        </div>
        {/* Replies */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Replies ({replies.length})
          </h3>
          <div className="space-y-4">
            {repliesLoading ? (
              <div className="animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/5 mb-3"></div>
                    <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ) : replies.length > 0 ? (
              replies.map((reply) => (
                <div key={reply.id} className="border-b border-gray-100 dark:border-gray-800 pb-4 last:border-0">
                  <div className="flex items-center mb-2">
                    <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {reply.author?.[0]?.toUpperCase() || "A"}
                      </span>
                    </div>
                    <div className="ml-3">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {reply.author}
                        </span>
                        {reply.role === "admin" && (
                          <span className="ml-1 inline-block bg-blue-500 text-white text-xs px-1 rounded">Admin</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTimestamp(reply.timestamp)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-11 text-gray-700 dark:text-gray-300">
                    {reply.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 mb-3">
                  <RiChat3Line className="size-6 text-gray-500" />
                </div>
                <p className="text-gray-500 dark:text-gray-400">No replies yet. Be the first to reply!</p>
              </div>
            )}
          </div>
          {/* Reply Form */}
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Add a reply</h3>
            <div className="relative">
              <Textarea
                value={newReplyContent}
                onChange={(e) => setNewReplyContent(e.target.value)}
                placeholder="Write your reply here..."
                className="min-h-[120px] w-full pr-14 border border-gray-300 dark:border-gray-700 rounded-md focus:ring-2 focus:ring-blue-500 dark:bg-gray-800"
              />
              <Button
                onClick={handleSubmitReply}
                disabled={!newReplyContent.trim()}
                className="absolute bottom-3 right-3 h-8 w-8 p-0 flex items-center justify-center"
                title="Post reply"
              >
                <RiAddLine className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render the post list view
  const renderPostList = () => (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col md:flex-row gap-3 justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
            <RiTimeLine className="mr-2 size-4" />
            Latest discussions
          </h2>
          <div className="relative w-full md:w-64">
            <RiSearchLine className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
          </div>
        ) : filteredPosts.length > 0 ? (
          <>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginatedPosts.map((post) => (
                <div 
                  key={post.id} 
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer ${post.isPinned ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="flex items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {post.isPinned && (
                          <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                            <RiPinDistanceLine className="mr-1 size-3.5" />
                            Pinned
                          </span>
                        )}
                        {post.isAnswered && (
                          <span className="inline-flex items-center text-xs font-medium text-green-600 dark:text-green-400">
                            <RiCheckLine className="mr-1 size-3.5" />
                            Solved
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {post.title}
                      </h3>
                      <div className="flex flex-wrap items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span className="flex items-center">
                          <RiUserLine className="mr-1 size-3.5" />
                          {post.author}
                          {post.role === "admin" && (
                            <span className="ml-1 inline-block bg-blue-500 text-white text-xs px-1 rounded">
                              Admin
                            </span>
                          )}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{formatTimestamp(post.timestamp)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center text-right text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <RiChat3Line className="mr-1 size-3.5" />
                        <span>{post.replies || 0}</span>
                      </div>
                      <div className="flex items-center mt-1">
                        <RiEyeLine className="mr-1 size-3.5" />
                        <span>{post.views || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <div className="flex items-center space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="w-8 h-8 p-0 flex items-center justify-center"
                  >
                    1
                  </Button>
                  {currentPage > 3 && <span className="text-gray-500">...</span>}
                  {Array.from({ length: 3 }, (_, i) => {
                    const page = currentPage + i - 1;
                    if (page > 1 && page < totalPages) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                          className="w-8 h-8 p-0 flex items-center justify-center"
                        >
                          {page}
                        </Button>
                      );
                    }
                    return null;
                  })}
                  {currentPage < totalPages - 2 && <span className="text-gray-500">...</span>}
                  {totalPages > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="w-8 h-8 p-0 flex items-center justify-center"
                    >
                      {totalPages}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-8 text-center">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full p-4 inline-block mb-3">
              <RiChat3Line className="size-6 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No posts found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery ? "Try a different search term" : "Be the first to ask a question!"}
            </p>
            <Button onClick={() => setIsPostModalOpen(true)} className="flex items-center gap-2 mx-auto">
              <RiAddLine className="size-4" />
              Create New Post
            </Button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <main className="container max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            Community
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Ask questions, share insights, and connect with other researchers
          </p>
        </div>
        <Button onClick={() => setIsPostModalOpen(true)} className="flex items-center gap-2">
          <RiAddLine className="size-4" />
          New Post
        </Button>
      </div>
      {/* Main Content */}
      <div className="space-y-6">
        {selectedPost ? renderPostDetail() : renderPostList()}
      </div>
      {/* New Post Modal */}
      {isPostModalOpen && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-2xl">
            <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">Create New Post</h2>
                <Button variant="ghost" onClick={() => setIsPostModalOpen(false)} className="h-8 w-8 p-0">
                  <RiCloseLine className="size-5" />
                </Button>
              </div>
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
            </div>
            <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsPostModalOpen(false)} className="flex items-center gap-2">
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
          </div>
        </div>
      )}
    </main>
  );
}
