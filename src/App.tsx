import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { ToastProvider, useToast } from './components/ui/Toast';
import { UpdateBanner } from './components/UpdateBanner';
import { HelpChat } from './components/HelpChat';
import { Sidebar } from './components/layout/Sidebar';
import { Welcome } from './pages/Welcome';
import { CommunityPrompt } from './components/CommunityPrompt';
import { comunidadDePerfil } from './lib/curriculum/comunidades';
import { LicenseGate } from './pages/LicenseGate';
import { getLicenseState, licenseBridge } from './services/license';
import type { LicenseState } from './types/electron';
import { Dashboard } from './pages/Dashboard';
import { Profile } from './pages/Profile';
import { useAppState } from './hooks/useAppState';
import { useP2PSync } from './hooks/useP2PSync';
import { useNarrowScreen, usePhoneScreen } from './hooks/useNarrowScreen';
import { applyTheme, type ThemeKey } from './lib/utils';
import { buildBundle, bundleCounts } from './services/sync';
import { setPrivacyRoster } from './services/privacy';
import { applyClassMarks } from './services/classMarks';
import { HubTabs } from './components/layout/HubTabs';
import { hubOf, rememberTab } from './lib/navigation';
import type { Section, Ficha } from './types';
import { X, Menu } from 'lucide-react';
import { DEMO_USER, DEMO_COMMUNITY } from './lib/demoData';
import { useI18n, priorityLabel } from './i18n';
import { isAndroidApp } from './lib/platform';

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
const SeatingPlan    = lazy(() => import('./pages/SeatingPlan').then(m => ({ default: m.SeatingPlan })));
const Reports        = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const LearningSituations = lazy(() => import('./pages/LearningSituations').then(m => ({ default: m.LearningSituations })));
const Resources      = lazy(() => import('./pages/Resources').then(m => ({ default: m.Resources })));
const WorkSessions   = lazy(() => import('./pages/WorkSessions').then(m => ({ default: m.WorkSessions })));

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
  /** Ficha que Recursos manda proyectar en Aula Live. */
  const [liveFicha, setLiveFicha]     = useState<Ficha | null>(null);
  // Volver a un apartado del menú abre la pestaña en la que se estaba
  useEffect(() => { rememberTab(section); }, [section]);
  const [sidebarMini, setSidebarMini] = useState(false);
  // En pantallas estrechas el menú va plegado a iconos y se abre por encima
  const narrow = useNarrowScreen();
  // En el móvil ni siquiera cabe el menú plegado: se abre desde la barra de arriba
  const phone = usePhoneScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuOverlay = narrow && menuOpen;
  const menuMini = narrow ? !menuOpen : sidebarMini;
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskText, setTaskText]       = useState('');
  const [taskPri, setTaskPri]         = useState<'high'|'medium'|'low'>('medium');

  // Se memoriza para no crear una lista nueva en cada render: Aula Live la usa
  // como origen de la ruleta y reiniciaría el giro cada vez que cambie.
  const studentFirstNames = useMemo(
    () => st.students.map(s => s.name.split(' ')[0]),
    [st.students],
  );

  /**
   * El cuaderno tal como cuenta para las medias: lo guardado más el bloque
   * «Trabajo diario y actitud» que sale de las anotaciones del aula (ver
   * services/classMarks.ts). Todas las pantallas que calculan medias leen de
   * aquí; lo que se guarda en disco sigue siendo solo lo de `st`.
   */
  const gradeView = useMemo(() => applyClassMarks({
    classes: st.classes, students: st.students, gradeCategories: st.gradeCategories,
    gradeItems: st.gradeItems, grades: st.grades, classMarks: st.classMarks, marksConfigs: st.marksConfigs,
  }), [st.classes, st.students, st.gradeCategories, st.gradeItems, st.grades, st.classMarks, st.marksConfigs]);

  /**
   * Lo que el asistente del cuaderno puede consultar. Se arma aquí, donde
   * está todo el estado junto, y no dentro de la página: el chat necesita ver
   * clases, notas, asistencia y agenda a la vez, y el Cuaderno solo recibía
   * calificaciones.
   */
  const aiData = useMemo(() => ({
    profile: st.profile
      ? { name: st.profile.name, school: st.profile.school, subject: st.profile.subject, course: st.profile.course }
      : null,
    classes: st.classes,
    students: st.students,
    gradeCategories: gradeView.gradeCategories,
    gradeItems: gradeView.gradeItems,
    grades: gradeView.grades,
    evaluations: st.evaluations,
    attendance: st.attendance,
    reports: st.reports,
    calEvents: st.calEvents,
    scheduleBlocks: st.scheduleBlocks,
    tasks: st.tasks,
    learningSituations: st.learningSituations,
    seatingPlans: st.seatingPlans,
  }), [st.profile, st.classes, st.students, gradeView,
      st.evaluations, st.attendance, st.reports, st.calEvents, st.scheduleBlocks,
      st.tasks, st.learningSituations, st.seatingPlans]);

  const session = useP2PSync({
    source: st.syncSource,
    scope: st.shareScope,
    userName: st.currentUser?.full_name ?? 'Docente',
    applyBundle: st.applyBundle,
  });

  useEffect(() => {
    applyTheme((localStorage.getItem('aulapro_theme') as ThemeKey) ?? 'sky');
  }, []);

  // Al cambiar de perfil se vuelve al inicio, no a la sección del docente
  // anterior. Se ajusta durante el render (patrón recomendado por React para
  // «reiniciar estado cuando cambia un valor»), no en un efecto: así no se
  // pinta ni un instante la sección del perfil anterior.
  const [sectionOwner, setSectionOwner] = useState(st.profileId);
  if (sectionOwner !== st.profileId) {
    setSectionOwner(st.profileId);
    setSection('dashboard');
  }

  // Los nombres del alumnado nunca viajan a la IA: ver services/privacy.ts
  useEffect(() => { setPrivacyRoster(st.students, lang); }, [st.students, lang]);

  // Android: el botón «atrás» cierra lo que esté abierto o vuelve al Inicio
  // antes de salir, en vez de cerrar la aplicación de golpe.
  const backState = useRef({ section, open: menuOpen || showAddTask });
  useEffect(() => { backState.current = { section, open: menuOpen || showAddTask }; }, [section, menuOpen, showAddTask]);
  useEffect(() => {
    if (!isAndroidApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    import('@capacitor/app').then(({ App: CapApp }) => CapApp.addListener('backButton', () => {
      const { section: current, open } = backState.current;
      // Las ventanas se cierran tocando fuera (todas lo admiten); Escape, para el resto
      const overlays = document.querySelectorAll<HTMLElement>('.modal-overlay.open');
      if (overlays.length) {
        overlays[overlays.length - 1].click();
      } else if (open || document.querySelector('.cp, .cp-picker')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      } else if (current !== 'dashboard') {
        setSection('dashboard');
      } else {
        CapApp.minimizeApp();
      }
    })).then(handle => {
      if (cancelled) handle.remove();
      else remove = () => { handle.remove(); };
    });
    return () => { cancelled = true; remove?.(); };
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowAddTask(false); setMenuOpen(false); }
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
            subject: DEMO_USER.subject, course: '2025-2026', community: DEMO_COMMUNITY,
          }, { demo: true });
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
      {(!phone || menuOpen) && <Sidebar
        mini={menuMini}
        overlay={menuOverlay}
        onToggle={() => (narrow ? setMenuOpen(v => !v) : setSidebarMini(v => !v))}
        current={section}
        onNav={s => { setSection(s); setMenuOpen(false); }}
        user={st.currentUser}
        sharing={session.connected}
        saving={st.saving}
        onLogout={async () => { await st.logout(); toast(t('Sesión cerrada')); }}
      />}

      {menuOverlay && (
        <>
          {/* Ocupa el hueco del menú plegado para que el contenido no salte */}
          {!phone && <div style={{ width: 'var(--sb-w-min)', flexShrink: 0 }} />}
          <div className="sb-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        </>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {phone && (
          <header className="m-top">
            <button type="button" className="m-top-btn" onClick={() => setMenuOpen(true)} aria-label={t('Abrir el menú')} aria-expanded={menuOpen}>
              <Menu size={22} />
            </button>
            <button type="button" className="m-top-brand" onClick={() => setSection('dashboard')}>AULAPRO</button>
            <button type="button" className="m-top-avatar" onClick={() => setSection('profile')} aria-label={t('Configuración')}>
              {st.currentUser.full_name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
            </button>
          </header>
        )}
        {/* La página se desplaza con la ventana, no dentro de <main>. `clip`
            recorta lo que se salga a lo ancho sin convertir <main> en zona de
            desplazamiento propia: si lo fuera, nada de dentro podría quedarse
            fijo (position: sticky), ni la barra de pestañas ni los índices. */}
        <main style={{ flex: 1, overflowX: 'clip' }} className={hubOf(section) ? 'with-hub' : undefined}>
          {/* La clave cambia al entrar en otro apartado: la barra se monta de
              nuevo y su animación de aviso (parpadeo) vuelve a sonar. Al
              cambiar de pestaña dentro del mismo apartado no parpadea. */}
          <HubTabs key={hubOf(section)?.id ?? 'none'} section={section} onNav={setSection} />
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
                attendance={st.attendance}
                gradeCategories={gradeView.gradeCategories}
                gradeItems={gradeView.gradeItems}
                grades={gradeView.grades}
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
                onAddStudents={ss => ss.forEach(st.addStudent)}
                onOpenEval={() => setSection('rubrics')}
                profileId={st.profileId}
                comunidad={st.currentUser?.community}
              />
            )}
            {section === 'agenda' && (
              <Agenda
                classes={st.classes}
                scheduleBlocks={st.scheduleBlocks}
                calEvents={st.calEvents}
                onAddBlock={b => { st.addBlock(b); toast(t('✅ Bloque añadido')); }}
                onUpdateBlock={b => { st.updateBlock(b); toast(t('✅ Actualizado')); }}
                onDeleteBlock={(id: string) => { st.deleteBlock(id); toast(t('Bloque eliminado')); }}
                onReplaceBlocks={st.replaceBlocks}
                onAddCalEvent={ev => { st.addCalEvent(ev); toast(t('✅ Evento añadido')); }}
                onUpdateCalEvent={ev => { st.updateCalEvent(ev); toast(t('✅ Actualizado')); }}
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
                onAddRubric={r => { st.addRubric(r); toast(t('✅ Rúbrica creada')); }}
                onUpdateRubric={r => { st.updateRubric(r); toast(t('✅ Actualizada')); }}
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
                rubrics={st.rubrics}
                dianas={st.dianas}
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
                gradeCategories={gradeView.gradeCategories}
                gradeItems={gradeView.gradeItems}
                grades={gradeView.grades}
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
                gradeCategories={gradeView.gradeCategories}
                gradeItems={gradeView.gradeItems}
                grades={gradeView.grades}
                classMarks={st.classMarks}
                marksConfigs={st.marksConfigs}
                onSaveMarksConfig={st.setMarksConfig}
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
                aiData={aiData}
                chat={st.chat}
                onChatChange={st.setChat}
              />
            )}
            {section === 'sec-classroom' && (
              <ClassRoom
                studentNames={studentFirstNames}
                fichas={st.fichas}
                projectFicha={liveFicha}
                onProjectDone={() => setLiveFicha(null)}
              />
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
            {section === 'seating' && (
              <SeatingPlan
                classes={st.classes}
                students={st.students}
                gradeCategories={gradeView.gradeCategories}
                gradeItems={gradeView.gradeItems}
                grades={gradeView.grades}
                attendance={st.attendance}
                seatingPlans={st.seatingPlans}
                onSave={st.setSeatingPlan}
                classMarks={st.classMarks}
                marksConfigs={st.marksConfigs}
                onAddMark={st.addClassMark}
                onDeleteMark={st.deleteClassMark}
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
                gradeCategories={gradeView.gradeCategories}
                gradeItems={gradeView.gradeItems}
                grades={gradeView.grades}
                attendance={st.attendance}
                reports={st.reports}
                onAddReport={st.addReport}
                onUpdateReport={st.updateReport}
                onDeleteReport={st.deleteReport}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'learning-situations' && (
              <LearningSituations
                classes={st.classes}
                gradeCategories={st.gradeCategories}
                learningSituations={st.learningSituations}
                teacherName={st.currentUser?.full_name ?? ''}
                comunidad={st.currentUser?.community}
                onUpdateClass={st.updateClass}
                onSave={s => { st.saveLearningSituation(s); }}
                onDelete={id => { st.deleteLearningSituation(id); toast(t('Situación de aprendizaje eliminada')); }}
                onAddRubric={r => { st.addRubric(r); }}
                onAddDiana={d => { st.addDiana(d); }}
                onAddFicha={f => { st.saveFicha(f); }}
                onNav={s => setSection(s as Section)}
              />
            )}
            {section === 'resources' && (
              <Resources
                classes={st.classes}
                fichas={st.fichas}
                onSave={f => { st.saveFicha(f); }}
                onDelete={id => { st.deleteFicha(id); toast(t('Ficha eliminada')); }}
                onProject={f => { setLiveFicha(f); setSection('sec-classroom'); }}
                onNav={s => setSection(s as Section)}
              />
            )}
            {(section === 'meetings' || section === 'trainings') && (
              <WorkSessions
                // La clave fuerza a React a montar la pantalla de nuevo al
                // pasar de Reuniones a Formaciones: es el mismo componente y,
                // sin esto, se quedaría abierto el detalle de la otra lista.
                key={section}
                kind={section === 'meetings' ? 'meeting' : 'training'}
                sessions={st.workSessions}
                onSave={st.saveWorkSession}
                onDelete={id => { st.deleteWorkSession(id); toast(t('Eliminado')); }}
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
                    ...(u.community ? { community: u.community } : {}),
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

      {/* Ayuda sobre la aplicación: botón flotante en todas las pantallas.
          Va aquí dentro y no junto a UpdateBanner porque necesita saber en qué
          sección está el docente y poder llevarle a otra. */}
      <HelpChat section={section} onNav={s => setSection(s as Section)} />

      {/* A los perfiles anteriores a la comunidad se les pregunta una sola vez,
          la elijan o la dejen para después (ver `communityPromptAt`). */}
      {st.profile && !comunidadDePerfil(st.profile.community) && !st.profile.communityPromptAt && (
        <CommunityPrompt
          onChoose={community => { void st.updateUser({ community, communityPromptAt: new Date().toISOString() }); }}
          onLater={() => { void st.updateUser({ communityPromptAt: new Date().toISOString() }); }}
        />
      )}

      {/* Modal nueva tarea */}
      <div className={`modal-overlay${showAddTask ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setShowAddTask(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-hd">
            <div className="modal-title">{t('Nueva tarea')}</div>
            <button className="ico-btn" onClick={() => setShowAddTask(false)} aria-label={t('Cerrar')} title={t('Cerrar')}><X size={17} /></button>
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="app-f1">{t('Descripción')}</label>
            <input id="app-f1" className="finput" value={taskText} onChange={e => setTaskText(e.target.value)} placeholder={t('Ej: Corregir exámenes 3º ESO A')}
              onKeyDown={e => { if (e.key === 'Enter') submitTask(); }}
            />
          </div>
          <div className="fgroup">
            <label className="flabel" htmlFor="app-f2">{t('Prioridad')}</label>
            <select id="app-f2" className="finput" value={taskPri} onChange={e => setTaskPri(e.target.value as 'high' | 'medium' | 'low')} style={{ cursor: 'pointer' }}>
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

/**
 * En escritorio, antes de nada, la licencia (ver `electron/license.cjs`).
 * Quien ya usaba Aula Pro antes de la venta es fundador y pasa directo; en el
 * navegador no hay licencia.
 */
function LicenseCheck({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<LicenseState | null | undefined>(licenseBridge() ? undefined : null);
  useEffect(() => {
    if (state !== undefined) return;
    getLicenseState().then(setState);
  }, [state]);

  if (state === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--sb-bg)', color: 'rgba(255,255,255,0.6)', fontSize: 14, gap: 10 }}>
        <span className="spin" />{t('Abriendo tu cuaderno…')}
      </div>
    );
  }
  if (state?.required) return <LicenseGate state={state} onChange={setState} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <LicenseCheck><AppInner /></LicenseCheck>
      <UpdateBanner />
    </ToastProvider>
  );
}
