import { useEffect, useState } from "react";
import "./App.css";
import SentinelHome from "./components/SentinelHome.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Metric from "./components/Metric.jsx";
import ProjectSetup from "./pages/ProjectSetup.jsx";
import ScheduleMilestones from "./pages/ScheduleMilestones.jsx";
import ConstraintBoard from "./pages/ConstraintBoard.jsx";
import TodosPage from "./pages/TodosPage.jsx";
import IssuesBoard from "./pages/IssuesBoard.jsx";
import ExecutiveAttentionCenter from "./pages/ExecutiveAttentionCenter.jsx";
import OperationalFeed from "./components/OperationalFeed.jsx";
import TIAIntelligence from "./components/TIAIntelligence.jsx";
import ScheduleIntelligence from "./pages/ScheduleIntelligence.jsx";
import RevenueForecast from "./components/RevenueForecast.jsx";
import FourWeekLookAhead from "./components/FourWeekLookAhead.jsx";
import SubmittalReadiness from "./components/SubmittalReadiness.jsx";
import ProjectHealthOS from "./components/ProjectHealthOS.jsx";
import ModuleHeader from "./components/ModuleHeader.jsx";
import LongLeadItemBoard from "./pages/LongLeadItemBoard.jsx";

import {
  getAgeInDays,
  isOverdue,
  needsExecutiveAttention,
} from "./utils/escalationUtils.js";

const STORAGE_KEY = "constraintos_app_data_v2";

function createEmptyProjectData() {
  return {
    milestones: [],
    constraints: [],
    longLeadItems: [],
    issues: [],
    todos: [],
    teamMembers: [],
    submittals: [],
    revenueHistory: [],
        scheduleSnapshots: [],
    scheduleActivities: [],
    scheduleRelationships: [],
    pullPlans: {},
workZones: [],
ppcHistory: [],

    projectHealthOS: {
      reviewItems: [],
      issues: [],
      todos: [],
      reviewHistory: [],
    },
  };
}

function App() {
  const savedAppData = localStorage.getItem(STORAGE_KEY);
  const parsedAppData = savedAppData ? JSON.parse(savedAppData) : null;
  const [activePage, setActivePage] = useState("SentinelOS Home");

  const [projects, setProjects] = useState(parsedAppData?.projects || []);
  const [selectedProject, setSelectedProject] = useState(
    parsedAppData?.selectedProject || ""
  );
  const [projectData, setProjectData] = useState(
    parsedAppData?.projectData || {}
  );

  const [projectForm, setProjectForm] = useState({
    name: "",
    number: "",
    client: "",
    location: "",
    type: "Design-Build",
    status: "Active",
  });

  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    due: "",
    status: "On Track",
  });

  const [constraintForm, setConstraintForm] = useState({
    description: "",
    owner: "",
    requiredBy: "",
    milestone: "",
    status: "Open",
  });

  const [todoForm, setTodoForm] = useState({
  action: "",
  owner: "",
  dueDate: "",
  status: "Open",
  assignedToUserId: "",
  reminderEnabled: true,
});
  const [teamMemberForm, setTeamMemberForm] = useState({
  name: "",
  email: "",
  company: "",
  role: "",
});
const [editingTeamMemberId, setEditingTeamMemberId] = useState(null);

  const [lastCompletedTodo, setLastCompletedTodo] = useState(null);
  const [mockRole, setMockRole] = useState("Admin");
  const [dashboardFilter, setDashboardFilter] = useState("");

  const currentProject = projects.find(
    (project) => project.id === selectedProject
  );

  const projectName = currentProject?.name || "";

  const currentData = selectedProject
    ? projectData[selectedProject] || createEmptyProjectData()
    : createEmptyProjectData();

  const milestones = currentData.milestones || [];
const constraints = currentData.constraints || [];
const longLeadItems = currentData.longLeadItems || [];
const issues = currentData.issues || [];
const todos = currentData.todos || [];
const teamMembers = currentData.teamMembers || [];
const submittals = currentData.submittals || [];
const revenueHistory = currentData.revenueHistory || [];
const scheduleActivities = currentData.scheduleActivities || [];
const scheduleSnapshots = currentData.scheduleSnapshots || [];
const pullPlans = currentData.pullPlans || {};
const workZones = currentData.workZones || [];
const ppcHistory = currentData.ppcHistory || [];
const projectHealthOS = currentData.projectHealthOS || {
  reviewItems: [],
  issues: [],
  todos: [],
  reviewHistory: [],
};
  const latestScheduleSnapshot = scheduleSnapshots?.[scheduleSnapshots.length - 1] || {};

const latestScheduleActivities =
  latestScheduleSnapshot.activities ||
  latestScheduleSnapshot.scheduleActivities ||
  latestScheduleSnapshot.rows ||
  latestScheduleSnapshot.data ||
  currentData?.scheduleActivities ||
  [];

