function ModuleHeader({
  logo,
  title,
  subtitle,
  description,
  project,
}) {
  return (
    <div className="module-header-card">
      <div className="module-header-logo-wrap">
        <img
          src={`${import.meta.env.BASE_URL}${logo}`}
          alt={title}
          className="module-header-logo"
        />
      </div>

      <div>
        <h1 className="module-header-title">{title}</h1>
        {subtitle && <div className="module-header-subtitle">{subtitle}</div>}
        {project && (
  <div className="module-project-banner">
    Active Project: <strong>{project}</strong>
  </div>
)}

{description && (
  <p className="module-header-description">
    {description}
  </p>
)}
      </div>
    </div>
  );
}

export default ModuleHeader;