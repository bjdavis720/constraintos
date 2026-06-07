function ModuleHeader({ logo, title, subtitle, description }) {
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
        {description && <p className="module-header-description">{description}</p>}
      </div>
    </div>
  );
}

export default ModuleHeader;