"use client"

import { Button } from "@/components/Button"
import { useState } from "react"
import { useRouter } from "next/navigation"

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
    <div className="container max-w-2xl py-10">
      {notification && (
        <div 
          className={`mb-6 p-4 rounded-md ${
            notification.type === "success" 
              ? "bg-green-50 border border-green-200 text-green-800" 
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {notification.type === "success" ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium">{notification.title}</h3>
              <div className="mt-1 text-sm">{notification.message}</div>
            </div>
          </div>
        </div>
      )}
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          We value your input to help improve our testing dashboard.
        </p>
      </div>
      
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Feedback Type</label>
            <div className="flex flex-wrap gap-3">
              {["suggestion", "bug", "feature-request", "general"].map((type) => (
                <label 
                  key={type} 
                  className={`flex items-center rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    feedbackType === type 
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-950 dark:text-blue-400" 
                      : "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="feedbackType" 
                    value={type}
                    checked={feedbackType === type}
                    onChange={() => setFeedbackType(type)}
                    className="sr-only"
                  />
                  <span className="capitalize">{type.replace("-", " ")}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              rows={5}
              className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
              placeholder="Please describe your feedback in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              Email (optional)
            </label>
            <input
              type="email"
              id="email"
              className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-400"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If you'd like us to follow up with you about your feedback
            </p>
          </div>
          
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
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
    </div>
  )
}