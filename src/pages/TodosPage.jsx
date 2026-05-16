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
}) {
  function handleChange(e) {
    const { name, value } = e.target;
    setTodoForm({ ...todoForm, [name]: value });
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>To-Dos</h1>
        <p>{project}</p>
      </div>

      {!permissions.canAddTodo && (
        <div className="card">
          <p>You have read-only access to To-Dos.</p>
        </div>
      )}

      <form className="entry-form milestone-form" onSubmit={addTodo}>
        <div className="form-group">
          <label>To-Do</label>
          <input
            name="action"
            value={todoForm.action}
            onChange={handleChange}
            placeholder="Action item"
            disabled={!permissions.canAddTodo}
          />
        </div>

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
          <label>Due Date</label>
          <input
            name="dueDate"
            type="date"
            value={todoForm.dueDate}
            onChange={handleChange}
            disabled={!permissions.canAddTodo}
          />
        </div>

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

      <div className="data-card">
        <h2>Open To-Dos</h2>

        <table className="data-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Owner</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {todos.length === 0 && (
              <tr>
                <td colSpan="5">No To-Dos have been added yet.</td>
              </tr>
            )}

            {todos.map((todo) => (
              <tr key={todo.id}>
  <td>
    <strong>{todo.action}</strong>
    {todo.sourceIssueTitle && (
      <p className="table-subtext">From Issue: {todo.sourceIssueTitle}</p>
    )}
    {todo.discussionNotes && (
      <p className="table-subtext">Discussion Notes: {todo.discussionNotes}</p>
    )}
  </td>
  <td>{todo.owner || "Unassigned"}</td>
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