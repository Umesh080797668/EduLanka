import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface DisasterModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string, resumeDate: string) => void;
}

export function DisasterModeModal({ isOpen, onClose, onConfirm }: DisasterModeModalProps) {
    const [reason, setReason] = useState('Flood');
    const [resumeDate, setResumeDate] = useState('');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative"
                >
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-red-900">Engage Disaster Protocol</h2>
                            <p className="text-red-700/80 text-sm mt-1">
                                This will instantly suspend platform operations and broadcast overriding SMS messages out to all registered Parents.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Closure Reason (Taxonomy)
                            </label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            >
                                <option value="Flood">Flood</option>
                                <option value="Cyclone">Cyclone</option>
                                <option value="Landslide">Landslide</option>
                                <option value="Civil/Public Health">Civil/Public Health</option>
                                <option value="Other">Other</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-1">This classification drives the Phase 5 Predictive Engine Analytics.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">
                                Expected Resume Date (Optional)
                            </label>
                            <input
                                type="date"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                                value={resumeDate}
                                onChange={(e) => setResumeDate(e.target.value)}
                            />
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => {
                                    if (confirm("FINAL WARNING: Are you absolutely certain you want to blast Emergency SMS messages system-wide?")) {
                                        onConfirm(reason, resumeDate);
                                    }
                                }}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg shadow-sm shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                <AlertTriangle className="w-5 h-5" />
                                Initiate Lockdown & Notify Parents
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
