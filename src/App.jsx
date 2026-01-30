import React, { useState, useEffect, useRef } from 'react';

const FIREBASE_CONFIG = {
  databaseURL: "https://poker-duel-26992-default-rtdb.europe-west1.firebasedatabase.app"
};

const firebaseDB = {
  async get(path) {
    try {
      const res = await fetch(`${FIREBASE_CONFIG.databaseURL}/${path}.json`);
      return await res.json();
    } catch (e) { return null; }
  },
  async set(path, data) {
    try {
      await fetch(`${FIREBASE_CONFIG.databaseURL}/${path}.json`, { method: 'PUT', body: JSON.stringify(data) });
      return true;
    } catch (e) { return false; }
  },
  async update(path, data) {
    try {
      await fetch(`${FIREBASE_CONFIG.databaseURL}/${path}.json`, { method: 'PATCH', body: JSON.stringify(data) });
      return true;
    } catch (e) { return false; }
  }
};

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: '#e63946', diamonds: '#e63946', clubs: '#1a1a2e', spades: '#1a1a2e' };

const createDeck = () => SUITS.flatMap(suit => VALUES.map(value => ({ suit, value })));

const shuffleDeck = (deck, seed) => {
  const shuffled = [...deck];
  let s = seed;
  const random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const valueToNumber = (v) => v === 'A' ? 14 : v === 'K' ? 13 : v === 'Q' ? 12 : v === 'J' ? 11 : parseInt(v);

const evaluateHand = (cards) => {
  if (!cards || cards.length !== 5) return { rank: 0, name: 'Incomplet', highCards: [] };
  const values = cards.map(c => valueToNumber(c.value)).sort((a, b) => b - a);
  const suits = cards.map(c => c.suit);
  const valueCounts = {};
  values.forEach(v => { valueCounts[v] = (valueCounts[v] || 0) + 1; });
  const counts = Object.values(valueCounts).sort((a, b) => b - a);
  const uniqueValues = Object.keys(valueCounts).map(Number).sort((a, b) => b - a);
  const isFlush = suits.every(s => s === suits[0]);
  const sorted = [...uniqueValues].sort((a, b) => b - a);
  const isStraight = uniqueValues.length === 5 && (sorted[0] - sorted[4] === 4 || (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && sorted.includes(3) && sorted.includes(2)));
  const isRoyal = isStraight && values.includes(14) && values.includes(13);
  if (isFlush && isStraight && isRoyal) return { rank: 10, name: 'Quinte Flush Royale', highCards: values };
  if (isFlush && isStraight) return { rank: 9, name: 'Quinte Flush', highCards: values };
  if (counts[0] === 4) return { rank: 8, name: 'Carré', highCards: values };
  if (counts[0] === 3 && counts[1] === 2) return { rank: 7, name: 'Full', highCards: values };
  if (isFlush) return { rank: 6, name: 'Couleur', highCards: values };
  if (isStraight) return { rank: 5, name: 'Suite', highCards: values };
  if (counts[0] === 3) return { rank: 4, name: 'Brelan', highCards: values };
  if (counts[0] === 2 && counts[1] === 2) return { rank: 3, name: 'Double Paire', highCards: values };
  if (counts[0] === 2) return { rank: 2, name: 'Paire', highCards: values };
  return { rank: 1, name: 'Carte Haute', highCards: values };
};

const compareHands = (hand1, hand2) => {
  const eval1 = evaluateHand(hand1), eval2 = evaluateHand(hand2);
  if (eval1.rank !== eval2.rank) return { winner: eval1.rank > eval2.rank ? 1 : 2, eval1, eval2 };
  for (let i = 0; i < Math.max(eval1.highCards.length, eval2.highCards.length); i++) {
    if ((eval1.highCards[i] || 0) !== (eval2.highCards[i] || 0)) return { winner: eval1.highCards[i] > eval2.highCards[i] ? 1 : 2, eval1, eval2 };
  }
  return { winner: 1, eval1, eval2 };
};

const canPlaceOnColumn = (columns, columnIndex) => {
  const minCards = Math.min(...columns.map(col => col.length));
  return columns[columnIndex].length === minCards && columns[columnIndex].length < 5;
};

const Card = ({ card, faceDown = false }) => {
  if (!card) return null;
  const color = SUIT_COLORS[card.suit] || '#333';
  return (
    <div className="card">
      {faceDown ? (
        <div className="card-back"><div className="card-back-pattern"></div></div>
      ) : (
        <div className="card-face" style={{ color }}>
          <div className="card-corner top-left"><span className="card-value">{card.value}</span><span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span></div>
          <div className="card-center"><span className="card-suit-large">{SUIT_SYMBOLS[card.suit]}</span></div>
          <div className="card-corner bottom-right"><span className="card-value">{card.value}</span><span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span></div>
        </div>
      )}
    </div>
  );
};

const Column = ({ cards, canPlace, onPlace, isRevealed, flippedBack }) => (
  <div className={`column-cards ${canPlace ? 'can-place' : ''}`} onClick={canPlace ? onPlace : undefined}>
    {cards.map((card, i) => {
      const isFifthCard = i === 4;
      const shouldHide = isFifthCard && !isRevealed;
      return <Card key={i} card={card} faceDown={shouldHide || flippedBack} />;
    })}
    {canPlace && <div className="place-indicator">+</div>}
  </div>
);

export default function App() {
  const [mode, setMode] = useState('menu');
  const [roomCode, setRoomCode] = useState('');
  const [playerNumber, setPlayerNumber] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [gameState, setGameState] = useState('waiting');
  const [deck, setDeck] = useState([]);
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [drawnCard, setDrawnCard] = useState(null);
  const [placementCount, setPlacementCount] = useState(0);
  const [gameSeed, setGameSeed] = useState(null);
  const [player1Columns, setPlayer1Columns] = useState([[], [], [], [], []]);
  const [player2Columns, setPlayer2Columns] = useState([[], [], [], [], []]);
  const [results, setResults] = useState(null);
  const [revealedColumns, setRevealedColumns] = useState([false, false, false, false, false]);
  const [flippedLosers, setFlippedLosers] = useState([false, false, false, false, false]);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(-1);
  
  const pollingRef = useRef(null);
  const modeRef = useRef(mode);
  const placementCountRef = useRef(placementCount);
  const gameStateRef = useRef(gameState);
  const isProcessingRef = useRef(false);
  
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { placementCountRef.current = placementCount; }, [placementCount]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  const rebuildGameState = (seed, moves) => {
    const fullDeck = shuffleDeck(createDeck(), seed);
    fullDeck.shift();
    const p1Cols = [[], [], [], [], []], p2Cols = [[], [], [], [], []];
    for (let i = 0; i < 5; i++) { p1Cols[i].push(fullDeck.shift()); p2Cols[i].push(fullDeck.shift()); }
    let ptr = 0;
    (moves || []).forEach(m => { (m.player === 1 ? p1Cols : p2Cols)[m.column].push(fullDeck[ptr]); ptr++; });
    return { p1Cols, p2Cols, remainingDeck: fullDeck.slice(ptr), nextCard: fullDeck[ptr], nextPlayer: (moves || []).length % 2 === 0 ? 1 : 2, moveCount: (moves || []).length };
  };

  const applyGameState = (state) => {
    setDeck(state.remainingDeck); setPlayer1Columns(state.p1Cols); setPlayer2Columns(state.p2Cols);
    setPlacementCount(state.moveCount); setCurrentPlayer(state.nextPlayer); setDrawnCard(state.nextCard);
    setGameState('placing'); setResults(null);
    setRevealedColumns([false, false, false, false, false]); setFlippedLosers([false, false, false, false, false]);
  };

  const calculateResults = (p1Cols, p2Cols) => {
    const columnResults = [];
    let p1Wins = 0, p2Wins = 0;
    for (let i = 0; i < 5; i++) { const c = compareHands(p1Cols[i], p2Cols[i]); columnResults.push(c); if (c.winner === 1) p1Wins++; else p2Wins++; }
    setResults({ columnResults, p1Wins, p2Wins, overallWinner: p1Wins > p2Wins ? 1 : 2 });
    let idx = 0;
    const revealNext = () => {
      if (idx >= 5) { setGameState('finished'); return; }
      setCurrentRevealIndex(idx);
      setRevealedColumns(prev => { const u = [...prev]; u[idx] = true; return u; });
      setTimeout(() => { setFlippedLosers(prev => { const u = [...prev]; u[idx] = true; return u; }); setTimeout(() => { idx++; revealNext(); }, 500); }, 700);
    };
    setTimeout(revealNext, 300);
  };

  const startLocalGame = () => {
    const seed = Date.now();
    const newDeck = shuffleDeck(createDeck(), seed); newDeck.shift();
    const p1Cols = [[], [], [], [], []], p2Cols = [[], [], [], [], []];
    for (let i = 0; i < 5; i++) { p1Cols[i].push(newDeck.shift()); p2Cols[i].push(newDeck.shift()); }
    setDeck(newDeck); setPlayer1Columns(p1Cols); setPlayer2Columns(p2Cols);
    setCurrentPlayer(1); setPlacementCount(0); setDrawnCard(newDeck[0]); setGameState('placing');
    setResults(null); setRevealedColumns([false, false, false, false, false]); setFlippedLosers([false, false, false, false, false]);
    setCurrentRevealIndex(-1); setMode('local');
  };

  const placeCardLocal = (columnIndex) => {
    if (!drawnCard || gameState !== 'placing') return;
    const isP1 = currentPlayer === 1;
    const cols = isP1 ? player1Columns : player2Columns;
    const setCols = isP1 ? setPlayer1Columns : setPlayer2Columns;
    if (!canPlaceOnColumn(cols, columnIndex)) return;
    const newCols = cols.map((c, i) => i === columnIndex ? [...c, drawnCard] : c);
    setCols(newCols);
    const newCount = placementCount + 1; setPlacementCount(newCount);
    const updP1 = isP1 ? newCols : player1Columns, updP2 = isP1 ? player2Columns : newCols;
    if (updP1.every(c => c.length >= 5) && updP2.every(c => c.length >= 5)) {
      setDrawnCard(null); setGameState('revealing'); setTimeout(() => calculateResults(updP1, updP2), 500);
    } else {
      setCurrentPlayer(currentPlayer === 1 ? 2 : 1); const newDeck = deck.slice(1); setDeck(newDeck); setDrawnCard(newDeck[0]);
    }
  };

  const generateRoomCode = () => { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let code = ''; for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]; return code; };

  const startPolling = (code, myPlayer, seed) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      if (isProcessingRef.current) return;
      try {
        const roomData = await firebaseDB.get(`rooms/${code}`);
        if (!roomData) return;
        if (myPlayer === 1 && roomData.player2Connected && modeRef.current === 'online-waiting') {
          setMode('online-game'); applyGameState(rebuildGameState(seed, roomData.moves || [])); return;
        }
        if (modeRef.current === 'online-game' && gameStateRef.current === 'placing') {
          const serverMoves = roomData.moves?.length || 0;
          if (serverMoves > placementCountRef.current) {
            const state = rebuildGameState(seed, roomData.moves);
            setDeck(state.remainingDeck); setPlayer1Columns(state.p1Cols); setPlayer2Columns(state.p2Cols);
            setPlacementCount(state.moveCount); setCurrentPlayer(state.nextPlayer); setDrawnCard(state.nextCard);
          }
          if (serverMoves >= 40) {
            const finalState = rebuildGameState(seed, roomData.moves);
            setPlayer1Columns(finalState.p1Cols); setPlayer2Columns(finalState.p2Cols);
            setPlacementCount(40); setDrawnCard(null); setGameState('revealing');
            setTimeout(() => calculateResults(finalState.p1Cols, finalState.p2Cols), 500);
          }
        }
      } catch (err) {}
    }, 600);
  };

  const createRoom = async () => {
    setError('');
    try {
      const code = generateRoomCode(), seed = Date.now();
      const success = await firebaseDB.set(`rooms/${code}`, { seed, player1Connected: true, player2Connected: false, moves: [], createdAt: Date.now() });
      if (!success) { setError('Erreur réseau'); return; }
      setRoomCode(code); setPlayerNumber(1); setGameSeed(seed); setMode('online-waiting'); startPolling(code, 1, seed);
    } catch (err) { setError('Erreur de création'); }
  };

  const joinRoom = async () => {
    setError('');
    const code = inputCode.toUpperCase().trim();
    if (code.length !== 4) { setError('Code invalide'); return; }
    try {
      const roomData = await firebaseDB.get(`rooms/${code}`);
      if (!roomData) { setError('Room introuvable'); return; }
      if (roomData.player2Connected) { setError('Room pleine'); return; }
      await firebaseDB.update(`rooms/${code}`, { player2Connected: true });
      setRoomCode(code); setPlayerNumber(2); setGameSeed(roomData.seed);
      applyGameState(rebuildGameState(roomData.seed, roomData.moves || []));
      setMode('online-game'); startPolling(code, 2, roomData.seed);
    } catch (err) { setError('Erreur de connexion'); }
  };

  const placeCardOnline = async (columnIndex) => {
    if (!drawnCard || gameState !== 'placing' || currentPlayer !== playerNumber) return;
    const cols = playerNumber === 1 ? player1Columns : player2Columns;
    if (!canPlaceOnColumn(cols, columnIndex)) return;
    isProcessingRef.current = true;
    try {
      const roomData = await firebaseDB.get(`rooms/${roomCode}`);
      if (!roomData || (roomData.moves?.length || 0) !== placementCount) { isProcessingRef.current = false; return; }
      const newMoves = [...(roomData.moves || []), { player: playerNumber, column: columnIndex }];
      await firebaseDB.update(`rooms/${roomCode}`, { moves: newMoves });
      const state = rebuildGameState(gameSeed, newMoves);
      setDeck(state.remainingDeck); setPlayer1Columns(state.p1Cols); setPlayer2Columns(state.p2Cols);
      setPlacementCount(state.moveCount); setCurrentPlayer(state.nextPlayer); setDrawnCard(state.nextCard);
      if (newMoves.length >= 40) { setDrawnCard(null); setGameState('revealing'); setTimeout(() => calculateResults(state.p1Cols, state.p2Cols), 500); }
    } catch (err) {} finally { setTimeout(() => { isProcessingRef.current = false; }, 150); }
  };

  const goToMenu = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setMode('menu'); setRoomCode(''); setPlayerNumber(null); setError(''); setInputCode(''); setGameState('waiting'); setGameSeed(null); isProcessingRef.current = false;
  };

  const myColumns = playerNumber === 1 ? player1Columns : player2Columns;
  const oppColumns = playerNumber === 1 ? player2Columns : player1Columns;

  const getCanPlaceLocal = (colIndex) => {
    if (gameState !== 'placing') return false;
    const cols = currentPlayer === 1 ? player1Columns : player2Columns;
    return canPlaceOnColumn(cols, colIndex);
  };

  const getCanPlaceOnline = (colIndex) => {
    if (gameState !== 'placing' || currentPlayer !== playerNumber) return false;
    return canPlaceOnColumn(myColumns, colIndex);
  };

  return (
    <div className="game-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#071510}
        .game-container{height:100vh;height:100dvh;overflow:hidden;background:radial-gradient(ellipse at center,#1a472a 0%,#0d2818 50%,#071510 100%);padding:6px;font-family:'Cinzel',serif;color:#ffd700;display:flex;flex-direction:column}
        .game-header{text-align:center;padding:4px 0}
        .game-title{font-size:1rem;font-weight:700;background:linear-gradient(180deg,#ffd700 0%,#ff8c00 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .menu-container{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px}
        .menu-title{font-size:1.2rem;margin-bottom:15px}
        .menu-btn{width:100%;max-width:220px;padding:12px 16px;font-family:'Cinzel',serif;font-size:.8rem;font-weight:600;border:none;border-radius:10px;cursor:pointer}
        .menu-btn-primary{background:linear-gradient(135deg,#ffd700 0%,#ff8c00 100%);color:#1a1a2e}
        .menu-btn-secondary{background:linear-gradient(135deg,#2d4a3e 0%,#1a2f26 100%);color:#ffd700;border:2px solid #ffd700}
        .room-code{font-size:2rem;font-weight:700;letter-spacing:6px;padding:12px 25px;background:rgba(0,0,0,.4);border-radius:10px;border:2px solid #ffd700}
        .waiting-text{font-size:.8rem;color:#b8860b;animation:blink 1.5s infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.5}}
        .input-code{font-family:'Cinzel',serif;font-size:1.3rem;text-align:center;letter-spacing:4px;padding:10px 15px;border-radius:8px;border:2px solid #ffd700;background:rgba(0,0,0,.4);color:#ffd700;width:130px;text-transform:uppercase}
        .input-code::placeholder{color:#b8860b}
        .error-text{color:#ff5252;font-size:.75rem;text-align:center}
        .back-btn{position:absolute;top:10px;left:10px;padding:4px 10px;font-size:.65rem;background:rgba(0,0,0,.4);border:1px solid #ffd700;color:#ffd700;border-radius:6px;cursor:pointer}
        .game-board{flex:1;display:flex;flex-direction:column;overflow:hidden}
        .info-bar{display:flex;justify-content:center;gap:6px;padding:3px 0}
        .info-badge{padding:2px 8px;background:rgba(0,0,0,.5);border-radius:6px;font-size:.55rem;color:#ffd700;border:1px solid rgba(255,215,0,.3)}
        .info-badge.active{background:rgba(0,100,0,.6);border-color:#00c853}
        .info-badge.waiting-turn{background:rgba(100,50,0,.6);border-color:#ff8c00}
        .scores-bar{display:flex;justify-content:center;gap:15px;padding:3px 0}
        .score-item{display:flex;align-items:center;gap:5px;padding:2px 8px;background:rgba(0,0,0,.4);border-radius:5px}
        .score-item.winner{border:1px solid #00c853;box-shadow:0 0 6px rgba(0,200,83,.4)}
        .score-label{font-size:.5rem;color:#b8860b}.score-value{font-size:.9rem;font-weight:700}
        .duel-container{flex:1;display:flex;flex-direction:column;gap:3px}
        .duel-row{display:flex;align-items:center;justify-content:space-between;padding:3px 4px;border-radius:6px;background:rgba(0,0,0,.25);flex:1;transition:all .3s ease}
        .duel-row.revealing{background:rgba(255,215,0,.15);box-shadow:0 0 8px rgba(255,215,0,.3)}
        .duel-row.winner-p1{background:linear-gradient(90deg,rgba(0,200,83,.3) 0%,transparent 40%,transparent 60%,rgba(100,0,0,.2) 100%)}
        .duel-row.winner-p2{background:linear-gradient(90deg,rgba(100,0,0,.2) 0%,transparent 40%,transparent 60%,rgba(0,200,83,.3) 100%)}
        .player-side{display:flex;flex-direction:column;align-items:center;gap:1px}
        .column-cards{display:flex;gap:1px;padding:2px;border-radius:4px;transition:all .2s ease;position:relative;min-height:40px}
        .column-cards.can-place{cursor:pointer;border:2px dashed rgba(255,215,0,.6);background:rgba(255,215,0,.1)}
        .column-cards.can-place:hover,.column-cards.can-place:active{background:rgba(255,215,0,.25);border-color:#ffd700;transform:scale(1.02)}
        .place-indicator{position:absolute;right:-5px;top:50%;transform:translateY(-50%);width:12px;height:12px;background:#ffd700;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;color:#1a472a;animation:pulse 1s infinite}
        @keyframes pulse{0%,100%{transform:translateY(-50%) scale(1)}50%{transform:translateY(-50%) scale(1.2)}}
        .vs-indicator{font-size:.5rem;font-weight:700;color:#ffd700;min-width:22px;text-align:center}
        .hand-name{font-size:.4rem;color:#b8860b;text-transform:uppercase;white-space:nowrap;min-height:9px}
        .hand-name.winner{color:#00c853;font-weight:700}.hand-name.loser{color:#ff5252}
        .center-zone{display:flex;justify-content:center;align-items:center;gap:8px;padding:5px;background:rgba(0,0,0,.4);border-radius:6px;margin:3px 0}
        .drawn-label{font-size:.5rem;color:#b8860b}.deck-count{font-size:.5rem;color:#b8860b}
        .card{width:26px;height:36px;border-radius:3px;background:linear-gradient(135deg,#fff 0%,#f5f5f5 100%);box-shadow:0 1px 2px rgba(0,0,0,.3);position:relative;flex-shrink:0}
        .card-back{width:100%;height:100%;border-radius:3px;background:linear-gradient(135deg,#8b0000 0%,#5c0000 100%);border:1px solid #ffd700;display:flex;align-items:center;justify-content:center}
        .card-back-pattern{width:80%;height:80%;background:repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,215,0,.15) 2px,rgba(255,215,0,.15) 4px);border-radius:2px}
        .card-face{width:100%;height:100%;padding:1px}
        .card-corner{position:absolute;display:flex;flex-direction:column;align-items:center;line-height:1}
        .top-left{top:1px;left:2px}.bottom-right{bottom:1px;right:2px;transform:rotate(180deg)}
        .card-value{font-size:7px;font-weight:700}.card-suit{font-size:6px}
        .card-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}.card-suit-large{font-size:10px}
        .game-controls{display:flex;justify-content:center;padding:5px 0}
        .btn{padding:6px 16px;font-family:'Cinzel',serif;font-size:.65rem;font-weight:600;border:none;border-radius:12px;cursor:pointer}
        .btn-secondary{background:linear-gradient(135deg,#2d4a3e 0%,#1a2f26 100%);color:#ffd700;border:1px solid #ffd700}
        .btn-primary{background:linear-gradient(135deg,#ffd700 0%,#ff8c00 100%);color:#1a1a2e}
        .results-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;z-index:100}
        .results-panel{background:linear-gradient(135deg,#1a472a 0%,#0d2818 100%);padding:20px 30px;border-radius:12px;border:2px solid #ffd700;text-align:center}
        .results-title{font-size:1.1rem;margin-bottom:8px}
        .results-score{font-size:1.8rem;font-weight:700;margin:8px 0;background:linear-gradient(180deg,#ffd700 0%,#ff8c00 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
      `}</style>
      
      <header className="game-header"><h1 className="game-title">♠ POKER DUEL ♠</h1></header>
      
      {mode === 'menu' && (
        <div className="menu-container">
          <div className="menu-title">🃏 Mode de jeu</div>
          <button className="menu-btn menu-btn-primary" onClick={startLocalGame}>👥 Local (2 joueurs)</button>
          <button className="menu-btn menu-btn-secondary" onClick={createRoom}>🌐 Créer une partie</button>
          <button className="menu-btn menu-btn-secondary" onClick={() => setMode('online-join')}>🔗 Rejoindre</button>
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
      
      {mode === 'online-join' && (
        <div className="menu-container">
          <button className="back-btn" onClick={goToMenu}>← Retour</button>
          <div className="menu-title">Code de la partie</div>
          <input type="text" className="input-code" placeholder="XXXX" maxLength={4} value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} />
          {error && <div className="error-text">{error}</div>}
          <button className="menu-btn menu-btn-primary" onClick={joinRoom}>Rejoindre</button>
        </div>
      )}
      
      {mode === 'online-waiting' && (
        <div className="menu-container">
          <button className="back-btn" onClick={goToMenu}>← Annuler</button>
          <div className="menu-title">Code de la partie</div>
          <div className="room-code">{roomCode}</div>
          <div className="waiting-text">En attente d'un adversaire...</div>
        </div>
      )}
      
      {mode === 'local' && gameState !== 'waiting' && (
        <div className="game-board">
          <div className="info-bar">
            <span className={`info-badge ${currentPlayer === 1 ? 'active' : ''}`}>J1</span>
            <span className="info-badge">{placementCount}/40</span>
            <span className={`info-badge ${currentPlayer === 2 ? 'active' : ''}`}>J2</span>
          </div>
          {results && (
            <div className="scores-bar">
              <div className={`score-item ${results.overallWinner === 1 ? 'winner' : ''}`}><span className="score-label">J1</span><span className="score-value">{results.p1Wins}</span></div>
              <div className={`score-item ${results.overallWinner === 2 ? 'winner' : ''}`}><span className="score-label">J2</span><span className="score-value">{results.p2Wins}</span></div>
            </div>
          )}
          {gameState === 'placing' && drawnCard && (
            <div className="center-zone"><span className="deck-count">🃏 {deck.length}</span><span className="drawn-label">J{currentPlayer} →</span><Card card={drawnCard} /></div>
          )}
          {gameState === 'revealing' && <div className="center-zone"><span className="drawn-label">✨ Révélation...</span></div>}
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const isRevealing = currentRevealIndex === colIndex, isRevealed = revealedColumns[colIndex];
              const p1Winner = results?.columnResults[colIndex]?.winner === 1, p2Winner = results?.columnResults[colIndex]?.winner === 2;
              return (
                <div key={colIndex} className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (p1Winner ? 'winner-p1' : 'winner-p2') : ''}`}>
                  <div className="player-side">
                    <Column cards={player1Columns[colIndex]} canPlace={currentPlayer === 1 && getCanPlaceLocal(colIndex)} onPlace={() => placeCardLocal(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && p2Winner} />
                    <div className={`hand-name ${isRevealed ? (p1Winner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.eval1?.name : `(${player1Columns[colIndex].length}/5)`}</div>
                  </div>
                  <div className="vs-indicator">{flippedLosers[colIndex] ? (p1Winner ? '✓' : '✗') : 'VS'}</div>
                  <div className="player-side">
                    <Column cards={player2Columns[colIndex]} canPlace={currentPlayer === 2 && getCanPlaceLocal(colIndex)} onPlace={() => placeCardLocal(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && p1Winner} />
                    <div className={`hand-name ${isRevealed ? (p2Winner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.eval2?.name : `(${player2Columns[colIndex].length}/5)`}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="game-controls"><button className="btn btn-secondary" onClick={goToMenu}>← Menu</button></div>
        </div>
      )}
      
      {mode === 'online-game' && gameState !== 'waiting' && (
        <div className="game-board">
          <div className="info-bar">
            <span className="info-badge">Room: {roomCode}</span>
            <span className={`info-badge ${currentPlayer === playerNumber ? 'active' : 'waiting-turn'}`}>{currentPlayer === playerNumber ? '🎯 Votre tour' : '⏳ Adversaire'}</span>
            <span className="info-badge">{placementCount}/40</span>
          </div>
          {results && (
            <div className="scores-bar">
              <div className={`score-item ${results.overallWinner === playerNumber ? 'winner' : ''}`}><span className="score-label">Vous</span><span className="score-value">{playerNumber === 1 ? results.p1Wins : results.p2Wins}</span></div>
              <div className={`score-item ${results.overallWinner !== playerNumber ? 'winner' : ''}`}><span className="score-label">Adv.</span><span className="score-value">{playerNumber === 1 ? results.p2Wins : results.p1Wins}</span></div>
            </div>
          )}
          {gameState === 'placing' && drawnCard && currentPlayer === playerNumber && (
            <div className="center-zone"><span className="deck-count">🃏 {deck.length}</span><span className="drawn-label">À placer →</span><Card card={drawnCard} /></div>
          )}
          {gameState === 'placing' && currentPlayer !== playerNumber && <div className="center-zone"><span className="drawn-label">⏳ L'adversaire joue...</span></div>}
          {gameState === 'revealing' && <div className="center-zone"><span className="drawn-label">✨ Révélation...</span></div>}
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const isRevealing = currentRevealIndex === colIndex, isRevealed = revealedColumns[colIndex];
              const myWinner = results?.columnResults[colIndex]?.winner === playerNumber;
              const oppWinner = results && results.columnResults[colIndex]?.winner !== playerNumber;
              return (
                <div key={colIndex} className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (myWinner ? 'winner-p1' : 'winner-p2') : ''}`}>
                  <div className="player-side">
                    <Column cards={myColumns[colIndex]} canPlace={getCanPlaceOnline(colIndex)} onPlace={() => placeCardOnline(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && oppWinner} />
                    <div className={`hand-name ${isRevealed ? (myWinner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.[playerNumber === 1 ? 'eval1' : 'eval2']?.name : `(${myColumns[colIndex].length}/5)`}</div>
                  </div>
                  <div className="vs-indicator">{flippedLosers[colIndex] ? (myWinner ? '✓' : '✗') : 'VS'}</div>
                  <div className="player-side">
                    <Column cards={oppColumns[colIndex]} canPlace={false} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && myWinner} />
                    <div className={`hand-name ${isRevealed ? (oppWinner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.[playerNumber === 1 ? 'eval2' : 'eval1']?.name : `(${oppColumns[colIndex].length}/5)`}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="game-controls"><button className="btn btn-secondary" onClick={goToMenu}>← Menu</button></div>
        </div>
      )}
      
      {results && gameState === 'finished' && (
        <div className="results-overlay" onClick={goToMenu}>
          <div className="results-panel" onClick={e => e.stopPropagation()}>
            <h2 className="results-title">{mode === 'online-game' ? (results.overallWinner === playerNumber ? '🎉 Victoire !' : '😔 Défaite') : `👑 Joueur ${results.overallWinner} gagne !`}</h2>
            <div className="results-score">{results.p1Wins} - {results.p2Wins}</div>
            <button className="btn btn-primary" onClick={goToMenu}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