const latestScheduleRelationships =
  latestScheduleSnapshot.relationships ||
  latestScheduleSnapshot.scheduleRelationships ||
  currentData?.scheduleRelationships ||
  [];
  console.log("REL SAMPLE", latestScheduleRelationships[0]);
console.log("REL COUNT", latestScheduleRelationships.length);

  const openTodos = todos.filter((todo) => todo.status === "Open");
  const overdueTodos = todos.filter((todo) => isOverdue(todo));

  const activeMilestones = milestones.filter((m) => !m.archived);
  const archivedMilestones = milestones.filter((m) => m.archived);
  const offTrackMilestones = activeMilestones.filter(
    (m) => m.status === "Off Track"
  );
  const atRiskMilestones = activeMilestones.filter(
    (m) => m.status === "At Risk"
  );

  const openConstraints = constraints.filter((c) => c.status !== "Closed");
  const escalatedConstraints = constraints.filter(
    (c) => c.status === "Escalated"
  );

  const openIssues = issues.filter(
    (i) => i.status !== "Closed" && !i.archived
  );

  const actionAssignedIssues = issues.filter(
    (i) => i.status === "Action Assigned"
  );

  const agingIssues = openIssues.filter(
    (issue) => getAgeInDays(issue.createdAt) >= 7
  );

  const executiveAttentionIssues = openIssues.filter((issue) =>
    needsExecutiveAttention(issue)
  );

  const executiveAttentionTotal =
    executiveAttentionIssues.length +
    escalatedConstraints.length +
    offTrackMilestones.length +
    overdueTodos.length;

  let projectHealth = "Green";
  let projectHealthNote = "Project appears stable based on current indicators.";

  if (
    overdueTodos.length > 0 ||
    offTrackMilestones.length > 0 ||
    escalatedConstraints.length > 0
  ) {
    projectHealth = "Red";
    projectHealthNote =
      "Immediate attention required due to overdue actions, off-track milestones, or escalated constraints.";
  } else if (
    atRiskMilestones.length > 0 ||
    openIssues.length > 0 ||
    openConstraints.length > 0
  ) {
    projectHealth = "Yellow";
    projectHealthNote =
      "Monitor closely.  Project has active risks, open issues, or unresolved constraints.";
  }

  const permissions = {
    canCreateProject: ["Admin", "Executive"].includes(mockRole),
    canArchiveProject: ["Admin", "Executive"].includes(mockRole),
    canRestoreProject: ["Admin", "Executive"].includes(mockRole),
    canDeleteProject: ["Admin"].includes(mockRole),

    canAddMilestone: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),
    canArchiveMilestone: ["Admin", "Executive", "Project Manager"].includes(
      mockRole
    ),

   canAddConstraint: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),
    canMoveConstraintToIssue: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),

    canUpdateIssueStatus: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),
    canCreateTodoFromIssue: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),
    canArchiveIssue: ["Admin", "Executive", "Project Manager"].includes(
      mockRole
    ),

    canAddTodo: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),
    canCompleteTodo: [
      "Admin",
      "Executive",
      "Project Manager",
      "Superintendent",
    ].includes(mockRole),

    canViewOnly: mockRole === "Read Only",
  };

  useEffect(() => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        activePage,
        projects,
        selectedProject,
        projectData,
      })
    );
  } catch (error) {
    console.error("ConstraintOS save failed:", error);
  }
}, [activePage, projects, selectedProject, projectData]);
  function createProject(e) {
    e.preventDefault();

    if (!projectForm.name.trim()) {
      alert("Please enter a project name.");
      return;
    }

    const newProject = {
      id: Date.now().toString(),
      ...projectForm,
    };

    setProjects([...projects, newProject]);

    setProjectData({
      ...projectData,
      [newProject.id]: createEmptyProjectData(),
    });

    setSelectedProject(newProject.id);
setActivePage("SentinelOS Home");

    setProjectForm({
      name: "",
      number: "",
      client: "",
      location: "",
      type: "Design-Build",
      status: "Active",
    });
  }
  
  function archiveProject(projectId) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "Archived" } : project
      )
    );

    if (selectedProject === projectId) {
      setSelectedProject("");
      setActivePage("Project Setup");
    }
  }

  function restoreProject(projectId) {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: "Active" } : project
      )
    );
  }

  function deleteProject(projectId) {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this project and all related workflow data?"
    );

    if (!confirmed) return;

    setProjects((prev) => prev.filter((project) => project.id !== projectId));

    setProjectData((prev) => {
      const updated = { ...prev };
      delete updated[projectId];
      return updated;
    });

    if (selectedProject === projectId) {
      setSelectedProject("");
      setActivePage("Project Setup");
    }
  }
