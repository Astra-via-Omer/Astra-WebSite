import { purpose } from '@/data/chapters';

export default function MissionVision() {
  return <div className="mission-vision">
    <section>
      <h3>Our mission</h3>
      <p>{purpose.mission}</p>
    </section>
    <section>
      <h3>Our vision</h3>
      <p>{purpose.vision}</p>
    </section>
  </div>;
}
