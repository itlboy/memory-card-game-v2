const { TopBar } = window.MemoryMatchDesignSystem_ce0961;

function App() {
  const [dark, setDark] = React.useState(false);
  const [sound, setSound] = React.useState(true);
  const [screen, setScreen] = React.useState('menu');
  const [config, setConfig] = React.useState(null);
  const [wizard, setWizard] = React.useState({
    step: 'players', mode: 'classic', grid: '4x4', themeIds: ['animals'],
    playerCount: 1, totalScore: 1200
  });
  const set = (patch) => setWizard((w) => ({ ...w, ...patch }));

  React.useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);

  const home = () => { setScreen('menu'); set({ step: 'players' }); };

  return (
    <div className="mm-shell">
      <TopBar totalScore={wizard.totalScore} dark={dark} sound={sound}
        onHome={home} onToggleDark={() => setDark(!dark)} onToggleSound={() => setSound(!sound)} />
      <main className="mm-main">
        <div className="mm-col">
          {screen === 'menu' && (
            <WizardScreen state={wizard} set={set}
              onOnline={() => setScreen('online')}
              onCampaign={() => { set({ mode: 'campaign' }); setScreen('campaign'); }}
              onStart={() => { setConfig({ ...wizard, levelId: null }); setScreen('game'); }} />
          )}
          {screen === 'campaign' && (
            <CampaignScreen progress={{ 1: 3, 2: 3, 3: 2, 4: 1 }}
              onBack={() => setScreen('menu')}
              onPlay={(l) => { setConfig({ ...wizard, grid: `${l.cols}x${l.rows}`, playerCount: 1, levelId: l.id }); setScreen('game'); }} />
          )}
          {screen === 'online' && (
            <OnlineEntry onBack={() => setScreen('menu')}
              onLobby={(name, isHost) => { setConfig({ ...wizard, name, isHost, playerCount: 3 }); setScreen('lobby'); }} />
          )}
          {screen === 'lobby' && (
            <OnlineLobby me={config.name} isHost={config.isHost}
              onBack={() => setScreen('online')}
              onStart={() => setScreen('game')} />
          )}
          {screen === 'game' && (
            <GameScreen config={config}
              onQuit={home} onMenu={home}
              onReplay={() => { setConfig({ ...config, levelId: config.levelId ? config.levelId + 1 : null }); setScreen('game'); }} />
          )}
        </div>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
