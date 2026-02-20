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

const DRIVER_COLORS = [
    { bg: 'bg-blue-50 dark:bg-blue-950', border: 'border-blue-400', text: 'text-blue-900 dark:text-blue-100' },
    { bg: 'bg-emerald-50 dark:bg-emerald-950', border: 'border-emerald-400', text: 'text-emerald-900 dark:text-emerald-100' },
    { bg: 'bg-orange-50 dark:bg-orange-950', border: 'border-orange-400', text: 'text-orange-900 dark:text-orange-100' },
    { bg: 'bg-purple-50 dark:bg-purple-950', border: 'border-purple-400', text: 'text-purple-900 dark:text-purple-100' },
    { bg: 'bg-rose-50 dark:bg-rose-950', border: 'border-rose-400', text: 'text-rose-900 dark:text-rose-100' },
    { bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-400', text: 'text-amber-900 dark:text-amber-100' },
    { bg: 'bg-cyan-50 dark:bg-cyan-950', border: 'border-cyan-400', text: 'text-cyan-900 dark:text-cyan-100' },
    { bg: 'bg-indigo-50 dark:bg-indigo-950', border: 'border-indigo-400', text: 'text-indigo-900 dark:text-indigo-100' },
];

function getDriverColor(index: number | undefined) {
    if (index === undefined || index < 0) return null;
    return DRIVER_COLORS[index % DRIVER_COLORS.length];
}

function extractPackageType(text: string | undefined): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    // Ukrainian/English keywords for packaging
    if (lower.includes('wor') || lower.includes('сак') || lower.includes('міш') || lower.includes('mesh')) return 'wor';
    if (lower.includes('pal') || lower.includes('пал')) return 'pal';
    if (lower.includes('box') || lower.includes('ящ') || lower.includes('box')) return 'box';
    if (lower.includes('kart') || lower.includes('кор')) return 'kart';
    return null;
}

