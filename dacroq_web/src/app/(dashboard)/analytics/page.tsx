"use client";

import React from "react";
import { Card } from "@tremor/react";
import { Sparklines, SparklinesLine } from "react-sparklines";

const dummyDataSales = [5, 10, 5, 20, 8, 15, 12, 18];
const dummyDataUsers = [3, 7, 3, 10, 5, 12, 6, 9];
const dummyDataRevenue = [10, 8, 15, 10, 20, 15, 18, 22];
const dummyDataSessions = [20, 15, 30, 25, 35, 40, 32, 28];

export default function AnalyticsPage() {
    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <h2 className="text-xl font-semibold mb-2">Sales Overview</h2>
                    <Sparklines data={dummyDataSales}>
                        <SparklinesLine color="#1E40AF" />
                    </Sparklines>
                    <p className="mt-2 text-sm text-gray-500">Total Sales: $12,345</p>
                </Card>

                <Card className="p-4">
                    <h2 className="text-xl font-semibold mb-2">User Signups</h2>
                    <Sparklines data={dummyDataUsers}>
                        <SparklinesLine color="#059669" />
                    </Sparklines>
                    <p className="mt-2 text-sm text-gray-500">New Users: 1,234</p>
                </Card>

                <Card className="p-4">
                    <h2 className="text-xl font-semibold mb-2">Revenue Growth</h2>
                    <Sparklines data={dummyDataRevenue}>
                        <SparklinesLine color="#6B21A8" />
                    </Sparklines>
                    <p className="mt-2 text-sm text-gray-500">Revenue Growth: 25%</p>
                </Card>

                <Card className="p-4">
                    <h2 className="text-xl font-semibold mb-2">Active Sessions</h2>
                    <Sparklines data={dummyDataSessions}>
                        <SparklinesLine color="#F59E0B" />
                    </Sparklines>
                    <p className="mt-2 text-sm text-gray-500">Sessions: 5,678</p>
                </Card>
            </div>
        </div>
    );
}