function clearCurrentProjectData() {
  if (!selectedProject) return;

  const confirmed = window.confirm(
    "Are you sure you want to clear all workflow data for this project?  This will remove milestones, constraints, issues, to-dos, and schedule snapshots.  The project itself will remain."
  );

  if (!confirmed) return;

  updateCurrentProjectData(createEmptyProjectData());

  alert("Project workflow data has been cleared.");
}
  function updateCurrentProjectData(updates) {
    if (!selectedProject) return;

    setProjectData((prev) => ({
      ...prev,
      [selectedProject]: {
        ...(prev[selectedProject] || createEmptyProjectData()),
        ...updates,
      },
    }));
  }
  
function updateProjectHealthOS(updatedHealthData) {
  updateCurrentProjectData({
    projectHealthOS: updatedHealthData,
  });
}

  function updateMilestoneStatus(id) {
    const statusFlow = ["Imported", "On Track", "At Risk", "Off Track", "Complete"];

    updateCurrentProjectData({
      milestones: milestones.map((milestone) => {
        if (milestone.id !== id) return milestone;

        const currentIndex = statusFlow.indexOf(milestone.status);
        const nextStatus = statusFlow[(currentIndex + 1) % statusFlow.length];

        return {
          ...milestone,
          status: nextStatus,
        };
      }),
    });
  }

  function archiveMilestone(id) {
    updateCurrentProjectData({
      milestones: milestones.map((milestone) =>
        milestone.id === id ? { ...milestone, archived: true } : milestone
      ),
    });
  }
  function unarchiveMilestone(id) {
  updateCurrentProjectData({
    milestones: milestones.map((milestone) =>
      milestone.id === id ? { ...milestone, archived: false } : milestone
    ),
  });
}

  function addMilestone(e) {
    e.preventDefault();

    if (!selectedProject) {
      alert("Please create or select a project first.");
      return;
    }

    if (!milestoneForm.name || !milestoneForm.due) {
      alert("Please enter a milestone name and target date.");
      return;
    }

    updateCurrentProjectData({
      milestones: [...milestones, { id: Date.now(), ...milestoneForm }],
    });

    setMilestoneForm({ name: "", due: "", status: "On Track" });
  }

  function importMilestones(importedMilestones) {
  if (!selectedProject) {
    alert("Please create or select a project first.");
    return;
  }

  if (!importedMilestones || importedMilestones.length === 0) {
    alert("No milestones were selected to import.");
    return;
  }

  const formattedMilestones = importedMilestones.map((milestone, index) => ({
    id: Date.now() + index,
    name: milestone.activityName || milestone.name,
    due: milestone.finish || milestone.due,
    status: "Imported",
    sourceActivityId: milestone.activityId || "",
  }));

  updateCurrentProjectData({
    milestones: [...milestones, ...formattedMilestones],
  });

 }

function importIssuesFromSchedule(importedIssues) {
  if (!selectedProject) {
    alert("Please create or select a project first.");
    return;
  }

  if (!importedIssues || importedIssues.length === 0) {
    alert("No schedule activities were selected to create issues.");
    return;
  }

  const formattedIssues = importedIssues.map((item, index) => ({
    id: Date.now() + index,
    title: item.activityName || item.name,
    source: "Schedule Intelligence",
    scheduleDeltaType: item.scheduleDeltaType || "Current Schedule Activity",
    activityId: item.activityId,
    start: item.start,
    finish: item.finish,
    totalFloat: item.totalFloat,
    milestone: item.milestone || "Unassigned",
    status: "Open",
    manuallyEscalated: false,
    createdAt: new Date().toISOString(),
    notes: "Issue created manually from current schedule activity.",
  }));

  updateCurrentProjectData({
    issues: [...issues, ...formattedIssues],
  });

  alert("Selected schedule activities were added to Issues Board.");
}
  function addConstraint(e) {
    e.preventDefault();

    if (!selectedProject) {
      alert("Please create or select a project first.");
      return;
    }

    if (
      !constraintForm.description ||
      !constraintForm.owner ||
      !constraintForm.requiredBy
    ) {
      alert("Please enter a constraint, owner, and required-by date.");
      return;
    }

    updateCurrentProjectData({
      constraints: [
        ...constraints,
        {
          id: Date.now(),
          ...constraintForm,
          milestone: constraintForm.milestone || "Unassigned",
        },
      ],
    });

    setConstraintForm({
      description: "",
      owner: "",
      requiredBy: "",
      milestone: "",
      status: "Open",
    });
  }
  function archiveConstraint(constraintId) {
  updateCurrentProjectData({
    constraints: constraints.map((constraint) =>
      constraint.id === constraintId
        ? { ...constraint, archived: true, archivedAt: new Date().toISOString() }
        : constraint
    ),
  });
}