// Simple Editable Cell Component (Reused logic)
const EditableCell = ({ value, onUpdate, unit, readOnly = false, className }: { value: any, onUpdate: (val: string) => Promise<boolean>, unit?: string, readOnly?: boolean, className?: string }) => {
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
                readOnly && "bg-gray-50/50 dark:bg-zinc-800/50 cursor-default",
                (value === '' || value === null) && "text-gray-300 italic",
                className
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
            let qtyUnit = 'kg';

            // Derive package type more robustly (copying logic from cell renderer)
            let derivedPkgType = pkgType;
            if (!derivedPkgType || derivedPkgType === 'kart') {
                derivedPkgType = extractPackageType(meta?.name + " " + (meta?.additionalInfo || "")) || derivedPkgType;
            }
            if (!derivedPkgType || derivedPkgType === 'kart') {
                const u = unit.toLowerCase();
                derivedPkgType = (u !== 'шт' && u !== 'szt') ? unit || 'kart' : 'kart';
            }

            if (isWeight) {
                qtyVal = ['g', 'г'].includes(rawUnit) ? (qty / 1000).toFixed(0) : qty.toFixed(0);
                qtyUnit = 'kg';
            } else {
                // Non-weight items: Show package count
                qtyVal = pkgCount > 0 ? pkgCount.toFixed(1) : qty.toFixed(0);
                // Use the derived package type even if pkgCount is 0, instead of falling back to raw unit
                qtyUnit = pkgCount > 0 ? derivedPkgType : derivedPkgType;
            }

            const cleanHeader = header.split(' [ID:')[0];
            // 3 columns: Product Name [Tab] Value [Tab] Unit/Pkg
            lines.push(`${cleanHeader}\t${qtyVal}\t${qtyUnit}`);
        }

        if (lines.length <= 1) return null; // Only driver name

        // Get total weight (Column 1 is complex object {weight, otherUnits})
        const totalWeightData = row[1];
        const totalWeight = typeof totalWeightData === 'object' && totalWeightData !== null ? (totalWeightData.weight || 0) : (Number(totalWeightData) || 0);

        lines.push(`TOTAL\t${totalWeight.toFixed(0)}\tkg`);

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

    const handleCopyAllOrders = () => {
        if (!report || !report.data) return;

        const reportData = report.data;

        const getColName = (idx: number) => {
            let let1 = Math.floor(idx / 26) - 1;
            let let2 = idx % 26;
            return let1 >= 0 ? String.fromCharCode(65 + let1) + String.fromCharCode(65 + let2) : String.fromCharCode(65 + let2);
        };

        const lastColName = getColName(reportData.headers.length - 1);

        let html = '<table border="1">';

        // 1. Headers
        html += '<tr>';
        const cleanHeaders = reportData.headers.map((h: string) => h.split(' [ID:')[0]);
        for (const h of cleanHeaders) {
            html += `<th>${h}</th>`;
        }
        html += '</tr>';

        // 2. Rows
        for (let rowIdx = 0; rowIdx < reportData.rows.length; rowIdx++) {
            const row = reportData.rows[rowIdx];
            html += '<tr>';

            // Client Name
            html += `<td>${row[0] ? String(row[0]) : ''}</td>`;

            // Total Weight (Index 1)
            const excelRow = rowIdx + 2;
            html += `<td>=SUM(C${excelRow}:${lastColName}${excelRow})</td>`;

            // Products
            for (let i = 2; i < row.length; i++) {
                const qty = Number(row[i]) || 0;
                if (qty === 0) {
                    html += `<td>0</td>`;
                    continue;
                }

                const meta = reportData.headerMetadata?.[i];
                const unit = meta?.unit || '';
                const rawUnit = unit.toLowerCase().trim();
                const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);

                const pkgData = reportData.packageCountRows?.[rowIdx]?.[i];
                const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                const pkgType = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : 'kart';

                // Derive package type
                let derivedPkgType = pkgType;
                if (!derivedPkgType || derivedPkgType === 'kart') {
                    derivedPkgType = extractPackageType(meta?.name + " " + (meta?.additionalInfo || "")) || derivedPkgType;
                }
                if (!derivedPkgType || derivedPkgType === 'kart') {
                    derivedPkgType = (rawUnit !== 'шт' && rawUnit !== 'szt') ? unit || 'kart' : 'kart';
                }

                let displayVal = '';
                let displayUnitCode = '';

                if (isWeight) {
                    const weightInKg = ['g', 'г'].includes(rawUnit) ? qty / 1000 : qty;
                    displayVal = weightInKg.toFixed(0);
                    displayUnitCode = 'kg';
                } else {
                    if (pkgCount > 0) {
                        displayVal = Number.isInteger(pkgCount) ? pkgCount.toFixed(0) : pkgCount.toFixed(1);
                        displayUnitCode = derivedPkgType;
                    } else {
                        displayVal = Number.isInteger(qty) ? qty.toFixed(0) : qty.toFixed(1);
                        displayUnitCode = derivedPkgType;
                    }
                }

                // Apply mso-number-format for custom Excel/Sheets formatting (leaves underlying value purely numeric)
                html += `<td style="mso-number-format:'0 &quot;${displayUnitCode}&quot;';">${displayVal}</td>`;
            }

            html += '</tr>';
        }

        // 3. Footers
        const lastRowExcelIdx = reportData.rows.length + 1;

        // Footer 1: Value Totals
        html += '<tr>';
        html += '<td>TOTAL (вага)</td>';
        html += `<td>=SUM(B2:B${lastRowExcelIdx})</td>`;

        for (let i = 2; i < reportData.footer.length; i++) {
            const colName = getColName(i);
            const cellVal = Number(reportData.footer[i]) || 0;
            if (cellVal === 0) {
                html += '<td>0</td>';
                continue;
            }

            const meta = reportData.headerMetadata?.[i];
            const rawUnit = String(meta?.unit || '').trim().toLowerCase();
            const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);

            if (isWeight) {
                html += `<td>=SUM(${colName}2:${colName}${lastRowExcelIdx})</td>`;
            } else {
                html += '<td>0</td>';
            }
        }
        html += '</tr>';

        // Footer 2: Package Counts Totals
        html += '<tr>';
        html += '<td>TOTAL (пак.)</td>';
        // Grand total pkgs might not be directly at index 1 for typical usage, but just in case, leave blank
        html += '<td>0</td>';

        for (let i = 2; i < reportData.footer.length; i++) {
            const colName = getColName(i);
            const pkgData = reportData.packageCountFooter?.[i];
            const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);

            if (count > 0) {
                html += `<td>=SUM(${colName}2:${colName}${lastRowExcelIdx})</td>`;
            } else {
                html += '<td>0</td>';
            }
        }
        html += '</tr>';
        html += '</table>';

        const blobHtml = new Blob([html], { type: 'text/html' });
        // Fallback for simple paste (e.g. text editors)
        const plainTextFallback = 'Таблиця замовлень (вставте у табличний редактор для кращого результату)';
        const blobPlain = new Blob([plainTextFallback], { type: 'text/plain' });

        const clipboardItem = new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobPlain
        });

        navigator.clipboard.write([clipboardItem]).then(() => {
            toast.success('Таблицю скопійовано');
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
        // 1. Update Cell Value with Inverse Conversion Logic
        const val = isNumberCol ? (Number(newValue) || 0) : newValue;
        let storageVal = val;

        if (isNumberCol && headerIdx >= 2) {
            const meta = newData.headerMetadata?.[headerIdx];
            if (meta) {
                const rawUnit = String(meta.unit || '').trim().toLowerCase();
                const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);

                if (isWeight) {
                    // If original was g/г, we displayed kg (val). Convert back to g.
                    if (['g', 'г'].includes(rawUnit)) {
                        storageVal = Number(val) * 1000;
                    }
                } else {
                    // Non-weight items: We displayed 'packages' if available.
                    // Convert 'packages' (val) back to 'quantity' (storageVal).
                    const currentVal = Number(report.data.rows[rowIdx][headerIdx]) || 0;
                    const currentPkgData = report.data.packageCountRows?.[rowIdx]?.[headerIdx];
                    const currentPkgCount = typeof currentPkgData === 'object' && currentPkgData !== null ? currentPkgData.count : (Number(currentPkgData) || 0);

                    if (currentVal > 0 && currentPkgCount > 0) {
                        storageVal = Number(val) * (currentVal / currentPkgCount);
                    } else if (meta.unitPerCardboard > 0) {
                        storageVal = Number(val) * meta.unitPerCardboard;
                    }
                }
            }
        }

        newRow[headerIdx] = storageVal;
        newRows[rowIdx] = newRow;

        // 2. Recalculate Package Count for the Modified Cell (moved up)
        if (headerIdx >= 2 && newData.packageCountRows) {
            const newPackageCountRows = [...newData.packageCountRows];
            const newPkgRow = [...newPackageCountRows[rowIdx]];
            const meta = newData.headerMetadata?.[headerIdx];

            if (meta) {
                const weightOrQty = Number(storageVal) || 0;
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
                                        // Standard: qty / capacity = packages
                                        newPkgCount = weightOrQty / meta.unitPerCardboard;
                                        foundFromOriginal = true;
                                    } else if (pkgCountFromMeta > 0) {
                                        // Fallback: if no capacity, assume the meta number might be capacity
                                        // E.g. "3 box" -> capacity 3? No, usually "3 box" means 3 boxes for the netWeight.
                                        // But for PIECES, "3 box" is ambiguous.
                                        // Safer to default to 1:1 or use input if we can't determine ratio.
                                        // Avoid multiplying by pkgCountFromMeta blindly.
                                        newPkgCount = weightOrQty;
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
                    } else if (meta.netWeight > 0) {
                        totalWeight += qty * meta.netWeight;
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

        // --- INVERSE CONVERSION LOGIC FOR DRIVERS ---
        let storageVal = val;
        if (isNumberCol && headerIdx >= 2) {
            const meta = report.data.headerMetadata?.[headerIdx];
            if (meta) {
                const rawUnit = String(meta.unit || '').trim().toLowerCase();
                // If original was g/г, we displayed kg (val). Convert back to g.
                if (['g', 'г'].includes(rawUnit)) {
                    storageVal = Number(val) * 1000;
                } else {
                    // Invert package count for drivers too
                    const currentVal = Number(driverRows[rowIdx][headerIdx]) || 0;
                    const currentPkgData = driverPackageCountRows?.[rowIdx]?.[headerIdx];
                    const currentPkgCount = typeof currentPkgData === 'object' && currentPkgData !== null ? currentPkgData.count : (Number(currentPkgData) || 0);

                    if (currentVal > 0 && currentPkgCount > 0) {
                        storageVal = Number(val) * (currentVal / currentPkgCount);
                    } else if (meta.unitPerCardboard > 0) {
                        storageVal = Number(val) * meta.unitPerCardboard;
                    }
                }
            }
        }

        newDriverRow[headerIdx] = storageVal;

        // Recalculate package counts for this driver row first, so we have them for weight total
        const newDriverPkgRows = [...driverPackageCountRows];
        const newDriverPkgRow = [...newDriverPkgRows[rowIdx]];

        if (headerIdx >= 2) {
            const meta = report.data.headerMetadata?.[headerIdx];
            if (meta) {
                // Use the calculated storage value (the real quantity in DB/State) instead of the raw input 'val'
                // This ensures that whether we edited 'kg' or 'boxes', we derive the package count from the standardized quantity.
                const weightOrQty = Number(newDriverRow[headerIdx]) || 0;
                let newPkgCount = 0;

                // Try to infer ratio from previous value to preserve custom packaging logic
                const oldVal = Number(driverRows[rowIdx][headerIdx]) || 0;
                const oldPkgData = driverPackageCountRows?.[rowIdx]?.[headerIdx];
                const oldPkgCount = typeof oldPkgData === 'object' && oldPkgData !== null ? oldPkgData.count : (Number(oldPkgData) || 0);

                if (oldVal > 0 && oldPkgCount > 0) {
                    const ratio = oldPkgCount / oldVal;
                    newPkgCount = weightOrQty * ratio;
                } else {
                    // Try to parse from meta.additionalInfo (e.g., "3 ggg" means 3 packages)
                    let pkgCountFromMeta = 0;
                    if (meta.additionalInfo) {
                        const match = meta.additionalInfo.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
                        if (match) {
                            pkgCountFromMeta = parseFloat(match[1]);
                        }
                    }

                    if (pkgCountFromMeta > 0) {
                        if (['kg', 'кг', 'g', 'г'].includes(meta.unit?.toLowerCase())) {
                            if (meta.netWeight > 0) {
                                const ratio = pkgCountFromMeta / meta.netWeight;
                                newPkgCount = weightOrQty * ratio;
                            }
                        } else {
                            // Non-weight items: pieces/bunches etc.
                            // If additionalInfo says "3 box", and we input 1 piece:
                            // We should check unitPerCardboard.
                            // If unitPerCardboard is 0, we can't really guess ratio unless we assume 1:1 or use the number in meta as capacity?
                            // Actually, if additionalInfo is "3 box", it usually describes the PACKAGING itself or capacity.
                            // But usually `pkgCountFromMeta` IS the capacity if the string is like "12kg / 3box".

                            if (meta.unitPerCardboard > 0) {
                                // Standard: qty / capacity = packages
                                newPkgCount = weightOrQty / meta.unitPerCardboard;
                            } else {
                                // Fallback: if no capacity, maybe 1 to 1? Or just use the input?
                                // Previously it was multiplying, which is wrong if we enter pieces.
                                // Let's default to 1:1 if no better info.
                                newPkgCount = weightOrQty;
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
                }

                // Preserve packageType if present in old data, otherwise default or extract from meta
                let packageType = (typeof oldPkgData === 'object' && oldPkgData?.packageType) ? oldPkgData.packageType : 'kart';
                if (meta.additionalInfo) {
                    const match = meta.additionalInfo.match(/^(\d+(?:\.\d+)?)\s+(.+)/);
                    if (match) packageType = match[2].trim();
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

        // Save the updated package row to the array so the weight loop can use it
        newDriverPkgRows[rowIdx] = newDriverPkgRow;

        // Recalculate weight total if editing product column
        if (isNumberCol && headerIdx >= 2) {
            let rowTotal = 0;
            for (let i = 2; i < newDriverRow.length; i++) {
                const colHeader = report.data.headers[i];
                const qty = Number(newDriverRow[i]) || 0;
                const meta = report.data.headerMetadata?.[i];

                if (meta) {
                    const unit = meta.unit?.toLowerCase();
                    const pkgCell = newDriverPkgRow[i];
                    const pkgCount = typeof pkgCell === 'object' && pkgCell !== null ? pkgCell.count : (Number(pkgCell) || 0);

                    if (['kg', 'кг'].includes(unit)) {
                        rowTotal += qty;
                    } else if (['g', 'г'].includes(unit)) {
                        rowTotal += qty / 1000;
                    } else if (meta.netWeight > 0) {
                        rowTotal += qty * meta.netWeight;
                    } else if (pkgCount > 0) {
                        rowTotal += pkgCount;
                    }
                }
            }
            newDriverRow[1] = rowTotal;
        }

        newDriverRows[rowIdx] = newDriverRow;

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
            if (colIndex === 1) return `${value.toFixed(0)} kg`;

            return Number.isInteger(value) ? value : value.toFixed(0);
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
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 py-5 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                        <FileBarChart2 size={16} />
                        Таблиця агрегації
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-4 text-[10px] bg-blue-600 hover:bg-blue-500 border-none text-white uppercase font-black tracking-widest transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95 m-0"
                        onClick={handleCopyAllOrders}
                    >
                        <Copy size={12} className="mr-2" />
                        Копіювати все
                    </Button>
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
                                                (header === 'Вага' || header.toLowerCase().includes('total') || header.toLowerCase().includes('сума')) && "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-center"
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
                                const assignedDriverIdx = driverAssignments[rowIdx];
                                const dColor = getDriverColor(assignedDriverIdx);

                                return (
                                    <tr key={rowIdx} className={cn(
                                        "transition-colors group/row border-b border-zinc-100 dark:border-zinc-800",
                                        dColor ? `${dColor.bg} border-l-[4px] ${dColor.border}` : "hover:bg-blue-50/30 dark:hover:bg-zinc-800/50"
                                    )}>
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
                                                        "px-2 py-3.5 text-zinc-700 dark:text-zinc-300 whitespace-nowrap border-r border-zinc-100 dark:border-zinc-800/50 overflow-hidden",
                                                        colIdx < 2 && "sticky z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                        colIdx < 2 && (dColor ? dColor.bg : "bg-white dark:bg-zinc-900"),
                                                        (header === 'Вага' || header.toLowerCase().includes('total') || header.toLowerCase().includes('сума')) && (dColor ? "text-center text-blue-600 dark:text-blue-400" : "font-medium bg-blue-50/30 dark:bg-blue-900/10 px-4 text-blue-600 dark:text-blue-400 text-center"),
                                                        (header === 'Вага' || header.toLowerCase().includes('total') || header.toLowerCase().includes('сума')) && dColor && "font-bold px-4 text-center text-blue-600 dark:text-blue-400"
                                                    )}>
                                                    {isEditable ? (
                                                        <div className="flex flex-col relative group/cell">
                                                            {(() => {
                                                                const qty = Number(cell) || 0;
                                                                let displayValue: any = cell;

                                                                const pkgData = reportData.packageCountRows?.[rowIdx]?.[colIdx];
                                                                const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);

                                                                let displayUnit = 'kg';

                                                                if (meta) {
                                                                    const rawUnit = String(meta.unit || '').trim().toLowerCase();
                                                                    const isWeight = ['kg', 'кг', 'g', 'г'].includes(rawUnit);

                                                                    let type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : null;
                                                                    if (!type || type === 'kart') {
                                                                        const orderMeta = reportData.orderMetadata?.[rowIdx];
                                                                        // Try to find derived type from orderMetadata using meta.id
                                                                        if (orderMeta?.originalItems && meta.id) {
                                                                            const originalItem = (orderMeta.originalItems as any[]).find(
                                                                                (item: any) => String(item.productId) === String(meta.id)
                                                                            );
                                                                            if (originalItem?.packageType) {
                                                                                type = originalItem.packageType;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (!type || type === 'kart') {
                                                                        type = extractPackageType(meta.name + " " + (meta.additionalInfo || "")) || type;
                                                                    }
                                                                    if (!type) {
                                                                        const u = (meta.unit || '').toLowerCase();
                                                                        type = (u !== 'шт' && u !== 'szt') ? meta.unit || 'kart' : 'kart';
                                                                    }

                                                                    if (isWeight) {
                                                                        displayValue = ['g', 'г'].includes(rawUnit) ? qty / 1000 : qty;
                                                                        displayUnit = 'kg';
                                                                    } else {
                                                                        // Non-weight items: Show package count
                                                                        if (pkgCount > 0 || qty === 0) {
                                                                            displayValue = pkgCount;
                                                                            displayUnit = type;
                                                                        } else {
                                                                            displayValue = qty;
                                                                            displayUnit = meta.unit || '';
                                                                        }
                                                                    }
                                                                }

                                                                return (
                                                                    <div className={cn("flex items-center", colIdx === 1 && "justify-center")}>
                                                                        <EditableCell
                                                                            value={typeof displayValue === 'number' ? displayValue.toFixed(0) : displayValue}
                                                                            onUpdate={(newVal) => handleCellUpdate(rowIdx, colIdx, newVal)}
                                                                            unit={displayUnit}
                                                                        />
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    ) : (
                                                        <div className={cn("p-2 truncate flex flex-col tabular-nums", header === 'Вага' && "items-center")} title={typeof cell === 'string' || typeof cell === 'number' ? String(cell) : ''}>
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

                                        <td className={cn(
                                            "px-2 py-3.5 text-center border-b border-zinc-100 dark:border-zinc-800 sticky right-0 z-20 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                            dColor ? dColor.bg : "bg-white dark:bg-zinc-900"
                                        )} style={{ width: '150px', minWidth: '150px' }}>
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
                                                "px-4 py-4 text-zinc-900 dark:text-zinc-100 whitespace-nowrap border-r border-zinc-200/50 dark:border-zinc-700 overflow-hidden font-bold bg-zinc-50 dark:bg-zinc-800",
                                                idx < 2 && "sticky z-20 bg-zinc-50 dark:bg-zinc-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)]",
                                                idx < 2 && "text-blue-600 dark:text-blue-400 text-center",
                                            )}>
                                            <div className="flex flex-col tabular-nums">
                                                {/* If index 0, show "TOTAL (вага)" instead of standard client text */}
                                                {idx === 0 ? (
                                                    <span className="font-bold text-zinc-600 dark:text-zinc-400">TOTAL (вага)</span>
                                                ) : (
                                                    <div className={cn("flex items-baseline gap-1", idx === 1 && "justify-center")}>
                                                        {(() => {
                                                            const meta = reportData.headerMetadata?.[idx];
                                                            const unit = String(meta?.unit || '').trim().toLowerCase();
                                                            const isWeight = ['kg', 'кг', 'g', 'г'].includes(unit);

                                                            // If weight column, show the normal sum (cell value)
                                                            if (idx === 1 || isWeight) {
                                                                if (Number(cell) === 0) return null;

                                                                const val = Number(cell);
                                                                const displayVal = ['g', 'г'].includes(unit) ? val / 1000 : val;

                                                                return (
                                                                    <>
                                                                        <span>{displayVal.toFixed(0)} kg</span>
                                                                    </>
                                                                );
                                                            }

                                                            // If non-weight (e.g. stz), check package count to derive weight (1 pkg = 1 kg)
                                                            // We do NOT show the 'stz' sum here anymore.
                                                            const pkgData = reportData.packageCountFooter?.[idx];
                                                            const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                                            const pkgType = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : (meta?.unit || '');

                                                            if (pkgCount > 0) {
                                                                return (
                                                                    <>
                                                                        <span>
                                                                            {Number.isInteger(pkgCount) ? pkgCount.toFixed(0) : pkgCount.toFixed(1)} kg
                                                                        </span>
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
                                        const meta = reportData.headerMetadata?.[idx];
                                        const pkgData = reportData.packageCountFooter?.[idx];
                                        const count = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);
                                        const type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : (meta?.unit || 'kart');

                                        if (count > 0) {
                                            content = (
                                                <div className={cn("flex items-baseline gap-1 tabular-nums", idx === 1 && "justify-center")}>
                                                    <span>{Number.isInteger(Number(count)) ? Number(count).toFixed(0) : Number(count).toFixed(1)}</span>
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
                                                idx < 2 && "shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] clip-right text-blue-600 dark:text-blue-400 text-center",
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
                                        className="px-0 py-0 text-sm font-bold text-white uppercase tracking-wider sticky left-0 top-[48px] z-30 shadow-md bg-slate-800 dark:bg-slate-900 border-b border-white/10"
                                    >
                                        <div className="flex items-center justify-between w-full h-12 relative px-4">
                                            {/* Sticky Label (Left) */}
                                            <div className="flex items-center gap-2 sticky left-4 z-40 bg-slate-800 dark:bg-slate-900 py-1 pr-4">
                                                <Truck size={16} className="text-blue-400" />
                                                <span className="text-blue-100 whitespace-nowrap uppercase tracking-wider font-black">Логістика / Водії</span>
                                            </div>

                                            {/* Sticky Button (Right) */}
                                            <div className="sticky right-4 z-40 bg-slate-800 dark:bg-slate-900 py-1 pl-4">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-8 px-4 text-[10px] bg-blue-600 hover:bg-blue-500 border-none text-white uppercase font-black tracking-widest transition-all shadow-lg hover:shadow-blue-500/20 active:scale-95"
                                                    onClick={handleCopyAllDrivers}
                                                >
                                                    <Copy size={12} className="mr-2" />
                                                    Копіювати всіх
                                                </Button>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {driverRows.map((row, rowIdx) => {
                                    const dColor = getDriverColor(rowIdx);
                                    return (
                                        <tr key={`driver-${rowIdx}`} className={cn(
                                            "group border-b border-zinc-100 dark:border-zinc-800 last:border-0 border-l-[4px] bg-white dark:bg-zinc-900 transition-colors",
                                            dColor ? `${dColor.bg} ${dColor.border}` : "bg-blue-50/10 border-l-blue-500"
                                        )}>
                                            {/* Driver Name Cell (Editable) */}
                                            <td
                                                className={cn(
                                                    "px-0 py-0 border-r border-zinc-100 dark:border-zinc-800 sticky left-0 z-20 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]",
                                                    dColor ? dColor.bg : "bg-white dark:bg-zinc-900"
                                                )}
                                                style={{
                                                    width: `${getColumnWidth(0)}px`,
                                                    minWidth: `${getColumnWidth(0)}px`,
                                                    maxWidth: `${getColumnWidth(0)}px`,
                                                    left: 0
                                                }}
                                            >
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
                                                        style={{
                                                            width: `${getColumnWidth(colIdx)}px`,
                                                            minWidth: `${getColumnWidth(colIdx)}px`,
                                                            maxWidth: `${getColumnWidth(colIdx)}px`,
                                                            left: getStickyLeft(colIdx) !== undefined ? `${getStickyLeft(colIdx)}px` : undefined
                                                        }}
                                                        className={cn(
                                                            "px-0 py-0 border-r border-zinc-100 dark:border-zinc-800 text-xs transition-colors overflow-hidden",
                                                            colIdx === 1 && "sticky z-20 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)] clip-right",
                                                            colIdx === 1 && (dColor ? dColor.bg + " text-center text-blue-600 dark:text-blue-400" : "bg-blue-50/10 dark:bg-blue-900/10 text-center text-blue-600 dark:text-blue-400"),
                                                            (header === 'Вага' || header.toLowerCase().includes('total') || header.toLowerCase().includes('сума')) && (dColor ? "text-center text-blue-600 dark:text-blue-400" : "font-medium bg-blue-50/30 dark:bg-blue-900/10 px-4 text-blue-600 dark:text-blue-400 text-center")
                                                        )}>
                                                        <div className={cn("flex flex-col relative group/cell min-h-[40px] justify-center", colIdx === 1 && "items-center")}>
                                                            {(() => {
                                                                const qty = Number(cell) || 0;
                                                                const meta = reportData.headerMetadata?.[colIdx];

                                                                let displayValue: any = cell;
                                                                let displayUnit = 'kg';

                                                                if (colIdx === 1) {
                                                                    displayValue = typeof cell === 'object' ? cell.weight : cell;
                                                                } else {
                                                                    const pkgData = driverPackageCountRows?.[rowIdx]?.[colIdx];
                                                                    const pkgCount = typeof pkgData === 'object' && pkgData !== null ? pkgData.count : (Number(pkgData) || 0);

                                                                    if (meta) {
                                                                        const unit = meta.unit?.toLowerCase().trim();
                                                                        let type = typeof pkgData === 'object' && pkgData !== null ? pkgData.packageType : null;
                                                                        if (!type || type === 'kart') {
                                                                            type = extractPackageType(meta.name + " " + (meta.additionalInfo || "")) || type;
                                                                        }
                                                                        if (!type) {
                                                                            const u = unit || '';
                                                                            type = (u !== 'шт' && u !== 'szt') ? meta.unit || 'kart' : 'kart';
                                                                        }

                                                                        if (['kg', 'кг'].includes(unit)) {
                                                                            displayValue = qty;
                                                                            displayUnit = 'kg';
                                                                        } else if (['g', 'г'].includes(unit)) {
                                                                            displayValue = qty / 1000;
                                                                            displayUnit = 'kg';
                                                                        } else if (meta.netWeight > 0) {
                                                                            // High preference for explicit weight even if not in kg/g units
                                                                            displayValue = qty * meta.netWeight;
                                                                            displayUnit = 'kg';
                                                                        } else {
                                                                            // Non-weight items: Show package count
                                                                            if (pkgCount > 0 || qty === 0) {
                                                                                displayValue = pkgCount;
                                                                                displayUnit = type;
                                                                            } else {
                                                                                displayValue = qty;
                                                                                displayUnit = meta.unit || '';
                                                                            }
                                                                        }
                                                                    }
                                                                }

                                                                return (
                                                                    <div className={cn("flex items-center", colIdx === 1 && "justify-center")}>
                                                                        <EditableCell
                                                                            value={typeof displayValue === 'number' ? (colIdx === 1 ? `${displayValue.toFixed(0)} kg` : displayValue.toFixed(0)) : displayValue}
                                                                            onUpdate={(newVal) => handleDriverCellUpdate(rowIdx, colIdx, newVal)}
                                                                            unit={colIdx === 1 ? undefined : (displayUnit === 'kg' ? undefined : displayUnit)}
                                                                            readOnly={colIdx === 1} // Only Total Weight is read-only
                                                                            className={cn("font-bold text-sm", colIdx === 1 ? "text-blue-600 dark:text-blue-400" : dColor?.text)}
                                                                        />
                                                                    </div>
                                                                );
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
                                    );
                                })}
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
