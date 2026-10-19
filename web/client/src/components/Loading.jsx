/**
 * Loading spinner component.
 */
export default function Loading({ message = 'Loading…' }) {
  return (
    <div className="loading" id="loading-indicator">
      <div className="spinner" />
      {message}
    </div>
  );
}
