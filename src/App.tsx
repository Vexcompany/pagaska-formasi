import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Layers, 
  Settings,
  Download,
  Upload,
  UserPlus,
  Move,
  Undo2,
  Redo2,
  Zap
} from 'lucide-react';

const EASING_OPTIONS = ['Linear', 'EaseInOut', 'Bounce', 'Elastic', 'Back', 'Strong'];
import { Project, Performer, Formation, Position } from './types';
import { StageComponent } from './components/StageComponent';
import { cn } from './utils';

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', 
  '#d946ef', '#f43f5e'
];

export default function App() {
  const [project, setProject] = useState<Project>({
    id: uuidv4(),
    name: 'New Formation Project',
    performers: [
      { id: uuidv4(), name: 'P1', color: COLORS[0] },
      { id: uuidv4(), name: 'P2', color: COLORS[1] },
    ],
    formations: [
      { 
        id: uuidv4(), 
        name: 'Start', 
        positions: {} 
      }
    ],
    settings: {
      fps: 60,
      transitionDuration: 1.0,
      easing: 'EaseInOut'
    }
  });

  const [history, setHistory] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);

  const [currentFormationIndex, setCurrentFormationIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const stageRef = useRef<any>(null);

  // Ensure currentFormationIndex is always valid
  useEffect(() => {
    if (currentFormationIndex >= project.formations.length) {
      setCurrentFormationIndex(Math.max(0, project.formations.length - 1));
    }
  }, [project.formations.length, currentFormationIndex]);

  // Helper to update project with history
  const updateProjectWithHistory = (newProject: Project | ((prev: Project) => Project)) => {
    setProject(prev => {
      const next = typeof newProject === 'function' ? newProject(prev) : newProject;
      setHistory(h => [...h, prev]);
      setFuture([]);
      return next;
    });
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);
    
    setFuture(f => [project, ...f]);
    setHistory(newHistory);
    setProject(previous);
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setHistory(h => [...h, project]);
    setFuture(newFuture);
    setProject(next);
  };

  // Initialize positions if missing
  useEffect(() => {
    const index = Math.min(currentFormationIndex, project.formations.length - 1);
    const currentFormation = project.formations[index];
    if (!currentFormation) return;
    
    let updated = false;
    const newPositions = { ...currentFormation.positions };

    project.performers.forEach((p, index) => {
      if (!newPositions[p.id]) {
        newPositions[p.id] = { x: 100 + (index * 60), y: 300 };
        updated = true;
      }
    });

    if (updated) {
      const newFormations = [...project.formations];
      newFormations[index] = {
        ...currentFormation,
        positions: newPositions
      };
      setProject(prev => ({ ...prev, formations: newFormations }));
    }
  }, [project.performers, currentFormationIndex]);

  const addPerformer = () => {
    const id = uuidv4();
    const newPerformer: Performer = {
      id,
      name: `P${project.performers.length + 1}`,
      color: COLORS[project.performers.length % COLORS.length]
    };

    updateProjectWithHistory(prev => ({
      ...prev,
      performers: [...prev.performers, newPerformer]
    }));
  };

  const removePerformer = (id: string) => {
    updateProjectWithHistory(prev => ({
      ...prev,
      performers: prev.performers.filter(p => p.id !== id),
      formations: prev.formations.map(f => {
        const { [id]: _, ...rest } = f.positions;
        return { ...f, positions: rest };
      })
    }));
  };

  const addFormation = () => {
    const index = Math.max(0, Math.min(currentFormationIndex, project.formations.length - 1));
    const currentFormation = project.formations[index];
    const newFormation: Formation = {
      id: uuidv4(),
      name: `Formation ${project.formations.length + 1}`,
      positions: currentFormation ? { ...currentFormation.positions } : {}
    };

    updateProjectWithHistory(prev => ({
      ...prev,
      formations: [...prev.formations, newFormation]
    }));
    setCurrentFormationIndex(project.formations.length);
  };

  const removeFormation = (index: number) => {
    if (project.formations.length <= 1) return;
    
    const newFormations = project.formations.filter((_, i) => i !== index);
    updateProjectWithHistory(prev => ({ ...prev, formations: newFormations }));
    setCurrentFormationIndex(Math.max(0, index - 1));
  };

  const updatePosition = (performerId: string, pos: Position) => {
    updateProjectWithHistory(prev => {
      const index = Math.max(0, Math.min(currentFormationIndex, prev.formations.length - 1));
      if (!prev.formations[index]) return prev;
      
      const newFormations = [...prev.formations];
      newFormations[index] = {
        ...newFormations[index],
        positions: {
          ...newFormations[index].positions,
          [performerId]: pos
        }
      };
      return { ...prev, formations: newFormations };
    });
  };

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    setCurrentFormationIndex(0);
    setIsPlaying(true);
  };

  const exportVideo = async () => {
    if (!stageRef.current) return;
    setIsExporting(true);
    setIsPlaying(false);
    setCurrentFormationIndex(0);

    const canvas = stageRef.current.getStage().content.querySelector('canvas');
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    const stream = canvas.captureStream(project.settings.fps);
    let recorder: MediaRecorder;
    
    try {
      // Try webm first
      recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    } catch (e) {
      try {
        // Fallback to mp4 if supported
        recorder = new MediaRecorder(stream, { mimeType: 'video/mp4' });
      } catch (e2) {
        // Final fallback to default
        recorder = new MediaRecorder(stream);
      }
    }

    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'video/webm';
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.${extension}`;
      a.click();
      setIsExporting(false);
    };

    recorder.start();

    // Play through formations
    for (let i = 0; i < project.formations.length; i++) {
      setCurrentFormationIndex(i);
      await new Promise(r => setTimeout(r, project.settings.transitionDuration * 1000 + 500));
    }

    recorder.stop();
  };

  useEffect(() => {
    let interval: any;
    if (isPlaying && !isExporting) {
      interval = setInterval(() => {
        setCurrentFormationIndex(prev => {
          if (prev >= project.formations.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, project.settings.transitionDuration * 1000 + 500); // Wait for transition + buffer
    }
    return () => clearInterval(interval);
  }, [isPlaying, isExporting, project.formations.length, project.settings.transitionDuration]);

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 border-r border-white/10 bg-[#111] flex flex-col z-30"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Move className="w-5 h-5 text-black" />
                </div>
                <h1 className="font-bold text-lg tracking-tight">Pagaska</h1>
              </div>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Performers
                  </h2>
                  <button 
                    onClick={addPerformer}
                    className="p-1 hover:bg-emerald-500/20 text-emerald-500 rounded transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {project.performers.map((p) => (
                    <div 
                      key={p.id}
                      className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-all"
                    >
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm" 
                        style={{ backgroundColor: p.color }}
                      />
                      <input 
                        className="bg-transparent border-none focus:ring-0 text-sm flex-1 p-0"
                        value={p.name}
                        onChange={(e) => {
                          const newPerformers = project.performers.map(per => 
                            per.id === p.id ? { ...per, name: e.target.value } : per
                          );
                          setProject(prev => ({ ...prev, performers: newPerformers }));
                        }}
                      />
                      <button 
                        onClick={() => removePerformer(p.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Settings className="w-3 h-3" /> Settings
                  </h2>
                </div>
                <div className="p-3 bg-white/5 rounded-xl space-y-4">
                  <div>
                    <label className="text-[10px] text-white/30 uppercase block mb-2">Frame Rate (FPS): {project.settings.fps}</label>
                    <input 
                      type="range"
                      min="30"
                      max="120"
                      step="1"
                      className="w-full accent-emerald-500"
                      value={project.settings.fps}
                      onChange={(e) => setProject(prev => ({ 
                        ...prev, 
                        settings: { ...prev.settings, fps: parseInt(e.target.value) } 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 uppercase block mb-2">Transition (Sec): {project.settings.transitionDuration}s</label>
                    <input 
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      className="w-full accent-emerald-500"
                      value={project.settings.transitionDuration}
                      onChange={(e) => setProject(prev => ({ 
                        ...prev, 
                        settings: { ...prev.settings, transitionDuration: parseFloat(e.target.value) } 
                      }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/30 uppercase block mb-2 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> Transition Effect
                    </label>
                    <select 
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg text-xs p-2 focus:ring-emerald-500 focus:border-emerald-500"
                      value={project.settings.easing}
                      onChange={(e) => updateProjectWithHistory(prev => ({ 
                        ...prev, 
                        settings: { ...prev.settings, easing: e.target.value } 
                      }))}
                    >
                      {EASING_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Layers className="w-3 h-3" /> Project Info
                  </h2>
                </div>
                <div className="p-3 bg-white/5 rounded-xl space-y-3">
                  <div>
                    <label className="text-[10px] text-white/30 uppercase block mb-1">Project Name</label>
                    <input 
                      className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0"
                      value={project.name}
                      onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2 pt-2">
                    <div className="flex gap-2">
                      <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors">
                        <Download className="w-3 h-3" /> Save
                      </button>
                      <button className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors">
                        <Upload className="w-3 h-3" /> Load
                      </button>
                    </div>
                    <button 
                      onClick={exportVideo}
                      disabled={isExporting}
                      className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-black font-bold rounded-lg text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      {isExporting ? (
                        <>
                          <motion.div 
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          >
                            <Settings className="w-3 h-3" />
                          </motion.div>
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3" /> Export Video (.webm)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Top Navbar */}
        <nav className="h-16 border-b border-white/10 bg-[#0a0a0a] flex items-center justify-between px-6 z-20">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
              >
                <ChevronRight className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60">Menu</span>
              </button>
            )}
            <div className="h-6 w-px bg-white/10 mx-2" />
            <h2 className="font-bold text-sm tracking-tight text-white/80">{project.name}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 mr-4">
              <button 
                onClick={undo}
                disabled={history.length === 0}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20"
                title="Undo"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button 
                onClick={redo}
                disabled={future.length === 0}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-20"
                title="Redo"
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/5">
              <button 
                onClick={() => setCurrentFormationIndex(Math.max(0, currentFormationIndex - 1))}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-30"
                disabled={currentFormationIndex === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-mono font-medium min-w-[60px] text-center">
                {currentFormationIndex + 1} / {project.formations.length}
              </span>
              <button 
                onClick={() => setCurrentFormationIndex(Math.min(project.formations.length - 1, currentFormationIndex + 1))}
                className="p-1.5 hover:bg-white/10 rounded-md transition-colors disabled:opacity-30"
                disabled={currentFormationIndex === project.formations.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </nav>

        {/* Toolbar */}
        <header className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-[#0a0a0a]/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-6">
            <button 
              onClick={handlePlay}
              disabled={isExporting}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg",
                isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600 text-black"
              )}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {isPlaying ? 'Stop' : 'Play Sequence'}
            </button>
          </div>

          <div className="flex items-center gap-3">
             <div className="text-right mr-4">
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">Formation Name</p>
                <input 
                  className="bg-transparent border-none p-0 text-lg font-bold text-right focus:ring-0 w-48"
                  value={project.formations[Math.max(0, Math.min(currentFormationIndex, project.formations.length - 1))]?.name || ''}
                  onChange={(e) => {
                    const index = Math.max(0, Math.min(currentFormationIndex, project.formations.length - 1));
                    if (!project.formations[index]) return;
                    
                    const newFormations = [...project.formations];
                    newFormations[index] = { ...newFormations[index], name: e.target.value };
                    setProject(prev => ({ ...prev, formations: newFormations }));
                  }}
                />
             </div>
          </div>
        </header>

        {/* Stage Area */}
        <div className="flex-1 p-8 flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
          <div className="w-full h-full max-w-5xl max-h-[700px] relative">
            <StageComponent 
              width={1000}
              height={600}
              performers={project.performers}
              currentFormation={project.formations[Math.max(0, Math.min(currentFormationIndex, project.formations.length - 1))] || project.formations[0]}
              onUpdatePosition={updatePosition}
              transitionDuration={project.settings.transitionDuration}
              stageRef={stageRef}
              projectSettings={project.settings}
            />
          </div>
        </div>

        {/* Timeline */}
        <footer className="h-32 border-t border-white/10 bg-[#111] p-4 flex items-center gap-4 overflow-x-auto z-20">
          <div className="flex gap-4 px-4">
            {project.formations.map((f, i) => (
              <motion.div
                key={f.id}
                layoutId={f.id}
                onClick={() => setCurrentFormationIndex(i)}
                className={cn(
                  "relative min-w-[120px] h-20 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden",
                  currentFormationIndex === i 
                    ? "border-emerald-500 bg-emerald-500/10" 
                    : "border-white/10 bg-white/5 hover:border-white/20"
                )}
              >
                <span className="text-[10px] font-mono opacity-40">#{i + 1}</span>
                <span className="text-xs font-semibold truncate px-2 w-full text-center">{f.name}</span>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFormation(i);
                  }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {currentFormationIndex === i && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500"
                  />
                )}
              </motion.div>
            ))}
            
            <button 
              onClick={addFormation}
              className="min-w-[120px] h-20 rounded-xl border-2 border-dashed border-white/10 hover:border-white/30 hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1 text-white/40"
            >
              <Plus className="w-5 h-5" />
              <span className="text-[10px] font-semibold uppercase tracking-widest">Add Frame</span>
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
