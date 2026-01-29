import React, { useState, useEffect, useCallback, useRef } from 'react';

// ============================================
// CONSTANTES ET UTILITAIRES
// ============================================

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
const SUIT_COLORS = { hearts: '#e63946', diamonds: '#e63946', clubs: '#1a1a2e', spades: '#1a1a2e' };

const createDeck = () => {
  const deck = [];
  SUITS.forEach(suit => {
    VALUES.forEach(value => {
      deck.push({ suit, value, id: `${suit}-${value}` });
    });
  });
  return deck;
};

const shuffleDeck = (deck, seed = null) => {
  const shuffled = [...deck];
  const random = seed ? seedRandom(seed) : Math.random;
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const seedRandom = (seed) => {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
};

const valueToNumber = (value) => {
  if (value === 'A') return 14;
  if (value === 'K') return 13;
  if (value === 'Q') return 12;
  if (value === 'J') return 11;
  return parseInt(value);
};

// ============================================
// ÉVALUATION DES MAINS
// ============================================

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
  const isStraight = uniqueValues.length === 5 && (sorted[0] - sorted[4] === 4 || 
    (sorted.includes(14) && sorted.includes(5) && sorted.includes(4) && sorted.includes(3) && sorted.includes(2)));
  const isRoyal = isStraight && values.includes(14) && values.includes(13);
  
  if (isFlush && isStraight && isRoyal) return { rank: 10, name: 'Quinte Flush Royale', highCards: values };
  if (isFlush && isStraight) return { rank: 9, name: 'Quinte Flush', highCards: values };
  if (counts[0] === 4) {
    const quadValue = Number(Object.keys(valueCounts).find(k => valueCounts[k] === 4));
    return { rank: 8, name: 'Carré', highCards: [quadValue, ...values.filter(v => v !== quadValue)] };
  }
  if (counts[0] === 3 && counts[1] === 2) {
    const tripValue = Number(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
    const pairValue = Number(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
    return { rank: 7, name: 'Full', highCards: [tripValue, pairValue] };
  }
  if (isFlush) return { rank: 6, name: 'Couleur', highCards: values };
  if (isStraight) return { rank: 5, name: 'Suite', highCards: values };
  if (counts[0] === 3) {
    const tripValue = Number(Object.keys(valueCounts).find(k => valueCounts[k] === 3));
    return { rank: 4, name: 'Brelan', highCards: [tripValue, ...values.filter(v => v !== tripValue)] };
  }
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = Object.keys(valueCounts).filter(k => valueCounts[k] === 2).map(Number).sort((a, b) => b - a);
    const kicker = values.find(v => !pairs.includes(v));
    return { rank: 3, name: 'Double Paire', highCards: [...pairs, kicker] };
  }
  if (counts[0] === 2) {
    const pairValue = Number(Object.keys(valueCounts).find(k => valueCounts[k] === 2));
    return { rank: 2, name: 'Paire', highCards: [pairValue, ...values.filter(v => v !== pairValue)] };
  }
  return { rank: 1, name: 'Carte Haute', highCards: values };
};

const compareHands = (hand1, hand2) => {
  const eval1 = evaluateHand(hand1);
  const eval2 = evaluateHand(hand2);
  
  if (eval1.rank !== eval2.rank) {
    return { winner: eval1.rank > eval2.rank ? 1 : 2, eval1, eval2 };
  }
  
  for (let i = 0; i < Math.max(eval1.highCards.length, eval2.highCards.length); i++) {
    const a = eval1.highCards[i] || 0;
    const b = eval2.highCards[i] || 0;
    if (a !== b) return { winner: a > b ? 1 : 2, eval1, eval2 };
  }
  return { winner: 1, eval1, eval2 };
};

// ============================================
// COMPOSANT CARTE
// ============================================

const Card = ({ card, faceDown = false }) => {
  const [isFlipping, setIsFlipping] = useState(false);
  const [showFace, setShowFace] = useState(!faceDown);
  const [wasRevealed, setWasRevealed] = useState(!faceDown);
  
  useEffect(() => {
    if (!faceDown && !showFace && !wasRevealed) {
      setIsFlipping(true);
      setTimeout(() => {
        setShowFace(true);
        setWasRevealed(true);
        setTimeout(() => setIsFlipping(false), 300);
      }, 150);
    }
    if (faceDown && showFace && wasRevealed) {
      setIsFlipping(true);
      setTimeout(() => {
        setShowFace(false);
        setTimeout(() => setIsFlipping(false), 300);
      }, 150);
    }
  }, [faceDown, showFace, wasRevealed]);
  
  if (!card) return null;
  
  const color = SUIT_COLORS[card.suit] || '#333';
  
  return (
    <div className={`card ${isFlipping ? 'card-flipping' : ''}`}>
      {(faceDown || !showFace) ? (
        <div className="card-back">
          <div className="card-back-pattern"></div>
        </div>
      ) : (
        <div className="card-face" style={{ color }}>
          <div className="card-corner top-left">
            <span className="card-value">{card.value}</span>
            <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div className="card-center">
            <span className="card-suit-large">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div className="card-corner bottom-right">
            <span className="card-value">{card.value}</span>
            <span className="card-suit">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// COMPOSANT COLONNE
// ============================================

const Column = ({ cards, canPlace, onPlace, showCards, isRevealed, flippedBack }) => {
  return (
    <div 
      className={`column-cards ${canPlace ? 'can-place' : ''}`}
      onClick={canPlace ? onPlace : undefined}
    >
      {cards.map((card, i) => {
        const shouldShow = i === 0 || showCards || isRevealed;
        return (
          <Card 
            key={i} 
            card={card} 
            faceDown={!shouldShow || flippedBack}
          />
        );
      })}
      {canPlace && cards.length < 5 && (
        <div className="place-indicator">+</div>
      )}
    </div>
  );
};

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function PokerDuel() {
  const [mode, setMode] = useState('menu'); // menu, local, online-create, online-join, online-waiting, online-game
  const [roomCode, setRoomCode] = useState('');
  const [playerNumber, setPlayerNumber] = useState(null);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');
  const [storageAvailable, setStorageAvailable] = useState(true);
  
  // État du jeu
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

  // ============================================
  // MODE LOCAL (PARFAIT)
  // ============================================

  const startLocalGame = useCallback(() => {
    const newDeck = shuffleDeck(createDeck());
    newDeck.shift(); // Brûler 1 carte
    
    const p1Cols = [[], [], [], [], []];
    const p2Cols = [[], [], [], [], []];
    
    for (let i = 0; i < 5; i++) {
      p1Cols[i].push(newDeck.shift());
      p2Cols[i].push(newDeck.shift());
    }
    
    setDeck(newDeck);
    setPlayer1Columns(p1Cols);
    setPlayer2Columns(p2Cols);
    setCurrentPlayer(1);
    setPlacementCount(0);
    setDrawnCard(newDeck[0]);
    setGameState('placing');
    setResults(null);
    setRevealedColumns([false, false, false, false, false]);
    setFlippedLosers([false, false, false, false, false]);
    setCurrentRevealIndex(-1);
    setMode('local');
  }, []);

  const placeCardLocal = (columnIndex) => {
    if (!drawnCard || gameState !== 'placing') return;
    
    const isPlayer1 = currentPlayer === 1;
    const columns = isPlayer1 ? player1Columns : player2Columns;
    const setColumns = isPlayer1 ? setPlayer1Columns : setPlayer2Columns;
    
    if (columns[columnIndex].length >= 5) return;
    
    const newColumns = columns.map((col, i) => 
      i === columnIndex ? [...col, drawnCard] : col
    );
    setColumns(newColumns);
    
    const newCount = placementCount + 1;
    setPlacementCount(newCount);
    
    const updatedP1 = isPlayer1 ? newColumns : player1Columns;
    const updatedP2 = isPlayer1 ? player2Columns : newColumns;
    const allFull = updatedP1.every(c => c.length >= 5) && updatedP2.every(c => c.length >= 5);
    
    if (allFull) {
      setDrawnCard(null);
      setGameState('revealing');
      setTimeout(() => calculateResults(updatedP1, updatedP2), 500);
    } else {
      const nextPlayer = currentPlayer === 1 ? 2 : 1;
      setCurrentPlayer(nextPlayer);
      const newDeck = deck.slice(1);
      setDeck(newDeck);
      setDrawnCard(newDeck[0]);
    }
  };

  // ============================================
  // MODE ONLINE
  // ============================================

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const createRoom = async () => {
    if (!window.storage) {
      setStorageAvailable(false);
      setError('Mode en ligne non disponible en preview. Déployez l\'app pour jouer en ligne.');
      return;
    }
    
    try {
      const code = generateRoomCode();
      const seed = Date.now();
      
      const roomData = {
        seed,
        player1Connected: true,
        player2Connected: false,
        gameState: 'waiting',
        currentPlayer: 1,
        placementCount: 0,
        moves: [],
        lastUpdate: Date.now()
      };
      
      await window.storage.set(`poker:${code}`, JSON.stringify(roomData), true);
      
      setRoomCode(code);
      setPlayerNumber(1);
      setGameSeed(seed);
      setMode('online-waiting');
      startPolling(code, 1, seed);
    } catch (err) {
      setError('Erreur de création. Vérifiez que l\'app est déployée.');
      console.error(err);
    }
  };

  const joinRoom = async () => {
    if (!window.storage) {
      setStorageAvailable(false);
      setError('Mode en ligne non disponible en preview.');
      return;
    }
    
    const code = inputCode.toUpperCase().trim();
    if (code.length !== 4) {
      setError('Code invalide (4 caractères)');
      return;
    }
    
    try {
      const result = await window.storage.get(`poker:${code}`, true);
      if (!result || !result.value) {
        setError('Room introuvable');
        return;
      }
      
      const roomData = JSON.parse(result.value);
      
      if (roomData.player2Connected) {
        setError('Room déjà pleine');
        return;
      }
      
      roomData.player2Connected = true;
      roomData.gameState = 'playing';
      roomData.lastUpdate = Date.now();
      
      await window.storage.set(`poker:${code}`, JSON.stringify(roomData), true);
      
      setRoomCode(code);
      setPlayerNumber(2);
      setGameSeed(roomData.seed);
      initOnlineGame(roomData.seed, roomData.moves);
      setMode('online-game');
      startPolling(code, 2, roomData.seed);
    } catch (err) {
      setError('Erreur de connexion');
      console.error(err);
    }
  };

  const initOnlineGame = useCallback((seed, existingMoves = []) => {
    const fullDeck = shuffleDeck(createDeck(), seed);
    fullDeck.shift(); // Brûler
    
    const p1Cols = [[], [], [], [], []];
    const p2Cols = [[], [], [], [], []];
    
    for (let i = 0; i < 5; i++) {
      p1Cols[i].push(fullDeck.shift());
      p2Cols[i].push(fullDeck.shift());
    }
    
    // Appliquer les moves existants
    let deckPointer = 0;
    existingMoves.forEach((move, idx) => {
      const card = fullDeck[deckPointer];
      if (move.player === 1) {
        p1Cols[move.column].push(card);
      } else {
        p2Cols[move.column].push(card);
      }
      deckPointer++;
    });
    
    setDeck(fullDeck.slice(deckPointer));
    setPlayer1Columns(p1Cols);
    setPlayer2Columns(p2Cols);
    setPlacementCount(existingMoves.length);
    setCurrentPlayer(existingMoves.length % 2 === 0 ? 1 : 2);
    setDrawnCard(fullDeck[deckPointer]);
    setGameState('placing');
    setResults(null);
    setRevealedColumns([false, false, false, false, false]);
    setFlippedLosers([false, false, false, false, false]);
  }, []);

  const startPolling = (code, myPlayer, seed) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    
    pollingRef.current = setInterval(async () => {
      try {
        const result = await window.storage.get(`poker:${code}`, true);
        if (!result?.value) return;
        
        const roomData = JSON.parse(result.value);
        
        // J1 attend J2
        if (myPlayer === 1 && roomData.player2Connected && mode === 'online-waiting') {
          setMode('online-game');
          initOnlineGame(seed, roomData.moves);
        }
        
        // Synchroniser les moves
        if (mode === 'online-game' || (myPlayer === 1 && roomData.player2Connected)) {
          const currentMoves = roomData.moves || [];
          if (currentMoves.length > placementCount) {
            initOnlineGame(seed, currentMoves);
          }
          
          // Vérifier fin de partie
          if (roomData.gameState === 'finished' && gameState !== 'revealing') {
            setGameState('revealing');
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  };

  const placeCardOnline = async (columnIndex) => {
    if (!drawnCard || gameState !== 'placing') return;
    if (currentPlayer !== playerNumber) return;
    
    const isPlayer1 = playerNumber === 1;
    const columns = isPlayer1 ? player1Columns : player2Columns;
    const setColumns = isPlayer1 ? setPlayer1Columns : setPlayer2Columns;
    
    if (columns[columnIndex].length >= 5) return;
    
    // Mettre à jour localement
    const newColumns = columns.map((col, i) => 
      i === columnIndex ? [...col, drawnCard] : col
    );
    setColumns(newColumns);
    
    const newCount = placementCount + 1;
    setPlacementCount(newCount);
    
    // Envoyer au serveur
    try {
      const result = await window.storage.get(`poker:${roomCode}`, true);
      if (result?.value) {
        const roomData = JSON.parse(result.value);
        roomData.moves.push({ player: playerNumber, column: columnIndex });
        roomData.currentPlayer = playerNumber === 1 ? 2 : 1;
        roomData.placementCount = newCount;
        
        if (newCount >= 40) {
          roomData.gameState = 'finished';
        }
        
        roomData.lastUpdate = Date.now();
        await window.storage.set(`poker:${roomCode}`, JSON.stringify(roomData), true);
      }
    } catch (err) {
      console.error('Send move error:', err);
    }
    
    // Vérifier fin
    const updatedP1 = isPlayer1 ? newColumns : player1Columns;
    const updatedP2 = isPlayer1 ? player2Columns : newColumns;
    const allFull = updatedP1.every(c => c.length >= 5) && updatedP2.every(c => c.length >= 5);
    
    if (allFull) {
      setDrawnCard(null);
      setGameState('revealing');
      setTimeout(() => calculateResults(updatedP1, updatedP2), 500);
    } else {
      setCurrentPlayer(playerNumber === 1 ? 2 : 1);
      const newDeck = deck.slice(1);
      setDeck(newDeck);
      setDrawnCard(newDeck[0]);
    }
  };

  // ============================================
  // RÉSULTATS
  // ============================================

  const calculateResults = (p1Cols, p2Cols) => {
    const columnResults = [];
    let p1Wins = 0, p2Wins = 0;
    
    for (let i = 0; i < 5; i++) {
      const comparison = compareHands(p1Cols[i], p2Cols[i]);
      columnResults.push(comparison);
      if (comparison.winner === 1) p1Wins++;
      else p2Wins++;
    }
    
    setResults({ columnResults, p1Wins, p2Wins, overallWinner: p1Wins > p2Wins ? 1 : 2 });
    
    // Animation révélation
    let idx = 0;
    const revealNext = () => {
      if (idx >= 5) {
        setGameState('finished');
        return;
      }
      setCurrentRevealIndex(idx);
      setRevealedColumns(prev => { const u = [...prev]; u[idx] = true; return u; });
      setTimeout(() => {
        setFlippedLosers(prev => { const u = [...prev]; u[idx] = true; return u; });
        setTimeout(() => { idx++; revealNext(); }, 500);
      }, 700);
    };
    setTimeout(revealNext, 300);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const goToMenu = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setMode('menu');
    setRoomCode('');
    setPlayerNumber(null);
    setError('');
    setInputCode('');
    setGameState('waiting');
  };

  // ============================================
  // RENDU
  // ============================================

  return (
    <div className="game-container">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap');
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
        
        .game-container {
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          background: radial-gradient(ellipse at center, #1a472a 0%, #0d2818 50%, #071510 100%);
          padding: 6px;
          font-family: 'Cinzel', serif;
          color: #ffd700;
          display: flex;
          flex-direction: column;
        }
        
        .game-header { text-align: center; padding: 4px 0; }
        
        .game-title {
          font-size: 1rem;
          font-weight: 700;
          background: linear-gradient(180deg, #ffd700 0%, #ff8c00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        /* Menu */
        .menu-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px;
        }
        
        .menu-title { font-size: 1.2rem; margin-bottom: 15px; }
        
        .menu-btn {
          width: 100%;
          max-width: 220px;
          padding: 12px 16px;
          font-family: 'Cinzel', serif;
          font-size: 0.8rem;
          font-weight: 600;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }
        
        .menu-btn-primary {
          background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
          color: #1a1a2e;
        }
        
        .menu-btn-secondary {
          background: linear-gradient(135deg, #2d4a3e 0%, #1a2f26 100%);
          color: #ffd700;
          border: 2px solid #ffd700;
        }
        
        .room-code {
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: 6px;
          padding: 12px 25px;
          background: rgba(0,0,0,0.4);
          border-radius: 10px;
          border: 2px solid #ffd700;
        }
        
        .waiting-text {
          font-size: 0.8rem;
          color: #b8860b;
          animation: blink 1.5s infinite;
        }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .input-code {
          font-family: 'Cinzel', serif;
          font-size: 1.3rem;
          text-align: center;
          letter-spacing: 4px;
          padding: 10px 15px;
          border-radius: 8px;
          border: 2px solid #ffd700;
          background: rgba(0,0,0,0.4);
          color: #ffd700;
          width: 130px;
          text-transform: uppercase;
        }
        
        .error-text { color: #ff5252; font-size: 0.75rem; text-align: center; }
        
        .back-btn {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 10px;
          font-size: 0.65rem;
          background: rgba(0,0,0,0.4);
          border: 1px solid #ffd700;
          color: #ffd700;
          border-radius: 6px;
          cursor: pointer;
        }
        
        /* Game */
        .game-board {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .info-bar {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 3px 0;
        }
        
        .info-badge {
          padding: 2px 8px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 6px;
          font-size: 0.55rem;
          color: #ffd700;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }
        
        .info-badge.active {
          background: rgba(0, 100, 0, 0.6);
          border-color: #00c853;
        }
        
        .info-badge.waiting-turn {
          background: rgba(100, 50, 0, 0.6);
          border-color: #ff8c00;
        }
        
        .scores-bar {
          display: flex;
          justify-content: center;
          gap: 15px;
          padding: 3px 0;
        }
        
        .score-item {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          background: rgba(0,0,0,0.4);
          border-radius: 5px;
        }
        
        .score-item.winner {
          border: 1px solid #00c853;
          box-shadow: 0 0 6px rgba(0, 200, 83, 0.4);
        }
        
        .score-label { font-size: 0.5rem; color: #b8860b; }
        .score-value { font-size: 0.9rem; font-weight: 700; }
        
        .duel-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        
        .duel-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 3px 4px;
          border-radius: 6px;
          background: rgba(0,0,0,0.25);
          flex: 1;
          transition: all 0.3s ease;
        }
        
        .duel-row.revealing {
          background: rgba(255, 215, 0, 0.15);
          box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
        }
        
        .duel-row.winner-p1 {
          background: linear-gradient(90deg, rgba(0, 200, 83, 0.3) 0%, transparent 40%, transparent 60%, rgba(100, 0, 0, 0.2) 100%);
        }
        
        .duel-row.winner-p2 {
          background: linear-gradient(90deg, rgba(100, 0, 0, 0.2) 0%, transparent 40%, transparent 60%, rgba(0, 200, 83, 0.3) 100%);
        }
        
        .player-side {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1px;
        }
        
        .column-cards {
          display: flex;
          gap: 1px;
          padding: 2px;
          border-radius: 4px;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .column-cards.can-place {
          cursor: pointer;
          border: 2px dashed rgba(255, 215, 0, 0.6);
          background: rgba(255, 215, 0, 0.1);
        }
        
        .column-cards.can-place:hover, .column-cards.can-place:active {
          background: rgba(255, 215, 0, 0.25);
          border-color: #ffd700;
          transform: scale(1.02);
        }
        
        .place-indicator {
          position: absolute;
          right: -5px;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 12px;
          background: #ffd700;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: #1a472a;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { transform: translateY(-50%) scale(1); }
          50% { transform: translateY(-50%) scale(1.2); }
        }
        
        .vs-indicator {
          font-size: 0.5rem;
          font-weight: 700;
          color: #ffd700;
          min-width: 22px;
          text-align: center;
        }
        
        .hand-name {
          font-size: 0.4rem;
          color: #b8860b;
          text-transform: uppercase;
          white-space: nowrap;
          min-height: 9px;
        }
        
        .hand-name.winner { color: #00c853; font-weight: 700; }
        .hand-name.loser { color: #ff5252; }
        
        .center-zone {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 5px;
          background: rgba(0,0,0,0.4);
          border-radius: 6px;
          margin: 3px 0;
        }
        
        .drawn-label { font-size: 0.5rem; color: #b8860b; }
        .deck-count { font-size: 0.5rem; color: #b8860b; }
        
        .card {
          width: 26px;
          height: 36px;
          border-radius: 3px;
          background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
          box-shadow: 0 1px 2px rgba(0,0,0,0.3);
          position: relative;
          flex-shrink: 0;
        }
        
        .card-flipping { animation: flip 0.3s ease; }
        
        @keyframes flip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        
        .card-back {
          width: 100%;
          height: 100%;
          border-radius: 3px;
          background: linear-gradient(135deg, #8b0000 0%, #5c0000 100%);
          border: 1px solid #ffd700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .card-back-pattern {
          width: 80%;
          height: 80%;
          background: repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255, 215, 0, 0.15) 2px, rgba(255, 215, 0, 0.15) 4px);
          border-radius: 2px;
        }
        
        .card-face { width: 100%; height: 100%; padding: 1px; }
        
        .card-corner {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          line-height: 1;
        }
        
        .top-left { top: 1px; left: 2px; }
        .bottom-right { bottom: 1px; right: 2px; transform: rotate(180deg); }
        
        .card-value { font-size: 7px; font-weight: 700; }
        .card-suit { font-size: 6px; }
        .card-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .card-suit-large { font-size: 10px; }
        
        .game-controls {
          display: flex;
          justify-content: center;
          padding: 5px 0;
        }
        
        .btn {
          padding: 6px 16px;
          font-family: 'Cinzel', serif;
          font-size: 0.65rem;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
        }
        
        .btn-secondary {
          background: linear-gradient(135deg, #2d4a3e 0%, #1a2f26 100%);
          color: #ffd700;
          border: 1px solid #ffd700;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
          color: #1a1a2e;
        }
        
        .results-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }
        
        .results-panel {
          background: linear-gradient(135deg, #1a472a 0%, #0d2818 100%);
          padding: 20px 30px;
          border-radius: 12px;
          border: 2px solid #ffd700;
          text-align: center;
        }
        
        .results-title { font-size: 1.1rem; margin-bottom: 8px; }
        .results-score {
          font-size: 1.8rem;
          font-weight: 700;
          margin: 8px 0;
          background: linear-gradient(180deg, #ffd700 0%, #ff8c00 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `}</style>
      
      <header className="game-header">
        <h1 className="game-title">♠ POKER DUEL ♠</h1>
      </header>
      
      {/* MENU */}
      {mode === 'menu' && (
        <div className="menu-container">
          <div className="menu-title">🃏 Mode de jeu</div>
          <button className="menu-btn menu-btn-primary" onClick={startLocalGame}>
            👥 Local (2 joueurs)
          </button>
          <button className="menu-btn menu-btn-secondary" onClick={createRoom}>
            🌐 Créer une partie
          </button>
          <button className="menu-btn menu-btn-secondary" onClick={() => setMode('online-join')}>
            🔗 Rejoindre
          </button>
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
      
      {/* REJOINDRE */}
      {mode === 'online-join' && (
        <div className="menu-container">
          <button className="back-btn" onClick={goToMenu}>← Retour</button>
          <div className="menu-title">Code de la partie</div>
          <input
            type="text"
            className="input-code"
            placeholder="XXXX"
            maxLength={4}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
          />
          {error && <div className="error-text">{error}</div>}
          <button className="menu-btn menu-btn-primary" onClick={joinRoom}>
            Rejoindre
          </button>
        </div>
      )}
      
      {/* EN ATTENTE */}
      {mode === 'online-waiting' && (
        <div className="menu-container">
          <button className="back-btn" onClick={goToMenu}>← Annuler</button>
          <div className="menu-title">Code de la partie</div>
          <div className="room-code">{roomCode}</div>
          <div className="waiting-text">En attente d'un adversaire...</div>
        </div>
      )}
      
      {/* JEU LOCAL */}
      {mode === 'local' && gameState !== 'waiting' && (
        <div className="game-board">
          <div className="info-bar">
            <span className={`info-badge ${currentPlayer === 1 ? 'active' : ''}`}>J1</span>
            <span className="info-badge">{placementCount}/40</span>
            <span className={`info-badge ${currentPlayer === 2 ? 'active' : ''}`}>J2</span>
          </div>
          
          {results && (
            <div className="scores-bar">
              <div className={`score-item ${results.overallWinner === 1 ? 'winner' : ''}`}>
                <span className="score-label">J1</span>
                <span className="score-value">{results.p1Wins}</span>
              </div>
              <div className={`score-item ${results.overallWinner === 2 ? 'winner' : ''}`}>
                <span className="score-label">J2</span>
                <span className="score-value">{results.p2Wins}</span>
              </div>
            </div>
          )}
          
          {gameState === 'placing' && drawnCard && (
            <div className="center-zone">
              <span className="deck-count">🃏 {deck.length}</span>
              <span className="drawn-label">J{currentPlayer} →</span>
              <Card card={drawnCard} />
            </div>
          )}
          
          {gameState === 'revealing' && (
            <div className="center-zone">
              <span className="drawn-label">✨ Révélation...</span>
            </div>
          )}
          
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const isRevealing = currentRevealIndex === colIndex;
              const isRevealed = revealedColumns[colIndex];
              const p1Winner = results?.columnResults[colIndex]?.winner === 1;
              const p2Winner = results?.columnResults[colIndex]?.winner === 2;
              
              return (
                <div 
                  key={colIndex}
                  className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (p1Winner ? 'winner-p1' : 'winner-p2') : ''}`}
                >
                  <div className="player-side">
                    <Column
                      cards={player1Columns[colIndex]}
                      canPlace={gameState === 'placing' && currentPlayer === 1 && player1Columns[colIndex].length < 5}
                      onPlace={() => placeCardLocal(colIndex)}
                      showCards={currentPlayer === 1}
                      isRevealed={isRevealed}
                      flippedBack={flippedLosers[colIndex] && p2Winner}
                    />
                    <div className={`hand-name ${isRevealed ? (p1Winner ? 'winner' : 'loser') : ''}`}>
                      {isRevealed ? results?.columnResults[colIndex]?.eval1?.name : `(${player1Columns[colIndex].length}/5)`}
                    </div>
                  </div>
                  
                  <div className="vs-indicator">
                    {flippedLosers[colIndex] ? (p1Winner ? '✓' : '✗') : 'VS'}
                  </div>
                  
                  <div className="player-side">
                    <Column
                      cards={player2Columns[colIndex]}
                      canPlace={gameState === 'placing' && currentPlayer === 2 && player2Columns[colIndex].length < 5}
                      onPlace={() => placeCardLocal(colIndex)}
                      showCards={currentPlayer === 2}
                      isRevealed={isRevealed}
                      flippedBack={flippedLosers[colIndex] && p1Winner}
                    />
                    <div className={`hand-name ${isRevealed ? (p2Winner ? 'winner' : 'loser') : ''}`}>
                      {isRevealed ? results?.columnResults[colIndex]?.eval2?.name : `(${player2Columns[colIndex].length}/5)`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="game-controls">
            <button className="btn btn-secondary" onClick={goToMenu}>← Menu</button>
          </div>
        </div>
      )}
      
      {/* JEU ONLINE */}
      {mode === 'online-game' && gameState !== 'waiting' && (
        <div className="game-board">
          <div className="info-bar">
            <span className="info-badge">Room: {roomCode}</span>
            <span className={`info-badge ${currentPlayer === playerNumber ? 'active' : 'waiting-turn'}`}>
              {currentPlayer === playerNumber ? '🎯 Votre tour' : '⏳ Adversaire'}
            </span>
            <span className="info-badge">{placementCount}/40</span>
          </div>
          
          {results && (
            <div className="scores-bar">
              <div className={`score-item ${results.overallWinner === playerNumber ? 'winner' : ''}`}>
                <span className="score-label">Vous</span>
                <span className="score-value">{playerNumber === 1 ? results.p1Wins : results.p2Wins}</span>
              </div>
              <div className={`score-item ${results.overallWinner !== playerNumber ? 'winner' : ''}`}>
                <span className="score-label">Adv.</span>
                <span className="score-value">{playerNumber === 1 ? results.p2Wins : results.p1Wins}</span>
              </div>
            </div>
          )}
          
          {gameState === 'placing' && drawnCard && currentPlayer === playerNumber && (
            <div className="center-zone">
              <span className="deck-count">🃏 {deck.length}</span>
              <span className="drawn-label">À placer →</span>
              <Card card={drawnCard} />
            </div>
          )}
          
          {gameState === 'placing' && currentPlayer !== playerNumber && (
            <div className="center-zone">
              <span className="drawn-label">⏳ L'adversaire joue...</span>
            </div>
          )}
          
          <div className="duel-container">
            {[0, 1, 2, 3, 4].map(colIndex => {
              const myColumns = playerNumber === 1 ? player1Columns : player2Columns;
              const oppColumns = playerNumber === 1 ? player2Columns : player1Columns;
              const isRevealing = currentRevealIndex === colIndex;
              const isRevealed = revealedColumns[colIndex];
              const myWinner = results?.columnResults[colIndex]?.winner === playerNumber;
              const oppWinner = results?.columnResults[colIndex]?.winner !== playerNumber;
              
              return (
                <div 
                  key={colIndex}
                  className={`duel-row ${isRevealing ? 'revealing' : ''} ${flippedLosers[colIndex] ? (myWinner ? 'winner-p1' : 'winner-p2') : ''}`}
                >
                  {/* Mes cartes */}
                  <div className="player-side">
                    <Column
                      cards={myColumns[colIndex]}
                      canPlace={gameState === 'placing' && currentPlayer === playerNumber && myColumns[colIndex].length < 5}
                      onPlace={() => placeCardOnline(colIndex)}
                      showCards={true}
                      isRevealed={isRevealed}
                      flippedBack={flippedLosers[colIndex] && oppWinner}
                    />
                    <div className={`hand-name ${isRevealed ? (myWinner ? 'winner' : 'loser') : ''}`}>
                      {isRevealed ? results?.columnResults[colIndex]?.[playerNumber === 1 ? 'eval1' : 'eval2']?.name : `(${myColumns[colIndex].length}/5)`}
                    </div>
                  </div>
                  
                  <div className="vs-indicator">
                    {flippedLosers[colIndex] ? (myWinner ? '✓' : '✗') : 'VS'}
                  </div>
                  
                  {/* Cartes adversaire (cachées sauf base) */}
                  <div className="player-side">
                    <Column
                      cards={oppColumns[colIndex]}
                      canPlace={false}
                      showCards={false}
                      isRevealed={isRevealed}
                      flippedBack={flippedLosers[colIndex] && myWinner}
                    />
                    <div className={`hand-name ${isRevealed ? (oppWinner ? 'winner' : 'loser') : ''}`}>
                      {isRevealed ? results?.columnResults[colIndex]?.[playerNumber === 1 ? 'eval2' : 'eval1']?.name : `(${oppColumns[colIndex].length}/5)`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="game-controls">
            <button className="btn btn-secondary" onClick={goToMenu}>← Menu</button>
          </div>
        </div>
      )}
      
      {/* RÉSULTATS */}
      {results && gameState === 'finished' && (
        <div className="results-overlay" onClick={goToMenu}>
          <div className="results-panel" onClick={e => e.stopPropagation()}>
            <h2 className="results-title">
              {mode === 'online-game' 
                ? (results.overallWinner === playerNumber ? '🎉 Victoire !' : '😔 Défaite')
                : `👑 Joueur ${results.overallWinner} gagne !`
              }
            </h2>
            <div className="results-score">{results.p1Wins} - {results.p2Wins}</div>
            <button className="btn btn-primary" onClick={goToMenu}>Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
