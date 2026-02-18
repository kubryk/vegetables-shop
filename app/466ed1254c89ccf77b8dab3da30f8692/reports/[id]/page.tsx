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
    Truck
} from "lucide-react";
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
    value: string | number,
    onUpdate: (newValue: string) => Promise<boolean>,
    unit?: string,
    readOnly?: boolean
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [localValue, setLocalValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLocalValue(value);
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
            setLocalValue(value);
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
            onClick={() => !readOnly && setIsEditing(true)}
            className={cn(
                "p-2 min-h-[30px] rounded transition-colors truncate tabular-nums",
                !readOnly && "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800",
                readOnly && "bg-gray-50/50 dark:bg-zinc-800/50 text-gray-500 cursor-default",
                (value === '' || value === null) && "text-gray-300 italic"
            )}
            title={String(value)}
        >
            <div className="flex items-baseline gap-1">
                {(value === '' || value === null) ? 'Empty' : value}
                {unit && <span className="text-[10px] text-zinc-400 font-normal select-none">{unit}</span>}
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

    const handleCopyTable = async () => {
        if (!report || !report.data) return;

        const reportData = report.data as any;

        try {
            // Format data as TSV (Tab-Separated Values) for Excel/Sheets
            const headers = reportData.headers.map((h: string) => h.split(' [ID:')[0]).join('\t');
            const rows = reportData.rows.map((row: any[]) => row.join('\t')).join('\n');
            const footer = reportData.footer.join('\t');

            const tsvData = `${headers}\n${rows}\n${footer}`;

            await navigator.clipboard.writeText(tsvData);
            toast.success('Таблицю скопійовано в буфер обміну!');
        } catch (error) {
            toast.error('Не вдалося скопіювати таблицю');
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

        // 2. Recalculate Row Total (Index 1 is 'Вага', Products start at Index 2)
        if (isNumberCol && headerIdx >= 2) {
            let rowTotal = 0;
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
                }
            }
            newRow[1] = rowTotal;
        }

        // 3. Recalculate Footer for Modified Column
        if (isNumberCol) {
            let colTotal = 0;
            for (let r = 0; r < newRows.length; r++) {
                colTotal += Number(newRows[r][headerIdx]) || 0;
            }
            newFooter[headerIdx] = colTotal;
        }

        // 4. Recalculate Footer for Grand Total (Index 1)
        if (isNumberCol && headerIdx >= 1) {
            let totalWeight = 0;
            for (let r = 0; r < newRows.length; r++) {
                totalWeight += Number(newRows[r][1]) || 0; // Sum up the row totals
            }
            newFooter[1] = totalWeight;
        }

        newData.rows = newRows;
        newData.footer = newFooter;

        // 5. Recalculate Package Counts
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
                    console.log(`[PKG CLIENT]   -> Looking for original items, orderMeta exists:`, !!orderMeta);
                    if (orderMeta?.originalItems) {
                        console.log(`[PKG CLIENT]   -> All original items:`, (orderMeta.originalItems as any[]).map((item: any) => ({
                            name: item.name,
                            productId: item.productId,
                            productIdType: typeof item.productId
                        })));
                        const header = newData.headers[headerIdx];
                        const idMatch = header.match(/\[ID:(\d+)\]/);
                        const productId = idMatch ? idMatch[1] : null;
                        console.log(`[PKG CLIENT]   -> ProductId from header: ${productId} (type: ${typeof productId})`);
                        if (productId) {
                            const originalItem = (orderMeta.originalItems as any[]).find(
                                (item: any) => String(item.productId) === productId
                            );
                            console.log(`[PKG CLIENT]   -> Found original item:`, originalItem ? {
                                name: originalItem.name,
                                quantity: originalItem.quantity,
                                packageCount: originalItem.packageCount,
                                packageType: originalItem.packageType
                            } : 'NOT FOUND');
                            if (originalItem) {
                                const origQty = Number(originalItem.quantity) || 0;
                                const origPkgCount = Number(originalItem.packageCount) || 0;
                                if (origQty > 0 && origPkgCount > 0) {
                                    const ratio = origPkgCount / origQty;
                                    newPkgCount = weightOrQty * ratio;
                                    foundFromOriginal = true;
                                    console.log(`[PKG CLIENT]   -> Using original ratio: ${origPkgCount}/${origQty} = ${ratio}, newPkgCount=${newPkgCount}`);
                                }
                            }
                        }
                    }

                    if (!foundFromOriginal) {
                        // Try to parse from meta.additionalInfo (e.g., "3 ggg" means 3 packages)
                        if (meta.additionalInfo) {
                            const match = meta.additionalInfo.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
                            if (match) {
                                const pkgCountFromMeta = parseFloat(match[1]);
                                console.log(`[PKG CLIENT]   -> Found packageCount in meta.additionalInfo: ${pkgCountFromMeta}, unitPerCardboard=${meta.unitPerCardboard}`);

                                // If we have unitPerCardboard, calculate ratio
                                // For KG products, we check if netWeight is available to calculate ratio (packages per kg)
                                // e.g. 10kg corresponds to 2 cartons -> ratio = 2 / 10 = 0.2 cartons/kg
                                if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                                    if (meta.netWeight > 0 && pkgCountFromMeta > 0) {
                                        const ratio = pkgCountFromMeta / meta.netWeight;
                                        newPkgCount = weightOrQty * ratio;
                                        foundFromOriginal = true;
                                        console.log(`[PKG CLIENT]   -> Using meta KG ratio: ${pkgCountFromMeta}/${meta.netWeight} = ${ratio}, newPkgCount=${newPkgCount}`);
                                    } else {
                                        // Fallback if no netWeight: maybe simple division if pkgCount is meant as weight?
                                        // But user says "10kg -> 2 kart", so likely ratio.
                                        // If no netWeight, we can't determine ratio. Default to 0?
                                        // Or maybe pkgCountFromMeta IS the default pack count for 1 unit? Unlikely for KG.
                                        console.log(`[PKG CLIENT]   -> Cannot calculate KG ratio without netWeight. meta.netWeight=${meta.netWeight}`);
                                    }
                                } else {
                                    // For piecewise products
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
                        // Fallback to metadata-based calculation
                        console.log(`[PKG CLIENT]   -> Using fallback calculation, unit=${meta.unit}, netWeight=${meta.netWeight}, unitPerCardboard=${meta.unitPerCardboard}`);
                        if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                            if (meta.netWeight > 0) newPkgCount = weightOrQty / meta.netWeight;
                        } else {
                            if (meta.unitPerCardboard > 0) newPkgCount = weightOrQty / meta.unitPerCardboard;
                        }
                        console.log(`[PKG CLIENT]   -> Fallback result: newPkgCount=${newPkgCount}`);
                    }
                }

                // Determine packageType:
                // 1. Try to preserve from original data
                const originalData = report.data.packageCountRows?.[rowIdx]?.[headerIdx];
                let existingType = (typeof originalData === 'object' && originalData !== null) ? originalData.packageType : null;

                // 2. If no existing type, try original order items
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

                // 3. If still no type, parse from product metadata
                if (!existingType || existingType === 'kart') {
                    // meta.additionalInfo might be like "5 wor" or "3 kart"
                    if (meta.additionalInfo) {
                        const match = meta.additionalInfo.match(/^\d+(?:\.\d+)?\s*(.+)/);
                        if (match && match[1]) {
                            existingType = match[1].trim();
                        }
                    }
                }

                // 4. Final fallback
                if (!existingType) {
                    existingType = 'kart';
                }

                newPkgRow[headerIdx] = { count: newPkgCount, packageType: existingType };

                // Recalculate Row Total Pkg Count (Index 1)
                let rowPkgTotal = 0;
                for (let i = 2; i < newPkgRow.length; i++) {
                    const cell = newPkgRow[i];
                    const count = typeof cell === 'object' && cell !== null ? cell.count : (Number(cell) || 0);
                    rowPkgTotal += count;
                }
                newPkgRow[1] = rowPkgTotal;

                newPackageCountRows[rowIdx] = newPkgRow;
                newData.packageCountRows = newPackageCountRows;

                // Also update packageCountFooter
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

                        // Prefer non-'kart' types (same logic as server-side)
                        if (count > 0 && (colPackageType === 'kart' && type !== 'kart')) {
                            colPackageType = type;
                        }
                    }

                    // Store as object with count and type (matching server format)
                    if (colPkgTotal > 0) {
                        newPkgFooter[headerIdx] = { count: colPkgTotal, packageType: colPackageType };
                    } else {
                        newPkgFooter[headerIdx] = colPkgTotal; // Keep as 0 number
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
        saveDriverRowsToDb([...driverRows, newDriverRow], [...driverPackageCountRows, newDriverPkgRow]);
    };

    const handleRemoveDriver = (rowIdx: number) => {
        const newDriverRows = driverRows.filter((_, idx) => idx !== rowIdx);
        const newDriverPkgRows = driverPackageCountRows.filter((_, idx) => idx !== rowIdx);

        setDriverRows(newDriverRows);
        setDriverPackageCountRows(newDriverPkgRows);

        // Save to DB
        saveDriverRowsToDb(newDriverRows, newDriverPkgRows);
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

    const saveDriverRowsToDb = async (newDriverRows: any[][], newDriverPkgRows: any[][]) => {
        if (!report || !report.data) return;

        const newData = {
            ...report.data,
            driverRows: newDriverRows,
            driverPackageCountRows: newDriverPkgRows,
        };

        const res = await updateReportData(id, newData);
        if (res.success) {
            setReport({ ...report, data: newData });
        }
    };


    const formatCell = (value: any, colIndex: number) => {
        if (value === null || value === undefined) return '';

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
                        <Button variant="outline" onClick={handleCopyTable}>
                            <Copy size={16} className="mr-2" />
                            Копіювати таблицю
                        </Button>
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
                <CardContent className="p-0 overflow-auto max-h-[calc(100vh-250px)] relative">
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
                                <th className="px-4 py-4 font-bold text-center text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-700 whitespace-nowrap bg-zinc-100 dark:bg-zinc-800 sticky right-0 z-40 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]" style={{ width: '100px', minWidth: '100px' }}>
                                    Дії
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

                                                                        // Warning if it's a service (never has weight) OR if it's a piece without defined weight
                                                                        const showWarning = isService || (!isWeight && !hasNetWeight);

                                                                        if (showWarning) {
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
                                                                                                оскільки вага не вказана у Fakturownia.
                                                                                            </p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            );
                                                                        }
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            {(() => {
                                                                const pkgData = reportData.packageCountRows?.[rowIdx]?.[colIdx];
                                                                const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                                                const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                                                                return count > 0 && (
                                                                    <div className="px-2 text-[10px] text-zinc-400 font-medium">
                                                                        [{Number(count).toFixed(1)} {type}]
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div className="p-2 truncate flex flex-col tabular-nums" title={String(cell)}>
                                                            <span className={cn(header === 'Вага' && "font-bold")}>
                                                                {formatCell(cell, colIdx)}
                                                            </span>

                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {/* Actions Column */}
                                        {/* Actions Column */}
                                        <td className="px-2 py-3.5 text-center border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]" style={{ width: '100px', minWidth: '100px' }}>
                                            <div className="flex items-center justify-center gap-1">
                                                {invoiceData && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="w-8 h-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                                        asChild
                                                        title={`Фактура: ${invoiceData.invoiceNumber}`}
                                                    >
                                                        <a href={invoiceData.invoiceUrl} target="_blank" rel="noopener noreferrer">
                                                            <FileCheck size={16} />
                                                        </a>
                                                    </Button>
                                                )}

                                                {!invoiceData && (
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="w-8 h-8 text-zinc-500 hover:text-zinc-900"
                                                        onClick={() => handleCreateInvoice(rowIdx, false)}
                                                        disabled={creatingInvoice[rowIdx]}
                                                        title="Виставити фактуру"
                                                    >
                                                        {creatingInvoice[rowIdx] ? (
                                                            <Loader2 size={16} className="animate-spin" />
                                                        ) : (
                                                            <FileText size={16} />
                                                        )}
                                                    </Button>
                                                )}
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
                                                ) : (Number(cell) !== 0 && (
                                                    <div className="flex items-baseline gap-1">
                                                        <span>{formatCell(cell, idx)}</span>
                                                        {(() => {
                                                            const meta = reportData.headerMetadata?.[idx];
                                                            return idx > 1 && meta?.unit && (
                                                                <span className="text-[10px] text-zinc-500 font-normal select-none">{meta.unit}</span>
                                                            );
                                                        })()}
                                                    </div>
                                                ))}
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
                                        <div className="flex items-center gap-2">
                                            <Truck size={16} className="text-blue-400" />
                                            <span className="text-blue-100">Логістика / Водії</span>
                                        </div>
                                    </td>
                                </tr>

                                {driverRows.map((row: any[], rowIdx: number) => (
                                    <tr key={`driver-${rowIdx}`} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors bg-white dark:bg-zinc-900 border-b border-blue-100/50 dark:border-blue-900/20 group/driver">
                                        {row.map((cell: any, colIdx: number) => {
                                            const header = reportData.headers[colIdx];
                                            const width = getColumnWidth(colIdx);
                                            const left = getStickyLeft(colIdx);
                                            const meta = reportData.headerMetadata?.[colIdx];
                                            const isEditable = true;

                                            return (
                                                <td key={colIdx}
                                                    style={{
                                                        width: `${width}px`,
                                                        minWidth: `${width}px`,
                                                        maxWidth: `${width}px`,
                                                        left: left !== undefined ? `${left}px` : undefined
                                                    }}
                                                    className={cn(
                                                        "px-2 py-3.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap border-r border-blue-50 dark:border-blue-900/20 overflow-hidden",
                                                        colIdx < 2 && "sticky z-10 bg-white dark:bg-zinc-900 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                        header === 'Вага' && "font-medium bg-blue-50/30 dark:bg-blue-900/10 px-4 text-blue-800 dark:text-blue-200"
                                                    )}>
                                                    <div className="flex flex-col relative group/cell">
                                                        <div className="flex items-center">
                                                            <EditableCell
                                                                value={cell}
                                                                onUpdate={(newVal) => handleDriverCellUpdate(rowIdx, colIdx, newVal)}
                                                                unit={meta?.unit}
                                                                readOnly={header === 'Вага'}
                                                            />
                                                        </div>
                                                        {(() => {
                                                            const pkgData = driverPackageCountRows?.[rowIdx]?.[colIdx];

                                                            // Handle Breakdown for Total Column
                                                            if (colIdx === 1 && typeof pkgData === 'object' && pkgData?.breakdown) {
                                                                return (
                                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                                        {Object.entries(pkgData.breakdown).map(([type, count]) => (
                                                                            <div key={type} className="px-2 text-[10px] text-zinc-500 font-medium bg-zinc-100 dark:bg-zinc-800 rounded w-fit">
                                                                                {Number(count).toFixed(1)} {type}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                );
                                                            }

                                                            const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                                            const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                                                            return count > 0 && (
                                                                <div className="px-2 text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                                                                    [{Number(count).toFixed(1)} {type}]
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            );
                                        })}
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
            </Card>

            <div className="flex justify-end">
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
