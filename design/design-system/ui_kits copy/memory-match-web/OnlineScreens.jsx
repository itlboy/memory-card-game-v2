const { Panel, Button, WizardHeader, OptionTile, TextField, Icon } = window.MemoryMatchDesignSystem_ce0961;

const AVATARS = ['🦊', '🐼', '🐯', '🐸'];

function OnlineEntry({ onBack, onLobby }) {
  const [entry, setEntry] = React.useState('choose');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const title = entry === 'choose' ? 'Chơi online' : entry === 'create' ? 'Tạo phòng mới' : 'Vào phòng';
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <WizardHeader title={title} onBack={() => (entry === 'choose' ? onBack() : setEntry('choose'))} />
      {entry === 'choose' && (
        <div className="mm-loose">
          <OptionTile tone="g-violet" layout="wide" icon={<Icon name="sparkles" size={34} />} title="Tạo phòng mới"
            description="Lấy mã 6 số rồi mời bạn bè vào chơi" onClick={() => setEntry('create')} />
          <OptionTile tone="g-cyan" layout="wide" icon={<Icon name="hash" size={34} />} title="Vào phòng có sẵn"
            description="Nhập mã 6 số bạn bè gửi cho" onClick={() => setEntry('join')} />
        </div>
      )}
      {entry === 'create' && (
        <div>
          <TextField label="Tên của bạn" value={name} onChange={setName} placeholder="VD: An" />
          <Button variant="primary" disabled={!name.trim()} onClick={() => onLobby(name.trim(), true)}>Tiếp tục</Button>
        </div>
      )}
      {entry === 'join' && (
        <div>
          <TextField label="Tên của bạn" value={name} onChange={setName} placeholder="VD: An" />
          <TextField label="Mã phòng" value={code} onChange={setCode} placeholder="••••••" code />
          <Button variant="primary" disabled={!name.trim() || code.length !== 6} onClick={() => onLobby(name.trim(), false)}>
            Vào phòng chơi
          </Button>
        </div>
      )}
    </Panel>
  );
}

function OnlineLobby({ me, isHost, onBack, onStart }) {
  const [copied, setCopied] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const players = [
    { id: 'p1', name: isHost ? me : 'An', avatar: '🦊', host: true, ready: true },
    { id: 'p2', name: isHost ? 'Bình' : me, avatar: '🐼', host: false, ready: isHost ? true : ready },
    { id: 'p3', name: 'Chi', avatar: '🐯', host: false, ready: false, connected: false }
  ];
  const code = '418203';
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <WizardHeader title="Phòng chờ" onBack={onBack} trailing={
        <Button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '.12em', color: 'var(--accent)' }}>
          {code}<Icon name={copied ? 'check' : 'copy'} size={16} />
        </Button>
      } />
      <ul style={{ listStyle: 'none', margin: '0 0 6px', padding: 0, display: 'grid', gap: 8 }}>
        {players.map((p) => (
          <li key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            border: '2px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--panel-soft)',
            opacity: p.connected === false ? .55 : 1
          }}>
            <span style={{ fontSize: 20 }}>{p.avatar}</span>
            <b>{p.name}</b>
            {p.host && <small style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>chủ phòng</small>}
            {p.name === me && <small style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)' }}>(bạn)</small>}
            {p.connected === false ? (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--warn)' }}>rớt mạng…</span>
            ) : (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap', fontWeight: p.ready ? 700 : 400, color: p.ready ? 'var(--ok)' : 'var(--muted)' }}>
                {p.host ? <Icon name="crown" size={15} style={{ color: 'var(--gold)' }} /> : p.ready ? '✓ sẵn sàng' : 'chưa sẵn sàng'}
              </span>
            )}
          </li>
        ))}
        <li style={{ display: 'flex', justifyContent: 'center', padding: '10px 12px', border: '2px dashed var(--line)', borderRadius: 'var(--r-md)', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
          Còn 1 chỗ trống — chia sẻ mã <b style={{ marginLeft: 4 }}>{code}</b> để mời bạn bè
        </li>
      </ul>
      {isHost ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--panel-soft)', fontSize: 'var(--text-sm)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>🧠 Cổ điển · lưới <b>4×4</b> · Động vật</span>
            <Button style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
              <Icon name="settings-2" size={16} /> Chỉnh
            </Button>
          </div>
          <Button variant="primary" onClick={onStart}>Bắt đầu</Button>
        </>
      ) : (
        <>
          <Button variant="primary" onClick={() => setReady(!ready)}
            style={ready ? { background: 'var(--ok)', boxShadow: '0 8px 22px color-mix(in srgb, var(--ok) 40%, transparent)' } : undefined}>
            {ready ? '✅ Đã sẵn sàng — bấm để huỷ' : 'Sẵn sàng!'}
          </Button>
          <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: '14px 0 0' }}>
            🧠 Cổ điển · lưới 4×4 · Động vật — chờ chủ phòng bắt đầu…
          </p>
        </>
      )}
    </Panel>
  );
}

Object.assign(window, { OnlineEntry, OnlineLobby });
