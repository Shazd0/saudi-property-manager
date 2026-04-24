
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, User } from '../types';
import { getTasks, saveTask, deleteTask } from '../services/firestoreService';
import { ClipboardList, Plus, CheckCircle, Clock, Circle, ArrowRight, Trash2, AlertTriangle, Zap } from 'lucide-react';
import { useToast } from './Toast';
import ConfirmDialog from './ConfirmDialog';
import SoundService from '../services/soundService';
import { useLanguage } from '../i18n';

interface TaskManagerProps {
    currentUser: User;
}

const TaskManager: React.FC<TaskManagerProps> = ({ currentUser }) => {
    const { t, isRTL } = useLanguage();
    const { showError, showSuccess } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'MY'>('MY');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [confirmTitle, setConfirmTitle] = useState('Confirm');
    const [confirmDanger, setConfirmDanger] = useState(false);
    const [confirmAction, setConfirmAction] = useState<null | (() => void)>(null);

    const openConfirm = (message: string, onConfirm: () => void, opts?: { title?: string; danger?: boolean }) => {
        setConfirmTitle(opts?.title || 'Confirm');
        setConfirmDanger(!!opts?.danger);
        setConfirmMessage(message);
        setConfirmAction(() => onConfirm);
        setConfirmOpen(true);
    };
    const closeConfirm = () => {
        setConfirmOpen(false);
        setConfirmMessage('');
        setConfirmAction(null);
    };

    useEffect(() => {
        const loadTasks = async () => {
            if (currentUser.role === 'ADMIN' && filter === 'ALL') {
                setTasks(await getTasks());
            } else {
                setTasks(await getTasks(currentUser.id));
            }
        };
        loadTasks();
    }, [currentUser, filter]);

    const handleAddTask = async (e: React.FormEvent) => {
      e.preventDefault();
      SoundService.play('submit');
      if(!newTaskTitle.trim()) return;
      
      // Automation: Auto-detect Priority
      const lowerTitle = newTaskTitle.toLowerCase();
      let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (lowerTitle.includes('urgent') || lowerTitle.includes('leak') || lowerTitle.includes('fire') || lowerTitle.includes('broken')) {
          priority = 'HIGH';
      } else if (lowerTitle.includes('cleaning') || lowerTitle.includes('check')) {
          priority = 'LOW';
      }

      const newTask: Task = {
          id: crypto.randomUUID(),
          userId: currentUser.id,
          title: newTaskTitle,
          status: TaskStatus.TODO,
          priority: priority,
          createdAt: Date.now()
      };
      
      await saveTask(newTask);
      
      const list = currentUser.role === 'ADMIN' && filter === 'ALL' ? await getTasks() : await getTasks(currentUser.id);
      setTasks(list);
      setNewTaskTitle('');
  };

    const moveTask = async (task: Task, newStatus: TaskStatus) => {
    const updated = { ...task, status: newStatus };
    await saveTask(updated);
    const list = currentUser.role === 'ADMIN' && filter === 'ALL' ? await getTasks() : await getTasks(currentUser.id);
    setTasks(list);
      
      // --- AUTOMATION: AUTO-DELETE DONE TASKS ---
      if (newStatus === TaskStatus.DONE) {
             setTimeout(async () => {
                 await deleteTask(task.id);
                 const list = currentUser.role === 'ADMIN' && filter === 'ALL' ? await getTasks() : await getTasks(currentUser.id);
                 setTasks(list);
             }, 2000);
      }
  };

  const removeTask = async (id: string) => {
            openConfirm(t('task.deleteConfirm'), async () => {
                await deleteTask(id);
                const list = currentUser.role === 'ADMIN' && filter === 'ALL' ? await getTasks() : await getTasks(currentUser.id);
                setTasks(list);
                showSuccess(t('task.deleted'));
                closeConfirm();
            }, { danger: true, title: t('task.deleteTitle') });
  };

  const Column = ({ status, title, icon: Icon, color }: any) => {
      const columnTasks = tasks.filter(t => t.status === status);
      return (
          <div className="flex-1 bg-slate-50/50 rounded-lg sm:rounded-2xl md:rounded-3xl p-3 sm:p-4 md:p-5 border border-slate-100 min-h-[400px] sm:min-h-[500px] flex flex-col">
              <div className={`flex items-center gap-2 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b ${color}`}>
                  <div className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-white shadow-sm`}>
                    <Icon size={14} className="sm:size-[18px]" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-[9px] sm:text-xs md:text-sm uppercase tracking-wide">{title}</h3>
                  <span className="ml-auto bg-white px-2 sm:px-2.5 py-1 rounded-lg text-[8px] sm:text-xs font-black text-slate-400 shadow-sm border border-slate-100">{columnTasks.length}</span>
              </div>
              <div className="space-y-2 sm:space-y-3 flex-1">
                  {columnTasks.map(tx => (
                      <div key={tx.id} className="ios-card p-3 sm:p-4 hover:shadow-ios-md transition-all group relative animate-slide-up">
                          <div className="flex justify-between items-start mb-2">
                              <div className="flex-1">
                                  {tx.priority === 'HIGH' && <span className="text-[8px] sm:text-[9px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full mb-1 inline-block">{t('task.urgent')}</span>}
                                  {tx.priority === 'LOW' && <span className="text-[8px] sm:text-[9px] font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full mb-1 inline-block">{t('task.low')}</span>}
                                  <p className="font-bold text-slate-800 text-xs sm:text-sm leading-snug break-words">{tx.title}</p>
                              </div>
                              <button onClick={() => removeTask(tx.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2">
                                  <Trash2 size={12} className="sm:size-[14px]" />
                              </button>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-slate-50/50 text-[9px] sm:text-[10px]">
                             {status !== TaskStatus.TODO && (
                                 <button onClick={() => moveTask(tx, status === TaskStatus.DONE ? TaskStatus.IN_PROGRESS : TaskStatus.TODO)} className="font-bold text-slate-400 hover:text-slate-600 flex items-center gap-0.5">
                                     {t('task.prev')}
                                 </button>
                             )}
                             {status !== TaskStatus.DONE && (
                                 <button onClick={() => moveTask(tx, status === TaskStatus.TODO ? TaskStatus.IN_PROGRESS : TaskStatus.DONE)} className="font-bold text-ios-blue hover:text-blue-700 ml-auto flex items-center gap-0.5">
                                     {t('task.next')}
                                 </button>
                             )}
                             {status === TaskStatus.DONE && (
                                 <span className="text-emerald-500 font-bold italic ml-auto">{t('task.clearing')}</span>
                             )}
                          </div>
                      </div>
                  ))}
                  {columnTasks.length === 0 && (
                      <div className="text-center py-8 sm:py-12 text-slate-300 text-[8px] sm:text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-lg sm:rounded-2xl">
                          {t('task.noTasks')}
                      </div>
                  )}
              </div>
          </div>
      );
  };

  return (
    <div className="premium-card h-[calc(100vh-140px)] flex flex-col animate-fade-in overflow-hidden">
        <div className="p-3 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 bg-slate-50/30 z-10">
             <div className="w-full sm:w-auto">
                <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5 sm:gap-2">
                    <ClipboardList className="text-violet-500 size-[18px] sm:size-[20px] md:size-[24px]" /> {t('task.boardTitle')}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                    <p className="text-[8px] sm:text-xs text-slate-400 font-bold uppercase tracking-wide">{t('task.kanban')}</p>
                    {currentUser.role === 'ADMIN' && (
                        <div className="flex bg-slate-100 rounded-lg p-0.5 ml-2 sm:ml-4">
                            <button onClick={() => setFilter('MY')} className={`text-[8px] sm:text-[10px] font-bold px-2 sm:px-3 py-1 rounded-md transition-all ${filter === 'MY' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>{t('task.my')}</button>
                            <button onClick={() => setFilter('ALL')} className={`text-[8px] sm:text-[10px] font-bold px-2 sm:px-3 py-1 rounded-md transition-all ${filter === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}>{t('common.all')}</button>
                        </div>
                    )}
                </div>
             </div>
             
             <form onSubmit={handleAddTask} className="flex gap-2 w-full sm:max-w-md">
                 <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
                        <Zap size={12} className="sm:size-[14px] text-slate-400 group-focus-within:text-violet-500 transition-colors" />
                    </div>
                    <input 
                        type="text" 
                        placeholder={t('task.newTaskPlaceholder')} 
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-2 sm:py-3 bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl outline-none focus:ring-2 focus:ring-violet-500 text-xs sm:text-sm font-medium transition-all focus:bg-white"
                    />
                 </div>
                 <button type="submit" className="bg-emerald-500 text-white p-2 sm:p-3 rounded-lg sm:rounded-xl hover:bg-emerald-600 transition-transform active:scale-95 shadow-lg flex-shrink-0">
                     <Plus size={16} className="sm:size-[20px]" />
                 </button>
             </form>
        </div>

        <div className="flex-1 p-3 sm:p-6 flex gap-3 sm:gap-6 overflow-x-auto bg-slate-50/30">
            <Column status={TaskStatus.TODO} title={t('task.todo')} icon={Circle} color="border-slate-200 text-slate-500" />
            <Column status={TaskStatus.IN_PROGRESS} title={t('task.inProgress')} icon={Clock} color="border-blue-200 text-blue-500" />
            <Column status={TaskStatus.DONE} title={t('task.done')} icon={CheckCircle} color="border-emerald-200 text-emerald-500" />
        </div>

        <ConfirmDialog
            open={confirmOpen}
            title={confirmTitle}
            message={confirmMessage}
            danger={confirmDanger}
            onConfirm={() => confirmAction && confirmAction()}
            onCancel={closeConfirm}
        />
    </div>
  );
};

export default TaskManager;
