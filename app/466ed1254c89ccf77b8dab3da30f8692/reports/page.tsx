'use client';

import React, { useState, useEffect } from 'react';
import { getReports, createReport, deleteReport } from '@/app/actions/reports';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, FileText, Trash2, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import Link from 'next/link';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

export default function ReportsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const router = useRouter();

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 10;

    // New Report State
    const [open, setOpen] = useState(false);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportName, setReportName] = useState('');

    useEffect(() => {
        loadReports(currentPage);
    }, [currentPage]);

    async function loadReports(page: number) {
        setIsLoading(true);
        const res = await getReports(page, limit);
        if (res.success && res.data) {
            setReports(res.data);
            setTotalPages(res.totalPages || 1);
        } else {
            toast.error('Failed to load reports');
        }
        setIsLoading(false);
    }

    async function handleCreateReport() {
        if (!startDate || !endDate) {
            toast.error('Please select dates');
            return;
        }

        setIsCreating(true);
        const res = await createReport(startDate, endDate, reportName);

        if (res.success && res.data) {
            toast.success('Report created');
            setOpen(false);
            // Redirect to the new report (don't reload list as we're navigating away)
            router.push(`/466ed1254c89ccf77b8dab3da30f8692/reports/${res.data.id}`);
        } else {
            toast.error(res.error || 'Failed to create report');
        }
        setIsCreating(false);
    }

    async function handleDeleteReport(id: string) {
        if (!confirm('Are you sure you want to delete this report?')) return;

        setIsDeleting(id);
        const res = await deleteReport(id);
        if (res.success) {
            toast.success('Report deleted');
            loadReports(currentPage);
        } else {
            toast.error('Failed to delete report');
        }
        setIsDeleting(null);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Збережені звіти</h2>
                    <p className="text-zinc-500">Створюйте та переглядайте snapshot-звіти за певні періоди</p>
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="gap-2">
                            <Plus size={16} />
                            Створити новий звіт
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Створити звіт</DialogTitle>
                            <DialogDescription>
                                Виберіть період для генерації звіту. Звіт буде збережено, і ви зможете редагувати його пізніше.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Назва (опціонально)</Label>
                                <Input
                                    id="name"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    placeholder="Наприклад: Звіт за Жовтень"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Початкова дата</Label>
                                    <Input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>Кінцева дата</Label>
                                    <Input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleCreateReport} disabled={isCreating}>
                                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Згенерувати
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 py-4">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                        <FileText size={16} />
                        Список звітів
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-10 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="p-10 text-center text-zinc-500">
                            Немає збережених звітів. Створіть перший звіт!
                        </div>
                    ) : (
                        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {reports.map((report) => (
                                <div key={report.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="font-semibold text-lg hover:underline decoration-zinc-400 underline-offset-4">
                                            <Link href={`/466ed1254c89ccf77b8dab3da30f8692/reports/${report.id}`}>
                                                {report.name}
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-zinc-500">
                                            <div className="flex items-center gap-1">
                                                <CalendarIcon size={14} />
                                                <span>
                                                    {format(new Date(report.startDate), 'dd MMM yyyy', { locale: uk })} - {format(new Date(report.endDate), 'dd MMM yyyy', { locale: uk })}
                                                </span>
                                            </div>
                                            <div className="text-xs text-zinc-400">
                                                Створено: {format(new Date(report.createdAt), 'dd MMM yyyy HH:mm', { locale: uk })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" asChild>
                                            <Link href={`/466ed1254c89ccf77b8dab3da30f8692/reports/${report.id}`}>
                                                <ExternalLink size={14} className="mr-2" />
                                                Відкрити
                                            </Link>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDeleteReport(report.id)}
                                            disabled={isDeleting === report.id}
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            {isDeleting === report.id ? (
                                                <Loader2 size={16} className="animate-spin" />
                                            ) : (
                                                <Trash2 size={16} />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
                {totalPages > 1 && (
                    <div className="flex items-center justify-center p-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1 || isLoading}
                            >
                                Попередня
                            </Button>
                            <span className="text-sm text-zinc-500">
                                Сторінка {currentPage} з {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || isLoading}
                            >
                                Наступна
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
