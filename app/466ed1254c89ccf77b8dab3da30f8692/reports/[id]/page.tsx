'use client';

import React, { useState, useEffect } from 'react';
import { getReport, updateReportData, createInvoiceForReportRow, duplicateReport } from '@/app/actions/reports';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Loader2, FileBarChart2, ArrowLeft, Save, FileText, ExternalLink, Copy, Files, AlertTriangle,
    RotateCcw,
    Trash2,
    Plus,
    FileCheck,
    Truck,
    Info
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../../components/ui/tooltip";
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useParams } from 'next/navigation';

// Simple Editable Cell Component (Reused logic)
function EditableCell({
    value,
    onUpdate,
    unit,
    readOnly
}: {
    value: string | number | React.ReactNode,
    onUpdate: (newValue: string) => Promise<boolean>,
    unit?: string,
    readOnly?: boolean
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState<string | number>('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (typeof value === 'string' || typeof value === 'number') {
            setLocalValue(value);
        }
    }, [value]);

    const handleSave = async () => {
        if (localValue == value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        const success = await onUpdate(String(localValue));
        setIsSaving(false);

        if (success) {
            setIsEditing(false);
        } else {
            toast.error('Failed to save value');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            if (typeof value === 'string' || typeof value === 'number') {
                setLocalValue(value);
            }
            setIsEditing(false);
        }
    };

    if (isEditing) {
        return (
            <div className="relative flex items-center min-w-[60px]">
                <input
                    autoFocus
                    className="w-full p-1 text-sm border rounded shadow-sm focus:ring-2 focus:ring-blue-500 bg-white text-black"
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    disabled={isSaving}
                />
                {isSaving && <Loader2 className="absolute right-1 w-3 h-3 animate-spin text-gray-500" />}
            </div>
        );
    }

    return (
        <div
            onClick={() => !readOnly && typeof value !== 'object' && setIsEditing(true)}
            className={cn(
                "p-2 min-h-[30px] rounded transition-colors truncate tabular-nums",
                !readOnly && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
                readOnly && "bg-gray-50/50 dark:bg-zinc-800/50 text-gray-500 cursor-default",
                (value === '' || value === null) && "text-gray-300 italic"
            )}
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
        >
            <div className="flex items-baseline gap-1">
                {(value === '' || value === null) ? 'Empty' : value}
                {unit && (typeof value === 'string' || typeof value === 'number') && <span className="text-[10px] text-zinc-400 font-normal select-none">{unit}</span>}
            </div>
        </div>
    );
}
export default function ReportDetailPage() {
    const params = useParams();
    const id = params.id as string;

    const [report, setReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [creatingInvoice, setCreatingInvoice] = useState<{ [rowIndex: number]: boolean }>({});
    const [isDuplicating, setIsDuplicating] = useState(false);

    // Driver Rows State
    const [driverRows, setDriverRows] = useState<any[][]>([]);
    const [driverPackageCountRows, setDriverPackageCountRows] = useState<any[][]>([]);
    const [driverAssignments, setDriverAssignments] = useState<{ [rowIdx: number]: number }>({}); // orderRowIdx -> driverRowIdx

    // Column Resizing State
    const [columnWidths, setColumnWidths] = useState<{ [key: number]: number }>({});
    const [resizing, setResizing] = useState<{ colIndex: number; startX: number; startWidth: number } | null>(null);
    const [hoveredHeader, setHoveredHeader] = useState<{ meta: any, rect: DOMRect } | null>(null);

    useEffect(() => {
        if (id) {
            loadReport(id);
        }
    }, [id]);

    useEffect(() => {
        if (resizing) {
            const handleMouseMove = (e: MouseEvent) => {
                const diff = e.clientX - resizing.startX;
                const newWidth = Math.max(50, resizing.startWidth + diff); // Min width 50px
                setColumnWidths(prev => ({
                    ...prev,
                    [resizing.colIndex]: newWidth
                }));
            };

            const handleMouseUp = () => {
                setResizing(null);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [resizing]);

    async function loadReport(reportId: string) {
        setIsLoading(true);
        const res = await getReport(reportId);
        if (res.success && res.data) {
            setReport(res.data);
            // Initialize driver rows from report data
            const reportData = res.data.data as any;
            if (reportData?.driverRows) {
                setDriverRows(reportData.driverRows);
            }
            if (reportData?.driverPackageCountRows) {
                setDriverPackageCountRows(reportData.driverPackageCountRows);
            }
            if (reportData?.driverAssignments) {
                setDriverAssignments(reportData.driverAssignments);
            }
        } else {
            toast.error(res.error || 'Failed to load report');
        }
        setIsLoading(false);
    }

    const handleResizeStart = (e: React.MouseEvent, colIndex: number) => {
        e.preventDefault();
        const currentWidth = columnWidths[colIndex] || (colIndex === 0 ? 200 : colIndex === 1 ? 100 : 150); // Defaults
        setResizing({
            colIndex,
            startX: e.clientX,
            startWidth: currentWidth
        });
    };

    const handleCreateInvoice = async (rowIdx: number, force: boolean = false) => {
        setCreatingInvoice(prev => ({ ...prev, [rowIdx]: true }));

        try {
            const result = await createInvoiceForReportRow(id, rowIdx, force);

            if (result.success) {
                toast.success(force ? `Фактура ${result.invoiceNumber} оновлена!` : `Фактура ${result.invoiceNumber} створена успішно!`);
                // Reload report to get updated invoice data
                await loadReport(id);
            } else {
                toast.error(result.error || 'Не вдалося створити фактуру');
            }
        } catch (error) {
            toast.error('Помилка при створенні фактури');
        } finally {
            setCreatingInvoice(prev => ({ ...prev, [rowIdx]: false }));
        }
    };



    const handleDuplicateReport = async () => {
        setIsDuplicating(true);

        try {
            const result = await duplicateReport(id);

            if (result.success && result.data) {
                toast.success('Звіт скопійовано!');
                // Redirect to the new report
                window.location.href = `/466ed1254c89ccf77b8dab3da30f8692/reports/${result.data.id}`;
            } else {
                toast.error(result.error || 'Не вдалося скопіювати звіт');
            }
        } catch (error) {
            toast.error('Помилка при копіюванні звіту');
        } finally {
            setIsDuplicating(false);
        }
    };

    const getDriverVerticalText = (rowIdx: number): string | null => {
        const row = driverRows[rowIdx];
        if (!row) return null;

        const driverName = row[0];
        const lines: string[] = [];

        // Header: name with tabs to span across columns
        lines.push(`${driverName}\t\t`);

        // Products start at index 2
        for (let i = 2; i < row.length; i++) {
            const qty = Number(row[i]) || 0;
            const header = reportData.headers[i];
            const meta = reportData.headerMetadata?.[i];
            const unit = meta?.unit || '';
            const rawUnit = unit.trim().toLowerCase();
            const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);

            // Add package info
            const pkgData = driverPackageCountRows?.[rowIdx]?.[i];
            const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
            const pkgType = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

            let qtyVal = '';
            let qtyUnit = '';
            if (isWeight) {
                qtyVal = qty.toFixed(2);
                qtyUnit = unit;
            } else {
                // Non-weight items: Use packages as primary quantity if available
                if (pkgCount > 0) {
                    qtyVal = pkgCount.toFixed(1);
                    qtyUnit = pkgType;
                } else {
                    qtyVal = qty.toFixed(2);
                    qtyUnit = unit;
                }
            }

            const cleanHeader = header.split(' [ID:')[0];
            // 3 columns: Product Name [Tab] Value [Tab] Unit/Pkg
            lines.push(`${cleanHeader}\t${qtyVal}\t${qtyUnit}`);
        }

        if (lines.length <= 1) return null; // Only driver name

        // Get total weight (Column 1 is complex object {weight, otherUnits})
        const totalWeightData = row[1];
        const totalWeight = typeof totalWeightData === 'object' && totalWeightData !== null ? (totalWeightData.weight || 0) : (Number(totalWeightData) || 0);

        lines.push(`TOTAL\t${totalWeight.toFixed(2)}\tkg`);

        return lines.join('\n');
    }

    const handleCopyDriverVertical = (rowIdx: number) => {
        const text = getDriverVerticalText(rowIdx);
        if (!text) {
            toast.error('Немає товарів для копіювання');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            toast.success('Скопійовано!');
        }).catch(() => {
            toast.error('Помилка копіювання');
        });
    };

    const handleCopyAllDrivers = () => {
        const driversData: string[][] = [];

        for (let i = 0; i < driverRows.length; i++) {
            const text = getDriverVerticalText(i);
            if (text) {
                driversData.push(text.split('\n'));
            }
        }

        if (driversData.length === 0) {
            toast.error('Немає даних для копіювання');
            return;
        }

        // Find the maximum number of lines among all drivers to know how many rows we need
        const maxLines = Math.max(...driversData.map(d => d.length));
        const finalLines: string[] = [];

        for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
            let combinedLine = '';
            for (let driverIdx = 0; driverIdx < driversData.length; driverIdx++) {
                // Get the line for this driver at the current index, or empty tabs if they have no more lines
                const line = driversData[driverIdx][lineIdx] || '\t\t';
                combinedLine += line + '\t\t'; // Add extra spacing between drivers
            }
            finalLines.push(combinedLine.trimEnd());
        }

        const fullText = finalLines.join('\n');

        navigator.clipboard.writeText(fullText).then(() => {
            toast.success('Дані всіх водіїв скопійовано горизонтально!');
        }).catch(() => {
            toast.error('Помилка копіювання');
        });
    }

    const handleCellUpdate = async (rowIdx: number, headerIdx: number, newValue: string) => {
        if (!report || !report.data) return false;

        const newData = { ...report.data };
        const newRows = [...newData.rows];
        const newRow = [...newRows[rowIdx]];
        const newFooter = [...newData.footer];

        const header = newData.headers[headerIdx];
        // Index 0 is Client (text). Index 1 is Weight (number). Index 2+ are Products (number).
        const isNumberCol = headerIdx > 0;

        // 1. Update Cell Value
        const val = isNumberCol ? (Number(newValue) || 0) : newValue;
        newRow[headerIdx] = val;
        newRows[rowIdx] = newRow;

        // 2. Recalculate Package Count for the Modified Cell (moved up)
        if (headerIdx >= 2 && newData.packageCountRows) {
            const newPackageCountRows = [...newData.packageCountRows];
            const newPkgRow = [...newPackageCountRows[rowIdx]];
            const meta = newData.headerMetadata?.[headerIdx];

            if (meta) {
                const weightOrQty = Number(val) || 0;
                let newPkgCount = 0;

                // Try to infer ratio from previous value to preserve custom packaging logic
                const oldVal = Number(report.data.rows[rowIdx][headerIdx]) || 0;
                const oldPkgData = report.data.packageCountRows?.[rowIdx]?.[headerIdx];
                const oldPkgCount = typeof oldPkgData === 'object' && oldPkgData !== null ? oldPkgData.count : (Number(oldPkgData) || 0);

                console.log(`[PKG CLIENT] Editing cell - oldVal=${oldVal}, oldPkgCount=${oldPkgCount}, newVal=${weightOrQty}`);

                if (oldVal > 0 && oldPkgCount > 0) {
                    const ratio = oldPkgCount / oldVal;
                    newPkgCount = weightOrQty * ratio;
                    console.log(`[PKG CLIENT]   -> Using existing ratio: ${oldPkgCount}/${oldVal} = ${ratio}, newPkgCount=${newPkgCount}`);
                } else {
                    // Try to find packageCount from original order items
                    let foundFromOriginal = false;
                    const orderMeta = newData.orderMetadata?.[rowIdx];

                    if (orderMeta?.originalItems) {
                        const header = newData.headers[headerIdx];
                        const idMatch = header.match(/\[ID:(\d+)\]/);
                        const productId = idMatch ? idMatch[1] : null;
                        if (productId) {
                            const originalItem = (orderMeta.originalItems as any[]).find(
                                (item: any) => String(item.productId) === productId
                            );
                            if (originalItem) {
                                const origQty = Number(originalItem.quantity) || 0;
                                const origPkgCount = Number(originalItem.packageCount) || 0;
                                if (origQty > 0 && origPkgCount > 0) {
                                    const ratio = origPkgCount / origQty;
                                    newPkgCount = weightOrQty * ratio;
                                    foundFromOriginal = true;
                                }
                            }
                        }
                    }

                    if (!foundFromOriginal) {
                        if (meta.additionalInfo) {
                            const match = meta.additionalInfo.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
                            if (match) {
                                const pkgCountFromMeta = parseFloat(match[1]);
                                if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                                    if (meta.netWeight > 0 && pkgCountFromMeta > 0) {
                                        const ratio = pkgCountFromMeta / meta.netWeight;
                                        newPkgCount = weightOrQty * ratio;
                                        foundFromOriginal = true;
                                    }
                                } else {
                                    if (meta.unitPerCardboard > 0 && pkgCountFromMeta > 0) {
                                        const ratio = pkgCountFromMeta / meta.unitPerCardboard;
                                        newPkgCount = weightOrQty * ratio;
                                        foundFromOriginal = true;
                                    }
                                }
                            }
                        }
                    }

                    if (!foundFromOriginal) {
                        if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                            if (meta.netWeight > 0) newPkgCount = weightOrQty / meta.netWeight;
                        } else {
                            if (meta.unitPerCardboard > 0) newPkgCount = weightOrQty / meta.unitPerCardboard;
                        }
                    }
                }

                // Determine packageType
                const originalData = report.data.packageCountRows?.[rowIdx]?.[headerIdx];
                let existingType = (typeof originalData === 'object' && originalData !== null) ? originalData.packageType : null;

                if (!existingType || existingType === 'kart') {
                    const orderMeta = newData.orderMetadata?.[rowIdx];
                    if (orderMeta?.originalItems) {
                        const header = newData.headers[headerIdx];
                        const idMatch = header.match(/\[ID:(\d+)\]/);
                        const productId = idMatch ? idMatch[1] : null;
                        if (productId) {
                            const originalItem = (orderMeta.originalItems as any[]).find(
                                (item: any) => String(item.productId) === productId
                            );
                            if (originalItem?.packageType) {
                                existingType = originalItem.packageType;
                            }
                        }
                    }
                }

                if (!existingType || existingType === 'kart') {
                    if (meta.additionalInfo) {
                        const match = meta.additionalInfo.match(/^\d+(?:\.\d+)?\s*(.+)/);
                        if (match && match[1]) {
                            existingType = match[1].trim();
                        }
                    }
                }

                if (!existingType) {
                    existingType = 'kart';
                }

                newPkgRow[headerIdx] = { count: newPkgCount, packageType: existingType };

                // Recalculate Row Total Pkg Count (Index 1) for packages
                let rowPkgTotal = 0;
                for (let i = 2; i < newPkgRow.length; i++) {
                    const cell = newPkgRow[i];
                    const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                    rowPkgTotal += count;
                }
                newPkgRow[1] = rowPkgTotal;

                newPackageCountRows[rowIdx] = newPkgRow;
                newData.packageCountRows = newPackageCountRows;

                // Update Package Footer
                if (newData.packageCountFooter) {
                    const newPkgFooter = [...newData.packageCountFooter];

                    // Update column total AND preserve package type
                    let colPkgTotal = 0;
                    let colPackageType = 'kart'; // default
                    for (let r = 0; r < newPackageCountRows.length; r++) {
                        const cell = newPackageCountRows[r][headerIdx];
                        const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                        const type = typeof cell === 'object' && cell !== null ? cell.packageType : 'kart';

                        colPkgTotal += count;

                        if (count > 0 && (colPackageType === 'kart' && type !== 'kart')) {
                            colPackageType = type;
                        }
                    }

                    if (colPkgTotal > 0) {
                        newPkgFooter[headerIdx] = { count: colPkgTotal, packageType: colPackageType };
                    } else {
                        newPkgFooter[headerIdx] = colPkgTotal;
                    }

                    // Update grand total (index 1)
                    let grandPkgTotal = 0;
                    for (let r = 0; r < newPackageCountRows.length; r++) {
                        grandPkgTotal += Number(newPackageCountRows[r][1]) || 0;
                    }
                    newPkgFooter[1] = grandPkgTotal;
                    newData.packageCountFooter = newPkgFooter;
                }
            }
        }

        // 3. Recalculate Row Total (Index 1 is 'Вага', Products start at Index 2)
        if (isNumberCol && headerIdx >= 2) {
            let rowTotal = 0;
            const pkgRow = newData.packageCountRows?.[rowIdx];

            for (let i = 2; i < newRow.length; i++) {
                const colHeader = newData.headers[i];
                const meta = newData.headerMetadata?.[i];

                // Check metadata for unit, fallback to header string check
                let isWeightColumn = false;
                if (meta && meta.unit) {
                    isWeightColumn = ['kg', 'кг', 'g', 'г'].includes(meta.unit.toLowerCase());
                } else if (colHeader) {
                    isWeightColumn = colHeader.includes('(кг)');
                }

                if (isWeightColumn) {
                    rowTotal += Number(newRow[i]) || 0;
                } else {
                    // Treat non-weight unit packages as 1kg each
                    if (pkgRow) {
                        const pkgData = pkgRow[i];
                        const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                        if (count > 0) {
                            rowTotal += count;
                        }
                    }
                }
            }
            newRow[1] = rowTotal;
        }

        // 4. Recalculate Footer for Modified Column
        if (isNumberCol) {
            let colTotal = 0;
            for (let r = 0; r < newRows.length; r++) {
                colTotal += Number(newRows[r][headerIdx]) || 0;
            }
            newFooter[headerIdx] = colTotal;
        }

        // 5. Recalculate Footer for Grand Total (Index 1)
        if (isNumberCol && headerIdx >= 1) {
            let totalWeight = 0;
            for (let r = 0; r < newRows.length; r++) {
                totalWeight += Number(newRows[r][1]) || 0; // Sum up the row totals
            }
            newFooter[1] = totalWeight;
        }

        newData.rows = newRows;
        newData.footer = newFooter;


        // 6. Recalculate Driver Rows if assignments exist
        if (Object.keys(driverAssignments).length > 0) {
            const { newDriverRows, newDriverPkgRows } = recalculateDriverRows(driverRows, driverAssignments, newData);
            newData.driverRows = newDriverRows;
            newData.driverPackageCountRows = newDriverPkgRows;
            setDriverRows(newDriverRows);
            setDriverPackageCountRows(newDriverPkgRows);
        }

        // Optimistic update
        const previousReport = { ...report };
        setReport({ ...report, data: newData });

        // Save to DB
        const res = await updateReportData(id, newData);
        if (res.success) {
            toast.success('Saved');
            return true;
        } else {
            // Revert
            setReport(previousReport);
            return false;
        }
    };



    // Recalculate Driver Rows based on assignments
    const recalculateDriverRows = (
        currentDriverRows: any[][],
        currentDriverAssignments: { [rowIdx: number]: number },
        fullReportData: any
    ) => {
        // Clone driver rows to avoid direct mutation of state/props
        // We only want to reset the Calculated Values (cols 1+), but keep the Driver Name (col 0)
        const newDriverRows = currentDriverRows.map(row => {
            const newRow = new Array(row.length).fill(0);
            newRow[0] = row[0]; // Preserve name
            return newRow;
        });

        const newDriverPkgRows = currentDriverRows.map(row => {
            const newRow = new Array(row.length).fill(0);
            newRow[0] = '';
            return newRow;
        });

        // Iterate over all Main Rows (Orders)
        fullReportData.rows.forEach((orderRow: any[], orderIdx: number) => {
            const assignedDriverIdx = currentDriverAssignments[orderIdx];

            // If this order is assigned to a valid driver
            if (assignedDriverIdx !== undefined && newDriverRows[assignedDriverIdx]) {
                const driverRow = newDriverRows[assignedDriverIdx];
                const driverPkgRow = newDriverPkgRows[assignedDriverIdx];

                // Iterate columns (products)
                for (let colIdx = 2; colIdx < orderRow.length; colIdx++) {
                    const val = Number(orderRow[colIdx]) || 0;

                    if (val > 0) {
                        // console.log(`[DriverCalc] Adding val ${val} to driver ${assignedDriverIdx} col ${colIdx}`);
                        // Add to driver row
                        driverRow[colIdx] += val;
                    }

                    // Add to driver package row
                    if (fullReportData.packageCountRows?.[orderIdx]?.[colIdx]) {
                        const pkgData = fullReportData.packageCountRows[orderIdx][colIdx];
                        const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                        const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                        if (count > 0) {
                            if (!driverPkgRow[colIdx]) driverPkgRow[colIdx] = 0;

                            // If existing is number, convert to object structure if needed, or just sum
                            // Logic: 
                            // 1. If we have a complex object in driver row, update it
                            // 2. Or simplified: just sum counts and keep last type? 
                            // Better: Store breakdown like footer? Yes, let's use breakdown for simplicity or just sum counts.
                            // For cells (not total column), usually single type is expected per cell. 
                            // But here multiple orders might have different types for SAME product? Unlikely but possible.
                            // Let's stick to simple sum for now and taking the type of the last one or 'kart'.

                            const currentDriverCell = driverPkgRow[colIdx];
                            const currentCount = typeof currentDriverCell === 'object' ? currentDriverCell.count : (Number(currentDriverCell) || 0);

                            let newCount = currentCount + count;
                            let newType = type; // simplified (last wins)

                            driverPkgRow[colIdx] = { count: newCount, packageType: newType };
                        }
                    }
                }
            }
        });

        // Calculate Row Totals for Drivers (Weight and Other Units)
        newDriverRows.forEach((row, dIdx) => {
            let totalWeight = 0;
            const otherUnitsMap: Record<string, number> = {};
            const pkgRow = newDriverPkgRows[dIdx];

            for (let i = 2; i < row.length; i++) {
                const qty = Number(row[i]) || 0;
                const meta = fullReportData.headerMetadata?.[i];

                // Get pkg count for this cell
                const pkgCell = pkgRow && pkgRow[i];
                const pkgCount = typeof pkgCell === 'object' && pkgCell !== null ? pkgCell.count : (Number(pkgCell) || 0);

                if (meta && qty > 0) {
                    const unit = meta.unit?.toLowerCase().trim();
                    if (['kg', 'кг'].includes(unit)) {
                        totalWeight += qty;
                    } else if (['g', 'г'].includes(unit)) {
                        totalWeight += qty / 1000;
                    } else {
                        // Treat non-weight unit packages as 1kg each
                        if (pkgCount > 0) {
                            totalWeight += pkgCount;
                        }
                    }
                }
            }

            // Store comprehensive total object instead of just number
            row[1] = { weight: totalWeight };

            // Pkg Total - Group by Unit
            const packagesByUnit: Record<string, Record<string, number>> = {};

            for (let i = 2; i < pkgRow.length; i++) {
                const cell = pkgRow[i];
                const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                const type = typeof cell === 'object' && cell !== null ? cell.packageType : 'kart';

                if (count > 0) {
                    const meta = fullReportData.headerMetadata?.[i];
                    // Force all packages to group under 'kg' since everything contributes to total weight now
                    const unit = 'kg';

                    if (!packagesByUnit[unit]) {
                        packagesByUnit[unit] = {};
                    }
                    packagesByUnit[unit][type] = (packagesByUnit[unit][type] || 0) + count;
                }
            }
            pkgRow[1] = { packagesByUnit };
        });

        return { newDriverRows, newDriverPkgRows };
    };

    const handleAssignDriver = async (orderRowIdx: number, driverIdxStr: string) => {
        if (!report || !report.data) return;

        const driverIdx = parseInt(driverIdxStr);
        let newAssignments = { ...driverAssignments };

        if (isNaN(driverIdx) || driverIdx < 0) {
            delete newAssignments[orderRowIdx];
        } else {
            newAssignments[orderRowIdx] = driverIdx;
        }

        setDriverAssignments(newAssignments);

        // Recalculate
        const { newDriverRows, newDriverPkgRows } = recalculateDriverRows(driverRows, newAssignments, report.data);

        setDriverRows(newDriverRows);
        setDriverPackageCountRows(newDriverPkgRows);

        // Save to DB
        const newData = {
            ...report.data,
            driverAssignments: newAssignments,
            driverRows: newDriverRows,
            driverPackageCountRows: newDriverPkgRows
        };

        // Optimistic Update
        // setReport({ ...report, data: newData }); // already updated state individually, but report.data needs to stay in sync

        const res = await updateReportData(id, newData);
        if (res.success) {
            setReport({ ...report, data: newData }); // Confirm sync
            toast.success('Assignment saved');
        } else {
            toast.error('Failed to save assignment');
        }
    };

    // Driver Row Management Functions
    const handleAddDriver = () => {
        if (!report || !report.data) return;

        const numCols = report.data.headers.length;
        const driverCount = driverRows.length + 1;

        // Create new driver row with empty values
        const newDriverRow = new Array(numCols).fill(0);
        newDriverRow[0] = `Driver ${driverCount}`; // Name
        newDriverRow[1] = 0; // Weight total

        // Create package count row for driver
        const newDriverPkgRow = new Array(numCols).fill(0);
        newDriverPkgRow[0] = '';
        newDriverPkgRow[1] = 0;

        setDriverRows([...driverRows, newDriverRow]);
        setDriverPackageCountRows([...driverPackageCountRows, newDriverPkgRow]);

        // Save to DB
        saveDriverRowsToDb([...driverRows, newDriverRow], [...driverPackageCountRows, newDriverPkgRow], driverAssignments);
    };

    const handleRemoveDriver = (rowIdx: number) => {
        const newDriverRows = driverRows.filter((_, idx) => idx !== rowIdx);
        const newDriverPkgRows = driverPackageCountRows.filter((_, idx) => idx !== rowIdx);

        // Update assignments: remove assignments to this driver, shift others down
        const newAssignments: { [rowIdx: number]: number } = {};
        Object.entries(driverAssignments).forEach(([orderIdxStr, driverIdx]) => {
            const orderIdx = parseInt(orderIdxStr);
            if (driverIdx < rowIdx) {
                newAssignments[orderIdx] = driverIdx;
            } else if (driverIdx > rowIdx) {
                newAssignments[orderIdx] = driverIdx - 1;
            }
        });

        setDriverAssignments(newAssignments);
        setDriverRows(newDriverRows);
        setDriverPackageCountRows(newDriverPkgRows);

        // Save to DB
        saveDriverRowsToDb(newDriverRows, newDriverPkgRows, newAssignments);
        toast.success('Driver removed');
    };

    const handleDriverCellUpdate = async (rowIdx: number, headerIdx: number, newValue: any) => {
        if (!report || !report.data) return false;

        const newDriverRows = [...driverRows];
        const newDriverRow = [...newDriverRows[rowIdx]];

        const isNumberCol = headerIdx > 0;
        const val = isNumberCol ? (Number(newValue) || 0) : newValue;
        newDriverRow[headerIdx] = val;

        // Recalculate weight total if editing product column
        if (isNumberCol && headerIdx >= 2) {
            let rowTotal = 0;
            for (let i = 2; i < newDriverRow.length; i++) {
                const colHeader = report.data.headers[i];
                const qty = Number(newDriverRow[i]) || 0;
                const meta = report.data.headerMetadata?.[i];

                if (meta) {
                    const unit = meta.unit?.toLowerCase();
                    if (['kg', 'кг'].includes(unit)) {
                        rowTotal += qty;
                    } else if (['g', 'г'].includes(unit)) {
                        rowTotal += qty / 1000;
                    } else {
                        const netWeight = meta.netWeight || 0;
                        rowTotal += qty * netWeight;
                    }
                }
            }
            newDriverRow[1] = rowTotal;
        }

        newDriverRows[rowIdx] = newDriverRow;

        // Recalculate package counts for this driver row
        const newDriverPkgRows = [...driverPackageCountRows];
        const newDriverPkgRow = [...newDriverPkgRows[rowIdx]];

        if (headerIdx >= 2) {
            const meta = report.data.headerMetadata?.[headerIdx];
            if (meta) {
                const weightOrQty = Number(val) || 0;
                let newPkgCount = 0;

                // Try to parse from meta.additionalInfo (e.g., "3 ggg" means 3 packages)
                let packageType = 'kart';
                if (meta.additionalInfo) {
                    const match = meta.additionalInfo.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
                    if (match) {
                        const pkgCountFromMeta = parseFloat(match[1]);
                        packageType = match[2].trim();

                        if (pkgCountFromMeta > 0) {
                            if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                                if (meta.netWeight > 0) {
                                    const ratio = pkgCountFromMeta / meta.netWeight;
                                    newPkgCount = weightOrQty * ratio;
                                }
                            } else {
                                if (meta.unitPerCardboard > 0) {
                                    const ratio = pkgCountFromMeta / meta.unitPerCardboard;
                                    newPkgCount = weightOrQty * ratio;
                                }
                            }
                        }
                    }
                }

                // Fallback calculation
                if (newPkgCount === 0) {
                    if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                        if (meta.netWeight > 0) newPkgCount = weightOrQty / meta.netWeight;
                    } else {
                        if (meta.unitPerCardboard > 0) newPkgCount = weightOrQty / meta.unitPerCardboard;
                    }
                }

                newDriverPkgRow[headerIdx] = { count: newPkgCount, packageType };
            }

            // Recalculate row total package count
            const rowPkgMap: Record<string, number> = {};
            for (let i = 2; i < newDriverPkgRow.length; i++) {
                const cell = newDriverPkgRow[i];
                const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                const type = typeof cell === 'object' && cell !== null ? cell.packageType : 'kart';

                if (count > 0) {
                    rowPkgMap[type] = (rowPkgMap[type] || 0) + count;
                }
            }
            newDriverPkgRow[1] = { breakdown: rowPkgMap };
        }

        newDriverPkgRows[rowIdx] = newDriverPkgRow;

        // Update state
        setDriverRows(newDriverRows);
        setDriverPackageCountRows(newDriverPkgRows);

        // Save to DB
        await saveDriverRowsToDb(newDriverRows, newDriverPkgRows);
        return true;
    };

    const saveDriverRowsToDb = async (newDriverRows: any[][], newDriverPkgRows: any[][], newAssignments?: { [rowIdx: number]: number }) => {
        if (!report || !report.data) return;

        const newData = {
            ...report.data,
            driverRows: newDriverRows,
            driverPackageCountRows: newDriverPkgRows,
            driverAssignments: newAssignments || driverAssignments
        };

        const res = await updateReportData(id, newData);
        if (res.success) {
            setReport({ ...report, data: newData });
        }
    };


    const formatCell = (value: any, colIndex: number) => {
        if (value === null || value === undefined) return '';

        // Check specifically for our custom breakdown object structure
        if (typeof value === 'object' && value !== null && ('weight' in value || 'otherUnits' in value)) {
            // For the Driver Row "Weight" Column (Total), we now handle the display inside the TABLE CELL renderer directly (where we have access to package data).
            // Therefore, formatCell should return null or a simple placeholder if it's called for rendering assignment value (e.g. in EditableCell).
            // Actually, EditableCell uses THIS for the value prop.
            // If we want to hide the standard text rendering because we are doing custom rendering below, we can return null.
            // BUT, EditableCell renders 'value' prop.
            // Let's modify the TABLE structure to NOT use EditableCell for the driver summary column, or make EditableCell smarter.
            // Better: Return nothing here, and handle FULL rendering in the cell loop.
            return null;
        }

        if (typeof value === 'number') {
            if (colIndex === 1) return `${value.toFixed(2)} kg`;

            return Number.isInteger(value) ? value : value.toFixed(2);
        }
        return value;
    };

    const getColumnWidth = (index: number) => {
        if (columnWidths[index]) return columnWidths[index];
        if (index === 0) return 200; // Client default
        if (index === 1) return 100; // Weight default
        return 150; // Product default
    };

    const getStickyLeft = (index: number) => {
        if (index === 0) return 0;
        if (index === 1) return getColumnWidth(0);
        return undefined;
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-xl font-bold">Report not found</h2>
                <Button asChild className="mt-4">
                    <Link href="/466ed1254c89ccf77b8dab3da30f8692/reports">Back to Reports</Link>
                </Button>
            </div>
        );
    }

    const reportData = report.data;

    return (
        <div className="space-y-6">
            <div className="mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" asChild>
                        <Link href="/466ed1254c89ccf77b8dab3da30f8692/reports">
                            <ArrowLeft size={16} />
                        </Link>
                    </Button>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">{report.name}</h2>
                        <p className="text-zinc-500">
                            Редагування звіту (зміни зберігаються автоматично)
                        </p>
                    </div>
                    <div className="flex gap-2">

                        <Button variant="outline" onClick={handleDuplicateReport} disabled={isDuplicating}>
                            {isDuplicating ? (
                                <>
                                    <Loader2 size={16} className="mr-2 animate-spin" />
                                    Копіювання...
                                </>
                            ) : (
                                <>
                                    <Files size={16} className="mr-2" />
                                    Дублювати звіт
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {/* Summary Cards Removed per user request */}

            <Card className="border-none shadow-2xl bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden ring-1 ring-zinc-200 dark:ring-zinc-800">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 py-5 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                        <FileBarChart2 size={16} />
                        Таблиця агрегації
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0 relative overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm table-fixed">
                        <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0 z-30 shadow-sm">
                            <tr>
                                {reportData.headers.map((header: string, idx: number) => {
                                    const width = getColumnWidth(idx);
                                    const left = getStickyLeft(idx);
                                    const meta = reportData.headerMetadata ? reportData.headerMetadata[idx] : null;

                                    return (
                                        <th key={idx}
                                            style={{
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                left: left !== undefined ? `${left}px` : undefined
                                            }}
                                            className={cn(
                                                "px-4 py-4 text-xs font-bold text-zinc-500 dark:text-zinc-400 border-b border-r border-zinc-200/60 dark:border-zinc-700 whitespace-nowrap relative group uppercase tracking-wider",
                                                idx < 2 && "sticky z-40 bg-zinc-100 dark:bg-zinc-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                header === 'Вага' && "bg-blue-50/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                            )}
                                            onMouseEnter={(e) => {
                                                if (meta) {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setHoveredHeader({ meta, rect });
                                                }
                                            }}
                                            onMouseLeave={() => setHoveredHeader(null)}>
                                            <div className="truncate cursor-help decoration-dotted underline underline-offset-4 decoration-zinc-300">
                                                {header.split(' [ID:')[0]}
                                            </div>

                                            {/* Custom Tooltip on Hover */}
                                            {meta && (
                                                <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-left font-normal flex flex-col gap-2 pointer-events-none">
                                                    <div className="font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-1 mb-1">
                                                        {meta.name}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                                                        <span>Unit:</span>
                                                        <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{meta.unit}</span>

                                                        {meta.netWeight > 0 && (
                                                            <>
                                                                <span>Weight (kg):</span>
                                                                <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{meta.netWeight}</span>
                                                            </>
                                                        )}

                                                        {meta.unitPerCardboard > 0 && (
                                                            <>
                                                                <span>In package:</span>
                                                                <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{meta.unitPerCardboard} {meta.unit}</span>
                                                            </>
                                                        )}

                                                        {meta.agregationResult && (
                                                            <>
                                                                <span>Aggregation:</span>
                                                                <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{meta.agregationResult === 'weight' ? 'Weight' : 'Pieces'}</span>
                                                            </>
                                                        )}

                                                        <div className="col-span-2 pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                                                            ID: {meta.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Resize Handle */}
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 group-hover:bg-zinc-300 dark:group-hover:bg-zinc-600 transition-colors z-40"
                                                onMouseDown={(e) => handleResizeStart(e, idx)}
                                            />
                                        </th>
                                    );
                                })}
                                {/* Actions Column */}
                                <th className="px-4 py-4 font-bold text-center text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-700 whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 sticky right-0 z-40 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]" style={{ width: '150px', minWidth: '150px' }}>
                                    Водій / Дії
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {reportData.rows.map((row: any[], rowIdx: number) => {
                                const invoices = (report.invoices as any) || {};
                                const invoiceData = invoices[rowIdx];

                                return (
                                    <tr key={rowIdx} className="hover:bg-blue-50/30 dark:hover:bg-zinc-800/50 transition-colors group/row">
                                        {row.map((cell: any, colIdx: number) => {
                                            const header = reportData.headers[colIdx];
                                            const isEditable = header !== 'Клієнт' && header !== 'Вага';
                                            const width = getColumnWidth(colIdx);
                                            const left = getStickyLeft(colIdx);
                                            const meta = reportData.headerMetadata?.[colIdx];

                                            return (
                                                <td key={colIdx}
                                                    style={{
                                                        width: `${width}px`,
                                                        minWidth: `${width}px`,
                                                        maxWidth: `${width}px`,
                                                        left: left !== undefined ? `${left}px` : undefined
                                                    }}
                                                    className={cn(
                                                        "px-2 py-3.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-b border-r border-zinc-100 dark:border-zinc-800/50 overflow-hidden",
                                                        colIdx < 2 && "sticky z-20 bg-white dark:bg-zinc-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                        header === 'Вага' && "font-medium bg-blue-50/30 dark:bg-blue-900/10 px-4 text-blue-900 dark:text-blue-100"
                                                    )}>
                                                    {isEditable ? (
                                                        <div className="flex flex-col relative group/cell">
                                                            <div className="flex items-center">
                                                                <EditableCell
                                                                    value={cell}
                                                                    onUpdate={(newVal) => handleCellUpdate(rowIdx, colIdx, newVal)}
                                                                    unit={meta?.unit}
                                                                />
                                                                {(() => {
                                                                    const val = Number(cell) || 0;
                                                                    if (val > 0 && meta) {
                                                                        const rawUnit = String(meta.unit || '').trim().toLowerCase();
                                                                        const isService = ['godz', 'h', 'min', 'm', 'usł', 'srv', 'km'].includes(rawUnit);
                                                                        const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);
                                                                        const hasNetWeight = meta.netWeight > 0;

                                                                        // Check package count
                                                                        const pkgData = reportData.packageCountRows?.[rowIdx]?.[colIdx];
                                                                        const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);

                                                                        // Case 1: Service or Piece without weight AND NO Packages -> Not included
                                                                        const notIncluded = (isService || (!isWeight && !hasNetWeight)) && pkgCount <= 0;

                                                                        // Case 2: Piece without weight BUT Has Packages -> Included as 1kg/pkg
                                                                        const calculatedAsPkg = !isService && !isWeight && !hasNetWeight && pkgCount > 0;

                                                                        if (notIncluded) {
                                                                            return (
                                                                                <TooltipProvider>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <div className="absolute top-0 right-0 p-0.5 cursor-help">
                                                                                                <AlertTriangle size={12} className="text-amber-500" />
                                                                                            </div>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent side="top">
                                                                                            <p className="text-xs">
                                                                                                Увага: Цей товар не враховується в загальну вагу замовлення,<br />
                                                                                                оскільки вага не вказана у Fakturownia, а пакування = 0.
                                                                                            </p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        }

                                                                        // calculatedAsPkg case is now handled by the badge below, so no icon needed here.
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            {(() => {
                                                                const pkgData = reportData.packageCountRows?.[rowIdx]?.[colIdx];
                                                                const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                                                const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                                                                if (count > 0) {
                                                                    const rawUnit = String(meta?.unit || '').trim().toLowerCase();
                                                                    const isKg = ['kg', 'кг'].includes(rawUnit);
                                                                    const isG = ['g', 'г'].includes(rawUnit);
                                                                    const isWeight = isKg || isG;

                                                                    let weightInKg = 0;
                                                                    if (isKg) {
                                                                        weightInKg = Number(cell) || 0;
                                                                    } else if (isG) {
                                                                        weightInKg = (Number(cell) || 0) / 1000;
                                                                    } else {
                                                                        // Non-weight items: 1 pkg = 1 kg
                                                                        weightInKg = count;
                                                                    }

                                                                    return (
                                                                        <div className="mt-0.5">
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700">
                                                                                {Number(count).toFixed(1)} {type}
                                                                                <span className="text-blue-600 dark:text-blue-400 ml-0.5 font-semibold">
                                                                                    ({weightInKg.toFixed(2)} kg)
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 truncate flex flex-col tabular-nums" title={typeof cell === 'string' || typeof cell === 'number' ? String(cell) : ''}>
                                                            <span className={cn(header === 'Вага' && "font-bold", colIdx === 0 && "font-semibold")}>
                                                                {formatCell(cell, colIdx)}
                                                            </span>
                                                            {colIdx === 0 && reportData.clientEmails?.[rowIdx] && (
                                                                <span className="text-[10px] text-zinc-400 font-normal mt-0.5">
                                                                    {reportData.clientEmails[rowIdx]}
                                                                </span>
                                                            )}

                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {/* Actions Column */}
                                        {/* Actions Column */}

                                        <td className="px-2 py-3.5 text-center border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]" style={{ width: '150px', minWidth: '150px' }}>
                                            <div className="flex items-center justify-between gap-2">
                                                {/* Driver Select */}
                                                <div className="flex-1 min-w-[80px]">
                                                    <Select
                                                        value={driverAssignments[rowIdx] !== undefined ? String(driverAssignments[rowIdx]) : "unassigned"}
                                                        onValueChange={(val) => handleAssignDriver(rowIdx, val)}
                                                    >
                                                        <SelectTrigger className="h-7 text-xs px-2 py-0 border-zinc-200 bg-zinc-50/50">
                                                            <SelectValue placeholder="No Driver" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="unassigned" className="text-zinc-400 italic">No Driver</SelectItem>
                                                            {driverRows.map((dRow, dIdx) => (
                                                                <SelectItem key={dIdx} value={String(dIdx)}>
                                                                    {dRow[0]}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {invoiceData && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="w-7 h-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                            asChild
                                                            title={`Фактура: ${invoiceData.invoiceNumber}`}
                                                        >
                                                            <a href={invoiceData.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                                                <FileCheck size={14} />
                                                            </a>
                                                        </Button>
                                                    )}

                                                    {!invoiceData && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="w-7 h-7 text-zinc-400 hover:text-zinc-900"
                                                            onClick={() => handleCreateInvoice(rowIdx, false)}
                                                            disabled={creatingInvoice[rowIdx]}
                                                            title="Виставити фактуру"
                                                        >
                                                            {creatingInvoice[rowIdx] ? (
                                                                <Loader2 size={14} className="animate-spin" />
                                                            ) : (
                                                                <FileText size={14} />
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                        {/* Order Footer - Rendered as tbody rows, not sticky */}
                        <tbody className="bg-zinc-100 dark:bg-zinc-800 font-bold border-t-2 border-zinc-200 dark:border-zinc-700">
                            {/* Row 1: Value Totals */}
                            <tr>
                                {reportData.footer.map((cell: any, idx: number) => {
                                    const width = getColumnWidth(idx);
                                    const left = getStickyLeft(idx);

                                    return (
                                        <td key={idx}
                                            style={{
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                left: left !== undefined ? `${left}px` : undefined
                                            }}
                                            className={cn(
                                                "px-4 py-4 text-zinc-900 dark:text-zinc-100 whitespace-nowrap border-r border-zinc-200/50 dark:border-zinc-700 overflow-hidden font-bold bg-zinc-50/50 dark:bg-zinc-800/50",
                                                idx < 2 && "sticky z-20 bg-zinc-50 dark:bg-zinc-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                idx === 1 && "text-blue-700 dark:text-blue-300",
                                            )}>
                                            <div className="flex flex-col tabular-nums">
                                                {/* If index 0, show "TOTAL (вага)" instead of standard client text */}
                                                {idx === 0 ? (
                                                    <span className="font-bold text-zinc-600 dark:text-zinc-400">TOTAL (вага)</span>
                                                ) : (
                                                    <div className="flex items-baseline gap-1">
                                                        {(() => {
                                                            const meta = reportData.headerMetadata?.[idx];
                                                            const unit = String(meta?.unit || '').trim().toLowerCase();
                                                            const isWeight = ['kg', 'кг', 'g', 'г'].includes(unit);

                                                            // If weight column, show the normal sum (cell value)
                                                            if (idx === 1 || isWeight) {
                                                                return Number(cell) !== 0 ? (
                                                                    <>
                                                                        <span>{formatCell(cell, idx)}</span>
                                                                        {idx > 1 && meta?.unit && (
                                                                            <span className="text-[10px] text-zinc-500 font-normal select-none">{meta.unit}</span>
                                                                        )}
                                                                    </>
                                                                ) : null;
                                                            }

                                                            // If non-weight (e.g. stz), check package count to derive weight (1 pkg = 1 kg)
                                                            // We do NOT show the 'stz' sum here anymore.
                                                            const pkgData = reportData.packageCountFooter?.[idx];
                                                            const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);

                                                            if (pkgCount > 0) {
                                                                return (
                                                                    <>
                                                                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                                            {pkgCount.toFixed(2)}
                                                                        </span>
                                                                        <span className="text-[10px] text-zinc-400 font-normal select-none">kg</span>
                                                                    </>
                                                                );
                                                            }

                                                            return null;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 sticky right-0 z-20" style={{ width: '100px', minWidth: '100px' }}></td>
                            </tr>

                            {/* Row 2: Package Counts */}
                            <tr className="border-t border-zinc-200 dark:border-zinc-700">
                                {reportData.footer.map((_: any, idx: number) => {
                                    const width = getColumnWidth(idx);
                                    const left = getStickyLeft(idx);

                                    let content = null;
                                    if (idx === 0) {
                                        content = <span className="font-bold text-zinc-600 dark:text-zinc-400">TOTAL (пак.)</span>;
                                    } else if (idx !== 1) {
                                        const pkgData = reportData.packageCountFooter?.[idx];
                                        const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                        const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                                        if (count > 0) {
                                            content = (
                                                <div className="flex items-baseline gap-1 tabular-nums">
                                                    <span>{Number(count).toFixed(1)}</span>
                                                    <span className="text-[10px] text-zinc-500 font-normal select-none">{type}</span>
                                                </div>
                                            );
                                        }
                                    }

                                    return (
                                        <td key={idx}
                                            style={{
                                                width: `${width}px`,
                                                minWidth: `${width}px`,
                                                maxWidth: `${width}px`,
                                                left: left !== undefined ? `${left}px` : undefined
                                            }}
                                            className={cn(
                                                "px-4 py-3 text-zinc-900 dark:text-zinc-100 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700 overflow-hidden font-bold",
                                                idx < 2 && "sticky z-20 bg-zinc-100 dark:bg-zinc-800",
                                                idx === 1 && "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] clip-right",
                                            )}>
                                            {content}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 sticky right-0 z-20" style={{ width: '100px', minWidth: '100px' }}></td>
                            </tr>
                        </tbody>

                        {/* Driver Rows Section - Appended to Main Table */}
                        {driverRows.length > 0 && (
                            <tbody className="border-t-4 border-double border-blue-200 dark:border-blue-800">
                                {/* Logistics Header */}
                                <tr className="bg-slate-800 dark:bg-slate-900 shadow-md relative z-20">
                                    <td
                                        colSpan={reportData.headers.length + 1}
                                        className="px-4 py-3 text-sm font-bold text-white uppercase tracking-wider sticky left-0 top-[45px] z-20 shadow-md"
                                    >
                                        <div className="flex items-center justify-between w-full pr-4">
                                            <div className="flex items-center gap-2">
                                                <Truck size={16} className="text-blue-400" />
                                                <span className="text-blue-100">Логістика / Водії</span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-[10px] bg-slate-700 hover:bg-slate-600 border-slate-600 text-blue-100 uppercase font-bold tracking-wider transition-colors"
                                                onClick={handleCopyAllDrivers}
                                            >
                                                <Copy size={12} className="mr-1.5" />
                                                Копіювати всіх
                                            </Button>
                                        </div>
                                    </td>
                                </tr>

                                {driverRows.map((row, rowIdx) => (
                                    <tr key={`driver-${rowIdx}`} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800 last:border-0 border-l-[3px] border-l-blue-500 bg-blue-50/10">
                                        {/* Driver Name Cell (Editable) */}
                                        <td className="px-0 py-0 border-r border-zinc-100 dark:border-zinc-800 sticky left-0 z-20 bg-white dark:bg-zinc-900 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800" style={{ width: '150px', minWidth: '150px' }}>
                                            <div className="flex items-center gap-1 pr-2">
                                                <div className="flex-1">
                                                    <EditableCell
                                                        value={row[0]}
                                                        onUpdate={(newVal) => handleDriverCellUpdate(rowIdx, 0, newVal)}
                                                    />
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-6 h-6 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                                    onClick={() => handleCopyDriverVertical(rowIdx)}
                                                    title="Копіювати вертикально"
                                                >
                                                    <Copy size={12} />
                                                </Button>
                                            </div>
                                        </td>

                                        {/* Data Cells */}
                                        {row.map((cell, colIdx) => {
                                            if (colIdx === 0) return null; // Skip name cell handled above

                                            const meta = reportData.headerMetadata?.[colIdx]; // Changed from 'report' to 'reportData'
                                            const header = meta?.name || '';

                                            return (
                                                <td
                                                    key={`${rowIdx}-${colIdx}`}
                                                    className={cn(
                                                        "px-0 py-0 border-r border-zinc-100 dark:border-zinc-800 text-xs transition-colors",
                                                        header === 'Вага' && "font-medium bg-blue-50/30 dark:bg-blue-900/10 px-4 text-blue-800 dark:text-blue-200"
                                                    )}>
                                                    <div className="flex flex-col relative group/cell min-h-[40px] justify-center">
                                                        {/* Main Cell Value (with logic to hide if complex object handling breakdown) */}
                                                        {(() => {
                                                            // For the total column (index 1), if it has complex data (packagesByUnit),
                                                            // we might want to hide the standard value because we render it all in the breakdown below.
                                                            // However, checking 'cell' structure here.
                                                            // Based on previous logic, we simply render null here if it's the complex object column, 
                                                            // and let the package breakdown handle it all.
                                                            if (colIdx === 1 && typeof cell === 'object' && cell !== null && ('weight' in cell || 'otherUnits' in cell)) {
                                                                return null;
                                                            }

                                                            return (
                                                                <div className="flex items-center">
                                                                    <EditableCell
                                                                        value={colIdx === 1 && typeof cell !== 'object' ? cell : formatCell(cell, colIdx)}
                                                                        onUpdate={(newVal) => handleDriverCellUpdate(rowIdx, colIdx, newVal)}
                                                                        unit={meta?.unit}
                                                                        readOnly={true}
                                                                    />
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Package Breakdown or Count */}
                                                        {(() => {
                                                            const pkgData = driverPackageCountRows?.[rowIdx]?.[colIdx];

                                                            // Special handling for Driver Total Column (Breakdown)
                                                            if (colIdx === 1 && typeof pkgData === 'object' && pkgData?.packagesByUnit) {
                                                                const valueCell = row[1];
                                                                const unitsToDisplay = new Set<string>();

                                                                // Only show 'kg' (Total Weight). All packages are now aggregated under 'kg'.
                                                                // We ignore 'otherUnits' entirely for the Total column.
                                                                if (valueCell?.weight > 0 || pkgData.packagesByUnit?.['kg']) {
                                                                    unitsToDisplay.add('kg');
                                                                }

                                                                const sortedUnits = Array.from(unitsToDisplay); // No sort needed, just 'kg' 

                                                                return (
                                                                    <div className="flex flex-col gap-2 mt-1 px-2 pb-2">
                                                                        {sortedUnits.map(unit => {
                                                                            const isKg = unit === 'kg';
                                                                            // Always 'kg' now, but keeping structure if we ever reverb
                                                                            let quantity = valueCell?.weight || 0;

                                                                            const packages = pkgData.packagesByUnit?.[unit] || {};
                                                                            const hasPackages = Object.keys(packages).length > 0;

                                                                            if (quantity === 0 && !hasPackages) return null;

                                                                            return (
                                                                                <div key={unit} className="flex flex-col gap-0.5 border-l-2 border-blue-200 pl-1.5">
                                                                                    <div className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                                                                                        {isKg ? `${quantity.toFixed(2)} kg` : `${quantity.toFixed(1)} ${unit}`}
                                                                                    </div>

                                                                                    {hasPackages && (
                                                                                        <div className="flex flex-wrap gap-1">
                                                                                            {Object.entries(packages).map(([type, count]) => (
                                                                                                <div key={`${unit}-${type}`} className="px-1.5 py-0.5 text-[9px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                                                                                    {Number(count).toFixed(1)} {type}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                );
                                                            }

                                                            // Standard Package Rendering for other columns
                                                            const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                                            const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                                                            if (count > 0) {
                                                                const unit = meta?.unit?.toLowerCase().trim();
                                                                const isKg = ['kg', 'кг'].includes(unit || '');
                                                                const isG = ['g', 'г'].includes(unit || '');

                                                                let weightInKg = 0;
                                                                if (isKg) {
                                                                    weightInKg = Number(cell) || 0;
                                                                } else if (isG) {
                                                                    weightInKg = (Number(cell) || 0) / 1000;
                                                                } else {
                                                                    // Non-weight: 1 pkg = 1 kg
                                                                    weightInKg = count;
                                                                }

                                                                return (
                                                                    <div className="px-2 py-0.5 text-[10px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 rounded w-fit mt-1 ml-2 mb-1 border border-zinc-200/50 dark:border-zinc-700">
                                                                        {Number(count).toFixed(1)} {type} <span className="text-blue-600 dark:text-blue-400 font-semibold ml-0.5">({weightInKg.toFixed(2)} kg)</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        {/* Remove Button */}
                                        <td className="px-2 py-3 text-center border-l border-blue-100 dark:border-blue-800 bg-white dark:bg-zinc-900 sticky right-0 z-10" style={{ width: '100px', minWidth: '100px' }}>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleRemoveDriver(rowIdx)}
                                                className="w-8 h-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Видалити водія"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        )}
                    </table>
                </CardContent>
            </Card >

            <div className="flex justify-end mt-4">
                <Button onClick={handleAddDriver} variant="outline" className="gap-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                    <Plus size={16} />
                    Додати водія
                </Button>
            </div>
            {/* Portal-like Tooltip Rendered at Root Level to avoid Overflow Clipping */}
            {
                hoveredHeader && (
                    <div
                        className="fixed z-[100] w-64 p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 text-left font-normal flex flex-col gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            left: `${Math.min(hoveredHeader.rect.left, window.innerWidth - 270)}px`, // Prevent overflow right
                            top: `${hoveredHeader.rect.bottom + 4}px`
                        }}
                    >
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-1 mb-1">
                            {hoveredHeader.meta.name}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>Unit:</span>
                            <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{hoveredHeader.meta.unit}</span>

                            {hoveredHeader.meta.pricePerUnit > 0 && (
                                <>
                                    <span>Price per unit:</span>
                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right font-bold text-emerald-600 dark:text-emerald-400">
                                        {hoveredHeader.meta.pricePerUnit} {hoveredHeader.meta.currency || 'EUR'}
                                    </span>
                                </>
                            )}

                            {hoveredHeader.meta.netWeight > 0 && (
                                <>
                                    <span>In package:</span>
                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">{hoveredHeader.meta.netWeight} kg</span>
                                </>
                            )}

                            {/* Show unitPerCardboard if unit is not kg/g */}
                            {hoveredHeader.meta.unit && !['kg', 'кг', 'g', 'г'].includes(hoveredHeader.meta.unit.toLowerCase()) && hoveredHeader.meta.unitPerCardboard > 0 && (
                                <>
                                    <span>In package:</span>
                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right">
                                        {hoveredHeader.meta.unitPerCardboard} {hoveredHeader.meta.unit}
                                    </span>
                                </>
                            )}

                            {/* Show packaging from additionalInfo */}
                            {hoveredHeader.meta.additionalInfo && (
                                <>
                                    <span>Packaging:</span>
                                    <span className="text-zinc-900 dark:text-zinc-200 font-medium text-right truncate" title={hoveredHeader.meta.additionalInfo}>
                                        {hoveredHeader.meta.additionalInfo}
                                    </span>
                                </>
                            )}

                            <div className="col-span-2 pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                                ID: {hoveredHeader.meta.id}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
