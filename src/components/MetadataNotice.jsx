import './metadata-notice.css';

export default function MetadataNotice({ metadata }) {
  const warnings = [...new Set(metadata?.warnings || [])];
  if (!metadata?.source && !warnings.length) return null;
  return <div className={'metadata-notice' + (warnings.length ? ' needs-review' : '')}>
    {metadata?.source && <p className="metadata-source">Sumber data: {metadata.source}</p>}
    {!!warnings.length && <div role="status"><strong>Periksa sebelum digunakan</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><p>Data yang belum tersedia dapat dilengkapi melalui Input Manual.</p></div>}
  </div>;
}
