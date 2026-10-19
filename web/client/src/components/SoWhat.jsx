/**
 * SoWhat — Dark insight panel matching the Power BI "So what" section.
 */
export default function SoWhat({ children }) {
  return (
    <div className="so-what" id="so-what-panel">
      <div className="so-what__title">
        <span className="so-what__dot" /> So what
      </div>
      <div className="so-what__text">{children}</div>
    </div>
  );
}
