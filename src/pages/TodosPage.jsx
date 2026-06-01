import { useState } from "react";
function TodosPage({
  project,
  todos,
  todoForm,
  setTodoForm,
  addTodo,
  completeTodo,
  undoCompleteTodo,
  lastCompletedTodo,
  permissions,
  dashboardFilter,
  teamMembers,
  teamMemberForm,
  setTeamMemberForm,
  addTeamMember,
}) {
  const [selectedTeamMemberFilter, setSelectedTeamMemberFilter] = useState("");
  const visibleTodos = (
  selectedTeamMemberFilter
    ? todos.filter((todo) => todo.assignedToUserId === selectedTeamMemberFilter)
    : todos
).sort((a, b) => {
  if (!a.dueDate && !b.dueDate) return 0;
  if (!a.dueDate) return 1;
  if (!b.dueDate) return -1;

  return new Date(a.dueDate) - new Date(b.dueDate);
});

const assignedOpenTodos = todos.filter(
  (todo) =>
    todo.status !== "Complete" &&
    todo.status !== "Closed" &&
    todo.assignedToUserId
);

function isOverdue(todo) {
  if (!todo.dueDate) return false;

  const today = new Date();
  const dueDate = new Date(todo.dueDate);

  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return (
    dueDate < today &&
    todo.status !== "Complete" &&
    todo.status !== "Closed"
  );
}

const overdueAssignedTodos = assignedOpenTodos.filter((todo) =>
  isOverdue(todo)
);
  function handleChange(e) {
    const { name, value } = e.target;
    setTodoForm({ ...todoForm, [name]: value });
  }
function generateReminderEmails() {
  const openReminderTodos = todos.filter(
    (todo) =>
      todo.status !== "Complete" &&
      todo.status !== "Closed" &&
      todo.assignedToUserId &&
      todo.reminderEnabled !== false
  );

  const groupedByUser = openReminderTodos.reduce((groups, todo) => {
    if (!groups[todo.assignedToUserId]) {
      groups[todo.assignedToUserId] = [];
    }

    groups[todo.assignedToUserId].push(todo);
    return groups;
  }, {});

  return Object.entries(groupedByUser)
    .map(([userId, userTodos]) => {
      const user = teamMembers.find((member) => member.id === userId);

      if (!user) return null;

      return {
        user,
        todos: userTodos,
        subject: `ConstraintOS Daily To-Do Reminder - ${project}`,
        body: `${user.name},

Below are your open To-Dos for ${project}:

${userTodos
  .map(
    (todo, index) =>
      `${index + 1}. ${todo.action}
Owner: ${todo.owner || "Unassigned"}
Due: ${todo.dueDate || "No due date"}
Status: ${todo.status || "Open"}`
  )
  .join("\n\n")}

Please complete or update these items in ConstraintOS.

Thanks,`,
      };
    })
    .filter(Boolean);
}
  return (
    <div className="page">
    
      <div className="card">
  <h2>To-Do Workload</h2>

  <div className="metric-grid">
    <div className="mini-metric">
      <strong>{assignedOpenTodos.length}</strong>
      <span>Assigned Open Actions</span>
    </div>

    <div className="mini-metric">
      <strong>{overdueAssignedTodos.length}</strong>
      <span>Overdue Assigned Actions</span>
    </div>

    <div className="mini-metric">
      <strong>{teamMembers.length}</strong>
      <span>Project Team Members</span>
    </div>
  </div>

  <div style={{ marginTop: "16px" }}>
    <label>
      Filter by Team Member
      <select
        value={selectedTeamMemberFilter}
        onChange={(e) => setSelectedTeamMemberFilter(e.target.value)}
      >
        <option value="">All Team Members</option>

        {teamMembers.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} - {member.email}
          </option>
        ))}
      </select>
    </label>
  </div>
  <h3 style={{ marginTop: "20px" }}>Open Actions by Team Member</h3>

