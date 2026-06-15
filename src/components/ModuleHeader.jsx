function ModuleHeader({
  logo,
  title,
  subtitle,
  project,
  description,
  accentColor = "#4d8cff",
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
        <h1 className="module-header-title">
  {title?.endsWith("OS") ? title.slice(0, -2) : title}
  {title?.endsWith("OS") && (
    <span className={`module-header-title-os ${title}`}>
      OS
    </span>
  )}
</h1>
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