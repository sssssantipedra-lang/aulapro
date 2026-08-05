import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { Welcome } from './pages/Welcome';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { useAppState } from './hooks/useAppState';
import { useP2PSync } from './hooks/useP2PSync';
import { applyTheme, isoDate, type ThemeKey } from './lib/utils';
import { buildBundle, bundleCounts } from './services/sync';
import type { Section } from './types';
import { X } from 'lucide-react';
import { DEMO_USER } from './lib/demoData';

const ClassesManager = lazy(() => import('./pages/ClassesManager').then(m => ({ default: m.ClassesManager })));
const Agenda         = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));
const Rubrics        = lazy(() => import('./pages/Rubrics').then(m => ({ default: m.Rubrics })));
const Diana          = lazy(() => import('./pages/Diana').then(m => ({ default: m.Diana })));
const History        = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const AuditLog       = lazy(() => import('./pages/AuditLog').then(m => ({ default: m.AuditLog })));
const Records        = lazy(() => import('./pages/Records').then(m => ({ default: m.Records })));
const Notebook       = lazy(() => import('./pages/Notebook').then(m => ({ default: m.Notebook })));
const ClassRoom      = lazy(() => import('./pages/SecClassroom'));
const Share          = lazy(() => import('./pages/Share').then(m => ({ default: m.Share })));
const ClassroomLive  = lazy(() => import('./pages/ClassroomLive').then(m => ({ default: m.ClassroomLive })));
const Attendance     = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Reports        = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)', fontSize: 14 }}>
      <span className="spin" style={{ marginRight: 10 }} />Cargando…
    </div>
  );
}

