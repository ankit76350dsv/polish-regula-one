import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Play, Square, Coffee } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkPulse() {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isClockedIn && startTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((new Date().getTime() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, startTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleClockToggle = () => {
    if (!isClockedIn) {
      setIsClockedIn(true);
      setStartTime(new Date());
      toast.success('Clocked in successfully');
    } else {
      setIsClockedIn(false);
      setStartTime(null);
      setElapsed(0);
      toast.info('Clocked out successfully. Report generated.');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 font-sans">WorkPulse Attendance</h2>
        <p className="text-sm text-slate-500 font-medium">Real-time shift management & payroll synchronization.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-white border-slate-200 shadow-xl shadow-slate-200/50 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Shift Live Session</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-10 space-y-10">
            <div className="text-7xl font-black font-sans tracking-tight text-slate-900 tabular-nums">
              {formatTime(elapsed)}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button 
                size="lg" 
                className={`w-44 h-14 rounded-full font-bold transition-all duration-300 shadow-lg ${
                  isClockedIn 
                  ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                }`}
                onClick={handleClockToggle}
              >
                {isClockedIn ? <><Square className="mr-2 h-4 w-4 fill-current" /> Stop Work</> : <><Play className="mr-2 h-4 w-4 fill-current" /> Start Shift</>}
              </Button>
              <Button variant="outline" className="h-14 w-14 rounded-full border-slate-200 bg-white text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all">
                <Coffee className="h-6 w-6" />
              </Button>
            </div>

            <div className="flex items-center gap-2 p-2 px-4 bg-slate-50 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-400 border border-slate-100">
              <MapPin className="h-3 w-3 text-indigo-500" /> Warsaw HQ Node (WWA-01)
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl flex flex-col">
          <CardHeader className="border-b border-slate-50">
            <CardTitle className="text-sm font-bold text-slate-800">Historical Journal</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 py-6 space-y-3">
            {[
              { date: 'Today, 14 May', duration: '08:12:44', status: 'SYNCHRONIZED' },
              { date: 'Yesterday, 13 May', duration: '07:45:12', status: 'SYNCHRONIZED' },
              { date: 'Mon, 12 May', duration: '08:00:00', status: 'OVERTIME' },
            ].map((shift, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <Clock className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">{shift.date}</p>
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Duration: {shift.duration}</p>
                  </div>
                </div>
                <span className={`text-[9px] font-black tracking-widest px-2 py-0.5 rounded ${
                  shift.status === 'OVERTIME' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 bg-slate-100'
                }`}>
                  {shift.status}
                </span>
              </div>
            ))}
            
            <Button variant="ghost" className="w-full mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600">
              Generate PDF Export
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

