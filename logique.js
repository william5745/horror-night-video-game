// Mine 3D — logique pure : monde en grille 3D, strates de plus en plus profondes
(function (root) {
  'use strict';

  var PIOCHES = [
    { nom: 'Pioche en bois',    degats: 1,  cout: 0,    couleur: 0x8b5a2b },
    { nom: 'Pioche en pierre',  degats: 2,  cout: 50,   couleur: 0x8d8d8d },
    { nom: 'Pioche en fer',     degats: 4,  cout: 200,  couleur: 0xc0c0c8 },
    { nom: 'Pioche en or',      degats: 8,  cout: 600,  couleur: 0xffd700 },
    { nom: 'Pioche en diamant', degats: 16, cout: 2000, couleur: 0x4de8e8 }
  ];

  var BOTTES = [
    { nom: 'Chaussures usées',  vitesse: 1,    cout: 0 },
    { nom: 'Bottes en cuir',    vitesse: 1.35, cout: 80 },
    { nom: 'Bottes ferrées',    vitesse: 1.7,  cout: 300 },
    { nom: 'Bottes de vitesse', vitesse: 2.1,  cout: 900 }
  ];

  // coucheMin : profondeur (1 = surface) à partir de laquelle ce bloc apparaît
  // cleInv : si renseigné, le bloc donne une pépite dans l'inventaire au lieu de pièces directes
  var BLOCS = [
    { nom: 'Terre',             durete: 2,  valeur: 2,   couleur: 0x8b5a2b, coucheMin: 1, poids: 45, forme: 'boite',  cleInv: null },
    { nom: 'Pierre',            durete: 4,  valeur: 5,   couleur: 0x8d8d8d, coucheMin: 1, poids: 30, forme: 'boite',  cleInv: null },
    { nom: 'Minerai de cuivre', durete: 6,  valeur: 12,  couleur: 0xb87333, coucheMin: 2, poids: 25, forme: 'boite',  cleInv: 'cuivre' },
    { nom: 'Minerai de fer',    durete: 10, valeur: 30,  couleur: 0xd8d8e0, coucheMin: 3, poids: 20, forme: 'boite',  cleInv: 'fer' },
    { nom: 'Minerai d’or',      durete: 16, valeur: 80,  couleur: 0xffd700, coucheMin: 4, poids: 12, forme: 'boite',  cleInv: 'or' },
    { nom: 'Diamant',           durete: 28, valeur: 250, couleur: 0x4de8e8, coucheMin: 6, poids: 6,  forme: 'octaedre', cleInv: 'diamant' }
  ];

  var INVENTAIRE_CLE = ['cuivre', 'fer', 'or', 'diamant'];
  var NOMS_PEPITES = {
    cuivre: 'Pépite de cuivre', fer: 'Pépite de fer',
    or: 'Pépite d’or', diamant: 'Pépite de diamant'
  };
  // Prix de revente chez le marchand (par pépite)
  var VALEURS_MARCHAND = { cuivre: 15, fer: 40, or: 120, diamant: 400 };

  var TX = 10;          // colonnes en x
  var TZ = 10;          // colonnes en z
  var PROF = 8;         // niveaux de départ (y = 0 à -(PROF-1))

  var etat = {
    pieces: 0, pioche: 0, bottes: 0, profondeur: 1,
    blocs: {}, niveauGenere: 0,
    inventaire: { cuivre: 0, fer: 0, or: 0, diamant: 0 }
  };

  function cle(x, y, z) { return x + ',' + y + ',' + z; }

  function typeAleatoire(couche) {
    var total = 0, i;
    for (i = 0; i < BLOCS.length; i++) if (couche >= BLOCS[i].coucheMin) total += BLOCS[i].poids;
    var tirage = Math.random() * total;
    for (i = 0; i < BLOCS.length; i++) {
      if (couche >= BLOCS[i].coucheMin) {
        tirage -= BLOCS[i].poids;
        if (tirage <= 0) return i;
      }
    }
    return 0;
  }

  function ajouterBloc(x, y, z) {
    var couche = -y + 1;
    var t = typeAleatoire(couche);
    etat.blocs[cle(x, y, z)] = { type: t, pv: BLOCS[t].durete, maxPv: BLOCS[t].durete };
  }

  function genererMonde() {
    etat.blocs = {};
    for (var x = 0; x < TX; x++) {
      for (var z = 0; z < TZ; z++) {
        for (var y = -(PROF - 1); y <= 0; y++) ajouterBloc(x, y, z);
      }
    }
    etat.niveauGenere = -(PROF - 1);
  }

  function blocEn(x, y, z) { return etat.blocs[cle(x, y, z)] || null; }

  // Un coup de pioche sur le bloc (x, y, z)
  function frapper(x, y, z) {
    var b = blocEn(x, y, z);
    if (!b) return { casse: false };
    b.pv -= PIOCHES[etat.pioche].degats;
    if (b.pv <= 0) {
      delete etat.blocs[cle(x, y, z)];
      var prof = -y + 1;
      if (prof > etat.profondeur) etat.profondeur = prof;
      var cleInv = BLOCS[b.type].cleInv;
      if (cleInv) {
        etat.inventaire[cleInv]++;
        return { casse: true, pepite: cleInv, nom: BLOCS[b.type].nom, x: x, y: y, z: z };
      }
      etat.pieces += BLOCS[b.type].valeur;
      return { casse: true, valeur: BLOCS[b.type].valeur, nom: BLOCS[b.type].nom, x: x, y: y, z: z };
    }
    return { casse: false, pv: b.pv, maxPv: b.maxPv, nom: BLOCS[b.type].nom };
  }

  // Si tout le niveau le plus profond généré est cassé, on génère une strate plus bas
  function etendreSiNecessaire() {
    var y = etat.niveauGenere;
    var trouve = false;
    for (var k in etat.blocs) {
      if (parseInt(k.split(',')[1], 10) === y) { trouve = true; break; }
    }
    if (trouve || !Object.keys(etat.blocs).length) return false;
    etat.niveauGenere--;
    for (var x = 0; x < TX; x++) {
      for (var z = 0; z < TZ; z++) ajouterBloc(x, etat.niveauGenere, z);
    }
    return true;
  }

  function acheterPioche(i) {
    if (i <= etat.pioche || etat.pieces < PIOCHES[i].cout) return false;
    etat.pieces -= PIOCHES[i].cout;
    etat.pioche = i;
    return true;
  }

  function acheterBottes(i) {
    if (i <= etat.bottes || etat.pieces < BOTTES[i].cout) return false;
    etat.pieces -= BOTTES[i].cout;
    etat.bottes = i;
    return true;
  }

  // Revend toutes les pépites d'un type chez le marchand ; renvoie le total obtenu
  function vendreType(cleInv) {
    var n = etat.inventaire[cleInv] || 0;
    if (n <= 0) return 0;
    var total = n * VALEURS_MARCHAND[cleInv];
    etat.inventaire[cleInv] = 0;
    etat.pieces += total;
    return total;
  }

  // Revend tout l'inventaire ; renvoie le total obtenu
  function vendreToutPepites() {
    var total = 0;
    INVENTAIRE_CLE.forEach(function (c) { total += vendreType(c); });
    return total;
  }

  function sauvegarder() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('mine3d', JSON.stringify({
        pieces: etat.pieces, pioche: etat.pioche, bottes: etat.bottes,
        profondeur: etat.profondeur, inventaire: etat.inventaire
      }));
    } catch (e) { /* stockage indisponible : on ignore */ }
  }

  function charger() {
    try {
      if (typeof localStorage === 'undefined') return;
      var brut = localStorage.getItem('mine3d');
      if (brut) {
        var d = JSON.parse(brut);
        etat.pieces = d.pieces || 0;
        etat.pioche = d.pioche || 0;
        etat.bottes = d.bottes || 0;
        etat.profondeur = d.profondeur || 1;
        if (d.inventaire) {
          INVENTAIRE_CLE.forEach(function (c) { etat.inventaire[c] = d.inventaire[c] || 0; });
        }
      }
    } catch (e) { /* sauvegarde illisible : on repart à zéro */ }
    genererMonde();
  }

  // ---------- Clavier (AZERTY + QWERTY + flèches) ----------
  // Enregistre un événement clavier dans la table des touches (e.code + e.key)
  function enregistrerTouche(touches, e, enfoncee) {
    if (e.code) touches[e.code] = enfoncee;
    if (e.key) touches['key:' + String(e.key).toLowerCase()] = enfoncee;
  }

  function toucheEnfoncee(touches) {
    for (var i = 1; i < arguments.length; i++) {
      if (touches[arguments[i]]) return true;
    }
    return false;
  }

  // Traduit la table des touches en axes de déplacement { avant, droite }
  function axesDepuisTouches(touches) {
    var avant = 0, droite = 0;
    if (toucheEnfoncee(touches, 'KeyW', 'KeyZ', 'ArrowUp', 'key:w', 'key:z', 'key:arrowup')) avant += 1;
    if (toucheEnfoncee(touches, 'KeyS', 'ArrowDown', 'key:s', 'key:arrowdown')) avant -= 1;
    if (toucheEnfoncee(touches, 'KeyD', 'ArrowRight', 'key:d', 'key:arrowright')) droite += 1;
    if (toucheEnfoncee(touches, 'KeyA', 'KeyQ', 'ArrowLeft', 'key:a', 'key:q', 'key:arrowleft')) droite -= 1;
    return { avant: avant, droite: droite };
  }

  // ---------- Déplacement ----------
  // Vecteur de déplacement (normalisé) relatif à la direction de vue yaw
  function vecteurMouvement(yaw, avant, droite) {
    if (avant === 0 && droite === 0) return { mx: 0, mz: 0 };
    var len = Math.hypot(avant, droite);
    avant /= len; droite /= len;
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    var rx = Math.cos(yaw), rz = -Math.sin(yaw);
    return { mx: fx * avant + rx * droite, mz: fz * avant + rz * droite };
  }

  // Rotation cosmétique du modèle de personnage (ne touche PAS au yaw de la caméra,
  // sinon le personnage oscille d'avant en arrière quand on maintient une touche)
  function yawModele(mx, mz) {
    if (mx === 0 && mz === 0) return 0;
    return Math.atan2(mx, mz);
  }

  root.LOGIQUE = {
    PIOCHES: PIOCHES, BOTTES: BOTTES, BLOCS: BLOCS,
    TX: TX, TZ: TZ, PROF: PROF,
    INVENTAIRE_CLE: INVENTAIRE_CLE, NOMS_PEPITES: NOMS_PEPITES, VALEURS_MARCHAND: VALEURS_MARCHAND,
    etat: etat, cle: cle,
    vendreType: vendreType, vendreToutPepites: vendreToutPepites,
    genererMonde: genererMonde, blocEn: blocEn, frapper: frapper,
    etendreSiNecessaire: etendreSiNecessaire,
    acheterPioche: acheterPioche, acheterBottes: acheterBottes,
    sauvegarder: sauvegarder, charger: charger,
    enregistrerTouche: enregistrerTouche,
    axesDepuisTouches: axesDepuisTouches,
    vecteurMouvement: vecteurMouvement,
    yawModele: yawModele
  };
})(typeof window !== 'undefined' ? window : globalThis);