function deleteConstraint(constraintId) {
  const confirmed = window.confirm(
    "Delete this constraint permanently? This cannot be undone."
  );

  if (!confirmed) return;

  updateCurrentProjectData({
    constraints: constraints.filter((constraint) => constraint.id !== constraintId),
  });
}

  function updateConstraintStatus(id) {
    const statusFlow = ["Open", "Waiting", "Escalated", "Closed"];

    updateCurrentProjectData({
      constraints: constraints.map((constraint) => {
        if (constraint.id !== id) return constraint;

        const nextStatus =
          statusFlow[
            (statusFlow.indexOf(constraint.status) + 1) % statusFlow.length
          ];

        return { ...constraint, status: nextStatus };
      }),
    });
  }

  function moveConstraintToIssue(constraint) {
    const newIssue = {
      id: Date.now(),
      title: constraint.description,
      source: "Constraint Board",
      activityId: "-",
      start: "",
      finish: constraint.requiredBy,
      totalFloat: "",
      owner: constraint.owner || "Unassigned",
      milestone: constraint.milestone || "Unassigned",
      status: "Open",
      manuallyEscalated: false,
      createdAt: new Date().toISOString(),
    };

    updateCurrentProjectData({
      issues: [...issues, newIssue],
      constraints: constraints.map((item) =>
        item.id === constraint.id ? { ...item, status: "Escalated" } : item
      ),
    });

    alert("Constraint moved to Issues Board.");
  }
function updateLongLeadItems(items) {
  updateCurrentProjectData({
    longLeadItems: items,
  });
}
  function updateIssueStatus(id) {
    const statusFlow = ["Open", "Discussing", "Action Assigned", "Closed"];

    updateCurrentProjectData({
      issues: issues.map((issue) => {
        if (issue.id !== id) return issue;

        const currentIndex = statusFlow.indexOf(issue.status);
        const nextStatus =
          statusFlow[(currentIndex + 1) % statusFlow.length];

        return {
          ...issue,
          status: nextStatus,
        };
      }),
    });
  }

  function toggleIssueEscalation(id) {
    updateCurrentProjectData({
      issues: issues.map((issue) =>
        issue.id === id
          ? { ...issue, manuallyEscalated: !issue.manuallyEscalated }
          : issue
      ),
    });
  }

  function archiveIssue(id) {
    updateCurrentProjectData({
      issues: issues.map((issue) =>
        issue.id === id ? { ...issue, archived: true } : issue
      ),
    });
  }
  function deleteIssue(id) {
  const confirmed = window.confirm(
    "Are you sure you want to permanently delete this archived issue?"
  );

  if (!confirmed) return;

  updateCurrentProjectData({
    issues: issues.filter((issue) => issue.id !== id),
  });
}

  function updateIssueNotes(issueId, notes) {
    updateCurrentProjectData({
      issues: issues.map((issue) =>
        issue.id === issueId ? { ...issue, notes } : issue
      ),
    });
  }

  function createManualTodoFromIssue(issue, todoData) {
    if (!todoData.action || !todoData.owner || !todoData.dueDate) {
      alert("Please enter a To-Do action, owner, and due date.");
      return;
    }

    const newTodo = {
  id: Date.now(),
  action: todoData.action,
  owner: todoData.owner,
  assignedToUserId: todoData.assignedToUserId || "",
  reminderEnabled: true,
  dueDate: todoData.dueDate,
  status: "Open",
  sourceIssueId: issue.id,
  sourceIssueTitle: issue.title,
  discussionNotes: issue.notes || "",
};

    updateCurrentProjectData({
      todos: [...todos, newTodo],
      issues: issues.map((item) =>
  item.id === issue.id
    ? {
        ...item,
        status: "Action Assigned",
        assignedActionOwner: todoData.owner || "",
        assignedActionUserId: todoData.assignedToUserId || "",
        assignedActionDueDate: todoData.dueDate || "",
      }
    : item
),
    });

    alert("To-Do created from IDS action.");
  }

  function addTeamMember(e) {
  e.preventDefault();

  if (!teamMemberForm.name.trim() || !teamMemberForm.email.trim()) {
    alert("Please enter a team member name and email.");
    return;
  }

  const emailAlreadyExists = teamMembers.some(
  (member) =>
    member.id !== editingTeamMemberId &&
    member.email.toLowerCase() ===
      teamMemberForm.email.trim().toLowerCase()
);

  if (emailAlreadyExists) {
    alert("A team member with this email already exists for this project.");
    return;
  }

  if (editingTeamMemberId) {
  updateCurrentProjectData({
    teamMembers: teamMembers.map((member) =>
      member.id === editingTeamMemberId
        ? {
            ...member,
            name: teamMemberForm.name.trim(),
            email: teamMemberForm.email.trim(),
            company: teamMemberForm.company.trim(),
            role: teamMemberForm.role.trim(),
          }
        : member
    ),
  });

  setEditingTeamMemberId(null);
} else {
  const newTeamMember = {
    id: Date.now().toString(),
    name: teamMemberForm.name.trim(),
    email: teamMemberForm.email.trim(),
    company: teamMemberForm.company.trim(),
    role: teamMemberForm.role.trim(),
  };

    updateCurrentProjectData({
    teamMembers: [...teamMembers, newTeamMember],
  });
}

setTeamMemberForm({
  name: "",
  email: "",
  company: "",
  role: "",
});

setEditingTeamMemberId(null);
}

