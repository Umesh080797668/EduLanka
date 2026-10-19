'use client';

import React, { useEffect, useState } from 'react';
import {
    CheckCircle,
    Clock,
    Download,
    Eye,
    EyeOff,
    FileCheck,
    FileText,
    Globe,
    Pause,
    Play,
    RotateCcw,
    School,
    Search,
    SplitSquareVertical,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import { apiClient } from '@/lib/api-client';
import { TutorialProvider } from '@/components/TutorialProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface PaperItem {
    id: string;
    title: string;
    subject: string;
    grade: number;
    year: number;
    medium: 'sinhala' | 'tamil' | 'english';
    term: string;
    type: string;
    file_url: string;
    marking_scheme_url?: string;
    is_national: boolean;
    created_at: string;
}

export default function StudentPapersPage() {
    const [papers, setPapers] = useState<PaperItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGrade, setSelectedGrade] = useState<string>('all');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [selectedMedium, setSelectedMedium] = useState<string>('all');

    // Split-Screen Practice Mode State
    const [activePaper, setActivePaper] = useState<PaperItem | null>(null);
    const [showMarkingScheme, setShowMarkingScheme] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [timerRunning, setTimerRunning] = useState(false);


    useEffect(() => {
        let isMounted = true;
        apiClient
            .get<{ data: PaperItem[] }>('/papers')
            .then((res) => {
                if (isMounted) setPapers(res.data || []);
            })
            .catch((err: any) => {
                if (isMounted) {
                    toast.error('Failed to load past papers', {
                        description: err?.message || 'Network error',
                    });
                }
            })
            .finally(() => {
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, []);

    // Exam Stopwatch Effect
    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (timerRunning) {
            interval = setInterval(() => {
                setTimerSeconds((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [timerRunning]);

    const formatTime = (totalSec: number) => {
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const startPracticeSession = (paper: PaperItem) => {
        setActivePaper(paper);
        setShowMarkingScheme(false);
        setTimerSeconds(0);
        setTimerRunning(true);
    };

    const closePracticeSession = () => {
        setActivePaper(null);
        setTimerRunning(false);
    };

    const filtered = papers.filter((p) => {
        const matchesSearch =
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.subject.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGrade = selectedGrade === 'all' || String(p.grade) === selectedGrade;
        const matchesSubject = selectedSubject === 'all' || p.subject === selectedSubject;
        const matchesMedium = selectedMedium === 'all' || p.medium === selectedMedium;
        return matchesSearch && matchesGrade && matchesSubject && matchesMedium;
    });

    return (
        <TutorialProvider role="STUDENT" screenId="papers">
            <div className="space-y-6 p-6 max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <FileCheck className="w-6 h-6 text-primary" />
                            National & School Past Paper Hub
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Exam preparation portal with synchronized question papers and paired marking schemes.
                        </p>
                    </div>
                </div>

                {/* Split Screen Practice View Modal / Overlay */}
                {activePaper && (
                    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col">
                        {/* Top Practice Bar */}
                        <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-card/80">
                            <div className="flex items-center gap-3">
                                <h2 className="text-sm font-bold text-foreground truncate max-w-md">
                                    {activePaper.title} ({activePaper.year} · Grade {activePaper.grade})
                                </h2>
                                <Badge variant="outline" className="capitalize text-xs">
                                    {activePaper.medium}
                                </Badge>
                            </div>

                            {/* Exam Timer */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-muted/60 px-3 py-1 rounded-md border border-border">
                                    <Clock className="w-4 h-4 text-primary" />
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                        {formatTime(timerSeconds)}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setTimerRunning(!timerRunning)}
                                        className="h-6 w-6 p-0 ml-1"
                                    >
                                        {timerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setTimerSeconds(0)}
                                        className="h-6 w-6 p-0"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </Button>
                                </div>

                                {activePaper.marking_scheme_url && (
                                    <Button
                                        variant={showMarkingScheme ? 'primary' : 'secondary'}
                                        size="sm"
                                        onClick={() => setShowMarkingScheme(!showMarkingScheme)}
                                        className="flex items-center gap-1.5 text-xs"
                                    >
                                        {showMarkingScheme ? (
                                            <>
                                                <EyeOff className="w-4 h-4" /> Hide Marking Scheme
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4" /> Reveal Marking Scheme
                                            </>
                                        )}
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={closePracticeSession}
                                    className="h-8 w-8 p-0"
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>
                        </div>

                        {/* Split Screen View Body */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Pane: Question Paper */}
                            <div className={`h-full border-r border-border flex flex-col transition-all duration-300 ${showMarkingScheme ? 'w-1/2' : 'w-full'
                                }`}>
                                <div className="bg-muted/30 px-3 py-1.5 border-b border-border/50 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                                    <span>Question Paper (Exam Mode)</span>
                                    <a
                                        href={activePaper.file_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-primary hover:underline flex items-center gap-1"
                                    >
                                        <Download className="w-3 h-3" /> Download PDF
                                    </a>
                                </div>
                                <div className="flex-1 bg-muted/10 p-4 overflow-auto">
                                    <iframe
                                        src={`${activePaper.file_url}#toolbar=0`}
                                        title="Question Paper"
                                        className="w-full h-full rounded border border-border bg-white"
                                    />
                                </div>
                            </div>

                            {/* Right Pane: Paired Marking Scheme */}
                            {showMarkingScheme && (
                                <div className="w-1/2 h-full flex flex-col bg-card/40 animate-in slide-in-from-right duration-300">
                                    <div className="bg-muted/30 px-3 py-1.5 border-b border-border/50 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                                        <span className="flex items-center gap-1">
                                            <CheckCircle className="w-3.5 h-3.5" /> Official Marking Scheme & Answers
                                        </span>
                                        {activePaper.marking_scheme_url && (
                                            <a
                                                href={activePaper.marking_scheme_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-primary hover:underline flex items-center gap-1"
                                            >
                                                <Download className="w-3 h-3" /> Download PDF
                                            </a>
                                        )}
                                    </div>
                                    <div className="flex-1 bg-muted/10 p-4 overflow-auto">
                                        {activePaper.marking_scheme_url ? (
                                            <iframe
                                                src={`${activePaper.marking_scheme_url}#toolbar=0`}
                                                title="Marking Scheme"
                                                className="w-full h-full rounded border border-border bg-white"
                                            />
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                                                No marking scheme uploaded for this paper.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Filter & Search Bar */}
                <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search past papers..."
                            className="w-full pl-9 pr-3 h-9 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>

                    <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="all">All Grades</option>
                        {[6, 7, 8, 9, 10, 11, 12, 13].map((g) => (
                            <option key={g} value={String(g)}>
                                Grade {g}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="all">All Subjects</option>
                        <option value="Science">Science</option>
                        <option value="Mathematics">Mathematics</option>
                        <option value="Sinhala">Sinhala</option>
                        <option value="Tamil">Tamil</option>
                        <option value="English">English</option>
                        <option value="History">History</option>
                        <option value="ICT">ICT</option>
                    </select>

                    <select
                        value={selectedMedium}
                        onChange={(e) => setSelectedMedium(e.target.value)}
                        className="h-9 px-3 rounded-md bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        <option value="all">All Mediums</option>
                        <option value="sinhala">Sinhala Medium</option>
                        <option value="tamil">Tamil Medium</option>
                        <option value="english">English Medium</option>
                    </select>

                    <span className="text-xs text-muted-foreground ml-auto">
                        {filtered.length} papers available
                    </span>
                </div>

                {/* Papers Grid */}
                {loading ? (
                    <div className="py-12 text-center text-muted-foreground animate-pulse">
                        Loading examination archive...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-16 text-center border rounded-xl border-dashed border-border bg-card/40 flex flex-col items-center justify-center space-y-3">
                        <FileText className="w-12 h-12 text-muted-foreground/60" />
                        <h3 className="text-base font-semibold text-foreground">No Examination Papers Found</h3>
                        <p className="text-sm text-muted-foreground max-w-md">
                            Try adjusting your grade, subject, or language medium filters.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filtered.map((paper) => (
                            <Card
                                key={paper.id}
                                className="border-border/60 hover:border-primary/50 transition-all flex flex-col justify-between"
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <Badge variant="outline" className="text-xs">
                                                    Grade {paper.grade}
                                                </Badge>
                                                <Badge tone="neutral" className="capitalize text-xs">
                                                    {paper.medium}
                                                </Badge>
                                                {paper.is_national ? (
                                                    <Badge tone="primary" className="text-[10px] flex items-center gap-1">
                                                        <Globe className="w-3 h-3" /> National
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                                                        <School className="w-3 h-3" /> School
                                                    </Badge>
                                                )}
                                            </div>
                                            <CardTitle className="text-base font-semibold text-foreground line-clamp-1">
                                                {paper.title}
                                            </CardTitle>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-muted-foreground">
                                            {paper.year}
                                        </span>
                                    </div>
                                    <CardDescription className="text-xs mt-1">
                                        {paper.subject} · {paper.term.replace('_', ' ').toUpperCase()}
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="pt-0 space-y-3">
                                    <div className="text-xs text-muted-foreground flex items-center justify-between border-t border-border/50 pt-2.5">
                                        <span>Type: {paper.type.toUpperCase()}</span>
                                        <span>
                                            {paper.marking_scheme_url ? (
                                                <span className="text-emerald-500 font-medium flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Scheme Paired
                                                </span>
                                            ) : (
                                                'Paper Only'
                                            )}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1">
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            onClick={() => startPracticeSession(paper)}
                                            className="text-xs flex items-center gap-1.5 flex-1"
                                        >
                                            <SplitSquareVertical className="w-3.5 h-3.5" /> Practice Exam
                                        </Button>

                                        <a
                                            href={paper.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center justify-center h-8 px-2.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                            title="Download Question Paper"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </TutorialProvider>
    );
}
