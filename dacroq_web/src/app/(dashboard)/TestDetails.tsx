// ./TestDetails.tsx
'use client';

import React from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Divider } from "@/components/Divider";
import { LineChart, DonutChart, BarChart, Badge } from "@tremor/react";
import { RiArrowLeftLine } from "@remixicon/react";

interface TestDetailsProps {
    test: any;
    onBack: () => void;
    performanceData: any[];
    utilizationData: any[];
    runtimeData: any[];
    aggregatedData: any[];
    usageSummary: any[];
    resourceData: any[];
}

const TestDetails: React.FC<TestDetailsProps> = ({
                                                     test,
                                                     onBack,
                                                     performanceData,
                                                     utilizationData,
                                                     runtimeData,
                                                     aggregatedData,
                                                     usageSummary,
                                                     resourceData,
                                                 }) => {
    const displayStatus = test.status.charAt(0).toUpperCase() + test.status.slice(1);
    return (
        <main className="p-4">
            <div className="flex items-center mb-6">
                <Button variant="outline" onClick={onBack} className="mr-4 flex items-center gap-2">
                    <RiArrowLeftLine className="h-4 w-4" />
                    Back to Dashboard
                </Button>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
                    Test Details: {test.name}
                </h1>
            </div>
            <Divider />
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card>
                        <h3 className="text-lg font-medium mb-2">Test Info</h3>
                        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                            <div className="py-2 flex justify-between">
                                <dt className="text-sm text-gray-500">Chip Type</dt>
                                <dd className="text-sm font-medium">{test.chipType}</dd>
                            </div>
                            <div className="py-2 flex justify-between">
                                <dt className="text-sm text-gray-500">Status</dt>
                                <dd className="text-sm font-medium">
                                    <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium 
                    ${test.status === "completed" ? "bg-green-500/10 text-green-500" :
                                        test.status.includes("running") ? "bg-blue-500/10 text-blue-500" :
                                            test.status === "failed" ? "bg-red-500/10 text-red-500" :
                                                "bg-gray-500/10 text-gray-500"}`}>
                                        {displayStatus}
                                    </div>
                                </dd>
                            </div>
                            <div className="py-2 flex justify-between">
                                <dt className="text-sm text-gray-500">Created</dt>
                                <dd className="text-sm font-medium">
                                    {test.created?.seconds
                                        ? new Date(test.created.seconds * 1000).toLocaleString()
                                        : new Date(test.created).toLocaleString()}
                                </dd>
                            </div>
                            <div className="py-2 flex justify-between">
                                <dt className="text-sm text-gray-500">Created by</dt>
                                <dd className="text-sm font-medium flex items-center">
                                    <img
                                        src={test.createdBy?.photoURL || test.createdBy?.avatar || '/default-avatar.png'}
                                        alt="Avatar"
                                        className="h-6 w-6 rounded-full mr-2"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                test.createdBy?.displayName || test.createdBy?.name || 'User'
                                            )}`;
                                        }}
                                    />
                                    {test.createdBy?.displayName || test.createdBy?.name || "Unknown"}
                                </dd>
                            </div>
                        </dl>
                    </Card>
                </div>
                <div className="lg:col-span-2">
                    <Card>
                        <h3 className="text-lg font-medium mb-2">Results</h3>
                        {test.results ? (
                            <pre className="mt-2 rounded bg-gray-100 p-4 dark:bg-gray-700 overflow-auto max-h-80">
                {JSON.stringify(test.results, null, 2)}
              </pre>
                        ) : (
                            <p>No results available</p>
                        )}
                    </Card>
                </div>
            </div>
            <div className="mt-6">
                <h2 className="text-lg font-medium mb-4">Test Analytics</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                        <h3 className="text-base font-medium mb-2">Success Rate Trend</h3>
                        <p className="text-sm text-gray-500 mb-4">Monthly performance history</p>
                        <LineChart
                            data={performanceData}
                            index="month"
                            categories={["success", "failures"]}
                            colors={["emerald", "rose"]}
                            valueFormatter={(num) => `${num.toFixed(1)}%`}
                            showYAxis={true}
                            showLegend={true}
                            className="h-64"
                        />
                    </Card>
                    <Card>
                        <h3 className="text-base font-medium mb-2">Chip Utilization</h3>
                        <p className="text-sm text-gray-500 mb-4">Distribution by chip type</p>
                        <DonutChart
                            data={utilizationData}
                            category="value"
                            index="name"
                            valueFormatter={(num) => `${num.toFixed(1)}%`}
                            colors={["blue", "indigo", "violet"]}
                            className="h-64"
                        />
                    </Card>
                    <Card>
                        <h3 className="text-base font-medium mb-2">Test Runtime</h3>
                        <p className="text-sm text-gray-500 mb-4">Performance metrics over time (ms)</p>
                        <LineChart
                            data={runtimeData}
                            index="date"
                            categories={["avg", "min", "max"]}
                            colors={["blue", "emerald", "amber"]}
                            valueFormatter={(num) => Intl.NumberFormat("us").format(num)}
                            showYAxis={true}
                            showLegend={true}
                            className="h-64"
                        />
                    </Card>
                    <Card>
                        <h3 className="text-base font-medium mb-2">Test Frequency</h3>
                        <p className="text-sm text-gray-500 mb-4">Total tests by date</p>
                        <BarChart
                            data={aggregatedData}
                            index="date"
                            categories={["Tests"]}
                            colors={["blue"]}
                            valueFormatter={(num) => `${Intl.NumberFormat("us").format(num)}`}
                            showYAxis={true}
                            showLegend={false}
                            className="h-64"
                        />
                    </Card>
                </div>
            </div>
            <div className="mt-6">
                <Card>
                    <h3 className="text-lg font-medium mb-4">Resource Usage</h3>
                    <div className="flex flex-col gap-x-6 gap-y-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-50">Enterprise</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                                User ID: <span className="font-medium text-gray-900 dark:text-gray-50">admin_dfQ7s</span>
                            </p>
                        </div>
                        <div className="mt-4 flex items-center gap-4 gap-y-2 sm:mt-0 sm:gap-x-8">
                            {usageSummary.map((item, index) => (
                                <React.Fragment key={item.name}>
                                    <div>
                                        <p className="whitespace-nowrap text-sm text-gray-500 dark:text-gray-500">
                                            {item.name}
                                        </p>
                                        {item.name === "Last invoice" ? (
                                            <a
                                                className="mt-1 inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-blue-500 hover:underline hover:underline-offset-4 dark:text-blue-500"
                                                href="#"
                                            >
                                                {item.value}
                                            </a>
                                        ) : (
                                            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
                                                {item.value}
                                            </p>
                                        )}
                                    </div>
                                    <span className="flex">
                    {index < usageSummary.length - 1 && (
                        <span className="h-10 w-px bg-slate-500/20" aria-hidden="true" />
                    )}
                  </span>
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                    <Divider className="my-5" />
                    <div className="flex items-center gap-3">
                        <Badge variant="success" className="rounded-full">
                            Active
                        </Badge>
                        <span className="h-6 w-px bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
                        <span className="text-sm text-gray-500 dark:text-gray-500">Sept 24 period</span>
                        <span className="hidden h-6 w-px bg-gray-200 dark:bg-gray-800 sm:block" aria-hidden="true" />
                        <span className="hidden text-sm text-gray-500 dark:text-gray-500 sm:block">
              Started Sep 1, 2024 (billed on the 28th)
            </span>
                    </div>
                    <BarChart
                        data={resourceData}
                        index="date"
                        colors={["blue", "emerald"]}
                        categories={["GPU cluster", "Workspace usage"]}
                        stack={true}
                        valueFormatter={(num) => `$${Intl.NumberFormat("us").format(num)}`}
                        showLegend={true}
                        showYAxis={true}
                        className="mt-6 h-64"
                    />
                </Card>
            </div>
        </main>
    );
};

export default TestDetails;
