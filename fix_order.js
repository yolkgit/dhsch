// fix_order.js
// 기존 데이터의 순서(Position)를 0, 1, 2... 로 초기화하는 스크립트

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 데이터 정렬 초기화 시작...");

  // 1. 프로젝트 순서 정리
  const projects = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`📋 프로젝트 ${projects.length}개 발견. 순서 재할당 중...`);
  
  for (let i = 0; i < projects.length; i++) {
    await prisma.project.update({
      where: { id: projects[i].id },
      data: { position: i }
    });
  }

  // 2. 태스크 순서 정리 (프로젝트별로)
  for (const project of projects) {
    const tasks = await prisma.task.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' } // 생성된 순서대로 일단 번호 부여
    });

    if (tasks.length > 0) {
      console.log(`   └─ 프로젝트 "${project.name}": 태스크 ${tasks.length}개 정리 중...`);
      for (let j = 0; j < tasks.length; j++) {
        await prisma.task.update({
          where: { id: tasks[j].id },
          data: { position: j }
        });
      }
    }
  }

  console.log("✅ 모든 순서 번호표 부착 완료!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
