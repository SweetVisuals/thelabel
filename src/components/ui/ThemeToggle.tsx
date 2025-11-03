import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className={cn(
        "relative flex items-center justify-center w-12 h-8 rounded-full p-1 transition-all duration-300 hover:scale-105",
        "bg-gradient-to-r from-purple-500 to-pink-500 shadow-lg",
        "hover:shadow-xl hover:from-purple-600 hover:to-pink-600",
        className
      )}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.05 }}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-white/20 backdrop-blur-sm"
        initial={false}
        animate={{ opacity: theme === 'light' ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />
      
      <motion.div
        className="flex items-center justify-center w-full h-full relative"
        initial={false}
        animate={{ rotate: theme === 'dark' ? 0 : 180 }}
        transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      >
        <motion.div
          className="absolute flex items-center justify-center"
          initial={false}
          animate={{ 
            scale: theme === 'dark' ? 1 : 0,
            opacity: theme === 'dark' ? 1 : 0 
          }}
          transition={{ duration: 0.3 }}
        >
          <Moon className="w-4 h-4 text-white" />
        </motion.div>
        
        <motion.div
          className="absolute flex items-center justify-center"
          initial={false}
          animate={{ 
            scale: theme === 'light' ? 1 : 0,
            opacity: theme === 'light' ? 1 : 0 
          }}
          transition={{ duration: 0.3 }}
        >
          <Sun className="w-4 h-4 text-white" />
        </motion.div>
      </motion.div>

      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-400/30 to-pink-400/30 blur-sm"
        animate={{ 
          opacity: theme === 'dark' ? 0.8 : 0.4,
          scale: theme === 'dark' ? 1 : 0.8
        }}
        transition={{ duration: 0.5 }}
      />
    </motion.button>
  );
};