/* --------------------------------------------------------------------------
 * components/sat-test-details-modal.tsx
 * Simple dialog to show SAT‑/K‑SAT test metadata (extend as needed).
 * -------------------------------------------------------------------------*/

"use client"

import React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RiInformationLine } from "@remixicon/react"

interface SATTestDetailsModalProps {
    open: boolean
    onClose: () => void
    testId: string | null
    testData?: any
}

const SATTestDetailsModal: React.FC<SATTestDetailsModalProps> = ({
                                                                     open,
                                                                     onClose,
                                                                     testId,
                                                                     testData,
                                                                 }) => {
    if (!testId) return null

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>SAT Test Results</DialogTitle>
                    <DialogDescription>
                        Detailed results for SAT test {testId}
                    </DialogDescription>
                </DialogHeader>

                {testData && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <RiInformationLine className="h-5 w-5" />
                                Test Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Name</label>
                                <div className="text-foreground">{testData.name}</div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Chip Type</label>
                                <div className="text-foreground">{testData.chip_type}</div>
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium text-muted-foreground">Created</label>
                                <div className="text-foreground">
                                    {new Date(testData.created).toLocaleString("en-US", {
                                        timeZone: "America/New_York",
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </DialogContent>
        </Dialog>
    )
}

export default SATTestDetailsModal
