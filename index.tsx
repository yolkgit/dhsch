
import React, { useState, useMemo, useEffect, FC, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import ReactDOM from 'react-dom/client';
import { Department, Employee, Task, Project } from './types';
import { getProjects, getDepartments, getEmployees, addProject, updateProject, deleteProject, addTask, updateTask, deleteTask, updateProjects, updateTaskPositions, hasAdminPassword, verifyAdminPassword, addDepartment, deleteDepartment, addEmployee, deleteEmployee } from './services/apiService';
import { addDays, getDaysBetween, formatDate } from './utils/dateUtils';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, FilterIcon, PlusIcon, FolderIcon, ChevronDownIcon, XMarkIcon, PencilIcon, TrashIcon, GripVerticalIcon, SunIcon, MoonIcon } from './components/icons';

import './index.css'; 

import { io } from 'socket.io-client';

// Settings Constants Keys
const SETTINGS_KEY = 'gantt-ui-settings-v2';
const GANTT_COLUMN_WIDTHS_KEY = 'ganttColumnWidths';
const MIN_DAYS_IN_VIEW = 30;
const MIN_COLUMN_WIDTH = 50;

interface UISettings {
    dayWidth: number;
    rowHeight: number;
    projectBarHeight: number;
    taskBarHeight: number;
    fontSize: number;
    headerFontSize: number;
}

const DEFAULT_SETTINGS: UISettings = {
    dayWidth: 30,
    rowHeight: 35,
    projectBarHeight: 36,
    taskBarHeight: 26,
    fontSize: 13,
    headerFontSize: 12,
};

const DEFAULT_COLUMN_WIDTHS = {
    project: 220,
    department: 100,
    author: 100,
    progress: 100,
};

// --- Custom Icons ---
const CogIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.592c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const Resizer: FC<{ onMouseDown: (e: React.MouseEvent) => void }> = ({ onMouseDown }) => (
    <div onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} className="absolute top-0 right-0 h-full w-2.5 cursor-col-resize group z-20 flex justify-center items-center">
        <div className="w-px h-2/3 bg-transparent group-hover:bg-gray-500 transition-colors duration-200"></div>
    </div>
);

const Tooltip: FC<{ content: React.ReactNode; children: React.ReactNode }> = ({ content, children }) => {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const handleMouseMove = (e: React.MouseEvent) => setPosition({ x: e.clientX, y: e.clientY });
    const handleMouseEnter = (e: React.MouseEvent) => { setPosition({ x: e.clientX, y: e.clientY }); setVisible(true); };
    const handleMouseLeave = () => setVisible(false);
    const handleTouchStart = (e: React.TouchEvent) => { const touch = e.touches[0]; setPosition({ x: touch.clientX, y: touch.clientY }); setVisible(!visible); };

    return (
        <div className="w-full h-full" onMouseEnter={handleMouseEnter} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onTouchStart={handleTouchStart}>
            {children}
            {visible && createPortal(
                <div className="fixed top-0 left-0 pointer-events-none z-[9999] bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-gray-900 dark:text-white text-xs rounded-md py-3 px-4 shadow-2xl border border-gray-200 dark:border-gray-700 transition-opacity duration-200"
                    style={{ transform: `translate(${Math.min(window.innerWidth - 280, position.x + 15)}px, ${Math.min(window.innerHeight - 150, position.y + 15)}px)`, width: 'max-content', maxWidth: '280px' }}>
                    {content}
                </div>, document.body
            )}
        </div>
    );
};

