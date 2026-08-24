(() => {
  'use strict';
  const suits = ['♠','♥','♦','♣'], redSuits = new Set(['♥','♦']);
  const rankNames = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const board = document.getElementById('board'), topRow = document.getElementById('topRow'), tableauRow = document.getElementById('tableauRow');
  const movesEl = document.getElementById('movesEl'), timerEl = document.getElementById('timerEl'), solveBtn = document.getElementById('solveBtn');
  const winOverlay = document.getElementById('winOverlay'), winStats = document.getElementById('winStats');
  let state, history = [], dragData = null, timer = null, startedAt = 0, autoSolving = false;
  const clone = v => JSON.parse(JSON.stringify(v));

  function newGame() {
    autoSolving = false;
    const color = Math.random() < .5 ? { light:'#b91c1c', dark:'#7a1212' } : { light:'#1d4ed8', dark:'#15339e' };
    document.documentElement.style.setProperty('--back-color-dark', color.light);
    document.documentElement.style.setProperty('--btn-color', color.dark);
    const deck = []; suits.forEach((s, si) => { for (let r=1;r<=13;r++) deck.push({ rank:r, suit:s, color:redSuits.has(s)?'red':'black', faceUp:false, id:si*13+r }); });
    for (let i=deck.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    state = { stock:[], waste:[], foundations:[[],[],[],[]], tableau:[[],[],[],[],[],[],[]], moves:0 };
    for (let c=0;c<7;c++) for(let n=0;n<=c;n++) { const card=deck.pop(); card.faceUp=n===c; state.tableau[c].push(card); }
    state.stock=deck; history=[]; startedAt=Date.now(); clearInterval(timer); timer=setInterval(updateTimer,1000); winOverlay?.classList.remove('show'); render();
  }
  function updateTimer(){ if(!startedAt)return; const s=Math.floor((Date.now()-startedAt)/1000), m=Math.floor(s/60); if(timerEl) timerEl.textContent=`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
  function snapshot(){ return clone({stock:state.stock,waste:state.waste,foundations:state.foundations,tableau:state.tableau,moves:state.moves}); }
  function pushHistory(){ history.push(snapshot()); if(history.length>100)history.shift(); }
  function restore(s){ state=clone(s); render(); }
  function undo(){ if(autoSolving) return; if(history.length) restore(history.pop()); }
  function setupLayout(){ const w=board.clientWidth-16, gap=Math.max(4,Math.min(10,w*.012)); const cw=Math.max(34,Math.min(92,(w-6*gap)/7)); const ch=cw*1.42; board.style.setProperty('--cw',`${cw}px`); board.style.setProperty('--ch',`${ch}px`); board.style.setProperty('--gap',`${gap}px`); }

  function cardHTML(c, i, source, col){
    const el=document.createElement('div');
    el.className=`card ${c.color}${c.faceUp?'':' facedown'}`;
    el.dataset.cardIndex=i; el.dataset.source=source;
    if(col!==undefined)el.dataset.sourceIndex=col;
    el.innerHTML=c.faceUp?`<div class="corner"><span>${rankNames[c.rank]}</span><span>${c.suit}</span></div><span class="center-suit">${c.suit}</span><div class="corner bottom"><span>${rankNames[c.rank]}</span><span>${c.suit}</span></div>`:'';
    return el;
  }
  function addDropZone(el,type,index){ el.dataset.dropType=type; el.dataset.dropIndex=index; }
  function allCardsFaceUp(){ return state.stock.length===0 && state.waste.every(c=>c.faceUp) && state.tableau.every(col=>col.every(c=>c.faceUp===true)); }

  function cw(){ return parseFloat(getComputedStyle(board).getPropertyValue('--cw')); }

  function render(){
    setupLayout();
    topRow.innerHTML=''; tableauRow.innerHTML='';

    // Foundations links
    state.foundations.forEach((f,i)=>{
      const p=document.createElement('div'); p.className='pile foundation';
      p.innerHTML=`<span class="suit-hint">${suits[i]}</span>`;
      addDropZone(p,'foundation',i);
      if(f.length)p.append(cardHTML(f.at(-1),f.length-1,'foundation',i));
      topRow.append(p);
    });

    const spacer=document.createElement('div'); spacer.style.flex='1'; topRow.append(spacer);

    // Waste (mit Fächerung der letzten bis zu 3 Karten)
    const waste=document.createElement('div'); waste.className='pile waste';
    addDropZone(waste,'waste',0);
    const wLen = state.waste.length;
    const fanCount = Math.min(3, wLen);
    for (let k = fanCount; k >= 1; k--) {
      const idx = wLen - k;
      const c = state.waste[idx];
      const el = cardHTML(c, idx, 'waste');
      const offset = (fanCount - k) * (cw() * 0.22);
      el.style.left = offset + 'px';
      el.style.zIndex = idx;
      waste.append(el);
    }
    topRow.append(waste);

    // Stock (rechts außen)
    const stock=document.createElement('div'); stock.className='pile stock';
    addDropZone(stock,'stock',0);
    stock.addEventListener('pointerdown',drawStock);
    if(state.stock.length){
      const topCard = { ...state.stock.at(-1), faceUp:false };
      const el = cardHTML(topCard, state.stock.length-1, 'stock');
      stock.append(el);
    }
    topRow.append(stock);

    // Tableau
    state.tableau.forEach((col,i)=>{
      const el=document.createElement('div'); el.className='tableau-col';
      addDropZone(el,'tableau',i);
      let y=0;
      col.forEach((c,j)=>{
        const card=cardHTML(c,j,'tableau',i);
        card.style.top=`${y}px`;
        el.append(card);
        y += c.faceUp ? Math.max(20,cw()*.32) : Math.max(16,cw()*.22);
      });
      tableauRow.append(el);
    });

    document.querySelectorAll('.card').forEach(attachDrag);
    if(movesEl)movesEl.textContent=state.moves;
    solveBtn?.classList.toggle('hidden', autoSolving || !allCardsFaceUp() || state.foundations.every(f=>f.length===13));
    checkWin();
  }

  function drawStock(e){
    if(autoSolving) return;
    e.preventDefault(); pushHistory();
    if(state.stock.length)state.waste.push({...state.stock.pop(),faceUp:true});
    else { while(state.waste.length)state.stock.push({...state.waste.pop(),faceUp:false}); }
    state.moves++; render();
  }

  function attachDrag(el){ el.addEventListener('pointerdown',startDrag); }
  function startDrag(e){
    if(autoSolving) return;
    if(e.button!==undefined&&e.button!==0)return;
    const el=e.currentTarget, c=+el.dataset.cardIndex, src=el.dataset.source, idx=+(el.dataset.sourceIndex||0);
    if(src==='stock') return;
    if(src==='tableau'&&!state.tableau[idx][c].faceUp)return;
    if(src==='foundation'&&c!==state.foundations[idx].length-1)return;
    if(src==='waste'&&c!==state.waste.length-1)return;
    const group=src==='tableau'?state.tableau[idx].slice(c):[src==='waste'?state.waste.at(-1):state.foundations[idx].at(-1)];
    if(!group[0])return;
    dragData={source:src,sourceIndex:idx,index:c,group,originX:e.clientX,originY:e.clientY,moved:false,pointerId:e.pointerId,el};
    el.setPointerCapture?.(e.pointerId);
    document.addEventListener('pointermove',onDragMove);
    document.addEventListener('pointerup',onDragEnd,{once:true});
  }
  function onDragMove(e){
    if(!dragData)return;
    if(Math.hypot(e.clientX-dragData.originX,e.clientY-dragData.originY)>6)dragData.moved=true;
    if(!dragData.moved)return;
    const dx=e.clientX-dragData.originX,dy=e.clientY-dragData.originY;
    const cards=[...document.querySelectorAll('.card')].filter(x=>x.dataset.source===dragData.source&&+x.dataset.sourceIndex===dragData.sourceIndex&&+x.dataset.cardIndex>=dragData.index);
    cards.forEach(x=>{x.classList.add('dragging');x.style.transform=`translate(${dx}px,${dy}px)`;});
  }
  function onDragEnd(e){
    if(!dragData)return;
    const d=dragData; dragData=null;
    document.removeEventListener('pointermove',onDragMove);
    document.querySelectorAll('.card.dragging').forEach(x=>{x.classList.remove('dragging');x.style.transform='';});
    if(d.moved)tryDropWithTolerance(e.clientX,e.clientY,d); else tryAutoMove(d);
  }
  function zoneRect(z,type){
    const r=z.getBoundingClientRect();
    if(type!=='tableau')return r;
    const col=state.tableau[+z.dataset.dropIndex], c=cw(), ch=parseFloat(getComputedStyle(board).getPropertyValue('--ch'));
    let y=0; col.forEach(card=>y+=card.faceUp?Math.max(20,c*.32):Math.max(16,c*.22));
    return {left:r.left,top:r.top,right:r.right,bottom:Math.min(r.top+y+ch,r.bottom)};
  }
  function distanceToRect(x,y,r){ return Math.hypot(Math.max(r.left-x,0,x-r.right),Math.max(r.top-y,0,y-r.bottom)); }
  function tryDropWithTolerance(x,y,drag){
    const candidates=[];
    document.querySelectorAll('[data-drop-type]').forEach(z=>{
      const type=z.dataset.dropType,idx=+z.dataset.dropIndex;
      if(type==='foundation'&&canPlaceOnFoundation(drag.group[0],idx))candidates.push({z,type,idx});
      if(type==='tableau'&&canPlaceOnTableau(drag.group,idx,drag))candidates.push({z,type,idx});
    });
    candidates.sort((a,b)=>distanceToRect(x,y,zoneRect(a.z,a.type))-distanceToRect(x,y,zoneRect(b.z,b.type)));
    if(candidates.length&&distanceToRect(x,y,zoneRect(candidates[0].z,candidates[0].type))<=45)executeDrop(candidates[0].type,candidates[0].idx,drag);
    else render();
  }
  function removeFromSource(d){
    if(d.source==='tableau')state.tableau[d.sourceIndex].splice(d.index,d.group.length);
    else if(d.source==='waste')state.waste.pop();
    else state.foundations[d.sourceIndex].pop();
  }
  function flipNewTopIfNeeded(col){ if(col?.length&&!col.at(-1).faceUp)col.at(-1).faceUp=true; }
  function executeDrop(type,idx,d){
    pushHistory();
    removeFromSource(d);
    if(type==='foundation')state.foundations[idx].push(d.group[0]);
    else state.tableau[idx].push(...d.group);
    if(d.source==='tableau')flipNewTopIfNeeded(state.tableau[d.sourceIndex]);
    state.moves++;
    render();
  }
  function canPlaceOnFoundation(card,idx){
    if (suits[idx] !== card.suit) return false;
    const f=state.foundations[idx];
    return f.length ? card.rank===f.at(-1).rank+1 : card.rank===1;
  }
  function foundationIndexForSuit(suit){ return suits.indexOf(suit); }
  function canPlaceOnTableau(group,idx,d){
    if(d&&d.source==='tableau'&&d.sourceIndex===idx)return false;
    const col=state.tableau[idx], card=group[0];
    return col.length?col.at(-1).faceUp&&col.at(-1).color!==card.color&&col.at(-1).rank===card.rank+1:card.rank===13;
  }
  function tryAutoMove(d){
    const card=d.group[0];
    if(d.group.length===1){
      const fIdx = foundationIndexForSuit(card.suit);
      if(canPlaceOnFoundation(card,fIdx)){ executeDrop('foundation',fIdx,d); return; }
    }
    const valid=[];
    for(let i=0;i<7;i++)if(canPlaceOnTableau(d.group,i,d))valid.push(i);
    if(valid.length===1)executeDrop('tableau',valid[0],d);
  }

  // ---------- Auto-Solve mit sichtbarer Animation ----------
  function findNextAutoSolveMove(){
    if(state.waste.length>0){
      const card=state.waste[state.waste.length-1];
      const fIdx=foundationIndexForSuit(card.suit);
      if(canPlaceOnFoundation(card,fIdx)) return {source:'waste', col:null, fIdx};
    }
    for(let col=0; col<7; col++){
      const pile=state.tableau[col];
      if(pile.length===0) continue;
      const card=pile[pile.length-1];
      if(!card.faceUp) continue;
      const fIdx=foundationIndexForSuit(card.suit);
      if(canPlaceOnFoundation(card,fIdx)) return {source:'tableau', col, fIdx};
    }
    return null;
  }

  function getSourceCardEl(move){
    if(move.source==='waste'){
      return document.querySelector(`.card[data-source="waste"][data-card-index="${state.waste.length-1}"]`);
    } else {
      return document.querySelector(`.card[data-source="tableau"][data-source-index="${move.col}"][data-card-index="${state.tableau[move.col].length-1}"]`);
    }
  }

  function autoSolveStep(){
    if(!autoSolving) return;
    const move = findNextAutoSolveMove();
    if(!move){ autoSolving=false; render(); return; }

    const cardEl = getSourceCardEl(move);
    const foundationEl = topRow.querySelectorAll('.foundation')[move.fIdx];

    if(cardEl && foundationEl){
      const cardRect = cardEl.getBoundingClientRect();
      const targetRect = foundationEl.getBoundingClientRect();
      const clone = cardEl.cloneNode(true);
      clone.classList.add('auto-move-clone');
      clone.style.position='fixed';
      clone.style.left = `${cardRect.left}px`;
      clone.style.top = `${cardRect.top}px`;
      clone.style.width = `${cardRect.width}px`;
      clone.style.height = `${cardRect.height}px`;
      clone.style.margin='0';
      clone.style.zIndex='2000';
      clone.style.transition='left .22s ease, top .22s ease';
      document.body.append(clone);
      cardEl.style.visibility='hidden';

      requestAnimationFrame(()=>{
        clone.style.left = `${targetRect.left}px`;
        clone.style.top = `${targetRect.top}px`;
      });

      setTimeout(()=>{
        clone.remove();
        performAutoSolveMove(move);
        if(autoSolving) setTimeout(autoSolveStep, 60);
      }, 230);
    } else {
      performAutoSolveMove(move);
      if(autoSolving) setTimeout(autoSolveStep, 180);
    }
  }

  function performAutoSolveMove(move){
    let card;
    if(move.source==='waste') card = state.waste.pop();
    else card = state.tableau[move.col].pop();
    state.foundations[move.fIdx].push(card);
    state.moves++;
    render();
    if(state.foundations.every(f=>f.length===13)){
      autoSolving=false;
      checkWin();
    }
  }

  function autoSolve(){
    if(autoSolving) return;
    autoSolving = true;
    solveBtn?.classList.add('hidden');
    autoSolveStep();
  }

  function checkWin(){
    if(state.foundations.every(f=>f.length===13)){
      clearInterval(timer);
      if(winStats)winStats.textContent=`Züge: ${state.moves} · Zeit: ${timerEl?.textContent||'00:00'}`;
      winOverlay?.classList.add('show');
    }
  }

  document.getElementById('newGameBtn')?.addEventListener('click',newGame);
  document.getElementById('winNewGame')?.addEventListener('click',newGame);
  document.getElementById('undoBtn')?.addEventListener('click',undo);
  solveBtn?.addEventListener('click',autoSolve);
  window.addEventListener('resize',render);
  newGame();

  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
})();