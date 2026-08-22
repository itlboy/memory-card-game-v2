const { Panel, Button, WizardHeader, OptionTile, Icon, GridPreview, CampaignNode } = window.MemoryMatchDesignSystem_ce0961;
const { grids, themes, modes, levels } = window.MM_DATA;


function WizardScreen({ state, set, onStart, onCampaign, onOnline }) {
  const { step, mode, grid, themeIds, playerCount, totalScore } = state;
  const multi = playerCount > 1;
  const path = multi
    ? ['players', 'count', 'mode', 'grid', 'theme']
    : ['players', 'mode', ...(mode === 'campaign' ? ['campaign'] : ['grid', 'theme'])];
  const idx = path.indexOf(step);
  const titles = {
    players: 'Bạn muốn chơi thế nào?', count: 'Mấy người chơi?', mode: 'Chọn chế độ',
    grid: 'Kích thước lưới', theme: 'Chọn theme thẻ'
  };
  const visible = multi ? modes.filter((m) => m.id === 'classic' || m.id === 'survival') : modes;
  const pool = new Set(themes.filter((t) => themeIds.includes(t.id)).flatMap((t) => t.symbols));
  const [cols, rows] = grids[grid];
  const tooSmall = pool.size < Math.floor((cols * rows) / 2);

  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <WizardHeader
        title={titles[step]}
        onBack={idx > 0 ? () => set({ step: path[idx - 1] }) : undefined}
        steps={path.length}
        current={idx}
      />

      {step === 'players' && (
        <div className="mm-loose">
          <OptionTile tone="g-violet" layout="wide" icon={<Icon name="user" size={40} />} title="Chơi một mình"
            description="Luyện trí nhớ, phá kỷ lục của chính bạn"
            onClick={() => set({ playerCount: 1, step: 'mode' })} />
          <OptionTile tone="g-pink" layout="wide" icon={<Icon name="users" size={40} />} title="Chơi nhiều người"
            description="2–4 người thay lượt trên cùng máy này"
            onClick={() => set({ playerCount: Math.max(2, playerCount), mode: 'classic', step: 'count' })} />
          <OptionTile tone="g-cyan" layout="wide" icon={<Icon name="globe" size={40} />} title="Chơi online"
            description="Tạo phòng, mời bạn bè bằng mã 6 ký tự"
            onClick={onOnline} />
        </div>
      )}

      {step === 'count' && (
        <div className="mm-loose mm-cols3">
          {[2, 3, 4].map((n) => (
            <OptionTile key={n} tone="g-pink" numeral={n} title={`${n} người`} selected={playerCount === n}
              onClick={() => set({ playerCount: n, step: 'mode' })} />
          ))}
        </div>
      )}

      {step === 'mode' && (
        <div className={`mm-loose${visible.length > 2 ? ' mm-modes' : ''}`}>
          {visible.map((m) => (
            <OptionTile key={m.id} tone={m.tone} layout="wide" icon={<Icon name={m.icon} size={26} />}
              title={m.name} description={m.desc} selected={mode === m.id}
              onClick={() => (m.id === 'campaign' && !multi ? onCampaign() : set({ mode: m.id, step: 'grid' }))} />
          ))}
        </div>
      )}

      {step === 'grid' && (
        <div className="mm-fill">
          {Object.entries(grids).map(([k, [c, r]]) => (
            <OptionTile key={k} title={k.replace('x', '×')} description={`${Math.floor((c * r) / 2)} cặp`}
              selected={grid === k} icon={<GridPreview cols={c} rows={r} selected={grid === k} />}
              style={{ padding: '6px 4px', gap: 2 }}
              onClick={() => set({ grid: k, step: 'theme' })} />
          ))}
        </div>
      )}

      {step === 'theme' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)', fontSize: 'var(--text-sm)' }}>
            Chọn được nhiều theme — bàn thẻ sẽ trộn biểu tượng của tất cả.
          </p>
          <div role="group" aria-label="Theme thẻ" className="mm-fill">
            {themes.map((t) => {
              const locked = t.unlockAt > totalScore;
              return (
                <OptionTile key={t.id} role="checkbox" selected={themeIds.includes(t.id)} disabled={locked}
                  icon={<span style={{ fontSize: 17, letterSpacing: 1, whiteSpace: 'nowrap', opacity: .9 }}>{t.symbols.slice(0, 3).join(' ')}</span>}
                  title={t.name} description={locked ? `🔒 ${t.unlockAt / 1000}k điểm` : undefined}
                  style={{ padding: '10px 6px', gap: 3 }}
                  onClick={() => {
                    const next = themeIds.includes(t.id) ? themeIds.filter((x) => x !== t.id) : [...themeIds, t.id];
                    if (next.length) set({ themeIds: next });
                  }} />
              );
            })}
          </div>
          {tooSmall && (
            <p role="alert" style={{ margin: '14px 0 0', padding: '10px 12px', borderRadius: 10, fontSize: 13, background: 'color-mix(in srgb, var(--bad) 14%, transparent)' }}>
              Chưa đủ biểu tượng cho lưới {grid.replace('x', '×')}. Hãy chọn thêm theme hoặc lưới nhỏ hơn.
            </p>
          )}
          <Button variant="primary" disabled={tooSmall} onClick={onStart}>Bắt đầu</Button>
          <p style={{ margin: '14px 0 0', color: 'var(--muted)', fontSize: 13 }}>
            Kỷ lục: <b>1180</b> điểm · 14 lượt · 0:52
          </p>
        </div>
      )}
    </Panel>
  );
}

function CampaignScreen({ onBack, onPlay, progress }) {
  const stars = Object.values(progress).reduce((n, s) => n + s, 0);
  return (
    <Panel style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
      <WizardHeader title="Chọn màn" onBack={onBack} steps={3} current={2} />
      <p style={{ margin: '0 0 8px', color: 'var(--muted)', fontSize: 14 }}>Đã đạt <b>{stars}</b> / 60 sao</p>
      <ol className="mm-fill mm-map" style={{ gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
        {levels.map((l) => (
          <li key={l.id} style={{ display: 'flex', minHeight: 0, alignItems: 'center' }}>
            <CampaignNode {...l} stars={progress[l.id] ?? 0} locked={l.id > 6} onPlay={() => onPlay(l)} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

Object.assign(window, { WizardScreen, CampaignScreen });