function AppInner() {
  const { toast } = useToast();
  const st = useAppState();

  const [section, setSection]         = useState<Section>('dashboard');
  const [sidebarMini, setSidebarMini] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskText, setTaskText]       = useState('');
  const [taskPri, setTaskPri]         = useState<'high'|'medium'|'low'>('medium');

  // Se memoriza para no crear una lista nueva en cada render: Aula Live la usa
  // como origen de la ruleta y reiniciaría el giro cada vez que cambie.
  const studentFirstNames = useMemo(
    () => st.students.map(s => s.name.split(' ')[0]),
    [st.students],
  );

  const session = useP2PSync({
    source: st.syncSource,
    scope: st.shareScope,
    userName: st.currentUser?.full_name ?? 'Docente',
    applyBundle: st.applyBundle,
  });

  useEffect(() => {
    applyTheme((localStorage.getItem('aulapro_theme') as ThemeKey) ?? 'sky');
  }, []);

  // Al cambiar de perfil se vuelve al inicio, no a la sección del docente anterior
  useEffect(() => { setSection('dashboard'); }, [st.profileId]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAddTask(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  if (!st.ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--sb-bg)', color: 'rgba(255,255,255,0.6)', fontSize: 14, gap: 10 }}>
        <span className="spin" />Abriendo tu cuaderno…
      </div>
    );
  }

  if (!st.currentUser) {
    return (
      <Welcome
        onOpenProfile={st.openProfile}
        onCreateProfile={async (input, options) => {
          await st.createAndOpenProfile(input, options);
          toast(`✅ ¡Bienvenido/a, ${input.name.split(' ')[0]}!`);
        }}
        onExploreDemo={async () => {
          await st.createAndOpenProfile({
            name: DEMO_USER.full_name, school: DEMO_USER.school,
            subject: DEMO_USER.subject, course: '2025-2026',
          });
          st.loadDemoData();
          toast('✅ Datos de ejemplo cargados');
        }}
      />
    );
  }

  function submitTask() {
    if (!taskText.trim()) { toast('Escribe una descripción'); return; }
    st.addTask(taskText.trim(), taskPri);
    setTaskText('');
    setShowAddTask(false);
    toast('✅ Tarea añadida');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar
        mini={sidebarMini}
        onToggle={() => setSidebarMini(v => !v)}
        current={section}
        onNav={setSection}
        user={st.currentUser}
        sharing={session.connected}
        saving={st.saving}
        onLogout={async () => { await st.logout(); toast('Sesión cerrada'); }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Suspense fallback={<Loading />}>
            {section === 'dashboard' && (
              <Dashboard
                user={st.currentUser}
                tasks={st.tasks}
                scheduleBlocks={st.scheduleBlocks}
                calEvents={st.calEvents}
                students={st.students}
                classes={st.classes}
                evaluations={st.evaluations}
                onNav={s => setSection(s as Section)}
                onAddTask={() => setShowAddTask(true)}
                onToggleTask={st.toggleTask}
                onLoadDemo={() => { st.loadDemoData(); toast('✅ Datos de ejemplo cargados'); }}
              />
            )}
            {section === 'classes' && (
              <ClassesManager
                classes={st.classes}
                students={st.students}
                evaluations={st.evaluations}
                rubrics={st.rubrics}
                onAddClass={st.addClass}
                onUpdateClass={st.updateClass}
                onDeleteClass={st.deleteClass}
                onAddStudent={st.addStudent}
                onUpdateStudent={st.updateStudent}
                onDeleteStudent={st.deleteStudent}
                onAddStudents={(ss: any[]) => ss.forEach(st.addStudent)}
                onOpenEval={() => setSection('rubrics')}
              />
            )}
            {section === 'agenda' && (
              <Agenda
                classes={st.classes}
                scheduleBlocks={st.scheduleBlocks}
                calEvents={st.calEvents}
                onAddBlock={(b: any) => { st.addBlock(b); toast('✅ Bloque añadido'); }}
                onUpdateBlock={(b: any) => { st.updateBlock(b); toast('✅ Actualizado'); }}
                onDeleteBlock={(id: string) => { st.deleteBlock(id); toast('Bloque eliminado'); }}
                onAddCalEvent={(ev: any) => { st.addCalEvent(ev); toast('✅ Evento añadido'); }}
                onUpdateCalEvent={(ev: any) => { st.updateCalEvent(ev); toast('✅ Actualizado'); }}
                onDeleteCalEvent={(id: string) => { st.deleteCalEvent(id); toast('Evento eliminado'); }}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'rubrics' && (
              <Rubrics
                rubrics={st.rubrics}
                dianas={st.dianas}
                evaluations={st.evaluations}
                classes={st.classes}
                students={st.students}
                lawDocument={st.lawDocument}
                onAddRubric={(r: any) => { st.addRubric(r); toast('✅ Rúbrica creada'); }}
                onUpdateRubric={(r: any) => { st.updateRubric(r); toast('✅ Actualizada'); }}
                onDeleteRubric={(id: string) => { st.deleteRubric(id); toast('Rúbrica eliminada'); }}
                onAddDiana={st.addDiana}
                onUpdateDiana={st.updateDiana}
                onDeleteDiana={st.deleteDiana}
                onAddEvaluation={st.addEvaluation}
              />
            )}
            {section === 'diana' && (
              <Diana
                classes={st.classes}
                students={st.students}
                evaluations={st.evaluations}
                lawDocument={st.lawDocument}
                dianaProfiles={st.dianaProfiles}
                onSaveDiana={st.saveDianaProfile}
              />
            )}
            {section === 'audit' && (
              <AuditLog auditLog={st.auditLog} onClear={st.clearAuditLog} />
            )}
            {section === 'records' && (
              <Records
                classes={st.classes}
                students={st.students}
                gradeCategories={st.gradeCategories}
                gradeItems={st.gradeItems}
                grades={st.grades}
                teacherName={st.profile?.name ?? ''}
                course={st.profile?.course ?? ''}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'history' && (
              <History
                evaluations={st.evaluations}
                classes={st.classes}
                students={st.students}
                rubrics={st.rubrics}
                onOpenEval={() => setSection('rubrics')}
              />
            )}
            {section === 'notebook' && (
              <Notebook
                classes={st.classes}
                students={st.students}
                gradeCategories={st.gradeCategories}
                gradeItems={st.gradeItems}
                grades={st.grades}
                onAddCategory={st.addGradeCategory}
                onUpdateCategory={st.updateGradeCategory}
                onDeleteCategory={st.deleteGradeCategory}
                onAddItem={st.addGradeItem}
                onUpdateItem={st.updateGradeItem}
                onDeleteItem={st.deleteGradeItem}
                onSetGrade={st.setGrade}
                lawDocument={st.lawDocument}
                onLawDocumentChange={st.setLawDocument}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'sec-classroom' && (
              <ClassRoom studentNames={studentFirstNames} />
            )}
            {section === 'classroom-live' && (
              <ClassroomLive
                classes={st.classes}
                students={st.students}
                rubrics={st.rubrics}
                dianas={st.dianas}
                onNav={s => setSection(s as Section)}
                onSaveSelfAssessment={({ classId, activityTitle, rows }) => {
                  rows.forEach(row => {
                    st.addEvaluation({
                      id: 'ev' + Date.now() + Math.random().toString(36).slice(2, 7),
                      rubric_id: 'autoeval',
                      rubric_name: `${activityTitle} (autoevaluación)`,
                      student_id: row.studentId ?? '',
                      student_name: row.studentName,
                      class_id: classId,
                      date: isoDate(),
                      scores: row.scores,
                      notes: 'Respuesta del propio alumno desde su móvil',
                      instrument: 'diana',
                      grade: row.grade ?? undefined,
                    });
                  });
                  toast(`✅ ${rows.length} autoevaluaciones guardadas en el Historial`);
                }}
              />
            )}
            {section === 'share' && (
              <Share
                classes={st.classes}
                scope={st.shareScope}
                onScopeChange={st.setShareScope}
                session={session}
                counts={bundleCounts(buildBundle(st.syncSource, st.shareScope))}
              />
            )}
            {section === 'attendance' && (
              <Attendance
                classes={st.classes}
                students={st.students}
                attendance={st.attendance}
                onSet={st.setAttendanceFor}
                onSetDay={st.setAttendanceDay}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'reports' && (
              <Reports
                classes={st.classes}
                students={st.students}
                evaluations={st.evaluations}
                rubrics={st.rubrics}
                dianas={st.dianas}
                gradeCategories={st.gradeCategories}
                gradeItems={st.gradeItems}
                grades={st.grades}
                attendance={st.attendance}
                reports={st.reports}
                onAddReport={st.addReport}
                onUpdateReport={st.updateReport}
                onDeleteReport={st.deleteReport}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'profile' && (
              <Profile
                user={st.currentUser}
                profileId={st.profileId}
                course={st.profile?.course ?? ''}
                onUpdateUser={u => {
                  st.updateUser({
                    name: u.full_name, school: u.school,
                    subject: u.subject, course: u.course,
                  });
                }}
                onExportData={st.exportData}
                onImportData={st.importData}
                onClearSchoolYear={st.clearSchoolYear}
              />
            )}
          </Suspense>
        </main>
      </div>

      {/* Modal nueva tarea */}
      <div className={`modal-overlay${showAddTask ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setShowAddTask(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <div className="modal-title">Nueva tarea</div>
            <button className="ico-btn" onClick={() => setShowAddTask(false)}><X size={17} /></button>
          </div>
          <div className="fgroup">
            <label className="flabel">Descripción</label>
            <input className="finput" value={taskText} onChange={e => setTaskText(e.target.value)} placeholder="Ej: Corregir exámenes 3º ESO A"
              onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
            />
          </div>
          <div className="fgroup">
            <label className="flabel">Prioridad</label>
            <select className="finput" value={taskPri} onChange={e => setTaskPri(e.target.value as any)} style={{ cursor: 'pointer' }}>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={submitTask}>Añadir tarea</button>
            <button className="btn-ghost" onClick={() => setShowAddTask(false)}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
