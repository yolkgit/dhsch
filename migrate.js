import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';

// ▼▼▼ [여기를 수정하세요!] 본인의 Supabase 정보로 채워주세요 ▼▼▼
const SUPABASE_URL = "https://jvvqausidqgjtjteemyg.supabase.co"; 
const SUPABASE_KEY = process.env.SUPABASE_KEY; 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚚 Supabase -> MySQL 데이터 이사를 시작합니다...');

  try {
    // 1. 기존 데이터 비우기 (순서 중요: 자식 -> 부모)
    console.log('🧹 MySQL 청소 중...');
    await prisma.task.deleteMany();
    await prisma.project.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();

    // 2. 부서 (Departments)
    console.log('📦 부서 옮기는 중...');
    const { data: depts } = await supabase.from('departments').select('*');
    if (depts) {
      for (const d of depts) {
        await prisma.department.create({ data: { id: d.id, name: d.name } });
      }
    }

    // 3. 직원 (Employees)
    console.log('📦 직원 옮기는 중...');
    const { data: emps } = await supabase.from('employees').select('*');
    if (emps) {
      for (const e of emps) {
        if (!e.department_id) continue; // 부서 없는 직원은 패스
        await prisma.employee.create({
          data: { id: e.id, name: e.name, departmentId: e.department_id }
        });
      }
    }

    // 4. 프로젝트 (Projects)
    console.log('📦 프로젝트 옮기는 중...');
    const { data: projs } = await supabase.from('projects').select('*');
    if (projs) {
      for (const p of projs) {
        await prisma.project.create({
          data: { 
            id: p.id, 
            name: p.name, 
            position: p.position || 0 
          }
        });
      }
    }

    // 5. 태스크 (Tasks) - 여기가 제일 중요! (날짜 변환)
    console.log('📦 태스크(일정) 옮기는 중...');
    const { data: tasks } = await supabase.from('tasks').select('*');
    if (tasks) {
      for (const t of tasks) {
        // Supabase에는 날짜가 글자(Text)로 되어있어서 날짜(Date)로 바꿔줘야 함
        const startDate = t.start_date ? new Date(t.start_date) : new Date();
        const endDate = t.end_date ? new Date(t.end_date) : new Date();

        try {
          await prisma.task.create({
            data: {
              id: t.id,
              name: t.name,
              startDate: startDate,
              endDate: endDate,
              color: t.color || 'bg-blue-500',
              progress: t.progress || 0,
              description: t.description || '',
              position: t.position || 0,
              projectId: t.project_id,
              employeeId: t.employee_id
            }
          });
        } catch (err) {
            console.log(`⚠️ 패스: ${t.name} (연결된 프로젝트나 직원이 삭제됨)`);
        }
      }
    }

    console.log('🎉 이사 완료! 모든 데이터가 MySQL로 넘어왔습니다.');

  } catch (error) {
    console.error('❌ 에러 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
