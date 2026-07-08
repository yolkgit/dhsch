export interface Task {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  // 여러 일정(구간) 목록. 없으면 startDate~endDate 단일 일정으로 취급
  segments?: { start: string; end: string; note?: string }[];
  color: string;
  employeeId: string;
  progress: number;
  description?: string;
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