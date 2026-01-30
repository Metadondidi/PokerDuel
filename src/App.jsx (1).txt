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

// Sound effects
const playCardSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(180, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.12);
    gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    oscillator.type = 'sine';
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
};

const playRevealSound = () => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(350, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(550, audioCtx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    oscillator.type = 'triangle';
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.25);
  } catch (e) {}
};

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Mapping pour les URLs des cartes (deckofcardsapi.com)
const SUIT_CODES = { hearts: 'H', diamonds: 'D', clubs: 'C', spades: 'S' };
const VALUE_CODES = { '10': '0', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9' };

const getCardImageUrl = (card) => {
  const valueCode = VALUE_CODES[card.value] || card.value;
  const suitCode = SUIT_CODES[card.suit];
  return `https://deckofcardsapi.com/static/img/${valueCode}${suitCode}.png`;
};

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

const Card = ({ card, faceDown = false, isNew = false, isFlipping = false }) => {
  if (!card) return null;
  
  return (
    <div className={`card ${isNew ? 'card-slide-in' : ''} ${isFlipping ? 'card-flip' : ''}`}>
      {faceDown ? (
        <div className="card-back">
          <div className="card-back-outer">
            <div className="card-back-inner">
              <div className="card-back-pattern"></div>
              <div className="card-back-logo">♠♥<br/>♦♣</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-face">
          <img 
            src={getCardImageUrl(card)} 
            alt={`${card.value} of ${card.suit}`}
            className="card-image"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
};

const Column = ({ cards, canPlace, onPlace, isRevealed, flippedBack, animatingCard }) => (
  <div className={`column-cards ${canPlace ? 'can-place' : ''}`} onClick={canPlace ? onPlace : undefined}>
    {cards.map((card, i) => {
      const isFifthCard = i === 4;
      const shouldHide = isFifthCard && !isRevealed;
      const isNew = animatingCard && i === cards.length - 1;
      return <Card key={i} card={card} faceDown={shouldHide || flippedBack} isNew={isNew} isFlipping={isRevealed && isFifthCard} />;
    })}
    {canPlace && <div className="place-indicator"><span>+</span></div>}
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
  const [animatingColumn, setAnimatingColumn] = useState(null);
  
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
      playRevealSound();
      setTimeout(() => { setFlippedLosers(prev => { const u = [...prev]; u[idx] = true; return u; }); setTimeout(() => { idx++; revealNext(); }, 700); }, 900);
    };
    setTimeout(revealNext, 500);
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
    
    playCardSound();
    setAnimatingColumn(columnIndex);
    
    setTimeout(() => {
      const newCols = cols.map((c, i) => i === columnIndex ? [...c, drawnCard] : c);
      setCols(newCols);
      const newCount = placementCount + 1; setPlacementCount(newCount);
      const updP1 = isP1 ? newCols : player1Columns, updP2 = isP1 ? player2Columns : newCols;
      
      setTimeout(() => setAnimatingColumn(null), 350);
      
      if (updP1.every(c => c.length >= 5) && updP2.every(c => c.length >= 5)) {
        setDrawnCard(null); setGameState('revealing'); setTimeout(() => calculateResults(updP1, updP2), 600);
      } else {
        setCurrentPlayer(currentPlayer === 1 ? 2 : 1); const newDeck = deck.slice(1); setDeck(newDeck); setDrawnCard(newDeck[0]);
      }
    }, 200);
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
            playCardSound();
            const state = rebuildGameState(seed, roomData.moves);
            setDeck(state.remainingDeck); setPlayer1Columns(state.p1Cols); setPlayer2Columns(state.p2Cols);
            setPlacementCount(state.moveCount); setCurrentPlayer(state.nextPlayer); setDrawnCard(state.nextCard);
          }
          if (serverMoves >= 40) {
            const finalState = rebuildGameState(seed, roomData.moves);
            setPlayer1Columns(finalState.p1Cols); setPlayer2Columns(finalState.p2Cols);
            setPlacementCount(40); setDrawnCard(null); setGameState('revealing');
            setTimeout(() => calculateResults(finalState.p1Cols, finalState.p2Cols), 600);
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
    
    playCardSound();
    isProcessingRef.current = true;
    
    try {
      const roomData = await firebaseDB.get(`rooms/${roomCode}`);
      if (!roomData || (roomData.moves?.length || 0) !== placementCount) { isProcessingRef.current = false; return; }
      const newMoves = [...(roomData.moves || []), { player: playerNumber, column: columnIndex }];
      await firebaseDB.update(`rooms/${roomCode}`, { moves: newMoves });
      const state = rebuildGameState(gameSeed, newMoves);
      setDeck(state.remainingDeck); setPlayer1Columns(state.p1Cols); setPlayer2Columns(state.p2Cols);
      setPlacementCount(state.moveCount); setCurrentPlayer(state.nextPlayer); setDrawnCard(state.nextCard);
      if (newMoves.length >= 40) { setDrawnCard(null); setGameState('revealing'); setTimeout(() => calculateResults(state.p1Cols, state.p2Cols), 600); }
    } catch (err) {} finally { setTimeout(() => { isProcessingRef.current = false; }, 200); }
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
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#0a1f14;overflow:hidden}
        
        .game-container{
          height:100vh;height:100dvh;overflow:hidden;
          background: 
            radial-gradient(ellipse at 30% 20%, rgba(26,74,53,0.8) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(26,74,53,0.6) 0%, transparent 50%),
            linear-gradient(180deg, #0d2818 0%, #1a3d2e 30%, #0f2a1c 70%, #071510 100%);
          padding:8px;font-family:'Cinzel',serif;color:#ffd700;display:flex;flex-direction:column;
          position:relative;
        }
        
        /* Texture tapis de poker */
        .game-container::before {
          content:'';position:absolute;top:0;left:0;right:0;bottom:0;
          background-image: 
            url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events:none;opacity:0.5;
        }
        
        .game-header{text-align:center;padding:8px 0;position:relative;z-index:1}
        .game-title{
          font-size:1.4rem;font-weight:800;letter-spacing:4px;
          background:linear-gradient(180deg,#fff9c4 0%,#ffd700 30%,#ff8c00 70%,#cc6600 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        
        .menu-container{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:20px}
        .menu-title{font-size:1.4rem;margin-bottom:20px;color:#ffd700;text-shadow:0 2px 10px rgba(255,215,0,0.4)}
        .menu-btn{
          width:100%;max-width:260px;padding:16px 24px;
          font-family:'Cinzel',serif;font-size:.9rem;font-weight:700;
          border:none;border-radius:12px;cursor:pointer;
          transition:all .2s ease;text-transform:uppercase;letter-spacing:1px;
          box-shadow:0 4px 15px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .menu-btn:hover{transform:translateY(-3px);box-shadow:0 8px 25px rgba(0,0,0,0.5)}
        .menu-btn:active{transform:translateY(0)}
        .menu-btn-primary{
          background:linear-gradient(180deg,#ffd700 0%,#f0a500 50%,#cc8400 100%);
          color:#1a1a2e;border:2px solid #ffec80;
        }
        .menu-btn-secondary{
          background:linear-gradient(180deg,#2d5a4a 0%,#1a3f32 50%,#0f2a1c 100%);
          color:#ffd700;border:2px solid rgba(255,215,0,0.4);
        }
        
        .room-code{
          font-size:2.5rem;font-weight:800;letter-spacing:10px;padding:18px 35px;
          background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.4) 100%);
          border-radius:15px;border:3px solid #ffd700;
          box-shadow:0 0 30px rgba(255,215,0,0.3),inset 0 2px 10px rgba(0,0,0,0.5);
          color:#ffd700;
        }
        .waiting-text{font-size:.9rem;color:#b8860b;animation:blink 1.5s infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
        
        .input-code{
          font-family:'Cinzel',serif;font-size:1.6rem;font-weight:700;text-align:center;letter-spacing:8px;
          padding:14px 20px;border-radius:12px;border:3px solid #ffd700;
          background:rgba(0,0,0,.5);color:#ffd700;width:160px;text-transform:uppercase;
          box-shadow:inset 0 2px 10px rgba(0,0,0,0.5);
        }
        .input-code::placeholder{color:#6b6b3d}
        .error-text{color:#ff6b6b;font-size:.85rem;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.5)}
        .back-btn{
          position:absolute;top:12px;left:12px;padding:8px 14px;font-size:.75rem;font-weight:600;
          background:rgba(0,0,0,.5);border:2px solid rgba(255,215,0,0.5);color:#ffd700;
          border-radius:8px;cursor:pointer;transition:all .2s ease;
        }
        .back-btn:hover{background:rgba(255,215,0,0.1);border-color:#ffd700}
        
        .game-board{flex:1;display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:1}
        
        .info-bar{display:flex;justify-content:center;gap:10px;padding:6px 0}
        .info-badge{
          padding:6px 14px;
          background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.4) 100%);
          border-radius:20px;font-size:.65rem;font-weight:600;color:#ffd700;
          border:1px solid rgba(255,215,0,.3);
          box-shadow:inset 0 1px 3px rgba(0,0,0,0.3);
        }
        .info-badge.active{
          background:linear-gradient(180deg,rgba(0,150,0,.7) 0%,rgba(0,100,0,.5) 100%);
          border-color:#00ff88;color:#00ff88;
          box-shadow:0 0 15px rgba(0,255,136,0.3);
        }
        .info-badge.waiting-turn{
          background:linear-gradient(180deg,rgba(150,80,0,.7) 0%,rgba(100,50,0,.5) 100%);
          border-color:#ffa500;color:#ffa500;
        }
        
        .scores-bar{display:flex;justify-content:center;gap:25px;padding:6px 0}
        .score-item{
          display:flex;align-items:center;gap:8px;padding:6px 16px;
          background:rgba(0,0,0,.5);border-radius:10px;
          border:1px solid rgba(255,215,0,0.2);
        }
        .score-item.winner{
          border:2px solid #00ff88;
          box-shadow:0 0 20px rgba(0,255,136,.4);
          background:rgba(0,100,0,0.3);
        }
        .score-label{font-size:.6rem;color:#b8860b;font-weight:600}
        .score-value{font-size:1.1rem;font-weight:800}
        
        .duel-container{flex:1;display:flex;flex-direction:column;gap:5px;padding:5px 0}
        .duel-row{
          display:flex;align-items:center;justify-content:space-between;
          padding:5px 8px;border-radius:10px;
          background:linear-gradient(90deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,.15) 50%,rgba(0,0,0,.25) 100%);
          flex:1;transition:all .4s ease;
          border:1px solid rgba(255,215,0,0.08);
        }
        .duel-row.revealing{
          background:linear-gradient(90deg,rgba(255,215,0,.15) 0%,rgba(255,215,0,.08) 50%,rgba(255,215,0,.15) 100%);
          border-color:rgba(255,215,0,0.5);
          box-shadow:0 0 25px rgba(255,215,0,.2);
        }
        .duel-row.winner-p1{
          background:linear-gradient(90deg,rgba(0,255,136,.2) 0%,transparent 30%,transparent 70%,rgba(255,50,50,.15) 100%);
        }
        .duel-row.winner-p2{
          background:linear-gradient(90deg,rgba(255,50,50,.15) 0%,transparent 30%,transparent 70%,rgba(0,255,136,.2) 100%);
        }
        
        .player-side{display:flex;flex-direction:column;align-items:center;gap:3px}
        .column-cards{
          display:flex;gap:4px;padding:5px;border-radius:8px;
          transition:all .3s ease;position:relative;min-height:58px;
        }
        .column-cards.can-place{
          cursor:pointer;
          border:2px dashed rgba(255,215,0,.6);
          background:rgba(255,215,0,.1);
          animation:glow 2s ease-in-out infinite;
        }
        @keyframes glow{
          0%,100%{box-shadow:0 0 8px rgba(255,215,0,0.2),inset 0 0 8px rgba(255,215,0,0.05)}
          50%{box-shadow:0 0 20px rgba(255,215,0,0.4),inset 0 0 15px rgba(255,215,0,0.1)}
        }
        .column-cards.can-place:hover,.column-cards.can-place:active{
          background:rgba(255,215,0,.2);border-color:#ffd700;transform:scale(1.04);
        }
        .place-indicator{
          position:absolute;right:-10px;top:50%;transform:translateY(-50%);
          width:22px;height:22px;
          background:linear-gradient(180deg,#ffd700 0%,#ff8c00 100%);
          border-radius:50%;display:flex;align-items:center;justify-content:center;
          font-size:16px;font-weight:bold;color:#1a3d2e;
          animation:pulse 1.2s ease-in-out infinite;
          box-shadow:0 3px 10px rgba(255,140,0,0.6);
          border:2px solid #fff9c4;
        }
        @keyframes pulse{0%,100%{transform:translateY(-50%) scale(1)}50%{transform:translateY(-50%) scale(1.2)}}
        
        .vs-indicator{
          font-size:.6rem;font-weight:800;color:#ffd700;min-width:32px;text-align:center;
          text-shadow:0 0 10px rgba(255,215,0,0.6);
        }
        .hand-name{
          font-size:.5rem;color:#b8860b;text-transform:uppercase;
          white-space:nowrap;min-height:12px;font-weight:700;letter-spacing:0.5px;
        }
        .hand-name.winner{color:#00ff88;text-shadow:0 0 10px rgba(0,255,136,0.6)}
        .hand-name.loser{color:#ff6b6b;text-shadow:0 0 5px rgba(255,100,100,0.3)}
        
        .center-zone{
          display:flex;justify-content:center;align-items:center;gap:15px;
          padding:10px 20px;
          background:linear-gradient(180deg,rgba(0,0,0,.6) 0%,rgba(0,0,0,.4) 100%);
          border-radius:12px;margin:5px 0;
          border:1px solid rgba(255,215,0,0.2);
          box-shadow:inset 0 2px 10px rgba(0,0,0,0.3);
        }
        .drawn-label{font-size:.7rem;color:#b8860b;font-weight:600}
        .deck-count{font-size:.7rem;color:#ffd700;font-weight:700}
        
        /* CARTES RÉALISTES */
        .card{
          width:42px;height:60px;border-radius:6px;
          background:#fff;
          box-shadow:
            0 2px 4px rgba(0,0,0,0.3),
            0 4px 8px rgba(0,0,0,0.2),
            inset 0 0 0 1px rgba(0,0,0,0.1);
          position:relative;flex-shrink:0;
          transition:transform 0.3s ease,box-shadow 0.3s ease;
          overflow:hidden;
        }
        .card:hover{
          transform:translateY(-3px);
          box-shadow:
            0 4px 8px rgba(0,0,0,0.4),
            0 8px 16px rgba(0,0,0,0.3);
        }
        
        .card-slide-in{animation:slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)}
        @keyframes slideIn{
          0%{transform:translateY(-80px) rotate(-5deg) scale(0.8);opacity:0}
          60%{transform:translateY(8px) rotate(2deg) scale(1.02)}
          100%{transform:translateY(0) rotate(0) scale(1);opacity:1}
        }
        
        .card-flip{animation:flipCard 0.7s ease-in-out}
        @keyframes flipCard{
          0%{transform:perspective(400px) rotateY(0deg)}
          50%{transform:perspective(400px) rotateY(90deg) scale(1.1)}
          100%{transform:perspective(400px) rotateY(0deg)}
        }
        
        /* Dos de carte style casino */
        .card-back{
          width:100%;height:100%;border-radius:6px;
          background:linear-gradient(180deg,#8b0000 0%,#6b0000 50%,#4a0000 100%);
          display:flex;align-items:center;justify-content:center;
          overflow:hidden;position:relative;
        }
        .card-back-outer{
          width:calc(100% - 4px);height:calc(100% - 4px);
          border:2px solid #ffd700;border-radius:4px;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(180deg,#7a0000 0%,#5a0000 100%);
          position:relative;overflow:hidden;
        }
        .card-back-inner{
          width:calc(100% - 6px);height:calc(100% - 6px);
          border:1px solid rgba(255,215,0,0.3);border-radius:2px;
          display:flex;align-items:center;justify-content:center;
          position:relative;overflow:hidden;
          background:
            repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(255,215,0,.06) 4px,rgba(255,215,0,.06) 8px),
            repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(255,215,0,.06) 4px,rgba(255,215,0,.06) 8px),
            linear-gradient(180deg,#6a0000 0%,#4a0000 100%);
        }
        .card-back-pattern{
          position:absolute;width:100%;height:100%;
          background:
            radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.2) 70%);
        }
        .card-back-logo{
          font-size:8px;color:#ffd700;text-align:center;
          text-shadow:0 1px 2px rgba(0,0,0,0.5);
          font-weight:bold;line-height:1.2;
          position:relative;z-index:1;
        }
        
        .card-face{width:100%;height:100%;border-radius:6px;overflow:hidden}
        .card-image{
          width:100%;height:100%;object-fit:cover;
          border-radius:6px;
        }
        
        .game-controls{display:flex;justify-content:center;padding:8px 0}
        .btn{
          padding:10px 24px;font-family:'Cinzel',serif;font-size:.75rem;font-weight:700;
          border:none;border-radius:12px;cursor:pointer;transition:all .2s ease;
          text-transform:uppercase;letter-spacing:1px;
        }
        .btn:hover{transform:translateY(-2px)}
        .btn-secondary{
          background:linear-gradient(180deg,#2d5a4a 0%,#1a3f32 100%);
          color:#ffd700;border:2px solid rgba(255,215,0,0.5);
          box-shadow:0 3px 10px rgba(0,0,0,0.3);
        }
        .btn-primary{
          background:linear-gradient(180deg,#ffd700 0%,#cc8400 100%);
          color:#1a1a2e;border:2px solid #ffec80;
          box-shadow:0 3px 15px rgba(255,215,0,0.3);
        }
        
        .results-overlay{
          position:fixed;top:0;left:0;right:0;bottom:0;
          background:rgba(0,0,0,.92);backdrop-filter:blur(8px);
          display:flex;align-items:center;justify-content:center;z-index:100;
          animation:fadeIn 0.5s ease;
        }
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .results-panel{
          background:
            linear-gradient(180deg,rgba(26,93,58,0.95) 0%,rgba(13,51,32,0.95) 100%);
          padding:30px 50px;border-radius:20px;
          border:4px solid #ffd700;text-align:center;
          box-shadow:0 0 50px rgba(255,215,0,0.4),0 20px 60px rgba(0,0,0,0.5);
          animation:popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes popIn{from{transform:scale(0.7);opacity:0}to{transform:scale(1);opacity:1}}
        .results-title{
          font-size:1.3rem;margin-bottom:12px;
          text-shadow:0 2px 15px rgba(255,215,0,0.5);
        }
        .results-score{
          font-size:2.8rem;font-weight:800;margin:15px 0;letter-spacing:5px;
          background:linear-gradient(180deg,#fff9c4 0%,#ffd700 50%,#ff8c00 100%);
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;
          filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));
        }
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
            <span className={`info-badge ${currentPlayer === 1 ? 'active' : ''}`}>Joueur 1</span>
            <span className="info-badge">{placementCount}/40</span>
            <span className={`info-badge ${currentPlayer === 2 ? 'active' : ''}`}>Joueur 2</span>
          </div>
          {results && (
            <div className="scores-bar">
              <div className={`score-item ${results.overallWinner === 1 ? 'winner' : ''}`}><span className="score-label">J1</span><span className="score-value">{results.p1Wins}</span></div>
              <div className={`score-item ${results.overallWinner === 2 ? 'winner' : ''}`}><span className="score-label">J2</span><span className="score-value">{results.p2Wins}</span></div>
            </div>
          )}
          {gameState === 'placing' && drawnCard && (
            <div className="center-zone">
              <span className="deck-count">🃏 {deck.length}</span>
              <span className="drawn-label">J{currentPlayer} place →</span>
              <Card card={drawnCard} />
            </div>
          )}
          {gameState === 'revealing' && <div className="center-zone"><span className="drawn-label">✨ Révélation des mains...</span></div>}
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const isRevealing = currentRevealIndex === colIndex, isRevealed = revealedColumns[colIndex];
              const p1Winner = results?.columnResults[colIndex]?.winner === 1, p2Winner = results?.columnResults[colIndex]?.winner === 2;
              return (
                <div key={colIndex} className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (p1Winner ? 'winner-p1' : 'winner-p2') : ''}`}>
                  <div className="player-side">
                    <Column cards={player1Columns[colIndex]} canPlace={currentPlayer === 1 && getCanPlaceLocal(colIndex)} onPlace={() => placeCardLocal(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && p2Winner} animatingCard={animatingColumn === colIndex && currentPlayer === 1} />
                    <div className={`hand-name ${isRevealed ? (p1Winner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.eval1?.name : `(${player1Columns[colIndex].length}/5)`}</div>
                  </div>
                  <div className="vs-indicator">{flippedLosers[colIndex] ? (p1Winner ? '✓' : '✗') : 'VS'}</div>
                  <div className="player-side">
                    <Column cards={player2Columns[colIndex]} canPlace={currentPlayer === 2 && getCanPlaceLocal(colIndex)} onPlace={() => placeCardLocal(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && p1Winner} animatingCard={animatingColumn === colIndex && currentPlayer === 2} />
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
            <div className="center-zone">
              <span className="deck-count">🃏 {deck.length}</span>
              <span className="drawn-label">À placer →</span>
              <Card card={drawnCard} />
            </div>
          )}
          {gameState === 'placing' && currentPlayer !== playerNumber && <div className="center-zone"><span className="drawn-label">⏳ L'adversaire joue...</span></div>}
          {gameState === 'revealing' && <div className="center-zone"><span className="drawn-label">✨ Révélation des mains...</span></div>}
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const isRevealing = currentRevealIndex === colIndex, isRevealed = revealedColumns[colIndex];
              const myWinner = results?.columnResults[colIndex]?.winner === playerNumber;
              const oppWinner = results && results.columnResults[colIndex]?.winner !== playerNumber;
              return (
                <div key={colIndex} className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (myWinner ? 'winner-p1' : 'winner-p2') : ''}`}>
                  <div className="player-side">
                    <Column cards={myColumns[colIndex]} canPlace={getCanPlaceOnline(colIndex)} onPlace={() => placeCardOnline(colIndex)} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && oppWinner} animatingCard={false} />
                    <div className={`hand-name ${isRevealed ? (myWinner ? 'winner' : 'loser') : ''}`}>{isRevealed ? results?.columnResults[colIndex]?.[playerNumber === 1 ? 'eval1' : 'eval2']?.name : `(${myColumns[colIndex].length}/5)`}</div>
                  </div>
                  <div className="vs-indicator">{flippedLosers[colIndex] ? (myWinner ? '✓' : '✗') : 'VS'}</div>
                  <div className="player-side">
                    <Column cards={oppColumns[colIndex]} canPlace={false} isRevealed={isRevealed} flippedBack={flippedLosers[colIndex] && myWinner} animatingCard={false} />
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
            <button className="btn btn-primary" onClick={goToMenu}>Rejouer</button>
          </div>
        </div>
      )}
    </div>
  );
}
