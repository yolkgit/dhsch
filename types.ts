export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  // 여러 일정(구간) 목록. 없으면 startDate~endDate 단일 일정으로 취급
  segments?: { start: string; end: string; note?: string }[];
  // 중요도: 3=상, 2=중, 1=하 (평가 가중치)
  priority?: number;
  color: string;
  employeeId: string;
  progress: number;
  description?: string;
}

// 분기별 개인 목표 (MBO)
export interface Goal {
  id: string;
  employeeId: string;
  year: number;
  quarter: number;
  title: string;
  achieved: boolean;
}

// 분기별 관리자 정성평가
export interface Evaluation {
  id: string;
  employeeId: string;
  year: number;
  quarter: number;
  scores: Record<string, number>;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  tasks: Task[];
}

export interface Employee {
  id: string;
  name: string;
  departmentId: string;
}

export interface Department {
  id: string;
  name: string;
  employees: Employee[];
}