function deleteTeamMember(memberId) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this team member?"
  );

  if (!confirmed) return;

  updateCurrentProjectData({
    teamMembers: teamMembers.filter((member) => member.id !== memberId),
  });
}
  function addTodo(e) {
    e.preventDefault();

    if (!selectedProject) {
      alert("Please create or select a project first.");
      return;
    }

    if (!todoForm.action || !todoForm.owner || !todoForm.dueDate) {
      alert("Please enter a To-Do, owner, and due date.");
      return;
    }

    updateCurrentProjectData({
  todos: [
    ...todos,
    {
      id: Date.now(),
      ...todoForm,
      assignedToUserId: todoForm.assignedToUserId || "",
      reminderEnabled: todoForm.reminderEnabled ?? true,
    },
  ],
});

setTodoForm({
  action: "",
  owner: "",
  dueDate: "",
  status: "Open",
  assignedToUserId: "",
  reminderEnabled: true,
});
  }

  function completeTodo(id) {
    const completed = todos.find((todo) => todo.id === id);

    if (completed) {
      setLastCompletedTodo({ project: selectedProject, todo: completed });
    }

    updateCurrentProjectData({
      todos: todos.filter((todo) => todo.id !== id),
    });
  }

  function undoCompleteTodo() {
    if (!lastCompletedTodo) return;

    setProjectData((prev) => ({
      ...prev,
      [lastCompletedTodo.project]: {
        ...(prev[lastCompletedTodo.project] || createEmptyProjectData()),
        todos: [
          ...(prev[lastCompletedTodo.project]?.todos || []),
          lastCompletedTodo.todo,
        ],
      },
    }));

    setLastCompletedTodo(null);
  }

  function goToPageWithFilter(page, filter) {
    setDashboardFilter(filter);
    setActivePage(page);
  }

  function handleSetActivePage(page) {
    setDashboardFilter("");
    setActivePage(page);
  }

  function renderNoProjectSelected() {
    return (
      <div className="card">
        <h3>No Project Selected</h3>
        <p>
          Create or select a project in Project Setup before using the workflow
          tools.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        activePage={activePage}
        setActivePage={handleSetActivePage}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        projects={projects}
      />

      <main className="main">
      {activePage === "SentinelOS Home" && (
  <SentinelHome
    projects={projects}
    projectData={projectData}
    selectedProject={selectedProject}
    setSelectedProject={setSelectedProject}
    setActivePage={setActivePage}
  />
)}
{activePage === "Project Health Dashboard" &&
  (selectedProject ? (
    <>
      <div className="grid">
        <div
          className="metric-link"
          onClick={() =>
            goToPageWithFilter("Schedule Milestones", "active-milestones")
          }
        >
          <Metric
            title="Active Milestones"
            value={activeMilestones.length}
            note={`${archivedMilestones.length} archived`}
          />
        </div>

        <div
          className="metric-link"
          onClick={() =>
            goToPageWithFilter("Schedule Milestones", "milestone-risk")
          }
        >
          <Metric
            title="Milestone Risk"
            value={offTrackMilestones.length}
            note={`${atRiskMilestones.length} at risk`}
          />
        </div>

        <div
          className="metric-link"
          onClick={() =>
            goToPageWithFilter("Constraint Board", "open-constraints")
          }
        >
          <Metric
            title="Open Constraints"
            value={openConstraints.length}
            note={`${escalatedConstraints.length} escalated`}
          />
        </div>

        <div
          className="metric-link"
          onClick={() => goToPageWithFilter("Issues Board", "open-issues")}
        >
          <Metric
            title="Open Issues"
            value={openIssues.length}
            note={`${actionAssignedIssues.length} action assigned`}
          />
        </div>

        <div
          className="metric-link"
          onClick={() => goToPageWithFilter("Issues Board", "aging-issues")}
        >
          <Metric
            title="Aging Issues"
            value={agingIssues.length}
            note="Open 7+ days"
          />
        </div>

        <div
          className="metric-link"
          onClick={() =>
            goToPageWithFilter("Executive Attention", "exec-attention")
          }
        >
          <Metric
            title="Exec Attention"
            value={executiveAttentionTotal}
            note="Needs leadership review"
          />
        </div>

        <div
          className="metric-link"
          onClick={() => goToPageWithFilter("To-Dos", "open-todos")}
        >
          <Metric
            title="Open To-Dos"
            value={openTodos.length}
            note={`${overdueTodos.length} overdue`}
          />
        </div>
      </div>
    </>
  ) : (
    renderNoProjectSelected()
  ))}
  {activePage === "Project Health Reviews" &&
  (selectedProject ? (
    <ProjectHealthOS
      project={projectName}
      projectHealthOS={projectHealthOS}
      updateProjectHealthOS={updateProjectHealthOS}
      issues={issues}
      todos={todos}
      updateCurrentProjectData={updateCurrentProjectData}
      permissions={permissions}
    />
  ) : (
    renderNoProjectSelected()
  ))}
        
        {activePage === "Project Setup" && (
          <ProjectSetup
  projectForm={projectForm}
  setProjectForm={setProjectForm}
  createProject={createProject}
  projects={projects}
  selectedProject={selectedProject}
  setSelectedProject={setSelectedProject}
  archiveProject={archiveProject}
  restoreProject={restoreProject}
  deleteProject={deleteProject}
  clearCurrentProjectData={clearCurrentProjectData}
  permissions={permissions}
  teamMembers={teamMembers}
  teamMemberForm={teamMemberForm}
setTeamMemberForm={setTeamMemberForm}
editingTeamMemberId={editingTeamMemberId}
setEditingTeamMemberId={setEditingTeamMemberId}
addTeamMember={addTeamMember}
deleteTeamMember={deleteTeamMember}
/>
        )}

        {activePage === "Executive Attention" &&
          (selectedProject ? (
            <ExecutiveAttentionCenter
              project={projectName}
              milestones={milestones}
              constraints={constraints}
              issues={issues}
              todos={todos}
              updateIssueStatus={updateIssueStatus}
              archiveIssue={archiveIssue}
              permissions={permissions}
            />
          ) : (
            renderNoProjectSelected()
          ))}

        {activePage === "Executive Dashboard" && (
          <div className="page">
            <div className="print-report-header print-only">
  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="ConstraintOS" className="print-logo" />
  <div>
    <h1>ConstraintOS Executive Dashboard</h1>
    <p>Portfolio Operational Summary</p>
  </div>
</div>
            <div className="page-header">
  <div>
    <h1>Executive Dashboard</h1>
    <p>Portfolio-level view across active projects.</p>
  </div>

  <button
    type="button"
    className="secondary-button no-print"
    onClick={() => window.print()}
  >
    Print / Export
  </button>
</div>

            <div className="grid">
              <div
                className="metric-link"
                onClick={() => setActivePage("Schedule Milestones")}
              >
                <Metric
                  title="Active Milestones"
                  value={activeMilestones.length}
                  note={`${archivedMilestones.length} archived`}
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("Schedule Milestones")}
              >
                <Metric
                  title="Milestone Risk"
                  value={offTrackMilestones.length}
                  note={`${atRiskMilestones.length} at risk`}
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("Constraint Board")}
              >
                <Metric
                  title="Open Constraints"
                  value={openConstraints.length}
                  note={`${escalatedConstraints.length} escalated`}
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("Issues Board")}
              >
                <Metric
                  title="Open Issues"
                  value={openIssues.length}
                  note={`${actionAssignedIssues.length} action assigned`}
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("Issues Board")}
              >
                <Metric
                  title="Aging Issues"
                  value={agingIssues.length}
                  note="Open 7+ days"
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("Executive Attention")}
              >
                <Metric
                  title="Exec Attention"
                  value={Object.values(projectData).reduce((total, data) => {
                    const execIssues = (data.issues || []).filter((issue) =>
                      needsExecutiveAttention(issue)
                    );

                    const projectEscalatedConstraints = (
                      data.constraints || []
                    ).filter((constraint) => constraint.status === "Escalated");

                    const projectOffTrackMilestones = (
                      data.milestones || []
                    ).filter(
                      (milestone) =>
                        !milestone.archived &&
                        milestone.status === "Off Track"
                    );

                    const projectOverdueTodos = (data.todos || []).filter(
                      (todo) => isOverdue(todo)
                    );

                    return (
                      total +
                      execIssues.length +
                      projectEscalatedConstraints.length +
                      projectOffTrackMilestones.length +
                      projectOverdueTodos.length
                    );
                  }, 0)}
                  note="Needs leadership review"
                />
              </div>

              <div
                className="metric-link"
                onClick={() => setActivePage("To-Dos")}
              >
                <Metric
                  title="Open To-Dos"
                  value={openTodos.length}
                  note={`${overdueTodos.length} overdue`}
                />
              </div>
            </div>

            <OperationalFeed
              projects={projects}
              projectData={projectData}
              isOverdue={isOverdue}
              getAgeInDays={getAgeInDays}
            />

            <div className="data-card project-health-card">
              <h2>Portfolio Health Summary</h2>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Health</th>
                    <th>Status</th>
                    <th>Milestones</th>
                    <th>Off Track</th>
                    <th>Constraints</th>
                    <th>Open Issues</th>
                    <th>Aging Issues</th>
                    <th>Exec Attention</th>
                    <th>Open To-Dos</th>
                    <th>Overdue To-Dos</th>
                  </tr>
                </thead>

                <tbody>
                  {projects
                    .filter((project) => project.status !== "Archived")
                    .map((project) => {
                      const data =
                        projectData[project.id] || createEmptyProjectData();

                      const activeProjectMilestones = (
                        data.milestones || []
                      ).filter((m) => !m.archived);

                      const projectOffTrackMilestones =
                        activeProjectMilestones.filter(
                          (m) => m.status === "Off Track"
                        );

                      const projectAtRiskMilestones =
                        activeProjectMilestones.filter(
                          (m) => m.status === "At Risk"
                        );

                      const projectOpenConstraints = (
                        data.constraints || []
                      ).filter((c) => c.status !== "Closed");

                      const projectEscalatedConstraints = (
                        data.constraints || []
                      ).filter((c) => c.status === "Escalated");

                      const projectOpenIssues = (data.issues || []).filter(
                        (i) => i.status !== "Closed" && !i.archived
                      );

                      const projectAgingIssues = projectOpenIssues.filter(
                        (issue) => getAgeInDays(issue.createdAt) >= 7
                      );

                      const projectExecAttentionIssues =
                        projectOpenIssues.filter((issue) =>
                          needsExecutiveAttention(issue)
                        );

                      const projectOpenTodos = (data.todos || []).filter(
                        (todo) => todo.status === "Open"
                      );

                      const projectOverdueTodos = (data.todos || []).filter(
                        (todo) => isOverdue(todo)
                      );

                      const projectExecAttentionTotal =
                        projectExecAttentionIssues.length +
                        projectEscalatedConstraints.length +
                        projectOffTrackMilestones.length +
                        projectOverdueTodos.length;

                      let health = "Green";

                      if (
                        projectOverdueTodos.length > 0 ||
                        projectOffTrackMilestones.length > 0 ||
                        projectEscalatedConstraints.length > 0 ||
                        projectExecAttentionIssues.length > 0
                      ) {
                        health = "Red";
                      } else if (
                        projectAtRiskMilestones.length > 0 ||
                        projectOpenIssues.length > 0 ||
                        projectOpenConstraints.length > 0
                      ) {
                        health = "Yellow";
                      }

                      return (
                        <tr
                          key={project.id}
                          className="clickable-row"
                          onClick={() => {
                            setSelectedProject(project.id);
                            setActivePage("SentinelOS Home");
                          }}
                        >
                          <td>{project.name}</td>
                          <td>
                            <span
                              className={`health-pill ${health.toLowerCase()}`}
                            >
                              {health}
                            </span>
                          </td>
                          <td>{project.status}</td>
                          <td>{activeProjectMilestones.length}</td>
                          <td>{projectOffTrackMilestones.length}</td>
                          <td>{projectOpenConstraints.length}</td>
                          <td>{projectOpenIssues.length}</td>
                          <td>{projectAgingIssues.length}</td>
                          <td>{projectExecAttentionTotal}</td>
                          <td>{projectOpenTodos.length}</td>
                          <td>{projectOverdueTodos.length}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

          {activePage === "Schedule Intelligence" &&
  (selectedProject ? (
  <ScheduleIntelligence
  project={projectName}
  scheduleSnapshots={scheduleSnapshots}
  updateCurrentProjectData={updateCurrentProjectData}
  issues={issues}
  milestones={milestones}
  importMilestones={importMilestones}
  importIssuesFromSchedule={importIssuesFromSchedule}
/>
  ) : (
    renderNoProjectSelected()
  ))}
  {activePage === "TIA Intelligence" &&
  (selectedProject ? (
    <TIAIntelligence
      scheduleSnapshots={scheduleSnapshots}
      issues={issues}
      updateCurrentProjectData={updateCurrentProjectData}
    />
  ) : (
    renderNoProjectSelected()
  ))}
  {activePage === "Revenue Forecast" &&
  (selectedProject ? (
    <RevenueForecast
  scheduleSnapshots={scheduleSnapshots}
  revenueHistory={revenueHistory}
  updateCurrentProjectData={updateCurrentProjectData}
/>
  ) : (
    renderNoProjectSelected()
  ))}
    {activePage === "4-Week Look Ahead and Sprint Plan" &&
  (selectedProject ? (
    <FourWeekLookAhead
      project={projectName}
      activities={latestScheduleActivities}
      scheduleActivities={latestScheduleActivities}
      scheduleRelationships={latestScheduleRelationships}
      milestones={milestones}
      constraints={constraints}
      issues={issues}
      submittals={submittals}
      pullPlans={pullPlans}
      workZones={workZones}
      updateCurrentProjectData={updateCurrentProjectData}
      setConstraintForm={setConstraintForm}
      setActivePage={setActivePage}
      ppcHistory={ppcHistory}
setPpcHistory={(nextPpcHistory) =>
  updateCurrentProjectData({
    ppcHistory: nextPpcHistory,
  })
}
          />
  ) : (
    renderNoProjectSelected()
  ))}
  {activePage === "Submittal Readiness" &&
  (selectedProject ? (
    <SubmittalReadiness
      project={projectName}
      submittals={submittals}
      scheduleActivities={latestScheduleActivities}
      issues={issues}
      updateCurrentProjectData={updateCurrentProjectData}
    />
  ) : (
    renderNoProjectSelected()
  ))}
        {activePage === "Schedule Milestones" &&
  (selectedProject ? (
    <ScheduleMilestones
      project={selectedProject.name}
      milestones={milestones || []}
      milestoneForm={milestoneForm}
      setMilestoneForm={setMilestoneForm}
      addMilestone={addMilestone}
      updateMilestoneStatus={updateMilestoneStatus}
      archiveMilestone={archiveMilestone}
       unarchiveMilestone={unarchiveMilestone}
      permissions={permissions}
      issues={issues || []}
      todos={todos}
      updateCurrentProjectData={updateCurrentProjectData}
    />
  ) : (
    renderNoProjectSelected()
  ))}

        {activePage === "Constraint Board" &&
          (selectedProject ? (
            <ConstraintBoard
  project={selectedProject}
  teamMembers={teamMembers}
  milestones={milestones}
  constraints={constraints}
  constraintForm={constraintForm}
  setConstraintForm={setConstraintForm}
  addConstraint={addConstraint}
  updateConstraintStatus={updateConstraintStatus}
  moveConstraintToIssue={moveConstraintToIssue}
  setActivePage={setActivePage}
  archiveConstraint={archiveConstraint}
deleteConstraint={deleteConstraint}
/>

          ) : (
            renderNoProjectSelected()
          ))}

        {activePage === "Issues Board" &&
          (selectedProject ? (
            <IssuesBoard
  project={projectName}
  issues={issues}
  updateIssueStatus={updateIssueStatus}
  updateIssueNotes={updateIssueNotes}
  createManualTodoFromIssue={createManualTodoFromIssue}
  archiveIssue={archiveIssue}
  toggleIssueEscalation={toggleIssueEscalation}
  permissions={permissions}
  dashboardFilter={dashboardFilter}
  deleteIssue={deleteIssue}
  teamMembers={teamMembers}
/>
          ) : (
            renderNoProjectSelected()
          ))}
          {activePage === "Long Lead Items" &&
  (selectedProject ? (
    <LongLeadItemBoard
  longLeadItems={longLeadItems}
  updateLongLeadItems={updateLongLeadItems}
  scheduleActivities={latestScheduleActivities}
  submittals={submittals}
  issues={issues}
  constraints={constraints}
  updateCurrentProjectData={updateCurrentProjectData}
/>
  ) : (
    renderNoProjectSelected()
  ))}
        
        {activePage === "To-Dos" &&
          (selectedProject ? (
            <TodosPage
  project={projectName}
  todos={todos}
  todoForm={todoForm}
  setTodoForm={setTodoForm}
  addTodo={addTodo}
  completeTodo={completeTodo}
  undoCompleteTodo={undoCompleteTodo}
  lastCompletedTodo={lastCompletedTodo}
  permissions={permissions}
  dashboardFilter={dashboardFilter}
  teamMembers={teamMembers}
  teamMemberForm={teamMemberForm}
  setTeamMemberForm={setTeamMemberForm}
  addTeamMember={addTeamMember}
/>
          ) : (
            renderNoProjectSelected()
          ))}

        {![
  "Project Setup",
  "Project Health Dashboard",
  "Executive Dashboard",
  "Schedule Intelligence",
  "TIA Intelligence",
  "Revenue Forecast",
  "4-Week Look Ahead and Sprint Plan",
  "Submittal Readiness",
  "Schedule Milestones",
  "Constraint Board",
  "Long Lead Items",
  "Issues Board",
  "To-Dos",
  "Executive Attention",
  "SentinelOS Home",
  "Project Health Reviews",
"Design Integration Dashboard",
"Long Lead Dashboard",
"Procurement Dashboard",
].includes(activePage) && (
          <div className="card">
            <h3>{activePage}</h3>
            <p>This page is ready to reconnect as its own component.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;


