"use client"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { RiCheckLine, RiCloseLine } from "@remixicon/react"

// Base URL for the backend API; configure NEXT_PUBLIC_API_BASE_URL in .env.local
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<string>("suggestion")
  const [description, setDescription] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [notification, setNotification] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "success" | "error";
  } | null>(null)
  const router = useRouter()

  const showNotification = (title: string, message: string, type: "success" | "error") => {
    setNotification({ show: true, title, message, type })
    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim()) {
      showNotification("Error", "Please provide feedback description", "error")
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: feedbackType,
          description,
          email: email || undefined,
          timestamp: new Date().toISOString(),
        }),
      })
      
      if (!response.ok) {
        throw new Error("Failed to submit feedback")
      }
      
      showNotification("Thank you!", "Your feedback has been submitted successfully.", "success")
      
      // Reset form
      setFeedbackType("suggestion")
      setDescription("")
      setEmail("")
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push("/")
      }, 2000)
      
    } catch (error) {
      console.error("Error submitting feedback:", error)
      showNotification("Error", "Failed to submit feedback. Please try again.", "error")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="container max-w-4xl py-6">
      {notification && (
        <div className={`mt-4 p-3 ${
          notification.type === "success" 
            ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400" 
            : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
        } rounded-md flex items-center gap-2 mb-6`}>
          {notification.type === "success" ? (
            <RiCheckLine className="h-5 w-5" />
          ) : (
            <RiCloseLine className="h-5 w-5" />
          )}
          <span>{notification.message}</span>
        </div>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Feedback</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          We value your input to help improve our testing dashboard.
        </p>
      </div>
      
      <Card>
        <div className="p-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Feedback Type</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="suggestion"
                    name="feedbackType" 
                    value="suggestion"
                    checked={feedbackType === "suggestion"}
                    onChange={() => setFeedbackType("suggestion")}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="suggestion" className="text-sm text-gray-700 dark:text-gray-300">
                    Suggestion
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="bug"
                    name="feedbackType" 
                    value="bug"
                    checked={feedbackType === "bug"}
                    onChange={() => setFeedbackType("bug")}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="bug" className="text-sm text-gray-700 dark:text-gray-300">
                    Bug
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="feature"
                    name="feedbackType" 
                    value="feature-request"
                    checked={feedbackType === "feature-request"}
                    onChange={() => setFeedbackType("feature-request")}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="feature" className="text-sm text-gray-700 dark:text-gray-300">
                    Feature Request
                  </label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id="general"
                    name="feedbackType" 
                    value="general"
                    checked={feedbackType === "general"}
                    onChange={() => setFeedbackType("general")}
                    className="h-4 w-4 text-blue-600"
                  />
                  <label htmlFor="general" className="text-sm text-gray-700 dark:text-gray-300">
                    General
                  </label>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label htmlFor="description" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                id="description"
                rows={5}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300"
                placeholder="Please describe your feedback in detail..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Email (optional)
              </label>
              <input
                type="email"
                id="email"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-700 dark:text-gray-300"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                If you'd like us to follow up with you about your feedback
              </p>
            </div>
            
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => router.push("/")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  )
}