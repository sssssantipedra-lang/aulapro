import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { Welcome } from './pages/Welcome';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { useAppState } from './hooks/useAppState';
import { useP2PSync } from './hooks/useP2PSync';
import { applyTheme, type ThemeKey } from './lib/utils';
import { buildBundle, bundleCounts } from './services/sync';
import type { Section } from './types';
import { X } from 'lucide-react';
import { DEMO_USER } from './lib/demoData';
import { useI18n, priorityLabel } from './i18n';

const ClassesManager = lazy(() => import('./pages/ClassesManager').then(m => ({ default: m.ClassesManager })));
const Agenda         = lazy(() => import('./pages/Agenda').then(m => ({ default: m.Agenda })));
const Rubrics        = lazy(() => import('./pages/Rubrics').then(m => ({ default: m.Rubrics })));
const Diana          = lazy(() => import('./pages/Diana').then(m => ({ default: m.Diana })));
const History        = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const SelfAssessments = lazy(() => import('./pages/SelfAssessments').then(m => ({ default: m.SelfAssessments })));
const AuditLog       = lazy(() => import('./pages/AuditLog').then(m => ({ default: m.AuditLog })));
const Records        = lazy(() => import('./pages/Records').then(m => ({ default: m.Records })));
const Notebook       = lazy(() => import('./pages/Notebook').then(m => ({ default: m.Notebook })));
const ClassRoom      = lazy(() => import('./pages/SecClassroom'));
const Share          = lazy(() => import('./pages/Share').then(m => ({ default: m.Share })));
const ClassroomLive  = lazy(() => import('./pages/ClassroomLive').then(m => ({ default: m.ClassroomLive })));
const Attendance     = lazy(() => import('./pages/Attendance').then(m => ({ default: m.Attendance })));
const Reports        = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));

function Loading() {
  const { t } = useI18n();
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)', fontSize: 14 }}>
      <span className="spin" style={{ marginRight: 10 }} />{t('Cargando…')}
    </div>
  );
}

function AppInner() {
  const { toast } = useToast();
  const { t, lang } = useI18n();
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
        <span className="spin" />{t('Abriendo tu cuaderno…')}
      </div>
    );
  }

  if (!st.currentUser) {
    return (
      <Welcome
        onOpenProfile={st.openProfile}
        onCreateProfile={async (input, options) => {
          await st.createAndOpenProfile(input, options);
          toast(t('✅ ¡Bienvenido/a, {name}!', { name: input.name.split(' ')[0] }));
        }}
        onExploreDemo={async () => {
          await st.createAndOpenProfile({
            name: DEMO_USER.full_name, school: DEMO_USER.school,
            subject: DEMO_USER.subject, course: '2025-2026',
          });
          st.loadDemoData();
          toast(t('✅ Datos de ejemplo cargados'));
        }}
      />
    );
  }

  function submitTask() {
    if (!taskText.trim()) { toast(t('Escribe una descripción')); return; }
    st.addTask(taskText.trim(), taskPri);
    setTaskText('');
    setShowAddTask(false);
    toast(t('✅ Tarea añadida'));
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
        onLogout={async () => { await st.logout(); toast(t('Sesión cerrada')); }}
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
                gradeCategories={st.gradeCategories}
                gradeItems={st.gradeItems}
                grades={st.grades}
                onNav={s => setSection(s as Section)}
                onAddTask={() => setShowAddTask(true)}
                onToggleTask={st.toggleTask}
                onLoadDemo={() => { st.loadDemoData(); toast(t('✅ Datos de ejemplo cargados')); }}
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
                profileId={st.profileId}
              />
            )}
            {section === 'agenda' && (
              <Agenda
                classes={st.classes}
                scheduleBlocks={st.scheduleBlocks}
                calEvents={st.calEvents}
                onAddBlock={(b: any) => { st.addBlock(b); toast(t('✅ Bloque añadido')); }}
                onUpdateBlock={(b: any) => { st.updateBlock(b); toast(t('✅ Actualizado')); }}
                onDeleteBlock={(id: string) => { st.deleteBlock(id); toast(t('Bloque eliminado')); }}
                onAddCalEvent={(ev: any) => { st.addCalEvent(ev); toast(t('✅ Evento añadido')); }}
                onUpdateCalEvent={(ev: any) => { st.updateCalEvent(ev); toast(t('✅ Actualizado')); }}
                onDeleteCalEvent={(id: string) => { st.deleteCalEvent(id); toast(t('Evento eliminado')); }}
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
                onAddRubric={(r: any) => { st.addRubric(r); toast(t('✅ Rúbrica creada')); }}
                onUpdateRubric={(r: any) => { st.updateRubric(r); toast(t('✅ Actualizada')); }}
                onDeleteRubric={(id: string) => { st.deleteRubric(id); toast(t('Rúbrica eliminada')); }}
                onAddDiana={st.addDiana}
                onUpdateDiana={st.updateDiana}
                onDeleteDiana={st.deleteDiana}
                onAddEvaluation={st.addEvaluation}
                gradeCategories={st.gradeCategories}
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
            {section === 'selfassess' && (
              <SelfAssessments
                sessions={st.selfAssessments}
                onInclude={st.includeSelfAssessment}
                onDelete={st.deleteSelfAssessment}
                onNav={s => setSection(s as Section)}
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
                dianas={st.dianas}
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
                // Solo guarda la sesión. Pasarla al Historial es una decisión
                // posterior, desde la pantalla de Autoevaluaciones.
                onSaveSelfAssessment={st.saveSelfAssessment}
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
                profile={st.profile}
                profileId={st.profileId}
                course={st.profile?.course ?? ''}
                onUpdateUser={u => {
                  st.updateUser({
                    name: u.full_name, school: u.school,
                    subject: u.subject, course: u.course,
                  });
                }}
                onUpdateSecurity={st.updateUser}
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
            <div className="modal-title">{t('Nueva tarea')}</div>
            <button className="ico-btn" onClick={() => setShowAddTask(false)}><X size={17} /></button>
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Descripción')}</label>
            <input className="finput" value={taskText} onChange={e => setTaskText(e.target.value)} placeholder={t('Ej: Corregir exámenes 3º ESO A')}
              onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
            />
          </div>
          <div className="fgroup">
            <label className="flabel">{t('Prioridad')}</label>
            <select className="finput" value={taskPri} onChange={e => setTaskPri(e.target.value as any)} style={{ cursor: 'pointer' }}>
              <option value="high">{priorityLabel('high', lang)}</option>
              <option value="medium">{priorityLabel('medium', lang)}</option>
              <option value="low">{priorityLabel('low', lang)}</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button className="btn-accent" style={{ flex: 1, justifyContent: 'center' }} onClick={submitTask}>{t('Añadir tarea')}</button>
            <button className="btn-ghost" onClick={() => setShowAddTask(false)}>{t('Cancelar')}</button>
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
