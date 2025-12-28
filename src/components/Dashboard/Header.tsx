import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut, Folder, Home, ChevronRight, Calendar as CalendarIcon, ListOrdered, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from '../../hooks/useAuth';
import { cn } from "@/lib/utils";
import { useBulkPost } from '../../contexts/BulkPostContext';
import { useNavigate } from 'react-router-dom';

interface FolderPathItem {
    id: string;
    name: string;
}

interface HeaderProps {
    path: FolderPathItem[];
    onNavigateToFolder?: (folderId: string | null) => void;
    onAction?: (action: string) => void;
}

function Header1({ path, onNavigateToFolder, onAction }: HeaderProps) {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    // const { theme } = useTheme(); // Unused
    const { statusMessage, isPosting, isPaused, jobQueue, postingSchedule, currentBatchIndex, totalBatches, nextBatchStartTime } = useBulkPost();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [countdown, setCountdown] = useState<string>('');

    // Countdown timer effect
    useEffect(() => {
        const interval = setInterval(() => {
            if (nextBatchStartTime) {
                const now = new Date();
                const diff = nextBatchStartTime.getTime() - now.getTime();

                if (diff <= 0) {
                    setCountdown('Starting...');
                } else {
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setCountdown(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                }
            } else {
                setCountdown('');
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [nextBatchStartTime]);

    const handleSignOut = async () => {
        await signOut();
    };

    // ... existing useEffects ...

    return (
        <>
            {/* ... Header Content ... */}
            <motion.header
                className="w-full bg-black/40 backdrop-blur-xl border-b border-white/10 relative overflow-hidden z-50"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            >
                {/* ... existing header content ... */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse pointer-events-none" />

                <div className="relative px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* ... Logo, Breadcrumb, Actions ... */}
                        <div className="flex items-center space-x-6">
                            {/* Logo */}
                            <motion.div
                                className="flex items-center space-x-3 cursor-pointer"
                                whileHover={{ scale: 1.05 }}
                                transition={{ type: "spring", stiffness: 400 }}
                                onClick={() => onNavigateToFolder?.(null)}
                            >
                                <img
                                    src="/Movement.png"
                                    alt="Movement"
                                    className="h-10 w-auto object-contain"
                                />
                            </motion.div>

                            {/* Breadcrumb */}
                            <div className="hidden md:flex items-center space-x-2 text-sm">
                                <div className="h-4 w-[1px] bg-white/10 mx-2" />
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/')}
                                    className="text-muted-foreground hover:text-white hover:bg-white/5 px-2 h-8 rounded-lg transition-all duration-300"
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Home
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate('/calendar')}
                                    className="text-muted-foreground hover:text-white hover:bg-white/5 px-2 h-8 rounded-lg transition-all duration-300"
                                >
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Calendar
                                </Button>
                                {path.map((folder, index) => (
                                    <div key={folder.id} className="flex items-center space-x-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                                        <motion.div
                                            className={cn(
                                                "flex items-center space-x-2 px-3 py-1 rounded-lg border border-transparent transition-all duration-200",
                                                index === path.length - 1
                                                    ? "bg-white/10 border-white/10 text-white"
                                                    : "hover:bg-white/5 hover:border-white/5 text-muted-foreground hover:text-white cursor-pointer"
                                            )}
                                            whileHover={{ scale: 1.02 }}
                                            onClick={() => onNavigateToFolder?.(folder.id)}
                                        >
                                            <Folder className={cn("w-3.5 h-3.5", index === path.length - 1 ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-medium truncate max-w-[150px]">
                                                {folder.name}
                                            </span>
                                        </motion.div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Section - Actions & User */}
                        <div className="flex items-center space-x-4">
                            <div className="hidden md:flex items-center space-x-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAction?.('queue')}
                                    className={cn(
                                        "hover:bg-white/10 text-muted-foreground hover:text-white px-3 h-9 rounded-lg transition-all duration-300",
                                        jobQueue.length > 0 && "text-primary bg-primary/10 hover:bg-primary/20"
                                    )}
                                >
                                    <ListOrdered className="w-4 h-4 mr-2" />
                                    Queue
                                    {jobQueue.length > 0 && (
                                        <span className="ml-2 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                                            {jobQueue.length}
                                        </span>
                                    )}
                                </Button>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onAction?.('settings')}
                                    className="hover:bg-white/10 text-muted-foreground hover:text-white"
                                >
                                    <Menu className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="h-6 w-[1px] bg-white/10 hidden md:block" />

                            <div className="flex items-center space-x-3">
                                <div className="hidden md:flex flex-col items-end">
                                    <span className="text-sm font-medium text-white">{user?.email?.split('@')[0]}</span>
                                    <span className="text-[10px] text-muted-foreground">Pro Plan</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" />
                                </Button>
                            </div>

                            {/* Mobile Menu Toggle */}
                            <div className="md:hidden">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                                >
                                    {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-white/10 bg-black/60 backdrop-blur-xl"
                        >
                            <div className="p-4 space-y-4">
                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        onAction?.('queue');
                                        setMobileMenuOpen(false);
                                    }}
                                >
                                    <ListOrdered className="w-4 h-4 mr-2" />
                                    Queue ({jobQueue.length})
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => {
                                        onNavigateToFolder?.(null);
                                        setMobileMenuOpen(false);
                                    }}
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Home
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* Status Bar */}
            <motion.div
                className="w-full bg-black/20 backdrop-blur-sm border-b border-white/5"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
            >
                <div className="px-6 lg:px-8 py-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <motion.div
                            className="flex items-center space-x-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <span className="flex items-center space-x-1.5">
                                <div className={cn(
                                    "w-1.5 h-1.5 rounded-full animate-pulse",
                                    isPosting ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"
                                )} />
                                <span>{isPosting ? "Processing Bulk Schedule" : (jobQueue.length > 0 ? "System Active" : "System Online")}</span>
                            </span>
                            <span>•</span>

                            {isPosting && postingSchedule.length > 0 ? (
                                <>
                                    <span className="text-blue-400">
                                        {totalBatches} Batches Scheduled
                                    </span>
                                    <span>•</span>
                                    <span className="text-blue-400">
                                        Batch #{currentBatchIndex}
                                    </span>
                                    <span>•</span>
                                    <span className="flex items-center space-x-1 text-blue-400">
                                        <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                        <span>
                                            Post {postingSchedule.filter(s => s.status === 'success' || s.status === 'error').length + 1}/{postingSchedule.length}
                                        </span>
                                    </span>
                                    <span>•</span>
                                    <span className="text-green-400">
                                        ✓ {postingSchedule.filter(s => s.status === 'success').length}
                                    </span>
                                    {postingSchedule.filter(s => s.status === 'error').length > 0 && (
                                        <>
                                            <span>•</span>
                                            <span className="text-red-400">
                                                ✗ {postingSchedule.filter(s => s.status === 'error').length}
                                            </span>
                                        </>
                                    )}
                                </>
                            ) : isPosting ? (
                                <span className="flex items-center space-x-1 text-blue-400">
                                    {isPaused ? (
                                        <>
                                            <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                                            <span>{statusMessage}</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                                            <span>{statusMessage}</span>
                                        </>
                                    )}
                                </span>
                            ) : (
                                // Check if there's a job processing on server (not local)
                                jobQueue.some(j => j.status === 'processing') ? (
                                    <span className="flex items-center space-x-1 text-blue-400">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        <span>Processing Batch on Server...</span>
                                    </span>
                                ) : (
                                    <span className={cn(jobQueue.length > 0 && "text-blue-400")}>
                                        {jobQueue.length > 0 ? (
                                            <>
                                                {jobQueue.length} Batches Scheduled
                                                {nextBatchStartTime && countdown && (
                                                    <> - Waiting for next batch {countdown}</>
                                                )}
                                            </>
                                        ) : "Ready"}
                                    </span>
                                )
                            )}
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                        >
                            <span className="text-primary/70 font-medium">v2.0.0</span>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

export { Header1 };
