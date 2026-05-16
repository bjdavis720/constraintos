function Metric({ title, value, note }) {
  return (
    <div className="metric">
      <h3>{title}</h3>
      <div className="metricValue">{value}</div>
      <p>{note}</p>
    </div>
  );
}

export default Metric;