const ModalBase: FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title?: string }> = ({ isOpen, onClose, children, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 transition-all" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-2xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-700 custom-scrollbar transition-colors" onClick={e => e.stopPropagation()}>
                {title && (
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"><XMarkIcon className="h-6 w-6" /></button>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
};

const SliderField: FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void; colorClass: string; unit?: string }> = ({ label, value, min, max, onChange, colorClass, unit = 'px' }) => {
    const [localValue, setLocalValue] = useState(value);
    useEffect(() => { setLocalValue(value); }, [value]);

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <label className="text-gray-600 dark:text-gray-300 font-medium">{label}</label>
                <span className={`${colorClass} font-mono font-black`}>{localValue}{unit}</span>
            </div>
            <input 
                type="range" 
                min={min} 
                max={max} 
                value={localValue} 
                onInput={(e) => setLocalValue(parseInt((e.target as HTMLInputElement).value))}
                onChange={(e) => onChange(parseInt((e.target as HTMLInputElement).value))} 
                className="w-full accent-indigo-500 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-lg appearance-none cursor-pointer" 
            />
        </div>
    );
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: UISettings;
    setSettings: (s: UISettings) => void;
    departments: Department[];
    employees: Employee[];
    onAddDepartment: (name: string) => void;
    onDeleteDepartment: (id: string) => void;
    onAddEmployee: (name: string, deptId: string) => void;
    onDeleteEmployee: (id: string) => void;
}

const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, settings, setSettings, departments, employees, onAddDepartment, onDeleteDepartment, onAddEmployee, onDeleteEmployee }) => {
    const update = useCallback((key: keyof UISettings, val: any) => setSettings({ ...settings, [key]: val }), [settings, setSettings]);
    const [activeTab, setActiveTab] = useState<'general' | 'data'>('general');

    // Data Management State
    const [newDeptName, setNewDeptName] = useState('');
    const [newEmpName, setNewEmpName] = useState('');
    const [newEmpDeptId, setNewEmpDeptId] = useState('');

    useEffect(() => {
        if (departments.length > 0) setNewEmpDeptId(departments[0].id);
    }, [isOpen, departments]);

    const copySql = () => {
        const sql = `
-- MySQL Database Setup Script
-- 데이터베이스 스키마 생성 (이미 존재하면 건너뜀)

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    position INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    department_id VARCHAR(255),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    start_date DATE,
    end_date DATE,
    color VARCHAR(50),
    employee_id VARCHAR(255),
    progress INT DEFAULT 0,
    description TEXT,
    position INT DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
    \`key\` VARCHAR(255) PRIMARY KEY,
    value JSON
);

-- 초기 마이그레이션 (컬럼이 없을 경우 추가)
-- MySQL에서는 IF NOT EXISTS 구문이 ALTER TABLE 컬럼 추가에 직접 지원되지 않으므로 
-- 프로시저를 사용하거나 수동으로 확인해야 합니다. 아래는 참고용입니다.
-- ALTER TABLE projects ADD COLUMN position INT DEFAULT 0;
`;
        navigator.clipboard.writeText(sql);
        alert('MySQL용 SQL 스크립트가 복사되었습니다.\n\n데이터베이스 관리 도구(Workbench, DBeaver 등)에서 실행하세요.');
    };

    const handleAddDept = (e: React.FormEvent) => {
        e.preventDefault();
        if (newDeptName.trim()) {
            onAddDepartment(newDeptName.trim());
            setNewDeptName('');
        }
    };

    const handleAddEmp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmpDeptId) {
            alert('부서를 먼저 추가한 뒤 직원을 등록하세요.');
            return;
        }
        if (newEmpName.trim()) {
            onAddEmployee(newEmpName.trim(), newEmpDeptId);
            setNewEmpName('');
        }
    };

    return (
        <ModalBase isOpen={isOpen} onClose={onClose} title="표시 및 시스템 설정">
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 pb-1">
                <button onClick={() => setActiveTab('general')} className={`pb-2 px-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'general' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}>일반 및 연결</button>
                <button onClick={() => setActiveTab('data')} className={`pb-2 px-4 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'data' ? 'text-emerald-600 dark:text-emerald-400 border-b-2 border-emerald-600 dark:border-emerald-500' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-300'}`}>조직 관리</button>
            </div>

            <div className="space-y-8 pb-32">
                {activeTab === 'general' ? (
                    <>
                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest border-b border-rose-500/20 dark:border-rose-400/20 pb-2">보안 설정</h4>
                        <div className="space-y-3">
                            {hasAdminPassword() ? (
                                <div className="px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-2"><span>🛡️</span>관리자 비밀번호가 환경 변수(.env)로 관리됩니다.</div>
                            ) : (
                                <p className="text-xs text-rose-600 dark:text-rose-200 leading-relaxed">비밀번호가 설정되지 않았습니다. 서버 .env의 VITE_ADMIN_PASSWORD로 설정한 뒤 다시 빌드하세요.</p>
                            )}
                        </div>
                    </section>

                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest border-b border-indigo-500/20 dark:border-indigo-400/20 pb-2">MySQL API 서버 연결</h4>
                        <div className="space-y-3">
                            <div className="p-4 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">환경 변수로 연결됨</p>
                                        <p className="text-xs text-gray-500">시스템 환경 변수(.env) 설정을 사용 중입니다.</p>
                                    </div>
                                </div>
                                <button onClick={copySql} className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 text-xs font-bold rounded-lg transition-all border border-gray-300 dark:border-gray-600">MySQL 초기 설정 스크립트 복사</button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 dark:border-emerald-400/20 pb-2">테이블 레이아웃</h4>
                        <SliderField label="날짜 칸 너비 (가로)" value={settings.dayWidth} min={30} max={120} onChange={(v) => update('dayWidth', v)} colorClass="text-emerald-600 dark:text-emerald-300" />
                        <SliderField label="행 높이 (세로)" value={settings.rowHeight} min={35} max={120} onChange={(v) => update('rowHeight', v)} colorClass="text-emerald-600 dark:text-emerald-300" />
                    </section>

                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest border-b border-amber-500/20 dark:border-amber-400/20 pb-2">바 스타일 및 폰트</h4>
                        <SliderField label="프로젝트 바 높이" value={settings.projectBarHeight} min={10} max={60} onChange={(v) => update('projectBarHeight', v)} colorClass="text-amber-600 dark:text-amber-300" />
                        <SliderField label="태스크 바 높이" value={settings.taskBarHeight} min={10} max={60} onChange={(v) => update('taskBarHeight', v)} colorClass="text-amber-600 dark:text-amber-300" />
                        <SliderField label="내용 글자 크기" value={settings.fontSize} min={8} max={26} onChange={(v) => update('fontSize', v)} colorClass="text-amber-600 dark:text-amber-300" />
                        <SliderField label="제목줄 글자 크기" value={settings.headerFontSize} min={8} max={22} onChange={(v) => update('headerFontSize', v)} colorClass="text-amber-600 dark:text-amber-300" />
                    </section>
                    
                    <button onClick={onClose} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95">닫기</button>
                    </>
                ) : (
                    <>
                    {/* Data Management Tab */}
                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest border-b border-emerald-500/20 dark:border-emerald-400/20 pb-2">부서 관리</h4>
                        <form onSubmit={handleAddDept} className="flex gap-2">
                            <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="새 부서 이름" className="flex-grow bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-emerald-500 outline-none" />
                            <button type="submit" className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"><PlusIcon className="h-4 w-4"/></button>
                        </form>
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {departments.map(d => (
                                <div key={d.id} className="flex justify-between items-center bg-gray-100/50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-200 dark:border-gray-700/50">
                                    <span className="text-sm text-gray-800 dark:text-gray-200 font-bold">{d.name}</span>
                                    <button onClick={() => onDeleteDepartment(d.id)} className="text-gray-500 hover:text-red-400 p-1"><XMarkIcon className="h-4 w-4"/></button>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-5">
                        <h4 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest border-b border-blue-500/20 dark:border-blue-400/20 pb-2">직원 관리</h4>
                        <form onSubmit={handleAddEmp} className="flex flex-col gap-2">
                             <div className="flex gap-2">
                                <select value={newEmpDeptId} onChange={e => setNewEmpDeptId(e.target.value)} className="w-1/3 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none appearance-none">
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <input type="text" value={newEmpName} onChange={e => setNewEmpName(e.target.value)} placeholder="새 직원 이름" className="flex-grow bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 outline-none" />
                                <button type="submit" className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"><PlusIcon className="h-4 w-4"/></button>
                            </div>
                        </form>
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                            {employees.map(e => {
                                const deptName = departments.find(d => d.id === e.departmentId)?.name || 'Unknown';
                                return (
                                    <div key={e.id} className="flex justify-between items-center bg-gray-100/50 dark:bg-gray-700/30 p-2 rounded-lg border border-gray-200 dark:border-gray-700/50">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-800 dark:text-gray-200 font-bold">{e.name}</span>
                                            <span className="text-[10px] text-gray-500 uppercase">{deptName}</span>
                                        </div>
                                        <button onClick={() => onDeleteEmployee(e.id)} className="text-gray-500 hover:text-red-400 p-1"><XMarkIcon className="h-4 w-4"/></button>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                    </>
                )}
            </div>
        </ModalBase>
    );
};

const AuthModal: FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = ({ isOpen, onClose, onSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setError(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (verifyAdminPassword(password)) {
            onSuccess();
            onClose();
        } else {
            setError(true);
            setPassword('');
        }
    };

    return (
        <ModalBase isOpen={isOpen} onClose={onClose} title="관리자 인증">
            <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="p-4 bg-gray-100 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <p className="text-sm text-gray-600 dark:text-gray-300 text-center">설정 메뉴에 접근하려면 비밀번호를 입력하세요.</p>
                </div>
                <div>
                    <input 
                        ref={inputRef}
                        type="password" 
                        value={password} 
                        onChange={e => { setPassword(e.target.value); setError(false); }} 
                        placeholder="비밀번호 입력" 
                        className={`w-full bg-gray-50 dark:bg-gray-900/50 border ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 dark:border-gray-600 focus:ring-indigo-500'} rounded-xl p-4 text-gray-900 dark:text-white text-lg text-center tracking-widest focus:ring-2 outline-none transition-all`} 
                        autoFocus
                    />
                    {error && <p className="text-red-500 dark:text-red-400 text-xs font-bold text-center mt-2 animate-pulse">비밀번호가 일치하지 않습니다.</p>}
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">확인</button>
            </form>
        </ModalBase>
    );
};

// --- Task/Project Management Modals ---

const AVAILABLE_COLORS = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 
    'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 
    'bg-rose-500', 'bg-red-500', 'bg-orange-500', 
    'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 
    'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-gray-500'
];

// 하나의 달력에서 시작일~종료일 범위를 선택하는 컴포넌트
const RangeCalendar: FC<{ startDate: string; endDate: string; onChange: (start: string, end: string) => void; onComplete?: () => void; single?: boolean }> = ({ startDate, endDate, onChange, onComplete, single }) => {
    const [viewDate, setViewDate] = useState(() => {
        const d = startDate ? new Date(startDate) : new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [selecting, setSelecting] = useState(false); // true = 종료일 선택 대기 중
    const [hoverDate, setHoverDate] = useState<string | null>(null);

    // 시작일이 바뀌면 해당 월로 이동 (모달 재사용 시 이전 태스크 월이 남는 것 방지)
    useEffect(() => {
        if (startDate) {
            const d = new Date(startDate);
            setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
        }
    }, [startDate]);

    const todayStr = formatDate(new Date());
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < firstDayOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(formatDate(new Date(year, month, d)));

    const handleDayClick = (dstr: string) => {
        if (single) {
            // 단일 날짜 선택 모드: 한 번 클릭으로 완료
            onChange(dstr, dstr);
            if (onComplete) onComplete();
            return;
        }
        if (!selecting || dstr < startDate) {
            // 새 범위 시작 (종료일 선택 중에 시작일보다 앞을 클릭해도 새로 시작)
            onChange(dstr, dstr);
            setSelecting(true);
        } else {
            onChange(startDate, dstr);
            setSelecting(false);
            setHoverDate(null);
            if (onComplete) onComplete();
        }
    };

    // 종료일 선택 중에는 호버 위치까지를 미리보기 범위로 표시
    const rangeEnd = selecting ? (hoverDate && hoverDate > startDate ? hoverDate : startDate) : endDate;
    const isInRange = (dstr: string) => !!startDate && dstr >= startDate && dstr <= rangeEnd;
    const isEndpoint = (dstr: string) => dstr === startDate || dstr === rangeEnd;

    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

    return (
        <div className="bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 select-none">
            <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"><ChevronLeftIcon className="h-4 w-4" /></button>
                <span className="text-sm font-black text-gray-800 dark:text-gray-100">{year}년 {month + 1}월</span>
                <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((w, i) => (
                    <div key={w} className={`h-6 flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>{w}</div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5" onMouseLeave={() => setHoverDate(null)}>
                {cells.map((dstr, i) => {
                    if (!dstr) return <div key={`empty-${i}`} />;
                    const endpoint = isEndpoint(dstr);
                    const inRange = isInRange(dstr);
                    const isToday = dstr === todayStr;
                    return (
                        <button
                            type="button"
                            key={dstr}
                            onClick={() => handleDayClick(dstr)}
                            onMouseEnter={() => selecting && setHoverDate(dstr)}
                            className={`h-8 flex items-center justify-center text-xs transition-colors cursor-pointer
                                ${endpoint ? 'bg-indigo-600 text-white font-black rounded-lg shadow-md shadow-indigo-500/30'
                                    : inRange ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg'}
                                ${isToday && !endpoint ? 'ring-1 ring-inset ring-indigo-400 rounded-lg font-black' : ''}`}
                        >
                            {parseInt(dstr.slice(8))}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 text-center text-[11px] font-bold text-gray-600 dark:text-gray-300">
                {single
                    ? <span>이동할 날짜를 선택하세요</span>
                    : selecting
                        ? <span className="text-indigo-500 dark:text-indigo-400 animate-pulse">종료일을 선택하세요 ({startDate} ~ )</span>
                        : startDate && endDate
                            ? <span>{startDate} ~ {endDate} · <span className="text-indigo-600 dark:text-indigo-400">{getDaysBetween(new Date(startDate), new Date(endDate))}일</span></span>
                            : <span>시작일을 선택하세요</span>}
            </div>
        </div>
    );
};

const TaskModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    // onSubmit 타입에 color 추가
    onSubmit: (data: { name: string; employeeId: string; startDate: string; duration: number; description: string; color: string }) => Promise<void>;
    employees: Employee[];
    departments: Department[];
    task?: Task;
    project: Project | null;
}> = ({ isOpen, onClose, onSubmit, employees, departments, task, project }) => {
    const [name, setName] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [selectedDeptId, setSelectedDeptId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [duration, setDuration] = useState(1);
    const [description, setDescription] = useState('');
    const [color, setColor] = useState('bg-blue-500'); // 기본값 파랑
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const prevIsOpenRef = useRef(false);

    useEffect(() => {
        if (isOpen && !prevIsOpenRef.current) {
            setIsCalendarOpen(false);
            if (task) {
                setName(task.name);
                setEmployeeId(task.employeeId);
                const assignedEmp = employees.find(e => e.id === task.employeeId);
                if (assignedEmp) setSelectedDeptId(assignedEmp.departmentId);
                else if (departments.length > 0) setSelectedDeptId(departments[0].id);

                setStartDate(formatDate(new Date(task.startDate)));
                setEndDate(formatDate(new Date(task.endDate)));
                setDuration(getDaysBetween(new Date(task.startDate), new Date(task.endDate)));
                setDescription(task.description || '');
                setColor(task.color || 'bg-blue-500'); // 기존 색상 불러오기
            } else {
                setName('');
                const defaultDept = departments[0];
                setSelectedDeptId(defaultDept ? defaultDept.id : '');
                const defaultEmp = employees.find(e => e.departmentId === (defaultDept ? defaultDept.id : '')) || employees[0];
                setEmployeeId(defaultEmp ? defaultEmp.id : '');
                setStartDate(formatDate(new Date()));
                setEndDate(formatDate(addDays(new Date(), 2)));
                setDuration(3);
                setDescription('');
                setColor('bg-blue-500'); // 새 태스크 기본값
            }
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, task, employees, departments]);

    const handleDeptChange = (newDeptId: string) => {
        setSelectedDeptId(newDeptId);
        const empsInDept = employees.filter(e => e.departmentId === newDeptId);
        if (empsInDept.length > 0) setEmployeeId(empsInDept[0].id);
        else setEmployeeId('');
    };

    // 달력에서 범위 선택 → 기간 자동 계산 / 기간 입력 → 종료일 자동 계산
    const handleRangeChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
        setDuration(getDaysBetween(new Date(start), new Date(end)));
    };
    const handleDurationChange = (value: number) => {
        const d = Math.max(1, isNaN(value) ? 1 : value);
        setDuration(d);
        if (startDate) setEndDate(formatDate(addDays(new Date(startDate), d - 1)));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId) { alert('담당자를 선택해주세요.'); return; }
        setIsSubmitting(true);
        try {
            // color 정보도 같이 보냄
            await onSubmit({ name, employeeId, startDate, duration, description, color });
        } finally { setIsSubmitting(false); }
    };

    const filteredEmployees = useMemo(() => {
        if (!selectedDeptId) return employees;
        return employees.filter(e => e.departmentId === selectedDeptId);
    }, [employees, selectedDeptId]);

    // Tailwind가 색상을 못 읽을 때를 대비해 스타일 직접 주입용 맵 (아까 만든거 활용)
    const getColorStyle = (c: string) => {
        // TaskBar 위에 정의했던 COLOR_MAP이 있다고 가정하거나, 간단히 직접 변환
        const map: Record<string, string> = {
            'bg-rose-500': '#f43f5e', 'bg-amber-500': '#f59e0b', 'bg-orange-500': '#f97316',
            'bg-blue-500': '#3b82f6', 'bg-indigo-500': '#6366f1', 'bg-emerald-500': '#10b981',
            'bg-red-500': '#ef4444', 'bg-green-500': '#22c55e', 'bg-purple-500': '#a855f7',
            'bg-gray-500': '#6b7280', 'bg-violet-500': '#8b5cf6', 'bg-fuchsia-500': '#d946ef',
            'bg-pink-500': '#ec4899', 'bg-teal-500': '#14b8a6', 'bg-cyan-500': '#06b6d4',
            'bg-sky-500': '#0ea5e9'
        };
        return map[c] || '#6366f1';
    };

    return (
        <ModalBase isOpen={isOpen} onClose={onClose} title={task ? '태스크 수정' : '새 태스크 추가'}>
            <form onSubmit={handleFormSubmit} className="space-y-4">
                {project && <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-black uppercase tracking-widest mb-1 px-1">PROJECT: {project.name}</div>}
                
                {/* 1. 이름 입력 */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-bold ml-1">태스크 이름</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="작업 내용을 입력하세요" className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                </div>
                
                {/* 2. 색상 선택 (추가된 부분) */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-bold ml-1">색상 선택</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-xl">
                        {AVAILABLE_COLORS.map((c) => (
                            <button
                                type="button"
                                key={c}
                                onClick={() => setColor(c)}
                                className={`w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none ring-2 ${color === c ? 'ring-gray-900 dark:ring-white scale-110' : 'ring-transparent'}`}
                                style={{ backgroundColor: getColorStyle(c) }}
                            />
                        ))}
                    </div>
                </div>

                {/* 3. 부서 및 담당자 */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-bold ml-1">부서 선택</label>
                        <select value={selectedDeptId} onChange={e => handleDeptChange(e.target.value)} className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer">
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-gray-500 font-bold ml-1">담당자</label>
                        <select value={employeeId} onChange={e => setEmployeeId(e.target.value)} disabled={filteredEmployees.length === 0} className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-50">
                             {filteredEmployees.length === 0 ? <option>직원 없음</option> : filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                    </div>
                </div>

                {/* 4. 날짜 및 기간 — 달력 아이콘 클릭 시 범위 선택 달력 표시 */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-bold ml-1">일정</label>
                    <button type="button" onClick={() => setIsCalendarOpen(v => !v)} className="w-full flex items-center gap-3 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-left focus:ring-2 focus:ring-indigo-500 outline-none transition-all hover:border-indigo-400 dark:hover:border-indigo-500">
                        <CalendarIcon className={`h-5 w-5 flex-shrink-0 ${isCalendarOpen ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <span className="text-gray-900 dark:text-white text-sm font-bold">{startDate} ~ {endDate}</span>
                        <span className="ml-auto text-xs font-black text-indigo-600 dark:text-indigo-400">{duration}일</span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isCalendarOpen && (
                        <RangeCalendar startDate={startDate} endDate={endDate} onChange={handleRangeChange} onComplete={() => setIsCalendarOpen(false)} />
                    )}
                </div>
                <div className="space-y-1">
                     <label className="text-xs text-gray-500 font-bold ml-1">기간 (일) — 직접 입력하면 종료일이 자동 계산됩니다</label>
                     <input type="number" min="1" value={duration} onChange={e => handleDurationChange(parseInt(e.target.value))} className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required />
                </div>
                
                {/* 5. 설명 */}
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-bold ml-1">상세 설명</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all" placeholder="구체적인 내용을 입력하세요" />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 mt-4 active:scale-95">
                    {isSubmitting ? '저장 중...' : '저장 완료'}
                </button>
            </form>
        </ModalBase>
    );
};

const ProjectModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (name: string) => Promise<void>;
    project: Project | null;
}> = ({ isOpen, onClose, onSubmit, project }) => {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const prevIsOpenRef = useRef(false);

    useEffect(() => { 
        if (isOpen && !prevIsOpenRef.current) {
            setName(project?.name || ''); 
        }
        prevIsOpenRef.current = isOpen;
    }, [isOpen, project]);
    
    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        setIsSubmitting(true);
        try {
            await onSubmit(name);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <ModalBase isOpen={isOpen} onClose={onClose} title={project ? '프로젝트 수정' : '새 프로젝트 추가'}>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-xs text-gray-500 font-bold ml-1">프로젝트 명칭</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="프로젝트 이름을 입력하세요" className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-xl p-4 text-lg font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all" required autoFocus />
                </div>
                <button type="submit" disabled={isSubmitting} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                    {isSubmitting ? '처리 중...' : '프로젝트 생성'}
                </button>
            </form>
        </ModalBase>
    );
};

const ConfirmationModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    title: string;
    message: string;
}> = ({ isOpen, onClose, onConfirm, title, message }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalBase isOpen={isOpen} onClose={onClose} title={title}>
            <div className="space-y-8">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                    <p className="text-gray-700 dark:text-gray-200 leading-relaxed text-sm text-center">{message}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onClose} disabled={isSubmitting} className="py-4 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50">취소</button>
                    <button onClick={handleConfirm} disabled={isSubmitting} className="py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl transition-all shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50">
                        {isSubmitting ? '삭제 중...' : '삭제 확인'}
                    </button>
                </div>
            </div>
        </ModalBase>
    );
};

// --- Main Components ---

const Header: FC<{
    departments: Department[];
    filter: { departmentId: string; employeeId: string };
    setFilter: React.Dispatch<React.SetStateAction<{ departmentId: string; employeeId: string }>>;
    viewStartDate: Date;
    setViewStartDate: React.Dispatch<React.SetStateAction<Date>>;
    onOpenSettings: () => void;
    isOnline: boolean;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}> = ({ departments, filter, setFilter, viewStartDate, setViewStartDate, onOpenSettings, isOnline, isDarkMode, toggleDarkMode }) => {
    const employeesInSelectedDept = useMemo(() => {
        if (filter.departmentId === 'all' || !departments) return [];
        return departments.find(d => d.id === filter.departmentId)?.employees || [];
    }, [filter.departmentId, departments]);

    const handleDateShift = (days: number) => setViewStartDate(currentDate => addDays(currentDate, days));
    const goToToday = () => { const today = new Date(); today.setDate(today.getDate() - 2); today.setHours(0,0,0,0); setViewStartDate(today); }

    // 달력 아이콘으로 특정 날짜로 바로 이동 (오늘 버튼과 동일하게 선택일이 앞에서 3번째 칸에 오도록 -2일)
    const [isJumpOpen, setIsJumpOpen] = useState(false);
    const jumpAnchor = formatDate(addDays(viewStartDate, 2));
    const handleJump = (dstr: string) => {
        const d = new Date(dstr);
        d.setHours(0, 0, 0, 0);
        setViewStartDate(addDays(d, -2));
    };

    return (
        <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-3 sm:p-5 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl shadow-lg transition-colors ${isOnline ? 'bg-indigo-600 shadow-indigo-600/30' : 'bg-gray-200 dark:bg-gray-700 shadow-gray-300 dark:shadow-gray-700/30'}`}>
                        <CalendarIcon className={`h-6 w-6 ${isOnline ? 'text-white' : 'text-gray-500 dark:text-gray-300'}`} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">다현산업 <span className="text-indigo-600 dark:text-indigo-400">일정 플래너</span></h1>
                        <div className="flex items-center gap-2">
                             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Team Productivity Suite</p>
                             {isOnline && <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>Live Sync</span>}
                        </div>
                    </div>
                    <div className="flex items-center ml-2 gap-2">
                        <button onClick={toggleDarkMode} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-indigo-500/20 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-gray-200 dark:border-gray-700 hover:border-indigo-500/50 shadow-inner group">
                            {isDarkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                        </button>
                        <button onClick={onOpenSettings} className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-indigo-500/20 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all border border-gray-200 dark:border-gray-700 hover:border-indigo-500/50 shadow-inner group">
                            <CogIcon className="h-5 w-5 group-hover:rotate-90 transition-transform duration-700" />
                        </button>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
                    <div className="flex gap-2 flex-grow sm:flex-grow-0 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-xl px-3 border border-gray-200 dark:border-gray-700 shrink-0 transition-colors">
                            <FilterIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400 mr-3"/>
                            <select value={filter.departmentId} onChange={e => setFilter({ departmentId: e.target.value, employeeId: 'all' })} className="bg-transparent py-3 pl-1 pr-8 text-sm font-bold text-gray-700 dark:text-gray-200 rounded-xl focus:outline-none appearance-none cursor-pointer">
                                <option value="all">부서 전체</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center bg-gray-100 dark:bg-gray-800/80 rounded-xl px-3 border border-gray-200 dark:border-gray-700 shrink-0 transition-colors">
                            <select value={filter.employeeId} onChange={e => setFilter(f => ({ ...f, employeeId: e.target.value }))} disabled={filter.departmentId === 'all'} className="bg-transparent py-3 pl-1 pr-8 text-sm font-bold text-gray-700 dark:text-gray-200 rounded-xl focus:outline-none disabled:opacity-30 appearance-none cursor-pointer">
                                <option value="all">직원 전체</option>
                                {employeesInSelectedDept.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-start gap-3 bg-white/50 dark:bg-gray-800/40 rounded-2xl p-1.5 border border-gray-200 dark:border-gray-700/50 transition-colors">
                        <button onClick={() => handleDateShift(-7)} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white active:scale-90"><ChevronLeftIcon className="h-5 w-5" /></button>
                        <button onClick={goToToday} className="flex items-center gap-2.5 px-5 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white shadow-sm">오늘</button>
                        <div className="relative">
                            <button onClick={() => setIsJumpOpen(v => !v)} title="특정 날짜로 이동" className={`p-2.5 rounded-xl transition-all active:scale-90 ${isJumpOpen ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}><CalendarIcon className="h-5 w-5" /></button>
                            {isJumpOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsJumpOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
                                        <RangeCalendar single startDate={jumpAnchor} endDate={jumpAnchor} onChange={(s) => handleJump(s)} onComplete={() => setIsJumpOpen(false)} />
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={() => handleDateShift(7)} className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-gray-400 hover:text-gray-900 dark:hover:text-white active:scale-90"><ChevronRightIcon className="h-5 w-5" /></button>
                    </div>
                </div>
            </div>
        </header>
    );
};

const TimelineHeader: FC<{ dates: Date[], todayString: string; dayWidth: number; fontSize: number }> = ({ dates, todayString, dayWidth, fontSize }) => {
    return (
        <div className="flex" style={{ height: '100%' }}>
            {dates.map((date, index) => {
                const day = date.getDay();
                const isWeekend = day === 0 || day === 6;
                const isToday = formatDate(date) === todayString;
                return (
                    <div key={index} className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-800 ${isWeekend ? 'bg-gray-100/50 dark:bg-gray-800/40' : ''} ${isToday ? 'bg-yellow-100 dark:bg-yellow-400/10' : ''}`} style={{ width: dayWidth }}>
                        <div className={`leading-tight uppercase opacity-50 font-black mb-0.5`} style={{ fontSize: fontSize * 0.8 }}>{date.toLocaleString('ko-KR', { weekday: 'short' })}</div>
                        <div className={`font-black ${isToday ? 'text-yellow-600 dark:text-yellow-400 animate-pulse' : 'text-gray-700 dark:text-gray-300'}`} style={{ fontSize: fontSize }}>{date.getDate()}</div>
                    </div>
                );
            })}
        </div>
    );
};

const TaskBar: FC<{
    task: Task;
    viewStartDate: Date;
    onProgressChange: (newProgress: number) => void;
    employeeMap: Map<string, Employee>;
    departmentMap: Map<string, Department>;
    dayWidth: number;
    barHeight: number;
    fontSize: number;
}> = ({ task, viewStartDate, onProgressChange, employeeMap, departmentMap, dayWidth, barHeight, fontSize }) => {
    const barRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const startDate = new Date(task.startDate);
    const endDate = new Date(task.endDate);
    const startOffsetDays = getDaysBetween(viewStartDate, startDate) - 1;
    const durationDays = getDaysBetween(startDate, endDate);
    const left = startOffsetDays * dayWidth;
    const width = durationDays * dayWidth - 4;
    // Remove fixed limit check to allow infinite scrolling if implemented, 
    // but for now we just check if it's completely off-screen to the left
    if (left + width < 0) return null;

    const employee = employeeMap.get(task.employeeId);
    const department = employee ? departmentMap.get(employee.departmentId) : undefined;

    const tooltipContent = (
        <div className="space-y-3 w-64 p-1">
            <p className="font-black text-lg text-indigo-600 dark:text-indigo-300 tracking-tight leading-tight">{task.name}</p>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 space-y-2 font-bold uppercase tracking-wider">
                <div className="flex items-center justify-between"><span className="opacity-50">담당</span> <span>{employee?.name} ({department?.name})</span></div>
                <div className="flex items-center justify-between"><span className="opacity-50">기간</span> <span>{formatDate(startDate)} ~ {formatDate(endDate)}</span></div>
                <div className="pt-2">
                    <div className="flex items-center justify-between mb-1.5"><span className="opacity-50">진행률</span> <span className="text-gray-900 dark:text-white">{task.progress}%</span></div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${task.color} opacity-80`} style={{ width: `${task.progress}%` }}></div>
                    </div>
                </div>
            </div>
            {task.description && (
                <div className="pt-3 border-t border-gray-200 dark:border-gray-700 mt-2">
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">{task.description}</p>
                </div>
            )}
        </div>
    );

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (window.matchMedia("(pointer: coarse)").matches) return;
        e.preventDefault(); e.stopPropagation();
        isDraggingRef.current = true;
        const updateProgress = (clientX: number) => {
            if(!barRef.current) return;
            const rect = barRef.current.getBoundingClientRect();
            let newProgress = ((clientX - rect.left) / rect.width) * 100;
            newProgress = Math.max(0, Math.min(100, Math.round(newProgress)));
            onProgressChange(newProgress);
        };
        const handleMouseMove = (moveEvent: MouseEvent) => { if (isDraggingRef.current) updateProgress(moveEvent.clientX); };
        const handleMouseUp = () => { isDraggingRef.current = false; document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
        document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    };

    const textOffset = `max(0px, calc(var(--gantt-scroll-left, 0px) - ${left}px))`;
    const visibleBarWidth = `calc(${width}px - ${textOffset})`;

    return (
        <div className="absolute top-1/2 -translate-y-1/2" style={{ left, height: barHeight }}>
            <div style={{ width: Math.max(0, width), height: '100%' }}>
                <Tooltip content={tooltipContent}>
                    <div ref={barRef} onMouseDown={handleMouseDown} className="w-full h-full rounded-xl bg-white dark:bg-gray-800/90 shadow-md dark:shadow-2xl hover:ring-2 hover:ring-indigo-500/40 dark:hover:ring-white/40 transition-all duration-300 cursor-pointer flex items-center overflow-hidden border border-gray-200 dark:border-white/5">
                        <div className={`h-full ${task.color} pointer-events-none transition-all duration-500 opacity-80 dark:opacity-70`} style={{ width: `${task.progress}%` }}></div>
                    </div>
                </Tooltip>
            </div>
            <div className="absolute top-0 h-full flex items-center pointer-events-none" style={{ transform: `translateX(${textOffset})`}}>
                <span className="font-black text-gray-700 dark:text-white px-4 truncate drop-shadow-sm dark:drop-shadow-xl tracking-tight mix-blend-difference dark:mix-blend-normal" style={{ maxWidth: visibleBarWidth, fontSize }}>
                    {task.name}
                </span>
            </div>
        </div>
    );
};

const ProjectBar: FC<{ project: Project; viewStartDate: Date; dayWidth: number; barHeight: number; fontSize: number }> = ({ project, viewStartDate, dayWidth, barHeight, fontSize }) => {
    if (project.tasks.length === 0) return null;
    const startDates = project.tasks.map(t => new Date(t.startDate));
    const endDates = project.tasks.map(t => new Date(t.endDate));
    const projectStartDate = new Date(Math.min(...startDates.map(d => d.getTime())));
    const projectEndDate = new Date(Math.max(...endDates.map(d => d.getTime())));
    const totalProgress = project.tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
    const averageProgress = project.tasks.length > 0 ? Math.round(totalProgress / project.tasks.length) : 0;
    const startOffsetDays = getDaysBetween(viewStartDate, projectStartDate) - 1;
    const durationDays = getDaysBetween(projectStartDate, projectEndDate);
    const left = startOffsetDays * dayWidth;
    const width = durationDays * dayWidth - 4;
    // Removed strict max-width check
    if (left + width < 0) return null;

    const textOffset = `max(0px, calc(var(--gantt-scroll-left, 0px) - ${left}px))`;
    const visibleBarWidth = `calc(${width}px - ${textOffset})`;

    return (
        <div className="absolute top-1/2 -translate-y-1/2 flex items-center" style={{ left, height: barHeight, width: Math.max(0, width) }}>
            <Tooltip content={<div className="text-xs p-2 font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-200">{project.name} <br/><span className="text-gray-900 dark:text-white">{averageProgress}% COMPLETE</span></div>}>
                <div className="relative w-full h-full flex items-center group cursor-pointer">
                    {/* Glow & Track Background */}
                    <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* Horizontal Body (The Track) - Thick body with border */}
                        <div className="absolute w-full h-8 bg-white dark:bg-gray-900/90 border border-gray-300 dark:border-indigo-500/50 rounded-sm overflow-hidden shadow-lg backdrop-blur-sm z-10">
                            {/* Inner Progress Fill */}
                            <div className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 dark:from-indigo-700 dark:via-indigo-600 dark:to-indigo-500 transition-all duration-700 relative" style={{ width: `${averageProgress}%` }}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
                            </div>
                        </div>

                        {/* Traditional Gantt Brackets (Summary Marks) */}
                        {/* Start (Left) Bracket */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-[6px] border-l-4 border-t-4 border-b-4 border-indigo-500 dark:border-indigo-400 rounded-l-sm z-20"></div>
                        
                        {/* End (Right) Bracket */}
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-10 w-[6px] border-r-4 border-t-4 border-b-4 border-indigo-500 dark:border-indigo-400 rounded-r-sm z-20"></div>
                    </div>

                    {/* Project Label Overlay — 바 너비를 벗어나는 글자는 숨김 */}
                    <div className="absolute top-0 left-0 h-full w-full overflow-hidden pointer-events-none z-30">
                        <div className="h-full flex items-center" style={{ transform: `translateX(${textOffset})` }}>
                            <span className="font-bold text-gray-900 dark:text-white px-3 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-[0_2px_4px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" style={{ maxWidth: visibleBarWidth, fontSize: fontSize + 1 }}>
                                {project.name} <span className="ml-1 text-indigo-600 dark:text-indigo-300">{averageProgress}%</span>
                            </span>
                        </div>
                    </div>
                </div>
            </Tooltip>
        </div>
    );
};

const TimelineGridBackground: FC<{ dates: Date[], todayString: string, sidebarWidth: number, dayWidth: number }> = ({ dates, todayString, sidebarWidth, dayWidth }) => (
    <div className="absolute top-0 left-0 h-full w-full flex pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth }}></div>
        <div className="flex-grow flex h-full">
            {dates.map((date, index) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = formatDate(date) === todayString;
                return (
                    <div key={index} className={`h-full border-r border-gray-200/60 dark:border-gray-800/40 ${isWeekend ? 'bg-gray-50/50 dark:bg-gray-800/10' : ''} ${isToday ? 'bg-yellow-50/50 dark:bg-yellow-400/5' : ''}`} style={{ width: dayWidth, minWidth: dayWidth }} />
                );
            })}
        </div>
    </div>
);

const GanttView: FC<{
    projects: Project[];
    timelineDates: Date[];
    viewStartDate: Date;
    todayString: string;
    employeeMap: Map<string, Employee>;
    departmentMap: Map<string, Department>;
    expandedProjects: Record<string, boolean>;
    toggleProjectExpansion: (projectId: string) => void;
    onAddTaskClick: (projectId: string) => void;
    onAddProjectClick: () => void;
    onTaskProgressChange: (projectId: string, taskId: string, progress: number) => void;
    onEditProject: (project: Project) => void;
    onDeleteProject: (project: Project) => void;
    onEditTask: (task: Task, projectId: string) => void;
    onDeleteTask: (task: Task, projectId: string) => void;
    columnWidths: typeof DEFAULT_COLUMN_WIDTHS;
    setColumnWidths: React.Dispatch<React.SetStateAction<typeof DEFAULT_COLUMN_WIDTHS>>;
    onReorderProjects: (draggedId: string, targetId: string) => void;
    onReorderTasks: (projectId: string, draggedId: string, targetId: string) => void;
    uiSettings: UISettings;
}> = ({ projects, timelineDates, viewStartDate, todayString, employeeMap, departmentMap, expandedProjects, toggleProjectExpansion, onAddTaskClick, onAddProjectClick, onTaskProgressChange, onEditProject, onDeleteProject, onEditTask, onDeleteTask, columnWidths, setColumnWidths, onReorderProjects, onReorderTasks, uiSettings }) => {
    
    const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<{pid: string, tid: string} | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => { const checkMobile = () => setIsMobile(window.innerWidth < 768); checkMobile(); window.addEventListener('resize', checkMobile); return () => window.removeEventListener('resize', checkMobile); }, []);
    const visibleColumnWidths = useMemo<typeof DEFAULT_COLUMN_WIDTHS>(() => isMobile ? { project: Math.max(140, columnWidths.project * 0.7), department: 0, author: 0, progress: 0 } : columnWidths, [isMobile, columnWidths]);
    const sidebarWidth = (Object.values(visibleColumnWidths) as number[]).reduce((sum, width) => sum + width, 0);
    const timelineWidth: number = timelineDates.length * uiSettings.dayWidth;

    const handleResizeMouseDown = (e: React.MouseEvent, columnKey: keyof typeof columnWidths) => {
        if (isMobile) return; e.preventDefault(); e.stopPropagation();
        const startX = e.clientX; const startWidth: number = columnWidths[columnKey];
        const handleMouseMove = (mv: MouseEvent) => setColumnWidths(prev => ({ ...prev, [columnKey]: Math.max(MIN_COLUMN_WIDTH, startWidth + (mv.clientX - startX)) }));
        const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); };
        document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => { const sl = e.currentTarget.scrollLeft; e.currentTarget.style.setProperty('--gantt-scroll-left', `${sl}px`); setScrollLeft(sl); };

    if (projects.length === 0) return <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4"><FilterIcon className="h-12 w-12 opacity-20" /><p className="font-bold tracking-tight">일치하는 결과가 없습니다.</p></div>;

    return (
        <div onScroll={handleScroll} className="flex-grow overflow-auto border border-gray-200 dark:border-gray-800 rounded-3xl shadow-inner bg-white/40 dark:bg-gray-950/40 relative no-scrollbar transition-colors">
            <div style={{ width: sidebarWidth + timelineWidth, position: 'relative' }}>
                <div className="flex flex-shrink-0 sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl transition-colors" style={{ height: uiSettings.rowHeight }}>
                    <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex items-center text-[9px] uppercase font-black text-gray-500 border-r border-b border-gray-200 dark:border-gray-800 sticky left-0 z-30 bg-gray-50 dark:bg-gray-900 transition-colors">
                        <div style={{ width: visibleColumnWidths.project }} className="px-5 flex items-center justify-between h-full relative">
                            <span>NAME / TASK</span>
                            <button onClick={onAddProjectClick} className="p-1.5 rounded-lg text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-400/20 active:scale-90 transition-all"><PlusIcon className="h-3.5 w-3.5" /></button>
                            {!isMobile && <Resizer onMouseDown={e => handleResizeMouseDown(e, 'project')} />}
                        </div>
                        {visibleColumnWidths.department > 0 && <div style={{ width: visibleColumnWidths.department }} className="px-5 border-l border-gray-200 dark:border-gray-800 h-full flex items-center relative truncate"><span>DEPT</span><Resizer onMouseDown={e => handleResizeMouseDown(e, 'department')} /></div>}
                        {visibleColumnWidths.author > 0 && <div style={{ width: visibleColumnWidths.author }} className="px-5 border-l border-gray-200 dark:border-gray-800 h-full flex items-center relative truncate"><span>OWNER</span><Resizer onMouseDown={e => handleResizeMouseDown(e, 'author')} /></div>}
                        {visibleColumnWidths.progress > 0 && <div style={{ width: visibleColumnWidths.progress }} className="px-5 border-l border-gray-200 dark:border-gray-800 h-full flex items-center relative truncate"><span>PROG</span><Resizer onMouseDown={e => handleResizeMouseDown(e, 'progress')} /></div>}
                    </div>
                    <div className="border-b border-gray-200 dark:border-gray-800 flex-grow"><TimelineHeader dates={timelineDates} todayString={todayString} dayWidth={uiSettings.dayWidth} fontSize={uiSettings.headerFontSize} /></div>
                </div>

                <div className="relative">
                     <TimelineGridBackground dates={timelineDates} todayString={todayString} sidebarWidth={sidebarWidth} dayWidth={uiSettings.dayWidth} />
                    {projects.map(project => {
                        const isExpanded = expandedProjects[project.id] ?? true;
                        const totalProgress = project.tasks.reduce((sum, task) => sum + (task.progress || 0), 0);
                        const averageProgress = project.tasks.length > 0 ? Math.round(totalProgress / project.tasks.length) : 0;
                        return (
                        <div key={project.id} className="relative" onDragOver={e => e.preventDefault()} onDrop={e => {
                            const pId = e.dataTransfer.getData('projectId');
                            const targetPId = project.id;
                            if (pId && pId !== targetPId) onReorderProjects(pId, targetPId);
                        }}>
                            <div className={`flex items-center hover:bg-indigo-500/[0.03] group transition-all duration-300 border-b border-gray-200 dark:border-gray-800/40`} style={{ height: uiSettings.rowHeight }}>
                                <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex border-r border-gray-200 dark:border-gray-800 sticky left-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md h-full shadow-sm dark:shadow-2xl transition-colors">
                                    <div style={{ width: visibleColumnWidths.project }} className="flex items-center pl-1 pr-2 sm:pr-5 text-sm font-black text-gray-800 dark:text-gray-100 truncate tracking-tight">
                                        {!isMobile && <div draggable onDragStart={(e) => { e.dataTransfer.setData('projectId', project.id); setDraggedProjectId(project.id); }} onDragEnd={() => {setDraggedProjectId(null); setDropTargetId(null);}} className="cursor-move py-1 mr-0.5 -ml-0.5 text-gray-400 hover:text-gray-900 dark:text-gray-600 dark:hover:text-white transition-colors"><GripVerticalIcon className="h-4 w-3" /></div>}
                                        <div className="flex-grow flex items-center cursor-pointer truncate" onClick={() => toggleProjectExpansion(project.id)}>
                                            <ChevronDownIcon className={`h-3.5 w-3.5 mr-1.5 transition-transform duration-500 ${isExpanded ? 'rotate-0' : '-rotate-90 text-indigo-500 dark:text-indigo-400'}`} />
                                            <FolderIcon className="h-5 w-5 mr-1.5 sm:mr-2 text-indigo-500 shrink-0 opacity-80" />
                                            <span className="truncate">{project.name}</span>
                                        </div>
                                    </div>
                                    {visibleColumnWidths.department > 0 && <div style={{ width: visibleColumnWidths.department }} className="border-l border-gray-200 dark:border-gray-800/40" />}
                                    {visibleColumnWidths.author > 0 && <div style={{ width: visibleColumnWidths.author }} className="relative flex items-center justify-center border-l border-gray-200 dark:border-gray-800/40"><button onClick={(e) => { e.stopPropagation(); onAddTaskClick(project.id); }} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:text-gray-600 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"><PlusIcon className="h-5 w-5" /></button></div>}
                                    {visibleColumnWidths.progress > 0 && <div style={{ width: visibleColumnWidths.progress }} className="relative border-l border-gray-200 dark:border-gray-800/60 flex items-center justify-center gap-3"><span className="text-[11px] font-black text-indigo-600/70 dark:text-indigo-400/70 group-hover:opacity-0 transition-opacity tracking-widest">{averageProgress}%</span><div className="absolute inset-0 flex items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={(e) => { e.stopPropagation(); onEditProject(project); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"><PencilIcon className="h-4 w-4" /></button><button onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 dark:hover:text-red-400 transition-all"><TrashIcon className="h-4 w-4" /></button></div></div>}
                                </div>
                                <div className="relative flex-grow h-full bg-indigo-500/[0.01]">
                                    <ProjectBar project={project} viewStartDate={viewStartDate} dayWidth={uiSettings.dayWidth} barHeight={uiSettings.projectBarHeight} fontSize={uiSettings.fontSize} />
                                </div>
                            </div>
                            {isExpanded && project.tasks.map(task => {
                                const employee = employeeMap.get(task.employeeId);
                                const department = employee ? departmentMap.get(employee.departmentId) : undefined;
                                const startDate = new Date(task.startDate); const endDate = new Date(task.endDate);
                                const startOffsetDays = getDaysBetween(viewStartDate, startDate) - 1;
                                const durationDays = getDaysBetween(startDate, endDate);
                                const left: number = startOffsetDays * uiSettings.dayWidth;
                                const width: number = durationDays * uiSettings.dayWidth - 4;
                                const rightEdgePosition: number = left + width;
                                if (task.progress === 100 && rightEdgePosition < scrollLeft) return null;
                                return (
                                    <div 
                                        className={`flex group border-b border-gray-200/50 dark:border-gray-800/20 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${draggedTaskId?.tid === task.id ? 'opacity-30' : ''}`} 
                                        style={{ height: uiSettings.rowHeight }} 
                                        key={task.id}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={e => {
                                            e.stopPropagation();
                                            const tId = e.dataTransfer.getData('taskId');
                                            const pId = e.dataTransfer.getData('parentProjectId');
                                            if (tId && pId === project.id && tId !== task.id) onReorderTasks(project.id, tId, task.id);
                                        }}
                                    >
                                        <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex border-r border-gray-200 dark:border-gray-800 sticky left-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-sm dark:shadow-lg transition-colors">
                                            <div style={{ width: visibleColumnWidths.project }} className="flex items-center px-4 pl-12 sm:pl-14 truncate relative">
                                                {!isMobile && (
                                                    <div 
                                                        draggable 
                                                        onDragStart={(e) => { 
                                                            e.dataTransfer.setData('taskId', task.id); 
                                                            e.dataTransfer.setData('parentProjectId', project.id);
                                                            setDraggedTaskId({pid: project.id, tid: task.id}); 
                                                        }} 
                                                        onDragEnd={() => setDraggedTaskId(null)}
                                                        className="absolute left-4 cursor-move p-1 text-gray-300 hover:text-gray-900 dark:text-gray-700 dark:hover:text-gray-400 transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <GripVerticalIcon className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                                <p className="text-gray-600 dark:text-gray-400 font-bold truncate tracking-tight transition-colors group-hover:text-gray-900 dark:group-hover:text-white cursor-pointer" style={{ fontSize: uiSettings.fontSize }} onClick={() => onEditTask(task, project.id)}>{task.name}</p>
                                            </div>
                                            {visibleColumnWidths.department > 0 && <div style={{ width: visibleColumnWidths.department }} className="flex items-center px-5 border-l border-gray-200 dark:border-gray-800/30 truncate"><p className="text-gray-500 dark:text-gray-600 text-[10px] font-black uppercase tracking-wider truncate">{department?.name}</p></div>}
                                            {visibleColumnWidths.author > 0 && <div style={{ width: visibleColumnWidths.author }} className="flex items-center px-5 border-l border-gray-200 dark:border-gray-800/30 truncate"><p className="text-gray-500 text-[11px] font-bold truncate">{employee?.name}</p></div>}
                                            {visibleColumnWidths.progress > 0 && <div style={{ width: visibleColumnWidths.progress }} className="flex items-center justify-center px-5 border-l border-gray-200 dark:border-gray-800/30"><div className="flex items-center group-hover:hidden"><span className="text-[10px] font-black text-gray-500 dark:text-gray-600 tracking-tighter">{task.progress}%</span></div><div className="hidden items-center gap-2 group-hover:flex"><button onClick={(e) => { e.stopPropagation(); onEditTask(task, project.id); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all"><PencilIcon className="h-4 w-4" /></button><button onClick={(e) => { e.stopPropagation(); onDeleteTask(task, project.id); }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 dark:hover:text-red-400 transition-all"><TrashIcon className="h-4 w-4" /></button></div></div>}
                                        </div>
                                        <div className="relative flex-grow h-full">
                                            <TaskBar task={task} viewStartDate={viewStartDate} onProgressChange={(np) => onTaskProgressChange(project.id, task.id, np)} employeeMap={employeeMap} departmentMap={departmentMap} dayWidth={uiSettings.dayWidth} barHeight={uiSettings.taskBarHeight} fontSize={uiSettings.fontSize} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )})}
                </div>
            </div>
        </div>
    );
};

const App: FC = () => {
    // State
    const [projects, setProjects] = useState<Project[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [filter, setFilter] = useState({ departmentId: 'all', employeeId: 'all' });
    const [daysInView, setDaysInView] = useState(MIN_DAYS_IN_VIEW);
    
    // Theme State
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return true;
    });

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
    };

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // Optimized: Initialize viewStartDate with function to avoid computation on every render, defaulting to 2 days ago
    const [viewStartDate, setViewStartDate] = useState<Date>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 2);
        d.setHours(0,0,0,0);
        return d;
    });

    const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // UI Settings
    const [uiSettings, setUiSettings] = useState<UISettings>(() => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    });
    const [columnWidths, setColumnWidths] = useState<typeof DEFAULT_COLUMN_WIDTHS>(() => {
        const saved = localStorage.getItem(GANTT_COLUMN_WIDTHS_KEY);
        return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS;
    });

    // Modals
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [projectModal, setProjectModal] = useState<{ open: boolean; project: Project | null }>({ open: false, project: null });
    const [taskModal, setTaskModal] = useState<{ open: boolean; task: Task | null; projectId: string | null }>({ open: false, task: null, projectId: null });
    const [confirmModal, setConfirmModal] = useState<{ open: boolean; type: 'project' | 'task'; id: string; subId?: string; title: string; message: string }>({ open: false, type: 'project', id: '', title: '', message: '' });
    
    const [isOnline, setIsOnline] = useState(true);

    // Calculate dynamic number of days based on width
    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth < 768;
            const currentColumnWidths = isMobile
                ? { project: Math.max(140, columnWidths.project * 0.7), department: 0, author: 0, progress: 0 }
                : columnWidths;
            // FIXED: Changed 'width' to correctly named accumulator variable 'w'
            const sidebarWidth = (Object.values(currentColumnWidths) as number[]).reduce((sum, w) => sum + w, 0);
            
            // Calculate available width for timeline (Total width - sidebar - padding)
            const availableWidth = window.innerWidth - sidebarWidth - 40; // 40px buffer for padding/margins
            
            // Calculate how many days fit
            const calculatedDays = Math.ceil(availableWidth / uiSettings.dayWidth) + 5; // Add extra buffer columns
            
            setDaysInView(Math.max(MIN_DAYS_IN_VIEW, calculatedDays));
        };

        // Initial calculation
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [columnWidths, uiSettings.dayWidth]);

    // Computed
    const todayString = formatDate(new Date());
    
    const timelineDates = useMemo(() => {
        const dates = [];
        for (let i = 0; i < daysInView; i++) {
            dates.push(addDays(viewStartDate, i));
        }
        return dates;
    }, [viewStartDate, daysInView]);

    // Initial Data Load
   const loadData = useCallback(async () => {
        try {
            setErrorMsg(null);
            const [loadedProjects, loadedDepartments, loadedEmployees] = await Promise.all([getProjects(), getDepartments(), getEmployees()]);
            
            // ▼▼▼ [추가] 서버가 안 해줄까봐 화면에서 한번 더 강제로 정렬합니다 (2중 안전장치) ▼▼▼
            loadedProjects.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
            loadedProjects.forEach((p: any) => {
                if (p.tasks) {
                    p.tasks.sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
                }
            });
            // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

            setProjects(loadedProjects); 
            setDepartments(loadedDepartments); 
            setEmployees(loadedEmployees);

            setExpandedProjects(prev => {
                if (Object.keys(prev).length === 0) {
                    return Object.fromEntries(loadedProjects.map((p: any) => [p.id, true]));
                }
                return prev;
            });
            setIsOnline(true);
        } catch (e: any) {
            console.error("Failed to load data", e);
            const msg = e && e.message ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
            setErrorMsg(msg || "데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.");
            setIsOnline(false);
        } finally { setIsLoading(false); }
    }, []);

// --- [여기서부터 복사] 실시간 부드러운 갱신 (Soft Refresh) ---
    useEffect(() => {
        // 1. 소켓 연결
        const socket = io();

        // 2. 서버에서 "업데이트해!" 신호가 오면?
        socket.on('server:update', () => {
            console.log('📢 데이터 변경 감지! 부드럽게 데이터를 갱신합니다.');
            
            // ★ 핵심: 페이지 새로고침 없이 데이터만 쏙 다시 가져옵니다!
            loadData(); 
        });

        // 3. 청소 (컴포넌트 꺼질 때 연결 해제)
        return () => { socket.disconnect(); };
    }, [loadData]);
    // --- [여기까지] ---


    // Initial load on mount
    useEffect(() => {
        loadData();
    }, [loadData]);

    const { employeeMap, departmentMap } = useMemo(() => {
        const eMap = new Map(employees.map(e => [e.id, e]));
        const dMap = new Map(departments.map(d => [d.id, d]));
        return { employeeMap: eMap, departmentMap: dMap };
    }, [employees, departments]);

    const filteredProjects = useMemo(() => {
        if (filter.departmentId === 'all' && filter.employeeId === 'all') return projects;
        return projects.map(p => {
             const filteredTasks = p.tasks?.filter(t => {
                 const emp = employeeMap.get(t.employeeId);
                 if (!emp) return filter.departmentId === 'all' && filter.employeeId === 'all';
                 if (filter.departmentId !== 'all' && emp.departmentId !== filter.departmentId) return false;
                 if (filter.employeeId !== 'all' && emp.id !== filter.employeeId) return false;
                 return true;
             }) || [];
             return { ...p, tasks: filteredTasks };
        }).filter(p => p.tasks.length > 0);
    }, [projects, filter, employeeMap]);

    // Effects for saving settings
    useEffect(() => {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(uiSettings));
    }, [uiSettings]);

    useEffect(() => {
        localStorage.setItem(GANTT_COLUMN_WIDTHS_KEY, JSON.stringify(columnWidths));
    }, [columnWidths]);

    // Handlers
    const handleUiSettingsChange = (newSettings: UISettings) => {
        setUiSettings(newSettings);
    };

    const handleProjectSubmit = async (name: string) => {
        try {
            if (projectModal.project) {
                await updateProject(projectModal.project.id, name);
            } else {
                await addProject(name);
            }
            if (!isOnline) await loadData();
            setProjectModal({ open: false, project: null });
        } catch (e) { console.error(e); alert('Error saving project'); }
    };

const handleTaskSubmit = async (data: { name: string; employeeId: string; startDate: string; duration: number; description: string; color: string }) => {
        if (!taskModal.projectId) return;
        try {
            const start = new Date(data.startDate);
            const end = addDays(start, data.duration - 1); 
            
            if (taskModal.task) {
                await updateTask(taskModal.projectId, taskModal.task.id, {
                    name: data.name,
                    employeeId: data.employeeId,
                    startDate: start,
                    endDate: end,
                    description: data.description,
                    color: data.color // 색상 정보 전달
                });
            } else {
                await addTask(taskModal.projectId, {
                    name: data.name,
                    employeeId: data.employeeId,
                    startDate: start,
                    endDate: end,
                    description: data.description,
                    color: data.color // 색상 정보 전달
                });
            }
            if (!isOnline) await loadData();
            setTaskModal({ open: false, task: null, projectId: null });
        } catch (e) { console.error(e); alert('Error saving task'); }
    };


    const handleDelete = async () => {
        try {
            if (confirmModal.type === 'project') {
                await deleteProject(confirmModal.id);
            } else if (confirmModal.type === 'task' && confirmModal.subId) {
                await deleteTask(confirmModal.id, confirmModal.subId);
            }
            if (!isOnline) await loadData();
            setConfirmModal({ ...confirmModal, open: false });
        } catch(e) { console.error(e); alert('Error deleting'); }
    };

    // Data Management Handlers
    const handleAddDepartment = async (name: string) => {
        try { await addDepartment(name); if (!isOnline) await loadData(); } catch(e) { console.error(e); alert('부서 추가 실패'); }
    };
    const handleDeleteDepartment = async (id: string) => {
        if (!window.confirm('부서를 삭제하면 소속된 직원 정보도 영향을 받을 수 있습니다. 계속하시겠습니까?')) return;
        try { await deleteDepartment(id); if (!isOnline) await loadData(); } catch(e) { console.error(e); alert('부서 삭제 실패'); }
    };
    const handleAddEmployee = async (name: string, deptId: string) => {
        try { await addEmployee(name, deptId); if (!isOnline) await loadData(); } catch(e) { console.error(e); alert('직원 추가 실패'); }
    };
    const handleDeleteEmployee = async (id: string) => {
        if (!window.confirm('직원을 삭제하시겠습니까? 담당 중인 태스크는 담당자 없음 상태로 남습니다.')) return;
        try { await deleteEmployee(id); if (!isOnline) await loadData(); } catch(e) { console.error(e); alert('직원 삭제 실패'); }
    };


    const handleProgressChange = async (projectId: string, taskId: string, progress: number) => {
        setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, progress } : t) };
        }));
        try {
            await updateTask(projectId, taskId, { progress });
        } catch (e) { console.error(e); loadData(); }
    };

    const toggleProjectExpansion = (pid: string) => {
        setExpandedProjects(prev => {
            const current = prev[pid] ?? true;
            return { ...prev, [pid]: !current };
        });
    };

    const handleReorderProjects = async (draggedId: string, targetId: string) => {
        if (draggedId === targetId) return;
        const draggedIndex = projects.findIndex(p => p.id === draggedId);
        const targetIndex = projects.findIndex(p => p.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        
        const newProjects = [...projects];
        const [removed] = newProjects.splice(draggedIndex, 1);
        newProjects.splice(targetIndex, 0, removed);
        
        setProjects(newProjects);
        // 서버에 새 순서 영구 저장
        await updateProjects(newProjects);
    };

    const handleReorderTasks = async (projectId: string, draggedId: string, targetId: string) => {
        const targetProjectIndex = projects.findIndex(p => p.id === projectId);
        if (targetProjectIndex === -1) return;
        
        const project = projects[targetProjectIndex];
        const newTasks = [...project.tasks];
        const draggedIdx = newTasks.findIndex(t => t.id === draggedId);
        const targetIdx = newTasks.findIndex(t => t.id === targetId);
        
        if (draggedIdx === -1 || targetIdx === -1) return;
        
        const [removed] = newTasks.splice(draggedIdx, 1);
        newTasks.splice(targetIdx, 0, removed);
        
        // 상태 업데이트
        const newProjects = [...projects];
        newProjects[targetProjectIndex] = { ...project, tasks: newTasks };
        setProjects(newProjects);
        
        // 서버에 새 순서 영구 저장 (오프라인/온라인 모두 대응)
        await updateTaskPositions(projectId, newTasks);
    };

    const handleOpenSettings = () => {
        if (hasAdminPassword()) {
            setIsAuthModalOpen(true);
        } else {
            setIsSettingsOpen(true);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white min-h-screen flex flex-col items-center justify-center font-sans tracking-tight transition-colors">
                {errorMsg ? (
                    <div className="max-w-md w-full bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl border border-red-500/20 flex flex-col items-center text-center gap-6">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                             <XMarkIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black mb-2">데이터 로드 실패</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                                {errorMsg}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <button onClick={() => window.location.reload()} className="py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl font-bold transition-all">다시 시도</button>
                            <button onClick={() => { setIsLoading(false); setIsSettingsOpen(true); }} className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20">설정 열기</button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 border-[6px] border-indigo-600 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_40px_rgba(79,70,229,0.4)]" />
                        <div className="text-2xl font-black animate-pulse text-indigo-600 dark:text-indigo-300 tracking-tighter uppercase">DAHYUN GANTT IS LOADING...</div>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-200 overflow-hidden font-sans selection:bg-indigo-500/30 transition-colors duration-300">
            <Header 
                departments={departments}
                filter={filter}
                setFilter={setFilter}
                viewStartDate={viewStartDate}
                setViewStartDate={setViewStartDate}
                onOpenSettings={handleOpenSettings}
                isOnline={isOnline}
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
            />
            <main className="flex-grow p-2 sm:p-4 overflow-hidden flex flex-col">
                <GanttView
                    projects={filteredProjects}
                    timelineDates={timelineDates}
                    viewStartDate={viewStartDate}
                    todayString={todayString}
                    employeeMap={employeeMap}
                    departmentMap={departmentMap}
                    expandedProjects={expandedProjects}
                    toggleProjectExpansion={toggleProjectExpansion}
                    onAddTaskClick={(pid) => setTaskModal({ open: true, task: null, projectId: pid })}
                    onAddProjectClick={() => setProjectModal({ open: true, project: null })}
                    onTaskProgressChange={handleProgressChange}
                    onEditProject={(p) => setProjectModal({ open: true, project: p })}
                    onDeleteProject={(p) => setConfirmModal({ open: true, type: 'project', id: p.id, title: '프로젝트 삭제', message: `"${p.name}" 프로젝트와 포함된 모든 태스크를 삭제하시겠습니까?` })}
                    onEditTask={(t, pid) => setTaskModal({ open: true, task: t, projectId: pid })}
                    onDeleteTask={(t, pid) => setConfirmModal({ open: true, type: 'task', id: pid, subId: t.id, title: '태스크 삭제', message: `"${t.name}" 태스크를 삭제하시겠습니까?` })}
                    columnWidths={columnWidths}
                    setColumnWidths={setColumnWidths}
                    onReorderProjects={handleReorderProjects}
                    onReorderTasks={handleReorderTasks}
                    uiSettings={uiSettings}
                />
            </main>

            {/* Modals */}
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                settings={uiSettings} 
                setSettings={handleUiSettingsChange}
                departments={departments}
                employees={employees}
                onAddDepartment={handleAddDepartment}
                onDeleteDepartment={handleDeleteDepartment}
                onAddEmployee={handleAddEmployee}
                onDeleteEmployee={handleDeleteEmployee}
            />
            <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onSuccess={() => setIsSettingsOpen(true)} />
            <ProjectModal isOpen={projectModal.open} onClose={() => setProjectModal({ open: false, project: null })} onSubmit={handleProjectSubmit} project={projectModal.project} />
            <TaskModal 
                isOpen={taskModal.open} 
                onClose={() => setTaskModal({ open: false, task: null, projectId: null })} 
                onSubmit={handleTaskSubmit} 
                employees={employees} 
                departments={departments}
                task={taskModal.task || undefined} 
                project={projects.find(p => p.id === taskModal.projectId) || null} 
            />
            <ConfirmationModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ ...confirmModal, open: false })} onConfirm={handleDelete} title={confirmModal.title} message={confirmModal.message} />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
