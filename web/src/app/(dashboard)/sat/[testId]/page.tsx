"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import SATTestResultsView from "../sat-test-results-view"
import SATTestProgressView from "../sat-test-progress-view"
import PageNavigation from "@/components/PageNavigation"

export default function SATTestResultsPage() {
    const params = useParams()
    const router = useRouter()
    const testId = params.testId as string
    const [testData, setTestData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchTestData = async () => {
            try {
                const response = await fetch(`/api/proxy/sat/tests/${testId}`)
                if (response.ok) {
                    const data = await response.json()
                    setTestData(data)
                } else {
                    console.error('Failed to fetch test data')
                }
            } catch (error) {
                console.error('Error fetching test data:', error)
            } finally {
                setLoading(false)
            }
        }

        if (testId) {
            fetchTestData()
        }
    }, [testId])

    // Auto-refresh for running tests only
    useEffect(() => {
        if (!testData || testData.status !== 'running') return

        const pollInterval = setInterval(() => {
            fetch(`/api/proxy/sat/tests/${testId}`)
                .then(response => response.json())
                .then(data => {
                    setTestData(data)
                    // If test completed, stop polling
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(pollInterval)
                    }
                })
                .catch(console.error)
        }, 2000) // Poll every 2 seconds

        return () => clearInterval(pollInterval)
    }, [testId, testData?.status])

    const handleBack = () => {
        router.back()
    }

    // Improved breadcrumbs based on test status and data
    const getBreadcrumbs = () => {
        const baseBreadcrumbs = [
            { label: "Dashboard", href: "/" },
            { label: "SAT Solver", href: "/sat" }
        ]

        if (loading) {
            return [
                ...baseBreadcrumbs,
                { label: "Loading..." }
            ]
        }

        if (!testData) {
            return [
                ...baseBreadcrumbs,
                { label: "Test Not Found" }
            ]
        }

        // Show test name and status in breadcrumbs
        const testName = testData.name || `Test ${testId.slice(-8)}`
        const statusText = testData.status === 'running' ? 'Running' : 
                          testData.status === 'queued' ? 'Queued' : 
                          testData.status === 'completed' ? 'Results' : 'Failed'

        return [
            ...baseBreadcrumbs,
            { label: testName, href: `/sat/${testId}` },
            { label: statusText }
        ]
    }

    const breadcrumbs = getBreadcrumbs()

    if (loading) {
        return (
            <>
                <PageNavigation currentPage="Test Details" breadcrumbs={breadcrumbs} />
                <div className="min-h-screen bg-background flex items-center justify-center pb-20 sm:pb-6">
                    <div className="text-center">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading test results...</p>
                    </div>
                </div>
            </>
        )
    }

    if (!testData) {
        return (
            <>
                <PageNavigation currentPage="Test Not Found" breadcrumbs={breadcrumbs} />
                <div className="min-h-screen bg-background flex items-center justify-center pb-20 sm:pb-6">
                    <div className="text-center">
                        <p className="text-lg font-medium mb-2">Test not found</p>
                        <p className="text-muted-foreground mb-4">The requested test could not be loaded.</p>
                    </div>
                </div>
            </>
        )
    }

    // Show different components based on test status
    const showProgressView = testData.status === 'running' || testData.status === 'queued'

    return (
        <>
            <PageNavigation currentPage="Test Details" breadcrumbs={breadcrumbs} />
            {showProgressView ? (
                <SATTestProgressView testData={testData} onBack={handleBack} />
            ) : (
                <SATTestResultsView testData={testData} onBack={handleBack} />
            )}
        </>
    )
} 