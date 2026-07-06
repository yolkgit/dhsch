import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

const prisma = new PrismaClient();
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// 포트 3001번 확정
const PORT = 3001;

app.use(cors());
app.use(express.json());

const broadcastUpdate = () => io.emit('server:update');

// [API]
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { position: 'asc' },
      include: { tasks: { orderBy: { position: 'asc' } } }
    });
    res.json(projects);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tasks/reorder', async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!tasks || !Array.isArray(tasks)) return res.json({ success: true });

    // 개별 업데이트 (실패 허용)
    const updatePromises = tasks.map(t => 
      prisma.task.update({
        where: { id: String(t.id) },
        data: { position: parseInt(t.position) || 0 }
      }).catch(err => {
        console.error(`ID ${t.id} Update Failed:`, err.message);
        return null;
      })
    );
    await Promise.all(updatePromises);

    broadcastUpdate();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// [기타 API들...]
app.get('/api/departments', async (req, res) => {
  const depts = await prisma.department.findMany({ include: { employees: true } });
  res.json(depts);
});
app.get('/api/employees', async (req, res) => {
  const emps = await prisma.employee.findMany();
  res.json(emps);
});
app.post('/api/projects', async (req, res) => {
  const p = await prisma.project.create({ data: { name: req.body.name, position: 0 } });
  broadcastUpdate(); res.json(p);
});
app.post('/api/tasks', async (req, res) => {
    const { projectId, ...data } = req.body;
    const t = await prisma.task.create({ data: { ...data, projectId, startDate: new Date(data.startDate), endDate: new Date(data.endDate) }});
    broadcastUpdate(); res.json(t);
});
app.put('/api/tasks/:id', async (req, res) => {
    const { startDate, endDate, ...data } = req.body;
    const updateData = { ...data };
    if(startDate) updateData.startDate = new Date(startDate);
    if(endDate) updateData.endDate = new Date(endDate);
    const t = await prisma.task.update({ where: { id: req.params.id }, data: updateData });
    broadcastUpdate(); res.json(t);
});
app.put('/api/projects/:id', async (req, res) => {
    const p = await prisma.project.update({ where: { id: req.params.id }, data: { name: req.body.name } });
    broadcastUpdate(); res.json(p);
});
app.put('/api/projects/reorder', async (req, res) => {
    const { projects } = req.body;
    await Promise.all(projects.map(p => prisma.project.update({ where: { id: String(p.id) }, data: { position: parseInt(p.position) } }).catch(e=>console.error(e))));
    broadcastUpdate(); res.json({success:true});
});
app.delete('/api/projects/:id', async (req, res) => {
  await prisma.project.delete({ where: { id: req.params.id } });
  broadcastUpdate(); res.json({ success: true });
});
app.delete('/api/tasks/:id', async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  broadcastUpdate(); res.json({ success: true });
});
app.post('/api/departments', async (req, res) => {
  const d = await prisma.department.create({ data: { name: req.body.name } });
  broadcastUpdate(); res.json(d);
});
app.delete('/api/departments/:id', async (req, res) => {
  await prisma.department.delete({ where: { id: req.params.id } });
  broadcastUpdate(); res.json({success:true});
});
app.post('/api/employees', async (req, res) => {
  const e = await prisma.employee.create({ data: { name: req.body.name, departmentId: req.body.departmentId } });
  broadcastUpdate(); res.json(e);
});
app.delete('/api/employees/:id', async (req, res) => {
  await prisma.employee.delete({ where: { id: req.params.id } });
  broadcastUpdate(); res.json({success:true});
});

// [Frontend Serving]
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'dist')));
app.get(/.*/, (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
