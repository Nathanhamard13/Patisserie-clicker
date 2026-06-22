'use strict';

// ============================================================
// DONNÉES
// ============================================================

const PALIERS = [
  { seuil: 0,       nom: "Pâtisserie de quartier", image: "assets/img/gateaum.png",          accent: "#c97b8f", accentDark: "#a85e72", accentLight: "#f5dde3", fond: "assets/img/fond-patisserie.jpg" },
  { seuil: 1000,    nom: "Salon de thé",           image: "assets/img/gateau-palier2.png",    accent: "#7a9484", accentDark: "#5e7868", accentLight: "#d5e8e0", fond: "assets/img/fond-palier2.jpg"   },
  { seuil: 10000,   nom: "Boulangerie réputée",    image: "assets/img/gateau-palier3.png",    accent: "#b8956a", accentDark: "#8f6e47", accentLight: "#f0e0cc", fond: "assets/img/fond-palier3.jpg"   },
  { seuil: 100000,  nom: "Empire pâtissier",       image: "assets/img/gateau-palier4.png",    accent: "#8b3a4e", accentDark: "#6d2037", accentLight: "#f0c8d0", fond: "assets/img/fond-palier4.jpg"   },
  { seuil: 1000000, nom: "Multinationale",         image: "assets/img/gateau-palier5.png",    accent: "#d4a84a", accentDark: "#a87d28", accentLight: "#f5e8c0", fond: "assets/img/fond-palier5.jpg"   },
];

// Fond de secours si l'image d'un palier n'existe pas encore
const FOND_FALLBACK = "assets/img/fond-patisserie.png";

const UPGRADES = [
  { id: "multiplier",  nom: "Multiplicateur",   desc: "+1 à chaque clic",            prixBase: 50,      debloque: 0,       icone: "assets/img/fouetm.png",             effet: "clic"   },
  { id: "autoclic",    nom: "Autoclic",         desc: "+1 gâteau par seconde",       prixBase: 500,     debloque: 100,     icone: "assets/img/timerm.png",             effet: "passif", mps: 1    },
  { id: "bonus",       nom: "Bonus Double",     desc: "×2 sur les clics, 30 s",     prixBase: 5000,    debloque: 1000,    icone: "assets/img/bonusm.png",             effet: "bonus"  },
  { id: "apprenti",    nom: "Apprenti",         desc: "+5 gâteaux par seconde",      prixBase: 1000,    debloque: 200,     icone: "assets/img/icone-apprenti.png",     effet: "passif", mps: 5    },
  { id: "four",        nom: "Four",             desc: "+50 gâteaux par seconde",     prixBase: 12000,   debloque: 5000,    icone: "assets/img/icone-four.png",         effet: "passif", mps: 50   },
  { id: "boulangerie", nom: "Boulangerie",      desc: "+400 gâteaux par seconde",    prixBase: 130000,  debloque: 50000,   icone: "assets/img/icone-boulangerie.png",  effet: "passif", mps: 400  },
  { id: "usine",       nom: "Usine",            desc: "+3000 gâteaux par seconde",   prixBase: 1400000, debloque: 500000,  icone: "assets/img/icone-usine.png",        effet: "passif", mps: 3000 },
];
 
// ============================================================
// ÉTAT
// ============================================================

let score        = 0;
let totalProduit = 0;
let clicsManuels = 0;
let chronoMs     = 0;
let premierClic  = false;
let mpsTotal     = 0;
let bonusActif   = false;
let bonusIntervalId = null;
let palierIdx    = 0;
let tickCount    = 0;

// Nombre d'achats par upgrade { id → n }
const upgradeState = {};
UPGRADES.forEach(u => { upgradeState[u.id] = 0; });

// IDs des upgrades actuellement affichées dans le DOM
const visibleUpgrades = new Set();

// ============================================================
// DOM
// ============================================================

const elAffichage  = document.querySelector('#affichage');
const btnClic      = document.querySelector('#clic');
const cakeImg      = document.querySelector('#cake-img');
const shopList     = document.querySelector('#shop-list');
const elPalierNom  = document.querySelector('#palier-nom');
const elMPS        = document.querySelector('#stat-mps');
const elMPC        = document.querySelector('#stat-mpc');
const elTotal      = document.querySelector('#stat-total');
const elClics      = document.querySelector('#stat-clics');
const elChrono     = document.querySelector('#stat-chrono');
const elBanner     = document.querySelector('#palier-banner');
const elBannerText = document.querySelector('#palier-banner-text');
const floatCont    = document.querySelector('#floats-container');
const clickZone    = document.querySelector('.click-zone');

