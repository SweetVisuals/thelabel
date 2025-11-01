"use client";

import { Button } from "@/components/ui/button";
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Menu, MoveRight, X, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  currentFolderId?: string | null;
  folders?: any[];
  onNavigateUp?: () => void;
}

function Header1({ currentFolderId, folders = [], onNavigateUp }: HeaderProps) {
    const { user, signOut } = useAuth();

    const handleSignOut = async () => {
        await signOut();
    };

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

    const [isOpen, setOpen] = useState(false);
    return (
        <header className="w-full bg-background border-b border-neutral-800">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Navigation Breadcrumb */}
                    {currentFolderId && (
                        <div className="flex items-center space-x-2 text-sm text-neutral-300">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onNavigateUp}
                                className="text-neutral-300 hover:text-white hover:bg-neutral-800 px-3 py-2 h-8"
                            >
                                ← Back
                            </Button>
                            <span className="text-neutral-500">/</span>
                            <span className="font-medium truncate max-w-32 text-white">
                                {folders.find((f: any) => f.id === currentFolderId)?.name}
                            </span>
                        </div>
                    )}
                    {!currentFolderId && <div></div>} {/* Spacer when no breadcrumb */}
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2 text-sm text-neutral-400">
                            <User className="w-4 h-4 text-neutral-50" />
                            <span className="text-neutral-50">{user?.email}</span>
                        </div>
                        <Button variant="outline" className="border-neutral-800 hover:bg-neutral-800 text-neutral-50" onClick={handleSignOut}>
                            <LogOut className="w-4 h-4 mr-2" />
                            Log out
                        </Button>
                    </div>
                </div>
            </div>
        </header>
    );
}

export { Header1 };