<table className="data-table">
  <thead>
    <tr>
      <th>Team Member</th>
      <th>Open Actions</th>
      <th>Overdue</th>
    </tr>
  </thead>

  <tbody>
    {teamMembers.map((member) => {
      const memberOpenTodos = todos.filter(
        (todo) =>
          todo.assignedToUserId === member.id &&
          todo.status !== "Complete"
      );

      const memberOverdueTodos = memberOpenTodos.filter((todo) => {
        if (!todo.dueDate) return false;

        const today = new Date();
        const dueDate = new Date(todo.dueDate);

        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);

        return dueDate < today;
      });

      return (
        <tr key={member.id}>
          <td>{member.name}</td>
          <td>{memberOpenTodos.length}</td>
          <td>{memberOverdueTodos.length}</td>
        </tr>
      );
    })}
  </tbody>
</table>
</div>

      {!permissions.canAddTodo && (
        <div className="card">
          <p>You have read-only access to To-Dos.</p>
        </div>
      )}

      <form className="entry-form milestone-form" onSubmit={addTodo}>
        

        <div className="form-group">
          <label>Owner</label>
          <input
            name="owner"
            value={todoForm.owner}
            onChange={handleChange}
            placeholder="Owner"
            disabled={!permissions.canAddTodo}
          />
        </div>
        <div className="form-group">
  <label>Assigned To</label>
        <select
  name="assignedToUserId"
  value={todoForm.assignedToUserId || ""}
  onChange={(e) => {
    const selectedUser = teamMembers.find(
      (member) => member.id === e.target.value
    );

    setTodoForm({
      ...todoForm,
      assignedToUserId: e.target.value,
      owner: selectedUser?.name || "",
    });
  }}
>
  <option value="">Assign to team member</option>
  {teamMembers.map((member) => (
    <option key={member.id} value={member.id}>
      {member.name} - {member.email}
    </option>
  ))}

</select>
</div>
<label className="checkbox-row">
  <input
    type="checkbox"
    checked={todoForm.reminderEnabled ?? true}
    onChange={(e) =>
      setTodoForm({
        ...todoForm,
        reminderEnabled: e.target.checked,
      })
    }
  />
  Daily reminder until complete
</label>

        

        <div className="form-button-group">
          <label>&nbsp;</label>
          <button type="submit" disabled={!permissions.canAddTodo}>
            + Add To-Do
          </button>
        </div>
      </form>

      {lastCompletedTodo && (
        <div className="card">
          <p>Last completed To-Do: {lastCompletedTodo.todo.action}</p>
          <button
            type="button"
            className="secondary-button small-button"
            onClick={undoCompleteTodo}
            disabled={!permissions.canCompleteTodo}
          >
            Undo Complete
          </button>
        </div>
      )}

<div className="card">
  <h3>
    Active Reminders:{" "}
    {
      todos.filter(
        (todo) =>
          todo.status !== "Complete" &&
          todo.assignedToUserId &&
          todo.reminderEnabled !== false
      ).length
    }
  </h3>

  <p>
    Open To-Dos assigned to team members that will receive daily reminders.
  </p>
</div>
      <div className="data-card">
        <h2>Open To-Dos</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Assigned To</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {visibleTodos.length === 0 && (
              <tr>
                <td colSpan="5">No To-Dos have been added yet.</td>
              </tr>
            )}

            {visibleTodos.map((todo) => (
              <tr key={todo.id} className={isOverdue(todo) ? "overdue-row" : ""}>
  <td>
    <strong>{todo.action}</strong>
    {todo.sourceIssueTitle && (
      <p className="table-subtext">From Issue: {todo.sourceIssueTitle}</p>
    )}
    {todo.discussionNotes && (
      <p className="table-subtext">Discussion Notes: {todo.discussionNotes}</p>
    )}
  </td>
  <td>
  {teamMembers.find((member) => member.id === todo.assignedToUserId)?.name ||
    todo.owner ||
    "Unassigned"}
</td>
  <td>{todo.dueDate || "-"}</td>
  <td>{todo.status}</td>
  <td>
                  <button
                    type="button"
                    className="secondary-button small-button"
                    onClick={() => completeTodo(todo.id)}
                    disabled={!permissions.canCompleteTodo}
                  >
                    Complete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
    </div>
  );
}

export default TodosPage;