// ============================================================
// UTILITAIRES
// ============================================================

const fmt = n => Math.floor(n).toLocaleString('fr-FR');

function prixUpgrade(u) {
  return Math.ceil(u.prixBase * Math.pow(1.15, upgradeState[u.id]));
}

function getMPC() {
  return (1 + upgradeState['multiplier']) * (bonusActif ? 2 : 1);
}

function recalcMPS() {
  mpsTotal = UPGRADES
    .filter(u => u.effet === 'passif')
    .reduce((sum, u) => sum + u.mps * upgradeState[u.id], 0);
}

function getPalierIndex(total) {
  let idx = 0;
  for (let i = 0; i < PALIERS.length; i++) {
    if (total >= PALIERS[i].seuil) idx = i;
    else break;
  }
  return idx;
}

// ============================================================
// AFFICHAGE
// ============================================================

function updateScoreDisplay() {
  elAffichage.textContent = fmt(score);
}

function updateStats() {
  elMPS.textContent   = fmt(mpsTotal);
  elMPC.textContent   = fmt(getMPC());
  elTotal.textContent = fmt(totalProduit);
  elClics.textContent = fmt(clicsManuels);

  if (premierClic) {
    const sec = Math.floor(chronoMs / 1000);
    const mm  = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss  = String(sec % 60).padStart(2, '0');
    elChrono.textContent = `${mm}:${ss}`;
  }
}

// ============================================================
// FLOATS "+N"
// ============================================================

