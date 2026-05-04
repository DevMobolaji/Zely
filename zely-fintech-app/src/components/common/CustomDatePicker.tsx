import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface CustomDatePickerProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
    value,
    onChange,
    placeholder = 'Select a date',
    className = '',
    disabled = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Parse initial date or use today
    const [currentDate, setCurrentDate] = useState(() => {
        if (value) {
            const date = new Date(value);
            // Ensure valid date
            if (!isNaN(date.getTime())) return date;
        }
        return new Date();
    });

    // Update actual displayed month/year independently of selected date
    const [viewDate, setViewDate] = useState(currentDate);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        
        const days = [];
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        
        // Days of week header
        const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        // Add empty slots for days before the 1st
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
        }

        // Add actual days
        for (let i = 1; i <= daysInMonth; i++) {
            const currentObjDate = new Date(year, month, i);
            const isSelected = value === currentObjDate.toISOString().split('T')[0];
            const isToday = new Date().toISOString().split('T')[0] === currentObjDate.toISOString().split('T')[0];

            days.push(
                <button
                    key={`day-${i}`}
                    onClick={(e) => {
                        e.preventDefault();
                        const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                        onChange(formattedDate);
                        setIsOpen(false);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${isSelected ? 'bg-primary text-white shadow-md' : 
                          isToday ? 'border border-primary text-primary' : 
                          'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="absolute z-50 mt-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200 w-[280px]">
                <div className="flex items-center justify-between mb-4">
                    <button 
                        onClick={(e) => { e.preventDefault(); setViewDate(new Date(year, month - 1, 1)); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                        {monthNames[month]} {year}
                    </div>
                    <button 
                        onClick={(e) => { e.preventDefault(); setViewDate(new Date(year, month + 1, 1)); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map(name => (
                        <div key={name} className="w-8 h-8 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                            {name}
                        </div>
                    ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            </div>
        );
    };

    // Format display value visually
    let displayValue = placeholder;
    if (value) {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
            displayValue = dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        }
    }

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div 
                className={`flex items-center w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-300 dark:hover:border-slate-700'} transition-colors gap-3`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <CalendarIcon className="text-slate-400 w-5 h-5 shrink-0" />
                <span className={`block truncate ${!value ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {displayValue}
                </span>
            </div>

            {isOpen && renderCalendar()}
        </div>
    );
};

export default CustomDatePicker;
