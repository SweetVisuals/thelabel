import * as React from "react"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfToday,
    setHours,
    setMinutes,
} from "date-fns"
import { cn } from "@/lib/utils"
import { Button } from "./button"

interface DateTimePickerProps {
    date: Date
    setDate: (date: Date) => void
    className?: string
}

export function DateTimePicker({ date, setDate, className }: DateTimePickerProps) {
    const [currentMonth, setCurrentMonth] = React.useState(startOfMonth(date))

    // Sync current month when date changes externally (optional, but good for UX)
    React.useEffect(() => {
        setCurrentMonth(startOfMonth(date))
    }, [date])

    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    })

    const firstDayCurrentMonth = getDay(startOfMonth(currentMonth))
    const colStartClasses = [
        "",
        "col-start-2",
        "col-start-3",
        "col-start-4",
        "col-start-5",
        "col-start-6",
        "col-start-7",
    ]

    const previousMonth = () => {
        const firstDayNextMonth = addMonths(currentMonth, -1)
        setCurrentMonth(firstDayNextMonth)
    }

    const nextMonth = () => {
        const firstDayNextMonth = addMonths(currentMonth, 1)
        setCurrentMonth(firstDayNextMonth)
    }

    const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
        const numVal = parseInt(value, 10)
        if (isNaN(numVal)) return

        let newDate = new Date(date)
        if (type === 'hour') {
            newDate = setHours(newDate, Math.min(23, Math.max(0, numVal)))
        } else {
            newDate = setMinutes(newDate, Math.min(59, Math.max(0, numVal)))
        }
        setDate(newDate)
    }

    return (
        <div className={cn("p-4 bg-black/20 rounded-xl border border-white/10", className)}>
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm">
                    {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex space-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={previousMonth}
                        className="h-7 w-7 hover:bg-white/10"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={nextMonth}
                        className="h-7 w-7 hover:bg-white/10"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2 text-center">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div key={day} className="text-xs text-muted-foreground font-medium py-1">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-1 mb-6">
                {days.map((day, dayIdx) => {
                    const isSelected = isSameDay(day, date)
                    const isToday = isSameDay(day, startOfToday())

                    return (
                        <button
                            key={day.toString()}
                            onClick={() => {
                                // Preserve time when changing date
                                const newDate = new Date(day)
                                newDate.setHours(date.getHours())
                                newDate.setMinutes(date.getMinutes())
                                setDate(newDate)
                            }}
                            className={cn(
                                dayIdx === 0 && colStartClasses[getDay(day)],
                                "h-8 w-8 rounded-lg flex items-center justify-center text-sm transition-all duration-200 mx-auto",
                                isSelected && "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(var(--primary),0.3)] font-semibold",
                                !isSelected && isToday && "text-primary font-semibold bg-primary/10",
                                !isSelected && !isToday && "hover:bg-white/10 text-foreground",
                                !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50"
                            )}
                        >
                            <time dateTime={format(day, 'yyyy-MM-dd')}>
                                {format(day, 'd')}
                            </time>
                        </button>
                    )
                })}
            </div>

            <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-muted-foreground uppercase tracking-wider font-medium">
                        <Clock className="w-3 h-3 mr-2" />
                        Time
                    </div>
                    <div className="flex items-center space-x-2 bg-black/40 rounded-lg p-1 border border-white/5">
                        <input
                            type="number"
                            min={0}
                            max={23}
                            value={format(date, 'HH')}
                            onChange={(e) => handleTimeChange('hour', e.target.value)}
                            className="w-8 bg-transparent text-center text-sm font-medium focus:outline-none appearance-none"
                        />
                        <span className="text-muted-foreground">:</span>
                        <input
                            type="number"
                            min={0}
                            max={59}
                            value={format(date, 'mm')}
                            onChange={(e) => handleTimeChange('minute', e.target.value)}
                            className="w-8 bg-transparent text-center text-sm font-medium focus:outline-none appearance-none"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