function afficherFloat(valeur, x, y) {
  const el = document.createElement('div');
  el.className = 'float-text';
  el.textContent = `+${fmt(valeur)}`;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  floatCont.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function afficherFloatClic() {
  const rect = btnClic.getBoundingClientRect();
  const x = rect.left + rect.width  / 2 + (Math.random() - 0.5) * 60;
  const y = rect.top  + rect.height / 2 * Math.random();
  afficherFloat(getMPC(), x, y);
}

function afficherFloatPassif() {
  if (mpsTotal <= 0) return;
  const rect  = btnClic.getBoundingClientRect();
  const angle  = Math.random() * Math.PI * 2;
  // Confiné autour du gâteau : rayon max 80px depuis le centre
  const radius = 30 + Math.random() * 50;
  const cx = rect.left + rect.width  / 2;
  const cy = rect.top  + rect.height / 2;
  afficherFloat(mpsTotal, cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
}

// ============================================================
// CLIC PRINCIPAL
// ============================================================

btnClic.addEventListener('click', () => {
  if (!premierClic) premierClic = true;

  const gain = getMPC();
  score        += gain;
  totalProduit += gain;
  clicsManuels++;

  updateScoreDisplay();
  afficherFloatClic();

  // Animation wobble
  btnClic.classList.remove('clicked');
  void btnClic.offsetWidth;
  btnClic.classList.add('clicked');
  btnClic.addEventListener('animationend', () => btnClic.classList.remove('clicked'), { once: true });
});

// ============================================================
// BOUTIQUE — GÉNÉRATION DYNAMIQUE
// ============================================================

function renderUpgradeCard(u) {
  const card = document.createElement('div');
  card.className = 'card card-new';
  card.id = `card-${u.id}`;

  card.innerHTML = `
    <img src="${u.icone}" alt="" class="card-icon" aria-hidden="true">
    <div class="card-body">
      <p class="card-title">${u.nom}</p>
      <p class="card-desc">${u.desc}</p>
      <p class="card-possede">Possédé : <span id="possede-${u.id}">${upgradeState[u.id]}</span></p>
      <button id="btn-${u.id}" disabled>Acheter — ${fmt(prixUpgrade(u))}</button>
    </div>
  `;

  shopList.appendChild(card);
  card.addEventListener('animationend', () => card.classList.remove('card-new'), { once: true });
  document.querySelector(`#btn-${u.id}`).addEventListener('click', () => acheterUpgrade(u));
}

function checkNewUpgrades() {
  for (const u of UPGRADES) {
    if (!visibleUpgrades.has(u.id) && totalProduit >= u.debloque) {
      visibleUpgrades.add(u.id);
      renderUpgradeCard(u);
    }
  }
}

function updateShopButtons() {
  for (const u of UPGRADES) {
    if (!visibleUpgrades.has(u.id)) continue;

    const btn     = document.querySelector(`#btn-${u.id}`);
    const possede = document.querySelector(`#possede-${u.id}`);
    if (!btn) continue;

    if (possede) possede.textContent = upgradeState[u.id];

    // Ne pas toucher au bouton bonus pendant le décompte
    if (u.id === 'bonus' && bonusActif) continue;

    const prix = prixUpgrade(u);
    btn.textContent = `Acheter — ${fmt(prix)}`;
    btn.disabled    = score < prix;
  }
}

// ============================================================
// ACHATS
// ============================================================

function acheterUpgrade(u) {
  const prix = prixUpgrade(u);
  if (score < prix) return;

  score -= prix;
  upgradeState[u.id]++;

  if (u.effet === 'passif') {
    recalcMPS();
    rebuildSatellites();
  } else if (u.effet === 'bonus') {
    activerBonus(u);
  }
  // 'clic' : getMPC() lit upgradeState['multiplier'] directement, rien d'autre à faire

  updateScoreDisplay();
  sauvegarder();
}

// ============================================================
// BONUS
// ============================================================

function activerBonus(u) {
  bonusActif = true;
  let secondes = 30;

  const btn = document.querySelector(`#btn-${u.id}`);
  if (btn) btn.disabled = true;

  const rafraichir = () => {
    if (btn) btn.textContent = `Bonus actif — ${secondes}s`;
  };
  rafraichir();

  bonusIntervalId = setInterval(() => {
    secondes--;
    if (secondes <= 0) {
      clearInterval(bonusIntervalId);
      bonusActif = false;
      // Remettre le libellé normal
      if (btn) {
        const prix = prixUpgrade(u);
        btn.textContent = `Acheter — ${fmt(prix)}`;
        btn.disabled    = score < prix;
      }
    } else {
      rafraichir();
    }
  }, 1000);
}

// ============================================================
// CURSEURS ORBITAUX
// ============================================================

function rebuildOrbitCursors(n) {
  cakeStage.querySelectorAll('.cursor-orbit').forEach(el => el.remove());

  if (n === undefined) n = upgradeState['autoclic'];
  for (let i = 0; i < n; i++) {
    const orbit = document.createElement('div');
    orbit.className = 'cursor-orbit';
    // Délai négatif pour répartir uniformément sur le cercle
    orbit.style.animationDelay = `-${(i * 8) / n}s`;

    const img = document.createElement('img');
    img.className = 'cursor-hand';
    img.src = 'assets/img/autoclic.png';
    img.alt = '';

    orbit.appendChild(img);
    cakeStage.appendChild(orbit);
  }
}

// ============================================================
// SATELLITES — refonte « factory floor »
// Le gâteau (+ curseurs autoclic orbitaux) occupe le haut de la zone.
// Toutes les autres upgrades passives sont alignées en rangées
// thématiques dans un bandeau horizontal en bas.
// Plafonds individuels par type, aucun plafond global.
// ============================================================

let cakeStage    = null;   // englobe le gâteau + les curseurs orbitaux
let factoryFloor = null;   // bandeau du bas
const factoryRows = {};    // type → élément de rangée
let usineEls       = [];
let boulangerieEls = [];

function initSatellites() {
  // Scène du gâteau (haut, centrée) — on y déplace le bouton existant
  cakeStage = document.createElement('div');
  cakeStage.className = 'cake-stage';
  clickZone.insertBefore(cakeStage, clickZone.firstChild);
  cakeStage.appendChild(btnClic);

  // Bandeau « factory floor » (bas) avec une rangée par type
  factoryFloor = document.createElement('div');
  factoryFloor.className = 'factory-floor';
  ['apprenti', 'four', 'boulangerie', 'usine'].forEach(type => {
    const row = document.createElement('div');
    row.className = `factory-row factory-row-${type}`;
    factoryFloor.appendChild(row);
    factoryRows[type] = row;
  });
  clickZone.appendChild(factoryFloor);
}

function rebuildSatellites() {
  // Plafonds individuels (visuels uniquement — le calcul MPS n'est jamais affecté)
  const nCursors  = Math.min(upgradeState['autoclic'],    20);
  const nApprenti = Math.min(upgradeState['apprenti'],    15);
  const nFour     = Math.min(upgradeState['four'],         8);
  const nBoulang  = Math.min(upgradeState['boulangerie'],  8);
  const nUsine    = Math.min(upgradeState['usine'],        5);

  // --- Curseurs autoclic : orbite autour du gâteau (inchangé) ---
  rebuildOrbitCursors(nCursors);

  // --- Réinitialisation des rangées ---
  usineEls       = [];
  boulangerieEls = [];
  Object.values(factoryRows).forEach(row => { row.innerHTML = ''; });

  // Apprentis : alignés, léger bobbing vertical décalé
  for (let i = 0; i < nApprenti; i++) {
    const img = document.createElement('img');
    img.className = 'sat-apprenti';
    img.src = 'assets/img/icone-apprenti.png';
    img.alt = '';
    img.style.animationDelay = `${(i % 6) * 0.2}s`;
    factoryRows.apprenti.appendChild(img);
  }

  // Fours : alignés, avec petite fumée animée au-dessus
  for (let i = 0; i < nFour; i++) {
    const wrap = document.createElement('div');
    wrap.className = 'sat-four';
    const img = document.createElement('img');
    img.src = 'assets/img/icone-four.png';
    img.alt = '';
    wrap.appendChild(img);
    for (let s = 0; s < 2; s++) {
      const sm = document.createElement('span');
      sm.className = 'smoke';
      sm.style.left = `${32 + s * 24}%`;
      sm.style.animationDelay = `${s * 1.2}s`;
      wrap.appendChild(sm);
    }
    factoryRows.four.appendChild(wrap);
  }

  // Boulangeries : alignées, ka-ching « +N » au-dessus de chaque caisse
  for (let i = 0; i < nBoulang; i++) {
    const img = document.createElement('img');
    img.className = 'sat-boulangerie';
    img.src = 'assets/img/icone-boulangerie.png';
    img.alt = '';
    factoryRows.boulangerie.appendChild(img);
    boulangerieEls.push(img);
  }

  // Usines : nettes, 100% opaques, tremblement subtil périodique
  for (let i = 0; i < nUsine; i++) {
    const img = document.createElement('img');
    img.className = 'sat-usine';
    img.src = 'assets/img/icone-usine.png';
    img.alt = '';
    factoryRows.usine.appendChild(img);
    usineEls.push(img);
  }
}

// "+N" doré qui s'élève depuis une boulangerie
const MPS_BOULANGERIE = (UPGRADES.find(u => u.id === 'boulangerie') || {}).mps || 0;

function emitKaching(el) {
  const rect = el.getBoundingClientRect();
  const k = document.createElement('div');
  k.className = 'float-kaching';
  k.textContent = `+${fmt(MPS_BOULANGERIE)}`;
  k.style.left = `${rect.left + rect.width / 2}px`;
  k.style.top  = `${rect.top}px`;
  floatCont.appendChild(k);
  k.addEventListener('animationend', () => k.remove(), { once: true });
}

// ============================================================
// FOND — crossfade entre paliers (2 calques superposés)
// ============================================================

const bgLayers = [];
let bgActive = 0;

function initBgLayers() {
  for (let i = 0; i < 2; i++) {
    const layer = document.createElement('div');
    layer.className = 'bg-layer';
    document.body.appendChild(layer);
    bgLayers.push(layer);
  }
}

// immediate = true → bascule sans fondu (au chargement)
function setFond(url, immediate) {
  const img = new Image();
  img.onload = () => appliquerFond(url, immediate);
  img.onerror = () => {
    // Image manquante : on retombe sur le fond de secours s'il diffère
    if (url !== FOND_FALLBACK) {
      const fb = new Image();
      fb.onload = () => appliquerFond(FOND_FALLBACK, immediate);
      fb.src = FOND_FALLBACK;
    }
  };
  img.src = url;
}

function appliquerFond(url, immediate) {
  const next = bgLayers[1 - bgActive];
  const curr = bgLayers[bgActive];
  next.style.backgroundImage = `url('${url}')`;

  if (immediate) {
    next.style.transition = 'none';
    next.style.opacity = '1';
    curr.style.opacity = '0';
    void next.offsetWidth;          // reflow
    next.style.transition = '';     // restaure la transition CSS
  } else {
    next.style.opacity = '1';
    curr.style.opacity = '0';
  }
  bgActive = 1 - bgActive;
}

// ============================================================
// PALIERS
// ============================================================

function appliquerPalier(idx, avecBanniere) {
  const p = PALIERS[idx];

  // Fond du body (fondu doux, immédiat au chargement)
  setFond(p.fond, !avecBanniere);

  // Transition de l'image du gâteau
  cakeImg.classList.add('cake-transition-out');
  setTimeout(() => {
    cakeImg.src = p.image;
    cakeImg.classList.remove('cake-transition-out');
    cakeImg.classList.add('cake-transition-in');
    cakeImg.addEventListener('animationend', () => cakeImg.classList.remove('cake-transition-in'), { once: true });
  }, 200);

  // Mise à jour des variables CSS d'accent
  const root = document.documentElement;
  root.style.setProperty('--accent',       p.accent);
  root.style.setProperty('--accent-dark',  p.accentDark);
  root.style.setProperty('--accent-light', p.accentLight);

  // Nom du palier dans le score
  elPalierNom.textContent = p.nom;

  if (avecBanniere) afficherBannerPalier(p.nom);
}

function checkPalier() {
  const idx = getPalierIndex(totalProduit);
  if (idx !== palierIdx) {
    palierIdx = idx;
    appliquerPalier(idx, true);
  }
}

function afficherBannerPalier(nom) {
  elBannerText.textContent = `Vous passez à : ${nom} !`;
  elBanner.classList.add('visible');
  setTimeout(() => elBanner.classList.remove('visible'), 3000);
}

// ============================================================
// BOUCLE PRINCIPALE — 100 ms
// ============================================================

setInterval(() => {
  tickCount++;

  // Production passive
  if (mpsTotal > 0) {
    const gain = mpsTotal / 10;
    score        += gain;
    totalProduit += gain;
  }

  // Chrono (démarre au premier clic)
  if (premierClic) chronoMs += 100;

  // Affichage
  updateScoreDisplay();
  updateStats();

  // Paliers + nouvelles upgrades
  checkPalier();
  checkNewUpgrades();
  updateShopButtons();

  // Animations toutes les secondes (curseurs autoclic + ka-ching boulangeries)
  if (tickCount % 10 === 0) {
    document.querySelectorAll('.cursor-hand').forEach(c => {
      c.classList.add('cursor-clicking');
      setTimeout(() => c.classList.remove('cursor-clicking'), 150);
    });
    if (mpsTotal > 0) afficherFloatPassif();
    boulangerieEls.forEach(emitKaching);
  }

  // Tremblement des usines toutes les 2 s
  if (tickCount % 20 === 0) {
    usineEls.forEach(u => {
      u.classList.add('usine-shake');
      setTimeout(() => u.classList.remove('usine-shake'), 500);
    });
  }

  // Sauvegarde toutes les 5 s
  if (tickCount % 50 === 0) sauvegarder();

}, 100);

// ============================================================
// SAUVEGARDE / CHARGEMENT
// ============================================================

const SAVE_KEY = 'patisserie-save';

function sauvegarder() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      score,
      totalProduit,
      clicsManuels,
      chronoMs,
      premierClic,
      upgrades: { ...upgradeState },
    }));
  } catch (_) { /* quota ou mode privé */ }
}

