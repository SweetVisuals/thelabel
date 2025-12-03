import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, User, Filter } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { postizAPI, PostizPost, PostizProfile } from '../../lib/postiz';
import { Header1 as Header } from '../Dashboard/Header';
import { useNavigate } from 'react-router-dom';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export const CalendarPage: React.FC = () => {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [posts, setPosts] = useState<PostizPost[]>([]);
    const [profiles, setProfiles] = useState<PostizProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedProfileId, setSelectedProfileId] = useState<string>('all');

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch posts for a wide range around the current month
            const start = subMonths(currentDate, 2).toISOString();
            const end = addMonths(currentDate, 3).toISOString();

            const [fetchedPosts, fetchedProfiles] = await Promise.all([
                postizAPI.getPosts(start, end),
                postizAPI.getProfiles()
            ]);

            setPosts(fetchedPosts);
            setProfiles(fetchedProfiles);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const getPostsForDay = (day: Date) => {
        return posts.filter(post => {
            if (!post.scheduledAt) return false;

            // Filter by profile if one is selected
            if (selectedProfileId !== 'all') {
                const hasProfile = post.profiles && post.profiles.includes(selectedProfileId);
                if (!hasProfile) return false;
            }

            return isSameDay(new Date(post.scheduledAt), day);
        });
    };

    const getProfile = (profileId: string) => {
        return profiles.find(p => p.id === profileId);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'published': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'scheduled': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            case 'failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
            default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };



    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading calendar...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
            <Header
                path={[{ id: 'calendar', name: 'Calendar' }]}
                onNavigateToFolder={() => navigate('/')}
                onAction={(action) => {
                    if (action === 'upload') navigate('/');
                }}
            />

            <div className="flex-1 overflow-auto p-6">
                <div className="max-w-7xl mx-auto space-y-6">

                    {/* Calendar Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                                {format(currentDate, 'MMMM yyyy')}
                            </h1>
                            <div className="flex items-center bg-secondary/50 rounded-lg p-1 border border-white/10">
                                <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={goToToday} className="h-8 px-3 text-xs">
                                    Today
                                </Button>
                                <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            {/* Account Filter */}
                            <div className="w-[200px]">
                                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                                    <SelectTrigger className="h-9 bg-white/5 border-white/10 text-xs">
                                        <div className="flex items-center">
                                            <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                            <SelectValue placeholder="Filter by account" />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Accounts</SelectItem>
                                        {profiles.map(profile => (
                                            <SelectItem key={profile.id} value={profile.id}>
                                                <div className="flex items-center">
                                                    {profile.avatar ? (
                                                        <img src={profile.avatar} alt={profile.username} className="w-4 h-4 rounded-full mr-2" />
                                                    ) : (
                                                        <User className="w-4 h-4 mr-2" />
                                                    )}
                                                    {profile.displayName || profile.username}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex items-center space-x-2 text-sm text-muted-foreground hidden lg:flex">
                                <div className="flex items-center px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                    Scheduled
                                </div>
                                <div className="flex items-center px-2 py-1 rounded bg-green-500/10 border border-green-500/20">
                                    <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                                    Published
                                </div>
                                <div className="flex items-center px-2 py-1 rounded bg-red-500/10 border border-red-500/20">
                                    <div className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                                    Failed
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="bg-background/95 p-4 text-center text-sm font-medium text-muted-foreground border-b border-white/5">
                                {day}
                            </div>
                        ))}

                        {calendarDays.map((day) => {
                            const dayPosts = getPostsForDay(day);
                            const isSelected = selectedDate && isSameDay(day, selectedDate);

                            return (
                                <div
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={cn(
                                        "min-h-[140px] bg-background/50 p-3 transition-all hover:bg-background/80 cursor-pointer relative group",
                                        !isSameMonth(day, currentDate) && "bg-background/20 text-muted-foreground/50",
                                        isToday(day) && "bg-primary/5",
                                        isSelected && "ring-2 ring-primary inset-0 z-10"
                                    )}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={cn(
                                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                                            isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground group-hover:text-white"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        {dayPosts.length > 0 && (
                                            <span className="text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full text-white/70">
                                                {dayPosts.length}
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-1.5 overflow-y-auto max-h-[100px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                                        {dayPosts.map(post => {
                                            const profile = post.profiles && post.profiles.length > 0 ? getProfile(post.profiles[0]) : null;
                                            return (
                                                <div
                                                    key={post.id}
                                                    className={cn(
                                                        "text-[10px] p-1.5 rounded border truncate flex items-center space-x-1.5 transition-transform hover:scale-105",
                                                        getStatusColor(post.status)
                                                    )}
                                                >
                                                    {profile?.avatar ? (
                                                        <img src={profile.avatar} alt={profile.username} className="w-3 h-3 rounded-full" />
                                                    ) : (
                                                        <User className="w-3 h-3" />
                                                    )}
                                                    <span className="truncate flex-1">{post.text || 'No caption'}</span>
                                                    <span className="opacity-70 text-[9px]">
                                                        {post.scheduledAt ? format(new Date(post.scheduledAt), 'HH:mm') : ''}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selected Day Details */}
                    {selectedDate && (
                        <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-6 animate-in slide-in-from-bottom-4">
                            <h2 className="text-xl font-bold mb-4 flex items-center">
                                <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
                                Posts for {format(selectedDate, 'MMMM do, yyyy')}
                            </h2>

                            {getPostsForDay(selectedDate).length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No posts scheduled for this day{selectedProfileId !== 'all' ? ' for this account' : ''}.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {getPostsForDay(selectedDate).map(post => {
                                        const profile = post.profiles && post.profiles.length > 0 ? getProfile(post.profiles[0]) : null;
                                        return (
                                            <div key={post.id} className="bg-black/40 rounded-lg border border-white/10 overflow-hidden group hover:border-primary/50 transition-colors">
                                                <div className="aspect-video bg-black/50 relative">
                                                    {post.mediaUrls && post.mediaUrls.length > 0 ? (
                                                        <img
                                                            src={post.mediaUrls[0]}
                                                            alt="Post preview"
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                            No Image
                                                        </div>
                                                    )}
                                                    <div className={cn(
                                                        "absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold uppercase border backdrop-blur-md",
                                                        getStatusColor(post.status)
                                                    )}>
                                                        {post.status}
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center space-x-2">
                                                            {profile ? (
                                                                <div className="flex items-center space-x-1.5 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10">
                                                                    {profile.avatar ? (
                                                                        <img src={profile.avatar} alt={profile.username} className="w-4 h-4 rounded-full" />
                                                                    ) : (
                                                                        <User className="w-3 h-3" />
                                                                    )}
                                                                    <span className="text-[10px] font-medium text-white/80 max-w-[80px] truncate">
                                                                        {profile.displayName || profile.username}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground">Unknown Account</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground flex items-center">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {post.scheduledAt ? format(new Date(post.scheduledAt), 'h:mm a') : 'Unscheduled'}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm line-clamp-3 text-white/90 mb-3">
                                                        {post.text || 'No caption provided'}
                                                    </p>
                                                    <div className="flex items-center justify-end">
                                                        <Button variant="outline" size="sm" className="h-7 text-xs border-white/10 hover:bg-white/5">
                                                            View Details
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
