"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTheme } from "../../contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, MoveRight, X, LogOut, User, Folder, Home, ChevronRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from '../../hooks/useAuth';
import { cn } from "@/lib/utils";

interface FolderPathItem {
  id: string;
  name: string;
}

interface HeaderProps {
  path: FolderPathItem[];
  onNavigateToFolder?: (folderId: string | null) => void;
}

function Header1({ path, onNavigateToFolder }: HeaderProps) {
    const { user, signOut } = useAuth();
    const { theme } = useTheme();
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [rateLimitCountdown, setRateLimitCountdown] = useState<string>('');

    const handleSignOut = async () => {
        await signOut();
    };

    // Listen for rate limit events from BulkPostizPoster
    useEffect(() => {
        const handleRateLimitUpdate = (event: CustomEvent) => {
            const { countdown } = event.detail;
            setRateLimitCountdown(countdown);
        };

        window.addEventListener('rateLimitUpdate', handleRateLimitUpdate as EventListener);

        return () => {
            window.removeEventListener('rateLimitUpdate', handleRateLimitUpdate as EventListener);
        };
    }, []);

    const navigationItems = [
        {
            title: "Home",
            href: "/",
            description: "",
        },
        {
            title: "Product",
            description: "Managing a small business today is already tough.",
            items: [
                {
                    title: "Reports",
                    href: "/reports",
                },
                {
                    title: "Statistics",
                    href: "/statistics",
                },
                {
                    title: "Dashboards",
                    href: "/dashboards",
                },
                {
                    title: "Recordings",
                    href: "/recordings",
                },
            ],
        },
        {
            title: "Company",
            description: "Managing a small business today is already tough.",
            items: [
                {
                    title: "About us",
                    href: "/about",
                },
                {
                    title: "Fundraising",
                    href: "/fundraising",
                },
                {
                    title: "Investors",
                    href: "/investors",
                },
                {
                    title: "Contact us",
                    href: "/contact",
                },
            ],
        },
    ];

    return (
        <>
            <motion.header
                className="w-full bg-gradient-to-r from-background via-background/95 to-background/90 backdrop-blur-xl border-b border-border/50 relative overflow-hidden"
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            >
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-blue-500/5 animate-pulse" />
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 shimmer opacity-30" />

                <div className="relative px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        {/* Left Section - Navigation Breadcrumb */}
                        <div className="flex items-center space-x-4">
                            {/* Logo/Brand */}
                            <motion.div 
                                className="flex items-center space-x-3"
                                whileHover={{ scale: 1.05 }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <span className="text-lg font-bold gradient-text">
                                    TikTok Bulk
                                </span>
                            </motion.div>

                            {/* Breadcrumb */}
                            <motion.div
                                className="flex items-center space-x-2 text-sm"
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                            >
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onNavigateToFolder?.(null)}
                                    className="text-muted-foreground hover:text-foreground hover:bg-accent/50 px-3 py-2 h-8 rounded-full transition-all duration-300 hover-lift"
                                >
                                    <Home className="w-4 h-4 mr-2" />
                                    Home
                                </Button>
                                {path.map((folder, index) => (
                                    <div key={folder.id} className="flex items-center space-x-2">
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        <motion.div
                                            className={cn(
                                                "flex items-center space-x-2 px-3 py-1 rounded-full border border-border/50",
                                                index === path.length - 1
                                                    ? "bg-accent/30"
                                                    : "bg-transparent hover:bg-accent/20 cursor-pointer"
                                            )}
                                            whileHover={{ scale: 1.02 }}
                                            onClick={() => onNavigateToFolder?.(folder.id)}
                                        >
                                            <Folder className="w-4 h-4 text-primary" />
                                            <span className="font-medium text-foreground truncate max-w-32">
                                                {folder.name}
                                            </span>
                                        </motion.div>
                                    </div>
                                ))}
                            </motion.div>
                        </div>

                        {/* Right Section - User Info & Actions */}
                        <div className="flex items-center space-x-3">
                            {/* Theme Toggle */}
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <ThemeToggle />
                            </motion.div>

                            {/* User Info */}
                            <motion.div 
                                className="flex items-center space-x-3 bg-accent/20 backdrop-blur-sm px-4 py-2 rounded-full border border-border/30"
                                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                                transition={{ type: "spring", stiffness: 400 }}
                            >
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <div className="hidden sm:block">
                                    <p className="text-sm font-medium text-foreground">
                                        {user?.email?.split('@')[0]}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {user?.email}
                                    </p>
                                </div>
                            </motion.div>

                            {/* Logout Button */}
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Button 
                                    variant="outline" 
                                    className="border-border/50 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive text-muted-foreground rounded-full px-4 transition-all duration-300 hover-lift"
                                    onClick={handleSignOut}
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    <span className="hidden sm:inline">Sign Out</span>
                                </Button>
                            </motion.div>

                            {/* Mobile Menu Button */}
                            <motion.button
                                className="lg:hidden p-2 rounded-lg hover:bg-accent/50 transition-colors"
                                onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                            >
                                {isMobileMenuOpen ? (
                                    <X className="w-5 h-5 text-foreground" />
                                ) : (
                                    <Menu className="w-5 h-5 text-foreground" />
                                )}
                            </motion.button>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {isMobileMenuOpen && (
                        <motion.div
                            className="lg:hidden absolute top-full left-0 right-0 bg-background/95 backdrop-blur-xl border-b border-border/50 z-50"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="px-6 py-4 space-y-4">
                                {navigationItems.map((item, index) => (
                                    <motion.div
                                        key={item.title}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        {item.href ? (
                                            <button
                                                className="block py-2 text-foreground hover:text-primary transition-colors duration-300 text-left"
                                                onClick={() => setMobileMenuOpen(false)}
                                            >
                                                {item.title}
                                            </button>
                                        ) : (
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium text-muted-foreground py-2">
                                                    {item.title}
                                                </p>
                                                {item.items?.map((subItem) => (
                                                    <button
                                                        key={subItem.title}
                                                        className="block py-1 pl-4 text-sm text-foreground/80 hover:text-primary transition-colors duration-300 text-left"
                                                        onClick={() => setMobileMenuOpen(false)}
                                                    >
                                                        {subItem.title}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* Status Bar */}
            <motion.div 
                className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
            >
                <div className="px-6 lg:px-8 py-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <motion.div
                            className="flex items-center space-x-4"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8 }}
                        >
                            <span className="flex items-center space-x-1">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                <span>Connected</span>
                            </span>
                            <span>•</span>
                            {rateLimitCountdown ? (
                                <span className="flex items-center space-x-1 text-yellow-500">
                                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                    <span>Rate limit: {rateLimitCountdown}</span>
                                </span>
                            ) : (
                                <span>Ready to create amazing content</span>
                            )}
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                        >
                            <span className="text-primary font-medium">TikTok Bulk Uploader v1.0</span>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

export { Header1 };