function chargerSauvegarde() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    score        = d.score        || 0;
    totalProduit = d.totalProduit || 0;
    clicsManuels = d.clicsManuels || 0;
    chronoMs     = d.chronoMs     || 0;
    premierClic  = d.premierClic  || false;
    Object.assign(upgradeState, d.upgrades || {});
  } catch (e) {
    console.warn('Sauvegarde corrompue, ignorée.', e);
  }
}

// ============================================================
// INITIALISATION
// ============================================================

(function init() {
  initBgLayers();
  initSatellites();
  chargerSauvegarde();
  recalcMPS();

  // Appliquer le palier courant (sans bannière au chargement)
  palierIdx = getPalierIndex(totalProduit);
  appliquerPalier(palierIdx, false);

  // Révéler les upgrades déjà débloquées
  UPGRADES.forEach(u => {
    if (totalProduit >= u.debloque) {
      visibleUpgrades.add(u.id);
      renderUpgradeCard(u);
    }
  });

  // Reconstruire tous les éléments visuels (curseurs + satellites)
  rebuildSatellites();

  updateScoreDisplay();
  updateStats();
  updateShopButtons();
})();

// ============================================================
// MODE DEBUG (discret) — Ctrl+Shift+D : +100 000 macarons
// ============================================================

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault();
    score        += 100000;
    totalProduit += 100000;
    updateScoreDisplay();
  }
});
