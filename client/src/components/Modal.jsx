export default function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="page-header">
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="secondary small" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
