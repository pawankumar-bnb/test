/** The drifting light behind every page. Purely decorative. */
export function Ambient() {
  return (
    <div className="ambient" aria-hidden>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="orb orb-4" />
      <div className="grid-lines" />
      <div className="grain" />
    </div>
  )
}
