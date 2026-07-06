import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 데이터 심는 중...');

  // 1. 기존 데이터 삭제 (중복 방지)
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();

  // 2. 부서 만들기
  const devTeam = await prisma.department.create({
    data: { name: '개발팀' }
  });
  const designTeam = await prisma.department.create({
    data: { name: '디자인팀' }
  });

  // 3. 직원 만들기
  const emp1 = await prisma.employee.create({
    data: { name: '김철수', departmentId: devTeam.id }
  });
  const emp2 = await prisma.employee.create({
    data: { name: '이영희', departmentId: designTeam.id }
  });
  const emp3 = await prisma.employee.create({
    data: { name: '박민수', departmentId: devTeam.id }
  });

  // 4. 프로젝트 만들기
  const project1 = await prisma.project.create({
    data: { name: '홈페이지 리뉴얼', position: 0 }
  });
  const project2 = await prisma.project.create({
    data: { name: '모바일 앱 개발', position: 1 }
  });

  // 5. 일정(Task) 만들기
  await prisma.task.create({
    data: {
      name: '기획서 작성',
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-02-05'),
      progress: 100,
      color: 'bg-green-500',
      projectId: project1.id,
      employeeId: emp1.id
    }
  });

  await prisma.task.create({
    data: {
      name: '메인 디자인',
      startDate: new Date('2024-02-06'),
      endDate: new Date('2024-02-15'),
      progress: 50,
      color: 'bg-blue-500',
      projectId: project1.id,
      employeeId: emp2.id
    }
  });

  await prisma.task.create({
    data: {
      name: 'API 연동',
      startDate: new Date('2024-02-10'),
      endDate: new Date('2024-02-20'),
      progress: 20,
      color: 'bg-purple-500',
      projectId: project2.id,
      employeeId: emp3.id
    }
  });

  console.log('✅ 데이터 심기 완료!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
